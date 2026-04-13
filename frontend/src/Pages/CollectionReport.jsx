import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    ArrowUpDown,
    CheckCircle2,
    Calendar,
    ChevronDown,
    Building2,
    Briefcase
} from 'lucide-react';
import { getCollectionReport } from '../controllers/Reports.controller';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function CollectionReport() {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [accounts, setAccounts] = useState([]);

    // Filters
    const [firmName, setFirmName] = useState('');
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [reportBy, setReportBy] = useState('Date Wise');
    const [monthFrom, setMonthFrom] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [monthTo, setMonthTo] = useState(new Date().toISOString().substring(0, 7));

    const [transTypes, setTransTypes] = useState([
        'Sale', 'Sale Order', 'Sale Challan',
        'Purchase', 'Purchase Order', 'Purchase Challan',
        'Damage and Shrinkage'
    ]);
    const [isTransTypeOpen, setIsTransTypeOpen] = useState(false);

    const availableTransTypes = [
        'Sale', 'Sale Order', 'Sale Challan',
        'Purchase', 'Purchase Order', 'Purchase Challan',
        'Damage and Shrinkage'
    ];

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await getAllAccounts();
            if (res.success) setAccounts(res.data);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const handleSearch = useCallback(async () => {
        setLoading(true);
        try {
            const filters = {
                firmName,
                dateFrom,
                dateTo,
                reportBy,
                monthFrom: reportBy === 'Month Wise' ? `${monthFrom}-01` : undefined,
                monthTo: reportBy === 'Month Wise' ? `${monthTo}-01` : undefined,
                transTypes
            };
            const res = await getCollectionReport(filters);
            if (res.success) {
                setReportData(res.data);
                toast.success('Report generated');
            } else {
                toast.error(res.message || 'Failed to fetch report');
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Search failed');
        } finally {
            setLoading(false);
        }
    }, [firmName, dateFrom, dateTo, reportBy, monthFrom, monthTo, transTypes]);

    const handleReset = () => {
        setFirmName('');
        setDateFrom(new Date().toISOString().split('T')[0]);
        setDateTo(new Date().toISOString().split('T')[0]);
        setReportBy('Date Wise');
        setMonthFrom(new Date().toISOString().substring(0, 7));
        setMonthTo(new Date().toISOString().substring(0, 7));
        setTransTypes(availableTransTypes);
        setReportData([]);
    };

    const toggleTransType = (type) => {
        setTransTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    // Global Enter key listener
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Enter' && !['TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement.tagName)) {
                handleSearch();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [handleSearch]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const handleExportExcel = () => {
        if (!reportData.length) return toast.error('No data to export');
        const csv = Papa.unparse(reportData.map(item => ({
            'Date/Month': item.date,
            'Firm Name': item.firmName,
            'Total Business': item.totalBusiness,
            'Cash Dr': item.cashDr,
            'Cash Cr': item.cashCr,
            'Bank Dr': item.bankDr,
            'Bank Cr': item.bankCr,
            'Oth Dr': item.othDr,
            'Oth Cr': item.othCr,
            'Balance': item.balance,
            'Detail': item.detail
        })));
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collection_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
            {/* Top Bar */}
            <div className="bg-[#4f46e5] text-white px-6 py-4 flex items-center justify-between shadow-lg no-print">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Amount Collection Report</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-white/10 rounded-xl p-1.5 border border-white/10">
                        <button onClick={handleExportExcel} className="p-2 hover:bg-white/20 rounded-lg transition-all text-emerald-300" title="Export Excel">
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                        <button onClick={() => window.print()} className="p-2 hover:bg-white/20 rounded-lg transition-all text-white" title="Print">
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white border-b border-slate-200 p-6 shadow-sm no-print">
                <div className="max-w-[1700px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 items-end">

                    {/* Firm Name */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-3 h-3" /> Firm Name
                        </label>
                        <select
                            value={firmName}
                            onChange={(e) => setFirmName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                            <option value="">All Firms</option>
                            {accounts.map(acc => (
                                <option key={acc._id} value={acc.Name}>{acc.Name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Report By */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Report By</label>
                        <select
                            value={reportBy}
                            onChange={(e) => setReportBy(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                            <option value="All">All</option>
                            <option value="Date Wise">Date Wise</option>
                            <option value="Month Wise">Month Wise</option>
                        </select>
                    </div>

                    {/* Date Filters */}
                    {reportBy !== 'Month Wise' ? (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" /> Date From
                                </label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" /> Date To
                                </label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Month From</label>
                                <input
                                    type="month"
                                    value={monthFrom}
                                    onChange={(e) => setMonthFrom(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Month To</label>
                                <input
                                    type="month"
                                    value={monthTo}
                                    onChange={(e) => setMonthTo(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </>
                    )}

                    {/* Trans Type (Multi-select) */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trans Type</label>
                        <button
                            onClick={() => setIsTransTypeOpen(!isTransTypeOpen)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-left flex items-center justify-between hover:border-indigo-300 transition-all"
                        >
                            <span className="truncate">{transTypes.length} Selected</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isTransTypeOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isTransTypeOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsTransTypeOpen(false)} />
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 max-h-60 overflow-y-auto">
                                    {availableTransTypes.map(type => (
                                        <label key={type} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer gap-3 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={transTypes.includes(type)}
                                                onChange={() => toggleTransType(type)}
                                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                            />
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 lg:col-span-2 xl:col-span-1">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all active:scale-95"
                            title="Reset Filters"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Table Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                <div className="max-w-[1700px] mx-auto min-h-full">
                    {!reportData.length && !loading ? (
                        <div className="h-[500px] flex flex-col items-center justify-center text-slate-300 gap-4 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 shadow-inner">
                            <div className="bg-slate-50 p-6 rounded-full border border-slate-100">
                                <Search className="w-16 h-16 opacity-20" />
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-slate-400">No collection data found</p>
                                <p className="text-sm text-slate-400 mt-1">Adjust filters or search by pressing Enter</p>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="h-[500px] flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Briefcase className="w-5 h-5 text-indigo-200" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-500 font-bold text-lg animate-pulse tracking-wide">Processing collection data...</p>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Please wait</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden ring-1 ring-slate-900/5">
                            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                                <table className="w-full text-left border-collapse min-w-[1200px]">
                                    <thead>
                                        <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Date / Month</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Total Business</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-emerald-600 bg-emerald-50/50">Cash Dr</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-rose-600 bg-rose-50/50">Cash Cr</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-indigo-600 bg-indigo-50/50">Bank Dr</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-amber-600 bg-amber-50/50">Bank Cr</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Oth Dr</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Oth Cr</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Bal.</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reportData.map((row, idx) => (
                                            <React.Fragment key={idx}>
                                                {/* Optional Group Header if needed - but here rows are flat based on groupKey */}
                                                <tr className="hover:bg-slate-50/80 transition-all group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-700">{row.date}</span>
                                                            {reportBy === 'All' && <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">{row.firmName}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-slate-900 tabular-nums">
                                                        {formatCurrency(row.totalBusiness)}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-emerald-600 bg-emerald-50/20 tabular-nums">
                                                        {formatCurrency(row.cashDr)}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-rose-600 bg-rose-50/20 tabular-nums">
                                                        {formatCurrency(row.cashCr)}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-indigo-600 bg-indigo-50/20 tabular-nums">
                                                        {formatCurrency(row.bankDr)}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-amber-600 bg-amber-50/20 tabular-nums">
                                                        {formatCurrency(row.bankCr)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400 tabular-nums">
                                                        {formatCurrency(row.othDr)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400 tabular-nums">
                                                        {formatCurrency(row.othCr)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${row.balance.includes('Dr')
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {row.balance}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="max-w-[300px] text-[11px] text-slate-500 leading-relaxed italic bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:bg-white transition-all">
                                                            {row.detail || 'No detailed break-up'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    {/* Footer Totals */}
                                    <tfoot className="bg-slate-900 text-white font-black uppercase tracking-widest text-[10px]">
                                        <tr>
                                            <td className="px-6 py-5">Grand Totals</td>
                                            <td className="px-6 py-5">
                                                {formatCurrency(reportData.reduce((s, r) => s + r.totalBusiness, 0))}
                                            </td>
                                            <td className="px-6 py-5 text-emerald-400">
                                                {formatCurrency(reportData.reduce((s, r) => s + r.cashDr, 0))}
                                            </td>
                                            <td className="px-6 py-5 text-rose-400">
                                                {formatCurrency(reportData.reduce((s, r) => s + r.cashCr, 0))}
                                            </td>
                                            <td className="px-6 py-5 text-indigo-300">
                                                {formatCurrency(reportData.reduce((s, r) => s + r.bankDr, 0))}
                                            </td>
                                            <td className="px-6 py-5 text-amber-300">
                                                {formatCurrency(reportData.reduce((s, r) => s + r.bankCr, 0))}
                                            </td>
                                            <td className="px-6 py-5" colSpan={4}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; }
                    .flex-1 { overflow: visible !important; height: auto !important; padding: 0 !important; }
                    .max-w-[1700px] { max-width: 100% !important; }
                    .bg-white { box-shadow: none !important; border: 1px solid #e2e8f0 !important; border-radius: 0 !important; }
                    table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
                    th, td { border: 1px solid #e2e8f0 !important; padding: 8px 12px !important; }
                    tfoot { display: table-footer-group !important; color: black !important; }
                    tfoot tr td { border-top: 2px solid black !important; color: black !important; }
                }
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                ::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
}
