import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    Download,
    Filter,
    TrendingUp,
    TrendingDown,
    AlertCircle
} from 'lucide-react';
import { getProfitAndLossReport, getParentGroups } from '../controllers/Reports.controller';
import { getAllLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function ProfitAndLossBook() {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [parentGroups, setParentGroups] = useState([]);
    const [allLenses, setAllLenses] = useState([]);
    const groupInputRef = useRef(null);
    const productInputRef = useRef(null);
    const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);

    const [summary, setSummary] = useState({
        totalPurchaseAmount: 0,
        totalSaleAmount: 0,
        totalProfitLoss: 0,
        totalItems: 0,
        profitableItems: 0,
        lossItems: 0
    });

    const [filters, setFilters] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        groupName: '',
        productName: '',
        includeStockOutflow: false,
        searchText: ''
    });

    // Fetch all parent groups and items on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch parent groups
                const groupRes = await getParentGroups();
                if (groupRes.success) {
                    setParentGroups(groupRes.data || []);
                }

                // Fetch all lens products
                const res = await getAllLensPower();
                const dataArr = res?.data ?? res;
                
                // Extract all unique product names from groups
                if (Array.isArray(dataArr)) {
                    const allProducts = new Set();
                    dataArr.forEach(group => {
                        if (group.productName) {
                            allProducts.add(group.productName);
                        }
                    });
                    setAllLenses(Array.from(allProducts).map(name => ({ productName: name })));
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
        fetchData();
    }, []);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (groupInputRef.current && !groupInputRef.current.contains(e.target)) {
                setShowGroupSuggestions(false);
            }
            if (productInputRef.current && !productInputRef.current.contains(e.target)) {
                setShowProductSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get filtered group suggestions
    const getGroupSuggestions = () => {
        const query = filters.groupName.toLowerCase().trim();
        if (!query) return parentGroups.slice(0, 10);
        return parentGroups.filter(group =>
            group.toLowerCase().includes(query)
        ).slice(0, 10);
    };

    // Get filtered product suggestions
    const getProductSuggestions = () => {
        const query = filters.searchText.toLowerCase().trim();
        if (!query) return allLenses.slice(0, 10);
        return allLenses.filter(lens =>
            (lens.productName || '').toLowerCase().includes(query)
        ).slice(0, 10);
    };

    const selectGroup = (group) => {
        setFilters(prev => ({ ...prev, groupName: group }));
        setShowGroupSuggestions(false);
    };

    const selectProduct = (product) => {
        setFilters(prev => ({ ...prev, searchText: product.productName }));
        setShowProductSuggestions(false);
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getProfitAndLossReport(filters);
            
            if (res.success) {
                setReportData(res.data.reportData || []);
                setSummary(res.data.summary || {
                    totalPurchaseAmount: 0,
                    totalSaleAmount: 0,
                    totalProfitLoss: 0,
                    totalItems: 0,
                    profitableItems: 0,
                    lossItems: 0
                });
                toast.success('Report generated successfully');
            } else {
                toast.error(res.message || 'Failed to fetch report');
            }
        } catch (error) {
            console.error('Error fetching profit and loss report:', error);
            toast.error('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            groupName: '',
            productName: '',
            includeStockOutflow: false,
            searchText: ''
        });
        setReportData([]);
        setSummary({
            totalPurchaseAmount: 0,
            totalSaleAmount: 0,
            totalProfitLoss: 0,
            totalItems: 0,
            profitableItems: 0,
            lossItems: 0
        });
    };

    const handleExportCSV = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        const csvData = reportData.map((item, idx) => ({
            'S.No': idx + 1,
            'Group Name': item.groupName,
            'Product Name': item.itemName,
            'Stock Out Qty': item.stokOutQty,
            'Pur Price': item.itemWiseProfit.purPrice,
            'Sal Price': item.itemWiseProfit.salPrice,
            'Tot. Pur Price': item.itemWiseProfit.totPurPrice,
            'Tot. Sal Price': item.itemWiseProfit.totSalPrice,
            'Profit/Loss': item.itemWiseProfit.profitLoss
        }));

        const csv = Papa.unparse(csvData);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = `profit_loss_report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Report exported to CSV');
    };

    const handlePrint = () => {
        if (reportData.length === 0) {
            toast.error('No data to print');
            return;
        }
        window.print();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-8 h-8 text-green-600" />
                        Item Wise Profit And Loss Book
                    </h1>

                    {/* Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        {/* Date From */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                Date From
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                To
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Group Filter */}
                        <div className="relative" ref={groupInputRef}>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                Group
                            </label>
                            <input
                                type="text"
                                value={filters.groupName}
                                onChange={(e) => {
                                    handleFilterChange('groupName', e.target.value);
                                    setShowGroupSuggestions(true);
                                }}
                                onFocus={() => setShowGroupSuggestions(true)}
                                onKeyPress={handleKeyPress}
                                placeholder="Search group..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {showGroupSuggestions && getGroupSuggestions().length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                                    {getGroupSuggestions().map((group, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => selectGroup(group)}
                                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                                        >
                                            {group}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Product Search */}
                        <div className="relative" ref={productInputRef}>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                Search
                            </label>
                            <input
                                type="text"
                                value={filters.searchText}
                                onChange={(e) => {
                                    handleFilterChange('searchText', e.target.value);
                                    setShowProductSuggestions(true);
                                }}
                                onFocus={() => setShowProductSuggestions(true)}
                                onKeyPress={handleKeyPress}
                                placeholder="Search product..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {showProductSuggestions && getProductSuggestions().length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                                    {getProductSuggestions().map((product, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => selectProduct(product)}
                                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
                                        >
                                            {product.productName}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Checkboxes and Buttons */}
                    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.includeStockOutflow}
                                    onChange={(e) => handleFilterChange('includeStockOutflow', e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300"
                                />
                                Include Stock Outflow
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
                            >
                                <Search className="w-4 h-4" />
                                Search
                            </button>

                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>

                            <button
                                onClick={handleExportCSV}
                                disabled={reportData.length === 0}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                Excel
                            </button>

                            <button
                                onClick={handlePrint}
                                disabled={reportData.length === 0}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                {reportData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Purchase</p>
                            <p className="text-2xl font-bold text-slate-800">₹ {summary.totalPurchaseAmount.toFixed(2)}</p>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Sale</p>
                            <p className="text-2xl font-bold text-slate-800">₹ {summary.totalSaleAmount.toFixed(2)}</p>
                        </div>

                        <div className={`bg-white rounded-lg shadow p-4 ${summary.totalProfitLoss >= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Profit/Loss</p>
                            <p className={`text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹ {summary.totalProfitLoss.toFixed(2)}
                            </p>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Items</p>
                            <p className="text-2xl font-bold text-slate-800">{summary.totalItems}</p>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-l-green-500">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Profitable Items</p>
                            <p className="text-2xl font-bold text-green-600">{summary.profitableItems}</p>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-l-red-500">
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Loss Items</p>
                            <p className="text-2xl font-bold text-red-600">{summary.lossItems}</p>
                        </div>
                    </div>
                )}

                {/* Table Section */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                            <p className="mt-4 text-slate-600">Loading report...</p>
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="p-8 text-center">
                            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                            <p className="text-slate-500">Click "Search" to generate the report</p>
                        </div>
                    ) : (
                        <div className="print-table-only">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-blue-500 text-white sticky top-0">
                                        <th className="px-4 py-3 text-left font-semibold">S.No</th>
                                        <th className="px-4 py-3 text-left font-semibold">Group Name</th>
                                        <th className="px-4 py-3 text-left font-semibold">Product Name</th>
                                        <th className="px-4 py-3 text-center font-semibold">Stk Out Qty</th>
                                        <th colSpan="5" className="px-4 py-3 text-center font-semibold bg-opacity-90 bg-blue-600">Item Wise Profit</th>
                                        <th colSpan="4" className="px-4 py-3 text-center font-semibold bg-opacity-90 bg-blue-600">Terms Wise Profit</th>
                                    </tr>
                                    <tr className="bg-slate-100 text-slate-700 sticky top-12">
                                        <th className="px-4 py-2"></th>
                                        <th className="px-4 py-2"></th>
                                        <th className="px-4 py-2"></th>
                                        <th className="px-4 py-2"></th>
                                        <th className="px-4 py-2 text-center text-xs">Pur Price</th>
                                        <th className="px-4 py-2 text-center text-xs">Sal Price</th>
                                        <th className="px-4 py-2 text-center text-xs">Tot. Pur Price</th>
                                        <th className="px-4 py-2 text-center text-xs">Tot. Sal Price</th>
                                        <th className="px-4 py-2 text-center text-xs font-bold">Profit/Loss</th>
                                        <th className="px-4 py-2 text-center text-xs">Pur Price</th>
                                        <th className="px-4 py-2 text-center text-xs">Sal Price</th>
                                        <th className="px-4 py-2 text-center text-xs">Tot. Pur Price</th>
                                        <th className="px-4 py-2 text-center text-xs">Tot. Sal Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.map((item, idx) => (
                                        <tr key={idx} className={`border-b border-slate-200 hover:bg-slate-50 transition ${item.itemWiseProfit.profitLoss >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                            <td className="px-4 py-3 font-medium text-slate-700">{idx + 1}</td>
                                            <td className="px-4 py-3 text-slate-700">{item.groupName}</td>
                                            <td className="px-4 py-3 text-slate-700 font-medium">{item.itemName}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.stokOutQty.toFixed(2)}</td>
                                            
                                            {/* Item Wise Profit */}
                                            <td className="px-4 py-3 text-center text-slate-700">{item.itemWiseProfit.purPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.itemWiseProfit.salPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.itemWiseProfit.totPurPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.itemWiseProfit.totSalPrice.toFixed(2)}</td>
                                            <td className={`px-4 py-3 text-center font-bold ${item.itemWiseProfit.profitLoss >= 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                                                {item.itemWiseProfit.profitLoss.toFixed(2)}
                                            </td>

                                            {/* Terms Wise Profit */}
                                            <td className="px-4 py-3 text-center text-slate-700">{item.termsWiseProfit.purPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.termsWiseProfit.salPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.termsWiseProfit.totPurPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center text-slate-700">{item.termsWiseProfit.totSalPrice.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                {reportData.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-slate-600">
                            <span className="font-semibold">Total Records:</span> {reportData.length} | 
                            <span className="font-semibold ml-3">Period:</span> {filters.dateFrom} to {filters.dateTo}
                        </p>
                    </div>
                )}
            </div>

            {/* Print Styles */}
            <style>{`
  @media print {
    * {
      margin: 0;
      padding: 0;
    }

    body {
      background: white;
    }

    .no-print {
      display: none !important;
    }

    /* Hide sidebar */
    nav,
    aside,
    .sidebar {
      display: none !important;
    }

    /* Hide date and time */
    time,
    [role="time"],
    .date-time,
    .timestamp {
      display: none !important;
    }

    /* Hide header/logo */
    header,
    .header,
    .logo,
    .store-name {
      display: none !important;
    }

    .max-w-7xl {
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* Hide all sections except table */
    .bg-white.rounded-lg.shadow-md.p-4.mb-6 {
      display: none !important;
    }

    .grid.grid-cols-1.md\\:grid-cols-2 {
      display: none !important;
    }

    .mt-4.p-4.bg-blue-50 {
      display: none !important;
    }

    /* Style the table for print */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 11px !important;
    }

    thead {
      background-color: #2563eb !important;
      color: white !important;
    }

    th,
    td {
      border: 1px solid #e2e8f0 !important;
      padding: 8px !important;
      text-align: left !important;
    }

    tbody tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }

    .bg-green-50 {
      background-color: #f0fdf4 !important;
    }

    .bg-red-50 {
      background-color: #fef2f2 !important;
    }

    .bg-green-100 {
      background-color: #dcfce7 !important;
    }

    .bg-red-100 {
      background-color: #fee2e2 !important;
    }

    .text-green-700 {
      color: #15803d !important;
    }

    .text-red-700 {
      color: #b91c1c !important;
    }

    .bg-blue-50 {
      display: none !important;
    }

    .bg-gradient-to-br {
      background: white !important;
    }

    .sticky {
      position: static !important;
    }

    /* Hide scroll behavior */
    .overflow-x-auto {
      overflow: visible !important;
    }

    /* Hide entire page margins and extras */
    @page {
      margin: 0.5cm !important;
    }
  }
`}</style>

        </div>
    );
}
