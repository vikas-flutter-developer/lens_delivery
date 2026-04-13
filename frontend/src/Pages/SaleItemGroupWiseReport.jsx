import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Filter,
    ChevronDown,
    X,
    Check,
} from 'lucide-react';
import { getSaleItemGroupWiseReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { roundAmount } from '../utils/amountUtils';

export default function SaleItemGroupWiseReport() {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [groups, setGroups] = useState([]);
    const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
    const groupDropdownRef = useRef(null);

    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        selectedGroups: []
    });

    const [groupSearch, setGroupSearch] = useState('');

    const [columns, setColumns] = useState([
        { id: 'sn', label: 'SN', width: '30px', visible: true },
        { id: 'billNo', label: 'Bill No', width: '100px', visible: true },
        { id: 'date', label: 'Date', width: '75px', visible: true },
        { id: 'party', label: 'Party', width: '140px', visible: true, align: 'left' },
        { id: 'group', label: 'Group', width: '90px', visible: true, align: 'left' },
        { id: 'product', label: 'Product', width: '160px', visible: true, align: 'left' },
        { id: 'qty', label: 'Qty', width: '40px', visible: true },
        { id: 'price', label: 'Price', width: '70px', visible: true },
        { id: 'disPct', label: 'Dis%', width: '60px', visible: true },
        { id: 'disRs', label: 'Dis Rs', width: '65px', visible: true },
        { id: 'oDisPct', label: 'O.Dis%', width: '60px', visible: false },
        { id: 'oDisRs', label: 'O.Dis Rs', width: '65px', visible: false },
        { id: 'value', label: 'Value', width: '85px', visible: true, bold: true, color: 'text-blue-700' },
        { id: 'taxable', label: 'Taxable', width: '85px', visible: true },
        { id: 'total', label: 'Total', width: '95px', visible: true, bold: true, color: 'text-blue-800', bg: 'bg-blue-50' },
        { id: 'cash', label: 'Cash', width: '75px', visible: true, color: 'text-green-600' },
        { id: 'bank', label: 'Bank', width: '75px', visible: true, color: 'text-purple-600' },
    ]);

    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
    const columnDropdownRef = useRef(null);
    const [printOrientation, setPrintOrientation] = useState('landscape');

    useEffect(() => {
        fetchGroups();
        handleSearch();

        const handleClickOutside = (event) => {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target)) {
                setIsGroupDropdownOpen(false);
            }
            if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target)) {
                setIsColumnDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await getAllGroups();
            setGroups(res.groups || []);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            console.log("FE: Requesting report with filters:", filters);
            const res = await getSaleItemGroupWiseReport(filters);
            console.log("FE: Report response received:", res);
            if (res.success) {
                setReportData(res.data);
            }
        } catch (error) {
            console.error('FE: Failed to fetch report data:', error);
            toast.error('Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            selectedGroups: []
        });
        setTimeout(handleSearch, 100);
    };

    const handleGroupToggle = (groupName) => {
        setFilters(prev => {
            const isSelected = prev.selectedGroups.includes(groupName);
            const newGroups = isSelected
                ? prev.selectedGroups.filter(g => g !== groupName)
                : [...prev.selectedGroups, groupName];
            return { ...prev, selectedGroups: newGroups };
        });
    };

    const handleSelectAllGroups = () => {
        if (filters.selectedGroups.length === groups.length) {
            setFilters(prev => ({ ...prev, selectedGroups: [] }));
        } else {
            setFilters(prev => ({ ...prev, selectedGroups: groups.map(g => g.groupName) }));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const toggleColumn = (id) => {
        setColumns(prev => prev.map(col =>
            col.id === id ? { ...col, visible: !col.visible } : col
        ));
    };

    const visibleColsCount = columns.filter(c => c.visible).length;

    const getFontSize = () => {
        if (visibleColsCount > 15) return 'text-[10px]';
        if (visibleColsCount > 12) return 'text-[11px]';
        return 'text-xs';
    };

    const getCellPadding = () => {
        if (visibleColsCount > 15) return 'px-1 py-1.5';
        return 'px-2 py-2';
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }
        const dataToExport = reportData.map((item, idx) => ({
            SN: idx + 1,
            'Sale Bill': item.billNo,
            Date: new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
            Party: item.party,
            'Product Group': item.productGroup,
            'Product Name': item.productName,
            Qty: item.qty,
            'Prod. Price': roundAmount(item.prodPrice),
            'Prod. Dis %': roundAmount(item.prodDisPct),
            'Prod. Dis Rs': roundAmount(item.prodDisRs),
            'Other Dis %': roundAmount(item.otherDisPct),
            'Other Dis Rs': roundAmount(item.otherDisRs),
            'Prod. Value': roundAmount(item.prodValue),
            'Prod. Txble Amt': roundAmount(item.prodTxbleAmt),
            'Invoice Total Amt': roundAmount(item.invoiceTotalAmt),
            Cash: roundAmount(item.cash),
            Bank: roundAmount(item.bank)
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Sale_Item_Group_Wise_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredGroupList = groups.filter(g =>
        g.groupName.toLowerCase().includes(groupSearch.toLowerCase())
    );

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800">
            {/* Header */}
            <div className="bg-[#3b82f6] text-white px-6 py-3 flex items-center justify-between shadow-md shrink-0">
                <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2 uppercase">
                    <Filter className="w-5 h-5" />
                    Product Group Wise Sale Report
                </h1>
                <div className="flex gap-3 print:hidden">
                    {/* Print Orientation Toggle */}
                    <div className="flex bg-white/10 p-1 rounded-lg border border-white/20">
                        <button
                            onClick={() => setPrintOrientation('portrait')}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${printOrientation === 'portrait' ? 'bg-white text-blue-600 shadow-sm' : 'text-white/70 hover:text-white'}`}
                        >
                            Portrait
                        </button>
                        <button
                            onClick={() => setPrintOrientation('landscape')}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${printOrientation === 'landscape' ? 'bg-white text-blue-600 shadow-sm' : 'text-white/70 hover:text-white'}`}
                        >
                            Landscape
                        </button>
                    </div>

                    <button onClick={() => window.print()} className="p-2 hover:bg-white/20 rounded-lg transition-all active:scale-95" title="Print">
                        <Printer className="w-5 h-5" />
                    </button>
                    <button onClick={handleExportExcel} className="p-2 hover:bg-white/20 rounded-lg transition-all active:scale-95" title="Export Excel">
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm shrink-0 print-hide z-20">
                <div className="flex flex-wrap items-end gap-6 justify-center">
                    <div className="space-y-1.5 min-w-[140px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    <div className="space-y-1.5 min-w-[140px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>

                    {/* Multi-select Group Checkbox Dropdown */}
                    <div className="space-y-1.5 relative" ref={groupDropdownRef}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Select Groups</label>
                        <button
                            onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                            className="w-56 px-4 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold flex items-center justify-between shadow-sm hover:border-blue-400 transition-colors"
                        >
                            <span className="truncate">
                                {filters.selectedGroups.length === 0
                                    ? "All Groups"
                                    : filters.selectedGroups.length === 1
                                        ? filters.selectedGroups[0]
                                        : `${filters.selectedGroups.length} Groups Selected`}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isGroupDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isGroupDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 overflow-hidden transform animate-in fade-in zoom-in duration-200">
                                <div className="p-3 border-b border-slate-100 flex flex-col gap-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search groups..."
                                            value={groupSearch}
                                            onChange={(e) => setGroupSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded text-xs focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSelectAllGroups}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase tracking-tighter"
                                    >
                                        {filters.selectedGroups.length === groups.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                                    {filteredGroupList.map((g, i) => {
                                        const isSelected = filters.selectedGroups.includes(g.groupName);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => handleGroupToggle(g.groupName)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                </div>
                                                <span className="text-xs font-semibold">{g.groupName}</span>
                                            </div>
                                        );
                                    })}
                                    {filteredGroupList.length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400 italic">No groups found</div>
                                    )}
                                </div>
                                {filters.selectedGroups.length > 0 && (
                                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-bold flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                        {filters.selectedGroups.map(name => (
                                            <span key={name} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded flex items-center gap-1">
                                                {name}
                                                <X className="w-2 h-2 cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleGroupToggle(name); }} />
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Column Visibility Toggle */}
                    <div className="space-y-1.5 relative" ref={columnDropdownRef}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Table Columns</label>
                        <button
                            onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                            className="w-48 px-4 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold flex items-center justify-between shadow-sm hover:border-blue-400 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Filter className="w-3 h-3 text-blue-500" />
                                {visibleColsCount} Columns
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isColumnDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isColumnDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-2 border-b border-slate-50 bg-slate-50 uppercase text-[9px] font-black tracking-widest text-slate-400">Visibility Control</div>
                                <div className="max-h-80 overflow-y-auto p-1 custom-scrollbar">
                                    {columns.map((col) => (
                                        <div
                                            key={col.id}
                                            onClick={() => toggleColumn(col.id)}
                                            className={`flex items-center gap-3 px-3 py-1.5 rounded cursor-pointer transition-colors ${col.visible ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-500'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${col.visible ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                {col.visible && <Check className="w-2.5 h-2.5 text-white" strokeWidth={5} />}
                                            </div>
                                            <span className="text-[11px] font-bold whitespace-nowrap">{col.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 print:hidden pb-[2px]">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-6 py-2 bg-[#10b981] text-white rounded-md text-xs font-bold hover:bg-[#059669] transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            <Search className="w-3.5 h-3.5" />
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-md text-xs font-bold hover:bg-slate-300 transition-all flex items-center gap-2 border border-slate-300 shadow-sm active:scale-95"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-2 bg-white printable">
                <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-full">
                    <table className="w-full border-collapse table-fixed select-none">
                        <thead>
                            <tr className={`bg-slate-100 text-slate-700 uppercase font-black text-center border-b border-slate-200 sticky top-0 z-10 ${getFontSize()}`}>
                                {columns.filter(c => c.visible).map(col => (
                                    <th key={col.id} style={{ width: col.width }} className={`${getCellPadding()} border-r ${col.align === 'left' ? 'text-left px-2' : ''}`}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className={`divide-y divide-slate-100 font-medium ${getFontSize()}`}>
                            {loading ? (
                                <tr>
                                    <td colSpan={visibleColsCount} className="px-6 py-20 text-center text-xs">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                            <p className="font-bold text-slate-400">Loading data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColsCount} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-300">
                                            <Search className="w-10 h-10 opacity-20" />
                                            <p className="text-sm font-bold italic text-slate-400">No records found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((item, idx) => (
                                    <tr key={idx} className={`hover:bg-blue-50/40 transition-colors text-center even:bg-slate-50/30 h-8`}>
                                        {columns.map(col => {
                                            if (!col.visible) return null;

                                            let content = "";
                                            switch (col.id) {
                                                case 'sn': content = idx + 1; break;
                                                case 'billNo': content = item.billNo; break;
                                                case 'date': content = new Date(item.date).toLocaleDateString('en-GB'); break;
                                                case 'party': content = item.party; break;
                                                case 'group': content = item.productGroup; break;
                                                case 'product': content = item.productName; break;
                                                case 'qty': content = item.qty; break;
                                                case 'price': content = roundAmount(item.prodPrice); break;
                                                case 'disPct': content = `${roundAmount(item.prodDisPct)}%`; break;
                                                case 'disRs': content = roundAmount(item.prodDisRs); break;
                                                case 'oDisPct': content = `${roundAmount(item.otherDisPct)}%`; break;
                                                case 'oDisRs': content = roundAmount(item.otherDisRs); break;
                                                case 'value': content = roundAmount(item.prodValue); break;
                                                case 'taxable': content = roundAmount(item.prodTxbleAmt); break;
                                                case 'total': content = roundAmount(item.invoiceTotalAmt); break;
                                                case 'cash': content = roundAmount(item.cash); break;
                                                case 'bank': content = roundAmount(item.bank); break;
                                                default: content = "";
                                            }

                                            return (
                                                <td
                                                    key={col.id}
                                                    className={`${getCellPadding()} border-r truncate ${col.align === 'left' ? 'text-left px-2 uppercase' : ''} ${col.bold ? 'font-black' : col.id === 'date' ? 'whitespace-nowrap' : col.id === 'sn' ? 'text-slate-400' : ''} ${col.color || ''} ${col.bg || ''}`}
                                                    title={typeof content === 'string' ? content : ''}
                                                >
                                                    {content}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className={`bg-slate-100 font-black border-t-2 border-slate-200 sticky bottom-0 z-10 ${getFontSize()}`}>
                            <tr className="text-center bg-blue-50/50 h-9">
                                {columns.map(col => {
                                    if (!col.visible) return null;

                                    if (col.id === 'sn') return <td key={col.id} className="border-r border-slate-200"></td>;
                                    if (col.id === 'product') return <td key={col.id} className="px-4 py-2 text-right text-slate-600 tracking-widest uppercase border-r border-slate-200">Totals:</td>;

                                    // Skip common empty cells in footer
                                    if (['billNo', 'date', 'party', 'group', 'price', 'disPct', 'disRs', 'oDisPct', 'oDisRs'].includes(col.id)) {
                                        return <td key={col.id} className="border-r border-slate-200"></td>;
                                    }

                                    // Render Sums
                                    let sumValue = 0;
                                    const sumKeys = ['qty', 'value', 'taxable', 'total', 'cash', 'bank'];
                                    if (sumKeys.includes(col.id)) {
                                        const apiKey = col.id === 'value' ? 'prodValue' : col.id === 'taxable' ? 'prodTxbleAmt' : col.id === 'total' ? 'invoiceTotalAmt' : col.id;
                                        sumValue = reportData.reduce((s, i) => s + (i[apiKey] || 0), 0);
                                    }

                                    return (
                                        <td key={col.id} className={`${getCellPadding()} border-r ${col.color || ''} border-slate-200`}>
                                            {sumValue !== 0 ? (col.id === 'qty' ? sumValue : roundAmount(sumValue)) : ''}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: ${printOrientation}; margin: 5mm; }
                    .print-hide, .Navbar, .Sidebar, nav, aside { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .h-\\[calc\\(100vh-2rem\\)\\] { height: auto !important; overflow: visible !important; display: block !important; }
                    .report-table-area { padding: 0 !important; margin: 0 !important; }
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        font-size: ${visibleColsCount > 12 ? '8pt' : '10pt'} !important; 
                        table-layout: auto !important;
                    }
                    th, td { 
                        border: 0.5pt solid #000 !important; 
                        padding: 2pt 1pt !important; 
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                    }
                    th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                    h1 { color: black !important; font-size: 14pt !important; text-align: left !important; margin-bottom: 2mm !important; text-transform: uppercase !important; }
                    .bg-\\[\\#3b82f6\\] { background: none !important; border-bottom: 1.5pt solid #000; padding: 0 !important; margin-bottom: 3mm !important; }
                    
                    /* Force display date range in print */
                    .bg-white.border-b.border-slate-200.p-4::after {
                        content: "Report Period: ${filters.dateFrom} to ${filters.dateTo}";
                        display: block;
                        font-size: 9pt;
                        font-weight: bold;
                        margin-bottom: 3mm;
                    }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}} />
        </div>
    );
}
