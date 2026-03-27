const overlay = document.querySelector(".overlay");
const popup = document.querySelector(".popup");
const addbtn = document.getElementById("add-btn");
const addSong = document.querySelector(".add-song");
const cancel = document.querySelector(".cancel");
const closePopupBtn = document.querySelector(".close-popup");
const container = document.getElementById("song-list");
const songName = document.getElementById("song-name");
const songFile = document.getElementById("song");

// Helper function to format time (e.g., 65s -> 1:05)
function formatTime(timeInSeconds) {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Function to initialize a custom audio player
function initAudioPlayer(songContainer) {
    const audio = songContainer.querySelector(".audio-element");
    const playPauseBtn = songContainer.querySelector(".play-pause-btn");
    const playPauseIcon = playPauseBtn.querySelector(".material-symbols-rounded");
    const progressContainer = songContainer.querySelector(".progress-container");
    const progressBar = songContainer.querySelector(".progress-bar");
    const currentTimeEl = songContainer.querySelector(".current-time");
    const totalTimeEl = songContainer.querySelector(".total-time");

    // Load initial metadata to set total time
    audio.addEventListener("loadedmetadata", () => {
        totalTimeEl.textContent = formatTime(audio.duration);
    });
    
    // In case the metadata is already loaded before the listener is attached
    if (audio.readyState >= 1) {
        totalTimeEl.textContent = formatTime(audio.duration);
    }

    // Toggle Play/Pause
    playPauseBtn.addEventListener("click", () => {
        const isPaused = audio.paused;
        
        // Pause all other audios (optional, but good UX)
        document.querySelectorAll(".audio-element").forEach(el => {
            if (el !== audio) {
                el.pause();
                // Update their icons as well
                const otherIcon = el.parentElement.querySelector(".play-pause-btn .material-symbols-rounded");
                if (otherIcon) otherIcon.textContent = "play_arrow";
            }
        });

        if (isPaused) {
            audio.play();
            playPauseIcon.textContent = "pause";
        } else {
            audio.pause();
            playPauseIcon.textContent = "play_arrow";
        }
    });

    // Update progress bar as audio plays
    audio.addEventListener("timeupdate", () => {
        const progressPercent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(audio.currentTime);
        // Also ensure duration is updated here in case loadedmetadata wasn't caught
        if (!isNaN(audio.duration) && totalTimeEl.textContent === "0:00") {
            totalTimeEl.textContent = formatTime(audio.duration);
        }
    });

    // Reset when audio ends
    audio.addEventListener("ended", () => {
        playPauseIcon.textContent = "play_arrow";
        progressBar.style.width = "0%";
        currentTimeEl.textContent = "0:00";
    });

    // Click on progress bar to seek
    progressContainer.addEventListener("click", (e) => {
        const width = progressContainer.clientWidth;
        const clickX = e.offsetX;
        const duration = audio.duration;
        audio.currentTime = (clickX / width) * duration;
    });
}

// Initialize all existing players on page load
document.querySelectorAll(".song-container").forEach(container => {
    initAudioPlayer(container);
    
    // Add download button dynamically if not present
    const info = container.querySelector(".song-info");
    if (!info.querySelector(".download-btn")) {
        const audioSrc = container.querySelector("source").src;
        const btn = document.createElement("a");
        btn.href = audioSrc;
        btn.download = "";
        btn.className = "download-btn";
        btn.innerHTML = '<span class="material-symbols-rounded">download</span>';
        info.appendChild(btn);
    }
});

// Modal logic
function openModal() {
    overlay.style.display = "block";
    popup.style.display = "block";
    // Using setTimeout to allow display block to apply before changing opacity
    setTimeout(() => popup.style.opacity = "1", 10);
}

function closeModal() {
    overlay.style.display = "none";
    popup.style.display = "none";
}

addbtn.addEventListener("click", openModal);
cancel.addEventListener("click", closeModal);
if(closePopupBtn) closePopupBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", closeModal);

// Append a new song to the DOM
function appendSongToDOM(title, url, id) {
    let newSong = document.createElement("div");
    newSong.classList.add("song-container");

    const downloadLink = id ? `/api/songs/download/${id}` : url;

    newSong.innerHTML = `
        <div class="song-info">
            <span class="material-symbols-rounded song-icon">music_note</span>
            <h3>${title}</h3>
            <a href="${downloadLink}" class="download-btn" download><span class="material-symbols-rounded">download</span></a>
        </div>
        <div class="custom-audio-player">
            <button class="play-pause-btn"><span class="material-symbols-rounded">play_arrow</span></button>
            <div class="progress-wrapper">
                <span class="current-time">0:00</span>
                <div class="progress-container">
                    <div class="progress-bar"></div>
                </div>
                <span class="total-time">0:00</span>
            </div>
        </div>
        <audio class="audio-element" title="${title}">
            <source src="${url}">
        </audio>
    `;

    container.appendChild(newSong);
    initAudioPlayer(newSong);
}

addSong.addEventListener("click", async (e) => {
    e.preventDefault();
    const file = songFile.files[0];
    if (!file) return alert("Please select an audio file!");

    const title = songName.value || "Untitled Track";
    const formData = new FormData();
    formData.append("song", file);
    formData.append("title", title);

    try {
        const response = await fetch("/api/songs", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            appendSongToDOM(data.title, data.url, data.id);
            closeModal();
            songName.value = "";
            songFile.value = "";
        } else {
            console.error("Backend failed to save. Falling back to local DOM.");
            const blobUrl = URL.createObjectURL(file);
            appendSongToDOM(title, blobUrl, null);
            closeModal();
            songName.value = "";
            songFile.value = "";
        }
    } catch (err) {
        console.error("Backend not reachable. Falling back to local DOM.", err);
        const blobUrl = URL.createObjectURL(file);
        appendSongToDOM(title, blobUrl, null);
        closeModal();
        songName.value = "";
        songFile.value = "";
    }
});

// Fetch historical offline/online songs from backend immediately
async function fetchSongs() {
    try {
        const res = await fetch("/api/songs");
        if (!res.ok) return;
        const songs = await res.json();
        
        if (songs && Array.isArray(songs)) {
            songs.forEach(song => {
                appendSongToDOM(song.title, song.url, song.id);
            });
        }
    } catch (err) {
        console.log("No backend running or error fetching songs.", err);
    }
}

fetchSongs();
