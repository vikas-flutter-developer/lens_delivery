import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash,
  Plus,
  Search,
  RotateCcw,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { getAllAccountGroups, deleteAccountGroup } from "../controllers/AccountGroupController";
function AccountGroupMaster() {
  const [searchTerm, setSearchTerm] = useState("");
  const [accountGroups, setAccountGroups] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    const fetchData = async () => {
      const res = await getAllAccountGroups();
      setAccountGroups(res);
    };
    fetchData();
  }, []);

  const handleReset = () => {
    setSearchTerm("");
  };

  const handleEdit = (id) => {
    navigate(`/add/accountgroupmaster/${id}`)
  }
  const fetchAccountGroups = async () => {
    try {
      const res = await getAllAccountGroups();
      setAccountGroups(res);
    } catch (err) {
      toast.error("Failed to fetch account groups!");
    }
  };

  useEffect(() => {
    fetchAccountGroups();
  }, []);

  const handleDelete = async (id) => {
    try {
      const res = await deleteAccountGroup(id);
      if (!res) return toast.error("Something went wrong!");
      if (res.success === false) return toast.error(res.message || "Failed to delete!");
      if (res.success === true) {
        toast.success("Account Group deleted successfully!");
        setAccountGroups((prev) => prev.filter((group) => group._id !== id));
      }
    } catch (err) {
      console.log(err);
      toast.error("Error deleting account group!");
    }
  };

  const filteredAccounts = accountGroups.filter((account) =>
    account.accountGroupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownloadExcel = () => {
    if (filteredAccounts.length === 0) {
      toast.error("No records to download");
      return;
    }
    const exportData = filteredAccounts.map((account, index) => ({
      "Sr. No.": index + 1,
      "Account Group Name": account.accountGroupName,
      "Primary": account.primaryGroup,
      "Ledger Group": account.LedgerGroup,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Account Groups");
    XLSX.writeFile(workbook, "AccountGroupMaster.xlsx");
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
        <td style="font-weight: 600;">${account.accountGroupName || "-"}</td>
        <td style="text-align: center;">${account.primaryGroup || "-"}</td>
        <td>${account.LedgerGroup || "-"}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Account Group Master - ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: white; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
            .header p { margin: 5px 0 0 0; color: #64748b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 12px; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f1f5f9; }
            .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Account Group Master</h1>
              <p>Generated on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            </div>
            <div style="text-align: right;">
              <p>Total Groups: <strong>${filteredAccounts.length}</strong></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">Sr. No.</th>
                <th>Account Group Name</th>
                <th style="width: 80px; text-align: center;">Primary</th>
                <th>Ledger Group</th>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Account Group Master
          </h1>
          <p className="text-slate-600">
            Manage your account groups and ledger classifications
          </p>
        </div>

        {/* Controls Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search Section */}
            <div className="flex items-center gap-3 flex-1 min-w-64">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // Trigger search - currently the filter is real-time, so this is a no-op
                      console.log("Search triggered with term:", searchTerm);
                    }
                  }}
                  placeholder="Search by account name..."
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 outline-none"
                />
              </div>
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md flex items-center gap-2">
                <Search className="w-4 h-4" /> Search
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors duration-200 font-medium flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Link
                to={"/add/accountgroupmaster/"}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadExcel}
                  className="p-3 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm"
                  title="Download Excel"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrint}
                  className="p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm"
                  title="Print"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-6 gap-4 p-4 font-semibold text-slate-700">
              <div className="text-center">Sr. No.</div>
              <div>Account Group Name</div>
              <div className="text-center">Primary</div>
              <div>Ledger Group</div>
              <div className="text-center">Edit</div>
              <div className="text-center">Delete</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-200">
            {filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-lg">No accounts found</p>
                <p className="text-sm">Try adjusting your search criteria</p>
              </div>
            ) : (
              filteredAccounts.map((account, index) => (
                <div
                  key={account._id || index}
                  className="grid grid-cols-6 gap-4 p-4 hover:bg-slate-50 transition-colors duration-150 group"
                >
                  <div className="text-center text-slate-600 font-medium">
                    {index + 1}
                  </div>
                  <div className="font-medium text-slate-800">
                    {account.accountGroupName}
                  </div>
                  <div className="text-center">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${account.primaryGroup === "Y"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-600"
                        }`}
                    >
                      {account.primaryGroup}
                    </span>
                  </div>
                  <div className="text-slate-700">{account.LedgerGroup}</div>
                  <div className="text-center">
                    <button onClick={() => handleEdit(account._id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 group-hover:shadow-sm">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-center">
                    <button onClick={() => handleDelete(account._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 group-hover:shadow-sm">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          Showing {filteredAccounts.length} of {accountGroups.length} account
          groups
        </div>
      </div>
    </div>
  );
}

export default AccountGroupMaster;
