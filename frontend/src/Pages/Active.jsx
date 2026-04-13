import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import {
  TrendingUp, Users, Zap, DollarSign, Activity,
  RefreshCw, AlertCircle, BarChart2, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Minus, Award
} from "lucide-react";
import {
  getRevenueSummary,
  getRevenueTrend,
  getTopCustomers,
  getOrdersByDay,
  getAvgOrderValue,
  getStaffSummary,
  getStaffRevenue,
  getStaffPerformance,
  getStaffCollectionEfficiency,
  getCashFlowSummary,
  getReceivablesAging,
  getDsoTrend,
  getCashFlowForecast,
  getAIInsights,
  getCustomerSegmentation
} from "../controllers/Analytics.controller";
import { 
  MessageSquare, Clock, Target, Cpu, AlertTriangle, 
  HelpCircle, ChevronRight, CheckCircle2, Search, FileText
} from "lucide-react";

// ─── Utility ──────────────────────────────────────────────────────────────────
const formatINR = (val) => {
  if (!val && val !== 0) return "₹0";
  const absVal = Math.abs(val);
  if (absVal >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (absVal >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  if (absVal >= 1000)     return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString("en-IN")}`;
};

// ─── Color palette (matches reference dark theme) ────────────────────────────
const COLORS = {
  memo:    "#F5A623",   // warm gold  — Memo line
  invoice: "#4A90D9",   // blue       — Invoice DC line
  b2b:     "#50E3A4",   // teal green — B2B line
  aov:     "#50E3A4",
  bars:    "#F5A623",
};

const DONUT_COLORS = ["#4A90D9","#50E3A4","#9B59B6","#E74C3C","#F5A623","#636E72"];

// ─── Shared styles (avoids Tailwind reliance for dark theme specifics) ────────
const cardStyle = {
  background: "#1A1D2E",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "20px 24px",
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const Skeleton = ({ h = 40, w = "100%", radius = 8 }) => (
  <div
    style={{
      height: h, width: w, borderRadius: radius,
      background: "linear-gradient(90deg,#1e2236 25%,#252840 50%,#1e2236 75%)",
      backgroundSize: "400% 100%",
      animation: "shimmer 1.4s infinite",
    }}
  />
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, sub, growth, icon: Icon, loading, error }) => {
  const growthColor = growth > 0 ? "#50E3A4" : growth < 0 ? "#E74C3C" : "#8a8fa8";
  const GrowthIcon  = growth > 0 ? ArrowUpRight : growth < 0 ? ArrowDownRight : Minus;

  return (
    <div style={cardStyle}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", color:"#8a8fa8", textTransform:"uppercase" }}>
          {title}
        </span>
        <div style={{ background:"rgba(245,166,35,0.12)", borderRadius:8, padding:"5px 7px", display:"flex" }}>
          {Icon && <Icon size={14} color={COLORS.memo} />}
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 6 }}><Skeleton h={36} /><Skeleton h={16} w="60%" radius={4} /></div>
      ) : error ? (
        <div style={{ color: "#E74C3C", fontSize: 13 }}>Error loading data</div>
      ) : (
        <>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px", margin: "4px 0" }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 2 }}>{sub}</div>
          )}
          {growth !== undefined && growth !== null && (
            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:6, fontSize:12, fontWeight:600, color:growthColor }}>
              <GrowthIcon size={14} />
              {Math.abs(growth)}% vs last month
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Error Banner ─────────────────────────────────────────────────────────────
const ErrorBanner = ({ msg }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
    background:"rgba(231,76,60,0.12)", border:"1px solid rgba(231,76,60,0.3)",
    borderRadius:8, color:"#E74C3C", fontSize:13 }}>
    <AlertCircle size={14} />
    {msg}
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#141625", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:8, padding:"10px 14px", fontSize:12 }}>
      <div style={{ color:"#8a8fa8", marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:p.color, display:"inline-block" }} />
          <span style={{ color:"#ccc" }}>{p.name}:</span>
          <span style={{ fontWeight:700 }}>{typeof p.value === "number" && p.value > 1000 ? formatINR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Custom Donut Label ───────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.45;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#ccc" fontSize={11} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {`${name} ${value}%`}
    </text>
  );
};

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab() {
  const [summary,    setSummary]    = useState(null);
  const [trend,      setTrend]      = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [dayOrders,  setDayOrders]  = useState([]);
  const [aovTrend,   setAovTrend]   = useState([]);

  const [loadingMap, setLoadingMap] = useState({
    summary: true, trend: true, customers: true, dayOrders: true, aov: true
  });
  const [errorMap,   setErrorMap]   = useState({});

  const setLoading = (key, v) => setLoadingMap(p => ({ ...p, [key]: v }));
  const setError   = (key, v) => setErrorMap(p => ({ ...p, [key]: v }));

  const fetchAll = useCallback(async () => {
    setLoadingMap({ summary:true, trend:true, customers:true, dayOrders:true, aov:true });
    setErrorMap({});

    const safe = async (key, fn, setter) => {
      try {
        const data = await fn();
        if (data?.success) setter(data.data ?? data);
        else throw new Error(data?.message || "API error");
      } catch (e) {
        setError(key, e.message);
      } finally {
        setLoading(key, false);
      }
    };

    await Promise.all([
      safe("summary",   getRevenueSummary,  setSummary),
      safe("trend",     getRevenueTrend,    setTrend),
      safe("customers", getTopCustomers,    setCustomers),
      safe("dayOrders", getOrdersByDay,     setDayOrders),
      safe("aov",       getAvgOrderValue,   setAovTrend),
    ]);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const anyLoading = Object.values(loadingMap).some(Boolean);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Refresh button ───────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button
          onClick={fetchAll}
          disabled={anyLoading}
          style={{
            display:"flex", alignItems:"center", gap:6,
            background:"rgba(245,166,35,0.12)", border:"1px solid rgba(245,166,35,0.3)",
            color: COLORS.memo, padding:"7px 14px", borderRadius:8,
            fontSize:12, fontWeight:600, cursor:"pointer",
            opacity: anyLoading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: anyLoading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:16 }}>
        <KpiCard
          title="Monthly Revenue"
          value={summary ? formatINR(summary.monthlyRevenue) : "—"}
          growth={summary?.growth}
          icon={TrendingUp}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
        <KpiCard
          title="Memo DC Revenue"
          value={summary ? formatINR(summary.memoRevenue) : "—"}
          sub={summary ? `${summary.monthlyRevenue > 0 ? ((summary.memoRevenue/summary.monthlyRevenue)*100).toFixed(1) : 0}% of total` : ""}
          icon={Activity}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
        <KpiCard
          title="Invoice DC Revenue"
          value={summary ? formatINR(summary.invoiceDcRevenue) : "—"}
          sub={summary ? `${summary.monthlyRevenue > 0 ? ((summary.invoiceDcRevenue/summary.monthlyRevenue)*100).toFixed(1) : 0}% of total` : ""}
          icon={BarChart2}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
        <KpiCard
          title="B2B Invoice Revenue"
          value={summary ? formatINR(summary.b2bRevenue) : "—"}
          sub={summary ? `${summary.monthlyRevenue > 0 ? ((summary.b2bRevenue/summary.monthlyRevenue)*100).toFixed(1) : 0}% of total` : ""}
          icon={DollarSign}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
      </div>

      {/* ── Revenue Trend + Concentration ────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Revenue Trend Chart */}
        <div style={cardStyle}>
          <div style={{ marginBottom:16 }}>
            <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>Revenue Trend — Memo vs Invoice vs B2B</div>
            <div style={{ color:"#8a8fa8", fontSize:12, marginTop:2 }}>Last 6 months</div>
          </div>

          {loadingMap.trend ? (
            <Skeleton h={220} />
          ) : errorMap.trend ? (
            <ErrorBanner msg={errorMap.trend} />
          ) : trend.length === 0 ? (
            <div style={{ color:"#8a8fa8", textAlign:"center", padding:"60px 0", fontSize:13 }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <defs>
                  <linearGradient id="memoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.memo} stopOpacity={0.3}/>
                    <stop offset="100%" stopColor={COLORS.memo} stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill:"#8a8fa8", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatINR(v)} tick={{ fill:"#8a8fa8", fontSize:10 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize:11, color:"#8a8fa8", paddingTop:8 }}
                  formatter={(v) => <span style={{ color:"#ccc" }}>{v}</span>}
                />
                <Line type="monotone" dataKey="Memo"    stroke={COLORS.memo}    strokeWidth={2.5} dot={{ r:3, fill:COLORS.memo }}    activeDot={{ r:5 }} />
                <Line type="monotone" dataKey="Invoice" stroke={COLORS.invoice} strokeWidth={2.5} dot={{ r:3, fill:COLORS.invoice }} activeDot={{ r:5 }} />
                <Line type="monotone" dataKey="B2B"     stroke={COLORS.b2b}     strokeWidth={2.5} dot={{ r:3, fill:COLORS.b2b }}     activeDot={{ r:5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue Concentration Donut */}
        <div style={cardStyle}>
          <div style={{ marginBottom:16 }}>
            <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>Revenue Concentration</div>
            <div style={{ color:"#8a8fa8", fontSize:12, marginTop:2 }}>Top 5 customers</div>
          </div>

          {loadingMap.customers ? (
            <Skeleton h={220} />
          ) : errorMap.customers ? (
            <ErrorBanner msg={errorMap.customers} />
          ) : customers.length === 0 ? (
            <div style={{ color:"#8a8fa8", textAlign:"center", padding:"60px 0", fontSize:13 }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={customers}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {customers.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name, props) => [`${v}% (${formatINR(props.payload.revenue)})`, props.payload.name]}
                  contentStyle={{ background:"#141625", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:12 }}
                  itemStyle={{ color:"#ccc" }}
                  labelStyle={{ color:"#fff", display:"none" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Orders by Day + AOV Trend ─────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Orders by Day of Week */}
        <div style={cardStyle}>
          <div style={{ marginBottom:16 }}>
            <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>Orders by Day of Week</div>
            <div style={{ color:"#8a8fa8", fontSize:12, marginTop:2 }}>Helps plan staffing</div>
          </div>

          {loadingMap.dayOrders ? (
            <Skeleton h={200} />
          ) : errorMap.dayOrders ? (
            <ErrorBanner msg={errorMap.dayOrders} />
          ) : dayOrders.every(d => d.orders === 0) ? (
            <div style={{ color:"#8a8fa8", textAlign:"center", padding:"60px 0", fontSize:13 }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayOrders} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill:"#8a8fa8", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#8a8fa8", fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="orders" fill={COLORS.bars} radius={[5,5,0,0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Avg Order Value Trend */}
        <div style={cardStyle}>
          <div style={{ marginBottom:16 }}>
            <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>Avg Order Value Trend</div>
            <div style={{ color:"#8a8fa8", fontSize:12, marginTop:2 }}>Last 6 months</div>
          </div>

          {loadingMap.aov ? (
            <Skeleton h={200} />
          ) : errorMap.aov ? (
            <ErrorBanner msg={errorMap.aov} />
          ) : aovTrend.every(d => d.aov === 0) ? (
            <div style={{ color:"#8a8fa8", textAlign:"center", padding:"60px 0", fontSize:13 }}>No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={aovTrend} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill:"#8a8fa8", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatINR(v)} tick={{ fill:"#8a8fa8", fontSize:10 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<DarkTooltip />} />
                <Line
                  type="monotone" dataKey="aov" name="AOV"
                  stroke={COLORS.aov} strokeWidth={2.5}
                  dot={{ r:4, fill:COLORS.aov, stroke:"#141625", strokeWidth:2 }}
                  activeDot={{ r:6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Staff Tab Components ──────────────────────────────────────────────────
const StaffPerformerCard = ({ staff, rank, loading }) => {
  if (loading) {
    return <div style={{ ...cardStyle, flex: 1 }}><Skeleton h={100} /></div>;
  }
  const medalColor = rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : null;

  return (
    <div style={{
      ...cardStyle, flex: 1, position: "relative", textAlign: "center",
      border: rank <= 3 ? `1px solid ${medalColor}44` : cardStyle.border,
      background: rank <= 3 ? `linear-gradient(180deg, ${medalColor}11 0%, #1A1D2E 100%)` : "#1A1D2E"
    }}>
      {rank <= 3 && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#1A1D2E", padding: "0 8px" }}>
          <Award size={24} color={medalColor} fill={medalColor + "33"} />
        </div>
      )}
      <div style={{ marginTop: rank <= 3 ? 12 : 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>{staff.name}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.memo, margin: "8px 0" }}>{formatINR(staff.revenue)}</div>
      <div style={{ fontSize: 11, color: "#8a8fa8" }}>
        {staff.orders} orders · AOV {formatINR(staff.aov)}
      </div>
    </div>
  );
};

function StaffTab() {
  const [summary, setSummary] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [performance, setPerformance] = useState({ radarData: [], staffNames: [] });
  const [efficiency, setEfficiency] = useState([]);

  const [loadingMap, setLoadingMap] = useState({ summary: true, revenue: true, performance: true, efficiency: true });
  const [errorMap, setErrorMap] = useState({});

  const setLoading = (key, v) => setLoadingMap(p => ({ ...p, [key]: v }));
  const setError = (key, v) => setErrorMap(p => ({ ...p, [key]: v }));

  const fetchStaffData = useCallback(async () => {
    setLoadingMap({ summary: true, revenue: true, performance: true, efficiency: true });
    setErrorMap({});

    const safe = async (key, fn, setter) => {
      try {
        const res = await fn();
        if (res?.success) setter(res.data ?? res);
        else throw new Error(res?.message || "API error");
      } catch (e) {
        setError(key, e.message);
      } finally {
        setLoading(key, false);
      }
    };

    await Promise.all([
      safe("summary", getStaffSummary, setSummary),
      safe("revenue", getStaffRevenue, setRevenue),
      safe("performance", getStaffPerformance, setPerformance),
      safe("efficiency", getStaffCollectionEfficiency, setEfficiency),
    ]);
  }, []);

  useEffect(() => { fetchStaffData(); }, [fetchStaffData]);

  const anyLoading = Object.values(loadingMap).some(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header / Refresh */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={fetchStaffData}
          disabled={anyLoading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)",
            color: COLORS.memo, padding: "7px 14px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            opacity: anyLoading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: anyLoading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Top Performers Cards */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {loadingMap.summary ? [1, 2, 3, 4, 5].map(i => <StaffPerformerCard key={i} loading />) :
          summary.slice(0, 5).map((s, i) => <StaffPerformerCard key={s.name} staff={s} rank={i + 1} />)}
        {!loadingMap.summary && summary.length === 0 && (
          <div style={{ ...cardStyle, width: "100%", textAlign: "center", color: "#8a8fa8" }}>No staff performance data</div>
        )}
      </div>

      {/* Middle Grid: Revenue Comparison & Radar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Revenue Comparison (Horizontal Bar Chart) */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Staff Revenue Comparison</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>This month</div>
          </div>
          {loadingMap.revenue ? <Skeleton h={250} /> : errorMap.revenue ? <ErrorBanner msg={errorMap.revenue} /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenue} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: "#8a8fa8", fontSize: 12 }} width={80} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="revenue" fill={COLORS.bars} radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Radar Chart */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Performance Radar</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>Multi-dimensional comparison (Top 3)</div>
          </div>
          {loadingMap.performance ? <Skeleton h={250} /> : errorMap.performance ? <ErrorBanner msg={errorMap.performance} /> : (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={performance.radarData || []}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#8a8fa8", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip content={<DarkTooltip />} />
                {(performance.staffNames || []).map((name, i) => (
                  <Radar
                    key={name} name={name} dataKey={name}
                    stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                    fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))}
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Collection Efficiency */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Collection Efficiency by Staff</div>
          <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>% of receivables collected on time</div>
        </div>
        {loadingMap.efficiency ? <Skeleton h={80} /> : errorMap.efficiency ? <ErrorBanner msg={errorMap.efficiency} /> : (
          <div style={{ display: "flex", gap: 32, overflowX: "auto", paddingBottom: 8 }}>
            {efficiency.slice(0, 5).map(s => {
              const color = s.efficiency >= 90 ? "#50E3A4" : s.efficiency >= 75 ? "#F5A623" : "#E74C3C";
              return (
                <div key={s.name} style={{ textAlign: "center", minWidth: 100 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color, marginBottom: 4 }}>{s.efficiency}%</div>
                  <div style={{ height: 6, width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${s.efficiency}%`, background: color }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{s.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CashFlowTab() {
  const [summary, setSummary]   = useState(null);
  const [aging, setAging]       = useState([]);
  const [dsoTrend, setDsoTrend] = useState([]);
  const [forecast, setForecast] = useState([]);

  const [loadingMap, setLoadingMap] = useState({ summary: true, aging: true, dso: true, forecast: true });
  const [errorMap, setErrorMap]     = useState({});

  const setLoading = (key, v) => setLoadingMap(p => ({ ...p, [key]: v }));
  const setError   = (key, v) => setErrorMap(p => ({ ...p, [key]: v }));

  const fetchData = useCallback(async () => {
    setLoadingMap({ summary: true, aging: true, dso: true, forecast: true });
    setErrorMap({});

    const safe = async (key, fn, setter) => {
      try {
        const res = await fn();
        if (res?.success) setter(res.data ?? res);
        else throw new Error(res?.message || "API error");
      } catch (e) {
        setError(key, e.message);
      } finally {
        setLoading(key, false);
      }
    };

    await Promise.all([
      safe("summary",  getCashFlowSummary,  setSummary),
      safe("aging",    getReceivablesAging, setAging),
      safe("dso",      getDsoTrend,         setDsoTrend),
      safe("forecast", getCashFlowForecast, setForecast),
    ]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const anyLoading = Object.values(loadingMap).some(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header / Refresh */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={fetchData}
          disabled={anyLoading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)",
            color: COLORS.memo, padding: "7px 14px", borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            opacity: anyLoading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: anyLoading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <KpiCard
          title="Total Receivables"
          value={summary ? formatINR(summary.totalReceivables) : "—"}
          icon={DollarSign}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
        <KpiCard
          title="Overdue (60+ Days)"
          value={summary ? formatINR(summary.overdue60) : "—"}
          sub={summary ? `${((summary.overdue60 / (summary.totalReceivables || 1)) * 100).toFixed(1)}% of total` : ""}
          icon={AlertCircle}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
        <KpiCard
          title="DSO (Days)"
          value={summary ? summary.dso : "—"}
          sub="Days Sales Outstanding"
          icon={Activity}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
        <KpiCard
          title="Collection Rate"
          value={summary ? `${summary.collectionRate}%` : "—"}
          sub="Collected vs Billed"
          icon={TrendingUp}
          loading={loadingMap.summary}
          error={errorMap.summary}
        />
      </div>

      {/* Aging + DSO Trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Receivables Aging</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>Outstanding by time bucket</div>
          </div>
          {loadingMap.aging ? <Skeleton h={220} /> : errorMap.aging ? <ErrorBanner msg={errorMap.aging} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aging} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="range" tick={{ fill: "#8a8fa8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatINR} tick={{ fill: "#8a8fa8", fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="amount" fill="#E74C3C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>DSO Trend</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>Days Sales Outstanding — last 6 months</div>
          </div>
          {loadingMap.dso ? <Skeleton h={220} /> : errorMap.dso ? <ErrorBanner msg={errorMap.dso} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dsoTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "#8a8fa8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8a8fa8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Line type="monotone" dataKey="dso" stroke={COLORS.memo} strokeWidth={2} dot={{ r: 4, fill: COLORS.memo }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cash Flow Forecast */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Cash Flow Forecast</div>
          <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>Expected collections for next 4 weeks</div>
        </div>
        {loadingMap.forecast ? <Skeleton h={200} /> : errorMap.forecast ? <ErrorBanner msg={errorMap.forecast} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "#8a8fa8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatINR} tick={{ fill: "#8a8fa8", fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="expected" fill={COLORS.b2b} radius={[4, 4, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── AI Insights Components ──────────────────────────────────────────────
const InsightCard = ({ insight }) => {
  const getColors = (type) => {
    switch (type) {
      case "critical": return { border: "#E74C3C", bg: "rgba(231,76,60,0.05)", icon: "#E74C3C", tag: "#E74C3C" };
      case "high":     return { border: "#F5A623", bg: "rgba(245,166,35,0.05)", icon: "#F5A623", tag: "#F5A623" };
      case "medium":   return { border: "#F1C40F", bg: "rgba(241,196,15,0.05)", icon: "#F1C40F", tag: "#F1C40F" };
      case "opportunity": return { border: "#3498DB", bg: "rgba(52,152,219,0.05)", icon: "#3498DB", tag: "#3498DB" };
      default:         return { border: "#8a8fa8", bg: "rgba(255,255,255,0.02)", icon: "#8a8fa8", tag: "#8a8fa8" };
    }
  };

  const colors = getColors(insight.type);
  const Icon = insight.type === "critical" ? AlertCircle : (insight.type === "high" || insight.type === "medium") ? AlertTriangle : Zap;

  return (
    <div style={{
      ...cardStyle, borderLeft: `4px solid ${colors.border}`,
      background: colors.bg, display: "flex", flexDirection: "column", gap: 12,
      transition: "transform 0.2s ease", cursor: "default"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: `${colors.border}15`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Icon size={18} color={colors.icon} />
          </div>
          <div>
            <div style={{ 
              fontSize: 10, fontWeight: 800, textTransform: "uppercase", 
              letterSpacing: "0.05em", color: colors.tag, marginBottom: 2 
            }}>
              {insight.type}
            </div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{insight.title}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#8a8fa8", fontWeight: 500 }}>
          Source: {insight.source}
        </div>
      </div>

      <div style={{ color: "#8a8fa8", fontSize: 13, lineHeight: "1.6", fontWeight: 400 }}>
        {insight.description}
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "0.03em" }}>
          RECOMMENDED ACTIONS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {insight.actions.map((action, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <ChevronRight size={14} color={colors.border} style={{ marginTop: 2 }} />
              <div style={{ color: "#d1d5db", fontSize: 12.5 }}>{action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function AiInsightsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAIInsights();
      if (res?.success) setData(res.data);
      else throw new Error(res?.message || "Failed to load AI insights");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {[1, 2, 3, 4].map(i => <div key={i} style={cardStyle}><Skeleton h={150} /></div>)}
    </div>
  );

  if (error) return <ErrorBanner msg={error} />;
  if (!data) return <div style={{ color: "#8a8fa8", textAlign: "center" }}>No insights available today.</div>;

  const { businessPulse: pulse, insights, businessHealth, revenueTrend, cashHealth, customerHealth } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── AI Business Pulse (Summary) ─────────────────────────────────── */}
      <div style={{
        ...cardStyle,
        background: "linear-gradient(135deg, #1A1D2E 0%, #111424 100%)",
        border: "1px solid rgba(245,166,35,0.15)",
        position: "relative", overflow: "hidden"
      }}>
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, background: "rgba(245,166,35,0.03)", borderRadius: "50%" }} />
        
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: "rgba(245,166,35,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Cpu size={22} color={COLORS.memo} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
              AI Business Pulse — {new Date().toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div style={{ color: "#8a8fa8", fontSize: 12 }}>Based on analysis of all performance dimensions</div>
          </div>
        </div>

        <div style={{ color: "#d1d5db", fontSize: 15, lineHeight: "1.7", marginBottom: 24, maxWidth: "900px" }}>
          Good morning! Yesterday's revenue was <span style={{ color: "#50E3A4", fontWeight: 700 }}>{formatINR(pulse.yesterdayRev)} across {pulse.yesterdayOrders} orders</span> — 
          <span style={{ color: pulse.vsAvg >= 0 ? "#50E3A4" : "#E74C3C", fontWeight: 700 }}> {Math.abs(pulse.vsAvg)}% {pulse.vsAvg >= 0 ? "above" : "below"}</span> your daily average. 
          {pulse.topPerformer !== "N/A" && <span> {pulse.topPerformer} was the top performer with {formatINR(pulse.topPerformerRev)}.</span>}
          {" "}I’ve identified <span style={{ color: "#E74C3C", fontWeight: 700 }}>{insights.filter(i => i.type === "critical").length} critical issues</span> and 
          {" "}<span style={{ color: "#3498DB", fontWeight: 700 }}>{insights.filter(i => i.type === "opportunity").length} growth opportunities</span> that need your attention. 
          Your overall business health score is <span style={{ color: COLORS.memo, fontWeight: 700 }}>{businessHealth}/100</span>.
        </div>

        {/* Pulse KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Business Health", value: `${businessHealth}/100`, color: COLORS.memo, icon: Activity },
            { label: "Revenue Trend", value: revenueTrend, color: "#50E3A4", icon: TrendingUp },
            { label: "Cash Health", value: cashHealth, color: cashHealth === "Safe" ? "#50E3A4" : cashHealth === "Watch" ? "#F1C40F" : "#E74C3C", icon: AlertTriangle },
            { label: "Customer Health", value: customerHealth, color: customerHealth === "Good" ? "#50E3A4" : customerHealth === "Watch" ? "#F1C40F" : "#E74C3C", icon: Users },
          ].map((k, i) => (
            <div key={i} style={{ 
              background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 4
            }}>
              <div style={{ color: "#8a8fa8", fontSize: 11, fontWeight: 600 }}>{k.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <k.icon size={13} color={k.color} />
                <div style={{ color: k.color, fontWeight: 800, fontSize: 18 }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Insights List ────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {insights.map((insight, idx) => (
          <InsightCard key={idx} insight={insight} />
        ))}
      </div>
      
      {/* Refresh Footer */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <button
          onClick={fetchInsights}
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            color: "#8a8fa8", padding: "8px 20px", borderRadius: 20, fontSize: 12,
            cursor: "pointer", transition: "all 0.2s"
          }}
        >
          Re-Analyze Latest Data
        </button>
      </div>
    </div>
  );
}

function CustomerTab() {
  const [data, setData] = useState({ summary: {}, customers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCustomerSegmentation();
      if (res?.success) setData(res.data);
      else throw new Error(res?.message || "Failed to load data");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={cardStyle}><Skeleton h={100} /></div>)}
      </div>
      <div style={cardStyle}><Skeleton h={400} /></div>
    </div>
  );

  if (error) return <ErrorBanner msg={error} />;

  const filtered = (data.customers || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.segment.toLowerCase().includes(search.toLowerCase())
  );

  const SEG_COLORS = {
    platinum: { border: "#A855F7", bg: "rgba(168,85,247,0.1)", icon: "#A855F7", label: "Platinum" },
    gold:     { border: "#F5A623", bg: "rgba(245,166,35,0.1)", icon: "#F5A623", label: "Gold" },
    silver:   { border: "#8a8fa8", bg: "rgba(138,143,168,0.1)", icon: "#8a8fa8", label: "Silver" },
    dormant:  { border: "#E74C3C", bg: "rgba(231,76,60,0.1)", icon: "#E74C3C", label: "Dormant" }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>
        {Object.entries(SEG_COLORS).map(([key, theme]) => {
          const stats = data.summary[key] || { count: 0, revenue: 0 };
          return (
            <div key={key} style={{
              ...cardStyle, flex: 1, minWidth: 200, borderLeft: `4px solid ${theme.border}`,
              background: `linear-gradient(135deg, ${theme.bg} 0%, #1A1D2E 100%)`
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.border }}>{theme.label}</div>
                <Award size={16} color={theme.border} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{stats.count}</div>
              <div style={{ fontSize: 11, color: "#8a8fa8", marginTop: 4 }}>
                Total Rev: <span style={{ color: "#fff", fontWeight: 600 }}>{formatINR(stats.revenue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Churn Risk Table ─────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Churn Risk & Segmentation Analysis</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 4 }}>Identifying at-risk accounts based on buying patterns</div>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} color="#8a8fa8" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px 12px 8px 32px", color: "#fff", fontSize: 13, width: 220,
                outline: "none"
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Customer Name", "Segment", "Last Order", "Usual Freq.", "Freq. Drop", "Monthly Value", "Risk Level"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 10px", fontSize: 11, color: "#8a8fa8", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const riskColor = c.risk === "High" || c.risk === "Critical" ? "#E74C3C" : c.risk === "Medium" ? "#F5A623" : "#50E3A4";
                const segTheme = SEG_COLORS[c.segment.toLowerCase()];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <td style={{ padding: "16px 10px", fontSize: 13, color: "#fff", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "16px 10px" }}>
                      <span style={{ 
                        fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 4, 
                        background: segTheme.bg, color: segTheme.icon, border: `1px solid ${segTheme.icon}33`
                      }}>
                        {c.segment}
                      </span>
                    </td>
                    <td style={{ padding: "16px 10px", fontSize: 13, color: "#d1d5db" }}>{c.lastOrderDays} days ago</td>
                    <td style={{ padding: "16px 10px", fontSize: 13, color: "#d1d5db" }}>{c.usualFrequency}d</td>
                    <td style={{ padding: "16px 10px", fontSize: 13, color: c.frequencyDrop < 0 ? "#E74C3C" : "#50E3A4" }}>
                      {c.frequencyDrop > 0 ? "+" : ""}{c.frequencyDrop}%
                    </td>
                    <td style={{ padding: "16px 10px", fontSize: 13, color: "#fff", fontWeight: 600 }}>{formatINR(c.monthlyValue)}</td>
                    <td style={{ padding: "16px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: riskColor }}>{c.risk}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "#8a8fa8", fontSize: 14 }}>
                    No customers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Additional Analytics: Retention & Credit Risk ───────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* New vs Returning Customers */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Customer Cohort Analysis</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>Retention metrics for current month</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32, padding: "10px 0" }}>
            <div style={{ position: "relative", width: 100, height: 100 }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" />
                <circle
                  cx="50" cy="50" r="40" stroke="#A855F7" strokeWidth="8" fill="none"
                  strokeDasharray={`${(data.retention?.retCount / ((data.retention?.newCount + data.retention?.retCount) || 1)) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#A855F7" }}>
                  {Math.round((data.retention?.retCount / ((data.retention?.newCount + data.retention?.retCount) || 1)) * 100)}%
                </div>
                <div style={{ fontSize: 8, color: "#8a8fa8", fontWeight: 700 }}>RETAINED</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: "#A855F7" }} />
                  <div style={{ fontSize: 13, color: "#d1d5db" }}>Returning Customers</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{data.retention?.retCount}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(255,255,255,0.1)" }} />
                  <div style={{ fontSize: 13, color: "#d1d5db" }}>New Acquisitions</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{data.retention?.newCount}</div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0" }} />
              <div style={{ fontSize: 12, color: "#8a8fa8" }}>
                New accounts generated <span style={{ color: "#50E3A4", fontWeight: 700 }}>{formatINR(data.retention?.newRev)}</span> while returning accounts contributed <span style={{ color: "#A855F7", fontWeight: 700 }}>{formatINR(data.retention?.retRev)}</span> this month.
              </div>
            </div>
          </div>
        </div>

        {/* AI Credit Risk Scorecard */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>AI Credit Risk Scorecard</div>
            <div style={{ color: "#8a8fa8", fontSize: 12, marginTop: 2 }}>Real-time credit utilization & health</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {(data.creditRisk || []).map((cr, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === 5 ? "none" : "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "10px 0", fontSize: 12.5, color: "#fff", fontWeight: 600 }}>{cr.name}</td>
                    <td style={{ padding: "10px 5px", textAlign: "right" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <div style={{ fontSize: 10, color: "#8a8fa8" }}>Utilization: {cr.utilization}%</div>
                        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ 
                            height: "100%", width: `${cr.utilization}%`, 
                            background: cr.utilization > 80 ? "#E74C3C" : cr.utilization > 50 ? "#F5A623" : "#50E3A4" 
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 0", textAlign: "right" }}>
                      <span style={{ 
                        fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                        background: cr.risk === "Critical" || cr.risk === "High" ? "rgba(231,76,60,0.1)" : "rgba(80,227,164,0.1)",
                        color: cr.risk === "Critical" || cr.risk === "High" ? "#E74C3C" : "#50E3A4",
                        border: `1px solid ${cr.risk === "Critical" || cr.risk === "High" ? "#E74C3C" : "#50E3A4"}33`
                      }}>
                        {cr.risk === "Critical" ? "AI ALERT" : cr.risk.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder Tab ──────────────────────────────────────────────────────────
function ComingSoonTab({ label }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:400, gap:16 }}>
      <div style={{ width:64, height:64, borderRadius:"50%",
        background:"rgba(245,166,35,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Zap size={28} color={COLORS.memo} />
      </div>
      <div style={{ color:"#fff", fontWeight:700, fontSize:20 }}>{label}</div>
      <div style={{ color:"#8a8fa8", fontSize:13 }}>This section is coming soon — designs in progress.</div>
    </div>
  );
}

// ─── Tab Definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id:"revenue",   label:"Revenue",    icon: TrendingUp  },
  { id:"customers", label:"Customers",  icon: Users       },
  { id:"staff",     label:"Staff",      icon: Award       },
  { id:"cashflow",  label:"Cash Flow",  icon: DollarSign  },
  { id:"insights",  label:"AI Insights",icon: Zap,  badge: true },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Active() {
  const [activeTab, setActiveTab] = useState("revenue");

  return (
    <div style={{ minHeight:"100vh", background:"#0F1120", padding:"24px 28px", fontFamily:"Inter, system-ui, sans-serif", margin:"-24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.3px" }}>
            <span style={{ color: COLORS.memo }}>Positiv</span>ERP
            <span style={{ color:"#8a8fa8", fontWeight:400, fontSize:18 }}> — Wholesale AI Analytics</span>
          </h1>
          <p style={{ margin:"4px 0 0", fontSize:12, color:"#8a8fa8" }}>
            Powered by AI · Real-time data · {new Date().toLocaleString("en-IN", { month:"long", year:"numeric" })}
          </p>
        </div>
        <div style={{
          background:"rgba(245,166,35,0.12)", border:"1px solid rgba(245,166,35,0.25)",
          borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:600, color:COLORS.memo,
          display:"flex", alignItems:"center", gap:6
        }}>
          <Activity size={13} />
          This Month
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", gap:4, marginBottom:24, padding:"4px",
        background:"rgba(255,255,255,0.04)", borderRadius:10, width:"fit-content",
        border:"1px solid rgba(255,255,255,0.07)"
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display:"flex", alignItems:"center", gap:7, padding:"8px 16px",
                borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
                transition:"all 0.18s ease",
                background: isActive ? "rgba(245,166,35,0.18)" : "transparent",
                color: isActive ? COLORS.memo : "#8a8fa8",
                outline:"none",
                position:"relative",
              }}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && (
                <span style={{
                  background: "#F5A623", color:"#0F1120",
                  fontSize:9, fontWeight:800, padding:"1px 5px",
                  borderRadius:20, lineHeight:"14px",
                  letterSpacing:"0.05em",
                }}>AI</span>
              )}
              {isActive && (
                <div style={{
                  position:"absolute", bottom:-4, left:"50%", transform:"translateX(-50%)",
                  width:20, height:2, borderRadius:2, background:COLORS.memo,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      {activeTab === "revenue"   && <RevenueTab />}
      {activeTab === "customers" && <CustomerTab />}
      {activeTab === "staff"     && <StaffTab />}
      {activeTab === "cashflow"  && <CashFlowTab />}
      {activeTab === "insights"  && <AiInsightsTab />}
    </div>
  );
}
