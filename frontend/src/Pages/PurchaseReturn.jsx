import React, { useState, useMemo, useEffect } from "react";
import { printBarcodeStickers } from "../utils/BarcodeStickerHelper";
import * as XLSX from "xlsx";
import {
  Plus,
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash,
  Search,
  RotateCcw,
  Menu,
  Truck,
  File,
  Barcode,
  CreditCard,
  Info,
} from "lucide-react";
import {
  getAllLensPurchaseReturn,
  removeLensPurchaseReturn,
  updateReturnQuantities,
} from '../controllers/PurchaseReturn.controller'
import {
  getAllRxPurchaseReturn,
  removeRxPurchaseReturn,
  updateRxPurchaseReturnFields
} from "../controllers/RxPurchaseReturn.controller"
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from 'react-hot-toast'
import { roundAmount } from "../utils/amountUtils";
function PurchaseReturnVoucher() {
  const [purchaseReturns, setPurchaseReturns] = useState([])
  const [expandedRow, setExpandedRow] = useState(null);
  const [quantitiesValues, setQuantitiesValues] = useState({});
  const [filters, setFilters] = useState({
    billSeries: "",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });
  const [dcIds, setDcIds] = useState({});

  const navigate = useNavigate();

  const fetchdata = async () => {
    try {
      const [lensRes, rxRes] = await Promise.all([
        getAllLensPurchaseReturn(),
        getAllRxPurchaseReturn(),
      ]);

      let combinedData = [];
      if (lensRes?.data) combinedData = [...combinedData, ...lensRes.data.map(item => ({ ...item, returnType: "lens" }))];
      if (rxRes?.data) combinedData = [...combinedData, ...rxRes.data.map(item => ({ ...item, returnType: "rx" }))];

      // Sort by date descending
      combinedData.sort((a, b) => new Date(b.billData?.date) - new Date(a.billData?.date));

      setPurchaseReturns(combinedData);
    } catch (err) {
      console.error("Error fetching purchase return data:", err);
      toast.error("Failed to load data");
    }
  };

  useEffect(() => {
    fetchdata();
  }, []);

  const handleQuantityChange = (id, field, value) => {
    if (value === "") {
      setQuantitiesValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: "" } }));
      return;
    }
    const numVal = Number(value);
    if (isNaN(numVal) || numVal < 0) return;

    setQuantitiesValues((prev) => {
      const current = prev[id] || {};
      const newVals = { ...current, [field]: numVal };
      const o = field === "ordQty" ? numVal : Number(current.ordQty || 0);
      const u = field === "usedQty" ? numVal : Number(current.usedQty || 0);
      newVals.balQty = Math.max(0, o - u);
      return { ...prev, [id]: newVals };
    });
  };

  const handleDcIdChange = (id, value) => {
    setDcIds(prev => ({ ...prev, [id]: value }));
  };

  const handleDcIdBlur = async (id, returnType) => {
    const dcId = dcIds[id];
    let res;
    if (returnType === "lens") {
      res = await updateReturnQuantities(id, { dcId });
    } else {
      res = await updateRxPurchaseReturnFields(id, { dcId });
    }

    if (res.success) {
      toast.success("DC ID updated");
    } else {
      toast.error("Failed to update DC ID");
    }
  };

  const saveQuantities = async (id) => {
    const vals = quantitiesValues[id];
    if (!vals) return;
    const o = Number(vals.ordQty || 0);
    const u = Number(vals.usedQty || 0);
    if (u > o) {
      toast.error("Used Qty cannot exceed Order Qty");
      return;
    }
    const res = await updateReturnQuantities(id, { orderQty: o, usedQty: u });
    if (res.success) {
      toast.success("Quantities updated");
      fetchdata();
    } else {
      toast.error("Failed to update");
    }
  };

  useEffect(() => {
    const vals = {};
    const dcs = {};
    if (purchaseReturns) {
      purchaseReturns.forEach(v => {
        vals[v._id] = {
          ordQty: v.orderQty !== undefined ? v.orderQty : (v.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0),
          usedQty: v.usedQty || 0,
          balQty: v.balQty || 0
        };
        dcs[v._id] = v.dcId || "";
      });
      setQuantitiesValues(vals);
      setDcIds(dcs);
    }
  }, [purchaseReturns]);

  const handleFilterChange = (field, value) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const handleAddPurchaseReturn = () => {
    navigate("/lenstransaction/addpurchasereturn");
  };

  const handleReset = () =>
    setFilters({
      billSeries: "",
      dateFrom: "",
      dateTo: "",
      searchText: "",
    });

  const formatTime = (v) => {
    try {
      if (v.time) return v.time;
      const d = v.createdAt || v.billData?.date;
      if (!d) return "-";
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return "-";
      return dt.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "-";
    }
  };

  const safeDate = (d) => {
    try {
      if (!d) return new Date().toISOString().split("T")[0];
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return new Date().toISOString().split("T")[0];
      return dt.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };

  // ── Excel Export ──────────────────────────────────────────────
  const handleExcelExport = () => {
    const rows = filteredVouchers.map((v, i) => ({
      "S.N.": i + 1,
      "Bill Date": safeDate(v.billData?.date),
      "Time": formatTime(v),
      "Bill Series": v.billData?.billSeries || "-",
      "Bill No.": v.billData?.billNo || "-",
      "Party Name": v.partyData?.partyAccount || "-",
      "DC ID": v.dcId || "-",
      "Net Amount": v.netAmount || 0,
      "Type": v.returnType || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Returns");
    XLSX.writeFile(wb, "purchase_return_vouchers.xlsx");
    toast.success("Excel file downloaded!");
  };

  // ── Table Print (header Printer button) ─────────────────────
  const handleTablePrint = () => {
    const tableRows = filteredVouchers
      .map(
        (v, i) => `<tr>
          <td>${i + 1}</td>
          <td>${safeDate(v.billData?.date)}</td>
          <td>${formatTime(v)}</td>
          <td>${v.billData?.billSeries || "-"}</td>
          <td>${v.billData?.billNo || "-"}</td>
          <td>${v.partyData?.partyAccount || "-"}</td>
          <td>${v.dcId || "-"}</td>
          <td>&#8377;${roundAmount(v.netAmount)}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Return Voucher List</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { font-size: 20px; margin-bottom: 5px; text-align: center; }
          p { font-size: 12px; color: #666; margin-bottom: 15px; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #1e293b; color: white; padding: 10px; text-align: left; font-size: 12px; }
          td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
          tr:nth-child(even) { background: #f8fafc; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Purchase Return Voucher List</h1>
        <p>Total Records: ${filteredVouchers.length} | Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>S.N.</th><th>Bill Date</th><th>Time</th><th>Bill Series</th><th>Bill No.</th><th>Party Name</th><th>DC ID</th><th>Net Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>`;

    const pw = window.open("", "_blank");
    pw.document.write(html);
    pw.document.close();
    pw.focus();
    pw.print();
  };

  const filteredVouchers = useMemo(() => {
    const q = filters.searchText?.toLowerCase().trim();

    return purchaseReturns.filter((v) => {
      const billDate = new Date(v.billData?.date);

      // ⭐ Combined search string
      const combined = `${v.billData?.billSeries || ""} ${v.billData?.billNo || ""} ${v.partyData?.partyAccount || ""}`.toLowerCase();

      // ⭐ Single search filter
      if (q && !combined.includes(q)) return false;

      // ⭐ Date From Filter
      if (filters.dateFrom && billDate < new Date(filters.dateFrom)) return false;

      // ⭐ Date To Filter
      if (filters.dateTo && billDate > new Date(filters.dateTo)) return false;

      return true;
    });
  }, [filters, purchaseReturns]);



  // helper: parse numeric string (handles commas) to number
  const parseNumber = (val) => {
    if (val === null || val === undefined) return 0;
    const n = Number(String(val).replace(/,/g, "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // totals for the currently filtered vouchers
  const totals = useMemo(() => {
    let net = 0;
    let ordQty = 0;
    filteredVouchers.forEach((v) => {
      net += parseNumber(v.netAmount);
      // Fallback to item sum for quantity
      const q = Number(quantitiesValues[v._id]?.ordQty ?? 0) || (v.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0);
      ordQty += q;
    });
    return { net, ordQty };
  }, [filteredVouchers, quantitiesValues]);

  const formatINR = (num) =>
    num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleEdit = (id, type) => {
    if (type === "lens") {
      navigate(`/lenstransaction/addpurchasereturn/${id}`);
    } else {
      navigate(`/rxtransaction/addrxpurchasereturn/${id}`);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;

    const res =
      type === "lens"
        ? await removeLensPurchaseReturn(id)
        : await removeRxPurchaseReturn(id);

    if (res.success) {
      toast.success("Purchase Return deleted successfully!");
      setPurchaseReturns((prev) => prev.filter((o) => o._id !== id));
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const handleInfo = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleNormalPrint = (v) => {
    const items = v.items || [];
    const itemRows = items
      .map(
        (it, idx) => `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td>${it.itemName || it.productName || "-"}</td>
          <td style="text-align:center">${it.eye || "-"}</td>
          <td style="text-align:center">${it.sph || "-"}</td>
          <td style="text-align:center">${it.cyl || "-"}</td>
          <td style="text-align:center">${it.axis || "-"}</td>
          <td style="text-align:center">${it.qty || 0}</td>
          <td style="text-align:right">&#8377;${roundAmount(it.purchasePrice || 0)}</td>
          <td style="text-align:right">&#8377;${roundAmount(it.totalAmount || 0)}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Return - Normal Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 26px; font-weight: 900; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin: 4px 0 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .card h3 { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; margin: 0 0 8px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          .card p { margin: 4px 0; font-size: 12px; display: flex; justify-content: space-between; }
          .card p span:first-child { color: #64748b; }
          .card p span:last-child { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #1e293b; color: white; padding: 8px; font-size: 11px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 12px; }
          .totals { max-width: 280px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
          .totals p { margin: 4px 0; font-size: 12px; display: flex; justify-content: space-between; }
          .total-final { font-size: 16px; font-weight: 900; border-top: 2px solid #e2e8f0; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; }
          .footer { margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8; }
          .sign-row { display: flex; justify-content: center; gap: 80px; margin-top: 20px; }
          .sign-line { width: 120px; border-top: 1px solid #cbd5e1; text-align: center; padding-top: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><p class="title">PURCHASE RETURN</p><p class="subtitle">Return Confirmation & Receipt</p></div>
          <div style="text-align:right"><p style="font-size:10px;color:#94a3b8;margin:0">DATE</p><p style="font-size:14px;font-weight:700;margin:4px 0 0">${new Date(v.billData?.date || Date.now()).toLocaleDateString("en-IN")}</p></div>
        </div>
        <div class="grid">
          <div class="card">
            <h3>Voucher Details</h3>
            <p><span>Series:</span><span>${v.billData?.billSeries || "-"}</span></p>
            <p><span>Bill No:</span><span>${v.billData?.billNo || "-"}</span></p>
            <p><span>Type:</span><span>${v.returnType?.toUpperCase() || "-"}</span></p>
          </div>
          <div class="card">
            <h3>Party Details</h3>
            <p style="font-size:14px;font-weight:700">${v.partyData?.partyAccount || "-"}</p>
            <p><span>Phone:</span><span>${v.partyData?.contactNumber || "-"}</span></p>
            <p><span>Address:</span><span>${v.partyData?.address || "-"}</span></p>
          </div>
        </div>
        <table>
          <thead><tr><th>Item Name</th><th>Eye</th><th>Sph</th><th>Cyl</th><th>Axis</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${itemRows || "<tr><td colspan='8' style='text-align:center;color:#94a3b8'>No items</td></tr>"}</tbody>
        </table>
        <div class="totals">
          <p><span>Subtotal</span><span>&#8377;${roundAmount(v.subtotal || 0)}</span></p>
          <p><span>Taxes</span><span>&#8377;${roundAmount(v.taxesAmount || 0)}</span></p>
          <div class="total-final"><span>TOTAL</span><span>&#8377;${roundAmount(v.netAmount || 0)}</span></div>
        </div>
        <div class="footer">
          Thank you!
          <div class="sign-row">
            <div class="sign-line">Authorized Sign</div>
            <div class="sign-line">Supplier Sign</div>
          </div>
        </div>
      </body>
      </html>`;
    const pw = window.open("", "_blank");
    pw.document.write(html);
    pw.document.close();
    pw.focus();
    pw.print();
  };

  const generateBarcodePrint = (v) => {
    printBarcodeStickers(v, [], []);
  };

  const generateCardPrint = (v) => {
    printAuthenticityCard(v, allLenses, allItems);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Purchase Return Voucher List
          </h1>
          <p className="text-slate-600">
            Manage Purchases return vouchers and refunds
          </p>
        </div>



        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="relative">
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) =>
                  handleFilterChange("searchText", e.target.value)
                }
                placeholder="Search..."
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Search
              </label>
            </div>

            <div className="relative">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                From Date
              </label>
            </div>

            <div className="relative">
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                To Date
              </label>
            </div>


          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap justify-start gap-2">
            </div>
            <div className="flex flex-wrap justify-start gap-2 ">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button onClick={handleAddPurchaseReturn} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200">
                <Plus className="w-3.5 h-3.5" />
                Add Purchase Return
              </button>
              <button
                onClick={handleExcelExport}
                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm"
                title="Download Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handleTablePrint}
                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm"
                title="Print Voucher List"
              >
                <Printer className="w-4 h-4" />
              </button>

            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-20 text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    S.N.
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill Date
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Time
                  </th>
                  <th className="min-w-[180px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill Series
                  </th>
                  <th className="min-w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill No.
                  </th>
                  <th className="min-w-[280px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Party Name
                  </th>
                  <th className="min-w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    DC ID
                  </th>
                  <th className="min-w-[130px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Net Amt
                  </th>
                  <th className="min-w-[80px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Ord Q
                  </th>
                  <th className="w-[200px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-10 text-center text-slate-500">
                      <p className="text-xl">No return vouchers found</p>
                      <p className="text-md">
                        Try adjusting your search criteria
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v, i) => {
                    const idStr = String(v._id);
                    return (
                      <React.Fragment key={idStr}>
                        <tr
                          key={v.id}
                          className="hover:bg-slate-50 transition-colors duration-150 group text-sm"
                        >
                      <td className="w-20 text-center text-slate-600 font-medium py-5 px-2 align-top whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="text-base">{i + 1}</span>
                        </div>
                      </td>
                      <td className="py-5 px-3 text-slate-800 align-top text-center">
                        {safeDate(v.billData.date)}
                      </td>
                      <td className="py-5 px-3 text-slate-800 align-top text-center">
                        {formatTime(v)}
                      </td>
                      <td className="py-5 px-3 text-slate-800 align-top text-center">
                        {v.billData.billSeries}
                      </td>
                      <td className="py-5 px-3 text-slate-800 align-top text-center">
                        {v.billData.billNo}
                      </td>
                      <td className="py-5 px-3 text-slate-700 align-top">
                        <div className="whitespace-normal text-center break-words">
                          {v.partyData.partyAccount}
                        </div>
                      </td>
                      <td className="py-2 px-2 align-top text-center border-r border-gray-100">
                        <textarea
                          className="w-full min-h-[38px] border border-slate-200 rounded p-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 overflow-hidden break-words text-center"
                          value={dcIds[v._id] || ""}
                          onChange={(e) => {
                            handleDcIdChange(v._id, e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onBlur={() => handleDcIdBlur(v._id, v.returnType)}
                          placeholder="DC ID"
                          rows={1}
                        />
                      </td>
                      <td className="text-center text-slate-900 font-medium py-5 px-3 align-top">
                        {v.netAmount !== "0.00" ? `₹${roundAmount(v.netAmount)}` : "-"}
                      </td>
                      <td className="py-5 px-3 align-top text-center">
                        <input
                          type="number"
                          value={quantitiesValues[v._id]?.ordQty ?? ""}
                          onChange={(e) => handleQuantityChange(v._id, "ordQty", e.target.value)}
                          onBlur={() => saveQuantities(v._id)}
                          className="w-full px-1 py-1 text-sm border border-slate-300 rounded text-center outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="py-5 px-2 align-top text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleInfo(idStr)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors duration-200" title="Details">
                            <Info className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEdit(v._id, v.returnType)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(v._id, v.returnType)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200" title="Delete">
                            <Trash className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleNormalPrint(v)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200" title="Print Invoice">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => generateBarcodePrint(v)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200" title="Print Barcode">
                            <Barcode className="w-4 h-4" />
                          </button>
                          <button onClick={() => generateCardPrint(v)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200" title="Print PVC Card">
                            <CreditCard className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedRow === idStr && (
                      <tr>
                        <td
                          colSpan="10"
                          className="bg-blue-50 p-6 border-b-2 border-t-2 border-blue-300 shadow-lg"
                        >
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-bold text-slate-700 uppercase text-sm tracking-wider mb-3">
                              📦 Items Details ({v.items?.length || 0} items)
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead className="bg-gradient-to-r from-slate-300 to-slate-200">
                                  <tr className="border-b-2 border-slate-400">
                                    <th className="p-2 text-left font-bold">Item Name</th>
                                    <th className="p-2 text-center font-bold">Eye</th>
                                    <th className="p-2 text-center font-bold">Sph</th>
                                    <th className="p-2 text-center font-bold">Cyl</th>
                                    <th className="p-2 text-center font-bold">Axis</th>
                                    <th className="p-2 text-center font-bold">Add</th>
                                    <th className="p-2 text-center font-bold">Remark</th>
                                    <th className="p-2 text-center font-bold">Qty</th>
                                    <th className="p-2 text-right font-bold">Purchase Price</th>
                                    <th className="p-2 text-right font-bold">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.items?.map((it, idx) => (
                                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                      <td className="p-2 font-semibold text-slate-700">{it.itemName || it.productName || "-"}</td>
                                      <td className="p-2 text-center">{it.eye || "-"}</td>
                                      <td className="p-2 text-center">{it.sph || "-"}</td>
                                      <td className="p-2 text-center">{it.cyl || "-"}</td>
                                      <td className="p-2 text-center">{it.axis || "-"}</td>
                                      <td className="p-2 text-center">{it.add || "-"}</td>
                                      <td className="p-2 text-center">{it.remark || "-"}</td>
                                      <td className="p-2 text-center font-bold text-blue-600">{it.qty || 0}</td>
                                      <td className="p-2 text-right">₹{roundAmount(it.purchasePrice || 0)}</td>
                                      <td className="p-2 text-right font-bold text-slate-700">₹{roundAmount(it.totalAmount || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
                                  <tr>
                                    <td colSpan="7" className="p-2 text-right">Total:</td>
                                    <td className="p-2 text-center text-blue-600">{v.items?.reduce((s, it) => s + (Number(it.qty) || 0), 0) || 0}</td>
                                    <td colSpan="1"></td>
                                    <td className="p-2 text-right text-slate-900 font-bold tracking-tight">₹{roundAmount(v.subtotal || 0)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
                )}
              </tbody>

              {/* Totals footer */}
              {filteredVouchers.length > 0 && (
                <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-t-2 border-slate-300">
                  <tr>
                    <td colSpan="7" className="py-4 px-3 text-right text-slate-700 uppercase tracking-wider text-sm font-black">
                      Grand Totals:
                    </td>
                    <td className="py-4 px-3 text-center text-slate-900 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                      {`₹${roundAmount(totals.net)}`}
                    </td>
                    <td className="py-4 px-3 text-center text-blue-600 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                      {totals.ordQty}
                    </td>
                    <td className="bg-slate-100/50" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PurchaseReturnVoucher;
