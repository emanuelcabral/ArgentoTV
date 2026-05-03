const list = document.getElementById('channel-list');
const search = document.getElementById('search');
const player = document.getElementById('player-container');

const overlay = document.getElementById("overlay");
const overlayName = document.getElementById("overlay-name");
const overlayLogo = document.getElementById("overlay-logo");
const overlayEpg = document.getElementById("overlay-epg");

let channels = [];
let hls;
let epgData = {};
let overlayTimeout;
let currentChannelIndex = 0;

// 🔥 EPG URL
// const EPG_URL = "https://iptv-epg.org/files/epg-ar.xml";
const EPG_URL = "http://localhost:3000/epg";



// -----------------------------
// 🔥 NORMALIZAR TEXTO (CLAVE)
// -----------------------------
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}


// -----------------------------
// 🔥 PARSE TIME (ADAPTADO)
// -----------------------------
function parseTime(str) {
  if (!str) return null;

  // Ejemplo: "20260417010000 +0000"
  const match = str.match(
    /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s?([+-]\d{4})?/
  );

  if (!match) return null;

  const [, y, m, d, h, min, s, tz] = match;

  let date = new Date(Date.UTC(y, m - 1, d, h, min, s));

  if (tz) {
    const sign = tz[0] === "-" ? -1 : 1;
    const hh = parseInt(tz.slice(1, 3));
    const mm = parseInt(tz.slice(3, 5));
    const offset = sign * (hh * 60 + mm);
    date.setUTCMinutes(date.getUTCMinutes() - offset);
  }

  return date.getTime(); // timestamp en ms
}


// -----------------------------
// 🔥 CARGAR EPG
// -----------------------------
async function loadEPG() {
  try {
    const res = await fetch(EPG_URL);
    const xmlText = await res.text();

    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const programmes = xml.getElementsByTagName("programme");

    for (let p of programmes) {
      const channel = p.getAttribute("channel");
      const title = p.getElementsByTagName("title")[0]?.textContent || "";
      const desc = p.getElementsByTagName("desc")[0]?.textContent || "";

      const start = parseTime(p.getAttribute("start"));
      const stop = parseTime(p.getAttribute("stop"));

      if (!channel) continue;

      if (!epgData[channel]) epgData[channel] = [];

      epgData[channel].push({ title, desc, start, stop });
    }

    // 🔥 ordenar EPG
    for (let k in epgData) {
      epgData[k].sort((a, b) => a.start - b.start);
    }

    console.log("EPG cargado:", Object.keys(epgData));

  } catch (e) {
    console.warn("EPG error:", e);
  }
}


// -----------------------------
// 🔥 PROGRAMA ACTUAL
// -----------------------------
function getCurrentProgram(list) {
  if (!list) return null;

  const now = Date.now();

  for (let p of list) {
    if (!p.start || !p.stop) continue;

    if (now >= p.start && now <= p.stop) {
      return p;
    }
  }

  return null;
}


// -----------------------------
// 🔥 CARGAR CANALES
// -----------------------------
async function loadChannels() {
  try {
    const res = await fetch('./channels.json');
    channels = await res.json();

    renderChannels(channels);

  } catch (err) {
    console.error("Error channels:", err);
    list.innerHTML = "<p>Error cargando canales</p>";
  }
}


// -----------------------------
// 🔥 OBTENER EPG (ROBUSTO)
// -----------------------------
function getEPG(channel) {
  if (channel.epg_id && epgData[channel.epg_id]) {
    return epgData[channel.epg_id];
  }

  const keys = Object.keys(epgData);
  const foundKey = keys.find(k =>
    normalize(k) === normalize(channel.name)
  );

  if (foundKey) {
    return epgData[foundKey];
  }

  return null;
}


// -----------------------------
// 🔥 OVERLAY
// -----------------------------
// 🔥 PROGRESO
function getProgress(p) {
  if (!p?.start || !p?.stop) return 0;
  const now = Date.now();
  return Math.min(100, Math.max(0, ((now - p.start) / (p.stop - p.start)) * 100));
}

// 🔥 OVERLAY
function showOverlay(channel) {
  if (!overlay) return;

  const epgList = getEPG(channel);
  const current = getCurrentProgram(epgList);

  overlayName.textContent = channel.name;
  overlayLogo.src = channel.logo || '';

  if (!epgList || !current) {
    document.getElementById("overlay-title").textContent = "Sin programa actual";
    document.getElementById("overlay-start").textContent = "";
    document.getElementById("overlay-stop").textContent = "";
    document.getElementById("overlay-progress-bar").style.width = "0%";
    document.getElementById("overlay-category").textContent = "";
    document.getElementById("overlay-desc").textContent = "";
  } else {
    document.getElementById("overlay-title").textContent = current.title;
    document.getElementById("overlay-start").textContent =
      new Date(current.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    document.getElementById("overlay-stop").textContent =
      new Date(current.stop).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    document.getElementById("overlay-progress-bar").style.width = getProgress(current) + "%";
    document.getElementById("overlay-category").textContent = current.category || "";
    document.getElementById("overlay-desc").textContent = current.desc || "";
  }

  // Datos técnicos desde channels.json
  document.getElementById("overlay-resolution").textContent = channel.resolution || "HD";
  document.getElementById("overlay-bitrate").textContent = channel.bitrate || "3.00 Mbps";
  document.getElementById("overlay-audio").textContent = channel.audio || "Stereo";

  overlay.classList.add("show");

  clearTimeout(overlayTimeout);
  overlayTimeout = setTimeout(() => {
    overlay.classList.remove("show");
  }, 5000);
}


// -----------------------------
// 🔥 RENDER
// -----------------------------
function renderChannels(data) {
  list.innerHTML = '';

  if (!data || data.length === 0) {
    list.innerHTML = "<p>No hay canales</p>";
    return;
  }

  data.forEach(channel => {
    const div = document.createElement('div');
    div.className = 'channel';

    const epgList = getEPG(channel);
    const current = getCurrentProgram(epgList);

    console.log(
      "CANAL:", channel.name,
      "| epg_id:", channel.epg_id,
      "| EPG:", epgList?.length,
      "| CURRENT:", current
    );

    let epgText = "Sin informacion";

    if (epgList && current?.title) {
      epgText = current.title;
    } else if (epgList) {
      epgText = "Sin programa actual";
    }

    // 🔥 IMG FIX
    const img = document.createElement("img");
    img.src = channel.logo || "https://via.placeholder.com/40";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      img.src = "https://via.placeholder.com/40";
    };

    // 🔥 TEXTO
    const info = document.createElement("div");
    info.innerHTML = `
      <span>${channel.name}</span>
      <small style="display:block;color:${epgList ? '#00ef03' : ''};">
        ${epgText}
      </small>
    `;

    div.appendChild(img);
    div.appendChild(info);

    div.onclick = () => playChannel(channel);

    list.appendChild(div);
  });
}

// -----------------------------
// 🔥 PLAYER
// -----------------------------
function playChannel(channel) {
  currentChannelIndex = channels.indexOf(channel);

  if (hls) {
    hls.destroy();
    hls = null;
  }

  let video = document.getElementById('video');

  if (!video) {
    video = document.createElement("video");
    video.id = "video";
    video.controls = true;
    video.autoplay = true;
    player.prepend(video);
  }

if (channel.type === "youtube" || channel.url.includes("youtube")) {
  const id = channel.url.match(/(?:youtu\.be\/|v=)([^&]+)/)?.[1];
  if (!id) return;

  player.innerHTML = `
    <iframe width="100%" height="100%"
    src="https://www.youtube.com/embed/${id}?autoplay=1"
    allowfullscreen></iframe>
  `;
  return;
}

// 🔥 NUEVO: soporte iframe genérico
if (channel.type === "iframe") {
  player.innerHTML = `
    <iframe 
      width="100%" 
      height="100%" 
      src="${channel.url}"
      frameborder="0"
      allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen>
    </iframe>
  `;

  showOverlay(channel);
  return;
}

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(channel.url);
    hls.attachMedia(video);
  } else {
    video.src = channel.url;
  }

  showOverlay(channel);
}


// -----------------------------
// 🔥 TECLADO
// -----------------------------
document.addEventListener("keydown", (e) => {
  if (!channels.length) return;

  if (e.key === "ArrowUp") {
    currentChannelIndex =
      (currentChannelIndex - 1 + channels.length) % channels.length;
    showOverlay(channels[currentChannelIndex]);
  }

  if (e.key === "ArrowDown") {
    currentChannelIndex =
      (currentChannelIndex + 1) % channels.length;
    showOverlay(channels[currentChannelIndex]);
  }

  if (e.key === "Enter") {
    playChannel(channels[currentChannelIndex]);
  }
});


// -----------------------------
// 🔥 FULLSCREEN
// -----------------------------
player.addEventListener("dblclick", () => {
  if (!document.fullscreenElement) {
    player.requestFullscreen();
  }
});


// -----------------------------
// 🔥 SEARCH
// -----------------------------
search?.addEventListener('input', () => {
  const v = search.value.toLowerCase();

  renderChannels(
    channels.filter(c =>
      c.name?.toLowerCase().includes(v)
    )
  );
});

// -----------------------------
// 🔥 INIT
// -----------------------------
async function init() {
  await loadEPG();
  await loadChannels();
}

init();

// -----------------------------
// 🔥 Local Time
// -----------------------------
function actualizarHora() {
  const now = new Date();

  const horaLocal = now.toLocaleString("es-AR", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: "2-digit",
    minute: "2-digit"
  });

  document.getElementById("hora").textContent = horaLocal;
}

// Ejecutar una vez inmediatamente
actualizarHora();

// Actualizar cada segundo
setInterval(actualizarHora, 1000);