// server.js
import express from "express";
import fetch from "node-fetch";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

const app = express();

const parser = new XMLParser();
const builder = new XMLBuilder();

app.get("/epg", async (req, res) => {
  try {
    // 🔥 descargamos todas las fuentes EPG
    const [rAr, rBo, rCl, rMx, rAr2] = await Promise.all([
      fetch("https://iptv-epg.org/files/epg-ar.xml"),
      fetch("https://iptv-epg.org/files/epg-bo.xml"),
      fetch("https://iptv-epg.org/files/epg-cl.xml"),
      fetch("https://iptv-epg.org/files/epg-mx.xml"),
      fetch("https://iptv-epg.org/files/epg-ar2.xml") // otro feed argentino
    ]);

    const [xmlAr, xmlBo, xmlCl, xmlMx, xmlAr2] = await Promise.all([
      rAr.text(), rBo.text(), rCl.text(), rMx.text(), rAr2.text()
    ]);

    const epgAr  = parser.parse(xmlAr);
    const epgBo  = parser.parse(xmlBo);
    const epgCl  = parser.parse(xmlCl);
    const epgMx  = parser.parse(xmlMx);
    const epgAr2 = parser.parse(xmlAr2);

    const channelsMap = new Map();
    const programmes = [];

    // 🔥 función robusta para procesar cualquier feed
    const processEPG = (epg, tag) => {
      if (!epg?.tv) {
        console.warn(`Feed ${tag} sin nodo <tv>`);
        return;
      }

      const chs = epg.tv.channel || [];
      const progs = epg.tv.programme || [];

      for (const ch of chs) {
        channelsMap.set(ch.id, ch);
      }
      for (const prog of progs) {
        programmes.push(prog);
      }

      console.log(`Feed ${tag}: ${chs.length} canales, ${progs.length} programas`);
    };

    // Procesamos cada fuente
    processEPG(epgAr, "AR");
    processEPG(epgBo, "BO");
    processEPG(epgCl, "CL");
    processEPG(epgMx, "MX");
    processEPG(epgAr2, "AR2");

    const finalEPG = {
      tv: {
        channel: [...channelsMap.values()],
        programme: programmes
      }
    };

    const xmlFinal = builder.build(finalEPG);

    res.set("Content-Type", "application/xml");
    res.set("Access-Control-Allow-Origin", "*");
    res.send(xmlFinal);

  } catch (err) {
    console.error("Error cargando EPG:", err);
    res.status(500).send("Error cargando EPG");
  }
});

app.listen(3000, () =>
  console.log("Proxy EPG en http://localhost:3000/epg")
);
