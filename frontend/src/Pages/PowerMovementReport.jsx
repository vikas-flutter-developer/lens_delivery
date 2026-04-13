import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Eye,
    Zap,
    TrendingDown,
    DollarSign,
    Package,
    Layout,
    ArrowUpDown,
    Filter,
    X,
    ChevronDown,
} from 'lucide-react';
import { getPowerMovementReport } from '../controllers/Reports.controller';
import { getAllItems } from '../controllers/itemcontroller';
import { getAllAccounts } from '../controllers/Account.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getPowerGroupsForProduct } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function PowerMovementReport() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [itemsList, setItemsList] = useState([]);
    const [partiesList, setPartiesList] = useState([]);
    const [groupsList, setGroupsList] = useState([]);
    const [powerGroupsForItem, setPowerGroupsForItem] = useState([]);
    const [loadingPowerGroups, setLoadingPowerGroups] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showColumnDropdown, setShowColumnDropdown] = useState(false);
    const [showMatrixModal, setShowMatrixModal] = useState(false);
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);
    const [vendorSearchText, setVendorSearchText] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'totalQty', direction: 'desc' });
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const vendorDropdownRef = React.useRef(null);

    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        itemName: [],
        powerGroup: '',
        movementType: 'All',
        vendorPartyName: '',
        groupName: ''
    });

    const [matrixFilters, setMatrixFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        itemName: [],
        groupName: '',
        eye: 'R/L',
        axis: '',
        add: ''
    });

    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [itemSearchText, setItemSearchText] = useState('');
    const itemDropdownRef = React.useRef(null);

    const [columns, setColumns] = useState({
        sno: true,
        eye: true,
        sph: true,
        cyl: true,
        axis: true,
        add: true,
        lensPower: true,
        itemName: true,
        totalOrders: true,
        totalQty: true,
        totalRevenue: true,
        avgPrice: true,
        lastSoldDate: true,
        movementStatus: true
    });

    useEffect(() => {
        fetchData();
        fetchItems();
        fetchParties();
        fetchGroups();

        // Close vendor dropdown on outside click
        const handleClickOutside = (e) => {
            if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(e.target)) {
                setShowVendorDropdown(false);
            }
            if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target)) {
                setShowItemDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await getAllGroups();
            setGroupsList(res.groups || []);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const fetchItems = async () => {
        try {
            const res = await getAllItems();
            setItemsList(res.items || []);
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    };

    const fetchParties = async () => {
        try {
            const res = await getAllAccounts();
            // getAllAccounts returns array directly
            const arr = Array.isArray(res) ? res : (res?.data || []);
            setPartiesList(arr);
        } catch (error) {
            console.error('Error fetching parties:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getPowerMovementReport(filters);
            if (res.success) {
                setData(res.data || []);
                setAnalytics(res.analytics || {});
            }
        } catch (error) {
            toast.error('Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleItemSelect = async (itemName, isChecked) => {
        let newItems = [...filters.itemName];
        if (isChecked) {
            newItems.push(itemName);
        } else {
            newItems = newItems.filter(name => name !== itemName);
        }
        setFilters(prev => ({ ...prev, itemName: newItems, powerGroup: '' }));
        
        if (newItems.length === 1) {
            try {
                setLoadingPowerGroups(true);
                const res = await getPowerGroupsForProduct(newItems[0]);
                if (res.success && Array.isArray(res.data)) {
                    setPowerGroupsForItem(res.data);
                } else {
                    setPowerGroupsForItem([]);
                }
            } catch (e) {
                setPowerGroupsForItem([]);
            } finally {
                setLoadingPowerGroups(false);
            }
        } else {
            setPowerGroupsForItem([]);
        }
    };

    const handleReset = () => {
        setFilters({
            dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            dateTo: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
            itemName: [],
            powerGroup: '',
            movementType: 'All',
            vendorPartyName: '',
            groupName: ''
        });
        setPowerGroupsForItem([]);
        setVendorSearchText('');
        setSearchTerm('');
        setItemSearchText('');
    };

    const handleExportExcel = () => {
        const exportData = filteredAndSortedData.map((item, idx) => ({
            'Sr. No.': idx + 1,
            'Eye': item.eye,
            'SPH': item.sph,
            'CYL': item.cyl,
            'AXIS': item.axis,
            'ADD': item.add,
            'Item Name': item.itemName,
            'Total Orders': item.totalOrders,
            'Total Quantity': item.totalQty,
            'Total Revenue': item.totalRevenue.toFixed(2),
            'Avg Price': item.avgPrice.toFixed(2),
            'Last Sold': item.lastSoldDate ? new Date(item.lastSoldDate).toLocaleDateString() : 'N/A',
            'Status': item.movementStatus
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Power Movement");
        XLSX.writeFile(wb, `Power_Movement_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const filteredAndSortedData = useMemo(() => {
        let result = [...data];

        // Power Group filter (client-side by SPH/CYL range)
        if (filters.powerGroup) {
            const pg = powerGroupsForItem.find(g => g.label === filters.powerGroup);
            if (pg) {
                result = result.filter(item => {
                    const sph = parseFloat(item.sph);
                    const cyl = parseFloat(item.cyl);
                    const sphOk = sph >= parseFloat(pg.sphMin) && sph <= parseFloat(pg.sphMax);
                    const cylOk = cyl >= parseFloat(pg.cylMin) && cyl <= parseFloat(pg.cylMax);
                    return sphOk && cylOk;
                });
            }
        }

        // Quick Search
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(item =>
                item.itemName?.toLowerCase().includes(lowerSearch) ||
                item.eye?.toLowerCase().includes(lowerSearch) ||
                item.sph.toString().includes(lowerSearch) ||
                item.cyl.toString().includes(lowerSearch) ||
                item.movementStatus?.toLowerCase().includes(lowerSearch)
            );
        }

        // Sort
        result.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [data, searchTerm, sortConfig, filters.powerGroup, powerGroupsForItem]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredAndSortedData.slice(start, start + pageSize);
    }, [filteredAndSortedData, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

    const DashboardCard = ({ title, value, icon: Icon, colorClass, subText }) => (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-xl font-bold text-slate-800">{value}</h3>
                {subText && <p className="text-[10px] text-slate-400 mt-1 font-medium">{subText}</p>}
            </div>
            <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col gap-6">
            {/* Header Area */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Zap className="w-8 h-8 text-amber-500" />
                        Power Movement Report
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Analyze power-wise delivery and sales performance</p>
                </div>
                <div className="flex gap-2 print:hidden header-actions">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition font-bold text-sm shadow-sm">
                        <Printer className="w-4 h-4" /> Print
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-bold text-sm shadow-md">
                        <FileSpreadsheet className="w-4 h-4" /> Export Excel
                    </button>
                    <button
                        onClick={() => {
                            setMatrixFilters({
                                ...matrixFilters,
                                dateFrom: filters.dateFrom,
                                dateTo: filters.dateTo,
                                itemName: filters.itemName,
                                groupName: filters.groupName
                            });
                            setShowMatrixModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-sm shadow-md"
                    >
                        <Layout className="w-4 h-4" /> Power Matrix
                    </button>
                </div>
            </div>

            {/* Analytics Insights Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 analytics-insights">
                <DashboardCard
                    title="Top Fast Moving Power"
                    value={analytics.topFastMoving?.[0] ? `${analytics.topFastMoving[0].sph} / ${analytics.topFastMoving[0].cyl}` : 'N/A'}
                    subText={analytics.topFastMoving?.[0] ? `${analytics.topFastMoving[0].totalQty} Qty Sold` : ''}
                    icon={Zap}
                    colorClass="bg-amber-100 text-amber-600"
                />
                <DashboardCard
                    title="Highest Revenue Power"
                    value={analytics.highestRevenue ? `₹${analytics.highestRevenue.totalRevenue.toLocaleString()}` : 'N/A'}
                    subText={analytics.highestRevenue ? `${analytics.highestRevenue.sph}/${analytics.highestRevenue.cyl}` : ''}
                    icon={DollarSign}
                    colorClass="bg-blue-100 text-blue-600"
                />
                <DashboardCard
                    title="Most Sold Item"
                    value={analytics.mostSoldItem || 'N/A'}
                    icon={Package}
                    colorClass="bg-purple-100 text-purple-600"
                />
                <DashboardCard
                    title="Total Summary"
                    value={`₹${analytics.totalSummary?.totalRevenue?.toLocaleString() || 0}`}
                    subText={`${analytics.totalSummary?.totalQty || 0} Total Units`}
                    icon={Layout}
                    colorClass="bg-slate-100 text-slate-600"
                />
            </div>

            {/* Filters Area */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:hidden shrink-0 filters-area">
                <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold uppercase text-xs tracking-widest border-b pb-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    Filters & Parameters
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                    {/* Date Range */}
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block">Date Range</label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition appearance-none h-[42px]"
                                />
                            </div>
                            <span className="text-slate-400 font-bold px-1">to</span>
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition appearance-none h-[42px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Item Name */}
                    <div className="lg:col-span-2 space-y-1.5" ref={itemDropdownRef}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block">Item Name</label>
                        <div className="relative">
                            <div
                                onClick={() => setShowItemDropdown(!showItemDropdown)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs hover:border-blue-500 outline-none transition min-h-[42px] cursor-pointer flex items-center justify-between"
                            >
                                <span className="truncate text-slate-800 font-medium">
                                    {(Array.isArray(filters.itemName) ? filters.itemName : []).length === 0 ? "Select items..." :
                                     filters.itemName.length > 2 ? `${filters.itemName.length} items selected` :
                                     filters.itemName.join(", ")}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                            {showItemDropdown && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2">
                                    <div className="sticky top-0 bg-white pb-2 mb-2 border-b">
                                       <input 
                                          type="text" 
                                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-500 transition" 
                                          placeholder="Search here..."
                                          onClick={(e) => e.stopPropagation()}
                                          value={itemSearchText}
                                          onChange={(e) => setItemSearchText(e.target.value)}
                                       />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {itemsList.filter(it => (it.itemName || '').toLowerCase().includes(itemSearchText.toLowerCase())).length === 0 ? (
                                            <div className="px-2 py-3 text-xs text-slate-400 italic text-center">No items found</div>
                                        ) : (
                                            itemsList.filter(it => (it.itemName || '').toLowerCase().includes(itemSearchText.toLowerCase())).map((it, idx) => (
                                                <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                                                    <input 
                                                        type="checkbox"
                                                        checked={(Array.isArray(filters.itemName) ? filters.itemName : []).includes(it.itemName)}
                                                        onChange={(e) => handleItemSelect(it.itemName, e.target.checked)}
                                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                                    />
                                                    <span className="text-xs font-medium text-slate-700 truncate" title={it.itemName}>{it.itemName}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Power Group Filter */}
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block">
                            Power Group
                            {loadingPowerGroups && <span className="ml-1 text-blue-400 normal-case font-normal">Loading...</span>}
                        </label>
                        <select
                            value={filters.powerGroup}
                            onChange={(e) => handleFilterChange('powerGroup', e.target.value)}
                            disabled={powerGroupsForItem.length === 0}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition font-medium h-[42px] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <option value="">{Array.isArray(filters.itemName) && filters.itemName.length > 0 ? (powerGroupsForItem.length === 0 ? 'No groups found' : 'All Power Groups') : 'Select item first'}</option>
                            {powerGroupsForItem.map((pg, idx) => (
                                <option key={idx} value={pg.label}>{pg.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Vendor / Party — Searchable Dropdown */}
                    <div className="lg:col-span-4 space-y-1.5" ref={vendorDropdownRef}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block">Vendor / Party</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search vendor or party..."
                                value={vendorSearchText !== '' ? vendorSearchText : filters.vendorPartyName}
                                onFocus={() => {
                                    setVendorSearchText(filters.vendorPartyName);
                                    setShowVendorDropdown(true);
                                }}
                                onChange={(e) => {
                                    setVendorSearchText(e.target.value);
                                    setShowVendorDropdown(true);
                                    if (e.target.value === '') handleFilterChange('vendorPartyName', '');
                                }}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition h-[42px] pr-8"
                            />
                            {filters.vendorPartyName && (
                                <button
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400 transition"
                                    onClick={() => { handleFilterChange('vendorPartyName', ''); setVendorSearchText(''); }}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {showVendorDropdown && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto custom-scrollbar">
                                    {(() => {
                                        const q = (vendorSearchText || '').toLowerCase();
                                        const filtered = partiesList.filter(p => (p.Name || '').toLowerCase().includes(q));
                                        if (filtered.length === 0) return (
                                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No parties found</div>
                                        );
                                        return filtered.slice(0, 80).map((p, idx) => (
                                            <div
                                                key={idx}
                                                onMouseDown={() => {
                                                    handleFilterChange('vendorPartyName', p.Name);
                                                    setVendorSearchText(p.Name);
                                                    setShowVendorDropdown(false);
                                                }}
                                                className="px-4 py-2.5 text-xs font-semibold cursor-pointer hover:bg-blue-50 text-slate-700 border-b border-slate-50 last:border-0"
                                            >
                                                {p.Name}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Movement Status */}
                    <div className="lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block">Movement Status</label>
                        <select
                            value={filters.movementType}
                            onChange={(e) => handleFilterChange('movementType', e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition font-medium h-[42px]"
                        >
                            <option value="All">All Movements</option>
                            <option value="Fast Moving">Fast Moving</option>
                            <option value="Medium Moving">Medium Moving</option>
                            <option value="Slow Moving">Slow Moving</option>
                        </select>
                    </div>

                    {/* Group Name */}
                    <div className="lg:col-span-3 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block">Group Name</label>
                        <div className="relative">
                            <input
                                type="text"
                                list="groups-list"
                                placeholder="Search group..."
                                value={filters.groupName}
                                onChange={(e) => handleFilterChange('groupName', e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition h-[42px]"
                            />
                            <datalist id="groups-list">
                                {groupsList.map((g, idx) => <option key={idx} value={g.groupName} />)}
                            </datalist>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="lg:col-span-2 flex gap-2 h-[42px]">
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : <><Search className="w-4 h-4" /> Search</>}
                        </button>
                        <button
                            onClick={handleReset}
                            className="w-[42px] flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition shadow-sm"
                            title="Reset Filters"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>

            {/* Table Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1 table-area">
                {/* Table Header Controls */}
                <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 shrink-0 table-controls">
                    <div className="relative group min-w-[300px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Quick search power, status or item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
                            >
                                <Layout className="w-4 h-4" /> Columns
                            </button>
                            {showColumnDropdown && (
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Visible Columns</span>
                                        <button onClick={() => setShowColumnDropdown(false)}><X className="w-3 h-3 text-slate-400" /></button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {Object.keys(columns).filter(col => !['eye', 'sph', 'cyl', 'axis', 'add'].includes(col)).map(col => (
                                            <label key={col} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                                                <input
                                                    type="checkbox"
                                                    checked={col === 'lensPower' ? columns.eye : columns[col]}
                                                    onChange={() => {
                                                        if (col === 'lensPower') {
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
                                                            setColumns(prev => ({ ...prev, [col]: !prev[col] }));
                                                        }
                                                    }}
                                                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                                />
                                                <span className="text-xs font-medium text-slate-700 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actual Table */}
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
                            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                                {columns.sno && <th className="px-4 py-4 border-r">Sr. No.</th>}
                                {columns.eye && <th className="px-4 py-4 border-r">Eye</th>}
                                {columns.sph && <th className="px-4 py-4 border-r cursor-pointer hover:text-blue-600 transition" onClick={() => handleSort('sph')}><div className="flex items-center justify-center gap-1">SPH <ArrowUpDown className="w-3 h-3" /></div></th>}
                                {columns.cyl && <th className="px-4 py-4 border-r cursor-pointer hover:text-blue-600 transition" onClick={() => handleSort('cyl')}><div className="flex items-center justify-center gap-1">CYL <ArrowUpDown className="w-3 h-3" /></div></th>}
                                {columns.axis && <th className="px-4 py-4 border-r">AXIS</th>}
                                {columns.add && <th className="px-4 py-4 border-r">ADD</th>}
                                {columns.itemName && <th className="px-6 py-4 border-r text-left min-w-[200px]">Item Name</th>}
                                {columns.totalOrders && <th className="px-4 py-4 border-r">Orders</th>}
                                {columns.totalQty && <th className="px-4 py-4 border-r cursor-pointer hover:text-blue-600 transition bg-blue-50/30 text-blue-700" onClick={() => handleSort('totalQty')}><div className="flex items-center justify-center gap-1">Quantity <ArrowUpDown className="w-3 h-3" /></div></th>}
                                {columns.totalRevenue && <th className="px-4 py-4 border-r cursor-pointer hover:text-blue-600 transition" onClick={() => handleSort('totalRevenue')}><div className="flex items-center justify-center gap-1">Revenue <ArrowUpDown className="w-3 h-3" /></div></th>}
                                {columns.avgPrice && <th className="px-4 py-4 border-r">Avg Price</th>}
                                {columns.lastSoldDate && <th className="px-4 py-4 border-r">Last Sold</th>}
                                {columns.movementStatus && <th className="px-4 py-4">Status</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-slate-50 rounded-full">
                                                <Search className="w-10 h-10 text-slate-300" />
                                            </div>
                                            <p className="text-slate-400 font-medium italic">No power combinations matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((item, idx) => (
                                    <tr key={idx} className={`hover:bg-slate-50/80 transition-colors text-center text-xs font-semibold ${item.movementStatus === 'Fast Moving' ? 'bg-amber-50/10' : ''}`}>
                                        {columns.sno && <td className="px-4 py-3 border-r text-slate-400">{(currentPage - 1) * pageSize + idx + 1}</td>}
                                        {columns.eye && <td className="px-4 py-3 border-r text-blue-600 font-bold">{item.eye}</td>}
                                        {columns.sph && <td className="px-4 py-3 border-r text-slate-700">{item.sph.toFixed(2)}</td>}
                                        {columns.cyl && <td className="px-4 py-3 border-r text-slate-700">{item.cyl.toFixed(2)}</td>}
                                        {columns.axis && <td className="px-4 py-3 border-r text-slate-700">{item.axis}</td>}
                                        {columns.add && <td className="px-4 py-3 border-r text-slate-700">{item.add.toFixed(2)}</td>}
                                        {columns.itemName && <td className="px-6 py-3 border-r text-left truncate max-w-[200px]" title={item.itemName}>{item.itemName}</td>}
                                        {columns.totalOrders && <td className="px-4 py-3 border-r">{item.orderCount}</td>}
                                        {columns.totalQty && <td className="px-4 py-3 border-r text-lg font-black text-blue-700 bg-blue-50/30">{item.totalQty}</td>}
                                        {columns.totalRevenue && <td className="px-4 py-3 border-r text-slate-700">₹{item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                                        {columns.avgPrice && <td className="px-4 py-3 border-r text-slate-500">₹{item.avgPrice.toFixed(2)}</td>}
                                        {columns.lastSoldDate && <td className="px-4 py-3 border-r text-slate-400">{item.lastSoldDate ? new Date(item.lastSoldDate).toLocaleDateString("en-IN") : '-'}</td>}
                                        {columns.movementStatus && (
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${item.movementStatus === 'Fast Moving' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                        item.movementStatus === 'Medium Moving' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                            'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}>
                                                    {item.movementStatus}
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Total Summary Bar */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 summary-bar">
                    <div className="flex gap-8 items-center">
                        <div className="flex items-center gap-4 border-r border-slate-700 pr-8">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Quantity</p>
                            <span className="text-xl font-black text-blue-400">{analytics.totalSummary?.totalQty || 0}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Net Revenue</p>
                            <span className="text-xl font-black text-emerald-400">₹{(analytics.totalSummary?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 mr-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Show per page</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="bg-slate-800 border-none text-xs rounded-md px-2 py-1 outline-none font-bold"
                            >
                                {[10, 25, 50, 100].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="p-1 px-3 bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                                «
                            </button>
                            <span className="text-xs font-bold px-4 tracking-tighter">Page {currentPage} of {totalPages || 1}</span>
                            <button
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="p-1 px-3 bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                                »
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Matrix Modal */}
            {showMatrixModal && (
                <MatrixModal
                    filters={matrixFilters}
                    onClose={() => setShowMatrixModal(false)}
                    itemsList={itemsList}
                    groupsList={groupsList}
                />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: landscape; margin: 1cm; }
                    body { background: white !important; color: black !important; }
                    .min-h-screen { display: block !important; padding: 0 !important; background: white !important; }
                    
                    /* Hide non-essential elements */
                    .print\\:hidden, 
                    button, 
                    select, 
                    input, 
                    .DashboardCard, 
                    .analytics-insights,
                    .filters-area,
                    .header-actions,
                    .table-controls,
                    .summary-bar,
                    .pagination-area,
                    .lucide { 
                        display: none !important; 
                    }

                    /* Show only Title and Table */
                    h1 { display: block !important; font-size: 20pt !important; margin-bottom: 20px !important; color: black !important; }
                    .table-area { display: block !important; border: none !important; box-shadow: none !important; margin-top: 0 !important; }
                    .overflow-hidden { overflow: visible !important; }
                    .overflow-x-auto { overflow: visible !important; display: block !important; }
                    
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        table-layout: auto !important;
                    }
                    
                    th, td { 
                        border: 1px solid #000 !important; 
                        padding: 6px 4px !important; 
                        font-size: 9pt !important; 
                        color: black !important;
                        background: transparent !important;
                    }
                    
                    thead { display: table-header-group !important; }
                    tr { page-break-inside: avoid !important; }
                    
                    .text-blue-600, .text-blue-700, .text-emerald-700, .bg-blue-50\\/30 { 
                        color: black !important; 
                        background: transparent !important; 
                    }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}} />
        </div>
    );
}

// Matrix Modal Component
const MatrixModal = ({ filters: initialFilters, onClose, itemsList, groupsList }) => {
    const [loading, setLoading] = useState(false);
    const [matrixData, setMatrixData] = useState([]);
    const [filters, setFilters] = useState(initialFilters);

    useEffect(() => {
        fetchMatrixData();
    }, []);

    const fetchMatrixData = async () => {
        try {
            setLoading(true);
            const res = await getPowerMovementReport(filters);
            if (res.success) {
                setMatrixData(res.data || []);
            }
        } catch (error) {
            toast.error('Failed to fetch matrix data');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // Matrix Logic
    const { powerRows, addCols, cellData } = useMemo(() => {
        let filtered = matrixData;

        // Frontend filtering for specific UI selections
        if (filters.eye && filters.eye !== 'Both') {
            filtered = filtered.filter(item => item.eye === filters.eye);
        }
        if (filters.axis) {
            filtered = filtered.filter(item => item.axis.toString() === filters.axis);
        }
        if (filters.add) {
            filtered = filtered.filter(item => parseFloat(item.add).toFixed(2) === parseFloat(filters.add).toFixed(2));
        }

        const combos = new Set();
        const adds = new Set();
        const map = {};

        filtered.forEach(item => {
            const s = parseFloat(item.sph).toFixed(2);
            const c = parseFloat(item.cyl).toFixed(2);
            const ax = parseInt(item.axis) || 0;
            const ad = parseFloat(item.add).toFixed(2);

            const comboKey = `${s} / ${c} / ${ax}`;
            combos.add(comboKey);
            adds.add(ad);

            const cellKey = `${comboKey}_${ad}`;
            if (!map[cellKey]) {
                map[cellKey] = { qty: 0, status: item.movementStatus };
            }
            map[cellKey].qty += item.totalQty;
            
            // Prefer 'Fast Moving' status if multiple items are aggregated
            if (item.movementStatus === 'Fast Moving') {
                map[cellKey].status = 'Fast Moving';
            } else if (item.movementStatus === 'Medium Moving' && map[cellKey].status === 'Slow Moving') {
                map[cellKey].status = 'Medium Moving';
            }
        });

        // Sort combinations: SPH desc, then CYL desc, then AXIS asc
        const sortedCombos = Array.from(combos).sort((a, b) => {
            const [sa, ca, aa] = a.split(' / ').map(parseFloat);
            const [sb, cb, ab] = b.split(' / ').map(parseFloat);
            if (sb !== sa) return sb - sa;
            if (cb !== ca) return cb - ca;
            return aa - ab;
        });

        const sortedAdds = Array.from(adds).sort((a, b) => parseFloat(a) - parseFloat(b));

        return { powerRows: sortedCombos, addCols: sortedAdds, cellData: map };
    }, [matrixData, filters.eye, filters.axis, filters.add]);

    const statusColorMap = {
        'Fast Moving': 'text-emerald-600',
        'Medium Moving': 'text-blue-600',
        'Slow Moving': 'text-slate-400',
        'Default': 'text-blue-600'
    };

    const statusBgMap = {
        'Fast Moving': 'bg-emerald-50/30',
        'Medium Moving': 'bg-blue-50/30',
        'Slow Moving': 'bg-slate-50/50',
        'Default': 'bg-blue-50/20'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Layout className="w-6 h-6 text-blue-600" />
                            Power Movement Matrix
                        </h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Movement Analysis: SPH/CYL/AXIS vs ADD</p>
                    </div>
                    <div className="flex items-center gap-6 mr-8">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fast</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Medium</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slow</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Modal Filters */}
                <div className="p-6 bg-white border-b border-slate-100 shrink-0 shadow-sm relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date From</label>
                            <input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date To</label>
                            <input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</label>
                            <input type="text" title={Array.isArray(filters.itemName) ? filters.itemName.join(", ") : filters.itemName} list="matrix-items" placeholder="Item..." value={Array.isArray(filters.itemName) ? filters.itemName.join(", ") : filters.itemName} onChange={e => handleFilterChange('itemName', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition truncate" />
                            <datalist id="matrix-items">{itemsList.map((it, i) => <option key={i} value={it.itemName} />)}</datalist>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Group</label>
                            <select value={filters.groupName} onChange={e => handleFilterChange('groupName', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition">
                                <option value="">All Groups</option>
                                {groupsList.map((g, i) => <option key={i} value={g.groupName}>{g.groupName}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eye</label>
                            <select value={filters.eye} onChange={e => handleFilterChange('eye', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition">
                                <option value="Both">Both</option>
                                <option value="R/L">R/L</option>
                                <option value="R">R</option>
                                <option value="L">L</option>
                            </select>
                        </div>
                        <button onClick={fetchMatrixData} disabled={loading} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-xs font-black uppercase hover:bg-blue-700 transition shadow-md disabled:opacity-50 h-[38px]">
                            {loading ? '...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Matrix Content */}
                <div className="flex-1 overflow-auto p-8 bg-slate-50/30 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold text-sm">Building Matrix...</p>
                        </div>
                    ) : powerRows.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                            <Layout className="w-16 h-16 opacity-20" />
                            <p className="font-bold italic">No data found for the selected matrix filters.</p>
                        </div>
                    ) : (
                        <div className="inline-block min-w-full">
                            <table className="border-separate border-spacing-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-40 bg-slate-100 p-4 border-r border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 text-center min-w-[180px]">SPH / CYL / AXIS</th>
                                        {addCols.map(add => (
                                            <th key={add} className="sticky top-0 z-30 bg-slate-100 p-4 border-b border-slate-200 text-xs font-black text-slate-700 text-center min-w-[100px]">
                                                ADD: {parseFloat(add) > 0 ? `+${add}` : add}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {powerRows.map(combo => (
                                        <tr key={combo} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="sticky left-0 z-30 bg-slate-50 p-4 border-r border-b border-slate-200 text-xs font-bold text-slate-700 text-center whitespace-nowrap">
                                                {combo}
                                            </td>
                                            {addCols.map(add => {
                                                const cell = cellData[`${combo}_${add}`];
                                                const val = cell?.qty || 0;
                                                const status = cell?.status;
                                                const colorClass = val > 0 ? (statusColorMap[status] || statusColorMap['Default']) : 'text-slate-200';
                                                const bgClass = val > 0 ? (statusBgMap[status] || statusBgMap['Default']) : '';
                                                
                                                return (
                                                    <td 
                                                        key={`${combo}_${add}`} 
                                                        title={val > 0 ? status : ''}
                                                        className={`p-4 border-r border-b border-slate-100 text-center font-black text-sm transition-all hover:bg-blue-50/50 ${colorClass} ${bgClass}`}
                                                    >
                                                        {val > 0 ? val : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Combinations: {powerRows.length} | Unique Adds: {addCols.length} | Items Found: {matrixData.length}
                    </div>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition shadow-sm">Close View</button>
                </div>
            </div>
        </div>
    );
};

