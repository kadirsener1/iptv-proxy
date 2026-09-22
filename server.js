import express from "express";
import fetch from "node-fetch";
import cloudscraper from "cloudscraper";

const app = express();
const EMBED_URL = "https://matchora.to/embed/channel/913455";

async function m3u8Al() {
  const html = await cloudscraper.get({
    uri: EMBED_URL,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    timeout: 30000,
  });
  const m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
  if (!m) throw new Error("m3u8 yok");
  return m[0];
}

app.get("/live.m3u8", async (req, res) => {
  try {
    const hedef = await m3u8Al();
    const r = await fetch(hedef);
    let icerik = await r.text();
    const base = new URL(hedef);
    icerik = icerik.replace(/^(?!#)(.+)$/gm, (l) => {
      const t = l.trim();
      return t ? "/seg?u=" + encodeURIComponent(new URL(t, base).href) : l;
    });
    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.send(icerik);
  } catch (e) {
    res.status(502).send("# hata: " + e.message);
  }
});

app.get("/seg", async (req, res) => {
  if (!req.query.u) return res.status(400).end();
  const r = await fetch(req.query.u);
  res.set("Content-Type", r.headers.get("content-type") || "video/mp2t");
  r.body.pipe(res);
});

app.get("/playlist.m3u8", (req, res) => {
  const base = req.protocol + "://" + req.get("host");
  res.set("Content-Type", "audio/x-mpegurl");
  res.send("#EXTM3U\n#EXTINF:-1,Kanal\n" + base + "/live.m3u8\n");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Proxy: " + PORT));
