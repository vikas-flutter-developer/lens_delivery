import React, { useState, useEffect } from 'react';
import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    ChevronDown,
    Eye,
    Package,
    RefreshCw,
    Calendar,
    Users,
    Filter,
    Columns,
    FileText,
} from 'lucide-react';
import { getPartyWiseItemReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllAccounts } from '../controllers/Account.controller';
import { getAllLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';

export default function PartyWiseItemReport() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [items, setItems] = useState([]);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [showTransTypeSelector, setShowTransTypeSelector] = useState(false);
    const [marginUnit, setMarginUnit] = useState('price'); // 'price' or 'percent'
    const [lensMasterMap, setLensMasterMap] = useState({});

    // Suggestion states
    const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
    const [showCustSuggestions, setShowCustSuggestions] = useState(false);
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
    const [activeGroupIdx, setActiveGroupIdx] = useState(-1);
    const [activeCustIdx, setActiveCustIdx] = useState(-1);
    const [activeSearchIdx, setActiveSearchIdx] = useState(-1);

    // Get default date range (current month)
    const getDefaultDates = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const formatDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        return {
            dateFrom: formatDate(firstDay),
            dateTo: formatDate(lastDay),
        };
    };

    const defaultDates = getDefaultDates();

    const [filters, setFilters] = useState({
        dateFrom: defaultDates.dateFrom,
        dateTo: defaultDates.dateTo,
        transType: ['Sale'],
        groupName: '',
        customerName: '',
        searchText: '',
    });

    // Column visibility state
    const [visibleColumns, setVisibleColumns] = useState({
        sNo: true,
        transType: true,
        vchSeries: true,
        vchNo: true,
        vchDate: true,
        partyName: true,
        mobNo: true,
        barcode: true,
        productName: true,
        bookedBy: true,
        dia: true,
        eye: true,
        sph: true,
        cyl: true,
        axis: true,
        add: true,
        qty: true,
        loc: true,
        pricePerUnit: true,
        totalPrice: true,
        productMargin: true,
        remark: false,
    });

    const columnLabels = {
        sNo: 'SNo',
        transType: 'Trans Type',
        vchSeries: 'Vch Series',
        vchNo: 'Vch No',
        vchDate: 'Vch Date',
        partyName: 'Party Name',
        bookedBy: 'Booked By',
        mobNo: 'Mob.No',
        barcode: 'Barcode',
        productName: 'Product Name',
        dia: 'DIA',
        lensPower: 'Lens Power',
        qty: 'Qty',
        loc: 'LOC',
        pricePerUnit: 'Price/Unit',
        totalPrice: 'Total Price',
        productMargin: 'Product Margin',
        remark: 'Remarks',
    };

    const transactionTypes = [
        'All',
        'Sale',
        'Sale Order',
        'Sale Challan',
        'Sale Return',
        'Purchase',
        'Purchase Order',
        'Purchase Challan',
        'Purchase Return',
        'Rx Sale Order',
        'Rx Purchase Order',
        'Contact Lens & Sol Sale Order',
        'Contact Lens & Sol Purchase Order',
        'Product Exchange',
        'Damage & Shrinkage',
        'Cancelled',
    ];

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [groupRes, accountRes, itemRes] = await Promise.all([
                getAllGroups(),
                getAllAccounts(),
                getAllLensPower()
            ]);
            setGroups(groupRes.groups || []);
            setAccounts(Array.isArray(accountRes) ? accountRes : accountRes.data || []);
            const itemData = itemRes?.data ?? itemRes;
            setItems(Array.isArray(itemData) ? itemData : []);

            // Build lens master map for margin calculation
            if (itemRes?.success && Array.isArray(itemRes.data)) {
                const map = {};
                itemRes.data.forEach((group) => {
                    if (group.addGroups) {
                        group.addGroups.forEach((ag) => {
                            if (ag.combinations) {
                                ag.combinations.forEach((comb) => {
                                    if (comb._id) {
                                        map[String(comb._id)] = Number(comb.pPrice) || 0;
                                    }
                                });
                            }
                        });
                    }
                });
                setLensMasterMap(map);
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            setReportData([]); // Clear old data to prevent mixing
            const res = await getPartyWiseItemReport(filters);
            if (res.success) {
                setReportData(res.data);
                if (res.data.length === 0) {
                    toast.info('No records found for the selected filters');
                }
            }
        } catch (error) {
            toast.error('Failed to fetch report data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        const defaultDates = getDefaultDates();
        setFilters({
            dateFrom: defaultDates.dateFrom,
            dateTo: defaultDates.dateTo,
            transType: ['Sale'],
            groupName: '',
            customerName: '',
            searchText: '',
        });
        setReportData([]);
    };

    const handleExport = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        // Create CSV content
        const visibleCols = Object.entries(visibleColumns)
            .filter(([_, visible]) => visible)
            .map(([key]) => key);

        const headers = visibleCols.map(col => columnLabels[col]).join(',');
        const rows = reportData.map(row =>
            visibleCols.map(col => {
                const value = row[col];
                if (col === 'productMargin') {
                    const cost = Number(row.purchasePrice || 0) || lensMasterMap[row.combinationId] || 0;
                    const totalCost = cost * (Number(row.qty) || 0);
                    const margin = (Number(row.totalPrice) || 0) - totalCost;
                    if (marginUnit === 'percent') {
                        return (row.totalPrice > 0 ? (margin / row.totalPrice) * 100 : 0).toFixed(2) + '%';
                    }
                    return margin.toFixed(2);
                }
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value ?? '';
            }).join(',')
        ).join('\n');

        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PartyWiseItemReport_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Report exported successfully!');
    };

    const handlePrint = () => {
        if (displayData.length === 0) {
            toast.error('No data to print');
            return;
        }

        const activeCols = Object.entries(visibleColumns)
            .filter(([_, visible]) => visible)
            .map(([key]) => ({ key, label: columnLabels[key] }));

        const headerHtml = activeCols.map(col => `<th>${col.label}</th>`).join('');
        const rowHtml = displayData.map((row, idx) => `
            <tr>
                ${activeCols.map(col => {
            let val = row[col.key] ?? '—';
            if (col.key === 'totalPrice' || col.key === 'pricePerUnit') {
                val = (parseFloat(val) || 0).toFixed(2);
            }
            if (col.key === 'productMargin') {
                const cost = Number(row.purchasePrice || 0) || lensMasterMap[row.combinationId] || 0;
                const totalCost = cost * (Number(row.qty) || 0);
                const margin = (Number(row.totalPrice) || 0) - totalCost;
                if (marginUnit === 'percent') {
                    val = (row.totalPrice > 0 ? (margin / row.totalPrice) * 100 : 0).toFixed(2) + '%';
                } else {
                    val = margin.toFixed(2);
                }
            }
            return `<td style="${col.key === 'totalPrice' || col.key === 'pricePerUnit' || col.key === 'productMargin' ? 'text-align:right;' : col.key === 'sNo' || col.key === 'qty' || col.key === 'loc' ? 'text-align:center;' : ''}">${val}</td>`;
        }).join('')}
            </tr>
        `).join('');

        const footerHtml = `
            <tr style="font-weight:bold; background:#f1f5f9;">
                ${activeCols.map((col, idx) => {
            if (idx === 0) return `<td>Total</td>`;
            if (col.key === 'qty') return `<td style="text-align:center;">${totals.qty}</td>`;
            if (col.key === 'totalPrice') return `<td style="text-align:right;">₹${totals.totalPrice.toFixed(2)}</td>`;
            if (col.key === 'productMargin') {
                if (marginUnit === 'percent') {
                    const avgMarginPercent = totals.totalPrice > 0 ? (totals.totalMargin / totals.totalPrice) * 100 : 0;
                    return `<td style="text-align:right;">${avgMarginPercent.toFixed(2)}%</td>`;
                }
                return `<td style="text-align:right;">₹${totals.totalMargin.toFixed(2)}</td>`;
            }
            return `<td></td>`;
        }).join('')}
            </tr>
        `;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Party Wise Item Report</title>
                <style>
                    body { font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
                    .title { font-size: 24px; font-weight: 800; text-transform: uppercase; margin: 0; }
                    .info { font-size: 12px; color: #64748b; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                    th { background: #1e293b; color: white; padding: 10px 5px; text-align: left; border: 1px solid #1e293b; }
                    td { border: 1px solid #e2e8f0; padding: 8px 5px; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .totals-row { font-weight: bold; background: #f1f5f9 !important; }
                    @page { size: landscape; margin: 10mm; }
                </style>
            </head>
            <body>
                <div class="header">
                    <p class="title">Party Wise Item Report</p>
                    <div class="info">
                        Date Range: ${filters.dateFrom} to ${filters.dateTo} | 
                        Types: ${filters.transType.includes('All') ? 'All' : filters.transType.join(', ')} | 
                        Records: ${displayData.length}
                    </div>
                </div>
                <table>
                    <thead><tr>${headerHtml}</tr></thead>
                    <tbody>
                        ${rowHtml}
                        ${footerHtml}
                    </tbody>
                </table>
                <div style="margin-top:20px; text-align:right; font-size:10px; color:#94a3b8;">
                    Generated on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;

        const pw = window.open('', '_blank');
        pw.document.write(html);
        pw.document.close();
        pw.focus();
        setTimeout(() => {
            pw.print();
            // Optional: pw.close();
        }, 500);
    };

    const toggleColumn = (column) => {
        if (column === 'lensPower') {
            const nextValue = !visibleColumns.eye;
            setVisibleColumns(prev => ({
                ...prev,
                eye: nextValue,
                sph: nextValue,
                cyl: nextValue,
                axis: nextValue,
                add: nextValue
            }));
        } else {
            setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
        }
    };

    const getSelectedColumnsCount = () => {
        return Object.values(visibleColumns).filter(Boolean).length;
    };

    const handleViewTransaction = (row) => {
        // Navigate to the appropriate transaction view based on type
        const transTypeRoutes = {
            'Sale Invoice': '/lenstransaction/sale/AddLensSale/',
            'Sale Order': '/lenstransaction/sale/AddLensSaleOrder/',
            'Sale Challan': '/lenstransaction/sale/AddLensSaleChallan/',
            'Sale Return': '/lenstransaction/addsalereturn/',
            'Purchase Invoice': '/lenstransaction/purchase/AddLensPurchase/',
            'Purchase Order': '/lenstransaction/purchase/AddLensPurchaseOrder/',
            'Purchase Challan': '/lenstransaction/purchase/AddLensPurchaseChallan/',
            'Purchase Return': '/lenstransaction/addpurchasereturn/',
            'Rx Sale Order': '/rxtransaction/rxorder/addrxorder/',
            'Rx Purchase Order': '/rxtransaction/rxpurchase/addRxPurchase/',
            'Contact Lens & Sol Sale Order': '/contactlens/sale/addcontactlensorder/',
            'Contact Lens & Sol Purchase Order': '/contactlens/purchase/addcontactlensorder/',
            'Damage': '/lenstransaction/adddamageentry/',
            'Shrinkage': '/lenstransaction/adddamageentry/',
            'Product Exchange': '/add/addproductexchange/',
        };
        const route = transTypeRoutes[row.transType];
        if (route && row.docId) {
            window.open(`${route}${row.docId}`, '_blank');
        }
    };

    // Map frontend filter labels to backend doc transType values
    const typeLabelMap = {
        'Sale': 'Sale Invoice',
        'Sale Order': 'Sale Order',
        'Sale Challan': 'Sale Challan',
        'Sale Return': 'Sale Return',
        'Purchase': 'Purchase Invoice',
        'Purchase Order': 'Purchase Order',
        'Purchase Challan': 'Purchase Challan',
        'Purchase Return': 'Purchase Return',
        'Rx Sale Order': 'Rx Sale Order',
        'Rx Purchase Order': 'Rx Purchase Order',
        'Contact Lens & Sol Sale Order': 'Contact Lens & Sol Sale Order',
        'Contact Lens & Sol Purchase Order': 'Contact Lens & Sol Purchase Order',
        'Product Exchange': 'Product Exchange',
        'Damage & Shrinkage': 'Damage & Shrinkage',
        'Damage': 'Damage',
        'Shrinkage': 'Shrinkage',
        'Cancelled': 'Cancelled'
    };

    // Filter report data in frontend for immediate feedback and consistency
    const displayData = React.useMemo(() => {
        if (!reportData || reportData.length === 0) return [];
        if (filters.transType.includes('All')) return reportData;

        const selectedBackendTypes = filters.transType.reduce((acc, t) => {
            if (t === 'Damage & Shrinkage') {
                acc.push('Damage', 'Shrinkage', 'Damage & Shrinkage');
            } else if (t === 'Cancelled') {
                acc.push(
                    'Cancelled Sale Order', 
                    'Cancelled Purchase Order', 
                    'Cancelled Rx Sale Order', 
                    'Cancelled Rx Purchase Order',
                    'Cancelled CL Sale Order', 
                    'Cancelled CL Purchase Order',
                    'Cancelled Sale Invoice', 
                    'Cancelled Purchase Invoice',
                    'Cancelled Rx Sale', 
                    'Cancelled Rx Purchase',
                    'Cancelled Sale Challan',
                    'Cancelled Purchase Challan'
                );
            } else {
                acc.push(typeLabelMap[t] || t);
            }
            return acc;
        }, []);
        return reportData.filter(row => selectedBackendTypes.includes(row.transType));
    }, [reportData, filters.transType]);

    // Calculate totals based on filtered display data
    const totals = React.useMemo(() => {
        return displayData.reduce((acc, r) => {
            const qty = parseFloat(r.qty) || 0;
            const totalPrice = parseFloat(r.totalPrice) || 0;
            const cost = Number(r.purchasePrice || 0) || lensMasterMap[r.combinationId] || 0;
            const totalCost = cost * qty;
            const margin = totalPrice - totalCost;

            acc.qty += qty;
            acc.totalPrice += totalPrice;
            acc.totalMargin += margin;
            return acc;
        }, { qty: 0, totalPrice: 0, totalMargin: 0 });
    }, [displayData, lensMasterMap]);

    return (
        <div className="min-h-screen text-black bg-slate-50 p-4 md:p-6 print:p-0 print:min-h-0 print:bg-white">
            <div className="max-w-[1800px] mx-auto">
                {/* Header */}
                <div className="bg-gray-50 rounded-t-xl px-6 py-4 flex items-center justify-between print:hidden">
                    <h1 className="text-xl font-bold text-black flex items-center gap-2">
                        <FileText className="w-6 h-6" />
                        Party Wise Item Report
                    </h1>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-sm rounded hover:bg-emerald-600 transition shadow-sm"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="bg-zinc-100  rounded-xl mb-10 px-4 py-3 print:hidden">
                    <div className="flex flex-wrap items-end gap-3">
                        {/* Date From */}
                        <div className="flex flex-col">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">Date From</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                    className="w-32 px-2 py-1.5 border border-blue-400 rounded bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
                                />
                            </div>
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">To</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                    className="w-32 px-2 py-1.5 border border-blue-400 rounded bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
                                />
                            </div>
                        </div>

                        {/* Trans Type */}
                        <div className="flex flex-col relative">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">Trans Type</label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowTransTypeSelector(!showTransTypeSelector)}
                                    className="w-44 px-2 py-1.5 flex items-center justify-between border border-blue-400 rounded bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none cursor-pointer"
                                >
                                    <span className="truncate">
                                        {filters.transType.length === 0
                                            ? 'None'
                                            : filters.transType.includes('All')
                                                ? 'All Types'
                                                : filters.transType.join(', ')}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none" />
                                </button>

                                {showTransTypeSelector && (
                                    <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-[70] max-h-64 overflow-y-auto">
                                        <div className="p-2">
                                            {transactionTypes.map(type => (
                                                <label key={type} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.transType.includes(type)}
                                                        onChange={(e) => {
                                                            let newTypes;
                                                            if (type === 'All') {
                                                                newTypes = e.target.checked ? ['All'] : [];
                                                            } else {
                                                                newTypes = filters.transType.filter(t => t !== 'All');
                                                                if (e.target.checked) {
                                                                    newTypes.push(type);
                                                                } else {
                                                                    newTypes = newTypes.filter(t => t !== type);
                                                                }
                                                                if (newTypes.length === transactionTypes.length - 1) {
                                                                    newTypes = ['All'];
                                                                }
                                                            }
                                                            handleFilterChange('transType', newTypes);
                                                        }}
                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Group */}
                        <div className="flex flex-col relative">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">Group</label>
                            <input
                                type="text"
                                value={filters.groupName}
                                onChange={(e) => {
                                    handleFilterChange('groupName', e.target.value);
                                    setShowGroupSuggestions(true);
                                }}
                                onFocus={() => setShowGroupSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowGroupSuggestions(false), 200)}
                                placeholder="Group..."
                                className="w-28 px-2 py-1.5 border border-blue-400 rounded bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
                            />
                            {showGroupSuggestions && groups.filter(g => g.groupName.toLowerCase().includes(filters.groupName.toLowerCase())).length > 0 && (
                                <div className="absolute top-full left-0 w-48 bg-white mt-1 rounded shadow-lg border border-slate-200 z-[60] max-h-48 overflow-y-auto">
                                    {groups.filter(g => g.groupName.toLowerCase().includes(filters.groupName.toLowerCase())).map((group, idx) => (
                                        <div
                                            key={group._id || idx}
                                            onMouseDown={() => {
                                                handleFilterChange('groupName', group.groupName);
                                                setShowGroupSuggestions(false);
                                            }}
                                            className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0"
                                        >
                                            {group.groupName}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Customer Name */}
                        <div className="flex flex-col relative">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">Custmr Name</label>
                            <input
                                type="text"
                                value={filters.customerName}
                                onChange={(e) => {
                                    handleFilterChange('customerName', e.target.value);
                                    setShowCustSuggestions(true);
                                }}
                                onFocus={() => setShowCustSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowCustSuggestions(false), 200)}
                                placeholder="Customer..."
                                className="w-36 px-2 py-1.5 border border-blue-400 rounded bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
                            />
                            {showCustSuggestions && accounts.filter(a => (a.Name || "").toLowerCase().includes(filters.customerName.toLowerCase())).length > 0 && (
                                <div className="absolute top-full left-0 w-64 bg-white mt-1 rounded shadow-lg border border-slate-200 z-[60] max-h-48 overflow-y-auto">
                                    {accounts.filter(a => (a.Name || "").toLowerCase().includes(filters.customerName.toLowerCase())).map((acc, idx) => (
                                        <div
                                            key={acc._id || idx}
                                            onMouseDown={() => {
                                                handleFilterChange('customerName', acc.Name);
                                                setShowCustSuggestions(false);
                                            }}
                                            className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                        >
                                            <span className="font-medium">{acc.Name}</span>
                                            {acc.MobileNumber && <span className="text-[10px] text-slate-400">{acc.MobileNumber}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Search Text */}
                        <div className="flex flex-col relative">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">Search Text</label>
                            <input
                                type="text"
                                value={filters.searchText}
                                onChange={(e) => {
                                    handleFilterChange('searchText', e.target.value);
                                    setShowSearchSuggestions(true);
                                }}
                                onFocus={() => setShowSearchSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                                placeholder="Search..."
                                className="w-32 px-2 py-1.5 border border-blue-400 rounded bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300 outline-none"
                            />
                            {showSearchSuggestions && items.filter(i =>
                                (i.productName || "").toLowerCase().includes(filters.searchText.toLowerCase()) ||
                                (i.barcode || "").toLowerCase().includes(filters.searchText.toLowerCase())
                            ).length > 0 && filters.searchText.length > 0 && (
                                    <div className="absolute top-full left-0 w-64 bg-white mt-1 rounded shadow-lg border border-slate-200 z-[60] max-h-48 overflow-y-auto">
                                        {items.filter(i =>
                                            (i.productName || "").toLowerCase().includes(filters.searchText.toLowerCase()) ||
                                            (i.barcode || "").toLowerCase().includes(filters.searchText.toLowerCase())
                                        ).slice(0, 50).map((item, idx) => (
                                            <div
                                                key={item._id || idx}
                                                onMouseDown={() => {
                                                    handleFilterChange('searchText', item.productName);
                                                    setShowSearchSuggestions(false);
                                                }}
                                                className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                            >
                                                <span className="font-medium">{item.productName}</span>
                                                {item.barcode && <span className="text-[10px] text-slate-400">Barcode: {item.barcode}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </div>

                        {/* Columns Selector */}
                        <div className="flex flex-col relative">
                            <label className="text-[10px] font-semibold text-black mb-0.5 uppercase tracking-wider">Columns</label>
                            <button
                                onClick={() => setShowColumnSelector(!showColumnSelector)}
                                className="flex items-center gap-1.5 px-2 py-1.5 border border-blue-400 rounded bg-white text-sm hover:bg-slate-50 transition"
                            >
                                <Columns className="w-4 h-4 text-slate-500" />
                                <span className="text-slate-600">{getSelectedColumnsCount()} selected</span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>

                            {showColumnSelector && (
                                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-64 overflow-y-auto">
                                    <div className="p-2">
                                        {Object.entries(columnLabels).map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={key === 'lensPower' ? visibleColumns.eye : visibleColumns[key]}
                                                    onChange={() => toggleColumn(key)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-slate-700">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 text-white text-sm font-semibold rounded hover:bg-green-600 transition shadow-sm disabled:bg-green-400"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4" />
                                )}
                                Search
                            </button>
                            <button
                                onClick={handleReset}
                                className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition border border-slate-300"
                                title="Reset Filters"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSearch}
                                className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition border border-blue-300"
                                title="Refresh"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Print-only Header */}
                <div className="hidden print:block mb-6 pt-4">
                    <h1 className="text-2xl font-bold text-center mb-4 uppercase text-black">Party Wise Item Report</h1>
                    <div className="flex justify-between items-center text-sm border-b-2 border-black pb-2 mb-4 font-semibold text-black">
                        <div>Date From: {filters.dateFrom}</div>
                        <div>Trans Type: {filters.transType.length === 0 ? 'None' : filters.transType.includes('All') ? 'All Types' : filters.transType.join(', ')}</div>
                        <div>To: {filters.dateTo}</div>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-b-xl shadow-md border border-slate-200 overflow-hidden print:shadow-none print:border-none print:overflow-visible">
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-sm text-left border-collapse min-w-max print:min-w-0 print:w-full">
                            <thead className="sticky top-0 z-10 print:static print:table-header-group">
                                <tr className="bg-blue-600 text-white print:bg-white print:text-black print:border-b-2 print:border-black text-xs uppercase tracking-wider font-bold">
                                    {visibleColumns.sNo && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-12">SNo</th>}
                                    {visibleColumns.transType && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 w-24">Trans Type</th>}
                                    {visibleColumns.vchSeries && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 w-24">Vch Series</th>}
                                    {visibleColumns.vchNo && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 w-16">Vch No</th>}
                                    {visibleColumns.vchDate && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 w-24">Vch Date</th>}
                                    {visibleColumns.partyName && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 min-w-[150px]">Party Name</th>}
                                    {visibleColumns.mobNo && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 w-28">Mob.No</th>}
                                    {visibleColumns.barcode && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 w-24">Barcode</th>}
                                    {visibleColumns.productName && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 min-w-[180px]">Product Name</th>}
                                    {visibleColumns.dia && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-12">DIA</th>}
                                    {visibleColumns.eye && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-10">EYE</th>}
                                    {visibleColumns.sph && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-14">SPH</th>}
                                    {visibleColumns.cyl && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-14">CYL</th>}
                                    {visibleColumns.axis && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-12">AXIS</th>}
                                    {visibleColumns.add && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-12">ADD</th>}
                                    {visibleColumns.qty && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-12">Qty</th>}
                                    {visibleColumns.loc && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-center w-24">LOC</th>}
                                    {visibleColumns.pricePerUnit && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-right w-20">Price/Unit</th>}
                                    {visibleColumns.totalPrice && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-right w-24">Total Price</th>}
                                    {visibleColumns.productMargin && (
                                        <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 text-right w-28 group/margin">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Margin</span>
                                                <button
                                                    onClick={() => setMarginUnit(marginUnit === 'price' ? 'percent' : 'price')}
                                                    className="p-1 hover:bg-blue-400 rounded transition-colors"
                                                    title={marginUnit === 'price' ? "Show Percentage" : "Show Price"}
                                                >
                                                    {marginUnit === 'price' ? '%' : '₹'}
                                                </button>
                                            </div>
                                        </th>
                                    )}
                                    {visibleColumns.remark && <th className="px-2 py-2.5 border-r border-blue-500 print:border-slate-300 min-w-[120px]">Remarks</th>}
                                    <th className="px-2 py-2.5 text-center w-20 print:hidden">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                                {displayData.length === 0 ? (
                                    <tr>
                                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-6 py-10 text-center text-slate-400 bg-slate-50">
                                            <div className="flex flex-col items-center gap-2">
                                                <Package className="w-12 h-12 text-slate-300" />
                                                <span className="text-lg font-medium">No records found</span>
                                                <span className="text-xs">Use the filters above and click Search to view data</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    displayData.map((row, index) => (
                                        <tr key={`${row.docId}_${index}`} className="hover:bg-blue-50 transition-colors group">
                                            {visibleColumns.sNo && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-500 tabular-nums">{row.sNo}</td>
                                            )}
                                            {visibleColumns.transType && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-slate-600 text-xs">{row.transType}</td>
                                            )}
                                            {visibleColumns.vchSeries && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-slate-600 font-mono text-xs">{row.vchSeries}</td>
                                            )}
                                            {visibleColumns.vchNo && (
                                                <td className="px-2 py-2 border-r border-slate-100 print:text-black text-blue-600 font-semibold">{row.vchNo}</td>
                                            )}
                                            {visibleColumns.vchDate && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-slate-600 text-xs">{row.vchDate}</td>
                                            )}
                                            {visibleColumns.partyName && (
                                                <td className="px-2 py-2 border-r border-slate-100 font-medium text-slate-700 truncate max-w-[200px]" title={row.partyName}>
                                                    {row.partyName}
                                                </td>
                                            )}
                                            {visibleColumns.mobNo && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-slate-600 font-mono text-xs">{row.mobNo}</td>
                                            )}
                                            {visibleColumns.barcode && (
                                                <td className="px-2 py-2 border-r border-slate-100 print:text-black text-blue-600 font-mono text-xs">{row.barcode || '—'}</td>
                                            )}
                                            {visibleColumns.productName && (
                                                <td className="px-2 py-2 border-r border-slate-100 font-medium text-slate-700 truncate max-w-[220px]" title={row.productName}>
                                                    {row.productName}
                                                </td>
                                            )}
                                            {visibleColumns.dia && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-600">{row.dia || '—'}</td>
                                            )}
                                            {visibleColumns.eye && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center">
                                                    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${row.eye === 'R' ? 'bg-green-100 text-green-700' : row.eye === 'L' ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>
                                                        {row.eye || '—'}
                                                    </span>
                                                </td>
                                            )}
                                            {visibleColumns.sph && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center font-bold text-slate-800">
                                                    {parseFloat(row.sph).toFixed(2)}
                                                </td>
                                            )}
                                            {visibleColumns.cyl && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center font-bold text-slate-800">
                                                    {parseFloat(row.cyl).toFixed(2)}
                                                </td>
                                            )}
                                            {visibleColumns.axis && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-600">{row.axis || 0}</td>
                                            )}
                                            {visibleColumns.add && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center font-bold text-slate-800">
                                                    {parseFloat(row.add).toFixed(2)}
                                                </td>
                                            )}
                                            {visibleColumns.qty && (
                                                <td className={`px-2 py-2 border-r border-slate-100 text-center font-bold ${row.qty > 0 ? 'text-green-600 print:text-black' : 'text-red-600 print:text-black'}`}>
                                                    {row.qty}
                                                </td>
                                            )}
                                            {visibleColumns.loc && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-center text-xs text-slate-600 italic">
                                                    {row.loc || '—'}
                                                </td>
                                            )}
                                            {visibleColumns.pricePerUnit && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-right font-medium text-slate-600">
                                                    {(parseFloat(row.pricePerUnit) || 0).toFixed(2)}
                                                </td>
                                            )}
                                            {visibleColumns.totalPrice && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-right font-bold text-blue-800 print:text-black print:bg-white bg-blue-50">
                                                    {(parseFloat(row.totalPrice) || 0).toFixed(2)}
                                                </td>
                                            )}
                                            {visibleColumns.productMargin && (
                                                <td className={`px-2 py-2 border-r border-slate-100 text-right font-bold bg-emerald-50/50`}>
                                                    {(() => {
                                                        const cost = Number(row.purchasePrice || 0) || lensMasterMap[row.combinationId] || 0;
                                                        const totalCost = cost * (Number(row.qty) || 0);
                                                        const margin = (Number(row.totalPrice) || 0) - totalCost;
                                                        const isNegative = margin < 0;
                                                        
                                                        if (marginUnit === 'percent') {
                                                            const percent = row.totalPrice > 0 ? (margin / row.totalPrice) * 100 : 0;
                                                            return (
                                                                <span className={isNegative ? 'text-red-600' : 'text-emerald-700'}>
                                                                    {percent.toFixed(2)}%
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className={isNegative ? 'text-red-600' : 'text-emerald-700'}>
                                                                {margin.toFixed(2)}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            )}
                                            {visibleColumns.remark && (
                                                <td className="px-2 py-2 border-r border-slate-100 text-slate-500 text-xs truncate max-w-[120px]" title={row.remark}>
                                                    {row.remark || '—'}
                                                </td>
                                            )}
                                            <td className="px-2 py-2 text-center print:hidden">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleViewTransaction(row)}
                                                        className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition"
                                                        title="View Transaction"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                                                        title="Transport"
                                                    >
                                                        Trsp
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {displayData.length > 0 && (
                                <tfoot className="sticky bottom-0 bg-gray-600 text-white font-bold print:static print:table-footer-group print:bg-white print:text-black print:border-t-2 print:border-slate-800">
                                    <tr>
                                        <td colSpan={visibleColumns.sNo ? 1 : 0} className="px-2 py-2.5"></td>
                                        {visibleColumns.transType && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.vchSeries && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.vchNo && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.vchDate && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.partyName && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.mobNo && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.barcode && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.productName && <td className="px-2 py-2.5 text-right uppercase tracking-widest text-xs">Grand Total</td>}
                                        {visibleColumns.dia && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.eye && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.sph && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.cyl && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.axis && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.add && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.qty && (
                                            <td className="px-2 py-2.5 text-center text-yellow-300 print:text-black text-lg">
                                                {totals.qty}
                                            </td>
                                        )}
                                        {visibleColumns.loc && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.pricePerUnit && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.totalPrice && (
                                            <td className="px-2 py-2.5 text-right text-green-300 print:text-black text-base">
                                                ₹{totals.totalPrice.toFixed(2)}
                                            </td>
                                        )}
                                        {visibleColumns.productMargin && (
                                            <td className="px-2 py-2.5 text-right text-yellow-300 print:text-black text-base">
                                                {marginUnit === 'price' 
                                                    ? `₹${totals.totalMargin.toFixed(2)}`
                                                    : `${(totals.totalPrice > 0 ? (totals.totalMargin / totals.totalPrice) * 100 : 0).toFixed(2)}%`
                                                }
                                            </td>
                                        )}
                                        {visibleColumns.remark && <td className="px-2 py-2.5"></td>}
                                        <td className="px-2 py-2.5 print:hidden"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500 print:hidden">
                    <div className="flex items-center gap-2">
                        <span className="font-medium">Total Records:</span>
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">{displayData.length}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                        Date Range: {filters.dateFrom} to {filters.dateTo} | Transaction Type: {Array.isArray(filters.transType) ? filters.transType.join(', ') : filters.transType}
                    </div>
                </div>
            </div>

            {/* Click outside to close selectors */}
            {(showColumnSelector || showTransTypeSelector) && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setShowColumnSelector(false);
                        setShowTransTypeSelector(false);
                    }}
                />
            )}
        </div>
    );
}
