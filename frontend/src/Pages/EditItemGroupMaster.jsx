import React, { useState, useEffect } from "react";
import { Trash, Save, RotateCcw } from "lucide-react";
import { updateGroup , getGroupbyId} from "../controllers/groupcontroller.js";
import toast from "react-hot-toast";
import { useParams , useNavigate } from "react-router-dom";

function EditItemGroupMaster() {
  const [formData, setFormData] = useState({
    groupName: "",
    printName: "",
    primaryGroup: false,
    saleDiscount: "",
    saleDiscountApplyAll: false,
    purchaseDiscount: "",
    hsnCode: "",
    hsnApplyAll: false,
    loyaltyPoint: "",
    loyaltyApplyAll: false,
    textCategory1: "",
    textCategory1ApplyAll: false,
    codeg1Limit: "",
    taxCategory2: "",
    appliedTaxDate: "",
    alertNegativeQty: false,
    restrictNegativeQty: false,
  });

  const [taxHistory] = useState([
    {
      id: 1,
      changeFrom: "2025-08-14",
      taxCategory1: "GST 18%",
      range: "0",
      taxCategory2: "CGST 9%",
    },
  ]);

  // route param (call hooks at top level)
  const { id } = useParams();
  const navigate = useNavigate()

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fetchCurrentGroupData = async () => {
    // Fetch current group data logic here
    try {
      const data = await getGroupbyId(id);

      // Normalize date to yyyy-MM-dd for <input type="date" />
      const appliedTaxDate = data.appliedTaxDate
        ? new Date(data.appliedTaxDate).toISOString().slice(0, 10)
        : "";

      setFormData({
        groupName: data.groupName || "",
        printName: data.printName || "",
        primaryGroup: data.primaryGroup || false,
        saleDiscount: data.saleDiscount || "",
        saleDiscountApplyAll: data.saleDiscountApplyAll || false,
        purchaseDiscount: data.purchaseDiscount || "",
        hsnCode: data.hsnCode || "",
        hsnApplyAll: data.hsnApplyAll || false,
        loyaltyPoint: data.loyaltyPoint || "",
        loyaltyApplyAll: data.loyaltyApplyAll || false,
        textCategory1: data.textCategory1 || "",
        textCategory1ApplyAll: data.textCategory1ApplyAll || false,
        codeg1Limit: data.codeg1Limit || "",
        taxCategory2: data.taxCategory2 || "",
        appliedTaxDate,
        alertNegativeQty: data.alertNegativeQty || false,
        restrictNegativeQty: data.restrictNegativeQty || false,
      });
    } catch (error) {
      toast.error("Failed to fetch group data.");
      console.error(error);
    }
  };

  useEffect(() => {
    if (id) fetchCurrentGroupData();
  }, [id]);

  const handleReset = () => {
    setFormData({
      groupName: "",
      printName: "",
      primaryGroup: false,
      saleDiscount: "",
      saleDiscountApplyAll: false,
      purchaseDiscount: "",
      hsnCode: "",
      hsnApplyAll: false,
      loyaltyPoint: "",
      loyaltyApplyAll: false,
      textCategory1: "",
      textCategory1ApplyAll: false,
      codeg1Limit: "",
      taxCategory2: "",
      appliedTaxDate: "",
      alertNegativeQty: false,
      restrictNegativeQty: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.groupName.trim()) {
      toast.error("Group Name is required.");
      return;
    }
    try {
      await updateGroup(id , formData);
      toast.success("Group updated successfully!");
      handleReset();
          navigate(`/masters/inventorymaster/itemgroupmaster`)

    } catch (error) {
      toast.error(error.message || "Failed to update group.");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ">
      <div className="w-full">
        {/* Header */}
        <div className="">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Update Item Group Master
          </h1>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-6">
          {/* Group Information */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Group Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => handleInputChange("groupName", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Enter group name"
                />
              </div>

              {/* Print Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Print Name
                </label>
                <input
                  type="text"
                  value={formData.printName}
                  onChange={(e) => handleInputChange("printName", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Enter print name"
                />
              </div>

              {/* Primary Group */}
              <div className="flex jsce items-center gap-2 mt-6">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={formData.primaryGroup}
                    onChange={(e) => handleInputChange("primaryGroup", e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  Primary Group
                </label>
              </div>

              {/* Purchase Discount */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Purchase Discount (%)
                </label>
                <input
                  type="number"
                  value={formData.purchaseDiscount}
                  onChange={(e) => handleInputChange("purchaseDiscount", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="0.00"
                />
              </div>

              {/* Sale Discount */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Sale Discount (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.saleDiscount}
                    onChange={(e) => handleInputChange("saleDiscount", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="0.00"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={formData.saleDiscountApplyAll}
                      onChange={(e) => handleInputChange("saleDiscountApplyAll", e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    Apply All
                  </label>
                </div>
              </div>

              {/* HSN Code */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  HSN Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.hsnCode}
                    onChange={(e) => handleInputChange("hsnCode", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="HSN"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={formData.hsnApplyAll}
                      onChange={(e) => handleInputChange("hsnApplyAll", e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    Apply All
                  </label>
                </div>
              </div>

              {/* Loyalty Point */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Loyalty Point
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.loyaltyPoint}
                    onChange={(e) => handleInputChange("loyaltyPoint", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Points"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={formData.loyaltyApplyAll}
                      onChange={(e) => handleInputChange("loyaltyApplyAll", e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    Apply All
                  </label>
                </div>
              </div>

              {/* Tax Category 1 */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tax Category 1
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.textCategory1}
                    onChange={(e) => handleInputChange("textCategory1", e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="e.g. GST 18%"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={formData.textCategory1ApplyAll}
                      onChange={(e) => handleInputChange("textCategory1ApplyAll", e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    Apply All
                  </label>
                </div>
              </div>

              {/* Code G1 Limit */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Code G1 Limit
                </label>
                <input
                  type="number"
                  value={formData.codeg1Limit}
                  onChange={(e) => handleInputChange("codeg1Limit", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Limit"
                />
              </div>

              {/* Tax Category 2 */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tax Category 2
                </label>
                <input
                  type="text"
                  value={formData.taxCategory2}
                  onChange={(e) => handleInputChange("taxCategory2", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="e.g. CGST 9%"
                />
              </div>

              {/* Applied Tax Date */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Applied Tax Date
                </label>
                <input
                  type="date"
                  value={formData.appliedTaxDate}
                  onChange={(e) => handleInputChange("appliedTaxDate", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Tax History Section */}
          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              Tax History
            </h2>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-slate-700 bg-gradient-to-r from-blue-50 to-slate-50 p-2 rounded-md mb-2">
              <div className="col-span-1 text-center">SN</div>
              <div className="col-span-2">Change From</div>
              <div className="col-span-3">Tax Cat 1</div>
              <div className="col-span-2 text-center">Range</div>
              <div className="col-span-3">Tax Cat 2</div>
              <div className="col-span-1 text-center">Del</div>
            </div>

            {/* Mobile Label */}
            <div className="sm:hidden text-xs font-semibold text-slate-700 mb-2">
              Tax History Records
            </div>

            {/* Table Body - Scrollable */}
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md">
              {taxHistory.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">
                  No tax history available
                </p>
              ) : (
                taxHistory.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2 text-xs border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    {/* Mobile Layout */}
                    <div className="sm:hidden space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">SN:</span> <span>{index + 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>From:</span> <span>{item.changeFrom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax 1:</span> <span className="truncate">{item.taxCategory1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Range:</span> <span>{item.range}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax 2:</span> <span className="truncate">{item.taxCategory2}</span>
                      </div>
                      <div className="text-right">
                        <button className="text-red-600 hover:bg-red-50 p-1 rounded">
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block col-span-1 text-center font-medium">
                      {index + 1}
                    </div>
                    <div className="hidden sm:block col-span-2">{item.changeFrom}</div>
                    <div className="hidden sm:block col-span-3 truncate" title={item.taxCategory1}>
                      {item.taxCategory1}
                    </div>
                    <div className="hidden sm:block col-span-2 text-center">{item.range}</div>
                    <div className="hidden sm:block col-span-3 truncate" title={item.taxCategory2}>
                      {item.taxCategory2}
                    </div>
                    <div className="hidden sm:block col-span-1 text-center">
                      <button className="text-red-600 hover:bg-red-50 p-1 rounded transition">
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Controls */}
            <div className="mt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.alertNegativeQty}
                    onChange={(e) => handleInputChange("alertNegativeQty", e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="text-slate-700">Alert Negative Qty</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.restrictNegativeQty}
                    onChange={(e) => handleInputChange("restrictNegativeQty", e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="text-slate-700">Restrict Negative Qty</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Update Group
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditItemGroupMaster;