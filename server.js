import express from "express";
import fetch from "node-fetch";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import cors from "cors";

const app = express();
app.use(cors()); // habilita CORS

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
const builder = new XMLBuilder({ ignoreAttributes: false });

app.get("/epg", async (req, res) => {
  try {
    const feeds = [
      { url: "https://www.open-epg.com/files/argentina.xml", tag: "AR2" },
      { url: "https://iptv-epg.org/files/epg-ar.xml", tag: "AR" },
      { url: "https://iptv-epg.org/files/epg-cl.xml", tag: "CL" },
      { url: "https://iptv-epg.org/files/epg-mx.xml", tag: "MX" },
      { url: "https://iptv-epg.org/files/epg-pe.xml", tag: "PE" },
      { url: "https://iptv-epg.org/files/epg-es.xml", tag: "ES" },
      { url: "https://iptv-epg.org/files/epg-eu.xml", tag: "Eu" },
      { url: "https://iptv-epg.org/files/epg-bo.xml", tag: "BO" }
    ];

    const responses = await Promise.all(feeds.map(f => fetch(f.url)));
    const xmls = await Promise.all(responses.map(r => r.text()));
    const epgs = xmls.map(x => parser.parse(x));

    const channelsMap = new Map();
    const programmes = [];

    epgs.forEach((epg, i) => {
      if (!epg.tv) return;
      const chs = [].concat(epg.tv.channel || []);
      const progs = [].concat(epg.tv.programme || []);

      chs.forEach(ch => ch?.id && channelsMap.set(ch.id, ch));
      progs.forEach(p => p?.channel && programmes.push(p));

      console.log(`Feed ${feeds[i].tag}: ${chs.length} canales, ${progs.length} programas`);
    });

    // 🔥 reconstruimos XML con atributos
    const finalEPG = {
      tv: {
        "@_source-info-name": "IPTV-EPG.org",
        "@_source-info-url": "https://iptv-epg.org",
        channel: [...channelsMap.values()].map(ch => ({
          "@_id": ch.id,
          "display-name": ch["display-name"],
          icon: { "@_src": ch.icon?.src || "" }
        })),
        programme: programmes.map(p => ({
          "@_start": p.start,
          "@_stop": p.stop,
          "@_channel": p.channel,
          title: p.title,
          desc: p.desc
        }))
      }
    };

    const xmlFinal = builder.build(finalEPG);

    res.set("Content-Type", "application/xml");
    res.send(xmlFinal);

  } catch (err) {
    console.error("Error cargando EPG:", err);
    res.status(500).send("Error cargando EPG");
  }
});

app.listen(3000, () => console.log("EPG XML en http://localhost:3000/epg"));
