/* Offers: CheapShark deal lookup for Cart + Want lists, cached 30 min. */
const Offers = (() => {
  const DEAL_KEY = 'playnext.deals', STORE_KEY = 'playnext.stores', TTL = 30 * 60 * 1000;
  let stores = null, onNew = () => {}, onUpdate = () => {};
  const inflight = {};
  let deals = load();

  function load() { try { return JSON.parse(localStorage.getItem(DEAL_KEY) || '{}'); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(DEAL_KEY, JSON.stringify(deals)); } catch (e) {} }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function getStores() {
    if (stores) return stores;
    try { stores = JSON.parse(sessionStorage.getItem(STORE_KEY)) || null; } catch (e) { stores = null; }
    if (stores) return stores;
    try {
      const arr = await fetch('https://www.cheapshark.com/api/1.0/stores').then(r => r.json());
      stores = {};
      arr.forEach(s => stores[s.storeID] = s.storeName);
      sessionStorage.setItem(STORE_KEY, JSON.stringify(stores));
    } catch (e) { stores = {}; }
    return stores;
  }

  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function pickBest(title, arr, names) {
    const tw = norm(title).split(' ').filter(w => w.length > 2);
    let best = null, bestScore = 0;
    for (const d of arr) {
      const dw = norm(d.title).split(' ');
      const common = tw.filter(w => dw.includes(w)).length;
      const score = tw.length ? common / tw.length : 0;
      if (score > bestScore || (score === bestScore && best && +d.salePrice < +best.salePrice)) { bestScore = score; best = d; }
    }
    if (!best || bestScore < 0.6) return null;
    return {
      game: title, store: names[best.storeID] || ('Store ' + best.storeID), storeID: best.storeID,
      salePrice: +best.salePrice, normalPrice: +best.normalPrice, savings: Math.round(+best.savings),
      url: best.dealID ? 'https://www.cheapshark.com/redirect?dealID=' + best.dealID : 'https://www.cheapshark.com'
    };
  }

  function isFresh(title) { const c = deals[title]; return c && Date.now() - c.t < TTL; }

  async function findFor(title) {
    if (isFresh(title)) return deals[title].deal;
    if (inflight[title]) return inflight[title];
    inflight[title] = (async () => {
      const names = await getStores();
      let deal = null;
      try {
        const arr = await fetch('https://www.cheapshark.com/api/1.0/deals?title=' + encodeURIComponent(title) + '&onSale=1').then(r => r.json());
        deal = Array.isArray(arr) ? pickBest(title, arr, names) : null;
        deals[title] = { t: Date.now(), deal };
      } catch (e) {
        deals[title] = { t: Date.now(), deal: null };
      }
      save();
      delete inflight[title];
      if (deal) onNew(deal);
      return deal;
    })();
    return inflight[title];
  }

  function current(titles) {
    const out = [], seen = {};
    for (const t of titles) if (!seen[t]) { seen[t] = 1; const d = deals[t] && deals[t].deal; if (d) out.push(d); }
    return out;
  }

  async function scan(titles) {
    const list = [...new Set(titles)].filter(Boolean);
    for (const t of list) {
      if (isFresh(t)) continue;
      await findFor(t);
      await sleep(120);
      onUpdate();
    }
    return current(list);
  }

  return {
    scan, current, findFor, getStores,
    onNew: fn => onNew = fn,
    onUpdate: fn => onUpdate = fn
  };
})();
