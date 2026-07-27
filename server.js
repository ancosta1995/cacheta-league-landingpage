require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "caixeta.db");

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "caixeta-dev-secret";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "cacheta2026";

const DEFAULT_SETTINGS = {
    redirect_url: "https://cacheta.app.link/IJx9lE",
    whatsapp_url:
        "https://api.whatsapp.com/send/?phone=5531971582866&text=Quero+jogar%21&type=phone_number&app_absent=0",
    meta_pixel_id: "",
    meta_pixel_pageview: "1",
    meta_pixel_lead_event: "registrou",
    meta_pixel_lead_event_type: "custom",
};

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
const setSettingStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!getSettingStmt.get(key)) {
        setSettingStmt.run(key, value);
    }
}

function getSettings() {
    const rows = db.prepare("SELECT key, value FROM settings").all();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function getMetaPixelConfig(settings) {
    const pixelId = String(settings.meta_pixel_id || "").trim();

    if (!pixelId) {
        return null;
    }

    const leadEventName = String(settings.meta_pixel_lead_event || "").trim();
    const leadEventType =
        settings.meta_pixel_lead_event_type === "standard" ? "standard" : "custom";

    return {
        pixelId,
        pageView: settings.meta_pixel_pageview !== "0",
        leadEvent: leadEventName
            ? {
                  type: leadEventType,
                  name: leadEventName,
              }
            : null,
    };
}

function buildPublicConfig(settings) {
    return {
        redirectUrl: settings.redirect_url,
        whatsappUrl: settings.whatsapp_url,
        metaPixel: getMetaPixelConfig(settings),
    };
}

function buildAdminSettings(settings) {
    return {
        redirectUrl: settings.redirect_url,
        whatsappUrl: settings.whatsapp_url,
        metaPixelId: settings.meta_pixel_id || "",
        metaPixelPageView: settings.meta_pixel_pageview !== "0",
        metaPixelLeadEvent: settings.meta_pixel_lead_event || "",
        metaPixelLeadEventType:
            settings.meta_pixel_lead_event_type === "standard" ? "standard" : "custom",
    };
}

function requireAdmin(req, res, next) {
    if (req.session?.admin) {
        next();
        return;
    }

    res.status(401).json({ error: "Não autorizado." });
}

const app = express();

app.use(express.json());
app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 12,
        },
    })
);

app.post("/api/leads", (req, res) => {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").replace(/\D+/g, "").slice(0, 11);

    if (!name || phone.length < 10) {
        res.status(400).json({ error: "Nome e telefone válidos são obrigatórios." });
        return;
    }

    const result = db
        .prepare("INSERT INTO leads (name, phone) VALUES (?, ?)")
        .run(name, phone);

    res.status(201).json({ id: result.lastInsertRowid });
});

app.get("/api/config", (_req, res) => {
    res.json(buildPublicConfig(getSettings()));
});

app.post("/api/admin/login", (req, res) => {
    const password = String(req.body?.password || "");

    if (password !== ADMIN_PASSWORD) {
        res.status(401).json({ error: "Senha incorreta." });
        return;
    }

    req.session.admin = true;
    res.json({ ok: true });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

app.get("/api/admin/session", (req, res) => {
    res.json({ authenticated: Boolean(req.session?.admin) });
});

app.get("/api/admin/leads", requireAdmin, (_req, res) => {
    const leads = db
        .prepare("SELECT id, name, phone, created_at FROM leads ORDER BY id DESC")
        .all();

    res.json({ leads });
});

app.get("/api/admin/settings", requireAdmin, (_req, res) => {
    res.json(buildAdminSettings(getSettings()));
});

app.put("/api/admin/settings", requireAdmin, (req, res) => {
    const redirectUrl = String(req.body?.redirectUrl || "").trim();
    const whatsappUrl = String(req.body?.whatsappUrl || "").trim();
    const metaPixelId = String(req.body?.metaPixelId || "").trim();
    const metaPixelPageView = Boolean(req.body?.metaPixelPageView);
    const metaPixelLeadEvent = String(req.body?.metaPixelLeadEvent || "").trim();
    const metaPixelLeadEventType =
        req.body?.metaPixelLeadEventType === "standard" ? "standard" : "custom";

    if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
        res.status(400).json({ error: "Informe um link de redirecionamento válido." });
        return;
    }

    if (!whatsappUrl.startsWith("http://") && !whatsappUrl.startsWith("https://")) {
        res.status(400).json({ error: "Informe um link do WhatsApp válido." });
        return;
    }

    if (metaPixelId && !/^\d{5,20}$/.test(metaPixelId)) {
        res.status(400).json({ error: "Informe um ID de Pixel Meta válido (somente números)." });
        return;
    }

    if (metaPixelId && metaPixelLeadEvent && !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(metaPixelLeadEvent)) {
        res.status(400).json({ error: "Informe um nome de evento válido para o Pixel Meta." });
        return;
    }

    setSettingStmt.run("redirect_url", redirectUrl);
    setSettingStmt.run("whatsapp_url", whatsappUrl);
    setSettingStmt.run("meta_pixel_id", metaPixelId);
    setSettingStmt.run("meta_pixel_pageview", metaPixelPageView ? "1" : "0");
    setSettingStmt.run("meta_pixel_lead_event", metaPixelLeadEvent);
    setSettingStmt.run("meta_pixel_lead_event_type", metaPixelLeadEventType);

    res.json({ ok: true });
});

app.use("/admin", express.static(path.join(ROOT, "admin")));
app.use(
    "/assets/media",
    express.static(path.join(ROOT, "assets", "media"), {
        maxAge: "7d",
        immutable: true,
        setHeaders(res, filePath) {
            if (filePath.endsWith(".mp4")) {
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Cache-Control", "public, max-age=604800, immutable");
            }
        },
    })
);
app.use(express.static(ROOT));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Painel admin: http://localhost:${PORT}/admin`);
    console.log(`Senha padrão do admin: ${ADMIN_PASSWORD}`);
});
