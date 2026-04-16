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
const EPG_URL = "https://iptv-epg.org/files/epg-ar.xml";

// -----------------------------
// 🔥 PARSE TIME
// -----------------------------
function parseTime(str) {
  if (!str) return null;

  const clean = str.split(" ")[0];

  return new Date(
    clean.slice(0, 4) + "-" +
    clean.slice(4, 6) + "-" +
    clean.slice(6, 8) + "T" +
    clean.slice(8, 10) + ":" +
    clean.slice(10, 12) + ":" +
    clean.slice(12, 14) + "Z"
  );
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
      const title = p.getElementsByTagName("title")[0]?.textContent;

      const start = parseTime(p.getAttribute("start"));
      const stop = parseTime(p.getAttribute("stop"));

      if (!channel) continue;

      if (!epgData[channel]) epgData[channel] = [];

      epgData[channel].push({ title, start, stop });
    }

  } catch (e) {
    console.warn("EPG error:", e);
  }
}

// -----------------------------
// 🔥 PROGRAMA ACTUAL
// -----------------------------
function getCurrentProgram(list) {
  if (!list) return null;

  const now = new Date();

  return list.find(p =>
    p.start && p.stop && now >= p.start && now <= p.stop
  );
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
// 🔥 OBTENER EPG
// -----------------------------
function getEPG(channel) {

  if (channel.epg_id && epgData[channel.epg_id]) {
    return epgData[channel.epg_id];
  }

  const keys = Object.keys(epgData);

  const foundKey = keys.find(k =>
    channel.name?.toLowerCase().includes(k.toLowerCase())
  );

  if (foundKey) {
    return epgData[foundKey];
  }

  return null;
}

// -----------------------------
// 🔥 OVERLAY
// -----------------------------
function showOverlay(channel) {

  if (!overlay) return;

  const epgList = getEPG(channel);
  const current = getCurrentProgram(epgList);

  overlayName.textContent = channel.name;
  overlayLogo.src = channel.logo || '';
  overlayEpg.textContent = current?.title || "Sin programación";

  overlay.classList.add("show");

  clearTimeout(overlayTimeout);
  overlayTimeout = setTimeout(() => {
    overlay.classList.remove("show");
  }, 3000);
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

    const epgText =
      current?.title ||
      epgList?.[0]?.title ||
      "Sin programación";

    div.innerHTML = `
      <img src="${channel.logo || 'https://via.placeholder.com/40'}">
      <div>
        <span>${channel.name}</span>
        <small style="display:block;color:gray;">${epgText}</small>
      </div>
    `;

    div.onclick = () => playChannel(channel);

    list.appendChild(div);
  });
}

// -----------------------------
// 🔥 PLAYER (FIX REAL)
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

  // YouTube
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
    currentChannelIndex--;
    if (currentChannelIndex < 0) {
      currentChannelIndex = channels.length - 1;
    }
    showOverlay(channels[currentChannelIndex]);
  }

  if (e.key === "ArrowDown") {
    currentChannelIndex++;
    if (currentChannelIndex >= channels.length) {
      currentChannelIndex = 0;
    }
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