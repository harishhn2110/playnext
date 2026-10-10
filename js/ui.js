/* UI: browse grid, filters, sliders, assistant, lists drawer, modal, offers. */
const UI = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const PAGE = 48;
  const CONSOLE = { NS: 'Switch', XONE: 'Xbox One', XSX: 'Xbox Series', PS4: 'PS4', PS3: 'PS3', PS5: 'PS5', PS: 'PlayStation', VITA: 'Vita', WIIU: 'Wii U', WII: 'Wii', MAC: 'Mac', LNX: 'Linux', IOS: 'iOS', AND: 'Android', MOBI: 'Mobile', X360: 'Xbox 360', XBOX: 'Xbox', DS: 'DS', '3DS': '3DS', GC: 'GameCube', N64: 'N64', GEN: 'Genesis', DC: 'Dreamcast', SAT: 'Saturn' };
  const cShort = c => CONSOLE[c] || c;
  const ICON = s => 'https://cdn.jsdelivr.net/npm/simple-icons@11/icons/' + s + '.svg';
  const CART = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  const STORES = [
    { name: 'Steam', slug: 'steam', rawg: 1, search: t => 'https://store.steampowered.com/search/?term=' + enc(t) },
    { name: 'Epic', slug: 'epicgames', rawg: 11, search: t => 'https://store.epicgames.com/en-US/search?q=' + enc(t) },
    { name: 'EA', slug: 'ea', rawg: null, search: t => 'https://www.ea.com/games/library?search=' + enc(t) },
    { name: 'GOG', slug: 'gogdotcom', rawg: 5, search: t => 'https://www.gog.com/en/games?query=' + enc(t) },
    { name: 'Xbox', slug: 'xbox', rawg: 2, search: t => 'https://www.xbox.com/en-US/search?q=' + enc(t) },
    { name: 'PlayStation', slug: 'playstation', rawg: 3, search: t => 'https://store.playstation.com/en-us/search/' + enc(t) },
    { name: 'Nintendo', slug: 'nintendoswitch', rawg: 6, search: t => 'https://www.nintendo.com/us/search/?q=' + enc(t) }
  ];

  let page = 1, sort = 'fit', q = '', fConsole = '', fDeveloper = '', fGenre = '', fMin = 1, rows = [];
  let currentGame = null, currentDetail = null, rafId = null, clearMoodOn = false, savedMood = null;

  /* ---------- sliders / filters ---------- */
  function renderSliders() {
    $('#sliders').innerHTML = Recommender.AXES.map((a, i) => `
      <div class="slider">
        <div class="slider-head"><b>${a.left}</b><span>${a.note}</span><b>${a.right}</b></div>
        <input class="range" type="range" min="0" max="100" value="${Recommender.state.mood[i]}" data-axis="${i}">
      </div>`).join('');
    $('#profile-text').textContent = clearMoodOn ? 'Mood cleared — browsing every game.' : Recommender.profileText();
  }
  function setClearMood(on) {
    if (on && !clearMoodOn) savedMood = Recommender.state.mood.slice();
    if (on) Recommender.state.mood = [50, 50, 50, 50, 50, 50];
    else if (savedMood) Recommender.state.mood = savedMood.slice();
    clearMoodOn = on;
    const cb = $('#clear-mood'); if (cb) cb.checked = on;
    renderSliders(); page = 1; renderGrid();
  }
  function unsetClearMood() {
    if (!clearMoodOn) return;
    clearMoodOn = false; savedMood = null;
    const cb = $('#clear-mood'); if (cb) cb.checked = false;
  }
  function renderFilterOptions() {
    $('#f-console').innerHTML = '<option value="">All platforms</option>' + Data.consoleList().map(c => `<option value="${esc(c)}">${esc(cShort(c))}</option>`).join('');
    $('#f-developer').innerHTML = '<option value="">All developers</option>' + Data.developerList().map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    $('#f-genre').innerHTML = '<option value="">All genres</option>' + Data.genreList().map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  }

  /* ---------- grid ---------- */
  function compute() {
    const list = [];
    for (const g of Data.games) {
      if (fConsole && !g.consoles.includes(fConsole)) continue;
      if (fMin > 1 && g.score < fMin) continue;
      if (fGenre && !(g.enriched && g.enriched.genres.includes(fGenre))) continue;
      if (fDeveloper && !(g.enriched && g.enriched.developers.includes(fDeveloper))) continue;
      if (q) {
        const e = g.enriched;
        const hay = (g.title + ' ' + g.consoles.join(' ') + ' ' + (e ? e.genres.join(' ') + ' ' + e.tags.join(' ') + ' ' + e.developers.join(' ') + ' ' + e.platforms.join(' ') : '')).toLowerCase();
        if (!hay.includes(q)) continue;
      }
      if (Recommender.state.beginner && !g.beginner) continue;
      list.push({ g, f: Recommender.fit(g) });
    }
    if (sort === 'fit') list.sort((a, b) => b.f - a.f);
    else if (sort === 'ign') list.sort((a, b) => b.g.score - a.g.score || b.f - a.f);
    else if (sort === 'ign_asc') list.sort((a, b) => a.g.score - b.g.score);
    else if (sort === 'title') list.sort((a, b) => a.g.title.localeCompare(b.g.title));
    else if (sort === 'meta') list.sort((a, b) => meta(b.g) - meta(a.g) || b.g.score - a.g.score);
    else if (sort === 'new') list.sort((a, b) => rel(b.g).localeCompare(rel(a.g)));
    rows = list;
  }
  const meta = g => (g.enriched && g.enriched.metacritic) || 0;
  const rel = g => String((g.enriched && g.enriched.released) || '');

  function poster(g) {
    if (g.enriched && g.enriched.image) return `<img loading="lazy" src="${esc(g.enriched.image)}" alt="" onload="this.classList.add('ok')" onerror="this.remove()">`;
    return `<div class="poster-empty">${esc((g.title[0] || '?'))}</div>`;
  }
  function card({ g, f }) {
    const genres = g.enriched && g.enriched.genres.length ? g.enriched.genres.slice(0, 2).join(' · ') : g.consoles.slice(0, 3).map(cShort).join(' · ');
    return `<article class="card" data-title="${esc(g.title)}">
      <div class="poster">${poster(g)}<div class="poster-shade"></div>
        <div class="chips"><span class="chip ign">IGN ${g.score}</span><span class="chip fit">${Math.max(0, Math.round(f))}% fit</span></div>
        <div class="poster-copy"><h3>${esc(g.title)}</h3><small>${esc(genres)}</small></div>
      </div>
      <div class="card-meta"><span>${g.enriched && g.enriched.released ? esc(g.enriched.released.slice(0, 4)) : esc(g.consoles.slice(0, 2).map(cShort).join(', '))}</span><strong>★ ${g.score}</strong></div>
    </article>`;
  }
  function renderGrid() {
    const grid = $('#grid');
    if (!Data.loaded) { grid.innerHTML = Array.from({ length: 12 }, () => '<div class="skeleton card"></div>').join(''); return; }
    compute();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE, page * PAGE);
    grid.innerHTML = slice.length ? slice.map(card).join('') : '<div class="empty" style="grid-column:1/-1">No games match those filters. Try widening them.</div>';
    renderPager(pages);
    $('#result-count').textContent = rows.length.toLocaleString();
  }
  function renderPager(pages) {
    let btns = '';
    const from = Math.max(1, page - 3), to = Math.min(pages, page + 3);
    btns += `<button data-go="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>`;
    if (from > 1) btns += `<button data-go="1">1</button>` + (from > 2 ? '<span class="pinfo">…</span>' : '');
    for (let i = from; i <= to; i++) btns += `<button data-go="${i}" class="${i === page ? 'active' : ''}">${i}</button>`;
    if (to < pages) btns += (to < pages - 1 ? '<span class="pinfo">…</span>' : '') + `<button data-go="${pages}">${pages}</button>`;
    btns += `<button data-go="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button>`;
    $('#pager').innerHTML = btns + `<span class="pinfo">Showing ${((page - 1) * PAGE + 1).toLocaleString()}–${Math.min(page * PAGE, rows.length).toLocaleString()} of ${rows.length.toLocaleString()}</span>`;
  }

  /* ---------- lists ---------- */
  function badges() {
    const c = Lists.counts();
    const set = (id, n) => { const el = document.getElementById(id); el.textContent = n; el.classList.toggle('hide', !n); };
    set('badge-want', c.want); set('badge-completed', c.completed); set('badge-cart', c.cart);
  }
  let tabCurrent = 'want';
  function listItem(g) {
    const t = esc(g.title);
    return `<div class="list-item" data-title="${t}">
      <div data-open="1" style="cursor:pointer">${poster(g)}</div>
      <div class="li-main" data-open="1" style="cursor:pointer"><b>${esc(g.title)}</b><small>IGN ${g.score}${g.enriched && g.enriched.released ? ' · ' + esc(g.enriched.released.slice(0, 4)) : ''}</small></div>
      <div class="li-actions">
        <button class="mini ${Lists.has('want', g.title) ? 'on' : ''}" data-mv="want" title="Want to Play">♡</button>
        <button class="mini ${Lists.has('completed', g.title) ? 'on' : ''}" data-mv="completed" title="Completed">✓</button>
        <button class="mini ${Lists.has('cart', g.title) ? 'on' : ''}" data-mv="cart" title="Cart">${CART}</button>
        <button class="mini" data-rm="1" title="Remove">✕</button>
      </div></div>`;
  }
  function renderLists() {
    const c = Lists.counts();
    $('#tabs').innerHTML =
      `<button data-tab="want" class="${tabCurrent === 'want' ? 'active' : ''}">Want (${c.want})</button>
       <button data-tab="completed" class="${tabCurrent === 'completed' ? 'active' : ''}">Done (${c.completed})</button>
       <button data-tab="cart" class="${tabCurrent === 'cart' ? 'active' : ''}">Cart (${c.cart})</button>`;
    const titles = Lists.list(tabCurrent).map(t => Data.get(t)).filter(Boolean);
    $('#list-body').innerHTML = titles.length ? titles.map(listItem).join('')
      : '<div class="empty">Nothing here yet. Add games from Discover.</div>';
    badges();
  }

  /* ---------- modal ---------- */
  function badgesFor(g, detail) {
    const out = [`<div class="score ign"><small>IGN</small><strong>${g.score}/10</strong></div>`];
    const mc = (detail && detail.metacritic) || meta(g);
    if (mc) out.push(`<div class="score mc ${mc >= 75 ? 'green' : mc >= 50 ? 'yellow' : 'red'}"><small>Metacritic</small><strong>${mc}</strong></div>`);
    return out.join('');
  }
  function storeRow(g, detail) {
    if (detail && detail.__error) return '<span class="hint">Could not load store info from RAWG.</span>';
    if (!detail) {
      return (g.enriched && g.enriched.rawgId)
        ? '<span class="hint">Checking store availability…</span>'
        : '<span class="hint">Store availability needs RAWG data — run enrich.js.</span>';
    }
    const urls = {};
    (detail.stores || []).forEach(s => { const id = s.store ? s.store.id : s.id; if (id) urls[id] = s.url || ''; });
    const available = STORES.filter(s => s.rawg && (s.rawg in urls));
    if (!available.length) return '<span class="hint">No store listings found on RAWG for this game.</span>';
    return available.map(s => {
      const direct = urls[s.rawg];
      const url = /^https?:/.test(direct) ? direct : s.search(g.title);
      return `<a class="store" href="${esc(url)}" target="_blank" rel="noopener"><img src="${ICON(s.slug)}" alt="" onerror="this.style.visibility='hidden'">${s.name} <span style="color:var(--muted)">↗</span></a>`;
    }).join('');
  }
  function detailHTML(g, detail) {
    const d = (detail && !detail.__error) ? detail : null;
    const enr = g.enriched || {};
    const genreNames = (d && d.genres ? d.genres.map(x => x.name) : enr.genres) || [];
    const dev = d && d.developers && d.developers.length ? d.developers.map(x => x.name).join(', ') : '—';
    const pub = d && d.publishers && d.publishers.length ? d.publishers.map(x => x.name).join(', ') : '—';
    const rel = (d && d.released) || enr.released || '—';
    let desc;
    if (d && (d.description_raw || d.description)) desc = (d.description_raw || d.description).replace(/<[^>]+>/g, '');
    else desc = enr.rawgId ? 'Loading description…' : 'No RAWG data yet — run enrich.js to pull descriptions, genres and posters.';
    const img = (d && d.background_image) || enr.image;
    const has = t => Lists.has(t, g.title);
    return `<button class="mini close-x" data-close="1">✕</button>
      <div class="detail-top">
        <div>${img ? `<img class="detail-cover" src="${esc(img)}" alt="">` : `<div class="detail-cover" style="display:grid;place-items:center;font-size:52px;color:rgba(255,255,255,.2)">${esc(g.title[0])}</div>`}</div>
        <div class="detail">
          <div class="eyebrow">Game dossier</div>
          <h2>${esc((d && d.name) || g.title)}</h2>
          <p class="detail-desc">${esc(desc)}</p>
          <div class="detail-info">
            <div><small>Developer</small><strong>${esc(dev)}</strong></div>
            <div><small>Publisher</small><strong>${esc(pub)}</strong></div>
            <div><small>Release</small><strong>${esc(String(rel))}</strong></div>
          </div>
          ${genreNames.length ? `<div class="hint">${esc(genreNames.slice(0, 6).join(' · '))}</div>` : ''}
          <div class="scores">${badgesFor(g, d)}</div>
          <div class="actions">
            <button data-act="want" class="${has('want') ? 'on' : ''}">♡ ${has('want') ? 'On your shelf' : 'Want to Play'}</button>
            <button data-act="completed" class="${has('completed') ? 'on' : ''}">✓ ${has('completed') ? 'Completed' : 'Mark completed'}</button>
            <button data-act="cart" class="${has('cart') ? 'on' : ''}">${CART} ${has('cart') ? 'In cart' : 'Add to Cart'}</button>
          </div>
          <div class="hint" style="margin-top:8px">Consoles: ${esc(g.consoles.map(cShort).join(', '))}</div>
        </div>
      </div>
      <div class="buy"><h3>Available on</h3><div class="stores">${storeRow(g, detail)}</div></div>`;
  }
  function renderDetail() { if (currentGame) $('#detail').innerHTML = detailHTML(currentGame, currentDetail); }
  function openDetail(title) {
    const g = Data.get(title); if (!g) return;
    currentGame = g; currentDetail = null;
    $('#modal').classList.add('open'); document.body.style.overflow = 'hidden';
    renderDetail();
    if (g.enriched && g.enriched.rawgId) {
      fetch('/api/rawg/game/' + g.enriched.rawgId).then(r => (r.ok ? r.json() : null)).then(d => {
        if (currentGame === g) { currentDetail = d || { __error: true }; renderDetail(); }
      }).catch(() => { if (currentGame === g) { currentDetail = { __error: true }; renderDetail(); } });
    }
  }
  function closeDetail() { $('#modal').classList.remove('open'); document.body.style.overflow = ''; currentGame = null; currentDetail = null; }

  /* ---------- assistant ---------- */
  function askAssistant() {
    const text = $('#assistant-input').value.trim();
    if (!text) return;
    unsetClearMood();
    const res = Assistant.ask(text, 7);
    renderSliders(); renderGrid();
    const changed = res.changed.length ? ` Sliders nudged toward ${res.changed.join(', ')}.` : '';
    $('#assistant-reply').innerHTML = `Found <b>${res.results.length}</b> games for “${esc(text)}”.${esc(changed)}`;
    $('#assistant-results').innerHTML = res.results.map(({ g }) => {
      const e = g.enriched;
      const hay = (g.title + ' ' + (e ? e.genres.join(' ') + ' ' + e.tags.join(' ') : '')).toLowerCase();
      const hit = res.keys.find(k => hay.includes(k));
      const tagline = (e && e.tags.length ? e.tags.slice(0, 2).join(', ') : g.consoles.slice(0, 2).map(cShort).join(', '));
      const reason = hit ? `Matches “${esc(hit)}” · ${esc(tagline)} · IGN ${g.score}` : `${esc(tagline)} · IGN ${g.score}`;
      const thumb = e && e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy">` : `<div class="poster-empty" style="width:42px;height:56px;border-radius:8px">${esc(g.title[0])}</div>`;
      return `<button class="aresult" data-title="${esc(g.title)}">${thumb}<span><b>${esc(g.title)}</b><small>${reason}</small></span></button>`;
    }).join('');
  }

  /* ---------- offers ---------- */
  const allListTitles = () => [...new Set([...Lists.list('want'), ...Lists.list('cart')])];
  function offersState() {
    const offers = Offers.current(allListTitles());
    const b = $('#badge-offers');
    b.textContent = offers.length; b.classList.toggle('hide', !offers.length);
    $('#offers-body').innerHTML = offers.length
      ? offers.map(o => `<div class="offer-row"><div style="flex:1"><b>${esc(o.game)}</b> on <b>${esc(o.store)}</b><br><small class="hint">-${o.savings}% · $${o.salePrice.toFixed(2)} <s>$${o.normalPrice.toFixed(2)}</s></small></div><a class="mini" href="${esc(o.url)}" target="_blank" rel="noopener">↗</a></div>`).join('')
      : '<div class="empty">No active deals right now. We scan your Cart and Want to Play lists automatically.</div>';
  }
  function toast(html) {
    const el = document.createElement('div');
    el.className = 'toast'; el.innerHTML = html;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 7000);
  }
  function scanOffers() { Offers.scan(allListTitles()); }

  /* ---------- celebration effects ---------- */
  function fxLayer() {
    let layer = document.getElementById('fx');
    if (!layer) { layer = document.createElement('div'); layer.id = 'fx'; document.body.appendChild(layer); }
    return layer;
  }
  function heartBurst() {
    const layer = fxLayer();
    for (let i = 0; i < 16; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'fx-heart'; el.textContent = '♥';
        el.style.left = (5 + Math.random() * 90) + 'vw';
        el.style.fontSize = (18 + Math.random() * 24) + 'px';
        el.style.setProperty('--drift', ((Math.random() * 2 - 1) * 70) + 'px');
        el.style.animationDuration = (2.4 + Math.random() * 1.6) + 's';
        layer.appendChild(el);
        setTimeout(() => el.remove(), 4600);
      }, i * 70);
    }
  }
  function partyBurst() {
    const layer = fxLayer();
    const colors = ['#c9ff55', '#93a4ff', '#ffd166', '#ff6b6b'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('div');
      p.className = 'fx-confetti';
      p.style.left = (8 + Math.random() * 84) + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', ((Math.random() * 2 - 1) * 240) + 'px');
      p.style.setProperty('--dy', (-120 - Math.random() * 240) + 'px');
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1) + 's';
      if (i % 3 === 0) p.style.borderRadius = '50%';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 3400);
    }
    const el = document.createElement('div');
    el.className = 'fx-congrats'; el.textContent = 'Congratulations!';
    layer.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1700);
    setTimeout(() => el.remove(), 2600);
  }

  /* ---------- drawer ---------- */
  function openDrawer(t) { tabCurrent = t; renderLists(); $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open'); }

  /* ---------- schedule ---------- */
  function schedule() { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = null; renderGrid(); }); }

  /* ---------- bind ---------- */
  function bind() {
    $('#grid').addEventListener('click', e => { const c = e.target.closest('[data-title]'); if (c) openDetail(c.dataset.title); });
    $('#assistant-results').addEventListener('click', e => { const c = e.target.closest('[data-title]'); if (c) openDetail(c.dataset.title); });
    $('#detail').addEventListener('click', e => {
      if (e.target.closest('[data-close]')) return closeDetail();
      const act = e.target.closest('[data-act]');
      if (act && currentGame) { Lists.toggle(act.dataset.act, currentGame.title); renderDetail(); }
    });
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeDetail(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDetail(); closeDrawer(); $('#offers-panel').classList.remove('open'); } });

    document.addEventListener('input', e => {
      const r = e.target.closest('.range');
      if (r && r.dataset.axis != null) {
        unsetClearMood();
        Recommender.state.mood[+r.dataset.axis] = +r.value;
        $('#profile-text').textContent = Recommender.profileText();
        schedule();
      }
    });
    $('#search').addEventListener('input', e => {
      q = e.target.value.trim();
      $('#search-clear').classList.toggle('show', !!e.target.value);
      page = 1; schedule();
    });
    $('#search-clear').addEventListener('click', () => {
      const input = $('#search'); input.value = ''; q = '';
      $('#search-clear').classList.remove('show');
      page = 1; renderGrid(); input.focus();
    });
    $('#f-console').addEventListener('change', e => { fConsole = e.target.value; page = 1; schedule(); });
    $('#f-developer').addEventListener('change', e => { fDeveloper = e.target.value; page = 1; schedule(); });
    $('#f-genre').addEventListener('change', e => { fGenre = e.target.value; page = 1; schedule(); });
    $('#f-sort').addEventListener('change', e => { sort = e.target.value; page = 1; schedule(); });
    $('#f-min').addEventListener('input', e => { fMin = +e.target.value; $('#f-min-out').textContent = fMin; page = 1; schedule(); });
    $('#beginner').addEventListener('change', e => { Recommender.state.beginner = e.target.checked; page = 1; schedule(); });
    $('#clear-mood').addEventListener('change', e => setClearMood(e.target.checked));
    $('#pager').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b && !b.disabled) { page = +b.dataset.go; renderGrid(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    $('#ask').addEventListener('click', askAssistant);
    $('#assistant-input').addEventListener('keydown', e => { if (e.key === 'Enter') askAssistant(); });

    ['want', 'completed', 'cart'].forEach(t => $('#nav-' + t).addEventListener('click', () => openDrawer(t)));
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tabCurrent = b.dataset.tab; renderLists(); } });
    $('#list-body').addEventListener('click', e => {
      const item = e.target.closest('.list-item'); if (!item) return;
      const title = item.dataset.title;
      if (e.target.closest('[data-rm]')) { Lists.removeFromAll(title); return; }
      const mv = e.target.closest('[data-mv]'); if (mv) { Lists.toggle(mv.dataset.mv, title); return; }
      if (e.target.closest('[data-open]')) openDetail(title);
    });
    $('#bell').addEventListener('click', e => { e.stopPropagation(); $('#offers-panel').classList.toggle('open'); });
    document.addEventListener('click', e => { if (!e.target.closest('#offers-panel') && !e.target.closest('#bell')) $('#offers-panel').classList.remove('open'); });

    let prevWant = new Set(Lists.list('want')), prevDone = new Set(Lists.list('completed'));
    Lists.onChange(store => {
      const w = new Set(store.want), d = new Set(store.completed);
      if ([...w].some(t => !prevWant.has(t))) heartBurst();
      if ([...d].some(t => !prevDone.has(t))) partyBurst();
      prevWant = w; prevDone = d;
      renderLists(); scanOffers();
    });
    Offers.onUpdate(offersState);
    Offers.onNew(deal => {
      toast(`Offer on <b>${esc(deal.game)}</b> on <b>${esc(deal.store)}</b>: -${deal.savings}% ($${deal.salePrice.toFixed(2)}) <a href="${esc(deal.url)}" target="_blank" rel="noopener" style="color:var(--lime)">View ↗</a>`);
      offersState();
    });
  }

  /* ---------- init ---------- */
  function init() {
    bind();
    renderSliders();
    renderFilterOptions();
    $('#profile-text').textContent = Recommender.profileText();
    renderGrid();
    badges();
    offersState();
    const enrichedCount = Data.games.filter(g => g.enriched).length;
    $('#stat-games').textContent = Data.games.length.toLocaleString();
    $('#stat-enriched').textContent = enrichedCount.toLocaleString();
    $('#notice').innerHTML = enrichedCount
      ? ''
      : '<div class="notice">Posters, genres and tags come from RAWG. Run <b>node enrich.js</b> then reload to light them up. Browse still works on CSV data.</div>';
    scanOffers();
  }

  return { init, openDetail, closeDetail, renderGrid };
})();
