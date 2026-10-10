/* Recommender: maps each game onto 6 mood axes, scores fit vs live sliders. */
const Recommender = (() => {
  const AXES = [
    { id: 'energy', left: 'Relaxed', right: 'Intense', note: 'soft rhythm ↔ full send',
      L: ['puzzle', 'casual', 'simulation', 'relaxing', 'chill', 'calm', 'meditative', 'cozy', 'farming', 'management', 'point and click', 'turn-based', 'city builder', 'walking simulator', 'fishing'],
      R: ['action', 'shooter', 'fighting', 'battle royale', 'fast-paced', 'intense', 'hack and slash', 'bullet hell', 'difficulty', 'hardcore', 'souls-like', 'shoot em up', 'twin stick shooter', 'racing'] },
    { id: 'mood', left: 'Cozy', right: 'Dark', note: 'soft & warm ↔ grim & tense',
      L: ['cozy', 'relaxing', 'cute', 'family friendly', 'wholesome', 'colorful', 'farming', 'fishing', 'feel-good', 'heartwarming', 'cooking', 'crafting'],
      R: ['horror', 'dark', 'gore', 'psychological horror', 'survival horror', 'dark fantasy', 'zombie', 'blood', 'violent', 'creepy', 'lovecraftian', 'post-apocalyptic', 'macabre'] },
    { id: 'world', left: 'Grounded', right: 'Dreamy', note: 'real places ↔ impossible worlds',
      L: ['simulation', 'realistic', 'historical', 'sports', 'automobile', 'motorcycle', 'business', 'management', 'military', 'modern', 'city', 'farming', 'football', 'soccer', 'basketball', 'life sim'],
      R: ['surreal', 'psychedelic', 'abstract', 'dreamlike', 'fantasy', 'science fiction', 'sci-fi', 'space', 'weird', 'magic', 'experimental', 'stylized', 'atmospheric', 'mystery'] },
    { id: 'commitment', left: 'Casual', right: 'Competitive', note: 'pick up & play ↔ git gud',
      L: ['casual', 'relaxing', 'singleplayer', 'sandbox', 'puzzle', 'turn-based', 'point and click', 'cozy', 'party', 'family friendly'],
      R: ['competitive', 'esports', 'multiplayer', 'pvp', 'ranked', 'online', 'battle royale', 'fighting', 'sports', 'racing', 'massively multiplayer', 'football', 'soccer'] },
    { id: 'focus', left: 'Story', right: 'Gameplay', note: 'watch it unfold ↔ master the loop',
      L: ['story rich', 'narrative', 'visual novel', 'adventure', 'emotional', 'lore', 'choices matter', 'cinematic', 'dialogue', 'point and click', 'atmospheric'],
      R: ['action', 'roguelike', 'roguelite', 'addictive', 'skill', 'difficulty', 'platformer', 'puzzle', 'physics', 'procedural generation', 'sandbox', 'building'] },
    { id: 'social', left: 'Solo', right: 'Multiplayer', note: 'your own lane ↔ bring friends',
      L: ['singleplayer', 'story rich', 'atmospheric', 'point and click'],
      R: ['multiplayer', 'co-op', 'cooperative', 'local multiplayer', 'pvp', 'online', 'massively multiplayer', 'battle royale', 'community'] }
  ];
  const BAD = new Set(['souls-like', 'difficult', 'hardcore', 'roguelike', 'roguelite', 'perma death', 'bullet hell', 'punishing', 'high difficulty']);
  const GOOD = new Set(['relaxing', 'casual', 'puzzle', 'turn-based', 'family friendly', 'cute', 'farming', 'sandbox', 'simulation', 'cozy', 'story rich', 'visual novel']);

  const state = { mood: [40, 42, 46, 40, 44, 36], beginner: false };

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = s => new RegExp('\\b' + esc(s) + '\\b', 'i');

  function init(games) {
    const patterns = AXES.map(a => [a.L.map(rx), a.R.map(rx)]);
    for (const g of games) {
      const e = g.enriched;
      const hay = [g.title].concat(e ? e.genres : [], e ? e.tags : []).join(' ');
      g.pos = new Float32Array(6);
      let hits = 0;
      for (let i = 0; i < 6; i++) {
        const L = patterns[i][0], R = patterns[i][1];
        let l = 0, r = 0;
        for (const p of L) if (p.test(hay)) l++;
        for (const p of R) if (p.test(hay)) r++;
        g.pos[i] = (l + r) ? (100 * r) / (l + r) : 50;
        hits += l + r;
      }
      g.hits = hits;
      const all = (e ? e.tags.concat(e.genres) : []).map(t => t.toLowerCase());
      g.beginner = !all.some(t => BAD.has(t));
      g.beginnerGood = all.some(t => GOOD.has(t));
    }
  }

  function fit(g, opts) {
    opts = opts || state;
    if (opts.beginner && !g.beginner) return -999;
    let d = 0;
    for (let i = 0; i < 6; i++) d += Math.abs(opts.mood[i] - g.pos[i]);
    let f = 100 - d / 6 + (g.score - 6) * 0.8;
    f += g.hits > 0 ? 3 : -5;
    if (g.enriched) f += 2;
    if (opts.beginner && g.beginnerGood) f += 4;
    return f;
  }

  function profileText() {
    const m = state.mood;
    if (m[0] < 35 && m[1] < 45) return 'A softer landing with just enough texture.';
    if (m[0] > 70) return 'You are ready for something that bites back.';
    if (m[3] > 68) return 'Locked in — bring the competition.';
    if (m[4] < 35) return 'You want a story to sink into.';
    if (m[5] > 65) return 'Better with company tonight.';
    return 'A balanced session with room to wander.';
  }

  return { AXES, state, init, fit, profileText };
})();
