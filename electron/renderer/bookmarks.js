/**
 * TeamAI — Bookmarks (localStorage with folders)
 */
const Bookmarks = {
  KEY: 'teamai_bookmarks_v2',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || { folders: { 'Favoris': [] } }; }
    catch { return { folders: { 'Favoris': [] } }; }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
    this.render();
  },

  add(providerId, label, url) {
    if (!url || url === 'about:blank') return;
    const data = this.load();
    const folderName = Object.keys(data.folders)[0] || 'Favoris';
    if (!data.folders[folderName]) data.folders[folderName] = [];
    data.folders[folderName].push({
      id: 'bm_' + Date.now(),
      label, url, providerId, added: new Date().toISOString(),
    });
    this.save(data);
  },

  remove(folder, id) {
    const data = this.load();
    if (data.folders[folder]) {
      data.folders[folder] = data.folders[folder].filter(b => b.id !== id);
      this.save(data);
    }
  },

  addFolder(name) {
    const data = this.load();
    if (!data.folders[name]) data.folders[name] = [];
    this.save(data);
  },

  open(folder, id) {
    const data = this.load();
    const bm = data.folders[folder]?.find(b => b.id === id);
    if (bm) WinManager._createView(bm.providerId, bm.url);
  },

  render() {
    const el = document.getElementById('sidebar');
    if (!el) return;
    let old = document.getElementById('bookmarks-section');
    if (old) old.remove();

    const data = this.load();
    const div = document.createElement('div');
    div.id = 'bookmarks-section';

    let html = `<div class="bookmark-section-title" onclick="document.getElementById('bookmarks-container').classList.toggle('hidden')">🔖 Favoris ▾</div>`;
    html += `<div id="bookmarks-container">`;
    html += `<div class="bookmark-button"><button class="sidebar-btn" id="bookmark-add-folder">+ Dossier</button></div>`;

    for (const [folder, items] of Object.entries(data.folders)) {
      html += `<div class="bookmark-folder"><div class="bookmark-section-title">📁 ${folder}</div>`;
      for (const bm of items) {
        html += `<div class="bookmark-item" data-folder="${folder}" data-id="${bm.id}">
          <span>🔗</span>
          <span class="bm-name">${bm.label || bm.url}</span>
          <span class="bm-close" data-folder="${folder}" data-id="${bm.id}" title="Supprimer">✕</span>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    div.innerHTML = html;

    // Insert after providers-list
    const providersList = document.getElementById('providers-list');
    if (providersList) providersList.after(div);

    // Wire events
    div.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bm-close')) return;
        Bookmarks.open(item.dataset.folder, item.dataset.id);
      });
    });
    div.querySelectorAll('.bm-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Bookmarks.remove(btn.dataset.folder, btn.dataset.id);
      });
    });
    document.getElementById('bookmark-add-folder')?.addEventListener('click', () => {
      const name = prompt('Nom du dossier :');
      if (name) Bookmarks.addFolder(name);
    });
  },
};
