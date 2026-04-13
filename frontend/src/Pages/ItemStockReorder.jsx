import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    ShoppingCart,
    Filter,
    PackageSearch,
    AlertTriangle,
    Eye,
    EyeOff,
} from 'lucide-react';
import { getReorderReport } from '../controllers/inventory.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllItems } from '../controllers/itemcontroller';
import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function ItemStockReorder() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [groups, setGroups] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [vendors, setVendors] = useState([]);

    const [filters, setFilters] = useState({
        groupName: '',
        itemName: '',
        barcode: '',
        vendorName: '',
        searchType: 'All',
        setValue: ''
    });

    const [columnVisibility, setColumnVisibility] = useState({
        sno: true,
        productName: true,
        groupName: true,
        unit: true,
        criticalLevel: true,
        stock: true,
        maxQty: true,
        minQty: true,
        reqMaxQty: true,
        reqMinQty: true,
        minReorder: true,
        sph: true,
        cyl: true,
        eye: true,
        axis: true,
        add: true,
        lensPower: true,
        reorder: true,
    });

    const [showColumnFilter, setShowColumnFilter] = useState(false);

    useEffect(() => {
        handleSearch();
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const [groupRes, itemRes, accountRes] = await Promise.all([
                getAllGroups(),
                getAllItems(),
                getAllAccounts()
            ]);

            setGroups(groupRes.groups || []);
            setItemsList(itemRes.items || []);
            // Filter accounts to show only vendors if type is available, 
            // otherwise show all accounts as potential vendors
            setVendors(accountRes || []);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getReorderReport(filters);
            if (res.success) {
                setReportData(res.data);
            }
        } catch (error) {
            toast.error('Failed to fetch reorder data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            groupName: '',
            itemName: '',
            barcode: '',
            vendorName: '',
            searchType: 'All',
            setValue: ''
        });
        handleSearch();
    };

    const toggleColumnVisibility = (column) => {
        if (column === 'lensPower') {
            const nextVal = !columnVisibility.eye;
            setColumnVisibility(prev => ({
                ...prev,
                eye: nextVal,
                sph: nextVal,
                cyl: nextVal,
                axis: nextVal,
                add: nextVal,
                lensPower: nextVal
            }));
        } else {
            setColumnVisibility(prev => ({
                ...prev,
                [column]: !prev[column]
            }));
        }
    };

    const toggleAllColumns = (show) => {
        const newVisibility = {};
        Object.keys(columnVisibility).forEach(key => {
            newVisibility[key] = show;
        });
        setColumnVisibility(newVisibility);
    };

    const handleReorder = (item) => {
        const path = item.type === 'Lens'
            ? '/lenstransaction/purchase/AddLensPurchase'
            : '/rxtransaction/rxpurchase/addRxPurchase';

        // Store reorder item in localStorage to pass data to the new tab
        localStorage.setItem('reorderItem', JSON.stringify(item));
        window.open(path, '_blank');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }
        const dataToExport = reportData.map((item, idx) => ({
            SNo: idx + 1,
            'Product Name': item.productName,
            'Group Name': item.groupName,
            Unit: item.unit,
            'Critical Lvl': item.alertQty,
            'Current Stock': item.stock,
            'Min Stock': item.minStock || 0,
            'Max Stock': item.maxStock || 0,
            'Min Reorder': item.minReorderQty || 0
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Stock_Reorder_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col bg-slate-50 overflow-hidden">
            {/* Header Bar */}
            <div className="bg-[#3b82f6] text-white px-4 py-3 flex items-center justify-between shadow-lg shrink-0">
                <h1 className="text-lg font-bold flex items-center gap-2">
                    <PackageSearch className="w-5 h-5" />
                    Item Stock Reorder
                </h1>
                <div className="flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="p-2 hover:bg-white/10 rounded-full transition" title="Print">
                        <Printer className="w-5 h-5" />
                    </button>
                    <button onClick={handleExportExcel} className="p-2 hover:bg-white/10 rounded-full transition" title="Excel">
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm shrink-0 print-hide">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Item Group</label>
                        <input
                            type="text"
                            placeholder="Select Group"
                            value={filters.groupName}
                            onChange={(e) => handleFilterChange('groupName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            list="group-suggestions"
                            className="w-40 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="group-suggestions">
                            {groups.map((g, i) => (
                                <option key={i} value={g.groupName} />
                            ))}
                        </datalist>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Item Name</label>
                        <input
                            type="text"
                            placeholder="Select Item"
                            value={filters.itemName}
                            onChange={(e) => handleFilterChange('itemName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            list="item-suggestions"
                            className="w-56 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="item-suggestions">
                            {itemsList.map((item, i) => (
                                <option key={i} value={item.itemName} />
                            ))}
                        </datalist>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Barcode</label>
                        <input
                            type="text"
                            placeholder="Search Barcode"
                            value={filters.barcode}
                            onChange={(e) => handleFilterChange('barcode', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-32 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Search Type</label>
                        <select
                            value={filters.searchType}
                            onChange={(e) => handleFilterChange('searchType', e.target.value)}
                            className="w-32 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="All">None</option>
                            <option value="Min">Min Qty</option>
                            <option value="Max">Max Qty</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Set Value</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={filters.setValue}
                            onChange={(e) => handleFilterChange('setValue', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-20 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Name</label>
                        <input
                            type="text"
                            placeholder="Vendor Name"
                            value={filters.vendorName}
                            onChange={(e) => handleFilterChange('vendorName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            list="vendor-suggestions"
                            className="w-48 px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="vendor-suggestions">
                            {vendors.map((v, i) => (
                                <option key={i} value={v.Name} />
                            ))}
                        </datalist>
                    </div>

                    <div className="flex gap-2 print:hidden pb-px">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-4 py-1.5 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 transition flex items-center gap-1 shadow-md"
                        >
                            <Search className="w-4 h-4" />
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded text-sm font-bold hover:bg-slate-300 transition flex items-center gap-1 border border-slate-300 shadow-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto p-4 bg-white report-table-area">
                {/* Column Visibility Filter */}
                <div className="mb-4 relative print-hide">
                    <button
                        onClick={() => setShowColumnFilter(!showColumnFilter)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 rounded text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                    >
                        <Filter className="w-4 h-4" />
                        Column Visibility
                    </button>

                    {showColumnFilter && (
                        <div className="absolute top-12 left-0 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-4 z-10 grid grid-cols-2 gap-3 w-80">
                            <div className="col-span-2 flex gap-2 pb-2 border-b border-slate-200">
                                <button
                                    onClick={() => toggleAllColumns(true)}
                                    className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 font-bold"
                                >
                                    Show All
                                </button>
                                <button
                                    onClick={() => toggleAllColumns(false)}
                                    className="flex-1 px-2 py-1 text-xs bg-slate-400 text-white rounded hover:bg-slate-500 font-bold"
                                >
                                    Hide All
                                </button>
                            </div>

                            {[
                                { key: 'sno', label: 'S.No' },
                                { key: 'productName', label: 'Product Name' },
                                { key: 'groupName', label: 'Group Name' },
                                { key: 'unit', label: 'Unit' },
                                { key: 'criticalLevel', label: 'Critical Lvl' },
                                { key: 'stock', label: 'Current Stock' },
                                { key: 'maxQty', label: 'Max Qty' },
                                { key: 'minQty', label: 'Min Qty' },
                                { key: 'reqMaxQty', label: 'Req Max Qty' },
                                { key: 'reqMinQty', label: 'Req Min Qty' },
                                { key: 'minReorder', label: 'Min Reorder' },
                                { key: 'lensPower', label: 'Lens Power' },
                                { key: 'reorder', label: 'Reorder Action' },
                            ].map(col => (
                                <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded text-xs">
                                    <input
                                        type="checkbox"
                                        checked={columnVisibility[col.key]}
                                        onChange={() => toggleColumnVisibility(col.key)}
                                        className="w-4 h-4 rounded"
                                    />
                                    <span className="font-medium">{col.label}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-max">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-700 text-[11px] uppercase font-extrabold text-center border-b border-slate-200 sticky top-0 z-10">
                                {columnVisibility.sno && <th className="px-2 py-3 border-r w-12">SNo</th>}
                                {columnVisibility.productName && <th className="px-4 py-3 border-r text-left">Product Name</th>}
                                {columnVisibility.groupName && <th className="px-4 py-3 border-r text-left">Group Name</th>}
                                {columnVisibility.unit && <th className="px-3 py-3 border-r w-24">Unit</th>}
                                {columnVisibility.criticalLevel && <th className="px-3 py-3 border-r w-24 bg-red-50 text-red-700">Critical Lvl</th>}
                                {columnVisibility.stock && <th className="px-3 py-3 border-r w-20">Stock</th>}
                                {columnVisibility.maxQty && <th className="px-3 py-3 border-r w-20">Max Qty</th>}
                                {columnVisibility.minQty && <th className="px-3 py-3 border-r w-20">Min Qty</th>}
                                {columnVisibility.reqMaxQty && <th className="px-3 py-3 border-r w-24">Req Max Qty</th>}
                                {columnVisibility.reqMinQty && <th className="px-3 py-3 border-r w-24">Req Min Qty</th>}
                                {columnVisibility.minReorder && <th className="px-3 py-3 border-r w-24">Min. Reorder</th>}
                                {columnVisibility.sph && <th className="px-3 py-3 border-r w-20">SPH</th>}
                                {columnVisibility.cyl && <th className="px-3 py-3 border-r w-20">CYL</th>}
                                {columnVisibility.eye && <th className="px-3 py-3 border-r w-20">EYE</th>}
                                {columnVisibility.axis && <th className="px-3 py-3 border-r w-20">AXIS</th>}
                                {columnVisibility.add && <th className="px-3 py-3 border-r w-20">ADD</th>}
                                {columnVisibility.reorder && <th className="px-4 py-3 w-28 print-hide">Reorder</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="17" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <PackageSearch className="w-12 h-12 opacity-20" />
                                            <p className="text-base italic">No items found below alert level</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors text-[11px] font-medium text-center">
                                        {columnVisibility.sno && <td className="px-2 py-2 text-slate-500 border-r">{idx + 1}</td>}
                                        {columnVisibility.productName && <td className="px-4 py-2 text-left font-bold border-r text-slate-800">{item.productName}</td>}
                                        {columnVisibility.groupName && <td className="px-4 py-2 text-left text-slate-600 border-r font-semibold uppercase">{item.groupName}</td>}
                                        {columnVisibility.unit && <td className="px-3 py-2 border-r text-slate-500">{item.unit}</td>}
                                        {columnVisibility.criticalLevel && <td className="px-3 py-2 border-r bg-red-50/30 text-red-600 font-bold italic">{item.alertQty}</td>}
                                        {columnVisibility.stock && <td className="px-3 py-2 border-r text-blue-600 font-bold">{item.stock}</td>}
                                        {columnVisibility.maxQty && <td className="px-3 py-2 border-r text-slate-500">{item.maxStock || 0}</td>}
                                        {columnVisibility.minQty && <td className="px-3 py-2 border-r text-slate-500">{item.minStock || 0}</td>}
                                        {columnVisibility.reqMaxQty && <td className="px-3 py-2 border-r text-slate-500">{Math.max(0, (item.maxStock || 0) - item.stock)}</td>}
                                        {columnVisibility.reqMinQty && <td className="px-3 py-2 border-r text-slate-500">{Math.max(0, (item.minStock || 0) - item.stock)}</td>}
                                        {columnVisibility.minReorder && <td className="px-3 py-2 border-r text-slate-500">{item.minReorderQty || 0}</td>}
                                        {columnVisibility.sph && <td className="px-3 py-2 border-r text-slate-600 font-semibold">{item.lensInfo?.sph || '-'}</td>}
                                        {columnVisibility.cyl && <td className="px-3 py-2 border-r text-slate-600 font-semibold">{item.lensInfo?.cyl || '-'}</td>}
                                        {columnVisibility.eye && <td className="px-3 py-2 border-r text-slate-600 font-semibold">{item.lensInfo?.eye || '-'}</td>}
                                        {columnVisibility.axis && <td className="px-3 py-2 border-r text-slate-600 font-semibold">{item.lensInfo?.axis || '-'}</td>}
                                        {columnVisibility.add && <td className="px-3 py-2 border-r text-slate-600 font-semibold">{item.lensInfo?.add || '-'}</td>}
                                        {columnVisibility.reorder && (
                                            <td className="px-4 py-2 print-hide">
                                                <button
                                                    onClick={() => handleReorder(item)}
                                                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-700 hover:text-white transition-all flex items-center justify-center gap-1 font-bold group border border-blue-200"
                                                >
                                                    <ShoppingCart className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                                    Order
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-[11px] border-t-2 border-slate-200">
                            <tr>
                                <td colSpan="5" className="px-4 py-2 text-right uppercase">Total:</td>
                                <td className="px-3 py-2 text-center text-blue-600">{reportData.reduce((s, i) => s + i.stock, 0)}</td>
                                <td className="px-3 py-2 text-center">{reportData.reduce((s, i) => s + (i.maxStock || 0), 0)}</td>
                                <td className="px-3 py-2 text-center">{reportData.reduce((s, i) => s + (i.minStock || 0), 0)}</td>
                                <td className="px-3 py-2 text-center">{reportData.reduce((s, i) => s + Math.max(0, (i.maxStock || 0) - i.stock), 0)}</td>
                                <td className="px-3 py-2 text-center">{reportData.reduce((s, i) => s + Math.max(0, (i.minStock || 0) - i.stock), 0)}</td>
                                <td colSpan="1" className="print-hide"></td>
                                {/* Specific cell for print to keep alignment if needed, or just skip */}
                                <td className="hidden print:table-cell"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            </div>

            {/* Footer Alert */}
            <div className="bg-orange-50 border-t border-orange-200 px-6 py-2 flex items-center gap-2 text-xs font-bold text-orange-700 shrink-0 print-hide">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
                Showing items that have reached critical stock levels (Stock ≤ Alert Quantity).
                <div className="ml-auto flex items-center gap-4 text-slate-400">
                    <span className="uppercase tracking-widest text-[10px]">Total items found: <span className="text-orange-900 ml-1">{reportData.length}</span></span>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: landscape; 
                        margin: 10mm; 
                    }
                    
                    /* Hide non-essential UI */
                    .print\\:hidden, .print-hide, button, input, select, .Navbar, .Sidebar, nav, aside { 
                        display: none !important; 
                        height: 0 !important;
                        overflow: hidden !important;
                    }

                    body { 
                        background: white !important; 
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .h-\\[calc\\(100vh-2rem\\)\\] { 
                        height: auto !important; 
                        overflow: visible !important; 
                        display: block !important;
                        min-height: auto !important;
                    }

                    /* Format Print Header */
                    .bg-\\[\\#3b82f6\\] { 
                        background: none !important; 
                        color: black !important; 
                        padding: 5mm 0 !important; 
                        border-bottom: 2px solid #000 !important;
                        margin-bottom: 5mm !important;
                        display: block !important;
                        text-align: center !important;
                    }

                    h1 { 
                        color: black !important; 
                        font-size: 20pt !important; 
                        text-align: center !important;
                        width: 100% !important;
                        display: block !important;
                    }

                    /* Table Formatting */
                    .report-table-area {
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }

                    .min-w-max {
                        min-width: 100% !important;
                        display: block !important;
                    }

                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        font-size: 8pt !important; 
                        table-layout: fixed !important;
                    }

                    th, td { 
                        border: 1px solid #000 !important; 
                        padding: 4px 2px !important; 
                        background: none !important;
                        color: black !important;
                        word-wrap: break-word !important;
                    }

                    th {
                        background-color: #f0f0f0 !important;
                        -webkit-print-color-adjust: exact;
                        font-weight: bold !important;
                    }

                    /* Remove shadows and rounded corners */
                    .shrink-0, .shadow-lg, .shadow-md, .shadow-sm, .rounded-lg, .border { 
                        box-shadow: none !important; 
                        border-radius: 0 !important;
                        border-color: #000 !important;
                    }
                }
            `}} />
        </div>
    );
}
