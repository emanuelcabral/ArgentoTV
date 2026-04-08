// Obtener los elementos del DOM
const list = document.getElementById('channel-list');
const search = document.getElementById('search');
const player = document.getElementById('player-container');

let channels = [];
let hls;

// Cargar los canales desde el archivo JSON
fetch('channels.json')
  .then(res => res.json())
  .then(data => {
    channels = data;
    renderChannels(channels);
  })
  .catch(err => {
    console.error('Error al cargar el archivo channels.json:', err);
  });

// Renderizar la lista de canales
function renderChannels(data) {
  list.innerHTML = ''; // Limpiar lista antes de renderizar

  // Verificar si el arreglo tiene elementos
  if (data.length === 0) {
    list.innerHTML = '<p>No hay canales disponibles.</p>';
    return;
  }

  data.forEach(channel => {
    const div = document.createElement('div');
    div.className = 'channel';
    div.textContent = channel.name;

    // Cuando se hace clic en un canal, se llama a playChannel
    div.onclick = () => playChannel(channel);

    list.appendChild(div);
  });
}

// Reproducir el canal seleccionado
function playChannel(channel) {
  // Limpiar reproductor anterior
  if (hls) {
    hls.destroy();
    hls = null;
  }

  // 🟥 Si el canal es de YouTube
  if (channel.type === "youtube" || channel.url.includes("youtube")) {
    const videoId = getYouTubeID(channel.url);
    if (!videoId) {
      alert("No se pudo obtener el ID de YouTube");
      return;
    }

    // Insertar iframe de YouTube
    player.innerHTML = `
      <iframe width="100%" height="100%"
      src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>
      </iframe>
    `;
    return;
  }

  // 🟩 Si es un canal HLS (m3u8)
  player.innerHTML = '<video id="video" controls autoplay></video>';
  const video = document.getElementById('video');

  // Verificar si Hls.js está soportado
  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(channel.url);  // Cargar la URL m3u8
    hls.attachMedia(video); // Adjuntar al reproductor de video

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      console.log('Manifest loaded, starting playback...');
    });

    hls.on(Hls.Events.ERROR, function(event, data) {
      if (data.fatal) {
        console.error("Error en HLS.js:", data);
      }
    });

  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Si el navegador soporta HLS nativamente (Safari)
    video.src = channel.url;
  } else {
    alert("Este navegador no soporta el streaming HLS.");
  }
}

// Obtener el ID de YouTube desde la URL
function getYouTubeID(url) {
  const regExp = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Filtro de búsqueda
search.addEventListener('input', () => {
  const value = search.value.toLowerCase();
  const filtered = channels.filter(c =>
    c.name.toLowerCase().includes(value)
  );
  renderChannels(filtered);
});