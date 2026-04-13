import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Eye,
    Package,
    ArrowUpCircle,
    ArrowDownCircle,
    Layout,
} from 'lucide-react';
import { getLensMovementReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllItems } from '../controllers/itemcontroller';
import { getAllAccounts } from '../controllers/Account.controller';
import { getAllLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function LensMovementReport() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState({
        purchaseData: [],
        saleData: [],
        openingStock: 0,
        closingStock: 0
    });
    const [groups, setGroups] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [accounts, setAccounts] = useState([]);

    const [filters, setFilters] = useState({
        searchType: 'All I/O Movement',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        groupName: '',
        productName: '',
        barcode: '',
        partyName: '',
        eye: '',
        sph: '',
        cyl: '',
        axis: '',
        add: ''
    });
    const [showColumnDropdown, setShowColumnDropdown] = useState(false);
    const [columns, setColumns] = useState({
        sno: true,
        date: true,
        transType: true,
        voucherNo: true,
        partyName: true,
        groupName: true,
        itemName: true,
        barcode: true,
        eye: true,
        sph: true,
        cyl: true,
        axis: true,
        add: true,
        lensPower: true,
        opening: true,
        inwards: true,
        outwards: true,
        closing: true,
        price: true,
        action: true
    });

    const activeCols = Object.keys(columns).reduce((acc, key) => {
        if (!columns[key]) return acc;
        if (key === 'inwards' || key === 'outwards') return acc + 2;
        return acc + 1;
    }, 0) + 1 + (!columns.inwards && !columns.outwards ? 1 : 0);

    useEffect(() => {
        handleSearch();
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const [groupRes, itemRes, accountRes, lensRes] = await Promise.all([
                getAllGroups(),
                getAllItems(),
                getAllAccounts(),
                getAllLensPower()
            ]);
            // Merge regular groups and lens groups
            const allGroups = [
                ...(groupRes.groups || []).map(g => g.groupName),
                ...(lensRes.data || []).map(l => l.groupName)
            ];
            setGroups([...new Set(allGroups)]);

            // Merge Item itemName and Lens productName
            const allItems = [
                ...(itemRes.items || []).map(i => i.itemName),
                ...(lensRes.data || []).map(l => l.productName)
            ];
            setItemsList([...new Set(allItems)]);

            setAccounts(accountRes || []);
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
            const res = await getLensMovementReport(filters);
            if (res.success) {
                setReportData(res.data);
            }
        } catch (error) {
            toast.error('Failed to fetch movement data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            searchType: 'All I/O Movement',
            dateFrom: new Date().toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            groupName: '',
            productName: '',
            barcode: '',
            partyName: '',
            eye: '',
            sph: '',
            cyl: '',
            axis: '',
            add: ''
        });
    };

    const toggleColumn = (column) => {
        if (column === 'lensPower') {
            const nextVal = !columns.eye;
            setColumns(prev => ({
                ...prev,
                eye: nextVal,
                sph: nextVal,
                cyl: nextVal,
                axis: nextVal,
                add: nextVal,
                lensPower: nextVal
            }));
        } else {
            setColumns(prev => ({ ...prev, [column]: !prev[column] }));
        }
    };

    // Process movements to include opening/closing balances
    const getProcessedData = () => {
        if (filters.searchType === 'Item Unmovement') {
            return { purchaseData: [], saleData: [], unmovedItems: reportData.unmovedItems || [] };
        }

        const allMovements = [
            ...reportData.purchaseData.map(item => ({ ...item, mType: 'inward' })),
            ...reportData.saleData.map(item => ({ ...item, mType: 'outward' }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        let balance = reportData.openingStock || 0;
        const processed = allMovements.map(item => {
            const opening = balance;
            const inwardQty = item.mType === 'inward' ? item.quantity : 0;
            const inwardValue = item.mType === 'inward' ? (item.quantity * (item.price || 0)) : 0;
            const outwardQty = item.mType === 'outward' ? item.quantity : 0;
            const outwardValue = item.mType === 'outward' ? (item.quantity * (item.price || 0)) : 0;
            balance += (inwardQty - outwardQty);
            return {
                ...item,
                opening,
                inwardQty,
                inwardValue,
                outwardQty,
                outwardValue,
                closing: balance
            };
        });

        return {
            purchaseData: processed.filter(m => m.mType === 'inward'),
            saleData: processed.filter(m => m.mType === 'outward')
        };
    };

    const { purchaseData, saleData, unmovedItems } = getProcessedData();

    const handleView = (item) => {
        let url = '';
        if (item.transType === 'Purchase Invoice') {
            url = `/lenstransaction/purchase/AddLensPurchase/${item.docId}`;
        } else if (item.transType === 'Sale Invoice') {
            url = `/lenstransaction/sale/AddLensSale/${item.docId}`;
        }

        if (url) {
            window.open(url, '_blank');
        }
    };

    const handleExportExcel = () => {
        const rows = [];

        // Add Summary Section
        rows.push(["ITEM MOVEMENT DETAILS REPORT"]);
        rows.push(["Date Range:", `${filters.dateFrom} to ${filters.dateTo}`]);
        rows.push(["Opening Stock:", reportData.openingStock]);
        rows.push(["Closing Stock:", reportData.closingStock]);
        rows.push([]); // Spacer

        // Add Purchase Section Header
        if (purchaseData.length > 0) {
            rows.push(["PURCHASE & INWARD MOVEMENTS"]);
            rows.push(["SNo", "Date", "Trans Type", "Voucher No", "Party Name", "Group Name", "Item Name", "Barcode", "Eye", "Sph", "Cyl", "Axis", "Add", "Opening Stk", "Inward Qty", "Inward Value", "Outward Qty", "Outward Value", "Closing", "Unit", "Price"]);

            purchaseData.forEach((item, idx) => {
                rows.push([
                    idx + 1,
                    new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                    item.transType,
                    item.voucherNo,
                    item.partyName,
                    item.groupName || item.group || '',
                    item.itemName,
                    item.barcode,
                    item.eye || '',
                    item.sph || '',
                    item.cyl || '',
                    item.axis || '',
                    item.add || '',
                    item.opening,
                    item.inwardQty,
                    item.inwardValue,
                    item.outwardQty,
                    item.outwardValue,
                    item.closing,
                    item.unit,
                    item.price
                ]);
            });
            rows.push([]); // Spacer
        }

        // Add Sale Section Header
        if (saleData.length > 0) {
            rows.push(["SALE & OUTWARD MOVEMENTS"]);
            rows.push(["SNo", "Date", "Trans Type", "Voucher No", "Party Name", "Group Name", "Item Name", "Barcode", "Eye", "Sph", "Cyl", "Axis", "Add", "Opening Stk", "Inward Qty", "Inward Value", "Outward Qty", "Outward Value", "Closing", "Unit", "Price"]);

            saleData.forEach((item, idx) => {
                rows.push([
                    idx + 1,
                    new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                    item.transType,
                    item.voucherNo,
                    item.partyName,
                    item.groupName || item.group || '',
                    item.itemName,
                    item.barcode,
                    item.eye || '',
                    item.sph || '',
                    item.cyl || '',
                    item.axis || '',
                    item.add || '',
                    item.opening,
                    item.inwardQty,
                    item.inwardValue,
                    item.outwardQty,
                    item.outwardValue,
                    item.closing,
                    item.unit,
                    item.price
                ]);
            });
            rows.push([]); // Spacer
        }

        // Add Unmoved Items Section
        if (unmovedItems && unmovedItems.length > 0) {
            rows.push(["UNMOVED ITEMS SUMMARY"]);
            rows.push(["SNo", "Group Name", "Item Name", "Barcode", "Eye", "Sph", "Cyl", "Axis", "Add", "Opening Stk", "Inward Qty", "Outward Qty", "Closing Stock", "Unit", "Price"]);

            unmovedItems.forEach((item, idx) => {
                rows.push([
                    idx + 1,
                    item.groupName || '',
                    item.productName || item.itemName,
                    item.barcode,
                    item.eye || '',
                    item.sph || '',
                    item.cyl || '',
                    item.axis || '',
                    item.add || '',
                    item.currentStock,
                    0, // Inward
                    0, // Outward
                    item.currentStock,
                    'PCS',
                    item.price || 0
                ]);
            });
        }

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Lens_Movement_Report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const TableHeader = () => (
        <>
            <tr className="bg-blue-50 text-blue-700 text-xs uppercase font-bold text-center">
                {columns.sno && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">SNo</th>}
                {columns.date && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Date</th>}
                {columns.transType && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Trans Type</th>}
                {columns.voucherNo && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">VoucherNo</th>}
                {columns.partyName && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Party Name</th>}
                {columns.groupName && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Group Name</th>}
                {columns.itemName && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Item Name</th>}
                {columns.barcode && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Code</th>}
                {columns.eye && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-blue-50 text-blue-600">Eye</th>}
                {columns.sph && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-blue-50 text-blue-600">Sph</th>}
                {columns.cyl && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-blue-50 text-blue-600">Cyl</th>}
                {columns.axis && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-blue-50 text-blue-600">Axis</th>}
                {columns.add && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-blue-50 text-blue-600">Add</th>}
                {columns.opening && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-orange-50 text-orange-700">Opening Stk</th>}
                {columns.inwards && <th colSpan="2" className="px-2 py-2 border whitespace-nowrap bg-green-50 text-green-700">Inwards</th>}
                {columns.outwards && <th colSpan="2" className="px-2 py-2 border whitespace-nowrap bg-red-50 text-red-700">Outwards</th>}
                {columns.closing && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap bg-blue-100 text-blue-800">Closing</th>}
                <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Unit</th>
                {!columns.inwards && !columns.outwards && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Quantity</th>}
                {columns.price && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Price</th>}
                {columns.action && <th rowSpan="2" className="px-2 py-2 border whitespace-nowrap">Action</th>}
            </tr>
            <tr className="bg-blue-50 text-blue-700 text-[10px] uppercase font-bold text-center">
                {columns.inwards && <th className="px-2 py-1 border bg-green-50/50">Qty</th>}
                {columns.inwards && <th className="px-2 py-1 border bg-green-50/50">Value</th>}
                {columns.outwards && <th className="px-2 py-1 border bg-red-50/50">Qty</th>}
                {columns.outwards && <th className="px-2 py-1 border bg-red-50/50">Value</th>}
            </tr>
        </>
    );

    const TableRow = ({ item, index }) => (
        <tr className="hover:bg-slate-50 transition-colors text-[11px] text-center border-b font-medium">
            {columns.sno && <td className="px-2 py-1 border">{index + 1}</td>}
            {columns.date && <td className="px-2 py-1 border">{item.date ? new Date(item.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : '—'}</td>}
            {columns.transType && <td className="px-2 py-1 border capitalize">{item.transType || '—'}</td>}
            {columns.voucherNo && <td className="px-2 py-1 border font-bold text-blue-700">{item.voucherNo || '—'}</td>}
            {columns.partyName && <td className="px-2 py-1 border text-left truncate max-w-[150px]" title={item.partyName}>{item.partyName || '—'}</td>}
            {columns.groupName && <td className="px-2 py-1 border text-left truncate max-w-[150px]" title={item.groupName}>{item.groupName || item.group || '—'}</td>}
            {columns.itemName && <td className="px-2 py-1 border text-left font-bold">{item.itemName}</td>}
            {columns.barcode && <td className="px-2 py-1 border font-mono">{item.barcode || item.barCode || item.barcodeNumber || '—'}</td>}
            {columns.eye && <td className="px-2 py-1 border bg-blue-50/30 font-semibold text-blue-700">{item.eye || '—'}</td>}
            {columns.sph && <td className="px-2 py-1 border bg-blue-50/30">{(item.sph !== undefined && item.sph !== null && item.sph !== '') ? item.sph : '—'}</td>}
            {columns.cyl && <td className="px-2 py-1 border bg-blue-50/30">{(item.cyl !== undefined && item.cyl !== null && item.cyl !== '') ? item.cyl : '—'}</td>}
            {columns.axis && <td className="px-2 py-1 border bg-blue-50/30">{(item.axis !== undefined && item.axis !== null && item.axis !== '') ? item.axis : '—'}</td>}
            {columns.add && <td className="px-2 py-1 border bg-blue-50/30">{(item.add !== undefined && item.add !== null && item.add !== '') ? item.add : '—'}</td>}

            {columns.opening && (
                <td className="px-2 py-1 border bg-orange-50/30 font-bold text-orange-700">
                    {(item.opening !== undefined && item.opening !== null) ? item.opening : '-'}
                </td>
            )}
            {columns.inwards && (
                <>
                    <td className="px-2 py-1 border bg-green-50/30 font-bold text-green-600 italic">
                        {item.inwardQty > 0 ? item.inwardQty : '-'}
                    </td>
                    <td className="px-2 py-1 border bg-green-50/30 font-bold text-green-600">
                        {item.inwardValue > 0 ? item.inwardValue.toFixed(2) : '-'}
                    </td>
                </>
            )}
            {columns.outwards && (
                <>
                    <td className="px-2 py-1 border bg-red-50/30 font-bold text-red-600 italic">
                        {item.outwardQty > 0 ? item.outwardQty : '-'}
                    </td>
                    <td className="px-2 py-1 border bg-red-50/30 font-bold text-red-600">
                        {item.outwardValue > 0 ? item.outwardValue.toFixed(2) : '-'}
                    </td>
                </>
            )}
            {columns.closing && (
                <td className="px-2 py-1 border bg-blue-50/30 font-bold text-blue-700">
                    {(item.closing !== undefined && item.closing !== null) ? item.closing : '-'}
                </td>
            )}

            <td className="px-2 py-1 border text-slate-500">{item.unit}</td>

            {!columns.inwards && !columns.outwards && (
                <td className={`px-2 py-1 border font-bold ${item.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {item.quantity}
                </td>
            )}

            {columns.price && <td className="px-2 py-1 border text-right font-bold">{(item.price || 0).toFixed(2)}</td>}

            {columns.action && (
                <td className="px-2 py-1 border">
                    <button
                        onClick={() => handleView(item)}
                        className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition shadow-sm"
                        title="View Transaction"
                    >
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                </td>
            )}
        </tr>
    );

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col bg-slate-50 overflow-hidden">
            {/* Header Bar */}
            <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md shrink-0">
                <h1 className="text-sm font-bold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Item Movement Details
                </h1>
                <div className="flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="p-1 hover:bg-blue-700 rounded transition border border-white/30">
                        <Printer className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white border-b border-slate-200 p-3 shrink-0">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Search Type</label>
                        <select
                            value={filters.searchType}
                            onChange={(e) => handleFilterChange('searchType', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-40 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="All I/O Movement">All I/O Movement</option>
                            <option value="Item Movement">Item Movement</option>
                            <option value="Item Unmovement">Item Unmovement</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex-1 min-w-[150px] space-y-1">
                        <input
                            type="text"
                            placeholder="Group Name"
                            value={filters.groupName}
                            onChange={(e) => handleFilterChange('groupName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            list="group-suggestions"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="group-suggestions">
                            {groups.map((name, i) => (
                                <option key={i} value={name} />
                            ))}
                        </datalist>
                    </div>

                    <div className="flex-1 min-w-[150px] space-y-1">
                        <input
                            type="text"
                            placeholder="Item Name"
                            value={filters.productName}
                            onChange={(e) => handleFilterChange('productName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            list="item-suggestions"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="item-suggestions">
                            {itemsList.map((name, i) => (
                                <option key={i} value={name} />
                            ))}
                        </datalist>
                    </div>

                    <div className="w-32 space-y-1">
                        <input
                            type="text"
                            placeholder="Barcode"
                            value={filters.barcode}
                            onChange={(e) => handleFilterChange('barcode', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex-1 min-w-[150px] space-y-1">
                        <input
                            type="text"
                            placeholder="Party Name"
                            value={filters.partyName}
                            onChange={(e) => handleFilterChange('partyName', e.target.value)}
                            onKeyDown={handleKeyDown}
                            list="party-suggestions"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="party-suggestions">
                            {accounts.map((acc, i) => (
                                <option key={i} value={acc.Name} />
                            ))}
                        </datalist>
                    </div>

                    <div className="w-full h-0"></div>

                    <div className="w-20 space-y-1">
                        <input
                            type="text"
                            placeholder="Eye"
                            value={filters.eye}
                            onChange={(e) => handleFilterChange('eye', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-20 space-y-1">
                        <input
                            type="text"
                            placeholder="Sph"
                            value={filters.sph}
                            onChange={(e) => handleFilterChange('sph', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-20 space-y-1">
                        <input
                            type="text"
                            placeholder="Cyl"
                            value={filters.cyl}
                            onChange={(e) => handleFilterChange('cyl', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-20 space-y-1">
                        <input
                            type="text"
                            placeholder="Axis"
                            value={filters.axis}
                            onChange={(e) => handleFilterChange('axis', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-20 space-y-1">
                        <input
                            type="text"
                            placeholder="Add"
                            value={filters.add}
                            onChange={(e) => handleFilterChange('add', e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-1 print:hidden">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold hover:bg-slate-300 transition flex items-center gap-1 border border-slate-400"
                        >
                            {loading ? '...' : <><Search className="w-3 h-3" /> Search</>}
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-3 py-1 bg-sky-400 text-white rounded text-xs font-bold hover:bg-sky-500 transition flex items-center gap-1 shadow-sm"
                        >
                            <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition flex items-center gap-1 shadow-sm font-bold"
                            title="Export to Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all"
                            >
                                <Layout className="w-4 h-4 text-slate-500" />
                                <span className="font-bold text-slate-700 uppercase text-[10px]">Columns</span>
                            </button>
                            {showColumnDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-2 border-b pb-1">Visible Columns</div>
                                    <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {Object.keys(columns).filter(key => !['eye', 'sph', 'cyl', 'axis', 'add'].includes(key)).map(key => (
                                            <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded cursor-pointer group transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={key === 'lensPower' ? columns.eye : columns[key]}
                                                    onChange={() => toggleColumn(key)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                />
                                                <span className="text-[11px] font-medium text-slate-700 capitalize group-hover:text-blue-700 transition-colors">
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex items-center gap-6 text-[11px] font-bold">
                    <div className="flex items-center gap-2">
                        <span className="text-orange-600">Opening stock :</span>
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200">
                            {reportData.openingStock}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-orange-600">Closing stock :</span>
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200">
                            {reportData.closingStock}
                        </span>
                    </div>
                    <span className="text-red-500 italic ml-auto font-normal">Note: Initial stock is not included</span>
                </div>
            </div>

            {/* Tables Area - Scrollable */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 bg-white">
                {/* Purchase Data Table */}
                <div className="border border-slate-200 rounded shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-xs font-bold text-slate-700">Purchase & Inward Movements</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <TableHeader />
                            </thead>
                            <tbody>
                                {purchaseData.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeCols} className="px-4 py-8 text-center text-slate-400 italic text-xs">No inward movements found</td>
                                    </tr>
                                ) : (
                                    purchaseData.map((item, idx) => (
                                        <TableRow key={`pur-${idx}`} item={item} index={idx} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sale Data Table */}
                <div className="border border-slate-200 rounded shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center gap-2">
                        <ArrowUpCircle className="w-4 h-4 text-red-600" />
                        <h2 className="text-xs font-bold text-slate-700">Sale & Outward Movements</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <TableHeader />
                            </thead>
                            <tbody>
                                {saleData.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeCols} className="px-4 py-8 text-center text-slate-400 italic text-xs">No outward movements found</td>
                                    </tr>
                                ) : (
                                    saleData.map((item, idx) => (
                                        <TableRow key={`sale-${idx}`} item={item} index={idx} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Unmoved Items Table */}
                {filters.searchType === 'Item Unmovement' && (
                    <div className="border border-slate-200 rounded shadow-sm overflow-hidden animate-in fade-in duration-500">
                        <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-600" />
                            <h2 className="text-xs font-bold text-slate-700">Unmoved Items Summary</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <TableHeader />
                                </thead>
                                <tbody>
                                    {(!unmovedItems || unmovedItems.length === 0) ? (
                                        <tr>
                                            <td colSpan={activeCols} className="px-4 py-8 text-center text-slate-400 italic text-xs">No unmoved items found for the selected criteria</td>
                                        </tr>
                                    ) : (
                                        unmovedItems.map((item, idx) => {
                                            const normalizedItem = {
                                                ...item,
                                                itemName: item.productName || item.itemName,
                                                groupName: item.groupName || item.group || '',
                                                opening: item.currentStock,
                                                closing: item.currentStock,
                                                inwardQty: 0,
                                                inwardValue: 0,
                                                outwardQty: 0,
                                                outwardValue: 0,
                                                transType: 'Unmoved',
                                                voucherNo: '—',
                                                partyName: '—',
                                                date: null,
                                                unit: item.unit || 'PCS'
                                            };
                                            return <TableRow key={`unm-${idx}`} item={normalizedItem} index={idx} />;
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Print Specific Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 1cm;
                    }
                    
                    /* Global Reset for Print */
                    html, body, #root, div[class*="h-screen"], div[class*="overflow-y-auto"] {
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }

                    /* Hide UI elements */
                    nav, aside, footer, .Navbar, .Sidebar, .print\\:hidden, 
                    .shrink-0, button, input, select, .datalist, [class*="max-w-64"] { 
                        display: none !important; 
                    }
                    
                    /* Show only report content */
                    .h-\\[calc\\(100vh-2rem\\)\\] {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        margin-top: 0 !important;
                    }
                    
                    /* Adjust containers */
                    .flex-1 { flex: none !important; width: 100% !important; }
                    .flex { display: block !important; }
                    .flex-col { flex-direction: column !important; }
                    .gap-3, .gap-6 { gap: 0 !important; }
                    
                    /* Format Tables */
                    .overflow-y-auto { 
                        overflow: visible !important; 
                        max-height: none !important; 
                    }
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        margin-bottom: 2rem !important;
                        font-size: 10px !important;
                    }
                    th, td { 
                        border: 1px solid #333 !important; 
                        padding: 4px !important;
                    }
                    .bg-blue-50 { background-color: #f8fafc !important; }
                    .text-blue-700 { color: #1e40af !important; }

                    /* Heading and Info */
                    h1 { 
                        display: block !important; 
                        color: black !important; 
                        font-size: 18px !important; 
                        text-align: center !important;
                        margin-bottom: 1rem !important;
                        padding-top: 0 !important;
                    }
                    .mt-2.flex { 
                        display: flex !important; 
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        margin-bottom: 1rem !important;
                        border-bottom: 2px solid #333 !important;
                        padding-bottom: 10px !important;
                    }
                }
            `}} />
        </div >
    );
}
