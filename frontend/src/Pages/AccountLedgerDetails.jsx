import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  RotateCcw,
  Mail,
  MessageCircle,
  Printer,
  ChevronDown,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { getAccountLedger } from "../controllers/Ledger.controller";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllAccountGroups } from "../controllers/AccountGroupController";

function AccountLedgerDetails() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchName, setSearchName] = useState("");
  const [stationName, setStationName] = useState("");
  const [accountGroup, setAccountGroup] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);

  // opening/closing and search state
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Column selection
  const [selectedColumns, setSelectedColumns] = useState({
    sn: true,
    date: true,
    voucherType: true,
    voucherDetail: true,
    itemName: true,
    orderNo: true,
    eye: true,
    sph: true,
    cyl: true,
    axis: true,
    add: true,
    lensPower: true,
    qty: true,
    price: true,
    amount: true,
    debit: true,
    credit: true,
    balance: true,
    remarks: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Autocomplete states
  const [accounts, setAccounts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [accountGroups, setAccountGroups] = useState([]);
  const containerRef = useRef(null);
  const columnDropdownRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        // Fetch accounts
        const res = await getAllAccounts();
        const dataArr = res?.data?.data ?? res?.data ?? res;
        if (mounted) setAccounts(Array.isArray(dataArr) ? dataArr : []);

        // Fetch account groups
        const groupRes = await getAllAccountGroups();
        const groupDataArr = groupRes?.data?.data ?? groupRes?.data ?? groupRes;
        if (mounted) setAccountGroups(Array.isArray(groupDataArr) ? groupDataArr : []);
      } catch (err) {
        console.error("Failed to load accounts/groups for filters", err);
        if (mounted) {
          setAccounts([]);
          setAccountGroups([]);
        }
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target)) {
        setShowColumnDropdown(false);
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
    setShowSuggestions(false);
  };

  const handleSearch = async () => {
    try {
      if (!searchName.trim()) {
        toast.error("Please select an account name");
        return;
      }

      setLoading(true);
      const params = {
        partyAccount: searchName,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      const resp = await getAccountLedger(params);

      if (resp.success) {
        const filteredRows = (resp?.data || []).filter(r => r.transType !== "Sale Order");
        setRows(filteredRows);
        setOpeningBalance(resp?.openingBalance ?? 0);
        setTotalDebit(resp?.totalDebit ?? 0);
        setTotalCredit(resp?.totalCredit ?? 0);
        setClosingBalance(resp?.closingBalance ?? 0);
        setHasSearched(true);
        toast.success(`Loaded ${resp?.count || 0} transactions`);
      } else {
        toast.error(resp?.message || "Failed to fetch ledger");
      }
    } catch (err) {
      console.error("Ledger fetch error:", err);
      toast.error("Failed to fetch ledger. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSearchName("");
    setStationName("");
    setAccountGroup("");
    setRows([]);
    setOpeningBalance(0);
    setClosingBalance(0);
    setHasSearched(false);
    setSelectedRows([]);
  };

  const handlePrint = () => {
    if (!hasSearched) {
      alert("Please search first.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    // Determine which transactions to print
    const rowsToPrint = selectedRows.length > 0 
      ? rows.filter((_, idx) => selectedRows.includes(idx))
      : rows;

    const openingRow = (hasSearched && selectedRows.length === 0) ? `
      <tr style="font-weight: bold; background-color: #f9f9f9;">
        <td style="border: 1px solid black; padding: 4px; text-align: center;">-</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">Opening</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatDrCr(openingBalance)}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
      </tr>
    ` : "";

    const closingRow = (hasSearched && selectedRows.length === 0) ? `
      <tr style="font-weight: bold; background-color: #f2f2f2;">
        <td style="border: 1px solid black; padding: 4px; text-align: center;">-</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;">Closing</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px;"></td>
        <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatDrCr(closingBalance)}</td>
        <td style="border: 1px solid black; padding: 4px;"></td>
      </tr>
    ` : "";

    const tableRows = rowsToPrint.map((r, idx) => {
      const items = r.items || [];
      if (items.length === 0) {
        return `
          <tr>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${idx+1}</td>
            <td style="border: 1px solid black; padding: 4px;">${new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
            <td style="border: 1px solid black; padding: 4px;">${r.transType}</td>
            <td style="border: 1px solid black; padding: 4px;">${r.voucherNo || ""}</td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px;"></td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${Number(r.debit || 0).toFixed(2)}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${Number(r.credit || 0).toFixed(2)}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatDrCr(r.balance)}</td>
            <td style="border: 1px solid black; padding: 4px; font-size: 8pt;">${r.remarks || ""}</td>
          </tr>
        `;
      }
      return items.map((item, i) => `
          <tr>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${i === 0 ? idx + 1 : ""}</td>
            <td style="border: 1px solid black; padding: 4px;">${i === 0 ? new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}</td>
            <td style="border: 1px solid black; padding: 4px;">${i === 0 ? r.transType : ""}</td>
            <td style="border: 1px solid black; padding: 4px;">${i === 0 ? r.voucherNo : ""}</td>
            <td style="border: 1px solid black; padding: 4px;">${item.itemName || ""}</td>
            <td style="border: 1px solid black; padding: 4px;">${item.orderNo || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${item.eye || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${item.sph || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${item.cyl || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${item.axis || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${item.add || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: center;">${item.qty || ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${Number(item.price || 0).toFixed(2)}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${Number(item.amount || 0).toFixed(2)}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${i === 0 ? Number(r.debit || 0).toFixed(2) : ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${i === 0 ? Number(r.credit || 0).toFixed(2) : ""}</td>
            <td style="border: 1px solid black; padding: 4px; text-align: right;">${i === 0 ? formatDrCr(r.balance) : ""}</td>
            <td style="border: 1px solid black; padding: 4px; font-size: 8pt;">${i === 0 ? r.remarks || "" : ""}</td>
          </tr>
      `).join("");
    }).join("");

    const html = `
      <html>
        <head>
          <title>Ledger Details - ${searchName}</title>
          <style>
            body { font-family: sans-serif; padding: 15px; margin: 0; }
            h2 { text-align: center; margin-bottom: 5px; margin-top: 0; }
            h3 { text-align: center; margin-bottom: 15px; font-weight: normal; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
            th { border: 1px solid black; padding: 5px; background-color: #f2f2f2; }
            td { border: 1px solid black; padding: 4px; }
            @page { size: portrait; margin: 8mm; }
          </style>
        </head>
        <body>
          <h2>Ledger Details</h2>
          <h3>${searchName} ${fromDate && toDate ? "(" + fromDate + " to " + toDate + ")" : ""}</h3>
          <table>
            <thead>
              <tr>
                <th>SN</th>
                <th>Date</th>
                <th>Type</th>
                <th>Vch No</th>
                <th>Item</th>
                <th>Order</th>
                <th>Eye</th>
                <th>SPH</th>
                <th>CYL</th>
                <th>AX</th>
                <th>ADD</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amt</th>
                <th>Dr</th>
                <th>Cr</th>
                <th>Bal</th>
                <th>Rem</th>
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
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Format a numeric balance as DR/CR string (no suffix for zero)
  const formatDrCr = (val) => {
    const n = Number(val || 0);
    if (n === 0) return "0.00";
    const side = n < 0 ? "CR" : "DR";
    return `${Math.abs(n).toFixed(2)} ${side}`;
  };

  // Toggle column selection
  const toggleColumn = (colName) => {
    if (colName === 'lensPower') {
      const nextVal = !selectedColumns.eye;
      setSelectedColumns((prev) => ({
        ...prev,
        eye: nextVal,
        sph: nextVal,
        cyl: nextVal,
        axis: nextVal,
        add: nextVal,
        lensPower: nextVal,
      }));
    } else {
      setSelectedColumns((prev) => ({
        ...prev,
        [colName]: !prev[colName],
      }));
    }
  };

  // Count selected columns
  const selectedCount = Object.values(selectedColumns).filter(Boolean).length;

  // Get visible columns
  const getVisibleColumns = () => {
    const cols = [];
    if (selectedColumns.sn) cols.push("SN");
    if (selectedColumns.date) cols.push("Date");
    if (selectedColumns.voucherType) cols.push("Voucher Type");
    if (selectedColumns.voucherDetail) cols.push("Voucher Detail");
    if (selectedColumns.itemName) cols.push("Item Name");
    if (selectedColumns.orderNo) cols.push("Order No");
    if (selectedColumns.eye) cols.push("Eye");
    if (selectedColumns.sph) cols.push("Sph");
    if (selectedColumns.cyl) cols.push("Cyl");
    if (selectedColumns.axis) cols.push("Axis");
    if (selectedColumns.add) cols.push("Add");
    if (selectedColumns.qty) cols.push("Qty");
    if (selectedColumns.price) cols.push("Price");
    if (selectedColumns.amount) cols.push("Amount");
    if (selectedColumns.debit) cols.push("Debit");
    if (selectedColumns.credit) cols.push("Credit");
    if (selectedColumns.balance) cols.push("Balance");
    if (selectedColumns.remarks) cols.push("Remarks");
    return cols;
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* Print only title */}
      <div className="hidden print:block text-center font-bold text-2xl mb-4">
          Ledger Book Details - {searchName}
      </div>
      
      {/* Header */}
      <h2 className="text-xl font-bold text-black px-4 py-3 rounded-t-lg print:hidden">
        Ledger Book Details
      </h2>

      {/* Filters - Multiple Rows */}
      <div className="p-4 rounded-b-lg shadow-md print:hidden">
        {/* Row 1: Date filters, Account Name */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {/* Date From */}
          <div className="w-[160px]">
            <label className="text-xs font-semibold text-gray-800">Date From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border-2 border-gray-300 rounded px-2 py-2 text-sm bg-white"
            />
          </div>

          {/* Date To */}
          <div className="w-[160px]">
            <label className="text-xs font-semibold text-gray-800">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border-2 border-gray-300 rounded px-2 py-2 text-sm bg-white"
            />
          </div>

          {/* Station Name */}
          <div className="w-[200px]">
            <label className="text-xs font-semibold text-gray-800">Station Name</label>
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              placeholder="Select Station"
              className="w-full border-2 border-gray-300 rounded px-2 py-2 text-sm bg-white"
            />
          </div>

          {/* Account Group */}
          <div className="w-[180px]">
            <label className="text-xs font-semibold text-gray-800">Acc Group</label>
            <select
              value={accountGroup}
              onChange={(e) => setAccountGroup(e.target.value)}
              className="w-full border-2 border-gray-300 rounded px-2 py-2 text-sm bg-white"
            >
              <option value="">Select Group</option>
              {accountGroups.map((group) => (
                <option key={group._id || group.id} value={group.groupName || group.Name || ""}>
                  {group.groupName || group.Name}
                </option>
              ))}
            </select>
          </div>

          {/* Account Name */}
          <div className="flex-1 min-w-[240px]" ref={containerRef}>
            <label className="text-xs font-semibold text-gray-800">Account Name</label>
            <div className="relative">
              <input
                type="text"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  filterSuggestions(e.target.value);
                }}
                onFocus={() => filterSuggestions(searchName)}
                placeholder="ABC"
                className="w-full border-2 border-gray-300 rounded px-2 py-2 text-sm bg-white"
              />

              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 mt-1 bg-white border-2 border-gray-300 shadow-lg max-h-48 overflow-auto z-50 rounded">
                  {suggestions.map((acc) => (
                    <li
                      key={acc._id || acc.id || acc.Name}
                      onClick={() => handleSelectSuggestion(acc)}
                      className="px-3 py-2 hover:bg-blue-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                      title={acc.Name}
                    >
                      <div className="text-sm font-medium text-gray-800">{acc.Name}</div>
                      <div className="text-xs text-gray-500">{acc.contactNumber || acc.mobile || ""}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pb-0">
            <button
              onClick={handleSearch}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded transition"
            >
              <Search size={16} />
              Search
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded transition"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>

        {/* Row 2: Columns selector and Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Columns Dropdown */}
          <div className="relative" ref={columnDropdownRef}>
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="flex items-center gap-1 bg-white border-2 border-gray-400 hover:border-gray-600 text-gray-800 text-xs font-semibold px-3 py-2 rounded transition"
            >
              Columns
              <span className="ml-1 inline-block bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {selectedCount} selected
              </span>
              <ChevronDown size={14} className={`transition ${showColumnDropdown ? "rotate-180" : ""}`} />
            </button>

            {showColumnDropdown && (
              <div className="absolute top-full mt-1 bg-white border-2 border-gray-300 shadow-lg rounded z-50 min-w-[200px]">
                {[
                  { key: "sn", label: "SN" },
                  { key: "date", label: "Date" },
                  { key: "voucherType", label: "Voucher Type" },
                  { key: "voucherDetail", label: "Voucher Detail" },
                  { key: "itemName", label: "Item Name" },
                  { key: "orderNo", label: "Order No" },
                  { key: "lensPower", label: "Lens Power" },
                  { key: "qty", label: "Qty" },
                  { key: "price", label: "Price" },
                  { key: "amount", label: "Amount" },
                  { key: "debit", label: "Debit" },
                  { key: "credit", label: "Credit" },
                  { key: "balance", label: "Balance" },
                  { key: "remarks", label: "Remarks" },
                ].map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Additional Action Buttons */}
          <button className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded transition" title="Email">
            <Mail size={16} />
          </button>

          <button className="bg-green-500 hover:bg-green-600 text-white p-2 rounded transition" title="Message">
            <MessageCircle size={16} />
          </button>

          <button 
            onClick={handlePrint}
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition" title="Print"
          >
            <Printer size={16} />
          </button>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Summary Info */}
          <div className="text-xs text-gray-800 font-semibold print:hidden">
            {hasSearched && (
              <>
                <span>Debit: {totalDebit.toFixed(2)} | </span>
                <span>Credit: {totalCredit.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
               {getVisibleColumns().map((colName) => (
                <th
                  key={colName}
                  className={`border border-gray-300 px-3 py-2 font-bold text-gray-800 ${["Debit", "Credit", "Balance"].includes(colName) ? "text-right" : "text-left"
                    }`}
                >
                  {colName === "SN" ? (
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
                  ) : (
                    colName
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Account name header */}
            {searchName && (
              <tr className="bg-blue-100 print:hidden">
                <td
                  colSpan={getVisibleColumns().length}
                  className="text-center py-2 font-bold text-gray-800 border border-gray-300"
                >
                  {searchName}
                </td>
              </tr>
            )}

            {/* Opening Balance */}
            {hasSearched && (
              <tr className={`bg-gray-100 font-bold ${selectedRows.length > 0 ? "print:hidden" : ""}`}>
                {selectedColumns.sn && <td className="border border-gray-300 px-3 py-2">-</td>}
                {selectedColumns.date && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.voucherType && (
                  <td className="border border-gray-300 px-3 py-2">Opening</td>
                )}
                {selectedColumns.voucherDetail && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.itemName && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.orderNo && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.eye && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.sph && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.cyl && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.axis && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.add && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.qty && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.price && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.amount && (
                  <td className="border border-gray-300 px-3 py-2"></td>
                )}
                {selectedColumns.debit && <td className="border border-gray-300 px-3 py-2 text-right"></td>}
                {selectedColumns.credit && <td className="border border-gray-300 px-3 py-2 text-right"></td>}
                {selectedColumns.balance && (
                  <td className="border border-gray-300 px-3 py-2 text-right font-bold">
                    {formatDrCr(openingBalance)}
                  </td>
                )}
                {selectedColumns.remarks && <td className="border border-gray-300 px-3 py-2"></td>}
              </tr>
            )}

            {/* Transaction rows */}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={getVisibleColumns().length}
                  className="text-center py-10 text-gray-500 text-sm"
                >
                  {loading ? "Loading..." : hasSearched ? "No transactions found." : "Use filters and click Search"}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                // Get items from the row
                const items = r.items || [];
                const hasItems = items.length > 0;

                if (!hasItems) {
                  // If no items, show transaction row without item details
                  return (
                   <tr key={idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedRows.length > 0 && !selectedRows.includes(idx) ? "print:hidden" : ""}`}>
                      {selectedColumns.sn && (
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="checkbox"
                              className="print:hidden"
                              checked={selectedRows.includes(idx)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedRows([...selectedRows, idx]);
                                else setSelectedRows(selectedRows.filter(i => i !== idx));
                              }}
                            />
                            <span>{idx + 1}</span>
                          </div>
                        </td>
                      )}
                      {selectedColumns.date && (
                        <td className="border border-gray-300 px-3 py-2">
                          {new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </td>
                      )}
                      {selectedColumns.voucherType && <td className="border border-gray-300 px-3 py-2">{r.transType}</td>}
                      {selectedColumns.voucherDetail && <td className="border border-gray-300 px-3 py-2">{r.voucherNo}</td>}
                      {selectedColumns.itemName && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.orderNo && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.eye && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.sph && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.cyl && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.axis && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.add && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.qty && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.price && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.amount && <td className="border border-gray-300 px-3 py-2"></td>}
                      {selectedColumns.debit && (
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                          {Number(r.debit || 0).toFixed(2)}
                        </td>
                      )}
                      {selectedColumns.credit && (
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                          {Number(r.credit || 0).toFixed(2)}
                        </td>
                      )}
                      {selectedColumns.balance && (
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                          {formatDrCr(r.balance)}
                        </td>
                      )}
                      {selectedColumns.remarks && <td className="border border-gray-300 px-3 py-2 text-xs">{r.remarks}</td>}
                    </tr>
                  );
                }

                // If has items, show each item as separate row
                return (
                  <React.Fragment key={idx}>
                    {items.map((item, itemIdx) => (
                       <tr key={`${idx}-${itemIdx}`} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${selectedRows.length > 0 && !selectedRows.includes(idx) ? "print:hidden" : ""}`}>
                        {/* SN - only on first item */}
                        {selectedColumns.sn && (
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {itemIdx === 0 ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="checkbox"
                                  className="print:hidden"
                                  checked={selectedRows.includes(idx)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedRows([...selectedRows, idx]);
                                    else setSelectedRows(selectedRows.filter(i => i !== idx));
                                  }}
                                />
                                <span>{idx + 1}</span>
                              </div>
                            ) : ""}
                          </td>
                        )}

                        {/* Date - only on first item */}
                        {selectedColumns.date && (
                          <td className="border border-gray-300 px-3 py-2">
                            {itemIdx === 0 ? new Date(r.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}
                          </td>
                        )}

                        {/* Voucher Type - only on first item */}
                        {selectedColumns.voucherType && (
                          <td className="border border-gray-300 px-3 py-2">
                            {itemIdx === 0 ? r.transType : ""}
                          </td>
                        )}

                        {/* Voucher Detail - only on first item */}
                        {selectedColumns.voucherDetail && (
                          <td className="border border-gray-300 px-3 py-2">
                            {itemIdx === 0 ? r.voucherNo : ""}
                          </td>
                        )}

                        {/* Item Details - all rows */}
                        {selectedColumns.itemName && (
                          <td className="border border-gray-300 px-3 py-2 text-sm font-medium">
                            {item?.itemName}
                          </td>
                        )}
                        {selectedColumns.orderNo && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.orderNo || "-"}
                          </td>
                        )}
                        {selectedColumns.eye && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.eye || "-"}
                          </td>
                        )}
                        {selectedColumns.sph && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.sph || "-"}
                          </td>
                        )}
                        {selectedColumns.cyl && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.cyl || "-"}
                          </td>
                        )}
                        {selectedColumns.axis && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.axis || "-"}
                          </td>
                        )}
                        {selectedColumns.add && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.add || "-"}
                          </td>
                        )}
                        {selectedColumns.qty && (
                          <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                            {item?.qty}
                          </td>
                        )}
                        {selectedColumns.price && (
                          <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                            {Number(item?.price || 0).toFixed(2)}
                          </td>
                        )}
                        {selectedColumns.amount && (
                          <td className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold">
                            {Number(item?.amount || 0).toFixed(2)}
                          </td>
                        )}

                        {/* Transaction totals - only on first item */}
                        {selectedColumns.debit && (
                          <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                            {itemIdx === 0 ? Number(r.debit || 0).toFixed(2) : ""}
                          </td>
                        )}
                        {selectedColumns.credit && (
                          <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                            {itemIdx === 0 ? Number(r.credit || 0).toFixed(2) : ""}
                          </td>
                        )}
                        {selectedColumns.balance && (
                          <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                            {itemIdx === 0 ? formatDrCr(r.balance) : ""}
                          </td>
                        )}
                        {selectedColumns.remarks && (
                          <td className="border border-gray-300 px-3 py-2 text-xs">
                            {itemIdx === 0 ? r.remarks : ""}
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}

            {/* Closing Balance */}
            {hasSearched && (
              <tr className={`bg-gray-200 font-bold ${selectedRows.length > 0 ? "print:hidden" : ""}`}>
                {selectedColumns.sn && <td className="border border-gray-300 px-3 py-2">-</td>}
                {selectedColumns.date && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.voucherType && (
                  <td className="border border-gray-300 px-3 py-2 text-blue-800">Closing Balance</td>
                )}
                {selectedColumns.voucherDetail && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.itemName && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.orderNo && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.eye && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.sph && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.cyl && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.axis && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.add && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.qty && (
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    {rows.reduce((sum, r) => sum + (r.items ? r.items.reduce((iSum, item) => iSum + (Number(item.qty) || 0), 0) : 0), 0)}
                  </td>
                )}
                {selectedColumns.price && <td className="border border-gray-300 px-3 py-2"></td>}
                {selectedColumns.amount && (
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {rows.reduce((sum, r) => sum + (r.items ? r.items.reduce((iSum, item) => iSum + (Number(item.amount) || 0), 0) : 0), 0).toFixed(2)}
                  </td>
                )}
                {selectedColumns.debit && (
                  <td className="border border-gray-300 px-3 py-2 text-right text-blue-900">
                    {rows.reduce((sum, r) => sum + Number(r.debit || 0), 0).toFixed(2)}
                  </td>
                )}
                {selectedColumns.credit && (
                  <td className="border border-gray-300 px-3 py-2 text-right text-blue-900">
                    {rows.reduce((sum, r) => sum + Number(r.credit || 0), 0).toFixed(2)}
                  </td>
                )}
                {selectedColumns.balance && (
                  <td className="border border-gray-300 px-3 py-2 text-right font-bold text-blue-900">
                    {formatDrCr(closingBalance ?? openingBalance ?? 0)}
                  </td>
                )}
                {selectedColumns.remarks && <td className="border border-gray-300 px-3 py-2"></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Toaster position="top-right" reverseOrder={false} />
    </div>
  );
}

export default AccountLedgerDetails;
