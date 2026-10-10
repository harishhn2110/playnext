// Resumable RAWG enrichment job:
//   node enrich.js [--limit N] [--delay MS]      match titles, pull search-level data
//   node enrich.js --details [--limit N]         backfill developers/publishers for enriched titles
import fs from "node:fs";
import "dotenv/config";

const CSV = "Games.csv", OUT = "enriched.json";
const KEY = process.env.RAWG_KEY || "";
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf("--" + n); return i < 0 ? d : +args[i + 1]; };
const LIMIT = flag("limit", 0), DELAY = flag("delay", 300);
const MODE = args.includes("--details") ? "details" : "run";

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

function loadTitles() {
  const rows = parseCSV(fs.readFileSync(CSV, "utf8")).slice(1);
  const map = new Map();
  for (const r of rows) {
    const raw = r[1] || "", k = raw.indexOf(" Review");
    const title = (k >= 0 ? raw.slice(0, k) : raw).trim();
    if (!title) continue;
    const score = parseInt(r[3], 10) || 0;
    const prev = map.get(title);
    if (!prev) map.set(title, { title, score });
    else if (score > prev.score) prev.score = score;
  }
  return [...map.values()];
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function similarity(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.replace(/ /g, "") === B.replace(/ /g, "")) return 1; // "nba2k17" == "nba 2k17"
  const ta = new Set(A.split(" ").filter(w => w.length > 1)), tb = new Set(B.split(" ").filter(w => w.length > 1));
  let common = 0; for (const w of ta) if (tb.has(w)) common++;
  const contain = common / ta.size;
  const jaccard = common / (ta.size + tb.size - common);
  let s = Math.max(contain * 0.75 + jaccard * 0.25, contain);
  if (B.startsWith(A) || A.startsWith(B)) s = Math.max(s, 0.92);
  return s;
}

// Strip platform/edition/marketing noise so variants ("GTA 5 PS4/Xbox One/PC") still match.
const PLATFORM_WORDS = /\b(pc|ps[0-9]|psp|psvita|vita|xbox(?: one| series [xs])?|nintendo switch|switch|wii ?u?|3ds|ds|ios|android|mac|linux|mobile|import|edition|remaster(?:ed)?|definitive|complete|goty|game of the year|hd)\b/gi;
const cleanQuery = title => title
  .replace(/[\/|+]/g, " ")
  .replace(/\b(ep\.?|episode)\s*\d+/gi, " ")
  .replace(PLATFORM_WORDS, " ")
  .replace(/\breview\b/gi, " ")
  .replace(/\s+/g, " ")
  .trim();

async function fetchJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "playnext-enrich/1.0" } });
      if (r.status === 401 || r.status === 403) throw new Error("AUTH " + r.status);
      if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
      if (!r.ok) return null; // other 4xx: give up on this title
      return await r.json();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise(r => setTimeout(r, 800 * i));
    }
  }
  return null;
}

function save(data) {
  const tmp = OUT + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, OUT);
}

const enriched = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const TAG_NOISE = /(steam|achievement|cloud|controller|overlay|trading|leaderboard|remote play|soundtrack|commentary|dlc|in-app|profile feature|stats|family sharing)/i;
const cleanTags = tags => (tags || []).map(t => t && t.name ? t.name : t)
  .filter(t => typeof t === "string" && t && /^[\x20-\x7E]+$/.test(t) && !TAG_NOISE.test(t));
const titles = loadTitles();
const pending = titles.filter(t => !(t.title in enriched)).sort((a, b) => b.score - a.score);
const total = titles.length, done0 = total - pending.length;
console.log(`titles ${total} · already enriched ${done0} · pending ${pending.length}${LIMIT ? " · limit " + LIMIT : ""}`);

let i = 0, added = 0, since = 0, stopped = false;
const bye = () => { stopped = true; };
process.on("SIGINT", bye); process.on("SIGTERM", bye);

async function matchQuery(query) {
  const url = new URL("https://api.rawg.io/api/games");
  url.search = new URLSearchParams({ key: KEY, search: query, page_size: "10" });
  const data = await fetchJSON(url);
  const results = data?.results || [];
  let best = null, bestS = 0;
  for (const r of results) {
    const s = similarity(query, r.name);
    if (s > bestS) { bestS = s; best = r; }
  }
  return best && bestS >= 0.55 ? best : null;
}

const toEntry = g => ({
  rawgId: g.id,
  genres: (g.genres || []).map(x => x.name),
  tags: cleanTags(g.tags),
  image: g.background_image || "",
  rating: g.rating || null,
  metacritic: g.metacritic || null,
  released: g.released || "",
  platforms: (g.platforms || []).map(p => (p.platform ? p.platform.name : p.name)).filter(Boolean),
  stores: (g.stores || []).map(s => (s.store ? s.store.id : s.id)).filter(Boolean),
  developers: [],
  publishers: []
});

async function bestMatch(title) {
  let best = await matchQuery(title);
  if (!best) {
    const cleaned = cleanQuery(title);
    if (cleaned && cleaned.toLowerCase() !== title.toLowerCase()) best = await matchQuery(cleaned);
  }
  return best ? toEntry(best) : null;
}

// Fill developers/publishers/platforms/stores for already-enriched titles (resumable).
async function backfillDetails() {
  const keys = Object.keys(enriched).filter(k => enriched[k] && !(enriched[k].developers && enriched[k].developers.length));
  console.log(`detail backfill · ${keys.length} entries missing developer data`);
  let n = 0;
  for (const k of keys) {
    if (stopped) break;
    if (LIMIT && n >= LIMIT) break;
    try {
      const d = await fetchJSON(new URL("https://api.rawg.io/api/games/" + enriched[k].rawgId + "?key=" + KEY));
      if (d) {
        enriched[k].developers = (d.developers || []).map(x => x.name);
        enriched[k].publishers = (d.publishers || []).map(x => x.name);
        if (!(enriched[k].platforms || []).length) enriched[k].platforms = (d.platforms || []).map(p => (p.platform ? p.platform.name : p.name)).filter(Boolean);
        if (!(enriched[k].stores || []).length) enriched[k].stores = (d.stores || []).map(s => (s.store ? s.store.id : s.id)).filter(Boolean);
      }
      n++;
      if (n % 10 === 0) save(enriched);
      console.log(`[${n}/${keys.length}] ${k} → ${(enriched[k].developers || []).join(", ") || "no developers"}`);
    } catch (e) {
      console.error(`${k}: ${e.message} — will retry next run`);
    }
    await new Promise(r => setTimeout(r, DELAY));
  }
  save(enriched);
  console.log(`backfill done · updated ${n} entries`);
}

async function run() {
  while (i < pending.length && !stopped) {
    if (LIMIT && added >= LIMIT) break;
    const t = pending[i];
    try {
      const v = await bestMatch(t.title);
      enriched[t.title] = v; // null = no confident match, still counts as done
      added++;
      if (++since >= 10) { save(enriched); since = 0; }
      console.log(`[${done0 + added}/${total}] ${t.title} → ${v ? v.rawgId + " " + (v.genres[0] || "") : "no match"}`);
    } catch (e) {
      if (/^AUTH/.test(e.message)) { console.error(`stopping: RAWG rejected the key (${e.message}). Fix RAWG_KEY or quota, then re-run to resume.`); stopped = true; break; }
      console.error(`[${t.title}] failed: ${e.message} — will retry next run`);
    }
    i++;
    await new Promise(r => setTimeout(r, DELAY));
  }
  save(enriched);
  console.log(`saved ${OUT} · enriched ${Object.keys(enriched).length}/${total}${stopped ? " (interrupted, resumable)" : ""}`);
}
(MODE === "details" ? backfillDetails() : run()).catch(e => { console.error(e); save(enriched); process.exit(1); });
