// Use data from window.musicData
const autoplay = window.musicData.autoplay;
const bgElement = document.getElementById('bgElement');
if (bgElement) {
    bgElement.style.filter = `blur(${window.musicData.blur}px)`;
}

// Pause media until overlay is clicked
const overlay = document.getElementById('overlay');
const video = document.querySelector('video');
const audio = document.getElementById('audio-element');

if (video) video.pause();
if (audio) audio.pause();

overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    if (video) video.play();
    if (audio) {
        audio.play().then(() => {
            // Update player UI if music player is shown
            if (document.querySelector('.player')) {
                const playBtn = document.querySelector('.play i');
                const albumCover = document.querySelector('.image');
                playBtn.classList.remove('fa-play');
                playBtn.classList.add('fa-pause');
                albumCover.style.animation = 'spin 20s linear infinite';
            }
        }).catch(e => {
            console.log('Autoplay prevented:', e);
        });
    }
});

// Music player functionality
document.addEventListener('DOMContentLoaded', () => {
    const audioElement = document.getElementById('audio-element');
    if (!audioElement) return;

    const files = window.musicData.files;
    let currentIndex = files.findIndex(file => file.url === window.musicData.selectedUrl);

    // Player elements
    const player = document.querySelector('.player');
    const playBtnDiv = document.querySelector('.play');
    const playBtn = document.querySelector('.play i');
    const backwardBtn = document.querySelector('.backward');
    const forwardBtn = document.querySelector('.forward');
    const titleEl = document.querySelector('.title');
    const artistEl = document.querySelector('.artist');
    const currentTimeEl = document.querySelector('.current-time');
    const totalTimeEl = document.querySelector('.total-time');
    const progressBar = document.querySelector('.current');
    const albumCover = document.querySelector('.image');
    const expandBtn = document.getElementById('expand-button');

    // Format time (seconds to MM:SS)
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Update song info
    function updateSongInfo() {
        const currentSong = files[currentIndex];
        titleEl.textContent = currentSong.title || 'Unknown Title';
        artistEl.textContent = currentSong.artist || 'Unknown Artist';
        // Set album cover if available
        if (currentSong.cover) {
            albumCover.style.backgroundImage = `url('${currentSong.cover}')`;
        } else {
            albumCover.style.backgroundImage = 'url("/images/music-logo.png")';
        }
    }

    // Play song
    function playSong() {
        const currentSong = files[currentIndex];
        audioElement.src = currentSong.url;
        audioElement.play()
            .then(() => {
                updateSongInfo();
                updatePlayerUI(true);
            })
            .catch(e => {
                console.log('Playback failed:', e);
            });
    }

    // Update play/pause button and album cover animation
    function updatePlayerUI(isPlaying) {
        if (isPlaying) {
            playBtn.classList.remove('fa-play');
            playBtn.classList.add('fa-pause');
            albumCover.style.animation = 'spin 20s linear infinite';
        } else {
            playBtn.classList.remove('fa-pause');
            playBtn.classList.add('fa-play');
            albumCover.style.animation = 'none';
        }
    }

    // Play next song
    function playNext() {
        currentIndex = (currentIndex + 1) % files.length;
        playSong();
    }

    // Play previous song
    function playPrevious() {
        currentIndex = (currentIndex - 1 + files.length) % files.length;
        playSong();
    }

    // Update progress bar
    function updateProgress() {
        const { currentTime, duration } = audioElement;
        const progressPercent = (currentTime / duration) * 100;
        progressBar.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(currentTime);

        if (duration) {
            totalTimeEl.textContent = formatTime(duration);
        }
    }

    // Set progress bar on click
    function setProgress(e) {
        const width = this.clientWidth;
        const clickX = e.offsetX;
        const duration = audioElement.duration;
        audioElement.currentTime = (clickX / width) * duration;
    }

    // Initialize
    updateSongInfo();
    // Set initial title and artist from selected music
    titleEl.textContent = files[currentIndex].title || 'Unknown Title';
    artistEl.textContent = files[currentIndex].artist || 'Unknown Artist';

    // Event listeners
    playBtnDiv.addEventListener('click', () => {
        if (audioElement.paused) {
            audioElement.play();
        } else {
            audioElement.pause();
        }
    });

    // Sync UI with audio events
    audioElement.addEventListener('play', () => updatePlayerUI(true));
    audioElement.addEventListener('pause', () => updatePlayerUI(false));

    backwardBtn.addEventListener('click', playPrevious);
    forwardBtn.addEventListener('click', playNext);

    audioElement.addEventListener('timeupdate', updateProgress);
    audioElement.addEventListener('ended', playNext);

    document.querySelector('.line').addEventListener('click', setProgress);

    // Expand button functionality
    expandBtn.addEventListener('click', () => {
        player.classList.toggle('expand');

        const icon = expandBtn.querySelector('i');
        if (player.classList.contains('expand')) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    });

    // Autoplay if enabled
    if (autoplay) {
        audioElement.play().then(() => {
            updatePlayerUI(true);
        }).catch(e => {
            console.log('Autoplay prevented:', e);
        });
    }
});