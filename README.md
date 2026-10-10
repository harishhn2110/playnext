# Playnext

A dark, animated game-recommendation site built on `Games.csv` (14,801 IGN review rows → 11,234 unique titles), enriched with RAWG metadata and CheapShark deals. Plain HTML/CSS/JS frontend + a small Node/Express server.

## Setup

```bash
npm i                       # install express + dotenv
# create .env with your RAWG key:
#   RAWG_KEY=your_rawg_api_key
node enrich.js              # build enriched.json (resumable, see below)
npm start                   # http://localhost:3000
```

`.env`:

```
RAWG_KEY=<your key from https://rawg.io/apidocs>
```

### Enriching data

`enrich.js` matches every CSV title to its best RAWG result and writes `enriched.json`
(`title → { rawgId, genres, tags, image, rating, metacritic, released, platforms, stores,
developers, publishers }`). `developers` and `publishers` come from RAWG's detail endpoint,
so run the detail backfill once to fill them in.

- **Resumable** — already-written titles are skipped, so re-run it any time.
- **Prioritized by Score** — highest-rated games are matched first.
- **Throttled** — `--delay 250` ms between requests by default.
- `node enrich.js --limit 200` matches only the next 200 titles (handy for testing).
- `node enrich.js --details` backfills missing developers/publishers for already-enriched
  titles (one extra RAWG call each) — powers the Developer filter and developer search.
- Interrupt with `Ctrl+C`; progress is saved and resumed on the next run.

Until `enriched.json` exists the site still works: it shows every game using CSV data only
(no posters/genres). A small subset ships enriched so you can try it immediately.

## Files

```
playnext.html      main page (markup + boot)
style.css          dark responsive UI, animations, skeletons
js/data.js         parses Games.csv, dedupes titles, merges consoles, loads enriched.json
js/recommender.js  six mood axes → per-game axis positions + live fit score
js/assistant.js    rule-based prompt parser (synonym map), no LLM
js/lists.js        Want / Completed / Cart in localStorage
js/offers.js       CheapShark deals for Cart + Want, 30-min cache
js/ui.js           grid, filters, pagination, modal, drawers, toasts
server.js          static hosting + RAWG proxy (key stays server-side)
enrich.js          background enrichment job
Games.csv          source data
```

## Features

- **Browse** — lazy-loaded poster grid over all titles, live search (title, developer,
  platform, genre, tags), filters (platform, developer, genre, min IGN), sorting, and
  pagination (~14k rows).
- **Mood sliders** — Relaxed↔Intense, Cozy↔Dark, Grounded↔Dreamy, Casual↔Competitive,
  Story↔Gameplay, Solo↔Multiplayer. Each end maps to RAWG genres/tags; games are scored by
  distance from the slider positions plus a small IGN boost. "Beginner friendly" toggle too.
- **Assistant** — type a mood ("scary game for two hours"); a synonym map sets the sliders and
  returns 5–8 clickable cards, each with a one-line reason.
- **Game modal** — RAWG description, developer, publisher, release, genres; IGN (CSV) and
  Metacritic (RAWG) as colored badges; "Available on" row shows only the storefronts RAWG
  lists for that game (Steam/Epic/GOG/Xbox/PlayStation/Nintendo) with a search-URL fallback;
  Want to Play / Completed / Cart.
- **Lists** — Want to Play, Completed and Cart with count badges, per-list move buttons and a
  ✕ that removes a game from all three. Adding to Want to Play triggers a floating heart burst;
  completing a game fires confetti and a "Congratulations!" overlay (both auto-dismiss).
- **Offers** — CheapShark scan of Cart + Want on load and on every list change, with a bell
  badge, toast and panel ("Offer on … on …: -X% ($price)"), cached for 30 minutes.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/rawg/search?q=` | proxy to RAWG game search (key injected server-side) |
| `GET /api/rawg/game/:id` | proxy to RAWG game details |

Responses are cached in memory (10 min) and upstream failures return `502` instead of crashing.
