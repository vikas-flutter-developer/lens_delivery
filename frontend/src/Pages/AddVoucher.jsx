import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet,
  Pencil,
  Printer,
  Trash,
  Search,
  RotateCcw,
  Plus,
  Info
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { getVouchers, deleteVoucher } from "../controllers/Voucher.controller";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

function AddVoucher() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  const [filters, setFilters] = useState({
    recordType: "Payment",
    billSeries: "All",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  const getBillSeriesOptions = (type) => {
    if (type === 'All' || !type) return ['All'];
    if (type === 'Payment') return ['All', 'P(25-26)', 'PUR_26', 'BPAY_25'];
    if (type === 'Receipt') return ['All', 'S(25-26)', 'SAL_26', 'BRCPT_25'];
    if (type === 'Journal') return ['All', 'JRNL_25-26'];
    if (type === 'Contra') return ['All', 'CONTRA_25-26'];
    if (type === 'Debit') return ['All', 'DR_NOTE_25'];
    if (type === 'Credit') return ['All', 'CR_NOTE_25'];
    return ['All', 'GEN_25'];
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === 'recordType') {
        newData.billSeries = 'All';
      }
      return newData;
    });
  };

  const fetchVouchersFromDB = async () => {
    try {
      setLoading(true);
      const res = await getVouchers();
      if (res && res.data) {
        setVouchers(res.data);
      }
    } catch (error) {
      toast.error("Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchersFromDB();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this voucher?")) return;
    try {
      const res = await deleteVoucher(id);
      if (res.success) {
        toast.success("Voucher deleted successfully");
        fetchVouchersFromDB();
      }
    } catch (err) {
      toast.error("Failed to delete voucher");
    }
  };

  const handleEdit = (id) => {
    navigate(`/transaction/payrecptumicntr/voucherentry/${id}`);
  };

  const handleAddBtn = () => {
    navigate(`/transaction/payrecptumicntr/voucherentry`);
  };

  const handleExportAll = () => {
    if (filteredVouchers.length === 0) {
      toast.error('No data to export');
      return;
    }
    const excelData = filteredVouchers.map((v, i) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "-";
      const remarks = v.remarks || v.rows?.[0]?.shortNarration || '';
      const account = v.rows?.[0]?.account || "";
      return {
        "Sr. No.": i + 1,
        "Bill Date": date,
        "Bill Series": v.billSeries,
        "Bill No.": v.billNo,
        "Party Name": account,
        "Debit": v.totalDebit || 0,
        "Credit": v.totalCredit || 0,
        "Remarks": remarks
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");

    const fileName = `Vouchers_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('Exported to Excel successfully!');
  };

  const handleExportRow = (v) => {
    if (!v.rows || v.rows.length === 0) {
      toast.error('No rows to export for this voucher');
      return;
    }
    const excelData = v.rows.map(r => ({
      "SN": r.sn,
      "D/C": r.dc,
      "Account": r.account,
      "Debit": r.debit || 0,
      "Credit": r.credit || 0,
      "Chq/Doc No": r.chqDocNo || '',
      "Remark": r.remark || r.shortNarration || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Voucher Details");

    const fileName = `Voucher_${v.billSeries}_${v.billNo}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Filter vouchers locally based on UI criteria
  const filteredVouchers = vouchers.filter((v) => {
    if (filters.recordType && filters.recordType !== "All" && v.recordType !== filters.recordType) return false;
    if (filters.billSeries !== "All" && v.billSeries !== filters.billSeries) return false;

    // Partial search (by bill number, remarks, etc)
    if (filters.searchText) {
      const text = filters.searchText.toLowerCase();
      const matchHeader = String(v.billNo).toLowerCase().includes(text) || (v.remarks && v.remarks.toLowerCase().includes(text));
      const matchRows = v.rows?.some(r => (r.remark && r.remark.toLowerCase().includes(text)) || (r.shortNarration && r.shortNarration.toLowerCase().includes(text)));
      if (!matchHeader && !matchRows) {
        return false;
      }
    }

    if (filters.dateFrom) {
      const vDate = new Date(v.date || v.createdAt);
      const fDate = new Date(filters.dateFrom);
      if (vDate < fDate) return false;
    }

    if (filters.dateTo) {
      const vDate = new Date(v.date || v.createdAt);
      const tDate = new Date(filters.dateTo);
      tDate.setHours(23, 59, 59, 999);
      if (vDate > tDate) return false;
    }

    return true;
  });

  const totalDr = filteredVouchers.reduce((s, v) => s + Number(v.totalDebit || 0), 0);
  const totalCr = filteredVouchers.reduce((s, v) => s + Number(v.totalCredit || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans p-6 print:p-0 print:min-h-0 print:bg-white print:block overflow-visible print:overflow-visible">
      <div className="max-w-[98vw] mx-auto print:max-w-full">
        {/* Header */}
        <div className="mb-8 print:hidden">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Add Voucher</h1>
          <p className="text-slate-600">Manage payment and receipt vouchers</p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <select
                id="recordType"
                value={filters.recordType}
                onChange={(e) => handleFilterChange("recordType", e.target.value)}
                className="peer w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-base bg-white appearance-none"
              >
                <option value="All">All</option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="Journal">Journal</option>
                <option value="Contra">Contra</option>
                <option value="Debit">Debit</option>
                <option value="Credit">Credit</option>
              </select>
              <label htmlFor="recordType" className="absolute left-3 -top-2.5 text-sm font-medium bg-white px-2 text-gray-500">Record Type</label>
            </div>

            <div className="relative">
              <select
                id="billSeries"
                value={filters.billSeries}
                onChange={(e) => handleFilterChange("billSeries", e.target.value)}
                className="peer w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-base bg-white appearance-none"
              >
                {getBillSeriesOptions(filters.recordType).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label htmlFor="billSeries" className="absolute left-3 -top-2.5 text-sm font-medium bg-white px-2 text-gray-500">Bill Series</label>
            </div>

            <div className="relative">
              <input
                type="date"
                id="dateFrom"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                placeholder=" "
                className="peer w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-base placeholder-transparent"
              />
              <label htmlFor="dateFrom" className="absolute left-3 -top-2.5 text-sm font-medium transition-all duration-200 bg-white px-2 text-gray-500">Date From</label>
            </div>

            <div className="relative">
              <input
                type="date"
                id="dateTo"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                placeholder=" "
                className="peer w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-base placeholder-transparent"
              />
              <label htmlFor="dateTo" className="absolute left-3 -top-2.5 text-sm font-medium transition-all duration-200 bg-white px-2 text-gray-500">Date To</label>
            </div>

            <div className="relative">
              <input
                type="text"
                id="searchText"
                value={filters.searchText}
                onChange={(e) => handleFilterChange("searchText", e.target.value)}
                placeholder=" "
                className="peer w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-base placeholder-transparent"
              />
              <label htmlFor="searchText" className="absolute left-3 -top-2.5 text-sm font-medium transition-all duration-200 bg-white px-2 text-gray-500">Search Text</label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors duration-200">
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              onClick={() => {
                setFilters({ recordType: "Payment", billSeries: "All", dateFrom: "", dateTo: "", searchText: "" });
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors duration-200"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleAddBtn}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>

            <div className="ml-auto flex gap-3">
              <button
                className="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors duration-200 hover:shadow-md"
                onClick={handleExportAll}
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>
              <button
                className="p-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors duration-200 hover:shadow-md"
                onClick={() => window.print()}
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Print-only Header */}
        <div className="hidden print:block mb-6 pt-4 text-center">
          <h1 className="text-2xl font-bold uppercase text-black">Vouchers Report</h1>
          <div className="flex justify-between items-center text-sm border-b-2 border-black pb-2 mt-4 font-semibold text-black">
            <div>Record Type: {filters.recordType}</div>
            <div>Date Filter: {filters.dateFrom || 'Any'} to {filters.dateTo || 'Any'}</div>
          </div>
        </div>

        {/* Table (adjusted to new compact, readable layout) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden print:shadow-none print:border-none print:overflow-visible">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-full table-fixed divide-y divide-slate-200 print:w-full print:min-w-0">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 print:bg-white print:border-b-2 print:border-black print:text-black">
                <tr>
                  <th className="w-20 text-center py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Sr. No.</th>
                  <th className="w-[140px] text-left py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Bill Date</th>
                  <th className="w-[160px] text-left py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Bill Series</th>
                  <th className="w-[100px] text-center py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Bill No.</th>
                  <th className="w-[180px] text-left py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Party Name</th>
                  <th className="w-[110px] text-center py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Debit</th>
                  <th className="w-[110px] text-center py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Credit</th>
                  <th className="w-[240px] text-left py-4 px-3 text-slate-700 print:text-black font-bold text-sm">Remarks</th>
                  <th className="w-28 text-center py-4 px-3 text-slate-700 font-bold text-sm print:hidden">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 print:divide-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="p-10 text-center text-slate-500">
                      Loading vouchers...
                    </td>
                  </tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-10 text-center text-slate-500">
                      <p className="text-xl">No vouchers found</p>
                      <p className="text-md">Try adjusting your search criteria</p>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher, index) => (
                    <React.Fragment key={voucher._id || index}>
                      <tr className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                      <td className="w-20 text-center text-slate-600 font-medium py-3 px-2 align-top whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="text-base">{index + 1}</span>
                        </div>
                      </td>

                      <td className="w-[140px] py-3 px-3 text-slate-800 print:text-black align-top">
                        {voucher.date ? new Date(voucher.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "-"}
                      </td>
                      <td className="w-[160px] py-3 px-3 text-slate-800 print:text-black align-top">{voucher.billSeries}</td>
                      <td className="w-[100px] text-center py-3 px-3 text-slate-800 print:text-black align-top">{voucher.billNo}</td>
                      <td className="w-[180px] py-3 px-3 text-slate-700 print:text-black align-top break-words" title={voucher.rows?.[0]?.account}>{voucher.rows?.[0]?.account || "-"}</td>
                      <td className="w-[110px] text-center text-slate-900 print:text-black font-medium py-3 px-3 align-top">{voucher.totalDebit ? `₹${voucher.totalDebit}` : "-"}</td>
                      <td className="w-[110px] text-center text-slate-900 print:text-black font-medium py-3 px-3 align-top">{voucher.totalCredit ? `₹${voucher.totalCredit}` : "-"}</td>
                      <td className="w-[240px] py-3 px-3 text-slate-700 print:text-black align-top break-words" title={voucher.remarks}>{voucher.remarks || voucher.rows?.[0]?.remark || voucher.rows?.[0]?.shortNarration || '-'}</td>

                      <td className="w-fit py-3 px-2 align-top print:hidden">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setExpandedRow(expandedRow === voucher._id ? null : voucher._id)}
                            className={`p-2 rounded-lg transition-colors duration-200 ${expandedRow === voucher._id ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50'}`}
                            title="View All Entries"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(voucher._id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(voucher._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExportRow(voucher)}
                            className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(
                              `Voucher%20${voucher.billSeries}%20No.%20${voucher.billNo}%20-%20₹${voucher.totalDebit}`
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
                    {expandedRow === voucher._id && (
                      <tr className="bg-blue-50/50">
                        <td colSpan="9" className="p-4">
                          <div className="bg-white rounded-xl shadow-inner border border-blue-100 overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200">
                              <thead className="bg-blue-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">SN</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Account</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-blue-800 uppercase">Debit</th>
                                  <th className="px-4 py-2 text-right text-xs font-bold text-blue-800 uppercase">Credit</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Mode</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-blue-800 uppercase">Remark</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {voucher.rows?.map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-blue-50/30">
                                    <td className="px-4 py-2 text-sm text-slate-600">{row.sn}</td>
                                    <td className="px-4 py-2 text-sm font-medium text-slate-800">{row.account}</td>
                                    <td className="px-4 py-2 text-sm text-right text-slate-700">{row.debit > 0 ? `₹${row.debit}` : '-'}</td>
                                    <td className="px-4 py-2 text-sm text-right text-slate-700">{row.credit > 0 ? `₹${row.credit}` : '-'}</td>
                                    <td className="px-4 py-2 text-sm text-slate-600">{row.modeOfPayment || 'Cash'}</td>
                                    <td className="px-4 py-2 text-sm text-slate-600">{row.remark || row.shortNarration || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
              </tbody>
            </table>
          </div>

          {/* Total Section */}
          <div className="bg-gray-50 border-t border-slate-200 px-6 py-4 print:static print:table-footer-group print:border-t-2 print:border-black print:bg-white text-black">
            <div className="flex justify-end gap-8">
              <div className="text-sm font-semibold text-slate-900 print:text-black">Total : (Dr) ₹{totalDr}</div>
              <div className="text-sm font-semibold text-slate-900 print:text-black">Total : (Cr) ₹{totalCr}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddVoucher;
