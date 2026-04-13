import React, { useState, useEffect, useMemo, useCallback } from "react";
import ApiClient from "../ApiClient";
import {
  Users,
  Package,
  Search,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
  Star,
  Eye,
  RefreshCw,
  X,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const INR = (v) =>
  `₹${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const today = () => new Date().toISOString().split("T")[0];
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};

// ─── Mini Bar Chart (top 5 items) ────────────────────────────────────────────
const TopItemsChart = ({ data = [] }) => {
  const top5 = [...data].slice(0, 5);
  if (!top5.length)
    return (
      <div className="flex items-center justify-center h-full text-slate-300 text-[10px] font-black uppercase tracking-widest">
        No data to display
      </div>
    );
  const maxQty = Math.max(...top5.map((d) => d.totalQty), 1);
  return (
    <div className="space-y-4">
      {top5.map((d, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tight">
            <span className="truncate max-w-[60%]">{d.itemName}</span>
            <span className="text-indigo-600">{d.totalQty.toLocaleString()} pcs</span>
          </div>
          <div className="relative h-3.5 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000"
              style={{ width: `${(d.totalQty / maxQty) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CustomerItemSalesReport = () => {
  // Customers list
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");

  // Filters
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");

  // Report state
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({});
  const [sortKey, setSortKey] = useState("totalQty");
  const [sortDir, setSortDir] = useState("desc");
  const [hasSearched, setHasSearched] = useState(false);

  // ── Fetch data on mount ─────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, itemRes] = await Promise.all([
          ApiClient.get("/accounts/getallaccounts"),
          ApiClient.get("/items")
        ]);

        let accData = custRes.data;
        if (accData && accData.success !== undefined) {
          accData = accData.data;
        }
        if (Array.isArray(accData)) {
          const sale = accData.filter(
            (a) => a.AccountType === "Sale" || a.AccountType === "Both"
          );
          setCustomers(sale);
        }

        let itmData = itemRes.data;
        if (itmData) {
          if (Array.isArray(itmData.items)) {
            itmData = itmData.items;
          } else if (itmData.success !== undefined) {
            itmData = itmData.data;
          }
        }
        if (Array.isArray(itmData)) {
          setItems(itmData);
        }
      } catch {
        // silently fail
      }
    };
    fetchData();
  }, []);

  const filteredCustomers = useMemo(() => {
    const search = selectedCustomer ? "" : customerSearch;
    if (!search) return customers.slice(0, 50);
    return customers
      .filter((c) => c.Name?.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 50);
  }, [customers, customerSearch, selectedCustomer]);

  const filteredItems = useMemo(() => {
    const search = selectedItem ? "" : itemSearch;
    if (!search) return items.slice(0, 50);
    return items
      .filter((i) => i.itemName?.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 50);
  }, [items, itemSearch, selectedItem]);

  // ── Fetch Report ─────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const payload = {
        customerName: selectedCustomer,
        dateFrom,
        dateTo,
        itemSearch: selectedItem || itemSearch || undefined,
      };
      const res = await ApiClient.post("/reports/customer-item-sales", payload);
      if (res.data.success) {
        const rawData = res.data.data || [];
        const groupedMap = new Map();

        rawData.forEach(row => {
          const name = row.itemName || "Unknown";
          if (groupedMap.has(name)) {
            const existing = groupedMap.get(name);
            existing.totalQty += (row.totalQty || 0);
            existing.totalRevenue += (row.totalRevenue || 0);
            existing.orderCount += (row.orderCount || 0);
            if (!existing.lastSoldDate && row.lastSoldDate) {
              existing.lastSoldDate = row.lastSoldDate;
            }
          } else {
            groupedMap.set(name, { ...row });
          }
        });

        const groupedData = Array.from(groupedMap.values());
        let totalOrders = 0;
        groupedData.forEach(r => totalOrders += (r.orderCount || 0));

        setReportData(groupedData);
        setSummary({
          ...(res.data.summary || {}),
          totalItems: groupedData.length,
          totalOrders
        });
      }
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, dateFrom, dateTo, selectedItem, itemSearch]);

  // ── Client-side sort ─────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const d = [...reportData];
    d.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return d;
  }, [reportData, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) =>
    sortKey === col ? (
      sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
    ) : null;

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!sorted.length) return toast.error("No data to export");
    const rows = sorted.map((r, i) => ({
      "SR No.": i + 1,
      "Item Name": r.itemName,
      "Total Qty": r.totalQty,
      "Total Revenue (₹)": r.totalRevenue,
      "Order Count": r.orderCount,
      "Last Sold": r.lastSoldDate || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer Item Sales");
    XLSX.writeFile(wb, `Customer_Item_Sales_${selectedCustomer}_${dateFrom}_${dateTo}.xlsx`);
  };

  const handleReset = () => {
    setSelectedCustomer("");
    setCustomerSearch("");
    setDateFrom(firstOfMonth());
    setDateTo(today());
    setItemSearch("");
    setSelectedItem("");
    setReportData([]);
    setSummary({});
    setHasSearched(false);
  };

  return (
    <div className="flex flex-col gap-6 min-h-screen pb-10 bg-slate-50/30">
      {/* ── Sticky Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-2xl shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
              Customer Item Sales Report
            </h1>
            <p className="text-slate-400 text-xs font-bold mt-1.5 uppercase tracking-widest">
              Items Purchased by Customer · Quantity &amp; Revenue Analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm" title="Export Excel">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => window.print()} className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm" title="Print">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={handleReset} className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm" title="Reset">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-6 space-y-6">

        {/* ── Filter Panel ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-4 print:hidden">
          <div className="flex flex-wrap gap-4 items-end">

            {/* Customer Selector */}
            <div className="flex flex-col gap-1.5 min-w-[240px] flex-1 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Users className="w-3 h-3" /> Customer *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search & select customer…"
                  value={showCustomerDropdown && !selectedCustomer ? customerSearch : selectedCustomer || customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomer("");
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-sm font-black text-slate-800 placeholder:text-slate-300 focus:border-indigo-400 outline-none transition-all"
                />
                {selectedCustomer && (
                  <button
                    onClick={() => { setSelectedCustomer(""); setCustomerSearch(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-y-auto max-h-60">
                  {filteredCustomers.map((c, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50 last:border-0"
                      onMouseDown={() => {
                        setSelectedCustomer(c.Name);
                        setCustomerSearch(c.Name);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      {c.Name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3 h-3" /> From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-sm font-black text-slate-700 focus:border-indigo-400 outline-none transition-all"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3 h-3" /> To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-sm font-black text-slate-700 focus:border-indigo-400 outline-none transition-all"
              />
            </div>

            {/* Item Search Selector */}
            <div className="flex flex-col gap-1.5 min-w-[200px] flex-1 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Search className="w-3 h-3" /> Item Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter items…"
                  value={showItemDropdown && !selectedItem ? itemSearch : selectedItem || itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setSelectedItem("");
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                  onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-4 pr-10 py-2.5 text-sm font-black text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 outline-none transition-all"
                />
                {selectedItem ? (
                  <button
                    onClick={() => { setSelectedItem(""); setItemSearch(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                )}
              </div>
              {showItemDropdown && filteredItems.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-y-auto max-h-60">
                  {filteredItems.map((item, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50 last:border-0"
                      onMouseDown={() => {
                        setSelectedItem(item.itemName);
                        setItemSearch(item.itemName);
                        setShowItemDropdown(false);
                      }}
                    >
                      {item.itemName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={() => { setShowCustomerDropdown(false); setShowItemDropdown(false); fetchReport(); }}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {loading ? "Loading…" : "Generate"}
            </button>
          </div>

        </div>

        {/* ── Summary Cards ── */}
        {hasSearched && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { label: "Total Items", val: summary.totalItems?.toLocaleString() || "0", icon: Package, color: "indigo", sub: "Unique items" },
              { label: "Total Qty Sold", val: summary.totalQty?.toLocaleString() || "0", icon: BarChart3, color: "cyan", sub: "Pieces dispatched" },
              { label: "Total Revenue", val: INR(summary.totalRevenue), icon: TrendingUp, color: "emerald", sub: "Gross sales value" },
            ].map((card, i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-125 -rotate-12">
                  <card.icon className={`w-16 h-16 text-${card.color}-600`} />
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{card.label}</span>
                <div className="mt-2">
                  <span className={`text-2xl font-black text-slate-800 tracking-tight ${i === 3 ? "text-base" : ""}`}>
                    {card.val}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-300 mt-2 uppercase tracking-wider">{card.sub}</span>
                <div className="mt-3 h-1 w-full bg-slate-50 rounded-full">
                  <div className={`h-full w-full bg-${card.color}-500 rounded-full opacity-60`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Charts + Insight Row ── */}
        {hasSearched && !loading && sorted.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top 5 chart */}
            <div className="lg:col-span-7 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-50">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                <h3 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-widest">
                  Top 5 Items by Quantity
                </h3>
              </div>
              <TopItemsChart data={sorted} />
            </div>

            {/* Insights card */}
            <div className="lg:col-span-5 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-cyan-400" />
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <Star className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Customer Insights</h4>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                  {selectedCustomer} has purchased{" "}
                  <span className="text-indigo-600">{summary.totalItems} unique items</span> with a total of{" "}
                  <span className="text-emerald-600">{summary.totalQty} units</span> and revenue of{" "}
                  <span className="text-emerald-600">{INR(summary.totalRevenue)}</span>.
                </p>
                {sorted[0] && (
                  <div className="mt-4 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Top Item</p>
                    <p className="text-sm font-black text-indigo-800">{sorted[0].itemName}</p>
                    <p className="text-[10px] font-bold text-indigo-500 mt-0.5">
                      {sorted[0].totalQty} pcs · {INR(sorted[0].totalRevenue)} · {sorted[0].orderCount} orders
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Main Table ── */}
        {hasSearched && (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                    <th className="px-6 py-5">SR</th>
                    <th
                      className="px-6 py-5 cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => toggleSort("itemName")}
                    >
                      Item Name <SortIcon col="itemName" />
                    </th>
                    <th
                      className="px-6 py-5 text-right cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => toggleSort("totalQty")}
                    >
                      Total Qty <SortIcon col="totalQty" />
                    </th>
                    <th
                      className="px-6 py-5 text-right cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => toggleSort("totalRevenue")}
                    >
                      Revenue <SortIcon col="totalRevenue" />
                    </th>
                    <th className="px-6 py-5 text-center">Orders</th>
                    <th className="px-6 py-5">Last Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-32 text-center text-slate-300 font-black uppercase text-xs animate-pulse tracking-widest">
                        Fetching sales data…
                      </td>
                    </tr>
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">
                        {selectedCustomer
                          ? `No sales found for "${selectedCustomer}" in the selected period`
                          : "Select a customer and click Generate"}
                      </td>
                    </tr>
                  ) : (
                    sorted.map((row, idx) => {
                      const isTop = idx === 0;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/30 transition-colors group ${isTop ? "bg-indigo-50/20" : ""}`}
                        >
                          <td className="px-6 py-5 text-xs font-black text-slate-300">{idx + 1}</td>

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              {isTop && (
                                <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md border border-amber-100">
                                  <Star className="w-2.5 h-2.5" /> Top
                                </span>
                              )}
                              <span className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors max-w-[200px] truncate">
                                {row.itemName || "—"}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-black text-indigo-600">{row.totalQty.toLocaleString()}</span>
                              <div className="w-16 h-1 bg-slate-50 rounded-full overflow-hidden mt-1 border border-slate-100">
                                <div
                                  className="h-full bg-indigo-400 rounded-full"
                                  style={{ width: `${sorted[0] ? (row.totalQty / sorted[0].totalQty) * 100 : 100}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-right">
                            <span className="text-sm font-black text-emerald-600">{INR(row.totalRevenue)}</span>
                          </td>

                          <td className="px-6 py-5 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 text-xs font-black text-slate-600 border border-slate-100">
                              {row.orderCount}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <span className="text-xs font-bold text-slate-400">
                              {row.lastSoldDate || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Grand Total Footer */}
                {!loading && sorted.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-white border-t-2 border-slate-200">
                    <tr className="text-slate-700 font-black text-xs uppercase tracking-widest">
                      <td colSpan={2} className="px-6 py-4 text-right border-double border-t-4 border-indigo-200">
                        Grand Total
                      </td>
                      <td className="px-6 py-4 text-right border-double border-t-4 border-indigo-200 text-indigo-600 text-base">
                        {summary.totalQty?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right border-double border-t-4 border-indigo-200 text-emerald-600">
                        {INR(summary.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-center border-double border-t-4 border-indigo-200 text-slate-800 text-base">
                        {summary.totalOrders?.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 border-double border-t-4 border-indigo-200" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── Empty State (before first search) ── */}
        {!hasSearched && (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-5 bg-indigo-50 rounded-3xl">
              <Package className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">Select a Customer</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                Choose a customer and date range, then click Generate
              </p>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
          .shadow-sm, .shadow-lg { box-shadow: none !important; }
          table { border: 1px solid #eee !important; }
          thead { background: #f8fafc !important; }
        }
      `}} />
    </div>
  );
};

export default CustomerItemSalesReport;
