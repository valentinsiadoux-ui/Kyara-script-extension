/*
 * Interface : un menu déroulant flottant en haut à droite (un élément par script), et un popover en trois étapes
 *   1. réglages  ->  2. aperçu (Confirmer / Modifier / Annuler)  ->  3. exécution (journal, Arrêter)
 */
(() => {
  const K = globalThis.KyaraExt;
  if (!K || window.top !== window || document.getElementById("kx-bar-host"))
    return;

  const MAX_LOGS = 500;
  const STEP_LABELS = {
    params: "1 · Réglages",
    loading: "2 · Aperçu",
    preview: "2 · Aperçu",
    running: "3 · Exécution",
    done: "3 · Terminé",
  };

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key.startsWith("on"))
        el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === "class") el.className = value;
      else if (key in el && typeof value !== "string") el[key] = value;
      else el.setAttribute(key, value === true ? "" : value);
    }
    el.append(...children.flat().filter((c) => c != null && c !== false));
    return el;
  }

  // ---------- Réglages mémorisés ----------
  const storage = globalThis.chrome?.storage?.local;
  const defaultsOf = (script) =>
    Object.fromEntries(
      script.params.map((p) => [p.key, structuredClone(p.default)]),
    );
  async function loadValues(script) {
    try {
      const key = `params:${script.id}`;
      const saved = (await storage?.get(key))?.[key] ?? {};
      return { ...defaultsOf(script), ...saved };
    } catch {
      return defaultsOf(script);
    }
  }
  function saveValues(script, values) {
    try {
      storage?.set({ [`params:${script.id}`]: values });
    } catch {
      /* stockage indisponible : réglages non mémorisés */
    }
  }

  // ---------- État de chaque script ----------
  // phase : params | loading | preview | running | done
  const sessions = new Map(
    K.scripts.map((s) => [
      s.id,
      {
        phase: "params",
        values: defaultsOf(s),
        controller: null,
        preview: null,
        excluded: new Set(),
        logs: [],
        statusText: "",
        error: null,
      },
    ]),
  );
  for (const s of K.scripts)
    loadValues(s).then((v) => {
      sessions.get(s.id).values = v;
      if (current === s.id && sessions.get(s.id).phase === "params") render();
    });
  const scriptOf = (id) => K.scripts.find((s) => s.id === id);
  let current = null;

  // ---------- Menu flottant (en haut à droite, par-dessus la page) ----------
  const barHost = h("div", { id: "kx-bar-host", class: "kx-bar-host" });
  const barRoot = barHost.attachShadow({ mode: "open" });
  const trigger = h(
    "button",
    {
      type: "button",
      class: "trigger",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      "aria-controls": "kx-menu",
      title: "Scripts Kyara",
      onClick: () => toggleMenu(),
    },
    h("span", { class: "logo", "aria-hidden": "true" }, "K"),
    h("span", { class: "lbl" }, "Scripts"),
    h("span", { class: "chev", "aria-hidden": "true" }, "▾"),
  );
  const menu = h(
    "div",
    {
      class: "menu",
      id: "kx-menu",
      role: "menu",
      "aria-label": "Scripts Kyara",
      hidden: true,
    },
    K.scripts.map((s) =>
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          "data-id": s.id,
          "aria-haspopup": "dialog",
          onClick: () => {
            toggleMenu(false);
            open(s.id);
          },
        },
        h("span", { class: "ic", "aria-hidden": "true" }, s.icon),
        h(
          "span",
          { class: "txt" },
          h("b", {}, s.name),
          h("small", {}, s.description),
        ),
      ),
    ),
  );
  barRoot.append(
    h("style", {}, K.styles),
    h("div", { class: "bar" }, trigger, menu),
  );

  function toggleMenu(force = menu.hidden) {
    menu.hidden = !force;
    trigger.setAttribute("aria-expanded", String(force));
    if (force) menu.querySelector("button")?.focus();
  }
  // Clic ailleurs ou Échap : le menu se referme.
  document.addEventListener("pointerdown", (e) => {
    if (!menu.hidden && !e.composedPath().includes(barHost)) toggleMenu(false);
  });
  menu.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll("button")];
    const i = items.indexOf(barRoot.activeElement);
    if (e.key === "Escape") {
      toggleMenu(false);
      trigger.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    }
  });

  function updateBar() {
    let any = false;
    for (const btn of menu.querySelectorAll("button")) {
      const running = sessions.get(btn.dataset.id).phase === "running";
      any ||= running;
      btn.querySelector(".dot")?.remove();
      if (running) btn.append(h("span", { class: "dot", title: "En cours" }));
    }
    trigger.querySelector(".dot")?.remove();
    if (any)
      trigger.append(
        h("span", { class: "dot", title: "Un script est en cours" }),
      );
  }

  let scheduled = false;
  // Le site (SvelteKit) peut réécrire le body : on se remet en place si on a été retiré.
  function placeBar() {
    scheduled = false;
    if (!barHost.isConnected) document.body.append(barHost);
    if (!popHost.isConnected) document.body.append(popHost);
  }

  // ---------- Popover ----------
  const popHost = h("div", { id: "kx-pop-host" });
  const popRoot = popHost.attachShadow({ mode: "open" });
  const pop = h("div", {
    class: "pop",
    popover: "manual",
    role: "dialog",
    "aria-labelledby": "kx-title",
  });
  popRoot.append(h("style", {}, K.styles), pop);
  document.body.append(popHost);
  const hasPopoverApi = typeof pop.showPopover === "function";

  const isOpen = () => pop.classList.contains("open");
  function open(id) {
    current = id;
    if (!popHost.isConnected) document.body.append(popHost);
    render();
    if (!isOpen()) {
      pop.classList.add("open");
      if (hasPopoverApi) pop.showPopover();
    }
    position();
    updateBar();
    pop.querySelector("input, select, .btn.primary")?.focus();
  }
  function close() {
    const s = sessions.get(current);
    // Fermer pendant le calcul de l'aperçu l'annule ; une exécution continue en arrière-plan.
    if (s?.phase === "loading") {
      s.controller.abort();
      s.phase = "params";
    }
    if (s?.phase === "preview") {
      s.phase = "params";
      s.preview = null;
    }
    pop.classList.remove("open");
    if (hasPopoverApi && pop.matches(":popover-open")) pop.hidePopover();
    updateBar();
    trigger.focus();
  }

  // Sous le menu, aligné à droite ; centré sur petit écran.
  function position() {
    const vw = innerWidth,
      vh = innerHeight;
    const w = Math.min(pop.classList.contains("wide") ? 1000 : 640, vw - 32);
    const r = trigger.getBoundingClientRect();
    const left = vw < 640 ? (vw - w) / 2 : Math.max(16, r.right - w);
    const top = r.bottom + 8;
    Object.assign(pop.style, {
      left: `${left}px`,
      top: `${top}px`,
      maxHeight: `${Math.min(760, vh - top - 16)}px`,
    });
  }
  addEventListener("resize", () => isOpen() && position());
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
  // Recharger la page arrête les scripts en cours : on prévient.
  addEventListener("beforeunload", (e) => {
    if ([...sessions.values()].some((s) => s.phase === "running"))
      e.preventDefault();
  });

  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(placeBar);
  }).observe(document.body, { childList: true, subtree: true });
  placeBar();

  // Répond au diagnostic de la popup de l'extension.
  globalThis.chrome?.runtime?.onMessage?.addListener((msg, _sender, reply) => {
    if (msg !== "kx-status") return;
    reply({
      scripts: K.scripts.length,
      running: K.scripts
        .filter((s) => sessions.get(s.id).phase === "running")
        .map((s) => s.name),
    });
  });

  // ---------- Rendu ----------
  function render() {
    const script = scriptOf(current);
    const s = sessions.get(current);
    const view = {
      params: viewParams,
      loading: viewLoading,
      preview: viewPreview,
      running: viewRun,
      done: viewRun,
    }[s.phase];
    const { body, footer } = view(script, s);
    // Aperçu avec beaucoup de colonnes : popover élargi.
    pop.classList.toggle(
      "wide",
      s.phase === "preview" && s.preview?.columns.length > 6,
    );
    if (isOpen()) requestAnimationFrame(position);
    pop.replaceChildren(
      h(
        "div",
        { class: "hd" },
        h("span", { class: "ic", "aria-hidden": "true" }, script.icon),
        h(
          "div",
          {},
          h("h2", { id: "kx-title" }, script.name),
          h("p", {}, script.description),
        ),
        h(
          "span",
          { class: "step" },
          script.skipPreview
            ? { params: "Réglages", running: "Préparation", done: "Terminé" }[
                s.phase
              ]
            : STEP_LABELS[s.phase],
        ),
        h(
          "button",
          {
            class: "x",
            type: "button",
            "aria-label": "Fermer",
            onClick: close,
          },
          "✕",
        ),
      ),
      body,
      h("div", { class: "ft" }, footer),
    );
  }
  const rerender = (id) => {
    if (current === id && isOpen()) render();
    updateBar();
  };

  // 1. Réglages
  function field(p, value) {
    const help = p.help ? h("small", {}, p.help) : null;
    if (p.type === "boolean") {
      return h(
        "label",
        { class: "field check" },
        h("input", { type: "checkbox", name: p.key, checked: !!value }),
        h("span", {}, p.label, help ? h("br") : null, help),
      );
    }
    let control;
    if (p.type === "select") {
      control = h(
        "select",
        { name: p.key },
        p.options.map(([v, label]) =>
          h("option", { value: v, selected: v === value }, label),
        ),
      );
    } else if (p.type === "modeToggle") {
      const input = h("input", {
        type: "checkbox",
        name: p.key,
        checked: !!value,
        hidden: true,
      });
      const buttons = [
        [false, "Échange"],
        [true, "Achat"],
      ].map(([buy, label]) =>
        h(
          "button",
          {
            type: "button",
            class: "mode-option",
            "aria-pressed": String(!!value === buy),
            onClick: () => {
              input.checked = buy;
              buttons.forEach((b, i) =>
                b.setAttribute("aria-pressed", String(Boolean(i) === buy)),
              );
              input.dispatchEvent(new Event("change", { bubbles: true }));
            },
          },
          label,
        ),
      );
      control = h(
        "div",
        { class: "mode-toggle", role: "group", "aria-label": p.label },
        input,
        buttons,
      );
    } else if (p.type === "raritySet") {
      const colors = {
        C: "#B5B1BB",
        U: "#3FBF7F",
        R: "#4D9BFF",
        E: "#B072FF",
        L: "#F5C518",
        M: "#FF4D2E",
      };
      const order = ["C", "U", "R", "E", "L", "M"];
      const inputs = Object.fromEntries(
        order.map((r) => [
          r,
          h("input", {
            type: "checkbox",
            name: p.key + "." + r,
            checked: (value ?? []).includes(r),
            hidden: true,
          }),
        ]),
      );
      const caption = h("span", {
        class: "rar-caption",
        "aria-live": "polite",
      });
      const refresh = () => {
        const selected = order.filter((r) => inputs[r].checked);
        all.setAttribute(
          "aria-pressed",
          String(selected.length === order.length),
        );
        buttons.forEach((b, i) =>
          b.setAttribute("aria-pressed", String(inputs[order[i]].checked)),
        );
        caption.textContent =
          selected.length === order.length
            ? "Toutes"
            : selected.length
              ? selected.map((r) => K.LABELS[r]).join(" · ")
              : "Aucune";
      };
      const all = h(
        "button",
        {
          type: "button",
          class: "rar-button all",
          title: "Toutes les raretés",
          onClick: () => {
            const checked = !order.every((r) => inputs[r].checked);
            order.forEach((r) => {
              inputs[r].checked = checked;
            });
            refresh();
            inputs.C.dispatchEvent(new Event("change", { bubbles: true }));
          },
        },
        h("span", { class: "rar-glyph", "aria-hidden": "true" }, "✦"),
        "Toutes",
      );
      let drag = null;
      const notify = () => {
        refresh();
        inputs.C.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const applyRange = (index) => {
        const low = Math.min(drag.start, index),
          high = Math.max(drag.start, index);
        order.forEach((r, i) => {
          inputs[r].checked =
            i >= low && i <= high ? drag.checked : drag.initial[i];
        });
        notify();
      };
      const buttons = order.map((r, index) =>
        h(
          "button",
          {
            type: "button",
            class: "rar-button",
            title: K.LABELS[r],
            "aria-label": K.LABELS[r],
            style: "--rc:" + colors[r],
            onPointerDown: (e) => {
              if (e.button !== 0 || e.isPrimary === false) return;
              drag = {
                id: e.pointerId,
                start: index,
                checked: !inputs[r].checked,
                initial: order.map((r) => inputs[r].checked),
              };
              bar.setPointerCapture(e.pointerId);
              applyRange(index);
            },
            onClick: (e) => {
              // Les clics souris/tactiles ont déjà été traités par pointerdown.
              if (e?.detail > 0) return;
              inputs[r].checked = !inputs[r].checked;
              notify();
            },
          },
          h("span", { class: "rar-glyph", "aria-hidden": "true" }, r),
        ),
      );
      const finish = (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        drag = null;
        if (bar.hasPointerCapture(e.pointerId))
          bar.releasePointerCapture(e.pointerId);
      };
      const bar = h(
        "div",
        {
          class: "rar-bar",
          role: "group",
          "aria-label": "Raretés — cliquer ou glisser pour sélectionner",
          onPointerMove: (e) => {
            if (!drag || drag.id !== e.pointerId) return;
            const index = buttons.findIndex((b) => {
              const rect = b.getBoundingClientRect();
              return (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
              );
            });
            if (index >= 0) applyRange(index);
          },
          onPointerUp: finish,
          onPointerCancel: (e) => {
            if (!drag || drag.id !== e.pointerId) return;
            order.forEach((r, i) => {
              inputs[r].checked = drag.initial[i];
            });
            notify();
            finish(e);
          },
          onLostPointerCapture: () => {
            drag = null;
          },
        },
        all,
        buttons,
      );
      control = h(
        "div",
        { class: "rar-sheet" },
        Object.values(inputs),
        bar,
        caption,
      );
      refresh();
    } else if (p.type === "rarityMap") {
      control = h(
        "div",
        { class: "rmap" },
        K.RARITIES.map((r) =>
          h(
            "label",
            { title: K.LABELS[r] },
            r,
            h("input", {
              type: "number",
              name: `${p.key}.${r}`,
              min: 0,
              step: "any",
              value: value?.[r] ?? "",
            }),
          ),
        ),
      );
    } else if (p.type === "number") {
      control = h("input", {
        type: "number",
        name: p.key,
        required: true,
        min: p.min,
        max: p.max,
        step: p.step ?? 1,
        value: value ?? "",
      });
    } else {
      control = h("input", {
        type: "text",
        name: p.key,
        required: true,
        value: value ?? "",
      });
    }
    return h(
      ["raritySet", "modeToggle"].includes(p.type) ? "div" : "label",
      { class: "field" },
      h("span", {}, p.label),
      control,
      help,
    );
  }

  function readForm(script, form) {
    const values = {};
    for (const p of script.params) {
      if (p.type === "boolean" || p.type === "modeToggle")
        values[p.key] = form.elements[p.key].checked;
      else if (p.type === "number")
        values[p.key] = Number(form.elements[p.key].value);
      else if (p.type === "raritySet") {
        values[p.key] = K.RARITIES.filter(
          (r) => form.elements[p.key + "." + r].checked,
        );
      } else if (p.type === "rarityMap") {
        values[p.key] = {};
        for (const r of K.RARITIES) {
          const raw = form.elements[`${p.key}.${r}`].value;
          if (raw !== "") values[p.key][r] = Number(raw);
        }
      } else values[p.key] = form.elements[p.key].value.trim();
    }
    return values;
  }

  function viewParams(script, s) {
    const renderField = (p) => {
      const node = field(p, s.values[p.key]);
      node.setAttribute("data-param", p.key);
      if (p.title) node.title = p.title;
      if (script.id === "preparer-echange" && p.key === "buyPercent")
        node.classList.add("purchase-price");
      return node;
    };
    const renderFields = (params) =>
      params.flatMap((p) => {
        if (script.id !== "preparer-echange") return [renderField(p)];
        if (["balanceMode", "maxGapPercent"].includes(p.key)) return [];
        if (p.key === "balance") {
          const mode = params.find((item) => item.key === "balanceMode");
          const gap = params.find((item) => item.key === "maxGapPercent");
          if (mode && gap)
            return [
              h(
                "div",
                { class: "balance-settings" },
                renderField(p),
                h(
                  "div",
                  { class: "balance-fields" },
                  renderField(mode),
                  renderField(gap),
                ),
              ),
            ];
        }
        return [renderField(p)];
      });
    const basic = script.params.filter((p) => p.group !== "advanced");
    const advanced = script.params.filter((p) => p.group === "advanced");
    const form = h(
      "form",
      {
        id: "kx-form",
        novalidate: false,
        onSubmit: (e) => {
          e.preventDefault();
          if (!form.reportValidity()) return;
          s.values = readForm(script, form);
          saveValues(script, s.values);
          if (script.skipPreview) startRun(script, s);
          else startPreview(script, s);
        },
      },
      s.error
        ? h(
            "ul",
            { class: "warn-list" },
            h("li", {}, `L'aperçu a échoué : ${s.error}`),
          )
        : null,
      h("div", { class: "grid" }, renderFields(basic)),
      advanced.length
        ? h(
            "details",
            {},
            h("summary", {}, "Réglages avancés"),
            h("div", { class: "grid" }, renderFields(advanced)),
          )
        : null,
    );
    const syncEnabled = () => {
      const values = readForm(script, form);
      for (const p of script.params) {
        const node = form.querySelector('[data-param="' + p.key + '"]');
        const enabled =
          !p.enabledWhen ||
          Object.entries(p.enabledWhen).every(
            ([key, value]) => values[key] === value,
          );
        const showDisabled =
          script.id === "preparer-echange" &&
          values.buy === false &&
          (p.key === "balanceMode" ||
            (p.key === "maxGapPercent" && values.balanceMode === "value"));
        node.hidden = !enabled && !showDisabled;
        node.classList.toggle("inactive", !enabled && showDisabled);
        node.querySelectorAll("input, select, button").forEach((el) => {
          el.disabled = !enabled;
        });
      }
    };
    form.addEventListener("change", syncEnabled);
    syncEnabled();
    return {
      body: h("div", { class: "bd" }, form),
      footer: [
        h(
          "button",
          {
            class: "btn link left",
            type: "button",
            onClick: () => {
              s.values = defaultsOf(script);
              saveValues(script, s.values);
              render();
            },
          },
          "Valeurs par défaut",
        ),
        h(
          "button",
          { class: "btn", type: "button", onClick: close },
          "Annuler",
        ),
        h(
          "button",
          { class: "btn primary", type: "submit", form: "kx-form" },
          script.skipPreview ? "Préparer l’échange" : "Voir l'aperçu →",
        ),
      ],
    };
  }

  // 2. Aperçu
  function contextFor(id, s) {
    return K.createContext({
      signal: s.controller.signal,
      status: (text) => {
        s.statusText = text;
        if (current === id && isOpen()) {
          const el = pop.querySelector(".status-text");
          if (el) el.textContent = text;
        }
      },
      log: (msg, tone = "") => {
        const entry = { at: new Date(), msg, tone };
        s.logs.push(entry);
        if (s.logs.length > MAX_LOGS) s.logs.shift();
        console.log(
          `%c[Kyara · ${scriptOf(id).name}] ${msg}`,
          `color:${{ success: "#4ad991", warn: "#ffb347", error: "#ff6b6b", info: "#c9a3ff" }[tone] ?? "#7aa2ff"}`,
        );
        if (current === id && isOpen()) {
          const list = pop.querySelector(".log");
          if (!list) return;
          const stick =
            list.scrollTop + list.clientHeight >= list.scrollHeight - 20;
          list.querySelector(".empty")?.remove();
          list.append(logItem(entry));
          if (stick) list.scrollTop = list.scrollHeight;
        }
      },
    });
  }

  async function startPreview(script, s) {
    s.phase = "loading";
    s.error = null;
    s.statusText = "Préparation…";
    s.controller = new AbortController();
    const controller = s.controller;
    rerender(script.id);
    try {
      const result = await script.preview(contextFor(script.id, s), s.values);
      if (controller.signal.aborted) return;
      s.preview = result;
      s.excluded = new Set();
      s.phase = "preview";
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error(e);
      s.error = e.message;
      s.phase = "params";
    }
    rerender(script.id);
  }

  function viewLoading(script, s) {
    return {
      body: h(
        "div",
        { class: "bd" },
        h(
          "div",
          { class: "loading" },
          h("span", { class: "spin" }),
          h("span", { class: "status-text" }, s.statusText),
        ),
        h(
          "p",
          { class: "empty" },
          "Lecture seule : rien n'est publié pendant l'aperçu.",
        ),
      ),
      footer: [
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              s.controller.abort();
              s.phase = "params";
              render();
            },
          },
          "Annuler l'aperçu",
        ),
      ],
    };
  }

  function viewPreview(script, s) {
    const pv = s.preview;
    const selectable = pv.rows.filter((r) => r.selectable);
    const selectedCount = () =>
      selectable.filter((r) => !s.excluded.has(r.id)).length;
    const count = h("span", { class: "count left" });
    const confirmBtn = h(
      "button",
      {
        class: "btn primary",
        type: "button",
        onClick: () => startRun(script, s),
      },
      "Confirmer et lancer",
    );
    const all = h("input", { type: "checkbox", "aria-label": "Tout cocher" });
    const sync = () => {
      const n = selectedCount();
      count.textContent = pv.rows.length
        ? `${n}/${selectable.length} sélectionnée(s)`
        : "";
      confirmBtn.disabled = !pv.canRun || (selectable.length > 0 && n === 0);
      all.checked = n === selectable.length && n > 0;
      all.indeterminate = n > 0 && n < selectable.length;
    };
    // Remarque sous la première colonne de texte (nom de la carte…).
    const noteCol = Math.max(
      0,
      pv.columns.findIndex((c) => c.align !== "end"),
    );
    const rowEls = pv.rows.map((r) => {
      const tr = h(
        "tr",
        { class: r.selectable && s.excluded.has(r.id) ? "off" : "" },
        h(
          "td",
          { class: "sel" },
          r.selectable
            ? h("input", {
                type: "checkbox",
                checked: !s.excluded.has(r.id),
                "aria-label": "Inclure cette ligne",
                onChange: (e) => {
                  e.target.checked
                    ? s.excluded.delete(r.id)
                    : s.excluded.add(r.id);
                  tr.classList.toggle("off", !e.target.checked);
                  sync();
                },
              })
            : null,
        ),
        pv.columns.map((c, i) =>
          h(
            "td",
            { class: c.align === "end" ? "end" : "" },
            String(r.cells[c.key] ?? ""),
            i === noteCol && r.note
              ? h("span", { class: "note" }, r.note)
              : null,
          ),
        ),
      );
      if (!r.selectable) tr.classList.add("off");
      return tr;
    });
    all.addEventListener("change", () => {
      for (const r of selectable)
        all.checked ? s.excluded.delete(r.id) : s.excluded.add(r.id);
      render();
    });
    sync();
    return {
      body: h(
        "div",
        { class: "bd" },
        h("p", { class: "summary" }, pv.summary),
        pv.warnings?.length
          ? h(
              "ul",
              { class: "warn-list" },
              pv.warnings.map((w) => h("li", {}, w)),
            )
          : null,
        pv.rows.length
          ? h(
              "div",
              { class: "tbl-wrap" },
              h(
                "table",
                {},
                h(
                  "thead",
                  {},
                  h(
                    "tr",
                    {},
                    h("th", { class: "sel" }, selectable.length ? all : null),
                    pv.columns.map((c) =>
                      h(
                        "th",
                        { class: c.align === "end" ? "end" : "" },
                        c.label,
                      ),
                    ),
                  ),
                ),
                h("tbody", {}, rowEls),
              ),
            )
          : null,
      ),
      footer: [
        count,
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              s.phase = "params";
              s.preview = null;
              close();
            },
          },
          "Annuler",
        ),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onClick: () => {
              s.phase = "params";
              render();
            },
          },
          "← Modifier",
        ),
        confirmBtn,
      ],
    };
  }

  // 3. Exécution
  async function startRun(script, s) {
    s.phase = "running";
    s.logs = [];
    s.statusText = "Démarrage…";
    s.controller = new AbortController();
    const ctx = contextFor(script.id, s);
    const plan = { excludedIds: new Set(s.excluded), state: s.preview?.state };
    rerender(script.id);
    try {
      await script.run(ctx, s.values, plan);
    } catch (e) {
      if (!(e instanceof K.StoppedError)) {
        console.error(e);
        ctx.log(`✖ ${e.message}`, "error");
      }
    }
    if (s.controller.signal.aborted) ctx.log("Arrêté.", "warn");
    s.phase = "done";
    s.preview = null;
    rerender(script.id);
  }

  const logItem = ({ at, msg, tone }) =>
    h(
      "li",
      {},
      h("time", {}, at.toLocaleTimeString("fr-FR")),
      h("span", { class: tone }, msg),
    );

  function viewRun(script, s) {
    const running = s.phase === "running";
    const stopping = running && s.controller.signal.aborted;
    const list = h(
      "ul",
      { class: "log", "aria-live": "polite" },
      s.logs.length
        ? s.logs.map(logItem)
        : h("li", { class: "empty" }, "Aucun message pour l'instant."),
    );
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
    return {
      body: h(
        "div",
        { class: "bd" },
        h(
          "div",
          { class: `status${running ? "" : " done"}` },
          h("span", { class: "spin" }),
          h(
            "span",
            { class: "status-text" },
            running ? s.statusText : `Terminé. ${s.statusText}`,
          ),
        ),
        list,
      ),
      footer: running
        ? [
            h(
              "button",
              {
                class: "btn",
                type: "button",
                onClick: close,
                title: "Le script continue en arrière-plan",
              },
              "Masquer",
            ),
            h(
              "button",
              {
                class: "btn danger",
                type: "button",
                disabled: stopping,
                onClick: () => {
                  s.controller.abort();
                  render();
                },
              },
              stopping ? "Arrêt en cours…" : "Arrêter",
            ),
          ]
        : [
            h(
              "button",
              {
                class: "btn",
                type: "button",
                onClick: () => {
                  s.phase = "params";
                  close();
                },
              },
              "Fermer",
            ),
            h(
              "button",
              {
                class: "btn primary",
                type: "button",
                onClick: () => {
                  s.phase = "params";
                  render();
                },
              },
              "Nouveau lancement",
            ),
          ],
    };
  }
})();
