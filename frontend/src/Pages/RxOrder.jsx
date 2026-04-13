import React, { useState, useMemo } from "react";
import {
  Plus,
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash,
  Search,
  RotateCcw,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import {useNavigate} from 'react-router-dom';
// RxOrder page — table style & structure matched to AddVoucher
export default function RxOrderPage() {
  const [filters, setFilters] = useState({
    billSeries: "All",
    dateFrom: "",
    dateTo: "",
    delivFrom: "",
    delivTo: "",
    searchText: "",
  });

  const RX_ORDERS = [
    {
      id: 1,
      billDate: "14-08-2025",
      billSeries: "Rx_Ord_25-26",
      orderNo: "1452",
      partyName: "Diaar Optics",
      vendorName: "Rio Digital Lens PVT LTD",
      netAmt: "680.00",
      purchaseAmt: "0.00",
      saleAmt: "1150.00",
      vendorRef: "0",
      delDate: "14-08-2025",
      remarks: "JIGAR",
      usedInSal: "",
      usedInPer: "",
      chargeStation: "",
      placeOrder: "",
    },
    {
      id: 1,
      billDate: "14-08-2025",
      billSeries: "Rx_Ord_25-26",
      orderNo: "1452",
      partyName: "Diaar Optics",
      vendorName: "Rio Digital Lens PVT LTD",
      netAmt: "680.00",
      purchaseAmt: "0.00",
      saleAmt: "1150.00",
      vendorRef: "0",
      delDate: "14-08-2025",
      remarks: "JIGAR",
      usedInSal: "",
      usedInPer: "",
      chargeStation: "",
      placeOrder: "",
    },
    {
      id: 1,
      billDate: "14-08-2025",
      billSeries: "Rx_Ord_25-26",
      orderNo: "1452",
      partyName: "Diaar Optics",
      vendorName: "Rio Digital Lens PVT LTD",
      netAmt: "680.00",
      purchaseAmt: "0.00",
      saleAmt: "1150.00",
      vendorRef: "0",
      delDate: "14-08-2025",
      remarks: "JIGAR",
      usedInSal: "",
      usedInPer: "",
      chargeStation: "",
      placeOrder: "",
    },
    {
      id: 1,
      billDate: "14-08-2025",
      billSeries: "Rx_Ord_25-26",
      orderNo: "1452",
      partyName: "Diaar Optics",
      vendorName: "Rio Digital Lens PVT LTD",
      netAmt: "680.00",
      purchaseAmt: "0.00",
      saleAmt: "1150.00",
      vendorRef: "0",
      delDate: "14-08-2025",
      remarks: "JIGAR",
      usedInSal: "",
      usedInPer: "",
      chargeStation: "",
      placeOrder: "",
    },
  ];

  const handleFilterChange = (field, value) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const handleReset = () =>
    setFilters({
      billSeries: "All",
      dateFrom: "",
      dateTo: "",
      delivFrom: "",
      delivTo: "",
      searchText: "",
    });

    const navigate = useNavigate()
   const handleAddRxOrder = ()=>{
      navigate('/rxtransaction/addrxorder')
    }

  const orders = RX_ORDERS;

  const filtered = useMemo(() => {
    const q = filters.searchText.toLowerCase();
    return orders.filter((o) => {
      if (
        q &&
        !(`${o.orderNo} ${o.partyName} ${o.vendorName} ${o.remarks}`.toLowerCase().includes(q))
      )
        return false;
      if (filters.billSeries !== "All" && o.billSeries !== filters.billSeries) return false;
      // NOTE: date strings are dd-mm-yyyy; parse when using real date comparisons
      if (filters.dateFrom && o.billDate < filters.dateFrom) return false;
      if (filters.dateTo && o.billDate > filters.dateTo) return false;
      return true;
    });
  }, [orders, filters]);

  const totalNet = filtered.reduce((s, o) => s + Number(o.netAmt || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans p-6">
      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Rx Orders</h1>
          <p className="text-slate-600">Manage prescription orders and deliveries</p>
        </div>

        {/* Filters */}
<div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-4">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
    <div className="relative">
      <select
        value={filters.billSeries}
        onChange={(e) => handleFilterChange("billSeries", e.target.value)}
        className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm bg-white appearance-none"
      >
        <option value="All">All</option>
        <option value="Rx_Ord_25-26">Rx_Ord_25-26</option>
      </select>
      <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Bill Series</label>
    </div>

    <div className="relative">
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
        className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
      />
      <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Date From</label>
    </div>

    <div className="relative">
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => handleFilterChange("dateTo", e.target.value)}
        className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
      />
      <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Date To</label>
    </div>

    <div className="relative">
      <input
        type="text"
        value={filters.delivFrom}
        onChange={(e) => handleFilterChange("delivFrom", e.target.value)}
        className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
      />
      <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Deliv From</label>
    </div>

    <div className="relative">
      <input
        type="text"
        value={filters.delivTo}
        onChange={(e) => handleFilterChange("delivTo", e.target.value)}
        className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
      />
      <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Deliv To</label>
    </div>

    <div className="relative">
      <input
        type="text"
        value={filters.searchText}
        onChange={(e) => handleFilterChange("searchText", e.target.value)}
        className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
      />
      <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Search Text</label>
    </div>
  </div>

  <div className="flex flex-wrap gap-2">
    <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">
      <Search className="w-3.5 h-3.5" />
      Search
    </button>
    <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200">
      <RotateCcw className="w-3.5 h-3.5" />
      Reset
    </button>
    <button onClick={handleAddRxOrder} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200">
      <Plus className="w-3.5 h-3.5" />
      Add Rx Order
    </button>

    <div className="ml-auto flex gap-2">
      <button className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm">
        <FileSpreadsheet className="w-4 h-4" />
      </button>
      <button className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm">
        <Printer className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>


        {/* Table (style & structure from AddVoucher) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-20 text-center py-4 px-3 text-slate-700 font-bold text-sm">Sr. No.</th>
                  <th className="w-[200px] text-left py-4 px-3 text-slate-700 font-bold text-sm">Bill Date</th>
                  <th className="w-[180px] text-left py-4 px-3 text-slate-700 font-bold text-sm">Bill Series</th>
                  <th className="w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Order No.</th>
                  <th className="w-[320px] text-left py-4 px-3 text-slate-700 font-bold text-sm">Party Name</th>
                  <th className="w-[300px] text-left py-4 px-3 text-slate-700 font-bold text-sm">Vend. Name</th>
                  <th className="w-[130px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Net. Amt</th>
                  <th className="w-[130px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Purch Amt</th>
                  <th className="w-[130px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Sale Amt</th>
                  <th className="w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Vend. ref No</th>
                  <th className="w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Del. Date</th>
                  <th className="w-[320px] text-left py-4 px-3 text-slate-700 font-bold text-sm">Remarks</th>
                  <th className="w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Used in(sal)</th>
                  <th className="w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Used in(pur)</th>
                  <th className="w-[170px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Status</th>
                  <th className="w-fit text-center py-4 px-3 text-slate-700 font-bold text-sm">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="17" className="p-10 text-center text-slate-500">
                      <p className="text-xl">No orders found</p>
                      <p className="text-md">Try adjusting your search criteria</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((o, i) => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                      <td className="w-20 text-center text-slate-600 font-medium py-3 px-2 align-top whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="text-base">{i + 1}</span>
                        </div>
                      </td>

                      <td className="min-w-[100px] py-3 px-3 text-slate-800 align-top">{o.billDate}</td>
                      <td className="min-w-[120px] py-3 px-3 text-slate-800 align-top">{o.billSeries}</td>
                      <td className="w-[100px] text-center py-3 px-3 text-slate-800 align-top">{o.orderNo}</td>
                      <td className="w-[700px] py-3 px-3 text-slate-700 align-top">
                        <div className="min-w-[100px] max-w- whitespace-normal break-words">{o.partyName}</div>
                      </td>
                      <td className="w-[300px] py-3 px-3 text-slate-700 align-top">
                        <div className="min-w-[170px] whitespace-normal break-words">{o.vendorName}</div>
                      </td>
                      <td className="w-[130px] text-center text-slate-900 font-medium py-3 px-3 align-top">{o.netAmt !== "0" ? `₹${o.netAmt}` : "-"}</td>
                      <td className="w-[130px] text-center text-slate-900 font-medium py-3 px-3 align-top">{o.purchaseAmt !== "0" ? `₹${o.purchaseAmt}` : "-"}</td>
                      <td className="w-[130px] text-center text-slate-900 font-medium py-3 px-3 align-top">{o.saleAmt !== "0" ? `₹${o.saleAmt}` : "-"}</td>
                      <td className="min-w-[140px] text-center py-3 px-3 text-slate-700 align-top">{o.vendorRef || "-"}</td>
                      <td className="min-w-[100px] text-center py-3 px-3 text-slate-700 align-top">{o.delDate || "-"}</td>
                      <td className="w-[320px] py-3 px-3 text-slate-700 align-top">
                        <div className="min-w-[100px] whitespace-normal break-words">{o.remarks}</div>
                      </td>
                      <td className="min-w-[150px] text-center py-3 px-3 text-slate-700 align-top">{o.usedInSal || "-"}</td>
                      <td className="min-w-[150px] text-center py-3 px-3 text-slate-700 align-top">{o.usedInPer || "-"}</td>
                      <td className="min-w-[150px] text-center py-3 px-3 text-slate-700 align-top">{o.chargeStation || "-"}</td>

                      <td className="w-fit py-3 px-2 align-top">
                        <div className="flex  items-center gap-2">
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200">
                            <Trash className="w-4 h-4" />
                          </button>
                          <button className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200">
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <a
                            href={`https://wa.me/918850285043?text=${encodeURIComponent(
                              `RxOrder%20${o.billSeries}%20No.%20${o.orderNo}%20-%20₹${o.netAmt}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-[#25D366] text-white rounded-full hover:bg-[#20b857] transition-colors duration-200 inline-flex items-center justify-center"
                          >
                            <FaWhatsapp className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
