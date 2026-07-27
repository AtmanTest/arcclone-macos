/**
 * TeamAI — Bookmarks (localStorage)
 */
const Bookmarks = {
  KEY: 'teamai_bookmarks',
  items: [],

  init() {
    this.load();
    this.render();
    document.getElementById('add-bookmark')?.addEventListener('click', () => this.add());
  },

  load() {
    try { this.items = JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch { this.items = []; }
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.items));
  },

  add(url, label) {
    if (!url) {
      // Try to find current URL from first view
      const v = WindowManager.list[0];
      if (v && v.url && v.url !== 'about:blank') { url = v.url; }
      else { url = 'https://chatgpt.com'; label = 'ChatGPT'; }
    }
    if (!label) label = url.replace(/^https?:\/\//, '').split('/')[0];
    this.items.push({ url, label, icon: '🔖' });
    this.save();
    this.render();
  },

  remove(index) {
    this.items.splice(index, 1);
    this.save();
    this.render();
  },

  render() {
    const el = document.getElementById('bookmarks-list');
    if (!el) return;
    el.innerHTML = this.items.map((bm, i) => `
      <div class="bookmark-item" data-url="${bm.url}">
        <span>${bm.icon||'🔖'}</span>
        <span class="bm-label">${bm.label}</span>
        <span class="bm-del" data-index="${i}">✕</span>
      </div>
    `).join('');

    el.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bm-del')) return;
        const url = item.dataset.url;
        WindowManager.add('default');
        // Navigate the last added view via IPC
        setTimeout(() => {
          const ids = WindowManager.list;
          if (ids.length > 0) teamai.navigateView(ids[ids.length-1].id, url);
        }, 300);
      });
    });

    el.querySelectorAll('.bm-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.remove(parseInt(btn.dataset.index));
      });
    });
  },
};
