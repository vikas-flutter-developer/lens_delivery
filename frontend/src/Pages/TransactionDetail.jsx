import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Eye,
    FileText,
    Calendar,
    Filter,
    Download,
    CheckSquare,
    Layout,
    ChevronDown,
} from 'lucide-react';
import { getTransactionDetailReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllItems } from '../controllers/itemcontroller';
import { getLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { roundAmount } from '../utils/amountUtils';

export default function TransactionDetail({ hideHeader = false }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);

    const [filters, setFilters] = useState({
        groupName: '',
        productName: '',
        transType: 'SALE',
        billSeries: 'All',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        searchText: ''
    });

    const [allGroups, setAllGroups] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [availablePG, setAvailablePG] = useState({ sph: [], cyl: [], add: [] });
    const [selectedPG, setSelectedPG] = useState({ sph: [], cyl: [], add: [] });
    const [pgDropdownOpen, setPgDropdownOpen] = useState({ sph: false, cyl: false, add: false });

    useEffect(() => {
        fetchInitialData();
        handleSearch();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [groupsRes, itemsRes] = await Promise.all([
                getAllGroups(),
                getAllItems()
            ]);
            setAllGroups(groupsRes.groups || groupsRes || []);
            setAllItems(itemsRes.items || itemsRes || []);
        } catch (error) {
            console.error('Error fetching initial filter data:', error);
        }
    };

    const fetchPowerGroups = async (productName) => {
        try {
            const result = await getLensPower({ productName });
            if (result && result.success !== false && result.data) {
                const data = result.data.data || result.data;
                if (data && data.powerGroups) {
                    setAvailablePG({
                        sph: data.powerGroups.sph || [],
                        cyl: data.powerGroups.cyl || [],
                        add: data.powerGroups.add || []
                    });
                } else {
                    setAvailablePG({ sph: [], cyl: [], add: [] });
                }
            } else {
                setAvailablePG({ sph: [], cyl: [], add: [] });
            }
        } catch (error) {
            console.error('Error fetching power groups:', error);
            setAvailablePG({ sph: [], cyl: [], add: [] });
        }
    };

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
        { id: 'vchNo', label: 'Vch No', visible: true },
        { id: 'partyName', label: 'Party Name', visible: true },
        { id: 'mobNo', label: 'Mob.No', visible: true },
        { id: 'group', label: 'Group', visible: true },
        { id: 'product', label: 'Product', visible: true },
        { id: 'modelNo', label: 'MODEL NO.', visible: true },
        { id: 'size', label: 'SIZE', visible: true },
        { id: 'color', label: 'COLOR', visible: true },
        { id: 'itemDetail', label: 'Item Detail', visible: true },
        { id: 'qty', label: 'Qty', visible: true },
        { id: 'price', label: 'Price', visible: true },
        { id: 'ttlPrc', label: 'Ttl Prc', visible: true },
        { id: 'disAmt', label: 'Dis Amt', visible: true },
        { id: 'ttlPrice', label: 'Ttl Price', visible: true },
        { id: 'gstWiseAmt', label: 'GstWise Amt', visible: true },
        { id: 'dueAmt', label: 'Due Amt', visible: true },
    ]);

    const filteredReportData = React.useMemo(() => {
        if (!reportData) return [];
        return reportData.filter(row => {
            if (selectedPG.sph.length > 0) {
                const val = parseFloat(row.sph);
                if (!selectedPG.sph.some(g => !isNaN(val) && val >= g.min && val <= g.max)) return false;
            }
            if (selectedPG.cyl.length > 0) {
                const val = parseFloat(row.cyl);
                if (!selectedPG.cyl.some(g => !isNaN(val) && val >= g.min && val <= g.max)) return false;
            }
            if (selectedPG.add.length > 0) {
                const val = parseFloat(row.add);
                if (!selectedPG.add.some(g => !isNaN(val) && val >= g.min && val <= g.max)) return false;
            }
            return true;
        });
    }, [reportData, selectedPG]);

    const totals = React.useMemo(() => {
        return filteredReportData.reduce((acc, curr) => {
            acc.qty += (parseFloat(curr.qty) || 0);
            acc.ttlPrc += (parseFloat(curr.ttlPrc) || 0);
            acc.disAmt += (parseFloat(curr.disAmt) || 0);
            acc.ttlPrice += (parseFloat(curr.ttlPrice) || 0);
            acc.gstWiseAmt += (parseFloat(curr.gstWiseAmt) || 0);
            acc.dueAmt += (parseFloat(curr.dueAmt) || 0);
            return acc;
        }, { qty: 0, ttlPrc: 0, disAmt: 0, ttlPrice: 0, gstWiseAmt: 0, dueAmt: 0 });
    }, [filteredReportData]);

    const [showColumnFilter, setShowColumnFilter] = useState(false);

    const toggleColumn = (id) => {
        setColumns(prev => prev.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
    };

    const handleFilterChange = (field, value) => {
        if (field === 'productName') {
            const selectedItem = allItems.find(it => it.itemName === value);
            const groupName = selectedItem?.groupName || filters.groupName;
            setFilters(prev => ({ ...prev, productName: value, groupName }));
            if (value) {
                fetchPowerGroups(value);
            } else {
                setAvailablePG({ sph: [], cyl: [], add: [] });
            }
            setSelectedPG({ sph: [], cyl: [], add: [] });
        } else if (field === 'groupName') {
            setFilters(prev => ({ ...prev, groupName: value, productName: '' }));
            setAvailablePG({ sph: [], cyl: [], add: [] });
            setSelectedPG({ sph: [], cyl: [], add: [] });
        } else {
            setFilters(prev => ({ ...prev, [field]: value }));
        }
    };

    const toggleGroupSelection = (type, group) => {
        setSelectedPG(prev => {
            const current = prev[type];
            const exists = current.find(g => g.min === group.min && g.max === group.max);
            let updated;
            if (exists) {
                updated = current.filter(g => g.min !== group.min || g.max !== group.max);
            } else {
                updated = [...current, group];
            }
            return { ...prev, [type]: updated };
        });
    };

    const toggleSelectAll = (type) => {
        const all = availablePG[type];
        const current = selectedPG[type];
        if (current.length === all.length && all.length > 0) {
            setSelectedPG(prev => ({ ...prev, [type]: [] }));
        } else {
            setSelectedPG(prev => ({ ...prev, [type]: [...all] }));
        }
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getTransactionDetailReport(filters);
            if (res.success) {
                setReportData(res.data || []);
            } else {
                toast.error(res.message || 'Failed to fetch transaction details');
            }
        } catch (error) {
            console.error('Error fetching transaction details:', error);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            groupName: '',
            productName: '',
            transType: 'SALE',
            billSeries: 'All',
            dateFrom: new Date().toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            searchText: ''
        });
        setReportData([]);
        setSelectedPG({ sph: [], cyl: [], add: [] });
        setAvailablePG({ sph: [], cyl: [], add: [] });
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            toast.error("No data to export");
            return;
        }

        const rows = reportData.map((t, idx) => ({
            'SNo': idx + 1,
            'Date': new Date(t.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
            'Vch No': t.vchNo,
            'Party Name': t.partyName,
            'Mob.No': t.mobNo,
            'Group': t.group,
            'Product': t.product,
            'Model No': t.modelNo,
            'Size': t.size,
            'Color': t.color,
            'Item Detail': t.itemDetail,
            'Qty': t.qty,
            'Price': roundAmount(t.price),
            'Ttl Prc': roundAmount(t.ttlPrc),
            'Dis Amt': roundAmount(t.disAmt),
            'Ttl Price': roundAmount(t.ttlPrice),
            'GstWise Amt': roundAmount(t.gstWiseAmt),
            'Due Amt': roundAmount(t.dueAmt)
        }));

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `TransactionDetail_${filters.dateFrom}_to_${filters.dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleView = (item) => {
        const { transType, docId } = item;
        let url = '';
        if (transType === 'SALE') url = `/lenstransaction/sale/AddLensSale/${docId}`;
        else if (transType === 'PURCHASE') url = `/lenstransaction/purchase/AddLensPurchase/${docId}`;

        if (url) {
            window.open(url, '_blank');
        } else {
            toast.info("View not implemented for this type");
        }
    };

    const formatCurrency = (num) => {
        const rounded = roundAmount(num);
        return new Intl.NumberFormat('en-IN').format(rounded);
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans">
            {/* Header */}
            {!hideHeader && (
                <div className="bg-[#4a86e8] text-white px-4 py-2 flex items-center justify-between shadow-sm shrink-0 print:hidden text-base font-bold">
                    <span>Invoice With Item Detail</span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white border-b border-slate-200 p-3 shrink-0 print:hidden shadow-sm">
                <div className="flex flex-wrap items-end gap-3 text-sm">
                    <div className="w-64">
                        <label className="block font-bold text-teal-700 mb-1 uppercase text-[10px] tracking-wider">Group Name</label>
                        <select
                            value={filters.groupName}
                            onChange={(e) => handleFilterChange('groupName', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white text-sm font-semibold"
                        >
                            <option value="">Select Group</option>
                            {allGroups.map(g => (
                                <option key={g._id || g.groupName} value={g.groupName}>{g.groupName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-64">
                        <label className="block font-bold text-teal-700 mb-1 uppercase text-[10px] tracking-wider">Item Name</label>
                        <select
                            value={filters.productName}
                            onChange={(e) => handleFilterChange('productName', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white text-sm font-semibold"
                        >
                            <option value="">Select Item</option>
                            {allItems
                                .filter(it => !filters.groupName || it.groupName === filters.groupName)
                                .map(it => (
                                    <option key={it._id || it.itemName} value={it.itemName}>{it.itemName}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="w-40">
                        <label className="block font-bold text-teal-700 mb-1">Trans Type</label>
                        <select
                            value={filters.transType}
                            onChange={(e) => handleFilterChange('transType', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white font-medium text-slate-700 text-sm"
                        >
                            <option value="SALE">SALE</option>
                            <option value="PURCHASE">PURCHASE</option>
                            <option value="All">ALL</option>
                        </select>
                    </div>

                    <div className="w-32">
                        <label className="block font-bold text-teal-700 mb-1">Bill Series</label>
                        <input
                            type="text"
                            value={filters.billSeries}
                            onChange={(e) => handleFilterChange('billSeries', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    <div className="w-40">
                        <label className="block font-bold text-teal-700 mb-1">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    <div className="w-40">
                        <label className="block font-bold text-teal-700 mb-1">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={filters.searchText}
                            onChange={(e) => handleFilterChange('searchText', e.target.value)}
                            placeholder="Search Any Text"
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowColumnFilter(!showColumnFilter)}
                            className="px-4 py-2 bg-white border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-50 transition flex items-center gap-2 text-sm shadow-sm"
                        >
                            <Layout className="w-4 h-4 text-blue-600" />
                            Columns ({columns.filter(c => c.visible).length})
                        </button>
                        {showColumnFilter && (
                            <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 p-3 max-h-[70vh] overflow-y-auto">
                                <h4 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest border-b pb-2">Visible Columns</h4>
                                <div className="space-y-1">
                                    {columns.map(col => (
                                        <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group">
                                            <input
                                                type="checkbox"
                                                checked={col.visible}
                                                onChange={() => toggleColumn(col.id)}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-1.5 ml-auto">
                        <button className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition shadow">
                            <CheckSquare className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition shadow shadow-blue-200"
                        >
                            Search
                        </button>
                        <button onClick={handleReset} className="p-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition shadow">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={handleExportExcel} className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition shadow">
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                        <button onClick={handlePrint} className="p-2 bg-slate-500 text-white rounded hover:bg-slate-600 transition shadow">
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* New: Power Group section */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['sph', 'cyl', 'add'].map((type) => {
                        const all = availablePG[type];
                        const selected = selectedPG[type];
                        const isOpen = pgDropdownOpen[type];
                        const label = type === 'add' ? 'ADD' : type.toUpperCase();

                        return (
                            <div key={type} className="relative">
                                <label className="block text-xs font-bold text-teal-700 uppercase mb-1.5 ml-1">Power Group ({label})</label>
                                <div
                                    className={`w-full px-3 py-2 border rounded bg-white cursor-pointer min-h-[38px] flex items-center justify-between transition-all duration-200 ${isOpen ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
                                    onClick={() => setPgDropdownOpen(prev => ({
                                        sph: false, cyl: false, add: false,
                                        [type]: !prev[type]
                                    }))}
                                >
                                    <div className="flex flex-wrap gap-1">
                                        {selected.length === 0 ? (
                                            <span className="text-slate-400 text-xs italic">Select {label}</span>
                                        ) : selected.length === all.length ? (
                                            <span className="text-blue-600 text-xs font-bold uppercase">All Selected</span>
                                        ) : (
                                            <span className="text-blue-600 text-xs font-bold">({selected.length}) Selected</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
                                </div>

                                {isOpen && (
                                    <div className="absolute top-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-xl z-50 p-2 max-h-60 overflow-y-auto ring-1 ring-black ring-opacity-5">
                                        {all.length === 0 ? (
                                            <div className="py-4 text-center text-slate-400 text-xs italic">No groups found</div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={all.length > 0 && selected.length === all.length}
                                                        onChange={() => toggleSelectAll(type)}
                                                    />
                                                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">Select All</span>
                                                </label>
                                                <div className="h-px bg-slate-100 my-1"></div>
                                                {all.map((group, idx) => {
                                                    const isSelected = selected.some(g => g.min === group.min && g.max === group.max);
                                                    return (
                                                        <label key={idx} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all duration-200 group ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                checked={isSelected}
                                                                onChange={() => toggleGroupSelection(type, group)}
                                                            />
                                                            <span className={`text-xs font-medium transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'}`}>
                                                                {group.min} to {group.max}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-white shadow-inner">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#e7f0f7] sticky top-0 z-10 border-b border-blue-200 shadow-sm">
                        <tr>
                            {columns.find(c => c.id === 'sNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">SNo</th>}
                            {columns.find(c => c.id === 'date')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Date</th>}
                            {columns.find(c => c.id === 'vchNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Vch No</th>}
                            {columns.find(c => c.id === 'partyName')?.visible && <th className="px-5 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Party Name</th>}
                            {columns.find(c => c.id === 'mobNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Mob.No</th>}
                            {columns.find(c => c.id === 'group')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Group</th>}
                            {columns.find(c => c.id === 'product')?.visible && <th className="px-5 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Product</th>}
                            {columns.find(c => c.id === 'modelNo')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">MODEL NO.</th>}
                            {columns.find(c => c.id === 'size')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">SIZE</th>}
                            {columns.find(c => c.id === 'color')?.visible && <th className="px-3 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">COLOR</th>}
                            {columns.find(c => c.id === 'itemDetail')?.visible && <th className="px-5 py-3 text-left text-blue-900 border-r border-blue-100 font-bold">Item Detail</th>}
                            {columns.find(c => c.id === 'qty')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-bold">Qty</th>}
                            {columns.find(c => c.id === 'price')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-bold">Price</th>}
                            {columns.find(c => c.id === 'ttlPrc')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-bold">Ttl Prc</th>}
                            {columns.find(c => c.id === 'disAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-bold">Dis Amt</th>}
                            {columns.find(c => c.id === 'ttlPrice')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-black">Ttl Price</th>}
                            {columns.find(c => c.id === 'gstWiseAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-bold">GstWise Amt</th>}
                            {columns.find(c => c.id === 'dueAmt')?.visible && <th className="px-3 py-3 text-right text-blue-900 border-r border-blue-100 font-black text-red-600">Due Amt</th>}
                            <th className="px-3 py-3 text-center text-blue-900 print:hidden font-bold">View</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="20" className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center gap-4 text-blue-600 font-black text-lg">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                        Fetching granular details...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredReportData.length === 0 ? (
                            <tr>
                                <td colSpan="20" className="text-center py-16 text-slate-400 italic font-bold text-lg">
                                    No transaction details found
                                </td>
                            </tr>
                        ) : (
                            filteredReportData.map((t, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                    {columns.find(c => c.id === 'sNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-500 font-medium">{idx + 1}</td>}
                                    {columns.find(c => c.id === 'date')?.visible && <td className="px-3 py-2 border-r border-slate-100 whitespace-nowrap text-slate-700">{new Date(t.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>}
                                    {columns.find(c => c.id === 'vchNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-900">{t.vchNo}</td>}
                                    {columns.find(c => c.id === 'partyName')?.visible && <td className="px-5 py-2 border-r border-slate-100 font-black text-slate-800">{t.partyName}</td>}
                                    {columns.find(c => c.id === 'mobNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 font-medium">{t.mobNo}</td>}
                                    {columns.find(c => c.id === 'group')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 italic uppercase text-xs">{t.group}</td>}
                                    {columns.find(c => c.id === 'product')?.visible && <td className="px-5 py-2 border-r border-slate-100 font-black text-blue-800 tracking-tight">{t.product}</td>}
                                    {columns.find(c => c.id === 'modelNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 font-mono text-xs uppercase">{t.modelNo}</td>}
                                    {columns.find(c => c.id === 'size')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 font-bold">{t.size}</td>}
                                    {columns.find(c => c.id === 'color')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 uppercase text-xs font-medium">{t.color}</td>}
                                    {columns.find(c => c.id === 'itemDetail')?.visible && <td className="px-5 py-2 border-r border-slate-100 text-slate-500 font-semibold italic text-xs tracking-wider">{t.itemDetail}</td>}
                                    {columns.find(c => c.id === 'qty')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right font-black text-slate-900">{t.qty}</td>}
                                    {columns.find(c => c.id === 'price')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-slate-700">{formatCurrency(t.price)}</td>}
                                    {columns.find(c => c.id === 'ttlPrc')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-slate-700 font-medium">{formatCurrency(t.ttlPrc)}</td>}
                                    {columns.find(c => c.id === 'disAmt')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-red-500 font-bold">-{formatCurrency(t.disAmt)}</td>}
                                    {columns.find(c => c.id === 'ttlPrice')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right font-black text-slate-900 shadow-inner bg-slate-50/30">{formatCurrency(t.ttlPrice)}</td>}
                                    {columns.find(c => c.id === 'gstWiseAmt')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-slate-800 font-medium">{formatCurrency(t.gstWiseAmt)}</td>}
                                    {columns.find(c => c.id === 'dueAmt')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right font-black text-red-700">{formatCurrency(t.dueAmt)}</td>}
                                    <td className="px-3 py-2 text-center print:hidden">
                                        <button onClick={() => handleView(t)} className="p-1.5 bg-yellow-400 text-white rounded shadow hover:bg-yellow-500 transition-transform group-hover:scale-110">
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-[#f8fafc] border-t-2 border-slate-200 sticky bottom-0 z-10 font-black">
                        <tr>
                            <td colSpan={columns.filter(c => c.visible && ['sNo', 'date', 'vchNo', 'partyName', 'mobNo', 'group', 'product', 'modelNo', 'size', 'color', 'itemDetail'].includes(c.id)).length} className="px-3 py-3 text-right text-slate-500 uppercase tracking-widest text-[10px]">Grand Totals:</td>

                            {columns.find(c => c.id === 'qty')?.visible && <td className="px-3 py-3 text-right text-blue-900 border-r border-slate-200">{totals.qty}</td>}
                            {columns.find(c => c.id === 'price')?.visible && <td className="px-3 py-3 text-right text-slate-400 border-r border-slate-200">-</td>}
                            {columns.find(c => c.id === 'ttlPrc')?.visible && <td className="px-3 py-3 text-right text-blue-900 border-r border-slate-200">{formatCurrency(totals.ttlPrc)}</td>}
                            {columns.find(c => c.id === 'disAmt')?.visible && <td className="px-3 py-3 text-right text-red-600 border-r border-slate-200">-{formatCurrency(totals.disAmt)}</td>}
                            {columns.find(c => c.id === 'ttlPrice')?.visible && <td className="px-3 py-3 text-right text-blue-900 border-r border-slate-200 bg-blue-50/50">{formatCurrency(totals.ttlPrice)}</td>}
                            {columns.find(c => c.id === 'gstWiseAmt')?.visible && <td className="px-3 py-3 text-right text-blue-900 border-r border-slate-200">{formatCurrency(totals.gstWiseAmt)}</td>}
                            {columns.find(c => c.id === 'dueAmt')?.visible && <td className="px-3 py-3 text-right text-red-700 border-r border-slate-200">{formatCurrency(totals.dueAmt)}</td>}
                            <td className="print:hidden bg-[#f8fafc]"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <style jsx global>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body { font-size: 7pt; }
                    .print\\:hidden { display: none !important; }
                    table { border-collapse: collapse !important; width: 100% !important; }
                    th, td { border: 1px solid #ddd !important; padding: 2px !important; }
                }
            `}</style>
        </div>
    );
}
