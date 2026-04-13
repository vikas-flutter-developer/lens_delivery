import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

import {
    Search,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    Package,
    ArrowRight,
    Filter,
    ClipboardCheck,
    BarChart3,
    Layers,
    LayoutGrid,
    ChevronRight,
    Table,
    Grid3X3,
    ChevronDown,
    UploadCloud,
    X,
} from 'lucide-react';
import { getLensStockReport } from '../controllers/Reports.controller';
import { getAllGroups } from '../controllers/groupcontroller';
import { getAllItems } from '../controllers/itemcontroller';
import { verifyStock, getMissingLenses, getPowerGroupsForProduct, getAllLensPower } from '../controllers/LensGroupCreationController';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function VerifyLensStock() {
    const navigate = useNavigate();
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [items, setItems] = useState([]);
    const [receivedQuantities, setReceivedQuantities] = useState({});
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'matrix'
    const [searched, setSearched] = useState(false);

    // Power Group filter state
    const [availablePowerGroups, setAvailablePowerGroups] = useState([]);
    const [selectedPowerGroups, setSelectedPowerGroups] = useState([]);
    const [pgDropdownOpen, setPgDropdownOpen] = useState(false);
    const pgDropdownRef = useRef(null);

    const [matrixInputs, setMatrixInputs] = useState({});
    const [comparisonResult, setComparisonResult] = useState(null); // { [key]: { expected, received, diff, status } }

    // Uploaded file name state
    const [uploadedFileName, setUploadedFileName] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        groupName: '',
        productName: '',
        barcode: '',
        eye: 'All',
    });

    // Close power group dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pgDropdownRef.current && !pgDropdownRef.current.contains(e.target)) {
                setPgDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fileInputRef = useRef(null);

    const normalizeNumber = (val) => {
        if (val === undefined || val === null || val === '') return null;
        let parsed;
        if (typeof val === 'string') {
            const cleaned = val.replace(/[^\d.-]/g, '');
            parsed = parseFloat(cleaned);
        } else {
            parsed = parseFloat(val);
        }
        return isNaN(parsed) ? null : parsed.toFixed(2);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (reportData.length === 0 && !searched) {
            toast.error('Please click Search Records first to load the items before importing.', { duration: 4000 });
            event.target.value = null;
            return;
        }

        setLoading(true);
        try {
            const fileName = file.name.toLowerCase();
            let extractedData = [];

            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
                extractedData = await processExcel(file);
            } else if (fileName.endsWith('.pdf')) {
                extractedData = await processPDF(file);
            } else {
                toast.error('Unsupported file format. Please upload Excel (.xlsx) or PDF.');
                setLoading(false);
                event.target.value = null;
                return;
            }

            if (extractedData.length > 0) {
                applyImportedData(extractedData);
                setUploadedFileName(file.name);
            } else {
                toast.error('No matching records found or could not extract data from the file.');
            }
        } catch (error) {
            console.error('File parsing error:', error);
            toast.error('Failed to parse file. Please check format.');
        } finally {
            setLoading(false);
            event.target.value = null;
        }
    };

    const processExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                    const extracted = [];

                    json.forEach(row => {
                        const keys = Object.keys(row);
                        const getVal = (possibleKeys) => {
                            const key = keys.find(k => possibleKeys.some(pk => k.trim().toUpperCase() === pk || k.trim().toUpperCase().includes(pk)));
                            return key ? row[key] : null;
                        };

                        const sph = getVal(['SPH', 'SPHERE']);
                        const cyl = getVal(['CYL', 'CYLINDER']);
                        const product = getVal(['PRODUCT', 'ITEM', 'NAME']);
                        const axis = getVal(['AXIS']);

                        // Check if it's a matrix format by looking for keys containing "ADD" with numbers
                        const isMatrix = keys.some(k => k.toUpperCase().includes('ADD') && /[0-9]/.test(k));

                        if (isMatrix) {
                            // Matrix format processing
                            keys.forEach(k => {
                                const upperK = k.toUpperCase().trim();
                                if (upperK.includes('ADD') && /[0-9]/.test(upperK)) {
                                    // Extract the ADD value from the column name (e.g. "Add +1.00")
                                    const match = upperK.match(/[+-]?\d*\.?\d+/);
                                    if (match) {
                                        const addValue = match[0];
                                        const qty = row[k];
                                        const parsedQty = typeof qty === 'string' ? parseFloat(qty.replace(/[^\d.-]/g, '')) : parseFloat(qty);

                                        if (!isNaN(parsedQty) && parsedQty > 0) {
                                            extracted.push({
                                                product,
                                                sph,
                                                cyl,
                                                add: addValue,
                                                axis,
                                                qty: parsedQty
                                            });
                                        }
                                    }
                                }
                            });
                        } else {
                            // Standard row format processing
                            const qty = getVal(['QTY', 'QUANTITY', 'RECEIVED', 'REC', 'STOCK']);
                            const add = getVal(['ADD', 'ADDITION']);

                            if (qty !== null && qty !== undefined && String(qty).trim() !== "") {
                                extracted.push({
                                    product,
                                    sph,
                                    cyl,
                                    add,
                                    axis,
                                    qty
                                });
                            }
                        }
                    });

                    resolve(extracted);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const processPDF = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const typedarray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const strings = content.items.map(function (item) { return item.str; });
                        fullText += strings.join(' ') + '\n';
                    }

                    const extracted = [];
                    // Generic pattern mapping: SPH 1.00 CYL -1.00 ADD 2.00 QTY 5
                    const regex = /(?:SPH|SPHERE)[\s=:|]*([+-]?\d*\.?\d+).*?(?:CYL|CYLINDER)[\s=:|]*([+-]?\d*\.?\d+).*?(?:ADD)[\s=:|]*([+-]?\d*\.?\d+)(?:.*?(?:AXIS|AX)[\s=:|]*(\d+))?.*?(?:QTY|QUANTITY|REC|RECEIVED|STOCK)[\s=:|]*(\d+)/gi;

                    let match;
                    while ((match = regex.exec(fullText)) !== null) {
                        extracted.push({
                            product: null,
                            sph: match[1],
                            cyl: match[2],
                            add: match[3],
                            axis: match[4] || null,
                            qty: match[5]
                        });
                    }

                    resolve(extracted);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const applyImportedData = (extractedData) => {
        let updatedQty = { ...receivedQuantities };
        let matchCount = 0;
        let matchedKeys = new Set();
        let matrixUpdates = { ...matrixInputs };

        extractedData.forEach(row => {
            const fSph = normalizeNumber(row.sph);
            const fCyl = normalizeNumber(row.cyl);
            const fAdd = normalizeNumber(row.add);
            const rAxis = row.axis ? parseInt(row.axis, 10).toString() : null;
            const rQty = parseInt(row.qty, 10);
            const rProduct = row.product ? String(row.product).trim().toLowerCase() : null;

            if (isNaN(rQty) || fSph === null || fCyl === null) return;

            for (let i = 0; i < reportData.length; i++) {
                const item = reportData[i];
                const iSph = normalizeNumber(item.sph);
                const iCyl = normalizeNumber(item.cyl);
                const iAdd = normalizeNumber(item.addValue);

                const sphMatch = iSph === fSph;
                const cylMatch = iCyl === fCyl;
                const addMatch = fAdd !== null ? iAdd === fAdd : true; // Some might not provide ADD

                const itemAxis = item.axis ? parseInt(item.axis, 10).toString() : null;
                const axisMatch = rAxis !== null ? itemAxis === rAxis : true;

                const itemProduct = item.productName ? item.productName.toLowerCase() : '';
                const prodMatch = rProduct ? itemProduct.includes(rProduct) : true;

                if (sphMatch && cylMatch && addMatch && axisMatch && prodMatch) {
                    updatedQty[item.barcode] = rQty;

                    const mxKey = `${parseFloat(item.sph).toFixed(2)}_${parseFloat(item.cyl).toFixed(2)}`;
                    matrixUpdates[mxKey] = rQty;

                    matchedKeys.add(item.barcode);
                }
            }
        });

        if (matchedKeys.size > 0) {
            setReceivedQuantities(updatedQty);
            setMatrixInputs(matrixUpdates);
            toast.success(`Successfully mapped quantities for ${matchedKeys.size} lens variants!`);
        } else {
            toast.error('No rows from the file matched the currently displayed items. Please check if the right product is searched.');
        }
    };


    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [groupRes, lensRes] = await Promise.all([
                getAllGroups(),
                getAllLensPower()
            ]);

            setGroups(groupRes.groups || groupRes.data?.groups || []);

            let itemsList = [];
            if (lensRes.success) {
                itemsList = lensRes.data || [];
            } else if (Array.isArray(lensRes)) {
                itemsList = lensRes;
            }
            
            // Sort by productName for easier selection
            itemsList.sort((a, b) => (a.productName || a.itemName || '').localeCompare(b.productName || b.itemName || ''));
            setItems(itemsList);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Failed to load metadata');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        // When productName changes, fetch power groups for new product
        if (field === 'productName') {
            setSelectedPowerGroups([]);
            setAvailablePowerGroups([]);
            if (value) {
                getPowerGroupsForProduct(value).then(res => {
                    if (res.success && res.data) {
                        setAvailablePowerGroups(res.data);
                    }
                }).catch(() => { });
            }
        }
    };

    const handleSearch = async () => {
        if (!filters.productName && !filters.groupName) {
            toast.error('Please select an item or group to verify');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                groupName: filters.groupName,
                productName: filters.productName,
                barcode: filters.barcode,
                eye: filters.eye,
                // Only send powerGroups if some are selected
                ...(selectedPowerGroups.length > 0 && { powerGroups: selectedPowerGroups }),
            };
            const res = await getLensStockReport(payload);
            if (res.success) {
                setReportData(res.data);
                setSearched(true);
                setReceivedQuantities({});
                setMatrixInputs({});
                setComparisonResult(null);
            }
        } catch (error) {
            toast.error('Failed to fetch stock data');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFilters({
            groupName: '',
            productName: '',
            barcode: '',
            eye: 'All',
        });
        setAvailablePowerGroups([]);
        setSelectedPowerGroups([]);
        setPgDropdownOpen(false);
        setReportData([]);
        setSearched(false);
        setReceivedQuantities({});
        setMatrixInputs({});
        setComparisonResult(null);
        setUploadedFileName(null);
    };

    const handleRemoveFile = () => {
        setUploadedFileName(null);
        setReceivedQuantities({});
        setMatrixInputs({});
        setComparisonResult(null);
        toast.success("Imported data cleared");
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    };

    const handleMatrixInput = (sph, cyl, value) => {
        const key = `${parseFloat(sph).toFixed(2)}_${parseFloat(cyl).toFixed(2)}`;
        setMatrixInputs(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleCompareMatrix = () => {
        const results = {};
        const sphValues = [...new Set(reportData.map(r => r.sph))];
        const cylValues = [...new Set(reportData.map(r => r.cyl))];

        let hasDiscrepancy = false;

        sphValues.forEach(sph => {
            cylValues.forEach(cyl => {
                const key = `${parseFloat(sph).toFixed(2)}_${parseFloat(cyl).toFixed(2)}`;

                // Calculate System Stock for this cell
                const cellItems = reportData.filter(r => r.sph === sph && r.cyl === cyl);
                const expected = cellItems.reduce((acc, r) => acc + (parseInt(r.currentStock) || 0), 0);

                // Get User Input (default to 0 if empty/undefined, or maybe we want to force entry?)
                // Assuming empty means 0 for now, or we can check if it exists
                const valStr = matrixInputs[key];
                const received = valStr === '' || valStr === undefined ? 0 : parseInt(valStr);

                if (expected === 0 && received === 0) return; // Skip empty cells

                const diff = received - expected;
                let status = 'match';
                if (diff < 0) status = 'missing';
                if (diff > 0) status = 'extra';

                if (status !== 'match') hasDiscrepancy = true;

                results[key] = {
                    expected,
                    received,
                    diff,
                    status
                };
            });
        });

        setComparisonResult(results);
        if (hasDiscrepancy) {
            toast.error('Discrepancies found! Please check highlighted cells.');
        } else {
            toast.success('Stock verified! All counts match.');
        }
    };

    const handleQtyChange = (barcode, value) => {
        setReceivedQuantities(prev => ({
            ...prev,
            [barcode]: parseInt(value) || 0
        }));
    };

    // Calculate discrepancies
    const discrepancies = useMemo(() => {
        if (viewMode === 'list') {
            return reportData.filter(row => {
                const received = receivedQuantities[row.barcode] ?? row.currentStock;
                const expected = row.currentStock || 0;
                return received !== expected;
            });
        } else {
            // Matrix View Logic
            if (!comparisonResult) return [];

            const matrixDiscrepancies = [];

            Object.entries(comparisonResult).forEach(([key, res]) => {
                if (res.status === 'match') return;

                const [sphStr, cylStr] = key.split('_');
                const sph = parseFloat(sphStr);
                const cyl = parseFloat(cylStr);

                // Find a representative item for metadata
                // We compare loose equality for safety with string/number variations
                const cellItems = reportData.filter(r =>
                    parseFloat(r.sph).toFixed(2) === sphStr &&
                    parseFloat(r.cyl).toFixed(2) === cylStr
                );

                const baseItem = cellItems.length > 0 ? cellItems[0] : {
                    productName: filters.productName || 'Unknown Product',
                    eye: filters.eye !== 'All' ? filters.eye : 'Mixed',
                    sph: sph,
                    cyl: cyl,
                };

                // Add virtual items for each count of difference
                const count = Math.abs(res.diff);
                for (let i = 0; i < count; i++) {
                    matrixDiscrepancies.push({
                        ...baseItem,
                        productName: baseItem.productName,
                        eye: baseItem.eye,
                        sph: baseItem.sph,
                        cyl: baseItem.cyl,
                        barcode: `MATRIX-DIFF-${key}-${i}` // Virtual barcode
                    });
                }
            });

            return matrixDiscrepancies;
        }
    }, [reportData, receivedQuantities, viewMode, comparisonResult, filters]);

    // Group discrepancies by range for the "show range" feature
    const discrepancyRanges = useMemo(() => {
        if (discrepancies.length === 0) return [];

        const ranges = [];
        // Group by product and eye
        const grouped = discrepancies.reduce((acc, curr) => {
            const key = `${curr.productName}-${curr.eye}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(curr);
            return acc;
        }, {});

        Object.entries(grouped).forEach(([key, items]) => {
            const sphValues = items.map(i => parseFloat(i.sph));
            const cylValues = items.map(i => parseFloat(i.cyl));

            const minSph = Math.min(...sphValues);
            const maxSph = Math.max(...sphValues);
            const minCyl = Math.min(...cylValues);
            const maxCyl = Math.max(...cylValues);

            ranges.push({
                product: items[0].productName,
                eye: items[0].eye,
                sphRange: `${minSph === maxSph ? minSph.toFixed(2) : minSph.toFixed(2) + ' to ' + maxSph.toFixed(2)}`,
                cylRange: `${minCyl === maxCyl ? minCyl.toFixed(2) : minCyl.toFixed(2) + ' to ' + maxCyl.toFixed(2)}`,
                count: items.length
            });
        });

        return ranges;
    }, [discrepancies]);

    const handleConfirmStock = async () => {
        if (reportData.length === 0) return;

        const verifications = reportData.map(row => ({
            barcode: row.barcode,
            receivedQty: receivedQuantities[row.barcode] ?? row.currentStock
        }));

        try {
            setLoading(true);
            const res = await verifyStock({ verifications });
            if (res.success) {
                toast.success('Stock verification saved successfully!');
                // Refresh data to show updated verification status
                handleSearch();
            } else {
                toast.error(res.message || 'Failed to save verification');
            }
        } catch (error) {
            console.error('Error confirming stock:', error);
            toast.error('Error saving verification data');
        } finally {
            setLoading(false);
        }
    };
    const handleCreatePO = async () => {
        let itemsToFetch = []; // { barcode, qty }

        if (viewMode === 'list') {
            itemsToFetch = reportData
                .filter(row => {
                    const received = receivedQuantities[row.barcode] ?? row.currentStock;
                    const expected = row.currentStock || 0;
                    return (received < expected);
                })
                .map(row => ({
                    barcode: row.barcode,
                    qty: (row.currentStock || 0) - (receivedQuantities[row.barcode] ?? row.currentStock)
                }));
        } else {
            // Matrix View Logic
            if (!comparisonResult) {
                toast.error('Please compare matrix first');
                return;
            }

            Object.entries(comparisonResult).forEach(([key, res]) => {
                if (res.status === 'missing') {
                    const [sphStr, cylStr] = key.split('_');
                    // Find a representative barcode for this cell
                    const cellItems = reportData.filter(r =>
                        parseFloat(r.sph).toFixed(2) === sphStr &&
                        parseFloat(r.cyl).toFixed(2) === cylStr
                    );

                    if (cellItems.length > 0) {
                        itemsToFetch.push({
                            barcode: cellItems[0].barcode,
                            qty: Math.abs(res.diff)
                        });
                    }
                }
            });
        }

        if (itemsToFetch.length === 0) {
            toast.error('No missing lenses found');
            return;
        }

        const barcodes = itemsToFetch.map(it => it.barcode);

        try {
            setLoading(true);
            const res = await getMissingLenses(barcodes);
            if (res.success && res.data.length > 0) {
                // Attach missing quantities to the data
                const prefilledItems = res.data.map(item => {
                    const match = itemsToFetch.find(it => it.barcode === item.barcode);
                    return {
                        ...item,
                        qty: match ? match.qty : 0,
                        productName: item.itemName // AddLensPurchaseOrder expects productName
                    };
                }).filter(it => it.qty > 0);

                if (prefilledItems.length === 0) {
                    toast.error('Could not determine quantities for purchase order');
                    return;
                }

                navigate('/lenstransaction/purchase/AddLensPurchaseOrder', {
                    state: { items: prefilledItems }
                });
            } else {
                toast.error('Failed to fetch lens details for purchase order');
            }
        } catch (error) {
            console.error('Error preparing purchase order:', error);
            toast.error('Error preparing purchase order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-8">
            <div className="max-w-[1700px] mx-auto">
                {/* Brand Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                            <ClipboardCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                Verify Lens Stock
                            </h1>
                            <p className="text-slate-500 font-medium mt-1 transition-all"> Reconcile manufacturer delivery with system records </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggle */}
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm mr-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold text-sm ${viewMode === 'list'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <Table className="w-4 h-4" />
                                List View
                            </button>
                            <button
                                onClick={() => setViewMode('matrix')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold text-sm ${viewMode === 'matrix'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <Grid3X3 className="w-4 h-4" />
                                Matrix View
                            </button>
                        </div>

                        <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${discrepancies.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                            <span className="text-sm font-bold text-slate-700">
                                {discrepancies.length} Discrepancies Found
                            </span>
                        </div>
                    </div>
                </div>

                {/* Search Panel */}
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200 border border-slate-100 p-8 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {/* Group Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">Group Name</label>
                            <div className="relative group">
                                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    value={filters.groupName}
                                    onChange={(e) => handleFilterChange('groupName', e.target.value)}
                                    placeholder="Select Group"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                                />
                            </div>
                        </div>

                        {/* Product / Item Name */}
                        <div className="lg:col-span-2 space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">Product / Item Name</label>
                            <div className="relative group">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <select
                                    value={filters.productName}
                                    onChange={(e) => handleFilterChange('productName', e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-sm font-medium appearance-none"
                                >
                                    <option value="">-- Select Product --</option>
                                    {items.map(item => (
                                        <option key={item._id} value={item.productName || item.itemName}>{item.productName || item.itemName}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronRight className="w-4 h-4 rotate-90" />
                                </div>
                            </div>
                        </div>

                        {/* Power Group Filter */}
                        <div className="space-y-2" ref={pgDropdownRef}>
                            <label className="text-sm font-bold text-slate-700 ml-1">
                                Power Group
                                {selectedPowerGroups.length > 0 && (
                                    <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 font-extrabold px-2 py-0.5 rounded-full">
                                        {selectedPowerGroups.length} selected
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!filters.productName) {
                                            toast.error('Please select a product first');
                                            return;
                                        }
                                        setPgDropdownOpen(prev => !prev);
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium transition-all outline-none
                                        ${!filters.productName ? 'opacity-60 cursor-not-allowed border-slate-200' : 'cursor-pointer border-slate-200 hover:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500'}`}
                                >
                                    <span className={selectedPowerGroups.length > 0 ? 'text-slate-800' : 'text-slate-400'}>
                                        {availablePowerGroups.length === 0 && filters.productName
                                            ? 'No saved power groups'
                                            : selectedPowerGroups.length === 0
                                                ? 'Select power ranges...'
                                                : `${selectedPowerGroups.length} range(s) selected`}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${pgDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {pgDropdownOpen && availablePowerGroups.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200 overflow-hidden">
                                        {/* Select All */}
                                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                            <label className="flex items-center gap-3 cursor-pointer group/all">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPowerGroups.length === availablePowerGroups.length && availablePowerGroups.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedPowerGroups(availablePowerGroups);
                                                        } else {
                                                            setSelectedPowerGroups([]);
                                                        }
                                                    }}
                                                    className="w-4 h-4 accent-indigo-600 rounded"
                                                />
                                                <span className="text-sm font-extrabold text-slate-700 group-hover/all:text-indigo-600 transition-colors">
                                                    Select All ({availablePowerGroups.length})
                                                </span>
                                            </label>
                                        </div>

                                        {/* Individual Groups */}
                                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                                            {availablePowerGroups.map((pg, idx) => {
                                                const isChecked = selectedPowerGroups.some((s, i) =>
                                                    s.sphMin === pg.sphMin && s.sphMax === pg.sphMax &&
                                                    s.cylMin === pg.cylMin && s.cylMax === pg.cylMax &&
                                                    s.addMin === pg.addMin && s.addMax === pg.addMax
                                                );
                                                const label = pg.label || `SPH: ${pg.sphMin ?? '?'} to ${pg.sphMax ?? '?'} | CYL: ${pg.cylMin ?? '?'} to ${pg.cylMax ?? '?'} | ADD: ${pg.addMin ?? '?'} to ${pg.addMax ?? '?'}`;

                                                return (
                                                    <label key={idx} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-indigo-50 ${isChecked ? 'bg-indigo-50/60' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedPowerGroups(prev => [...prev, pg]);
                                                                } else {
                                                                    setSelectedPowerGroups(prev => prev.filter((s) =>
                                                                        !(s.sphMin === pg.sphMin && s.sphMax === pg.sphMax &&
                                                                            s.cylMin === pg.cylMin && s.cylMax === pg.cylMax &&
                                                                            s.addMin === pg.addMin && s.addMax === pg.addMax)
                                                                    ));
                                                                }
                                                            }}
                                                            className="w-4 h-4 accent-indigo-600 mt-0.5 flex-shrink-0"
                                                        />
                                                        <span className="text-xs font-semibold text-slate-700 leading-relaxed">{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {/* Apply button */}
                                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPowerGroups([])}
                                                className="text-xs font-bold text-slate-500 hover:text-rose-500 transition-colors"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPgDropdownOpen(false)}
                                                className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
                                            >
                                                Done ✓
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Eye Filter + Action Buttons Row */}
                        <div className="xl:col-span-5 flex flex-wrap items-end gap-4 pt-2 border-t border-slate-100">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">Eye</label>
                                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                                    {['All', 'R', 'L'].map((eye) => (
                                        <button
                                            key={eye}
                                            onClick={() => handleFilterChange('eye', eye)}
                                            type="button"
                                            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${filters.eye === eye
                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {eye === 'All' ? 'Both' : eye}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-end gap-3 ml-auto">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".xlsx, .xls, .csv, .pdf"
                                    onChange={handleFileUpload}
                                />
                                {uploadedFileName && (
                                    <div className="flex flex-col items-center justify-center bg-indigo-50 border border-indigo-100 rounded-xl px-1">
                                        <div className="flex items-center gap-1.5 px-3 py-1">
                                            <span className="text-xs font-bold text-indigo-700 max-w-[120px] truncate" title={uploadedFileName}>
                                                {uploadedFileName}
                                            </span>
                                            <button
                                                onClick={handleRemoveFile}
                                                className="p-1 text-indigo-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                                title="Remove File"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                    title="Import Stock Quantities via Excel/PDF"
                                    className="px-6 py-3 font-bold transition-all flex items-center justify-center gap-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 hover:border-orange-300"
                                >
                                    <UploadCloud className="w-4 h-4" />
                                    Import
                                </button>
                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 py-3 font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                                >
                                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                                    Search Records
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all border border-slate-200"
                                    title="Reset Filters"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* Main Verification Table / Matrix */}
                    <div className="xl:col-span-3">
                        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <LayoutGrid className="w-5 h-5 text-indigo-500" />
                                    {viewMode === 'list' ? 'Items to Verify' : 'Verification Matrix'}
                                </h3>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">
                                    Showing {reportData.length} Variants
                                </span>
                            </div>

                            {viewMode === 'list' ? (
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                            <tr className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.1em]">
                                                <th className="px-6 py-4">Lens Configuration</th>
                                                <th className="px-6 py-4 text-center">Barcode</th>
                                                <th className="px-6 py-4 text-center">Expected Stock</th>
                                                <th className="px-6 py-4 text-center">Received Qty</th>
                                                <th className="px-6 py-4 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {reportData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-4">
                                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                                <Filter className="w-8 h-8 text-slate-200" />
                                                            </div>
                                                            <p className="text-slate-400 font-medium">
                                                                {searched ? "No variants found matching these filters" : "Use filters above to load stock data for verification"}
                                                            </p>
                                                        </div>
                                                    </td>

                                                </tr>
                                            ) : (
                                                reportData.map((row, index) => {
                                                    const received = receivedQuantities[row.barcode] ?? row.currentStock;
                                                    const isMatch = received === row.currentStock;

                                                    return (
                                                        <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${!isMatch ? 'bg-amber-50/30' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${row.eye === 'R' ? 'bg-blue-50 text-blue-600' : row.eye === 'L' ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-600'}`}>
                                                                        {row.eye || '—'}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 text-sm">SPH: {parseFloat(row.sph).toFixed(2)} | CYL: {parseFloat(row.cyl).toFixed(2)}</div>
                                                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">ADD: {parseFloat(row.addValue).toFixed(2)} | AXIS: {row.axis || 0}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center font-mono text-[11px] text-slate-500">{row.barcode || 'NO-BARCODE'}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg text-slate-700 font-extrabold text-sm">
                                                                    {row.currentStock}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <input
                                                                    type="number"
                                                                    value={receivedQuantities[row.barcode] ?? ''}
                                                                    placeholder={row.currentStock}
                                                                    onChange={(e) => handleQtyChange(row.barcode, e.target.value)}
                                                                    className={`w-20 px-3 py-2 text-center rounded-lg border-2 font-bold transition-all focus:ring-4 outline-none ${isMatch
                                                                        ? 'border-slate-100 bg-white focus:border-indigo-500 focus:ring-indigo-100'
                                                                        : 'border-amber-400 bg-white focus:border-amber-500 focus:ring-amber-100 text-amber-600'
                                                                        }`}
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-col items-end gap-1">
                                                                    {isMatch ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                                            Verified
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                                            Mis-match
                                                                        </span>
                                                                    )}
                                                                    {row.isVerified && (
                                                                        <div className="text-[9px] text-slate-400 font-medium">
                                                                            Last: {new Date(row.lastVerifiedDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                // Double Matrix View
                                <div className="p-6 space-y-10 max-h-[800px] overflow-y-auto">
                                    {reportData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <Grid3X3 className="w-16 h-16 text-slate-300 mb-4" />
                                            <p className="text-slate-500 font-medium">Load data to view stock matrix</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* 1. System Stock Matrix */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-slate-700">System Stock Details</h3>
                                                </div>
                                                <div className="overflow-x-auto rounded-xl border border-blue-200 shadow-sm">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead className="bg-blue-600 text-white">
                                                            <tr>
                                                                <th className="px-4 py-3 font-bold bg-blue-800 border-r border-blue-500 min-w-[100px]">SPH / CYL</th>
                                                                {[...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sph => (
                                                                    <th key={`h1-${sph}`} className="px-4 py-3 font-bold border-r border-blue-500 min-w-[80px]">
                                                                        {parseFloat(sph).toFixed(2)}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white">
                                                            {[...new Set(reportData.map(r => r.cyl))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(cyl => (
                                                                <tr key={`r1-${cyl}`} className="border-b border-blue-100 last:border-none">
                                                                    <td className="px-4 py-3 font-bold bg-blue-50 text-blue-800 border-r border-blue-200">
                                                                        {parseFloat(cyl).toFixed(2)}
                                                                    </td>
                                                                    {[...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sph => {
                                                                        const count = reportData
                                                                            .filter(r => r.sph === sph && r.cyl === cyl)
                                                                            .reduce((acc, r) => acc + (parseInt(r.currentStock) || 0), 0);
                                                                        return (
                                                                            <td key={`c1-${sph}-${cyl}`} className="px-4 py-3 border-r border-blue-100 text-slate-600 font-medium">
                                                                                {count || 0}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Comparison Action Bar */}
                                            <div className="flex items-center justify-center gap-4">
                                                <button
                                                    onClick={handleCompareMatrix}
                                                    className="px-8 py-3 bg-slate-800 text-white rounded-full font-bold shadow-lg shadow-slate-300 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                                                    Compare & Verify Stock
                                                </button>
                                                {comparisonResult && Object.values(comparisonResult).some(r => r.status === 'missing') && (
                                                    <button
                                                        onClick={handleCreatePO}
                                                        className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                    >
                                                        <ArrowRight className="w-5 h-5" />
                                                        Create Purchase Order
                                                    </button>
                                                )}
                                            </div>

                                            {/* 2. Physical Stock Input Matrix */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                                                    <h3 className="text-lg font-bold text-slate-700">Physical Verified Stock</h3>
                                                    <span className="text-xs text-slate-400 font-medium ml-2">(Enter manual counts below)</span>
                                                </div>
                                                <div className="overflow-x-auto rounded-xl border border-emerald-200 shadow-sm">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead className="bg-emerald-600 text-white">
                                                            <tr>
                                                                <th className="px-4 py-3 font-bold bg-emerald-800 border-r border-emerald-500 min-w-[100px]">SPH / CYL</th>
                                                                {[...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sph => (
                                                                    <th key={`h2-${sph}`} className="px-4 py-3 font-bold border-r border-emerald-500 min-w-[80px]">
                                                                        {parseFloat(sph).toFixed(2)}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white">
                                                            {[...new Set(reportData.map(r => r.cyl))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(cyl => (
                                                                <tr key={`r2-${cyl}`} className="border-b border-emerald-100 last:border-none">
                                                                    <td className="px-4 py-3 font-bold bg-emerald-50 text-emerald-800 border-r border-emerald-200">
                                                                        {parseFloat(cyl).toFixed(2)}
                                                                    </td>
                                                                    {[...new Set(reportData.map(r => r.sph))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(sph => {
                                                                        const key = `${parseFloat(sph).toFixed(2)}_${parseFloat(cyl).toFixed(2)}`;
                                                                        const result = comparisonResult ? comparisonResult[key] : null;

                                                                        let cellClass = "bg-white";
                                                                        if (result) {
                                                                            if (result.status === 'missing') cellClass = "bg-red-50 ring-2 ring-inset ring-red-200";
                                                                            else if (result.status === 'extra') cellClass = "bg-blue-50 ring-2 ring-inset ring-blue-200";
                                                                            else if (result.status === 'match' && result.expected > 0) cellClass = "bg-emerald-50 ring-2 ring-inset ring-emerald-200";
                                                                        }

                                                                        return (
                                                                            <td key={`c2-${sph}-${cyl}`} className={`p-2 border-r border-emerald-100 ${cellClass}`}>
                                                                                <div className="relative">
                                                                                    <input
                                                                                        type="number"
                                                                                        value={matrixInputs[key] ?? ''}
                                                                                        onChange={(e) => handleMatrixInput(sph, cyl, e.target.value)}
                                                                                        className={`w-full text-center font-bold bg-transparent outline-none py-1 rounded ${result && result.status !== 'match' ? 'text-red-600' : 'text-slate-700'}`}
                                                                                        placeholder="-"
                                                                                    />
                                                                                    {result && result.status !== 'match' && (
                                                                                        <div className="absolute -top-3 -right-2 bg-red-500 text-white text-[9px] px-1 rounded-full shadow-sm">
                                                                                            {result.diff > 0 ? `+${result.diff}` : result.diff}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Side Panel: Range & Summary */}
                    <div className="space-y-8">
                        {/* Range of Inconsistencies */}
                        <div className="bg-[#1E293B] rounded-[2rem] shadow-xl p-8 text-white relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-700"></div>

                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 relative z-10">
                                <BarChart3 className="w-6 h-6 text-indigo-400" />
                                Issue Ranges
                            </h3>

                            <div className="space-y-6 relative z-10">
                                {discrepancyRanges.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400 border-2 border-dashed border-slate-700 rounded-2xl">
                                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                            {reportData.length > 0 ? (
                                                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                            ) : (
                                                <Search className="w-6 h-6 text-slate-600" />
                                            )}
                                        </div>
                                        <p className="text-sm font-bold">
                                            {reportData.length > 0 ? "All items matching!" : "No records to display"}
                                        </p>
                                        <p className="text-[10px] uppercase mt-1 tracking-widest transition-all">
                                            {reportData.length > 0 ? "Stock is 100% accurate" : "Load stock data to see issues"}
                                        </p>
                                    </div>
                                ) : (
                                    discrepancyRanges.map((range, idx) => (
                                        <div key={idx} className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700 transition-all hover:border-indigo-500/50">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-bold text-indigo-400">{range.product}</h4>
                                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">EYE: {range.eye || 'Both'}</div>
                                                </div>
                                                <div className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black">{range.count} Errors</div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">SPH Range</span>
                                                    <span className="font-mono font-bold text-slate-200">{range.sphRange}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">CYL Range</span>
                                                    <span className="font-mono font-bold text-slate-200">{range.cylRange}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleCreatePO}
                                                className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-widest hover:text-indigo-300 transition-colors w-full"
                                            >
                                                [ Purchase Order ] <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Summary Action */}
                        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200 border border-slate-100 p-8 space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1">Finalize Batch</h3>
                                <p className="text-sm text-slate-500">Update inventory after verification</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-sm font-medium text-slate-600">Accuracy Rate</span>
                                    <span className={`text-lg font-black ${discrepancies.length === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {reportData.length > 0
                                            ? Math.max(0, Math.round(((reportData.length - discrepancies.length) / reportData.length) * 100))
                                            : 100}%
                                    </span>
                                </div>
                                <button
                                    onClick={handleConfirmStock}
                                    disabled={reportData.length === 0 || loading}
                                    className="w-full bg-slate-900 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5" />
                                    )}
                                    Confirm Stock Match
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
