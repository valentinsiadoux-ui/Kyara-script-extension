// Styles des deux shadow roots (barre de boutons dans le header, popover dans le body).
KyaraExt.styles = `
:host { all: initial; }
* { box-sizing: border-box; }

/* ---------- Menu flottant ---------- */
:host(.kx-bar-host) {
  position: fixed;
  top: 76px; /* juste sous le header du site (68 px) */
  right: 16px;
  z-index: 2147483000;
  font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #ececf1;
}
.trigger {
  all: unset;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 6px;
  border-radius: 999px;
  border: 1px solid #2f2f3b;
  background: #17171fee;
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
  cursor: grab;
  touch-action: none;
  user-select: none;
  white-space: nowrap;
}
.trigger:active { cursor: grabbing; }
.trigger:hover, .trigger[aria-expanded="true"] { border-color: #8b7bff; }
.trigger:focus-visible, .menu button:focus-visible { outline: 2px solid #8b7bff; outline-offset: 2px; }
.trigger .logo {
  display: grid; place-items: center;
  width: 24px; height: 24px; border-radius: 50%;
  background: #8b7bff; color: #fff; font-weight: 800; font-style: italic; font-size: 13px;
}
.trigger .chev { color: #9a9aab; font-size: 11px; }
.trigger[aria-expanded="true"] .chev { transform: rotate(180deg); }
.menu {
  --menu-line: #343347;
  --menu-tile: #242334;
  --menu-accent: #a99bff;
  position: fixed;
  width: min(700px, calc(100vw - 16px));
  max-width: calc(100vw - 16px);
  max-height: var(--panel-height, calc(100dvh - 16px));
  min-width: min(72px, calc(100vw - 16px));
  min-height: min(120px, var(--panel-height, 100dvh));
  resize: both;
  container: kx-menu / inline-size;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--menu-line);
  background: #191824;
  box-shadow: 0 18px 50px rgba(0,0,0,.5);
  display: flex;
  flex-direction: column;
}
.menu[hidden] { display: none; }
.menu-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr));
  align-content: start;
  align-items: start;
  gap: 10px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #655a85 #211f30;
}
.menu-body:hover, .menu-body:focus-within { scrollbar-color: #9180ba #211f30; }
.menu .sec {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 5px;
  border: 1px solid var(--menu-line);
  border-radius: 12px;
  background: #1e1d2b;
}
.menu .sec-hd { grid-column: 1 / -1; padding: 2px 4px; color: var(--menu-accent); font-size: 11px; font-weight: 700; }
.menu-tools {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 6px 14px 6px 10px;
  border-top: 1px solid var(--menu-line);
  background: #1e1d2b;
}
.menu button {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--menu-tile);
  cursor: pointer;
}
.menu button:hover, .menu button:focus-visible { background: #2e2a45; border-color: #62588a; }
.menu button:focus-visible { outline-offset: -2px; }
.menu .ic { display: grid; place-items: center; font-size: 17px; line-height: 1; width: 34px; height: 34px; border-radius: 8px; background: #302b46; flex: none; }
.menu .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: break-word; text-wrap: pretty; }
.menu button[data-id] .txt { padding-right: 9px; }
.menu-tools button { background: transparent; padding: 3px 6px; }
.menu-tools .txt { font-size: 12px; }
.menu-tools .ic { width: 26px; height: 26px; }
.menu.horizontal-compact .menu-body { grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); }
.menu.horizontal-compact .menu-body small { display: none; }
.menu.icons-only .menu-body { display: flex; flex-wrap: wrap; align-content: start; gap: 6px; padding: 6px; }
.menu.icons-only .sec { display: flex; flex-wrap: wrap; gap: 4px; padding: 0; border: 0; background: transparent; }
.menu.icons-only .sec-hd, .menu.icons-only .txt { display: none; }
.menu.icons-only .menu-body button { justify-content: center; width: 44px; height: 44px; padding: 0; }
.menu.icons-only .menu-body .ic { background: transparent; }
.menu.icons-only .menu-body .dot { top: 5px; right: 4px; margin-top: 0; }
.menu b { font-weight: 600; }
.menu small {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: #9a9aab;
  font-size: 11.5px;
  font-weight: 400;
}
.menu .dot { top: 50%; right: 8px; margin-top: -4px; }
.dot {
  position: absolute; top: 6px; right: 6px;
  width: 8px; height: 8px; border-radius: 50%;
  background: #4ad991; box-shadow: 0 0 0 2px #17171f;
  animation: kx-pulse 1.4s ease-in-out infinite;
}
.trigger .dot { top: 0; right: 2px; }
.dot.err { background: #ff6b6b; animation: none; }
.dot.ok { background: #4ad991; animation: none; }
.trigger.mini { padding-right: 6px; }
.trigger.mini .lbl, .trigger.mini .chev { display: none; }
@container kx-menu (width < 275px) {
  .menu button[data-id] small { display: none; }
}
@container kx-menu (width < 170px) {
  .menu-body { gap: 5px; padding: 5px; }
  .menu.icons-only .menu-body, .menu.icons-only .sec { display: grid; }
  .menu .sec { grid-template-columns: repeat(auto-fill, minmax(min(44px, 100%), 1fr)); padding: 0; border: 0; background: transparent; }
  .menu .sec + .sec { border-top: 1px solid var(--menu-line); border-radius: 0; padding-top: 5px; }
  .menu .sec-hd, .menu .txt { display: none; }
  .menu button { justify-content: center; min-height: 44px; padding: 0; }
  .menu.horizontal-compact .menu-body button { width: auto; min-height: 44px; }
  .menu .ic { background: transparent; width: auto; }
  .menu-tools { flex-wrap: nowrap; padding: 3px 10px 5px 3px; }
  .menu-tools button { flex: 1; min-height: 34px; }
  .menu .dot { top: 5px; right: 4px; margin-top: 0; }
}
@keyframes kx-pulse { 50% { opacity: .35; } }
@media (max-width: 640px) { .trigger .lbl { display: none; } .trigger { padding-right: 10px; } }

/* ---------- Popover ---------- */
.pop {
  container: kx-panel / inline-size;
  --panel-padding: 16px;
  --bg: #17171f; --bg2: #20202a; --line: #2f2f3b; --fg: #ececf1; --mut: #9a9aab;
  --acc: #8b7bff; --acc-fg: #fff; --ok: #4ad991; --warn: #ffb347; --err: #ff6b6b; --info: #c9a3ff;
  position: fixed;
  inset: auto;
  margin: 0;
  width: min(640px, calc(100vw - 32px));
  max-width: calc(100vw - 16px);
  min-width: min(260px, calc(100vw - 16px));
  min-height: min(160px, var(--panel-height, 100dvh));
  max-height: var(--panel-height, calc(100dvh - 16px));
  display: none;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg);
  color: var(--fg);
  font: 400 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 18px 50px rgba(0,0,0,.5);
  z-index: 2147483001;
  overflow: hidden;
}
.pop.open { display: flex; resize: both; }
.pop.wide { width: min(1000px, calc(100vw - 32px)); }
:host(.kx-detached) { font: 500 13px/1.3 system-ui, sans-serif; color: #ececf1; }
:host(.kx-detached) .menu,
:host(.kx-detached) .pop {
  position: relative;
  /* Les dimensions inline de la poignée sont réservées aux panneaux flottants. */
  width: calc(100% - 16px) !important;
  height: auto !important;
  resize: none;
  max-height: calc(100dvh - 16px);
  margin: 8px;
  box-shadow: none;
}
:host(.kx-detached) .collapse { display: none; }
@media (prefers-color-scheme: light) {
  .pop { --bg: #fff; --bg2: #f4f4f8; --line: #e1e1ea; --fg: #1b1b24; --mut: #666678; --info: #7a3fd1; --ok: #138a52; --warn: #b36b00; --err: #c62828; }
}

.hd { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto auto; align-items: start; gap: 8px; padding: 14px var(--panel-padding) 12px; border-bottom: 1px solid var(--line); }
.hd > div { overflow-wrap: break-word; text-wrap: pretty; }
.hd .ic { font-size: 20px; line-height: 1.2; }
.hd h2 { margin: 0; font-size: 15px; font-weight: 650; }
.hd p { margin: 2px 0 0; color: var(--mut); font-size: 12px; }
.hd .step { margin-left: auto; color: var(--mut); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.hd .back { all: unset; cursor: pointer; padding: 0 8px; margin: -1px 0 0 -6px; border-radius: 6px; color: var(--mut); font-size: 18px; line-height: 1.4; }
.hd .back:hover { background: var(--bg2); color: var(--fg); }
.hd .back:focus-visible, .hd .x:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
.hd .x { all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px; color: var(--mut); font-size: 16px; }
.hd .x:hover { background: var(--bg2); color: var(--fg); }

.bd { padding: 14px var(--panel-padding); overflow: auto; flex: 1; min-height: 0; scrollbar-width: thin; }
.ft { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; padding: 10px var(--panel-padding); border-top: 1px solid var(--line); background: var(--bg2); }
.ft .left { margin-right: auto; }

.btn { all: unset; cursor: pointer; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font-weight: 550; }
.btn:hover { border-color: var(--mut); }
.btn:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
.btn.primary { background: var(--acc); border-color: var(--acc); color: var(--acc-fg); }
.btn.primary:hover { filter: brightness(1.1); }
.btn.danger { color: var(--err); border-color: color-mix(in srgb, var(--err) 50%, transparent); }
.btn.link { border: 0; background: none; padding: 7px 4px; color: var(--mut); font-weight: 400; text-decoration: underline; }
.btn[disabled] { opacity: .45; pointer-events: none; }

/* Formulaire */
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(245px, 100%), 1fr)); gap: 14px 16px; align-items: start; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; overflow-wrap: break-word; text-wrap: pretty; }
.field > span { font-size: 12px; color: var(--mut); }
.field small { font-size: 12px; color: var(--mut); }
.field.check { flex-direction: row; align-items: flex-start; gap: 8px; }
.field.check > span { color: var(--fg); font-size: 13px; }
input[type=number], input[type=text], .album-filters input[type=search], select {
  all: unset; box-sizing: border-box; width: 100%;
  padding: 6px 9px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg2); color: var(--fg); font-size: 13px;
}
select {
  padding-right: 26px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--mut) 50%), linear-gradient(135deg, var(--mut) 50%, transparent 50%);
  background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}
input:focus-visible, select:focus-visible { border-color: var(--acc); }
input:invalid { border-color: var(--err); }
input[type=checkbox] { accent-color: var(--acc); width: 15px; height: 15px; margin: 2px 0 0; flex: none; }
.rmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(48px, 100%), 1fr)); gap: 6px; }
.rmap label { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: var(--mut); }
.rmap .rar-glyph { color: var(--rc); font-weight: 800; font-size: 12px; }
.rmap input { text-align: center; padding: 5px 2px; }
details { margin-top: 12px; border-top: 1px dashed var(--line); padding-top: 10px; }
summary { cursor: pointer; color: var(--mut); font-size: 12px; margin-bottom: 10px; }

/* Champs regroupés sur une ligne (param.row) ; ligne masquée si tous ses champs le sont. */
.row { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(155px, 100%), 1fr)); gap: 12px; align-items: start; min-width: 0; }
.row:not(:has(> .field:not([hidden]))) { display: none; }
.row > .field { min-width: 0; }
.field[hidden] { display: none !important; }
.field.inactive { opacity: .45; }
.field.inactive select, .field.inactive input { cursor: not-allowed; }
.mode-toggle { position: relative; isolation: isolate; display: flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg2); }
.mode-toggle input, .rar-sheet input { display: none; }
.mode-option { position: relative; z-index: 1; flex: 1; border: 1px solid transparent; border-radius: 8px; padding: 9px 12px; background: transparent; color: var(--mut); font: inherit; cursor: pointer; }
.mode-toggle::before { content: ""; position: absolute; z-index: 0; pointer-events: none; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px - (var(--n, 2) - 1) * 4px) / var(--n, 2)); box-sizing: border-box; border-radius: 8px; border: 1px solid var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); transform: translateX(calc(var(--i, 0) * (100% + 4px))); transition: transform 200ms cubic-bezier(.2,.8,.2,1); }
.mode-option[aria-pressed="true"] { color: var(--fg); font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .mode-toggle::before { transition: none; } }
.field:has(.rar-sheet), .field:has(.mode-toggle), .field:has(.choice-group), .field:has(textarea) { grid-column: 1 / -1; }
.choice-group { display: flex; flex-wrap: wrap; gap: 6px; }
.choice-option { position: relative; flex: 1 1 auto; }
.choice-option input { position: absolute; opacity: 0; pointer-events: none; }
.choice-option span { display: block; text-align: center; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg2); color: var(--mut); cursor: pointer; transition: background .15s, border-color .15s; }
@container kx-panel (width < 440px) {
  .hd, .bd, .ft { --panel-padding: 12px; }
  .hd { grid-template-columns: auto auto minmax(0, 1fr) auto; }
  .hd .step { grid-column: 3; margin: 0; }
  .hd .x { grid-column: 4; grid-row: 1; }
  .mode-toggle { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(94px, 100%), 1fr)); }
  .mode-toggle::before { display: none; }
  .mode-option { min-width: 0; padding: 8px; }
  .mode-option[aria-pressed="true"] { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); }
  .choice-option { min-width: 0; max-width: 100%; }
}
.choice-option span:hover { border-color: var(--acc); }
.choice-option input:checked + span { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); color: var(--fg); font-weight: 600; }
.choice-option input:focus-visible + span { outline: 2px solid var(--acc); outline-offset: 2px; }
textarea {
  all: unset; box-sizing: border-box; width: 100%; min-height: 64px; white-space: pre-wrap; resize: vertical;
  padding: 6px 9px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg2); color: var(--fg); font-size: 13px;
}
textarea:focus-visible { border-color: var(--acc); }
.rar-sheet { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.rar-bar { touch-action: none; user-select: none; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.rar-button { --rc: var(--acc); display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 36px; height: 36px; padding: 0 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg2); color: var(--mut); cursor: pointer; font: inherit; transition: background .15s, border-color .15s; }
.rar-button .rar-glyph { color: var(--rc); font-size: 13px; font-weight: 800; }
.rar-button.all { padding: 0 12px; font-size: 12px; }
.rar-button[aria-pressed="true"] { background: color-mix(in srgb, var(--rc) 16%, var(--bg2)); border-color: var(--rc); color: var(--fg); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rc) 20%, transparent); }
.rar-button:hover { border-color: var(--rc); }
.rar-button:focus-visible, .mode-option:focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; }
.rar-caption { color: var(--mut); font-size: 11px; line-height: 1.5; }

/* Albums */
.album-filters.field { gap: 10px; }
.album-filters input[type=search] { min-height: 36px; }
.album-filters input[type=search]:focus-visible { border-color: var(--acc); }
.album-filters input[type=search]::placeholder { color: var(--mut); }
.album-count { font-size: 12px; color: var(--mut); margin: 12px 0 8px; }
.album-cooldown { display: inline-flex; margin-top: 8px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg2); color: var(--fg); font-size: 12px; font-variant-numeric: tabular-nums; }
.album-cooldown-bar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; height: 0; pointer-events: none; }
.album-cooldown-bar[hidden] { display: none; }
.album-cooldown-bar .album-cooldown { height: max-content; margin-top: 0; background: var(--bg2); box-shadow: 0 2px 8px #0004; }
.album-list { display: grid; gap: 8px; }
.album-card { margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--bg2); }
.album-card > summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; padding: 10px 12px; margin: 0; }
.album-card > summary:focus-visible { outline: 2px solid var(--acc); outline-offset: -2px; border-radius: 10px; }
.album-title { font-weight: 650; color: var(--fg); overflow-wrap: anywhere; }
.album-title::before { content: "▸"; margin-right: 6px; color: var(--acc); }
.album-card[open] .album-title::before { content: "▾"; }
.album-missing { color: var(--fg); }
.album-max-rarity { display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; min-width: 20px; height: 20px; border: 1px solid var(--rc); border-radius: 5px; font-weight: 700; color: var(--rc); }
.album-card progress { width: 100%; height: 8px; align-self: center; accent-color: var(--acc); }
.album-owned { justify-self: end; }
.album-cards { margin: 0; padding: 4px 12px 10px; list-style: none; }
.album-cards li { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px; }
.album-cards small { margin-left: auto; color: var(--mut); }
.album-card-link { color: var(--fg); text-decoration: none; overflow-wrap: anywhere; }
.album-card-link:hover, .album-card-link:focus-visible { color: var(--acc); text-decoration: underline; }

/* Aperçu */
.summary { margin: 0 0 10px; }
.warn-list { margin: 0 0 10px; padding: 8px 10px 8px 26px; border-radius: 8px; background: color-mix(in srgb, var(--warn) 12%, transparent); color: var(--fg); font-size: 12px; }
.warn-list li + li { margin-top: 2px; }
.tbl-wrap { overflow: auto; border: 1px solid var(--line); border-radius: 8px; max-height: 46vh; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { padding: 6px 8px; text-align: start; border-bottom: 1px solid var(--line); vertical-align: top; }
th { position: sticky; top: 0; background: var(--bg2); font-weight: 600; color: var(--mut); white-space: nowrap; z-index: 1; }
td.end, th.end { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
tr.off td:not(.sel) { opacity: .45; }
tr.off td:not(.sel) { text-decoration: line-through; }
td.sel, th.sel { width: 28px; }
td.sel + td { min-width: 150px; }
.note { display: block; color: var(--warn); font-size: 11px; text-decoration: none; }
.count { color: var(--mut); font-size: 12px; align-self: center; }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--fg); }
th[aria-sort="ascending"]::after { content: " ▲"; font-size: 9px; }
th[aria-sort="descending"]::after { content: " ▼"; font-size: 9px; }
tfoot td { position: sticky; bottom: 0; background: var(--bg2); font-weight: 600; border-top: 1px solid var(--line); border-bottom: 0; }
.rdot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--rc); vertical-align: 1px; }
.presets { display: flex; align-items: center; gap: 4px; }
.presets select { width: auto; max-width: 170px; padding-top: 5px; padding-bottom: 5px; font-size: 12px; }

/* Chargement / exécution */
.loading { display: flex; align-items: center; gap: 10px; padding: 18px 2px; color: var(--mut); }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--acc); animation: kx-spin .8s linear infinite; flex: none; }
@keyframes kx-spin { to { transform: rotate(360deg); } }
.status { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: var(--bg2); margin-bottom: 10px; font-size: 12px; }
.status.done .spin { display: none; }
.log { margin: 0; padding: 0; list-style: none; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 46vh; overflow: auto; }
.log li { padding: 3px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent); display: flex; gap: 8px; }
.log time { color: var(--mut); flex: none; }
.log .success { color: var(--ok); }
.log .warn { color: var(--warn); }
.log .error { color: var(--err); }
.log .info { color: var(--info); }
.empty { color: var(--mut); padding: 8px 0; }
`;
