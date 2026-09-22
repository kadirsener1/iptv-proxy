import express from "express";
import fetch from "node-fetch";
import cloudscraper from "cloudscraper";

const app = express();

// ============================================================
// KANAL LİSTESİ
// Buraya istediğin kadar kanal ekleyebilirsin.
// "id"      → matchora URL'sindeki sayı
// "name"    → TiviMate'de görünecek isim
// "group"   → TiviMate'de kategori
// ============================================================
const KANALLAR = [
  { id: "913460", name: "beIN Sports 1", group: "beIN" },
  { id: "913455", name: "beIN Sports 1 TR", group: "beIN" },
  { id: "913454", name: "beIN Sports 2 TR", group: "beIN" },
  { id: "1547292", name: "#Vamos", group: "İspanya" },
  { id: "1936134", name: "1° Federacion", group: "İspanya" },
  { id: "2112609", name: "24 Sport", group: "Arjantin" },
  // ... buraya eklemeye devam et
];

// ============================================================

const BASE_EMBED = "https://matchora.to/embed/channel/";

// Kanal ID'sinden embed URL üret
function embedUrl(id) {
  return BASE_EMBED + id;
}

// Embed sayfayı cloudscraper ile çek, m3u8 linkini bul
async function m3u8Al(kanalId) {
  const html = await cloudscraper.get({
    uri: embedUrl(kanalId),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    timeout: 30000,
  });

  const m = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
  if (!m) throw new Error("Kanal " + kanalId + ": m3u8 bulunamadı");
  return m[0];
}

// ---- Tüm kanalların listesi (TiviMate açılışta bunu çeker) ----
app.get("/playlist.m3u8", (req, res) => {
  const base = req.protocol + "://" + req.get("host");

  let cikti = "#EXTM3U\n";
  for (const k of KANALLAR) {
    cikti += `#EXTINF:-1 tvg-id="${k.id}" tvg-name="${k.name}" `;
    cikti += `group-title="${k.group}",${k.name}\n`;
    cikti += `${base}/live/${k.id}.m3u8\n`;
  }

  res.set("Content-Type", "audio/x-mpegurl");
  res.send(cikti);
});

// ---- Tek kanal akışı ----
app.get("/live/:id.m3u8", async (req, res) => {
  const kanalId = req.params.id;

  try {
    const hedef = await m3u8Al(kanalId);
    const r = await fetch(hedef);
    let icerik = await r.text();
    const baseUrl = new URL(hedef);

    // Segment ve alt playlist linklerini proxy'ye çevir
    icerik = icerik.replace(/^(?!#)(.+)$/gm, (line) => {
      const t = line.trim();
      if (!t) return line;
      const abs = new URL(t, baseUrl).href;
      return `/seg?u=${encodeURIComponent(abs)}`;
    });

    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.send(icerik);
  } catch (e) {
    console.error("live/" + kanalId + " hata:", e.message);
    res.status(502).send("# hata: " + e.message);
  }
});

// ---- Segment proxy ----
app.get("/seg", async (req, res) => {
  if (!req.query.u) return res.status(400).end();

  try {
    const r = await fetch(req.query.u, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    res.set("Content-Type", r.headers.get("content-type") || "video/mp2t");
    r.body.pipe(res);
  } catch (e) {
    res.status(502).end();
  }
});

// ---- Sağlık kontrolü ----
app.get("/", (req, res) => {
  res.send(
    "IPTV Proxy çalışıyor. " +
      KANALLAR.length +
      " kanal yüklü. Playlist: /playlist.m3u8"
  );
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Proxy: " + PORT + " | " + KANALLAR.length + " kanal"));
