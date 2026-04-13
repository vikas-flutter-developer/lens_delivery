import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Settings, 
  Search, 
  RotateCcw, 
  FileSpreadsheet, 
  Printer, 
  Pencil, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  AlertCircle,
  X,
  Save,
  Keyboard
} from "lucide-react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { 
  getAllShortcuts, 
  createShortcut, 
  updateShortcut, 
  deleteShortcut, 
  resetShortcuts 
} from "../controllers/Shortcut.controller";

const ShortcutKeysPage = () => {
  const [shortcuts, setShortcuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState(null);
  const [formData, setFormData] = useState({
    pageName: "",
    module: "",
    shortcutKey: "",
    description: "",
    status: "Enabled",
    url: ""
  });

  const modules = ["All", "Masters", "Transaction", "Sale", "Purchase", "Utilities", "Reports"];
  
  // Suggested Page List for the dropdown
  const pageList = [
    { name: "Dashboard", url: "/dashboard", module: "Reports" },
    { name: "Modify Company", url: "/company/modifycompany", module: "Masters" },
    { name: "Close Company", url: "/company/closecompany", module: "Masters" },
    { name: "Active", url: "/active", module: "Utilities" },
    
    // Masters
    { name: "Account Group Master", url: "/masters/accountmaster/accountgroupmaster", module: "Masters" },
    { name: "Account Master", url: "/masters/accountmaster/accountmaster", module: "Masters" },
    { name: "Transporter", url: "/masters/accountmaster/transporter", module: "Masters" },
    { name: "Vendors Master", url: "/masters/vendors", module: "Masters" },
    { name: "Group, Item & Lens Creation", url: "/masters/inventorymaster/creation", module: "Masters" },
    { name: "Lens Price Master", url: "/masters/inventorymaster/lensprice", module: "Masters" },
    { name: "Product Price Account Category Wise", url: "/masters/inventorymaster/productpriceaccountcategorywise", module: "Masters" },
    { name: "Tax Category", url: "/masters/billandothermaster/taxcategory", module: "Masters" },
    { name: "User Master", url: "/masters/userdetails/usermaster", module: "Masters" },
    { name: "Authentication", url: "/masters/userdetails/authentication", module: "Masters" },
    { name: "User Activity", url: "/masters/userdetails/useractivity", module: "Masters" },
    { name: "Master Settings", url: "/masters/mastersettings", module: "Masters" },
    
    // Transactions
    { name: "Add Voucher", url: "/transaction/payrecptumicntr/addvoucher", module: "Transaction" },
    
    // Sale
    { name: "Sale Invoice", url: "/lenstransaction/sale/saleinvoice", module: "Sale" },
    { name: "Sale Order", url: "/lenstransaction/sale/saleorder", module: "Sale" },
    { name: "Sale Challan", url: "/lenstransaction/sale/salechallan", module: "Sale" },
    { name: "Sale Return", url: "/lenstransaction/salereturn", module: "Sale" },
    { name: "Lens Rate Master", url: "/lenstransaction/lensratemaster", module: "Sale" },
    
    // Purchase
    { name: "Purchase Invoice", url: "/lenstransaction/purchase/purchaseinvoice", module: "Purchase" },
    { name: "Purchase Order", url: "/lenstransaction/purchase/purchaseorder", module: "Purchase" },
    { name: "Purchase Challan", url: "/lenstransaction/purchase/purchasechallan", module: "Purchase" },
    { name: "Purchase Return", url: "/lenstransaction/purchasereturn", module: "Purchase" },
    
    // Reports
    { name: "Lens Stock Report", url: "/lenstransaction/lensstockreport/lensstockwithoutbarcode", module: "Reports" },
    { name: "Party Wise Item Report", url: "/lenstransaction/lensstockreport/partywiseitemreport", module: "Reports" },
    { name: "Verify Billing", url: "/lenstransaction/lensstockreport/verifybilling", module: "Reports" },
    { name: "Lens Movement Report", url: "/lenstransaction/lensstockreport/lensmovement", module: "Reports" },
    { name: "Verify Lens Stock", url: "/lenstransaction/lensstockreport/verifylensstock", module: "Reports" },
    { name: "Lens Location", url: "/lenstransaction/lensstockreport/lenslocation", module: "Reports" },
    { name: "Lens SPH/CYL Wise Stock", url: "/lenstransaction/lenssphcylwisestock", module: "Reports" },
    { name: "Damage and Shrinkage", url: "/lenstransaction/damageandshrinkage", module: "Reports" },
    { name: "Product Exchange", url: "/lenstransaction/productexchange", module: "Reports" },
    { name: "Transaction Summary", url: "/reports/transactiondetails/transactionsummary", module: "Reports" },
    { name: "Transaction Detail", url: "/reports/transactiondetails/transactiondetail", module: "Reports" },
    { name: "Day Book", url: "/reports/books/daybook", module: "Reports" },
    { name: "Cash/Bank Book", url: "/reports/books/cashbankbook", module: "Reports" },
    { name: "Profit and Loss (Item)", url: "/reports/books/profitandlossitem", module: "Reports" },
    { name: "Profit and Loss (Account)", url: "/reports/books/profitandlossaccount", module: "Reports" },
    { name: "Balance Sheet", url: "/reports/books/balancesheet", module: "Reports" },
    { name: "Collection Report", url: "/reports/books/collectionreport", module: "Reports" },
    { name: "Account Ledger", url: "/reports/ledger/accountledger", module: "Reports" },
    { name: "Account Ledger Details", url: "/reports/ledger/accountledgerdetails", module: "Reports" },
    { name: "Outstanding", url: "/reports/ledger/outstanding", module: "Reports" },
    { name: "Item Stock Reorder", url: "/reports/stockandinventory/itemstockreorder", module: "Reports" },
    { name: "GST Summary", url: "/reports/gstreports/gstsummary", module: "Reports" },
    { name: "Booked By Report", url: "/reports/otherreports/bookedbyreport", module: "Reports" },
    { name: "Customer Analysis", url: "/reports/otherreports/customeranalysis", module: "Reports" },
    { name: "Deleted Data Report", url: "/reports/otherreports/deleteddatareport", module: "Reports" },
    { name: "Delivery Person Activity Report", url: "/reports/otherreports/useractivityreport", module: "Reports" },
    { name: "Power Movement Report", url: "/reports/otherreports/powermovementreport", module: "Reports" },
    
    // Utilities
    { name: "Offers", url: "/utilities/offers", module: "Utilities" },
    { name: "Product List for Update", url: "/utilities/bulkupdation/productlistforupdate", module: "Utilities" },
    { name: "Shortcut Keys", url: "/utilities/shortcutkeys", module: "Utilities" },
  ];

  useEffect(() => {
    fetchShortcuts();
  }, []);

  const fetchShortcuts = async () => {
    try {
      setLoading(true);
      const data = await getAllShortcuts();
      setShortcuts(data);
    } catch (error) {
      toast.error(error.message || "Failed to fetch shortcuts");
    } finally {
      setLoading(false);
    }
  };

  const filteredShortcuts = useMemo(() => {
    return shortcuts.filter(s => {
      const matchesSearch = s.pageName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.shortcutKey.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = moduleFilter === "All" || s.module === moduleFilter;
      return matchesSearch && matchesModule;
    });
  }, [shortcuts, searchQuery, moduleFilter]);

  const handleOpenModal = (shortcut = null) => {
    if (shortcut) {
      setEditingShortcut(shortcut);
      setFormData({
        pageName: shortcut.pageName,
        module: shortcut.module,
        shortcutKey: shortcut.shortcutKey,
        description: shortcut.description || "",
        status: shortcut.status,
        url: shortcut.url
      });
    } else {
      setEditingShortcut(null);
      setFormData({
        pageName: "",
        module: "",
        shortcutKey: "",
        description: "",
        status: "Enabled",
        url: ""
      });
    }
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "pageName") {
      const selectedPage = pageList.find(p => p.name === value);
      if (selectedPage) {
        setFormData(prev => ({
          ...prev,
          pageName: selectedPage.name,
          url: selectedPage.url,
          module: selectedPage.module
        }));
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingShortcut) {
        await updateShortcut(editingShortcut._id, formData);
        toast.success("Shortcut updated successfully");
      } else {
        await createShortcut(formData);
        toast.success("Shortcut created successfully");
      }
      setShowModal(false);
      fetchShortcuts();
      window.dispatchEvent(new Event('shortcut-updated'));
    } catch (error) {
      const msg = error.message || (typeof error === 'string' ? error : "Operation failed");
      toast.error(msg);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this shortcut?")) {
      try {
        await deleteShortcut(id);
        toast.success("Shortcut deleted");
        fetchShortcuts();
        window.dispatchEvent(new Event('shortcut-updated'));
      } catch (error) {
        toast.error(error.message || "Failed to delete");
      }
    }
  };

  const handleToggleStatus = async (shortcut) => {
    try {
      const newStatus = shortcut.status === "Enabled" ? "Disabled" : "Enabled";
      await updateShortcut(shortcut._id, { ...shortcut, status: newStatus });
      toast.success(`Shortcut ${newStatus}`);
      fetchShortcuts();
      window.dispatchEvent(new Event('shortcut-updated'));
    } catch (error) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const handleReset = async () => {
    if (window.confirm("Reset all shortcuts to defaults? This will erase your customizations.")) {
      try {
        await resetShortcuts();
        toast.success("Shortcuts reset to defaults");
        fetchShortcuts();
        window.dispatchEvent(new Event('shortcut-updated'));
      } catch (error) {
        toast.error(error.message || "Failed to reset");
      }
    }
  };

  const handleExport = () => {
    const exportData = filteredShortcuts.map((s, index) => ({
      "Sr. No.": index + 1,
      "Page Name": s.pageName,
      "Module": s.module,
      "Shortcut Key": s.shortcutKey,
      "Description": s.description || "-",
      "Status": s.status
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Shortcut Keys");
    XLSX.writeFile(workbook, "KeyboardShortcuts.xlsx");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const tableRows = filteredShortcuts.map((s, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${s.pageName}</td>
        <td>${s.module}</td>
        <td style="font-weight: bold; color: #2563eb;">${s.shortcutKey}</td>
        <td>${s.description || "-"}</td>
        <td style="color: ${s.status === 'Enabled' ? '#16a34a' : '#dc2626'}">${s.status}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Keyboard Shortcuts List</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f3f4f6; }
            h1 { color: #1e3a8a; }
          </style>
        </head>
        <body>
          <h1>Available Keyboard Shortcuts</h1>
          <table>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Page Name</th>
                <th>Module</th>
                <th>Shortcut Key</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[95vw] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Keyboard className="w-8 h-8 text-blue-600" />
              Shortcut Keys
            </h1>
            <p className="text-slate-500 mt-1">View, manage, and customize keyboard shortcuts for quick navigation.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Add New Shortcut
            </button>
            <button 
              onClick={handleReset}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 shadow-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Default
            </button>
            <button 
              onClick={handleExport}
              className="p-2 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 rounded-lg shadow-sm"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button 
              onClick={handlePrint}
              className="p-2 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded-lg shadow-sm"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by page name or shortcut key..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-medium">Filter by Module:</span>
            <div className="flex gap-2">
              {modules.map(mod => (
                <button
                  key={mod}
                  onClick={() => setModuleFilter(mod)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    moduleFilter === mod 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm">Sr. No.</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm">Page Name</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm">Module</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm">Shortcut Key</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm">Description</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">Loading shortcuts...</td>
                </tr>
              ) : filteredShortcuts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">No shortcuts found matching your criteria.</td>
                </tr>
              ) : (
                filteredShortcuts.map((s, index) => (
                  <tr key={s._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-slate-500 text-sm">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{s.pageName}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-semibold uppercase tracking-wider">
                        {s.module}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <kbd className="px-2 py-1.5 bg-slate-800 text-white rounded shadow-sm text-xs font-mono">
                        {s.shortcutKey}
                      </kbd>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm max-w-xs truncate" title={s.description}>
                      {s.description || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleToggleStatus(s)}
                        className={`transition-colors ${s.status === 'Enabled' ? 'text-green-500 hover:text-green-600' : 'text-slate-300 hover:text-slate-400'}`}
                      >
                        {s.status === 'Enabled' ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenModal(s)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(s._id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Settings Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingShortcut ? <Settings className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                {editingShortcut ? "Edit Shortcut" : "Add New Shortcut"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Page Name</label>
                <input 
                  type="text"
                  list="pages-autocomplete"
                  name="pageName"
                  value={formData.pageName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Sale Invoice"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <datalist id="pages-autocomplete">
                  {pageList.map(p => <option key={p.name} value={p.name} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Module</label>
                  <select 
                    name="module"
                    value={formData.module}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Select Module</option>
                    {modules.filter(m => m !== "All").map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Shortcut Key</label>
                  <input 
                    type="text"
                    name="shortcutKey"
                    value={formData.shortcutKey}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Alt+Shift+S"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Page URL (Internal)</label>
                <input 
                  type="text"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  required
                  placeholder="/lenstransaction/sale/saleinvoice"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea 
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="2"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Briefly describe what this shortcut does..."
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                <span className="text-sm font-semibold text-slate-700">Status:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={formData.status === "Enabled"}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? "Enabled" : "Disabled" }))}
                  />
                  <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.status === 'Enabled' ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.status === 'Enabled' ? 'left-7' : 'left-1'}`} />
                  </div>
                  <span className={`text-sm font-medium ${formData.status === 'Enabled' ? 'text-blue-600' : 'text-slate-500'}`}>
                    {formData.status}
                  </span>
                </label>
              </div>

              {/* Conflict Warning Placeholder */}
              {/* Optional: Add real-time conflict check here */}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> {editingShortcut ? "Save Changes" : "Create Shortcut"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortcutKeysPage;
