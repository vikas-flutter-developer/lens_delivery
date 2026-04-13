import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    ChevronDown,
    Filter,
    BarChart3,
    Package,
    Table,
    PieChart,
} from 'lucide-react';
import { getLensStockReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllItems } from '../controllers/itemcontroller';
import toast from 'react-hot-toast';

export default function LensStockReport() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [items, setItems] = useState([]);
    const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'detail', 'eye'
    const [viewMode, setViewMode] = useState('report'); // 'report', 'analysis'

    const [filters, setFilters] = useState({
        groupName: '',
        productName: '',
        barcode: '',
        boxNo: '',
        sphMin: '',
        sphMax: '',
        cylMin: '',
        cylMax: '',
        axis: '',
        addMin: '',
        addMax: '',
        eye: 'All',
        showQty: 'All',
        orderByAdd: false,
        showEye: true
    });

    useEffect(() => {
        fetchInitialData();
        handleSearch(); // Initial fetch
    }, []);

    const fetchInitialData = async () => {
        try {
            console.log('🔄 Fetching groups and items...');

            const groupRes = await getAllGroups();
            console.log('📦 Groups Response:', groupRes);
            const groupsList = groupRes.groups || groupRes.data?.groups || [];
            setGroups(groupsList);

            const itemRes = await getAllItems();
            console.log('📦 Items Response:', itemRes);
            console.log('📦 Response Type:', typeof itemRes, 'Is Array:', Array.isArray(itemRes));

            // Handle multiple response formats
            let itemsList = [];
            if (itemRes.items && Array.isArray(itemRes.items)) {
                itemsList = itemRes.items;
            } else if (itemRes.data && Array.isArray(itemRes.data)) {
                itemsList = itemRes.data;
            } else if (itemRes.data?.items && Array.isArray(itemRes.data.items)) {
                itemsList = itemRes.data.items;
            } else if (Array.isArray(itemRes)) {
                itemsList = itemRes;
            }

            console.log('✅ Items Processed:', itemsList.length, 'items');
            if (itemsList.length > 0) {
                console.log('📋 Sample Item:', itemsList[0]);
                console.log('📋 Item Keys:', Object.keys(itemsList[0]));
            } else {
                console.warn('⚠️ NO ITEMS RECEIVED FROM API');
                // Add test items for debugging
                console.log('📝 Adding test items for dropdown debugging...');
                itemsList = [
                    { _id: 'test1', itemName: 'Test Item 1', groupName: 'Test Group A' },
                    { _id: 'test2', itemName: 'Test Item 2', groupName: 'Test Group B' },
                    { _id: 'test3', itemName: 'Test Item 3', groupName: 'Test Group A' }
                ];
            }

            setItems(itemsList);
        } catch (error) {
            console.error('❌ Error fetching initial data:', error);
            console.error('Error Details:', error.message, error.response?.data);
            toast.error('Failed to load items and groups');
            setItems([]);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getLensStockReport(filters);
            if (res.success) {
                let data = res.data;

                // Apply manual sorting if "Order by Add" is checked
                if (filters.orderByAdd) {
                    data.sort((a, b) => (parseFloat(a.addValue) || 0) - (parseFloat(b.addValue) || 0));
                }

                setReportData(data);
            }
        } catch (error) {
            toast.error('Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            groupName: '',
            productName: '',
            barcode: '',
            boxNo: '',
            sphMin: '',
            sphMax: '',
            cylMin: '',
            cylMax: '',
            axis: '',
            addMin: '',
            addMax: '',
            eye: 'All',
            showQty: 'All',
            orderByAdd: false,
            showEye: true
        });
        // Optional: trigger search after reset
        // handleSearch();
    };

    const handleExport = () => {
        toast.success('Exporting to Excel...');
        // Implementation for excel export would go here
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 print:p-0">
            <div className="max-w-[1600px] mx-auto">
                {/* Debug Alert */}
                {items.length === 0 && (
                    <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                        <p className="text-sm text-yellow-800">
                            <span className="font-bold">⚠️ Items Not Loaded:</span> Check browser console (F12) for API response details.
                            Items count: {items.length}
                        </p>
                    </div>
                )}

                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl px-6 py-4 shadow-md">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <BarChart3 className="w-8 h-8" />
                            Lens Stock Report
                        </h1>
                        <p className="text-blue-100 text-sm mt-1">📊 Combined View With & Without Barcode Data</p>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-blue-800/30 p-1 rounded-lg border border-blue-400/30 backdrop-blur-sm">
                        <button
                            onClick={() => setViewMode('report')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm ${viewMode === 'report'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-blue-100 hover:bg-white/10'
                                }`}
                        >
                            <Table className="w-4 h-4" />
                            Stock Details
                        </button>
                        <button
                            onClick={() => setViewMode('analysis')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium text-sm ${viewMode === 'analysis'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-blue-100 hover:bg-white/10'
                                }`}
                        >
                            <PieChart className="w-4 h-4" />
                            Analysis & Summary
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-md font-semibold"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition shadow-md font-semibold"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                    </div>
                </div>

                {/* Filters Grid */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {/* Group Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Group Name</label>
                            <input
                                type="text"
                                value={filters.groupName}
                                onChange={(e) => handleFilterChange('groupName', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                placeholder="Search Group..."
                            />
                        </div>

                        {/* Product Name - Item Name Dropdown */}
                        <div className="lg:col-span-2 relative">
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                                Item Name {items?.length ? `(${items.length})` : '(loading)'}
                            </label>
                            <select
                                value={filters.productName}
                                onChange={(e) => {
                                    const selectedValue = e.target.value;
                                    console.log('✅ Selected:', selectedValue);
                                    handleFilterChange('productName', selectedValue);

                                    if (selectedValue && items?.length > 0) {
                                        const found = items.find(item => (item.itemName || item.name) === selectedValue);
                                        if (found) {
                                            const groupName = found.groupName || found.group || '';
                                            console.log('✅ Found item, setting group to:', groupName);
                                            handleFilterChange('groupName', groupName);
                                            toast.success('✓ Item selected, group auto-filled!');
                                        }
                                    }
                                }}
                                style={{
                                    appearance: 'auto',
                                    WebkitAppearance: 'menulist',
                                    MozAppearance: 'menulist'
                                }}
                                className="w-full px-3 py-2.5 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition text-sm bg-white cursor-pointer font-medium text-slate-700 hover:bg-slate-50 hover:border-blue-500"
                            >
                                <option value="">-- Select Item --</option>
                                <option value="Test Item 1">Test Item 1</option>
                                <option value="Test Item 2">Test Item 2</option>
                                <option value="Test Item 3">Test Item 3</option>
                                {items?.length > 0 && items.map((item) => (
                                    <option key={item._id || item.id} value={item.itemName || item.name}>
                                        {item.itemName || item.name}
                                    </option>
                                ))}
                            </select>
                            {items?.length === 0 && (
                                <div className="text-xs text-orange-600 mt-1 font-semibold bg-orange-50 p-2 rounded border border-orange-200">
                                    ⚠️ No items available - check backend API
                                </div>
                            )}
                        </div>

                        {/* Box No */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Box No</label>
                            <input
                                type="text"
                                value={filters.boxNo}
                                onChange={(e) => handleFilterChange('boxNo', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                placeholder="Box No..."
                            />
                        </div>

                        {/* Barcode */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Barcode</label>
                            <input
                                type="text"
                                value={filters.barcode}
                                onChange={(e) => handleFilterChange('barcode', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                placeholder="Scan or Type..."
                            />
                        </div>

                        {/* Show Qty */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Show Qty</label>
                            <select
                                value={filters.showQty}
                                onChange={(e) => handleFilterChange('showQty', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                            >
                                <option value="All">All</option>
                                <option value="Positive">Positive</option>
                                <option value="Negative">Negative</option>
                                <option value="Zero">Zero</option>
                            </select>
                        </div>

                        {/* SPH Range */}
                        <div className="flex gap-2 lg:col-span-2">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">From SPH</label>
                                <input
                                    type="number"
                                    step="0.25"
                                    value={filters.sphMin}
                                    onChange={(e) => handleFilterChange('sphMin', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">To SPH</label>
                                <input
                                    type="number"
                                    step="0.25"
                                    value={filters.sphMax}
                                    onChange={(e) => handleFilterChange('sphMax', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                />
                            </div>
                        </div>

                        {/* CYL Range */}
                        <div className="flex gap-2 lg:col-span-2">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">From CYL</label>
                                <input
                                    type="number"
                                    step="0.25"
                                    value={filters.cylMin}
                                    onChange={(e) => handleFilterChange('cylMin', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">To CYL</label>
                                <input
                                    type="number"
                                    step="0.25"
                                    value={filters.cylMax}
                                    onChange={(e) => handleFilterChange('cylMax', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                />
                            </div>
                        </div>

                        {/* Axis */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Axis</label>
                            <input
                                type="number"
                                value={filters.axis}
                                onChange={(e) => handleFilterChange('axis', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                            />
                        </div>

                        {/* ADD */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">ADD</label>
                            <input
                                type="number"
                                step="0.25"
                                value={filters.addMin}
                                onChange={(e) => handleFilterChange('addMin', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                            />
                        </div>

                        {/* EYE */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">EYE</label>
                            <select
                                value={filters.eye}
                                onChange={(e) => handleFilterChange('eye', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                            >
                                <option value="All">All</option>
                                <option value="R">Right</option>
                                <option value="L">Left</option>
                            </select>
                        </div>

                        {/* Checkboxes */}
                        <div className="flex items-center gap-6 xl:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filters.orderByAdd}
                                    onChange={(e) => handleFilterChange('orderByAdd', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition">Order by Add</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filters.showEye}
                                    onChange={(e) => handleFilterChange('showEye', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition">Show Eye</span>
                            </label>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-end gap-2 lg:col-span-1 xl:col-span-1">
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-md disabled:bg-blue-400"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search className="w-4 h-4" />}
                                Search
                            </button>
                            <button
                                onClick={handleReset}
                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition border border-slate-300"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                {viewMode === 'report' && (
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-none  print:shadow-none print:border-none">
                        <div className="">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-blue-600 text-white text-xs uppercase tracking-wider font-bold">
                                        <th rowSpan="2" className="px-4 py-3 border-r border-blue-500 text-center">S No.</th>
                                        <th rowSpan="2" className="px-4 py-3 border-r border-blue-500">Lens Name</th>
                                        <th rowSpan="2" className="px-4 py-3 border-r border-blue-500">Group Name</th>
                                        <th colSpan="5" className="px-4 py-2 border-r border-blue-500 text-center border-b border-blue-500">Lense Configuration</th>
                                        <th rowSpan="2" className="px-4 py-3 border-r border-blue-500 text-center">B.Code</th>
                                        <th rowSpan="2" className="px-4 py-3 border-r border-blue-500 text-center">Verified</th>
                                        <th colSpan="4" className="px-4 py-2 border-r border-blue-500 text-center border-b border-blue-500">Quantity</th>
                                        <th colSpan="2" className="px-4 py-2 border-r border-blue-500 text-center border-b border-blue-500">Price</th>
                                        <th colSpan="2" className="px-4 py-2 text-center border-b border-blue-500">Amount</th>
                                    </tr>
                                    <tr className="bg-blue-500 text-white text-[10px] uppercase tracking-tighter">
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">SPH</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">CYL</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">Axis</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">ADD</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">EYE</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">Alert</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">Stock</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">Min</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-center">Max</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-right">Pur Price</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-right">Sale Price</th>
                                        <th className="px-2 py-1 border-r border-blue-400 text-right">Ttl Amt(P)</th>
                                        <th className="px-2 py-1 text-right">Ttl Amt(S)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 italic font-medium">
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan="18" className="px-6 py-10 text-center text-slate-400 bg-slate-50 italic">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Package className="w-12 h-12 text-slate-300" />
                                                    <span className="text-lg">No records found</span>
                                                    <span className="text-xs">Adjust your filters to see results</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        reportData.map((row, index) => (
                                            <tr key={index} className="hover:bg-blue-50 transition-colors group">
                                                <td className="px-4 py-2 border-r border-slate-100 text-center text-slate-500 tabular-nums">{index + 1}</td>
                                                <td className="px-4 py-2 border-r border-slate-100 font-semibold text-slate-700">{row.productName}</td>
                                                <td className="px-4 py-2 border-r border-slate-100 text-slate-600">{row.groupName}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-800 font-bold">{parseFloat(row.sph).toFixed(2)}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-800 font-bold">{parseFloat(row.cyl).toFixed(2)}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-600">{row.axis || 0}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-800 font-bold">{parseFloat(row.addValue).toFixed(2)}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-600">{row.eye || '—'}</td>
                                                <td className="px-4 py-2 border-r border-slate-100 text-blue-600 font-mono text-xs">{row.barcode || '—'}</td>
                                                <td className="px-4 py-2 border-r border-slate-100 text-center">
                                                    {row.isVerified ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-green-600 font-bold">✓</span>
                                                            {row.lastVerifiedDate && (
                                                                <span className="text-[8px] text-slate-400">
                                                                    {new Date(row.lastVerifiedDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-red-600 font-bold">{row.alertQty || 0}</td>
                                                <td className={`px-2 py-2 border-r border-slate-100 text-center font-bold text-lg ${row.currentStock > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {row.currentStock}
                                                </td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-400">{row.alertQty || 0}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-400">0</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-right font-medium text-slate-600">{(parseFloat(row.pPrice) || 0).toFixed(2)}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-right font-medium text-slate-800">{(parseFloat(row.sPrice) || 0).toFixed(2)}</td>
                                                <td className="px-2 py-2 border-r border-slate-100 text-right font-bold text-slate-700 bg-slate-50">
                                                    {((parseFloat(row.currentStock) || 0) * (parseFloat(row.pPrice) || 0)).toFixed(2)}
                                                </td>
                                                <td className="px-2 py-2 text-right font-bold text-blue-800 bg-blue-50">
                                                    {((parseFloat(row.currentStock) || 0) * (parseFloat(row.sPrice) || 0)).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="sticky bottom-0  bg-zinc-50 text-black font-bold">
                                    <tr>
                                        <td colSpan="12" className="px-4 py-2 text-right uppercase tracking-widest text-xs">Grand Total</td>
                                        <td className="px-2 py-2 text-center text-yellow-400">
                                            {reportData.reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0)}
                                        </td>
                                        <td colSpan="3" className="px-2 py-2"></td>
                                        <td className="px-2 py-2 text-right text-emerald-400">
                                            {reportData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.pPrice) || 0)), 0).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-2 text-right text-blue-300">
                                            {reportData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.sPrice) || 0)), 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* Analysis & Summary View */}
                {viewMode === 'analysis' && (
                    <div className="mt-6">
                        {reportData.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400">
                                <PieChart className="w-16 h-16 mb-4 text-slate-300" />
                                <h3 className="text-xl font-semibold text-slate-600">No Data for Analysis</h3>
                                <p className="text-sm">Apply filters and search to view the analysis report.</p>
                            </div>
                        ) : (
                            <div>
                                <div className="mb-4">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                        Analysis & Summary
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">Multi-view analysis of lens inventory</p>
                                </div>

                                {/* Tab Navigation */}
                                <div className="bg-white rounded-t-xl shadow-sm border border-b-0 border-slate-200 flex overflow-x-auto">
                                    {[
                                        { id: 'summary', label: 'SPH/CYL Matrix', icon: '📊' },
                                        { id: 'eye', label: 'Eye Wise Summary', icon: '👁️' },
                                        { id: 'detail', label: 'Group Summary', icon: '📋' },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-4 py-3 font-semibold text-sm whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                                ? 'border-blue-600 text-blue-600 bg-blue-50'
                                                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                                }`}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="bg-white rounded-b-xl shadow-md border border-slate-200 overflow-auto min-h-[400px]">
                                    {/* SPH/CYL Matrix Tab */}
                                    {activeTab === 'summary' && (
                                        <div className="overflow-x-auto p-4">
                                            <table className="w-full text-sm text-center border-collapse">
                                                <thead className="sticky top-0 z-10 bg-emerald-600 text-white">
                                                    <tr>
                                                        <th className="px-3 py-2 border border-emerald-500 font-bold min-w-[80px]">SPH / CYL</th>
                                                        {[...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sph => (
                                                            <th key={`sph-${sph}`} className="px-3 py-2 border border-emerald-500 font-bold min-w-[70px] bg-emerald-700">
                                                                {parseFloat(sph).toFixed(2)}
                                                            </th>
                                                        ))}
                                                        <th className="px-3 py-2 border border-emerald-500 font-bold min-w-[80px] bg-emerald-800">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {[...new Set(reportData.map(r => r.cyl))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(cyl => {
                                                        const sphValues = [...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b));
                                                        const cylTotal = reportData
                                                            .filter(r => r.cyl === cyl)
                                                            .reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0);

                                                        return (
                                                            <tr key={`cyl-${cyl}`} className="hover:bg-emerald-50 transition-colors">
                                                                <td className="px-3 py-2 border border-slate-200 font-bold bg-emerald-50">
                                                                    {parseFloat(cyl).toFixed(2)}
                                                                </td>
                                                                {sphValues.map(sph => {
                                                                    const cellData = reportData.find(r => r.sph === sph && r.cyl === cyl);
                                                                    const qty = cellData ? (parseInt(cellData.currentStock) || 0) : 0;
                                                                    return (
                                                                        <td
                                                                            key={`${sph}-${cyl}`}
                                                                            className={`px-3 py-2 border border-slate-200 font-semibold ${qty > 0 ? 'bg-green-100 text-green-800' : 'bg-slate-50 text-slate-400'}`}
                                                                        >
                                                                            {qty > 0 ? qty : '—'}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-3 py-2 border border-slate-200 font-bold bg-emerald-700 text-white">
                                                                    {cylTotal}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* SPH Total Row */}
                                                    <tr className="bg-emerald-800 text-white font-bold sticky bottom-0">
                                                        <td className="px-3 py-2 border border-emerald-500">Total</td>
                                                        {[...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sph => {
                                                            const sphTotal = reportData
                                                                .filter(r => r.sph === sph)
                                                                .reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0);
                                                            return (
                                                                <td key={`sph-total-${sph}`} className="px-3 py-2 border border-emerald-500">
                                                                    {sphTotal}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-2 border border-emerald-500">
                                                            {reportData.reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Eye Wise Summary Tab */}
                                    {activeTab === 'eye' && (
                                        <div className="overflow-x-auto p-4">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="sticky top-0 z-10 bg-blue-600 text-white">
                                                    <tr>
                                                        <th className="px-4 py-2 border border-blue-500 text-left font-bold">Eye</th>
                                                        <th className="px-4 py-2 border border-blue-500 text-center font-bold">Total Items</th>
                                                        <th className="px-4 py-2 border border-blue-500 text-center font-bold">Total Quantity</th>
                                                        <th className="px-4 py-2 border border-blue-500 text-right font-bold">Total Value (Sale)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {['R', 'L', '—'].map(eye => {
                                                        const eyeData = reportData.filter(r => (r.eye || '—') === eye);
                                                        if (eyeData.length === 0) return null;
                                                        const totalQty = eyeData.reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0);
                                                        const totalValue = eyeData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.sPrice) || 0)), 0);

                                                        return (
                                                            <tr key={eye} className="hover:bg-blue-50 transition-colors">
                                                                <td className="px-4 py-2 border border-slate-200 font-semibold text-slate-700">
                                                                    {eye === 'R' ? '👁️ Right' : eye === 'L' ? '👁️ Left' : 'Not Specified'}
                                                                </td>
                                                                <td className="px-4 py-2 border border-slate-200 text-center text-slate-700">{eyeData.length}</td>
                                                                <td className="px-4 py-2 border border-slate-200 text-center font-bold text-green-700">{totalQty}</td>
                                                                <td className="px-4 py-2 border border-slate-200 text-right font-semibold text-blue-700 bg-blue-50">
                                                                    ₹{totalValue.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="bg-blue-800 text-white font-bold sticky bottom-0">
                                                        <td colSpan="2" className="px-4 py-2 border border-blue-500 text-right">Grand Total</td>
                                                        <td className="px-4 py-2 border border-blue-500 text-center">{reportData.reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0)}</td>
                                                        <td className="px-4 py-2 border border-blue-500 text-right">
                                                            ₹{reportData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.sPrice) || 0)), 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Group Summary Tab */}
                                    {activeTab === 'detail' && (
                                        <div className="overflow-x-auto p-4">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="sticky top-0 z-10 bg-purple-600 text-white">
                                                    <tr>
                                                        <th className="px-4 py-2 border border-purple-500 text-left font-bold">Group Name</th>
                                                        <th className="px-4 py-2 border border-purple-500 text-center font-bold">Items</th>
                                                        <th className="px-4 py-2 border border-purple-500 text-center font-bold">Total Qty</th>
                                                        <th className="px-4 py-2 border border-purple-500 text-right font-bold">Pur Value</th>
                                                        <th className="px-4 py-2 border border-purple-500 text-right font-bold">Sale Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {[...new Set(reportData.map(r => r.groupName))].sort().map(groupName => {
                                                        const groupData = reportData.filter(r => r.groupName === groupName);
                                                        const totalQty = groupData.reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0);
                                                        const purValue = groupData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.pPrice) || 0)), 0);
                                                        const saleValue = groupData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.sPrice) || 0)), 0);

                                                        return (
                                                            <tr key={groupName} className="hover:bg-purple-50 transition-colors">
                                                                <td className="px-4 py-2 border border-slate-200 font-semibold text-slate-700">{groupName}</td>
                                                                <td className="px-4 py-2 border border-slate-200 text-center text-slate-700">{groupData.length}</td>
                                                                <td className="px-4 py-2 border border-slate-200 text-center font-bold text-green-700">{totalQty}</td>
                                                                <td className="px-4 py-2 border border-slate-200 text-right font-semibold text-slate-700">₹{purValue.toFixed(2)}</td>
                                                                <td className="px-4 py-2 border border-slate-200 text-right font-semibold text-purple-700 bg-purple-50">₹{saleValue.toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="bg-purple-800 text-white font-bold sticky bottom-0">
                                                        <td colSpan="2" className="px-4 py-2 border border-purple-500 text-right">Total</td>
                                                        <td className="px-4 py-2 border border-purple-500 text-center">{reportData.reduce((sum, r) => sum + (parseInt(r.currentStock) || 0), 0)}</td>
                                                        <td className="px-4 py-2 border border-purple-500 text-right">
                                                            ₹{reportData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.pPrice) || 0)), 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-2 border border-purple-500 text-right">
                                                            ₹{reportData.reduce((sum, r) => sum + ((parseFloat(r.currentStock) || 0) * (parseFloat(r.sPrice) || 0)), 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
