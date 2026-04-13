import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Download,
  Printer,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Truck,
  Calendar,
  Eye,
  EyeOff,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import { getAllLensSaleChallan } from "../controllers/LensSaleChallan.controller";
import { toast, Toaster } from "react-hot-toast";

// Helper function to normalize delivery person names (consistent case)
const normalizeDeliveryPerson = (name) => {
  if (!name || typeof name !== 'string') return '';
  // Trim whitespace and convert to title case
  const trimmed = name.trim();
  return trimmed.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// Helper function to extract time in 12-hour format
const getTimeString = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    });
  } catch {
    return '';
  }
};

function DeliveryPersonActivityReport() {
  const navigate = useNavigate();
  const printRef = useRef();
  const [saleChallans, setSaleChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [showDeliveryPersonDropdown, setShowDeliveryPersonDropdown] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  // Get current month's start and end dates
  const getCurrentMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      from: firstDay.toISOString().split('T')[0],
      to: lastDay.toISOString().split('T')[0]
    };
  };

  const [filters, setFilters] = useState({
    deliveryPerson: "",
    dateFrom: getCurrentMonthDates().from,
    dateTo: getCurrentMonthDates().to,
    searchText: "",
  });

  const [visibleColumns, setVisibleColumns] = useState({
    srNo: true,
    date: true,
    time: true,
    billNo: true,
    partyName: true,
    deliveryPerson: true,
    itemName: true,
    eye: true,
    sph: true,
    cyl: true,
    axis: true,
    add: true,
    lensPower: true,
    remark: true,
    qty: true,
    netAmt: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getAllLensSaleChallan();
      const challansData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setSaleChallans(challansData);

      // Extract unique delivery persons (normalized, excluding empty ones)
      const uniquePersons = [...new Set(
        challansData
          .filter(c => c.deliveryPerson && c.deliveryPerson.trim())
          .map(c => normalizeDeliveryPerson(c.deliveryPerson))
      )].sort();
      setDeliveryPersons(uniquePersons);
    } catch (err) {
      console.error("Failed to fetch data", err);
      toast.error("Failed to load delivery data");
      setSaleChallans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group challan data by order and add summary info
  const groupedData = useMemo(() => {
    const grouped = [];
    saleChallans.forEach(challan => {
      // Only process if delivery person is assigned
      if (!challan.deliveryPerson || !challan.deliveryPerson.trim()) {
        return;
      }
      
      const totalQty = (challan.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const totalAmount = challan.netAmount || 0;

      grouped.push({
        _id: challan._id,
        challanDate: challan.deliveryPersonAssignedAt || challan.billData?.date || challan.createdAt,
        challanTime: getTimeString(challan.deliveryPersonAssignedAt),
        outForDeliveryTime: challan.outForDeliveryTime,
        deliveredTime: challan.deliveredTime,
        deliveryStatus: challan.deliveryStatus || "Out for Delivery", // default if missing
        billNo: challan.billData?.billNo || "N/A",
        deliveryPerson: normalizeDeliveryPerson(challan.deliveryPerson),
        netAmount: totalAmount,
        partyName: challan.partyData?.partyAccount || "Unknown",
        items: challan.items || [],
        totalQty: totalQty,
        itemCount: (challan.items || []).length,
        remark: challan.remark || "",
      });
    });
    return grouped;
  }, [saleChallans]);

  const getDuration = (start, end) => {
    if (!start || !end) return "-";
    const diff = new Date(end) - new Date(start);
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  // Filter data based on search and date filters
  const filteredData = useMemo(() => {
    return groupedData.filter(order => {
      const orderDate = new Date(order.challanDate);
      const filterFromDate = new Date(filters.dateFrom);
      const filterToDate = new Date(filters.dateTo);
      
      filterToDate.setHours(23, 59, 59, 999);

      const isInDateRange = orderDate >= filterFromDate && orderDate <= filterToDate;

      const normalizedFilterPerson = normalizeDeliveryPerson(filters.deliveryPerson);
      const matchesDeliveryPerson = !normalizedFilterPerson || 
        order.deliveryPerson === normalizedFilterPerson;

      const matchesSearch = !filters.searchText ||
        (order.billNo && order.billNo.toString().toLowerCase().includes(filters.searchText.toLowerCase())) ||
        (order.partyName && order.partyName.toLowerCase().includes(filters.searchText.toLowerCase())) ||
        (order.deliveryPerson && order.deliveryPerson.toLowerCase().includes(filters.searchText.toLowerCase())) ||
        (order.items && order.items.some(it => it.itemName && it.itemName.toLowerCase().includes(filters.searchText.toLowerCase())));

      return isInDateRange && matchesDeliveryPerson && matchesSearch;
    });
  }, [groupedData, filters]);

  // Calculate performance statistics based on unique orders
  const performanceStats = useMemo(() => {
    const stats = {};
    filteredData.forEach(order => {
      if (!order.deliveryPerson || order.deliveryPerson.trim() === '') return;
      
      if (!stats[order.deliveryPerson]) {
        stats[order.deliveryPerson] = { count: 0, totalQty: 0, totalAmount: 0 };
      }
      stats[order.deliveryPerson].count += 1;
      stats[order.deliveryPerson].totalQty += Number(order.totalQty || 0);
      stats[order.deliveryPerson].totalAmount += Number(order.netAmount || 0);
    });

    const ranked = Object.entries(stats)
      .map(([person, data]) => ({ person, ...data }))
      .sort((a, b) => b.count - a.count);

    return ranked;
  }, [filteredData]);

  const toggleOrderExpansion = (orderId) => {
    const next = new Set(expandedOrders);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setExpandedOrders(next);
  };

  const handleExportToExcel = () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = [];
    filteredData.forEach((order, idx) => {
      order.items.forEach((item, itIdx) => {
        exportData.push({
          "Sr. No.": `${idx + 1}.${itIdx + 1}`,
          "Dispatch Date": new Date(order.outForDeliveryTime || order.challanDate).toLocaleDateString("en-IN"),
          "Dispatch Time": getTimeString(order.outForDeliveryTime || order.challanDate),
          "Delivery Time": order.deliveredTime ? getTimeString(order.deliveredTime) : "Pending",
          "Duration": getDuration(order.outForDeliveryTime || order.challanDate, order.deliveredTime),
          "Status": order.deliveryStatus,
          "Bill No.": order.billNo,
          "Party Name": order.partyName,
          "Delivery Person": order.deliveryPerson,
          "Item Name": item.itemName || "",
          "Eye": item.eye || "",
          "Sph": item.sph || "",
          "Cyl": item.cyl || "",
          "Qty": item.qty || 0,
          "Total Order Net Amt": order.netAmount,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delivery Report");
    
    // Set column widths
    const colWidths = [8, 12, 12, 12, 25, 15, 15, 8, 8, 8, 8, 8, 15, 8, 12];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.writeFile(wb, `Delivery_Person_Activity_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Report exported successfully!");
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const printContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Delivery Person Activity Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .print-container { padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            thead { background-color: #f3f4f6; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
            th { font-weight: bold; background-color: #f3f4f6; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .statistics { margin-top: 30px; page-break-before: avoid; }
            .stat-card { display: inline-block; width: 23%; margin: 10px 1%; padding: 15px; border: 1px solid #d1d5db; border-radius: 4px; background-color: #fff; }
            .stat-label { color: #6b7280; font-size: 12px; }
            .stat-value { font-size: 18px; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body class="print-container">
          <h1>Delivery Person Activity Report</h1>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    toast.success("Print dialog opened!");
  };

  const handleRefresh = () => {
    setFilters({
      deliveryPerson: "",
      dateFrom: getCurrentMonthDates().from,
      dateTo: getCurrentMonthDates().to,
      searchText: "",
    });
    fetchData();
    toast.success("Filters reset!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Toaster />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="text-blue-600" size={32} />
            Delivery Person Activity Report
          </h1>
          <p className="text-slate-600 mt-1">Track and analyze delivery person performance</p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={16} className="inline mr-2" />
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={16} className="inline mr-2" />
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Delivery Person Dropdown */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Truck size={16} className="inline mr-2" />
                Delivery Person
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or select..."
                  value={filters.deliveryPerson}
                  onChange={(e) => setFilters({ ...filters, deliveryPerson: e.target.value })}
                  onFocus={() => setShowDeliveryPersonDropdown(true)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <ChevronDown className="absolute right-3 top-10 text-slate-400 pointer-events-none" size={20} />
              </div>
              {showDeliveryPersonDropdown && (
                <div className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                  {deliveryPersons.map(person => (
                    <div
                      key={person}
                      onClick={() => {
                        setFilters({ ...filters, deliveryPerson: person });
                        setShowDeliveryPersonDropdown(false);
                      }}
                      className="px-4 py-2 hover:bg-blue-100 cursor-pointer border-b border-slate-200 last:border-b-0"
                    >
                      {person}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Search */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Search size={16} className="inline mr-2" />
                Quick Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Bill No, Item, Party..."
                  value={filters.searchText}
                  onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute right-3 top-2.5 text-slate-400" size={20} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download size={18} />
              Export to Excel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Printer size={18} />
              Print
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <RotateCcw size={18} />
              Reset
            </button>
          </div>
        </div>

        {/* Performance Statistics */}
        {performanceStats.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={24} className="text-blue-600" />
              Performance Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {performanceStats.map((stat, idx) => (
                <div key={idx} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{stat.person}</p>
                      <p className="text-2xl font-bold text-blue-600">{stat.count}</p>
                    </div>
                    <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <p>Total Qty: {stat.totalQty}</p>
                    <p>Total Amount: ₹{stat.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-slate-700 flex justify-between items-center">
          <div>
            Showing <span className="font-bold text-blue-600">{filteredData.length}</span> unique orders
            {filters.deliveryPerson && ` for ${filters.deliveryPerson}`}
            {filters.dateFrom && ` from ${new Date(filters.dateFrom).toLocaleDateString("en-IN")}`}
            {filters.dateTo && ` to ${new Date(filters.dateTo).toLocaleDateString("en-IN")}`}
          </div>
          <button 
            onClick={() => {
              if (expandedOrders.size === filteredData.length) setExpandedOrders(new Set());
              else setExpandedOrders(new Set(filteredData.map(o => o._id)));
            }}
            className="text-blue-600 font-bold hover:underline text-xs"
          >
            {expandedOrders.size === filteredData.length ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Table Section - For both display and printing */}
        <div
          ref={printRef}
          className="bg-white rounded-lg shadow-md overflow-hidden"
        >
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 w-10"></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 w-16">Sr. No.</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Order Ref</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Dispatch Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Delivery Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Delivery Person</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Net Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((order, idx) => {
                    const isExpanded = expandedOrders.has(order._id);
                    const isDelivered = order.deliveryStatus === "Delivered";
                    return (
                      <React.Fragment key={order._id}>
                        <tr 
                          onClick={() => toggleOrderExpansion(order._id)}
                          className={`border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : ''}`}
                        >
                          <td className="px-4 py-3 text-center">
                            {isExpanded ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-bold text-blue-600 line-clamp-1">{order.billNo}</div>
                            <div className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">{order.partyName}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                            <div className="font-semibold text-slate-600">{new Date(order.outForDeliveryTime || order.challanDate).toLocaleDateString("en-IN")}</div>
                            <div className="text-blue-500 font-bold tabular-nums">{getTimeString(order.outForDeliveryTime || order.challanDate)}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                            {order.deliveredTime ? (
                              <>
                                <div className="font-semibold text-slate-600">{new Date(order.deliveredTime).toLocaleDateString("en-IN")}</div>
                                <div className="text-green-600 font-bold tabular-nums">{getTimeString(order.deliveredTime)}</div>
                              </>
                            ) : (
                              <span className="text-slate-300 italic">Pending...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-black text-slate-600">
                            {getDuration(order.outForDeliveryTime || order.challanDate, order.deliveredTime)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 decoration-blue-200 underline-offset-4">{order.deliveryPerson}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isDelivered ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'
                            }`}>
                              {order.deliveryStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-indigo-700 font-black">₹{Number(order.netAmount || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 italic max-w-xs truncate">{order.remark || "-"}</td>
                        </tr>
                        
                        {isExpanded && (
                          <tr className="bg-blue-50/30">
                            <td colSpan="10" className="px-8 py-4 border-b border-blue-100">
                              <div className="bg-white rounded-xl shadow-inner border border-blue-100 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-blue-100/50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-blue-800">Item Name</th>
                                      <th className="px-3 py-2 text-center text-blue-800">Eye</th>
                                      <th className="px-3 py-2 text-center text-blue-800">Sph</th>
                                      <th className="px-3 py-2 text-center text-blue-800">Cyl</th>
                                      <th className="px-3 py-2 text-center text-blue-800">Axis</th>
                                      <th className="px-3 py-2 text-center text-blue-800">Add</th>
                                      <th className="px-3 py-2 text-center text-blue-800">Qty</th>
                                      <th className="px-3 py-2 text-left text-blue-800">Remark</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item, i) => (
                                      <tr key={i} className="border-b border-blue-50 last:border-0">
                                        <td className="px-3 py-2 font-bold text-slate-700 flex items-center gap-2">
                                          <Package size={12} className="text-slate-400" />
                                          {item.itemName}
                                        </td>
                                        <td className="px-3 py-2 text-center">{item.eye || "-"}</td>
                                        <td className="px-3 py-2 text-center font-medium">{item.sph || "-"}</td>
                                        <td className="px-3 py-2 text-center font-medium">{item.cyl || "-"}</td>
                                        <td className="px-3 py-2 text-center">{item.axis || "-"}</td>
                                        <td className="px-3 py-2 text-center">{item.add || "-"}</td>
                                        <td className="px-3 py-2 text-center font-black text-blue-700">{item.qty}</td>
                                        <td className="px-3 py-2 text-slate-500 italic">{item.remark || "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex justify-center items-center h-64 text-slate-500">
              <div className="text-center">
                <Truck size={48} className="mx-auto mb-2 opacity-50" />
                <p>No delivery records found</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeliveryPersonActivityReport;
