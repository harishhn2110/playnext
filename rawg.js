// server.js  (npm i express node-fetch dotenv)
import express from "express";
import "dotenv/config";

const app = express();

app.get("/api/games", async (req, res) => {
  const url = new URL("https://api.rawg.io/api/games");
  url.search = new URLSearchParams({ ...req.query, key: process.env.RAWG_KEY });
  const r = await fetch(url);
  res.json(await r.json());
});

app.get("/api/games/:id", async (req, res) => {
  const r = await fetch(`https://api.rawg.io/api/games/${req.params.id}?key=${process.env.RAWG_KEY}`);
  res.json(await r.json());
});

app.use(express.static(".")); // serves playnext.html
app.listen(3000, () => console.log("http://localhost:3000"));