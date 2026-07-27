const LEAD_ENDPOINT = "/api/leads";
const openTrigger = document.getElementById("openLeadForm");
const modal = document.getElementById("leadModal");
const form = document.getElementById("leadForm");
const status = document.getElementById("leadStatus");
const nameInput = document.getElementById("leadName");
const phoneInput = document.getElementById("leadPhone");
const whatsappLink = document.getElementById("whatsappLink");

let destinationUrl = "";

async function loadPublicConfig() {
    const response = await fetch("/api/config");

    if (!response.ok) {
        throw new Error("Não foi possível carregar as configurações.");
    }

    const config = await response.json();
    destinationUrl = config.redirectUrl;

    if (whatsappLink && config.whatsappUrl) {
        whatsappLink.href = config.whatsappUrl;
    }
}

// Handle video autoplay and controls
function initializeVideo() {
    const video = document.getElementById("videoPlayer");
    const soundToggle = document.getElementById("soundToggle");
    const playPauseBtn = document.getElementById("playPauseBtn");
    const playPauseIcon = document.getElementById("playPauseIcon");
    const rewindBtn = document.getElementById("rewindBtn");
    const forwardBtn = document.getElementById("forwardBtn");
    const progressBar = document.querySelector(".progress-bar");
    const progressFill = document.getElementById("progressFill");
    const currentTimeDisplay = document.getElementById("currentTime");
    const durationDisplay = document.getElementById("duration");
    const overlay = document.querySelector(".phone__overlay");

    if (!video) return;

    video.muted = false;

    const formatTime = (seconds) => {
        if (!isFinite(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    };

    video.addEventListener("loadedmetadata", () => {
        durationDisplay.textContent = formatTime(video.duration);
    });

    video.addEventListener("timeupdate", () => {
        const percentage = (video.currentTime / video.duration) * 100;
        progressFill.style.width = `${percentage}%`;
        currentTimeDisplay.textContent = formatTime(video.currentTime);
    });

    const updatePlayPauseIcon = () => {
        playPauseIcon.textContent = video.paused ? "▶️" : "⏸";
    };

    playPauseBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }

        updatePlayPauseIcon();
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.remove("active"), 3000);
    });

    rewindBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        video.currentTime = Math.max(0, video.currentTime - 10);
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.remove("active"), 3000);
    });

    forwardBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.remove("active"), 3000);
    });

    progressBar.addEventListener("click", (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        video.currentTime = percentage * video.duration;
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.remove("active"), 3000);
    });

    soundToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        soundToggle.classList.toggle("muted", video.muted);
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.remove("active"), 3000);
    });

    video.addEventListener("play", updatePlayPauseIcon);
    video.addEventListener("pause", updatePlayPauseIcon);

    video.addEventListener("click", () => {
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.remove("active"), 3000);
    });

    const tryToPlay = () => {
        const playPromise = video.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    updatePlayPauseIcon();
                })
                .catch((error) => {
                    console.log("Autoplay prevented:", error);

                    const playOnInteraction = () => {
                        video.play().catch((err) => console.log("Play error:", err));
                        updatePlayPauseIcon();
                        overlay.classList.add("active");
                        setTimeout(() => overlay.classList.remove("active"), 3000);

                        document.removeEventListener("click", playOnInteraction);
                        document.removeEventListener("touchstart", playOnInteraction);
                    };

                    document.addEventListener("click", playOnInteraction, {
                        once: true,
                    });
                    document.addEventListener("touchstart", playOnInteraction, {
                        once: true,
                    });
                });
        }
    };

    if (video.readyState >= 2) {
        tryToPlay();
    } else {
        video.addEventListener("canplay", tryToPlay, {
            once: true,
        });
    }

    setTimeout(tryToPlay, 500);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeVideo);
} else {
    initializeVideo();
}

loadPublicConfig().catch((error) => {
    console.error(error);
});

function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    openTrigger.focus();
}

function normalizePhone(value) {
    let digits = value.replace(/\D+/g, "");

    if (digits.length > 11 && digits.startsWith("55")) {
        digits = digits.slice(2);
    }

    return digits.slice(0, 11);
}

function formatPhone(value) {
    const digits = normalizePhone(value).slice(0, 11);

    if (digits.length === 0) {
        return "";
    }

    if (digits.length <= 2) {
        return `(${digits}`;
    }

    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function setStatus(message, type) {
    status.textContent = message;
    status.dataset.state = type;
}

function setSubmitting(isSubmitting) {
    form.classList.toggle("is-submitting", isSubmitting);
    form.querySelector(".lead-form__submit").disabled = isSubmitting;
}

function openDestination() {
    if (!destinationUrl) {
        return;
    }

    const destination = window.open(destinationUrl, "_blank", "noopener,noreferrer");

    if (!destination) {
        window.location.href = destinationUrl;
    }
}

async function saveLead(payload) {
    const response = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível salvar o lead.");
    }
}

openTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
});

phoneInput.addEventListener("input", () => {
    const previousLength = phoneInput.value.length;
    phoneInput.value = formatPhone(phoneInput.value);

    if (phoneInput.value.length > previousLength) {
        phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    }
});

modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
        closeModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const phone = normalizePhone(phoneInput.value);

    if (!name || phone.length < 10) {
        setStatus("Preencha nome e telefone válidos.", "error");
        return;
    }

    setStatus("Enviando...", "loading");
    setSubmitting(true);

    try {
        await saveLead({ name, phone });

        setStatus("Tudo certo. Abrindo a Play Store...", "success");

        window.setTimeout(() => {
            openDestination();
        }, 700);
    } catch (error) {
        setStatus("Não foi possível salvar agora. Tente novamente.", "error");
        console.error(error);
    } finally {
        setSubmitting(false);
    }
});
