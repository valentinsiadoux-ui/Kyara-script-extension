/*
 * Interface : un menu déroulant flottant en haut à droite (un élément par script), et un popover en trois étapes
 *   1. réglages  ->  2. aperçu (Confirmer / Modifier / Annuler)  ->  3. exécution (journal, Arrêter)
 */
(() => {
  const K = globalThis.KyaraExt;
  if (!K || window.top !== window || document.getElementById("kx-bar-host"))
    return;

  const MAX_LOGS = 500;
  const CATEGORIES = ["Marché", "Échanges", "Comptoir", "Collection", "Suivi"];
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
      let saved = (await storage?.get(key))?.[key];
      // Réglages d'un ancien script fusionné dans celui-ci : repris une fois, ajoutés aux réglages actuels.
      for (const [oldId, map] of Object.entries(script.legacy ?? {})) {
        const oldKey = `params:${oldId}`,
          doneKey = `migrated:${oldId}`;
        const got = await storage?.get([oldKey, doneKey]);
        if (!got?.[oldKey] || got[doneKey]) continue;
        saved = { ...saved, ...map(got[oldKey]) };
        storage?.set({ [key]: saved, [doneKey]: true });
      }
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
  async function loadPresets(script) {
    try {
      const key = `presets:${script.id}`;
      return (await storage?.get(key))?.[key] ?? {};
    } catch {
      return {};
    }
  }
  function savePresets(script, presets) {
    try {
      storage?.set({ [`presets:${script.id}`]: presets });
    } catch {
      /* stockage indisponible */
    }
  }
  // Préférences du menu : position verticale, bouton réduit.
  async function loadUi() {
    try {
      return (await storage?.get("ui"))?.ui ?? {};
    } catch {
      return {};
    }
  }
  function saveUi(ui) {
    try {
      storage?.set({ ui });
    } catch {
      /* stockage indisponible */
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
        // Fin du dernier lancement : "done" | "error", affichée sur le menu tant qu'elle n'a pas été vue.
        outcome: null,
        seen: true,
        presets: {},
        preset: "",
      },
    ]),
  );
  for (const s of K.scripts)
    Promise.all([loadValues(s), loadPresets(s)]).then(([v, presets]) => {
      Object.assign(sessions.get(s.id), { values: v, presets });
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
      title: "Scripts Kyara — glisser pour déplacer",
      onClick: () => {
        // La fin d'un glisser n'ouvre pas le menu.
        if (drag?.moved) return void (drag = null);
        toggleMenu();
      },
      onPointerDown: (e) => {
        if (e.button !== 0) return;
        drag = { id: e.pointerId, y: e.clientY, top: barHost.getBoundingClientRect().top, moved: false };
        trigger.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dy) < 5) return;
        drag.moved = true;
        placeTop(drag.top + dy);
        if (isOpen()) position();
      },
      onPointerUp: (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        if (drag.moved) {
          ui.top = parseFloat(barHost.style.top);
          saveUi(ui);
        } else drag = null;
      },
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
    // Une rubrique par catégorie, dans l'ordre de CATEGORIES ; le reste à la fin.
    [...new Set([...CATEGORIES, ...K.scripts.map((s) => s.category ?? "Autres")])]
      .map((cat) => [cat, K.scripts.filter((s) => (s.category ?? "Autres") === cat)])
      .filter(([, scripts]) => scripts.length)
      .map(([cat, scripts]) =>
        h(
          "div",
          { class: "sec", role: "group", "aria-label": cat },
          h("div", { class: "sec-hd", "aria-hidden": "true" }, cat),
          scripts.map((s) =>
            h(
              "button",
              {
                type: "button",
                role: "menuitem",
                "data-id": s.id,
                "aria-haspopup": "dialog",
                title: s.description,
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
                h("small", {}, s.short ?? s.description),
              ),
            ),
          ),
        ),
      ),
    h(
      "div",
      { class: "sec" },
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          class: "collapse",
          onClick: () => {
            ui.collapsed = !ui.collapsed;
            saveUi(ui);
            applyUi();
            toggleMenu(false);
          },
        },
        h("span", { class: "ic", "aria-hidden": "true" }, "⇲"),
        h("span", { class: "txt" }, h("small", {}, "Réduire / agrandir le bouton")),
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

  // Point vert : en cours ; rouge : erreur non vue ; coche : terminé, non vu.
  function badgeOf(session) {
    if (session.phase === "running") return ["run", "En cours"];
    if (!session.seen && session.outcome === "error") return ["err", "Terminé avec une erreur"];
    if (!session.seen && session.outcome === "done") return ["ok", "Terminé"];
    return null;
  }
  function updateBar() {
    const badges = [];
    for (const btn of menu.querySelectorAll("button[data-id]")) {
      const badge = badgeOf(sessions.get(btn.dataset.id));
      btn.querySelector(".dot")?.remove();
      if (badge) {
        badges.push(badge[0]);
        btn.append(h("span", { class: `dot ${badge[0]}`, title: badge[1] }));
      }
    }
    trigger.querySelector(".dot")?.remove();
    const top = ["run", "err", "ok"].find((b) => badges.includes(b));
    if (top)
      trigger.append(
        h("span", {
          class: `dot ${top}`,
          title: { run: "Un script est en cours", err: "Un script a rencontré une erreur", ok: "Un script a terminé" }[top],
        }),
      );
  }

  // ---------- Position du bouton ----------
  let drag = null;
  let ui = {};
  function placeTop(top) {
    barHost.style.top = `${Math.round(Math.min(Math.max(8, top), innerHeight - 44))}px`;
  }
  function applyUi() {
    if (typeof ui.top === "number") placeTop(ui.top);
    trigger.classList.toggle("mini", !!ui.collapsed);
  }
  loadUi().then((saved) => {
    ui = saved;
    applyUi();
  });
  addEventListener("resize", () => typeof ui.top === "number" && placeTop(ui.top));

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
    sessions.get(id).seen = true;
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
            ? { params: "Réglages", running: "Exécution", done: "Terminé" }[
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

  // Bouton coloré d'une rareté (sélecteurs de raretés).
  const rarButton = (r, props = {}) =>
    h(
      "button",
      {
        type: "button",
        class: "rar-button",
        title: K.LABELS[r],
        "aria-label": K.LABELS[r],
        style: `--rc:${K.COLORS[r]}`,
        ...props,
      },
      h("span", { class: "rar-glyph", "aria-hidden": "true" }, r),
    );

  // Plusieurs raretés : clic ou glisser sur une plage, bouton Toutes.
  function raritySet(p, value) {
    const order = K.RARITIES_ASC;
    const inputs = Object.fromEntries(
      order.map((r) => [
        r,
        h("input", {
          type: "checkbox",
          name: `${p.key}.${r}`,
          checked: (value ?? []).includes(r),
          hidden: true,
        }),
      ]),
    );
    const caption = h("span", { class: "rar-caption", "aria-live": "polite" });
    const notify = () => {
      refresh();
      inputs.C.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const refresh = () => {
      const selected = order.filter((r) => inputs[r].checked);
      all.setAttribute("aria-pressed", String(selected.length === order.length));
      buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(inputs[order[i]].checked)));
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
          order.forEach((r) => (inputs[r].checked = checked));
          notify();
        },
      },
      h("span", { class: "rar-glyph", "aria-hidden": "true" }, "✦"),
      "Toutes",
    );
    let drag = null;
    const applyRange = (index) => {
      const low = Math.min(drag.start, index),
        high = Math.max(drag.start, index);
      order.forEach((r, i) => {
        inputs[r].checked = i >= low && i <= high ? drag.checked : drag.initial[i];
      });
      notify();
    };
    const buttons = order.map((r, index) =>
      rarButton(r, {
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
      }),
    );
    const finish = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      drag = null;
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
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
            return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
          });
          if (index >= 0) applyRange(index);
        },
        onPointerUp: finish,
        onPointerCancel: (e) => {
          if (!drag || drag.id !== e.pointerId) return;
          order.forEach((r, i) => (inputs[r].checked = drag.initial[i]));
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
    refresh();
    return h("div", { class: "rar-sheet" }, Object.values(inputs), bar, caption);
  }

  // Rareté maximale : un clic choisit la plus haute rareté admise, toutes celles en dessous suivent.
  function rarityMax(p, value) {
    const order = K.RARITIES_ASC;
    const input = h("input", {
      type: "hidden",
      name: p.key,
      value: order.includes(value) ? value : p.default,
    });
    const caption = h("span", { class: "rar-caption", "aria-live": "polite" });
    const refresh = () => {
      const max = order.indexOf(input.value);
      buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(i <= max)));
      caption.textContent =
        input.value === "M" ? "Toutes les raretés" : `Jusqu'à ${K.LABELS[input.value]} (${order.slice(0, max + 1).join(" ")})`;
    };
    const buttons = order.map((r) =>
      rarButton(r, {
        title: `Jusqu'à ${K.LABELS[r]}`,
        onClick: () => {
          input.value = r;
          refresh();
          input.dispatchEvent(new Event("change", { bubbles: true }));
        },
      }),
    );
    refresh();
    return h(
      "div",
      { class: "rar-sheet" },
      input,
      h("div", { class: "rar-bar max", role: "group", "aria-label": p.label }, buttons),
      caption,
    );
  }

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
      // Sélecteur segmenté : une seule option active, indicateur animé.
      const options = p.options;
      const input = h("input", {
        type: "hidden",
        name: p.key,
        value: options.some(([v]) => v === value) ? value : p.default,
      });
      const group = h("div", {
        class: "mode-toggle",
        role: "group",
        "aria-label": p.label,
      });
      const place = () => {
        const i = options.findIndex(([v]) => v === input.value);
        group.style.setProperty("--n", options.length);
        group.style.setProperty("--i", Math.max(0, i));
        buttons.forEach((b, j) =>
          b.setAttribute("aria-pressed", String(j === i)),
        );
      };
      const buttons = options.map(([v, label]) =>
        h(
          "button",
          {
            type: "button",
            class: "mode-option",
            onClick: () => {
              input.value = v;
              place();
              input.dispatchEvent(new Event("change", { bubbles: true }));
            },
          },
          label,
        ),
      );
      group.append(input, ...buttons);
      place();
      control = group;
    } else if (p.type === "choice") {
      // Rangée de boutons radio : une seule option active.
      control = h(
        "div",
        { class: "choice-group", role: "radiogroup", "aria-label": p.label },
        p.options.map(([v, label]) =>
          h(
            "label",
            { class: "choice-option" },
            h("input", {
              type: "radio",
              name: p.key,
              value: v,
              checked: v === value,
            }),
            h("span", {}, label),
          ),
        ),
      );
    } else if (p.type === "raritySet") {
      control = raritySet(p, value);
    } else if (p.type === "rarityMax") {
      control = rarityMax(p, value);
    } else if (p.type === "rarityMap") {
      control = h(
        "div",
        { class: "rmap" },
        K.RARITIES_ASC.map((r) =>
          h(
            "label",
            { title: K.LABELS[r], style: `--rc:${K.COLORS[r]}` },
            h("span", { class: "rar-glyph" }, r),
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
    } else if (p.type === "textarea") {
      control = h(
        "textarea",
        { name: p.key, rows: 3, required: !p.optional },
        value ?? "",
      );
    } else {
      control = h("input", {
        type: "text",
        name: p.key,
        required: !p.optional,
        value: value ?? "",
      });
    }
    return h(
      ["raritySet", "rarityMax", "modeToggle", "choice"].includes(p.type) ? "div" : "label",
      { class: "field" },
      h("span", {}, p.label),
      control,
      help,
    );
  }

  function readForm(script, form) {
    const values = {};
    for (const p of script.params) {
      if (p.type === "boolean")
        values[p.key] = form.elements[p.key].checked;
      else if (p.type === "number")
        values[p.key] = Number(form.elements[p.key].value);
      else if (p.type === "raritySet") {
        values[p.key] = K.RARITIES.filter(
          (r) => form.elements[p.key + "." + r].checked,
        );
      } else if (p.type === "rarityMax") {
        values[p.key] = form.elements[p.key].value;
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

  const matches = (cond, values) =>
    Object.entries(cond).every(([key, value]) =>
      Array.isArray(value) ? value.includes(values[key]) : values[key] === value,
    );

  function viewParams(script, s) {
    const renderField = (p) => {
      const node = field(p, s.values[p.key]);
      node.setAttribute("data-param", p.key);
      if (p.title) node.title = p.title;
      return node;
    };
    // Les champs consécutifs d'un même `row` partagent une ligne.
    const renderFields = (params) => {
      const out = [];
      for (const p of params) {
        const last = out.at(-1);
        if (p.row && last?.dataset.row === p.row) last.append(renderField(p));
        else if (p.row) out.push(h("div", { class: "row", "data-row": p.row }, renderField(p)));
        else out.push(renderField(p));
      }
      return out;
    };
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
      s.error ? h("ul", { class: "warn-list" }, h("li", {}, `L'aperçu a échoué : ${s.error}`)) : null,
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
        const node = form.querySelector(`[data-param="${p.key}"]`);
        const enabled = !p.enabledWhen || matches(p.enabledWhen, values);
        const inactive = !enabled && !!p.inactiveWhen && matches(p.inactiveWhen, values);
        node.hidden = !enabled && !inactive;
        node.classList.toggle("inactive", inactive);
        node.querySelectorAll("input, select, textarea, button").forEach((el) => {
          el.disabled = !enabled;
        });
      }
    };
    form.addEventListener("change", syncEnabled);
    syncEnabled();

    // Préréglages : valeurs enregistrées sous un nom, plus les valeurs par défaut.
    const applyValues = (values, preset) => {
      s.values = { ...defaultsOf(script), ...structuredClone(values) };
      s.preset = preset;
      saveValues(script, s.values);
      render();
    };
    const presetSelect = h(
      "select",
      {
        class: "preset",
        "aria-label": "Préréglages",
        onChange: (e) => {
          const name = e.target.value;
          if (name === "__defaults") applyValues(defaultsOf(script), "");
          else if (name) applyValues(s.presets[name], name);
        },
      },
      h("option", { value: "" }, "Préréglages…"),
      h("option", { value: "__defaults" }, "Valeurs par défaut"),
      Object.keys(s.presets).map((name) => h("option", { value: name, selected: name === s.preset }, name)),
    );
    const savePreset = () => {
      if (!form.reportValidity()) return;
      const name = prompt("Nom du préréglage :", s.preset || "")?.trim();
      if (!name || name === "__defaults") return;
      s.presets = { ...s.presets, [name]: readForm(script, form) };
      savePresets(script, s.presets);
      applyValues(s.presets[name], name);
    };
    const deletePreset = () => {
      if (!s.preset || !confirm(`Supprimer le préréglage « ${s.preset} » ?`)) return;
      const { [s.preset]: _, ...rest } = s.presets;
      s.presets = rest;
      s.preset = "";
      savePresets(script, s.presets);
      render();
    };
    return {
      body: h("div", { class: "bd" }, form),
      footer: [
        h(
          "div",
          { class: "presets left" },
          presetSelect,
          h("button", { class: "btn link", type: "button", onClick: savePreset }, "Enregistrer"),
          s.preset ? h("button", { class: "btn link", type: "button", onClick: deletePreset }, "Supprimer") : null,
        ),
        h("button", { class: "btn", type: "button", onClick: close }, "Annuler"),
        h(
          "button",
          { class: "btn primary", type: "submit", form: "kx-form" },
          script.runLabel ?? (script.skipPreview ? "Lancer" : "Voir l'aperçu →"),
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

  // Valeur numérique d'une cellule (tri et totaux) : rows[].values, sinon le nombre affiché.
  const numOf = (r, key) => {
    const v = r.values?.[key] ?? r.cells[key];
    if (typeof v === "number") return v;
    const m = String(v ?? "").replace(/[\s\u202f\u00a0]/g, "").match(/^[+-]?\d+(?:[.,]\d+)?/);
    return m ? Number(m[0].replace(",", ".")) : null;
  };

  function viewPreview(script, s) {
    const pv = s.preview;
    const selectable = pv.rows.filter((r) => r.selectable);
    const included = (r) => r.selectable && !s.excluded.has(r.id);
    const count = h("span", { class: "count left" });
    const confirmBtn = h(
      "button",
      { class: "btn primary", type: "button", onClick: () => startRun(script, s) },
      "Confirmer et lancer",
    );
    const all = h("input", { type: "checkbox", "aria-label": "Tout cocher" });
    const totals = pv.columns.some((c) => c.total)
      ? pv.columns.map((c, i) => (c.total ? h("td", { class: "end" }) : h("td", {}, i === 0 ? "Total (cochées)" : "")))
      : null;
    const sync = () => {
      const n = selectable.filter(included).length;
      count.textContent = pv.rows.length ? `${n}/${selectable.length} sélectionnée(s)` : "";
      confirmBtn.disabled = !pv.canRun || (selectable.length > 0 && n === 0);
      all.checked = n === selectable.length && n > 0;
      all.indeterminate = n > 0 && n < selectable.length;
      totals?.forEach((td, i) => {
        const c = pv.columns[i];
        if (c.total) td.textContent = K.fmt(Math.round(pv.rows.filter(included).reduce((t, r) => t + (numOf(r, c.key) ?? 0), 0)));
      });
    };
    // Remarque et pastille de rareté dans la première colonne de texte (nom de la carte…).
    const noteCol = Math.max(0, pv.columns.findIndex((c) => c.align !== "end"));
    const setIncluded = (r, tr, on) => {
      on ? s.excluded.delete(r.id) : s.excluded.add(r.id);
      tr.classList.toggle("off", !on);
      const box = tr.querySelector("td.sel input");
      if (box) box.checked = on;
    };
    const rowEls = new Map(
      pv.rows.map((r) => {
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
                    setIncluded(r, tr, e.target.checked);
                    sync();
                  },
                })
              : null,
          ),
          pv.columns.map((c, i) =>
            h(
              "td",
              { class: c.align === "end" ? "end" : "" },
              i === noteCol && r.rarity
                ? h("span", { class: "rdot", style: `--rc:${K.COLORS[r.rarity]}`, title: K.LABELS[r.rarity] })
                : null,
              String(r.cells[c.key] ?? ""),
              i === noteCol && r.note ? h("span", { class: "note" }, r.note) : null,
            ),
          ),
        );
        if (!r.selectable) tr.classList.add("off");
        return [r, tr];
      }),
    );
    all.addEventListener("change", () => {
      for (const r of selectable) setIncluded(r, rowEls.get(r), all.checked);
      sync();
    });
    // Tri : clic sur un en-tête (croissant, puis décroissant).
    const tbody = h("tbody", {}, [...rowEls.values()]);
    const sortBy = (c, th) => {
      const dir = s.sort?.key === c.key && s.sort.dir === 1 ? -1 : 1;
      s.sort = { key: c.key, dir };
      th.parentElement.querySelectorAll("th").forEach((x) => x.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
      const sorted = [...pv.rows].sort((a, b) => {
        const x = numOf(a, c.key),
          y = numOf(b, c.key);
        const cmp = x != null && y != null ? x - y : String(a.cells[c.key] ?? "").localeCompare(String(b.cells[c.key] ?? ""), "fr");
        return cmp * dir;
      });
      tbody.replaceChildren(...sorted.map((r) => rowEls.get(r)));
    };
    sync();
    return {
      body: h(
        "div",
        { class: "bd" },
        h("p", { class: "summary" }, pv.summary),
        pv.warnings?.length ? h("ul", { class: "warn-list" }, pv.warnings.map((w) => h("li", {}, w))) : null,
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
                    pv.columns.map((c) => {
                      const th = h(
                        "th",
                        {
                          class: `sortable${c.align === "end" ? " end" : ""}`,
                          title: "Trier",
                          onClick: () => sortBy(c, th),
                        },
                        c.label,
                      );
                      return th;
                    }),
                  ),
                ),
                tbody,
                totals
                  ? h(
                      "tfoot",
                      {},
                      h("tr", {}, h("td", { class: "sel" }), totals),
                    )
                  : null,
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
    s.outcome = s.logs.some((l) => l.tone === "error") ? "error" : "done";
    // Vu tout de suite si le popover montre ce script ; sinon, marque sur le menu.
    s.seen = current === script.id && isOpen();
    rerender(script.id);
  }

  const logItem = ({ at, msg, tone }) =>
    h(
      "li",
      {},
      h("time", {}, at.toLocaleTimeString("fr-FR")),
      h("span", { class: tone }, msg),
    );

  async function copyLog(s, button) {
    const text = s.logs.map(({ at, msg }) => `${at.toLocaleTimeString("fr-FR")}  ${msg}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copié ✓";
    } catch {
      button.textContent = "Copie impossible";
    }
    setTimeout(() => (button.textContent = "Copier le journal"), 1500);
  }

  function viewRun(script, s) {
    const running = s.phase === "running";
    const stopping = running && s.controller.signal.aborted;
    const copy = h(
      "button",
      { class: "btn link left", type: "button", onClick: () => copyLog(s, copy) },
      "Copier le journal",
    );
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
            copy,
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
            copy,
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
