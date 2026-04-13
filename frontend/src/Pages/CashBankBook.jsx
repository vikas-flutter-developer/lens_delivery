import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Eye,
    Wallet,
    Calendar,
    Filter,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
import { getCashBankBookReport, getBankAccounts } from '../controllers/Reports.controller';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function CashBankBook() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saleTransactions, setSaleTransactions] = useState([]);
    const [purchaseTransactions, setPurchaseTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [filteredAccounts, setFilteredAccounts] = useState([]);

    const [filters, setFilters] = useState({
        firmName: '',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        bookType: 'Cash Book', // Cash Book or Bank Book
        account: '', // Cash, KND Cash Box, or bank accounts
        transType: 'All', // All, sale, sale return, purchase, purchase return, payment, receipt, journal, debit note, credit note
    });

    const [summary, setSummary] = useState({
        openingAmount: 0,
        closingAmount: 0,
        saleTotalCash: 0,
        saleTotalBank: 0,
        purchaseTotalCash: 0,
        purchaseTotalBank: 0,
    });

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getCashBankBookReport(filters);
            if (res.success) {
                setSaleTransactions(res.data.saleTransactions || []);
                setPurchaseTransactions(res.data.purchaseTransactions || []);
                setSummary(res.data.summary || {
                    openingAmount: 0,
                    closingAmount: 0,
                    saleTotalCash: 0,
                    saleTotalBank: 0,
                    purchaseTotalCash: 0,
                    purchaseTotalBank: 0,
                });
            } else {
                toast.error(res.message || 'Failed to fetch cash/bank book data');
            }
        } catch (error) {
            console.error('Error fetching cash/bank book:', error);
            toast.error('Failed to fetch cash/bank book data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            firmName: '',
            dateFrom: new Date().toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            transType: 'All',
        });
        setSaleTransactions([]);
        setPurchaseTransactions([]);
        setSummary({
            openingAmount: 0,
            closingAmount: 0,
            saleTotalCash: 0,
            saleTotalBank: 0,
            purchaseTotalCash: 0,
            purchaseTotalBank: 0,
        });
    };

    const handleExportExcel = () => {
        const rows = [];

        // Header
        rows.push([`CASH / BANK BOOK SUMMARY`]);
        rows.push(['Firm Name:', filters.firmName || 'All']);
        rows.push(['Date From:', filters.dateFrom]);
        rows.push(['Date To:', filters.dateTo]);
        rows.push(['Opening Amount:', summary.openingAmount.toFixed(2)]);
        rows.push([]);

        // Sale Transactions
        rows.push(['SALE TRANSACTIONS (CREDITS)']);
        rows.push(['Date', 'Vch/Bill No', 'Account', 'Cash', 'Bank']);
        saleTransactions.forEach((item) => {
            rows.push([
                new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                item.vchNo,
                item.account,
                item.cash || 0,
                item.bank || 0,
            ]);
        });
        rows.push(['', '', 'TOTAL:', summary.saleTotalCash, summary.saleTotalBank]);
        rows.push([]);

        // Purchase Transactions
        rows.push(['PURCHASE TRANSACTIONS (DEBITS)']);
        rows.push(['Date', 'Vch/Bill No', 'Account', 'Cash', 'Bank']);
        purchaseTransactions.forEach((item) => {
            rows.push([
                new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                item.vchNo,
                item.account,
                item.cash || 0,
                item.bank || 0,
            ]);
        });
        rows.push(['', '', 'TOTAL:', summary.purchaseTotalCash, summary.purchaseTotalBank]);
        rows.push([]);

        // Summary
        rows.push(['Closing Amount:', summary.closingAmount.toFixed(2)]);

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `CashBankBook_${filters.dateFrom}_to_${filters.dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleView = (transaction) => {
        const { transType, docId } = transaction;
        let url = `/transaction/payrecptumicntr/voucherentry/${docId}`;
        window.open(url, '_blank');
    };

    const transTypeOptions = [
        'All',
        'Payment',
        'Receipt',
        'Journal',
        'Contra',
        'Debit',
        'Credit'
    ];

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden text-slate-900">
            {/* Header Bar */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-lg shrink-0 print:bg-white print:text-black print:border-b-2 print:border-black">
                <h1 className="text-lg font-bold flex items-center gap-3">
                    <Wallet className="w-5 h-5 print:hidden" />
                    Cash / Bank Book
                </h1>
                <div className="flex gap-2 print:hidden">
                    <button
                        onClick={handleExportExcel}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/30 flex items-center gap-2 text-sm font-medium"
                        title="Export to Excel"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/30 flex items-center gap-2 text-sm font-medium"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white border-b border-slate-200 p-4 shrink-0 print:hidden shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px] space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Firm Name</label>
                        <input
                            type="text"
                            placeholder="Enter firm name (optional)"
                            value={filters.firmName}
                            onChange={(e) => handleFilterChange('firmName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    <div className="space-y-1 min-w-[140px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    <div className="space-y-1 min-w-[140px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    <div className="space-y-1 min-w-[160px]">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Voucher Type</label>
                        <select
                            value={filters.transType}
                            onChange={(e) => handleFilterChange('transType', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                        >
                            {transTypeOptions.map((type, idx) => (
                                <option key={idx} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Search className="w-4 h-4" />
                        {loading ? 'Loading...' : 'Search'}
                    </button>

                    <button
                        onClick={handleReset}
                        className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 transition shadow-sm flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                </div>
            </div>

            {/* Summary Info Bar */}
            <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50 border-b border-slate-200 px-6 py-3 shrink-0 shadow-sm print:hidden">
                <div className="flex justify-between items-center text-sm">
                    <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Firm:</span>
                            <span className="font-bold text-slate-800">{filters.firmName || 'All Firms'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500 font-medium">Period:</span>
                            <span className="font-bold text-slate-800">
                                {new Date(filters.dateFrom).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} to {new Date(filters.dateTo).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-slate-500 font-medium">Opening:</span>
                            <span className="font-bold text-green-700">₹{summary.openingAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg">
                            <TrendingDown className="w-4 h-4 text-blue-600" />
                            <span className="text-slate-500 font-medium">Closing:</span>
                            <span className="font-bold text-blue-700">₹{summary.closingAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tables Section - Vertical Layout */}
            <div className="flex-1 overflow-auto bg-white p-4 space-y-6">
                {/* Sale Transactions Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide">Sale Transactions (Inflows)</h2>
                        <div className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full">
                            {saleTransactions.length} Records
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-gradient-to-r from-green-50 to-green-100 sticky top-0 z-10">
                                <tr className="border-b-2 border-green-200">
                                    <th className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200">Date</th>
                                    <th className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200 w-28">Vch/Bill No</th>
                                    <th className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200">Account / Party Name</th>
                                    <th className="px-3 py-2 text-right font-bold text-slate-700 border-r border-slate-200 w-32">Cash</th>
                                    <th className="px-3 py-2 text-right font-bold text-slate-700 border-r border-slate-200 w-32">Bank</th>
                                    <th className="px-3 py-2 text-center font-bold text-slate-700 print:hidden w-16">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-500">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : saleTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-500">
                                            No inflow transactions found
                                        </td>
                                    </tr>
                                ) : (
                                    saleTransactions.map((transaction, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-slate-200 hover:bg-green-50 transition-colors"
                                        >
                                            <td className="px-3 py-2 border-r border-slate-200">
                                                {new Date(transaction.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                            </td>
                                            <td className="px-3 py-2 border-r border-slate-200 font-mono">
                                                {transaction.vchNo}
                                            </td>
                                            <td className="px-3 py-2 border-r border-slate-200 font-medium">
                                                {transaction.account}
                                            </td>
                                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono text-green-700 font-bold">
                                                {transaction.cash > 0 ? transaction.cash.toFixed(2) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono text-blue-700 font-bold">
                                                {transaction.bank > 0 ? transaction.bank.toFixed(2) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center print:hidden">
                                                <button
                                                    onClick={() => handleView(transaction)}
                                                    className="p-1 hover:bg-green-100 rounded transition text-green-600"
                                                    title="View Voucher"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {saleTransactions.length > 0 && (
                                <tfoot className="bg-gradient-to-r from-green-100 to-green-50 sticky bottom-0 font-bold border-t-2 border-green-200">
                                    <tr>
                                        <td colSpan="3" className="px-3 py-2 text-right border-r border-slate-200 uppercase text-xs">
                                            Total Inflows:
                                        </td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200 text-green-700 font-mono">
                                            {summary.saleTotalCash.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200 text-blue-700 font-mono">
                                            {summary.saleTotalBank.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 print:hidden"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Purchase Transactions Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-2 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide">Purchase Transactions (Outflows)</h2>
                        <div className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full">
                            {purchaseTransactions.length} Records
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-gradient-to-r from-orange-50 to-orange-100 sticky top-0 z-10">
                                <tr className="border-b-2 border-orange-200">
                                    <th className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200">Date</th>
                                    <th className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200 w-28">Vch/Bill No</th>
                                    <th className="px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200">Account / Party Name</th>
                                    <th className="px-3 py-2 text-right font-bold text-slate-700 border-r border-slate-200 w-32">Cash</th>
                                    <th className="px-3 py-2 text-right font-bold text-slate-700 border-r border-slate-200 w-32">Bank</th>
                                    <th className="px-3 py-2 text-center font-bold text-slate-700 print:hidden w-16">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-500">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : purchaseTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-slate-500">
                                            No outflow transactions found
                                        </td>
                                    </tr>
                                ) : (
                                    purchaseTransactions.map((transaction, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-slate-200 hover:bg-orange-50 transition-colors"
                                        >
                                            <td className="px-3 py-2 border-r border-slate-200">
                                                {new Date(transaction.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                            </td>
                                            <td className="px-3 py-2 border-r border-slate-200 font-mono">
                                                {transaction.vchNo}
                                            </td>
                                            <td className="px-3 py-2 border-r border-slate-200 font-medium">
                                                {transaction.account}
                                            </td>
                                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono text-red-700 font-bold">
                                                {transaction.cash > 0 ? transaction.cash.toFixed(2) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono text-blue-700 font-bold">
                                                {transaction.bank > 0 ? transaction.bank.toFixed(2) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center print:hidden">
                                                <button
                                                    onClick={() => handleView(transaction)}
                                                    className="p-1 hover:bg-orange-100 rounded transition text-orange-600"
                                                    title="View Voucher"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {purchaseTransactions.length > 0 && (
                                <tfoot className="bg-gradient-to-r from-orange-100 to-orange-50 sticky bottom-0 font-bold border-t-2 border-orange-200">
                                    <tr>
                                        <td colSpan="3" className="px-3 py-2 text-right border-r border-slate-200 uppercase text-xs">
                                            Total Outflows:
                                        </td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200 text-red-700 font-mono">
                                            {summary.purchaseTotalCash.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right border-r border-slate-200 text-blue-700 font-mono">
                                            {summary.purchaseTotalBank.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 print:hidden"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
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

                    /* Hide everything except tables */
                    .print\\:hidden {
                        display: none !important;
                    }

                    /* Hide sidebar and navbar */
                    nav, aside, .sidebar, .navbar,
                    .w-fit.max-w-64, .bg-gray-800,
                    [class*="sidebar"], [class*="navbar"],
                    .flex.h-screen > div:first-child {
                        display: none !important;
                    }

                    /* Make main content full width */
                    .flex.h-screen {
                        display: block !important;
                    }

                    .flex.h-screen > div:last-child,
                    .flex-1 {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Main container adjustments */
                    .h-\\[calc\\(100vh-2rem\\)\\] {
                        height: auto !important;
                        background: white !important;
                    }

                    /* Tables container */
                    .overflow-auto {
                        overflow: visible !important;
                        padding: 0 !important;
                    }

                    /* Table styling */
                    table {
                        page-break-inside: auto;
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }

                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }

                    thead {
                        display: table-header-group;
                    }

                    tfoot {
                        display: table-footer-group;
                    }

                    th, td {
                        border: 1px solid #333 !important;
                        padding: 4px 6px !important;
                    }

                    /* Ensure colors print */
                    .bg-gradient-to-r {
                        background: #f0f0f0 !important;
                    }

                    /* Space between tables */
                    .space-y-6 > div {
                        margin-bottom: 20px !important;
                    }
                }
            `}</style>
        </div>
    );
}
