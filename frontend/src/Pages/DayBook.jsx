import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Eye,
    BookOpen,
    Calendar,
    Filter,
    Layout,
} from 'lucide-react';
import { getDayBookReport } from '../controllers/Reports.controller';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function DayBook() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [filters, setFilters] = useState({
        firmName: '',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
    });

    const [summary, setSummary] = useState({
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
    });

    useEffect(() => {
        fetchAccounts();
        handleSearch();
    }, []);

    useEffect(() => {
        // Filter transactions based on search term
        if (searchTerm.trim() === '') {
            setFilteredTransactions(transactions);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = transactions.filter(t => {
                const searchMatch = t.account?.toLowerCase().includes(term) ||
                    t.transType?.toLowerCase().includes(term) ||
                    t.vchNo?.toString().includes(term);

                const itemMatch = t.items && t.items.some(it =>
                    it.itemName?.toLowerCase().includes(term) ||
                    it.orderNo?.toLowerCase().includes(term) ||
                    it.remark?.toLowerCase().includes(term)
                );

                return searchMatch || itemMatch;
            });
            setFilteredTransactions(filtered);
        }
    }, [searchTerm, transactions]);

    const fetchAccounts = async () => {
        try {
            const res = await getAllAccounts();
            setAccounts(res || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const [columns, setColumns] = useState([
        { id: 'sNo', label: 'SNo', visible: true },
        { id: 'date', label: 'Date', visible: true },
        { id: 'transType', label: 'Trans Type', visible: true },
        { id: 'vchNo', label: 'Vch No', visible: true },
        { id: 'account', label: 'Account', visible: true },
        { id: 'itemName', label: 'Item Name', visible: true },
        { id: 'orderNo', label: 'Ord No', visible: true },
        { id: 'eye', label: 'Eye', visible: true },
        { id: 'sph', label: 'SPH', visible: true },
        { id: 'cyl', label: 'CYL', visible: true },
        { id: 'axis', label: 'Axis', visible: true },
        { id: 'add', label: 'ADD', visible: true },
        { id: 'remark', label: 'Remark', visible: true },
        { id: 'debit', label: 'Debit', visible: true },
        { id: 'credit', label: 'Credit', visible: true },
    ]);

    const [showColumnFilter, setShowColumnFilter] = useState(false);

    const toggleColumn = (id) => {
        setColumns(prev => prev.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getDayBookReport(filters);
            if (res.success) {
                setTransactions(res.data.transactions || []);
                setFilteredTransactions(res.data.transactions || []);
                setSummary(res.data.summary || { totalDebit: 0, totalCredit: 0, balance: 0 });
            } else {
                toast.error(res.message || 'Failed to fetch day book data');
            }
        } catch (error) {
            console.error('Error fetching day book:', error);
            // Check specifically for 403 to give better feedback
            if (error.response?.status === 403) {
                toast.error('Session expired or access denied. Please re-login.');
            } else {
                toast.error('Failed to fetch day book data');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            firmName: '',
            dateFrom: new Date().toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
        });
        setSearchTerm('');
        setTransactions([]);
        setFilteredTransactions([]);
        setSummary({ totalDebit: 0, totalCredit: 0, balance: 0 });
    };

    const handleExportExcel = () => {
        const rows = [];
        // Header
        rows.push(['DAY BOOK SUMMARY']);
        rows.push(['Firm Name:', filters.firmName || 'All']);
        rows.push(['Date From:', filters.dateFrom]);
        rows.push(['Date To:', filters.dateTo]);
        rows.push([]);
        // Column headers - only visible ones
        const visibleCols = columns.filter(c => c.visible);
        rows.push(visibleCols.map(c => c.label));

        // Data rows
        filteredTransactions.forEach((item, idx) => {
            const rowData = [];
            if (columns.find(c => c.id === 'sNo')?.visible) rowData.push(idx + 1);
            if (columns.find(c => c.id === 'date')?.visible) rowData.push(new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }));
            if (columns.find(c => c.id === 'transType')?.visible) rowData.push(item.transType);
            if (columns.find(c => c.id === 'vchNo')?.visible) rowData.push(item.vchNo);
            if (columns.find(c => c.id === 'account')?.visible) rowData.push(item.account);
            if (columns.find(c => c.id === 'itemName')?.visible) rowData.push(item.items ? item.items.map(i => i.itemName || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'orderNo')?.visible) rowData.push(item.items ? item.items.map(i => i.orderNo || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'eye')?.visible) rowData.push(item.items ? item.items.map(i => i.eye || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'sph')?.visible) rowData.push(item.items ? item.items.map(i => i.sph || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'cyl')?.visible) rowData.push(item.items ? item.items.map(i => i.cyl || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'axis')?.visible) rowData.push(item.items ? item.items.map(i => i.axis || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'add')?.visible) rowData.push(item.items ? item.items.map(i => i.add || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'remark')?.visible) rowData.push(item.items ? item.items.map(i => i.remark || '-').join(' | ') : '');
            if (columns.find(c => c.id === 'debit')?.visible) rowData.push(item.debit || 0);
            if (columns.find(c => c.id === 'credit')?.visible) rowData.push(item.credit || 0);
            rows.push(rowData);
        });

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `DayBook_${filters.dateFrom}_to_${filters.dateTo}.csv`);
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
        let url = '';
        if (transType === 'Purchase Invoice') url = `/lenstransaction/purchase/AddLensPurchase/${docId}`;
        else if (transType === 'Sale Invoice') url = `/lenstransaction/sale/AddLensSale/${docId}`;
        else if (transType === 'Purchase Order') url = `/lenstransaction/purchase/AddLensPurchaseOrder/${docId}`;
        else if (transType === 'Sale Order') url = `/lenstransaction/sale/AddLensSaleOrder/${docId}`;
        else if (transType === 'Purchase Challan') url = `/lenstransaction/purchase/AddLensPurchaseChallan/${docId}`;
        else if (transType === 'Sale Challan') url = `/lenstransaction/sale/AddLensSaleChallan/${docId}`;

        if (url) window.open(url, '_blank');
        else toast.info('View not available for this type');
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans">
            {/* Header Bar */}
            <div className="bg-[#4a86e8] text-white px-4 py-2.5 flex items-center justify-between shadow-sm shrink-0 print:hidden">
                <h1 className="text-base font-black flex items-center gap-2 uppercase tracking-tight">
                    <BookOpen className="w-5 h-5 text-blue-200" />
                    Day Book Summary
                </h1>
            </div>

            {/* Filters Section */}
            <div className="bg-white border-b border-slate-200 p-4 shrink-0 print:hidden shadow-sm">
                <div className="flex flex-wrap items-end gap-3 text-sm font-bold">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-slate-500 font-black mb-1.5 uppercase text-[10px] tracking-widest">Firm Name</label>
                        <input
                            type="text"
                            placeholder="All Firms"
                            value={filters.firmName}
                            onChange={(e) => handleFilterChange('firmName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>

                    <div className="w-40">
                        <label className="block text-slate-500 font-black mb-1.5 uppercase text-[10px] tracking-widest">From Date</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>

                    <div className="w-40">
                        <label className="block text-slate-500 font-black mb-1.5 uppercase text-[10px] tracking-widest">To Date</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Quick search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnFilter(!showColumnFilter)}
                                className="px-5 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-black hover:bg-slate-50 transition flex items-center gap-2 text-sm shadow-sm"
                            >
                                <Layout className="w-4 h-4 text-blue-600" />
                                Columns
                            </button>
                            {showColumnFilter && (
                                <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 p-3 max-h-[70vh] overflow-y-auto ring-1 ring-black ring-opacity-5">
                                    <h4 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest border-b pb-2">Toggle Visibility</h4>
                                    <div className="space-y-1">
                                        {columns.map(col => (
                                            <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group">
                                                <input
                                                    type="checkbox"
                                                    checked={col.visible}
                                                    onChange={() => toggleColumn(col.id)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                />
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700">{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-8 py-2 bg-blue-600 text-white rounded-lg font-black hover:bg-blue-700 transition shadow-lg shadow-blue-100 uppercase text-xs"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-black hover:bg-slate-200 transition border border-slate-200"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={handleExportExcel} className="p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-lg shadow-green-100">
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                        <button onClick={handlePrint} className="p-2.5 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition shadow-lg shadow-slate-100">
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Info Bar */}
            <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 px-4 py-2 shrink-0">
                <div className="flex justify-between items-center text-xs">
                    <div className="flex gap-6">
                        <div>
                            <span className="text-slate-500 font-medium">Firm: </span>
                            <span className="font-bold text-slate-700">{filters.firmName || 'All Firms'}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 font-medium">Period: </span>
                            <span className="font-bold text-slate-700">
                                {new Date(filters.dateFrom).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} to {new Date(filters.dateTo).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 font-medium">Transactions: </span>
                            <span className="font-bold text-slate-700">{filteredTransactions.length}</span>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <div>
                            <span className="text-slate-500 font-medium">Total Debit: </span>
                            <span className="font-bold text-green-600">₹{summary.totalDebit.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 font-medium">Total Credit: </span>
                            <span className="font-bold text-red-600">₹{summary.totalCredit.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 font-medium">Balance: </span>
                            <span className={`font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{Math.abs(summary.balance).toFixed(2)} {summary.balance >= 0 ? 'Dr' : 'Cr'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 overflow-auto bg-white">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#e7f0f7] sticky top-0 z-10 border-b border-blue-200 shadow-sm font-black">
                        <tr>
                            {columns.find(c => c.id === 'sNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">SNo</th>}
                            {columns.find(c => c.id === 'date')?.visible && <th className="px-4 py-3 text-left text-blue-900 border-r border-blue-100">Date</th>}
                            {columns.find(c => c.id === 'transType')?.visible && <th className="px-4 py-3 text-left text-blue-900 border-r border-blue-100">Trans Type</th>}
                            {columns.find(c => c.id === 'vchNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">Vch No</th>}
                            {columns.find(c => c.id === 'account')?.visible && <th className="px-5 py-3 text-left text-blue-900 border-r border-blue-100">Account</th>}
                            {columns.find(c => c.id === 'itemName')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 min-w-[150px]">Item Name</th>}
                            {columns.find(c => c.id === 'orderNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">Ord No</th>}
                            {columns.find(c => c.id === 'eye')?.visible && <th className="px-3 py-3 text-center text-blue-900 border-r border-blue-100">Eye</th>}
                            {columns.find(c => c.id === 'sph')?.visible && <th className="px-3 py-3 text-center text-blue-900 border-r border-blue-100">SPH</th>}
                            {columns.find(c => c.id === 'cyl')?.visible && <th className="px-3 py-3 text-center text-blue-900 border-r border-blue-100">CYL</th>}
                            {columns.find(c => c.id === 'axis')?.visible && <th className="px-3 py-3 text-center text-blue-900 border-r border-blue-100">Axis</th>}
                            {columns.find(c => c.id === 'add')?.visible && <th className="px-3 py-3 text-center text-blue-900 border-r border-blue-100">ADD</th>}
                            {columns.find(c => c.id === 'remark')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 min-w-[120px]">Remark</th>}
                            {columns.find(c => c.id === 'debit')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Debit</th>}
                            {columns.find(c => c.id === 'credit')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Credit</th>}
                            <th className="px-3 py-3 text-center text-blue-900 print:hidden">View</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="20" className="text-center py-20">
                                    <div className="flex flex-col items-center justify-center gap-4 text-blue-600 font-black text-xl">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                                        Fetching day book...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredTransactions.length === 0 ? (
                            <tr>
                                <td colSpan="20" className="text-center py-20 text-slate-400 italic font-black text-xl">
                                    No records found for this period
                                </td>
                            </tr>
                        ) : (
                            filteredTransactions.map((transaction, index) => (
                                <tr key={index} className="hover:bg-blue-50/40 transition-colors group">
                                    {columns.find(c => c.id === 'sNo')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-center text-slate-500 font-bold">{index + 1}</td>}
                                    {columns.find(c => c.id === 'date')?.visible && <td className="px-4 py-2.5 border-r border-slate-100 whitespace-nowrap font-medium text-slate-700">{new Date(transaction.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>}
                                    {columns.find(c => c.id === 'transType')?.visible && (
                                        <td className="px-4 py-2.5 border-r border-slate-100">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase tracking-tight">
                                                {transaction.transType}
                                            </span>
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'vchNo')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 font-black text-slate-800 tracking-tight font-mono">{transaction.vchNo}</td>}
                                    {columns.find(c => c.id === 'account')?.visible && <td className="px-5 py-2.5 border-r border-slate-100 font-black text-slate-900 uppercase text-xs">{transaction.account}</td>}
                                    {columns.find(c => c.id === 'itemName')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1 whitespace-nowrap text-slate-700 font-medium text-[11px] truncate max-w-[200px]" title={it.itemName}>{it.itemName || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'orderNo')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-600 font-semibold text-[11px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1">{it.orderNo || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'eye')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-center font-bold text-slate-700 text-[11px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1">{it.eye || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'sph')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-center text-slate-600 font-mono text-[11px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1">{it.sph || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'cyl')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-center text-slate-600 font-mono text-[11px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1">{it.cyl || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'axis')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-center text-slate-600 font-mono text-[11px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1">{it.axis || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'add')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-center text-slate-600 font-mono text-[11px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1">{it.add || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'remark')?.visible && (
                                        <td className="px-3 py-1.5 border-r border-slate-100 text-slate-500 italic text-[10px]">
                                            {transaction.items && transaction.items.map((it, i) => <div key={i} className="py-1 truncate max-w-[150px]" title={it.remark}>{it.remark || '-'}</div>)}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'debit')?.visible && (
                                        <td className="px-3 py-2.5 border-r border-slate-100 text-right font-black text-green-700">
                                            {transaction.debit > 0 ? transaction.debit.toFixed(2) : '-'}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'credit')?.visible && (
                                        <td className="px-3 py-2.5 border-r border-slate-100 text-right font-black text-red-700">
                                            {transaction.credit > 0 ? transaction.credit.toFixed(2) : '-'}
                                        </td>
                                    )}
                                    <td className="px-3 py-2.5 text-center print:hidden">
                                        <button
                                            onClick={() => handleView(transaction)}
                                            className="p-1.5 hover:bg-blue-100 rounded-lg transition text-blue-600 shadow-sm border border-transparent hover:border-blue-200"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {filteredTransactions.length > 0 && (
                        <tfoot className="bg-slate-50 sticky bottom-0 font-black border-t-2 border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                            <tr>
                                <td colSpan={columns.filter(c => ['sNo', 'date', 'transType', 'vchNo', 'account', 'itemName', 'orderNo', 'eye', 'sph', 'cyl', 'axis', 'add', 'remark'].includes(c.id) && c.visible).length} className="px-4 py-3 text-right text-slate-400 uppercase text-[10px] tracking-widest">
                                    Totals
                                </td>
                                {columns.find(c => c.id === 'debit')?.visible && (
                                    <td className="px-3 py-3 text-right border-r border-slate-200 text-green-700 text-base">
                                        ₹{summary.totalDebit.toFixed(2)}
                                    </td>
                                )}
                                {columns.find(c => c.id === 'credit')?.visible && (
                                    <td className="px-3 py-3 text-right border-r border-slate-200 text-red-700 text-base">
                                        ₹{summary.totalCredit.toFixed(2)}
                                    </td>
                                )}
                                <td className="print:hidden"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    /* Reset page margins and size */
                    @page {
                        size: A4;
                        margin: 15mm;
                    }

                    /* Body and root styles */
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide sidebar and navbar completely */
                    nav,
                    aside,
                    .sidebar,
                    .navbar,
                    .w-fit.max-w-64,
                    .bg-gray-800,
                    [class*="sidebar"],
                    [class*="navbar"],
                    .flex.h-screen > div:first-child {
                        display: none !important;
                        visibility: hidden !important;
                        width: 0 !important;
                        height: 0 !important;
                        overflow: hidden !important;
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

                    /* Hide all non-essential elements */
                    .print\\:hidden {
                        display: none !important;
                    }

                    /* Main container adjustments */
                    .h-\\[calc\\(100vh-2rem\\)\\] {
                        height: auto !important;
                        min-height: 0 !important;
                    }

                    .overflow-hidden {
                        overflow: visible !important;
                    }

                    .bg-slate-50 {
                        background: white !important;
                    }

                    /* Header styling for print */
                    .bg-blue-600 {
                        background: white !important;
                        border-bottom: 2px solid black !important;
                        padding: 10px 0 !important;
                    }

                    /* Summary bar for print */
                    .bg-gradient-to-r {
                        background: white !important;
                        border: 1px solid #ddd !important;
                        margin-bottom: 10px !important;
                        padding: 8px !important;
                    }

                    /* Table container */
                    .flex-1 {
                        flex: none !important;
                        overflow: visible !important;
                    }

                    /* Prevent blank pages */
                    * {
                        box-sizing: border-box !important;
                    }

                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                    }

                    /* Remove any margins that might cause blank pages */
                    div, section, article {
                        page-break-after: auto !important;
                        margin-bottom: 0 !important;
                    }

                    /* Table styles */
                    table {
                        page-break-inside: auto;
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 10pt !important;
                        margin: 0 !important;
                    }

                    thead {
                        display: table-header-group;
                        background: #f0f0f0 !important;
                    }

                    tfoot {
                        display: table-footer-group;
                        background: #f0f0f0 !important;
                    }

                    tbody {
                        display: table-row-group;
                    }

                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }

                    th, td {
                        border: 1px solid #333 !important;
                        padding: 4px 6px !important;
                    }

                    th {
                        font-weight: bold !important;
                        text-align: left !important;
                    }

                    /* Remove hover effects */
                    .hover\\:bg-blue-50:hover {
                        background: transparent !important;
                    }

                    /* Ensure colors print correctly */
                    .text-green-700, .text-green-600 {
                        color: #15803d !important;
                    }

                    .text-red-700, .text-red-600 {
                        color: #b91c1c !important;
                    }

                    .text-blue-700 {
                        color: #1d4ed8 !important;
                    }

                    /* Badge styling for print */
                    .bg-blue-100 {
                        background: #dbeafe !important;
                        padding: 2px 6px !important;
                        border-radius: 3px !important;
                    }

                    /* Remove sticky positioning */
                    .sticky {
                        position: static !important;
                    }

                    /* Ensure proper spacing */
                    .px-3 {
                        padding-left: 6px !important;
                        padding-right: 6px !important;
                    }

                    .py-2 {
                        padding-top: 4px !important;
                        padding-bottom: 4px !important;
                    }

                    /* Print title styling */
                    h1 {
                        font-size: 18pt !important;
                        font-weight: bold !important;
                        text-align: center !important;
                        margin-bottom: 10px !important;
                        color: black !important;
                    }

                    /* Summary info styling */
                    .text-xs {
                        font-size: 9pt !important;
                    }

                    .font-bold {
                        font-weight: bold !important;
                    }

                    /* Ensure all borders are visible */
                    .border-r, .border-b, .border-t, .border-l {
                        border-color: #333 !important;
                    }

                    /* Prevent orphaned content */
                    .overflow-auto {
                        overflow: visible !important;
                        height: auto !important;
                    }
                }
            `}</style>
        </div>
    );
}
