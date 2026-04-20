// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();

app.get("/epg", async (req, res) => {
  try {
    const r = await fetch("https://iptv-epg.org/files/epg-ar.xml");
    const text = await r.text();
    res.set("Content-Type", "application/xml");
    res.set("Access-Control-Allow-Origin", "*"); // 🔥 habilita CORS
    res.send(text);
  } catch (err) {
    res.status(500).send("Error cargando EPG");
  }
});

app.listen(3000, () => console.log("Proxy EPG en http://localhost:3000/epg"));
