import React, { useState, useMemo, useEffect } from "react";
import {
  deleteAccount,
  getAllAccounts,
} from "../controllers/Account.controller";
import { getAllAccountGroups } from "../controllers/AccountGroupController";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash,
  Search,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
// Mock Data - remains unchanged

// Custom Hook for Filters - remains unchanged
const useFilters = (initialFilters) => {
  const [filters, setFilters] = useState(initialFilters);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFilters(initialFilters);
  };

  return { filters, handleFilterChange, handleReset };
};

function AccountMaster() {
  const initialFilters = {
    groupName: "",
    searchText: "",
    registerFrom: "",
    registerTo: "",
    gender: "",
    accountType: "",
  };

  const [accounts, setAccounts] = useState([]);
  const [accountGroups, setAccountGroups] = useState([]);
  const [uniqueGroups, setUniqueGroups] = useState([]);
  const [uniqueAccountNames, setUniqueAccountNames] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getAllAccounts();
        setAccounts(res);

        // Extract unique group names
        const groupsSet = new Set();
        res.forEach((account) => {
          if (Array.isArray(account.Groups)) {
            account.Groups.forEach((group) => groupsSet.add(group));
          }
        });
        setUniqueGroups(Array.from(groupsSet).sort());

        // Extract unique account names
        const namesSet = new Set();
        res.forEach((account) => {
          if (account.Name) namesSet.add(account.Name);
        });
        setUniqueAccountNames(Array.from(namesSet).sort());
      } catch (err) {
        console.error("Error fetching accounts:", err);
        toast.error("Failed to fetch accounts!");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAccountGroups = async () => {
      try {
        const res = await getAllAccountGroups();
        setAccountGroups(res);
      } catch (err) {
        console.error("Error fetching account groups:", err);
        toast.error("Failed to fetch account groups!");
      }
    };
    fetchAccountGroups();
  }, []);

  const { filters, handleFilterChange, handleReset } =
    useFilters(initialFilters);
  // helper (put it above your component or inside file)
  const toDayRange = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    // yyyy-mm-dd from <input type="date">
    const d = new Date(yyyyMmDd);
    if (isNaN(d.getTime())) return null;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  };

  // Memoized filtered accounts based on filter state
  const filteredAccounts = useMemo(() => {
    // precompute from/to once per render for performance
    const fromRange = toDayRange(filters.registerFrom); // {start,end} or null
    const toRange = toDayRange(filters.registerTo); // {start,end} or null

    // If both provided, we'll use fromRange.start .. toRange.end as final window
    let windowStart = null;
    let windowEnd = null;
    if (fromRange) windowStart = fromRange.start;
    if (toRange) windowEnd = toRange.end;
    // if only from given -> start only, if only to given -> end only

    return accounts.filter((account) => {
      const lowerSearch = (filters.searchText || "").toLowerCase();

      // SEARCH TEXT MATCHES (Name / MobileNumber / GSTIN)
      const matchesSearch =
        lowerSearch === "" ||
        (account.Name || "").toLowerCase().includes(lowerSearch) ||
        String(account.MobileNumber || "").includes(lowerSearch) ||
        (account.GSTIN || "").toLowerCase().includes(lowerSearch);

      // GROUP FILTER MATCHES (Groups is array)
      const matchesGroup =
        !filters.groupName ||
        (account.Groups || []).some((g) =>
          g.toLowerCase().includes(filters.groupName.toLowerCase())
        );

      // DATE FILTER MATCHES
      let matchesDate = true;
      if (windowStart !== null || windowEnd !== null) {
        const createdTs = account.createdAt
          ? new Date(account.createdAt).getTime()
          : NaN;
        if (isNaN(createdTs)) {
          // if account has no valid createdAt, treat as non-matching when date filter active
          matchesDate = false;
        } else {
          if (windowStart !== null && windowEnd !== null) {
            matchesDate = createdTs >= windowStart && createdTs <= windowEnd;
          } else if (windowStart !== null) {
            matchesDate = createdTs >= windowStart;
          } else if (windowEnd !== null) {
            matchesDate = createdTs <= windowEnd;
          }
        }
      }

      // ACCOUNT TYPE FILTER MATCHES
      const matchesType =
        !filters.accountType ||
        account.AccountType === "Both" ||
        account.AccountType === filters.accountType;

      return matchesSearch && matchesGroup && matchesDate && matchesType;
    });
  }, [accounts, filters]);

  // Placeholder functions for actions - remain unchanged
  const handleSearch = () => {
    console.log("Searching with filters:", filters);
  };

  const handleEdit = (id) => {
    navigate(`/add/accountmaster/${id}`);
  };

  const handleDelete = async (id) => {
    try {
      const res = await deleteAccount(id);
      if (!res) return toast.error("Something went wrong!");
      if (res.success === false)
        return toast.error(res.message || "Failed to delete!");
      if (res.success === true) {
        toast.success("Account Group deleted successfully!");
        setAccounts((prev) => prev.filter((account) => account._id !== id));
      }
    } catch (err) {
      console.log(err);
      toast.error("Error deleting account group!");
    }
  };

  const handleDownloadExcel = () => {
    if (filteredAccounts.length === 0) {
      toast.error("No records to download");
      return;
    }
    const exportData = filteredAccounts.map((account, index) => ({
      "Sr. No.": index + 1,
      "Date": account.createdAt ? new Date(account.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "-",
      "Account Name": account.Name || "-",
      "Mobile No.": account.MobileNumber || "-",
      "GST No.": account.GSTIN || "-",
      "Parent Group": Array.isArray(account.Groups) ? account.Groups.join(", ") : "-",
      "Address": account.Address || "-",
      "Station": Array.isArray(account.Stations) ? account.Stations.join(", ") : "-",
      "State": account.State || "-",
      "Opn. Bal (Dr)": account.OpeningBalance?.type === "Dr" ? account.OpeningBalance.balance : "0.00",
      "Opn. Bal (Cr)": account.OpeningBalance?.type === "Cr" ? account.OpeningBalance.balance : "0.00",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Accounts");
    XLSX.writeFile(workbook, "AccountMaster.xlsx");
  };

  const handlePrint = () => {
    if (filteredAccounts.length === 0) {
      toast.error("No data to print");
      return;
    }

    const printWindow = window.open("", "_blank");
    const tableRows = filteredAccounts.map((account, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${account.createdAt ? new Date(account.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "-"}</td>
        <td style="font-weight: 600;">${account.Name || "-"}</td>
        <td>${account.MobileNumber || "-"}</td>
        <td>${account.GSTIN || "-"}</td>
        <td>${Array.isArray(account.Groups) ? account.Groups.join(", ") : "-"}</td>
        <td>${account.Address || "-"}</td>
        <td>${Array.isArray(account.Stations) ? account.Stations.join(", ") : "-"}</td>
        <td>${account.State || "-"}</td>
        <td style="text-align: right;">${account.OpeningBalance?.type === "Dr" ? account.OpeningBalance.balance : "0.00"}</td>
        <td style="text-align: right;">${account.OpeningBalance?.type === "Cr" ? account.OpeningBalance.balance : "0.00"}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Account Master - ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</title>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: white; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
            .header p { margin: 5px 0 0 0; color: #64748b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 11px; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f1f5f9; }
            .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Account Master</h1>
              <p>Generated on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            </div>
            <div style="text-align: right;">
              <p>Total Records: <strong>${filteredAccounts.length}</strong></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">Sr. No.</th>
                <th>Date</th>
                <th>Account Name</th>
                <th>Mobile No.</th>
                <th>GST No.</th>
                <th>Parent Group</th>
                <th>Address</th>
                <th>Station</th>
                <th>State</th>
                <th style="text-align: right;">Opn. Bal (Dr)</th>
                <th style="text-align: right;">Opn. Bal (Cr)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Computer Generated Report - ${new Date().getFullYear()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans p-6">
      <div className="max-w-[98vw] mx-auto">
        {/* Header - remains unchanged */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-slate-800 mb-2">
            Account Master
          </h1>
          <p className="text-slate-600 text-lg">
            Manage customer and vendor account information
          </p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex flex-col gap-4">
            {/* Top Row: Filters */}
            <div className="flex flex-wrap items-end gap-4">
              {/* Group Name - Dropdown */}
              <div className="relative flex-1 min-w-[200px]">
                <select
                  value={filters.groupName}
                  onChange={(e) =>
                    handleFilterChange("groupName", e.target.value)
                  }
                  className="peer w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-white transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Groups</option>
                  {uniqueGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <label className="absolute left-3 -top-2 text-xs text-blue-500 bg-white px-1">
                  Group Name
                </label>
              </div>

              {/* Search Text with Autocomplete */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  list="accountNames"
                  value={filters.searchText}
                  onChange={(e) =>
                    handleFilterChange("searchText", e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  placeholder=" "
                  className="peer px-4 py-2.5 w-full border border-slate-300 rounded-lg outline-none text-sm transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <datalist id="accountNames">
                  {uniqueAccountNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <label className="absolute left-3 top-2.5 text-slate-400 text-sm transition-all bg-white px-1 peer-focus:-top-2 peer-focus:text-xs peer-focus:text-blue-500 peer-[&:not(:placeholder-shown)]:-top-2 peer-[&:not(:placeholder-shown)]:text-xs peer-[&:not(:placeholder-shown)]:text-blue-500">
                  Search Name, Number
                </label>
              </div>

              {/* Register From */}
              <div className="relative w-[160px]">
                <input
                  type="date"
                  value={filters.registerFrom}
                  onChange={(e) =>
                    handleFilterChange("registerFrom", e.target.value)
                  }
                  placeholder=" "
                  className="peer px-4 py-2.5 w-full border border-slate-300 rounded-lg outline-none text-sm text-slate-600 transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <label className="absolute left-3 -top-2 text-xs text-slate-500 bg-white px-1">
                  Register From
                </label>
              </div>

              {/* Register To */}
              <div className="relative w-[160px]">
                <input
                  type="date"
                  value={filters.registerTo}
                  onChange={(e) =>
                    handleFilterChange("registerTo", e.target.value)
                  }
                  placeholder=" "
                  className="peer px-4 py-2.5 w-full border border-slate-300 rounded-lg outline-none text-sm text-slate-600 transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <label className="absolute left-3 -top-2 text-xs text-slate-500 bg-white px-1">
                  Register To
                </label>
              </div>
            </div>

            {/* Middle Row: Account Type (Full width or contained) */}
            <div className="relative w-[160px]">
              <select
                value={filters.accountType}
                onChange={(e) =>
                  handleFilterChange("accountType", e.target.value)
                }
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="Sale">Sale</option>
                <option value="Purchase">Purchase</option>
                <option value="Both">Both</option>
              </select>
              <label className="absolute left-3 -top-2 text-xs text-blue-500 bg-white px-1">
                Account Type
              </label>
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex flex-wrap items-center gap-4 mt-2 mb-2">
              <button
                onClick={handleSearch}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px]"
              >
                <Search className="w-4 h-4" />
                Search
              </button>

              <button
                onClick={handleReset}
                className="h-10 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px]"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>

              <Link
                to="/add/accountmaster"
                className="h-10 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-w-[100px] shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </Link>

              {/* Print Icons aligned to the right or next to buttons (user asked for single line) */}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={handleDownloadExcel}
                  className="h-10 w-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  title="Download Excel"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrint}
                  className="h-10 w-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                  title="Print"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>


          {/* Table Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-200">
                <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-20 text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Sr. No.</th>
                    <th className="w-[120px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Date</th>
                    <th className="w-[180px] text-left py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Account Name</th>
                    <th className="w-[140px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Mobile No.</th>
                    <th className="w-[150px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">GST No.</th>
                    <th className="w-[180px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Parent Group</th>
                    <th className="w-[250px] text-left py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Address</th>
                    <th className="w-[120px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Station</th>
                    <th className="w-[120px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">State</th>
                    <th className="w-[150px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Opn. Bal (Dr)</th>
                    <th className="w-[150px] text-center py-4 px-3 border-gray-300 border-r text-slate-700 font-bold text-sm">Opn. Bal (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="p-10 text-center text-slate-500">
                        <p className="text-xl">No accounts found</p>
                        <p className="text-md">Try adjusting your search criteria</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((account, index) => (
                      <tr key={account._id || index} className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                        <td className="w-20 text-center border-gray-300 border-r text-slate-600 font-medium py-3 px-2 align-top whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="text-base">{index + 1}</span>
                            <button onClick={() => handleEdit(account._id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(account._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200">
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="w-[120px] border-gray-300 border-r text-center text-slate-700 py-3 px-3 align-top">
                          {account.createdAt ? new Date(account.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "-"}
                        </td>
                        <td className="w-[180px] border-gray-300 border-r font-medium text-slate-800 py-3 px-3 truncate align-top" title={account.Name}>
                          {account.Name}
                        </td>
                        <td className="w-[140px] border-gray-300 border-r text-center text-slate-700 py-3 px-3 align-top">
                          {account.MobileNumber}
                        </td>
                        <td className="w-[150px] border-gray-300 border-r text-center text-slate-700 py-3 px-3 break-words align-top" title={account.GSTIN}>
                          {account.GSTIN || "-"}
                        </td>
                        <td className="w-[180px] border-gray-300 border-r text-center text-slate-700 py-3 px-3 align-top">
                          {Array.isArray(account.Groups) ? account.Groups.join(", ") : ""}
                        </td>
                        <td className="w-[250px] border-gray-300 border-r text-slate-700 py-3 px-3 align-top" title={account.Address}>
                          {account.Address}
                        </td>
                        <td className="w-[120px] border-gray-300 border-r text-center text-slate-700 py-3 px-3 align-top">
                          {Array.isArray(account.Stations) ? account.Stations.join(", ") : ""}
                        </td>
                        <td className="w-[120px] border-gray-300 border-r text-center text-slate-700 py-3 px-3 align-top">
                          {account.State}
                        </td>
                        <td className="w-[150px] border-gray-300 border-r text-center text-slate-700 font-medium py-3 px-3 align-top">
                          {account.OpeningBalance?.type === "Dr" ? `₹${account.OpeningBalance.balance}` : "0.00"}
                        </td>
                        <td className="w-[150px] border-gray-300 border-r text-center text-slate-700 font-medium py-3 px-3 align-top">
                          {account.OpeningBalance?.type === "Cr" ? `₹${account.OpeningBalance.balance}` : "0.00"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div >

          <div className="mt-6 text-center text-slate-500 text-base">
            Showing {filteredAccounts.length} of {accounts.length} account records
          </div>
        </div >
      </div >
    </div>
  );
}

export default AccountMaster;
