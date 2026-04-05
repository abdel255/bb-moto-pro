import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "./supabaseClient";

const DEFAULT_CATEGORIES = ["Scooter 50cc", "Scooter 125cc", "Scooter 150cc", "Bike", "E-Bike"];
const SEASONS = [
  { id: "low", label: "Low Season", color: "#60a5fa" },
  { id: "mid", label: "Mid Season", color: "#f59e0b" },
  { id: "high", label: "High Season", color: "#ef4444" },
];
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "fleet", label: "Fleet", icon: "🛵" },
  { id: "contracts", label: "Contracts", icon: "📝" },
  { id: "expenses", label: "Expenses", icon: "💸" },
  { id: "revenue", label: "Revenue", icon: "💰" },
  { id: "cash", label: "Cash & Bank", icon: "🏦" },
];

const today = () => new Date().toISOString().split("T")[0];
const currency = (n) => `${Number(n || 0).toLocaleString("fr-MA")} MAD`;

const AuthContext = createContext(null);

/* ═══════ DATA HOOK — SUPABASE ═══════ */
function useSupabaseData(user) {
  const [data, setData] = useState({ vehicles: [], contracts: [], expenses: [], revenue: [], cashOps: [] });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [v, c, e, r, co] = await Promise.all([
      supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("revenue").select("*").order("date", { ascending: false }),
      supabase.from("cash_ops").select("*").order("date", { ascending: false }),
    ]);
    setData({
      vehicles: v.data || [],
      contracts: c.data || [],
      expenses: e.data || [],
      revenue: r.data || [],
      cashOps: co.data || [],
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logActivity = async (action, entityType, entityId, details) => {
    await supabase.from("activity_log").insert({ user_id: user.id, action, entity_type: entityType, entity_id: entityId, details });
  };

  // CRUD helpers
  const addVehicle = async (form) => {
    const { data: row, error } = await supabase.from("vehicles").insert({
      name: form.name, plate: form.plate, category: form.category, status: form.status,
      rate_low: Number(form.rates?.low) || 0, rate_mid: Number(form.rates?.mid) || 0, rate_high: Number(form.rates?.high) || 0,
      notes: form.notes, created_by: user.id,
    }).select().single();
    if (!error) { await logActivity("create", "vehicle", row.id, { name: form.name }); await fetchAll(); }
    return { row, error };
  };

  const updateVehicle = async (id, form) => {
    const { error } = await supabase.from("vehicles").update({
      name: form.name, plate: form.plate, category: form.category, status: form.status,
      rate_low: Number(form.rates?.low) || 0, rate_mid: Number(form.rates?.mid) || 0, rate_high: Number(form.rates?.high) || 0,
      notes: form.notes, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) { await logActivity("update", "vehicle", id, { name: form.name }); await fetchAll(); }
    return { error };
  };

  const deleteVehicle = async (id) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (!error) { await logActivity("delete", "vehicle", id, {}); await fetchAll(); }
    return { error };
  };

  const addContract = async (form) => {
    const { data: row, error } = await supabase.from("contracts").insert({
      client_name: form.clientName, client_phone: form.clientPhone, client_id: form.clientId,
      vehicle_id: form.vehicleId || null, start_date: form.startDate, end_date: form.endDate || null,
      season: form.season, total_amount: Number(form.totalAmount) || 0, deposit: Number(form.deposit) || 0,
      deposit_status: "held", status: form.status, notes: form.notes, created_by: user.id,
    }).select().single();
    if (!error) { await logActivity("create", "contract", row.id, { client: form.clientName }); await fetchAll(); }
    return { row, error };
  };

  const updateContract = async (id, form) => {
    const { error } = await supabase.from("contracts").update({
      client_name: form.clientName, client_phone: form.clientPhone, client_id: form.clientId,
      vehicle_id: form.vehicleId || null, start_date: form.startDate, end_date: form.endDate || null,
      season: form.season, total_amount: Number(form.totalAmount) || 0, deposit: Number(form.deposit) || 0,
      status: form.status, notes: form.notes, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) { await logActivity("update", "contract", id, { client: form.clientName }); await fetchAll(); }
    return { error };
  };

  const deleteContract = async (id) => {
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (!error) { await logActivity("delete", "contract", id, {}); await fetchAll(); }
    return { error };
  };

  const keepDeposit = async (contract, keptAmount, damageNotes) => {
    const kept = Number(keptAmount);
    const isPartial = kept < Number(contract.deposit);
    // update contract
    await supabase.from("contracts").update({
      deposit_status: isPartial ? "kept-partial" : "kept-full",
      kept_amount: kept, damage_notes: damageNotes, updated_at: new Date().toISOString(),
    }).eq("id", contract.id);
    // create revenue
    const { data: rev } = await supabase.from("revenue").insert({
      description: `Deposit kept – ${contract.client_name}${damageNotes ? ` (${damageNotes})` : ""}`,
      amount: kept, date: today(), vehicle_id: contract.vehicle_id, contract_id: contract.id,
      source: "Deposit Kept", created_by: user.id,
    }).select().single();
    // cash in
    await supabase.from("cash_ops").insert({
      type: "in", amount: kept, date: today(), description: `Deposit kept: ${contract.client_name}`,
      linked_id: rev?.id, created_by: user.id,
    });
    await logActivity("keep_deposit", "contract", contract.id, { amount: kept });
    await fetchAll();
  };

  const returnDeposit = async (contractId) => {
    await supabase.from("contracts").update({ deposit_status: "returned", kept_amount: 0 }).eq("id", contractId);
    await logActivity("return_deposit", "contract", contractId, {});
    await fetchAll();
  };

  const addExpense = async (form) => {
    const { data: row, error } = await supabase.from("expenses").insert({
      description: form.description, amount: Number(form.amount), date: form.date,
      category: form.category, vehicle_id: form.vehicleId || null, paid_from: form.paidFrom || "cash",
      notes: form.notes, created_by: user.id,
    }).select().single();
    if (!error) {
      if (form.paidFrom === "cash") {
        await supabase.from("cash_ops").insert({
          type: "out", amount: Number(form.amount), date: form.date,
          description: `Expense: ${form.description}`, linked_id: row.id, created_by: user.id,
        });
      }
      await logActivity("create", "expense", row.id, { description: form.description, amount: form.amount });
      await fetchAll();
    }
    return { row, error };
  };

  const deleteExpense = async (id) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) { await logActivity("delete", "expense", id, {}); await fetchAll(); }
    return { error };
  };

  const addRevenue = async (form) => {
    const { data: row, error } = await supabase.from("revenue").insert({
      description: form.description, amount: Number(form.amount), date: form.date,
      vehicle_id: form.vehicleId || null, contract_id: form.contractId || null,
      source: form.source, created_by: user.id,
    }).select().single();
    if (!error) {
      await supabase.from("cash_ops").insert({
        type: "in", amount: Number(form.amount), date: form.date,
        description: `Revenue: ${form.description || form.source}`, linked_id: row.id, created_by: user.id,
      });
      await logActivity("create", "revenue", row.id, { amount: form.amount });
      await fetchAll();
    }
    return { row, error };
  };

  const deleteRevenue = async (id) => {
    const { error } = await supabase.from("revenue").delete().eq("id", id);
    if (!error) { await logActivity("delete", "revenue", id, {}); await fetchAll(); }
    return { error };
  };

  const addCashOp = async (form) => {
    const { error } = await supabase.from("cash_ops").insert({
      type: form.type, amount: Number(form.amount), date: form.date,
      description: form.description, reference: form.reference, created_by: user.id,
    });
    if (!error) { await logActivity("create", "cash_op", null, { type: form.type, amount: form.amount }); await fetchAll(); }
    return { error };
  };

  const deleteCashOp = async (id) => {
    const { error } = await supabase.from("cash_ops").delete().eq("id", id);
    if (!error) { await logActivity("delete", "cash_op", id, {}); await fetchAll(); }
    return { error };
  };

  return {
    data, loading, refresh: fetchAll,
    addVehicle, updateVehicle, deleteVehicle,
    addContract, updateContract, deleteContract, keepDeposit, returnDeposit,
    addExpense, deleteExpense,
    addRevenue, deleteRevenue,
    addCashOp, deleteCashOp,
  };
}

/* ═══════ DATE HELPERS ═══════ */
function isInRange(dateStr, range) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (typeof range === "object" && range.from && range.to) {
    const from = new Date(range.from); from.setHours(0,0,0,0);
    const to = new Date(range.to); to.setHours(23,59,59,999);
    return d >= from && d <= to;
  }
  if (range === "week") { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w && d <= now; }
  if (range === "month") { return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
  if (range === "year") { return d.getFullYear() === now.getFullYear(); }
  return true;
}

/* ═══════ UI COMPONENTS ═══════ */
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: wide ? 640 : 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 18, color: "#f0f0f5" }}>{title}</h3>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...S.statCard, borderLeft: `4px solid ${accent || "#E81224"}` }}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TimeFilter({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const isCustom = typeof value === "object";
  const presets = ["week", "month", "year", "all"];
  const applyCustom = () => { if (customFrom && customTo) { onChange({ from: customFrom, to: customTo }); setShowCustom(false); } };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {presets.map((f) => (
          <button key={f} onClick={() => { onChange(f); setShowCustom(false); }} style={{ ...S.filterBtn, ...(!isCustom && value === f ? S.filterBtnActive : {}) }}>
            {f === "all" ? "All Time" : f.charAt(0).toUpperCase() + f.slice(1) + "ly"}
          </button>
        ))}
        <button onClick={() => setShowCustom(!showCustom)} style={{ ...S.filterBtn, ...(isCustom ? S.filterBtnActive : {}), display: "flex", alignItems: "center", gap: 4 }}>
          📅 {isCustom ? `${value.from} → ${value.to}` : "Custom"}
        </button>
      </div>
      {showCustom && (
        <div style={{ marginTop: 10, background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 10, padding: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><label style={{ ...S.label, fontSize: 10 }}>From</label><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...S.input, width: 150, padding: "7px 10px", fontSize: 13 }} /></div>
          <div><label style={{ ...S.label, fontSize: 10 }}>To</label><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...S.input, width: 150, padding: "7px 10px", fontSize: 13 }} /></div>
          <button onClick={applyCustom} disabled={!customFrom || !customTo} style={{ ...S.primaryBtn, padding: "8px 16px", fontSize: 12, opacity: (!customFrom || !customTo) ? .4 : 1 }}>Apply</button>
        </div>
      )}
    </div>
  );
}

function Inp({ label, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      {props.type === "textarea" ? <textarea {...props} style={S.textarea} />
        : props.type === "select" ? <select {...props} style={S.input}>{props.children}</select>
        : <input {...props} style={S.input} />}
    </div>
  );
}

function BarChart({ items, colorFrom, colorTo }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return items.map((item) => (
    <div key={item.label} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{item.label}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{currency(item.value)}</span>
      </div>
      <div style={{ background: "#1e1e2a", borderRadius: 4, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${(item.value / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`, borderRadius: 4, transition: "width .4s" }} />
      </div>
      {item.sub && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{item.sub}</div>}
    </div>
  ));
}

/* ═══════ LOGIN PAGE ═══════ */
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0e0e14", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 380, padding: 40, background: "#111118", borderRadius: 16, border: "1px solid #1e1e2a", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <svg width="56" height="56" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="17" fill="#111118" stroke="#E81224" strokeWidth="2"/>
            <path d="M8 22 L14 14 L18 18 L24 10 L28 14" stroke="#E81224" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M22 10 L28 14 L24 14" stroke="#E81224" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <h1 style={{ fontSize: 28, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: "#fff", marginTop: 12, letterSpacing: 2 }}>
            <span style={{ color: "#E81224" }}>BB</span> MOTO
          </h1>
          <div style={{ fontSize: 11, color: "#666", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Rajdhani', sans-serif" }}>Tanger · Management System</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: .5, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box", background: "#0e0e14", color: "#e0e0e8" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: .5, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box", background: "#0e0e14", color: "#e0e0e8" }} />
        </div>

        {error && <div style={{ background: "#2a1010", border: "1px solid #5c2020", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#f87171" }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #E81224, #b30e1c)", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1, textTransform: "uppercase", opacity: loading ? .6 : 1 }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#555" }}>
          Authorized personnel only
        </div>
      </div>
    </div>
  );
}

/* ═══════ DASHBOARD ═══════ */
function Dashboard({ data, timeRange, setTimeRange }) {
  const fRev = data.revenue.filter((r) => isInRange(r.date, timeRange));
  const fExp = data.expenses.filter((e) => isInRange(e.date, timeRange));
  const totalRev = fRev.reduce((s, r) => s + Number(r.amount), 0);
  const totalExp = fExp.reduce((s, e) => s + Number(e.amount), 0);
  const profit = totalRev - totalExp;
  const activeContracts = data.contracts.filter((c) => c.status === "active").length;
  const ops = data.cashOps;
  const cashBalance = ops.reduce((s, op) => { if (op.type === "in" || op.type === "withdrawal") return s + Number(op.amount); if (op.type === "out" || op.type === "deposit") return s - Number(op.amount); return s; }, 0);
  const totalDeposited = ops.filter(o => o.type === "deposit").reduce((s, o) => s + Number(o.amount), 0);
  const totalWithdrawn = ops.filter(o => o.type === "withdrawal").reduce((s, o) => s + Number(o.amount), 0);
  const bankBalance = totalDeposited - totalWithdrawn;
  const vRevMap = {}; const vDepKeptMap = {};
  fRev.forEach((r) => { if (r.vehicle_id) { vRevMap[r.vehicle_id] = (vRevMap[r.vehicle_id] || 0) + Number(r.amount); if (r.source === "Deposit Kept") vDepKeptMap[r.vehicle_id] = (vDepKeptMap[r.vehicle_id] || 0) + Number(r.amount); } });
  const totalDepositsKept = fRev.filter(r => r.source === "Deposit Kept").reduce((s, r) => s + Number(r.amount), 0);
  const vExpMap = {};
  fExp.filter(e => e.vehicle_id).forEach((e) => { vExpMap[e.vehicle_id] = (vExpMap[e.vehicle_id] || 0) + Number(e.amount); });
  const topV = data.vehicles.map((v) => ({ ...v, rev: vRevMap[v.id] || 0, exp: vExpMap[v.id] || 0, depKept: vDepKeptMap[v.id] || 0 })).sort((a, b) => b.rev - a.rev).slice(0, 6);
  const catRev = {};
  data.vehicles.forEach(v => { catRev[v.category] = (catRev[v.category] || 0) + (vRevMap[v.id] || 0); });

  return (
    <div>
      <TimeFilter value={timeRange} onChange={setTimeRange} />
      <div style={S.statGrid}>
        <StatCard label="Total Revenue" value={currency(totalRev)} accent="#16a34a" sub={totalDepositsKept > 0 ? `Incl. ${currency(totalDepositsKept)} deposits kept` : undefined} />
        <StatCard label="Total Expenses" value={currency(totalExp)} accent="#dc2626" />
        <StatCard label="Net Profit" value={currency(profit)} accent={profit >= 0 ? "#16a34a" : "#dc2626"} />
        <StatCard label="Active Contracts" value={activeContracts} accent="#E81224" />
        <StatCard label="Cash Register" value={currency(cashBalance)} accent="#7c3aed" />
        <StatCard label="In Bank" value={currency(bankBalance)} accent="#0891b2" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
        <div style={S.card}><h4 style={S.cardTitle}>Top Performing Vehicles</h4>
          {topV.length === 0 && <p style={S.empty}>Add vehicles & revenue to see performance</p>}
          <BarChart items={topV.map(v => ({ label: v.name, value: v.rev, sub: `Rentals: ${currency(v.rev - v.depKept)}${v.depKept > 0 ? ` · Deposits kept: ${currency(v.depKept)}` : ""} · Exp: ${currency(v.exp)} · Profit: ${currency(v.rev - v.exp)}` }))} colorFrom="#E81224" colorTo="#ff4757" />
        </div>
        <div style={S.card}><h4 style={S.cardTitle}>Revenue by Category</h4>
          {Object.keys(catRev).length === 0 && <p style={S.empty}>No revenue data yet</p>}
          {Object.entries(catRev).sort((a, b) => b[1] - a[1]).map(([cat, rev]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e1e2a", fontSize: 14 }}>
              <span>{cat}</span><span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#16a34a" }}>{currency(rev)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════ FLEET ═══════ */
function Fleet({ data, db, profile }) {
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { name: "", plate: "", category: DEFAULT_CATEGORIES[0], status: "available", rates: { low: "", mid: "", high: "" }, notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const isAdmin = profile?.role === "admin";

  const handleSave = async () => {
    if (!form.name) return;
    if (editId) await db.updateVehicle(editId, form);
    else await db.addVehicle(form);
    setForm(emptyForm); setShowForm(false); setEditId(null);
  };
  const handleEdit = (v) => { setForm({ ...v, rates: { low: v.rate_low || "", mid: v.rate_mid || "", high: v.rate_high || "" } }); setEditId(v.id); setShowForm(true); };
  const handleDelete = async (id) => { if (confirm("Delete this vehicle?")) await db.deleteVehicle(id); };
  const getRate = (v) => ({ low: v.rate_low || "—", mid: v.rate_mid || "—", high: v.rate_high || "—" });

  return (
    <div>
      <div style={S.sectionHeader}><h3 style={{ margin: 0, color: "#e0e0e8" }}>Fleet Management</h3>
        <button style={S.primaryBtn} onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}>+ Add Vehicle</button></div>
      {showForm && (
        <Modal title={editId ? "Edit Vehicle" : "Add Vehicle"} onClose={() => setShowForm(false)}>
          <Inp label="Vehicle Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Honda PCX #3" />
          <Inp label="License Plate" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
          <Inp label="Category" type="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{DEFAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Inp>
          <div style={{ background: "#111118", border: "1px solid #2a2a3a", borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e8", marginBottom: 10 }}>Daily Rates by Season (MAD)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {SEASONS.map((s) => (<div key={s.id}><label style={{ ...S.label, color: s.color, fontSize: 11 }}>{s.label}</label>
                <input type="number" placeholder="MAD" style={S.input} value={form.rates?.[s.id] || ""} onChange={(e) => setForm({ ...form, rates: { ...form.rates, [s.id]: e.target.value } })} /></div>))}
            </div></div>
          <Inp label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="available">Available</option><option value="rented">Rented</option><option value="maintenance">In Maintenance</option></Inp>
          <Inp label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button style={S.primaryBtn} onClick={handleSave}>{editId ? "Update" : "Add"} Vehicle</button>
        </Modal>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
        {data.vehicles.length === 0 && <p style={S.empty}>No vehicles yet. Add your first scooter or bike!</p>}
        {data.vehicles.map((v) => { const rates = getRate(v); return (
          <div key={v.id} style={S.vehicleCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div><div style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e8" }}>{v.name}</div>
                <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{v.plate || "No plate"}</div></div>
              <span style={{ ...S.badge, background: v.status === "available" ? "#0a2a15" : v.status === "rented" ? "#2a2210" : "#2a1010", color: v.status === "available" ? "#16a34a" : v.status === "rented" ? "#d97706" : "#dc2626" }}>{v.status}</span>
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 8 }}><span style={S.tag}>{v.category}</span></div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {SEASONS.map((s) => (<div key={s.id} style={{ flex: 1, background: "#111118", border: "1px solid #2a2a3a", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: .5, color: s.color, fontWeight: 700 }}>{s.label.replace(" Season", "")}</div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: "#e0e0e8", marginTop: 2 }}>{rates[s.id] || "—"}</div></div>))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button style={S.smallBtn} onClick={() => handleEdit(v)}>Edit</button>
              {isAdmin && <button style={{ ...S.smallBtn, color: "#dc2626" }} onClick={() => handleDelete(v.id)}>Delete</button>}
            </div>
          </div>); })}
      </div>
    </div>
  );
}

/* ═══════ CONTRACTS ═══════ */
function Contracts({ data, db, profile }) {
  const [showForm, setShowForm] = useState(false); const [search, setSearch] = useState("");
  const emptyForm = { clientName: "", clientPhone: "", clientId: "", vehicleId: "", startDate: today(), endDate: "", season: "mid", totalAmount: "", deposit: "", status: "active", notes: "" };
  const [form, setForm] = useState(emptyForm); const [editId, setEditId] = useState(null);
  const [showKeepDeposit, setShowKeepDeposit] = useState(null);
  const [keepForm, setKeepForm] = useState({ keptAmount: "", damageNotes: "" });
  const isAdmin = profile?.role === "admin";

  const autoCalc = (f) => { const v = data.vehicles.find(vv => vv.id === f.vehicleId); if (v && f.startDate && f.endDate && f.season) { const days = Math.max(1, Math.ceil((new Date(f.endDate) - new Date(f.startDate)) / 86400000)); const rate = Number(v[`rate_${f.season}`] || 0); if (rate > 0) return { ...f, totalAmount: String(days * rate) }; } return f; };
  const handleSave = async () => { if (!form.clientName || !form.vehicleId) return; if (editId) await db.updateContract(editId, form); else await db.addContract(form); setForm(emptyForm); setShowForm(false); setEditId(null); };
  const handleEdit = (c) => { setForm({ clientName: c.client_name, clientPhone: c.client_phone, clientId: c.client_id, vehicleId: c.vehicle_id, startDate: c.start_date, endDate: c.end_date || "", season: c.season, totalAmount: String(c.total_amount), deposit: String(c.deposit), status: c.status, notes: c.notes }); setEditId(c.id); setShowForm(true); };
  const handleDelete = async (id) => { if (confirm("Delete contract?")) await db.deleteContract(id); };
  const handleKeepDeposit = (c) => { setShowKeepDeposit(c.id); setKeepForm({ keptAmount: String(c.deposit), damageNotes: "" }); };
  const confirmKeepDeposit = async () => { const c = data.contracts.find(x => x.id === showKeepDeposit); if (!c || !keepForm.keptAmount) return; await db.keepDeposit(c, keepForm.keptAmount, keepForm.damageNotes); setShowKeepDeposit(null); };
  const handleReturnDeposit = async (id) => { if (confirm("Mark deposit as fully returned?")) await db.returnDeposit(id); };

  const filtered = data.contracts.filter((c) => c.client_name?.toLowerCase().includes(search.toLowerCase()) || c.client_phone?.includes(search) || c.client_id?.toLowerCase().includes(search.toLowerCase()));
  const getVName = (id) => data.vehicles.find((v) => v.id === id)?.name || "Unknown";

  return (
    <div>
      <div style={S.sectionHeader}><h3 style={{ margin: 0, color: "#e0e0e8" }}>Client Contracts</h3>
        <button style={S.primaryBtn} onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}>+ New Contract</button></div>
      <input style={{ ...S.input, marginBottom: 16, marginTop: 12 }} placeholder="Search by client name, phone or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {showForm && (
        <Modal title={editId ? "Edit Contract" : "New Contract"} onClose={() => setShowForm(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Inp label="Client Name *" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /><Inp label="Client Phone" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="+212..." /></div>
          <Inp label="Client ID / Passport" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} />
          <Inp label="Vehicle *" type="select" value={form.vehicleId} onChange={(e) => { const f = { ...form, vehicleId: e.target.value }; setForm(autoCalc(f)); }}><option value="">-- Select --</option>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate || v.category})</option>)}</Inp>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Inp label="Start Date" type="date" value={form.startDate} onChange={(e) => { setForm(autoCalc({ ...form, startDate: e.target.value })); }} />
            <Inp label="End Date" type="date" value={form.endDate} onChange={(e) => { setForm(autoCalc({ ...form, endDate: e.target.value })); }} />
            <Inp label="Season" type="select" value={form.season} onChange={(e) => { setForm(autoCalc({ ...form, season: e.target.value })); }}>{SEASONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Inp>
          </div>
          {form.vehicleId && form.season && (() => { const v = data.vehicles.find(vv => vv.id === form.vehicleId); const rate = v?.[`rate_${form.season}`]; if (!rate) return null; const days = form.startDate && form.endDate ? Math.max(1, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000)) : 0; return (<div style={{ background: "#2a2210", border: "1px solid #5c4a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#fbbf24" }}>Rate: <strong>{currency(rate)}/day</strong> ({SEASONS.find(s => s.id === form.season)?.label}){days > 0 && <> · {days} days = <strong>{currency(days * Number(rate))}</strong></>}</div>); })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Inp label="Total Amount (MAD)" type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} /><Inp label="Deposit (MAD)" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
          <Inp label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Inp>
          <Inp label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button style={S.primaryBtn} onClick={handleSave}>{editId ? "Update" : "Create"} Contract</button>
        </Modal>)}
      {showKeepDeposit && (() => { const c = data.contracts.find(x => x.id === showKeepDeposit); if (!c) return null; return (
        <Modal title="Keep Deposit – Damage Claim" onClose={() => setShowKeepDeposit(null)}>
          <div style={{ background: "#2a1515", border: "1px solid #5c2a2a", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}><strong>Client:</strong> {c.client_name}<br /><strong>Vehicle:</strong> {getVName(c.vehicle_id)}<br /><strong>Full deposit:</strong> {currency(c.deposit)}</div>
          <Inp label="Amount to Keep (MAD) *" type="number" value={keepForm.keptAmount} onChange={(e) => setKeepForm({ ...keepForm, keptAmount: e.target.value })} />
          <Inp label="Damage Description *" type="textarea" value={keepForm.damageNotes} onChange={(e) => setKeepForm({ ...keepForm, damageNotes: e.target.value })} placeholder="Describe the damage..." />
          <button style={{ ...S.primaryBtn, background: "#dc2626" }} onClick={confirmKeepDeposit}>Confirm – Keep {currency(keepForm.keptAmount)}</button>
        </Modal>); })()}
      <div style={S.tableWrap}><table style={S.table}><thead><tr>{["Client", "Vehicle", "Season", "Period", "Amount", "Deposit", "Dep. Status", "Status", "Actions"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{filtered.length === 0 && <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#666" }}>No contracts found</td></tr>}
          {filtered.map((c) => { const ds = c.deposit_status || "held"; const dsC = { held: { bg: "#2a2210", color: "#d97706", label: "Held" }, returned: { bg: "#0a2a15", color: "#16a34a", label: "Returned" }, "kept-full": { bg: "#2a1010", color: "#dc2626", label: "Kept (Full)" }, "kept-partial": { bg: "#2a1020", color: "#be185d", label: `Kept ${currency(c.kept_amount)}` } }; const d = dsC[ds] || dsC.held;
            return (<tr key={c.id}>
              <td style={S.td}><div style={{ fontWeight: 600, color: "#e0e0e8" }}>{c.client_name}</div><div style={{ fontSize: 11, color: "#666" }}>{c.client_phone} {c.client_id && `· ${c.client_id}`}</div></td>
              <td style={S.td}>{getVName(c.vehicle_id)}</td>
              <td style={S.td}><span style={{ ...S.badge, background: "#1e1e2a", color: SEASONS.find(s => s.id === c.season)?.color || "#777" }}>{SEASONS.find(s => s.id === c.season)?.label || "—"}</span></td>
              <td style={S.td}><span style={{ fontSize: 12 }}>{c.start_date} → {c.end_date || "—"}</span></td>
              <td style={{ ...S.td, fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{currency(c.total_amount)}</td>
              <td style={{ ...S.td, fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{currency(c.deposit)}</td>
              <td style={S.td}><span style={{ ...S.badge, background: d.bg, color: d.color }}>{d.label}</span>{c.damage_notes && <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>⚠ {c.damage_notes}</div>}</td>
              <td style={S.td}><span style={{ ...S.badge, background: c.status === "active" ? "#0a2a15" : c.status === "completed" ? "#10102a" : "#2a1010", color: c.status === "active" ? "#16a34a" : c.status === "completed" ? "#4f46e5" : "#dc2626" }}>{c.status}</span></td>
              <td style={S.td}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button style={S.smallBtn} onClick={() => handleEdit(c)}>Edit</button>
                {ds === "held" && Number(c.deposit) > 0 && <><button style={{ ...S.smallBtn, color: "#dc2626", fontWeight: 600 }} onClick={() => handleKeepDeposit(c)}>Keep</button><button style={{ ...S.smallBtn, color: "#16a34a" }} onClick={() => handleReturnDeposit(c.id)}>Return</button></>}
                {isAdmin && <button style={{ ...S.smallBtn, color: "#dc2626" }} onClick={() => handleDelete(c.id)}>Del</button>}
              </div></td></tr>); })}</tbody></table></div>
    </div>
  );
}

/* ═══════ EXPENSES ═══════ */
function Expenses({ data, db, profile, timeRange, setTimeRange }) {
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { description: "", amount: "", date: today(), category: "Fuel", vehicleId: "", paidFrom: "cash", notes: "" };
  const [form, setForm] = useState(emptyForm); const isAdmin = profile?.role === "admin";
  const expCats = ["Fuel", "Maintenance", "Insurance", "Rent", "Utilities", "Salary", "Marketing", "Parts", "Tires", "Oil Change", "Registration", "Other"];

  const handleSave = async () => { if (!form.description || !form.amount) return; await db.addExpense(form); setForm(emptyForm); setShowForm(false); };
  const handleDelete = async (id) => { if (confirm("Delete expense?")) await db.deleteExpense(id); };

  const filtered = data.expenses.filter((e) => isInRange(e.date, timeRange));
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const globalTotal = filtered.filter(e => !e.vehicle_id).reduce((s, e) => s + Number(e.amount), 0);
  const vehicleTotal = filtered.filter(e => e.vehicle_id).reduce((s, e) => s + Number(e.amount), 0);
  const cashPaid = filtered.filter(e => e.paid_from !== "bank").reduce((s, e) => s + Number(e.amount), 0);
  const bankPaid = filtered.filter(e => e.paid_from === "bank").reduce((s, e) => s + Number(e.amount), 0);
  const catTotals = {}; filtered.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount); });

  return (
    <div>
      <div style={S.sectionHeader}><h3 style={{ margin: 0, color: "#e0e0e8" }}>Expenses Tracker</h3><button style={S.primaryBtn} onClick={() => { setForm(emptyForm); setShowForm(true); }}>+ Add Expense</button></div>
      <TimeFilter value={timeRange} onChange={setTimeRange} />
      <div style={S.statGrid}>
        <StatCard label="Total Expenses" value={currency(total)} accent="#dc2626" />
        <StatCard label="Global (Office)" value={currency(globalTotal)} accent="#7c3aed" />
        <StatCard label="Per-Vehicle" value={currency(vehicleTotal)} accent="#E81224" />
        <StatCard label="Paid from Cash" value={currency(cashPaid)} accent="#f59e0b" />
        <StatCard label="Paid from Bank" value={currency(bankPaid)} accent="#0891b2" />
      </div>
      {showForm && (<Modal title="Add Expense" onClose={() => setShowForm(false)}>
        <Inp label="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Oil change Honda PCX" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Inp label="Amount (MAD) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><Inp label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <Inp label="Category" type="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{expCats.map((c) => <option key={c} value={c}>{c}</option>)}</Inp>
        <Inp label="Vehicle (optional)" type="select" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}><option value="">Global / Office Expense</option>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Inp>
        <Inp label="Paid From" type="select" value={form.paidFrom} onChange={(e) => setForm({ ...form, paidFrom: e.target.value })}><option value="cash">💵 Cash Register</option><option value="bank">🏦 Bank Account</option></Inp>
        <Inp label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button style={S.primaryBtn} onClick={handleSave}>Add Expense</button></Modal>)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div style={S.card}><h4 style={S.cardTitle}>By Category</h4>
          {Object.keys(catTotals).length === 0 && <p style={S.empty}>No expenses in this period</p>}
          <BarChart items={Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ label: cat, value: amt }))} colorFrom="#dc2626" colorTo="#f87171" /></div>
        <div style={S.card}><h4 style={S.cardTitle}>Recent Expenses</h4>
          {filtered.slice(0, 8).map((e) => (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e2a", fontSize: 13 }}>
            <div><div style={{ fontWeight: 600, color: "#e0e0e8" }}>{e.description}</div><div style={{ fontSize: 11, color: "#666" }}>{e.date} · {e.category} {e.vehicle_id && `· ${data.vehicles.find(v => v.id === e.vehicle_id)?.name || ""}`} · <span style={{ color: e.paid_from === "bank" ? "#0891b2" : "#f59e0b" }}>{e.paid_from === "bank" ? "🏦 Bank" : "💵 Cash"}</span></div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "'Space Mono', monospace", color: "#dc2626", fontSize: 13 }}>-{currency(e.amount)}</span>
              {isAdmin && <button style={{ ...S.smallBtn, color: "#dc2626", padding: "2px 6px", fontSize: 11 }} onClick={() => handleDelete(e.id)}>✕</button>}</div></div>))}</div>
      </div>
    </div>
  );
}

/* ═══════ REVENUE ═══════ */
function RevenueTab({ data, db, profile, timeRange, setTimeRange }) {
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { description: "", amount: "", date: today(), vehicleId: "", contractId: "", source: "Rental" };
  const [form, setForm] = useState(emptyForm); const isAdmin = profile?.role === "admin";

  const handleSave = async () => { if (!form.amount) return; await db.addRevenue(form); setForm(emptyForm); setShowForm(false); };
  const handleDelete = async (id) => { if (confirm("Delete revenue?")) await db.deleteRevenue(id); };

  const filtered = data.revenue.filter((r) => isInRange(r.date, timeRange));
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const totalDepositsKept = filtered.filter(r => r.source === "Deposit Kept").reduce((s, r) => s + Number(r.amount), 0);
  const totalRentals = total - totalDepositsKept;
  const vRevMap = {}; const vDepKeptMap = {};
  filtered.forEach(r => { if (r.vehicle_id) { vRevMap[r.vehicle_id] = (vRevMap[r.vehicle_id] || 0) + Number(r.amount); if (r.source === "Deposit Kept") vDepKeptMap[r.vehicle_id] = (vDepKeptMap[r.vehicle_id] || 0) + Number(r.amount); } });
  const vehicleRevEntries = data.vehicles.map(v => ({ ...v, rev: vRevMap[v.id] || 0, depKept: vDepKeptMap[v.id] || 0 })).sort((a, b) => b.rev - a.rev);

  return (
    <div>
      <div style={S.sectionHeader}><h3 style={{ margin: 0, color: "#e0e0e8" }}>Revenue Tracker</h3><button style={S.primaryBtn} onClick={() => { setForm(emptyForm); setShowForm(true); }}>+ Add Revenue</button></div>
      <TimeFilter value={timeRange} onChange={setTimeRange} />
      <div style={S.statGrid}>
        <StatCard label="Total Revenue" value={currency(total)} accent="#16a34a" />
        <StatCard label="From Rentals" value={currency(totalRentals)} accent="#0891b2" />
        <StatCard label="Deposits Kept" value={currency(totalDepositsKept)} accent="#be185d" sub="From damage claims" />
        <StatCard label="Avg per Entry" value={currency(filtered.length ? total / filtered.length : 0)} accent="#E81224" />
      </div>
      {showForm && (<Modal title="Add Revenue" onClose={() => setShowForm(false)}>
        <Inp label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. 3-day rental Honda PCX" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Inp label="Amount (MAD) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><Inp label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <Inp label="Vehicle" type="select" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}><option value="">-- No specific vehicle --</option>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Inp>
        <Inp label="Source" type="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{["Rental", "Deposit Kept", "Late Fee", "Damage Fee", "Other"].map(s => <option key={s} value={s}>{s}</option>)}</Inp>
        <button style={S.primaryBtn} onClick={handleSave}>Add Revenue</button></Modal>)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div style={S.card}><h4 style={S.cardTitle}>Revenue per Vehicle</h4>
          {vehicleRevEntries.length === 0 && <p style={S.empty}>Add vehicles and revenue</p>}
          <BarChart items={vehicleRevEntries.map(v => ({ label: v.name, value: v.rev, sub: `Rentals: ${currency(v.rev - v.depKept)}${v.depKept > 0 ? ` · Deposits kept: ${currency(v.depKept)}` : ""}` }))} colorFrom="#16a34a" colorTo="#4ade80" /></div>
        <div style={S.card}><h4 style={S.cardTitle}>Recent Revenue</h4>
          {filtered.slice(0, 8).map((r) => (<div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e2a", fontSize: 13 }}>
            <div><div style={{ fontWeight: 600, color: "#e0e0e8" }}>{r.source === "Deposit Kept" && <span style={{ ...S.badge, background: "#2a1020", color: "#be185d", marginRight: 6, fontSize: 9 }}>DEPOSIT KEPT</span>}{r.description || r.source}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{r.date} {r.vehicle_id && `· ${data.vehicles.find(v => v.id === r.vehicle_id)?.name || ""}`}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "'Space Mono', monospace", color: "#16a34a", fontSize: 13 }}>+{currency(r.amount)}</span>
              {isAdmin && <button style={{ ...S.smallBtn, color: "#dc2626", padding: "2px 6px", fontSize: 11 }} onClick={() => handleDelete(r.id)}>✕</button>}</div></div>))}</div>
      </div>
    </div>
  );
}

/* ═══════ CASH & BANK ═══════ */
function CashBank({ data, db, profile, timeRange, setTimeRange }) {
  const [showForm, setShowForm] = useState(false); const [formType, setFormType] = useState("deposit");
  const emptyForm = { amount: "", date: today(), description: "", reference: "" };
  const [form, setForm] = useState(emptyForm); const isAdmin = profile?.role === "admin";
  const ops = data.cashOps;
  const cashBalance = ops.reduce((s, op) => { if (op.type === "in" || op.type === "withdrawal") return s + Number(op.amount); if (op.type === "out" || op.type === "deposit") return s - Number(op.amount); return s; }, 0);
  const totalDeposited = ops.filter(o => o.type === "deposit").reduce((s, o) => s + Number(o.amount), 0);
  const totalWithdrawn = ops.filter(o => o.type === "withdrawal").reduce((s, o) => s + Number(o.amount), 0);
  const bankBalance = totalDeposited - totalWithdrawn;
  const totalCashIn = ops.filter(o => o.type === "in").reduce((s, o) => s + Number(o.amount), 0);
  const totalCashOut = ops.filter(o => o.type === "out").reduce((s, o) => s + Number(o.amount), 0);

  const handleSave = async () => { if (!form.amount) return; await db.addCashOp({ ...form, type: formType }); setForm(emptyForm); setShowForm(false); };
  const handleDelete = async (id) => { if (confirm("Delete transaction?")) await db.deleteCashOp(id); };
  const filteredOps = ops.filter(o => isInRange(o.date, timeRange));

  return (
    <div>
      <div style={S.sectionHeader}><h3 style={{ margin: 0, color: "#e0e0e8" }}>Cash Register & Bank</h3>
        <div style={{ display: "flex", gap: 8 }}><button style={S.primaryBtn} onClick={() => { setFormType("deposit"); setForm(emptyForm); setShowForm(true); }}>🏦 Bank Deposit</button>
          <button style={{ ...S.primaryBtn, background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }} onClick={() => { setFormType("withdrawal"); setForm(emptyForm); setShowForm(true); }}>💵 Withdrawal</button></div></div>
      <TimeFilter value={timeRange} onChange={setTimeRange} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
        <div style={{ background: "linear-gradient(135deg, #1a0a0c, #3a1015)", borderRadius: 14, padding: 24, color: "#fff", border: "1px solid #E8122433" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, opacity: .7 }}>Cash Register Balance</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Mono', monospace", marginTop: 8 }}>{currency(cashBalance)}</div>
          <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 13, opacity: .8, flexWrap: "wrap" }}><span>↑ In: {currency(totalCashIn)}</span><span>↓ Out: {currency(totalCashOut)}</span><span>→ Deposited: {currency(totalDeposited)}</span></div></div>
        <div style={{ background: "linear-gradient(135deg, #0a1a10, #0f2a18)", borderRadius: 14, padding: 24, color: "#fff", border: "1px solid #16a34a33" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, opacity: .7 }}>Bank Balance (est.)</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Mono', monospace", marginTop: 8 }}>{currency(bankBalance)}</div>
          <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 13, opacity: .8, flexWrap: "wrap" }}><span>Deposited: {currency(totalDeposited)}</span><span>Withdrawn: {currency(totalWithdrawn)}</span></div></div>
      </div>
      {showForm && (<Modal title={formType === "deposit" ? "Bank Deposit" : "Bank Withdrawal"} onClose={() => setShowForm(false)}>
        <div style={{ background: formType === "deposit" ? "#152a1a" : "#1a152a", border: `1px solid ${formType === "deposit" ? "#2a5c3a" : "#3a2a5c"}`, borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: "#c0c0c8" }}>
          {formType === "deposit" ? "Transfer cash from register → bank." : "Withdraw from bank → cash register."}</div>
        <Inp label="Amount (MAD) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Inp label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <Inp label="Reference / Receipt #" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        <Inp label="Notes" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button style={S.primaryBtn} onClick={handleSave}>Confirm {formType === "deposit" ? "Deposit" : "Withdrawal"}</button></Modal>)}
      <div style={{ ...S.card, marginTop: 20 }}><h4 style={S.cardTitle}>Transaction Log</h4>
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          {filteredOps.length === 0 && <p style={S.empty}>No transactions in this period.</p>}
          {filteredOps.map((op) => { const isPositive = op.type === "in" || op.type === "withdrawal"; const icon = op.type === "in" ? "💵" : op.type === "out" ? "📤" : op.type === "deposit" ? "🏦" : "🔄"; const typeLabel = op.type === "in" ? "Cash In" : op.type === "out" ? "Cash Out" : op.type === "deposit" ? "→ Bank" : "← Bank";
            return (<div key={op.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e1e2a" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 20 }}>{icon}</span>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e8" }}>{op.description || typeLabel}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{op.date} · <span style={{ color: isPositive ? "#16a34a" : op.type === "deposit" ? "#7c3aed" : "#dc2626" }}>{typeLabel}</span>{op.reference && ` · Ref: ${op.reference}`}</div></div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 600, color: isPositive ? "#16a34a" : op.type === "deposit" ? "#7c3aed" : "#dc2626" }}>{isPositive ? "+" : "−"}{currency(op.amount)}</span>
                {isAdmin && (op.type === "deposit" || op.type === "withdrawal") && <button style={{ ...S.smallBtn, color: "#dc2626", padding: "2px 6px", fontSize: 11 }} onClick={() => handleDelete(op.id)}>✕</button>}</div></div>); })}</div></div>
    </div>
  );
}

/* ═══════ MAIN APP ═══════ */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [timeRange, setTimeRange] = useState("month");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => { if (data) setProfile(data); });
    } else { setProfile(null); }
  }, [session]);

  const user = session?.user;
  const db = useSupabaseData(user);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (authLoading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0e0e14", fontFamily: "'Inter', sans-serif", color: "#666" }}>Loading...</div>;
  if (!session) return <LoginPage />;

  return (
    <div style={S.root}>
      <style>{`
        option { background: #111118; color: #e0e0e8; }
        select option:checked { background: #E81224; color: #fff; }
        input::placeholder, textarea::placeholder { color: #555 !important; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0e0e14; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: #E81224; }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ ...S.sidebar, width: sidebarOpen ? 230 : 60 }}>
        <div style={S.logoArea}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="17" fill="#111118" stroke="#E81224" strokeWidth="2"/><path d="M8 22 L14 14 L18 18 L24 10 L28 14" stroke="#E81224" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M22 10 L28 14 L24 14" stroke="#E81224" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          {sidebarOpen && <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}><span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 2, whiteSpace: "nowrap" }}><span style={{ color: "#E81224" }}>BB</span> MOTO</span><span style={{ fontSize: 9, color: "#c0c0c8", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 3, textTransform: "uppercase" }}>Tanger</span></div>}
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={S.collapseBtn}>{sidebarOpen ? "◀" : "▶"}</button>
        <nav style={{ marginTop: 24, flex: 1 }}>
          {TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} style={{ ...S.navBtn, ...(tab === t.id ? S.navBtnActive : {}), justifyContent: sidebarOpen ? "flex-start" : "center" }}><span style={{ fontSize: 18 }}>{t.icon}</span>{sidebarOpen && <span style={{ marginLeft: 10 }}>{t.label}</span>}</button>))}
        </nav>
        {sidebarOpen && (
          <div style={{ borderTop: "1px solid #1e1e2a", paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{profile?.full_name || user?.email}</div>
            <div style={{ fontSize: 10, color: "#E81224", textTransform: "uppercase", fontWeight: 700, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 1, marginBottom: 8 }}>{profile?.role || "agent"}</div>
            <button onClick={handleLogout} style={S.resetBtn}>Sign Out</button>
          </div>
        )}
      </div>
      <div style={S.main}>
        <div style={S.topBar}>
          <h2 style={{ margin: 0, fontSize: 20, color: "#f0f0f5", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: .5 }}>{TABS.find((t) => t.id === tab)?.icon} {TABS.find((t) => t.id === tab)?.label}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {db.loading && <span style={{ fontSize: 12, color: "#E81224" }}>Syncing...</span>}
            <div style={{ fontSize: 12, color: "#666", fontFamily: "'Space Mono', monospace" }}>{new Date().toLocaleDateString("en-MA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
        </div>
        <div style={S.content}>
          {tab === "dashboard" && <Dashboard data={db.data} timeRange={timeRange} setTimeRange={setTimeRange} />}
          {tab === "fleet" && <Fleet data={db.data} db={db} profile={profile} />}
          {tab === "contracts" && <Contracts data={db.data} db={db} profile={profile} />}
          {tab === "expenses" && <Expenses data={db.data} db={db} profile={profile} timeRange={timeRange} setTimeRange={setTimeRange} />}
          {tab === "revenue" && <RevenueTab data={db.data} db={db} profile={profile} timeRange={timeRange} setTimeRange={setTimeRange} />}
          {tab === "cash" && <CashBank data={db.data} db={db} profile={profile} timeRange={timeRange} setTimeRange={setTimeRange} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════ STYLES ═══════ */
const S = {
  root: { display: "flex", height: "100vh", fontFamily: "'Inter', sans-serif", background: "#0e0e14", color: "#e0e0e8", overflow: "hidden" },
  sidebar: { background: "#111118", display: "flex", flexDirection: "column", padding: "20px 12px", transition: "width .25s ease", flexShrink: 0, overflow: "hidden", borderRight: "1px solid #1e1e2a" },
  logoArea: { display: "flex", alignItems: "center", gap: 10, padding: "0 4px" },
  collapseBtn: { background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, marginTop: 12, textAlign: "center" },
  navBtn: { display: "flex", alignItems: "center", width: "100%", padding: "10px 12px", border: "none", background: "none", color: "#888", fontSize: 14, fontFamily: "'Inter', sans-serif", cursor: "pointer", borderRadius: 8, marginBottom: 4, transition: "all .15s", whiteSpace: "nowrap" },
  navBtnActive: { background: "linear-gradient(135deg, #E81224, #b30e1c)", color: "#fff", fontWeight: 600 },
  resetBtn: { background: "none", border: "1px solid #E8122433", color: "#E81224", padding: "8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif", width: "100%" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", background: "#141420", borderBottom: "1px solid #1e1e2a" },
  content: { flex: 1, overflow: "auto", padding: 28 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 16 },
  statCard: { background: "#16161f", borderRadius: 10, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.3)", border: "1px solid #1e1e2a" },
  statLabel: { fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 },
  statValue: { fontSize: 26, fontWeight: 700, color: "#f0f0f5", marginTop: 4, fontFamily: "'Space Mono', monospace" },
  card: { background: "#16161f", borderRadius: 10, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.3)", border: "1px solid #1e1e2a" },
  cardTitle: { margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e0e0e8", fontFamily: "'Rajdhani', sans-serif", letterSpacing: .5 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  primaryBtn: { background: "linear-gradient(135deg, #E81224, #b30e1c)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", whiteSpace: "nowrap", letterSpacing: .5, textTransform: "uppercase" },
  smallBtn: { background: "none", border: "1px solid #2a2a3a", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#999", fontFamily: "'Inter', sans-serif" },
  filterRow: { display: "flex", gap: 8, marginTop: 12 },
  filterBtn: { background: "#16161f", border: "1px solid #2a2a3a", padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", color: "#888", fontFamily: "'Inter', sans-serif", transition: "all .15s" },
  filterBtnActive: { background: "#E81224", color: "#fff", borderColor: "#E81224" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#1a1a24", borderRadius: 14, width: "90%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.5)", border: "1px solid #2a2a3a" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #2a2a3a" },
  modalBody: { padding: 20 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#666" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box", background: "#111118", color: "#e0e0e8" },
  textarea: { width: "100%", padding: "9px 12px", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", minHeight: 70, resize: "vertical", boxSizing: "border-box", background: "#111118", color: "#e0e0e8" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: .5, fontFamily: "'Rajdhani', sans-serif" },
  tableWrap: { overflowX: "auto", background: "#16161f", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,.3)", border: "1px solid #1e1e2a" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: .5, borderBottom: "2px solid #2a2a3a", whiteSpace: "nowrap", fontFamily: "'Rajdhani', sans-serif" },
  td: { padding: "10px 14px", borderBottom: "1px solid #1e1e2a", verticalAlign: "top" },
  badge: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: "capitalize", display: "inline-block" },
  tag: { background: "#1e1e2a", padding: "2px 8px", borderRadius: 4, fontSize: 11, color: "#999" },
  vehicleCard: { background: "#16161f", borderRadius: 10, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.3)", border: "1px solid #1e1e2a" },
  empty: { color: "#555", fontSize: 13, fontStyle: "italic" },
};
