// Diagnostic : accès au site accordé ? content script chargé dans l'onglet ?
const SITE = { origins: ["https://kyara.games/*"] };
const stateEl = document.getElementById("state");
const actionEl = document.getElementById("action");

function show(tone, title, text, action) {
  stateEl.className = tone;
  stateEl.replaceChildren(
    Object.assign(document.createElement("b"), { textContent: title }),
    Object.assign(document.createElement("p"), { textContent: text }),
  );
  actionEl.hidden = !action;
  if (action) {
    actionEl.textContent = action.label;
    actionEl.onclick = action.run;
  }
}

const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const ask = (tabId) => chrome.tabs.sendMessage(tabId, "kx-status").catch(() => null);

async function check() {
  const granted = await chrome.permissions.contains(SITE);
  const tab = await activeTab();
  if (!granted) {
    return show("warn", "Accès à kyara.games non autorisé", "Le navigateur bloque l'extension sur ce site, les boutons ne peuvent pas apparaître.", {
      label: "Autoriser sur kyara.games",
      run: async () => {
        if (await chrome.permissions.request(SITE)) {
          const t = await activeTab();
          if (t?.url?.startsWith("https://kyara.games/")) chrome.tabs.reload(t.id);
          check();
        }
      },
    });
  }
  if (!tab?.url?.startsWith("https://kyara.games/")) {
    return show("", "Accès autorisé", "Ouvre kyara.games : le menu « K Scripts » apparaît en haut à droite de la page.", {
      label: "Ouvrir kyara.games",
      run: () => chrome.tabs.create({ url: "https://kyara.games/" }),
    });
  }
  const status = await ask(tab.id);
  if (!status) {
    return show("warn", "Pas encore chargée dans cet onglet", "L'onglet était ouvert avant l'installation ou la mise à jour de l'extension.", {
      label: "Recharger l'onglet",
      run: async () => {
        await chrome.tabs.reload(tab.id);
        setTimeout(check, 1500);
      },
    });
  }
  const running = status.running.length ? ` En cours : ${status.running.join(", ")}.` : "";
  show("ok", "Active sur cet onglet", `${status.scripts} script(s) dans le menu « K Scripts » en haut à droite de la page.${running}`);
}

check().catch((e) => show("warn", "Erreur", e.message));
