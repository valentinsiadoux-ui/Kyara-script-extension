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
.bar { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
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
  cursor: pointer;
  white-space: nowrap;
}
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
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(300px, calc(100vw - 32px));
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #2f2f3b;
  background: #17171f;
  box-shadow: 0 18px 50px rgba(0,0,0,.5);
  display: flex;
  flex-direction: column;
}
.menu[hidden] { display: none; }
.menu .sec { display: flex; flex-direction: column; gap: 1px; padding: 2px 0; }
.menu .sec + .sec { border-top: 1px solid #262631; margin-top: 2px; padding-top: 4px; }
.menu .sec-hd { padding: 4px 10px 2px; color: #6f6f80; font-size: 10.5px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
.menu button {
  all: unset;
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.menu button:hover { background: #20202a; }
.menu .ic { font-size: 16px; line-height: 1; width: 20px; text-align: center; flex: none; }
.menu .txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-right: 12px; }
.menu b { font-weight: 600; }
.menu small { color: #9a9aab; font-size: 11.5px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.menu .dot { top: 50%; right: 8px; margin-top: -4px; }
.dot {
  position: absolute; top: 6px; right: 6px;
  width: 8px; height: 8px; border-radius: 50%;
  background: #4ad991; box-shadow: 0 0 0 2px #17171f;
  animation: kx-pulse 1.4s ease-in-out infinite;
}
.trigger .dot { top: 0; right: 2px; }
@keyframes kx-pulse { 50% { opacity: .35; } }
@media (max-width: 640px) { .trigger .lbl { display: none; } .trigger { padding-right: 10px; } }

/* ---------- Popover ---------- */
.pop {
  --bg: #17171f; --bg2: #20202a; --line: #2f2f3b; --fg: #ececf1; --mut: #9a9aab;
  --acc: #8b7bff; --acc-fg: #fff; --ok: #4ad991; --warn: #ffb347; --err: #ff6b6b; --info: #c9a3ff;
  position: fixed;
  inset: auto;
  margin: 0;
  width: min(640px, calc(100vw - 32px));
  max-height: min(78vh, 760px);
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
.pop.open { display: flex; }
.pop.wide { width: min(1000px, calc(100vw - 32px)); }
@media (prefers-color-scheme: light) {
  .pop { --bg: #fff; --bg2: #f4f4f8; --line: #e1e1ea; --fg: #1b1b24; --mut: #666678; --info: #7a3fd1; --ok: #138a52; --warn: #b36b00; --err: #c62828; }
}

.hd { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px 10px; border-bottom: 1px solid var(--line); }
.hd .ic { font-size: 20px; line-height: 1.2; }
.hd h2 { margin: 0; font-size: 15px; font-weight: 650; }
.hd p { margin: 2px 0 0; color: var(--mut); font-size: 12px; }
.hd .step { margin-left: auto; color: var(--mut); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
.hd .x { all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px; color: var(--mut); font-size: 16px; }
.hd .x:hover { background: var(--bg2); color: var(--fg); }

.bd { padding: 12px 16px; overflow: auto; flex: 1; min-height: 0; }
.ft { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid var(--line); background: var(--bg2); }
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
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px 14px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field > span { font-size: 12px; color: var(--mut); }
.field small { font-size: 11px; color: var(--mut); opacity: .85; }
.field.check { flex-direction: row; align-items: flex-start; gap: 8px; }
.field.check > span { color: var(--fg); font-size: 13px; }
input[type=number], input[type=text], select {
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
.rmap { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.rmap label { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: var(--mut); }
.rmap input { text-align: center; padding: 5px 2px; }
details { margin-top: 12px; border-top: 1px dashed var(--line); padding-top: 10px; }
summary { cursor: pointer; color: var(--mut); font-size: 12px; margin-bottom: 10px; }

/* Sélecteurs de préparation, inspirés de Kyara. */
.purchase-price, .balance-settings { grid-column: 1 / -1; }
.purchase-price input { width: 100%; box-sizing: border-box; }
.balance-settings { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.balance-settings:has(> [data-param="balance"][hidden]) { display: none; }
.balance-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: start; min-width: 0; }
.balance-fields:has(> [data-param="maxGapPercent"]:not([hidden])) { grid-template-columns: minmax(0, 1fr) 100px; }
.balance-fields:has(> [data-param="balanceMode"][hidden]) { display: none; }
.balance-fields > .field { min-width: 0; }
.balance-fields select, .balance-fields input { width: 100%; min-width: 0; box-sizing: border-box; }
.field[hidden] { display: none !important; }
.field.inactive { opacity: .45; }
.field.inactive select, .field.inactive input { cursor: not-allowed; }
.mode-toggle { position: relative; isolation: isolate; display: flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg2); }
.mode-toggle input, .rar-sheet input { display: none; }
.mode-option { position: relative; z-index: 1; flex: 1; border: 1px solid transparent; border-radius: 8px; padding: 9px 12px; background: transparent; color: var(--mut); font: inherit; cursor: pointer; }
.mode-toggle::before { content: ""; position: absolute; z-index: 0; pointer-events: none; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 6px); box-sizing: border-box; border-radius: 8px; border: 1px solid var(--acc); background: color-mix(in srgb, var(--acc) 18%, var(--bg)); transform: translateX(0); transition: transform 200ms cubic-bezier(.2,.8,.2,1); }
.mode-toggle:has(.mode-option:last-child[aria-pressed="true"])::before { transform: translateX(calc(100% + 4px)); }
.mode-option[aria-pressed="true"] { color: var(--fg); font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .mode-toggle::before { transition: none; } }
.field:has(.rar-sheet), .field:has(.mode-toggle), .field:has(.choice-group), .field:has(textarea) { grid-column: 1 / -1; }
.choice-group { display: flex; flex-wrap: wrap; gap: 6px; }
.choice-option { position: relative; flex: 1 1 auto; }
.choice-option input { position: absolute; opacity: 0; pointer-events: none; }
.choice-option span { display: block; text-align: center; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg2); color: var(--mut); cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s; }
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
