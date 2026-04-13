import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Download,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertCircle,
    ChevronDown,
    LayoutGrid,
    Users
} from 'lucide-react';
import {
    getProfitAndLossReport,
    getParentGroups,
    getProfitAndLossAccountReport
} from '../controllers/Reports.controller';
import { getAllLensPower } from '../controllers/LensGroupCreationController';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

import { useLocation } from "react-router-dom";

export default function ProfitAndLossCombined() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('account'); // 'account' or 'item'
    const [loading, setLoading] = useState(false);

    // Common States
    const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    // Account Wise Specific States
    const [accounts, setAccounts] = useState([]);
    const [accountSearch, setAccountSearch] = useState('');
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [selectedAccountName, setSelectedAccountName] = useState('');
    const accountInputRef = useRef(null);
    const [accountReportData, setAccountReportData] = useState(null);

    // Item Wise Specific States
    const [parentGroups, setParentGroups] = useState([]);
    const [allLenses, setAllLenses] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [includeStockOutflow, setIncludeStockOutflow] = useState(false);
    const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);
    const groupInputRef = useRef(null);
    const productInputRef = useRef(null);
    const [itemReportData, setItemReportData] = useState([]);
    const [itemSummary, setItemSummary] = useState(null);

    // Initialization
    useEffect(() => {
        // Detect initial tab from path
        if (location.pathname.includes('item')) {
            setActiveTab('item');
        } else {
            setActiveTab('account');
        }
        fetchInitialData();
    }, [location.pathname]);

    const fetchInitialData = async () => {
        try {
            const [accRes, groupRes, lensRes] = await Promise.all([
                getAllAccounts(),
                getParentGroups(),
                getAllLensPower()
            ]);

            setAccounts(accRes || []);

            if (groupRes.success) {
                setParentGroups(groupRes.data || []);
            }

            const dataArr = lensRes?.data ?? lensRes;
            if (Array.isArray(dataArr)) {
                const uniqueProducts = new Set();
                dataArr.forEach(group => {
                    if (group.productName) uniqueProducts.add(group.productName);
                });
                setAllLenses(Array.from(uniqueProducts).map(name => ({ productName: name })));
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    // Global keyboard and click listeners
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Trigger search on Enter if not focused on another interactive element that handles Enter
            if (e.key === 'Enter' && !['TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement.tagName)) {
                handleSearch();
            }
        };

        const handleClickOutside = (e) => {
            if (accountInputRef.current && !accountInputRef.current.contains(e.target)) setShowAccountDropdown(false);
            if (groupInputRef.current && !groupInputRef.current.contains(e.target)) setShowGroupSuggestions(false);
            if (productInputRef.current && !productInputRef.current.contains(e.target)) setShowProductSuggestions(false);
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dateFrom, dateTo, selectedAccountName, groupName, productSearch, includeStockOutflow]); // Re-bind when search params change to ensure handleSearch has latest state

    // Handlers
    const handleSearch = async () => {
        setLoading(true);
        try {
            if (activeTab === 'account') {
                const res = await getProfitAndLossAccountReport({
                    dateFrom,
                    dateTo,
                    accountName: selectedAccountName
                });
                if (res.success) {
                    setAccountReportData(res.data);
                    toast.success('Account report generated');
                } else {
                    toast.error(res.message || 'Failed to fetch account report');
                }
            } else {
                const res = await getProfitAndLossReport({
                    dateFrom,
                    dateTo,
                    groupName,
                    searchText: productSearch,
                    includeStockOutflow
                });
                if (res.success) {
                    setItemReportData(res.data.reportData || []);
                    setItemSummary(res.data.summary);
                    toast.success('Item report generated');
                } else {
                    toast.error(res.message || 'Failed to fetch item report');
                }
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setDateFrom(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0]);
        setDateTo(new Date().toISOString().split('T')[0]);

        if (activeTab === 'account') {
            setAccountSearch('');
            setSelectedAccountName('');
            setAccountReportData(null);
        } else {
            setGroupName('');
            setProductSearch('');
            setIncludeStockOutflow(false);
            setItemReportData([]);
            setItemSummary(null);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Export Logic
    const handleExportCSV = () => {
        if (activeTab === 'account') {
            if (!accountReportData) {
                toast.error('No account data to export');
                return;
            }
            const rows = [];

            // Header
            rows.push(['PROFIT & LOSS ACCOUNT (By Account)']);
            rows.push(['Period:', `${dateFrom} to ${dateTo}`]);
            rows.push(['Account:', selectedAccountName || 'All Accounts']);
            rows.push([]);

            // Expenditure Section
            rows.push(['EXPENDITURE', '', 'AMOUNT', 'TOTAL']);
            const addExpenditureGroup = (title, items, total) => {
                if (items.length > 0) {
                    rows.push([title, '', '', total.toFixed(2)]);
                    items.forEach(item => rows.push(['', item.accountName, item.amount.toFixed(2), '']));
                }
            };
            addExpenditureGroup('Direct Expenses', accountReportData.expenses.directExpenses, accountReportData.summary.totalDirectExpenses);
            addExpenditureGroup('Purchase Accounts', accountReportData.expenses.purchaseAccounts, accountReportData.summary.totalPurchase);
            addExpenditureGroup('Opening Stock', accountReportData.expenses.openingStock, accountReportData.summary.totalOpeningStock);
            addExpenditureGroup('Indirect Expenses', accountReportData.expenses.indirectExpenses, accountReportData.summary.totalIndirectExpenses);
            rows.push([]);

            // Income Section
            rows.push(['INCOME', '', 'AMOUNT', 'TOTAL']);
            const addIncomeGroup = (title, items, total) => {
                if (items.length > 0) {
                    rows.push([title, '', '', total.toFixed(2)]);
                    items.forEach(item => rows.push(['', item.accountName, item.amount.toFixed(2), '']));
                }
            };
            addIncomeGroup('Sale Accounts', accountReportData.income.saleAccounts, accountReportData.summary.totalSales);
            addIncomeGroup('Closing Stock', accountReportData.income.closingStock, accountReportData.summary.totalClosingStock);
            rows.push([]);

            // Summary
            rows.push(['STATEMENT SUMMARY']);
            rows.push(['Gross Profit (C/O)', accountReportData.summary.grossProfitCO.toFixed(2)]);
            rows.push(['Gross Profit (B/F)', accountReportData.summary.grossProfitBF.toFixed(2)]);
            rows.push(['Total Expenses', accountReportData.summary.totalExpenses.toFixed(2)]);
            rows.push(['Total Income', accountReportData.summary.totalIncome.toFixed(2)]);
            rows.push(['Net Profit/Loss', accountReportData.summary.netProfit.toFixed(2)]);

            const csv = Papa.unparse(rows);
            downloadCSV(csv, 'profit_loss_account_full');
        } else {
            if (itemReportData.length === 0) {
                toast.error('No item data to export');
                return;
            }
            const csvData = itemReportData.map((item, idx) => ({
                'S.No': idx + 1,
                'Category/Group': item.groupName,
                'Product Name': item.itemName,
                'In Stock Qty': item.stokOutQty,
                'Buy Price (Avg)': item.itemWiseProfit.purPrice,
                'Sell Price (Avg)': item.itemWiseProfit.salPrice,
                'Total Buy Value': item.itemWiseProfit.totPurPrice,
                'Total Sell Value': item.itemWiseProfit.totSalPrice,
                'Final Margin (Profit/Loss)': item.itemWiseProfit.profitLoss
            }));
            downloadCSV(Papa.unparse(csvData), 'profit_loss_items_analysis');
        }
    };

    const downloadCSV = (csv, filename) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col overflow-hidden">
            {/* Unified Top Header & Tab Switcher - HIDDEN ON PRINT */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white shadow-lg no-print">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/30">
                            <DollarSign className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Profit & Loss Analysis</h1>
                            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">Reports & Statements</p>
                        </div>
                    </div>

                    {/* Premium Tab Switcher */}
                    <div className="flex bg-blue-900/40 p-1 rounded-xl border border-white/10 backdrop-blur-md self-center">
                        <button
                            onClick={() => setActiveTab('account')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'account' ? 'bg-white text-blue-700 shadow-xl scale-105' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                        >
                            <Users className="w-4 h-4" />
                            Account Wise
                        </button>
                        <button
                            onClick={() => setActiveTab('item')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'item' ? 'bg-white text-blue-700 shadow-xl scale-105' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Item Wise
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleExportCSV} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20 group shadow-sm active:scale-95" title="Export Excel">
                            <FileSpreadsheet className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={() => window.print()} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20 group shadow-sm active:scale-95" title="Print">
                            <Printer className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar - HIDDEN ON PRINT */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 sticky top-0 no-print">
                <div className="max-w-[1600px] mx-auto flex flex-wrap items-end gap-5">
                    {/* Common Date Filters */}
                    <div className="grid grid-cols-2 gap-3 min-w-[320px]">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">From Date</label>
                            <div className="relative group">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all group-hover:border-slate-300"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">To Date</label>
                            <div className="relative group">
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all group-hover:border-slate-300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tab-Specific Filters */}
                    {activeTab === 'account' ? (
                        <div className="flex-1 min-w-[280px] space-y-1.5 relative" ref={accountInputRef}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Account Search</label>
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    value={accountSearch}
                                    onChange={(e) => {
                                        setAccountSearch(e.target.value);
                                        setShowAccountDropdown(true);
                                        if (!e.target.value) setSelectedAccountName('');
                                    }}
                                    onFocus={() => setShowAccountDropdown(true)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Search account name... (Leave empty for all)"
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all group-hover:border-slate-300"
                                />
                                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>

                            {showAccountDropdown && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 max-h-72 overflow-y-auto z-[100] p-1.5 animate-in fade-in slide-in-from-top-2">
                                    <div onClick={() => { setSelectedAccountName(''); setAccountSearch(''); setShowAccountDropdown(false); }} className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-bold rounded-lg mb-1 border-b border-blue-100">All Accounts</div>
                                    {accounts.filter(a => a.Name.toLowerCase().includes(accountSearch.toLowerCase())).slice(0, 30).map((acc, i) => (
                                        <div key={i} onClick={() => { setSelectedAccountName(acc.Name); setAccountSearch(acc.Name); setShowAccountDropdown(false); }} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 rounded-l transition-colors">
                                            {acc.Name} <span className="text-[10px] text-slate-400 ml-2">{acc.Groups?.join(', ')}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex gap-4 min-w-[500px]">
                            <div className="w-1/3 space-y-1.5 relative" ref={groupInputRef}>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Category / Group</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={(e) => { setGroupName(e.target.value); setShowGroupSuggestions(true); }}
                                        onFocus={() => setShowGroupSuggestions(true)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Filter by Group..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all group-hover:border-slate-300"
                                    />
                                    {showGroupSuggestions && parentGroups.filter(g => g.toLowerCase().includes(groupName.toLowerCase())).length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto z-[100] p-1.5">
                                            {parentGroups.filter(g => g.toLowerCase().includes(groupName.toLowerCase())).map((g, i) => (
                                                <div key={i} onClick={() => { setGroupName(g); setShowGroupSuggestions(false); }} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 rounded-lg">{g}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-2/3 space-y-1.5 relative" ref={productInputRef}>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Product Search</label>
                                <div className="relative group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => { setProductSearch(e.target.value); setShowProductSuggestions(true); }}
                                        onFocus={() => setShowProductSuggestions(true)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Search products..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all group-hover:border-slate-300"
                                    />
                                    {showProductSuggestions && allLenses.filter(l => l.productName.toLowerCase().includes(productSearch.toLowerCase())).length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto z-[100] p-1.5">
                                            {allLenses.filter(l => l.productName.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 30).map((l, i) => (
                                                <div key={i} onClick={() => { setProductSearch(l.productName); setShowProductSuggestions(false); }} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 rounded-lg">{l.productName}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        {activeTab === 'item' && (
                            <label className="flex items-center gap-2.5 px-3 py-2 bg-slate-100/80 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={includeStockOutflow}
                                    onChange={(e) => setIncludeStockOutflow(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded-lg focus:ring-blue-500"
                                />
                                <span className="text-xs font-semibold text-slate-600">Stock Outflow</span>
                            </label>
                        )}
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-xl transition-all active:scale-95"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                <div className="max-w-[1600px] mx-auto space-y-6">
                    {activeTab === 'account' ? (
                        <AccountReportContent data={accountReportData} filterData={{ dateFrom, dateTo, accountName: selectedAccountName }} loading={loading} />
                    ) : (
                        <ItemReportContent data={itemReportData} summary={itemSummary} loading={loading} />
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white; margin: 0; padding: 0; }
                    .min-h-screen { background: white !important; }
                    .flex-1 { overflow: visible !important; height: auto !important; }
                    .max-w-[1600px] { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
                    
                    /* Custom print layout */
                    .bg-white { box-shadow: none !important; border-radius: 0 !important; border: none !important; }
                    .rounded-3xl { border-radius: 0 !important; }
                    
                    table { border-collapse: collapse; width: 100%; border: 1px solid #333 !important; }
                    th, td { border: 1px solid #333 !important; padding: 6px 8px !important; color: black !important; font-size: 11px !important; }
                    th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }

                    .hide-on-print { display: none !important; }
                    .print-header { display: block !important; text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
                }
                .print-header { display: none; }
                .scroll-premium::-webkit-scrollbar { width: 6px; }
                .scroll-premium::-webkit-scrollbar-track { background: transparent; }
                .scroll-premium::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .scroll-premium::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}

// Internal Sub-Components for cleaner structure
function AccountReportContent({ data, filterData, loading }) {
    if (loading) return <LoadingSpinner />;
    if (!data) return <EmptyState text="Search to generate Account Statement" />;

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(amount || 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print-view">
            {/* Header for print only */}
            <div className="print-header">
                <h1 className="text-xl font-bold">Profit & Loss Account Analysis</h1>
                <p className="text-sm">Period: {filterData.dateFrom} to {filterData.dateTo} | Account: {filterData.accountName || 'All Accounts'}</p>
            </div>

            {/* Account Summary Cards - HIDDEN ON PRINT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <SummaryCard title="Gross Profit (C/O)" value={data.summary.grossProfitCO} color="amber" icon={<TrendingUp className="w-5 h-5" />} />
                <SummaryCard title="Gross Profit (B/F)" value={data.summary.grossProfitBF} color="indigo" icon={<TrendingUp className="w-5 h-5" />} />
                <SummaryCard title="Net Profit/Loss" value={data.summary.netProfit} color={data.summary.netProfit >= 0 ? "emerald" : "rose"} icon={data.summary.netProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />} isLarge />
                <SummaryCard title="Total Revenue" value={data.summary.totalIncome} color="blue" icon={<DollarSign className="w-5 h-5" />} />
            </div>

            {/* Main P&L Statement Grid */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden print:overflow-visible">
                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200 print:flex-row print:divide-x print:divide-y-0">
                    {/* Expenses Side */}
                    <div className="flex-1">
                        <div className="bg-rose-50/50 px-6 py-3 border-b border-rose-100">
                            <h3 className="text-rose-800 font-bold text-sm tracking-wide flex items-center gap-2">
                                <TrendingDown className="w-4 h-4" /> EXPENDITURE
                            </h3>
                        </div>
                        <div className="p-0 scroll-premium max-h-[600px] overflow-y-auto">
                            <StatementSection title="Direct Expenses" items={data.expenses.directExpenses} color="rose" total={data.summary.totalDirectExpenses} />
                            <StatementSection title="Purchase Accounts" items={data.expenses.purchaseAccounts} color="rose" total={data.summary.totalPurchase} />
                            <StatementSection title="Opening Stock" items={data.expenses.openingStock} color="rose" total={data.summary.totalOpeningStock} />
                            <StatementSection title="Indirect Expenses" items={data.expenses.indirectExpenses} color="orange" total={data.summary.totalIndirectExpenses} />
                        </div>
                    </div>

                    {/* Income Side */}
                    <div className="flex-1">
                        <div className="bg-emerald-50/50 px-6 py-3 border-b border-emerald-100">
                            <h3 className="text-emerald-800 font-bold text-sm tracking-wide flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> INCOME
                            </h3>
                        </div>
                        <div className="p-0 scroll-premium max-h-[600px] overflow-y-auto">
                            <StatementSection title="Sale Accounts" items={data.income.saleAccounts} color="emerald" total={data.summary.totalSales} isIncome />
                            <StatementSection title="Closing Stock" items={data.income.closingStock} color="emerald" total={data.summary.totalClosingStock} isIncome />
                        </div>
                    </div>
                </div>

                {/* Bottom Total Bar - Statement Summary */}
                <div className="bg-slate-50 border-t border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center bg-gradient-to-br from-slate-50 to-slate-100 print:bg-white print:border-t-2 print:border-black print:px-4">
                    <div className="text-center md:text-left mb-4 md:mb-0">
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight print:text-lg">Statement Summary</h4>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest no-print">{filterData.dateFrom} TO {filterData.dateTo}</p>
                    </div>
                    <div className="flex gap-8 print:gap-4">
                        <div className="text-right">
                            <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1 print:text-black print:mb-0">Total Exp.</p>
                            <p className="text-xl font-black text-slate-800 print:text-sm">₹ {formatCurrency(data.summary.totalExpenses)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1 print:text-black print:mb-0">Total Inc.</p>
                            <p className="text-xl font-black text-slate-800 print:text-sm">₹ {formatCurrency(data.summary.totalIncome)}</p>
                        </div>
                        <div className="bg-blue-600 rounded-2xl px-6 py-3 text-white shadow-xl shadow-blue-200 print:bg-white print:text-black print:rounded-none print:px-2 print:py-0 print:shadow-none">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5 print:opacity-100 print:text-black print:underline">Final Net Profit/Loss</p>
                            <p className="text-xl font-black print:text-sm">₹ {formatCurrency(Math.abs(data.summary.netProfit))} {data.summary.netProfit >= 0 ? 'Cr' : 'Dr'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ItemReportContent({ data, summary, loading }) {
    if (loading) return <LoadingSpinner />;
    if (!data || data.length === 0) return <EmptyState text="Search to generate Item Wise Analysis" />;

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(amount || 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print-view">
            {/* Header for print only */}
            <div className="print-header">
                <h1 className="text-xl font-bold">Item Wise Profit & Loss Analysis</h1>
                <p className="text-sm">Comprehensive Product Performance Report</p>
            </div>

            {/* Summary Grid - HIDDEN ON PRINT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <SummaryCard title="Purchase Total" value={summary.totalPurchaseAmount} color="blue" icon={<Users className="w-5 h-5" />} />
                <SummaryCard title="Sales Total" value={summary.totalSaleAmount} color="indigo" icon={<Users className="w-5 h-5" />} />
                <SummaryCard title="Total Inventory Profit" value={summary.totalProfitLoss} color={summary.totalProfitLoss >= 0 ? "emerald" : "rose"} icon={<TrendingUp className="w-5 h-5" />} isLarge />
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black text-emerald-500 uppercase">Profitable</p>
                        <p className="text-xl font-black text-slate-800">{summary.profitableItems}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black text-rose-500 uppercase">Loss/No Margin</p>
                        <p className="text-xl font-black text-slate-800">{summary.lossItems}</p>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden print:border-none print:shadow-none">
                <div className="overflow-x-auto scroll-premium">
                    <table className="w-full text-left border-collapse print:table">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 print:text-black print:border-b-2 print:border-black">
                                <th className="px-6 py-4 print:px-2 print:py-2">Product Analysis</th>
                                <th className="px-6 py-4 text-center print:px-2 print:py-2">In Stock Qty</th>
                                <th className="px-6 py-4 text-center bg-blue-50/30 print:bg-white print:px-2 print:py-2">Buy Info</th>
                                <th className="px-6 py-4 text-center bg-blue-50/50 print:bg-white print:px-2 print:py-2">Sell Info</th>
                                <th className="px-6 py-4 text-right bg-slate-100 print:bg-white print:px-2 print:py-2">Final Margin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-y-2 print:divide-slate-300">
                            {data.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4 print:px-2 print:py-2">
                                        <div className="font-bold text-slate-800 print:text-sm">{item.itemName}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase print:text-[8px] print:text-slate-600">{item.groupName}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black text-slate-700 print:px-2 print:py-2 print:text-sm">{item.stokOutQty.toFixed(2)}</td>
                                    <td className="px-6 py-4 bg-blue-50/20 print:bg-white print:px-2 print:py-2">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-slate-400 font-bold print:text-[8px]">AVG: ₹{item.itemWiseProfit.purPrice.toFixed(2)}</span>
                                            <span className="font-bold text-slate-700 print:text-sm">₹{formatCurrency(item.itemWiseProfit.totPurPrice)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 bg-blue-50/40 print:bg-white print:px-2 print:py-2">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-slate-400 font-bold print:text-[8px]">AVG: ₹{item.itemWiseProfit.salPrice.toFixed(2)}</span>
                                            <span className="font-bold text-slate-700 print:text-sm">₹{formatCurrency(item.itemWiseProfit.totSalPrice)}</span>
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 text-right bg-slate-50/50 print:bg-white print:px-2 print:py-2`}>
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm print:text-sm print:rounded-none print:px-0 print:border-none ${item.itemWiseProfit.profitLoss >= 0 ? "bg-emerald-100 text-emerald-700 print:text-green-800" : "bg-rose-100 text-rose-700 print:text-red-800"}`}>
                                            {item.itemWiseProfit.profitLoss >= 0 ? <TrendingUp className="w-3.5 h-3.5 no-print" /> : <TrendingDown className="w-3.5 h-3.5 no-print" />}
                                            ₹{formatCurrency(item.itemWiseProfit.profitLoss)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Utility Components
function SummaryCard({ title, value, color, icon, isLarge }) {
    const colors = {
        blue: "bg-blue-600 shadow-blue-200",
        emerald: "bg-emerald-600 shadow-emerald-200",
        rose: "bg-rose-600 shadow-rose-200",
        amber: "bg-amber-600 shadow-amber-200",
        indigo: "bg-indigo-600 shadow-indigo-200",
        orange: "bg-orange-600 shadow-orange-200",
    };

    return (
        <div className={`relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-lg shadow-slate-100 flex flex-col justify-between transition-transform hover:-translate-y-1`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                <div className={`p-2 rounded-xl text-white ${colors[color]}`}>{icon}</div>
            </div>
            <p className={`${isLarge ? "text-3xl" : "text-xl"} font-black text-slate-800 truncate`}>
                ₹ {new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(value || 0)}
            </p>
        </div>
    );
}

function StatementSection({ title, items, color, total, isIncome }) {
    if (!items || items.length === 0) return null;
    return (
        <div className="border-b border-slate-100 last:border-b-0">
            <div className={`px-6 py-3 flex items-center justify-between sticky top-0 z-10 ${isIncome ? 'bg-emerald-50/30' : 'bg-rose-50/30'} backdrop-blur-sm`}>
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">{title}</span>
                <span className="text-xs font-black text-slate-800">₹ {new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(total)}</span>
            </div>
            <div className="divide-y divide-slate-50">
                {items.map((item, i) => (
                    <div key={i} className="px-6 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{item.accountName}</span>
                            {item.type && <span className="text-[9px] font-bold text-slate-400 uppercase">{item.type}</span>}
                        </div>
                        <span className="text-xs font-bold text-slate-500 tabular-nums">₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LoadingSpinner() {
    return (
        <div className="h-96 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">Analyzing Financial Data...</p>
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="h-96 flex flex-col items-center justify-center text-center space-y-4 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="bg-slate-50 p-6 rounded-full">
                <LayoutGrid className="w-12 h-12 text-slate-200" />
            </div>
            <div>
                <p className="text-slate-400 font-black text-lg">{text}</p>
                <p className="text-slate-300 text-sm font-medium">Select parameters and click search to begin</p>
            </div>
        </div>
    );
}
