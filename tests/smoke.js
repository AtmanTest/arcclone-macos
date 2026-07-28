/**
 * tests/smoke.js — Smoke tests de régression TeamAI
 * CHAQUE bug fixé DOIT avoir son test ici.
 * Lancement : node tests/smoke.js
 * Pre-push hook : .git/hooks/pre-push
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const R = p => path.join(ROOT, 'electron', 'renderer', p);
const E = p => path.join(ROOT, 'electron', p);
let ok=0, ko=0;
const t = (n,f) => { try { f(); ok++; console.log(`  ✅ ${n}`); } catch(e) { ko++; console.log(`  ❌ ${n}: ${e.message}`); }};
const a = (c,m) => { if(!c) throw new Error(m||'assert'); };

console.log('\n🧪 TeamAI — Smoke Tests de Régression\n');

// ── 1. Syntaxe ──
console.log('📄 Syntaxe JS');
['main.js','preload.js','renderer/app.js','renderer/windowManager.js','renderer/layoutModel.js',
 'renderer/sidebar.js','renderer/presetLayouts.js','renderer/bookmarks.js',
 'renderer/promptDispatcher.js','renderer/reportManager.js','renderer/changelog.js',
 'renderer/loginAssistant.js','renderer/resizeController.js','renderer/persistenceManager.js']
.forEach(f => t(`electron/${f}`, () => { a(fs.existsSync(E(f))); execSync(`node --check "${E(f)}"`,{encoding:'utf8'}); }));

// ── 2. Appels critiques ──
console.log('\n🔍 Appels critiques');
const wm = fs.readFileSync(R('windowManager.js'),'utf8');
const ap = fs.readFileSync(R('app.js'),'utf8');
const sb = fs.readFileSync(R('sidebar.js'),'utf8');
const lm = fs.readFileSync(R('layoutModel.js'),'utf8');
const pr = fs.readFileSync(R('presetLayouts.js'),'utf8');
const main = fs.readFileSync(E('main.js'),'utf8');
const pre = fs.readFileSync(E('preload.js'),'utf8');
const html = fs.readFileSync(R('index.html'),'utf8');
const css = fs.readFileSync(R('style.css'),'utf8');

// Phase 1: appels fondation
t('BUG-001: PresetLayouts.init() dans WinManager.init()', () => a(wm.includes('PresetLayouts.init()')));
t('BUG-002: PersistenceManager.restore() dans init()', () => a(wm.includes('PersistenceManager.restore()')));
t('BUG-003: WinManager.init(providersList) avec param', () => a(wm.includes('async init(providersList)')));
t('BUG-004: teamai.loadProviders() dans app.js', () => a(ap.includes('teamai.loadProviders()')));
t('BUG-005: try/catch global app.js', () => a(ap.includes('try {') && ap.includes('catch (e)')));
t('BUG-006: WinManager.providers (pas providersList)', () => a(sb.includes('WinManager.providers')));
t('BUG-007: _renderVersion utilise getVersion', () => a(sb.includes('teamai.getVersion()')));

// Phase 2: IPC handlers
console.log('\n🔌 IPC handlers');
['load-providers','get-version','check-update','update-app','open-auth-window',
 'open-login-window','close-login-window','open-url','set-zoom','get-zoom',
 'get-providers','dispatch-prompt'].forEach(function(h) {
  t('IPC ' + h, function() { a(main.includes("h('" + h + "',")); });
});

// Phase 3: Preload bridge
console.log('\n🌉 Bridge preload');
['getVersion','loadProviders','checkUpdate','updateApp','openAuthWindow',
 'openLoginWindow','closeLoginWindow','openUrl','setZoom','getZoom'].forEach(aa => t(aa, () => a(pre.includes(`${aa}:`))));

// Phase 4: Layout modes
console.log('\n🎨 Layout modes');
['grid','split-h','focus','cards','manual'].forEach(m => t(m, () => a(pr.includes(`id: '${m}'`))));
t('BUG-008: split-v supprimé', () => a(!pr.includes('split-v')));
t('BUG-009: shortcut V supprimé', () => a(!pr.includes("case 'v'")));
t('_computeCards()', () => a(lm.includes('_computeCards')));
t('applyViewOrder()', () => a(lm.includes('applyViewOrder')));
t('setActiveCard()', () => a(lm.includes('setActiveCard')));

// ── CRITIQUE: SEARCH ALL dispatch ──
console.log('\n⚠️  CRITIQUE — SEARCH ALL');
const pd = fs.readFileSync(path.join(ROOT,'electron','renderer','promptDispatcher.js'),'utf8');
t('BUG-045: PromptDispatcher.init() appelle _dispatchToAll', () => a(
  pd.includes('WinManager._dispatchToAll(text)'),
  '_dispatchToAll manquant dans PromptDispatcher'
));
t('BUG-046: go-btn click → dispatch', () => a(
  pd.includes("btn.addEventListener('click', dispatch)"),
  'click handler manquant'
));
t('BUG-047: Enter key → dispatch', () => a(
  pd.includes("e.key === 'Enter'"),
  'Enter handler manquant'
));
t('BUG-048: _dispatchToAll submit prioritaire', () => a(
  wm.includes('this.frames.forEach((entry) =>')
  && wm.includes('form.requestSubmit()')
  && wm.includes("getAttribute('type') === 'submit'")
  && wm.includes('data-testid')
  && wm.includes('btn.querySelector')
  && wm.includes('candidates[c].click()')
  && wm.includes('800'),
  '_dispatchToAll incomplet'
));
t('BUG-049: prompt-input dans HTML', () => a(
  html.includes('id="prompt-input"'),
  'prompt-input manquant'
));
t('BUG-050: go-btn dans HTML', () => a(
  html.includes('id="go-btn"'),
  'go-btn manquant'
));
t('_computeFocus()', () => a(lm.includes('_computeFocus')));

// Phase 5: Cards mode
console.log('\n🃏 Cards');
t('BUG-010: card-overlay template', () => a(wm.includes('card-overlay')));
t('BUG-011: header click handler', () => a(wm.includes("header.addEventListener('click', handler)")));
t('BUG-012: scroll carousel supprimé', () => a(!wm.includes('_bindCardsScroll'), 'fonction _bindCardsScroll encore présente'));
t('BUG-013: 35% width', () => a(lm.includes('0.35')));
t('BUG-014: bordure blanche', () => a(wm.includes('rgba(255,255,255,0.8)')));
t('BUG-015: dimming 0.6', () => a(wm.includes("'0.6'")));

// Phase 6: Focus
console.log('\n⊙ Focus');
t('BUG-016: focus cliquable swap', () => a(wm.includes("LayoutModel.mode === 'focus'")));
t('case focus', () => a(lm.includes("case 'focus'")));

// Phase 7: Session
console.log('\n📦 Session');
t('PersistenceManager.save()', () => a(fs.readFileSync(R('persistenceManager.js'),'utf8').includes('save()')));
t('PersistenceManager.restore()', () => a(fs.readFileSync(R('persistenceManager.js'),'utf8').includes('restore()')));
t('auto-save avant fermeture', () => a(ap.includes('localStorage.setItem(\'teamai_session\'')));
t('_saveSession()', () => a(sb.includes('_saveSession')));

// Phase 8: Update button
console.log('\n🔄 Update');
t('BUG-017: check-update IPC', () => a(main.includes("h('check-update'")));
t('BUG-018: checkUpdate bridge', () => a(pre.includes('checkUpdate:')));
t('BUG-019: update-app IPC', () => a(main.includes("h('update-app'")));
t('BUG-020: btn-update HTML', () => a(html.includes('btn-update')));
t('BUG-021: rouge #EF4444 dispo', () => a(ap.includes('#EF4444')));
t('BUG-022: check 5min interval + btn-check-update', () => a(
  ap.includes('setInterval(checkUpdate, 300000)') && ap.includes('btn-check-update'),
  'checkUpdate périodique ou btn manquant'
));

// Phase 9: Add IA
console.log('\n✚ Add IA');
t('BUG-023: btn-add-ia HTML', () => a(html.includes('btn-add-ia')));
t('BUG-024: add-ia handler', () => a(ap.includes('btn-add-ia')));

// Phase 10: Auth / Login
console.log('\n🔑 Auth');
t('BUG-025: open-auth-window IPC', () => a(main.includes("h('open-auth-window'")));
t('BUG-026: open-login-window IPC', () => a(main.includes("h('open-login-window'")));
t('BUG-027: btn-login-assistant HTML', () => a(html.includes('btn-login-assistant')));
t('BUG-028: LoginAssistant.start()', () => a(sb.includes('LoginAssistant.start()')));
// Verrou anti-typo: WinManager.providersList nulle part
console.log('  🔒 Scan anti-typo WinManager.providersList...');
const allJs = fs.readdirSync(path.join(ROOT,'electron')).reduce((acc,f) => {
  const p = path.join(ROOT,'electron',f);
  if(fs.statSync(p).isFile() && p.endsWith('.js')) acc.push(fs.readFileSync(p,'utf8'));
  return acc;
}, []);
fs.readdirSync(path.join(ROOT,'electron','renderer')).forEach(f => {
  if(f.endsWith('.js')) allJs.push(fs.readFileSync(path.join(ROOT,'electron','renderer',f),'utf8'));
});
t('BUG-044: Aucun WinManager.providersList restant', () => {
  const found = allJs.filter(code => code.includes('WinManager.providersList'));
  a(found.length === 0, 'Trouvé dans ' + found.length + ' fichier(s)');
});

// Phase 11: Reset
console.log('\n🕶️ Reset');
t('BUG-029: _resetLayout()', () => a(wm.includes('_resetLayout')));
t('BUG-030: btn-reset-layout HTML', () => a(html.includes('btn-reset-layout')));

// Phase 12: Focus fenêtre
console.log('\n👁 Focus fenêtre');
t('BUG-031: _toggleFocus()', () => a(wm.includes('_toggleFocus')));
t('BUG-032: data-action=focus toolbar', () => a(wm.includes('data-action="focus"')));

// Phase 13: Google search
console.log('\n🔍 Google search');
t('BUG-033: fallback google.com/search', () => a(wm.includes('www.google.com/search?q=')));

// Phase 14: Error bar
console.log('\n💥 Error bar');
t('BUG-034: #error-bar HTML', () => a(html.includes('error-bar')));
t('BUG-035: ErrorBar.show dans wm', () => a(wm.includes('ErrorBar.show')));
t('BUG-036: did-fail-load ErrorBar', () => a(wm.includes('ErrorBar.show(`❌')));
t('BUG-037: crashed ErrorBar', () => a(wm.includes('ErrorBar.show(`💥')));

// Phase 15: Auth popup
console.log('\n🖱️ Auth popup');
t('BUG-038: intercept google oauth', () => a(wm.includes('accounts.google.com')));
t('BUG-039: openAuthWindow', () => a(wm.includes('teamai.openAuthWindow(e.url')));

// Phase 16: User-Agent
console.log('\n🎯 User-Agent');
t('BUG-040: Chrome 125', () => a(wm.includes('Chrome/125')));

// Phase 17: Provider colors
console.log('\n🎨 Couleurs');
['gpt5_terra','gpt5_sol','gemini','raisonnement','claude','zglm','kimi','grok','nemotron','venice']
.forEach(c => t(c, () => a(wm.includes(`${c}: '`))));

// Phase 18: Provider config
console.log('\n📜 Providers');
const pv = JSON.parse(fs.readFileSync(path.join(ROOT,'config','providers.json'),'utf8'));
t('tableau', () => a(Array.isArray(pv)));
t('>=10 providers', () => a(pv.length>=10));
pv.forEach(p => t(p.id, () => a(p.id && p.label && p.url)));
t('BUG-041: ChatGPT Raisonnement', () => a(pv.find(p=>p.id==='raisonnement')?.label?.includes('ChatGPT')));
const ver = JSON.parse(fs.readFileSync(path.join(ROOT,'config','version.json'),'utf8'));
t('version.json', () => a(ver.version && ver.commit));

// Phase 19: HTML elements
console.log('\n📋 HTML');
['btn-update','btn-check-update','btn-add-ia','btn-save-session','version-badge','grid-container',
 'error-bar','prompt-input','go-btn','btn-attach','btn-new-tab','btn-login-assistant',
 'btn-report','btn-reset-layout','zoom-in','zoom-out','zoom-level',
 'providers-list','sidebar-bottom','window-list','stats','prompt-wrap',
 'viewport','login-modal','report-modal']
.forEach(id => t(`#${id}`, () => a(html.includes(`id="${id}"`))));
t('card-overlay dans HTML ou JS', () => a(html.includes('card-overlay') || wm.includes('card-overlay'), 'card-overlay introuvable'));
t('BUG-042: SEARCH ALL', () => a(html.includes('SEARCH ALL')));

// Phase 20: CSS
console.log('\n🎯 CSS');
['.card-overlay','.card-header','.window-frame','#error-bar','#prompt-wrap',
 '.focused','.resize-handle','.num-badge','.webview-area','.url-bar',
 '.nav-btn','.close-btn','.card-header-icon','.card-header-name']
.forEach(sel => t(sel, () => a(css.includes(sel))));
t('BUG-043: prompt-actions absolute', () => a(css.includes('position: absolute')));

// Phase 21: Electron config
console.log('\n🛡️ Electron');
t('webviewTag: true', () => a(main.includes('webviewTag: true')));
t('contextIsolation: true', () => a(main.includes('contextIsolation: true')));
t('preload path', () => a(main.includes("preload: path.join(__dirname, 'preload.js')")));

// Phase 22: Script loading
console.log('\n📜 Script order');
const sc = html.match(/<script src="(.*?)"><\/script>/g)||[];
t('>=12 scripts', () => a(sc.length>=12));
t('wm avant layoutModel', () => a(html.indexOf('windowManager.js') < html.indexOf('layoutModel.js')));
t('app.js dernier', () => a(html.includes('<script src="app.js"></script>')));

// ── Résultat ──
console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 Résultat : ${ok} ✅ / ${ko} ❌`);
if (ko > 0) { console.log(`\n⚠️  ${ko} échec(s). Corrige avant push !\n`); process.exit(1); }
else console.log('✅ Zéro régression. Push autorisé.\n');
