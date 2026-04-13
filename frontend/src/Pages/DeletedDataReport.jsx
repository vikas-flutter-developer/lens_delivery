import React, { useState, useEffect } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Trash2,
    RefreshCw,
    ShieldAlert,
    CheckCircle2,
} from 'lucide-react';
import { getDeletedLogs, restoreDeletedData, deleteLogPermanently } from '../controllers/deletedLog.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function DeletedDataReport() {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        type: 'Alls',
        search: ''
    });

    useEffect(() => {
        handleSearch();
    }, []);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getDeletedLogs(filters);
            if (res.success) {
                setReportData(res.data);
                setSelectedIds([]);
            }
        } catch (error) {
            toast.error('Failed to fetch deleted data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            type: 'Alls',
            search: ''
        });
        setReportData([]);
        setSelectedIds([]);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(reportData.map(item => item._id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectItem = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRestore = async () => {
        if (selectedIds.length === 0) {
            toast.error('Please select items to restore');
            return;
        }

        if (!window.confirm(`Are you sure you want to restore ${selectedIds.length} item(s)?`)) return;

        try {
            const res = await restoreDeletedData(selectedIds);
            if (res.success) {
                toast.success('Data restored successfully');
                handleSearch();
            }
        } catch (error) {
            toast.error('Failed to restore data');
        }
    };

    const handleDeletePermanent = async () => {
        if (selectedIds.length === 0) {
            toast.error('Please select items to delete permanently');
            return;
        }

        if (!window.confirm(`Are you sure you want to PERMANENTLY delete ${selectedIds.length} item(s)? This action cannot be undone.`)) return;

        try {
            const res = await deleteLogPermanently(selectedIds);
            if (res.success) {
                toast.success('Data deleted permanently');
                handleSearch();
            }
        } catch (error) {
            toast.error('Failed to delete data');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }
        const dataToExport = reportData.map((item, idx) => ({
            SNo: idx + 1,
            'Deleted Date': new Date(item.deletedDate).toLocaleString('en-IN'),
            Type: item.type,
            Name: item.name,
            'Group Name': item.groupName || 'N/A',
            'Deleted By': item.deletedBy || 'Admin'
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Deleted_Data_Report_${new Date().toISOString().split('T')[0]}.csv`);
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

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col bg-slate-50 overflow-hidden report-print-container">
            {/* Header Bar */}
            <div className="bg-[#4b6cb7] text-white px-4 py-3 flex items-center justify-between shadow-lg shrink-0">
                <h1 className="text-lg font-bold flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Deleted/Updated Data
                </h1>
                <div className="flex gap-3 print:hidden">
                    <button
                        onClick={handleRestore}
                        className="px-4 py-1.5 bg-orange-400 hover:bg-orange-500 rounded-lg transition flex items-center gap-2 font-bold shadow-md"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Restore
                    </button>
                    <button
                        onClick={handleDeletePermanent}
                        className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg transition flex items-center gap-2 font-bold shadow-md"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                    <div className="w-[1px] bg-white/30 mx-1"></div>
                    <button onClick={handlePrint} className="p-2 hover:bg-white/10 rounded-full transition" title="Print">
                        <Printer className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm shrink-0 print-hide">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-44 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-white"
                        >
                            <option value="Alls">Alls</option>
                            <option value="transaction">Transaction</option>
                            <option value="master">Master</option>
                            <option value="item">Item</option>
                            <option value="group">Group</option>
                        </select>
                    </div>

                    <div className="flex-1 min-w-[250px] space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, type, or group..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 print:hidden pb-[2px]">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition flex items-center gap-2 shadow-md active:scale-95"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-5 py-2 bg-sky-500 text-white rounded-lg text-sm font-bold hover:bg-sky-600 transition flex items-center gap-2 shadow-md active:scale-95"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center gap-2 shadow-md active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-4 bg-white report-table-area">
                <div className="border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-700 text-xs uppercase font-extrabold text-left border-b border-slate-200 sticky top-0 z-10">
                                <th className="px-4 py-3 border-r w-12 text-center">SNo</th>
                                <th className="px-4 py-3 border-r w-12 text-center print-hide-internal">
                                    <input
                                        type="checkbox"
                                        checked={reportData.length > 0 && selectedIds.length === reportData.length}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-6 py-3 border-r whitespace-nowrap">Deleted Date</th>
                                <th className="px-6 py-3 border-r whitespace-nowrap">Type</th>
                                <th className="px-6 py-3 border-r">Name</th>
                                <th className="px-6 py-3 border-r">Group Name</th>
                                <th className="px-6 py-3 whitespace-nowrap">Deleted By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Trash2 className="w-12 h-12 opacity-20" />
                                            <p className="text-base italic">No deleted records found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((item, idx) => (
                                    <tr
                                        key={item._id}
                                        className={`hover:bg-blue-50/50 transition-colors text-sm font-medium border-b border-slate-100 ${selectedIds.includes(item._id) ? 'bg-blue-50' : ''}`}
                                    >
                                        <td className="px-4 py-3 text-center text-slate-500 border-r">{idx + 1}</td>
                                        <td className="px-4 py-3 text-center border-r print-hide-internal">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item._id)}
                                                onChange={() => handleSelectItem(item._id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-3 border-r font-mono text-slate-600 whitespace-nowrap">
                                            {new Date(item.deletedDate).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-6 py-3 border-r whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.type === 'item' ? 'bg-purple-100 text-purple-700' :
                                                item.type === 'transaction' ? 'bg-blue-100 text-blue-700' :
                                                    item.type === 'group' ? 'bg-green-100 text-green-700' :
                                                        'bg-amber-100 text-amber-700'
                                                }`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 border-r font-bold text-slate-800">{item.name}</td>
                                        <td className="px-6 py-3 border-r text-slate-500">{item.groupName || '—'}</td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase">
                                                    {(item.deletedBy || 'A')[0]}
                                                </div>
                                                <span className="text-slate-600">{item.deletedBy || 'Admin'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 font-bold text-xs print-hide">
                <div className="flex gap-4">
                    <span className="text-slate-500 uppercase tracking-widest">Total Records: <span className="text-slate-900 ml-1">{reportData.length}</span></span>
                    <span className="text-blue-600 uppercase tracking-widest">Selected: <span className="ml-1">{selectedIds.length}</span></span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Secure Audit Trail Enabled
                </div>
            </div>

            {/* Print Specific Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: auto;
                        margin: 10mm; 
                    }
                    
                    /* Hide everything in the body by default */
                    body * {
                        visibility: hidden !important;
                    }

                    /* Specifically show the report container and everything inside it */
                    .report-print-container, 
                    .report-print-container * {
                        visibility: visible !important;
                    }

                    /* Ensure the container is positioned correctly at the top of the print page */
                    .report-print-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        visibility: visible !important;
                    }

                    /* Hide elements with print-hide class */
                    .print-hide, .print-hide-internal {
                        display: none !important;
                        visibility: hidden !important;
                    }

                    /* Format Table Area for Print */
                    .report-table-area {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        margin-top: 20px !important;
                        width: 100% !important;
                        padding: 0 !important;
                    }

                    .report-table-area > div {
                        border: none !important;
                        box-shadow: none !important;
                    }

                    /* Format Report Header */
                    .report-print-container h1 {
                        font-size: 26pt !important;
                        text-align: center !important;
                        margin: 10mm 0 20mm 0 !important;
                        border-bottom: 3px solid #000 !important;
                        padding-bottom: 5mm !important;
                        color: #000 !important;
                    }

                    /* Table Styling for Paper */
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 11pt !important;
                        color: #000 !important;
                    }

                    th, td {
                        border: 1px solid #000 !important;
                        padding: 10px 8px !important;
                        text-align: left !important;
                    }

                    th {
                        background-color: #f5f5f5 !important;
                        -webkit-print-color-adjust: exact;
                        font-weight: bold !important;
                        text-transform: uppercase !important;
                    }

                    /* Utility resets */
                    .shadow-lg, .shadow-md, .shadow-sm, .rounded-xl, .rounded-lg {
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }

                    .font-mono {
                        font-family: monospace !important;
                    }
                }
            `}} />
        </div>
    );
}
