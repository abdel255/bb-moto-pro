import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ─── Supabase Client ───
const SUPABASE_URL = "https://ysihfkrkqwyhahejbwzf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzaWhma3JrcXd5aGFoZWpid3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDk1NDcsImV4cCI6MjA5MDkyNTU0N30.OXoYLIz_tkkDzTPsIrNoUtpipeOfD4p2M-DP2MQmo6A";

const supabase = {
  headers: (token) => ({
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  }),
  async query(table, { select = "*", filters = "", order = "", token, single = false } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    if (filters) url += `&${filters}`;
    if (order) url += `&order=${order}`;
    const res = await fetch(url, { headers: this.headers(token) });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return single ? data[0] : data;
  },
  async insert(table, body, token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: this.headers(token), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async update(table, body, filters, token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
      method: "PATCH", headers: this.headers(token), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async remove(table, filters, token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
      method: "DELETE", headers: this.headers(token),
    });
    if (!res.ok) throw new Error(await res.text());
  },
  async rpc(fn, args, token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: this.headers(token), body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return res.json();
  },
  async signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Sign up failed");
    return res.json();
  },
};

// ─── Icons (inline SVG) ───
const Icon = ({ d, size = 20, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{typeof d === "string" ? <path d={d} /> : d}</svg>
);
const Icons = {
  dashboard: <Icon d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />,
  scooter: <Icon d={<><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M5 16.5h3l4-8h4l3 8"/><path d="M12 8.5V5h3"/></>} />,
  contract: <Icon d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>} />,
  clients: <Icon d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />,
  money: <Icon d={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>} />,
  expense: <Icon d={<><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><line x1="2" y1="12" x2="6" y2="8"/></>} />,
  cash: <Icon d={<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M2 10h2M20 10h2M2 14h2M20 14h2"/></>} />,
  alert: <Icon d={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>} />,
  logout: <Icon d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />,
  plus: <Icon d="M12 5v14M5 12h14" />,
  search: <Icon d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>} />,
  x: <Icon d="M18 6L6 18M6 6l12 12" />,
  check: <Icon d="M20 6L9 17l-5-5" />,
  edit: <Icon d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>} />,
  trash: <Icon d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>} />,
  ban: <Icon d={<><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>} />,
  chevDown: <Icon d="M6 9l6 6 6-6" size={16} />,
  calendar: <Icon d={<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>} />,
  fuel: <Icon d={<><path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M13 10h4a2 2 0 0 1 2 2v6a1 1 0 0 0 1 1 1 1 0 0 0 1-1V9l-3-3"/><rect x="5" y="8" width="6" height="5" rx="1"/></>} />,
};

// ─── Helpers ───
const fmt = (n) => new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "—";
const daysBetween = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));
const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

// ─── Styles ───
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap');

:root {
  --bg: #0A0C10;
  --surface: #12151C;
  --surface2: #1A1E28;
  --border: #252A36;
  --border2: #333A4A;
  --text: #E8ECF4;
  --text2: #8B95A8;
  --text3: #5A6478;
  --accent: #F97316;
  --accent2: #FB923C;
  --accent-bg: rgba(249,115,22,0.1);
  --green: #22C55E;
  --green-bg: rgba(34,197,94,0.1);
  --red: #EF4444;
  --red-bg: rgba(239,68,68,0.1);
  --blue: #3B82F6;
  --blue-bg: rgba(59,130,246,0.1);
  --yellow: #EAB308;
  --yellow-bg: rgba(234,179,8,0.1);
  --purple: #A855F7;
  --purple-bg: rgba(168,85,247,0.1);
  --radius: 10px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --font: 'DM Sans', sans-serif;
  --mono: 'Space Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: var(--font); }
input, select, textarea, button { font-family: inherit; }

.app { display: flex; min-height: 100vh; }

/* Sidebar */
.sidebar {
  width: 240px; min-height: 100vh; background: var(--surface);
  border-right: 1px solid var(--border); display: flex; flex-direction: column;
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 100;
}
.sidebar-brand {
  padding: 24px 20px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 12px;
}
.sidebar-brand .logo {
  width: 40px; height: 40px; background: var(--accent);
  border-radius: 10px; display: grid; place-items: center;
  font-family: var(--mono); font-weight: 700; font-size: 14px; color: #fff;
}
.sidebar-brand h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
.sidebar-brand span { font-size: 11px; color: var(--text2); display: block; margin-top: 1px; }
.sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  border-radius: 8px; cursor: pointer; color: var(--text2);
  font-size: 13.5px; font-weight: 500; transition: all 0.15s;
  border: 1px solid transparent; position: relative;
}
.nav-item:hover { background: var(--surface2); color: var(--text); }
.nav-item.active {
  background: var(--accent-bg); color: var(--accent);
  border-color: rgba(249,115,22,0.2);
}
.nav-item .badge {
  position: absolute; right: 10px; background: var(--red);
  color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px;
  border-radius: 10px; min-width: 18px; text-align: center;
}
.sidebar-footer {
  padding: 16px; border-top: 1px solid var(--border);
}
.sidebar-footer button {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; color: var(--text2); font-size: 13px;
  cursor: pointer; transition: all 0.15s;
}
.sidebar-footer button:hover { border-color: var(--red); color: var(--red); }

/* Main */
.main { flex: 1; margin-left: 240px; }
.topbar {
  height: 60px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; background: var(--surface); position: sticky; top: 0; z-index: 50;
}
.topbar h2 { font-size: 17px; font-weight: 600; letter-spacing: -0.3px; }
.topbar-actions { display: flex; align-items: center; gap: 10px; }
.content { padding: 24px 28px; }

/* Cards / Stats */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
.stat-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 18px 20px; position: relative; overflow: hidden;
}
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
}
.stat-card.orange::before { background: var(--accent); }
.stat-card.green::before { background: var(--green); }
.stat-card.blue::before { background: var(--blue); }
.stat-card.red::before { background: var(--red); }
.stat-card.purple::before { background: var(--purple); }
.stat-card.yellow::before { background: var(--yellow); }
.stat-card .label { font-size: 11.5px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; }
.stat-card .value { font-size: 26px; font-weight: 700; font-family: var(--mono); margin-top: 6px; letter-spacing: -1px; }
.stat-card .sub { font-size: 12px; color: var(--text2); margin-top: 4px; }

/* Tables */
.table-wrap {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
}
.table-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border); gap: 12px; flex-wrap: wrap;
}
.search-box {
  display: flex; align-items: center; gap: 8px; background: var(--surface2);
  border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; flex: 1; max-width: 320px;
}
.search-box input {
  border: none; background: transparent; color: var(--text); font-size: 13px;
  outline: none; width: 100%;
}
.search-box input::placeholder { color: var(--text3); }
table { width: 100%; border-collapse: collapse; }
th {
  text-align: left; padding: 10px 18px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.8px; color: var(--text3);
  background: var(--surface2); border-bottom: 1px solid var(--border);
}
td {
  padding: 12px 18px; font-size: 13.5px; border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.015); }

/* Badges */
.badge-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
  border-radius: 20px; font-size: 11.5px; font-weight: 600;
}
.badge-green { background: var(--green-bg); color: var(--green); }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-blue { background: var(--blue-bg); color: var(--blue); }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-orange { background: var(--accent-bg); color: var(--accent); }
.badge-purple { background: var(--purple-bg); color: var(--purple); }
.badge-gray { background: var(--surface2); color: var(--text2); }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid transparent; transition: all 0.15s; white-space: nowrap;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent2); }
.btn-secondary { background: var(--surface2); color: var(--text); border-color: var(--border); }
.btn-secondary:hover { border-color: var(--text3); }
.btn-danger { background: var(--red-bg); color: var(--red); border-color: rgba(239,68,68,0.2); }
.btn-danger:hover { background: var(--red); color: #fff; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-icon {
  width: 32px; height: 32px; padding: 0; display: grid; place-items: center;
  border-radius: 8px; border: 1px solid var(--border); background: transparent;
  color: var(--text2); cursor: pointer; transition: all 0.15s;
}
.btn-icon:hover { border-color: var(--text3); color: var(--text); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  z-index: 200; display: grid; place-items: center; padding: 20px;
}
.modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  width: 100%; max-width: 540px; max-height: 85vh; overflow-y: auto;
  box-shadow: var(--shadow);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px; border-bottom: 1px solid var(--border);
}
.modal-header h3 { font-size: 16px; font-weight: 600; }
.modal-body { padding: 22px; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 22px; border-top: 1px solid var(--border);
}

/* Forms */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 9px 13px; background: var(--surface2);
  border: 1px solid var(--border); border-radius: 8px; color: var(--text);
  font-size: 13.5px; outline: none; transition: border-color 0.15s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--accent); }
.form-group select { appearance: none; cursor: pointer; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

/* Detail panels */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.detail-section {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
}
.detail-section h4 {
  font-size: 13px; font-weight: 600; color: var(--text2);
  text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border);
}
.detail-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13.5px; }
.detail-row .dl { color: var(--text3); }
.detail-row .dv { font-weight: 500; }

/* Charts */
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px; }
.chart-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
}
.chart-card h4 { font-size: 13px; font-weight: 600; color: var(--text2); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.6px; }

/* Alerts list */
.alert-item {
  display: flex; align-items: center; gap: 14px; padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.alert-item:last-child { border-bottom: none; }
.alert-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.alert-dot.red { background: var(--red); }
.alert-dot.yellow { background: var(--yellow); }
.alert-dot.orange { background: var(--accent); }
.alert-info { flex: 1; }
.alert-info .alert-msg { font-size: 13.5px; }
.alert-info .alert-meta { font-size: 11.5px; color: var(--text3); margin-top: 2px; }

/* Tabs */
.tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--surface); padding: 4px; border-radius: 10px; border: 1px solid var(--border); width: fit-content; }
.tab-btn {
  padding: 7px 16px; border-radius: 7px; border: none; background: transparent;
  color: var(--text2); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.tab-btn.active { background: var(--accent); color: #fff; }

/* Login */
.login-page {
  min-height: 100vh; display: grid; place-items: center;
  background: var(--bg);
  background-image: radial-gradient(ellipse at 30% 20%, rgba(249,115,22,0.08) 0%, transparent 60%),
                    radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05) 0%, transparent 60%);
}
.login-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 40px; width: 100%; max-width: 400px;
  box-shadow: var(--shadow);
}
.login-card .logo-big {
  width: 56px; height: 56px; background: var(--accent); border-radius: 14px;
  display: grid; place-items: center; font-family: var(--mono); font-weight: 700;
  font-size: 18px; color: #fff; margin: 0 auto 20px;
}
.login-card h2 { text-align: center; font-size: 22px; margin-bottom: 4px; }
.login-card .sub { text-align: center; color: var(--text2); font-size: 14px; margin-bottom: 28px; }
.login-card .err { background: var(--red-bg); color: var(--red); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }

/* Empty state */
.empty { text-align: center; padding: 48px 20px; color: var(--text3); }
.empty .empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.3; }
.empty p { font-size: 14px; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* Responsive */
@media (max-width: 900px) {
  .sidebar { display: none; }
  .main { margin-left: 0; }
  .chart-grid, .detail-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .form-row { grid-template-columns: 1fr; }
}

/* Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.content > * { animation: fadeIn 0.3s ease; }
.modal { animation: fadeIn 0.2s ease; }
`;

// ─── Modal Component ───
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}>{Icons.x}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ─── SVG Charts ───
function BarChart({ data, width = 420, height = 200, color = "var(--accent)" }) {
  if (!data?.length) return <div className="empty"><p>No data</p></div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min(36, (width - 60) / data.length - 6);
  const chartH = height - 40;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxHeight: height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1="40" y1={10 + chartH * (1 - f)} x2={width - 10} y2={10 + chartH * (1 - f)} stroke="var(--border)" strokeWidth="1" />
          <text x="36" y={14 + chartH * (1 - f)} textAnchor="end" fill="var(--text3)" fontSize="10" fontFamily="var(--mono)">{Math.round(max * f)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = 50 + i * ((width - 60) / data.length);
        const h = (d.value / max) * chartH;
        return (
          <g key={i}>
            <rect x={x} y={10 + chartH - h} width={barW} height={h} rx="4" fill={d.color || color} opacity="0.85" />
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fill="var(--text3)" fontSize="10" fontFamily="var(--mono)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data, size = 180 }) {
  if (!data?.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 60, cx = size / 2, cy = size / 2, stroke = 22;
  let cum = 0;
  const segments = data.map((d) => {
    const frac = d.value / total;
    const startAngle = cum * 2 * Math.PI - Math.PI / 2;
    cum += frac;
    const endAngle = cum * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    return { ...d, path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}` };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="round" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text)" fontSize="20" fontWeight="700" fontFamily="var(--mono)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text3)" fontSize="10">TOTAL</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text2)" }}>{d.label}</span>
            <span style={{ fontWeight: 600, marginLeft: "auto", fontFamily: "var(--mono)" }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SparkLine({ data, width = 200, height = 50, color = "var(--accent)" }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 6 - ((v - min) / range) * (height - 12)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxHeight: height }}>
      <defs>
        <linearGradient id={`sg_${color.replace(/[^a-z]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#sg_${color.replace(/[^a-z]/g, "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── LOGIN ───
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");

  const handleSubmit = async () => {
    setErr(""); setLoading(true);
    try {
      const data = mode === "login" ? await supabase.signIn(email, pass) : await supabase.signUp(email, pass);
      if (data.access_token) onLogin(data);
      else setErr("Check your email to confirm signup.");
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo-big">BB</div>
        <h2>BB MOTO Tanger</h2>
        <p className="sub">Fleet Management System</p>
        {err && <div className="err">{err}</div>}
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@bbmoto.ma" />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "11px 16px" }} onClick={handleSubmit} disabled={loading}>
          {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text3)" }}>
          {mode === "login" ? "No account? " : "Have an account? "}
          <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [vehicles, setVehicles] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashOps, setCashOps] = useState([]);
  const [clients, setClients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [detailVehicle, setDetailVehicle] = useState(null);
  const [detailClient, setDetailClient] = useState(null);

  const token = session?.access_token;

  // ─── Fetch all data ───
  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [v, c, r, e, co, cl, al, res] = await Promise.all([
        supabase.query("vehicles", { order: "created_at.desc", token }),
        supabase.query("contracts", { order: "created_at.desc", token }),
        supabase.query("revenue", { order: "created_at.desc", token }),
        supabase.query("expenses", { order: "created_at.desc", token }),
        supabase.query("cash_operations", { order: "created_at.desc", token }),
        supabase.query("clients", { order: "created_at.desc", token }).catch(() => []),
        supabase.query("alerts", { order: "created_at.desc", token }).catch(() => []),
        supabase.query("reservations", { order: "created_at.desc", token }).catch(() => []),
      ]);
      setVehicles(v); setContracts(c); setRevenue(r); setExpenses(e);
      setCashOps(co); setClients(cl); setAlerts(al); setReservations(res);
    } catch (err) { console.error("Fetch error:", err); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Auto-create revenue on contract creation ───
  const createContractWithRevenue = async (contractData) => {
    const days = daysBetween(contractData.start_date, contractData.end_date);
    const totalAmount = days * (contractData.daily_rate || 0);
    const [newContract] = await supabase.insert("contracts", { ...contractData, total_amount: totalAmount, status: "active" }, token);
    await supabase.insert("revenue", {
      contract_id: newContract.id,
      amount: totalAmount,
      type: "rental",
      description: `Rental: ${contractData.client_name || "Client"} — ${days}d × ${fmt(contractData.daily_rate)}`,
      date: contractData.start_date,
      vehicle_id: contractData.vehicle_id,
    }, token);
    if (contractData.vehicle_id) {
      await supabase.update("vehicles", { status: "rented" }, `id=eq.${contractData.vehicle_id}`, token);
    }
    fetchAll();
  };

  // ─── Generate alerts ───
  const computedAlerts = useMemo(() => {
    const a = [];
    vehicles.forEach((v) => {
      const insExp = daysFromNow(v.insurance_expiry);
      if (insExp !== null && insExp <= 30) {
        a.push({ type: insExp <= 0 ? "red" : insExp <= 7 ? "orange" : "yellow", msg: `${v.brand} ${v.model} — Insurance ${insExp <= 0 ? "EXPIRED" : `expires in ${insExp}d`}`, vehicle: v.id, date: v.insurance_expiry });
      }
      if (v.mileage && v.mileage > 20000) {
        a.push({ type: "yellow", msg: `${v.brand} ${v.model} — High mileage: ${v.mileage?.toLocaleString()} km`, vehicle: v.id });
      }
    });
    contracts.forEach((c) => {
      if (c.status === "active" && new Date(c.end_date) < new Date()) {
        a.push({ type: "red", msg: `Overdue contract: ${c.client_name || "Client"} — ended ${fmtDate(c.end_date)}`, contract: c.id });
      }
    });
    return a;
  }, [vehicles, contracts]);

  const allAlerts = [...computedAlerts, ...alerts.map((a) => ({ type: a.severity || "yellow", msg: a.message, date: a.created_at }))];

  if (!session) return (<><style>{css}</style><LoginPage onLogin={setSession} /></>);

  // ─── NAV ITEMS ───
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "vehicles", label: "Fleet", icon: Icons.scooter, count: vehicles.length },
    { id: "contracts", label: "Contracts", icon: Icons.contract, count: contracts.filter((c) => c.status === "active").length },
    { id: "clients", label: "Clients", icon: Icons.clients, count: clients.length },
    { id: "revenue", label: "Revenue", icon: Icons.money },
    { id: "expenses", label: "Expenses", icon: Icons.expense },
    { id: "cash", label: "Cash Tracking", icon: Icons.cash },
    { id: "alerts", label: "Alerts", icon: Icons.alert, badge: allAlerts.filter((a) => a.type === "red").length || null },
  ];

  // ─── DASHBOARD ───
  const renderDashboard = () => {
    const totalRevenue = revenue.reduce((s, r) => s + (r.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const activeContracts = contracts.filter((c) => c.status === "active").length;
    const availableVehicles = vehicles.filter((v) => v.status === "available").length;
    const totalCashIn = cashOps.filter((c) => c.type === "in").reduce((s, c) => s + (c.amount || 0), 0);
    const totalCashOut = cashOps.filter((c) => c.type === "out").reduce((s, c) => s + (c.amount || 0), 0);

    // Monthly revenue data
    const monthlyRev = {};
    revenue.forEach((r) => {
      const m = (r.date || r.created_at || "").slice(0, 7);
      if (m) monthlyRev[m] = (monthlyRev[m] || 0) + (r.amount || 0);
    });
    const monthLabels = Object.keys(monthlyRev).sort().slice(-6);
    const barData = monthLabels.map((m) => ({ label: m.slice(5), value: monthlyRev[m] }));

    // Vehicle status donut
    const statusCounts = { available: 0, rented: 0, maintenance: 0 };
    vehicles.forEach((v) => { statusCounts[v.status] = (statusCounts[v.status] || 0) + 1; });
    const donutData = [
      { label: "Available", value: statusCounts.available, color: "var(--green)" },
      { label: "Rented", value: statusCounts.rented, color: "var(--accent)" },
      { label: "Maintenance", value: statusCounts.maintenance, color: "var(--yellow)" },
    ];

    // Daily revenue spark
    const dailyRev = {};
    revenue.slice(0, 30).forEach((r) => {
      const d = (r.date || r.created_at || "").slice(0, 10);
      if (d) dailyRev[d] = (dailyRev[d] || 0) + (r.amount || 0);
    });
    const sparkData = Object.keys(dailyRev).sort().map((k) => dailyRev[k]);

    return (
      <>
        <div className="stats-grid">
          <div className="stat-card orange"><div className="label">Total Revenue</div><div className="value">{fmt(totalRevenue)}</div><SparkLine data={sparkData} color="var(--accent)" /></div>
          <div className="stat-card red"><div className="label">Total Expenses</div><div className="value">{fmt(totalExpenses)}</div><div className="sub">Net: {fmt(totalRevenue - totalExpenses)}</div></div>
          <div className="stat-card green"><div className="label">Active Contracts</div><div className="value">{activeContracts}</div><div className="sub">{contracts.length} total</div></div>
          <div className="stat-card blue"><div className="label">Available Vehicles</div><div className="value">{availableVehicles}</div><div className="sub">of {vehicles.length} total</div></div>
          <div className="stat-card purple"><div className="label">Clients</div><div className="value">{clients.length}</div><div className="sub">{clients.filter((c) => c.is_blacklisted).length} blacklisted</div></div>
          <div className="stat-card yellow"><div className="label">Cash Balance</div><div className="value">{fmt(totalCashIn - totalCashOut)}</div><div className="sub">In: {fmt(totalCashIn)} / Out: {fmt(totalCashOut)}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card">
            <h4>Monthly Revenue</h4>
            <BarChart data={barData} />
          </div>
          <div className="chart-card">
            <h4>Fleet Status</h4>
            <DonutChart data={donutData} />
          </div>
        </div>
        {allAlerts.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 24 }}>
            <div className="table-toolbar"><h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Recent Alerts</h4></div>
            {allAlerts.slice(0, 5).map((a, i) => (
              <div className="alert-item" key={i}>
                <div className={`alert-dot ${a.type}`} />
                <div className="alert-info">
                  <div className="alert-msg">{a.msg}</div>
                  {a.date && <div className="alert-meta">{fmtDate(a.date)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ─── VEHICLES ───
  const VehicleForm = ({ initial, onSave }) => {
    const [f, setF] = useState(initial || { brand: "", model: "", plate: "", status: "available", daily_rate: "", year: "", fuel_type: "petrol", color: "", mileage: "", insurance_expiry: "" });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
      <>
        <div className="form-row">
          <div className="form-group"><label>Brand</label><input value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Honda" /></div>
          <div className="form-group"><label>Model</label><input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="PCX 125" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Plate</label><input value={f.plate} onChange={(e) => set("plate", e.target.value)} placeholder="12345-A-1" /></div>
          <div className="form-group"><label>Daily Rate (MAD)</label><input type="number" value={f.daily_rate} onChange={(e) => set("daily_rate", e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Year</label><input type="number" value={f.year || ""} onChange={(e) => set("year", e.target.value)} placeholder="2023" /></div>
          <div className="form-group"><label>Fuel Type</label>
            <select value={f.fuel_type || "petrol"} onChange={(e) => set("fuel_type", e.target.value)}>
              <option value="petrol">Petrol</option><option value="electric">Electric</option><option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Color</label><input value={f.color || ""} onChange={(e) => set("color", e.target.value)} placeholder="Red" /></div>
          <div className="form-group"><label>Mileage (km)</label><input type="number" value={f.mileage || ""} onChange={(e) => set("mileage", e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Insurance Expiry</label><input type="date" value={f.insurance_expiry || ""} onChange={(e) => set("insurance_expiry", e.target.value)} /></div>
          <div className="form-group"><label>Status</label>
            <select value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="available">Available</option><option value="rented">Rented</option><option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(f)}>Save</button>
        </div>
      </>
    );
  };

  const renderVehicleDetail = (v) => {
    const vContracts = contracts.filter((c) => c.vehicle_id === v.id);
    const vRevenue = revenue.filter((r) => r.vehicle_id === v.id);
    const vAlerts = allAlerts.filter((a) => a.vehicle === v.id);
    const totalRev = vRevenue.reduce((s, r) => s + (r.amount || 0), 0);
    const insExp = daysFromNow(v.insurance_expiry);

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setDetailVehicle(null)}>← Back</button>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{v.brand} {v.model}</h3>
          <span className={`badge-pill ${v.status === "available" ? "badge-green" : v.status === "rented" ? "badge-orange" : "badge-yellow"}`}>{v.status}</span>
        </div>
        <div className="detail-grid">
          <div className="detail-section">
            <h4>Vehicle Info</h4>
            <div className="detail-row"><span className="dl">Plate</span><span className="dv">{v.plate}</span></div>
            <div className="detail-row"><span className="dl">Year</span><span className="dv">{v.year || "—"}</span></div>
            <div className="detail-row"><span className="dl">Color</span><span className="dv">{v.color || "—"}</span></div>
            <div className="detail-row"><span className="dl">Fuel</span><span className="dv">{v.fuel_type || "—"}</span></div>
            <div className="detail-row"><span className="dl">Mileage</span><span className="dv">{v.mileage ? `${v.mileage.toLocaleString()} km` : "—"}</span></div>
            <div className="detail-row"><span className="dl">Daily Rate</span><span className="dv">{fmt(v.daily_rate)}</span></div>
            <div className="detail-row"><span className="dl">Insurance Expiry</span><span className="dv" style={{ color: insExp !== null && insExp <= 7 ? "var(--red)" : "inherit" }}>{fmtDate(v.insurance_expiry)}{insExp !== null ? ` (${insExp}d)` : ""}</span></div>
          </div>
          <div className="detail-section">
            <h4>Performance</h4>
            <div className="detail-row"><span className="dl">Total Revenue</span><span className="dv" style={{ color: "var(--green)" }}>{fmt(totalRev)}</span></div>
            <div className="detail-row"><span className="dl">Total Contracts</span><span className="dv">{vContracts.length}</span></div>
            <div className="detail-row"><span className="dl">Active Contracts</span><span className="dv">{vContracts.filter((c) => c.status === "active").length}</span></div>
            {vAlerts.length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>Alerts</h4>
                {vAlerts.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                    <div className={`alert-dot ${a.type}`} />
                    <span style={{ fontSize: 13 }}>{a.msg}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        {vContracts.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 20 }}>
            <div className="table-toolbar"><h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>CONTRACT HISTORY</h4></div>
            <table>
              <thead><tr><th>Client</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {vContracts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.client_name || "—"}</td>
                    <td>{fmtDateShort(c.start_date)} → {fmtDateShort(c.end_date)}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{fmt(c.total_amount)}</td>
                    <td><span className={`badge-pill ${c.status === "active" ? "badge-green" : c.status === "completed" ? "badge-blue" : "badge-gray"}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderVehicles = () => {
    if (detailVehicle) return renderVehicleDetail(detailVehicle);
    const filtered = vehicles.filter((v) =>
      `${v.brand} ${v.model} ${v.plate}`.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="search-box">{Icons.search}<input placeholder="Search fleet..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={() => setModal("addVehicle")}>{Icons.plus} Add Vehicle</button>
        </div>
        <table>
          <thead><tr><th>Vehicle</th><th>Plate</th><th>Year</th><th>Rate/Day</th><th>Mileage</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => setDetailVehicle(v)}>
                <td style={{ fontWeight: 600 }}>{v.brand} {v.model}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>{v.plate}</td>
                <td>{v.year || "—"}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{fmt(v.daily_rate)}</td>
                <td>{v.mileage ? `${v.mileage.toLocaleString()} km` : "—"}</td>
                <td><span className={`badge-pill ${v.status === "available" ? "badge-green" : v.status === "rented" ? "badge-orange" : "badge-yellow"}`}>{v.status}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-icon" onClick={() => setModal({ type: "editVehicle", data: v })}>{Icons.edit}</button>
                    <button className="btn-icon" style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--red)" }} onClick={async () => { if (confirm("Delete this vehicle?")) { await supabase.remove("vehicles", `id=eq.${v.id}`, token); fetchAll(); } }}>{Icons.trash}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty"><p>No vehicles found</p></div>}
      </div>
    );
  };

  // ─── CONTRACTS ───
  const ContractForm = ({ initial, onSave }) => {
    const [f, setF] = useState(initial || { client_name: "", vehicle_id: "", start_date: today(), end_date: "", daily_rate: "", deposit: "", notes: "", client_id: "" });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const avail = vehicles.filter((v) => v.status === "available" || v.id === initial?.vehicle_id);
    const selectedV = vehicles.find((v) => v.id === f.vehicle_id);

    useEffect(() => {
      if (selectedV && !initial) set("daily_rate", selectedV.daily_rate || "");
    }, [f.vehicle_id]);

    return (
      <>
        <div className="form-row">
          <div className="form-group"><label>Client Name</label><input value={f.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Full name" /></div>
          <div className="form-group"><label>Client (linked)</label>
            <select value={f.client_id || ""} onChange={(e) => { set("client_id", e.target.value); const cl = clients.find((c) => c.id === e.target.value); if (cl) set("client_name", cl.full_name); }}>
              <option value="">— Select client —</option>
              {clients.filter((c) => !c.is_blacklisted).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>Vehicle</label>
          <select value={f.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)}>
            <option value="">— Select —</option>
            {avail.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plate}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Start Date</label><input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
          <div className="form-group"><label>End Date</label><input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Daily Rate (MAD)</label><input type="number" value={f.daily_rate} onChange={(e) => set("daily_rate", e.target.value)} /></div>
          <div className="form-group"><label>Deposit (MAD)</label><input type="number" value={f.deposit || ""} onChange={(e) => set("deposit", e.target.value)} /></div>
        </div>
        {f.start_date && f.end_date && f.daily_rate && (
          <div style={{ background: "var(--accent-bg)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text2)" }}>{daysBetween(f.start_date, f.end_date)} days × {fmt(f.daily_rate)}</span>
            <span style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--mono)" }}>{fmt(daysBetween(f.start_date, f.end_date) * f.daily_rate)}</span>
          </div>
        )}
        <div className="form-group"><label>Notes</label><textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(f)}>Save & Create Revenue</button>
        </div>
      </>
    );
  };

  const renderContracts = () => {
    const [tab, setTab] = useState("active");
    const filtered = contracts
      .filter((c) => tab === "all" || c.status === tab)
      .filter((c) => `${c.client_name}`.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <div className="tabs">
          {["active", "completed", "cancelled", "all"].map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="search-box">{Icons.search}<input placeholder="Search contracts..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => setModal("addContract")}>{Icons.plus} New Contract</button>
          </div>
          <table>
            <thead><tr><th>Client</th><th>Vehicle</th><th>Period</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((c) => {
                const v = vehicles.find((v) => v.id === c.vehicle_id);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.client_name || "—"}</td>
                    <td>{v ? `${v.brand} ${v.model}` : "—"}</td>
                    <td style={{ fontSize: 12.5 }}>{fmtDateShort(c.start_date)} → {fmtDateShort(c.end_date)}</td>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{fmt(c.total_amount)}</td>
                    <td><span className={`badge-pill ${c.status === "active" ? "badge-green" : c.status === "completed" ? "badge-blue" : "badge-gray"}`}>{c.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {c.status === "active" && (
                          <button className="btn btn-sm btn-secondary" onClick={async () => {
                            await supabase.update("contracts", { status: "completed" }, `id=eq.${c.id}`, token);
                            if (c.vehicle_id) await supabase.update("vehicles", { status: "available" }, `id=eq.${c.vehicle_id}`, token);
                            fetchAll();
                          }}>Complete</button>
                        )}
                        <button className="btn-icon" style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--red)" }} onClick={async () => {
                          if (confirm("Cancel this contract?")) {
                            await supabase.update("contracts", { status: "cancelled" }, `id=eq.${c.id}`, token);
                            if (c.vehicle_id) await supabase.update("vehicles", { status: "available" }, `id=eq.${c.vehicle_id}`, token);
                            fetchAll();
                          }
                        }}>{Icons.x}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><p>No contracts found</p></div>}
        </div>
      </>
    );
  };

  // ─── CLIENTS ───
  const ClientForm = ({ initial, onSave }) => {
    const [f, setF] = useState(initial || { full_name: "", phone: "", email: "", id_number: "", address: "", notes: "", is_blacklisted: false, blacklist_reason: "" });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    return (
      <>
        <div className="form-row">
          <div className="form-group"><label>Full Name</label><input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Mohammed El Alami" /></div>
          <div className="form-group"><label>Phone</label><input value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="+212 6XX XXX XXX" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email</label><input value={f.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" /></div>
          <div className="form-group"><label>ID Number (CIN)</label><input value={f.id_number || ""} onChange={(e) => set("id_number", e.target.value)} placeholder="AB123456" /></div>
        </div>
        <div className="form-group"><label>Address</label><input value={f.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="Tanger, Morocco" /></div>
        <div className="form-group"><label>Notes</label><textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={f.is_blacklisted} onChange={(e) => set("is_blacklisted", e.target.checked)} />
            <span style={{ color: f.is_blacklisted ? "var(--red)" : "var(--text2)" }}>Blacklisted</span>
          </label>
        </div>
        {f.is_blacklisted && (
          <div className="form-group"><label>Blacklist Reason</label><textarea rows={2} value={f.blacklist_reason || ""} onChange={(e) => set("blacklist_reason", e.target.value)} placeholder="Reason for blacklisting..." /></div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(f)}>Save Client</button>
        </div>
      </>
    );
  };

  const renderClientDetail = (cl) => {
    const clContracts = contracts.filter((c) => c.client_id === cl.id || (c.client_name && c.client_name === cl.full_name));
    const totalSpent = clContracts.reduce((s, c) => s + (c.total_amount || 0), 0);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setDetailClient(null)}>← Back</button>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{cl.full_name}</h3>
          {cl.is_blacklisted && <span className="badge-pill badge-red">{Icons.ban} Blacklisted</span>}
        </div>
        <div className="detail-grid">
          <div className="detail-section">
            <h4>Client Info</h4>
            <div className="detail-row"><span className="dl">Phone</span><span className="dv">{cl.phone || "—"}</span></div>
            <div className="detail-row"><span className="dl">Email</span><span className="dv">{cl.email || "—"}</span></div>
            <div className="detail-row"><span className="dl">ID (CIN)</span><span className="dv">{cl.id_number || "—"}</span></div>
            <div className="detail-row"><span className="dl">Address</span><span className="dv">{cl.address || "—"}</span></div>
            {cl.is_blacklisted && <div className="detail-row"><span className="dl">Blacklist Reason</span><span className="dv" style={{ color: "var(--red)" }}>{cl.blacklist_reason || "—"}</span></div>}
          </div>
          <div className="detail-section">
            <h4>Rental History</h4>
            <div className="detail-row"><span className="dl">Total Contracts</span><span className="dv">{clContracts.length}</span></div>
            <div className="detail-row"><span className="dl">Total Spent</span><span className="dv" style={{ color: "var(--green)", fontFamily: "var(--mono)" }}>{fmt(totalSpent)}</span></div>
            <div className="detail-row"><span className="dl">Active</span><span className="dv">{clContracts.filter((c) => c.status === "active").length}</span></div>
            <div className="detail-row"><span className="dl">Member Since</span><span className="dv">{fmtDate(cl.created_at)}</span></div>
          </div>
        </div>
        {clContracts.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 20 }}>
            <div className="table-toolbar"><h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>CONTRACT HISTORY</h4></div>
            <table>
              <thead><tr><th>Vehicle</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {clContracts.map((c) => {
                  const v = vehicles.find((v) => v.id === c.vehicle_id);
                  return (
                    <tr key={c.id}>
                      <td>{v ? `${v.brand} ${v.model}` : "—"}</td>
                      <td>{fmtDateShort(c.start_date)} → {fmtDateShort(c.end_date)}</td>
                      <td style={{ fontFamily: "var(--mono)" }}>{fmt(c.total_amount)}</td>
                      <td><span className={`badge-pill ${c.status === "active" ? "badge-green" : c.status === "completed" ? "badge-blue" : "badge-gray"}`}>{c.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderClients = () => {
    if (detailClient) return renderClientDetail(detailClient);
    const [tab, setTab] = useState("all");
    const filtered = clients
      .filter((c) => tab === "all" || (tab === "blacklisted" ? c.is_blacklisted : !c.is_blacklisted))
      .filter((c) => `${c.full_name} ${c.phone} ${c.id_number}`.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <div className="tabs">
          <button className={`tab-btn ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All ({clients.length})</button>
          <button className={`tab-btn ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>Active ({clients.filter((c) => !c.is_blacklisted).length})</button>
          <button className={`tab-btn ${tab === "blacklisted" ? "active" : ""}`} onClick={() => setTab("blacklisted")}>Blacklisted ({clients.filter((c) => c.is_blacklisted).length})</button>
        </div>
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="search-box">{Icons.search}<input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => setModal("addClient")}>{Icons.plus} Add Client</button>
          </div>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>CIN</th><th>Contracts</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((c) => {
                const cCount = contracts.filter((ct) => ct.client_id === c.id || ct.client_name === c.full_name).length;
                return (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setDetailClient(c)}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>{c.phone || "—"}</td>
                    <td>{c.id_number || "—"}</td>
                    <td>{cCount}</td>
                    <td>
                      {c.is_blacklisted
                        ? <span className="badge-pill badge-red">{Icons.ban} Blacklisted</span>
                        : <span className="badge-pill badge-green">Active</span>
                      }
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-icon" onClick={() => setModal({ type: "editClient", data: c })}>{Icons.edit}</button>
                        {!c.is_blacklisted ? (
                          <button className="btn-icon" style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--red)" }} title="Blacklist" onClick={() => setModal({ type: "blacklistClient", data: c })}>{Icons.ban}</button>
                        ) : (
                          <button className="btn-icon" style={{ borderColor: "rgba(34,197,94,0.3)", color: "var(--green)" }} title="Unblacklist" onClick={async () => { await supabase.update("clients", { is_blacklisted: false, blacklist_reason: "" }, `id=eq.${c.id}`, token); fetchAll(); }}>{Icons.check}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><p>No clients found</p></div>}
        </div>
      </>
    );
  };

  // ─── REVENUE ───
  const renderRevenue = () => {
    const filtered = revenue.filter((r) =>
      `${r.description} ${r.type}`.toLowerCase().includes(search.toLowerCase())
    );
    const total = filtered.reduce((s, r) => s + (r.amount || 0), 0);
    return (
      <>
        <div className="stats-grid">
          <div className="stat-card green"><div className="label">Total Revenue</div><div className="value">{fmt(total)}</div></div>
          <div className="stat-card blue"><div className="label">Rental Income</div><div className="value">{fmt(filtered.filter((r) => r.type === "rental").reduce((s, r) => s + (r.amount || 0), 0))}</div></div>
          <div className="stat-card orange"><div className="label">Entries</div><div className="value">{filtered.length}</div></div>
        </div>
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="search-box">{Icons.search}<input placeholder="Search revenue..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => setModal("addRevenue")}>{Icons.plus} Add Revenue</button>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date || r.created_at)}</td>
                  <td><span className={`badge-pill ${r.type === "rental" ? "badge-green" : "badge-blue"}`}>{r.type || "other"}</span></td>
                  <td>{r.description || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--green)" }}>{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><p>No revenue entries</p></div>}
        </div>
      </>
    );
  };

  // ─── EXPENSES ───
  const renderExpenses = () => {
    const filtered = expenses.filter((e) =>
      `${e.description} ${e.category}`.toLowerCase().includes(search.toLowerCase())
    );
    const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);
    return (
      <>
        <div className="stats-grid">
          <div className="stat-card red"><div className="label">Total Expenses</div><div className="value">{fmt(total)}</div></div>
          <div className="stat-card orange"><div className="label">Entries</div><div className="value">{filtered.length}</div></div>
        </div>
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="search-box">{Icons.search}<input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => setModal("addExpense")}>{Icons.plus} Add Expense</button>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date || e.created_at)}</td>
                  <td><span className="badge-pill badge-orange">{e.category || "other"}</span></td>
                  <td>{e.description || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--red)" }}>{fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><p>No expenses found</p></div>}
        </div>
      </>
    );
  };

  // ─── CASH ───
  const renderCash = () => {
    const totalIn = cashOps.filter((c) => c.type === "in").reduce((s, c) => s + (c.amount || 0), 0);
    const totalOut = cashOps.filter((c) => c.type === "out").reduce((s, c) => s + (c.amount || 0), 0);
    return (
      <>
        <div className="stats-grid">
          <div className="stat-card green"><div className="label">Cash In</div><div className="value">{fmt(totalIn)}</div></div>
          <div className="stat-card red"><div className="label">Cash Out</div><div className="value">{fmt(totalOut)}</div></div>
          <div className="stat-card blue"><div className="label">Balance</div><div className="value">{fmt(totalIn - totalOut)}</div></div>
        </div>
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="search-box">{Icons.search}<input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={() => setModal("cashIn")}>{Icons.plus} Cash In</button>
              <button className="btn btn-danger" onClick={() => setModal("cashOut")}>{Icons.plus} Cash Out</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {cashOps.map((c) => (
                <tr key={c.id}>
                  <td>{fmtDate(c.date || c.created_at)}</td>
                  <td><span className={`badge-pill ${c.type === "in" ? "badge-green" : "badge-red"}`}>{c.type === "in" ? "IN" : "OUT"}</span></td>
                  <td>{c.description || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 600, color: c.type === "in" ? "var(--green)" : "var(--red)" }}>{c.type === "in" ? "+" : "-"}{fmt(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cashOps.length === 0 && <div className="empty"><p>No cash operations</p></div>}
        </div>
      </>
    );
  };

  // ─── ALERTS ───
  const renderAlerts = () => (
    <div className="table-wrap">
      <div className="table-toolbar"><h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.6px" }}>All Alerts ({allAlerts.length})</h4></div>
      {allAlerts.length > 0 ? allAlerts.map((a, i) => (
        <div className="alert-item" key={i}>
          <div className={`alert-dot ${a.type}`} />
          <div className="alert-info">
            <div className="alert-msg">{a.msg}</div>
            {a.date && <div className="alert-meta">{fmtDate(a.date)}</div>}
          </div>
          <span className={`badge-pill ${a.type === "red" ? "badge-red" : a.type === "orange" ? "badge-orange" : "badge-yellow"}`}>{a.type === "red" ? "Critical" : a.type === "orange" ? "Warning" : "Info"}</span>
        </div>
      )) : <div className="empty"><p>No alerts — everything looks good!</p></div>}
    </div>
  );

  // ─── Page map ───
  const pages = { dashboard: renderDashboard, vehicles: renderVehicles, contracts: renderContracts, clients: renderClients, revenue: renderRevenue, expenses: renderExpenses, cash: renderCash, alerts: renderAlerts };
  const pageTitle = { dashboard: "Dashboard", vehicles: "Fleet Management", contracts: "Contracts", clients: "Client Management", revenue: "Revenue", expenses: "Expenses", cash: "Cash Tracking", alerts: "Alerts" };

  // ─── Modal handlers ───
  const saveVehicle = async (f) => {
    const data = { ...f, daily_rate: Number(f.daily_rate) || 0, mileage: f.mileage ? Number(f.mileage) : null, year: f.year ? Number(f.year) : null };
    await supabase.insert("vehicles", data, token);
    setModal(null); fetchAll();
  };
  const updateVehicle = async (f, id) => {
    const data = { ...f, daily_rate: Number(f.daily_rate) || 0, mileage: f.mileage ? Number(f.mileage) : null, year: f.year ? Number(f.year) : null };
    await supabase.update("vehicles", data, `id=eq.${id}`, token);
    setModal(null); fetchAll();
  };
  const saveContract = async (f) => {
    await createContractWithRevenue({ ...f, daily_rate: Number(f.daily_rate) || 0, deposit: f.deposit ? Number(f.deposit) : null });
    setModal(null);
  };
  const saveClient = async (f) => {
    await supabase.insert("clients", f, token);
    setModal(null); fetchAll();
  };
  const updateClient = async (f, id) => {
    await supabase.update("clients", f, `id=eq.${id}`, token);
    setModal(null); fetchAll();
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-brand">
            <div className="logo">BB</div>
            <div><h1>BB MOTO</h1><span>Tanger</span></div>
          </div>
          <div className="sidebar-nav">
            {navItems.map((n) => (
              <div key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => { setPage(n.id); setSearch(""); setDetailVehicle(null); setDetailClient(null); }}>
                {n.icon}
                {n.label}
                {n.badge && <span className="badge">{n.badge}</span>}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <button onClick={() => setSession(null)}>{Icons.logout} Sign Out</button>
          </div>
        </div>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <h2>{pageTitle[page]}</h2>
            <div className="topbar-actions">
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>{today()}</span>
            </div>
          </div>
          <div className="content">
            {loading ? <div className="empty"><p>Loading...</p></div> : (pages[page] || renderDashboard)()}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "addVehicle" && (
        <Modal title="Add Vehicle" onClose={() => setModal(null)}>
          <VehicleForm onSave={saveVehicle} />
        </Modal>
      )}
      {modal?.type === "editVehicle" && (
        <Modal title="Edit Vehicle" onClose={() => setModal(null)}>
          <VehicleForm initial={modal.data} onSave={(f) => updateVehicle(f, modal.data.id)} />
        </Modal>
      )}
      {modal === "addContract" && (
        <Modal title="New Contract" onClose={() => setModal(null)}>
          <ContractForm onSave={saveContract} />
        </Modal>
      )}
      {modal === "addClient" && (
        <Modal title="Add Client" onClose={() => setModal(null)}>
          <ClientForm onSave={saveClient} />
        </Modal>
      )}
      {modal?.type === "editClient" && (
        <Modal title="Edit Client" onClose={() => setModal(null)}>
          <ClientForm initial={modal.data} onSave={(f) => updateClient(f, modal.data.id)} />
        </Modal>
      )}
      {modal?.type === "blacklistClient" && (
        <Modal title="Blacklist Client" onClose={() => setModal(null)}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>Blacklist <strong>{modal.data.full_name}</strong>?</p>
            <p style={{ fontSize: 13, color: "var(--text2)" }}>This client will not appear in contract dropdowns.</p>
          </div>
          <div className="form-group"><label>Reason</label><textarea rows={3} id="bl-reason" placeholder="Why is this client being blacklisted?" /></div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={async () => {
              const reason = document.getElementById("bl-reason")?.value || "";
              await supabase.update("clients", { is_blacklisted: true, blacklist_reason: reason }, `id=eq.${modal.data.id}`, token);
              setModal(null); fetchAll();
            }}>Blacklist</button>
          </div>
        </Modal>
      )}
      {modal === "addRevenue" && (
        <Modal title="Add Revenue" onClose={() => setModal(null)}>
          {(() => {
            const [f, setF] = useState({ amount: "", type: "other", description: "", date: today(), vehicle_id: "" });
            const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
            return (
              <>
                <div className="form-row">
                  <div className="form-group"><label>Amount (MAD)</label><input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></div>
                  <div className="form-group"><label>Type</label>
                    <select value={f.type} onChange={(e) => set("type", e.target.value)}>
                      <option value="rental">Rental</option><option value="deposit">Deposit</option><option value="penalty">Penalty</option><option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Date</label><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
                <div className="form-group"><label>Description</label><input value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={async () => { await supabase.insert("revenue", { ...f, amount: Number(f.amount) || 0 }, token); setModal(null); fetchAll(); }}>Save</button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
      {modal === "addExpense" && (
        <Modal title="Add Expense" onClose={() => setModal(null)}>
          {(() => {
            const [f, setF] = useState({ amount: "", category: "fuel", description: "", date: today(), vehicle_id: "" });
            const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
            return (
              <>
                <div className="form-row">
                  <div className="form-group"><label>Amount (MAD)</label><input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></div>
                  <div className="form-group"><label>Category</label>
                    <select value={f.category} onChange={(e) => set("category", e.target.value)}>
                      <option value="fuel">Fuel</option><option value="maintenance">Maintenance</option><option value="insurance">Insurance</option><option value="rent">Rent</option><option value="salary">Salary</option><option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Date</label><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
                <div className="form-group"><label>Description</label><input value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={async () => { await supabase.insert("expenses", { ...f, amount: Number(f.amount) || 0 }, token); setModal(null); fetchAll(); }}>Save</button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
      {(modal === "cashIn" || modal === "cashOut") && (
        <Modal title={modal === "cashIn" ? "Cash In" : "Cash Out"} onClose={() => setModal(null)}>
          {(() => {
            const [f, setF] = useState({ amount: "", description: "", date: today() });
            const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
            return (
              <>
                <div className="form-group"><label>Amount (MAD)</label><input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></div>
                <div className="form-group"><label>Date</label><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
                <div className="form-group"><label>Description</label><input value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={async () => { await supabase.insert("cash_operations", { ...f, amount: Number(f.amount) || 0, type: modal === "cashIn" ? "in" : "out" }, token); setModal(null); fetchAll(); }}>Save</button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}
