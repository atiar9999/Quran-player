document.addEventListener('DOMContentLoaded', function() {
  // ---------- DOM elements ----------
  const audio = new Audio();
  let tracks = [];                // Will be filled from tracks.json
  let currentIndex = 0;
  let isPlaying = false;
  let repeatMode = 'none';
  let shuffle = false;

  const thumbnailCache = new Map();

  const playPauseIcon = document.getElementById('playPauseIcon');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const stopBtn = document.getElementById('stopBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const repeatIcon = document.getElementById('repeatIcon');
  const muteBtn = document.getElementById('muteBtn');
  const muteIcon = document.getElementById('muteIcon');
  const volSlider = document.getElementById('volumeSlider');
  const volDownBtn = document.getElementById('volDownBtn');
  const volUpBtn = document.getElementById('volUpBtn');
  const speedBtn = document.getElementById('speedBtn');
  const currentTrackDisplay = document.getElementById('currentTrackDisplay');
  const currentTimeSpan = document.getElementById('currentTime');
  const durationSpan = document.getElementById('durationTime');
  const progressFill = document.getElementById('progressFill');
  const progressContainer = document.getElementById('progressBarContainer');
  const playlistContainer = document.getElementById('playlistContainer');
  const liveIndicator = document.getElementById('liveIndicator');
  const thumbnailImage = document.getElementById('thumbnailImage');
  const thumbnailIcon = document.getElementById('thumbnailIcon');
  const thumbnailSpinner = document.getElementById('thumbnailSpinner');

  // Helper: encode filename for URI
  function getAudioSrc(fileName) {
    return './' + encodeURI(fileName);
  }

  // Main thumbnail functions
  function setMainThumbnail(src) {
    thumbnailSpinner.style.display = 'none';
    if (src) {
      thumbnailImage.src = src;
      thumbnailImage.style.display = 'block';
      thumbnailIcon.style.display = 'none';
    } else {
      thumbnailImage.style.display = 'none';
      thumbnailIcon.style.display = 'block';
    }
  }

  function showMainThumbnailLoading() {
    thumbnailImage.style.display = 'none';
    thumbnailIcon.style.display = 'none';
    thumbnailSpinner.style.display = 'block';
  }

  // Extract album art from file (returns Promise)
  function extractThumbnail(fileName) {
    return new Promise((resolve) => {
      if (thumbnailCache.has(fileName)) {
        resolve(thumbnailCache.get(fileName));
        return;
      }

      const fullPath = getAudioSrc(fileName);
      fetch(fullPath)
        .then(response => response.blob())
        .then(blob => {
          window.jsmediatags.read(blob, {
            onSuccess: function(tag) {
              const tags = tag.tags;
              if (tags.picture) {
                const picture = tags.picture;
                const base64String = arrayBufferToBase64(picture.data);
                const imageSrc = `data:${picture.format};base64,${base64String}`;
                thumbnailCache.set(fileName, imageSrc);
                resolve(imageSrc);
              } else {
                thumbnailCache.set(fileName, null);
                resolve(null);
              }
            },
            onError: function(error) {
              console.log('No album art or error reading metadata', error);
              thumbnailCache.set(fileName, null);
              resolve(null);
            }
          });
        })
        .catch(err => {
          console.log('Could not fetch file for metadata', err);
          thumbnailCache.set(fileName, null);
          resolve(null);
        });
    });
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Load track by index
  function loadTrack(index) {
    if (!tracks[index]) return;
    currentIndex = index;
    const track = tracks[currentIndex];
    audio.src = getAudioSrc(track.file);
    audio.load();
    currentTrackDisplay.textContent = track.display;
    updatePlaylistActive();

    showMainThumbnailLoading();
    extractThumbnail(track.file).then(src => {
      setMainThumbnail(src);
    });

    if (isPlaying) {
      audio.play().catch(e => console.log('playback delayed', e));
    }
    currentTimeSpan.textContent = '0:00';
    durationSpan.textContent = '0:00';
    progressFill.style.width = '0%';
  }

  // Play/Pause
  function playTrack() {
    audio.play()
      .then(() => {
        isPlaying = true;
        playPauseIcon.className = 'fas fa-pause';
        liveIndicator.style.opacity = '1';
      })
      .catch(e => console.warn('play error', e));
  }
  function pauseTrack() {
    audio.pause();
    isPlaying = false;
    playPauseIcon.className = 'fas fa-play';
    liveIndicator.style.opacity = '0';
  }
  function togglePlay() {
    if (isPlaying) pauseTrack();
    else playTrack();
  }

  function stopTrack() {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    playPauseIcon.className = 'fas fa-play';
    liveIndicator.style.opacity = '0';
  }

  // Next/Previous with shuffle
  function nextTrack() {
    if (shuffle && tracks.length > 1) {
      let randomIdx;
      do { randomIdx = Math.floor(Math.random() * tracks.length); }
      while (randomIdx === currentIndex && tracks.length > 1);
      loadTrack(randomIdx);
      playTrack();
    } else {
      let newIndex = (currentIndex + 1) % tracks.length;
      loadTrack(newIndex);
      playTrack();
    }
  }

  function prevTrack() {
    if (shuffle && tracks.length > 1) {
      let randomIdx;
      do { randomIdx = Math.floor(Math.random() * tracks.length); }
      while (randomIdx === currentIndex && tracks.length > 1);
      loadTrack(randomIdx);
      playTrack();
    } else {
      let newIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      loadTrack(newIndex);
      playTrack();
    }
  }

  // Repeat
  function cycleRepeat() {
    if (repeatMode === 'none') {
      repeatMode = 'one';
      repeatIcon.className = 'fas fa-repeat-1';
    } else if (repeatMode === 'one') {
      repeatMode = 'all';
      repeatIcon.className = 'fas fa-repeat';
    } else {
      repeatMode = 'none';
      repeatIcon.className = 'fas fa-repeat';
    }
    updateRepeatUI();
  }

  function updateRepeatUI() {
    if (repeatMode === 'none') repeatBtn.classList.remove('active');
    else repeatBtn.classList.add('active');
  }

  // Shuffle
  function toggleShuffle() {
    shuffle = !shuffle;
    if (shuffle) shuffleBtn.classList.add('active');
    else shuffleBtn.classList.remove('active');
  }

  // Volume
  function setVolume(value) {
    value = Math.max(0, Math.min(1, value));
    audio.volume = value;
    volSlider.value = value;
    updateMuteIcon(value === 0 || audio.muted);
  }
  function toggleMute() {
    audio.muted = !audio.muted;
    updateMuteIcon(audio.muted || audio.volume === 0);
  }
  function updateMuteIcon(isMuted) {
    if (isMuted) muteIcon.className = 'fas fa-volume-xmark';
    else if (audio.volume < 0.33) muteIcon.className = 'fas fa-volume-off';
    else if (audio.volume < 0.66) muteIcon.className = 'fas fa-volume-low';
    else muteIcon.className = 'fas fa-volume-high';
  }

  // Speed
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
  let speedIndex = 1;
  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % speeds.length;
    audio.playbackRate = speeds[speedIndex];
    speedBtn.textContent = speeds[speedIndex].toFixed(2) + 'x';
  }

  // Time formatting
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Progress
  function updateProgress() {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = percent + '%';
      currentTimeSpan.textContent = formatTime(audio.currentTime);
      durationSpan.textContent = formatTime(audio.duration);
    }
  }

  // Seek
  function seek(e) {
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    let percent = clickX / width;
    percent = Math.max(0, Math.min(1, percent));
    if (audio.duration) {
      audio.currentTime = percent * audio.duration;
    }
  }

  // Render playlist (with thumbnails)
  function renderPlaylist() {
    playlistContainer.innerHTML = '';
    tracks.forEach((track, idx) => {
      const li = document.createElement('li');
      li.className = 'playlist-item' + (idx === currentIndex ? ' active' : '');
      li.dataset.index = idx;

      const thumbDiv = document.createElement('div');
      thumbDiv.className = 'playlist-thumb';
      const img = document.createElement('img');
      img.alt = '';
      img.style.display = 'none';
      const icon = document.createElement('i');
      icon.className = 'fas fa-quran';
      const spinner = document.createElement('i');
      spinner.className = 'fas fa-spinner fa-pulse spinner';
      spinner.style.display = 'none';
      thumbDiv.appendChild(img);
      thumbDiv.appendChild(icon);
      thumbDiv.appendChild(spinner);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'playlist-name';
      nameSpan.textContent = track.display;

      li.appendChild(thumbDiv);
      li.appendChild(nameSpan);

      // Load thumbnail asynchronously
      (function(li, fileName, imgEl, iconEl, spinnerEl) {
        if (thumbnailCache.has(fileName)) {
          const src = thumbnailCache.get(fileName);
          if (src) {
            imgEl.src = src;
            imgEl.style.display = 'block';
            iconEl.style.display = 'none';
          } else {
            imgEl.style.display = 'none';
            iconEl.style.display = 'block';
          }
        } else {
          iconEl.style.display = 'none';
          spinnerEl.style.display = 'block';
          extractThumbnail(fileName).then(src => {
            spinnerEl.style.display = 'none';
            if (src) {
              imgEl.src = src;
              imgEl.style.display = 'block';
              iconEl.style.display = 'none';
            } else {
              imgEl.style.display = 'none';
              iconEl.style.display = 'block';
            }
          });
        }
      })(li, track.file, img, icon, spinner);

      li.addEventListener('click', () => {
        if (currentIndex !== idx) {
          loadTrack(idx);
          playTrack();
        } else {
          togglePlay();
        }
      });

      playlistContainer.appendChild(li);
    });
  }

  function updatePlaylistActive() {
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
      if (i === currentIndex) item.classList.add('active');
      else item.classList.remove('active');
    });
  }

  // ---------- Load tracks from tracks.json ----------
  fetch('tracks.json')
    .then(response => response.json())
    .then(data => {
      tracks = data;  // data is the array from tracks.json
      renderPlaylist();
      if (tracks.length > 0) {
        loadTrack(0);
      }
    })
    .catch(err => {
      console.error('Could not load tracks.json', err);
      playlistContainer.innerHTML = '<li class="playlist-item">Error loading tracks. Make sure tracks.json exists.</li>';
    });

  // Event listeners
  audio.addEventListener('loadedmetadata', () => {
    durationSpan.textContent = formatTime(audio.duration);
    if (isPlaying) playTrack();
  });
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      playTrack();
    } else if (repeatMode === 'all' || (repeatMode === 'none' && currentIndex < tracks.length - 1)) {
      nextTrack();
    } else {
      pauseTrack();
      liveIndicator.style.opacity = '0';
    }
  });

  playPauseBtn.addEventListener('click', togglePlay);
  stopBtn.addEventListener('click', stopTrack);
  prevBtn.addEventListener('click', prevTrack);
  nextBtn.addEventListener('click', nextTrack);
  shuffleBtn.addEventListener('click', toggleShuffle);
  repeatBtn.addEventListener('click', cycleRepeat);
  volSlider.addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
    audio.muted = false;
    updateMuteIcon(false);
  });
  muteBtn.addEventListener('click', toggleMute);
  volDownBtn.addEventListener('click', () => setVolume(audio.volume - 0.1));
  volUpBtn.addEventListener('click', () => setVolume(audio.volume + 0.1));
  speedBtn.addEventListener('click', cycleSpeed);
  progressContainer.addEventListener('click', seek);

  // Initial volume
  audio.volume = 0.7;
  updateMuteIcon(false);

  // Volume sync
  audio.addEventListener('volumechange', () => {
    volSlider.value = audio.volume;
    updateMuteIcon(audio.muted || audio.volume === 0);
  });
});