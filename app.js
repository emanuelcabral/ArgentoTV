// Obtener los elementos del DOM
const list = document.getElementById('channel-list');
const search = document.getElementById('search');
const player = document.getElementById('player-container');

let channels = [];
let hls;
let epgData = {}; // 🔥 EPG

// 🔥 URL DEL EPG (IMPORTANTE: sin .gz)
const EPG_URL = "https://iptv-epg.org/files/epg-ar.xml";

// 🔥 Cargar EPG primero
fetch(EPG_URL)
  .then(res => res.text())
  .then(xmlText => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");

    const programmes = xml.getElementsByTagName("programme");

    for (let p of programmes) {
      const channel = p.getAttribute("channel");
      const title = p.getElementsByTagName("title")[0]?.textContent;

      if (!epgData[channel]) epgData[channel] = [];
      epgData[channel].push({
        title: title
      });
    }

    console.log("EPG cargado:", epgData);
  });

// Cargar los canales
fetch('./channels.json')
  .then(res => res.json())
  .then(data => {
    channels = data;
    renderChannels(channels);
  })
  .catch(err => {
    console.error('Error al cargar channels.json:', err);
  });

// Renderizar la lista de canales
function renderChannels(data) {
  list.innerHTML = '';

  if (data.length === 0) {
    list.innerHTML = '<p>No hay canales disponibles.</p>';
    return;
  }

  data.forEach(channel => {
    const div = document.createElement('div');
    div.className = 'channel';

    // 🔥 EPG: obtener programa actual
    let epgText = "Sin programación";

    if (channel.epg_id && epgData[channel.epg_id]) {
      epgText = epgData[channel.epg_id][0]?.title || "Sin datos";
    }

    div.innerHTML = `
      <img src="${channel.logo || 'https://via.placeholder.com/40?text=TV'}">
      <div>
        <span>${channel.name}</span>
        <small style="display:block; color:gray;">${epgText}</small>
      </div>
    `;

    div.onclick = () => playChannel(channel);

    list.appendChild(div);
  });
}

// Reproducir canal
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
      frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>
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

// YouTube ID
function getYouTubeID(url) {
  const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Buscador
search.addEventListener('input', () => {
  const value = search.value.toLowerCase();
  const filtered = channels.filter(c =>
    c.name.toLowerCase().includes(value)
  );
  renderChannels(filtered);
});