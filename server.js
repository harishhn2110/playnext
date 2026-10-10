import express from "express";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const KEY = process.env.RAWG_KEY || "";
const TTL = 15 * 60 * 1000;
const cache = new Map();

async function cached(url) {
  const now = Date.now(), hit = cache.get(url);
  if (hit && now - hit.t < TTL) return hit.d;
  const r = await fetch(url, { headers: { "User-Agent": "playnext/1.0" } });
  if (!r.ok) throw new Error("upstream " + r.status);
  const d = await r.json();
  cache.set(url, { t: now, d });
  if (cache.size > 400) {
    for (const k of cache.keys()) { cache.delete(k); if (cache.size <= 300) break; }
  }
  return d;
}

const app = express();

app.get("/api/rawg/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [] });
  try {
    const url = new URL("https://api.rawg.io/api/games");
    url.search = new URLSearchParams({ key: KEY, search: q, page_size: "10" });
    res.json(await cached(url));
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/rawg/game/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "bad id" });
  try {
    const url = new URL("https://api.rawg.io/api/games/" + req.params.id);
    url.search = new URLSearchParams({ key: KEY });
    res.json(await cached(url));
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.use(express.static(__dirname, { extensions: ["html"], index: "playnext.html" }));
const server = app.listen(PORT, () => console.log("playnext → http://localhost:" + PORT));
server.on("error", e => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use — a Playnext server may already be running.`);
    console.error(`Open http://localhost:${PORT} or start on another port:  set PORT=3001 && npm start`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
