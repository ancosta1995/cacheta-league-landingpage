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
    const settings = getSettings();
    res.json({
        redirectUrl: settings.redirect_url,
        whatsappUrl: settings.whatsapp_url,
    });
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
    const settings = getSettings();
    res.json({
        redirectUrl: settings.redirect_url,
        whatsappUrl: settings.whatsapp_url,
    });
});

app.put("/api/admin/settings", requireAdmin, (req, res) => {
    const redirectUrl = String(req.body?.redirectUrl || "").trim();
    const whatsappUrl = String(req.body?.whatsappUrl || "").trim();

    if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
        res.status(400).json({ error: "Informe um link de redirecionamento válido." });
        return;
    }

    if (!whatsappUrl.startsWith("http://") && !whatsappUrl.startsWith("https://")) {
        res.status(400).json({ error: "Informe um link do WhatsApp válido." });
        return;
    }

    setSettingStmt.run("redirect_url", redirectUrl);
    setSettingStmt.run("whatsapp_url", whatsappUrl);

    res.json({ ok: true });
});

app.use("/admin", express.static(path.join(ROOT, "admin")));
app.use(express.static(ROOT));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Painel admin: http://localhost:${PORT}/admin`);
    console.log(`Senha padrão do admin: ${ADMIN_PASSWORD}`);
});
