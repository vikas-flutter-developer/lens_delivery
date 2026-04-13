import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
    FileText, Search, RefreshCw, Printer, Upload, Download, Filter,
    ChevronDown, X, Check, AlertCircle, FileSpreadsheet, Package, Columns, RotateCcw
} from 'lucide-react';
import { roundAmount } from '../utils/amountUtils';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { getPartyWiseItemReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllAccounts } from '../controllers/Account.controller';
import { getAllLensPower } from '../controllers/LensGroupCreationController';
import toast from 'react-hot-toast';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function VerifyBilling() {
    const navigate = useNavigate();
    const location = useLocation();

    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [items, setItems] = useState([]);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [showTransTypeSelector, setShowTransTypeSelector] = useState(false);

    // Suggestion states
    const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
    const [showCustSuggestions, setShowCustSuggestions] = useState(false);
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

    // File Upload States
    const [uploadedFile, setUploadedFile] = useState(null);
    const [fileData, setFileData] = useState([]);
    const [comparisonResults, setComparisonResults] = useState([]);
    const [mismatchCount, setMismatchCount] = useState(0);
    const [isVerifying, setIsVerifying] = useState(false);
    const fileInputRef = React.useRef(null);

    // Get default date range (current month)
    const getDefaultDates = () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
            dateFrom: firstDay.toISOString().split('T')[0],
            dateTo: today.toISOString().split('T')[0],
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

    // Column visibility state - Adjusted for Verify Billing requirements
    const [visibleColumns, setVisibleColumns] = useState({
        sNo: true,
        transType: true,
        partyName: true,
        productName: true,
        eye: true,
        sph: true,
        cyl: true,
        axis: true,
        add: true,
        lensPower: true,
        qty: true,
        totalPrice: true,
    });

    const columnLabels = {
        sNo: 'SNo',
        transType: 'Trans Type',
        partyName: 'Party Name',
        productName: 'Product Name',
        lensPower: 'Lens Power',
        qty: 'Qty',
        totalPrice: 'Total Price',
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
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    // --- Improved Data Normalization Helpers ---
    const normalizeEye = (eye) => {
        if (!eye) return 'RL';
        const e = String(eye).toUpperCase().trim();
        if (['R', 'RE', 'RIGHT'].includes(e)) return 'R';
        if (['L', 'LE', 'LEFT'].includes(e)) return 'L';
        if (['RL', 'BE', 'BOTH', 'PAIR', 'R/L', 'RE/LE'].includes(e)) return 'RL';
        return e;
    };

    const cleanNumeric = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Remove commas and currency symbols
        const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    };

    const normalizePower = (val) => {
        const n = cleanNumeric(val);
        // Always return as string with 2 decimals to handle "1" vs "1.00"
        return n.toFixed(2);
    };

    const normalizeAxis = (val) => {
        const n = cleanNumeric(val);
        return Math.round(n);
    };

    const normalizeQty = (val) => {
        return cleanNumeric(val);
    };

    const normalizePrice = (val) => {
        const n = cleanNumeric(val);
        return roundAmount(n);
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const runVerification = (sysData, fData) => {
        console.log("Starting verification. System rows:", sysData.length, "File rows:", fData.length);
        if (!fData || fData.length === 0 || !sysData || sysData.length === 0) {
            setComparisonResults([]);
            setMismatchCount(0);
            return;
        }

        let mismatches = 0;
        const usedFileIndices = new Set();

        const results = sysData.map((sysRow, idx) => {
            const sysEye = normalizeEye(sysRow.eye);
            const sysSph = normalizePower(sysRow.sph);
            const sysCyl = normalizePower(sysRow.cyl);
            const sysAdd = normalizePower(sysRow.add);
            const sysAxis = normalizeAxis(sysRow.axis);

            // Find match in file data that hasn't been used yet
            const matchIdx = fData.findIndex((fRow, fIdx) => {
                if (usedFileIndices.has(fIdx)) return false;

                const fileEye = normalizeEye(fRow.eye);
                const fileSph = normalizePower(fRow.sph);
                const fileCyl = normalizePower(fRow.cyl);
                const fileAdd = normalizePower(fRow.add);
                const fileAxis = normalizeAxis(fRow.axis);

                return fileEye === sysEye &&
                    fileSph === sysSph &&
                    fileCyl === sysCyl &&
                    fileAdd === sysAdd &&
                    fileAxis === sysAxis;
            });

            if (matchIdx === -1) {
                mismatches++;
                return {
                    rowIdx: idx,
                    isMissingInFile: true,
                    fields: {
                        eye: { sys: sysRow.eye, file: 'Not Found', match: false },
                        sph: { sys: sysSph, file: 'N/A', match: false },
                        cyl: { sys: sysCyl, file: 'N/A', match: false },
                        axis: { sys: sysAxis, file: 'N/A', match: false },
                        add: { sys: sysAdd, file: 'N/A', match: false },
                        qty: { sys: sysRow.qty, file: 'N/A', match: false },
                        totalPrice: { sys: normalizePrice(sysRow.totalPrice), file: 'N/A', match: false },
                    }
                };
            }

            usedFileIndices.add(matchIdx);
            const match = fData[matchIdx];

            const sysQty = normalizeQty(sysRow.qty);
            const sysPrice = normalizePrice(sysRow.totalPrice);

            const fileQty = normalizeQty(match.qty);
            const filePrice = normalizePrice(match.totalPrice);

            const fieldLeaks = {
                qty: Math.abs(fileQty - sysQty) > 0.001,
                totalPrice: filePrice !== sysPrice,
            };

            const isMatch = !fieldLeaks.qty && !fieldLeaks.totalPrice;
            if (!isMatch) {
                console.log(`Mismatch at row ${idx + 1}: Qty: ${sysQty} vs ${fileQty}, Price: ${sysPrice} vs ${filePrice}`);
                mismatches++;
            }

            return {
                rowIdx: idx,
                isMissingInFile: false,
                fields: {
                    eye: { sys: sysRow.eye, file: match.eye, match: true },
                    sph: { sys: sysSph, file: normalizePower(match.sph), match: true },
                    cyl: { sys: sysCyl, file: normalizePower(match.cyl), match: true },
                    axis: { sys: sysAxis, file: normalizeAxis(match.axis), match: true },
                    add: { sys: sysAdd, file: normalizePower(match.add), match: true },
                    qty: { sys: sysQty, file: fileQty, match: !fieldLeaks.qty },
                    totalPrice: { sys: sysPrice, file: filePrice, match: !fieldLeaks.totalPrice },
                }
            };
        });

        // Check if there are rows in the file that weren't matched to system data
        if (fData.length > sysData.length) {
            const unmatchedFileRows = fData.length - usedFileIndices.size;
            if (unmatchedFileRows > 0) {
                console.warn(`${unmatchedFileRows} rows in file not found in currently filtered system data.`);
                // We don't necessarily increment mismatches here as the view is filtered, 
                // but we should inform the user if the counts don't match.
            }
        }

        setComparisonResults(results);
        setMismatchCount(mismatches);

        if (mismatches === 0 && sysData.length > 0) {
            toast.success("Billing verified successfully! 100% Match.");
        } else if (mismatches > 0) {
            toast.error(`Found ${mismatches} mismatches in billing data`);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadedFile(file.name);
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target.result;
                    const wb = XLSX.read(bstr, { type: "binary" });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws);
                    processUploadedData(data);
                } catch (err) {
                    console.error("Excel error:", err);
                    toast.error("Failed to parse Excel file");
                }
            };
            reader.readAsBinaryString(file);
        } else if (file.name.endsWith(".pdf")) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                // pdfjsLib worker is already set at top level
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                let textData = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageItems = textContent.items.map(item => ({
                        str: item.str,
                        y: Math.round(item.transform[5]),
                        x: Math.round(item.transform[4])
                    }));

                    const rowsByY = pageItems.reduce((acc, item) => {
                        if (!acc[item.y]) acc[item.y] = [];
                        acc[item.y].push(item);
                        return acc;
                    }, {});

                    // Sort Y descending to get rows from top to bottom
                    const sortedY = Object.keys(rowsByY).sort((a, b) => b - a);
                    sortedY.forEach(y => {
                        const rowItems = rowsByY[y];
                        rowItems.sort((a, b) => a.x - b.x);
                        const rowText = rowItems.map(ri => ri.str).join(" ");
                        textData.push(rowText);
                    });
                }

                // Enhanced PDF mapping: Improved heuristic to find data rows
                const parsedPdfData = textData.map(text => {
                    const parts = text.split(/\s+/).filter(p => p.trim() !== "");

                    // Look for Eye indicator
                    const eyeIdx = parts.findIndex(p => ["R", "L", "RL", "RE", "LE", "RE/LE", "R/L"].includes(p.toUpperCase()));

                    if (eyeIdx !== -1) {
                        const dataParts = parts.slice(eyeIdx).filter(p => !isNaN(parseFloat(p)) || ["R", "L", "RL", "RE", "LE"].includes(p.toUpperCase()));
                        const rowNumbers = dataParts.map(p => parseFloat(p)).filter(n => !isNaN(n));

                        if (dataParts.length >= 4) { // Eye, Sph, Cyl, Qty are minimum
                            return {
                                eye: dataParts[0],
                                sph: dataParts[1],
                                cyl: dataParts[2],
                                axis: dataParts[3] || 0,
                                add: dataParts[4] || 0,
                                qty: dataParts[5] || rowNumbers[rowNumbers.length - 2] || 0, // Fallback logic
                                totalPrice: dataParts[6] || rowNumbers[rowNumbers.length - 1] || 0
                            };
                        }
                    }

                    // Fallback for rows without explicit Eye indicator but looking like data
                    const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
                    if (numbers.length >= 4) {
                        return {
                            eye: "RL",
                            sph: numbers[0],
                            cyl: numbers[1],
                            axis: numbers[2] || 0,
                            add: numbers[3] || 0,
                            qty: numbers[4] || 0,
                            totalPrice: numbers[5] || 0
                        };
                    }
                    return null;
                }).filter(Boolean);

                processUploadedData(parsedPdfData);
            } catch (err) {
                console.error("PDF error detail:", err);
                toast.error(`Failed to parse PDF: ${err.message || 'Check console'}`);
            }
        }
        e.target.value = "";
    };

    const processUploadedData = (data) => {
        const getVal = (row, patterns) => {
            // Prioritize the order of patterns. Check all keys for the first pattern, 
            // then all keys for the second, etc.
            for (const p of patterns) {
                const key = Object.keys(row).find((k) =>
                    k.toLowerCase().includes(p.toLowerCase())
                );
                if (key) return row[key];
            }
            return "";
        };

        const mappedData = data.map(row => {
            const rowEye = getVal(row, ["eye"]);
            const rowSph = getVal(row, ["sph"]);
            const rowCyl = getVal(row, ["cyl"]);
            const rowAxis = getVal(row, ["axis"]);
            const rowAdd = getVal(row, ["add"]);
            const rowQty = getVal(row, ["qty", "quantity"]);
            const rowPrice = getVal(row, ["total price", "total amount", "net amount", "total", "amount", "price"]);

            return {
                eye: normalizeEye(rowEye),
                sph: normalizePower(rowSph),
                cyl: normalizePower(rowCyl),
                axis: normalizeAxis(rowAxis),
                add: normalizePower(rowAdd),
                qty: normalizeQty(rowQty),
                totalPrice: normalizePrice(rowPrice),
                // Keep raw values for display if needed
                raw: { eye: rowEye, sph: rowSph, cyl: rowCyl, axis: rowAxis, add: rowAdd, qty: rowQty, totalPrice: rowPrice }
            };
        }).filter(r => r.qty > 0 || parseFloat(r.totalPrice) > 0);

        setFileData(mappedData);
        if (displayData.length > 0) {
            runVerification(displayData, mappedData);
        }
        toast.success(`Processed ${mappedData.length} records from file`);
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            setReportData([]);
            const res = await getPartyWiseItemReport(filters);
            if (res.success) {
                setReportData(res.data);
                if (res.data.length === 0) {
                    toast.info('No records found for the selected filters');
                } else if (fileData.length > 0) {
                    // Filter logic for displayData is in useMemo, so we need to compute it or rely on useEffect
                    // But for immediate feedback, we can do:
                    const selectedBackendTypes = filters.transType.includes('All') ? null : filters.transType.map(t => typeLabelMap[t] || t);
                    const filtered = selectedBackendTypes
                        ? res.data.filter(row => selectedBackendTypes.includes(row.transType))
                        : res.data;
                    runVerification(filtered, fileData);
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
        setFileData([]);
        setUploadedFile(null);
        setComparisonResults([]);
        setMismatchCount(0);
    };

    const handleExport = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        const visibleCols = Object.entries(visibleColumns)
            .filter(([_, visible]) => visible)
            .map(([key]) => key);

        const headers = visibleCols.map(col => columnLabels[col]).join(',');
        const rows = reportData.map(row =>
            visibleCols.map(col => {
                const value = row[col];
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
        a.download = `VerifyBilling_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Report exported successfully!');
    };

    const handlePrint = () => {
        window.print();
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
        'Contact Lens & Sol Purchase Order': 'Contact Lens & Sol Purchase Order'
    };

    const displayData = React.useMemo(() => {
        if (!reportData || reportData.length === 0) return [];
        if (filters.transType.includes('All')) return reportData;

        const selectedBackendTypes = filters.transType.map(t => typeLabelMap[t] || t);
        return reportData.filter(row => selectedBackendTypes.includes(row.transType));
    }, [reportData, filters.transType]);

    const totals = {
        qty: displayData.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0),
        totalPrice: displayData.reduce((sum, r) => sum + (parseFloat(r.totalPrice) || 0), 0),
    };

    return (
        <div className="min-h-screen text-black bg-slate-50 p-4 md:p-6 print:p-0">
            <div className="max-w-[1800px] mx-auto">
                {/* Toggle Feature */}
                <div className="flex mb-6 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
                    <button
                        onClick={() => navigate('/reports/verification/billing')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                            location.pathname.includes('/billing')
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Verify Billing
                    </button>
                    <button
                        onClick={() => navigate('/reports/verification/bank-statement')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                            location.pathname.includes('/bank-statement')
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Verify Bank Statement
                    </button>
                </div>

                {/* Header */}

                <div className="bg-gray-50 rounded-t-xl px-6 py-4 flex items-center justify-between print:hidden">
                    <h1 className="text-xl font-bold text-black flex items-center gap-2">
                        <FileText className="w-6 h-6" />
                        Verify Billing
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
                <div className="bg-zinc-100 rounded-xl mb-10 px-4 py-3 print:hidden">
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
                            {/* Upload Section */}
                            <div className="flex items-center gap-2 mr-2">
                                {uploadedFile && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded border border-blue-200 animate-in fade-in slide-in-from-right-4">
                                        <FileText className="w-3 h-3" />
                                        <span className="max-w-[100px] truncate">{uploadedFile}</span>
                                        <button
                                            onClick={() => {
                                                setUploadedFile(null);
                                                setFileData([]);
                                                setComparisonResults([]);
                                                setMismatchCount(0);
                                            }}
                                            className="hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx,.xls,.pdf"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-sm font-semibold rounded hover:bg-indigo-600 transition shadow-sm"
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload
                                </button>
                            </div>

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

                {/* Verification Results Banner */}
                {uploadedFile && displayData.length > 0 && (
                    <div className={`mb-4 p-3 rounded-lg flex items-center justify-between animate-in slide-in-from-top-4 ${mismatchCount === 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                        <div className="flex items-center gap-2">
                            {mismatchCount === 0 ? (
                                <Package className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <FileText className="w-5 h-5 text-amber-500" />
                            )}
                            <span className="font-semibold">
                                {mismatchCount === 0
                                    ? "Billing verified successfully! All records match."
                                    : `Verification Complete: Found ${mismatchCount} mismatches between system and file data.`}
                            </span>
                        </div>
                        <div className="text-xs opacity-70">
                            Compared against: {uploadedFile}
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <div className="bg-white rounded-b-xl shadow-md border border-slate-200 overflow-hidden print:shadow-none print:border-none">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse min-w-max">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-blue-600 text-white text-xs uppercase tracking-wider font-bold">
                                    {visibleColumns.sNo && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-12">SNo</th>}
                                    {visibleColumns.transType && <th className="px-2 py-2.5 border-r border-blue-500 w-32">Trans Type</th>}
                                    {visibleColumns.partyName && <th className="px-2 py-2.5 border-r border-blue-500 min-w-[200px]">Party Name</th>}
                                    {visibleColumns.productName && <th className="px-2 py-2.5 border-r border-blue-500 min-w-[220px]">Product Name</th>}
                                    {visibleColumns.eye && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-12">EYE</th>}
                                    {visibleColumns.sph && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-16">SPH</th>}
                                    {visibleColumns.cyl && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-16">CYL</th>}
                                    {visibleColumns.axis && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-14">AXIS</th>}
                                    {visibleColumns.add && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-16">ADD</th>}
                                    {visibleColumns.qty && <th className="px-2 py-2.5 border-r border-blue-500 text-center w-16">Qty</th>}
                                    {visibleColumns.totalPrice && <th className="px-2 py-2.5 text-right w-28">Total Price</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayData.length === 0 ? (
                                    <tr>
                                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-10 text-center text-slate-400 bg-slate-50">
                                            <div className="flex flex-col items-center gap-2">
                                                <Package className="w-12 h-12 text-slate-300" />
                                                <span className="text-lg font-medium">No records found</span>
                                                <span className="text-xs">Use the filters above and click Search to view data</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    displayData.map((row, index) => {
                                        const comp = comparisonResults[index];
                                        const isMismatch = comp && !comp.fields.qty.match || comp && !comp.fields.totalPrice.match || (comp && comp.isMissingInFile);

                                        return (
                                            <tr key={index} className={`transition-colors group ${isMismatch ? 'bg-red-50/50 hover:bg-red-100/50' : 'hover:bg-blue-50'}`}>
                                                {visibleColumns.sNo && (
                                                    <td className="px-2 py-2 border-r border-slate-100 text-center text-slate-500 tabular-nums">{index + 1}</td>
                                                )}
                                                {visibleColumns.transType && (
                                                    <td className="px-2 py-2 border-r border-slate-100 text-slate-600 text-xs">{row.transType}</td>
                                                )}
                                                {visibleColumns.partyName && (
                                                    <td className="px-2 py-2 border-r border-slate-100 font-medium text-slate-700 truncate max-w-[200px]" title={row.partyName}>
                                                        {row.partyName}
                                                    </td>
                                                )}
                                                {visibleColumns.productName && (
                                                    <td className="px-2 py-2 border-r border-slate-100 font-medium text-slate-700 truncate max-w-[220px]" title={row.productName}>
                                                        {row.productName}
                                                    </td>
                                                )}
                                                {visibleColumns.eye && (
                                                    <td className={`px-2 py-2 border-r border-slate-100 text-center ${comp && !comp.fields.eye.match ? 'bg-red-200' : ''}`} title={comp && !comp.fields.eye.match ? `File: ${comp.fields.eye.file}` : ''}>
                                                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${row.eye === 'R' ? 'bg-green-100 text-green-700' : row.eye === 'L' ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>
                                                            {row.eye || '—'}
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.sph && (
                                                    <td className={`px-2 py-2 border-r border-slate-100 text-center font-bold text-slate-800 ${comp && !comp.fields.sph.match ? 'bg-red-200' : ''}`} title={comp && !comp.fields.sph.match ? `File: ${comp.fields.sph.file}` : ''}>
                                                        {parseFloat(row.sph).toFixed(2)}
                                                    </td>
                                                )}
                                                {visibleColumns.cyl && (
                                                    <td className={`px-2 py-2 border-r border-slate-100 text-center font-bold text-slate-800 ${comp && !comp.fields.cyl.match ? 'bg-red-200' : ''}`} title={comp && !comp.fields.cyl.match ? `File: ${comp.fields.cyl.file}` : ''}>
                                                        {parseFloat(row.cyl).toFixed(2)}
                                                    </td>
                                                )}
                                                {visibleColumns.axis && (
                                                    <td className={`px-2 py-2 border-r border-slate-100 text-center text-slate-600 ${comp && !comp.fields.axis.match ? 'bg-red-200' : ''}`} title={comp && !comp.fields.axis.match ? `File: ${comp.fields.axis.file}` : ''}>
                                                        {row.axis || 0}
                                                    </td>
                                                )}
                                                {visibleColumns.add && (
                                                    <td className={`px-2 py-2 border-r border-slate-100 text-center font-bold text-slate-800 ${comp && !comp.fields.add.match ? 'bg-red-200' : ''}`} title={comp && !comp.fields.add.match ? `File: ${comp.fields.add.file}` : ''}>
                                                        {parseFloat(row.add).toFixed(2)}
                                                    </td>
                                                )}
                                                {visibleColumns.qty && (
                                                    <td className={`px-2 py-2 border-r border-slate-100 text-center font-bold relative group/cell ${comp && !comp.fields.qty.match ? 'bg-red-500 text-white' : (row.qty > 0 ? 'text-green-600' : 'text-red-600')}`}>
                                                        {row.qty}
                                                        {comp && !comp.fields.qty.match && (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap hidden group-hover/cell:block z-[100] shadow-xl border border-white/20">
                                                                System: {comp.fields.qty.sys} | File: {comp.fields.qty.file}
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                {visibleColumns.totalPrice && (
                                                    <td className={`px-2 py-2 text-right font-bold relative group/cell ${comp && !comp.fields.totalPrice.match ? 'bg-red-500 text-white' : 'text-blue-800 bg-blue-50/50'}`}>
                                                        {roundAmount(parseFloat(row.totalPrice) || 0)}
                                                        {comp && !comp.fields.totalPrice.match && (
                                                            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap hidden group-hover/cell:block z-[100] shadow-xl border border-white/20">
                                                                System: {comp.fields.totalPrice.sys} | File: {comp.fields.totalPrice.file}
                                                                <div className="absolute top-full right-4 border-8 border-transparent border-t-gray-800"></div>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {displayData.length > 0 && (
                                <tfoot className="sticky bottom-0 bg-gray-600 text-white font-bold">
                                    <tr>
                                        <td colSpan={visibleColumns.sNo ? 1 : 0} className="px-2 py-2.5"></td>
                                        {visibleColumns.transType && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.partyName && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.productName && <td className="px-2 py-2.5 text-right uppercase tracking-widest text-xs">Total</td>}
                                        {visibleColumns.eye && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.sph && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.cyl && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.axis && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.add && <td className="px-2 py-2.5"></td>}
                                        {visibleColumns.qty && (
                                            <td className="px-2 py-2.5 text-center text-yellow-300">
                                                {totals.qty}
                                            </td>
                                        )}
                                        {visibleColumns.totalPrice && (
                                            <td className="px-2 py-2.5 text-right text-green-300">
                                                ₹{roundAmount(totals.totalPrice)}
                                            </td>
                                        )}
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
