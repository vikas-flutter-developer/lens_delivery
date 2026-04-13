import React, { useState, useEffect } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Calculator,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import { getBalanceSheetReport } from '../controllers/Reports.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function BalanceSheet() {
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const res = await getBalanceSheetReport({ dateFrom, dateTo });
            if (res.success) {
                setReportData(res.data);
                toast.success('Balance Sheet generated');
            } else {
                toast.error(res.message || 'Failed to fetch report');
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setDateFrom(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
        setDateTo(new Date().toISOString().split('T')[0]);
        setReportData(null);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
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
    }, [dateFrom, dateTo]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const handleExportExcel = () => {
        if (!reportData) return toast.error('No data to export');

        const rows = [];
        rows.push(['BALANCE SHEET']);
        rows.push(['Period:', `${dateFrom} to ${dateTo}`]);
        rows.push([]);

        // Header
        rows.push(['LIABILITIES + EQUITY', 'AMOUNT', 'ASSETS', 'AMOUNT']);

        const liabilities = [...(reportData.liabilities || [])];
        // Add P&L to liabilities section for display consistency with UI
        liabilities.push({ name: 'Profit & Loss A/c', amount: reportData.profitLossA_c });

        const equity = reportData.equity || [];
        const assets = [...(reportData.assets || [])];

        // Add Loss and Diff to assets section for display consistency with UI
        if (reportData.lossForPeriod > 0) assets.push({ name: 'Loss for the period', amount: reportData.lossForPeriod });
        if (reportData.diffInOpBal !== 0) assets.push({ name: 'Diff in op bal.', amount: reportData.diffInOpBal });

        // Build side-by-side lists
        const leftSide = [
            { isHeader: true, name: 'LIABILITIES' },
            ...liabilities,
            { isTotal: true, name: 'Total Liabilities', amount: reportData.summary.totalLiabilities },
            { isHeader: true, name: 'EQUITY' },
            ...equity,
            { isTotal: true, name: 'Total Equity', amount: reportData.summary.totalEquity }
        ];

        const rightSide = [
            { isHeader: true, name: 'ASSETS' },
            ...assets,
            { isTotal: true, name: 'Total Assets', amount: reportData.summary.totalAssets }
        ];

        const maxLen = Math.max(leftSide.length, rightSide.length);

        for (let i = 0; i < maxLen; i++) {
            const left = leftSide[i] || {};
            const right = rightSide[i] || {};

            rows.push([
                left.name || '',
                left.amount !== undefined ? left.amount : '',
                right.name || '',
                right.amount !== undefined ? right.amount : ''
            ]);
        }

        // Grand Totals row
        rows.push([]);
        rows.push([
            'Total (Liabilities + Equity)',
            reportData.summary.grandTotalLeft,
            'Total Assets',
            reportData.summary.grandTotalRight
        ]);

        const csv = Papa.unparse(rows);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = `balance_sheet_${dateTo}.csv`;
        link.click();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
            {/* Top Blue Bar */}
            <div className="bg-[#1e40af] text-white px-6 py-3 flex items-center justify-between shadow-md no-print">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-200" />
                    <h1 className="text-lg font-bold tracking-tight">Balance Sheet</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-white/10 rounded-lg p-1">
                        <button onClick={handleExportExcel} className="p-1.5 hover:bg-white/20 rounded-md transition-all" title="Export Excel">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                        </button>
                        <button onClick={() => window.print()} className="p-1.5 hover:bg-white/20 rounded-md transition-all" title="Print">
                            <Printer className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm no-print">
                <div className="max-w-[1400px] mx-auto flex items-end gap-6 flex-wrap">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Date From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-44"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Date To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-44"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                <div className="max-w-[1400px] mx-auto">
                    {!reportData && !loading ? (
                        <div className="h-96 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                            <Calculator className="w-16 h-16 opacity-20" />
                            <p className="text-lg font-bold">Search to generate Balance Sheet</p>
                        </div>
                    ) : loading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold animate-pulse">Calculating balances...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-slate-800">
                            {/* Table Headers */}
                            <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 bg-slate-50 font-bold text-slate-700 text-sm">
                                <div className="py-2 text-center text-blue-800">Liabilities + Equity</div>
                                <div className="py-2 text-center text-blue-800">Assets</div>
                            </div>

                            {/* Main Body Grid */}
                            <div className="grid grid-cols-2 divide-x divide-slate-300 min-h-[500px]">
                                {/* LEFT SIDE: Liabilities + Equity */}
                                <div className="flex flex-col">
                                    <div className="bg-slate-100/50 px-4 py-1.5 text-xs font-black text-slate-500 border-b border-slate-200 uppercase tracking-widest">Liabilities</div>
                                    <div className="flex-1 p-0">
                                        {reportData.liabilities?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between px-4 py-2 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <span className="text-slate-700">{item.name}</span>
                                                <span className="font-bold tabular-nums">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                        {/* Profit & Loss Account Row */}
                                        <div className="flex justify-between px-4 py-2 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors bg-blue-50/20">
                                            <span className="text-slate-800 font-bold">Profit & Loss A/c</span>
                                            <span className="font-black text-blue-800 tabular-nums">{formatCurrency(reportData.profitLossA_c)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between px-4 py-3 bg-slate-50 border-t border-slate-300 font-black text-slate-700">
                                        <span className="uppercase text-[11px] tracking-wider">Total Liabilities</span>
                                        <span className="text-base tabular-nums">{formatCurrency(reportData.summary.totalLiabilities)}</span>
                                    </div>

                                    <div className="bg-slate-100/50 px-4 py-1.5 text-xs font-black text-slate-500 border-y border-slate-200 uppercase tracking-widest">Equity</div>
                                    <div className="flex-1 min-h-[100px]">
                                        {reportData.equity?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between px-4 py-2 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <span className="text-slate-700">{item.name}</span>
                                                <span className="font-bold tabular-nums">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between px-4 py-3 bg-slate-50 border-t border-slate-300 font-black text-slate-700">
                                        <span className="uppercase text-[11px] tracking-wider">Total Equity</span>
                                        <span className="text-base tabular-nums">{formatCurrency(reportData.summary.totalEquity)}</span>
                                    </div>
                                </div>

                                {/* RIGHT SIDE: Assets */}
                                <div className="flex flex-col bg-white">
                                    <div className="bg-slate-100/50 px-4 py-1.5 text-xs font-black text-slate-500 border-b border-slate-200 uppercase tracking-widest">Assets</div>
                                    <div className="flex-1 p-0">
                                        {reportData.assets?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between px-4 py-2 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <span className="text-slate-700">{item.name}</span>
                                                <span className="font-bold tabular-nums">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}

                                        {/* Loss for Period Row */}
                                        <div className="flex justify-between px-4 py-2 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors bg-rose-50/30">
                                            <span className="text-slate-700 font-medium">Loss for the period</span>
                                            <span className="font-bold tabular-nums">{formatCurrency(reportData.lossForPeriod)}</span>
                                        </div>

                                        {/* Diff. in Op. Bal. Row */}
                                        <div className="flex justify-between px-4 py-2 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors bg-amber-50/20">
                                            <span className="text-slate-700 font-medium italic">Diff in op bal.</span>
                                            <span className="font-bold tabular-nums">{formatCurrency(reportData.diffInOpBal)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between px-4 py-3 bg-slate-50 border-t border-slate-300 font-black text-slate-700 mt-auto">
                                        <span className="uppercase text-[11px] tracking-wider">Total Assets</span>
                                        <span className="text-base tabular-nums">{formatCurrency(reportData.summary.totalAssets)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* GRAND TOTAL BAR */}
                            <div className="grid grid-cols-2 divide-x divide-slate-400 border-t-2 border-slate-400 bg-slate-200/80 font-black text-slate-900">
                                <div className="flex justify-between px-6 py-4">
                                    <span>Total (Liabilities + Equity)</span>
                                    <span>{formatCurrency(reportData.summary.grandTotalLeft)}</span>
                                </div>
                                <div className="flex justify-between px-6 py-4">
                                    <span>Total Assets</span>
                                    <span>{formatCurrency(reportData.summary.grandTotalRight)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .flex-1 { overflow: visible !important; height: auto !important; }
                    .bg-slate-50 { background: white !important; }
                    .bg-slate-100 { background: white !important; }
                    .bg-slate-200 { background: white !important; }
                    .border-slate-400 { border-color: black !important; }
                    .divide-slate-300 { border-color: black !important; }
                    .text-blue-800 { color: black !important; }
                    .tab-content { border: 1px solid black !important; }
                    table { border-collapse: collapse; width: 100%; border: 1px solid black !important; }
                    th, td { border: 1px solid black !important; padding: 6px 8px !important; color: black !important; }
                }
            `}</style>
        </div>
    );
}
