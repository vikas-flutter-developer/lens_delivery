import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  RotateCcw,
  Printer,
  Columns,
  Check,
} from "lucide-react";
import { getAccountLedger, reconcileLedgerTransactions } from "../controllers/Ledger.controller";
import { getAllAccounts } from "../controllers/Account.controller";
import { FaWhatsapp } from "react-icons/fa";


import Papa from "papaparse";
import { FaFileCsv } from "react-icons/fa";
import { Toaster, toast } from "react-hot-toast";

function AccountLedger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchName, setSearchName] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);

  // opening/closing and search state
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Reconciliation states
  const [paymentReceived, setPaymentReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [reconciledIndices, setReconciledIndices] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Autocomplete states
  const [accounts, setAccounts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef(null);
  const hasAutoSearched = useRef(false);

  // Column Filter State
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const columnFilterRef = useRef(null);

  const ALL_COLUMNS = [
    { id: "sn", label: "SN" },
    { id: "date", label: "Date" },
    { id: "transType", label: "Transaction Type" },
    { id: "voucherNo", label: "Vch/Bill No" },
    { id: "debit", label: "Debit" },
    { id: "credit", label: "Credit" },
    { id: "balance", label: "Balance (Dr/Cr)" },
    { id: "shortNarr", label: "Short Narr" },
    { id: "remarks", label: "Remarks" },
    { id: "settlementDate", label: "Recv Date" },
    { id: "view", label: "View" },
  ];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("accountLedgerVisibleColumns");
    if (saved) return JSON.parse(saved);
    return {
      sn: true,
      date: true,
      transType: true,
      voucherNo: true,
      debit: true,
      credit: true,
      balance: true,
      shortNarr: true,
      remarks: true,
      settlementDate: true,
      view: true,
    };
  });

  useEffect(() => {
    localStorage.setItem("accountLedgerVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Close column filter when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (columnFilterRef.current && !columnFilterRef.current.contains(event.target)) {
        setShowColumnFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleColumn = (columnId) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  const activeVisibleCount = Object.values(visibleColumns).filter(Boolean).length;

  useEffect(() => {
    let mounted = true;
    const fetchAccounts = async () => {
      try {
        const res = await getAllAccounts();
        // API sometimes returns { data: [...] } or an array directly
        const dataArr = res?.data?.data ?? res?.data ?? res;
        if (mounted) setAccounts(Array.isArray(dataArr) ? dataArr : []);
      } catch (err) {
        console.error("Failed to load accounts for autocomplete", err);
        if (mounted) setAccounts([]);
      }
    };
    fetchAccounts();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle URL params for auto-fill and auto-search (from Outstanding page)
  useEffect(() => {
    const accountParam = searchParams.get("account");
    const fromDateParam = searchParams.get("fromDate");
    const toDateParam = searchParams.get("toDate");

    if (accountParam && !hasAutoSearched.current) {
      setSearchName(accountParam);
      if (fromDateParam) setFromDate(fromDateParam);
      if (toDateParam) setToDate(toDateParam);

      // Auto-search after a brief delay to allow state to update
      hasAutoSearched.current = true;
      setTimeout(async () => {
        try {
          setLoading(true);
          const params = {
            partyAccount: accountParam,
            fromDate: fromDateParam || undefined,
            toDate: toDateParam || undefined,
          };
          const resp = await getAccountLedger(params);
          const filteredRows = (resp?.data || []).filter(r => r.transType !== "Sale Order");
          setRows(filteredRows);
          setOpeningBalance(resp?.openingBalance ?? 0);
          setTotalDebit(resp?.totalDebit ?? 0);
          setTotalCredit(resp?.totalCredit ?? 0);
          setClosingBalance(resp?.closingBalance ?? 0);
          setHasSearched(true);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }, 100);
    }
  }, [searchParams]);

  // Close suggestions on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filterSuggestions = (input) => {
    const q = (input || "").trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const matches = accounts.filter((acc) => {
      const name = (acc.Name || "").toLowerCase();
      const phone = String(acc.contactNumber || "");
      return name.includes(q) || phone.includes(q);
    });
    setSuggestions(matches.slice(0, 10));
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectSuggestion = (acc) => {
    setSearchName(acc.Name || "");
    setSelectedPhone(acc.contactNumber || acc.MobileNumber || "");
    setShowSuggestions(false);
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const params = {
        partyAccount: searchName,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };
      const resp = await getAccountLedger(params);
      const filteredRows = (resp?.data || []).filter(r => r.transType !== "Sale Order");
      setRows(filteredRows);
      setOpeningBalance(resp?.openingBalance ?? 0);
      setTotalDebit(resp?.totalDebit ?? 0);
      setTotalCredit(resp?.totalCredit ?? 0);
      setClosingBalance(resp?.closingBalance ?? 0);
      setHasSearched(true);
      setReconciledIndices([]); // Reset reconciliation on new search
    } catch (err) {
      console.error(err);
      alert("Failed to fetch ledger. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSearchName("");
    setSelectedPhone("");
    setRows([]);
    setOpeningBalance(0);
    setClosingBalance(0);
    setHasSearched(false);
    setPaymentReceived("");
    setPaymentDate("");
    setPaymentReceived("");
    setPaymentDate("");
    setReconciledIndices([]);
    setSelectedRows([]);
  };

  const handleReconcile = (e) => {
    if (e.key === "Enter") {
      const amount = parseFloat(paymentReceived);
      if (isNaN(amount)) {
        alert("Please enter a valid amount");
        return;
      }

      const matched = [];
      rows.forEach((row, idx) => {
        // Only target unpaid rows
        if (row.settlementDate) return;

        const rowBalance = Math.abs(Number(row.balance || 0));
        // Requirement: "Update all rows together wherever balance <= entered amount"
        if (rowBalance <= amount + 0.01) {
          matched.push(idx);
        }
      });

      if (matched.length > 0) {
        setReconciledIndices(matched);
        toast.success(`Matched ${matched.length} rows. Click Confirm & Save to persist.`);
      } else {
        setReconciledIndices([]);
        toast.error("No unpaid rows found with balance <= this amount.");
      }
    }
  };

  const handleSaveSettlement = async () => {
    if (reconciledIndices.length === 0) return;
    if (!paymentDate) {
      toast.error("Please select a Payment Date first");
      return;
    }

    try {
      setIsSaving(true);
      // Update all matched rows that aren't already settled
      const transactionsToUpdate = rows
        .filter((_, idx) => reconciledIndices.includes(idx))
        .filter(r => !r.settlementDate)
        .map(r => ({
          sourceId: r.sourceId,
          transType: r.transType
        }));

      if (transactionsToUpdate.length === 0) {
        toast.info("All selected transactions are already settled.");
        setReconciledIndices([]);
        setPaymentReceived("");
        return;
      }

      const res = await reconcileLedgerTransactions({
        transactions: transactionsToUpdate,
        settlementDate: paymentDate
      });

      if (res.success) {
        toast.success(`Settled ${transactionsToUpdate.length} transactions.`);
        setReconciledIndices([]);
        setPaymentReceived("");
        handleSearch(); // Refresh the page to show result
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settlement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSingleSettlement = async (row, newDate) => {
    try {
      if (!newDate) return;
      setIsSaving(true);
      const res = await reconcileLedgerTransactions({
        transactions: [{ sourceId: row.sourceId, transType: row.transType }],
        settlementDate: newDate
      });
      if (res.success) {
        toast.success("Reception Date updated");
        handleSearch();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update date");
    } finally {
      setIsSaving(false);
    }
  };

  // Format a numeric balance as DR/CR string (no suffix for zero)
  const formatDrCr = (val) => {
    const n = Number(val || 0);
    if (n === 0) return "0.00";
    const side = n < 0 ? "CR" : "DR";
    return `${Math.abs(n).toFixed(2)} ${side}`;
  };

  const handleWhatsAppShare = () => {
    if (!hasSearched) {
      alert("Please search for a ledger first.");
      return;
    }

    // Construct the message
    let message = `*Ledger Statement for ${searchName}*\n`;
    if (fromDate && toDate) message += `Period: ${fromDate} to ${toDate}\n`;
    message += `--------------------------------\n`;
    message += `*Opening Balance:* ${formatDrCr(openingBalance)}\n`;
    message += `--------------------------------\n`;

    message += "`Date       | Vch   | Amount`\n";
    rows.forEach((r) => {
      const dateStr = new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
      const vch = r.voucherNo || "-";

      let amountStr = "";
      if (Number(r.debit) > 0) amountStr = `${Number(r.debit).toFixed(0)} Dr`;
      else if (Number(r.credit) > 0) amountStr = `${Number(r.credit).toFixed(0)} Cr`;
      else amountStr = "0";

      // Simple alignment attempt
      const datePad = dateStr.padEnd(11, " ").slice(0, 11);
      const vchPad = vch.padEnd(6, " ").slice(0, 6);

      message += `\`${datePad}| ${vchPad}| ${amountStr}\`\n`;
    });

    message += `--------------------------------\n`;
    message += `*Closing Balance:* ${formatDrCr(closingBalance)}\n`;

    const encodedMsg = encodeURIComponent(message);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Use api.whatsapp.com usually works best cross-platform
    const baseUrl = isMobile ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";

    // Explicitly doing NOT add phone number, so it opens contact selector (blanks)
    const url = `${baseUrl}?text=${encodedMsg}`;
    window.open(url, "_blank");
  };

  const handleExportCSV = () => {
    if (!rows.length) {
      alert("No data to export");
      return;
    }

    const csvData = rows.map(r => ({
      SN: r.sn,
      Date: new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
      "Transaction Type": r.transType,
      "Vch No": r.voucherNo,
      Debit: r.debit,
      Credit: r.credit,
      Balance: r.balance,
      Narr: r.shortNarr,
      Remarks: r.remarks
    }));

    // Add Opening/Closing rows manually if needed, or just transactions
    // For simplicity, let's just export transactions + summary

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ledger_${searchName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!hasSearched) {
      alert("Please search for a ledger first.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    // Determine which rows to print
    const rowsToPrint = selectedRows.length > 0 
      ? rows.filter((_, idx) => selectedRows.includes(idx))
      : rows;

    const openingRow = (hasSearched && selectedRows.length === 0) ? `
      <tr>
        <td style="border: 1px solid black; padding: 4px;">-</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px; font-weight: bold;">Opening Balance</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: right; font-weight: bold;">${formatDrCr(openingBalance)}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
      </tr>
    ` : "";

    const closingRow = (hasSearched && selectedRows.length === 0) ? `
      <tr>
        <td style="border: 1px solid black; padding: 4px;">-</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px; font-weight: bold;">Closing Balance</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: right; font-weight: bold;">${formatDrCr(closingBalance)}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
      </tr>
    ` : "";

    const tableRows = rowsToPrint.map(r => `
      <tr>
        <td style="border: 1px solid black; padding: 4px;">${r.sn}</td>
        <td style="border: 1px solid black; padding: 4px; white-space: nowrap;">${new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.transType}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.voucherNo || ""}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: right;">${Number(r.debit || 0).toFixed(2)}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: right;">${Number(r.credit || 0).toFixed(2)}</td>
        <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatDrCr(r.balance)}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.shortNarr || ""}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.remarks || ""}</td>
        <td style="border: 1px solid black; padding: 4px;">${r.settlementDate ? new Date(r.settlementDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head>
          <title>Ledger Statement - ${searchName}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h2 { text-align: center; margin-bottom: 5px; margin-top: 0; }
            h3 { text-align: center; margin-bottom: 20px; font-weight: normal; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; }
            th { border: 1px solid black; padding: 8px; background-color: #f2f2f2; }
            td { border: 1px solid black; padding: 6px; }
            @page { size: auto; margin: 10mm; }
          </style>
        </head>
        <body>
          <h2>Ledger Statement</h2>
          <h3>${searchName} ${fromDate && toDate ? "(" + fromDate + " to " + toDate + ")" : ""}</h3>
          <table>
            <thead>
              <tr>
                <th>SN</th>
                <th>Date</th>
                <th>Type</th>
                <th>Vch/Bill No</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
                <th>Short Narr</th>
                <th>Remarks</th>
                <th>Recv Date</th>
              </tr>
            </thead>
            <tbody>
              ${openingRow}
              ${tableRows}
              ${closingRow}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Navigate to transaction details based on type
  const handleView = (r) => {
    // If we have no ID, we can't really go to specific view
    const id = r.sourceId || r._id || r.id;
    if (!id) {
      alert("Transaction ID missing");
      return;
    }

    const type = (r.transType || "").toLowerCase();

    // Purchase
    if (type.includes("purchase challan")) {
      navigate(`/lenstransaction/purchase/AddLensPurchaseChallan/${id}`);
    } else if (type.includes("purchase order")) {
      navigate(`/lenstransaction/purchase/AddLensPurchaseOrder/${id}`);
    } else if (type.includes("purchase")) {
      // Covers "Purchase Invoice" and general "Purchase"
      navigate(`/lenstransaction/purchase/AddLensPurchase/${id}`);
    }
    // Sale
    else if (type.includes("sale challan")) {
      navigate(`/lenstransaction/sale/AddLensSaleChallan/${id}`);
    } else if (type.includes("sale order")) {
      navigate(`/lenstransaction/sale/AddLensSaleOrder/${id}`);
    } else if (type.includes("sale")) {
      // Covers "Sale Invoice" and general "Sale"
      navigate(`/lenstransaction/sale/AddLensSale/${id}`);
    } else {
      console.warn("Unknown transaction type for navigation:", type);
      alert(`Cannot view details for transaction type: ${r.transType}`);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-2xl min-h-screen">
      {/* Header */}
      <h2 className="text-lg font-semibold text-black px-4 py-2 rounded mb-3 print:hidden">
        Ledger Book
      </h2>

      {/* Print Header - Only visible on print */}
      <div className="hidden print:block mb-4 text-center">
        <h1 className="text-2xl font-bold">Ledger Statement</h1>
        <h2 className="text-xl">{searchName}</h2>
        {fromDate && toDate && <p>Period: {fromDate} to {toDate}</p>}
      </div>

      {/* Filters - One Line */}
      <div className="bg-blue-50 p-3 rounded-md shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          {/* Date From */}
          <div className="w-[130px]">
            <label className="text-xs font-medium text-gray-700">Date From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Date To */}
          <div className="w-[130px]">
            <label className="text-xs font-medium text-gray-700">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>

          {/* Search Name (with autocomplete) */}
          <div className="w-[180px]" ref={containerRef}>
            <label className="text-xs font-medium text-gray-700">
              Search Name / Mob
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  filterSuggestions(e.target.value);
                }}
                onFocus={() => filterSuggestions(searchName)}
                placeholder="Name / Mob"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              />

              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-md max-h-48 overflow-auto z-50 rounded">
                  {suggestions.map((acc) => (
                    <li
                      key={acc._id || acc.id || acc.Name}
                      onClick={() => handleSelectSuggestion(acc)}
                      className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                      title={acc.Name}
                    >
                      <div className="text-sm font-medium">{acc.Name}</div>
                      <div className="text-xs text-gray-500">{acc.contactNumber || acc.mobile || ""}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="w-[140px]">
            <label className="text-xs font-medium text-gray-700">Payment Receive</label>
            <input
              type="number"
              value={paymentReceived}
              onChange={(e) => setPaymentReceived(e.target.value)}
              onKeyDown={handleReconcile}
              placeholder="Enter Amount"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="w-[130px]">
            <label className="text-xs font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {reconciledIndices.length > 0 && (
            <div className="flex items-end pb-[2px]">
              <button
                onClick={handleSaveSettlement}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded shadow-md font-bold flex items-center gap-1 animate-pulse"
              >
                {isSaving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-1 items-end pb-[2px] ml-auto">
            <button onClick={handleSearch} className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-2 rounded shadow-sm">
              <Search size={16} />
              {loading ? "Searching..." : "Search"}
            </button>

            <button onClick={handleReset} className="flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-sm px-3 py-2 rounded shadow-sm">
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded shadow-sm" title="Export CSV">
            <FaFileCsv size={20} />
          </button>

          <button onClick={handleWhatsAppShare} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded shadow-sm" title="WhatsApp Share">
            <FaWhatsapp size={20} />
          </button>

          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow-sm" title="Print">
            <Printer size={20} />
          </button>

          <div className="relative" ref={columnFilterRef}>
            <button
              onClick={() => setShowColumnFilter(!showColumnFilter)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded shadow-sm hover:bg-gray-50 transition-all duration-200 uppercase tracking-wider"
            >
              <Columns className="w-4 h-4" />
              Columns
            </button>

            {showColumnFilter && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-3 animate-in fade-in zoom-in duration-200 ring-4 ring-gray-900/5">
                <div className="px-4 py-1 border-b border-gray-100 mb-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Display Columns</p>
                </div>
                <div className="max-h-[350px] overflow-y-auto px-2 space-y-0.5">
                  {ALL_COLUMNS.map((col) => (
                    <div
                      key={col.id}
                      onClick={() => toggleColumn(col.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${visibleColumns[col.id] ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-gray-50 text-gray-400 font-medium"}`}
                    >
                      <span className="text-xs uppercase tracking-wider">
                        {col.label}
                      </span>
                      {visibleColumns[col.id] && <Check className="w-4 h-4" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 print:bg-white">
            <tr>
              {visibleColumns.sn && (
                <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="print:hidden"
                      checked={rows.length > 0 && selectedRows.length === rows.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRows(rows.map((_, i) => i));
                        else setSelectedRows([]);
                      }}
                    />
                    <span>SN</span>
                  </div>
                </th>
              )}
              {visibleColumns.date && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">Date</th>}
              {visibleColumns.transType && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">Transaction Type</th>}
              {visibleColumns.voucherNo && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">Vch/Bill No</th>}
              {visibleColumns.debit && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-right print:border-black">Debit</th>}
              {visibleColumns.credit && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-right print:border-black">Credit</th>}
              {visibleColumns.balance && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-right print:border-black">Balance (Dr/Cr)</th>}
              {visibleColumns.shortNarr && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">Short Narr</th>}
              {visibleColumns.remarks && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">Remarks</th>}
              {visibleColumns.settlementDate && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:border-black">Recv Date</th>}
              {visibleColumns.view && <th className="border border-gray-200 px-2 py-2 font-semibold text-gray-700 text-left print:hidden">View</th>}
            </tr>
          </thead>

          <tbody>
            {searchName && (
              <tr className="print:hidden">
                <td colSpan={activeVisibleCount} className="text-center py-2 font-semibold bg-gray-50 print:bg-white print:border-black uppercase tracking-wider">{searchName}</td>
              </tr>
            )}

            {hasSearched && (
              <tr className={`bg-gray-50 font-semibold print:bg-white ${selectedRows.length > 0 ? "print:hidden" : ""} ${reconciledIndices.length > 0 ? "bg-yellow-50" : ""}`}>
                {visibleColumns.sn && <td className="border px-2 py-1 print:border-black">-</td>}
                {visibleColumns.date && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.transType && <td className="border px-2 py-1 print:border-black">Opening Balance</td>}
                {visibleColumns.voucherNo && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.debit && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.credit && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.balance && <td className="border px-2 py-1 text-right print:border-black">{formatDrCr(openingBalance)}</td>}
                {visibleColumns.shortNarr && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.remarks && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.settlementDate && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.view && <td className="border px-2 py-1 print:border-black"></td>}
              </tr>
            )}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={activeVisibleCount} className="text-center py-10 text-gray-500">
                  {loading
                    ? "Please wait..."
                    : hasSearched
                      ? "No transactions in this range."
                      : "No data. Use the filters and press Search."}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const isSavedReconciled = !!r.settlementDate;
                const isTempReconciled = reconciledIndices.includes(idx) && !isSavedReconciled;

                let rowBg = "";
                if (isSavedReconciled) rowBg = "bg-green-50/50";
                else if (isTempReconciled) rowBg = "bg-yellow-50";
                else if (r.transType === "Sale Order") rowBg = "bg-blue-50/30";

                return (
                  <tr key={idx} className={`${rowBg} ${selectedRows.length > 0 && !selectedRows.includes(idx) ? "print:hidden" : ""} print:bg-white border-b transition-colors duration-200 hover:bg-gray-50/80`}>
                    {visibleColumns.sn && (
                      <td className="border px-2 py-1 print:border-black">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="print:hidden"
                            checked={selectedRows.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedRows([...selectedRows, idx]);
                              else setSelectedRows(selectedRows.filter(i => i !== idx));
                            }}
                          />
                          <span>{r.sn}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.date && <td className="border px-2 py-1 print:border-black whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>}
                    {visibleColumns.transType && <td className="border px-2 py-1 print:border-black">{r.transType}</td>}
                    {visibleColumns.voucherNo && <td className="border px-2 py-1 print:border-black">{r.voucherNo}</td>}
                    {visibleColumns.debit && (
                      <td className={`border px-2 py-1 text-right print:border-black ${isTempReconciled ? "font-medium text-blue-700 underline decoration-blue-200" : ""}`}>
                        {Number(r.debit || 0).toFixed(2)}
                      </td>
                    )}
                    {visibleColumns.credit && (
                      <td className={`border px-2 py-1 text-right print:border-black ${isTempReconciled ? "font-medium text-blue-700 underline decoration-blue-200" : ""}`}>
                        {Number(r.credit || 0).toFixed(2)}
                      </td>
                    )}
                    {visibleColumns.balance && (
                      <td className={`border px-2 py-1 text-right print:border-black ${isTempReconciled ? "font-bold bg-yellow-100 ring-1 ring-yellow-300 ring-inset" : (isSavedReconciled ? "font-medium bg-green-100/50 text-green-800" : "")}`}>
                        {formatDrCr(r.balance)}
                      </td>
                    )}
                    {visibleColumns.shortNarr && <td className="border px-2 py-1 print:border-black">{r.shortNarr}</td>}
                    {visibleColumns.remarks && <td className="border px-2 py-1 print:border-black">{r.remarks}</td>}
                    {visibleColumns.settlementDate && (
                      <td className={`border px-2 py-1 print:border-black text-center font-medium ${isTempReconciled ? "animate-pulse" : ""}`}>
                        {isSavedReconciled ? (
                          <input
                            type="date"
                            className="text-green-700 bg-green-50 border border-green-200 rounded-full text-[10px] px-1 py-0.5 cursor-pointer hover:bg-green-100 focus:outline-none focus:ring-1 focus:ring-green-400"
                            value={new Date(r.settlementDate).toISOString().split("T")[0]}
                            onChange={(e) => handleUpdateSingleSettlement(r, e.target.value)}
                            title="Click to update reception date"
                          />
                        ) : isTempReconciled ? (
                          <span className="text-blue-600 font-bold border-b border-dashed border-blue-400">
                            {paymentDate || "SET DATE"}
                          </span>
                        ) : ""}
                      </td>
                    )}
                    {visibleColumns.view && (
                      <td
                        className="border px-2 py-1 print:hidden text-center cursor-pointer text-blue-600 hover:underline"
                        onClick={() => handleView(r)}
                      >
                        View
                      </td>
                    )}
                  </tr>
                );
              })
            )}

            {hasSearched && (
              <tr className={`bg-gray-100 font-semibold print:bg-white ${selectedRows.length > 0 ? "print:hidden" : ""}`}>
                {visibleColumns.sn && <td className="border px-2 py-1 print:border-black">-</td>}
                {visibleColumns.date && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.transType && <td className="border px-2 py-1 print:border-black">Closing Balance</td>}
                {visibleColumns.voucherNo && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.debit && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.credit && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.balance && <td className="border px-2 py-1 text-right print:border-black">{formatDrCr(closingBalance ?? openingBalance ?? 0)}</td>}
                {visibleColumns.shortNarr && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.remarks && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.settlementDate && <td className="border px-2 py-1 print:border-black"></td>}
                {visibleColumns.view && <td className="border px-2 py-1 print:border-black"></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountLedger;
