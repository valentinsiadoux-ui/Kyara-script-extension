// Styles des deux shadow roots (barre de boutons dans le header, popover dans le body).
KyaraExt.styles = `
:host {
  all: initial;

  /* Palette commune aux deux thèmes et au lanceur. */
  --kx-color-menu-surface: #191824;
  --kx-color-menu-tile-surface: #242334;
  --kx-color-menu-border: #343347;
  --kx-color-muted-light-theme: #666678;
  --kx-color-scroll-thumb-light: #796995;
  --kx-color-accent: #8b7bff;
  --kx-color-white: #fff;
  --kx-color-text-dark-theme: #ececf1;
  --kx-color-success-dark-theme: #4ad991;
  --kx-color-muted-dark-theme: #9a9aab;
  --kx-color-error-dark-theme: #ff6b6b;
  --kx-color-surface-dark-theme: #17171f;
  --kx-color-menu-raised: #1e1d2b;
  --kx-color-border-dark-theme: #2f2f3b;
  --kx-color-scroll-thumb-hover-dark: #9180ba;
  --kx-color-menu-heading: #a99bff;
  --kx-color-error-light-theme: #c62828;
  --kx-color-info-light-theme: #7a3fd1;
  --kx-color-info-dark-theme: #c9a3ff;
  --kx-color-border-light-theme: #e1e1ea;
  --kx-color-scroll-track-light: #efecf5;
  --kx-color-surface-raised-light-theme: #f4f4f8;
  --kx-color-warning-light-theme: #b36b00;
  --kx-color-scroll-thumb-dark: #655a85;
  --kx-color-warning-dark-theme: #ffb347;
  --kx-color-menu-tile-hover-border: #62588a;
  --kx-color-scroll-thumb-hover-light: #5e4e7b;
  --kx-color-menu-icon-surface: #302b46;
  --kx-color-menu-tile-hover: #2e2a45;
  --kx-color-scroll-track-dark: #211f30;
  --kx-color-surface-raised-dark-theme: #20202a;
  --kx-color-text-light-theme: #1b1b24;
  --kx-color-trigger-surface: #17171fee;
  --kx-color-success-light-theme: #138a52;
  --kx-color-shadow-tint: #0004;

  /* Échelle utilisée pour les espacements, tailles et bordures. */
  --kx-size-1: 1px;
  --kx-size-2: 2px;
  --kx-size-3: 3px;
  --kx-size-4: 4px;
  --kx-size-5: 5px;
  --kx-size-6: 6px;
  --kx-size-7: 7px;
  --kx-size-8: 8px;
  --kx-size-9: 9px;
  --kx-size-10: 10px;
  --kx-size-11: 11px;
  --kx-size-11-5: 11.5px;
  --kx-size-12: 12px;
  --kx-size-13: 13px;
  --kx-size-14: 14px;
  --kx-size-15: 15px;
  --kx-size-16: 16px;
  --kx-size-17: 17px;
  --kx-size-18: 18px;
  --kx-size-20: 20px;
  --kx-size-24: 24px;
  --kx-size-26: 26px;
  --kx-size-28: 28px;
  --kx-size-32: 32px;
  --kx-size-34: 34px;
  --kx-size-36: 36px;
  --kx-size-44: 44px;
  --kx-size-48: 48px;
  --kx-size-64: 64px;
  --kx-size-72: 72px;
  --kx-size-76: 76px;
  --kx-size-94: 94px;
  --kx-size-120: 120px;
  --kx-size-150: 150px;
  --kx-size-155: 155px;
  --kx-size-160: 160px;
  --kx-size-170: 170px;
  --kx-size-190: 190px;
  --kx-size-210: 210px;
  --kx-size-245: 245px;
  --kx-size-260: 260px;
  --kx-size-640: 640px;
  --kx-size-700: 700px;
  --kx-size-999: 999px;
  --kx-size-1000: 1000px;

  /* Ombres des éléments flottants. */
  --kx-shadow-trigger: 0 6px 20px rgba(0,0,0,.35);
  --kx-shadow-panel: 0 18px 50px rgba(0,0,0,.5);

  --kx-font-ui: system-ui, -apple-system, "Segoe UI", sans-serif;
  --kx-font-log: ui-monospace, SFMono-Regular, Menlo, monospace;
  --kx-scroll-region-max-height: 46vh;
  --kx-transition-fast: .15s;
  --kx-spinner-duration: .8s;
  --kx-indicator-duration: 1.4s;
}
* { box-sizing: border-box; }

/* Barres de défilement communes aux panneaux et à leurs zones internes. */
.menu, .pop {
  --scroll-track: var(--kx-color-scroll-track-dark);
  --scroll-thumb: var(--kx-color-scroll-thumb-dark);
  --scroll-thumb-active: var(--kx-color-scroll-thumb-hover-dark);
}
:is(.menu-body, .bd, .tbl-wrap, .log, .pop textarea) {
  scrollbar-width: thin;
  scrollbar-color: var(--scroll-thumb) var(--scroll-track);
}
:is(.menu-body, .bd, .tbl-wrap, .log, .pop textarea):is(:hover, :focus-within) {
  scrollbar-color: var(--scroll-thumb-active) var(--scroll-track);
}
@media (prefers-color-scheme: light) {
  .pop { --scroll-track: var(--kx-color-scroll-track-light); --scroll-thumb: var(--kx-color-scroll-thumb-light); --scroll-thumb-active: var(--kx-color-scroll-thumb-hover-light); }
}

/* ---------- Menu flottant ---------- */
:host(.kx-bar-host) {
  position: fixed;
  top: var(--kx-size-76); /* juste sous le header du site (68 px) */
  right: var(--kx-size-16);
  z-index: 2147483000;
  font: 500 var(--kx-size-13)/1.3 var(--kx-font-ui);
  color: var(--kx-color-text-dark-theme);
}
.trigger {
  all: unset;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--kx-size-8);
  height: var(--kx-size-36);
  padding: 0 var(--kx-size-12) 0 var(--kx-size-6);
  border-radius: var(--kx-size-999);
  border: var(--kx-size-1) solid var(--kx-color-border-dark-theme);
  background: var(--kx-color-trigger-surface);
  backdrop-filter: blur(var(--kx-size-6));
  box-shadow: var(--kx-shadow-trigger);
  cursor: grab;
  touch-action: none;
  user-select: none;
  white-space: nowrap;
}
.trigger:active { cursor: grabbing; }
.trigger:hover, .trigger[aria-expanded="true"] { border-color: var(--kx-color-accent); }
.trigger:focus-visible, .menu button:focus-visible { outline: var(--kx-size-2) solid var(--kx-color-accent); outline-offset: var(--kx-size-2); }
.trigger .logo {
  display: grid; place-items: center;
  width: var(--kx-size-24); height: var(--kx-size-24); border-radius: 50%;
  background: var(--kx-color-accent); color: var(--kx-color-white); font-weight: 800; font-style: italic; font-size: var(--kx-size-13);
}
.trigger .chev { color: var(--kx-color-muted-dark-theme); font-size: var(--kx-size-11); }
.trigger[aria-expanded="true"] .chev { transform: rotate(180deg); }
.menu {
  --menu-line: var(--kx-color-menu-border);
  --menu-tile: var(--kx-color-menu-tile-surface);
  --menu-accent: var(--kx-color-menu-heading);
  position: fixed;
  width: min(var(--kx-size-700), calc(100vw - var(--kx-size-16)));
  max-width: calc(100vw - var(--kx-size-16));
  max-height: var(--panel-height, calc(100dvh - var(--kx-size-16)));
  min-width: min(var(--kx-size-72), calc(100vw - var(--kx-size-16)));
  min-height: min(var(--kx-size-120), var(--panel-height, 100dvh));
  resize: both;
  container: kx-menu / inline-size;
  overflow: hidden;
  border-radius: var(--kx-size-16);
  border: var(--kx-size-1) solid var(--menu-line);
  background: var(--kx-color-menu-surface);
  box-shadow: var(--kx-shadow-panel);
  display: flex;
  flex-direction: column;
}
.menu[hidden] { display: none; }
.menu-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(var(--kx-size-210), 100%), 1fr));
  align-content: start;
  align-items: start;
  gap: var(--kx-size-10);
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--kx-size-10);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.menu .sec {
  display: grid;
  gap: var(--kx-size-4);
  min-width: 0;
  padding: var(--kx-size-5);
  border: var(--kx-size-1) solid var(--menu-line);
  border-radius: var(--kx-size-12);
  background: var(--kx-color-menu-raised);
}
.menu .sec-hd { grid-column: 1 / -1; padding: var(--kx-size-2) var(--kx-size-4); color: var(--menu-accent); font-size: var(--kx-size-11); font-weight: 700; }
.menu-tools {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: var(--kx-size-4) var(--kx-size-8);
  padding: var(--kx-size-6) var(--kx-size-14) var(--kx-size-6) var(--kx-size-10);
  border-top: var(--kx-size-1) solid var(--menu-line);
  background: var(--kx-color-menu-raised);
}
.menu button {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: flex;
  gap: var(--kx-size-8);
  align-items: center;
  min-width: 0;
  padding: var(--kx-size-6);
  border: var(--kx-size-1) solid transparent;
  border-radius: var(--kx-size-10);
  background: var(--menu-tile);
  cursor: pointer;
}
.menu button:hover, .menu button:focus-visible { background: var(--kx-color-menu-tile-hover); border-color: var(--kx-color-menu-tile-hover-border); }
.menu button:focus-visible { outline-offset: calc(-1 * var(--kx-size-2)); }
.menu .ic { display: grid; place-items: center; font-size: var(--kx-size-17); line-height: 1; width: var(--kx-size-34); height: var(--kx-size-34); border-radius: var(--kx-size-8); background: var(--kx-color-menu-icon-surface); flex: none; }
.menu .txt { display: flex; flex-direction: column; gap: var(--kx-size-2); min-width: 0; overflow-wrap: break-word; text-wrap: pretty; }
.menu button[data-id] .txt { padding-right: var(--kx-size-9); }
.menu-tools button { background: transparent; padding: var(--kx-size-3) var(--kx-size-6); }
.menu-tools .txt { font-size: var(--kx-size-12); }
.menu-tools .ic { width: var(--kx-size-26); height: var(--kx-size-26); }
.menu.horizontal-compact .menu-body { grid-template-columns: repeat(auto-fit, minmax(min(var(--kx-size-190), 100%), 1fr)); }
.menu.horizontal-compact .menu-body small { display: none; }
.menu.icons-only .menu-body { display: flex; flex-wrap: wrap; align-content: start; gap: var(--kx-size-6); padding: var(--kx-size-6); }
.menu.icons-only .sec { display: flex; flex-wrap: wrap; gap: var(--kx-size-4); padding: 0; border: 0; background: transparent; }
.menu.icons-only .sec-hd, .menu.icons-only .txt { display: none; }
.menu.icons-only .menu-body button { justify-content: center; width: var(--kx-size-44); height: var(--kx-size-44); padding: 0; }
.menu.icons-only .menu-body .ic { background: transparent; }
.menu.icons-only .menu-body .dot { top: var(--kx-size-5); right: var(--kx-size-4); margin-top: 0; }
.menu b { font-weight: 600; }
.menu small {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: var(--kx-color-muted-dark-theme);
  font-size: var(--kx-size-11-5);
  font-weight: 400;
}
.menu .dot { top: 50%; right: var(--kx-size-8); margin-top: calc(-1 * var(--kx-size-4)); }
.dot {
  position: absolute; top: var(--kx-size-6); right: var(--kx-size-6);
  width: var(--kx-size-8); height: var(--kx-size-8); border-radius: 50%;
  background: var(--kx-color-success-dark-theme); box-shadow: 0 0 0 var(--kx-size-2) var(--kx-color-surface-dark-theme);
  animation: kx-pulse var(--kx-indicator-duration) ease-in-out infinite;
}
.trigger .dot { top: 0; right: var(--kx-size-2); }
.dot.err { background: var(--kx-color-error-dark-theme); animation: none; }
.dot.ok { background: var(--kx-color-success-dark-theme); animation: none; }
.trigger.mini { padding-right: var(--kx-size-6); }
.trigger.mini .lbl, .trigger.mini .chev { display: none; }
@container kx-menu (width < 275px) {
  .menu button[data-id] small { display: none; }
}
@container kx-menu (width < 170px) {
  .menu-body { gap: var(--kx-size-5); padding: var(--kx-size-5); }
  .menu.icons-only .menu-body, .menu.icons-only .sec { display: grid; }
  .menu .sec { grid-template-columns: repeat(auto-fill, minmax(min(var(--kx-size-44), 100%), 1fr)); padding: 0; border: 0; background: transparent; }
  .menu .sec + .sec { border-top: var(--kx-size-1) solid var(--menu-line); border-radius: 0; padding-top: var(--kx-size-5); }
  .menu .sec-hd, .menu .txt { display: none; }
  .menu button { justify-content: center; min-height: var(--kx-size-44); padding: 0; }
  .menu.horizontal-compact .menu-body button { width: auto; min-height: var(--kx-size-44); }
  .menu .ic { background: transparent; width: auto; }
  .menu-tools { flex-wrap: nowrap; padding: var(--kx-size-3) var(--kx-size-10) var(--kx-size-5) var(--kx-size-3); }
  .menu-tools button { flex: 1; min-height: var(--kx-size-34); }
  .menu .dot { top: var(--kx-size-5); right: var(--kx-size-4); margin-top: 0; }
}
@keyframes kx-pulse { 50% { opacity: .35; } }
@media (max-width: 640px) { .trigger .lbl { display: none; } .trigger { padding-right: 10px; } }

/* ---------- Popover ---------- */
.pop {
  container: kx-panel / inline-size;
  --panel-padding: var(--kx-size-16);
  --bg: var(--kx-color-surface-dark-theme); --bg2: var(--kx-color-surface-raised-dark-theme); --line: var(--kx-color-border-dark-theme); --fg: var(--kx-color-text-dark-theme); --mut: var(--kx-color-muted-dark-theme);
  --acc: var(--kx-color-accent); --acc-fg: var(--kx-color-white); --ok: var(--kx-color-success-dark-theme); --warn: var(--kx-color-warning-dark-theme); --err: var(--kx-color-error-dark-theme); --info: var(--kx-color-info-dark-theme);
  position: fixed;
  inset: auto;
  margin: 0;
  width: min(var(--kx-size-640), calc(100vw - var(--kx-size-32)));
  max-width: calc(100vw - var(--kx-size-16));
  min-width: min(var(--kx-size-260), calc(100vw - var(--kx-size-16)));
  min-height: min(var(--kx-size-160), var(--panel-height, 100dvh));
  max-height: var(--panel-height, calc(100dvh - var(--kx-size-16)));
  display: none;
  flex-direction: column;
  padding: 0;
  border: var(--kx-size-1) solid var(--line);
  border-radius: var(--kx-size-14);
  background: var(--bg);
  color: var(--fg);
  font: 400 var(--kx-size-13)/1.45 var(--kx-font-ui);
  box-shadow: var(--kx-shadow-panel);
  z-index: 2147483001;
  overflow: hidden;
}
.pop.open { display: flex; resize: both; }
.pop.wide { width: min(var(--kx-size-1000), calc(100vw - var(--kx-size-32))); }
:host(.kx-detached) { font: 500 var(--kx-size-13)/1.3 system-ui, sans-serif; color: var(--kx-color-text-dark-theme); }
:host(.kx-detached) .menu,
:host(.kx-detached) .pop {
  position: relative;
  /* Les dimensions inline de la poignée sont réservées aux panneaux flottants. */
  width: calc(100% - var(--kx-size-16)) !important;
  height: auto !important;
  resize: none;
  max-height: calc(100dvh - var(--kx-size-16));
  margin: var(--kx-size-8);
  box-shadow: none;
}
:host(.kx-detached) .collapse { display: none; }
@media (prefers-color-scheme: light) {
  .pop { --bg: var(--kx-color-white); --bg2: var(--kx-color-surface-raised-light-theme); --line: var(--kx-color-border-light-theme); --fg: var(--kx-color-text-light-theme); --mut: var(--kx-color-muted-light-theme); --info: var(--kx-color-info-light-theme); --ok: var(--kx-color-success-light-theme); --warn: var(--kx-color-warning-light-theme); --err: var(--kx-color-error-light-theme); }
}

.hd { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto auto; align-items: start; gap: var(--kx-size-8); padding: var(--kx-size-14) var(--panel-padding) var(--kx-size-12); border-bottom: var(--kx-size-1) solid var(--line); }
.hd > div { overflow-wrap: break-word; text-wrap: pretty; }
.hd .ic { font-size: var(--kx-size-20); line-height: 1.2; }
.hd h2 { margin: 0; font-size: var(--kx-size-15); font-weight: 650; }
.hd p { margin: var(--kx-size-2) 0 0; color: var(--mut); font-size: var(--kx-size-12); }
.hd .step { margin-left: auto; color: var(--mut); font-size: var(--kx-size-11); text-transform: uppercase; letter-spacing: .06em; }
.hd .back { all: unset; cursor: pointer; padding: 0 var(--kx-size-8); margin: calc(-1 * var(--kx-size-1)) 0 0 calc(-1 * var(--kx-size-6)); border-radius: var(--kx-size-6); color: var(--mut); font-size: var(--kx-size-18); line-height: 1.4; }
.hd .back:hover { background: var(--bg2); color: var(--fg); }
.hd .back:focus-visible, .hd .x:focus-visible { outline: var(--kx-size-2) solid var(--acc); outline-offset: var(--kx-size-2); }
.hd .x { all: unset; cursor: pointer; padding: var(--kx-size-2) var(--kx-size-6); border-radius: var(--kx-size-6); color: var(--mut); font-size: var(--kx-size-16); }
.hd .x:hover { background: var(--bg2); color: var(--fg); }

.bd { padding: var(--kx-size-14) var(--panel-padding); overflow: auto; flex: 1; min-height: 0; }
.ft { display: flex; gap: var(--kx-size-8); justify-content: flex-end; flex-wrap: wrap; padding: var(--kx-size-10) var(--panel-padding); border-top: var(--kx-size-1) solid var(--line); background: var(--bg2); }
.ft .left { margin-right: auto; }

.btn { all: unset; cursor: pointer; padding: var(--kx-size-7) var(--kx-size-14); border-radius: var(--kx-size-8); border: var(--kx-size-1) solid var(--line); background: var(--bg); color: var(--fg); font-weight: 550; }
.btn:hover { border-color: var(--mut); }
.btn:focus-visible { outline: var(--kx-size-2) solid var(--acc); outline-offset: var(--kx-size-2); }
.btn.primary { background: var(--acc); border-color: var(--acc); color: var(--acc-fg); }
.btn.primary:hover { filter: brightness(1.1); }
.btn.danger { color: var(--err); border-color: color-mix(in srgb, var(--err) 50%, transparent); }
.btn.link { border: 0; background: none; padding: var(--kx-size-7) var(--kx-size-4); color: var(--mut); font-weight: 400; text-decoration: underline; }
.btn[disabled] { opacity: .45; pointer-events: none; }

/* Formulaire */
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--kx-size-245), 100%), 1fr)); gap: var(--kx-size-14) var(--kx-size-16); align-items: start; }
.field { display: flex; flex-direction: column; gap: var(--kx-size-6); min-width: 0; overflow-wrap: break-word; text-wrap: pretty; }
.field > span { font-size: var(--kx-size-12); color: var(--mut); }
.field small { font-size: var(--kx-size-12); color: var(--mut); }
.field.check { flex-direction: row; align-items: flex-start; gap: var(--kx-size-8); }
.field.check > span { color: var(--fg); font-size: var(--kx-size-13); }
input[type=number], input[type=text], .album-filters input[type=search], select {
  all: unset; box-sizing: border-box; width: 100%;
  padding: var(--kx-size-6) var(--kx-size-9); border-radius: var(--kx-size-7); border: var(--kx-size-1) solid var(--line); background: var(--bg2); color: var(--fg); font-size: var(--kx-size-13);
}
select {
  padding-right: var(--kx-size-26); cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--mut) 50%), linear-gradient(135deg, var(--mut) 50%, transparent 50%);
  background-position: calc(100% - var(--kx-size-14)) 50%, calc(100% - var(--kx-size-9)) 50%;
  background-size: var(--kx-size-5) var(--kx-size-5);
  background-repeat: no-repeat;
}
input:focus-visible, select:focus-visible { border-color: var(--acc); }
input:invalid { border-color: var(--err); }
input[type=checkbox] { accent-color: var(--acc); width: var(--kx-size-15); height: var(--kx-size-15); margin: var(--kx-size-2) 0 0; flex: none; }
.rmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--kx-size-48), 100%), 1fr)); gap: var(--kx-size-6); }
.rmap label { display: flex; flex-direction: column; align-items: center; gap: var(--kx-size-2); font-size: var(--kx-size-11); color: var(--mut); }
.rmap .rar-glyph { color: var(--rc); font-weight: 800; font-size: var(--kx-size-12); }
.rmap input { text-align: center; padding: var(--kx-size-5) var(--kx-size-2); }
details { margin-top: var(--kx-size-12); border-top: var(--kx-size-1) dashed var(--line); padding-top: var(--kx-size-10); }
summary { cursor: pointer; color: var(--mut); font-size: var(--kx-size-12); margin-bottom: var(--kx-size-10); }

/* Champs regroupés sur une ligne (param.row) ; ligne masquée si tous ses champs le sont. */
.row { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--kx-size-155), 100%), 1fr)); gap: var(--kx-size-12); align-items: start; min-width: 0; }
.row:not(:has(> .field:not([hidden]))) { display: none; }
.row > .field { min-width: 0; }
.field[hidden] { display: none !important; }
.field.inactive { opacity: .45; }
.field.inactive select, .field.inactive input { cursor: not-allowed; }
.mode-toggle { position: relative; isolation: isolate; display: flex; gap: var(--kx-size-4); padding: var(--kx-size-4); border: var(--kx-size-1) solid var(--line); border-radius: var(--kx-size-12); background: var(--bg2); }
.mode-toggle input, .rar-sheet input { display: none; }
.mode-option { position: relative; z-index: 1; flex: 1; border: var(--kx-size-1) solid transparent; border-radius: var(--kx-size-8); padding: var(--kx-size-9) var(--kx-size-12); background: transparent; color: var(--mut); font: inherit; cursor: pointer; }
.mode-toggle::before { content: ""; position: absolute; z-index: 0; pointer-events: none; top: var(--kx-size-4); bottom: var(--kx-size-4); left: var(--kx-size-4); width: calc((100% - var(--kx-size-8) - (var(--n, 2) - 1) * var(--kx-size-4)) / var(--n, 2)); box-sizing: border-box; border-radius: var(--kx-size-8); border: var(--kx-size-1) solid var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); transform: translateX(calc(var(--i, 0) * (100% + var(--kx-size-4)))); transition: transform 200ms cubic-bezier(.2,.8,.2,1); }
.mode-option[aria-pressed="true"] { color: var(--fg); font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .mode-toggle::before { transition: none; } }
.field:has(.rar-sheet), .field:has(.mode-toggle), .field:has(.choice-group), .field:has(textarea) { grid-column: 1 / -1; }
.choice-group { display: flex; flex-wrap: wrap; gap: var(--kx-size-6); }
.choice-option { position: relative; flex: 1 1 auto; }
.choice-option input { position: absolute; opacity: 0; pointer-events: none; }
.choice-option span { display: block; text-align: center; padding: var(--kx-size-9) var(--kx-size-10); border-radius: var(--kx-size-10); border: var(--kx-size-1) solid var(--line); background: var(--bg2); color: var(--mut); cursor: pointer; transition: background var(--kx-transition-fast), border-color var(--kx-transition-fast); }
@container kx-panel (width < 440px) {
  .hd, .bd, .ft { --panel-padding: var(--kx-size-12); }
  .hd { grid-template-columns: auto auto minmax(0, 1fr) auto; }
  .hd .step { grid-column: 3; margin: 0; }
  .hd .x { grid-column: 4; grid-row: 1; }
  .mode-toggle { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--kx-size-94), 100%), 1fr)); }
  .mode-toggle::before { display: none; }
  .mode-option { min-width: 0; padding: var(--kx-size-8); }
  .mode-option[aria-pressed="true"] { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); }
  .choice-option { min-width: 0; max-width: 100%; }
}
.choice-option span:hover { border-color: var(--acc); }
.choice-option input:checked + span { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); color: var(--fg); font-weight: 600; }
.choice-option input:focus-visible + span { outline: var(--kx-size-2) solid var(--acc); outline-offset: var(--kx-size-2); }
textarea {
  all: unset; box-sizing: border-box; width: 100%; min-height: var(--kx-size-64); white-space: pre-wrap; resize: vertical;
  padding: var(--kx-size-6) var(--kx-size-9); border-radius: var(--kx-size-7); border: var(--kx-size-1) solid var(--line); background: var(--bg2); color: var(--fg); font-size: var(--kx-size-13);
}
textarea:focus-visible { border-color: var(--acc); }
.rar-sheet { display: flex; flex-direction: column; gap: var(--kx-size-8); min-width: 0; }
.rar-bar { touch-action: none; user-select: none; display: flex; gap: var(--kx-size-6); flex-wrap: wrap; align-items: center; }
.rar-button { --rc: var(--acc); display: inline-flex; align-items: center; justify-content: center; gap: var(--kx-size-6); min-width: var(--kx-size-36); height: var(--kx-size-36); padding: 0 var(--kx-size-8); border-radius: var(--kx-size-10); border: var(--kx-size-1) solid var(--line); background: var(--bg2); color: var(--mut); cursor: pointer; font: inherit; transition: background var(--kx-transition-fast), border-color var(--kx-transition-fast); }
.rar-button .rar-glyph { color: var(--rc); font-size: var(--kx-size-13); font-weight: 800; }
.rar-button.all { padding: 0 var(--kx-size-12); font-size: var(--kx-size-12); }
.rar-button[aria-pressed="true"] { background: color-mix(in srgb, var(--rc) 16%, var(--bg2)); border-color: var(--rc); color: var(--fg); box-shadow: inset 0 0 0 var(--kx-size-1) color-mix(in srgb, var(--rc) 20%, transparent); }
.rar-button:hover { border-color: var(--rc); }
.rar-button:focus-visible, .mode-option:focus-visible { outline: var(--kx-size-2) solid var(--acc); outline-offset: var(--kx-size-3); }
.rar-caption { color: var(--mut); font-size: var(--kx-size-11); line-height: 1.5; }

/* Albums */
.album-filters.field { gap: var(--kx-size-10); }
.album-filters input[type=search] { min-height: var(--kx-size-36); }
.album-filters input[type=search]:focus-visible { border-color: var(--acc); }
.album-filters input[type=search]::placeholder { color: var(--mut); }
.album-count { font-size: var(--kx-size-12); color: var(--mut); margin: var(--kx-size-12) 0 var(--kx-size-8); }
.album-cooldown { display: inline-flex; margin-top: var(--kx-size-8); padding: var(--kx-size-4) var(--kx-size-10); border: var(--kx-size-1) solid var(--line); border-radius: var(--kx-size-999); background: var(--bg2); color: var(--fg); font-size: var(--kx-size-12); font-variant-numeric: tabular-nums; }
.album-cooldown-bar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; height: 0; pointer-events: none; }
.album-cooldown-bar[hidden] { display: none; }
.album-cooldown-bar .album-cooldown { height: max-content; margin-top: 0; background: var(--bg2); box-shadow: 0 var(--kx-size-2) var(--kx-size-8) var(--kx-color-shadow-tint); }
.album-list { display: grid; gap: var(--kx-size-8); }
.album-card { margin: 0; padding: 0; border: var(--kx-size-1) solid var(--line); border-radius: var(--kx-size-10); background: var(--bg2); }
.album-card > summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--kx-size-6) var(--kx-size-12); padding: var(--kx-size-10) var(--kx-size-12); margin: 0; }
.album-card > summary:focus-visible { outline: var(--kx-size-2) solid var(--acc); outline-offset: calc(-1 * var(--kx-size-2)); border-radius: var(--kx-size-10); }
.album-title { font-weight: 650; color: var(--fg); overflow-wrap: anywhere; }
.album-title::before { content: "▸"; margin-right: var(--kx-size-6); color: var(--acc); }
.album-card[open] .album-title::before { content: "▾"; }
.album-missing { color: var(--fg); }
.album-max-rarity { display: inline-flex; align-items: center; justify-content: center; margin-left: var(--kx-size-6); min-width: var(--kx-size-20); height: var(--kx-size-20); border: var(--kx-size-1) solid var(--rc); border-radius: var(--kx-size-5); font-weight: 700; color: var(--rc); }
.album-card progress { width: 100%; height: var(--kx-size-8); align-self: center; accent-color: var(--acc); }
.album-owned { justify-self: end; }
.album-cards { margin: 0; padding: var(--kx-size-4) var(--kx-size-12) var(--kx-size-10); list-style: none; }
.album-cards li { display: flex; align-items: center; gap: var(--kx-size-6); padding: var(--kx-size-4) 0; font-size: var(--kx-size-12); }
.album-cards small { margin-left: auto; color: var(--mut); }
.album-card-link { color: var(--fg); text-decoration: none; overflow-wrap: anywhere; }
.album-card-link:hover, .album-card-link:focus-visible { color: var(--acc); text-decoration: underline; }

/* Aperçu */
.summary { margin: 0 0 var(--kx-size-10); }
.warn-list { margin: 0 0 var(--kx-size-10); padding: var(--kx-size-8) var(--kx-size-10) var(--kx-size-8) var(--kx-size-26); border-radius: var(--kx-size-8); background: color-mix(in srgb, var(--warn) 12%, transparent); color: var(--fg); font-size: var(--kx-size-12); }
.warn-list li + li { margin-top: var(--kx-size-2); }
.tbl-wrap { overflow: auto; border: var(--kx-size-1) solid var(--line); border-radius: var(--kx-size-8); max-height: var(--kx-scroll-region-max-height); }
table { border-collapse: collapse; width: 100%; font-size: var(--kx-size-12); }
th, td { padding: var(--kx-size-6) var(--kx-size-8); text-align: start; border-bottom: var(--kx-size-1) solid var(--line); vertical-align: top; }
th { position: sticky; top: 0; background: var(--bg2); font-weight: 600; color: var(--mut); white-space: nowrap; z-index: 1; }
td.end, th.end { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
tr.off td:not(.sel) { opacity: .45; }
tr.off td:not(.sel) { text-decoration: line-through; }
td.sel, th.sel { width: var(--kx-size-28); }
td.sel + td { min-width: var(--kx-size-150); }
.note { display: block; color: var(--warn); font-size: var(--kx-size-11); text-decoration: none; }
.count { color: var(--mut); font-size: var(--kx-size-12); align-self: center; }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--fg); }
th[aria-sort="ascending"]::after { content: " ▲"; font-size: var(--kx-size-9); }
th[aria-sort="descending"]::after { content: " ▼"; font-size: var(--kx-size-9); }
tfoot td { position: sticky; bottom: 0; background: var(--bg2); font-weight: 600; border-top: var(--kx-size-1) solid var(--line); border-bottom: 0; }
.rdot { display: inline-block; width: var(--kx-size-8); height: var(--kx-size-8); margin-right: var(--kx-size-6); border-radius: 50%; background: var(--rc); vertical-align: var(--kx-size-1); }
.presets { display: flex; align-items: center; gap: var(--kx-size-4); }
.presets select { width: auto; max-width: var(--kx-size-170); padding-top: var(--kx-size-5); padding-bottom: var(--kx-size-5); font-size: var(--kx-size-12); }

/* Chargement / exécution */
.loading { display: flex; align-items: center; gap: var(--kx-size-10); padding: var(--kx-size-18) var(--kx-size-2); color: var(--mut); }
.spin { width: var(--kx-size-16); height: var(--kx-size-16); border-radius: 50%; border: var(--kx-size-2) solid var(--line); border-top-color: var(--acc); animation: kx-spin var(--kx-spinner-duration) linear infinite; flex: none; }
@keyframes kx-spin { to { transform: rotate(360deg); } }
.status { display: flex; align-items: center; gap: var(--kx-size-8); padding: var(--kx-size-8) var(--kx-size-10); border-radius: var(--kx-size-8); background: var(--bg2); margin-bottom: var(--kx-size-10); font-size: var(--kx-size-12); }
.status.done .spin { display: none; }
.log { margin: 0; padding: 0; list-style: none; font: var(--kx-size-12)/1.45 var(--kx-font-log); max-height: var(--kx-scroll-region-max-height); overflow: auto; }
.log li { padding: var(--kx-size-3) 0; border-bottom: var(--kx-size-1) solid color-mix(in srgb, var(--line) 60%, transparent); display: flex; gap: var(--kx-size-8); }
.log time { color: var(--mut); flex: none; }
.log .success { color: var(--ok); }
.log .warn { color: var(--warn); }
.log .error { color: var(--err); }
.log .info { color: var(--info); }
.empty { color: var(--mut); padding: var(--kx-size-8) 0; }
`;
