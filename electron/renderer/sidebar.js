/**
 * TeamAI — Sidebar
 * Renders provider list, active windows stats, bookmarks, version.
 */
const Sidebar = {
  async render() {
    this._stats();
    this._providers();
    this._version();
  },

  _stats() {
    const el = document.getElementById('stats');
    if (!el) return;
    const n = WindowManager.views.size;
    const ia = WindowManager.list.filter(v => v.providerId !== 'default').length;
    el.textContent = `Fenêtres: ${n} | IA: ${ia}`;

    // Render active window list
    let html = `<div style="font-size:10px;color:#64748B;margin-top:4px;">`;
    WindowManager.list.forEach((v, i) => {
      html += `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">
        <span style="background:#1E1E2E;border-radius:3px;padding:0 4px;font-size:8px;color:#64748B;min-width:14px;text-align:center;">${i+1}</span>
        <span>${v.icon||'🌐'}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;">${v.label}</span>
        <span onclick="WindowManager.remove('${v.id}')" style="cursor:pointer;color:#555;font-size:8px;padding:0 2px;">✕</span>
      </div>`;
    });
    html += `</div>`;
    el.innerHTML += html;
  },

  _providers() {
    const el = document.getElementById('providers-list');
    if (!el) return;
    const providers = WindowManager.providers;
    el.innerHTML = providers.map(p => `
      <button class="prov-btn" data-id="${p.id}">
        ${p.icon} ${p.label}
      </button>
    `).join('');

    el.querySelectorAll('.prov-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        WindowManager.add(btn.dataset.id);
      });
    });
  },

  async _version() {
    const el = document.getElementById('version-badge');
    if (!el) return;
    try {
      const v = await teamai.getVersion();
      el.textContent = `v${v.version} — ${v.commit ? v.commit.slice(0,7) : 'dev'}`;
    } catch { el.textContent = 'v0.1.0-dev'; }
  },
};
