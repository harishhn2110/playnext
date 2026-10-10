/* Data: parses Games.csv + enriched.json, dedupes titles, merges consoles. */
const Data = (() => {
  const games = [];
  const byTitle = new Map();
  const consoles = new Set();
  const genres = new Set();
  const developers = new Set();
  const platforms = new Set();
  let loaded = false;

  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  const cleanTitle = name => { const i = name.indexOf(' Review'); return (i < 0 ? name : name.slice(0, i)).trim(); };
  const NOISE = /(steam|achievement|cloud|controller|overlay|trading|leaderboard|remote play|soundtrack|commentary|dlc|in-app|profile feature|stats|family sharing)/i;
  const cleanTags = tags => (tags || []).filter(t => typeof t === 'string' && t && /^[\x20-\x7E]+$/.test(t) && !NOISE.test(t));

  async function load() {
    const [csvRes, enrRes] = await Promise.all([
      fetch('Games.csv').then(r => r.text()),
      fetch('enriched.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}))
    ]);
    const rows = parseCSV(csvRes);
    rows.shift();
    const map = new Map();
    for (const row of rows) {
      if (!row.length) continue;
      const title = cleanTitle(row[1] || '');
      if (!title) continue;
      const score = parseInt(row[3], 10) || 0;
      let g = map.get(title);
      if (!g) { g = { title, consoles: new Set(), score: 0, label: '' }; map.set(title, g); }
      (row[0] || '').split(',').forEach(c => { c = c.trim(); if (c) g.consoles.add(c); });
      if (score > g.score) { g.score = score; g.label = (row[2] || '').trim(); }
    }
    for (const g of map.values()) {
      g.consoles = [...g.consoles].sort();
      g.consoles.forEach(c => consoles.add(c));
      const e = enrRes[g.title];
      g.enriched = (e && typeof e === 'object') ? e : null;
      if (g.enriched) {
        g.enriched.genres = g.enriched.genres || [];
        g.enriched.tags = cleanTags(g.enriched.tags);
        g.enriched.developers = g.enriched.developers || [];
        g.enriched.publishers = g.enriched.publishers || [];
        g.enriched.platforms = g.enriched.platforms || [];
        g.enriched.genres.forEach(x => genres.add(x));
        g.enriched.developers.forEach(x => developers.add(x));
        g.enriched.platforms.forEach(x => platforms.add(x));
      }
      games.push(g);
      byTitle.set(g.title, g);
    }
    Recommender.init(games);
    loaded = true;
    return games;
  }

  return {
    games, byTitle,
    get loaded() { return loaded; },
    load,
    consoleList: () => [...consoles].sort(),
    genreList: () => [...genres].sort(),
    developerList: () => [...developers].sort(),
    platformList: () => [...platforms].sort(),
    get: t => byTitle.get(t)
  };
})();
