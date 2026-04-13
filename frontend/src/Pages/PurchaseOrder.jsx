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
  ShoppingCart,
  Barcode,
  CreditCard,
  Grid3X3,
  Columns,
  Check,
  Filter,
  Lock,
} from "lucide-react";
import ItemsMatrixViewModal from "../Components/ItemsMatrixViewModal"; // Added import
import { FaWhatsapp } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";

import {
  createLensInvoice,
  createLensChallan,
  getAllLensPurchaseOrder,
  removeLensPurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseOrderCancelReason,
  updateOrderQuantities,
  updatePurchaseItemStatus,
  updateItemQty,
  updatePurchaseOrderItemsQty,
  editLensPurchaseOrder, // Added import
} from "../controllers/LensPurchaseOrder.controller";

import {
  getAllRxPurchaseOrder,
  removeRxPurchaseOrder,
  createRxInvoice,
  updateRxPurchaseOrderStatus,
  updateRxPurchaseOrderCancelReason,
  editRxPurchaseOrder,
  createRxPurchaseChallan,
} from "../controllers/RxPurchaseOrder.controller";

import {
  getAllContactLensPurchaseOrder,
  removeContactLensPurchaseOrder,
  updateContactLensPurchaseOrderStatus,
  updateContactLensPurchaseOrderCancelReason,
  editContactLensPurchaseOrder,
  createContactLensPurchaseChallan,
  getNextPurchaseChallanBillNo,
} from "../controllers/ContactLensPurchaseOrder.controller";

import { toast, Toaster } from "react-hot-toast";
import StatusDropdown from "../Components/StatusDropdown";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import { getAllItems } from "../controllers/itemcontroller";
import { roundAmount } from "../utils/amountUtils";
function PurchaseOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialType = queryParams.get("type");
  const [viewType, setViewType] = useState(initialType === "rx" ? "rx" : initialType === "contact" ? "contact" : "lens"); // 'lens', 'rx' or 'contact'

  useEffect(() => {
    const type = queryParams.get("type");
    if (type === "rx") setViewType("rx");
    else if (type === "contact") setViewType("contact");
    else setViewType("lens");
  }, [location.search]);

  const [PurchaseOrders, setPurchaseOrders] = useState([]);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [allLenses, setAllLenses] = useState([]);
  const [allItems, setAllItems] = useState([]);

  // Cancel Reason Modal State
  const [cancelModal, setCancelModal] = useState({ isOpen: false, orderId: null, reason: "", status: "" });
  const [cancelReasonValues, setCancelReasonValues] = useState({});

  const handleCancelReasonChange = (orderId, value) => {
    setCancelReasonValues(prev => ({ ...prev, [orderId]: value }));
  };

  const saveCancelReason = async (orderId) => {
    const reason = cancelReasonValues[orderId];
    if (reason === undefined) return;
    try {
      let res;
      if (viewType === "lens") res = await updatePurchaseOrderCancelReason(orderId, reason);
      else if (viewType === "rx") res = await updateRxPurchaseOrderCancelReason(orderId, reason);
      else res = await updateContactLensPurchaseOrderCancelReason(orderId, reason);
      if (res.success) setPurchaseOrders(prev => prev.map(o => o._id === orderId ? { ...o, cancelReason: reason } : o));
    } catch (err) { console.error("Error saving cancel reason:", err); }
  };

  // Column Filter State
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const columnFilterRef = useRef(null);

  const ALL_COLUMNS = [
    { id: "date", label: "Date" },
    { id: "time", label: "Time" },
    { id: "series", label: "Series" },
    { id: "billNo", label: "No." },
    { id: "partyName", label: "Party Name" },
    { id: "ordQty", label: "Ord Q" },
    { id: "usedQty", label: "Used Q" },
    { id: "balQty", label: "Bal Q" },
    { id: "netAmt", label: "Net Amt" },
    { id: "usedIn", label: "Used In" },
    { id: "status", label: "Status" },
    { id: "reason", label: "Reason" },
  ];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("purchaseOrderVisibleColumns");
    if (saved) return JSON.parse(saved);
    return {
      date: true,
      time: true,
      series: true,
      billNo: true,
      partyName: true,
      ordQty: true,
      usedQty: true,
      balQty: true,
      netAmt: true,
      usedIn: true,
      status: true,
      reason: true,
    };
  });

  useEffect(() => {
    localStorage.setItem("purchaseOrderVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Close column filter when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (columnFilterRef.current && !columnFilterRef.current.contains(event.target)) {
        setShowColumnFilter(false);
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
      if (visibleColumns[col.id]) {
        count++;
      }
    });
    return count;
  }, [visibleColumns]);

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

    const order = PurchaseOrders.find(o => o._id === matrixModal.orderId);
    if (!order) return;

    // Ensure each item has a recalculated totalAmount
    const itemsWithTotals = updatedItems.map(item => ({
      ...item,
      totalAmount: roundAmount((Number(item.qty) || 0) * (Number(item.purchasePrice) || 0))
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
        res = await editLensPurchaseOrder(matrixModal.orderId, updatedOrder);
      } else if (matrixModal.viewType === "rx") {
        res = await editRxPurchaseOrder(matrixModal.orderId, updatedOrder);
      } else if (matrixModal.viewType === "contact") {
        res = await editContactLensPurchaseOrder(matrixModal.orderId, updatedOrder);
      }

      if (res && res.success) {
        toast.success("Items updated successfully!");
        const updatedDoc = res.data || updatedOrder;
        setPurchaseOrders(prev => prev.map(o => o._id === matrixModal.orderId ? updatedDoc : o));
        setMatrixModal(prev => ({ ...prev, isOpen: false }));
      } else {
        if (!res) {
          // For types without API, update local state directly
          setPurchaseOrders(prev => prev.map(o => o._id === matrixModal.orderId ? updatedOrder : o));
          toast("Items updated locally");
          setMatrixModal(prev => ({ ...prev, isOpen: false }));
        } else {
          toast.error(res?.error || "Failed to save items");
        }
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
      { header: "Axis", key: "axis", width: "60px", align: "center", editable: true, type: "number" },
      { header: "Qty", key: "qty", width: "80px", align: "center", editable: true, type: "number" },
      { header: "Price", key: "purchasePrice", width: "100px", align: "right", editable: true, type: "number" },
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
        { header: "BC", key: "bc", width: "60px", align: "center" },
        { header: "DIA", key: "dia", width: "60px", align: "center" },
        { header: "Qty", key: "qty", width: "80px", align: "center", editable: true, type: "number" },
        { header: "Vendor", key: "vendor", width: "120px", editable: true },
        { header: "Price", key: "purchasePrice", width: "100px", align: "right", editable: true, type: "number" },
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

    // Default lens with Add
    return [
      ...common.slice(0, 4),
      { header: "ADD", key: "add", width: "60px", align: "center" },
      ...common.slice(4)
    ];
  };

  // Fetch data based on viewType
  const fetchdata = async () => {
    try {
      let res;
      if (viewType === "lens") {
        res = await getAllLensPurchaseOrder();
      } else if (viewType === "rx") {
        res = await getAllRxPurchaseOrder();
      } else if (viewType === "contact") {
        res = await getAllContactLensPurchaseOrder();
      }

      setPurchaseOrders(res.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch orders");
    }
  };

  const fetchMasterData = async () => {
    try {
      const [lensRes, itemRes] = await Promise.all([
        getAllLensPower(),
        getAllItems(),
      ]);
      setAllLenses(lensRes?.data || []);
      // Handle the different response structures for items
      const itemsArray = Array.isArray(itemRes) 
        ? itemRes 
        : (itemRes?.items || itemRes?.data || []);
      setAllItems(itemsArray);
    } catch (err) {
      console.error("Error fetching master data:", err);
    }
  };

  useEffect(() => {
    fetchdata();
    fetchMasterData();
  }, [viewType]);

  const [quantitiesValues, setQuantitiesValues] = useState({});

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

  const saveQuantities = async (id) => {
    const vals = quantitiesValues[id];
    if (!vals) return;
    const o = Number(vals.ordQty || 0);
    const u = Number(vals.usedQty || 0);
    if (u > o) {
      toast.error("Used Qty cannot exceed Order Qty");
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

  const [itemQuantities, setItemQuantities] = useState({});
  const [itemRemarks, setItemRemarks] = useState({});

  useEffect(() => {
    const vals = {};
    const itemVals = {};
    const remarkVals = {};
    if (PurchaseOrders && PurchaseOrders.length) {
      PurchaseOrders.forEach(o => {
        vals[o._id] = {
          ordQty: o.orderQty !== undefined ? o.orderQty : (o.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0),
          usedQty: o.usedQty || 0,
          balQty: o.balQty || 0
        };
        // Populate items quantities and remarks
        if (o.items && o.items.length) {
          o.items.forEach(it => {
            if (it._id) {
              itemVals[it._id] = it.qty;
              remarkVals[it._id] = it.remark || "";
            }
          });
        }
      });
      setQuantitiesValues(vals);
      setItemQuantities(itemVals);
      setItemRemarks(remarkVals);
    }
  }, [PurchaseOrders]);

  const handleItemQtyChange = (itemId, val) => {
    setItemQuantities(prev => ({ ...prev, [itemId]: val }));
  };

  const handleItemRemarkChange = (itemId, val) => {
    setItemRemarks(prev => ({ ...prev, [itemId]: val }));
  };

  const handleRemarkBlur = async (orderId, itemId) => {
    const o = PurchaseOrders.find(po => po._id === orderId);
    if (!o || !o.items) return;

    const currentRemark = o.items.find(it => it._id === itemId)?.remark || "";
    const newRemark = itemRemarks[itemId];

    if (currentRemark === newRemark) return;

    const updatedItems = o.items.map(it =>
      it._id === itemId ? { ...it, remark: newRemark } : it
    );

    const payload = { ...o, items: updatedItems };

    try {
      let res;
      if (viewType === "lens") {
        res = await editLensPurchaseOrder(orderId, payload);
      } else if (viewType === "rx") {
        res = await editRxPurchaseOrder(orderId, payload);
      } else if (viewType === "contact") {
        res = await editContactLensPurchaseOrder(orderId, payload);
      }

      if (res && res.success) {
        toast.success("Remark saved");
        const updatedDoc = res.data || payload;
        setPurchaseOrders(prev => prev.map(po => po._id === orderId ? updatedDoc : po));
      } else {
        toast.error(res?.error || "Failed to save remark");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving remark");
    }
  };

  /*
   * Bulk Save Handler
   */
  const handleOrderQtySave = async (orderId) => {
    // Gather all updated quantities for this order
    const o = PurchaseOrders.find(po => po._id === orderId);
    if (!o || !o.items) return;

    const updates = [];
    o.items.forEach(it => {
      const val = itemQuantities[it._id];
      // Only include if value is present in local state
      // and different from original? For simplicity, send what's in state if defined.
      if (val !== undefined && val !== "") {
        updates.push({ itemId: it._id, qty: Number(val) });
      }
    });

    if (updates.length === 0) {
      toast("No changes to save");
      return;
    }

    try {
      let res;
      if (viewType === "lens") {
        res = await updatePurchaseOrderItemsQty({ orderId, items: updates });
      } else {
        // For Rx and Contact, we use the regular edit controller since they don't have a specialized qty-only update
        const updatedItems = o.items.map(it => {
          const update = updates.find(u => u.itemId === it._id);
          if (update) {
            const newQty = update.qty;
            const newTotal = roundAmount(newQty * (it.purchasePrice || 0));
            return { ...it, qty: newQty, totalAmount: newTotal };
          }
          return it;
        });

        const newGross = updatedItems.reduce((sum, it) => sum + (it.totalAmount || 0), 0);
        const payload = {
          ...o,
          items: updatedItems,
          grossAmount: roundAmount(newGross),
          subtotal: roundAmount(newGross),
          netAmount: roundAmount(newGross + Number(o.taxesAmount || 0)),
        };

        if (viewType === "rx") {
          res = await editRxPurchaseOrder(orderId, payload);
        } else if (viewType === "contact") {
          res = await editContactLensPurchaseOrder(orderId, payload);
        }
      }

      if (res && res.success) {
        toast.success("Quantities saved successfully!");
        const updatedDoc = res.data || o;
        setPurchaseOrders(prev => prev.map(po => po._id === orderId ? updatedDoc : po));
      } else {
        toast.error(res?.error || "Failed to save quantities");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving quantities");
    }
  };


  const [filters, setFilters] = useState({
    billSeries: "",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  const [selectedStatuses, setSelectedStatuses] = useState(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);

  const STATUS_OPTIONS = ["Pending", "In Progress", "Done", "Cancelled", "On Approval"];

  useEffect(() => {
    function handleClickOutside(event) {
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target)) {
        setShowStatusFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
      billSeries: "",
      dateFrom: "",
      dateTo: "",
    });
    setSelectedStatuses(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  };

  const filteredOrders = useMemo(() => {
    const q = filters.billSeries.toLowerCase();
    return PurchaseOrders.filter((o) => {
      // Basic text search across multiple fields
      if (
        q &&
        !(
          `${o.billNo || ""} `.toLowerCase().includes(q) ||
          `${o.partyName || ""} `.toLowerCase().includes(q) ||
          `${o.series || ""} `.toLowerCase().includes(q) ||
          `${o.status || ""} `.toLowerCase().includes(q) ||
          `${o.chalNO || ""} `.toLowerCase().includes(q)
        )
      ) {
        return false;
      }

      // Status Filtering
      const orderStatus = o.status || "Pending";
      const isStatusMatch = selectedStatuses.some(s => {
        const sClean = s.toLowerCase().replace(/[- ]/g, '');
        const oClean = orderStatus.toLowerCase().replace(/[- ]/g, '');
        return sClean === oClean;
      });
      if (!isStatusMatch) return false;

      const billDate = new Date(o.billData?.date);
      if (filters.dateFrom && billDate < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && billDate > new Date(filters.dateTo)) return false;

      return true;
    });
  }, [filters, PurchaseOrders, selectedStatuses]);

  const grandTotals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, o) => {
        acc.netAmt += Number(o.netAmount || o.netAmt || 0);

        // Standardize quantity summing by falling back to items if top-level is 0 or missing
        const oQty = Number(quantitiesValues[o._id]?.ordQty ?? 0) || (o.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0);
        const uQty = Number(quantitiesValues[o._id]?.usedQty ?? 0);
        const bQty = Number(quantitiesValues[o._id]?.balQty ?? 0) || (oQty - uQty);

        acc.ordQty += oQty;
        acc.usedQty += uQty;
        acc.balQty += bQty;
        return acc;
      },
      { netAmt: 0, ordQty: 0, usedQty: 0, balQty: 0 }
    );
  }, [filteredOrders, quantitiesValues]);

  const handleAddOrder = () => {
    if (viewType === "lens") {
      navigate("/lenstransaction/purchase/AddLensPurchaseOrder");
    } else if (viewType === "rx") {
      navigate("/rxtransaction/rxpurchase/addRxPurchase");
    } else {
      navigate("/contactlens/purchase/addcontactlensorder");
    }
  };

  const handleEdit = (id) => {
    if (viewType === "lens") {
      navigate(`/lenstransaction/purchase/AddLensPurchaseOrder/${id}`);
    } else if (viewType === "rx") {
      navigate(`/rxtransaction/rxpurchase/addRxPurchase/${id}`);
    } else {
      navigate(`/contactlens/purchase/addcontactlensorder/${id}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;

    let res;
    if (viewType === "lens") {
      res = await removeLensPurchaseOrder(id);
    } else if (viewType === "rx") {
      res = await removeRxPurchaseOrder(id);
    } else {
      res = await removeContactLensPurchaseOrder(id);
    }

    if (res.success) {
      toast.success(`${viewType === 'lens' ? 'Lens' : 'Rx'} Purchase Order deleted!`);
      setPurchaseOrders((prev) => prev.filter((o) => o._id !== id));
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const getId = (id) => {
    if (!id && id !== 0) return null;
    if (typeof id === "object" && id !== null) return id.$oid || String(id);
    return String(id);
  };

  const [expandedRow, setExpandedRow] = useState(null);
  const formatPrice = (price) => `₹${roundAmount(price || 0)} `;

  const handleInfo = (id) => {
    const idStr = getId(id);
    setExpandedRow((prev) => (prev === idStr ? null : idStr));
  };


  const getWhatsAppItemName = (item) => {
    // 1. Try saved name on item first
    if (item.vendorItemName) return item.vendorItemName;

    // 2. Prepare target name for lookup (Trimmed and Lowercased)
    const target = (item.itemName || "").trim().toLowerCase();
    if (!target) return item.itemName || "-";

    // 3. Search in Lenses - check for exact match or substring if needed
    // But exact match on productName is usually what's required
    const foundLens = allLenses.find(l =>
      (l.productName || "").trim().toLowerCase() === target
    );
    if (foundLens && foundLens.vendorItemName) return foundLens.vendorItemName;

    // 4. Search in General Items
    const foundItem = allItems.find(i =>
      (i.itemName || "").trim().toLowerCase() === target
    );
    if (foundItem && foundItem.vendorItemName) return foundItem.vendorItemName;

    // 5. Fallback
    return item.itemName || "-";
  };

  const handleShareWhatsApp = (order) => {
    const mobile = order.partyData?.contactNumber || "";
    if (!mobile) {
      toast.error("Contact number not found for this vendor");
      return;
    }

    let typeLabel = "Purchase Order";
    if (viewType === "rx") typeLabel = "Rx Purchase Order";
    else if (viewType === "contact") typeLabel = "Contact Lens Purchase Order";

    let message = `*Transaction Type:* ${typeLabel}\n`;
    message += `*Party Name:* ${order.partyData?.partyAccount || "-"}\n\n`;

    (order.items || []).forEach((item, index) => {
      const displayItemName = getWhatsAppItemName(item);
      message += `*Item ${index + 1}:* ${displayItemName}\n`;
      message += `*Order No:* ${item.orderNo || order.billData?.billNo || order.billNo || "-"}\n`;
      message += `*Eye:* ${item.eye || "-"}\n`;
      message += `*SPH:* ${item.sph || "0"}\n`;
      message += `*CYL:* ${item.cyl || "0"}\n`;
      message += `*Axis:* ${item.axis || "0"}\n`;
      message += `*Add:* ${item.add || "0"}\n`;
      message += `*Qty:* ${item.qty || "0"}\n`;
      message += `------------------------\n`;
    });

    message += `*Net Amount:* ₹${roundAmount(order.netAmount || 0)}`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${mobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  // Print functions
  const generateNormalPrint = (invoice) => {
    const itemsHTML = (invoice.items || [])
      .map(
        (item, i) => `
  < tr >
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${i + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.itemName || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.qty || 0}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(item.purchasePrice || 0)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.discount || 0}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatPrice(item.totalAmount || 0)}</td>
      </tr >
  `
      )
      .join("");

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
  < html >
        <head>
          <title>Purchase Order ${invoice.billData?.billSeries || ""}-${invoice.billData?.billNo || ""}</title>
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
            <h1>PURCHASE ORDER</h1>
            <p>Bill Series: ${invoice.billData?.billSeries || ""} | Bill No: ${invoice.billData?.billNo || ""}</p>
            <p>Date: ${formatToDDMMYYYY(invoice.billData?.date)}</p>
          </div>

          <div class="details">
            <div class="details-row">
              <div><span class="details-label">Party Name:</span> ${invoice.partyData?.partyAccount || "-"}</div>
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
            <p style="margin-top: 20px; color: #666;">This is a computer-generated purchase order</p>
          </div>
        </body>
      </html >
  `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const generateBarcodePrint = (order) => {
    printBarcodeStickers(order, allLenses, allItems, true);
  };

  const generateCardPrint = (invoice) => {
    printAuthenticityCard(invoice, allLenses, allItems);
  };

  // Rx Purchase Order Print
  const generateRxPrint = (order) => {
    if (!order) {
      toast.error('No order selected for printing');
      return;
    }

    const taxesHTML = (order.taxes || [])
      .filter(t => Number(t.amount) > 0 || Number(t.percentage) > 0)
      .map(t => `
  < tr >
          <td style="text-align: right; padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 12px;">${t.taxName || 'Tax'} (${t.percentage || 0}%)</td>
          <td style="text-align: right; padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 12px; font-weight: 600;">${formatPrice(t.amount)}</td>
        </tr >
  `).join('');

    const itemsHTML = (order.items || [])
      .map((item, i) => `
  < tr style = "${i % 2 === 0 ? 'background:#fafbfc;' : ''}" >
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${i + 1}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; font-weight: 600;">${item.itemName || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.eye || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.sph ?? '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.cyl ?? '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.axis ?? '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.add ?? '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.dia || '-'}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 12px;">${item.qty || 0}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right; font-size: 12px;">${formatPrice(item.purchasePrice || 0)}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right; font-size: 12px;">${formatPrice(item.discount || 0)}</td>
          <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right; font-size: 12px; font-weight: 700;">${formatPrice(item.totalAmount || 0)}</td>
        </tr >
  `).join('');

    const printWindow = window.open('', '', 'height=900,width=900');
    printWindow.document.write(`
  < html >
        <head>
          <title>Rx Purchase Order ${order.billData?.billSeries || ''}-${order.billData?.billNo || ''}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20mm 15mm; color: #1e293b; font-size: 12px; }
            @media print {
              @page { size: A4; margin: 15mm; }
              body { padding: 0; }
              .no-print { display: none !important; }
            }
            .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { font-size: 22px; color: #1e40af; margin-bottom: 4px; letter-spacing: 2px; text-transform: uppercase; }
            .header .subtitle { font-size: 11px; color: #64748b; letter-spacing: 1px; }
            .order-badge { display: inline-block; background: #1e40af; color: white; padding: 4px 16px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-top: 8px; }
            .info-grid { display: flex; justify-content: space-between; margin: 15px 0; gap: 20px; }
            .info-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; }
            .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px; font-weight: 700; }
            .info-box p { font-size: 12px; margin: 3px 0; color: #334155; }
            .info-box p strong { color: #1e293b; }
            table.items { width: 100%; border-collapse: collapse; margin: 15px 0; }
            table.items th { background: #1e40af; color: white; padding: 8px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e40af; }
            .totals-section { display: flex; justify-content: flex-end; margin-top: 15px; }
            .totals-table { width: 280px; }
            .totals-table td { padding: 6px 12px; font-size: 12px; }
            .totals-table .grand-total td { border-top: 2px solid #1e40af; font-size: 14px; font-weight: 800; color: #1e40af; padding-top: 10px; }
            .remark-box { margin-top: 15px; padding: 10px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 11px; color: #92400e; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .signature-box { text-align: center; width: 200px; }
            .signature-line { border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 5px; font-size: 10px; color: #64748b; }
            .print-note { text-align: center; margin-top: 30px; font-size: 9px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rx Purchase Order</h1>
            <p class="subtitle">Prescription Purchase Order</p>
            <div class="order-badge">ORDER: ${order.billData?.billSeries || ''}-${order.billData?.billNo || ''}</div>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <h3>Order Details</h3>
              <p><strong>Bill Series:</strong> ${order.billData?.billSeries || '-'}</p>
              <p><strong>Bill No:</strong> ${order.billData?.billNo || '-'}</p>
              <p><strong>Date:</strong> ${formatToDDMMYYYY(order.billData?.date)}</p>
              <p><strong>Bill Type:</strong> ${order.billData?.billType || '-'}</p>
              <p><strong>Godown:</strong> ${order.billData?.godown || '-'}</p>
              <p><strong>Booked By:</strong> ${order.billData?.bookedBy || '-'}</p>
            </div>
            <div class="info-box">
              <h3>Supplier Details</h3>
              <p><strong>Party Name:</strong> ${order.partyData?.partyAccount || '-'}</p>
              <p><strong>Address:</strong> ${order.partyData?.address || '-'}</p>
              <p><strong>Contact:</strong> ${order.partyData?.contactNumber || '-'}</p>
              <p><strong>State:</strong> ${order.partyData?.stateCode || '-'}</p>
              <p><strong>Status:</strong> ${order.status || '-'}</p>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th style="width:30px">Sr</th>
                <th>Item Name</th>
                <th style="width:40px">Eye</th>
                <th style="width:50px">SPH</th>
                <th style="width:50px">CYL</th>
                <th style="width:50px">Axis</th>
                <th style="width:50px">ADD</th>
                <th style="width:50px">DIA</th>
                <th style="width:40px">Qty</th>
                <th style="width:75px">Rate</th>
                <th style="width:60px">Disc</th>
                <th style="width:80px">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td style="text-align: right;">Subtotal:</td>
                <td style="text-align: right; font-weight: 600;">${formatPrice(order.subtotal || order.grossAmount || 0)}</td>
              </tr>
              ${taxesHTML}
              <tr class="grand-total">
                <td style="text-align: right;">Net Amount:</td>
                <td style="text-align: right;">${formatPrice(order.netAmount || 0)}</td>
              </tr>
              <tr>
                <td style="text-align: right; font-size: 12px;">Paid Amount:</td>
                <td style="text-align: right; font-size: 12px; font-weight: 600; color: #16a34a;">${formatPrice(order.paidAmount || 0)}</td>
              </tr>
              <tr>
                <td style="text-align: right; font-size: 12px;">Due Amount:</td>
                <td style="text-align: right; font-size: 12px; font-weight: 700; color: ${Number(order.dueAmount || 0) > 0 ? '#dc2626' : '#64748b'};">${formatPrice(order.dueAmount || 0)}</td>
              </tr>
            </table>
          </div>

          ${order.remark ? `<div class="remark-box"><strong>Remark:</strong> ${order.remark}</div>` : ''}

          <div class="footer">
            <div class="signature-box">
              <div class="signature-line">Prepared By</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Authorized Signatory</div>
            </div>
          </div>

          <p class="print-note">This is a computer-generated Rx Purchase Order.</p>
        </body>
      </html >
  `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  // Print ALL orders from the table
  const printAllOrders = () => {
    if (filteredOrders.length === 0) {
      toast.error('No orders to print');
      return;
    }

    const title = viewType === 'rx' ? 'Rx Purchase Orders' : 'Lens Purchase Orders';
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Calculate grand totals
    let totalNet = 0, totalPaid = 0, totalDue = 0, totalOrdQty = 0, totalUsedQty = 0, totalBalQty = 0;
    filteredOrders.forEach(o => {
      totalNet += Number(o.netAmount ?? 0);
      totalPaid += Number(o.paidAmount ?? 0);
      totalDue += Number(o.dueAmount ?? 0);
      const qv = quantitiesValues[o._id] || {};
      totalOrdQty += Number(qv.ordQty ?? 0);
      totalUsedQty += Number(qv.usedQty ?? 0);
      totalBalQty += Number(qv.balQty ?? 0);
    });

    const rowsHTML = filteredOrders.map((o, i) => {
      const qv = quantitiesValues[o._id] || {};
      const partyName = o.partyData?.partyAccount || '-';
      const address = o.partyData?.address || '-';
      const dueAmt = Number(o.dueAmount ?? 0);
      return `
  < tr style = "${i % 2 === 0 ? 'background:#f8fafc;' : ''}" >
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px;">${i + 1}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px;">${formatToDDMMYYYY(o.billData?.date)}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px;">${formatTimeTo12h(o.billData?.time || o.time, o.billData?.date)}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px;">${o.billData?.billSeries || '-'}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px; font-weight:700;">${o.billData?.billNo || '-'}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; font-size:12px; font-weight:600;">${partyName}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; font-size:11px; color:#64748b; max-width:160px;">${address}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px;">${qv.ordQty ?? 0}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px;">${qv.usedQty ?? 0}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:12px; font-weight:700;">${qv.balQty ?? 0}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:right; font-size:12px; font-weight:700;">${formatPrice(o.netAmount ?? 0)}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:11px;">${o.status || '-'}</td>
          <td style="border:1px solid #e2e8f0; padding:7px 6px; text-align:center; font-size:11px;">${o.cancelReason || '-'}</td>
        </tr >
  `;
    }).join('');

    const printWindow = window.open('', '', 'height=900,width=1100');
    printWindow.document.write(`
  < html >
        <head>
          <title>${title} - Print</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15mm; color: #1e293b; }
            @media print {
              @page { size: A4 landscape; margin: 10mm; }
              body { padding: 0; }
            }
            .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 15px; }
            .header h1 { font-size: 20px; color: #1e40af; letter-spacing: 2px; text-transform: uppercase; }
            .header p { font-size: 11px; color: #64748b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #1e40af; color: white; padding: 8px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e40af; text-align: center; }
            .totals-row td { background: #dbeafe; font-weight: 800; font-size: 12px; border: 1px solid #93c5fd; padding: 8px 6px; }
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>Printed on: ${today} | Total Orders: ${filteredOrders.length}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:30px">Sr</th>
                <th style="width:75px">Date</th>
                <th style="width:75px">Time</th>
                <th style="width:75px">Series</th>
                <th style="width:50px">No.</th>
                <th>Party Name</th>
                <th>Address</th>
                <th style="width:45px">Ord Q</th>
                <th style="width:45px">Used Q</th>
                <th style="width:45px">Bal Q</th>
                <th style="width:75px">Net Amt</th>
                <th style="width:65px">Status</th>
                <th style="width:100px">Reason</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
              <tr class="totals-row">
                <td colspan="7" style="text-align: right; text-transform: uppercase; letter-spacing: 1px; font-size: 10px;">Grand Totals:</td>
                <td style="text-align: center;">${totalOrdQty}</td>
                <td style="text-align: center;">${totalUsedQty}</td>
                <td style="text-align: center;">${totalBalQty}</td>
                <td style="text-align: right;">${formatPrice(totalNet)}</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <p class="footer">This is a computer-generated document.</p>
        </body>
      </html >
  `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === "Cancelled") {
      setCancelModal({ isOpen: true, orderId, reason: "", status: newStatus });
      return;
    }
    setUpdatingStatusId(orderId);
    try {
      let res;
      if (viewType === "lens") res = await updatePurchaseOrderStatus(orderId, newStatus);
      else if (viewType === "rx") res = await updateRxPurchaseOrderStatus(orderId, newStatus);
      else res = await updateContactLensPurchaseOrderStatus(orderId, newStatus);
      if (res.success) {
        setPurchaseOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
        toast.success(`Status updated to ${newStatus} `);
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
      if (viewType === "lens") res = await updatePurchaseOrderStatus(orderId, status, reason);
      else if (viewType === "rx") res = await updateRxPurchaseOrderStatus(orderId, status, reason);
      else res = await updateContactLensPurchaseOrderStatus(orderId, status, reason);
      if (res.success) {
        setPurchaseOrders(prev => prev.map(o => o._id === orderId ? { ...o, status, cancelReason: reason } : o));
        toast.success(`Order Cancelled`);
      } else toast.error(res.error || "Failed to cancel order");
    } catch (err) { toast.error("Error cancelling order"); }
    finally { setUpdatingStatusId(null); }
  };

  const handleItemStatusChange = async (orderId, itemIds, newStatus) => {
    try {
      const res = await updatePurchaseItemStatus({ orderId, itemIds, newStatus });
      if (res.success) {
        toast.success("Item status updated");
        fetchdata();
      } else {
        toast.error(res.error || "Failed to update item status");
      }
    } catch (err) {
      toast.error("Error updating item status");
    }
  };

  const [selectedItems, setSelectedItems] = useState([]);

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

  const handleSelectAllItems = (items, isChecked) => {
    if (isChecked) {
      const availableItems = items.filter(it => it.itemStatus !== "Done");
      setSelectedItems(prev => {
        const newItems = [...prev];
        availableItems.forEach(item => {
          if (!newItems.find(i => i._id === item._id)) {
            newItems.push(item);
          }
        });
        return newItems;
      });
    } else {
      const itemIdsToRemove = items.map(it => it._id);
      setSelectedItems(prev => prev.filter(i => !itemIdsToRemove.includes(i._id)));
    }
  };

  // Generic handler for creating invoice
  const handleCreateInvoice = async (o) => {
    if (!selectedItems || selectedItems.length === 0) {
      toast.error("Please select at least one item to make an invoice");
      return;
    }
    const payload = {
      sourcePurchaseId: o._id,
      billData: {
        billSeries: o.billData?.billSeries || "",
        billNo: o.billData?.billNo || "",
        billType: o.billData?.billType || "",
        godown: o.billData?.godown || "",
        bookedBy: o.billData?.bookedBy || "",
        date: o.billData?.date || new Date(),
      },
      partyData: o.partyData,
      items: selectedItems,
      selectedItemIds: selectedItems.map(i => String(i._id)),
      taxes: o.taxes,
      grossAmount: o.grossAmount,
      subtotal: o.subtotal,
      taxesAmount: o.taxesAmount,
      netAmount: o.netAmount,
      paidAmount: o.paidAmount,
      dueAmount: o.dueAmount,
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
    } else {
      // For contact lens, we use createLensInvoice but the backend will handle it based on sourceChallanId/orderType if needed, 
      // but here it's PO -> PI direct. LensPurchaseOrder.controller has createLensInvoice.
      // Actually, we might need a specific one for Contact, but let's check what's used currently.
      res = await createLensInvoice(payload);
    }

    if (res.success) {
      toast.success(res.data.message || "Invoice created successfully!");
      setSelectedItems([]);
      navigate(`/lenstransaction/purchase/purchaseinvoice`);
    } else {
      toast.error(res.error || "Failed to create invoice");
    }
  };

  const handleCreateChallan = async (o) => {
    if (!selectedItems || selectedItems.length === 0) {
      toast.error("Please select at least one item to make a challan");
      return;
    }
    const payload = {
      sourcePurchaseId: o._id,
      billData: o.billData,
      partyData: o.partyData,
      items: selectedItems,
      selectedItemIds: selectedItems.map((i) => String(i._id)),
      taxes: o.taxes,
      grossAmount: o.grossAmount,
      subtotal: o.subtotal,
      taxesAmount: o.taxesAmount,
      netAmount: o.netAmount,
      paidAmount: o.paidAmount,
      dueAmount: o.dueAmount,
      deliveryDate: o.deliveryDate,
      time: o.time,
      remark: o.remark,
      status: o.status,
    };

    let res;
    if (viewType === "lens") {
      res = await createLensChallan(payload);
    } else if (viewType === "rx") {
      res = await createRxPurchaseChallan(payload);
    } else if (viewType === "contact") {
      // Fetch a fresh bill number for the challan to avoid E11000 duplicate key error
      const nextNo = await getNextPurchaseChallanBillNo();
      if (nextNo) {
        payload.billData = {
          ...payload.billData,
          billNo: String(nextNo)
        };
      }
      res = await createContactLensPurchaseChallan(payload);
    }

    if (res && res.success) {
      toast.success(res.data.message || "Challan created successfully!");
      setSelectedItems([]);
      navigate(`/lenstransaction/purchase/purchasechallan`);
    } else {
      toast.error(res?.error || "Failed to create challan");
    }
  };

  const formatToDDMMYYYY = (date) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day} -${month} -${year} `;
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

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Purchase Orders
            </h1>
            <p className="text-slate-600 font-medium">Manage purchases orders and deliveries</p>
          </div>

          {/* Toggle View Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-w-4xl mt-4">
            <div
              onClick={() => setViewType("lens")}
              className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex items-center gap-4
        ${viewType === "lens"
                  ? "border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <div className={`p-2.5 rounded-lg transition-colors ${viewType === 'lens' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'} `}>
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-base font-bold transition-colors ${viewType === 'lens' ? 'text-blue-900' : 'text-slate-700'}`}>Lens Purchase Order</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Standard Lens Orders</p>
              </div>
            </div>

            <div
              onClick={() => setViewType("rx")}
              className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex items-center gap-4
        ${viewType === "rx"
                  ? "border-purple-600 bg-purple-50/50 shadow-sm ring-1 ring-purple-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <div className={`p-2.5 rounded-lg transition-colors ${viewType === 'rx' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'} `}>
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-base font-bold transition-colors ${viewType === 'rx' ? 'text-purple-900' : 'text-slate-700'}`}>Rx Purchase Order</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Prescription Orders</p>
              </div>
            </div>

            <div
              onClick={() => setViewType("contact")}
              className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex items-center gap-4
        ${viewType === "contact"
                  ? "border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
            >
              <div className={`p-2.5 rounded-lg transition-colors ${viewType === 'contact' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'} `}>
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-base font-bold transition-colors ${viewType === 'contact' ? 'text-emerald-900' : 'text-slate-700'}`}>Contact Lens & Solution</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Contact Lens Orders</p>
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
                placeholder="Bill Series,Party Name..."
                value={filters.billSeries}
                onChange={(e) =>
                  handleFilterChange("billSeries", e.target.value)
                }
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg 
           focus:ring-0 focus:border-blue-500 outline-none text-sm bg-white"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors duration-200 shadow-sm border border-slate-200 uppercase tracking-wider"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleAddOrder}
              className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-black rounded-lg transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 uppercase tracking-widest ${viewType === 'lens' ? 'bg-blue-600 hover:bg-blue-700' : viewType === 'rx' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Add {viewType === 'lens' ? 'Lens' : viewType === 'rx' ? 'Rx' : 'Contact Lens'} Purchase Order
            </button>

            <div className="relative" ref={columnFilterRef}>
              <button
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all duration-200 shadow-sm uppercase tracking-wider"
              >
                <Columns className="w-3.5 h-3.5" />
                Columns
              </button>

              {showColumnFilter && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-3 animate-in fade-in zoom-in duration-200 ring-4 ring-slate-900/5">
                  <div className="px-4 py-1 border-b border-slate-100 mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Columns</p>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto px-2 space-y-0.5">
                    {ALL_COLUMNS.map((col) => (
                      <div
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${visibleColumns[col.id] ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-400 font-medium"}`}
                      >
                        <span className="text-xs uppercase tracking-wider">
                          {col.label}
                        </span>
                        {visibleColumns[col.id] && <Check className="w-4 h-4" />}
                      </div>
                    ))}
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

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-16 text-center py-4 px-2 text-slate-700 font-bold text-sm">Sr</th>
                    {visibleColumns.date && <th className="w-28 text-center py-4 px-2 text-slate-700 font-bold text-sm">Date</th>}
                    {visibleColumns.time && <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">Time</th>}
                    {visibleColumns.series && <th className="w-32 text-center py-4 px-2 text-slate-700 font-bold text-sm">Series</th>}
                    {visibleColumns.billNo && <th className="w-24 text-center py-4 px-2 text-slate-700 font-bold text-sm">No.</th>}
                    {visibleColumns.partyName && <th className="w-48 text-left py-4 px-2 text-slate-700 font-bold text-sm">Party Name</th>}
                    {visibleColumns.ordQty && <th className="text-center py-4 px-2 text-slate-700 font-bold text-sm">Ord Q</th>}
                    {visibleColumns.usedQty && <th className="text-center py-4 px-2 text-slate-700 font-bold text-sm">Used Q</th>}
                    {visibleColumns.balQty && <th className="text-center py-4 px-2 text-slate-700 font-bold text-sm">Bal Q</th>}
                    {visibleColumns.netAmt && <th className="w-28 text-right py-4 px-2 text-slate-700 font-bold text-sm">Net Amt</th>}
                    {visibleColumns.usedIn && <th className="w-24 text-center py-4 px-2 text-slate-700 font-bold text-sm">Used In</th>}
                    {visibleColumns.status && <th className="w-24 text-center py-4 px-2 text-slate-700 font-bold text-sm">Status</th>}
                    {visibleColumns.reason && (
                      <th className="w-56 text-left py-4 px-2 text-slate-700 font-bold text-sm">Reason</th>
                    )}
                    <th className="w-40 text-center py-4 px-2 text-slate-700 font-bold text-sm">Action</th>
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
                      // safe shortcuts
                      const billDate = o?.billData?.date;
                      const orderTime = o?.billData?.time || o?.time;
                      const series = o?.billData?.billSeries || o?.billSeries || "-";
                      const billNo = o?.billData?.billNo || o?.billNo || "-";
                      const partyName = o?.partyData?.partyAccount || "-";
                      const netAmt = Number(o?.netAmount ?? o?.netAmt ?? 0);
                      const paidAmt = Number(o?.paidAmount ?? 0);
                      const dueAmt = Number(o?.dueAmount ?? 0);
                      const isDone = (o.status || "").toLowerCase() === "done";

                      return (
                        <React.Fragment key={idStr}>
                          <tr className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                            <td className="py-4 px-2 text-center text-slate-600">{i + 1}</td>
                            {visibleColumns.date && <td className="py-4 px-2 text-center text-slate-800">{formatToDDMMYYYY(billDate)}</td>}
                            {visibleColumns.time && <td className="py-4 px-2 text-center text-slate-800 font-medium">{formatTimeTo12h(orderTime, billDate)}</td>}
                            {visibleColumns.series && <td className="py-4 px-2 text-center text-slate-800"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">{series}</span></td>}
                            {visibleColumns.billNo && <td className="py-4 px-2 text-center text-slate-800 font-bold">{billNo}</td>}
                            {visibleColumns.partyName && <td className="py-4 px-2 text-left text-slate-700 font-medium truncate max-w-[200px]" title={partyName}>{partyName}</td>}
                            {visibleColumns.ordQty && (
                              <td className="py-4 px-2 text-center">
                                  <input
                                    type="number"
                                    value={quantitiesValues[o._id]?.ordQty ?? ""}
                                    disabled={isDone}
                                    onChange={(e) => handleQuantityChange(o._id, "ordQty", e.target.value)}
                                    onBlur={() => saveQuantities(o._id)}
                                    style={{ width: `calc(${Math.max(String(quantitiesValues[o._id]?.ordQty ?? "").length, 4)}ch + 2.5rem)` }}
                                    className={`px-1 py-1 text-sm border border-slate-300 rounded text-center outline-none focus:border-blue-500 font-bold shadow-sm transition-all duration-200 mx-auto block ${isDone ? "bg-slate-100 cursor-not-allowed text-slate-400" : "bg-white"}`}
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
                                  style={{ width: `calc(${Math.max(String(quantitiesValues[o._id]?.usedQty ?? "").length, 4)}ch + 2.5rem)` }}
                                  className={`px-1 py-1 text-sm border border-slate-300 rounded text-center outline-none focus:border-blue-500 font-bold shadow-sm transition-all duration-200 mx-auto block ${isDone ? "bg-slate-100 cursor-not-allowed text-slate-400" : "bg-white"}`}
                                />
                              </td>
                            )}
                            {visibleColumns.balQty && (
                              <td className="py-4 px-2 text-center">
                                  <input
                                    type="number"
                                    value={quantitiesValues[o._id]?.balQty ?? ""}
                                    onChange={(e) => handleQuantityChange(o._id, "balQty", e.target.value)}
                                    readOnly
                                    style={{ width: `calc(${Math.max(String(quantitiesValues[o._id]?.balQty ?? "").length, 4)}ch + 2.5rem)` }}
                                    className="px-1 py-1 text-sm border border-slate-300 rounded text-center outline-none bg-slate-100 font-black text-blue-700 transition-all duration-200 mx-auto block"
                                  />
                              </td>
                            )}
                            {visibleColumns.netAmt && <td className="py-4 px-2 text-right text-slate-900 font-bold">{formatPrice(netAmt)}</td>}
                            {visibleColumns.usedIn && (
                              <td className="py-4 px-2 text-center text-[10px] font-bold">
                                {Array.isArray(o.usedIn) && o.usedIn.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {o.usedIn.map((u, idx) => (
                                      <span key={idx} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                        {u.type}({u.number})
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  Array.isArray(o?.usageHistory) && o.usageHistory.length > 0
                                    ? `${viewType === 'rx' ? 'PI' : 'PC'} (${o.usageHistory[0].billNo})`
                                    : "-"
                                )}
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td className="py-4 px-2 text-center text-xs">
                                <StatusDropdown
                                  currentStatus={o.status || "pending"}
                                  isLoading={updatingStatusId === o._id}
                                  onStatusChange={(newStatus) => !isDone && handleStatusChange(o._id, newStatus)}
                                  disabled={isDone}
                                />
                              </td>
                            )}
                            {visibleColumns.reason && (
                              <td className="py-4 px-2">
                                <textarea
                                  value={cancelReasonValues[o._id] !== undefined ? cancelReasonValues[o._id] : (o.cancelReason || "")}
                                  disabled={isDone}
                                  onChange={(e) => handleCancelReasonChange(o._id, e.target.value)}
                                  onBlur={() => saveCancelReason(o._id)}
                                  placeholder={isDone ? "Order completed" : "Edit reason..."}
                                  className={`w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none overflow-hidden ${isDone ? "bg-slate-100 cursor-not-allowed text-slate-400" : ""}`}
                                  rows={1}
                                  onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                  style={{ minHeight: '38px' }}
                                />
                              </td>
                            )}
                            <td className="py-4 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleInfo(o._id)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" title="Details">
                                  <Info className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => !isDone && handleEdit(o._id)}
                                  disabled={isDone}
                                  className={`p-1.5 rounded transition-all ${isDone ? "text-slate-300 cursor-not-allowed" : "text-blue-600 hover:bg-blue-50"}`}
                                  title={isDone ? "Cannot edit completed order" : "Edit"}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => !isDone && handleDelete(o._id)}
                                  disabled={isDone}
                                  className={`p-1.5 rounded transition-all ${isDone ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                                  title={isDone ? "Cannot delete completed order" : "Delete"}
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                                <button onClick={() => viewType === 'rx' ? generateRxPrint(o) : generateNormalPrint(o)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Print Order">
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button onClick={() => generateBarcodePrint(o)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Print Barcode">
                                  <Barcode className="w-4 h-4" />
                                </button>
                                <button onClick={() => generateCardPrint(o)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Print Card">
                                  <CreditCard className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => !isDone && handleCreateInvoice(o)}
                                  disabled={isDone}
                                  className={`p-1.5 rounded transition-all ${isDone ? "text-slate-300 cursor-not-allowed" : "text-green-600 hover:bg-green-50"}`}
                                  title={isDone ? "Order completed" : "Create Invoice"}
                                >
                                  <Receipt className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleShareWhatsApp(o)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Share via WhatsApp">
                                  <FaWhatsapp className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row */}
                          {expandedRow === idStr && (
                            <tr>
                              <td colSpan={activeVisibleCount} className="bg-slate-50 p-4 border-b border-t border-slate-200 shadow-inner">
                                <div className="mb-3 flex justify-between items-center">
                                  <h4 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Order Items</h4>
                                  <div className="flex gap-2">
                                    {/* Save Order Qty Button */}
                                    <button
                                      onClick={() => !isDone && handleOrderQtySave(o._id)}
                                      disabled={isDone}
                                      className={`text-xs px-3 py-1.5 rounded transition font-medium ${isDone ? "bg-slate-400 text-white cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                                    >
                                      {isDone ? "Locked" : "Save Changes"}
                                    </button>
                                    <button
                                      onClick={() => !isDone && handleCreateInvoice(o)}
                                      disabled={isDone}
                                      className={`text-xs px-3 py-1.5 rounded transition ${isDone ? "bg-slate-400 text-white cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                                    >
                                      Make Invoice
                                    </button>
                                    <button
                                      onClick={() => !isDone && handleCreateChallan(o)}
                                      disabled={isDone}
                                      className={`text-xs px-3 py-1.5 rounded transition ${isDone ? "bg-slate-400 text-white cursor-not-allowed" : "bg-orange-600 text-white hover:bg-orange-700"}`}
                                    >
                                      Make Challan
                                    </button>
                                    <button
                                      onClick={() => !isDone && handleOpenMatrix(o)}
                                      disabled={isDone}
                                      className={`text-xs px-3 py-1.5 rounded transition flex items-center gap-1 ${isDone ? "bg-slate-400 text-white cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                                    >
                                      <Grid3X3 className="w-3 h-3" /> View in Matrix
                                    </button>
                                  </div>
                                </div>
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-200">
                                    <tr>
                                      <th className="p-2 text-left">Item Name</th>
                                      <th className="p-2 text-center">Order No</th>
                                      <th className="p-2 text-center">Eye</th>
                                      <th className="p-2 text-center">Sph</th>
                                      <th className="p-2 text-center">Cyl</th>
                                      <th className="p-2 text-center">Axis</th>
                                      <th className="p-2 text-center">Add</th>
                                      <th className="p-2 text-center">Remark</th>
                                      <th className="p-2 text-center text-xs">Qty</th>
                                      {viewType === "contact" && (
                                        <>
                                          <th className="p-2 text-center font-bold">Import Date</th>
                                          <th className="p-2 text-center font-bold">Expiry Date</th>
                                          <th className="p-2 text-center font-bold">MRP</th>
                                          <th className="p-2 text-center font-bold">Vendor</th>
                                        </>
                                      )}
                                      <th className="p-2 text-right">Price</th>
                                      <th className="p-2 text-right">Total</th>
                                      <th className="p-2 text-center text-xs">Item Status</th>
                                      <th className="p-2 text-center text-xs">
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="text-[10px] uppercase font-bold text-slate-500">Select</span>
                                          <input
                                            type="checkbox"
                                            className="accent-blue-600 w-3.5 h-3.5 cursor-pointer"
                                            onChange={(e) => handleSelectAllItems(o.items || [], e.target.checked)}
                                            checked={
                                              o.items?.length > 0 &&
                                              o.items.filter(it => it.itemStatus !== "Done").every(it =>
                                                selectedItems.some(si => si._id === it._id)
                                              )
                                            }
                                          />
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(o.items || []).map((it, idx) => (
                                      <tr key={idx} className="border-b border-slate-200">
                                        <td className="p-2">{it.itemName || "-"}</td>
                                        <td className="p-2 text-center">{it.orderNo || o.billData?.billNo || o.billNo || "-"}</td>
                                        <td className="p-2 text-center">{it.eye || "-"}</td>
                                        <td className="p-2 text-center">{it.sph}</td>
                                        <td className="p-2 text-center">{it.cyl}</td>
                                        <td className="p-2 text-center">{it.axis}</td>
                                        <td className="p-2 text-center">{it.add || "-"}</td>
                                        <td className="p-2 text-center">
                                          <textarea
                                            value={itemRemarks[it._id] ?? it.remark ?? ""}
                                            disabled={isDone}
                                            onChange={(e) => handleItemRemarkChange(it._id, e.target.value)}
                                            onBlur={() => handleRemarkBlur(o._id, it._id)}
                                            onInput={(e) => {
                                              e.target.style.height = 'auto';
                                              e.target.style.height = (e.target.scrollHeight) + 'px';
                                            }}
                                            className={`w-full py-1 text-[11px] text-center outline-none bg-transparent resize-none overflow-hidden min-h-[30px] leading-tight uppercase ${isDone ? "cursor-not-allowed text-slate-400" : ""}`}
                                            placeholder="REMARK"
                                          />
                                        </td>
                                        <td className="p-2 text-center">
                                          <input
                                            type="number"
                                            value={itemQuantities[it._id] ?? it.qty ?? 0}
                                            onChange={(e) => handleItemQtyChange(it._id, e.target.value)}
                                            className="w-16 px-1 py-0.5 text-center border border-slate-300 rounded text-sm focus:border-blue-500 outline-none"
                                            disabled={it.itemStatus === "Done" || isDone}
                                          />
                                        </td>
                                        {viewType === "contact" && (
                                          <>
                                            <td className="p-2 text-center">{formatToDDMMYYYY(it.importDate)}</td>
                                            <td className="p-2 text-center">{formatToDDMMYYYY(it.expiryDate)}</td>
                                            <td className="p-2 text-center">₹{roundAmount(it.mrp || 0)}</td>
                                            <td className="p-2 text-center font-semibold text-slate-800">{it.vendor || "-"}</td>
                                          </>
                                        )}
                                        <td className="p-2 text-right">{roundAmount(it.purchasePrice)}</td>
                                        <td className="p-2 text-right">{roundAmount(it.totalAmount)}</td>
                                        <td className="p-2 text-center">
                                          <StatusDropdown
                                            currentStatus={it.itemStatus || "Pending"}
                                            size="sm"
                                            onStatusChange={(newStatus) =>
                                              !isDone && handleItemStatusChange(o._id, [it._id], newStatus)
                                            }
                                            disabled={isDone}
                                          />
                                        </td>
                                        <td className="p-2 text-center">
                                          <input
                                            type="checkbox"
                                            className="accent-blue-600 w-4 h-4 cursor-pointer"
                                            onChange={(e) => handleSelect(it, e.target.checked)}
                                            checked={selectedItems.some(i => i._id === it._id)}
                                            disabled={it.itemStatus === "Done" || isDone}
                                          />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
              </tbody>

              {filteredOrders.length > 0 && (
                <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-t-2 border-slate-300">
                  <tr className="divide-x divide-slate-200">
                    <td
                      colSpan={Object.keys(visibleColumns).filter(k => visibleColumns[k]).indexOf("ordQty") + 1}
                      className="py-4 px-3 text-right text-slate-700 uppercase tracking-wider text-sm font-black"
                    >
                      Grand Totals:
                    </td>
                    {visibleColumns.ordQty && (
                      <td className="text-center py-4 px-3 text-blue-600 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                        {grandTotals.ordQty}
                      </td>
                    )}
                    {visibleColumns.usedQty && (
                      <td className="text-center py-4 px-3 text-emerald-600 text-lg font-black underline decoration-double decoration-emerald-500 underline-offset-4">
                        {grandTotals.usedQty}
                      </td>
                    )}
                    {visibleColumns.balQty && (
                      <td className="text-center py-4 px-3 text-red-600 text-lg font-black underline decoration-double decoration-red-500 underline-offset-4">
                        {grandTotals.balQty}
                      </td>
                    )}
                    {visibleColumns.netAmt && (
                      <td className="text-right py-4 px-3 text-slate-900 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                        {formatPrice(grandTotals.netAmt)}
                      </td>
                    )}
                    <td
                      colSpan={
                        Object.keys(visibleColumns).filter((k, i) => visibleColumns[k] && i > Object.keys(visibleColumns).filter(x => visibleColumns[x]).indexOf("netAmt")).length + 1
                      }
                      className="bg-slate-100/50"
                    ></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </div>

        <ItemsMatrixViewModal
          isOpen={matrixModal.isOpen}
          onClose={() => setMatrixModal(prev => ({ ...prev, isOpen: false }))}
          title={`Items Matrix - Order #${PurchaseOrders.find(o => o._id === matrixModal.orderId)?.billData?.billNo || PurchaseOrders.find(o => o._id === matrixModal.orderId)?.billNo || ''}`}
          data={matrixModal.items}
          columns={getMatrixColumns()}
          onSave={handleMatrixSave}
        />

        {/* Cancel Reason Modal */}
        {cancelModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
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
      </div>
    </div>
  );
}

export default PurchaseOrder;
