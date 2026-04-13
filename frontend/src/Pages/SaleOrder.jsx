import React, { useState, useMemo, useEffect, useRef } from "react";
import { printBarcodeStickers } from "../utils/BarcodeStickerHelper";
import { printAuthenticityCard } from "../utils/AuthenticityCardHelper";
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
  Forward,
  Info,
  Receipt,
  Eye,
  BarChart3,
  CreditCard,
  X,
  Columns,
  Check,
  ShoppingCart,
  Grid3X3,
  Filter,
} from "lucide-react";
import ItemsMatrixViewModal from "../Components/ItemsMatrixViewModal";
import { FaWhatsapp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import {
  createLensInvoice,
  getAllLensSaleOrder,
  removeLensSaleOrder,
  createLensChallan,
  updateSaleOrderStatus,
  updateSaleOrderBookedBy,
  updateOrderQuantities,
  updateSaleOrderVendor,
  updateLensItemStatus,
  editLensSaleOrder,
  syncOrderAcrossModules,
  updateOrderPlacementStatus as updateLensOrderPlacementStatus,
  updateSaleOrderRefNo,
  updateLensItemRemark,
} from '../controllers/LensSaleOrder.controller.js';
import { getAllLensPower } from "../controllers/LensGroupCreationController";

import {
  getAllRxSaleOrder,
  removeRxSaleOrder,
  createRxInvoice,
  createRxChallan,
  updateRxSaleOrderStatus,
  updateRxSaleOrderBookedBy,
  updateRxSaleOrderVendor,
  editRxSaleOrder,
  updateOrderPlacementStatus as updateRxOrderPlacementStatus,
  updateRxSaleOrderRefNo,
  updateRxItemRemark,
} from "../controllers/RxSaleOrder.controller.js";

import {
  getAllContactLensSaleOrder,
  removeContactLensSaleOrder,
  updateContactLensSaleOrderStatus,
  updateContactLensSaleOrderBookedBy,
  editContactLensSaleOrder,
  createContactLensChallan,
  updateOrderPlacementStatus as updateContactOrderPlacementStatus,
  updateContactLensSaleOrderRefNo,
  updateContactLensItemRemark,
} from "../controllers/ContactLensSaleOrder.controller.js";
import { getAllItems } from "../controllers/itemcontroller";

import { toast, Toaster } from "react-hot-toast";
import StatusDropdown from "../Components/StatusDropdown";
import ApiClient from "../ApiClient";
import { validateAccountLimits, getValidationErrorMessage } from "../utils/accountLimitValidator";
import { roundAmount } from "../utils/amountUtils";
import { numberToWords } from "../utils/numberToWords";

// Print Template Components
const NormalPrintTemplate = ({ order, allLenses = [], allItems = [] }) => {
  const getPrintItemName = (item) => {
    if (item.billItemName && item.billItemName.trim() !== "") return item.billItemName;
    const foundLens = (allLenses || []).find(l => 
      String(l.productName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundLens?.billItemName) return foundLens.billItemName;
    const foundItem = (allItems || []).find(i => 
      String(i.itemName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundItem?.billItemName) return foundItem.billItemName;
    return item.itemName || "-";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  return (
    <div className="print-container bg-white p-4 max-w-4xl mx-auto text-slate-800 font-sans" style={{ minHeight: '800px' }}>
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-300">
        <div className="flex items-center gap-4">
          <img src="/sadguru_logo.svg" alt="Logo" style={{ width: '120px', height: 'auto' }} />
        </div>
        <div className="flex-1 text-center">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">SALE ORDER</h1>
        </div>
        <div className="w-[120px]"></div> {/* Spacer to keep title centered */}
      </div>

      <div className="grid grid-cols-2 gap-8 mb-4">
        {/* Left: Party Details */}
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="font-bold w-28">Party Name</span>
            <span>: {order?.partyData?.partyAccount || "-"}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold w-28">Address</span>
            <span className="flex-1">: {order?.partyData?.address || "-"}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold w-28">State</span>
            <span>: {order?.partyData?.stateCode || "-"}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold w-28">Phone</span>
            <span>: {order?.partyData?.contactNumber || "-"}</span>
          </div>
        </div>

        {/* Right: Bill Information */}
        <div className="space-y-1 ml-auto">
          <div className="flex gap-2 justify-end">
            <span className="font-bold w-28">Bill Series</span>
            <span className="w-32">: {order?.billData?.billSeries || "-"}</span>
          </div>
          <div className="flex gap-2 justify-end">
            <span className="font-bold w-28">Bill No</span>
            <span className="w-32">: {order?.billData?.billNo || "-"}</span>
          </div>
          <div className="flex gap-2 justify-end">
            <span className="font-bold w-28">Date</span>
            <span className="w-32">: {formatDate(order?.billData?.date)}</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <table className="w-full border-collapse border border-slate-400 text-[11px]">
        <thead>
          <tr className="bg-slate-100 uppercase">
            <th className="border border-slate-400 p-1 w-8">SR</th>
            <th className="border border-slate-400 p-1 text-left">ITEM NAME</th>
            <th className="border border-slate-400 p-1">ORDER NO</th>
            <th className="border border-slate-400 p-1">EYE</th>
            <th className="border border-slate-400 p-1">SPH</th>
            <th className="border border-slate-400 p-1">CYL</th>
            <th className="border border-slate-400 p-1">AXIS</th>
            <th className="border border-slate-400 p-1">ADD</th>
            <th className="border border-slate-400 p-1">QTY</th>
            <th className="border border-slate-400 p-1 text-right">SALE PRICE</th>
            <th className="border border-slate-400 p-1 text-right">DISC</th>
            <th className="border border-slate-400 p-1 text-right">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order?.items?.map((item, idx) => (
            <tr key={idx} className="h-8">
              <td className="border border-slate-400 p-1 text-center">{idx + 1}</td>
              <td className="border border-slate-400 p-1 font-bold">{getPrintItemName(item)}</td>
              <td className="border border-slate-400 p-1 text-center">{item.orderNo || item.refId || "-"}</td>
              <td className="border border-slate-400 p-1 text-center">{item.eye || "-"}</td>
              <td className="border border-slate-400 p-1 text-center font-mono">{item.sph || "-"}</td>
              <td className="border border-slate-400 p-1 text-center font-mono">{item.cyl || "-"}</td>
              <td className="border border-slate-400 p-1 text-center font-mono">{item.axis || "-"}</td>
              <td className="border border-slate-400 p-1 text-center font-mono">{item.add || "-"}</td>
              <td className="border border-slate-400 p-1 text-center font-bold">{item.qty || 0}</td>
              <td className="border border-slate-400 p-1 text-right">{roundAmount(item.salePrice || 0)}</td>
              <td className="border border-slate-400 p-1 text-right">{item.discount || 0}%</td>
              <td className="border border-slate-400 p-1 text-right font-bold">{roundAmount(item.totalAmount || 0)}</td>
            </tr>
          ))}
          {/* Fill empty rows to maintain structure if needed */}
          {[...Array(Math.max(0, 5 - (order?.items?.length || 0)))].map((_, i) => (
             <tr key={`empty-${i}`} className="h-8">
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
               <td className="border border-slate-400 p-1"></td>
             </tr>
          ))}
          {/* Summary Row inside table */}
          <tr className="bg-slate-50 font-bold">
            <td colSpan={2} className="border border-slate-400 p-1 text-center uppercase tracking-widest">Total</td>
            <td colSpan={6} className="border border-slate-400 p-1"></td>
            <td className="border border-slate-400 p-1 text-center">{order?.items?.reduce((sum, i) => sum + (Number(i.qty) || 0), 0)}</td>
            <td className="border border-slate-400 p-1"></td>
            <td className="border border-slate-400 p-1"></td>
            <td className="border border-slate-400 p-1 text-right">{roundAmount(order?.subtotal || 0)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer Section */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Left: Words and T&C */}
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Total Invoice value ( In Words ) :</p>
            <p className="text-sm font-black italic">{numberToWords(order?.netAmount || 0)}</p>
          </div>
          
          <div className="pt-2 border-t border-slate-200">
            <p className="text-[10px] font-bold text-slate-800">Terms & Condition</p>
            <p className="text-[10px] text-slate-500 italic leading-tight mt-1">
              We declare that this invoice shows the actual price of the goods described<br />
              and that all particulars are true and correct.
            </p>
          </div>
        </div>

        {/* Right: Payment Summary */}
        <div className="ml-auto w-64 space-y-1 text-sm border-l border-slate-200 pl-6">
          <div className="flex justify-between">
            <span className="font-bold">Total Amount</span>
            <span>{roundAmount(order?.netAmount || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Paid Amt</span>
            <span>{roundAmount(order?.paidAmount || 0)}</span>
          </div>
          <div className="flex justify-between text-red-600 font-black border-b border-slate-200 pb-1">
            <span className="font-bold">Due Amt</span>
            <span>{roundAmount(order?.dueAmount || 0)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-bold">Prev.Bal</span>
            <span>{roundAmount(order?.partyData?.prevBalance || 0)}</span>
          </div>
          <div className="flex justify-between pt-2 mt-4 border-t border-slate-400 font-black text-lg">
             <span>Net Payable</span>
             <span>{roundAmount((order?.dueAmount || 0) + (order?.partyData?.prevBalance || 0))}</span>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-16 flex justify-between px-8">
        <div className="text-center">
            <div className="w-32 border-b border-slate-400 mb-2"></div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Customer Sign</p>
        </div>
        <div className="text-center">
             <p className="text-[11px] font-black mb-12">For, Sadguru Opticals</p>
            <div className="w-40 border-b border-slate-400 mb-2"></div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
};

 

const BarcodePrintTemplate = ({ order, allLenses = [], allItems = [] }) => {
  return (
    <div className="print-container bg-white p-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold uppercase tracking-widest text-blue-700">Barcode Labels Preview</h2>
        <p className="text-sm text-gray-600">
          Order: <span className="font-semibold">{order?.billData?.billNo}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1 italic">Standard Size: 70mm × 30mm</p>
      </div>

      <div className="flex flex-wrap gap-6 justify-center">
        {order?.items?.filter(it => (Number(it.qty) || 0) > 0).map((item, idx) => {
          return (
            <div key={idx} className="relative group">
              <div className="w-[70mm] h-[30mm] border border-blue-200 rounded-lg bg-white shadow-sm flex overflow-hidden ring-1 ring-blue-50/50">
                 {/* Left section info strip */}
                <div className="w-[22mm] bg-slate-50 border-r border-blue-100 flex flex-col items-center justify-between py-1.5 px-1">
                  <div className="text-[10pt] font-black text-blue-800 leading-none">{item.eye || "R/L"}</div>
                  <div className="w-12 h-12 bg-white rounded border border-blue-50 flex items-center justify-center">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(item.itemName || "")}&size=50x50`} alt="QR" className="w-10 h-10" />
                  </div>
                  <div className="text-[6.5pt] font-bold text-slate-700 tracking-tighter overflow-hidden whitespace-nowrap">{item.barcode || "0444821"}</div>
                </div>
                
                {/* Right section info */}
                <div className="flex-1 p-2 flex flex-col justify-between">
                  <div>
                    <div className="text-[8pt] font-black text-slate-900 truncate mb-0.5">{(order?.partyData?.partyAccount || "Customer Name").toUpperCase()}</div>
                    <div className="text-[7.5pt] font-semibold text-slate-700 line-clamp-2 leading-tight h-[6.5mm] overflow-hidden">{item.itemName}</div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[6.5pt] font-medium text-slate-500 whitespace-nowrap">
                    <span>SPH <strong className="text-slate-900 font-bold">{item.sph || "0.00"}</strong></span>
                    <span>CYL <strong className="text-slate-900 font-bold">{item.cyl || "0.00"}</strong></span>
                    <span>ADD <strong className="text-slate-900 font-bold">{item.add || "0.00"}</strong></span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[6pt] font-bold text-blue-900/70 border-t border-blue-50 pt-1">
                    <span>No: {order?.billData?.billNo}</span>
                    <span>{new Date().toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CardPrintTemplate = ({ order, allLenses = [], allItems = [] }) => {
  const getPrintItemName = (item) => {
    if (item.billItemName && item.billItemName.trim() !== "") return item.billItemName;
    const foundLens = (allLenses || []).find(l => 
      String(l.productName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundLens?.billItemName) return foundLens.billItemName;
    const foundItem = (allItems || []).find(i => 
      String(i.itemName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundItem?.billItemName) return foundItem.billItemName;
    return item.itemName || "-";
  };

  return (
    <div className="print-container bg-white p-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold">PRODUCT CARDS</h2>
        <p className="text-sm text-gray-600">
          Order: {order?.billData?.billNo}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 justify-items-center">
        {order?.items?.map((item, idx) => (
          <div
            key={idx}
            className="card-item p-4 border-2 border-gray-800 bg-white max-w-xs"
          >
            <div className="mb-3">
              <h3 className="text-sm font-bold text-center">{getPrintItemName(item)}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="text-center border border-gray-400 p-1">
                <p className="text-xs font-semibold">SPH</p>
                <p className="text-sm font-bold">{item.sph || "-"}</p>
              </div>
              <div className="text-center border border-gray-400 p-1">
                <p className="text-xs font-semibold">CYL</p>
                <p className="text-sm font-bold">{item.cyl || "-"}</p>
              </div>
              <div className="text-center border border-gray-400 p-1">
                <p className="text-xs font-semibold">AXIS</p>
                <p className="text-sm font-bold">{item.axis || "-"}</p>
              </div>
              <div className="text-center border border-gray-400 p-1">
                <p className="text-xs font-semibold">QTY</p>
                <p className="text-sm font-bold">{item.qty || 0}</p>
              </div>
            </div>

            <div className="border-t border-gray-400 pt-2">
              <p className="text-center font-bold text-sm">
                ₹{roundAmount(item.salePrice || 0)}
              </p>
              <p className="text-center text-xs text-gray-600 mt-1">
                {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function SaleOrder() {
  const navigate = useNavigate();
  const [viewType, setViewType] = useState("lens"); // 'lens' or 'rx'
  const [saleOrders, setSaleOrders] = useState([]);
  const [printModal, setPrintModal] = useState(null);
  const [printData, setPrintData] = useState(null);
  const printRef = useRef(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedItemsByOrder, setSelectedItemsByOrder] = useState({});
  const [selectedItems, setSelectedItems] = useState([]); // For bulk operations
  const [allLenses, setAllLenses] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [bulkOrderModal, setBulkOrderModal] = useState(false); // For bulk order modal
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [bookedByValues, setBookedByValues] = useState({});
  const bookedByTimers = useRef({});
  const [quantitiesValues, setQuantitiesValues] = useState({});
  const [vendorValues, setVendorValues] = useState({});
  const vendorTimers = useRef({});
  const [refNoValues, setRefNoValues] = useState({});
  const refNoTimers = useRef({});
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for threshold checks
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Status Filter State
  const [selectedStatuses, setSelectedStatuses] = useState(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);

  const STATUS_OPTIONS = ["Pending", "In Progress", "Done", "Cancelled", "On Approval"];

  // Matrix Modal State
  const [matrixModal, setMatrixModal] = useState({
    isOpen: false,
    orderId: null,
    items: [],
    viewType: 'lens'
  });

  const handleOpenMatrix = (order) => {
    setMatrixModal({
      isOpen: true,
      orderId: order._id,
      items: order.items || [],
      viewType: viewType
    });
  };

  const handleMatrixSave = async (updatedItems) => {
    if (!matrixModal.orderId) return;
    const order = saleOrders.find(o => o._id === matrixModal.orderId);
    if (!order) return;

    const itemsWithTotals = updatedItems.map(item => ({
      ...item,
      totalAmount: roundAmount((Number(item.qty) || 0) * (Number(item.salePrice) || 0))
    }));

    // Recalculate order-level totals
    const newGross = itemsWithTotals.reduce((sum, it) => sum + (it.totalAmount || 0), 0);

    const updatedOrder = {
      ...order,
      items: itemsWithTotals,
      grossAmount: roundAmount(newGross),
      subtotal: roundAmount(newGross),
      netAmount: roundAmount(newGross + Number(order.taxesAmount || 0)),
    };

    try {
      let res;
      if (matrixModal.viewType === "lens") {
        res = await editLensSaleOrder(matrixModal.orderId, updatedOrder);
      } else if (matrixModal.viewType === "rx") {
        res = await editRxSaleOrder(matrixModal.orderId, updatedOrder);
      } else if (matrixModal.viewType === "contact") {
        res = await editContactLensSaleOrder(matrixModal.orderId, updatedOrder);
      }

      if (res && res.success) {
        toast.success("Items updated successfully!");
        setSaleOrders(prev => prev.map(o => o._id === matrixModal.orderId ? res.data : o));
        setMatrixModal(prev => ({ ...prev, isOpen: false }));
      } else if (!res) {
        toast("Save simulated (API not connected for this type)");
        setMatrixModal(prev => ({ ...prev, isOpen: false }));
      } else {
        toast.error(res?.error || "Failed to save items");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving matrix items");
    }
  };

  const getMatrixColumns = () => {
    const common = [
      { header: "Item Name", key: "itemName", width: "150px" },
      { header: "Eye", key: "eye", width: "60px", align: "center" },
      { header: "SPH", key: "sph", width: "60px", align: "center" },
      { header: "CYL", key: "cyl", width: "60px", align: "center" },
      { header: "Axis", key: "axis", width: "60px", align: "center" },
      { header: "Qty", key: "qty", width: "80px", align: "center", editable: true, type: "number" },
      { header: "Price", key: "salePrice", width: "100px", align: "right", editable: true, type: "number" },
      {
        header: "Total", key: "totalAmount", width: "100px", align: "right",
        format: (val) => `₹${roundAmount(val || 0)}`
      },
      {
        header: "Status", key: "itemStatus", width: "120px", align: "center", render: (item, onChange) => (
          <StatusDropdown
            currentStatus={item.itemStatus || "Pending"}
            size="sm"
            onStatusChange={(val) => onChange(val)}
          />
        )
      }
    ];
    if (matrixModal.viewType === "contact") {
      return [
        { header: "Item Name", key: "itemName", width: "150px" },
        { header: "Eye", key: "eye", width: "60px", align: "center" },
        { header: "SPH", key: "sph", width: "60px", align: "center" },
        { header: "Qty", key: "qty", width: "80px", align: "center", editable: true, type: "number" },
        { header: "Vendor", key: "vendor", width: "120px", editable: true },
        { header: "Price", key: "salePrice", width: "100px", align: "right", editable: true, type: "number" },
        {
          header: "Total", key: "totalAmount", width: "100px", align: "right",
          format: (val) => `₹${roundAmount(val || 0)}`
        },
        {
          header: "Status", key: "itemStatus", width: "120px", align: "center", render: (item, onChange) => (
            <StatusDropdown
              currentStatus={item.itemStatus || "Pending"}
              size="sm"
              onStatusChange={(val) => onChange(val)}
            />
          )
        }
      ];
    }
    if (matrixModal.viewType !== "contact") {
      return [
        ...common.slice(0, 4),
        { header: "ADD", key: "add", width: "60px", align: "center" },
        ...common.slice(4)
      ];
    }
    return common;
  };

  const handleQuantityChange = (id, field, value) => {
    // allow empty string for typing
    if (value === "") {
      setQuantitiesValues(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: "" }
      }));
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

  const saveQuantities = async (id) => {
    const vals = quantitiesValues[id];
    if (!vals) return;
    const o = Number(vals.ordQty || 0);
    const u = Number(vals.usedQty || 0);

    if (u > o) {
      toast.error("Used Qty cannot exceed Order Qty");
      // Revert or force fix? Let's just warn for now and not save invalid state if strict
      return;
    }

    const res = await updateOrderQuantities(id, { orderQty: o, usedQty: u });
    if (res.success) {
      toast.success("Quantities updated");
      fetchdata();
    } else {
      toast.error("Failed to update quantities");
    }
  };

  // Lens Master Price Map
  const [lensMasterMap, setLensMasterMap] = useState({});

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const res = await getAllLensPower();
        if (res?.success && Array.isArray(res.data)) {
          const map = {};
          res.data.forEach((group) => {
            if (group.addGroups) {
              group.addGroups.forEach((ag) => {
                if (ag.combinations) {
                  ag.combinations.forEach((comb) => {
                    if (comb._id) {
                      map[String(comb._id)] = Number(comb.pPrice) || 0;
                    }
                  });
                }
              });
            }
          });
          setLensMasterMap(map);
        }
      } catch (err) {
        console.error("Error fetching lens masters:", err);
      }
    };
    fetchMasters();
  }, []);

  // Column Filter State
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const columnFilterRef = useRef(null);

  const ALL_COLUMNS = [
    { id: "date", label: "Date" },
    { id: "time", label: "Time" },
    { id: "series", label: "Series" },
    { id: "billNo", label: "No." },
    { id: "partyName", label: "Party Name" },
    { id: "importDate", label: "Import Date", viewSpecific: "contact" },
    { id: "expiryDate", label: "Expiry Date", viewSpecific: "contact" },
    { id: "mrp", label: "MRP", viewSpecific: "contact" },
    { id: "netAmt", label: "Net Amt" },
    { id: "usedIn", label: "Used in" },
    { id: "bookedBy", label: "Booked By" },
    { id: "status", label: "Status" },
    { id: "ordQty", label: "Ord Q" },
    { id: "usedQty", label: "Used Q" },
    { id: "balQty", label: "Bal Q" },
    { id: "marginBeforeGst", label: "Margin (Before GST)" },
    { id: "marginAfterGst", label: "Margin (After GST)" },
    { id: "margin", label: "Product Margin" },
    { id: "vendor", label: "Vendor" },
    { id: "placeOrd", label: "Place Ord" },
    { id: "refNo", label: "Ref No." },
    { id: "cancelReason", label: "Reason" },
  ];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("saleOrderVisibleColumns");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.placeOrd === undefined) parsed.placeOrd = true;
      return parsed;
    }
    return {
      date: true,
      time: true,
      series: true,
      billNo: true,
      partyName: true,
      importDate: true,
      expiryDate: true,
      mrp: true,
      netAmt: true,
      marginBeforeGst: true,
      marginAfterGst: true,
      margin: true,
      vendor: true,
      usedIn: true,
      bookedBy: true,
      status: true,
      ordQty: true,
      usedQty: true,
      balQty: true,
      placeOrd: true,
      refNo: true,
    };
  });

  useEffect(() => {
    localStorage.setItem("saleOrderVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Close filters when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (columnFilterRef.current && !columnFilterRef.current.contains(event.target)) {
        setShowColumnFilter(false);
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target)) {
        setShowStatusFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleColumn = (columnId) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  const activeVisibleCount = useMemo(() => {
    let count = 2; // Sr and Action
    ALL_COLUMNS.forEach((col) => {
      const isVisibleForView = !col.viewSpecific || col.viewSpecific === viewType;
      if (isVisibleForView && visibleColumns[col.id]) {
        count++;
      }
    });
    return count;
  }, [visibleColumns, viewType]);

  // WhatsApp Confirmation Modal State
  const [whatsappModal, setWhatsappModal] = useState({
    isOpen: false,
    order: null
  });

  // Cancel Reason Modal State
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    orderId: null,
    reason: "",
    status: ""
  });

  // Cancel reason values for inline editing
  const [cancelReasonValues, setCancelReasonValues] = useState({});
  const cancelReasonTimers = useRef({});

  const handleCancelReasonChange = (orderId, value) => {
    setCancelReasonValues(prev => ({ ...prev, [orderId]: value }));
  };

  const saveCancelReason = async (orderId) => {
    const reason = cancelReasonValues[orderId];
    if (reason === undefined) return;

    try {
      let res;
      if (viewType === "lens") {
        res = await updateSaleOrderCancelReason(orderId, reason);
      } else if (viewType === "rx") {
        res = await updateRxSaleOrderCancelReason(orderId, reason);
      } else if (viewType === "contact") {
        res = await updateContactLensSaleOrderCancelReason(orderId, reason);
      }

      if (res.success) {
        setSaleOrders(prev => prev.map(o => o._id === orderId ? { ...o, cancelReason: reason } : o));
      }
    } catch (err) {
      console.error("Error saving cancel reason:", err);
    }
  };

  // Fetch data based on viewType
  const fetchdata = async () => {
    try {
      let res;
      if (viewType === "lens") {
        res = await getAllLensSaleOrder();
      } else if (viewType === "rx") {
        res = await getAllRxSaleOrder();
      } else if (viewType === "contact") {
        res = await getAllContactLensSaleOrder();
      }

      setSaleOrders(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch orders");
      setSaleOrders([]);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [lensesRes, itemsRes] = await Promise.all([
        getAllLensPower(),
        getAllItems()
      ]);
      setAllLenses(Array.isArray(lensesRes?.data) ? lensesRes.data : (Array.isArray(lensesRes) ? lensesRes : []));
      setAllItems(Array.isArray(itemsRes?.items) ? itemsRes.items : (Array.isArray(itemsRes) ? itemsRes : []));
    } catch (error) {
      console.error("Error fetching master data:", error);
    }
  };

  useEffect(() => {
    fetchdata();
    fetchMasterData();
  }, [viewType]);

  // Initialize bookedByValues from fetched data
  useEffect(() => {
    const initialValues = {};
    const vendorInit = {};
    const qtyValues = {};
    const refValues = {};
    saleOrders.forEach((order) => {
      initialValues[order._id] = order.billData?.bookedBy || "";
      const firstVendor =
        order.items?.find((it) => (it.vendor || "").trim() !== "")?.vendor ||
        "";
      vendorInit[order._id] = firstVendor;
      refValues[order._id] = order.refNo || "";
      qtyValues[order._id] = {
        ordQty: order.orderQty !== undefined ? order.orderQty : (order.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0),
        usedQty: order.usedQty || 0,
        balQty: order.balQty || 0
      };
    });
    setBookedByValues(initialValues);
    setQuantitiesValues(qtyValues);
    setRefNoValues(refValues);
    setVendorValues(vendorInit);
  }, [saleOrders]);

  const handleRefNoChange = (id, value) => {
    setRefNoValues((prev) => ({ ...prev, [id]: value }));

    if (refNoTimers.current[id]) {
      clearTimeout(refNoTimers.current[id]);
    }

    refNoTimers.current[id] = setTimeout(async () => {
      try {
        let res;
        if (viewType === "lens") {
          res = await updateSaleOrderRefNo(id, value);
        } else if (viewType === "rx") {
          res = await updateRxSaleOrderRefNo(id, value);
        } else if (viewType === "contact") {
          res = await updateContactLensSaleOrderRefNo(id, value);
        }

        if (res?.success) {
          toast.success("Ref No updated");
          setSaleOrders((prev) =>
            prev.map((o) => (o._id === id ? { ...o, refNo: value } : o))
          );
        } else {
          toast.error(res?.error || "Failed to update Ref No");
        }
      } catch (err) {
        toast.error("Error updating Ref No");
      }
    }, 1000);
  };

  // Helper to format Date as YYYY-MM-DD in local time
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toDayRange = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    const d = new Date(yyyyMmDd);
    if (isNaN(d.getTime())) return null;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  };

  const todayStr = getTodayDateString();

  const [filters, setFilters] = useState({
    billSeries: "",
    dateFrom: todayStr,
    dateTo: todayStr,
    delivFrom: "",
    delivTo: "",
    searchText: "",
  });

  const handleFilterChange = (field, value) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const handleReset = () => {
    const todayStrReset = getTodayDateString();
    setFilters({
      billSeries: "",
      dateFrom: todayStrReset,
      dateTo: todayStrReset,
      delivFrom: "",
      delivTo: "",
      searchText: "",
    });
    setSelectedStatuses(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  };

  const filteredOrders = useMemo(() => {
    const q = filters.billSeries.toLowerCase();

    const fromRange = toDayRange(filters.dateFrom);
    const toRange = toDayRange(filters.dateTo);
    const windowStart = fromRange ? fromRange.start : null;
    const windowEnd = toRange ? toRange.end : null;

    const delivFromRange = toDayRange(filters.delivFrom);
    const delivToRange = toDayRange(filters.delivTo);
    const delivWindowStart = delivFromRange ? delivFromRange.start : null;
    const delivWindowEnd = delivToRange ? delivToRange.end : null;

    return saleOrders.filter((o) => {
      // Status Filtering
      const orderStatus = o.status || "Pending";
      // Lenient match check (handles "In Progress" vs "in-process" vs "InProgress")
      const isStatusMatch = selectedStatuses.some(s => {
        const sClean = s.toLowerCase().replace(/[- ]/g, '');
        const oClean = orderStatus.toLowerCase().replace(/[- ]/g, '');
        return sClean === oClean;
      });
      if (!isStatusMatch) return false;

      // Basic text search across multiple fields
      if (
        q &&
        !(
          `${o.billNo || o.billData?.billNo || ""}`.toLowerCase().includes(q) ||
          `${o.partyName || o.partyData?.partyAccount || ""}`.toLowerCase().includes(q) ||
          `${o.series || o.billData?.billSeries || ""}`.toLowerCase().includes(q) ||
          `${o.status || ""}`.toLowerCase().includes(q) ||
          `${o.chalNO || o.challanNo || ""}`.toLowerCase().includes(q) ||
          (o.items && o.items.some(it => String(it.orderNo || "").toLowerCase().includes(q)))
        )
      ) {
        return false;
      }

      // Date Filtering
      if (windowStart !== null || windowEnd !== null) {
        const billTs = o.billData?.date ? new Date(o.billData.date).getTime() : NaN;
        if (!isNaN(billTs)) {
          if (windowStart !== null && billTs < windowStart) return false;
          if (windowEnd !== null && billTs > windowEnd) return false;
        } else {
          // If no valid date and filters are applied, typically we might exclude it
          return false;
        }
      }

      if (delivWindowStart !== null || delivWindowEnd !== null) {
        const delTs = o.deliveryDate ? new Date(o.deliveryDate).getTime() : NaN;
        if (!isNaN(delTs)) {
          if (delivWindowStart !== null && delTs < delivWindowStart) return false;
          if (delivWindowEnd !== null && delTs > delivWindowEnd) return false;
        }
        // If there is no delivery date but a filter is applied, deciding to keep or discard is tricky. We'll discard.
        else if (filters.delivFrom || filters.delivTo) {
          return false;
        }
      }

      return true;
    });
  }, [filters, saleOrders, selectedStatuses]);

  const handleAddOrder = () => {
    if (viewType === "lens") {
      navigate("/lenstransaction/sale/AddLensSaleOrder");
    } else if (viewType === "rx") {
      navigate("/rxtransaction/rxorder/addrxorder"); // Adjust path if needed for Rx Order Add
    } else if (viewType === "contact") {
      navigate("/contactlens/sale/addcontactlensorder"); // Placeholder path
    }
  };

  const handleEdit = (id) => {
    if (viewType === "lens") {
      navigate(`/lenstransaction/sale/AddLensSaleOrder/${id}`);
    } else if (viewType === "rx") {
      navigate(`/rxtransaction/rxorder/addrxorder/${id}`);
    } else if (viewType === "contact") {
      navigate(`/contactlens/sale/addcontactlensorder/${id}`); // Placeholder path
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;

    let res;
    if (viewType === "lens") {
      res = await removeLensSaleOrder(id);
    } else if (viewType === "rx") {
      res = await removeRxSaleOrder(id);
    } else if (viewType === "contact") {
      res = await removeContactLensSaleOrder(id);
    }

    if (res.success) {
      toast.success(
        `${viewType === "lens" ? "Lens" : viewType === "rx" ? "Rx" : "Contact Lens"} Sale Order deleted!`,
      );
      setSaleOrders((prev) => prev.filter((o) => o._id !== id));
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const getId = (id) => {
    if (!id && id !== 0) return null;
    if (typeof id === "object" && id !== null) return id.$oid || String(id);
    return String(id);
  };

  const formatPrice = (price) => `₹${roundAmount(price || 0)}`;

  const calculateMargins = (order) => {
    if (!order || !order.items) return { beforeGst: 0, afterGst: 0, product: 0 };
    let totalCost = 0;
    order.items.forEach((item) => {
      let cost = Number(item.purchasePrice || 0);

      // If cost is 0, try to find it in master map using combinationId
      if (cost === 0 && item.combinationId && lensMasterMap[String(item.combinationId)] !== undefined) {
        cost = lensMasterMap[String(item.combinationId)];
      }

      const qty = Number(item.qty || 0);
      totalCost += cost * qty;
    });

    const subtotal = Number(order.subtotal || 0);
    const netAmount = Number(order.netAmount || 0);

    const beforeGst = subtotal - totalCost;
    const afterGst = netAmount - totalCost;

    return {
      beforeGst,
      afterGst,
      product: beforeGst,
    };
  };

  const footerTotals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, o) => {
        acc.netAmt += Number(o.netAmount || 0);

        // Standardize quantity summing by falling back to items if top-level is 0 or missing
        const oQty = Number(o.ordQty || 0) || (o.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0);
        const uQty = Number(o.usedQty || 0);
        const bQty = Number(o.balQty || 0) || (oQty - uQty);

        acc.ordQty += oQty;
        acc.usedQty += uQty;
        acc.balQty += bQty;

        const margins = calculateMargins(o);
        acc.marginBeforeGst += margins.beforeGst;
        acc.marginAfterGst += margins.afterGst;
        acc.margin += margins.product;
        return acc;
      },
      { netAmt: 0, ordQty: 0, usedQty: 0, balQty: 0, marginBeforeGst: 0, marginAfterGst: 0, margin: 0 }
    );
  }, [filteredOrders, calculateMargins]);

  const handleInfo = (id) => {
    const idStr = getId(id);
    console.log(
      "🔍 Expand clicked, idStr:",
      idStr,
      "current expandedRow:",
      expandedRow,
    );
    setExpandedRow((prev) => (prev === idStr ? null : idStr));
  };

  const handleSelect = (item, isChecked) => {
    if (isChecked) {
      setSelectedItems((prev) => {
        if (!prev.find((i) => i._id === item._id)) {
          return [...prev, item];
        }
        return prev;
      });
    } else {
      setSelectedItems((prev) => prev.filter((i) => i._id !== item._id));
    }
  };

  // Generic handler for creating invoice
  const handleCreateInvoice = async (o) => {
    const itemsToUse = o.items || [];

    if (itemsToUse.length === 0) {
      toast.error("No items available to create invoice.");
      return;
    }

    // Validate account credit limit and day limit before creating invoice
    const accountName = o.partyData?.partyAccount || "";
    if (accountName) {
      const validation = await validateAccountLimits(accountName, o.netAmount || 0, viewType);
      
      if (!validation.success) {
        // Show validation error popup
        const errorMessage = getValidationErrorMessage(validation.messages);
        toast.error(errorMessage);
        console.warn("Account validation failed:", validation);
        return;
      }
    }

    const payload = {
      sourceSaleId: o._id,
      billData: {
        billSeries: o.billData?.billSeries || "",
        billNo: o.billData?.billNo || "",
        billType: o.billData?.billType || "",
        godown: o.billData?.godown || "",
        bookedBy: o.billData?.bookedBy || "",
        date: o.billData?.date || new Date(),
      },
      partyData: o.partyData,
      items: itemsToUse,
      taxes: o.taxes,
      grossAmount: roundAmount(o.grossAmount || 0),
      subtotal: roundAmount(o.subtotal || 0),
      taxesAmount: roundAmount(o.taxesAmount || 0),
      netAmount: roundAmount(o.netAmount || 0),
      paidAmount: roundAmount(o.paidAmount || 0),
      dueAmount: roundAmount(o.dueAmount || 0),
      deliveryDate: o.deliveryDate,
      time: o.time,
      remark: o.remark,
      status: o.status,
    };

    let res;
    if (viewType === "lens") {
      res = await createLensInvoice(payload);
    } else if (viewType === "rx") {
      res = await createRxInvoice(payload);
    } else if (viewType === "contact") {
      toast("Invoice for Contact Lens not implemented yet");
      return;
    }

    if (res.success) {
      toast.success(res.data.message || "Invoice created successfully!");
      setTimeout(() => {
        navigate(
          viewType === "lens"
            ? "/lenstransaction/sale/saleinvoice"
            : viewType === "rx"
              ? "/rxtransaction/rxsale/saleinvoice?type=rx"
              : "/contactlens/sale/saleinvoice?type=contact",
        );
      }, 1500);
    } else {
      toast.error(res.error || "Failed to create invoice");
    }
  };

  const handleCreateChallan = async (o) => {

    const itemsToUse = o.items || [];

    if (itemsToUse.length === 0) {
      toast.error("No items available to create challan.");
      return;
    }

    // Validate account credit limit and day limit before creating challan
    const accountName = o.partyData?.partyAccount || "";
    if (accountName) {
      const validation = await validateAccountLimits(accountName, o.netAmount || 0, viewType);
      
      if (!validation.success) {
        // Show validation error popup
        const errorMessage = getValidationErrorMessage(validation.messages);
        toast.error(errorMessage);
        console.warn("Account validation failed:", validation);
        return;
      }
    }

    // Get selected items for this order from the extended row
    const selectedItemsForOrder = selectedItemsByOrder[o._id] || [];

    // For Challan creation, we send ALL items from the order, but mark which ones are selected
    const allItems = itemsToUse.map(it => ({
      ...it,
      qty: Number(it.qty) || 0,
      salePrice: Number(it.salePrice) || 0,
      totalAmount: Number(it.totalAmount) || 0
    }));

    const selectedIds = selectedItemsForOrder.length > 0
      ? selectedItemsForOrder
      : allItems.filter(it => it.qty > 0).map(it => String(it._id));

    if (selectedIds.length === 0) {
      toast.error("Please select at least one item.");
      return;
    }

    // Workflow restriction for Rx Sale Orders
    const isDone = (o.status || "").toLowerCase() === "done";
    if (viewType === 'rx' && !isDone) {
      const selectedItems = (o.items || []).filter(it => selectedIds.includes(it._id));
      const unpurchased = selectedItems.filter(it => !it.isPurchased && (it.itemStatus || "Pending").toLowerCase() === "pending");
      if (unpurchased.length > 0) {
        toast.error("Please complete purchase before creating challan.");
        console.warn("Attempted to create challan for unpurchased Rx items:", unpurchased.map(i => i.itemName));
        return;
      }
    }


    const payload = {
      sourceSaleId: o._id,
      selectedItemIds: selectedIds,
      billData: {
        billSeries: o.billData?.billSeries || "",
        billNo: o.billData?.billNo || "",
        billType: o.billData?.billType || "",
        godown: o.billData?.godown || "",
        bookedBy: o.billData?.bookedBy || "",
        date: o.billData?.date || new Date(),
      },
      partyData: o.partyData || {},
      items: allItems,
      taxes: o.taxes || [],
      grossAmount: roundAmount(o.grossAmount || 0),
      subtotal: roundAmount(o.subtotal || 0),
      taxesAmount: roundAmount(o.taxesAmount || 0),
      netAmount: roundAmount(o.netAmount || 0),
      paidAmount: roundAmount(o.paidAmount || 0),
      dueAmount: roundAmount(o.dueAmount || 0),
      deliveryDate: o.deliveryDate || new Date(),
      time: o.time || new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
      remark: o.remark || "",
      status: "In Progress",
    };

    console.log('📋 handleCreateChallan sending payload:', {
      sourceSaleId: payload.sourceSaleId,
      itemsCount: payload.items.length,
      selectedItemIds: payload.selectedItemIds,
      billData: payload.billData,
      partyData: payload.partyData
    });

    let res;
    if (viewType === "lens") {
      res = await createLensChallan(payload);
    } else if (viewType === "rx") {
      res = await createRxChallan(payload);
    } else if (viewType === "contact") {
      res = await createContactLensChallan(payload);
    }
    if (res.success) {
      toast.success(res.data.message || "Challan created successfully!");
      
      // Automatic WhatsApp Notification for Partial Fulfillment
      try {
        const totalEligibleItems = (o.items || []).filter(it => (Number(it.qty) || 0) > 0);
        const numSelected = selectedIds.length;
        if (numSelected < totalEligibleItems.length) {
          const pendingItems = totalEligibleItems.filter(it => !selectedIds.includes(String(it._id)));
          if (pendingItems.length > 0) {
            triggerPartialWhatsApp(o, numSelected, pendingItems);
          }
        }
      } catch (waErr) {
        console.error("WhatsApp trigger error:", waErr);
      }
      
      // Update the sale order status - only Mark as "Done" if no pending items remain
      try {
        const totalEligibleItems = (o.items || []).filter(it => (Number(it.qty) || 0) > 0);
        const hasPendingItems = totalEligibleItems.some(it => 
          !selectedIds.includes(String(it._id)) && (it.itemStatus || "Pending").toLowerCase() === "pending"
        );
        const targetStatus = hasPendingItems ? "In Progress" : "Done";

        if (viewType === "lens") {
          await updateSaleOrderStatus(o._id, targetStatus);
        } else if (viewType === "rx") {
          await updateRxSaleOrderStatus(o._id, targetStatus);
        } else if (viewType === "contact") {
          await updateContactLensSaleOrderStatus(o._id, targetStatus);
        }
        
        // Refresh the data to show updated status
        await fetchdata();
      } catch (err) {
        console.error("Failed to update status:", err);
        toast.error("Status updated partially - please refresh page");
      }
      
      // Clear selection
      setSelectedItemsByOrder(prev => ({
        ...prev,
        [o._id]: []
      }));
    } else {
      // Enhanced error message with details
      const errorMsg = res.details ? `${res.message}: ${res.details}` : res.message || "Failed to create challan";
      console.error('🔴 Challan creation failed:', errorMsg);
      toast.error(errorMsg);
    }
  };

  const handlePurchaseFromSaleOrder = (o) => {
    const idStr = String(o._id);
    const selectedIds = selectedItemsByOrder[idStr] || [];

    if (selectedIds.length === 0) {
      toast.error("Please select items to purchase");
      return;
    }

    const selectedItems = (o.items || []).filter((it) =>
      selectedIds.includes(it._id)
    );

    // Filter items that aren't already purchased/completed if needed, 
    // but here we just follow user's request to populate all selected.

    // Pick the first vendor mentioned in items, or empty
    const firstVendor = selectedItems.find(it => it.vendor)?.vendor || "";

    const itemsForPurchase = selectedItems.map((it) => ({
      productName: it.itemName,
      qty: it.qty,
      eye: it.eye,
      sph: it.sph,
      cyl: it.cyl,
      axis: it.axis,
      add: it.add,
      importDate: it.importDate || "",
      expiryDate: it.expiryDate || "",
      purchasePrice: it.purchasePrice || 0,
      salePrice: it.salePrice || 0,
      barcode: it.barcode || "",
      orderNo: o.billData?.billNo || o.billNo || "",
      combinationId: it.combinationId || "",
      saleOrderItemId: it._id
    }));

    let targetUrl;
    if (viewType === 'rx') {
      targetUrl = "/rxtransaction/rxpurchase/addRxPurchase";
    } else if (viewType === 'contact') {
      targetUrl = "/contactlens/purchase/addcontactlensorder";
    } else {
      targetUrl = "/lenstransaction/purchase/AddLensPurchaseOrder";
    }

    navigate(targetUrl, {
      state: {
        items: itemsForPurchase,
        vendor: firstVendor,
        sourceSaleId: idStr, // Pass sourceSaleId
        billData: {
          godown: o.billData?.godown || "HO",
          bookedBy: o.billData?.bookedBy || "",
        },
        remark: o.remark || ""
      }
    });

    toast.success(`Redirecting to ${viewType === 'rx' ? 'Rx ' : viewType === 'contact' ? 'Contact Lens ' : 'Lens '}Purchase Order...`);
  };

  // Bulk Order Handlers
  const handleToggleItemSelection = (item, isChecked) => {
    if (isChecked) {
      setSelectedItems((prev) => {
        if (!prev.find((i) => i._id === item._id)) {
          return [...prev, item];
        }
        return prev;
      });
    } else {
      setSelectedItems((prev) => prev.filter((i) => i._id !== item._id));
    }
  };

  const handleSelectAll = (items, isChecked) => {
    if (isChecked) {
      const newItems = items.filter((item) => !item.isInvoiced && !item.isChallaned);
      setSelectedItems((prev) => {
        const combined = [...prev];
        newItems.forEach((item) => {
          if (!combined.find((i) => i._id === item._id)) {
            combined.push(item);
          }
        });
        return combined;
      });
    } else {
      setSelectedItems([]);
    }
  };

  const handleBulkAddToOrder = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    try {
      // Create a new sale order with selected items
      const payload = {
        billData: {
          billSeries: "",
          billNo: "",
          date: new Date(),
        },
        partyData: {
          partyAccount: "",
          phone: "",
          address: "",
        },
        items: selectedItems?.map((item) => ({
          itemName: item.itemName,
          sph: item.sph,
          cyl: item.cyl,
          axis: item.axis,
          qty: item.qty || 1,
          salePrice: item.salePrice || 0,
          totalAmount: roundAmount((item.qty || 1) * (item.salePrice || 0)),
        })),
        subtotal: roundAmount(selectedItems?.reduce((sum, item) => sum + ((item.qty || 1) * (item.salePrice || 0)), 0)),
        taxesAmount: 0,
        netAmount: roundAmount(selectedItems?.reduce((sum, item) => sum + ((item.qty || 1) * (item.salePrice || 0)), 0)),
        paidAmount: 0,
        dueAmount: roundAmount(selectedItems?.reduce((sum, item) => sum + ((item.qty || 1) * (item.salePrice || 0)), 0)),
        status: "Pending",
      };

      toast.success(`${selectedItems?.length} item(s) ready for bulk order. Complete details in order form.`);
      setSelectedItems([]);
      setBulkOrderModal(false);
      // Navigate to create new order with these items
      navigate(`/lenstransaction/sale/AddLensSaleOrder`, { state: { bulkItems: payload.items } });
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to process bulk order");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems?.length === 0) {
      toast.error("Please select items to delete");
      return;
    }

    if (!window.confirm(`Delete ${selectedItems?.length} selected item(s)? This action cannot be undone.`)) {
      return;
    }

    toast.success(`${selectedItems?.length} item(s) marked for deletion.`);
    setSelectedItems([]);
    setBulkOrderModal(false);
  };

  const handleBulkClear = () => {
    setSelectedItems([]);
    toast.info("Selection cleared");
  };

  const formatToDDMMYYYY = (date) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTimeTo12h = (timeStr, dateObj) => {
    if (timeStr) return timeStr;
    if (!dateObj) return "-";
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).toLowerCase();
  };



  // Checkbox handlers
  const handleToggleItem = (orderId, itemId, isChecked) => {
    setSelectedItemsByOrder((prev) => {
      const currentSelected = prev[orderId] || [];
      if (isChecked) {
        if (!currentSelected.includes(itemId)) {
          return { ...prev, [orderId]: [...currentSelected, itemId] };
        }
      } else {
        return {
          ...prev,
          [orderId]: currentSelected.filter((id) => id !== itemId),
        };
      }
      return prev;
    });
  };

  const handleSelectAllItems = (orderId, items, isChecked) => {
    setSelectedItemsByOrder((prev) => {
      if (isChecked) {
        return { ...prev, [orderId]: items.map((item) => item._id) };
      } else {
        return { ...prev, [orderId]: [] };
      }
    });
  };

  // Status handler
  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === "Cancelled") {
      setCancelModal({
        isOpen: true,
        orderId,
        reason: "",
        status: newStatus
      });
      return;
    }

    setUpdatingStatusId(orderId);
    try {
      let res;
      if (viewType === "lens") {
        res = await updateSaleOrderStatus(orderId, newStatus);
      } else if (viewType === "rx") {
        res = await updateRxSaleOrderStatus(orderId, newStatus);
      } else if (viewType === "contact") {
        res = await updateContactLensSaleOrderStatus(orderId, newStatus);
      }
      if (res.success) {
        // Update the local state
        setSaleOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
        toast.success(`Status updated to ${newStatus}`);
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err) {
      toast.error("Error updating status");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const confirmCancel = async () => {
    const { orderId, reason, status } = cancelModal;
    setUpdatingStatusId(orderId);
    setCancelModal({ ...cancelModal, isOpen: false });

    try {
      let res;
      if (viewType === "lens") {
        res = await updateSaleOrderStatus(orderId, status, reason);
      } else if (viewType === "rx") {
        res = await updateRxSaleOrderStatus(orderId, status, reason);
      } else if (viewType === "contact") {
        res = await updateContactLensSaleOrderStatus(orderId, status, reason);
      }

      if (res.success) {
        setSaleOrders(prev => prev.map(o => o._id === orderId ? { ...o, status, cancelReason: reason } : o));
        toast.success(`Order Cancelled with reason: ${reason}`);
      } else {
        toast.error(res.error || "Failed to cancel order");
      }
    } catch (err) {
      toast.error("Error cancelling order");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Booked By handler with debounce
  const handleBookedByChange = (orderId, value) => {
    // Update local state immediately for responsive UI
    setBookedByValues((prev) => ({ ...prev, [orderId]: value }));

    // Clear existing timer for this order
    if (bookedByTimers.current[orderId]) {
      clearTimeout(bookedByTimers.current[orderId]);
    }

    // Set new timer to save after 1 second of inactivity
    bookedByTimers.current[orderId] = setTimeout(async () => {
      try {
        let res;
        if (viewType === "lens") {
          res = await updateSaleOrderBookedBy(orderId, value);
        } else if (viewType === "rx") {
          res = await updateRxSaleOrderBookedBy(orderId, value);
        } else if (viewType === "contact") {
          res = await updateContactLensSaleOrderBookedBy(orderId, value);
        }

        if (res.success) {
          // Update the local state with the response
          setSaleOrders((prevOrders) =>
            prevOrders.map((order) =>
              order._id === orderId
                ? { ...order, billData: { ...order.billData, bookedBy: value } }
                : order
            )
          );
          toast.success("Booked By updated successfully");
        } else {
          toast.error(res.error || "Failed to update Booked By");
        }
      } catch (err) {
        toast.error("Error updating Booked By");
      }
    }, 1000);
  };

  // Vendor handler with debounce
  const handleVendorChange = (orderId, value) => {
    setVendorValues((prev) => ({ ...prev, [orderId]: value }));

    if (vendorTimers.current[orderId]) {
      clearTimeout(vendorTimers.current[orderId]);
    }

    vendorTimers.current[orderId] = setTimeout(async () => {
      try {
        let res;
        if (viewType === "lens") {
          res = await updateSaleOrderVendor(orderId, value);
        } else if (viewType === "rx") {
          res = await updateRxSaleOrderVendor(orderId, value);
        } else if (viewType === "contact") {
          res = await updateContactLensSaleOrderVendor(orderId, value);
        }

        if (res?.success) {
          setSaleOrders((prevOrders) =>
            prevOrders.map((order) =>
              order._id === orderId
                ? {
                  ...order,
                  items: Array.isArray(order.items)
                    ? order.items.map((it) => ({ ...it, vendor: value }))
                    : order.items,
                }
                : order
            )
          );
          toast.success("Vendor updated successfully");
        } else {
          toast.error(res?.error || "Failed to update vendor");
        }
      } catch (err) {
        toast.error("Error updating vendor");
      }
    }, 800);
  };

  const handleUpdateItemRemark = async (orderId, itemId, remark) => {
    try {
      let res;
      if (viewType === "lens") {
        res = await updateLensItemRemark(orderId, itemId, remark);
      } else if (viewType === "rx") {
        res = await updateRxItemRemark(orderId, itemId, remark);
      } else if (viewType === "contact") {
        res = await updateContactLensItemRemark(orderId, itemId, remark);
      }

      if (res?.success) {
        setSaleOrders((prev) =>
          prev.map((order) => {
            if (order._id === orderId) {
              const updatedItems = order.items.map((it) =>
                String(it._id) === String(itemId) ? { ...it, remark } : it
              );
              return { ...order, items: updatedItems };
            }
            return order;
          })
        );
        toast.success("Remark updated");
      } else {
        toast.error(res?.error || "Failed to update remark");
      }
    } catch (err) {
      toast.error("Error updating remark");
    }
  };

  const handleItemStatusChange = async (orderId, itemId, newStatus) => {
    try {
      const res = await updateLensItemStatus(orderId, [itemId], newStatus);
      if (res.success) {
        setSaleOrders(prev => prev.map(order => {
          if (order._id === orderId) {
            const updatedItems = order.items.map(it =>
              String(it._id) === String(itemId) ? { ...it, itemStatus: newStatus } : it
            );
            return {
              ...order,
              items: updatedItems,
              status: res.data.data.status // Use status returned from backend (derived)
            };
          }
          return order;
        }));
        toast.success("Item status updated");
      } else {
        toast.error(res.error || "Failed to update item status");
      }
    } catch (err) {
      toast.error("Error updating item status");
    }
  };

  const handleWhatsAppShare = async (order) => {
    try {
      const partyData = order.partyData || {};
      const items = order.items || [];

      let message = `*Order Details*\n`;
      message += `*Party:* ${partyData.partyAccount || 'N/A'}\n`;
      message += `*Bill No:* ${order.billData?.billSeries || ''}${order.billData?.billNo || ''}\n`;
      message += `*Date:* ${new Date(order.billData?.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}\n\n`;

      message += `*Items:*\n`;
      items.forEach((item, index) => {
        message += `${index + 1}. ${item.itemName} (${item.qty} ${item.unit || 'pcs'})\n`;
        if (item.sph || item.cyl || item.axis || item.add) {
          message += `   SPH: ${item.sph || 0}, CYL: ${item.cyl || 0}, AXIS: ${item.axis || 0}, ADD: ${item.add || 0}\n`;
        }
      });

      message += `\n*Net Amount:* ₹${roundAmount(order.netAmount || 0)}`;

      const encodedMessage = encodeURIComponent(message);
      const rawPhoneNumber = partyData.contactNumber || partyData.mobile || "";
      let phoneNumber = rawPhoneNumber.replace(/[^0-9]/g, '');

      // If it's a 10-digit number, prepend 91 (India country code) for WhatsApp compatibility
      if (phoneNumber.length === 10) {
        phoneNumber = "91" + phoneNumber;
      }

      const whatsappUrl = phoneNumber
        ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      window.open(whatsappUrl, '_blank');

      // Open mandatory modal for confirmation
      setWhatsappModal({
        isOpen: true,
        order: order
      });
    } catch (err) {
      console.error("WhatsApp share error:", err);
      toast.error("Failed to share via WhatsApp");
    }
  };

  const triggerPartialWhatsApp = (order, deliveredCount, pendingItems) => {
    try {
      const partyData = order.partyData || {};
      const rawPhoneNumber = partyData.contactNumber || partyData.mobile || "";
      let phoneNumber = rawPhoneNumber.replace(/[^0-9]/g, '');

      if (!phoneNumber) return; // Case: Phone number missing

      if (phoneNumber.length === 10) {
        phoneNumber = "91" + phoneNumber;
      }

      let message = `Hello ${partyData.partyAccount || 'Customer'},\n\n`;
      message += `Your order has been partially dispatched.\n\n`;
      message += `Delivered Items: ${deliveredCount}\n`;
      message += `Pending Items: ${pendingItems.length}\n\n`;
      message += `*Pending Item Details:*\n`;

      pendingItems.forEach((item, index) => {
        message += `${index + 1}. ${item.itemName || 'Item'}\n`;
        if (item.orderNo) message += `   Order No: ${item.orderNo}\n`;
        if (item.eye) message += `   Eye: ${item.eye}\n`;
        message += `   Power: SPH ${item.sph || 0} / CYL ${item.cyl || 0} / Axis ${item.axis || 0} / Add ${item.add || 0}\n`;
        message += `   Qty: ${item.qty || 0}\n`;
        message += `   Price: ₹${roundAmount(item.salePrice || 0)}\n`;
        if (item.remark) message += `   Remark: ${item.remark}\n`;
        message += `\n`;
      });

      message += `The remaining item(s) will be dispatched shortly.\n\n`;
      message += `Thank you.`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

      window.open(whatsappUrl, '_blank');
    } catch (err) {
      console.error("WhatsApp partial trigger error:", err);
    }
  };

  const handleConfirmWhatsAppPlaced = async () => {
    const { order } = whatsappModal;
    if (!order) return;

    try {
      let res;
      if (viewType === 'lens') {
        res = await updateLensOrderPlacementStatus(order._id, true);
      } else if (viewType === 'rx') {
        res = await updateRxOrderPlacementStatus(order._id, true);
      } else if (viewType === 'contact') {
        res = await updateContactOrderPlacementStatus(order._id, true);
      }

      if (res?.success) {
        // Update state manually to ensure UI reflects changes immediately
        setSaleOrders(prev => prev.map(o => {
          if (o._id === order._id) {
            return {
              ...o,
              isOrderPlaced: true,
              status: 'In Progress',
              orderPlacedAt: new Date().toISOString()
            };
          }
          return o;
        }));
        toast.success("Order marked as placed");
        // Refresh data from server to keep everything in sync
        fetchdata();
      } else {
        toast.error(res?.message || "Failed to update placement status");
      }
    } catch (updateErr) {
      console.error("Update error:", updateErr);
      toast.error("Error updating order status");
    } finally {
      setWhatsappModal({ isOpen: false, order: null });
    }
  };

  const handleUpdateItemOrderNo = async (orderId, itemId, newOrderNo) => {
    try {
      let res;
      if (viewType === 'lens') {
        res = await ApiClient.patch(`/lensSaleOrder/updateItemOrderNo/${orderId}`, { itemId, orderNo: newOrderNo });
      } else if (viewType === 'rx') {
        res = await ApiClient.patch(`/rxSaleOrder/updateItemOrderNo/${orderId}`, { itemId, orderNo: newOrderNo });
      } else if (viewType === 'contact') {
        res = await ApiClient.patch(`/contactLensSaleOrder/updateItemOrderNo/${orderId}`, { itemId, orderNo: newOrderNo });
      }

      if (res?.data?.success) {
        setSaleOrders(prev => prev.map(order => {
          if (order._id === orderId) {
            return {
              ...order,
              items: order.items.map(it =>
                String(it._id) === String(itemId) ? { ...it, orderNo: newOrderNo } : it
              )
            };
          }
          return order;
        }));
        toast.success("Order No updated");
      } else {
        toast.error(res?.data?.message || "Failed to update Order No");
      }
    } catch (err) {
      console.error("Error updating item order no:", err);
      toast.error("Error updating Order No");
    }
  };

  // Print Handlers
  const getPrintItemName = (item) => {
    if (item.billItemName && item.billItemName.trim() !== "") return item.billItemName;
    
    // Fallback to lookup in allLenses (for lenses)
    const foundLens = allLenses.find(l => 
      String(l.productName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundLens?.billItemName) return foundLens.billItemName;

    // Fallback to lookup in allItems (for frames, contact lenses, etc.)
    const foundItem = allItems.find(i => 
      String(i.itemName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundItem?.billItemName) return foundItem.billItemName;

    return item.itemName || "-";
  };

  const handleNormalPrint = (order) => {
    const typeLabel = viewType === "rx" ? "RX SALE ORDER" : viewType === "contact" ? "CONTACT LENS SALE ORDER" : "SALE ORDER";
    const billSeries = order.billData?.billSeries || "";
    const billNo = order.billData?.billNo || "";
    const partyName = order.partyData?.partyAccount || "-";
    const address = order.partyData?.address || "-";
    const state = order.partyData?.stateCode || order.partyData?.state || "-";
    const phone = order.partyData?.contactNumber || order.partyData?.phone || "-";
    const prevBalance = roundAmount(order.partyData?.prevBalance || 0);
    const date = order.billData?.date
      ? new Date(order.billData.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "-";

    const itemsHTML = (order.items || []).map((item, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="font-weight:bold">${getPrintItemName(item)}</td>
        <td style="text-align:center">${item.orderNo || item.refId || "-"}</td>
        <td style="text-align:center">${item.eye || "-"}</td>
        <td style="text-align:center; font-family: monospace;">${item.sph || "-"}</td>
        <td style="text-align:center; font-family: monospace;">${item.cyl || "-"}</td>
        <td style="text-align:center; font-family: monospace;">${item.axis || "-"}</td>
        <td style="text-align:center; font-family: monospace;">${item.add || "-"}</td>
        <td style="text-align:center; font-weight:bold">${item.qty || 0}</td>
        <td style="text-align:right">₹${roundAmount(item.salePrice || 0)}</td>
        <td style="text-align:right">${item.discount || 0}%</td>
        <td style="text-align:right; font-weight:bold">₹${roundAmount(item.totalAmount || 0)}</td>
      </tr>
    `).join("");

    const netAmountValue = order.netAmount || 0;
    const words = numberToWords(netAmountValue);
    const netPayable = roundAmount(Number(order.dueAmount || 0) + Number(order.partyData?.prevBalance || 0));

    const printWindow = window.open("", "_blank", "height=800,width=950");
    printWindow.document.write(`
      <html>
        <head>
          <title>${typeLabel} ${billSeries}-${billNo}</title>
          <style>
            @page { margin: 8mm; size: A4; }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              padding: 0; margin: 0; 
              color: #1e293b; 
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-container { padding: 10px; position: relative; }
            
            /* Header */
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 20px; }
            .header-info { text-align: center; flex: 1; }
            .header-info h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }

            /* Top Info Grid */
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 13px; line-height: 1.6; }
            .party-details { flex: 1.2; }
            .bill-details { flex: 0.8; text-align: right; }
            .info-row { display: flex; margin-bottom: 2px; }
            .info-label { font-weight: 800; width: 100px; display: inline-block; }
            .info-val { flex: 1; }

            /* Table Styles */
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px; }
            th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 6px 4px; text-align: center; text-transform: uppercase; font-weight: 800; font-size: 10px; }
            td { border: 1px solid #94a3b8; padding: 7px 5px; vertical-align: middle; }
            .total-row { background: #f8fafc; font-weight: 800; border-top: 2px solid #334155; }

            /* Footer Section */
            .footer-section { display: flex; justify-content: space-between; margin-top: 20px; font-size: 13px; }
            .words-tc { flex: 1.2; }
            .payment-summary { flex: 0.8; border-left: 1px solid #e2e8f0; padding-left: 25px; }
            
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .summary-label { font-weight: 700; color: #64748b; }
            .summary-val { font-weight: 700; }
            .net-payable-row { margin-top: 15px; padding-top: 8px; border-top: 1.5px solid #334155; font-size: 18px; font-weight: 900; }

            .tc-box { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            .tc-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 5px; }
            .tc-text { font-size: 10px; color: #64748b; font-style: italic; line-height: 1.4; }

            /* Signatures */
            .sig-section { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 20px; }
            .sig-box { text-align: center; }
            .sig-line { border-bottom: 1px solid #334155; width: 160px; margin-bottom: 6px; }
            .sig-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="header">
              <img src="/sadguru_logo.svg" alt="Logo" style="width:120px; height:auto;" />
              <div class="header-info">
                <h1>SALE ORDER</h1>
              </div>
              <div style="width:120px;"></div>
            </div>

            <div class="info-grid">
              <div class="party-details">
                <div class="info-row"><span class="info-label">Party Name</span><span class="info-val">: <strong>${partyName}</strong></span></div>
                <div class="info-row"><span class="info-label">Address</span><span class="info-val">: ${address}</span></div>
                <div class="info-row"><span class="info-label">State</span><span class="info-val">: ${state}</span></div>
                <div class="info-row"><span class="info-label">Phone</span><span class="info-val">: ${phone}</span></div>
              </div>
              <div class="bill-details">
                <div class="info-row"><span class="info-label" style="width:120px">Bill Series</span><span class="info-val">: ${billSeries}</span></div>
                <div class="info-row"><span class="info-label" style="width:120px">Bill No</span><span class="info-val">: ${billNo}</span></div>
                <div class="info-row"><span class="info-label" style="width:120px">Date</span><span class="info-val">: ${date}</span></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width:30px">SR</th>
                  <th style="text-align:left">ITEM NAME</th>
                  <th>ORDER NO</th>
                  <th>EYE</th>
                  <th>SPH</th>
                  <th>CYL</th>
                  <th>AXIS</th>
                  <th>ADD</th>
                  <th>QTY</th>
                  <th style="text-align:right">PRICE</th>
                  <th>DISC</th>
                  <th style="text-align:right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
                <tr class="total-row">
                  <td colspan="2" style="text-align:center">TOTAL</td>
                  <td colspan="6"></td>
                  <td style="text-align:center">${order.items?.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)}</td>
                  <td colspan="2"></td>
                  <td style="text-align:right">₹${roundAmount(order.subtotal || 0)}</td>
                </tr>
              </tbody>
            </table>

            <div class="footer-section">
              <div class="words-tc">
                <p style="font-size:10px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Total Invoice Value (In Words):</p>
                <p style="font-size:15px; font-weight:900; font-style:italic;">${words}</p>
                
                <div class="tc-box">
                  <p class="tc-title">Terms & Condition</p>
                  <p class="tc-text">
                    We declare that this invoice shows the actual price of the goods described<br/>
                    and that all particulars are true and correct.
                  </p>
                </div>
              </div>

              <div class="payment-summary">
                <div class="summary-row"><span class="summary-label">Total Amount</span><span class="summary-val">${roundAmount(order.netAmount || 0)}</span></div>
                <div class="summary-row"><span class="summary-label">Paid Amt</span><span class="summary-val">${roundAmount(order.paidAmount || 0)}</span></div>
                <div class="summary-row" style="color:#ef4444;"><span class="summary-label" style="color:#ef4444;">Due Amt</span><span class="summary-val">${roundAmount(order.dueAmount || 0)}</span></div>
                <div class="summary-row"><span class="summary-label">Prev.Bal</span><span class="summary-val">${prevBalance}</span></div>
                <div class="summary-row net-payable-row">
                  <span>Net Payable</span>
                  <span>₹${netPayable}</span>
                </div>
              </div>
            </div>

            <div class="sig-section">
              <div class="sig-box">
                <div class="sig-line"></div>
                <p class="sig-title">Customer Sign</p>
              </div>
              <div class="sig-box">
                <p style="font-size:12px; font-weight:900; margin-bottom:45px;">For, Sadguru Opticals</p>
                <div class="sig-line" style="width:200px;"></div>
                <p class="sig-title">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleBarcodePrint = (order) => {
    setPrintData(order);
    setPrintModal("barcode");
  };

  const handleCardPrint = (order) => {
    setPrintData(order);
    setPrintModal("card");
  };

  const executePrint = () => {
    if (printModal === "barcode") {
      printBarcodeStickers(printData, allLenses, allItems);
    } else if (printModal === "card") {
      printAuthenticityCard(printData, allLenses, allItems);
    } else if (printModal === "normal") {
       handleNormalPrint(printData);
    } else {
      window.print();
    }
  };

  const closePrintModal = () => {
    setPrintModal(null);
    setPrintData(null);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Sale Orders
            </h1>
            <p className="text-slate-600">Manage sales orders and deliveries</p>
          </div>

          {/* Toggle View Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-w-4xl mt-4">
            <div
              onClick={() => setViewType("lens")}
              className={`cursor-pointer p-3 rounded-xl border transition flex items-center gap-3
        ${viewType === "lens"
                  ? "border-blue-600 bg-blue-50 shadow ring-1 ring-blue-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <div
                className={`p-2 rounded-lg ${viewType === "lens" ? "bg-blue-200 text-blue-700" : "bg-slate-100 text-slate-500"}`}
              >
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Lens Sale Order
                </p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                  Standard Lens Orders
                </p>
              </div>
            </div>

            <div
              onClick={() => setViewType("rx")}
              className={`cursor-pointer p-3 rounded-xl border transition flex items-center gap-3
        ${viewType === "rx"
                  ? "border-purple-600 bg-purple-50 shadow ring-1 ring-purple-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <div
                className={`p-2 rounded-lg ${viewType === "rx" ? "bg-purple-200 text-purple-700" : "bg-slate-100 text-slate-500"}`}
              >
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Rx Sale Order
                </p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                  Prescription Orders
                </p>
              </div>
            </div>

            <div
              onClick={() => setViewType("contact")}
              className={`cursor-pointer p-3 rounded-xl border transition flex items-center gap-3
        ${viewType === "contact"
                  ? "border-emerald-600 bg-emerald-50 shadow ring-1 ring-emerald-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <div
                className={`p-2 rounded-lg ${viewType === "contact" ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Contact Lens & Solution
                </p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                  Contact Lens Orders
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Bill Series, Party Name..."
                value={filters.billSeries}
                onChange={(e) =>
                  handleFilterChange("billSeries", e.target.value)
                }
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm bg-white"
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
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Date From
              </label>
            </div>

            <div className="relative">
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Date To
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleAddOrder}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors duration-200 ${viewType === "lens" ? "bg-blue-600 hover:bg-blue-700" : viewType === "rx" ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add {viewType === "lens" ? "Lens" : viewType === "rx" ? "Rx" : "Contact Lens"} Sale Order
            </button>
            {/* {viewType === "lens" && (
              <button
                onClick={() => navigate("/lenstransaction/sale/AddLensSaleOrder?bulk=true")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors duration-200 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Bulk Add Lens Order
              </button>
            )} */}



            {/* Column Filter Dropdown */}
            <div className="relative" ref={columnFilterRef}>
              <button
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors duration-200 shadow-sm"
              >
                <Columns className="w-3.5 h-3.5" />
                Columns
              </button>

              {showColumnFilter && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in zoom-in duration-200">
                  <div className="px-3 py-1 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toggle Columns</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto px-1">
                    {ALL_COLUMNS.map((col) => {
                      const isVisibleForView = !col.viewSpecific || col.viewSpecific === viewType;
                      if (!isVisibleForView) return null;

                      return (
                        <div
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
                        >
                          <span className={`text-sm ${visibleColumns[col.id] ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
                            {col.label}
                          </span>
                          {visibleColumns[col.id] && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-2 mt-2 pt-2 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => {
                        const allOn = {};
                        ALL_COLUMNS.forEach(c => allOn[c.id] = true);
                        setVisibleColumns(allOn);
                      }}
                      className="flex-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 py-1.5 rounded-md uppercase"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => {
                        const allOff = {};
                        ALL_COLUMNS.forEach(c => allOff[c.id] = false);
                        setVisibleColumns(allOff);
                      }}
                      className="flex-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 py-1.5 rounded-md uppercase"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="relative" ref={statusFilterRef}>
              <button
                onClick={() => setShowStatusFilter(!showStatusFilter)}
                className={`p-2 rounded-lg transition-colors duration-200 hover:shadow-sm flex items-center gap-2 ${showStatusFilter ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                title="Filter Status"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Status</span>
                {selectedStatuses.length < STATUS_OPTIONS.length && (
                  <span className="flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-600 text-[10px] rounded-full font-bold">
                    {selectedStatuses.length}
                  </span>
                )}
              </button>

              {showStatusFilter && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in zoom-in duration-200">
                  <div className="px-3 py-1 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter Status</p>
                  </div>
                  <div className="px-1">
                    {STATUS_OPTIONS.map((status) => (
                      <div
                        key={status}
                        onClick={() => {
                          setSelectedStatuses(prev => 
                            prev.includes(status) 
                              ? prev.filter(s => s !== status) 
                              : [...prev, status]
                          );
                        }}
                        className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
                      >
                        <span className={`text-sm ${selectedStatuses.includes(status) ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
                          {status}
                        </span>
                        {selectedStatuses.includes(status) && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                    ))}
                  </div>
                  <div className="px-2 mt-2 pt-2 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => setSelectedStatuses(STATUS_OPTIONS)}
                      className="flex-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 py-1.5 rounded-md uppercase"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedStatuses([])}
                      className="flex-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 py-1.5 rounded-md uppercase"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-16 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                    Sr
                  </th>
                  {visibleColumns.date && (
                    <th className="w-28 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Date
                    </th>
                  )}
                  {visibleColumns.time && (
                    <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Time
                    </th>
                  )}
                  {visibleColumns.series && (
                    <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Series
                    </th>
                  )}
                  {visibleColumns.billNo && (
                    <th className="w-24 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      No.
                    </th>
                  )}
                  {visibleColumns.partyName && (
                    <th className="w-48 text-left py-4 px-2 text-slate-700 font-bold text-sm">
                      Party Name
                    </th>
                  )}
                  {viewType === "contact" && (
                    <>
                      {visibleColumns.importDate && (
                        <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">Import Date</th>
                      )}
                      {visibleColumns.expiryDate && (
                        <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">Expiry Date</th>
                      )}
                      {visibleColumns.mrp && (
                        <th className="w-24 text-right py-4 px-2 text-slate-700 font-bold text-sm">MRP</th>
                      )}
                    </>
                  )}
                  {visibleColumns.netAmt && (
                    <th className="w-28 text-right py-4 px-2 text-slate-700 font-bold text-sm">
                      Net Amt
                    </th>
                  )}
                  {visibleColumns.usedIn && (
                    <th className="w-28 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Used in
                    </th>
                  )}
                  {visibleColumns.bookedBy && (
                    <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Booked By
                    </th>
                  )}
                  {visibleColumns.refNo && (
                    <th className="w-40 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Ref No.
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th className="w-24 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Status
                    </th>
                  )}
                  {selectedStatuses.includes("Cancelled") && (
                    <th className="w-64 text-left py-4 px-2 text-slate-700 font-bold text-sm">
                      Reason
                    </th>
                  )}
                  {visibleColumns.ordQty && (
                    <th className="w-16 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Ord Q
                    </th>
                  )}
                  {visibleColumns.usedQty && (
                    <th className="w-16 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Used Q
                    </th>
                  )}
                  {visibleColumns.balQty && (
                    <th className="w-16 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Bal Q
                    </th>
                  )}
                  {visibleColumns.marginBeforeGst && (
                    <th className="w-28 text-right py-4 px-2 text-slate-700 font-bold text-sm">
                      Margin (Before GST)
                    </th>
                  )}
                  {visibleColumns.marginAfterGst && (
                    <th className="w-28 text-right py-4 px-2 text-slate-700 font-bold text-sm">
                      Margin (After GST)
                    </th>
                  )}
                  {visibleColumns.margin && (
                    <th className="w-28 text-right py-4 px-2 text-slate-700 font-bold text-sm">
                      Product Margin
                    </th>
                  )}
                  {visibleColumns.vendor && (
                    <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Vendor
                    </th>
                  )}
                  {visibleColumns.placeOrd && (
                    <th className="w-24 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                      Place Ord
                    </th>
                  )}
                  <th className="w-40 text-center py-4 px-2 text-slate-700 font-bold text-sm">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeVisibleCount}
                      className="p-10 text-center text-slate-500"
                    >
                      <p className="text-xl">No orders found</p>
                      <p className="text-md">
                        Try adjusting your search criteria
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o, i) => {
                    const idStr = String(o._id);
                    const billDate = o?.billData?.date;
                    const orderTime = o?.billData?.time || o?.time;
                    const series =
                      o?.billData?.billSeries || o?.billSeries || "-";
                    const billNo = o?.billData?.billNo || o?.billNo || "-";
                    const partyName = o?.partyData?.partyAccount || "-";
                    const netAmt = Number(o?.netAmount ?? 0);
                    const paidAmt = Number(o?.paidAmount ?? 0);
                    const dueAmt = Number(o?.dueAmount ?? 0);

                    const isDone = (o.status || "").toLowerCase() === "done";
                    const isCancelled = (o.status || "").toLowerCase() === "cancelled";
                    const hasLinkedDoc = Array.isArray(o.usedIn) && o.usedIn.some(u => 
                      u.type?.toLowerCase().includes('challan') || 
                      u.type?.toLowerCase().includes('invoice') ||
                      u.type?.toLowerCase() === 'sc' ||
                      u.type?.toLowerCase() === 'si' ||
                      u.type?.toLowerCase() === 'p' ||
                      u.type?.toLowerCase() === 'po' ||
                      u.type?.toLowerCase() === 'rpo'
                    );
                    
                    // Threshold logic for highlighting from Report Settings
                    const threshold = parseInt(localStorage.getItem('orderThreshold') || '30');
                    const orderCreatedAt = new Date(o.createdAt);
                    const diffMin = Math.floor((currentTime - orderCreatedAt) / (1000 * 60));
                    const isDelayed = !isDone && !isCancelled && !hasLinkedDoc && diffMin > threshold;

                    return (
                      <React.Fragment key={idStr}>
                        <tr className={`hover:bg-slate-50 transition-colors duration-150 group text-sm ${isDone ? "bg-slate-50/50" : ""} ${isDelayed ? "bg-red-50 hover:bg-red-100" : ""}`}>
                          <td className="py-4 px-2 text-center text-slate-600">
                            {i + 1}
                          </td>
                          {visibleColumns.date && (
                            <td className="py-4 px-2 text-center text-slate-800">
                              {formatToDDMMYYYY(billDate)}
                            </td>
                          )}
                          {visibleColumns.time && (
                            <td className="py-4 px-2 text-center text-slate-800 font-medium">
                              {formatTimeTo12h(orderTime, billDate)}
                            </td>
                          )}
                          {visibleColumns.series && (
                            <td className="py-4 px-2 text-center text-slate-800">
                              <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">
                                {series}
                              </span>
                            </td>
                          )}
                          {visibleColumns.billNo && (
                            <td className="py-4 px-2 text-center text-slate-800 font-bold">
                              {billNo}
                            </td>
                          )}
                          {visibleColumns.partyName && (
                            <td
                              className="py-4 px-2 text-left text-slate-700 font-medium truncate max-w-[200px]"
                              title={partyName}
                            >
                              {partyName}
                            </td>
                          )}
                          {viewType === "contact" && (
                            <>
                              {visibleColumns.importDate && (
                                <td className="py-4 px-2 text-center text-slate-800">
                                  {formatToDDMMYYYY(o.items?.[0]?.importDate)}
                                </td>
                              )}
                              {visibleColumns.expiryDate && (
                                <td className="py-4 px-2 text-center text-slate-800">
                                  {formatToDDMMYYYY(o.items?.[0]?.expiryDate)}
                                </td>
                              )}
                              {visibleColumns.mrp && (
                                <td className="py-4 px-2 text-right text-slate-900 font-semibold">
                                  {formatPrice(o.items?.[0]?.mrp)}
                                </td>
                              )}
                            </>
                          )}
                          {visibleColumns.netAmt && (
                            <td className="py-4 px-2 text-right text-slate-900 font-bold">
                              {formatPrice(netAmt)}
                            </td>
                          )}
                          {visibleColumns.usedIn && (
                            <td className="py-4 px-2 text-center text-slate-800 text-[10px] font-bold">
                              {Array.isArray(o.usedIn) && o.usedIn.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {o.usedIn.map((u, idx) => (
                                    <span key={idx} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                      {u.type}({u.number})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                o.chalNO || o.challanNo || "-"
                              )}
                            </td>
                          )}
                          {visibleColumns.bookedBy && (
                            <td className="py-4 px-2 text-center">
                              <input
                                type="text"
                                value={bookedByValues[o._id] || ""}
                                disabled={isDone}
                                onChange={(e) => handleBookedByChange(o._id, e.target.value)}
                                placeholder="Enter name"
                                style={{ width: `calc(${Math.max(String(bookedByValues[o._id] || "").length, 10)}ch + 1rem)` }}
                                className={`px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-center ${isDone ? "bg-slate-100 cursor-not-allowed" : ""}`}
                              />
                            </td>
                          )}
                          {visibleColumns.refNo && (
                            <td className="py-4 px-2 text-center">
                              <input
                                type="text"
                                value={refNoValues[o._id] || ""}
                                disabled={isDone}
                                onChange={(e) =>
                                  handleRefNoChange(o._id, e.target.value)
                                }
                                placeholder="Ref No."
                                style={{ width: `calc(${Math.max(String(refNoValues[o._id] || "").length, 7)}ch + 1rem)` }}
                                className={`px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-center font-bold text-blue-800 ${isDone ? "bg-slate-100 cursor-not-allowed" : ""}`}
                              />
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="py-4 px-2 text-center text-xs">
                              <StatusDropdown
                                currentStatus={o.status || "pending"}
                                isLoading={updatingStatusId === o._id}
                                disabled={isDone}
                                onStatusChange={(newStatus) => !isDone && handleStatusChange(o._id, newStatus)}
                              />
                            </td>
                          )}
                          {selectedStatuses.includes("Cancelled") && (
                            <td className="py-4 px-2 text-left">
                              <textarea
                                value={cancelReasonValues[o._id] !== undefined ? cancelReasonValues[o._id] : (o.cancelReason || "")}
                                onChange={(e) => handleCancelReasonChange(o._id, e.target.value)}
                                onBlur={() => saveCancelReason(o._id)}
                                placeholder="Edit reason..."
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
                                rows={1}
                                onInput={(e) => {
                                  e.target.style.height = 'auto';
                                  e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                style={{ minHeight: '38px' }}
                              />
                            </td>
                          )}
                          {visibleColumns.ordQty && (
                            <td className="py-4 px-2 text-center">
                              <input
                                type="number"
                                value={quantitiesValues[o._id]?.ordQty ?? ""}
                                disabled={isDone}
                                onChange={(e) => handleQuantityChange(o._id, "ordQty", e.target.value)}
                                onBlur={() => saveQuantities(o._id)}
                                style={{ width: `calc(${Math.max(String(quantitiesValues[o._id]?.ordQty ?? "").length, 3)}ch + 2rem)` }}
                                className={`px-1 py-1 text-sm border rounded text-center outline-none focus:border-blue-500 ${isDone ? "bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200" : "border-slate-300"}`}
                              />
                            </td>
                          )}
                          {visibleColumns.usedQty && (
                            <td className="py-4 px-2 text-center">
                              <input
                                type="number"
                                value={quantitiesValues[o._id]?.usedQty ?? ""}
                                disabled={isDone}
                                onChange={(e) => handleQuantityChange(o._id, "usedQty", e.target.value)}
                                onBlur={() => saveQuantities(o._id)}
                                style={{ width: `calc(${Math.max(String(quantitiesValues[o._id]?.usedQty ?? "").length, 3)}ch + 2rem)` }}
                                className={`px-1 py-1 text-sm border rounded text-center outline-none focus:border-blue-500 ${isDone ? "bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200" : "border-slate-300"}`}
                              />
                            </td>
                          )}
                          {visibleColumns.balQty && (
                            <td className="py-4 px-2 text-center">
                              <input
                                type="number"
                                value={quantitiesValues[o._id]?.balQty ?? ""}
                                onChange={(e) => handleQuantityChange(o._id, "balQty", e.target.value)}
                                onBlur={() => saveQuantities(o._id)}
                                style={{ width: `calc(${Math.max(String(quantitiesValues[o._id]?.balQty ?? "").length, 3)}ch + 2rem)` }}
                                className="px-1 py-1 text-sm border border-slate-300 rounded text-center outline-none focus:border-blue-500 bg-slate-50"
                              />
                            </td>
                          )}
                          {visibleColumns.marginBeforeGst && (
                            <td className="py-4 px-2 text-right text-blue-700 font-bold">
                              {formatPrice(calculateMargins(o).beforeGst)}
                            </td>
                          )}
                          {visibleColumns.marginAfterGst && (
                            <td className="py-4 px-2 text-right text-indigo-700 font-bold">
                              {formatPrice(calculateMargins(o).afterGst)}
                            </td>
                          )}
                          {visibleColumns.margin && (
                            <td className="py-4 px-2 text-right text-emerald-700 font-bold">
                              {formatPrice(calculateMargins(o).product)}
                            </td>
                          )}
                          {visibleColumns.vendor && (
                            <td className="py-4 px-2 text-center">
                              <input
                                type="text"
                                value={vendorValues[o._id] || ""}
                                disabled={isDone}
                                onChange={(e) => handleVendorChange(o._id, e.target.value)}
                                placeholder="Vendor"
                                style={{ width: `calc(${Math.max(String(vendorValues[o._id] || "").length, 6)}ch + 1rem)` }}
                                className={`px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-center ${isDone ? "bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200" : "border-slate-300"}`}
                              />
                            </td>
                          )}
                          {visibleColumns.placeOrd && (
                            <td className="py-4 px-2 text-center">
                              {o.isOrderPlaced ? (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Placed
                                  </span>
                                  {o.orderPlacedAt && (
                                    <span className="text-[10px] text-gray-500 mt-0.5" title={new Date(o.orderPlacedAt).toLocaleString()}>
                                      {new Date(o.orderPlacedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Not Placed
                                </span>
                              )}
                            </td>
                          )}
                          <td className="py-4 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleInfo(o._id)}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded"
                                title="Details"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => !isDone && handleEdit(o._id)}
                                disabled={isDone}
                                className={`p-1.5 rounded ${isDone ? "text-slate-300 cursor-not-allowed" : "text-blue-600 hover:bg-blue-50"}`}
                                title={isDone ? "Cannot edit completed order" : "Edit"}
                              >
                                {isDone ? <Grid3X3 className="w-4 h-4 opacity-50" /> : <Pencil className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => !isDone && handleDelete(o._id)}
                                disabled={isDone}
                                className={`p-1.5 rounded ${isDone ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                                title={isDone ? "Cannot delete completed order" : "Delete"}
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => !isDone && handleCreateInvoice(o)}
                                disabled={isDone}
                                className={`p-1.5 rounded ${isDone ? "text-slate-300 cursor-not-allowed" : "text-green-600 hover:bg-green-50"}`}
                                title={isDone ? "Invoice already created/Order completed" : "Create Invoice"}
                              >
                                <Receipt className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleWhatsAppShare(o)}
                                className="p-1.5 text-green-500 hover:bg-green-100 rounded"
                                title="Share via WhatsApp"
                              >
                                <FaWhatsapp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleNormalPrint(o)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                                title="Normal Print"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleBarcodePrint(o)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Barcode Print"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCardPrint(o)}
                                className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded"
                                title="Card Print"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedRow === idStr && (
                          <tr>
                            <td
                              colSpan={activeVisibleCount}
                              className="bg-blue-50 p-6 border-b-2 border-t-2 border-blue-300 shadow-lg"
                            >
                              <div className="bg-white rounded-lg p-4 border border-blue-200">
                                <div className="mb-3 flex justify-between items-center">
                                  <h4 className="font-bold text-slate-700 uppercase text-sm tracking-wider">
                                    📦 Order Details ({o.items?.length || 0}{" "}
                                    items)
                                  </h4>
                                  <div className="flex gap-2">
                                    {(viewType === "lens" || viewType === "rx" || viewType === "contact") && (
                                      <>
                                        {(() => {
                                          const selectedIds = selectedItemsByOrder[idStr] || [];
                                          const itemsToVal = selectedIds.length > 0 
                                            ? (o.items || []).filter(it => selectedIds.includes(it._id))
                                            : (o.items || []).filter(it => it.qty > 0);
                                          const alreadyPurchased = viewType === 'rx' && itemsToVal.length > 0 && itemsToVal.every(it => it.isPurchased || (it.itemStatus && it.itemStatus.toLowerCase() !== "pending"));
                                          const isPurchaseDisabled = isDone || alreadyPurchased;

                                          return (
                                            <button
                                              onClick={() => !isPurchaseDisabled && handlePurchaseFromSaleOrder(o)}
                                              disabled={isPurchaseDisabled}
                                              className={`text-xs px-3 py-1.5 rounded transition flex items-center gap-1 ${
                                                isPurchaseDisabled 
                                                  ? "bg-slate-400 cursor-not-allowed text-white" 
                                                  : "bg-blue-600 text-white hover:bg-blue-700"
                                              }`}
                                              title={isDone ? "Order completed" : alreadyPurchased ? "All selected items already purchased" : "Purchase"}
                                            >
                                              <ShoppingCart className="w-3.5 h-3.5" />
                                              Purchase
                                            </button>
                                          );
                                        })()}
                                        {(() => {
                                          const selectedIds = selectedItemsByOrder[idStr] || [];
                                          const itemsToVal = selectedIds.length > 0 
                                            ? (o.items || []).filter(it => selectedIds.includes(it._id))
                                            : (o.items || []).filter(it => it.qty > 0);
                                          const isPurchasedRestricted = viewType === 'rx' && !isDone && itemsToVal.some(it => !it.isPurchased && (it.itemStatus || "Pending").toLowerCase() === "pending");
                                          const isDisabled = isDone || (viewType === 'rx' && !isDone && isPurchasedRestricted);

                                          return (
                                            <button
                                              onClick={() => !isDisabled && handleCreateChallan(o)}
                                              disabled={isDisabled}
                                              className={`text-xs px-3 py-1.5 rounded transition ${
                                                isDone 
                                                  ? "bg-slate-400 cursor-not-allowed text-white" 
                                                  : isPurchasedRestricted 
                                                    ? "bg-slate-300 cursor-not-allowed text-slate-500 border border-slate-400" 
                                                    : "bg-orange-600 text-white hover:bg-orange-700"
                                              }`}
                                              title={
                                                isDone 
                                                  ? "Order completed" 
                                                  : isPurchasedRestricted 
                                                    ? "Purchase required before creating challan" 
                                                    : "Make Challan"
                                              }
                                            >
                                              Make Challan
                                            </button>
                                          );
                                        })()}
                                        {viewType !== "rx" && (
                                          <button
                                            onClick={() => handleOpenMatrix(o)}
                                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition flex items-center gap-1"
                                          >
                                            <Grid3X3 className="w-3 h-3" /> {isDone ? "View Matrix" : "View in Matrix"}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border-collapse">
                                    <thead className="bg-gradient-to-r from-slate-300 to-slate-200 sticky top-0">
                                      <tr className="border-b-2 border-slate-400">
                                        <th className="p-2 text-left font-bold">
                                          Item Name
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Order No
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Eye
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Sph
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Cyl
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Axis
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Add
                                        </th>
                                        <th className="p-2 text-center font-bold min-w-[150px]">
                                          Remark
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Qty
                                        </th>
                                        {viewType === "contact" && (
                                          <>
                                            <th className="p-2 text-center font-bold">Import Date</th>
                                            <th className="p-2 text-center font-bold">Expiry Date</th>
                                            <th className="p-2 text-center font-bold">MRP</th>
                                            <th className="p-2 text-center font-bold">Vendor</th>
                                          </>
                                        )}
                                        <th className="p-2 text-right font-bold">
                                          Price
                                        </th>
                                        <th className="p-2 text-right font-bold">
                                          Total
                                        </th>
                                        <th className="p-2 text-center font-bold">
                                          Item Status
                                        </th>
                                        <th className="p-2 text-center font-bold w-10">
                                          <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                            disabled={isDone}
                                            onChange={(e) =>
                                              !isDone && handleSelectAllItems(
                                                idStr,
                                                o.items || [],
                                                e.target.checked,
                                              )
                                            }
                                            checked={
                                              (o.items || []).length > 0 &&
                                              (o.items || []).every((item) =>
                                                (
                                                  selectedItemsByOrder[idStr] ||
                                                  []
                                                ).includes(item._id),
                                              )
                                            }
                                          />
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {o.items?.map((it, idx) => {
                                        const isSelected = (
                                          selectedItemsByOrder[idStr] || []
                                        ).includes(it._id);
                                        return (
                                          <tr
                                            key={idx}
                                            className={`border-b border-slate-200 transition-colors ${isSelected ? "bg-blue-100 font-semibold" : "hover:bg-slate-100"}`}
                                          >
                                            <td className="p-2 font-semibold text-slate-700">
                                              {it.itemName || "-"}
                                            </td>
                                            <td className="p-2 text-center font-medium text-blue-700">
                                              <input
                                                type="text"
                                                defaultValue={it.orderNo || ""}
                                                disabled={isDone}
                                                onBlur={(e) => {
                                                  if (!isDone && e.target.value !== it.orderNo) {
                                                    handleUpdateItemOrderNo(o._id, it._id, e.target.value);
                                                  }
                                                }}
                                                onChange={(e) => {
                                                  e.target.style.width = `calc(${Math.max(e.target.value.length, 8)}ch + 1rem)`;
                                                }}
                                                placeholder={isDone ? "" : "Order No"}
                                                style={{ width: `calc(${Math.max(String(it.orderNo || "").length, 8)}ch + 1rem)` }}
                                                className={`bg-transparent text-center border-b border-transparent focus:border-blue-500 focus:outline-none transition-colors font-bold ${isDone ? "cursor-not-allowed opacity-60" : ""}`}
                                              />
                                            </td>
                                            <td className="p-2 text-center font-medium">
                                              {it.eye || "-"}
                                            </td>
                                            <td className="p-2 text-center font-medium">
                                              {it.sph || "-"}
                                            </td>
                                            <td className="p-2 text-center font-medium">
                                              {it.cyl || "-"}
                                            </td>
                                            <td className="p-2 text-center font-medium">
                                              {it.axis || "-"}
                                            </td>
                                            <td className="p-2 text-center font-medium">
                                              {it.add || "-"}
                                            </td>
                                            <td className="p-2 text-center font-medium min-w-[150px]">
                                              <textarea
                                                defaultValue={it.remark || ""}
                                                disabled={isDone}
                                                onBlur={(e) => {
                                                  if (!isDone && e.target.value !== (it.remark || "")) {
                                                    handleUpdateItemRemark(o._id, it._id, e.target.value);
                                                  }
                                                }}
                                                placeholder={isDone ? "" : "Remark"}
                                                className={`bg-transparent text-center border-b border-transparent focus:border-blue-500 focus:outline-none transition-colors w-full resize-none min-h-[1.5rem] overflow-hidden leading-tight ${isDone ? "cursor-not-allowed opacity-60" : ""}`}
                                                onInput={(e) => {
                                                  e.target.style.height = "auto";
                                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                                }}
                                              />
                                            </td>
                                            <td className="p-2 text-center font-bold text-blue-600">
                                              {it.qty || 0}
                                            </td>
                                            {viewType === "contact" && (
                                              <>
                                                <td className="p-2 text-center">{formatToDDMMYYYY(it.importDate)}</td>
                                                <td className="p-2 text-center">{formatToDDMMYYYY(it.expiryDate)}</td>
                                                <td className="p-2 text-center">₹{roundAmount(it.mrp || 0)}</td>
                                                <td className="p-2 text-center font-semibold text-slate-800">{it.vendor || "-"}</td>
                                              </>
                                            )}
                                            <td className="p-2 text-right font-medium">
                                              ₹{roundAmount(it.salePrice || 0)}
                                            </td>
                                            <td className="p-2 text-right font-bold text-slate-700 bg-slate-100">
                                              ₹{roundAmount(it.totalAmount || 0)}
                                            </td>
                                            {viewType === "contact" && <td colSpan={4}></td>}
                                            <td className="p-2 text-center">
                                              <StatusDropdown
                                                currentStatus={it.itemStatus || "Pending"}
                                                disabled={isDone}
                                                onStatusChange={(status) => !isDone && handleItemStatusChange(o._id, it._id, status)}
                                              />
                                            </td>
                                            <td className="p-2 text-center">
                                              <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                                disabled={isDone}
                                                onChange={(e) =>
                                                  !isDone && handleToggleItem(
                                                    idStr,
                                                    it._id,
                                                    e.target.checked,
                                                  )
                                                }
                                                checked={isSelected}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-200 font-bold border-t-2 border-slate-400">
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="p-2 text-right"
                                        >
                                          Order Total:
                                        </td>
                                        <td className="p-2 text-center text-blue-600">
                                          {o.items?.reduce(
                                            (sum, it) => sum + (it.qty || 0),
                                            0,
                                          ) || 0}
                                        </td>
                                        {viewType === "contact" && <td colSpan={4}></td>}
                                        <td
                                          colSpan={viewType === "contact" ? 2 : 2}
                                          className="p-2 text-right"
                                        >
                                          ₹{roundAmount(
                                            o.items?.reduce(
                                              (sum, it) =>
                                                sum + (it.totalAmount || 0),
                                              0,
                                            ) || 0,
                                          )}
                                        </td>
                                        <td></td>
                                        <td></td>
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
              <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                <tr className="border-t-2 border-slate-300">
                  <td
                    colSpan={
                      1 + // Sr
                      ["date", "time", "series", "billNo", "partyName", "importDate", "expiryDate", "mrp"].filter((id) => {
                        const col = ALL_COLUMNS.find((c) => c.id === id);
                        if (!col) return false;
                        const isVisibleForView = !col.viewSpecific || col.viewSpecific === viewType;
                        return isVisibleForView && visibleColumns[id];
                      }).length
                    }
                    className="py-4 px-2 text-right text-slate-700 uppercase tracking-wider text-xs"
                  >
                    Grand Totals:
                  </td>
                  {visibleColumns.netAmt && (
                    <td className="py-4 px-2 text-right text-slate-900 border-x border-slate-200">
                      {formatPrice(footerTotals.netAmt)}
                    </td>
                  )}
                  {visibleColumns.usedIn && <td className="py-4 px-2 border-x border-slate-200"></td>}
                  {visibleColumns.bookedBy && <td className="py-4 px-2 border-x border-slate-200"></td>}
                  {visibleColumns.refNo && <td className="py-4 px-2 border-x border-slate-200"></td>}
                  {visibleColumns.status && <td className="py-4 px-2 border-x border-slate-200"></td>}
                  {selectedStatuses.includes("Cancelled") && <td className="py-4 px-2 border-x border-slate-200"></td>}
                  {visibleColumns.ordQty && (
                    <td className="py-4 px-2 text-center text-slate-900 border-x border-slate-200 font-bold">
                      {footerTotals.ordQty}
                    </td>
                  )}
                  {visibleColumns.usedQty && (
                    <td className="py-4 px-2 text-center text-slate-900 border-x border-slate-200 font-bold">
                      {footerTotals.usedQty}
                    </td>
                  )}
                  {visibleColumns.balQty && (
                    <td className="py-4 px-2 text-center text-slate-900 border-x border-slate-200 font-bold bg-slate-50">
                      {footerTotals.balQty}
                    </td>
                  )}
                  {visibleColumns.marginBeforeGst && (
                    <td className="py-4 px-2 text-right text-blue-700 border-x border-slate-200 bg-blue-50">
                      {formatPrice(footerTotals.marginBeforeGst)}
                    </td>
                  )}
                  {visibleColumns.marginAfterGst && (
                    <td className="py-4 px-2 text-right text-indigo-700 border-x border-slate-200 bg-indigo-50">
                      {formatPrice(footerTotals.marginAfterGst)}
                    </td>
                  )}
                  {visibleColumns.margin && (
                    <td className="py-4 px-2 text-right text-emerald-700 border-x border-slate-200 bg-emerald-50">
                      {formatPrice(footerTotals.margin)}
                    </td>
                  )}
                  {visibleColumns.vendor && (
                    <td className="py-4 px-2 text-center text-slate-500 border-x border-slate-200">
                      —
                    </td>
                  )}
                  <td className="border-x border-slate-200"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Bulk Order Summary Bar */}
      {selectedItems?.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl z-40 border-t-4 border-blue-800">
          <div className="max-w-full mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs opacity-90">Items Selected</p>
                  <p className="text-2xl font-bold">{selectedItems?.length}</p>
                </div>
                <div className="border-l border-blue-400 pl-6">
                  <p className="text-xs opacity-90">Total Quantity</p>
                  <p className="text-2xl font-bold">{selectedItems?.reduce((sum, item) => sum + (item.qty || 1), 0)}</p>
                </div>
                <div className="border-l border-blue-400 pl-6">
                  <p className="text-xs opacity-90">Total Value</p>
                  <p className="text-2xl font-bold">₹{roundAmount(selectedItems?.reduce((sum, item) => sum + ((item.qty || 1) * (item.salePrice || 0)), 0))}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBulkClear}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition font-semibold text-sm border border-white/50"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Clear
                </button>
                <button
                  onClick={handleBulkAddToOrder}
                  className="px-6 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition font-bold text-sm flex items-center gap-2 shadow-lg"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Create Bulk Order ({selectedItems?.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modals */}
      {printModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print-modal-overlay">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col print-modal-content">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-200 no-print">
              <h2 className="text-lg font-bold text-slate-800">
                {printModal === "normal" && "Normal Print"}
                {printModal === "barcode" && "Barcode Print"}
                {printModal === "card" && "Card Print"}
              </h2>
              <button
                onClick={closePrintModal}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Content */}
            <div className="flex-1 overflow-auto p-4 bg-slate-50 print-modal-body">
              {printModal === "normal" && (
                <NormalPrintTemplate order={printData} allLenses={allLenses} allItems={allItems} />
              )}
              {printModal === "barcode" && (
                <BarcodePrintTemplate order={printData} allLenses={allLenses} allItems={allItems} />
              )}
              {printModal === "card" && <CardPrintTemplate order={printData} allLenses={allLenses} allItems={allItems} />}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 no-print">
              <button
                onClick={closePrintModal}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 transition"
              >
                Close
              </button>
              <button
                onClick={executePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 5mm;
            size: auto;
          }
          
          /* Hide everything by default */
          body * {
            visibility: hidden !important;
          }
          
          /* Show only the print container and its hierarchy */
          .print-modal-overlay,
          .print-modal-overlay *,
          .print-container,
          .print-container * {
            visibility: visible !important;
          }

          /* Force the container to take over the whole page */
          .print-modal-overlay {
            position: fixed !important;
            inset: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            z-index: 99999 !important;
            height: 100% !important;
            width: 100% !important;
          }

          .print-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 5mm !important;
          }
          
          .no-print {
            display: none !important;
          }

          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td { 
            border: 1px solid #94a3b8 !important;
            padding: 4px 8px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #1e293b !important;
          }
        }
        
        /* Modal Preview Table Styles */
        .print-items-table th {
          background-color: #1e293b;
          color: white;
        }
        .print-items-table td, .print-items-table th {
          border: 1px solid #e2e8f0;
          padding: 10px;
        }
      `}</style>

      {/* Items Matrix View Modal */}
      <ItemsMatrixViewModal
        isOpen={matrixModal.isOpen}
        onClose={() => setMatrixModal(prev => ({ ...prev, isOpen: false }))}
        title={`Items Matrix - Order #${saleOrders.find(o => o._id === matrixModal.orderId)?.billData?.billNo || ''}`}
        data={matrixModal.items}
        columns={getMatrixColumns()}
        onSave={handleMatrixSave}
      />
      {/* Cancel Reason Modal */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4">
              <h3 className="text-white font-bold text-lg">Enter Cancellation Reason</h3>
            </div>
            <div className="p-6">
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                placeholder="Reason for cancellation..."
                className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none text-slate-700"
                autoFocus
              ></textarea>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setCancelModal({ ...cancelModal, isOpen: false })}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                >
                  Save Reason
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Confirmation Modal */}
      {whatsappModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaWhatsapp className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">WhatsApp Shared?</h3>
              <p className="text-slate-500 leading-relaxed text-sm mb-8 px-2">
                Did you successfully send the message? This will mark the order as <strong className="text-slate-700">Placed</strong> and update status to <strong className="text-slate-700">In Progress</strong>.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmWhatsAppPlaced}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-black rounded-2xl shadow-xl shadow-green-100 transition-all duration-200 text-lg uppercase tracking-wide"
                >
                  Yes, Mark Placed
                </button>
                <button
                  onClick={() => setWhatsappModal({ isOpen: false, order: null })}
                  className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold transition-colors text-sm"
                >
                  Not Yet / Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SaleOrder;
