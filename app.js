// =======================
// DOM
// =======================
const list = document.getElementById('channel-list');
const search = document.getElementById('search');
const player = document.getElementById('player-container');

let channels = [];
let hls;
let epgData = {};

// =======================
// EPG URL
// =======================
const EPG_URL = "https://iptv-epg.org/files/epg-ar.xml";

// =======================
// HELPERS EPG TIME
// =======================
function parseEPGTime(str) {
  if (!str) return null;

  const clean = str.split(" ")[0]; // quita +0000
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(8, 10);
  const min = clean.slice(10, 12);

  return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`);
}

function getCurrentProgram(list) {
  const now = new Date();

  return list.find(p => {
    const start = parseEPGTime(p.start);
    const stop = parseEPGTime(p.stop);

    if (!start || !stop) return false;

    return now >= start && now <= stop;
  });
}

// =======================
// CARGAR EPG
// =======================
fetch(EPG_URL)
  .then(res => res.text())
  .then(xmlText => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");

    const programmes = xml.getElementsByTagName("programme");

    for (let p of programmes) {
      const channel = p.getAttribute("channel");
      const title = p.getElementsByTagName("title")[0]?.textContent;
      const start = p.getAttribute("start");
      const stop = p.getAttribute("stop");

      if (!channel) continue;

      if (!epgData[channel]) epgData[channel] = [];

      epgData[channel].push({
        title,
        start,
        stop
      });
    }

    // ordenar por tiempo
    for (let key in epgData) {
      epgData[key].sort((a, b) =>
        (a.start || "").localeCompare(b.start || "")
      );
    }

    console.log("EPG cargado OK:", epgData);

    // 🔥 re-render si ya hay canales
    if (channels.length) renderChannels(channels);
  })
  .catch(err => {
    console.error("Error cargando EPG:", err);
  });

// =======================
// CARGAR CANALES
// =======================
fetch('./channels.json')
  .then(res => res.json())
  .then(data => {
    channels = data;
    renderChannels(channels);
  })
  .catch(err => {
    console.error('Error al cargar channels.json:', err);
  });

// =======================
// RENDER
// =======================
function renderChannels(data) {
  list.innerHTML = '';

  if (!data.length) {
    list.innerHTML = '<p>No hay canales disponibles.</p>';
    return;
  }

  data.forEach(channel => {
    const div = document.createElement('div');
    div.className = 'channel';

    let epgText = "Sin programación";

    const epgId = (channel.epg_id || "").trim();

    if (epgId && epgData[epgId]) {
      const current = getCurrentProgram(epgData[epgId]);

      epgText = current?.title || "Sin datos";
    }

    div.innerHTML = `
      <img src="${channel.logo || 'https://via.placeholder.com/40?text=TV'}">
      <div>
        <span>${channel.name}</span>
        <small style="display:block; color:gray;">
          ${epgText}
        </small>
      </div>
    `;

    div.onclick = () => playChannel(channel);

    list.appendChild(div);
  });
}

// =======================
// PLAYER
// =======================
function playChannel(channel) {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  // YouTube
  if (channel.type === "youtube" || channel.url.includes("youtube")) {
    const videoId = getYouTubeID(channel.url);
    if (!videoId) return;

    player.innerHTML = `
      <iframe width="100%" height="100%"
      src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      frameborder="0"
      allow="autoplay; encrypted-media"
      allowfullscreen>
      </iframe>
    `;
    return;
  }

  // HLS
  player.innerHTML = '<video id="video" controls autoplay></video>';
  const video = document.getElementById('video');

  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(channel.url);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = channel.url;
  } else {
    alert("No soporta HLS");
  }
}

// =======================
// YOUTUBE ID
// =======================
function getYouTubeID(url) {
  const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// =======================
// BUSCADOR
// =======================
search.addEventListener('input', () => {
  const value = search.value.toLowerCase();

  const filtered = channels.filter(c =>
    c.name.toLowerCase().includes(value)
  );

  renderChannels(filtered);
});