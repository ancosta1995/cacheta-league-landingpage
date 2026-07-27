const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginStatus = document.getElementById("loginStatus");
const logoutBtn = document.getElementById("logoutBtn");
const settingsForm = document.getElementById("settingsForm");
const redirectUrlInput = document.getElementById("redirectUrl");
const whatsappUrlInput = document.getElementById("whatsappUrl");
const metaPixelIdInput = document.getElementById("metaPixelId");
const metaPixelPageViewInput = document.getElementById("metaPixelPageView");
const metaPixelLeadEventInput = document.getElementById("metaPixelLeadEvent");
const metaPixelLeadEventTypeInput = document.getElementById("metaPixelLeadEventType");
const settingsStatus = document.getElementById("settingsStatus");
const leadsTableBody = document.getElementById("leadsTableBody");
const leadsCount = document.getElementById("leadsCount");
const refreshLeadsBtn = document.getElementById("refreshLeadsBtn");

function setStatus(element, message, type = "") {
    element.textContent = message;
    element.dataset.state = type;
}

function showDashboard() {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
}

function showLogin() {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
}

function formatDate(value) {
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("pt-BR");
}

function formatPhone(phone) {
    const digits = String(phone).replace(/\D+/g, "");

    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return phone;
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Não foi possível completar a operação.");
    }

    return data;
}

async function loadSettings() {
    const data = await api("/api/admin/settings");
    redirectUrlInput.value = data.redirectUrl;
    whatsappUrlInput.value = data.whatsappUrl;
    metaPixelIdInput.value = data.metaPixelId || "";
    metaPixelPageViewInput.checked = Boolean(data.metaPixelPageView);
    metaPixelLeadEventInput.value = data.metaPixelLeadEvent || "";
    metaPixelLeadEventTypeInput.value = data.metaPixelLeadEventType || "custom";
}

async function loadLeads() {
    const data = await api("/api/admin/leads");
    const leads = data.leads || [];

    leadsCount.textContent = `${leads.length} lead(s) capturado(s)`;

    if (leads.length === 0) {
        leadsTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty">Nenhum lead capturado ainda.</td>
      </tr>
    `;
        return;
    }

    leadsTableBody.innerHTML = leads
        .map(
            (lead) => `
      <tr>
        <td>${lead.id}</td>
        <td>${lead.name}</td>
        <td>${formatPhone(lead.phone)}</td>
        <td>${formatDate(lead.created_at)}</td>
      </tr>
    `
        )
        .join("");
}

async function bootstrap() {
    try {
        const session = await api("/api/admin/session");
        if (!session.authenticated) {
            return;
        }

        showDashboard();
        await Promise.all([loadSettings(), loadLeads()]);
    } catch (_error) {
        showLogin();
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(loginStatus, "Entrando...", "");

    try {
        await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ password: loginPassword.value }),
        });

        showDashboard();
        loginPassword.value = "";
        setStatus(loginStatus, "", "");
        await Promise.all([loadSettings(), loadLeads()]);
    } catch (error) {
        setStatus(loginStatus, error.message, "error");
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await api("/api/admin/logout", { method: "POST" });
    } catch (_error) {
        // Ignore logout errors and return to login anyway.
    }

    showLogin();
});

settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(settingsStatus, "Salvando...", "");

    try {
        await api("/api/admin/settings", {
            method: "PUT",
            body: JSON.stringify({
                redirectUrl: redirectUrlInput.value.trim(),
                whatsappUrl: whatsappUrlInput.value.trim(),
                metaPixelId: metaPixelIdInput.value.trim(),
                metaPixelPageView: metaPixelPageViewInput.checked,
                metaPixelLeadEvent: metaPixelLeadEventInput.value.trim(),
                metaPixelLeadEventType: metaPixelLeadEventTypeInput.value,
            }),
        });

        setStatus(settingsStatus, "Configurações salvas com sucesso.", "success");
    } catch (error) {
        setStatus(settingsStatus, error.message, "error");
    }
});

refreshLeadsBtn.addEventListener("click", async () => {
    try {
        await loadLeads();
    } catch (error) {
        leadsCount.textContent = error.message;
    }
});

bootstrap();
