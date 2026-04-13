import React, { useState, useMemo, useEffect } from "react";
import { printAuthenticityCard } from "../utils/AuthenticityCardHelper";
import {
  Copy,
  FileSpreadsheet,
  Pencil,
  Printer,
  Trash,
  Truck,
  RotateCcw,
  Plus,
  Receipt,
  Info,
  Barcode,
  CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAllRxPurchase,
  removeRxPurchase,
} from "../controllers/RxPurchase.controller";
import { Toaster, toast } from "react-hot-toast";
import { roundAmount } from "../utils/amountUtils";

function RxPurchase() {
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [RxPurchases, setRxPurchases] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null); // <--- track expanded row
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const res = await getAllRxPurchase();
      setRxPurchases(res?.data || []);
    };
    fetchData();
  }, []);

  const handleEdit = (id) => {
    navigate(`/rxtransaction/rxpurchase/addRxPurchase/${id}`);
  };

  const handleReset = () => {
    setSearchText("");
    setDateFrom("");
    setDateTo("");
  };

  const handleAddRxPurchase = () => {
    navigate("/rxtransaction/rxpurchase/addRxPurchase");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    const res = await removeRxPurchase(id);
    if (res.success) {
      toast.success("Purchase deleted successfully!");
      const fresh = await getAllRxPurchase();
      setRxPurchases(fresh?.data || []);
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const formatPrice = (price) => `₹${roundAmount(Number(price || 0))}`;
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB");
  };

  const invoicesFromDB = useMemo(() => {
    return (RxPurchases || []).map((lp) => {
      const billDate = lp?.billData?.date || lp?.createdAt || null;
      const billSeries = lp?.billData?.billSeries || "";
      const billNo = lp?.billData?.billNo || "";
      const partyName = lp?.partyData?.partyAccount || "";
      const subtotal = Number(lp?.subtotal) || 0;
      const taxesAmount = Number(lp?.taxesAmount) || 0;
      const netAmount = Number(lp?.netAmount) || subtotal + taxesAmount;
      const paidAmount = Number(lp?.paidAmount) || 0;
      const dueAmount =
        typeof lp?.dueAmount !== "undefined"
          ? Number(lp?.dueAmount)
          : roundAmount(netAmount - paidAmount);
      const remark = lp?.remark || "";
      const status = lp?.status || "";

      return {
        _id: lp._id,
        billDate,
        billSeries,
        billNo,
        partyName,
        netAmount,
        paidAmount,
        dueAmount,
        remark,
        status,
        items: lp.items || [], // include items here for nested table
        raw: lp,
      };
    });
  }, [RxPurchases]);

  const visibleInvoices = useMemo(() => {
    let filtered = invoicesFromDB.slice();
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter((inv) => {
        const fields = `${inv.billSeries} ${inv.partyName} ${inv.billNo}`.toLowerCase();
        return fields.includes(q);
      });
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter((inv) => inv.billDate && new Date(inv.billDate) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((inv) => inv.billDate && new Date(inv.billDate) <= to);
    }
    return filtered;
  }, [invoicesFromDB, searchText, dateFrom, dateTo]);

  // helper to get string id (works with Mongo ObjectId or plain string)
  const getId = (id) => {
    if (!id && id !== 0) return null;
    if (typeof id === "object" && id !== null) return id.$oid || String(id);
    return String(id);
  };

  const handleInfo = (id) => {
    const idStr = getId(id);
    setExpandedRow((prev) => (prev === idStr ? null : idStr)); // toggle row
  };

  // Print functions
  const generateNormalPrint = (invoice) => {
    const itemsHTML = (invoice.items || [])
      .map(
        (item, i) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${i + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.itemName || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.qty || 0}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(item.purchasePrice || 0)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.discount || 0}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(item.totalAmount || 0)}</td>
      </tr>
    `
      )
      .join("");

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Rx Purchase Invoice ${invoice.billSeries}-${invoice.billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; }
            .details { margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
            .details-label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #f0f0f0; border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; }
            .total-row { background-color: #f9f9f9; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rx PURCHASE INVOICE</h1>
            <p>Bill Series: ${invoice.billSeries} | Bill No: ${invoice.billNo}</p>
            <p>Date: ${formatDate(invoice.billDate)}</p>
          </div>

          <div class="details">
            <div class="details-row">
              <div><span class="details-label">Party Name:</span> ${invoice.partyName}</div>
              <div><span class="details-label">Status:</span> ${invoice.status}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Item Name</th>
                <th>Qty</th>
                <th>Purchase Price</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
              <tr class="total-row">
                <td colspan="5" style="text-align: right; border: 1px solid #ddd; padding: 8px;">Net Amount:</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(invoice.netAmount)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="5" style="text-align: right; border: 1px solid #ddd; padding: 8px;">Paid Amount:</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(invoice.paidAmount)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="5" style="text-align: right; border: 1px solid #ddd; padding: 8px;">Due Amount:</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(invoice.dueAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>${invoice.remark || ""}</p>
            <p style="margin-top: 20px; color: #666;">This is a computer-generated purchase invoice</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const generateBarcodePrint = (invoice) => {
    const barcodeHTML = (invoice.items || [])
      .map(
        (item, i) => `
      <div style="page-break-inside: avoid; margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; width: 100%; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 10px;">
          <strong style="font-size: 14px;">${item.itemName}</strong>
        </div>
        <div style="text-align: center; margin-bottom: 10px;">
          <svg id="barcode-${i}" style="height: 60px;"></svg>
        </div>
        <div style="text-align: center; font-size: 12px;">
          <p style="margin: 5px 0;"><strong>SKU:</strong> ${item.itemName}</p>
          <p style="margin: 5px 0;"><strong>Price:</strong> ${formatPrice(item.purchasePrice)}</p>
          <p style="margin: 5px 0;"><strong>Qty:</strong> ${item.qty}</p>
        </div>
      </div>
    `
      )
      .join("");

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Print - ${invoice.billSeries}-${invoice.billNo}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h2 { margin: 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Barcode Labels - ${invoice.billSeries}-${invoice.billNo}</h2>
            <p>${invoice.partyName} | ${formatDate(invoice.billDate)}</p>
          </div>
          ${barcodeHTML}
          <script>
            window.onload = function() {
              document.querySelectorAll('[id^="barcode-"]').forEach((el, i) => {
                JsBarcode("#barcode-" + i, "PUR-${invoice.billNo}-" + (i + 1), {
                  format: "CODE128",
                  width: 2,
                  height: 50,
                  displayValue: true
                });
              });
              setTimeout(() => { window.print(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const generateCardPrint = (invoice) => {
    printAuthenticityCard(invoice.raw || invoice, [], []);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Rx Purchase Invoice</h1>
          <p className="text-slate-600">Manage Rx purchase invoices and payments</p>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 pb-0 mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
            <div className="lg:col-span-4 relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by Bill Series or Party Name..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Search</label>
            </div>
            <div className="lg:col-span-2 relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Date From</label>
            </div>
            <div className="lg:col-span-2 relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Date To</label>
            </div>
            <div className="lg:col-span-4 flex flex-wrap justify-start gap-2">
              <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={handleAddRxPurchase} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200">
                <Plus className="w-3.5 h-3.5" /> Add Rx Purchase
              </button>
              <button className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm">
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm">
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
                  <th className="w-16 text-center py-4 px-3 text-slate-700 font-bold text-sm">Sr No.</th>
                  <th className="min-w-[110px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Bill Date</th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Bill Series</th>
                  <th className="min-w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Bill No.</th>
                  <th className="min-w-[180px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Party Name</th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Net Amount</th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Paid Amount</th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Due Amount</th>
                  <th className="min-w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Remark</th>
                  <th className="w-[160px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {visibleInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-10 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="w-12 h-12 text-slate-300" />
                        <p className="text-xl">No invoices found</p>
                        <p className="text-md">Try adjusting your filters or add a new Rx purchase invoice</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleInvoices.map((invoice, index) => {
                    const idStr = getId(invoice._id);
                    return (
                      <React.Fragment key={idStr || index}>
                        <tr className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                          <td className="text-center text-slate-600 font-medium py-4 px-2">{index + 1}</td>
                          <td className="text-center text-slate-700 py-4 px-3">{formatDate(invoice.billDate)}</td>
                          <td className="text-center py-4 px-3">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">{invoice.billSeries || "-"}</span>
                          </td>
                          <td className="text-center text-slate-800 font-semibold py-4 px-3">{invoice.billNo || "-"}</td>
                          <td className="text-center text-slate-800 py-4 px-3"><div className="font-medium">{invoice.partyName || "-"}</div></td>
                          <td className="text-center text-slate-900 font-bold py-4 px-3">{formatPrice(invoice.netAmount || 0)}</td>
                          <td className="text-center text-green-700 font-semibold py-4 px-3">{formatPrice(invoice.paidAmount || 0)}</td>
                          <td className="text-center py-4 px-3">
                            <span className={`font-bold ${invoice.dueAmount > 0 ? "text-red-600" : "text-green-600"}`}>{formatPrice(invoice.dueAmount || 0)}</span>
                          </td>
                          <td className="text-center text-slate-600 py-4 px-3 text-xs">{invoice.remark || "-"}</td>
                          <td className="py-4 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleInfo(invoice._id)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors duration-200" title="Info">
                                <Info className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleEdit(invoice._id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(invoice._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200" title="Delete">
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => generateNormalPrint(invoice)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                title="Print Invoice"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => generateBarcodePrint(invoice)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                                title="Print Barcode"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => generateCardPrint(invoice)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                title="Print Card"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                              <button className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200" title="Delivery">
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Items Row */}
                        {expandedRow === idStr && (
                          <tr>
                            <td colSpan="10" className="bg-slate-50 p-4">
                              <div className="overflow-x-auto">
                                <table className="min-w-full table-fixed text-sm">
                                  <thead>
                                    <tr className="bg-white">
                                      <th className="py-2 px-3 text-center font-medium">Item Name</th>
                                      <th className="py-2 px-3 text-center font-medium">Unit</th>
                                      <th className="py-2 px-3 text-center font-medium">Order No</th>
                                      <th className="py-2 px-3 text-center font-medium">Eye</th>
                                      <th className="py-2 px-3 text-center font-medium">Sph</th>
                                      <th className="py-2 px-3 text-center font-medium">Cyl</th>
                                      <th className="py-2 px-3 text-center font-medium">Add</th>
                                      <th className="py-2 px-3 text-center font-medium">Qty</th>
                                      <th className="py-2 px-3 text-center font-medium">Purchase Price</th>
                                      <th className="py-2 px-3 text-center font-medium">Sale Price</th>
                                      <th className="py-2 px-3 text-center font-medium">Discount</th>
                                      <th className="py-2 px-3 text-center font-medium">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.isArray(invoice.items) && invoice.items.length > 0 ? (
                                      invoice.items.map((item, i) => (
                                        <tr key={item._id?.$oid || item._id || i} className="even:bg-white odd:bg-slate-50">
                                          <td className="py-2 px-3 text-center">{item.itemName || "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.unit || "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.orderNo || "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.eye || "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.sph ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.cyl ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.add ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.qty ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{formatPrice(item.purchasePrice ?? 0)}</td>
                                          <td className="py-2 px-3 text-center">{formatPrice(item.salePrice ?? 0)}</td>
                                          <td className="py-2 px-3 text-center">{item.discount ?? 0}</td>
                                          <td className="py-2 px-3 text-center">{formatPrice(item.totalAmount ?? 0)}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan="12" className="p-3 text-center text-slate-500">
                                          No items available
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RxPurchase;
