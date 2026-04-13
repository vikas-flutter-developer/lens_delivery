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
    ChevronDown
} from 'lucide-react';
import { getProfitAndLossAccountReport } from '../controllers/Reports.controller';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function ProfitAndLossAccount() {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [accountSearch, setAccountSearch] = useState('');
    const accountInputRef = useRef(null);

    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        accountName: ''
    });

    const [reportData, setReportData] = useState({
        expenses: {
            directExpenses: [],
            purchaseAccounts: [],
            openingStock: [],
            indirectExpenses: []
        },
        income: {
            closingStock: [],
            saleAccounts: []
        },
        summary: {
            totalDirectExpenses: 0,
            totalPurchase: 0,
            totalOpeningStock: 0,
            totalIndirectExpenses: 0,
            totalClosingStock: 0,
            totalSales: 0,
            grossProfitCO: 0,
            grossProfitBF: 0,
            netProfit: 0,
            totalExpenses: 0,
            totalIncome: 0
        }
    });

    // Fetch accounts on mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (accountInputRef.current && !accountInputRef.current.contains(e.target)) {
                setShowAccountDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await getAllAccounts();
            setAccounts(res || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const getFilteredAccounts = () => {
        const search = accountSearch.toLowerCase().trim();
        if (!search) return accounts.slice(0, 20);
        return accounts.filter(acc => 
            (acc.Name || '').toLowerCase().includes(search)
        ).slice(0, 20);
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const selectAccount = (account) => {
        setFilters(prev => ({ ...prev, accountName: account.Name }));
        setAccountSearch(account.Name);
        setShowAccountDropdown(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getProfitAndLossAccountReport(filters);
            
            if (res.success) {
                setReportData(res.data);
                toast.success('Report generated successfully');
            } else {
                toast.error(res.message || 'Failed to fetch report');
            }
        } catch (error) {
            console.error('Error fetching profit and loss account report:', error);
            toast.error('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            dateFrom: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            accountName: ''
        });
        setAccountSearch('');
        setReportData({
            expenses: {
                directExpenses: [],
                purchaseAccounts: [],
                openingStock: [],
                indirectExpenses: []
            },
            income: {
                closingStock: [],
                saleAccounts: []
            },
            summary: {
                totalDirectExpenses: 0,
                totalPurchase: 0,
                totalOpeningStock: 0,
                totalIndirectExpenses: 0,
                totalClosingStock: 0,
                totalSales: 0,
                grossProfitCO: 0,
                grossProfitBF: 0,
                netProfit: 0,
                totalExpenses: 0,
                totalIncome: 0
            }
        });
    };

    const handleExportCSV = () => {
        const rows = [];
        
        // Header
        rows.push(['PROFIT & LOSS ACCOUNT']);
        rows.push(['Period:', `${filters.dateFrom} to ${filters.dateTo}`]);
        rows.push(['Account:', filters.accountName || 'All Accounts']);
        rows.push([]);
        
        // Expenses Section
        rows.push(['EXPENSE', '', 'AMOUNT', 'NET AMOUNT', '', 'INCOME', '', 'AMOUNT', 'NET AMOUNT']);
        
        // Direct Expenses
        rows.push(['To Direct Expenses', '', '', '', '', 'By Closing Stock', '', '', '']);
        reportData.expenses.directExpenses.forEach(item => {
            rows.push(['', item.accountName, item.amount.toFixed(2), '', '', '', '', '', '']);
        });
        
        // Closing Stock
        reportData.income.closingStock.forEach((item, idx) => {
            if (idx === 0) {
                rows.push(['', '', '', reportData.summary.totalDirectExpenses.toFixed(2), '', '', item.accountName, item.amount.toFixed(2), '']);
            } else {
                rows.push(['', '', '', '', '', '', item.accountName, item.amount.toFixed(2), '']);
            }
        });
        
        if (reportData.income.closingStock.length > 0) {
            rows.push(['', '', '', '', '', '', '', '', reportData.summary.totalClosingStock.toFixed(2)]);
        }
        
        rows.push([]);
        
        // Purchase Accounts and Sale Accounts
        rows.push(['To Purchase Accounts', '', '', '', '', 'By Sale Accounts', '', '', '']);
        const maxRows = Math.max(reportData.expenses.purchaseAccounts.length, reportData.income.saleAccounts.length);
        for (let i = 0; i < maxRows; i++) {
            const purchase = reportData.expenses.purchaseAccounts[i];
            const sale = reportData.income.saleAccounts[i];
            rows.push([
                '', 
                purchase ? purchase.accountName : '', 
                purchase ? purchase.amount.toFixed(2) : '', 
                '',
                '',
                '', 
                sale ? sale.accountName : '', 
                sale ? sale.amount.toFixed(2) : '', 
                ''
            ]);
        }
        
        rows.push(['', '', '', reportData.summary.totalPurchase.toFixed(2), '', '', '', '', reportData.summary.totalSales.toFixed(2)]);
        rows.push([]);
        
        // Opening Stock
        rows.push(['To Opening Stock', '', '', '', '', '', '', '', '']);
        reportData.expenses.openingStock.forEach(item => {
            rows.push(['', item.accountName, item.amount.toFixed(2), '', '', '', '', '', '']);
        });
        rows.push(['', '', '', reportData.summary.totalOpeningStock.toFixed(2), '', '', '', '', '']);
        
        // Gross Profit
        rows.push(['Gross Profit c/o', '', '', reportData.summary.grossProfitCO.toFixed(2), '', 'Gross Profit b/f', '', '', reportData.summary.grossProfitBF.toFixed(2)]);
        rows.push([]);
        
        // Totals
        rows.push(['Total', '', '', reportData.summary.totalExpenses.toFixed(2), '', 'Total', '', '', reportData.summary.totalIncome.toFixed(2)]);
        
        // Indirect Expenses
        rows.push([]);
        rows.push(['To Indirect Expenses', '', '', '', '', '', '', '', '']);
        reportData.expenses.indirectExpenses.forEach(item => {
            rows.push(['', item.accountName, item.amount.toFixed(2), '', '', '', '', '', '']);
        });
        
        // Net Profit
        rows.push([]);
        rows.push(['Net Profit', '', '', reportData.summary.netProfit.toFixed(2), '', '', '', '', '']);

        const csv = Papa.unparse(rows);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = `profit_loss_account_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Report exported to CSV');
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const hasData = reportData.expenses.directExpenses.length > 0 || 
                    reportData.expenses.purchaseAccounts.length > 0 ||
                    reportData.expenses.openingStock.length > 0 ||
                    reportData.income.closingStock.length > 0 ||
                    reportData.income.saleAccounts.length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-0 overflow-hidden">
            {/* Header Bar */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white px-6 py-3 flex items-center justify-between shadow-lg print:bg-white print:text-black print:border-b-2 print:border-black">
                <h1 className="text-lg font-bold flex items-center gap-3">
                    <DollarSign className="w-6 h-6" />
                    Profit & Loss Account
                </h1>
                <div className="flex gap-2 print:hidden">
                    <button
                        onClick={handleExportCSV}
                        disabled={!hasData}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/30 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export to Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={!hasData}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/30 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm print:hidden">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Date From */}
                    <div className="space-y-1 min-w-[160px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    {/* Date To */}
                    <div className="space-y-1 min-w-[160px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    {/* Account Name Dropdown */}
                    <div className="flex-1 min-w-[280px] space-y-1 relative" ref={accountInputRef}>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Account Master Name</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={accountSearch}
                                onChange={(e) => {
                                    setAccountSearch(e.target.value);
                                    setShowAccountDropdown(true);
                                    if (!e.target.value) {
                                        handleFilterChange('accountName', '');
                                    }
                                }}
                                onFocus={() => setShowAccountDropdown(true)}
                                onKeyPress={handleKeyPress}
                                placeholder="Search and select account (optional)..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition pr-10"
                            />
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                        
                        {showAccountDropdown && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-20">
                                <div 
                                    onClick={() => {
                                        setFilters(prev => ({ ...prev, accountName: '' }));
                                        setAccountSearch('');
                                        setShowAccountDropdown(false);
                                    }}
                                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-medium border-b border-slate-200"
                                >
                                    All Accounts
                                </div>
                                {getFilteredAccounts().map((acc, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => selectAccount(acc)}
                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                                    >
                                        <span className="font-medium">{acc.Name}</span>
                                        {acc.Groups && acc.Groups.length > 0 && (
                                            <span className="text-slate-400 text-xs ml-2">({acc.Groups.join(', ')})</span>
                                        )}
                                    </div>
                                ))}
                                {getFilteredAccounts().length === 0 && (
                                    <div className="px-3 py-2 text-sm text-slate-500">No accounts found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Search className="w-4 h-4" />
                        {loading ? 'Loading...' : 'Search'}
                    </button>

                    <button
                        onClick={handleReset}
                        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition shadow-sm flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block p-4 text-center border-b-2 border-black">
                <h1 className="text-xl font-bold">Profit & Loss Account</h1>
                <p className="text-sm">Period: {filters.dateFrom} to {filters.dateTo}</p>
                {filters.accountName && <p className="text-sm">Account: {filters.accountName}</p>}
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 overflow-auto" style={{ height: 'calc(100vh - 140px)' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <p className="mt-4 text-slate-600">Generating report...</p>
                        </div>
                    </div>
                ) : !hasData ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg">Click "Search" to generate the Profit & Loss Account report</p>
                            <p className="text-slate-400 text-sm mt-2">Select date range and optionally filter by account</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                        {/* Two Column Layout */}
                        <div className="flex border-b-2 border-slate-300">
                            {/* Expense Column Header */}
                            <div className="w-1/2 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 text-center font-bold text-sm uppercase tracking-wide">
                                Expense
                            </div>
                            {/* Income Column Header */}
                            <div className="w-1/2 bg-gradient-to-r from-green-600 to-green-500 text-white px-4 py-2 text-center font-bold text-sm uppercase tracking-wide">
                                Income
                            </div>
                        </div>

                        {/* Table Headers */}
                        <div className="flex border-b border-slate-300 bg-slate-100">
                            {/* Expense Headers */}
                            <div className="w-1/2 flex text-xs font-semibold text-slate-700 border-r border-slate-300">
                                <div className="flex-1 px-3 py-2 border-r border-slate-200">Account Name</div>
                                <div className="w-28 px-3 py-2 text-right border-r border-slate-200">Amount</div>
                                <div className="w-32 px-3 py-2 text-right">Net Amount</div>
                            </div>
                            {/* Income Headers */}
                            <div className="w-1/2 flex text-xs font-semibold text-slate-700">
                                <div className="flex-1 px-3 py-2 border-r border-slate-200">Account Name</div>
                                <div className="w-28 px-3 py-2 text-right border-r border-slate-200">Amount</div>
                                <div className="w-32 px-3 py-2 text-right">Net Amount</div>
                            </div>
                        </div>

                        {/* Content Rows */}
                        <div className="flex text-sm">
                            {/* Expense Side */}
                            <div className="w-1/2 border-r border-slate-300">
                                {/* Direct Expenses Section */}
                                <div className="border-b border-slate-200">
                                    <div className="flex bg-red-50 font-semibold text-red-800">
                                        <div className="flex-1 px-3 py-2">To Direct Expenses</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-red-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-red-200">
                                            {formatCurrency(reportData.summary.totalDirectExpenses)}
                                        </div>
                                    </div>
                                    {reportData.expenses.directExpenses.map((item, idx) => (
                                        <div key={idx} className="flex hover:bg-slate-50">
                                            <div className="flex-1 px-3 py-1.5 pl-8 text-slate-700">{item.accountName}</div>
                                            <div className="w-28 px-3 py-1.5 text-right text-slate-600 font-mono text-xs border-l border-slate-100">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="w-32 px-3 py-1.5 text-right border-l border-slate-100"></div>
                                        </div>
                                    ))}
                                </div>

                                {/* Purchase Accounts Section */}
                                <div className="border-b border-slate-200">
                                    <div className="flex bg-red-50 font-semibold text-red-800">
                                        <div className="flex-1 px-3 py-2">To Purchase Accounts</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-red-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-red-200">
                                            {formatCurrency(reportData.summary.totalPurchase)}
                                        </div>
                                    </div>
                                    {reportData.expenses.purchaseAccounts.map((item, idx) => (
                                        <div key={idx} className="flex hover:bg-slate-50">
                                            <div className="flex-1 px-3 py-1.5 pl-8 text-slate-700">
                                                {item.type === 'minus' ? 'Purchase (-)' : 'Purchase'}
                                                <span className="text-slate-500 ml-2">{item.accountName}</span>
                                            </div>
                                            <div className="w-28 px-3 py-1.5 text-right text-slate-600 font-mono text-xs border-l border-slate-100">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="w-32 px-3 py-1.5 text-right border-l border-slate-100"></div>
                                        </div>
                                    ))}
                                </div>

                                {/* Opening Stock Section */}
                                <div className="border-b border-slate-200">
                                    <div className="flex bg-red-50 font-semibold text-red-800">
                                        <div className="flex-1 px-3 py-2">To Opening Stock</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-red-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-red-200">
                                            {formatCurrency(reportData.summary.totalOpeningStock)}
                                        </div>
                                    </div>
                                    {reportData.expenses.openingStock.map((item, idx) => (
                                        <div key={idx} className="flex hover:bg-slate-50">
                                            <div className="flex-1 px-3 py-1.5 pl-8 text-slate-700">{item.accountName}</div>
                                            <div className="w-28 px-3 py-1.5 text-right text-slate-600 font-mono text-xs border-l border-slate-100">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="w-32 px-3 py-1.5 text-right border-l border-slate-100"></div>
                                        </div>
                                    ))}
                                </div>

                                {/* Gross Profit c/o */}
                                <div className="border-b-2 border-dashed border-slate-400 bg-amber-50">
                                    <div className="flex font-bold text-amber-800">
                                        <div className="flex-1 px-3 py-2">Gross Profit c/o</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-amber-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-amber-200 font-mono">
                                            {formatCurrency(reportData.summary.grossProfitCO)}
                                        </div>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="border-b border-slate-300 bg-slate-100">
                                    <div className="flex font-bold text-slate-800">
                                        <div className="flex-1 px-3 py-2">Total</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-slate-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-slate-200 font-mono">
                                            {formatCurrency(reportData.summary.totalExpenses)}
                                        </div>
                                    </div>
                                </div>

                                {/* Indirect Expenses Section */}
                                <div className="border-b border-slate-200">
                                    <div className="flex bg-orange-50 font-semibold text-orange-800">
                                        <div className="flex-1 px-3 py-2">To Indirect Expenses</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-orange-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-orange-200">
                                            {formatCurrency(reportData.summary.totalIndirectExpenses)}
                                        </div>
                                    </div>
                                    {reportData.expenses.indirectExpenses.map((item, idx) => (
                                        <div key={idx} className="flex hover:bg-slate-50">
                                            <div className="flex-1 px-3 py-1.5 pl-8 text-slate-700">{item.accountName}</div>
                                            <div className="w-28 px-3 py-1.5 text-right text-slate-600 font-mono text-xs border-l border-slate-100">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="w-32 px-3 py-1.5 text-right border-l border-slate-100"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Income Side */}
                            <div className="w-1/2">
                                {/* Closing Stock Section */}
                                <div className="border-b border-slate-200">
                                    <div className="flex bg-green-50 font-semibold text-green-800">
                                        <div className="flex-1 px-3 py-2">By Closing Stock</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-green-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-green-200">
                                            {formatCurrency(reportData.summary.totalClosingStock)}
                                        </div>
                                    </div>
                                    {reportData.income.closingStock.map((item, idx) => (
                                        <div key={idx} className="flex hover:bg-slate-50">
                                            <div className="flex-1 px-3 py-1.5 pl-8 text-slate-700">{item.accountName}</div>
                                            <div className="w-28 px-3 py-1.5 text-right text-slate-600 font-mono text-xs border-l border-slate-100">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="w-32 px-3 py-1.5 text-right border-l border-slate-100"></div>
                                        </div>
                                    ))}
                                </div>

                                {/* Sale Accounts Section */}
                                <div className="border-b border-slate-200">
                                    <div className="flex bg-green-50 font-semibold text-green-800">
                                        <div className="flex-1 px-3 py-2">By Sale Accounts</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-green-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-green-200">
                                            {formatCurrency(reportData.summary.totalSales)}
                                        </div>
                                    </div>
                                    {reportData.income.saleAccounts.map((item, idx) => (
                                        <div key={idx} className="flex hover:bg-slate-50">
                                            <div className="flex-1 px-3 py-1.5 pl-8 text-slate-700">
                                                {item.type === 'minus' ? 'Sale (-)' : 'Sale'}
                                                <span className="text-slate-500 ml-2">{item.accountName}</span>
                                            </div>
                                            <div className="w-28 px-3 py-1.5 text-right text-slate-600 font-mono text-xs border-l border-slate-100">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="w-32 px-3 py-1.5 text-right border-l border-slate-100"></div>
                                        </div>
                                    ))}
                                </div>

                                {/* Empty space to align with left side */}
                                <div className="border-b border-slate-200 bg-slate-50 py-4"></div>

                                {/* Gross Profit b/f */}
                                <div className="border-b-2 border-dashed border-slate-400 bg-amber-50">
                                    <div className="flex font-bold text-amber-800">
                                        <div className="flex-1 px-3 py-2">Gross Profit b/f</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-amber-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-amber-200 font-mono">
                                            {formatCurrency(reportData.summary.grossProfitBF)}
                                        </div>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="border-b border-slate-300 bg-slate-100">
                                    <div className="flex font-bold text-slate-800">
                                        <div className="flex-1 px-3 py-2">Total</div>
                                        <div className="w-28 px-3 py-2 text-right border-l border-slate-200"></div>
                                        <div className="w-32 px-3 py-2 text-right border-l border-slate-200 font-mono">
                                            {formatCurrency(reportData.summary.totalIncome)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Net Profit/Loss Summary */}
                        <div className={`p-4 ${reportData.summary.netProfit >= 0 ? 'bg-gradient-to-r from-green-100 to-emerald-100' : 'bg-gradient-to-r from-red-100 to-orange-100'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {reportData.summary.netProfit >= 0 ? (
                                        <TrendingUp className="w-8 h-8 text-green-600" />
                                    ) : (
                                        <TrendingDown className="w-8 h-8 text-red-600" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-slate-600">
                                            {reportData.summary.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                                        </p>
                                        <p className={`text-2xl font-bold ${reportData.summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            ₹ {formatCurrency(Math.abs(reportData.summary.netProfit))}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right text-sm text-slate-600">
                                    <p>Period: {new Date(filters.dateFrom).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} to {new Date(filters.dateTo).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                                    {filters.accountName && <p>Account: {filters.accountName}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }

                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }

                    .print\\:hidden {
                        display: none !important;
                    }

                    .print\\:block {
                        display: block !important;
                    }

                    nav, aside, .sidebar, .navbar {
                        display: none !important;
                    }

                    .flex.h-screen {
                        display: block !important;
                    }

                    .flex.h-screen > div:first-child {
                        display: none !important;
                    }

                    .flex-1 {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .min-h-screen {
                        min-height: auto !important;
                        background: white !important;
                    }

                    .overflow-auto {
                        overflow: visible !important;
                        height: auto !important;
                    }

                    .bg-gradient-to-br,
                    .bg-gradient-to-r {
                        background: white !important;
                    }

                    table {
                        page-break-inside: auto;
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }

                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }

                    th, td {
                        border: 1px solid #333 !important;
                        padding: 4px 6px !important;
                    }

                    .shadow-lg, .shadow-md, .shadow-sm {
                        box-shadow: none !important;
                    }

                    .rounded-lg {
                        border-radius: 0 !important;
                    }
                }
            `}</style>
        </div>
    );
}
