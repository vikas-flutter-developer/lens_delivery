import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    TrendingUp, TrendingDown, BarChart3, Users, Calendar,
    Search, RotateCcw, FileSpreadsheet, Printer,
    ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronUp, ArrowUpDown,
    Zap, Star, AlertTriangle, Info, IndianRupee,
} from 'lucide-react';
import { getSalesGrowthComparisonReport } from '../controllers/Reports.controller';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import { ChevronRight } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n || 0).toLocaleString('en-IN');

// ── Growth indicator component ──
function GrowthPill({ value, size = 'md' }) {
    if (value === null || value === undefined) {
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">N/A</span>;
    }
    const isPos = value >= 0;
    const sz = size === 'lg' ? 'text-sm px-3 py-1' : 'text-[10px] px-2 py-0.5';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full font-bold ${sz} ${isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isPos ? '+' : ''}{value}%
        </span>
    );
}

// ── Simple bar chart ──
function BarChartViz({ data, curr, prev, ly, currLabel, prevLabel, lyLabel }) {
    const maxVal = Math.max(...data.slice(0, 10).map(r => Math.max(r.currSales, r.prevSales, r.lySales)), 1);
    const top10 = data.slice(0, 10);
    return (
        <div className="space-y-3">
            {top10.map((row, i) => (
                <div key={i}>
                    <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{row.partyName}</span>
                        <GrowthPill value={row.momGrowth} />
                    </div>
                    <div className="space-y-1">
                        {[
                            { label: currLabel, val: row.currSales, color: 'bg-indigo-500' },
                            { label: prevLabel, val: row.prevSales, color: 'bg-blue-300' },
                            { label: lyLabel,   val: row.lySales,   color: 'bg-slate-300' },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 w-20 truncate">{label}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${(val / maxVal) * 100}%` }} />
                                </div>
                                <span className="text-[9px] font-bold text-slate-600 w-20 text-right">₹{fmt(val)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Summary Card ──
function SummaryCard({ label, value, sub, icon: Icon, gradient, badge, badgeColor = 'bg-white/20' }) {
    return (
        <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} relative overflow-hidden`}>
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 rounded-full bg-white/5" />
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <div className="text-xl font-black leading-tight">{value}</div>
                {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
                {badge && <div className="mt-2">{badge}</div>}
            </div>
        </div>
    );
}

export default function SalesGrowthComparisonReport() {
    const now = new Date();
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary]       = useState(null);
    const [loading, setLoading]       = useState(false);
    const [searched, setSearched]     = useState(false);
    const [activeView, setActiveView] = useState('table'); // 'table' | 'chart'
    const [sortConfig, setSortConfig] = useState({ key: 'currSales', dir: 'desc' });

    // Dropdown state for Party Name
    const [allParties, setAllParties] = useState([]);
    const [showPartyDropdown, setShowPartyDropdown] = useState(false);
    const partySearchRef = useRef(null);

    const [filters, setFilters] = useState({
        month:     String(now.getMonth() + 1),
        year:      String(now.getFullYear()),
        partyName: '',
    });

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

    // Fetch initial data (Parties) on mount
    useEffect(() => {
        getAllAccounts()
            .then(res => {
                // Backend returns raw array OR object with success: true
                const data = Array.isArray(res) ? res : (res.data || res.accounts || []);
                const sortedParties = data
                    .map(p => p.Name || p.accountName || p.account_name)
                    .filter(Boolean)
                    .sort();
                
                // Deduplicate Names
                const uniqueParties = [...new Set(sortedParties)];
                setAllParties(uniqueParties);
            })
            .catch(err => console.error("Failed to fetch accounts:", err));
    }, []);

    // Handle outside clicks for party dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (partySearchRef.current && !partySearchRef.current.contains(e.target)) {
                setShowPartyDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ─── Filterable Parties ─── */
    const filteredPartyOptions = useMemo(() => {
        if (!filters.partyName) return allParties.slice(0, 50);
        const q = filters.partyName.toLowerCase();
        return allParties.filter(party => party.toLowerCase().includes(q)).slice(0, 50);
    }, [allParties, filters.partyName]);

    const handleSearch = useCallback(async () => {
        try {
            setLoading(true);
            setShowPartyDropdown(false); // Hide dropdown on search
            const res = await getSalesGrowthComparisonReport(filters);
            if (res.success) {
                setReportData(res.data || []);
                setSummary(res.summary || null);
                setSearched(true);
                if ((res.data || []).length === 0) toast('No data found for selected period.', { icon: '🔍' });
            } else {
                toast.error('Failed to fetch report.');
            }
        } catch {
            toast.error('Error fetching report.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { handleSearch(); }, []);

    const handleReset = () => {
        const fresh = { month: String(now.getMonth() + 1), year: String(now.getFullYear()), partyName: '' };
        setFilters(fresh);
        setTimeout(() => handleSearch(), 50);
    };

    // ── Sorting ──
    const handleSort = (key) => {
        setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
    };

    const sortedData = useMemo(() => {
        const d = [...reportData];
        d.sort((a, b) => {
            let av = a[sortConfig.key] ?? -Infinity;
            let bv = b[sortConfig.key] ?? -Infinity;
            if (typeof av === 'string') { av = av.toLowerCase(); bv = (b[sortConfig.key] ?? '').toLowerCase(); }
            if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return d;
    }, [reportData, sortConfig]);

    // ── Insights ──
    const insights = useMemo(() => {
        if (!reportData.length || !summary) return [];
        const tips = [];
        if (summary.momGrowthPct > 0) tips.push({ icon: '📈', text: `Overall sales grew by ${summary.momGrowthPct}% compared to previous month`, type: 'good' });
        else if (summary.momGrowthPct < 0) tips.push({ icon: '📉', text: `Overall sales declined by ${Math.abs(summary.momGrowthPct)}% compared to previous month`, type: 'bad' });

        const topGrower = [...reportData].sort((a, b) => (b.momGrowth || -Infinity) - (a.momGrowth || -Infinity))[0];
        if (topGrower?.momGrowth !== null) tips.push({ icon: '⭐', text: `${topGrower.partyName} had highest growth at +${topGrower.momGrowth}%`, type: 'info' });

        const topDecliner = [...reportData].sort((a, b) => (a.momGrowth ?? Infinity) - (b.momGrowth ?? Infinity))[0];
        if (topDecliner?.momGrowth !== null && topDecliner.momGrowth < 0) tips.push({ icon: '⚠️', text: `${topDecliner.partyName} had biggest decline at ${topDecliner.momGrowth}%`, type: 'warn' });

        tips.push({ icon: '👥', text: `${summary.growingParties} growing vs ${summary.degrowingParties} declining parties this month`, type: 'info' });
        return tips;
    }, [reportData, summary]);

    // ── Export ──
    const handleExport = () => {
        if (!sortedData.length) { toast.error('No data to export.'); return; }
        const ws = XLSX.utils.json_to_sheet(sortedData.map((r, i) => ({
            'SR No': i + 1,
            'Party Name': r.partyName,
            [`${summary?.currLabel} Sales`]: r.currSales,
            [`${summary?.prevLabel} Sales`]: r.prevSales,
            [`${summary?.lyLabel} Sales`]: r.lySales,
            'MoM Growth %': r.momGrowth ?? 'N/A',
            'YoY Growth %': r.yoyGrowth ?? 'N/A',
            'MoM Status': r.momStatus,
            'YoY Status': r.yoyStatus,
            'Invoices': r.currInvoices,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales Growth');
        XLSX.writeFile(wb, `SalesGrowthReport_${summary?.currLabel?.replace(' ', '_') || 'Report'}.xlsx`);
        toast.success('Excel exported!');
    };

    // ── Print ──
    const handlePrint = () => {
        if (!sortedData.length) { toast.error('No data to print.'); return; }
        const win = window.open('', '_blank', 'width=1200,height=800');
        const rows = sortedData.map((r, i) => `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td align="center">${i + 1}</td>
                <td style="font-weight:600;">${r.partyName}</td>
                <td align="right">₹${fmt(r.currSales)}</td>
                <td align="right">₹${fmt(r.prevSales)}</td>
                <td align="right">₹${fmt(r.lySales)}</td>
                <td align="center" style="color:${(r.momGrowth||0) >= 0 ? '#059669' : '#dc2626'};font-weight:700;">${r.momGrowth !== null ? (r.momGrowth >= 0 ? '+' : '') + r.momGrowth + '%' : 'N/A'}</td>
                <td align="center" style="color:${(r.yoyGrowth||0) >= 0 ? '#059669' : '#dc2626'};font-weight:700;">${r.yoyGrowth !== null ? (r.yoyGrowth >= 0 ? '+' : '') + r.yoyGrowth + '%' : 'N/A'}</td>
                <td align="center" style="color:${r.momStatus === 'Growth' ? '#059669' : r.momStatus === 'Degrowth' ? '#dc2626' : '#94a3b8'};font-weight:700;">${r.momStatus}</td>
            </tr>`).join('');
        win.document.write(`<html><head><title>Sales Growth Comparison Report</title>
            <style>body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;margin:20px}h2{text-align:center;font-size:16px;margin-bottom:4px}p.sub{text-align:center;color:#64748b;margin-bottom:14px;font-size:10px}table{width:100%;border-collapse:collapse}thead th{background:#1e40af;color:#fff;padding:8px;font-size:10px;text-transform:uppercase}tfoot td{background:#1e3a8a;color:#fff;padding:7px;font-weight:700}@media print{@page{margin:1cm}}</style>
            </head><body>
            <h2>Sales Growth Comparison Report</h2>
            <p class="sub">${summary?.currLabel || ''} vs ${summary?.prevLabel || ''} vs ${summary?.lyLabel || ''} &nbsp;·&nbsp; Generated ${new Date().toLocaleString('en-IN')}</p>
            <table><thead><tr><th>SR</th><th>Party Name</th><th>${summary?.currLabel}</th><th>${summary?.prevLabel}</th><th>${summary?.lyLabel}</th><th>MoM%</th><th>YoY%</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="2" align="right">GRAND TOTAL</td>
                <td align="right">₹${fmt(summary?.currTotal)}</td>
                <td align="right">₹${fmt(summary?.prevTotal)}</td>
                <td align="right">₹${fmt(summary?.lyTotal)}</td>
                <td align="center" style="color:${(summary?.momGrowthPct||0)>=0?'#6ee7b7':'#fca5a5'}">${summary?.momGrowthPct >= 0 ? '+' : ''}${summary?.momGrowthPct}%</td>
                <td align="center" style="color:${(summary?.yoyGrowthPct||0)>=0?'#6ee7b7':'#fca5a5'}">${summary?.yoyGrowthPct >= 0 ? '+' : ''}${summary?.yoyGrowthPct}%</td>
                <td></td></tr></tfoot></table></body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    const SortBtn = ({ col, label }) => (
        <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-indigo-200 transition-colors text-left">
            {label}
            {sortConfig.key === col
                ? (sortConfig.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                : <ArrowUpDown className="w-3 h-3 opacity-50" />}
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 p-4 md:p-6">
            <div className="max-w-[1600px] mx-auto space-y-5">

                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 rounded-2xl px-6 py-5 shadow-xl shadow-blue-200/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            Sales Growth Comparison Report
                        </h1>
                        <p className="text-blue-200 text-sm mt-1 ml-1">
                            {summary ? `${summary.currLabel} vs ${summary.prevLabel} vs ${summary.lyLabel}` : 'Compare sales across 3 time periods'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-white/10 p-1 rounded-xl border border-white/20">
                            {[['table','📋 Table'], ['chart','📊 Chart']].map(([v, label]) => (
                                <button key={v} onClick={() => setActiveView(v)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeView === v ? 'bg-white text-indigo-700 shadow' : 'text-white/80 hover:text-white'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md transition-all">
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-sm shadow-md transition-all">
                            <Printer className="w-4 h-4" /> Print
                        </button>
                    </div>
                </div>

                {/* ── Filters ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                        {/* Month */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Month</label>
                            <div className="relative">
                                <select value={filters.month} onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}
                                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
                                    {monthNames.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        {/* Year */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Year</label>
                            <div className="relative">
                                <select value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}
                                    className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
                                    {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        {/* Party Searchable Dropdown */}
                        <div className="col-span-2 relative" ref={partySearchRef}>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Party Name</label>
                            <input 
                                type="text" 
                                value={filters.partyName}
                                onFocus={() => setShowPartyDropdown(true)}
                                onChange={e => {
                                    setFilters(p => ({ ...p, partyName: e.target.value }));
                                    setShowPartyDropdown(true);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                                placeholder="Search or select party..."
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                            />

                            {showPartyDropdown && filteredPartyOptions.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-64 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-1 uppercase text-[10px] font-bold text-slate-400 tracking-widest bg-slate-50 border-b border-slate-100 px-3 py-1.5">
                                        Select existing party
                                    </div>
                                    {filteredPartyOptions.map((party, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setFilters(p => ({ ...p, partyName: party }));
                                                setShowPartyDropdown(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm font-semibold text-slate-700 transition-colors flex items-center justify-between group"
                                        >
                                            <span className="truncate">{party}</span>
                                            <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronRight className="w-3 h-3" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button onClick={handleSearch} disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-bold text-sm transition-all shadow-md shadow-indigo-100 disabled:opacity-50">
                                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                                Search
                            </button>
                            <button onClick={handleReset} className="px-3 py-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl border border-slate-200 transition-all">
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Summary Cards ── */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                        <SummaryCard label={summary.currLabel} value={`₹${fmt(summary.currTotal)}`} sub="Current period sales" icon={IndianRupee}
                            gradient="bg-gradient-to-br from-indigo-600 to-indigo-800" />
                        <SummaryCard label={summary.prevLabel} value={`₹${fmt(summary.prevTotal)}`} sub="Previous month sales" icon={Calendar}
                            gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
                        <SummaryCard label={summary.lyLabel} value={`₹${fmt(summary.lyTotal)}`} sub="Last year same month" icon={BarChart3}
                            gradient="bg-gradient-to-br from-violet-500 to-violet-700" />
                        <SummaryCard
                            label="Month-over-Month"
                            value={`${summary.momGrowthPct >= 0 ? '+' : ''}${summary.momGrowthPct}%`}
                            sub={`${summary.growingParties} growing parties`}
                            icon={summary.momGrowthPct >= 0 ? TrendingUp : TrendingDown}
                            gradient={summary.momGrowthPct >= 0 ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-rose-500 to-rose-700"}
                        />
                        <SummaryCard
                            label="Year-over-Year"
                            value={`${summary.yoyGrowthPct >= 0 ? '+' : ''}${summary.yoyGrowthPct}%`}
                            sub={`vs ${summary.lyLabel}`}
                            icon={summary.yoyGrowthPct >= 0 ? TrendingUp : TrendingDown}
                            gradient={summary.yoyGrowthPct >= 0 ? "bg-gradient-to-br from-teal-500 to-teal-700" : "bg-gradient-to-br from-amber-500 to-amber-700"}
                        />
                    </div>
                )}

                {/* ── Insights Card ── */}
                {insights.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-5">
                        <h3 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Key Insights
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {insights.map((ins, i) => (
                                <div key={i} className={`rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
                                    ins.type === 'good' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                                    ins.type === 'bad'  ? 'bg-rose-50 text-rose-800 border border-rose-100' :
                                    ins.type === 'warn' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                                    'bg-white text-slate-700 border border-slate-100'
                                }`}>
                                    <span>{ins.icon}</span>
                                    <span>{ins.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TABLE VIEW ── */}
                {activeView === 'table' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-indigo-500" />
                                {sortedData.length} Parties — sorted by {sortConfig.key} ({sortConfig.dir})
                            </h3>
                            <div className="flex gap-2 text-xs font-medium">
                                <span className="flex items-center gap-1 text-emerald-600"><ArrowUpRight className="w-3 h-3" /> Growth</span>
                                <span className="flex items-center gap-1 text-rose-500"><ArrowDownRight className="w-3 h-3" /> Degrowth</span>
                                <span className="flex items-center gap-1 text-slate-400"><Minus className="w-3 h-3" /> N/A</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-indigo-700 text-white text-[10px] uppercase tracking-widest font-bold">
                                        <th className="px-4 py-3 text-center w-10">SR</th>
                                        <th className="px-4 py-3"><SortBtn col="partyName" label="Party Name" /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="currSales" label={summary?.currLabel || 'Current'} /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="prevSales" label={summary?.prevLabel || 'Previous'} /></th>
                                        <th className="px-4 py-3 text-right"><SortBtn col="lySales" label={summary?.lyLabel || 'Last Year'} /></th>
                                        <th className="px-4 py-3 text-center"><SortBtn col="momGrowth" label="MoM%" /></th>
                                        <th className="px-4 py-3 text-center"><SortBtn col="yoyGrowth" label="YoY%" /></th>
                                        <th className="px-4 py-3 text-center">MoM Status</th>
                                        <th className="px-4 py-3 text-center">Invoices</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                                                        <BarChart3 className="w-7 h-7 text-slate-200" />
                                                    </div>
                                                    <p className="text-slate-400 font-medium">{searched ? 'No data for selected filters' : 'Click Search to load report'}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : sortedData.map((row, i) => {
                                        const isTopGrower = row.momGrowth !== null && row.momGrowth > 0;
                                        const isDecliner  = row.momGrowth !== null && row.momGrowth < 0;
                                        const rowBg = isTopGrower && i < 3 ? 'bg-emerald-50/40 hover:bg-emerald-50' : isDecliner ? 'bg-rose-50/30 hover:bg-rose-50' : 'hover:bg-indigo-50/30';
                                        return (
                                            <tr key={i} className={`transition-colors border-b border-slate-50 ${rowBg}`}>
                                                <td className="px-4 py-3 text-center text-slate-400 text-xs tabular-nums">
                                                    {i < 3 && row.momStatus === 'Growth' ? <Star className="w-3.5 h-3.5 text-amber-400 inline" /> : i + 1}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-800">{row.partyName}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-indigo-700 tabular-nums">₹{fmt(row.currSales)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 tabular-nums">₹{fmt(row.prevSales)}</td>
                                                <td className="px-4 py-3 text-right text-slate-500 tabular-nums">₹{fmt(row.lySales)}</td>
                                                <td className="px-4 py-3 text-center"><GrowthPill value={row.momGrowth} /></td>
                                                <td className="px-4 py-3 text-center"><GrowthPill value={row.yoyGrowth} /></td>
                                                <td className="px-4 py-3 text-center">
                                                    {row.momStatus === 'Growth'   && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><TrendingUp className="w-3 h-3" /> Growth</span>}
                                                    {row.momStatus === 'Degrowth' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700"><TrendingDown className="w-3 h-3" /> Degrowth</span>}
                                                    {row.momStatus === 'N/A'      && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">N/A</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center text-slate-500 text-xs">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold">{row.currInvoices}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {sortedData.length > 0 && summary && (
                                    <tfoot>
                                        <tr className="bg-indigo-900 text-white font-bold text-sm">
                                            <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-widest opacity-80">Grand Total</td>
                                            <td className="px-4 py-3 text-right">₹{fmt(summary.currTotal)}</td>
                                            <td className="px-4 py-3 text-right">₹{fmt(summary.prevTotal)}</td>
                                            <td className="px-4 py-3 text-right">₹{fmt(summary.lyTotal)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <GrowthPill value={summary.momGrowthPct} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <GrowthPill value={summary.yoyGrowthPct} />
                                            </td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* ── CHART VIEW ── */}
                {activeView === 'chart' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Top 10 Bar Chart */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 col-span-full">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-indigo-500" />
                                Top 10 Parties — Sales Comparison
                            </h3>
                            {reportData.length === 0
                                ? <p className="text-slate-400 text-center py-10">No data — click Search first</p>
                                : <BarChartViz data={sortedData} currLabel={summary?.currLabel || 'Current'} prevLabel={summary?.prevLabel || 'Previous'} lyLabel={summary?.lyLabel || 'Last Year'} />
                            }
                        </div>

                        {/* Top Growing */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                                Top 5 Growing Parties
                            </h3>
                            <div className="space-y-2">
                                {[...reportData].filter(r => r.momStatus === 'Growth').sort((a, b) => (b.momGrowth || 0) - (a.momGrowth || 0)).slice(0, 5).map((r, i) => (
                                    <div key={i} className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{r.partyName}</div>
                                            <div className="text-xs text-emerald-600">₹{fmt(r.currSales)} this month</div>
                                        </div>
                                        <GrowthPill value={r.momGrowth} size="lg" />
                                    </div>
                                ))}
                                {reportData.filter(r => r.momStatus === 'Growth').length === 0 && <p className="text-slate-400 text-sm text-center py-4">No growing parties</p>}
                            </div>
                        </div>

                        {/* Top Declining */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-rose-500" />
                                Top 5 Declining Parties
                            </h3>
                            <div className="space-y-2">
                                {[...reportData].filter(r => r.momStatus === 'Degrowth').sort((a, b) => (a.momGrowth || 0) - (b.momGrowth || 0)).slice(0, 5).map((r, i) => (
                                    <div key={i} className="flex items-center justify-between bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{r.partyName}</div>
                                            <div className="text-xs text-rose-600">₹{fmt(r.currSales)} this month</div>
                                        </div>
                                        <GrowthPill value={r.momGrowth} size="lg" />
                                    </div>
                                ))}
                                {reportData.filter(r => r.momStatus === 'Degrowth').length === 0 && <p className="text-slate-400 text-sm text-center py-4">No declining parties 🎉</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
