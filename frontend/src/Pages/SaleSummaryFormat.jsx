import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    CheckSquare,
    Edit3,
    Layout,
} from 'lucide-react';
import { getSaleSummaryFormatReport } from '../controllers/Reports.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { roundAmount } from '../utils/amountUtils';

export default function SaleSummaryFormat({ hideHeader = false }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);

    // Default dates from image (Dec 2025 - Jan 2026)
    const [filters, setFilters] = useState({
        billSeries: '',
        dateFrom: '2025-12-28',
        dateTo: new Date().toISOString().split('T')[0],
        searchText: ''
    });

    useEffect(() => {
        handleSearch();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filters]);

    const [columns, setColumns] = useState([
        { id: 'sNo', label: 'SNo', visible: true },
        { id: 'date', label: 'Date', visible: true },
        { id: 'billNo', label: 'Bill No', visible: true },
        { id: 'partyName', label: 'Party Name', visible: true },
        { id: 'mobileNo', label: 'Mobile No', visible: true },
        { id: 'gstin', label: 'GSTIN', visible: true },
        { id: 'state', label: 'State', visible: true },
        { id: 'billType', label: 'Bill Type', visible: true },
        { id: 'mtrlCntr', label: 'Mtrl Cntr', visible: true },
        { id: 'totalQty', label: 'Total Qty', visible: true },
        { id: 'totalAmt', label: 'Total Amt', visible: true },
        { id: 'taxableAmt', label: 'Taxable Amt', visible: true },
        { id: 'taxPercent', label: 'Tax@%', visible: true },
        { id: 'cgstPercent', label: 'Cgst %', visible: true },
        { id: 'cgstAmt', label: 'Cgst Amt', visible: true },
        { id: 'sgstPercent', label: 'Sgst %', visible: true },
        { id: 'sgstAmt', label: 'Sgst Amt', visible: true },
    ]);

    const [showColumnFilter, setShowColumnFilter] = useState(false);

    const toggleColumn = (id) => {
        setColumns(prev => prev.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getSaleSummaryFormatReport(filters);
            if (res.success) {
                setReportData(res.data || []);
            } else {
                toast.error(res.message || 'Failed to fetch sale summary');
            }
        } catch (error) {
            console.error('Error fetching sale summary:', error);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            billSeries: '',
            dateFrom: '2025-12-28',
            dateTo: new Date().toISOString().split('T')[0],
            searchText: ''
        });
        setReportData([]);
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            toast.error("No data to export");
            return;
        }

        const csvData = reportData.map((t, idx) => ({
            'SNo': idx + 1,
            'Date': new Date(t.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
            'Bill No': t.billNo,
            'Party Name': t.partyName,
            'Mobile No': t.mobileNo,
            'GSTIN': t.gstin,
            'State': t.state,
            'Bill Type': t.billType,
            'Mtrl Cntr': t.mtrlCntr,
            'Total Qty': t.totalQty,
            'Total Amt': roundAmount(t.totalAmt),
            'Taxable Amt': roundAmount(t.taxableAmt),
            'Tax@%': t.taxPercent.toFixed(2),
            'Cgst %': t.cgstPercent.toFixed(2),
            'Cgst Amt': roundAmount(t.cgstAmt),
            'Sgst %': t.sgstPercent.toFixed(2),
            'Sgst Amt': roundAmount(t.sgstAmt)
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `SaleSummaryFormat2_${filters.dateFrom}_to_${filters.dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (num) => {
        const rounded = roundAmount(num || 0);
        return new Intl.NumberFormat('en-IN').format(rounded);
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans">
            {/* Header */}
            {!hideHeader && (
                <div className="bg-[#4a86e8] text-white px-4 py-2 flex items-center justify-between shadow-sm shrink-0 print:hidden text-lg font-black">
                    <span>Invoice Summary Formate 2</span>
                </div>
            )}

            {/* Filters Area */}
            <div className="p-4 bg-[#f0f7ff] border-b border-slate-200 shrink-0 print:hidden shadow-sm">
                <div className="flex flex-wrap items-end gap-4 text-sm font-bold">
                    <div className="flex-1 min-w-[250px]">
                        <label className="block text-teal-700 font-black mb-1.5 uppercase tracking-wide">Bill Series</label>
                        <input
                            type="text"
                            value={filters.billSeries}
                            onChange={(e) => handleFilterChange('billSeries', e.target.value)}
                            placeholder="Enter Bill Series"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                        />
                    </div>

                    <div className="w-48">
                        <label className="block text-teal-700 font-black mb-1.5 uppercase tracking-wide">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-48">
                        <label className="block text-teal-700 font-black mb-1.5 uppercase tracking-wide">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex-1 min-w-[250px]">
                        <input
                            type="text"
                            value={filters.searchText}
                            onChange={(e) => handleFilterChange('searchText', e.target.value)}
                            placeholder="Search records..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnFilter(!showColumnFilter)}
                                className="px-5 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-black hover:bg-slate-50 transition flex items-center gap-2 text-sm shadow-sm"
                            >
                                <Layout className="w-4 h-4 text-blue-600" />
                                Columns ({columns.filter(c => c.visible).length})
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
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-8 py-2 bg-cyan-500 text-white rounded-lg font-black hover:bg-cyan-600 transition shadow-lg shadow-cyan-100 uppercase text-xs"
                        >
                            Reset
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

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-white">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#e7f0f7] sticky top-0 z-10 border-b border-blue-200 shadow-sm font-black">
                        <tr>
                            {columns.find(c => c.id === 'sNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">SNo</th>}
                            {columns.find(c => c.id === 'date')?.visible && <th className="px-4 py-3 text-left text-blue-900 border-r border-blue-100">Date</th>}
                            {columns.find(c => c.id === 'billNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">Bill No</th>}
                            {columns.find(c => c.id === 'partyName')?.visible && <th className="px-5 py-3 text-left text-blue-900 border-r border-blue-100 font-black uppercase text-xs tracking-tight">Party Name</th>}
                            {columns.find(c => c.id === 'mobileNo')?.visible && <th className="px-4 py-3 text-left text-blue-900 border-r border-blue-100">Mobile No</th>}
                            {columns.find(c => c.id === 'gstin')?.visible && <th className="px-4 py-3 text-left text-blue-900 border-r border-blue-100">GSTIN</th>}
                            {columns.find(c => c.id === 'state')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">State</th>}
                            {columns.find(c => c.id === 'billType')?.visible && <th className="px-4 py-3 text-left text-blue-900 border-r border-blue-100">Bill Type</th>}
                            {columns.find(c => c.id === 'mtrlCntr')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100">Mtrl Cntr</th>}
                            {columns.find(c => c.id === 'totalQty')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Total Qty</th>}
                            {columns.find(c => c.id === 'totalAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Total Amt</th>}
                            {columns.find(c => c.id === 'taxableAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Taxable Amt</th>}
                            {columns.find(c => c.id === 'taxPercent')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Tax@%</th>}
                            {columns.find(c => c.id === 'cgstPercent')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Cgst %</th>}
                            {columns.find(c => c.id === 'cgstAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Cgst Amt</th>}
                            {columns.find(c => c.id === 'sgstPercent')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100">Sgst %</th>}
                            {columns.find(c => c.id === 'sgstAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900">Sgst Amt</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="20" className="text-center py-20">
                                    <div className="flex flex-col items-center justify-center gap-4 text-blue-600 font-black text-xl">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                                        Generating report...
                                    </div>
                                </td>
                            </tr>
                        ) : reportData.length === 0 ? (
                            <tr>
                                <td colSpan="20" className="text-center py-20 text-slate-400 italic font-black text-xl">
                                    No records found in this time range
                                </td>
                            </tr>
                        ) : (
                            reportData.map((t, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                                    {columns.find(c => c.id === 'sNo')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-center text-slate-500 font-bold">{idx + 1}</td>}
                                    {columns.find(c => c.id === 'date')?.visible && <td className="px-4 py-2.5 border-r border-slate-100 whitespace-nowrap font-medium text-slate-700">{new Date(t.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>}
                                    {columns.find(c => c.id === 'billNo')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 font-black text-slate-800 tracking-tight">{t.billNo}</td>}
                                    {columns.find(c => c.id === 'partyName')?.visible && <td className="px-5 py-2.5 border-r border-slate-100 font-black text-slate-900 uppercase text-xs">{t.partyName}</td>}
                                    {columns.find(c => c.id === 'mobileNo')?.visible && <td className="px-4 py-2.5 border-r border-slate-100 text-slate-600 font-bold">{t.mobileNo}</td>}
                                    {columns.find(c => c.id === 'gstin')?.visible && <td className="px-4 py-2.5 border-r border-slate-100 font-mono text-xs text-blue-600 font-bold tracking-tighter">{t.gstin}</td>}
                                    {columns.find(c => c.id === 'state')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-slate-700 font-medium">{t.state}</td>}
                                    {columns.find(c => c.id === 'billType')?.visible && <td className="px-4 py-2.5 border-r border-slate-100 text-xs font-black text-slate-500 italic bg-slate-50/50">{t.billType}</td>}
                                    {columns.find(c => c.id === 'mtrlCntr')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 font-bold text-slate-600">{t.mtrlCntr}</td>}
                                    {columns.find(c => c.id === 'totalQty')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right font-black text-slate-900">{t.totalQty.toFixed(2)}</td>}
                                    {columns.find(c => c.id === 'totalAmt')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right font-black text-blue-900">{formatCurrency(t.totalAmt)}</td>}
                                    {columns.find(c => c.id === 'taxableAmt')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right font-bold text-slate-700">{formatCurrency(t.taxableAmt)}</td>}
                                    {columns.find(c => c.id === 'taxPercent')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right font-black text-slate-400">{t.taxPercent.toFixed(2)}</td>}
                                    {columns.find(c => c.id === 'cgstPercent')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right text-slate-500 font-medium">{t.cgstPercent.toFixed(2)}</td>}
                                    {columns.find(c => c.id === 'cgstAmt')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right font-bold text-slate-800 border-l border-slate-100/50">{formatCurrency(t.cgstAmt)}</td>}
                                    {columns.find(c => c.id === 'sgstPercent')?.visible && <td className="px-3 py-2.5 border-r border-slate-100 text-right text-slate-500 font-medium">{t.sgstPercent.toFixed(2)}</td>}
                                    {columns.find(c => c.id === 'sgstAmt')?.visible && <td className="px-3 py-2.5 text-right font-bold text-slate-800">{formatCurrency(t.sgstAmt)}</td>}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Buttons */}
            <div className="bg-white p-3 border-t border-slate-200 flex gap-2 print:hidden shrink-0 shadow-inner">
                <button className="px-6 py-2 bg-green-600 text-white text-xs font-black rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow shadow-green-100 uppercase tracking-widest">
                    <CheckSquare className="w-4 h-4" />
                    Verify List
                </button>
                <button className="px-6 py-2 bg-[#4CAF50] text-white text-xs font-black rounded-lg hover:bg-green-600 transition flex items-center gap-2 shadow shadow-green-100 uppercase tracking-widest">
                    <Edit3 className="w-4 h-4" />
                    Update voucher
                </button>
            </div>

            <style jsx global>{`
                @media print {
                    @page { size: landscape; margin: 8mm; }
                    body { font-size: 6.5pt; background: white; }
                    .print\\:hidden { display: none !important; }
                    table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; }
                    th, td { border: 0.5px solid #333 !important; padding: 2px !important; }
                    th { background-color: #f2f2f2 !important; font-weight: bold !important; }
                }
            `}</style>
        </div>
    );
}
