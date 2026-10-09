import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, Ambulance, Bed, Bell, Check, ChevronDown, ChevronRight, ClipboardList,
  Clock3, FileText, HeartPulse, Hospital, LayoutDashboard, LogOut, Menu, MessageCircle,
  Plus, Radio, Search, Settings, Shield, Siren, Users, X
} from "lucide-react";
import { api, loginUrl } from "./services/api";
import { demoList, demoRemove, demoReset, demoSave, demoSessionKey, demoStats, demoUser } from "./services/demo";
import type { DashboardStats, RecordItem, Resource, User } from "./types";

type Page = { path: string; title: string; icon: typeof Activity; resource?: Resource; group: string };
const pages: Page[] = [
  { path: "/dashboard", title: "Dashboard", icon: LayoutDashboard, group: "ARBEITSPLATZ" },
  { path: "/dispatch", title: "Dispatch", icon: Siren, resource: "calls", group: "EINSÄTZE" },
  { path: "/incidents", title: "Einsätze", icon: ClipboardList, resource: "calls", group: "EINSÄTZE" },
  { path: "/hospital", title: "Hospital", icon: Hospital, resource: "patients", group: "MEDIZIN" },
  { path: "/patients", title: "Patienten", icon: HeartPulse, resource: "patients", group: "MEDIZIN" },
  { path: "/records", title: "Patientenakten", icon: ClipboardList, resource: "patient_records", group: "MEDIZIN" },
  { path: "/beds", title: "Betten", icon: Bed, resource: "beds", group: "MEDIZIN" },
  { path: "/vitals", title: "Vitalzeichen", icon: Activity, resource: "vitals", group: "MEDIZIN" },
  { path: "/radio", title: "Funk", icon: Radio, resource: "radio_channels", group: "KOMMUNIKATION" },
  { path: "/invoices", title: "Rechnungen", icon: FileText, resource: "invoices", group: "VERWALTUNG" },
  { path: "/notifications", title: "Benachrichtigungen", icon: Bell, resource: "notifications", group: "VERWALTUNG" },
  { path: "/vehicles", title: "Fahrzeuge", icon: Ambulance, resource: "vehicles", group: "EINSÄTZE" },
  { path: "/staff", title: "Mitarbeiter", icon: Users, resource: "users", group: "ORGANISATION" },
  { path: "/profile", title: "Profil", icon: Users, group: "KONTO" },
  { path: "/statistics", title: "Statistiken", icon: Activity, group: "VERWALTUNG" },
  { path: "/admin", title: "Admin", icon: Shield, resource: "activity_logs", group: "SYSTEM" },
  { path: "/roles", title: "Rollen & Rechte", icon: Shield, resource: "roles", group: "SYSTEM" },
  { path: "/settings", title: "Einstellungen", icon: Settings, group: "SYSTEM" }
];
const allowedResourceRoles: Partial<Record<Resource, string[]>> = {
  users: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus", "Benutzer"],
  patients: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  patient_records: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  roles: ["Admin", "Moderator"],
  notifications: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus", "Benutzer"],
  vitals: ["Admin", "Moderator", "Krankenhaus", "Rettungsdienst"],
  beds: ["Admin", "Moderator", "Krankenhaus"],
  calls: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"],
  vehicles: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr"],
  radio_channels: ["Admin", "Moderator", "Rettungsdienst", "Feuerwehr", "Krankenhaus"],
  invoices: ["Admin", "Moderator", "Krankenhaus"],
  activity_logs: ["Admin", "Moderator"]
};

const fields: Partial<Record<Resource, { key: string; label: string; type?: string; options?: string[]; required?: boolean }[]>> = {
  calls: [
    { key: "title", label: "Stichwort", required: true }, { key: "incidentType", label: "Einsatzart", required: true },
    { key: "address", label: "Einsatzort", required: true }, { key: "priority", label: "Priorität", type: "select", options: ["P1", "P2", "P3"] },
    { key: "patientCount", label: "Patienten", type: "number" }, { key: "team", label: "Team (Komma-getrennt)" },
    { key: "vehicles", label: "Fahrzeuge (Komma-getrennt)" }, { key: "notes", label: "Notizen", type: "textarea" }
  ],
  patients: [
    { key: "name", label: "Name", required: true }, { key: "age", label: "Alter", type: "number" },
    { key: "status", label: "Status", type: "select", options: ["Aufgenommen", "Beobachtung", "Kritisch", "Entlassen"] },
    { key: "diagnosis", label: "Diagnose" }, { key: "allergies", label: "Allergien (Komma-getrennt)" },
    { key: "bloodType", label: "Blutgruppe" }, { key: "room", label: "Zimmer" }, { key: "bed", label: "Bett" }, { key: "notes", label: "Notizen", type: "textarea" }
  ],
  patient_records: [
    { key: "patientId", label: "Patienten-ID", required: true }, { key: "title", label: "Eintrag", required: true },
    { key: "diagnosis", label: "Diagnose" }, { key: "notes", label: "Notizen", type: "textarea" }
  ],
  roles: [
    { key: "name", label: "Rollenname", required: true }, { key: "description", label: "Beschreibung" },
    { key: "discordRoleId", label: "Discord-Rollen-ID" }, { key: "permissions", label: "Berechtigungen (Komma-getrennt)" }
  ],
  notifications: [
    { key: "title", label: "Titel", required: true }, { key: "message", label: "Nachricht", required: true },
    { key: "type", label: "Typ", type: "select", options: ["Info", "Warnung", "Kritisch"] },
    { key: "recipientRole", label: "Zielrolle (optional)" }
  ],
  vitals: [
    { key: "patientId", label: "Patient", required: true }, { key: "pulse", label: "Puls / min", type: "number", required: true },
    { key: "respiratoryRate", label: "Atemfrequenz / min", type: "number", required: true }, { key: "temperature", label: "Temperatur °C", type: "number", required: true },
    { key: "oxygenSaturation", label: "Sauerstoffsättigung %", type: "number", required: true }, { key: "bloodPressure", label: "Blutdruck", required: true },
    { key: "notes", label: "Notizen", type: "textarea" }
  ],
  beds: [
    { key: "code", label: "Bettkennung", required: true }, { key: "ward", label: "Station" },
    { key: "status", label: "Status", type: "select", options: ["Frei", "Belegt", "Reserviert", "Wartung"] }, { key: "patientId", label: "Patienten-ID" }
  ],
  vehicles: [
    { key: "callSign", label: "Funkkennung", required: true }, { key: "kind", label: "Fahrzeugtyp" },
    { key: "location", label: "Standort" }, { key: "status", label: "Status", type: "select", options: ["Frei", "Einsatz", "Anfahrt", "Vor Ort", "Transport", "Außer Dienst", "Werkstatt"] },
    { key: "crew", label: "Besatzung (Komma-getrennt)" }, { key: "fuel", label: "Tank %", type: "number" }, { key: "mileage", label: "Kilometerstand", type: "number" }
  ],
  users: [
    { key: "displayName", label: "Name", required: true }, { key: "serviceNumber", label: "Dienstnummer" },
    { key: "role", label: "Rolle", type: "select", options: ["Admin", "Moderator", "Rettungsdienst", "Krankenhaus", "Feuerwehr", "Benutzer"] },
    { key: "department", label: "Abteilung" }, { key: "dutyStatus", label: "Dienststatus", type: "select", options: ["Dienst", "Pause", "Außer Dienst"] }
  ],
  radio_channels: [
    { key: "name", label: "Kanalname", required: true }, { key: "description", label: "Beschreibung" },
    { key: "status", label: "Status", type: "select", options: ["Aktiv", "Inaktiv"] }
  ],
  invoices: [
    { key: "patientName", label: "Patient", required: true }, { key: "callId", label: "Einsatz-ID" },
    { key: "serviceNames", label: "Leistungen aus Preiskatalog (Komma-getrennt)", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["Offen", "Bezahlt", "Storniert"] }
  ],
  price_catalog: [
    { key: "name", label: "Leistung", required: true }, { key: "amountEur", label: "Preis (€)", type: "number", required: true },
    { key: "active", label: "Aktiv", type: "select", options: ["Ja", "Nein"] }
  ]
};

const formatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const display = (value: unknown) => value == null || value === "" ? "—" : Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
const dateDisplay = (value: unknown) => value ? new Date(String(value)).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—";
const idName = (page: Pick<Page, "title">, row: RecordItem) => display(row.title || row.name || row.displayName || row.patientName || row.code || row.callSign || row.invoiceNumber || page.title);
const description = (row: RecordItem) => {
  const entries = ["incidentType", "address", "diagnosis", "room", "ward", "kind", "location", "description", "patientName", "department", "serviceNumber", "action", "entity"]
    .map((key) => row[key]).filter(Boolean);
  if (typeof row.amountCents === "number") entries.push(formatter.format(row.amountCents / 100));
  if (row.latestVitals && typeof row.latestVitals === "object") {
    const vitals = row.latestVitals as Record<string, unknown>;
    entries.push(`Vitalzeichen: Puls ${display(vitals.pulse)} · SpO₂ ${display(vitals.oxygenSaturation)} % · ${display(vitals.classification)}`);
  }
  return entries.map(display).join(" · ") || display(row.notes || row.body || row.role);
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const error = new URLSearchParams(location.search).get("authError");
    if (error === "blocked") setAuthError("Dieses Konto wurde gesperrt.");
    else if (error === "oauthConfig") setAuthError("Discord OAuth ist nicht vollständig eingerichtet. Bitte prüfe die serverseitigen Umgebungsvariablen.");
    else if (error === "databaseConfig") setAuthError("MongoDB Atlas ist nicht konfiguriert. Bitte prüfe MONGODB_URI und MONGODB_DATABASE in Vercel.");
    else if (error === "databaseUnavailable") setAuthError("MongoDB Atlas ist momentan nicht erreichbar. Bitte versuche es später erneut.");
    else if (error === "sessionConfig") setAuthError("JWT_SECRET fehlt oder ist noch ein Platzhalter. Erzeuge einen neuen zufälligen Secret-Wert.");
    else if (error) setAuthError("Discord-Anmeldung fehlgeschlagen. Prüfe die OAuth-Konfiguration.");
    try {
      if (sessionStorage.getItem(demoSessionKey) === "true") {
        setUser(demoUser);
        setDemo(true);
        setAuthLoading(false);
        return;
      }
    } catch {
      setAuthError("Browser-Speicher ist nicht verfügbar. Der Demo-Modus kann nicht gestartet werden.");
    }
    api.session().then(({ user: current }) => setUser(current)).catch((err: unknown) => {
      setAuthError(err instanceof Error ? err.message : "Server momentan nicht erreichbar.");
    }).finally(() => setAuthLoading(false));
  }, []);

  const currentPage = pages.find((item) => item.path === location.pathname) || pages[0];
  const enterDemo = () => {
    try {
      sessionStorage.setItem(demoSessionKey, "true");
      setUser(demoUser);
      setDemo(true);
      setAuthError("");
    } catch {
      setAuthError("Browser-Speicher ist blockiert. Der isolierte Demo-Modus kann nicht gestartet werden.");
      return;
    }
    navigate("/dashboard");
  };
  const signOut = async () => {
    if (demo) {
      try { sessionStorage.removeItem(demoSessionKey); }
      catch { setAuthError("Demo-Sitzung konnte nicht beendet werden."); }
    } else {
      await api.logout().catch((err: unknown) => setAuthError(err instanceof Error ? err.message : "Abmeldung fehlgeschlagen."));
    }
    setUser(null);
    setDemo(false);
    navigate("/");
  };

  if (authLoading) return <div className="boot"><div className="spinner" /> MEDCNET wird geladen</div>;
  if (!user) return <Login error={authError} onDemo={enterDemo} />;

  const visiblePages = pages.filter((item) => !item.resource || !allowedResourceRoles[item.resource] || allowedResourceRoles[item.resource]?.includes(user.role));
  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Menü schließen" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><HeartPulse size={20} /></span><span>MEDC<span>NET</span></span><button className="close-menu" onClick={() => setMobileOpen(false)} aria-label="Menü schließen"><X size={17} /></button></div>
        <div className="station"><div className="station-icon"><Hospital size={17} /></div><div><b>MEDCNET Leitstelle</b><small>Rettungsdienst · Krankenhaus</small></div><ChevronDown size={15} /></div>
        <nav className="navigation">{[...new Set(visiblePages.map((item) => item.group))].map((group) => (
          <div className="nav-group" key={group}><div className="nav-caption">{group}</div>
            {visiblePages.filter((item) => item.group === group).map(({ path, title, icon: Icon }) => (
              <Link key={path} to={path} onClick={() => setMobileOpen(false)} className={`nav-link ${currentPage.path === path ? "nav-active" : ""}`}><Icon size={17} /><span>{title}</span></Link>
            ))}
          </div>
        ))}</nav>
        <div className="sidebar-bottom"><div className="service-state"><span className={`state-dot ${demo ? "dot-offline" : ""}`} /><div><b>{demo ? "DEMO-MODUS" : "MEDCNET"}</b><small>{demo ? "Nur lokale Beispieldaten" : "Produktionssystem"}</small></div></div>
          <button className="user-card" onClick={() => navigate("/profile")}><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><b>{user.name}</b><small>{user.role}</small></div><ChevronDown size={14} /></button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="topbar-left"><button className="menu-button" aria-label="Menü öffnen" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><span className="crumb">MEDCNET <ChevronRight size={13} /> <b>{currentPage.title}</b></span></div>
          <div className="topbar-actions"><label className="search"><Search size={15} /><input aria-label="Seite durchsuchen" placeholder="Bereich durchsuchen…" onChange={(event) => window.dispatchEvent(new CustomEvent("medcnet-search", { detail: event.target.value }))} /></label><span className="top-icon" title="Benachrichtigungsstatus"><Bell size={18} /><i /></span><span className="top-separator" /><span className="top-identity"><span className="avatar avatar-sm">{user.name.slice(0, 1).toUpperCase()}</span>{user.name}</span><button className="top-icon" title="Abmelden" onClick={() => void signOut()}><LogOut size={17} /></button></div>
        </header>
        {demo && <div className="demo-banner"><Shield size={15} /><b>DEMO-MODUS</b><span>Fiktive Beispieldaten · getrennt von MongoDB und Produktionsdaten</span><button onClick={() => { demoReset(); window.location.reload(); }}>Demo-Daten zurücksetzen</button></div>}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {pages.map((page) => <Route key={page.path} path={page.path} element={<Workspace page={page} user={user} demo={demo} onUserNameChange={(name) => setUser((current) => current ? { ...current, name } : current)} />} />)}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <footer className="footer"><span>MEDCNET · Medizinisches Einsatzmanagement</span><span><span className={`state-dot ${demo ? "dot-offline" : ""}`} /> {demo ? "DEMO-MODUS" : "PRODUKTION"}</span></footer>
      </main>
    </div>
  );
}

function Login({ error, onDemo }: { error: string; onDemo: () => void }) {
  return <main className="login"><section className="login-brand"><div className="brand"><span className="brand-mark"><HeartPulse size={22} /></span><span>MEDC<span>NET</span></span></div><div className="login-intro"><span className="eyebrow"><span className="state-dot" /> INTEGRIERTE LEITSTELLE</span><h1>Im Einsatz.<br /><em>Gemeinsam.</em></h1><p>Die zentrale Plattform für Rettungsdienst, Krankenhaus und Einsatzkoordination.</p><div className="login-signature">LAGE · PATIENTEN · RESSOURCEN</div></div></section>
    <section className="login-panel"><div className="login-card"><div className="login-shield"><Shield size={22} /></div><h2>Anmelden</h2><p>Nutze dein autorisiertes Discord-Konto.</p>{error && <div className="error-box">{error}</div>}<a className="button-primary button-wide" href={loginUrl}><MessageCircle size={17} /> Mit Discord anmelden <ChevronRight size={17} /></a><div className="divider"><span>ODER</span></div><button className="button-secondary button-wide" onClick={onDemo}><Activity size={17} /> Isolierten Demo-Modus starten</button><small className="login-footnote">Die Demo verwendet ausschließlich fiktive Daten in einem separaten Browser-Speicher. Keine Verbindung zu Produktionsdaten.</small></div></section>
  </main>;
}

function Workspace({ page, user, demo, onUserNameChange }: { page: Page; user: User; demo: boolean; onUserNameChange: (name: string) => void }) {
  const [rows, setRows] = useState<RecordItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>(demo ? demoStats() : emptyStats);
  const [dashboardData, setDashboardData] = useState({ recentCalls: [] as RecordItem[], criticalPatients: [] as RecordItem[], activity: [] as RecordItem[], notifications: [] as RecordItem[] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [channelId, setChannelId] = useState("");
  const [radioBody, setRadioBody] = useState("");
  const accessDenied = Boolean(page.resource && allowedResourceRoles[page.resource] && !allowedResourceRoles[page.resource]?.includes(user.role));

  const load = useCallback(async () => {
    if (accessDenied) {
      setRows([]);
      setError("Deine Rolle hat keinen Zugriff auf diesen Bereich.");
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (demo) {
        if (page.resource) setRows(demoList(page.resource));
        setStats(demoStats());
        setDashboardData({
          recentCalls: demoList("calls"),
          criticalPatients: demoList("patients").filter((patient) => patient.status === "Kritisch"),
          activity: demoList("activity_logs"),
          notifications: demoList("notifications")
        });
      } else {
        if (page.resource) setRows(await api.list(page.resource));
        if (["/dashboard", "/statistics"].includes(page.path)) setStats(await api.stats());
        if (page.path === "/dashboard") setDashboardData(await api.dashboard());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [accessDenied, demo, page.path, page.resource]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (demo || page.resource !== "radio_channels") return;
    const timer = window.setInterval(() => { void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [demo, page.resource, load]);
  useEffect(() => {
    const update = (event: Event) => setFilter((event as CustomEvent<string>).detail);
    window.addEventListener("medcnet-search", update);
    return () => window.removeEventListener("medcnet-search", update);
  }, []);

  const isAdmin = user.role === "Admin";
  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase())), [rows, filter]);
  const tell = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };

  async function save(values: Record<string, unknown>, id?: string) {
    if (!page.resource) return;
    try {
      if (demo) {
        const saved = demoSave(page.resource, values, id);
        if (page.resource === "vitals" && values.patientId) {
          const patient = demoList("patients").find((item) => item._id === String(values.patientId));
          if (patient) {
            const status = values.classification === "Kritisch" ? "Kritisch" : values.classification === "Warnung" ? "Beobachtung" : patient.status;
            demoSave("patients", {
              latestVitals: { ...values, recordedAt: new Date().toISOString() },
              ...(patient.status === "Entlassen" ? {} : { status })
            }, patient._id);
          }
        }
        if (page.resource === "invoices" && !saved.invoiceNumber) {
          demoSave("invoices", { invoiceNumber: `DEMO-${Date.now()}` }, saved._id);
        }
      } else if (id) await api.update(page.resource, id, values);
      else await api.create(page.resource, values);
      setModal(false);
      tell(id ? "Änderungen gespeichert." : "Eintrag angelegt.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen."); }
  }

  async function remove(row: RecordItem) {
    if (!page.resource || !window.confirm(`Eintrag „${idName(page, row)}“ wirklich löschen?`)) return;
    try {
      if (demo) demoRemove(page.resource, row._id);
      else await api.remove(page.resource, row._id);
      tell("Eintrag gelöscht.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen."); }
  }

  async function updateStatus(row: RecordItem, status: string, key = "status") {
    const update: Record<string, unknown> = { [key]: status };
    if (page.resource === "calls") update.history = [...(Array.isArray(row.history) ? row.history : []), { status, at: new Date().toISOString(), actor: user.name }];
    if (page.resource === "patients" && key === "status") update.dischargedAt = status === "Entlassen" ? new Date().toISOString() : null;
    if (page.resource === "beds" && key === "status" && status === "Frei") update.patientId = null;
    await save(update, row._id);
  }

  async function sendRadioMessage(event: FormEvent) {
    event.preventDefault();
    const channel = rows.find((row) => row._id === channelId);
    if (!channel || !radioBody.trim()) return;
    const values = { channelId, channelName: display(channel.name), sender: user.name, body: radioBody.trim(), createdAt: new Date().toISOString() };
    try {
      if (demo) demoSave("radio_messages", values);
      else await api.create("radio_messages", values);
      setRadioBody("");
      tell("Funknachricht gesendet.");
    } catch (err) { setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden."); }
  }

  const heading = page.path === "/dashboard" ? "Lageübersicht" : page.title;
  const canCreate = Boolean(page.resource && page.resource !== "activity_logs" && page.resource !== "radio_messages" && (isAdmin || !["users", "price_catalog", "roles"].includes(page.resource)));
  const canEdit = Boolean(page.resource && page.resource !== "activity_logs" && page.resource !== "radio_messages" && (isAdmin || !["users", "price_catalog", "roles"].includes(page.resource)));
  const resourceRows = page.resource ? (page.resource === "radio_channels" ? rows : filtered) : [];

  if (accessDenied) return <div className="content"><div className="error-banner">Deine Rolle hat keinen Zugriff auf diesen Bereich.</div></div>;
  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow"><span className="state-dot" /> MEDCNET · EINSATZPLATTFORM</div><h1>{heading}<span>.</span></h1><p>{page.path === "/dashboard" ? "Aktuelle Lage, Ressourcen und Aktivitäten deiner Organisation." : `Arbeitsbereich ${page.title} · zentral verwaltete Organisationsdaten.`}</p></div>
      {canCreate && <button className="button-primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} /> {page.resource === "calls" ? "Einsatz erstellen" : page.resource === "patients" ? "Patient aufnehmen" : "Neu anlegen"}</button>}
    </div>
    {error && <div className="error-banner"><span>{error}</span><button onClick={() => void load()}>Erneut versuchen</button></div>}
    {page.path === "/dashboard" && <Dashboard stats={stats} data={dashboardData} demo={demo} loading={loading} filter={filter} />}
    {page.path === "/statistics" && <Statistics stats={stats} />}
    {page.path === "/profile" && <Profile user={user} demo={demo} onNameChange={onUserNameChange} />}
    {page.path === "/settings" && <SettingsPage demo={demo} />}
    {page.path === "/admin" && <AdminPage rows={page.resource === "activity_logs" ? rows : filtered} demo={demo} isAdmin={isAdmin} />}
    {page.path === "/radio" && <RadioView channels={rows} selected={channelId} onSelect={setChannelId} body={radioBody} setBody={setRadioBody} demo={demo} onSend={sendRadioMessage} />}
    {page.resource && page.resource !== "activity_logs" && page.resource !== "radio_channels" && page.resource !== "radio_messages" && (
      <section className="panel data-panel"><div className="panel-toolbar"><div><h2>{page.title}</h2><p>{filtered.length} Einträge · zentraler Datenbestand</p></div><label className="table-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Einträge filtern…" /></label></div>
        {page.resource === "invoices" && <div className="export-actions"><button className="button-secondary" onClick={() => exportCsv(resourceRows)}><FileText size={15} /> Rechnungen als CSV exportieren</button></div>}
        {loading ? <div className="loading-state"><span className="spinner" /> Daten werden geladen …</div> : resourceRows.length ? <div className="table-wrap"><table><thead><tr><th>Eintrag</th><th>Details</th><th>Status / Priorität</th><th>Aktualisiert</th><th aria-label="Aktionen" /></tr></thead><tbody>{resourceRows.map((row) => <tr key={row._id}><td><b>{idName(page, row)}</b><small>{page.resource === "calls" ? `#${row._id.slice(-6)}` : display(row.serviceNumber || row.bloodType || row._id.slice(-6))}</small></td><td className="detail-cell">{description(row)}</td><td><Status value={display(row.status || row.dutyStatus || row.classification || row.priority)} /></td><td>{dateDisplay(row.updatedAt || row.createdAt || row.recordedAt)}</td><td className="row-actions">{page.resource === "calls" && <select aria-label={`Status für ${idName(page, row)}`} value={display(row.status)} onChange={(event) => void updateStatus(row, event.target.value)}><option>Offen</option><option>Angenommen</option><option>Anfahrt</option><option>Vor Ort</option><option>Transport</option><option>Abgeschlossen</option><option>Abgebrochen</option></select>}{page.resource === "patients" && <select aria-label={`Patientenstatus für ${idName(page, row)}`} value={display(row.status)} onChange={(event) => void updateStatus(row, event.target.value)}><option>Aufgenommen</option><option>Beobachtung</option><option>Kritisch</option><option>Entlassen</option></select>}{page.resource === "beds" && <select aria-label={`Bettstatus für ${idName(page, row)}`} value={display(row.status)} onChange={(event) => void updateStatus(row, event.target.value)}><option>Frei</option><option>Belegt</option><option>Reserviert</option><option>Wartung</option></select>}{page.resource === "vehicles" && <select aria-label={`Fahrzeugstatus für ${idName(page, row)}`} value={display(row.status)} onChange={(event) => void updateStatus(row, event.target.value)}><option>Frei</option><option>Einsatz</option><option>Anfahrt</option><option>Vor Ort</option><option>Transport</option><option>Außer Dienst</option><option>Werkstatt</option></select>}{page.resource === "users" && <>{isAdmin && <select aria-label={`Dienststatus für ${idName(page, row)}`} value={display(row.dutyStatus)} onChange={(event) => void updateStatus(row, event.target.value, "dutyStatus")}><option>Dienst</option><option>Pause</option><option>Außer Dienst</option></select>}{isAdmin && <button className="action-button" onClick={() => void save({ banned: !row.banned }, row._id)}>{row.banned ? "Freigeben" : "Sperren"}</button>}</>}{page.resource === "invoices" && row.status === "Offen" && <button className="action-button" onClick={() => void updateStatus(row, "Bezahlt")}>Bezahlen</button>}{canEdit && <button className="action-button" onClick={() => { setEditing(row); setModal(true); }}>Bearbeiten</button>}{isAdmin && page.resource !== "activity_logs" && <button className="icon-action" title="Eintrag löschen" onClick={() => void remove(row)}><X size={15} /></button>}</td></tr>)}</tbody></table></div> : <Empty title={`Keine ${page.title.toLowerCase()} vorhanden`} body="Neue Einträge können über „Neu anlegen“ erstellt werden." />}</section>
    )}
    {notice && <div className="toast"><Check size={16} />{notice}</div>}
    {modal && page.resource && <RecordModal resource={page.resource} initial={editing || undefined} demo={demo} onClose={() => setModal(false)} onSave={(values) => void save(values, editing?._id)} />}
  </div>;
}

const emptyStats: DashboardStats = { activeCalls: 0, openCalls: 0, patients: 0, criticalPatients: 0, freeBeds: 0, occupiedBeds: 0, activeChannels: 0, vehiclesOnCall: 0, staffOnDuty: 0, openInvoices: 0 };
function exportCsv(rows: RecordItem[]) {
  const columns = ["invoiceNumber", "patientName", "callId", "amountCents", "status", "createdAt"];
  const lines = [columns.join(";"), ...rows.map((row) => columns.map((column) => {
    const value = column === "amountCents" ? Number(row.amountCents || 0) / 100 : row[column];
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }).join(";"))];
  const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `medcnet-rechnungen-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Dashboard({ stats, data, demo, loading, filter }: { stats: DashboardStats; data: { recentCalls: RecordItem[]; criticalPatients: RecordItem[]; activity: RecordItem[]; notifications: RecordItem[] }; demo: boolean; loading: boolean; filter: string }) {
  const cards = [
    { label: "Aktive Einsätze", value: stats.activeCalls, icon: Siren, tone: "red", hint: `${stats.openCalls} offen` },
    { label: "Patienten", value: stats.patients, icon: HeartPulse, tone: "blue", hint: `${stats.criticalPatients} kritisch` },
    { label: "Freie Betten", value: stats.freeBeds, icon: Bed, tone: "green", hint: `${stats.occupiedBeds} belegt` },
    { label: "Fahrzeuge im Einsatz", value: stats.vehiclesOnCall, icon: Ambulance, tone: "orange", hint: "Flottenstatus" },
    { label: "Mitarbeiter im Dienst", value: stats.staffOnDuty, icon: Users, tone: "blue", hint: "Aktuelle Schicht" },
    { label: "Aktive Funkkanäle", value: stats.activeChannels, icon: Radio, tone: "green", hint: "Kommunikation" },
    { label: "Offene Rechnungen", value: stats.openInvoices, icon: FileText, tone: "orange", hint: "Abrechnung" },
    { label: "Systemstatus", value: demo ? "DEMO" : "API", icon: Activity, tone: "red", hint: demo ? "Lokale Beispieldaten" : "Produktivbetrieb" }
  ];
  const recentCalls = data.recentCalls.filter((item) => JSON.stringify(item).toLowerCase().includes(filter.toLowerCase()));
  const critical = data.criticalPatients.filter((item) => JSON.stringify(item).toLowerCase().includes(filter.toLowerCase()));
  const activities = data.activity;
  return <><div className="metric-grid">{cards.map(({ label, value, icon: Icon, tone, hint }) => <article key={label} className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={18} /></div></div><div className="metric-value">{loading ? "—" : value}</div><div className="metric-meta"><i className={`state-dot ${tone === "red" ? "red-dot" : ""}`} />{hint}</div></article>)}</div>
    <div className="dashboard-columns"><section className="panel"><div className="panel-head"><div><h2><Siren size={17} /> Letzte Einsätze</h2><p>Aktuelle Leitstellenlage</p></div><Link to="/dispatch" className="link-button">Alle Einsätze <ChevronRight size={14} /></Link></div>{recentCalls.length ? recentCalls.slice(0, 5).map((call) => <div className="incident-line" key={call._id}><span className="incident-icon"><Ambulance size={17} /></span><div className="incident-details"><b>{idName({ title: "Einsätze" }, call)}</b><small>{display(call.address)} · {display(call.vehicles)}</small></div><Status value={display(call.priority || call.status)} /></div>) : <Empty title="Keine passenden Einsätze" body="Es liegen derzeit keine Einsätze für diese Suche vor." />}</section>
      <section className="panel"><div className="panel-head"><div><h2><HeartPulse size={17} /> Kritische Patienten</h2><p>Medizinische Aufmerksamkeit</p></div><Link to="/patients" className="link-button">Patienten <ChevronRight size={14} /></Link></div>{critical.length ? critical.map((patient) => <div className="patient-alert" key={patient._id}><span className="alert-mark"><HeartPulse size={16} /></span><div><b>{display(patient.name)}</b><small>{display(patient.diagnosis)} · Zimmer {display(patient.room)}</small></div><Status value="Kritisch" /></div>) : <Empty title="Keine kritischen Patienten" body="Alle erfassten Patienten sind stabil." />}</section></div>
    <div className="dashboard-columns lower-columns"><section className="panel"><div className="panel-head"><div><h2><Clock3 size={17} /> Aktuelle Aktivitäten</h2><p>Nachvollziehbare Änderungen</p></div><Link to="/admin" className="link-button">Protokoll <ChevronRight size={14} /></Link></div>{activities.length ? activities.slice(0, 4).map((item) => <div className="activity-line" key={item._id}><span className="activity-dot" /><div><b>{display(item.action)}</b><small>{display(item.actor)} · {dateDisplay(item.createdAt)}</small></div></div>) : <Empty title="Noch keine Aktivitäten" body="Wichtige Änderungen werden hier protokolliert." />}</section><section className="panel status-panel"><div className="panel-head"><div><h2><Activity size={17} /> Ressourcenstatus</h2><p>Aktuelle Übersicht der Organisation</p></div></div><div className="resource-stat"><span>Betten belegt</span><b>{stats.occupiedBeds} / {stats.occupiedBeds + stats.freeBeds}</b></div><div className="progress"><i style={{ width: `${stats.occupiedBeds + stats.freeBeds ? Math.round(stats.occupiedBeds / (stats.occupiedBeds + stats.freeBeds) * 100) : 0}%` }} /></div><div className="resource-stat"><span>Fahrzeuge im Einsatz</span><b>{stats.vehiclesOnCall}</b></div><div className="resource-stat"><span>Personal im Dienst</span><b>{stats.staffOnDuty}</b></div><div className="live-label"><span className="state-dot" />API-VERBINDUNG</div></section></div>
    <section className="panel dashboard-notifications"><div className="panel-head"><div><h2><Bell size={17} /> Benachrichtigungen</h2><p>Aktuelle Hinweise aus dem System</p></div><Link to="/notifications" className="link-button">Alle Hinweise <ChevronRight size={14} /></Link></div>{data.notifications.length ? data.notifications.map((item) => <div className="activity-line" key={item._id}><span className={`state-dot ${item.type === "Kritisch" ? "red-dot" : item.type === "Warnung" ? "dot-offline" : ""}`} /><div><b>{display(item.title)}</b><small>{display(item.message)} · {dateDisplay(item.createdAt)}</small></div></div>) : <Empty title="Keine Benachrichtigungen" body="Aktuelle Systemhinweise werden hier angezeigt." />}</section>
  </>;
}

function Statistics({ stats }: { stats: DashboardStats }) {
  const items = [["Aktive Einsätze", stats.activeCalls], ["Patienten", stats.patients], ["Kritische Patienten", stats.criticalPatients], ["Freie Betten", stats.freeBeds], ["Fahrzeuge im Einsatz", stats.vehiclesOnCall], ["Mitarbeiter im Dienst", stats.staffOnDuty], ["Aktive Funkkanäle", stats.activeChannels], ["Offene Rechnungen", stats.openInvoices]] as const;
  const max = Math.max(1, ...items.map(([, value]) => value));
  return <section className="panel statistics-panel"><div className="panel-head"><div><h2><Activity size={18} /> Organisationskennzahlen</h2><p>Aktueller Datenbestand</p></div></div>{items.map(([label, value]) => <div className="bar-row" key={label}><span>{label}</span><div className="bar-track"><i style={{ width: `${Math.round(value / max * 100)}%` }} /></div><b>{value}</b></div>)}</section>;
}

function RadioView({ channels, selected, onSelect, body, setBody, demo, onSend }: { channels: RecordItem[]; selected: string; onSelect: (id: string) => void; body: string; setBody: (body: string) => void; demo: boolean; onSend: (event: FormEvent) => void }) {
  const [messages, setMessages] = useState<RecordItem[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [messageError, setMessageError] = useState("");
  useEffect(() => {
    if (!selected && channels[0]) onSelect(channels[0]._id);
  }, [channels, selected, onSelect]);
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setMessageError("");
        setMessages(demo ? demoList("radio_messages") : await api.list("radio_messages"));
      } catch (err) {
        setMessageError(err instanceof Error ? err.message : "Funknachrichten konnten nicht geladen werden.");
      }
    };
    void loadMessages();
    const timer = window.setInterval(() => { void loadMessages(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [demo, selected]);
  const channelMessages = messages.filter((message) => message.channelId === selected);
  return <div className="radio-layout"><section className="panel channel-list"><div className="panel-head"><div><h2><Radio size={17} /> Funkkanäle</h2><p>{channels.length} Kanäle</p></div><span className="live-label"><span className={`state-dot ${demo ? "dot-offline" : ""}`} />{demo ? "DEMO" : "REST"}</span></div>{channels.map((channel) => <button key={channel._id} onClick={() => onSelect(channel._id)} className={`channel-option ${selected === channel._id ? "channel-selected" : ""}`}><span className="state-dot" /><span><b>{display(channel.name)}</b><small>{display(channel.description)} · {display(channel.participants || (channel._id === selected ? participants : []))} online</small></span><ChevronRight size={15} /></button>)}</section><section className="panel radio-chat"><div className="panel-head"><div><h2>{display(channels.find((channel) => channel._id === selected)?.name || "Kanal auswählen")}</h2><p>{demo ? "Isolierter Demo-Chat" : "Aktualisierung über REST im 10-Sekunden-Takt"}</p></div><span className="live-label"><span className={`state-dot ${demo ? "dot-offline" : ""}`} />{demo ? "DEMO" : "REST"}</span></div>{messageError && <div className="error-banner">{messageError}</div>}<div className="chat-messages">{channelMessages.map((message) => <article className="chat-message" key={message._id}><div className="avatar avatar-sm">{display(message.sender).slice(0, 1)}</div><div><b>{display(message.sender)} <small>{dateDisplay(message.createdAt)}</small></b><p>{display(message.body)}</p></div></article>)}{channelMessages.length === 0 && <Empty title="Noch keine Nachrichten" body="Schreibe die erste Nachricht in diesem Kanal." />}</div><form className="chat-form" onSubmit={onSend}><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Funknachricht verfassen…" required /><button className="button-primary" disabled={!selected || !body.trim()}><MessageCircle size={16} /> Senden</button></form></section></div>;
}

function AdminPage({ rows, demo, isAdmin }: { rows: RecordItem[]; demo: boolean; isAdmin: boolean }) {
  const [prices, setPrices] = useState<RecordItem[]>([]);
  const [priceModal, setPriceModal] = useState(false);
  const [editPrice, setEditPrice] = useState<RecordItem | undefined>();
  const [priceError, setPriceError] = useState("");
  const reloadPrices = useCallback(async () => {
    try {
      setPrices(demo ? demoList("price_catalog") : await api.list("price_catalog"));
      setPriceError("");
    } catch (err) { setPriceError(err instanceof Error ? err.message : "Preise konnten nicht geladen werden."); }
  }, [demo]);
  useEffect(() => { void reloadPrices(); }, [reloadPrices]);
  async function savePrice(values: Record<string, unknown>) {
    if (!isAdmin) return;
    try {
      if (demo) demoSave("price_catalog", values, editPrice?._id);
      else if (editPrice) await api.update("price_catalog", editPrice._id, values);
      else await api.create("price_catalog", values);
      setPriceModal(false);
      await reloadPrices();
    } catch (err) { setPriceError(err instanceof Error ? err.message : "Preis konnte nicht gespeichert werden."); }
  }
  return <div className="admin-grid"><section className="panel data-panel"><div className="panel-toolbar"><div><h2><Shield size={17} /> Aktivitätsprotokoll</h2><p>Wichtige Aktionen werden nachvollziehbar protokolliert.</p></div></div><div className="table-wrap"><table><thead><tr><th>Person / Akteur</th><th>Aktion</th><th>Bereich</th><th>Zeitpunkt</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id}><td><b>{display(row.actor)}</b></td><td>{display(row.action)}</td><td>{display(row.entity)}</td><td>{dateDisplay(row.createdAt)}</td></tr>)}</tbody></table>{!rows.length && <Empty title="Noch keine protokollierten Aktionen" body="Änderungen an den MEDCNET-Daten erscheinen hier." />}</div></section>{isAdmin && <section className="panel data-panel admin-prices"><div className="panel-toolbar"><div><h2><FileText size={17} /> Preiskatalog</h2><p>Leistungspreise für Rechnungen verwalten</p></div><button className="button-primary" onClick={() => { setEditPrice(undefined); setPriceModal(true); }}><Plus size={15} /> Preis</button></div>{priceError && <div className="error-banner">{priceError}</div>}{prices.map((price) => <div className="price-row" key={price._id}><div><b>{display(price.name)}</b><small>{price.active === false ? "Inaktiv" : "Aktiv"}</small></div><b>{formatter.format(Number(price.amountCents || 0) / 100)}</b><button className="action-button" onClick={() => { setEditPrice(price); setPriceModal(true); }}>Bearbeiten</button></div>)}</section>}{priceModal && isAdmin && <RecordModal resource="price_catalog" initial={editPrice} demo={demo} onClose={() => setPriceModal(false)} onSave={(values) => void savePrice(values)} />}</div>;
}

function Profile({ user, demo, onNameChange }: { user: User; demo: boolean; onNameChange: (name: string) => void }) {
  const [profile, setProfile] = useState<RecordItem>({ _id: user.sub, displayName: user.name, role: user.role, discordId: user.discordId, department: "", dutyStatus: "Außer Dienst" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    if (demo) {
      try {
        const saved = localStorage.getItem("medcnet-demo-profile-v1");
        if (saved) setProfile((current) => ({ ...current, ...JSON.parse(saved) }));
      } catch { setError("Demo-Profil konnte nicht geladen werden. Bitte Demo-Daten zurücksetzen."); }
    } else {
      api.profile().then(({ profile: item }) => setProfile(item)).catch((err: unknown) => setError(err instanceof Error ? err.message : "Profil konnte nicht geladen werden."));
    }
  }, [demo, user.sub]);
  async function update(event: FormEvent) {
    event.preventDefault();
    try {
      const values = { displayName: String(profile.displayName || ""), department: String(profile.department || ""), dutyStatus: String(profile.dutyStatus || "Außer Dienst") };
      if (demo) localStorage.setItem("medcnet-demo-profile-v1", JSON.stringify(values));
      else await api.updateProfile(values);
      onNameChange(values.displayName);
      setSaved("Profil gespeichert.");
      window.setTimeout(() => setSaved(""), 2500);
    } catch (err) { setError(err instanceof Error ? err.message : "Profil konnte nicht gespeichert werden."); }
  }
  return <section className="profile-grid"><div className="panel profile-hero"><div className="profile-avatar">{String(profile.displayName || user.name).slice(0, 1)}</div><h2>{display(profile.displayName || user.name)}</h2><Status value={display(profile.role || user.role)} /><p>{demo ? "Fiktives Demo-Profil" : `Discord-ID ${display(profile.discordId || user.discordId)}`}</p></div><form className="panel profile-details" onSubmit={update}><h2>Kontodetails</h2><label className="profile-field">Name<input value={display(profile.displayName)} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} /></label><label className="profile-field">Abteilung<input value={display(profile.department)} onChange={(event) => setProfile((current) => ({ ...current, department: event.target.value }))} /></label><label className="profile-field">Dienststatus<select value={display(profile.dutyStatus)} onChange={(event) => setProfile((current) => ({ ...current, dutyStatus: event.target.value }))}><option>Dienst</option><option>Pause</option><option>Außer Dienst</option></select></label><div className="detail-pair"><span>Rolle (nur Admin)</span><b>{display(profile.role || user.role)}</b></div><div className="detail-pair"><span>Dienstnummer</span><b>{display(profile.serviceNumber)}</b></div>{error && <div className="error-banner">{error}</div>}{saved && <p className="saved-note">{saved}</p>}<button className="button-primary" type="submit"><Check size={15} /> Profil speichern</button></form></section>;
}

function SettingsPage({ demo }: { demo: boolean }) {
  return <section className="panel settings-page"><div className="panel-head"><div><h2><Settings size={17} /> Systemkonfiguration</h2><p>Verbindungsstatus und Deployment-Informationen</p></div></div><div className="detail-pair"><span>Speichermodus</span><b>{demo ? "Getrennter lokaler Demo-Speicher" : "MongoDB Atlas über MEDCNET API"}</b></div><div className="detail-pair"><span>Authentifizierung</span><b>{demo ? "Nur lokale Demo-Sitzung" : "Discord OAuth2 · signierte HttpOnly-JWT-Session"}</b></div><div className="detail-pair"><span>Live-Funk</span><b>{demo ? "Lokale Demo-Nachrichten" : "REST-Aktualisierung über serverlose API"}</b></div><div className="detail-pair"><span>Deployment</span><b>{demo ? "Nicht mit Produktivdaten verbunden" : "Vercel Functions · MongoDB Atlas"}</b></div></section>;
}

function RecordModal({ resource, initial, demo, onClose, onSave }: { resource: Resource; initial?: RecordItem; demo: boolean; onClose: () => void; onSave: (values: Record<string, unknown>) => void }) {
  const config = fields[resource] || [];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(config.map((field) => {
    let value = initial?.[field.key];
    if (resource === "invoices" && field.key === "serviceNames" && Array.isArray(initial?.services)) {
      value = initial.services.map((service) => typeof service === "object" && service !== null ? (service as { name?: string }).name : "").filter(Boolean);
    }
    if (resource === "price_catalog" && field.key === "amountEur" && typeof initial?.amountCents === "number") value = initial.amountCents / 100;
    if (resource === "price_catalog" && field.key === "active" && typeof value === "boolean") value = value ? "Ja" : "Nein";
    return [field.key, Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value)];
  })));
  const [prices, setPrices] = useState<RecordItem[]>([]);
  const [patients, setPatients] = useState<RecordItem[]>([]);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    if (resource === "invoices") {
      if (demo) setPrices(demoList("price_catalog"));
      else api.list("price_catalog").then(setPrices).catch((err: unknown) => setFormError(err instanceof Error ? err.message : "Preiskatalog konnte nicht geladen werden."));
    }
    if (resource === "vitals") {
      if (demo) setPatients(demoList("patients"));
      else api.list("patients").then(setPatients).catch((err: unknown) => setFormError(err instanceof Error ? err.message : "Patienten konnten nicht geladen werden."));
    }
  }, [demo, resource]);
  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const payload: Record<string, unknown> = {};
    for (const field of config) {
      let value: unknown = values[field.key] || (field.type === "select" ? field.options?.[0] : "");
      if (resource === "price_catalog" && field.key === "active") value = value === "Ja";
      if (value === "") continue;
      if (field.type === "number" && value !== "") value = Number(value);
      if (["allergies", "crew", "serviceNames", "permissions"].includes(field.key)) value = String(value).split(",").map((item) => item.trim()).filter(Boolean);
      payload[field.key] = value;
    }
    if (resource === "vitals") {
      const pulse = Number(payload.pulse), respiration = Number(payload.respiratoryRate), oxygen = Number(payload.oxygenSaturation);
      const temperature = Number(payload.temperature);
      const systolic = Number(String(payload.bloodPressure).split("/")[0]);
      payload.classification = pulse > 120 || oxygen < 90 || respiration > 25 || temperature >= 40 || systolic < 90 || systolic > 200
        ? "Kritisch"
        : pulse > 100 || pulse < 50 || oxygen < 95 || respiration > 20 || temperature >= 38 || systolic < 100
          ? "Warnung" : "Normal";
      payload.recordedAt = new Date().toISOString();
      payload.patientName = display(patients.find((patient) => patient._id === String(payload.patientId))?.name);
    }
    if (resource === "patients") {
      if (!initial && payload.status !== "Entlassen") payload.admittedAt = new Date().toISOString();
      if (payload.status === "Entlassen") payload.dischargedAt = new Date().toISOString();
    }
    if (resource === "invoices") {
      const names = payload.serviceNames as string[] || [];
      const selected = names.map((name) => prices.find((price) => String(price.name).toLowerCase() === name.toLowerCase() && price.active !== false));
      if (!names.length || selected.some((price) => !price)) {
        setFormError("Wähle ausschließlich aktive Leistungen aus dem Preiskatalog aus.");
        return;
      }
      const services = selected.filter((price): price is RecordItem => Boolean(price)).map((price) => ({ name: String(price.name), amountCents: Number(price.amountCents) }));
      payload.services = services;
      payload.amountCents = services.reduce((total, service) => total + service.amountCents, 0);
      payload.invoiceNumber = `2026-${String(Date.now()).slice(-5)}`;
      delete payload.serviceNames;
    }
    if (resource === "price_catalog") {
      payload.amountCents = Math.round(Number(payload.amountEur || 0) * 100);
      payload.active = payload.active === "Ja";
      delete payload.amountEur;
    }
    onSave(payload);
  }
  const invoiceNames = (values.serviceNames || "").split(",").map((name) => name.trim()).filter(Boolean);
  const invoiceTotal = invoiceNames.reduce((sum, name) => sum + Number(prices.find((price) => String(price.name).toLowerCase() === name.toLowerCase())?.amountCents || 0), 0);
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Schließen" onClick={onClose}><X size={18} /></button><div className="eyebrow">MEDCNET · {resource.toUpperCase()}</div><h2>{initial ? "Eintrag bearbeiten" : resource === "calls" ? "Neuen Einsatz erstellen" : resource === "patients" ? "Patient aufnehmen" : `Eintrag anlegen`}</h2><div className="form-grid">{config.map((field) => <label key={field.key} className={field.type === "textarea" ? "field-wide" : ""}>{field.label}{field.key === "patientId" && resource === "vitals" ? <select required value={values[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)}><option value="">Patient auswählen …</option>{patients.filter((patient) => patient.status !== "Entlassen").map((patient) => <option key={patient._id} value={patient._id}>{display(patient.name)} · {display(patient.room || patient._id.slice(-6))}</option>)}</select> : field.type === "select" ? <select value={values[field.key] || field.options?.[0] || ""} onChange={(event) => setValue(field.key, event.target.value)}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea value={values[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)} rows={3} /> : <input type={field.type || "text"} step={field.key === "temperature" ? "0.1" : field.type === "number" ? "1" : undefined} required={field.required} value={values[field.key] || ""} onChange={(event) => setValue(field.key, event.target.value)} />}</label>)}</div>{resource === "invoices" && <p className="invoice-estimate">Berechnete Gesamtsumme: <b>{formatter.format(invoiceTotal / 100)}</b></p>}{formError && <div className="error-banner">{formError}</div>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Abbrechen</button><button type="submit" className="button-primary"><Check size={16} /> Speichern</button></div></form></div>;
}

function Status({ value }: { value: string }) {
  const tone = /kritisch|p1|einsatz|abgebrochen/i.test(value) ? "status-red" : /frei|normal|bezahlt|abgeschlossen|dienst|aktiv/i.test(value) ? "status-green" : /p2|warnung|fahrt|beobachtung|reserviert|pause|offen/i.test(value) ? "status-yellow" : "status-muted";
  return <span className={`status-pill ${tone}`}><i />{value}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><span><ClipboardList size={19} /></span><b>{title}</b><p>{body}</p></div>;
}

export default App;
