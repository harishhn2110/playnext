/* Assistant: rule-based mood parser. No LLM. Sets sliders, ranks games by tag match. */
const Assistant = (() => {
  const AX = { energy: 0, mood: 1, world: 2, commitment: 3, focus: 4, social: 5 };
  // synonym -> canonical tags + slider hints (axis: 0..100)
  const SYN = {
    cozy:      { tags: ['cozy', 'relaxing', 'cute', 'farming'], mood: { energy: 15, mood: 12, commitment: 18 } },
    relaxing:  { tags: ['relaxing', 'chill', 'casual', 'meditative'], mood: { energy: 15, commitment: 20 } },
    relax:     { tags: ['relaxing', 'chill', 'casual'], mood: { energy: 15, commitment: 20 } },
    chill:     { tags: ['relaxing', 'chill', 'casual'], mood: { energy: 18, commitment: 22 } },
    calm:      { tags: ['relaxing', 'meditative', 'atmospheric'], mood: { energy: 15 } },
    unwind:    { tags: ['relaxing', 'cozy', 'casual'], mood: { energy: 15, mood: 25 } },
    peaceful:  { tags: ['relaxing', 'cozy'], mood: { energy: 12, mood: 20 } },
    scary:     { tags: ['horror', 'dark', 'survival horror'], mood: { mood: 90, energy: 70 } },
    creepy:    { tags: ['horror', 'dark', 'psychological horror'], mood: { mood: 85 } },
    spooky:    { tags: ['horror', 'dark'], mood: { mood: 85 } },
    horror:    { tags: ['horror', 'survival horror'], mood: { mood: 90, energy: 65 } },
    intense:   { tags: ['fast-paced', 'action', 'intense'], mood: { energy: 90, commitment: 70 } },
    action:    { tags: ['action', 'shooter'], mood: { energy: 85 } },
    hard:      { tags: ['difficult', 'souls-like', 'hardcore'], mood: { energy: 85, commitment: 90 } },
    difficult: { tags: ['difficult', 'souls-like'], mood: { energy: 85, commitment: 88 } },
    challenging:{ tags: ['difficult', 'hardcore'], mood: { energy: 80, commitment: 85 } },
    souls:     { tags: ['souls-like', 'difficult'], mood: { energy: 85, commitment: 90, mood: 75 } },
    easy:      { tags: ['casual', 'relaxing', 'family friendly'], mood: { energy: 15, commitment: 15 } },
    beginner:  { tags: ['casual', 'family friendly'], mood: { energy: 20, commitment: 15 } },
    story:     { tags: ['story rich', 'narrative', 'adventure'], mood: { focus: 12 } },
    narrative: { tags: ['narrative', 'story rich'], mood: { focus: 15 } },
    emotional: { tags: ['emotional', 'story rich'], mood: { focus: 12 } },
    funny:     { tags: ['comedy', 'funny'], mood: { focus: 40, mood: 35 } },
    multiplayer:{ tags: ['multiplayer', 'online'], mood: { social: 90, commitment: 70 } },
    coop:      { tags: ['co-op', 'cooperative', 'multiplayer'], mood: { social: 92 } },
    'co-op':   { tags: ['co-op', 'cooperative', 'multiplayer'], mood: { social: 92 } },
    friends:   { tags: ['co-op', 'multiplayer', 'party'], mood: { social: 92 } },
    together:  { tags: ['co-op', 'multiplayer'], mood: { social: 88 } },
    competitive:{ tags: ['competitive', 'pvp', 'esports'], mood: { commitment: 92, social: 85 } },
    solo:      { tags: ['singleplayer'], mood: { social: 8 } },
    puzzle:    { tags: ['puzzle'], mood: { energy: 25, focus: 70 } },
    shooter:   { tags: ['shooter', 'action'], mood: { energy: 85, commitment: 70 } },
    rpg:       { tags: ['rpg'], mood: { focus: 40 } },
    strategy:  { tags: ['strategy'], mood: { energy: 40, focus: 70 } },
    racing:    { tags: ['racing', 'automobile'], mood: { energy: 70, commitment: 75 } },
    platformer:{ tags: ['platformer'], mood: { energy: 60 } },
    sports:    { tags: ['sports'], mood: { world: 20, commitment: 78 } },
    farming:   { tags: ['farming', 'simulation'], mood: { energy: 15, world: 25, mood: 20 } },
    space:     { tags: ['space', 'sci-fi'], mood: { world: 90 } },
    fantasy:   { tags: ['fantasy', 'magic'], mood: { world: 82 } },
    dreamy:    { tags: ['dreamlike', 'surreal', 'atmospheric'], mood: { world: 88 } },
    surreal:   { tags: ['surreal', 'psychedelic', 'weird'], mood: { world: 90 } },
    weird:     { tags: ['weird', 'experimental'], mood: { world: 85 } },
    dark:      { tags: ['dark', 'dark fantasy'], mood: { mood: 80 } },
    atmospheric:{ tags: ['atmospheric', 'story rich'], mood: { focus: 25, mood: 55 } },
    short:     { tags: ['short'], mood: { commitment: 30 } }
  };
  const STOP = new Set(['a', 'the', 'an', 'game', 'games', 'something', 'play', 'want', 'to', 'for', 'with', 'me', 'i', 'of', 'and', 'my', 'next', 'find', 'recommend', 'please', 'tonight', 'hours', 'hour', 'that', 'this', 'like', 'give', 'some', 'am', 'in', 'on', 'is', 'be', 'feel', 'im', 'its']);

  function parse(text) {
    const words = (text || '').toLowerCase().split(/[^a-z0-9'-]+/).filter(Boolean);
    const tags = {}; const mood = {}; const labels = [];
    for (const w of words) {
      const s = SYN[w];
      if (s) {
        (s.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1);
        labels.push(w);
        for (const axis in s.mood) {
          if (!mood[axis]) mood[axis] = [];
          mood[axis].push(s.mood[axis]);
        }
      } else if (w.length > 3 && !STOP.has(w)) {
        tags[w] = (tags[w] || 0) + 1;
      }
    }
    return { tags, mood, labels };
  }

  function applyMood(mood) {
    const changed = [];
    for (const axis in mood) {
      const vals = mood[axis];
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      Recommender.state.mood[AX[axis]] = Math.max(0, Math.min(100, avg));
      changed.push(axis);
    }
    return changed;
  }

  function ask(text, limit) {
    const parsed = parse(text);
    const changed = applyMood(parsed.mood);
    const keys = Object.keys(parsed.tags).filter(k => k.length > 2);
    const ranked = [];
    for (const g of Data.games) {
      const e = g.enriched;
      const hay = (g.title + ' ' + (e ? e.genres.join(' ') + ' ' + e.tags.join(' ') : '')).toLowerCase();
      let m = 0;
      for (const k of keys) if (hay.includes(k)) m += parsed.tags[k];
      if (!m && !e) continue;                 // keep unenriched only if title matched
      const f = Recommender.fit(g);
      if (f < -500) continue;                 // filtered by beginner toggle
      ranked.push({ g, m, score: m * 12 + f });
    }
    ranked.sort((a, b) => b.score - a.score);
    const n = Math.max(5, Math.min(limit || 7, 8));
    const matched = ranked.filter(r => r.m > 0).slice(0, n);
    const results = (matched.length >= 5 ? matched : ranked.slice(0, n));
    return { parsed, changed, keys, results };
  }

  return { ask, parse };
})();
