import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
    Search,
    RotateCcw,
    FileSpreadsheet,
    Printer,
    ChevronDown,
    Package,
    RefreshCw,
    FileText,
    Columns,
    Upload,
    X,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    ArrowUpRight,
    ArrowDownLeft,
    TrendingUp,
    TrendingDown,
    Activity
} from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { getBankVerificationTransactions } from '../controllers/Reports.controller';

import { getAllAccounts } from '../controllers/Account.controller';
import toast from 'react-hot-toast';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function VerifyBankStatement() {
    const navigate = useNavigate();
    const location = useLocation();

    const [systemTransactions, setSystemTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [showAccountSuggestions, setShowAccountSuggestions] = useState(false);
    const [viewMode, setViewMode] = useState('system'); // 'system' or 'comparison'


    // File Upload States
    const [uploadedFile, setUploadedFile] = useState(null);
    const [fileData, setFileData] = useState([]);
    const [comparisonResults, setComparisonResults] = useState([]);
    const [summary, setSummary] = useState({
        total: 0,
        matched: 0,
        mismatched: 0,
        missing: 0,
        totalCredit: 0,
        totalDebit: 0
    });

    const fileInputRef = React.useRef(null);

    // Default dates - current month
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
        accountName: '',
        searchText: '',
        status: 'All',
        amountMin: '',
        amountMax: ''
    });

    const [visibleColumns, setVisibleColumns] = useState({
        sNo: true,
        date: true,
        source: true,
        credit: true,
        debit: true,
        totalAmount: true,
        systemAmount: true,
        difference: true,
        status: true,
        error: true
    });

    const columnLabels = {
        sNo: 'S.No',
        date: 'Date',
        source: 'Source',
        credit: 'Credit',
        debit: 'Debit',
        totalAmount: 'Total Amount',
        systemAmount: 'System Amount',
        difference: 'Difference',
        status: 'Status',
        error: 'Error Description'
    };

    useEffect(() => {
        fetchAccounts();
        handleSearch();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await getAllAccounts();
            setAccounts(Array.isArray(res) ? res : res.data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const res = await getBankVerificationTransactions(filters);
            if (res.success) {
                const txns = res.data || [];
                setSystemTransactions(txns);
                setViewMode('system');
                setComparisonResults([]); 
                
                if (fileData.length > 0) {
                    // We don't auto-verify to allow user to see system data first
                }
            }
        } catch (error) {
            toast.error('Failed to fetch system transactions');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        const d = getDefaultDates();
        setFilters({
            dateFrom: d.dateFrom,
            dateTo: d.dateTo,
            accountName: '',
            searchText: '',
            status: 'All',
            amountMin: '',
            amountMax: ''
        });
        setFileData([]);
        setUploadedFile(null);
        setComparisonResults([]);
        setViewMode('system');
        setSummary({
            total: 0, matched: 0, mismatched: 0, missing: 0, totalCredit: 0, totalDebit: 0
        });
    };


    const clearUploadedFile = () => {
        setFileData([]);
        setUploadedFile(null);
        setComparisonResults([]);
        setViewMode('system');
        setSummary({
            total: 0, matched: 0, mismatched: 0, missing: 0, totalCredit: 0, totalDebit: 0
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };


    const normalizeDate = (d) => {
        if (!d) return null;
        
        let date;
        // Handle JS Date objects (returned by XLSX with cellDates: true)
        if (d instanceof Date) {
            date = d;
        } 
        // Handle Excel serial numbers if they come through as numbers
        else if (typeof d === 'number') {
            // Excel serial dates start from 1900-01-01. 25569 is the offset for Unix epoch.
            date = new Date(Math.round((d - 25569) * 86400 * 1000));
        } else {
            const dateStr = String(d).trim();
            // Try DD/MM/YYYY or DD-MM-YYYY first (Common in India)
            const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dmyMatch) {
                let [_, day, month, year] = dmyMatch;
                if (year.length === 2) year = "20" + year;
                date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            } else {
                // Fallback to standard JS parsing (Handles YYYY-MM-DD and MM/DD/YYYY)
                date = new Date(dateStr);
            }
        }

        if (!date || isNaN(date.getTime())) return null;
        
        // Return YYYY-MM-DD string for strict matching
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };


    const cleanNumeric = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    };

    const processUploadedData = (data) => {
        const getVal = (row, patterns) => {
            for (const p of patterns) {
                const key = Object.keys(row).find((k) =>
                    k.toLowerCase().includes(p.toLowerCase())
                );
                if (key) return row[key];
            }
            return "";
        };

        const mappedData = data.map(row => {
            const dateRaw = getVal(row, ["date", "txn date", "value date", "transaction date"]);
            const creditRaw = getVal(row, ["credit", "cr", "deposit", "inward"]);
            const debitRaw = getVal(row, ["debit", "dr", "withdrawal", "outward", "payment"]);
            const amountRaw = getVal(row, ["total", "amount", "net amount", "balance"]);

            const date = normalizeDate(dateRaw);
            const credit = cleanNumeric(creditRaw);
            const debit = cleanNumeric(debitRaw);
            // If total amount is missing, calculate as credit + debit
            let amount = cleanNumeric(amountRaw);
            if (amount === 0) amount = credit || debit;

            return {
                date,
                credit,
                debit,
                amount,
                raw: row
            };
        }).filter(r => r.date && (r.credit > 0 || r.debit > 0 || r.amount > 0));

        if (mappedData.length === 0) {
            toast.error("No valid transactions found in file. Ensure Date, Credit/Debit columns exist.");
            return;
        }

        setFileData(mappedData);
        toast.success(`Loaded ${mappedData.length} bank transactions. Click Verify to compare.`);

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
                    const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json(ws);

                    processUploadedData(data);
                } catch (err) {
                    toast.error("Failed to parse Excel file");
                }
            };
            reader.readAsBinaryString(file);
        } else if (file.name.endsWith(".pdf")) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                let textData = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    textData.push(pageText);
                }

                let rawRows = [];
                const rowRegex = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+(.*?)\s+([\d,]+\.\d{2})/g;
                
                textData.forEach(text => {
                    let match;
                    while ((match = rowRegex.exec(text)) !== null) {
                        rawRows.push({
                            date: match[1],
                            description: match[2],
                            amount: match[3]
                        });
                    }
                });

                if (rawRows.length > 0) {
                    processUploadedData(rawRows);
                } else {
                    toast.error("Could not find any transaction patterns in PDF. Try Excel.");
                }
            } catch (err) {
                toast.error("PDF parsing failed");
            }
        }
        e.target.value = "";
    };

    const runVerification = (sysData, bankData) => {
        let matchedCount = 0;
        let mismatchedCount = 0;
        let missingInSystem = 0;
        let totalCredit = 0;
        let totalDebit = 0;

        // Essential for 100% accuracy: Track which system transactions are already matched
        // to prevent duplicate matches if multiple identical transactions exist on the same day.
        const matchedSystemIds = new Set();

        const results = bankData.map((bRow, idx) => {
            totalCredit += bRow.credit;
            totalDebit += bRow.debit;

            // Strict Filter for 1-to-1 Match
            // We search for an EXACT match first (Date + Exact Amount)
            const exactMatch = sysData.find(sRow => {
                const sDate = normalizeDate(sRow.date);
                const sDebit = cleanNumeric(sRow.debit);
                const sCredit = cleanNumeric(sRow.credit);
                
                // Bank Credit (In) = System Debit | Bank Debit (Out) = System Credit
                const isCorrectType = bRow.credit > 0 
                    ? Math.abs(sDebit - bRow.credit) < 0.001 
                    : Math.abs(sCredit - bRow.debit) < 0.001;

                const uniqueId = sRow.docId || `${sRow.vchNo}_${sRow.date}_${sRow.amount}`;
                
                return sDate === bRow.date && isCorrectType && !matchedSystemIds.has(uniqueId);
            });

            if (exactMatch) {
                const uniqueId = exactMatch.docId || `${exactMatch.vchNo}_${exactMatch.date}_${exactMatch.amount}`;
                matchedSystemIds.add(uniqueId);
                matchedCount++;
                
                return {
                    sNo: idx + 1,
                    date: bRow.date,
                    source: "Bank Statement",
                    credit: bRow.credit,
                    debit: bRow.debit,
                    totalAmount: bRow.amount, // Uploaded File Amount
                    systemAmount: cleanNumeric(exactMatch.debit || exactMatch.credit), // System Data Amount
                    difference: 0,
                    status: "Matched",
                    error: "100% Match Found",
                    sysTxn: exactMatch
                };
            } else {
                // If no exact match found, check for Date-only matches to identify Amount Mismatches
                const dateMatches = sysData.filter(sRow => {
                    const uniqueId = sRow.docId || `${sRow.vchNo}_${sRow.date}_${sRow.amount}`;
                    return normalizeDate(sRow.date) === bRow.date && !matchedSystemIds.has(uniqueId);
                });

                if (dateMatches.length > 0) {
                    // It's a mismatch because no exact amount matched on this date
                    mismatchedCount++;
                    const primaryMatch = dateMatches[0];
                    const sAmt = cleanNumeric(primaryMatch.debit || primaryMatch.credit);
                    
                    return {
                        sNo: idx + 1,
                        date: bRow.date,
                        source: "Bank Statement",
                        credit: bRow.credit,
                        debit: bRow.debit,
                        totalAmount: bRow.amount,
                        systemAmount: sAmt,
                        difference: Math.abs(bRow.amount - sAmt),
                        status: "Amount Mismatch",
                        error: `System record shows ${sAmt} (${primaryMatch.transType})`,
                        sysTxn: primaryMatch
                    };
                } else {
                    // No system records at all for this date
                    missingInSystem++;
                    return {
                        sNo: idx + 1,
                        date: bRow.date,
                        source: "Bank Statement",
                        credit: bRow.credit,
                        debit: bRow.debit,
                        totalAmount: bRow.amount,
                        systemAmount: 0,
                        difference: bRow.amount,
                        status: "Missing in System",
                        error: "No matching record available in system",
                        sysTxn: null
                    };
                }
            }
        });

        setComparisonResults(results);
        setViewMode('comparison');
        setSummary({
            total: bankData.length,
            matched: matchedCount,
            mismatched: mismatchedCount,
            missing: missingInSystem,
            totalCredit,
            totalDebit
        });
    };

    const handleVerify = () => {
        if (!systemTransactions.length) {
            toast.error("Please search system transactions first");
            return;
        }
        if (!fileData.length) {
            toast.error("Please upload a bank statement first");
            return;
        }
        runVerification(systemTransactions, fileData);
    };


    const handleExport = () => {
        if (comparisonResults.length === 0) {
            toast.error("No data to export");
            return;
        }
        const ws = XLSX.utils.json_to_sheet(comparisonResults.map(r => ({
            "S.No": r.sNo,
            "Date": r.date,
            "Credit": r.credit,
            "Debit": r.debit,
            "Uploaded Amount": r.totalAmount,
            "System Amount": r.systemAmount,
            "Status": r.status,
            "Difference": r.difference,
            "Error/Details": r.error
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
        XLSX.writeFile(wb, `BankVerification_${new Date().toISOString().split('T')[0]}.xlsx`);
    };



    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
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

                {/* Summary Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Txns</span>
                            <Activity className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-800 tabular-nums">
                            {viewMode === 'system' ? systemTransactions.length : summary.total}
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-blue-500 w-full" />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Matched</span>
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-emerald-600 tabular-nums">{summary.matched}</div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${(summary.matched / (summary.total || 1)) * 100}%` }} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Mismatched</span>
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="text-2xl font-black text-amber-600 tabular-nums">{summary.mismatched}</div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${(summary.mismatched / (summary.total || 1)) * 100}%` }} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Missing</span>
                            <HelpCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="text-2xl font-black text-red-600 tabular-nums">{summary.missing}</div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${(summary.missing / (summary.total || 1)) * 100}%` }} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Credit</span>
                            <ArrowUpRight className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="text-xl font-black text-green-700 tabular-nums">
                            ₹{(viewMode === 'system' 
                                ? systemTransactions.reduce((sum, t) => sum + (t.credit || 0), 0)
                                : summary.totalCredit
                            ).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-green-600 font-bold mt-2 uppercase tracking-tighter">Inward Cashflow</div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Debit</span>
                            <ArrowDownLeft className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="text-xl font-black text-red-700 tabular-nums">
                            ₹{(viewMode === 'system' 
                                ? systemTransactions.reduce((sum, t) => sum + (t.debit || 0), 0)
                                : summary.totalDebit
                            ).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-red-600 font-bold mt-2 uppercase tracking-tighter">Outward Cashflow</div>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date From</label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date To</label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 relative min-w-[200px]">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account / Bank</label>
                            <input
                                type="text"
                                value={filters.accountName}
                                onChange={(e) => {
                                    handleFilterChange('accountName', e.target.value);
                                    setShowAccountSuggestions(true);
                                }}
                                onFocus={() => setShowAccountSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAccountSuggestions(false), 200)}
                                placeholder="Select Bank Account..."
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                            {showAccountSuggestions && accounts.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white mt-1 rounded-xl shadow-xl border border-slate-200 z-[100] max-h-60 overflow-y-auto">
                                    {accounts.filter(a => a.Name?.toLowerCase().includes(filters.accountName.toLowerCase())).map(acc => (
                                        <div
                                            key={acc._id}
                                            onMouseDown={() => {
                                                handleFilterChange('accountName', acc.Name);
                                                setShowAccountSuggestions(false);
                                            }}
                                            className="px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0"
                                        >
                                            {acc.Name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={filters.searchText}
                                    onChange={(e) => handleFilterChange('searchText', e.target.value)}
                                    placeholder="Search by Amount, Voucher No, Narration..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 ml-auto">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".xlsx,.xls,.pdf"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm"
                            >
                                <Upload className="w-4 h-4" />
                                Upload Bank Statement
                            </button>
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Search
                            </button>
                            <button
                                onClick={handleVerify}
                                disabled={!fileData.length || loading}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Verify
                            </button>

                            <button
                                onClick={handleReset}
                                className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition"
                                title="Reset Filters"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Verification Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-700">Verification Results</h3>
                            {uploadedFile && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-bold border border-blue-100 flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> 
                                    {uploadedFile}
                                    <button 
                                        onClick={clearUploadedFile}
                                        className="hover:text-red-500 transition-all p-0.5 rounded-full hover:bg-red-50"
                                        title="Remove File"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Export Excel"
                            >
                                <FileSpreadsheet className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition"
                                title="Print Report"
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
                                    <th className="px-6 py-4 w-12 text-center">#</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Source</th>
                                    <th className="px-6 py-4 text-right">Credit</th>
                                    <th className="px-6 py-4 text-right">Debit</th>
                                    <th className="px-6 py-4 text-right">Uploaded Amount (File)</th>
                                    <th className="px-6 py-4 text-right">System Amount</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4">Error / Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {viewMode === 'comparison' && comparisonResults.length > 0 ? (
                                    comparisonResults.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group animate-in fade-in duration-300">
                                            <td className="px-6 py-4 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                                            <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap tabular-nums">
                                                {row.date || '-'}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-600">{row.source}</span>
                                                    {row.sysTxn && (
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                                                            {row.sysTxn.transType} | {row.sysTxn.vchNo}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-bold tabular-nums">
                                                {row.credit > 0 ? `₹${row.credit.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-red-600 font-bold tabular-nums">
                                                {row.debit > 0 ? `₹${row.debit.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-blue-900 font-black tabular-nums">
                                                ₹{row.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400 font-medium tabular-nums">
                                                ₹{row.systemAmount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                                        row.status === 'Matched' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                        row.status === 'Amount Mismatch' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                        'bg-red-100 text-red-700 border border-red-200'
                                                    }`}>
                                                        {row.status === 'Matched' ? <CheckCircle2 className="w-3 h-3" /> : 
                                                         row.status === 'Amount Mismatch' ? <AlertCircle className="w-3 h-3" /> : 
                                                         <HelpCircle className="w-3 h-3" />}
                                                        {row.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-semibold ${row.status === 'Matched' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {row.error || "No issues detected"}
                                                    </span>
                                                    {row.difference > 0 && (
                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                            Difference: ₹{row.difference.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : viewMode === 'system' && systemTransactions.length > 0 ? (
                                    systemTransactions.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group animate-in slide-in-from-left duration-300">
                                            <td className="px-6 py-4 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                                            <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap tabular-nums">
                                                {row.date || '-'}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-600">{row.transType}</span>
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{row.vchNo}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-bold tabular-nums">
                                                {row.credit > 0 ? `₹${row.credit.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-red-600 font-bold tabular-nums">
                                                {row.debit > 0 ? `₹${row.debit.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-300 tabular-nums">-</td>
                                            <td className="px-6 py-4 text-right text-slate-600 font-bold tabular-nums">
                                                ₹{(row.credit || row.debit || row.amount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase tracking-tight">System Data</span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-400 italic">
                                                {row.remark || "N/A"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-20 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-3 opacity-60">
                                                <Search className="w-12 h-12 text-slate-300" />
                                                <p className="text-lg font-medium">Use Search to fetch records or Upload to verify</p>
                                                <p className="text-sm">Fetched {systemTransactions.length} system records</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
