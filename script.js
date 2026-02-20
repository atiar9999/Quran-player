// ==================== GLOBAL VARIABLES ====================
let audio = new Audio();
let tracks = [];
let currentTrackIndex = -1;
let playlistOrder = [];
let shuffle = false;
let repeatMode = "none";
let visualizerCtx = null;
let audioContext = null;   // will store the Web Audio context
let visualizerAnalyser = null;
let visualizerSource = null;
let animationFrame = null;

const themeToggle = document.getElementById("theme-toggle");
const trackListContainer = document.getElementById("track-list-container");
const searchInput = document.getElementById("search-input");
const currentTrackName = document.getElementById("current-track-name");
const currentTrackArtist = document.getElementById("current-track-artist");
const playPauseBtn = document.getElementById("play-pause-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const shuffleBtn = document.getElementById("shuffle-btn");
const repeatBtn = document.getElementById("repeat-btn");
const muteBtn = document.getElementById("mute-btn");
const volumeSlider = document.getElementById("volume-slider");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const currentTimeSpan = document.getElementById("current-time");
const durationSpan = document.getElementById("duration");
const thumbnailDiv = document.getElementById("album-thumbnail");
const visualizerCanvas = document.getElementById("visualizer");

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.innerHTML =
    savedTheme === "light"
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';

  themeToggle.addEventListener("click", toggleTheme);
  searchInput.addEventListener("input", filterTracks);
  playPauseBtn.addEventListener("click", togglePlayPause);
  prevBtn.addEventListener("click", playPrevious);
  nextBtn.addEventListener("click", playNext);
  shuffleBtn.addEventListener("click", toggleShuffle);
  repeatBtn.addEventListener("click", toggleRepeat);
  muteBtn.addEventListener("click", toggleMute);
  volumeSlider.addEventListener("input", (e) => {
    audio.volume = e.target.value;
    updateMuteIcon();
  });
  progressBar.addEventListener("click", seek);
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateDuration);
  audio.addEventListener("ended", handleTrackEnd);
  audio.addEventListener("play", () => updatePlayPauseIcon(true));
  audio.addEventListener("pause", () => updatePlayPauseIcon(false));
  document.addEventListener("keydown", handleKeyboard);

  audio.volume = volumeSlider.value;

  loadTracksFromJSON();
});

// ==================== LOAD TRACKS ====================
async function loadTracksFromJSON() {
  try {
    const response = await fetch("tracks.json");
    if (!response.ok) throw new Error("Failed to load tracks.json");
    const data = await response.json();
    tracks = data.map((item, index) => ({
      id: index,
      name: item.name,
      url: item.url,
      pictureUrl: null,
      artist: null,
      title: null,
    }));

    updatePlaylistOrder();
    renderTrackList();
    loadAllMetadata();

    if (tracks.length > 0) {
      currentTrackIndex = 0;
      loadTrack(0);
    } else {
      showPlaceholder("No tracks found in tracks.json");
    }
  } catch (err) {
    console.error("Error loading tracks:", err);
    trackListContainer.innerHTML = `<div class="placeholder-message"><i class="fas fa-exclamation-triangle"></i><p>Failed to load track list. Make sure tracks.json exists.</p></div>`;
  }
}

// ==================== METADATA ====================
async function loadAllMetadata() {
  const concurrency = 5;
  for (let i = 0; i < tracks.length; i += concurrency) {
    const batch = tracks.slice(i, i + concurrency);
    await Promise.all(batch.map((track) => readTrackMetadata(track)));
  }
}

async function readTrackMetadata(track) {
  try {
    const response = await fetch(track.url);
    const blob = await response.blob();

    const tags = await new Promise((resolve, reject) => {
      window.jsmediatags.read(blob, {
        onSuccess: resolve,
        onError: reject,
      });
    });

    const tag = tags.tags;
    if (tag.artist) track.artist = tag.artist;
    if (tag.title) track.title = tag.title;

    if (tag.picture) {
      const { data, format } = tag.picture;
      let base64String = "";
      for (let i = 0; i < data.length; i++) {
        base64String += String.fromCharCode(data[i]);
      }
      const base64 = btoa(base64String);
      track.pictureUrl = `data:${format};base64,${base64}`;
    }

    updateTrackThumbnailInList(track);
  } catch (err) {
    // No metadata – ignore
  }
}

function updateTrackThumbnailInList(track) {
  const trackItem = document.querySelector(
    `.track-item[data-track-id="${track.id}"]`,
  );
  if (!trackItem) return;

  const thumbDiv = trackItem.querySelector(".track-thumb");
  if (track.pictureUrl) {
    thumbDiv.innerHTML = `<img src="${track.pictureUrl}" alt="cover">`;
    thumbDiv.style.background = "none";
  } else {
    const firstLetter = track.name.charAt(0).toUpperCase();
    thumbDiv.innerHTML = firstLetter;
    const hue =
      track.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      360;
    thumbDiv.style.background = `hsl(${hue}, 70%, 55%)`;
  }
}

// ==================== RENDER TRACK LIST ====================
function renderTrackList() {
  const filter = searchInput.value.toLowerCase();
  const filtered = tracks.filter((t) => t.name.toLowerCase().includes(filter));
  if (filtered.length === 0) {
    trackListContainer.innerHTML = `<div class="placeholder-message"><i class="fas fa-search"></i><p>No matching tracks</p></div>`;
    return;
  }

  let html = "";
  filtered.forEach((track) => {
    const isActive =
      tracks[currentTrackIndex] &&
      tracks[currentTrackIndex].name === track.name;
    const hue =
      track.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      360;
    const bgColor = `hsl(${hue}, 70%, 55%)`;
    const firstLetter = track.name.charAt(0).toUpperCase();

    let thumbHtml = track.pictureUrl
      ? `<img src="${track.pictureUrl}" alt="cover">`
      : firstLetter;

    html += `
            <div class="track-item ${isActive ? "active" : ""}" data-track-id="${track.id}">
                <div class="track-thumb" style="background: ${bgColor};">${thumbHtml}</div>
                <div class="track-info">
                    <span class="track-name">${escapeHTML(track.name)}</span>
                </div>
            </div>
        `;
  });
  trackListContainer.innerHTML = html;

  document.querySelectorAll(".track-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = parseInt(item.dataset.trackId);
      const trackIndex = tracks.findIndex((t) => t.id === id);
      if (trackIndex !== -1) {
        currentTrackIndex = trackIndex;
        loadTrack(currentTrackIndex);
        audio.play();
      }
    });
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>"]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    if (m === '"') return "&quot;";
    return m;
  });
}

// ==================== LOAD TRACK ====================
function loadTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  const track = tracks[index];

  if (audio.src) {
    audio.pause();
    // Only revoke object URLs created via URL.createObjectURL
    try {
      if (typeof audio.src === "string" && audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
    } catch (e) {
      // ignore any revoke errors
    }
  }

  audio.src = track.url;

  currentTrackName.textContent = track.title || track.name;
  currentTrackArtist.textContent = track.artist || "Quran Recitation";

  if (track.pictureUrl) {
    let img = thumbnailDiv.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      thumbnailDiv.appendChild(img);
    }
    img.src = track.pictureUrl;
    thumbnailDiv.classList.add("has-image");
  } else {
    const img = thumbnailDiv.querySelector("img");
    if (img) img.remove();
    thumbnailDiv.classList.remove("has-image");
  }

  renderTrackList();

  if (!visualizerCtx) {
    setupVisualizer();
  }
}

// ==================== PLAYLIST ORDER ====================
function updatePlaylistOrder() {
  if (shuffle) {
    playlistOrder = Array.from({ length: tracks.length }, (_, i) => i);
    for (let i = playlistOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playlistOrder[i], playlistOrder[j]] = [
        playlistOrder[j],
        playlistOrder[i],
      ];
    }
    // keep the currently playing track first to avoid jumps when toggling shuffle
    if (currentTrackIndex !== -1) {
      const idx = playlistOrder.indexOf(currentTrackIndex);
      if (idx > 0) {
        playlistOrder.splice(idx, 1);
        playlistOrder.unshift(currentTrackIndex);
      }
    }
  } else {
    playlistOrder = Array.from({ length: tracks.length }, (_, i) => i);
  }
}

// ==================== PLAYBACK CONTROLS ====================
function togglePlayPause() {
    if (audio.paused) {
        // If AudioContext exists and is suspended, resume it
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        audio.play();
    } else {
        audio.pause();
    }
}

function playPrevious() {
  if (tracks.length === 0) return;
  if (shuffle && playlistOrder.length > 0) {
    const pos = playlistOrder.indexOf(currentTrackIndex);
    const newPos = pos <= 0 ? playlistOrder.length - 1 : pos - 1;
    currentTrackIndex = playlistOrder[newPos];
  } else {
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) newIndex = tracks.length - 1;
    currentTrackIndex = newIndex;
  }
  loadTrack(currentTrackIndex);
  audio.play();
}

function playNext() {
  if (tracks.length === 0) return;
  if (shuffle && playlistOrder.length > 0) {
    const pos = playlistOrder.indexOf(currentTrackIndex);
    const newPos = pos === -1 || pos + 1 >= playlistOrder.length ? 0 : pos + 1;
    currentTrackIndex = playlistOrder[newPos];
  } else {
    let newIndex = currentTrackIndex + 1;
    if (newIndex >= tracks.length) newIndex = 0;
    currentTrackIndex = newIndex;
  }
  loadTrack(currentTrackIndex);
  audio.play();
}

function toggleShuffle() {
  shuffle = !shuffle;
  shuffleBtn.style.color = shuffle ? "var(--accent)" : "";
  updatePlaylistOrder();
}

function toggleRepeat() {
  if (repeatMode === "none") repeatMode = "all";
  else if (repeatMode === "all") repeatMode = "one";
  else repeatMode = "none";

  let icon = "fa-repeat";
  if (repeatMode === "one") icon = "fa-repeat-1";
  repeatBtn.innerHTML = `<i class="fas ${icon}"></i>`;
  repeatBtn.style.color = repeatMode !== "none" ? "var(--accent)" : "";
}

function toggleMute() {
  audio.muted = !audio.muted;
  updateMuteIcon();
}

function updateMuteIcon() {
  if (audio.muted || audio.volume === 0) {
    muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
  } else if (audio.volume < 0.5) {
    muteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
  } else {
    muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
  }
}

function updatePlayPauseIcon(isPlaying) {
  playPauseBtn.innerHTML = isPlaying
    ? '<i class="fas fa-pause"></i>'
    : '<i class="fas fa-play"></i>';
}

function seek(e) {
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audio.currentTime = percent * audio.duration;
}

function updateProgress() {
  if (audio.duration) {
    const percent = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = percent + "%";
    currentTimeSpan.textContent = formatTime(audio.currentTime);
  }
}

function updateDuration() {
  durationSpan.textContent = formatTime(audio.duration);
}

function formatTime(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function handleTrackEnd() {
  if (repeatMode === "one") {
    audio.currentTime = 0;
    audio.play();
  } else {
    playNext();
  }
}

// ==================== VISUALIZER ====================
function setupVisualizer() {
 audioContext = new (window.AudioContext || window.webkitAudioContext)();
visualizerAnalyser = audioContext.createAnalyser();
visualizerAnalyser.fftSize = 256;
const bufferLength = visualizerAnalyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

visualizerSource = audioContext.createMediaElementSource(audio);
visualizerSource.connect(visualizerAnalyser);
visualizerAnalyser.connect(audioContext.destination);

  function draw() {
    animationFrame = requestAnimationFrame(draw);
    visualizerAnalyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    canvasCtx.fillStyle = "rgba(255,255,255,0.05)";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    const barWidth = (WIDTH / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 2;
      canvasCtx.fillStyle = `rgba(100, 180, 255, 0.3)`;
      canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }
  draw();
}

// ==================== FILTER ====================
function filterTracks() {
  renderTrackList();
}

// ==================== THEME ====================
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const newTheme = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  themeToggle.innerHTML =
    newTheme === "light"
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';
}

// ==================== KEYBOARD ====================
function handleKeyboard(e) {
  if (e.target.tagName === "INPUT") return;

  switch (e.code) {
    case "Space":
      e.preventDefault();
      togglePlayPause();
      break;
    case "ArrowLeft":
      e.preventDefault();
      audio.currentTime -= 5;
      break;
    case "ArrowRight":
      e.preventDefault();
      audio.currentTime += 5;
      break;
    case "KeyN":
      if (e.ctrlKey) playNext();
      break;
    case "KeyP":
      if (e.ctrlKey) playPrevious();
      break;
  }
}

function showPlaceholder(msg) {
  trackListContainer.innerHTML = `<div class="placeholder-message"><i class="fas fa-info-circle"></i><p>${msg}</p></div>`;
}
