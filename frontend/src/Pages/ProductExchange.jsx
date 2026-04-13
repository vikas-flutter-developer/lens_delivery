import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash,
  Search,
  RotateCcw,
  Menu,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { getAllProductExchanges, deleteProductExchange } from "../controllers/ProductExchange.controller";
import { toast } from "react-hot-toast";

function ProductExchange() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    billSeries: "",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const res = await getAllProductExchanges();
      if (res.success) {
        setVouchers(res.data);
      }
    } catch (err) {
      toast.error("Failed to fetch exchange records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const handleReset = () =>
    setFilters({
      billSeries: "",
      dateFrom: "",
      dateTo: "",
      searchText: "",
    });

  const filteredVouchers = useMemo(() => {
    const q = filters.searchText.toLowerCase();
    return vouchers.filter((v) => {
      const billNo = v.billData?.billNo || "";
      const partyName = v.partyData?.partyAccount || "";
      const billSeries = v.billData?.billSeries || "";
      const type = v.billData?.type || "";
      const status = v.status || "";
      const date = v.billData?.date ? new Date(v.billData.date).toISOString().split('T')[0] : "";

      if (q && !`${billNo} ${partyName} ${billSeries} ${type} ${status}`.toLowerCase().includes(q)) return false;
      if (filters.billSeries && !billSeries.toLowerCase().includes(filters.billSeries.toLowerCase())) return false;
      if (filters.dateFrom && date < filters.dateFrom) return false;
      if (filters.dateTo && date > filters.dateTo) return false;
      return true;
    });
  }, [filters, vouchers]);

  const parseNumber = (val) => {
    if (val === null || val === undefined) return 0;
    const n = Number(String(val).replace(/,/g, "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const totals = useMemo(() => {
    let totalExchInQty = 0,
      totalExchInAmnt = 0,
      totalExchOutQty = 0,
      totalExchOutAmnt = 0;
    filteredVouchers.forEach((v) => {
      totalExchInQty += parseNumber(v.totals?.totalExchInQty);
      totalExchInAmnt += parseNumber(v.totals?.totalExchInAmnt);
      totalExchOutQty += parseNumber(v.totals?.totalExchOutQty);
      totalExchOutAmnt += parseNumber(v.totals?.totalExchOutAmnt);
    });
    return { totalExchInQty, totalExchInAmnt, totalExchOutQty, totalExchOutAmnt };
  }, [filteredVouchers]);

  const formatINR = (num) =>
    num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusColor = (status) => {
    switch (status) {
      case "Exchange-Out":
        return "bg-red-100 text-red-800";
      case "Exchange-In":
        return "bg-blue-100 text-blue-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this exchange record?")) {
      try {
        const res = await deleteProductExchange(id);
        if (res.success) {
          toast.success("Record deleted successfully");
          fetchVouchers();
        }
      } catch (err) {
        toast.error("Failed to delete record");
      }
    }
  };

  const handleExportToExcel = () => {
    const excelData = filteredVouchers.map((v, i) => ({
      "Sr No.": i + 1,
      "Bill Series": v.billData?.billSeries,
      "Bill No.": v.billData?.billNo,
      "Bill Date": new Date(v.billData?.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
      "Party Name": v.partyData?.partyAccount,
      "Type": v.billData?.type,
      "Exch In Qty": v.totals?.totalExchInQty,
      "Exch In Amnt": v.totals?.totalExchInAmnt,
      "Exch Out Qty": v.totals?.totalExchOutQty,
      "Exch Out Amnt": v.totals?.totalExchOutAmnt,
      "Status": v.status,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Exchange");
    XLSX.writeFile(wb, `Product_Exchange_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintSingle = (v) => {
    const printWindow = window.open('', '', 'height=800,width=1000');
    const printContent = `
      <html>
        <head>
          <title>Exchange Bill - ${v.billData.billNo}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f4f4f4; }
            .totals { text-align: right; font-weight: bold; margin-top: 10px; }
            .section-title { background: #eee; padding: 5px 10px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>PRODUCT EXCHANGE VOUCHER</h2>
            <p>Bill No: ${v.billData.billSeries}/${v.billData.billNo} | Date: ${new Date(v.billData.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </div>
          <div class="details">
            <div>
              <strong>Party Details:</strong><br/>
              ${v.partyData.partyAccount}<br/>
              ${v.partyData.address}<br/>
              Contact: ${v.partyData.contactNumber}
            </div>
            <div style="text-align: right">
              <strong>Other Details:</strong><br/>
              Type: ${v.billData.type}<br/>
              Godown: ${v.billData.godown}<br/>
              Booked By: ${v.billData.bookedBy}
            </div>
          </div>

          <div class="section-title">EXCHANGE OUT ITEMS</div>
          <table>
            <thead>
              <tr><th>Sr</th><th>Code</th><th>Item Name</th><th>Dia</th><th>Eye</th><th>SPH</th><th>CYL</th><th>Axis</th><th>Add</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${v.exchangeOutItems.map((it, i) => `
                <tr>
                  <td>${i + 1}</td><td>${it.code}</td><td>${it.itemName}</td><td>${it.dia}</td><td>${it.eye}</td><td>${it.sph}</td><td>${it.cyl}</td><td>${it.axis}</td><td>${it.add}</td><td>${it.qty}</td><td>${it.price}</td><td>${it.totalAmount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">EXCHANGE IN ITEMS</div>
          <table>
            <thead>
              <tr><th>Sr</th><th>Code</th><th>Item Name</th><th>Dia</th><th>Eye</th><th>SPH</th><th>CYL</th><th>Axis</th><th>Add</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${v.exchangeInItems.map((it, i) => `
                <tr>
                  <td>${i + 1}</td><td>${it.code}</td><td>${it.itemName}</td><td>${it.dia}</td><td>${it.eye}</td><td>${it.sph}</td><td>${it.cyl}</td><td>${it.axis}</td><td>${it.add}</td><td>${it.qty}</td><td>${it.price}</td><td>${it.totalAmount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            Net Difference: ₹${(parseNumber(v.totals.totalExchOutAmnt) - parseNumber(v.totals.totalExchInAmnt)).toFixed(2)}
          </div>
          <div style="margin-top: 50px; display: flex; justify-content: space-between">
            <div>Authorized Signatory</div>
            <div>Receiver's Signature</div>
          </div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const printContent = `
      <html>
        <head>
          <title>Product Exchange Report</title>
          <style>
            body { font-family: sans-serif; margin: 20px; }
            h1 { text-align: center; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 11px; }
            th { background-color: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Product Exchange Report</h1>
          <table>
            <thead>
              <tr><th>Sr</th><th>Series</th><th>No.</th><th>Date</th><th>Party</th><th>Type</th><th>In Qty</th><th>In Amnt</th><th>Out Qty</th><th>Out Amnt</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${filteredVouchers.map((v, i) => `
                <tr>
                  <td>${i + 1}</td><td>${v.billData.billSeries}</td><td>${v.billData.billNo}</td><td>${new Date(v.billData.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td>${v.partyData.partyAccount}</td><td>${v.billData.type}</td><td>${v.totals.totalExchInQty}</td><td>${v.totals.totalExchInAmnt}</td><td>${v.totals.totalExchOutQty}</td><td>${v.totals.totalExchOutAmnt}</td><td>${v.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className="p-2 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-[98vw] mx-auto">
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Product Exchange</h1>
          <p className="text-sm text-slate-600">Total Records: {filteredVouchers.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div className="relative">
              <input type="text" value={filters.billSeries} onChange={(e) => handleFilterChange("billSeries", e.target.value)} placeholder="Bill Series" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg outline-none text-sm" />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Bill Series</label>
            </div>
            <div className="relative">
              <input type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange("dateFrom", e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg outline-none text-sm" />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">From Date</label>
            </div>
            <div className="relative">
              <input type="date" value={filters.dateTo} onChange={(e) => handleFilterChange("dateTo", e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg outline-none text-sm" />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">To Date</label>
            </div>
            <div className="relative">
              <input type="text" value={filters.searchText} onChange={(e) => handleFilterChange("searchText", e.target.value)} placeholder="Search..." className="w-full px-2 py-1.5 border border-slate-300 rounded-lg outline-none text-sm" />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Search</label>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={fetchVouchers} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Search className="w-3.5 h-3.5" /> Search
              </button>
              <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <Link to='/add/addproductexchange' className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
                <Plus className="w-3.5 h-3.5" /> Add Exchange
              </Link>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportToExcel} className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200" title="Export to Excel">
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button onClick={handlePrintAll} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200" title="Print All">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="w-12 text-center py-3 px-2">Sr</th>
                  <th className="py-3 px-2">Series</th>
                  <th className="py-3 px-2">No.</th>
                  <th className="py-3 px-2">Date</th>
                  <th className="py-3 px-2 text-left">Party Name</th>
                  <th className="py-3 px-2">In Qty</th>
                  <th className="py-3 px-2">In Amnt</th>
                  <th className="py-3 px-2">Out Qty</th>
                  <th className="py-3 px-2">Out Amnt</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="w-32 py-3 px-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr><td colSpan="11" className="p-10 text-center">Loading...</td></tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr><td colSpan="11" className="p-10 text-center text-slate-500">No records found</td></tr>
                ) : (
                  filteredVouchers.map((v, i) => (
                    <tr key={v._id} className="hover:bg-blue-50/30 transition">
                      <td className="text-center py-2">{i + 1}</td>
                      <td className="text-center">{v.billData.billSeries}</td>
                      <td className="text-center">{v.billData.billNo}</td>
                      <td className="text-center">{new Date(v.billData.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                      <td className="pl-4 font-medium text-slate-800">{v.partyData.partyAccount}</td>
                      <td className="text-center font-bold">{v.totals.totalExchInQty}</td>
                      <td className="text-center">₹{formatINR(v.totals.totalExchInAmnt)}</td>
                      <td className="text-center font-bold">{v.totals.totalExchOutQty}</td>
                      <td className="text-center">₹{formatINR(v.totals.totalExchOutAmnt)}</td>
                      <td className="text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(v.status)}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-2 px-1 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => navigate(`/add/addproductexchange/${v._id}`)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(v._id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition" title="Delete">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handlePrintSingle(v)} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition" title="Print Bill">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 sticky bottom-0 font-bold border-t-2 border-slate-200">
                <tr className="text-[11px]">
                  <td colSpan="5" className="py-3 px-4 text-right">TOTALS:</td>
                  <td className="text-center">{totals.totalExchInQty.toFixed(2)}</td>
                  <td className="text-center">₹{formatINR(totals.totalExchInAmnt)}</td>
                  <td className="text-center">{totals.totalExchOutQty.toFixed(2)}</td>
                  <td className="text-center">₹{formatINR(totals.totalExchOutAmnt)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductExchange;