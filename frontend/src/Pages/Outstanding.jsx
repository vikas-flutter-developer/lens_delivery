import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Search,
    RotateCcw,
    Printer,
    Eye,
    MessageSquare,
} from "lucide-react";
import { getOutstandingReport, getStations, getGroups } from "../controllers/Outstanding.controller";
import { getAllAccounts } from "../controllers/Account.controller";
import { FaWhatsapp, FaFileCsv } from "react-icons/fa";
import Papa from "papaparse";

function Outstanding() {
    const navigate = useNavigate();

    // Filter states
    const [fromDate, setFromDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });
    const [type, setType] = useState("receivable"); // "receivable" or "payable"
    const [stationName, setStationName] = useState("");
    const [groupName, setGroupName] = useState("");
    const [searchText, setSearchText] = useState("");

    // Data states
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [summary, setSummary] = useState(null);

    // Dropdown options
    const [stations, setStations] = useState([]);
    const [groups, setGroups] = useState([]);

    // Selection states for SMS
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectAll, setSelectAll] = useState(false);

    // Autocomplete states for search
    const [accounts, setAccounts] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchContainerRef = useRef(null);

    // Fetch dropdown options and accounts on mount
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [stationRes, groupRes, accountsRes] = await Promise.all([
                    getStations(),
                    getGroups(),
                    getAllAccounts(),
                ]);
                setStations(stationRes?.data || []);
                setGroups(groupRes?.data || []);

                // Handle different response formats
                const dataArr = accountsRes?.data?.data ?? accountsRes?.data ?? accountsRes;
                setAccounts(Array.isArray(dataArr) ? dataArr : []);
            } catch (err) {
                console.error("Failed to load dropdown options", err);
            }
        };
        fetchOptions();
    }, []);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter suggestions based on search text
    const filterSuggestions = (input) => {
        const query = (input || "").trim().toLowerCase();
        if (!query) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const matches = accounts.filter((acc) => {
            const name = (acc.Name || "").toLowerCase();
            const mobile = String(acc.MobileNumber || "");
            const address = (acc.Address || "").toLowerCase();
            return name.includes(query) || mobile.includes(query) || address.includes(query);
        });

        setSuggestions(matches.slice(0, 10));
        setShowSuggestions(matches.length > 0);
    };

    const handleSearchTextChange = (e) => {
        const value = e.target.value;
        setSearchText(value);
        filterSuggestions(value);
    };

    const handleSelectSuggestion = (acc) => {
        setSearchText(acc.Name || "");
        setShowSuggestions(false);
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            setSelectedRows([]);
            setSelectAll(false);

            const params = {
                type,
                fromDate: fromDate || undefined,
                stationName: stationName || undefined,
                groupName: groupName || undefined,
                search: searchText || undefined,
            };

            const resp = await getOutstandingReport(params);
            setRows(resp?.data || []);
            setSummary(resp?.summary || null);
            setHasSearched(true);
        } catch (err) {
            console.error(err);
            alert("Failed to fetch outstanding report. Check console for details.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        const today = new Date();
        setFromDate(today.toISOString().split("T")[0]);
        setType("receivable");
        setStationName("");
        setGroupName("");
        setSearchText("");
        setRows([]);
        setSummary(null);
        setHasSearched(false);
        setSelectedRows([]);
        setSelectAll(false);
    };

    const handleSelectAll = (e) => {
        const checked = e.target.checked;
        setSelectAll(checked);
        if (checked) {
            setSelectedRows(rows.map((_, idx) => idx));
        } else {
            setSelectedRows([]);
        }
    };

    const handleRowSelect = (idx) => {
        setSelectedRows((prev) => {
            if (prev.includes(idx)) {
                return prev.filter((i) => i !== idx);
            }
            return [...prev, idx];
        });
    };

    const handleView = (row) => {
        // Navigate to account ledger with pre-filled account name
        navigate(`/reports/ledger/accountledger?account=${encodeURIComponent(row.particular)}`);
    };

    const handleSendSMS = () => {
        if (selectedRows.length === 0) {
            alert("Please select at least one account to send SMS.");
            return;
        }

        const selectedAccounts = selectedRows.map((idx) => rows[idx]);
        console.log("Sending SMS to:", selectedAccounts);
        alert(`SMS would be sent to ${selectedAccounts.length} account(s). Feature pending backend integration.`);
    };

    const handleWhatsAppShare = (row) => {
        const message = `Outstanding Statement\n\n` +
            `Party: ${row.particular}\n` +
            `Contact: ${row.contactNo}\n` +
            `--------------------------------\n` +
            `1-30 Days: ₹${row.days1to30}\n` +
            `31-60 Days: ₹${row.days31to60}\n` +
            `61-90 Days: ₹${row.days61to90}\n` +
            `Above 90 Days: ₹${row.above90Days}\n` +
            `--------------------------------\n` +
            `Total Outstanding: ₹${row.totalOutstanding}`;

        const encodedMsg = encodeURIComponent(message);
        const phone = row.contactNo?.replace(/\D/g, "");
        const url = phone
            ? `https://wa.me/${phone}?text=${encodedMsg}`
            : `https://wa.me/?text=${encodedMsg}`;
        window.open(url, "_blank");
    };

    const handleExportCSV = () => {
        if (!rows.length) {
            alert("No data to export");
            return;
        }

        const csvData = rows.map((r, idx) => ({
            "S.No": idx + 1,
            "Particular": r.particular,
            "Contact No": r.contactNo,
            "Address": r.address,
            "Group Name": r.groupName,
            "State": r.state,
            "1-30 Days": r.days1to30,
            "31-60 Days": r.days31to60,
            "61-90 Days": r.days61to90,
            "Above 90 Days": r.above90Days,
            "Total Outstanding": r.totalOutstanding,
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Outstanding_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    // Format number with Indian locale
    const formatNumber = (num) => {
        const n = parseFloat(num || 0);
        return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handlePrint = () => {
        if (!rows.length) {
            alert("No data to print");
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

        const tableRows = rowsToPrint.map((r, idx) => `
            <tr>
                <td style="border: 1px solid black; padding: 4px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid black; padding: 4px;">${r.particular || ""}</td>
                <td style="border: 1px solid black; padding: 4px;">${r.contactNo || ""}</td>
                <td style="border: 1px solid black; padding: 4px;">${r.address || ""}</td>
                <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatNumber(r.days1to30)}</td>
                <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatNumber(r.days31to60)}</td>
                <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatNumber(r.days61to90)}</td>
                <td style="border: 1px solid black; padding: 4px; text-align: right;">${formatNumber(r.above90Days)}</td>
                <td style="border: 1px solid black; padding: 4px; text-align: right; font-weight: bold;">${formatNumber(r.totalOutstanding)}</td>
            </tr>
        `).join("");

        const titleText = `Outstanding Report - ${type.toUpperCase()}`;

        const html = `
            <html>
                <head>
                    <title>${titleText}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h2 { text-align: center; margin-bottom: 5px; margin-top: 0; }
                        h3 { text-align: center; margin-bottom: 20px; font-weight: normal; margin-top: 0; }
                        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                        th { border: 1px solid black; padding: 8px; background-color: #f2f2f2; }
                        td { border: 1px solid black; padding: 6px; }
                        @page { size: landscape; margin: 10mm; }
                    </style>
                </head>
                <body>
                    <h2>${titleText}</h2>
                    <h3>As on ${new Date().toLocaleDateString("en-IN")}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>SN</th>
                                <th>Particular</th>
                                <th>Contact</th>
                                <th>Address</th>
                                <th>1-30 Days</th>
                                <th>31-60 Days</th>
                                <th>61-90 Days</th>
                                <th>>90 Days</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg">
                <h1 className="text-lg font-semibold">Outstanding</h1>
            </div>

            {/* Filters Section */}
            <div className="bg-blue-50 p-4 border-b print:hidden">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Date From */}
                    <div className="min-w-[140px]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>

                    {/* Receivable / Payable Toggle */}
                    <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded border border-gray-300">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="type"
                                value="receivable"
                                checked={type === "receivable"}
                                onChange={(e) => setType(e.target.value)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">Receivable</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="type"
                                value="payable"
                                checked={type === "payable"}
                                onChange={(e) => setType(e.target.value)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">Payable</span>
                        </label>
                    </div>

                    {/* Station Name */}
                    <div className="min-w-[150px]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Station Name</label>
                        <select
                            value={stationName}
                            onChange={(e) => setStationName(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">All Stations</option>
                            {stations.map((s, idx) => (
                                <option key={idx} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Group Name */}
                    <div className="min-w-[150px]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Group Name</label>
                        <select
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">All Groups</option>
                            {groups.map((g, idx) => (
                                <option key={idx} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search with Autocomplete */}
                    <div className="min-w-[180px] relative" ref={searchContainerRef}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                        <input
                            type="text"
                            value={searchText}
                            onChange={handleSearchTextChange}
                            onFocus={() => {
                                if (searchText.trim()) {
                                    filterSuggestions(searchText);
                                }
                            }}
                            placeholder="Name, Mobile, Address..."
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400"
                        />

                        {/* Autocomplete Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                                {suggestions.map((acc, idx) => (
                                    <div
                                        key={acc._id || idx}
                                        onClick={() => handleSelectSuggestion(acc)}
                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="font-medium text-sm text-gray-800">{acc.Name}</div>
                                        {acc.MobileNumber && (
                                            <div className="text-xs text-gray-500">{acc.MobileNumber}</div>
                                        )}
                                        {acc.Address && (
                                            <div className="text-xs text-gray-400 truncate">{acc.Address}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded shadow transition-colors disabled:opacity-50"
                        >
                            <Search size={16} />
                            {loading ? "Searching..." : "Search"}
                        </button>

                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm px-4 py-1.5 rounded shadow transition-colors"
                        >
                            <RotateCcw size={16} />
                            Reset
                        </button>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex gap-1 ml-auto">
                        <button
                            onClick={handleExportCSV}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded shadow transition-colors"
                            title="Export CSV"
                        >
                            <FaFileCsv size={18} />
                        </button>

                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow transition-colors"
                            title="Print"
                        >
                            <Printer size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700">
                            <th className="border border-gray-300 px-2 py-2.5 text-center w-12 print:hidden">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4"
                                />
                            </th>
                            <th className="border border-gray-300 px-2 py-2.5 text-center w-12">SNo</th>
                            <th className="border border-gray-300 px-2 py-2.5 text-center w-16 print:hidden">Action</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-left min-w-[200px]">Particular</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-left min-w-[120px]">Contact No</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-left min-w-[180px]">Address</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-left min-w-[120px]">Group Name</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-left min-w-[100px]">State</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-right min-w-[100px]">1 - 30 Days</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-right min-w-[100px]">31 - 60 Days</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-right min-w-[100px]">61 - 90 Days</th>
                            <th className="border border-gray-300 px-3 py-2.5 text-right min-w-[110px]">Above 90 Days</th>
                            <th className="border border-gray-300 px-2 py-2.5 text-center w-16">View</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan="13" className="text-center py-12 text-gray-500">
                                    {loading
                                        ? "Loading..."
                                        : hasSearched
                                            ? "No outstanding records found."
                                            : "Apply filters and click Search to view outstanding report."}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr
                                    key={row._id || idx}
                                    className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                                        } ${(selectedRows.length > 0 && !selectedRows.includes(idx)) ? "print:hidden" : ""}`}
                                >
                                    <td className="border border-gray-200 px-2 py-2 text-center print:hidden">
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.includes(idx)}
                                            onChange={() => handleRowSelect(idx)}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="border border-gray-200 px-2 py-2 text-center text-gray-600">
                                        {idx + 1}
                                    </td>
                                    <td className="border border-gray-200 px-2 py-2 text-center print:hidden">
                                        <button
                                            onClick={() => handleWhatsAppShare(row)}
                                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                                            title="Send WhatsApp"
                                        >
                                            <FaWhatsapp size={14} />
                                        </button>
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 font-medium text-gray-800">
                                        {row.particular}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-gray-600">
                                        {row.contactNo}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-gray-600 truncate max-w-[200px]" title={row.address}>
                                        {row.address}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-gray-600">
                                        {row.groupName}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-gray-600">
                                        {row.state}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-right text-gray-800">
                                        {formatNumber(row.days1to30)}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-right text-gray-800">
                                        {formatNumber(row.days31to60)}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-right text-gray-800">
                                        {formatNumber(row.days61to90)}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-2 text-right font-semibold text-red-600">
                                        {formatNumber(row.above90Days)}
                                    </td>
                                    <td className="border border-gray-200 px-2 py-2 text-center">
                                        <button
                                            onClick={() => handleView(row)}
                                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>

                    {/* Summary Footer */}
                    {summary && rows.length > 0 && (
                        <tfoot className={selectedRows.length > 0 ? "print:hidden" : ""}>
                            <tr className="bg-gradient-to-r from-blue-100 to-blue-200 font-semibold text-gray-800">
                                <td className="border border-gray-300 px-2 py-2.5 print:hidden"></td>
                                <td className="border border-gray-300 px-2 py-2.5 text-center">-</td>
                                <td className="border border-gray-300 px-2 py-2.5 print:hidden"></td>
                                <td className="border border-gray-300 px-3 py-2.5" colSpan="5">
                                    Total ({summary.totalAccounts} Accounts)
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 text-right">
                                    {formatNumber(summary.total1to30)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 text-right">
                                    {formatNumber(summary.total31to60)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 text-right">
                                    {formatNumber(summary.total61to90)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2.5 text-right text-red-600">
                                    {formatNumber(summary.totalAbove90)}
                                </td>
                                <td className="border border-gray-300 px-2 py-2.5"></td>
                            </tr>
                            <tr className="bg-gradient-to-r from-green-100 to-green-200 font-bold text-gray-900">
                                <td className="border border-gray-300 px-2 py-3 print:hidden"></td>
                                <td className="border border-gray-300 px-2 py-3"></td>
                                <td className="border border-gray-300 px-2 py-3 print:hidden"></td>
                                <td className="border border-gray-300 px-3 py-3" colSpan="8">
                                    Grand Total Outstanding
                                </td>
                                <td className="border border-gray-300 px-3 py-3 text-right text-lg text-green-700">
                                    ₹ {formatNumber(summary.grandTotal)}
                                </td>
                                <td className="border border-gray-300 px-2 py-3"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Bottom Action Bar */}
            {rows.length > 0 && (
                <div className="bg-gray-100 px-4 py-3 flex items-center justify-between border-t print:hidden">
                    <button
                        onClick={handleSendSMS}
                        disabled={selectedRows.length === 0}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded shadow transition-colors"
                    >
                        <MessageSquare size={16} />
                        Send SMS ({selectedRows.length})
                    </button>

                    <div className="text-sm text-gray-600">
                        {selectedRows.length} of {rows.length} selected
                    </div>
                </div>
            )}
        </div>
    );
}

export default Outstanding;
