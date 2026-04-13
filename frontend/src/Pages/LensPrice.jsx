import React, { useState, useMemo, useEffect } from "react";
import {
  getAllLensPower,
  removeLensPower,
  resetAllLensPriceHighlights,
} from "../controllers/LensGroupCreationController";
import { roundAmount } from "../utils/amountUtils";
import { useNavigate } from "react-router";

import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import {
  Plus,
  Printer,
  FileSpreadsheet,
  Pencil,
  Trash,
  Search,
  RotateCcw,
  Eye,
} from "lucide-react";
import * as XLSX from "xlsx";

function LensPrice() {
  const [lensData, setLensData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLensData = async () => {
    try {
      setLoading(true);
      const res = await getAllLensPower();
      if (res.success) {
        setLensData(res.data);
      } else {
        console.error("Error fetching lens data:", res.error?.message);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLensData();
  }, []);

  const [searchText, setSearchText] = useState("");

  const handleReset = () => {
    setSearchText("");
  };

  const handleResetHighlights = async () => {
    if (!window.confirm("Are you sure you want to reset all price highlights?")) return;
    try {
      const res = await resetAllLensPriceHighlights();
      if (res.success) {
        toast.success("Price highlights reset");
        fetchLensData();
      } else {
        toast.error(res.message || "Failed to reset highlights");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error resetting highlights");
    }
  };

  const handleEdit = (id, pgId) => {
    navigate(`/lenstransaction/lensratemaster/${id}${pgId ? `?powerGroupId=${pgId}` : ''}`)
  }

  const handleDeleteLensPower = async (item) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this lens power?"
    );
    if (!confirmDelete) return;

    const payload = typeof item === "string" ? { id: item } : item;

    const res = await removeLensPower(payload);

    if (res.success) {
      toast.success(res.data.message || "Lens power deleted successfully");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      toast.error(res.error?.message || "Something went wrong");
      console.error("Delete error:", res.error);
    }
  };

  // Filter lenses based on search
  const visibleLenses = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filtered = q ? lensData.filter((lens) => {
      const fields = `${lens.productName} ${lens.groupName} ${lens.eye}`.toLowerCase();
      return fields.includes(q);
    }) : lensData;

    // Flatten per power group as per requirement
    return filtered.flatMap(lens => {
      if (lens.powerGroups && lens.powerGroups.length > 0) {
        return lens.powerGroups.map(pg => ({
          ...lens,
          currentPowerGroup: pg,
          rowId: `${lens._id}_${pg._id}`,
          originalLensId: lens._id,
          originalPowerGroupId: pg._id
        }));
      }
      return [{ ...lens, currentPowerGroup: null, originalLensId: lens._id, rowId: lens._id }];
    });
  }, [searchText, lensData]);

  const formatPrice = (price) => `₹${roundAmount(price)}`;
  const navigate = useNavigate();
  const handleAddLensPrice = async () => {
    navigate("/lenstransaction/lensratemaster");
  };

  const handleDownloadExcel = () => {
    if (visibleLenses.length === 0) {
      toast.error("No records to download");
      return;
    }
    const exportData = visibleLenses.map((lens, index) => ({
      "Sr No.": index + 1,
      Title: lens.productName || "-",
      Group: lens.groupName || "-",
      Price: `${lens.isPriceUpdated ? '*' : ''}${roundAmount(lens.salePrice?.default || 0)}`,
      Eye: lens.eye || "-",
      SPH: `${lens.sphMin} to ${lens.sphMax}`,
      CYL: `${lens.cylMin} to ${lens.cylMax}`,
      AXIS: lens.axis || "-",
      ADD: `${lens.addMin} to ${lens.addMax}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lens Prices");
    XLSX.writeFile(workbook, "LensPriceList.xlsx");
  };

  const handlePrint = () => {
    if (visibleLenses.length === 0) {
      toast.error("No data to print");
      return;
    }

    const printWindow = window.open("", "_blank");
    const tableRows = visibleLenses
      .map(
        (lens, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${lens.productName || "-"}</td>
        <td>${lens.groupName || "-"}</td>
        <td style="text-align: right; ${lens.isPriceUpdated ? 'background-color: #fef08a;' : ''}">₹${roundAmount(
            lens.salePrice?.default || 0
          )}</td>
        <td style="text-align: center;">${lens.eye || "-"}</td>
        <td style="text-align: center;">${lens.sphMin} to ${lens.sphMax}</td>
        <td style="text-align: center;">${lens.cylMin} to ${lens.cylMax}</td>
        <td style="text-align: center;">${lens.axis || "-"}</td>
        <td style="text-align: center;">${lens.addMin} to ${lens.addMax}</td>
      </tr>
    `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Lens Price List</title>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: white; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
            .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 11px; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Lens Price List</h1>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">Sr No.</th>
                <th>Title</th>
                <th>Group</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: center;">Eye</th>
                <th style="text-align: center;">SPH</th>
                <th style="text-align: center;">CYL</th>
                <th style="text-align: center;">AXIS</th>
                <th style="text-align: center;">ADD</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleString("en-IN")}
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
    <div className="p-4 bg-slate-100 min-h-screen font-sans">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Lens Price List
          </h1>
          <p className="text-slate-600">
            Manage lens pricing and specifications
          </p>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 pb-0 mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by Name, Group, Power Group..."
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Search
              </label>
            </div>

            <div className="flex flex-wrap justify-start gap-2">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200">
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                onClick={handleResetHighlights}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-lg hover:bg-yellow-200 transition-colors duration-200"
                title="Reset price change highlights"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Highlights
              </button>
              <button onClick={handleAddLensPrice} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200">
                <Plus className="w-3.5 h-3.5" />
                Add Lens Price
              </button>
              <button
                onClick={handleDownloadExcel}
                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrint}
                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm"
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
                  <th className="w-16 text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Sr No.
                  </th>
                  <th className="min-w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Title
                  </th>
                  <th className="min-w-[130px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Group
                  </th>
                  <th className="min-w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Power Group
                  </th>
                  <th className="min-w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Price
                  </th>
                  <th className="w-20 text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Eye
                  </th>
                  <th className="min-w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    SPH
                  </th>
                  <th className="min-w-[140px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    CYL
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    AXIS
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    ADD
                  </th>
                  <th className="w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {visibleLenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan="11"
                      className="p-10 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Eye className="w-12 h-12 text-slate-300" />
                        <p className="text-xl">No lens prices found</p>
                        <p className="text-md">
                          Try adjusting your search criteria or add a new lens
                          price
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleLenses.map((lens, index) => (
                    <tr
                      key={lens.rowId}
                      className="hover:bg-slate-50 transition-colors duration-150 group text-sm"
                    >
                      <td className="text-center text-slate-600 font-medium py-4 px-2 align-top">
                        {index + 1}
                      </td>
                      <td className="py-4 px-3 text-slate-800 align-top text-center">
                        <div className="font-medium">{lens.productName}</div>
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {lens.groupName}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          {lens.currentPowerGroup?.label || '-'}
                        </span>
                      </td>
                      <td className={`text-center font-bold py-4 px-3 align-top ${lens.isPriceUpdated ? 'bg-yellow-100 text-yellow-900 border-x border-yellow-200 shadow-inner' : 'text-slate-900'}`}>
                        {formatPrice(lens.currentPowerGroup ? (lens.currentPowerGroup.salePrice || 0) : (lens.salePrice?.default || 0))}
                      </td>
                      <td className="text-center py-4 px-3 align-top">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          <Eye className="w-3 h-3" />
                          {lens.eye?.toUpperCase() || ""}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center text-xs">
                        {lens.currentPowerGroup ? `${lens.currentPowerGroup.sphMin} to ${lens.currentPowerGroup.sphMax}` : `${lens.sphMin} to ${lens.sphMax}`}
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center text-xs">
                        {lens.currentPowerGroup ? `${lens.currentPowerGroup.cylMin} to ${lens.currentPowerGroup.cylMax}` : `${lens.cylMin} to ${lens.cylMax}`}
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center text-xs">
                        {lens.currentPowerGroup?.axis || lens.axis || "-"}
                      </td>
                      <td className="py-4 px-3 text-slate-700 align-top text-center text-xs">
                        {lens.currentPowerGroup ? `${lens.currentPowerGroup.addMin} to ${lens.currentPowerGroup.addMax}` : `${lens.addMin} to ${lens.addMax}`}
                      </td>
                      <td className="py-4 px-2 align-top text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(lens.originalLensId, lens.originalPowerGroupId)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLensPower(lens.originalLensId)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          >
                            <Trash className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
}

export default LensPrice;
