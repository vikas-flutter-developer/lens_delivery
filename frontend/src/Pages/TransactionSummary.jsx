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
    Layout,
    ChevronDown,
    CheckSquare,
} from 'lucide-react';
import { getTransactionSummaryReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllItems } from '../controllers/itemcontroller';
import { getLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { roundAmount } from '../utils/amountUtils';


export default function TransactionSummary({ hideHeader = false }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);

    const [filters, setFilters] = useState({
        groupName: '',
        productName: '',
        transType: 'All',
        billSeries: '',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        bookedBy: '',
        searchText: ''
    });

    const transTypeOptions = [
        'All',
        'Sale Invoice',
        'Sale Return',
        'Sale Order',
        'Sale Challan',
        'Purchase Invoice',
        'Purchase Return',
        'Purchase Order',
        'Purchase Challan',
        'Damage and Shrinkage'
    ];

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
        { id: 'gstin', label: 'GSTIN', visible: true },
        { id: 'mobileNo', label: 'Mobile No', visible: true },
        { id: 'grossAmt', label: 'Gross Amt', visible: true },
        { id: 'paidAmt', label: 'Paid Amt', visible: true },
        { id: 'dueAmt', label: 'Due Amt', visible: true },
        { id: 'billType', label: 'Bill Type', visible: true },
        { id: 'mtrlCenter', label: 'Mtrl Center', visible: true },
        { id: 'usedIn', label: 'Used In', visible: true },
        { id: 'remark', label: 'Remark', visible: true },
        { id: 'status', label: 'Status', visible: true },
        { id: 'createdBy', label: 'CreatedBy', visible: true },
    ]);

    const [showColumnFilter, setShowColumnFilter] = useState(false);

    const toggleColumn = (id) => {
        setColumns(prev => prev.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
    };

    const isVisible = (id) => columns.find(c => d.id === id)?.visible !== false; // Fallback helper

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

    const filteredTransactions = React.useMemo(() => {
        if (!transactions) return [];
        return transactions.filter(doc => {
            if (selectedPG.sph.length > 0 || selectedPG.cyl.length > 0 || selectedPG.add.length > 0) {
                // Return true if AT LEAST ONE item in the transaction matches ALL active power group types
                return doc.items && doc.items.some(it => {
                    let sphMatch = true;
                    if (selectedPG.sph.length > 0) {
                        const val = parseFloat(it.sph);
                        sphMatch = selectedPG.sph.some(g => !isNaN(val) && val >= g.min && val <= g.max);
                    }
                    if (!sphMatch) return false;

                    let cylMatch = true;
                    if (selectedPG.cyl.length > 0) {
                        const val = parseFloat(it.cyl);
                        cylMatch = selectedPG.cyl.some(g => !isNaN(val) && val >= g.min && val <= g.max);
                    }
                    if (!cylMatch) return false;

                    let addMatch = true;
                    if (selectedPG.add.length > 0) {
                        const val = parseFloat(it.add);
                        addMatch = selectedPG.add.some(g => !isNaN(val) && val >= g.min && val <= g.max);
                    }
                    return addMatch;
                });
            }
            return true;
        });
    }, [transactions, selectedPG]);

    const totals = React.useMemo(() => {
        return filteredTransactions.reduce((acc, curr) => {
            acc.gross += (parseFloat(curr.grossAmt) || 0);
            acc.paid += (parseFloat(curr.paidAmt) || 0);
            acc.due += (parseFloat(curr.dueAmt) || 0);
            return acc;
        }, { gross: 0, paid: 0, due: 0 });
    }, [filteredTransactions]);

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getTransactionSummaryReport(filters);
            if (res.success) {
                setTransactions(res.data || []);
            } else {
                toast.error(res.message || 'Failed to fetch transaction summary');
            }
        } catch (error) {
            console.error('Error fetching transaction summary:', error);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            groupName: '',
            productName: '',
            transType: 'All',
            billSeries: '',
            dateFrom: new Date().toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0],
            bookedBy: '',
            searchText: ''
        });
        setTransactions([]);
        setSelectedPG({ sph: [], cyl: [], add: [] });
        setAvailablePG({ sph: [], cyl: [], add: [] });
    };

    const handleExportExcel = () => {
        if (transactions.length === 0) {
            toast.error("No data to export");
            return;
        }

        const rows = transactions.map((t, idx) => ({
            'SNo': idx + 1,
            'Date': new Date(t.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
            'Vch No': t.vchNo,
            'Party Name': t.partyName,
            'GSTIN': t.gstin,
            'Mobile No': t.mobileNo,
            'Gross Amt': roundAmount(t.grossAmt),
            'Paid Amt': roundAmount(t.paidAmt),
            'Due Amt': roundAmount(t.dueAmt),
            'Bill Type': t.billType,
            'Mtrl Center': t.mtrlCenter,
            'Used In': t.usedIn,
            'Remark': t.remark,
            'Status': t.status,
            'CreatedBy': t.createdBy
        }));

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `TransactionSummary_${filters.dateFrom}_to_${filters.dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleView = (transaction) => {
        const { transType, docId } = transaction;
        let url = '';

        if (transType === 'Sale Invoice') url = `/lenstransaction/sale/AddLensSale/${docId}`;
        else if (transType === 'Sale Order') url = `/lenstransaction/sale/AddLensSaleOrder/${docId}`;
        else if (transType === 'Sale Challan') url = `/lenstransaction/sale/AddLensSaleChallan/${docId}`;
        else if (transType === 'Sale Return') url = `/lenstransaction/addsalereturn/${docId}`;
        else if (transType === 'Purchase Invoice') url = `/lenstransaction/purchase/AddLensPurchase/${docId}`;
        else if (transType === 'Purchase Order') url = `/lenstransaction/purchase/AddLensPurchaseOrder/${docId}`;
        else if (transType === 'Purchase Challan') url = `/lenstransaction/purchase/AddLensPurchaseChallan/${docId}`;
        else if (transType === 'Purchase Return') url = `/lenstransaction/addpurchasereturn/${docId}`;

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
                    <span>Invoice Summary</span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white border-b border-slate-200 p-3 shrink-0 print:hidden shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-64">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Group Name</label>
                        <select
                            value={filters.groupName}
                            onChange={(e) => handleFilterChange('groupName', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white font-semibold"
                        >
                            <option value="">SELECT GROUP</option>
                            {allGroups.map(g => (
                                <option key={g._id || g.groupName} value={g.groupName}>{g.groupName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-64">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Name</label>
                        <select
                            value={filters.productName}
                            onChange={(e) => handleFilterChange('productName', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white font-semibold"
                        >
                            <option value="">SELECT ITEM</option>
                            {allItems
                                .filter(it => !filters.groupName || it.groupName === filters.groupName)
                                .map(it => (
                                    <option key={it._id || it.itemName} value={it.itemName}>{it.itemName}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="min-w-[160px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trans Type</label>
                        <select
                            value={filters.transType}
                            onChange={(e) => handleFilterChange('transType', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white font-semibold text-blue-800"
                        >
                            {transTypeOptions.map(opt => (
                                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-28">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bill Series</label>
                        <input
                            type="text"
                            value={filters.billSeries}
                            onChange={(e) => handleFilterChange('billSeries', e.target.value)}
                            placeholder="Series"
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-36">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-36">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="w-32">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Booked By</label>
                        <input
                            type="text"
                            value={filters.bookedBy}
                            onChange={(e) => handleFilterChange('bookedBy', e.target.value)}
                            placeholder="User"
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search any text</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={filters.searchText}
                                onChange={(e) => handleFilterChange('searchText', e.target.value)}
                                placeholder="Search..."
                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none pr-8"
                            />
                            <div className="absolute right-0 top-0 h-full flex items-center pr-3 pointer-events-none">
                                <Filter className="w-4 h-4 text-orange-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mb-[1px] ml-auto">
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnFilter(!showColumnFilter)}
                                className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition border border-slate-300 flex items-center gap-1 text-sm font-bold"
                            >
                                <Layout className="w-4 h-4" />
                                Columns
                            </button>
                            {showColumnFilter && (
                                <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 p-3 max-h-80 overflow-y-auto ring-1 ring-black ring-opacity-5">
                                    <h4 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest border-b pb-2">Toggle Visibility</h4>
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
                            className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition"
                        >
                            Search
                        </button>
                        <button onClick={handleReset} className="p-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition shadow-sm">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={handleExportExcel} className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition shadow-sm">
                            <FileSpreadsheet className="w-5 h-5" />
                        </button>
                        <button onClick={handlePrint} className="p-2 bg-slate-500 text-white rounded hover:bg-slate-600 transition shadow-sm">
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
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Power Group ({label})</label>
                                <div
                                    className={`w-full px-3 py-2 border rounded bg-white cursor-pointer min-h-[38px] flex items-center justify-between transition-all duration-200 ${isOpen ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
                                    onClick={() => setPgDropdownOpen(prev => ({
                                        sph: false, cyl: false, add: false,
                                        [type]: !prev[type]
                                    }))}
                                >
                                    <div className="flex flex-wrap gap-1">
                                        {selected.length === 0 ? (
                                            <span className="text-slate-400 text-xs italic lowercase">no {label} filter</span>
                                        ) : selected.length === all.length ? (
                                            <span className="text-blue-600 text-xs font-black uppercase tracking-tighter">All {label}</span>
                                        ) : (
                                            <span className="text-blue-600 text-xs font-black">({selected.length}) {label} Selected</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
                                </div>

                                {isOpen && (
                                    <div className="absolute top-10 left-0 right-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-lg z-50 p-2 max-h-60 overflow-y-auto ring-1 ring-black ring-opacity-5">
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
                                                            <span className={`text-xs font-bold transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-900'}`}>
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
            <div className="flex-1 overflow-auto bg-[#f0f7ff]">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#cfe2f3] sticky top-0 z-10 border-b border-blue-200">
                        <tr>
                            {columns.find(c => c.id === 'sNo')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">SNo</th>}
                            {columns.find(c => c.id === 'date')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Date</th>}
                            {columns.find(c => c.id === 'vchNo')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Vch No</th>}
                            {columns.find(c => c.id === 'partyName')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Party Name</th>}
                            {columns.find(c => c.id === 'gstin')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">GSTIN</th>}
                            {columns.find(c => c.id === 'mobileNo')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Mobile No</th>}
                            {columns.find(c => c.id === 'grossAmt')?.visible && <th className="px-3 py-2.5 text-right text-blue-900 font-bold border-r border-blue-200">Gross Amt</th>}
                            {columns.find(c => c.id === 'paidAmt')?.visible && <th className="px-3 py-2.5 text-right text-blue-900 font-bold border-r border-blue-200">Paid Amt</th>}
                            {columns.find(c => c.id === 'dueAmt')?.visible && <th className="px-3 py-2.5 text-right text-blue-900 font-bold border-r border-blue-200">Due Amt</th>}
                            {columns.find(c => c.id === 'billType')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Bill Type</th>}
                            {columns.find(c => c.id === 'mtrlCenter')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Mtrl Center</th>}
                            {columns.find(c => c.id === 'usedIn')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Used In</th>}
                            {columns.find(c => c.id === 'remark')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Remark</th>}
                            {columns.find(c => c.id === 'status')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">Status</th>}
                            {columns.find(c => c.id === 'createdBy')?.visible && <th className="px-3 py-2.5 text-left text-blue-900 font-bold border-r border-blue-200">CreatedBy</th>}
                            <th className="px-3 py-2.5 text-center text-blue-900 font-bold print:hidden">View</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {loading ? (
                            <tr>
                                <td colSpan="16" className="text-center py-12">
                                    <div className="flex flex-col items-center justify-center gap-3 text-blue-600 font-bold text-base">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        Fetching transaction summary...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredTransactions.length === 0 ? (
                            <tr>
                                <td colSpan="16" className="text-center py-12 text-slate-400 font-bold italic text-base">
                                    No records found for the selected filters
                                </td>
                            </tr>
                        ) : (
                            filteredTransactions.map((t, idx) => {
                                const showGroupHeader = idx === 0 || filteredTransactions[idx - 1].partyName !== t.partyName;
                                const visibleColsCount = columns.filter(c => c.visible).length + 1;
                                return (
                                    <React.Fragment key={idx}>
                                        {showGroupHeader && (
                                            <tr className="bg-[#e4f6ff] border-b border-blue-100 h-10">
                                                <td colSpan={visibleColsCount} className="px-4 border-r border-blue-200 font-black text-blue-900 uppercase text-xs align-middle tracking-wider shadow-inner">
                                                    {t.partyName}
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="border-b border-slate-100 hover:bg-blue-50 transition-colors group">
                                            {columns.find(c => c.id === 'sNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 font-medium">{idx + 1}</td>}
                                            {columns.find(c => c.id === 'date')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-800">{new Date(t.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>}
                                            {columns.find(c => c.id === 'vchNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-900 font-bold">{t.vchNo}</td>}
                                            {columns.find(c => c.id === 'partyName')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-blue-700 font-black">{t.partyName}</td>}
                                            {columns.find(c => c.id === 'gstin')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-700 font-mono text-xs">{t.gstin}</td>}
                                            {columns.find(c => c.id === 'mobileNo')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-700 font-medium">{t.mobileNo}</td>}
                                            {columns.find(c => c.id === 'grossAmt')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-slate-900 font-black">{formatCurrency(t.grossAmt)}</td>}
                                            {columns.find(c => c.id === 'paidAmt')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-green-700 font-bold">{formatCurrency(t.paidAmt)}</td>}
                                            {columns.find(c => c.id === 'dueAmt')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-right text-red-600 font-black">{formatCurrency(t.dueAmt)}</td>}
                                            {columns.find(c => c.id === 'billType')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600 font-medium">{t.billType}</td>}
                                            {columns.find(c => c.id === 'mtrlCenter')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-600">{t.mtrlCenter}</td>}
                                            {columns.find(c => c.id === 'usedIn')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-500 italic max-w-[150px] truncate" title={t.usedIn}>{t.usedIn}</td>}
                                            {columns.find(c => c.id === 'remark')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-500 max-w-[120px] truncate" title={t.remark}>{t.remark}</td>}
                                            {columns.find(c => c.id === 'status')?.visible && <td className="px-3 py-2 border-r border-slate-100 font-bold">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] ${t.status === 'Done' || t.status === 'Received' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {t.status}
                                                </span>
                                            </td>}
                                            {columns.find(c => c.id === 'createdBy')?.visible && <td className="px-3 py-2 border-r border-slate-100 text-slate-500 italic uppercase font-bold text-[10px]">{t.createdBy}</td>}
                                            <td className="px-3 py-2 text-center print:hidden">
                                                <button
                                                    onClick={() => handleView(t)}
                                                    className="p-1.5 bg-yellow-400 text-white rounded shadow hover:bg-yellow-500 transition-all group-hover:scale-110"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                    <tfoot className="bg-[#cfe2f3] border-t-2 border-blue-300 sticky bottom-0 z-10 font-black">
                        <tr>
                            <td colSpan={columns.filter(c => c.visible && ['sNo', 'date', 'vchNo', 'partyName', 'gstin', 'mobileNo'].includes(c.id)).length} className="px-3 py-3 text-right text-blue-900 uppercase tracking-widest text-[10px]">Grand Totals:</td>
                            {columns.find(c => c.id === 'grossAmt')?.visible && <td className="px-3 py-3 text-right text-blue-900 border-r border-blue-200">{formatCurrency(totals.gross)}</td>}
                            {columns.find(c => c.id === 'paidAmt')?.visible && <td className="px-3 py-3 text-right text-green-700 border-r border-blue-200">{formatCurrency(totals.paid)}</td>}
                            {columns.find(c => c.id === 'dueAmt')?.visible && <td className="px-3 py-3 text-right text-red-700 border-r border-blue-200">{formatCurrency(totals.due)}</td>}
                            <td colSpan={columns.filter(c => c.visible && ['billType', 'mtrlCenter', 'usedIn', 'remark', 'status', 'createdBy'].includes(c.id)).length + 1} className="bg-[#cfe2f3]"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body { font-size: 8pt; background: white; }
                    .print\\:hidden { display: none !important; }
                    h1 { display: block; text-align: center; margin-bottom: 10px; }
                    table { width: 100% !important; border-collapse: collapse !important; }
                    th, td { border: 1px solid #ddd !important; padding: 4px !important; }
                    th { background-color: #f2f2f2 !important; color: black !important; }
                }
            `}</style>
        </div>
    );
}
