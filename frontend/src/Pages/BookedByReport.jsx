import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Download,
  Printer,
  Search,
  RotateCcw,
  ChevronDown,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import { getAllLensSaleOrder } from "../controllers/LensSaleOrder.controller";
import { getAllRxSaleOrder } from "../controllers/RxSaleOrder.controller";
import { getAllContactLensSaleOrder } from "../controllers/ContactLensSaleOrder.controller";
import { toast, Toaster } from "react-hot-toast";

// Helper function to normalize Booked By person names (consistent case)
const normalizeBookedByPerson = (name) => {
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

function BookedByReport() {
  const navigate = useNavigate();
  const printRef = useRef();
  const [saleOrders, setSaleOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookedByPersons, setBookedByPersons] = useState([]);
  const [showBookedByDropdown, setShowBookedByDropdown] = useState(false);

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
    bookedBy: "",
    dateFrom: getCurrentMonthDates().from,
    dateTo: getCurrentMonthDates().to,
    searchText: "",
  });

  const [visibleColumns, setVisibleColumns] = useState({
    srNo: true,
    date: true,
    time: true,
    billNo: true,
    bookedBy: true,
    itemName: true,
    eye: true,
    sph: true,
    cyl: true,
    axis: true,
    add: true,
    remark: true,
    qty: true,
    netAmt: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all three types of sale orders
      const lensRes = await getAllLensSaleOrder();
      const rxRes = await getAllRxSaleOrder();
      const contactRes = await getAllContactLensSaleOrder();

      const lensData = Array.isArray(lensRes?.data) ? lensRes.data : (Array.isArray(lensRes) ? lensRes : []);
      const rxData = Array.isArray(rxRes?.data) ? rxRes.data : (Array.isArray(rxRes) ? rxRes : []);
      const contactData = Array.isArray(contactRes?.data) ? contactRes.data : (Array.isArray(contactRes) ? contactRes : []);

      // Combine all sale orders with type info
      const allOrders = [
        ...lensData.map(o => ({ ...o, orderType: 'Lens' })),
        ...rxData.map(o => ({ ...o, orderType: 'Rx' })),
        ...contactData.map(o => ({ ...o, orderType: 'ContactLens' }))
      ];

      setSaleOrders(allOrders);

      // Extract unique booked by persons (normalized, excluding empty ones)
      const uniquePersons = [...new Set(
        allOrders
          .filter(o => o.billData?.bookedBy && o.billData.bookedBy.trim())
          .map(o => normalizeBookedByPerson(o.billData.bookedBy))
      )].sort();
      setBookedByPersons(uniquePersons);
    } catch (err) {
      console.error("Failed to fetch data", err);
      toast.error("Failed to load booked by data");
      setSaleOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Flatten sale order data to item level and add sr.no
  const flattenedData = useMemo(() => {
    const flattened = [];
    saleOrders.forEach(order => {
      // Only process if booked by person is assigned
      if (!order.billData?.bookedBy || !order.billData.bookedBy.trim()) {
        return;
      }
      
      if (order.items && order.items.length > 0) {
        order.items.forEach((item, idx) => {
          flattened.push({
            ...item,
            _id: `${order._id}-${idx}`,
            orderDate: order.billData?.date || order.createdAt,
            orderTime: getTimeString(order.createdAt),
            billNo: order.billData?.billNo || "",
            bookedBy: normalizeBookedByPerson(order.billData?.bookedBy),
            netAmount: order.netAmount || 0,
            partyName: order.partyData?.partyAccount || "",
            remark: item.remark || order.remark || "",
            orderType: order.orderType,
          });
        });
      }
    });
    return flattened;
  }, [saleOrders]);

  // Filter data based on search and date filters
  const filteredData = useMemo(() => {
    return flattenedData.filter(item => {
      const itemDate = new Date(item.orderDate);
      const filterFromDate = new Date(filters.dateFrom);
      const filterToDate = new Date(filters.dateTo);
      
      // Ensure we include the entire target day
      filterToDate.setHours(23, 59, 59, 999);

      const isInDateRange = itemDate >= filterFromDate && itemDate <= filterToDate;

      // Normalize the filter for case-insensitive comparison
      const normalizedFilterPerson = normalizeBookedByPerson(filters.bookedBy);
      const matchesBookedBy = !normalizedFilterPerson || 
        item.bookedBy === normalizedFilterPerson;

      const matchesSearch = !filters.searchText ||
        (item.billNo && item.billNo.toString().toLowerCase().includes(filters.searchText.toLowerCase())) ||
        (item.itemName && item.itemName.toLowerCase().includes(filters.searchText.toLowerCase())) ||
        (item.partyName && item.partyName.toLowerCase().includes(filters.searchText.toLowerCase())) ||
        (item.bookedBy && item.bookedBy.toLowerCase().includes(filters.searchText.toLowerCase()));

      return isInDateRange && matchesBookedBy && matchesSearch;
    });
  }, [flattenedData, filters]);

  // Calculate performance statistics
  const performanceStats = useMemo(() => {
    const stats = {};
    filteredData.forEach(item => {
      // Skip items without a booked by person
      if (!item.bookedBy || item.bookedBy.trim() === '') {
        return;
      }
      
      if (!stats[item.bookedBy]) {
        stats[item.bookedBy] = { count: 0, totalQty: 0, totalAmount: 0 };
      }
      stats[item.bookedBy].count += 1;
      stats[item.bookedBy].totalQty += Number(item.qty || 0);
      stats[item.bookedBy].totalAmount += Number(item.netAmount || 0);
    });

    const ranked = Object.entries(stats)
      .map(([person, data]) => ({ person, ...data }))
      .sort((a, b) => b.count - a.count);

    return ranked;
  }, [filteredData]);

  const handleExportToExcel = () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = filteredData.map((item, idx) => ({
      "Sr. No.": idx + 1,
      "Date": new Date(item.orderDate).toLocaleDateString("en-IN"),
      "Time": item.orderTime || "",
      "Bill No.": item.billNo,
      "Booked By": item.bookedBy,
      "Item Name": item.itemName || "",
      "Eye": item.eye || "",
      "Sph": item.sph || "",
      "Cyl": item.cyl || "",
      "Axis": item.axis || "",
      "Add": item.add || "",
      "Remark": item.remark || "",
      "Qty": item.qty || 0,
      "Net Amt": item.netAmount || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Booked By Report");
    
    // Set column widths
    const colWidths = [8, 12, 12, 12, 15, 15, 8, 8, 8, 8, 8, 15, 8, 12];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.writeFile(wb, `Booked_By_Activity_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Report exported successfully!");
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const printContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Booked By Activity Report</title>
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
          <h1>Booked By Activity Report</h1>
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
      bookedBy: "",
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
            <Users className="text-blue-600" size={32} />
            Booked By Activity Report
          </h1>
          <p className="text-slate-600 mt-1">Track and analyze booking person performance</p>
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

            {/* Booked By Dropdown */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Users size={16} className="inline mr-2" />
                Booked By
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or select..."
                  value={filters.bookedBy}
                  onChange={(e) => setFilters({ ...filters, bookedBy: e.target.value })}
                  onFocus={() => setShowBookedByDropdown(true)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <ChevronDown className="absolute right-3 top-10 text-slate-400 pointer-events-none" size={20} />
              </div>
              {showBookedByDropdown && (
                <div className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                  {bookedByPersons.map(person => (
                    <div
                      key={person}
                      onClick={() => {
                        setFilters({ ...filters, bookedBy: person });
                        setShowBookedByDropdown(false);
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-slate-700">
          Showing <span className="font-bold text-blue-600">{filteredData.length}</span> booking records
          {filters.bookedBy && ` for ${filters.bookedBy}`}
          {filters.dateFrom && ` from ${new Date(filters.dateFrom).toLocaleDateString("en-IN")}`}
          {filters.dateTo && ` to ${new Date(filters.dateTo).toLocaleDateString("en-IN")}`}
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
                    {visibleColumns.srNo && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Sr. No.</th>}
                    {visibleColumns.date && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date</th>}
                    {visibleColumns.time && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Time</th>}
                    {visibleColumns.billNo && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Bill No.</th>}
                    {visibleColumns.bookedBy && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Booked By</th>}
                    {visibleColumns.itemName && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Item Name</th>}
                    {visibleColumns.eye && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Eye</th>}
                    {visibleColumns.sph && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Sph</th>}
                    {visibleColumns.cyl && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Cyl</th>}
                    {visibleColumns.axis && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Axis</th>}
                    {visibleColumns.add && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Add</th>}
                    {visibleColumns.remark && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Remark</th>}
                    {visibleColumns.qty && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Qty</th>}
                    {visibleColumns.netAmt && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Net Amt</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr key={item._id} className="border-b border-slate-200 hover:bg-blue-50 transition-colors">
                      {visibleColumns.srNo && <td className="px-4 py-3 text-sm text-slate-700">{idx + 1}</td>}
                      {visibleColumns.date && <td className="px-4 py-3 text-sm text-slate-700">{new Date(item.orderDate).toLocaleDateString("en-IN")}</td>}
                      {visibleColumns.time && <td className="px-4 py-3 text-sm text-slate-700">{item.orderTime || "-"}</td>}
                      {visibleColumns.billNo && <td className="px-4 py-3 text-sm text-slate-700">{item.billNo}</td>}
                      {visibleColumns.bookedBy && <td className="px-4 py-3 text-sm text-slate-700 font-medium">{item.bookedBy}</td>}
                      {visibleColumns.itemName && <td className="px-4 py-3 text-sm text-slate-700">{item.itemName || "-"}</td>}
                      {visibleColumns.eye && <td className="px-4 py-3 text-sm text-slate-700">{item.eye || "-"}</td>}
                      {visibleColumns.sph && <td className="px-4 py-3 text-sm text-slate-700">{item.sph || "-"}</td>}
                      {visibleColumns.cyl && <td className="px-4 py-3 text-sm text-slate-700">{item.cyl || "-"}</td>}
                      {visibleColumns.axis && <td className="px-4 py-3 text-sm text-slate-700">{item.axis || "-"}</td>}
                      {visibleColumns.add && <td className="px-4 py-3 text-sm text-slate-700">{item.add || "-"}</td>}
                      {visibleColumns.remark && <td className="px-4 py-3 text-sm text-slate-700">{item.remark || "-"}</td>}
                      {visibleColumns.qty && <td className="px-4 py-3 text-sm text-slate-700">{item.qty || 0}</td>}
                      {visibleColumns.netAmt && <td className="px-4 py-3 text-sm text-slate-700">₹{Number(item.netAmount || 0).toFixed(2)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex justify-center items-center h-64 text-slate-500">
              <div className="text-center">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>No booking records found</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookedByReport;
