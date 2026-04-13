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
  Barcode,
  CreditCard,
  Eye,
  EyeOff,
  Layers,
  Filter,
  Check,
  ShoppingCart,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';

import {
  createLensInvoice,
  getAllLensSaleChallan,
  removeLensSaleChallan,
  updateSaleChallanStatus,
  updateSaleChallanCancelReason,
  updateDeliveryPerson,
  updateLensChallanItemStatus,
  updateLensChallanItemRemark,
} from "../controllers/LensSaleChallan.controller";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import { getAllItems } from "../controllers/itemcontroller";

import { toast, Toaster } from "react-hot-toast";
import StatusDropdown from "../Components/StatusDropdown";
import { roundAmount } from "../utils/amountUtils";
import { numberToWords } from "../utils/numberToWords";

function SaleChallan() {
  const navigate = useNavigate();
  const [saleChallans, setSaleChallans] = useState([]);
  
  // Print Modal State for normal print custom message
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedChallanForPrint, setSelectedChallanForPrint] = useState(null);
  const [printCustomMessage, setPrintCustomMessage] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [allLenses, setAllLenses] = useState([]);
  const [allItems, setAllItems] = useState([]);

  // Cancel Reason State
  const [cancelModal, setCancelModal] = useState({ isOpen: false, challanId: null, reason: "", status: "" });
  const [cancelReasonValues, setCancelReasonValues] = useState({});

  const handleCancelReasonChange = (id, value) => {
    setCancelReasonValues(prev => ({ ...prev, [id]: value }));
  };

  const saveCancelReason = async (id) => {
    const reason = cancelReasonValues[id];
    if (reason === undefined) return;
    try {
      const res = await updateSaleChallanCancelReason(id, reason);
      if (res.success) setSaleChallans(prev => prev.map(c => c._id === id ? { ...c, cancelReason: reason } : c));
    } catch (err) { console.error("Error saving cancel reason:", err); }
  };

  const fetchdata = async () => {
    try {
      const res = await getAllLensSaleChallan();
      // Safely handle different response structures or API failures
      const challansData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setSaleChallans(challansData);

      const accRes = await getAllAccounts();
      const accountsData = Array.isArray(accRes?.data) ? accRes.data : (Array.isArray(accRes) ? accRes : []);
      setAccounts(accountsData);

      const [lensesRes, itemsRes] = await Promise.all([
        getAllLensPower(),
        getAllItems()
      ]);
      setAllLenses(Array.isArray(lensesRes?.data) ? lensesRes.data : (Array.isArray(lensesRes) ? lensesRes : []));
      setAllItems(Array.isArray(itemsRes?.items) ? itemsRes.items : (Array.isArray(itemsRes) ? itemsRes : []));
    } catch (err) {
      console.error("Failed to fetch data", err);
      setSaleChallans([]);
      setAccounts([]);
    }
  };
  useEffect(() => {

    fetchdata();
  }, []);

  const [filters, setFilters] = useState({
    billSeries: "",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  const [visibleColumns, setVisibleColumns] = useState({
    srNo: true,
    billDate: true,
    billSeries: true,
    billNo: true,
    partyName: true,
    netAmt: true,
    usedIn: true,
    status: true,
    time: true,
    ordQ: true,
    usdQ: true,
    balQ: true,
    deliveryPerson: true,
    reason: true,
  });

  const [showColumnFilter, setShowColumnFilter] = useState(false);

  const handleFilterChange = (field, value) => {
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  const toggleAllColumns = (show) => {
    const newState = {};
    Object.keys(visibleColumns).forEach((key) => {
      newState[key] = show;
    });
    setVisibleColumns(newState);
  };
  const handleReset = () => {
    setFilters({
      billSeries: "",
      dateFrom: "",
      dateTo: "",
    });
    setSelectedStatuses(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  };

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

  const filteredChallans = useMemo(() => {
    const q = filters.billSeries.toLowerCase();
    return saleChallans.filter((o) => {
      // Status Filtering
      const orderStatus = o.status || "Pending";
      const isStatusMatch = selectedStatuses.some(s => {
        const sClean = s.toLowerCase().replace(/[- ]/g, '');
        const oClean = orderStatus.toLowerCase().replace(/[- ]/g, '');
        return sClean === oClean;
      });
      if (!isStatusMatch) return false;

      if (
        q &&
        !(
          `${o.billNo || ""}`.toLowerCase().includes(q) ||
          `${o.partyName || ""}`.toLowerCase().includes(q) ||
          `${o.series || ""}`.toLowerCase().includes(q) ||
          `${o.status || ""}`.toLowerCase().includes(q) ||
          `${o.chalNO || ""}`.toLowerCase().includes(q)
        )
      ) {
        return false;
      }

      const billDate = new Date(o.billData?.date);
      if (filters.dateFrom && billDate < new Date(filters.dateFrom))
        return false;
      if (filters.dateTo && billDate > new Date(filters.dateTo)) return false;

      return true;
    });
  }, [filters, saleChallans, selectedStatuses]);

  const grandTotals = useMemo(() => {
    return filteredChallans.reduce(
      (acc, o) => {
        acc.netAmt += Number(o.netAmount || o.netAmt || 0);

        // Standardize quantity summing by falling back to items if top-level is 0 or missing
        const oQty = Number(o.orderQty || o.orderQuantity || 0) || (o.items?.reduce((s, i) => s + (Number(i.qty) || 0), 0) || 0);
        const uQty = Number(o.usedQty || 0);
        const bQty = Number(o.balQty || 0) || (oQty - uQty);

        acc.ordQ += oQty;
        acc.usdQ += uQty;
        acc.balQ += bQty;
        return acc;
      },
      { netAmt: 0, ordQ: 0, usdQ: 0, balQ: 0 }
    );
  }, [filteredChallans]);

  const handleAddLensChallan = () => {
    navigate("/lenstransaction/sale/AddLensSaleChallan");
  };

  const handleEdit = (id) => {
    navigate(`/lenstransaction/sale/AddLensSaleChallan/${id}`);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    const res = await removeLensSaleChallan(id);
    if (res.success) {
      toast.success("Sale Challan deleted successfully!");
      setSaleChallans((prev) => prev.filter((o) => o._id !== id));
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const handleUpdateItemRemark = async (challanId, itemId, remark) => {
    try {
      const res = await updateLensChallanItemRemark(challanId, itemId, remark);
      if (res.success) {
        setSaleChallans((prev) =>
          prev.map((c) => {
            if (c._id === challanId) {
              const updatedItems = c.items.map((it) =>
                String(it._id) === String(itemId) ? { ...it, remark } : it
              );
              return { ...c, items: updatedItems };
            }
            return c;
          })
        );
        toast.success("Remark updated");
      } else {
        toast.error(res.error || "Failed to update remark");
      }
    } catch (err) {
      toast.error("Error updating remark");
    }
  };

  const handleForward = async (o) => {
    try {
      // Create payload for invoice from challan
      const payload = {
        sourceChallanId: o._id,
        billData: {
          billSeries: o.billData?.billSeries || "",
          billNo: o.billData?.billNo || "",
          billType: o.billData?.billType || "",
          godown: o.billData?.godown || "",
          bookedBy: o.billData?.bookedBy || "",
          date: o.billData?.date || new Date(),
        },
        partyData: o.partyData,
        items: o.items || [],
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

      const res = await createLensInvoice(payload);
      if (res.success) {
        toast.success(res.data.message || "Invoice created successfully!");
        // Save to localStorage for reference
        localStorage.setItem("forwardedChallan", JSON.stringify(o));
        // Redirect to Lens Sale Invoice page
        setTimeout(() => {
          navigate("/lenstransaction/sale/saleinvoice");
        }, 500);
      } else {
        toast.error(res.error || "Failed to create invoice");
        console.error("Invoice creation error:", res.error);
      }
    } catch (err) {
      toast.error("Failed to forward challan");
      console.error(err);
    }
  };

  const getId = (id) => {
    if (!id && id !== 0) return null;
    if (typeof id === "object" && id !== null) return id.$oid || String(id);
    return String(id);
  };
  const [expandedRow, setExpandedRow] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [updatingDeliveryPersonId, setUpdatingDeliveryPersonId] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const formatPrice = (price) => `₹${roundAmount(price || 0)}`;
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB");
  };
  const handleInfo = (id) => {
    const idStr = getId(id);
    setExpandedRow((prev) => (prev === idStr ? null : idStr));
  };

  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedChallans, setSelectedChallans] = useState([]);

  const handleSelectChallan = (challanId, isChecked) => {
    setSelectedChallans(prev =>
      isChecked ? [...prev, challanId] : prev.filter(id => id !== challanId)
    );
  };

  const handleSelectAllChallans = (isChecked) => {
    if (isChecked) {
      setSelectedChallans(filteredChallans.map(ch => ch._id));
    } else {
      setSelectedChallans([]);
    }
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

  const handleCreateInvoice = async (o) => {
    const challanItems = selectedItems.filter(si => o.items.some(oi => String(oi._id) === String(si._id)));
    if (challanItems.length === 0) {
      toast.error("Please select at least one item of this challan to invoice");
      return;
    }

    const payload = {
      sourceChallanId: o._id,
      billData: {
        billSeries: o.billData?.billSeries || "",
        billNo: o.billData?.billNo || "",
        billType: o.billData?.billType || "",
        godown: o.billData?.godown || "",
        bookedBy: o.billData?.bookedBy || "",
        date: o.billData?.date || new Date(),
      },
      partyData: o.partyData,
      items: challanItems,
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
      sourceSaleId: o.sourceSaleId || null,
    };
    const res = await createLensInvoice(payload);
    if (res.success) {
      toast.success(res.data.message || "Invoice created successfully!");
      setSelectedItems([]);
      // Refresh the challan list to show updated status
      await fetchdata();
      setTimeout(() => {
        navigate(
          o.orderType === "RX" || o.orderType === "CONTACT"
            ? "/lenstransaction/sale/saleinvoice"
            : "/lenstransaction/sale/saleinvoice"
        );
      }, 1000);
    } else {
      toast.error(res.error || "Failed to create invoice");
      console.error("Invoice creation error:", res.error);
    }
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

  const handleStatusChange = async (challanId, newStatus) => {
    if (newStatus === "Cancelled") {
      setCancelModal({ isOpen: true, challanId, reason: "", status: newStatus });
      return;
    }
    setUpdatingStatusId(challanId);
    try {
      const res = await updateSaleChallanStatus(challanId, newStatus);
      if (res.success) {
        setSaleChallans((prevChallans) =>
          prevChallans.map((challan) =>
            challan._id === challanId
              ? { ...challan, status: newStatus }
              : challan
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
    const { challanId, reason, status } = cancelModal;
    setUpdatingStatusId(challanId);
    setCancelModal({ ...cancelModal, isOpen: false });
    try {
      const res = await updateSaleChallanStatus(challanId, status, reason);
      if (res.success) {
        setSaleChallans(prev => prev.map(c => c._id === challanId ? { ...c, status, cancelReason: reason } : c));
        toast.success("Challan Cancelled");
      } else toast.error(res.error || "Failed to cancel");
    } catch (err) { toast.error("Error cancelling challan"); }
    finally { setUpdatingStatusId(null); }
  };

  const handleDeliveryPersonChange = async (challanId, deliveryPersonName) => {
    if (!deliveryPersonName.trim()) return;

    setUpdatingDeliveryPersonId(challanId);
    try {
      const res = await updateDeliveryPerson(challanId, deliveryPersonName);
      if (res.success) {
        // Update the local state
        setSaleChallans((prevChallans) =>
          prevChallans.map((challan) =>
            challan._id === challanId
              ? { ...challan, deliveryPerson: deliveryPersonName }
              : challan
          )
        );
        toast.success("Delivery person saved successfully!");
      } else {
        toast.error(res.error || "Failed to save delivery person");
      }
    } catch (err) {
      toast.error("Error saving delivery person");
    } finally {
      setUpdatingDeliveryPersonId(null);
    }
  };

  const handleItemStatusChange = async (challanId, itemId, newStatus) => {
    try {
      const res = await updateLensChallanItemStatus(challanId, [itemId], newStatus);
      if (res.success) {
        setSaleChallans(prev => prev.map(ch => {
          if (ch._id === challanId) {
            const updatedItems = ch.items.map(it =>
              String(it._id) === String(itemId) ? { ...it, itemStatus: newStatus } : it
            );
            return {
              ...ch,
              items: updatedItems,
              status: res.data.data.status // Derived status from backend
            };
          }
          return ch;
        }));
        toast.success("Item status updated");
      } else {
        toast.error(res.error || "Failed to update item status");
      }
    } catch (err) {
      toast.error("Error updating item status");
    }
  };

  /**
   * Build the wa.me link using party's MobileNumber from Account master.
   * Falls back to partyData.contactNumber if no Account found.
   */
  const getWhatsAppUrl = (o) => {
    const partyName = o?.partyData?.partyAccount || "";
    const account = accounts.find(
      (a) =>
        a.Name?.toLowerCase() === partyName?.toLowerCase() ||
        a.PrintName?.toLowerCase() === partyName?.toLowerCase()
    );
    const rawPhone =
      account?.MobileNumber || o?.partyData?.contactNumber || "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    const phoneWithCountry =
      cleanPhone && cleanPhone.length >= 10
        ? cleanPhone.startsWith("91") && cleanPhone.length >= 12
          ? cleanPhone
          : `91${cleanPhone}`
        : "";

    const series = o?.billData?.billSeries || "";
    const billNo = o?.billData?.billNo || "";
    const voucherNo = series ? `${series}-${billNo}` : billNo;
    const displayName =
      account?.PrintName || account?.Name || partyName || "Customer";
    const dueAmt = roundAmount(o?.dueAmount ?? 0);

    const message =
      `Dear ${displayName},\nThis is a reminder that payment for your Sale Challan is still pending.\n\nVoucher No: ${voucherNo}\nPending Amount: \u20b9${dueAmt}\n\nPlease clear the payment before the invoice is automatically generated.\n\nThank you.`;

    const encoded = encodeURIComponent(message);
    return phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
  };



  const handleNormalPrintClick = (o) => {
    setSelectedChallanForPrint(o);
    setPrintCustomMessage(localStorage.getItem("lastCustomPrintMessage") || "");
    setPrintModalOpen(true);
  };

  // Print functions
  const generateNormalPrint = (challan, customMessage = "") => {
    let totalQty = 0;
    let totalDisc = 0;
    const itemsHTML = (challan.items || [])
      .map(
        (item, i) => {
          totalQty += (Number(item.qty) || 0);
          totalDisc += (Number(item.discount) || 0); // fallback in case disc is used
          return `
      <tr>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${i + 1}</td>
        <td style="border: 1px solid #000; padding: 8px;">${getPrintItemName(item)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.orderNo || challan.sourceSaleId?.orderNo || challan.billData?.billNo || "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.eye || "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.sph ?? "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.cyl ?? "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.axis ?? "0"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.add ?? "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty || 0}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatPrice(item.salePrice || 0)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatPrice(item.discount || 0)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatPrice(item.totalAmount || 0)}</td>
      </tr>
    `})
      .join("");

    const series = challan?.billData?.billSeries || "-";
    const billNo = challan?.billData?.billNo || "-";
    const partyName = challan?.partyData?.partyAccount || "-";

    // Fallback to Account Master if address/state missing
    const account = accounts.find(a => a.Name?.toLowerCase() === partyName?.toLowerCase());

    const address = challan?.partyData?.address || account?.Address || "";
    const city = challan?.partyData?.city || account?.City || "";
    const state = challan?.partyData?.state || challan?.partyData?.stateCode || account?.State || "";

    const billDate = formatToDDMMYYYY(challan?.billData?.date);
    const netAmt = Number(challan?.netAmount || 0);
    const paidAmt = Number(challan?.paidAmount || 0);
    const dueAmt = Number(challan?.dueAmount || 0);

    const getBalanceInfo = (val) => {
      if (!val) return { amount: 0, isCr: false };
      const strVal = String(val).trim().toUpperCase();
      const match = strVal.match(/[\d.]+/);
      const amount = match ? parseFloat(match[0]) : 0;
      const isCr = strVal.includes('CR') || (typeof val === 'number' && val < 0) || (typeof val === 'string' && val.startsWith('-'));
      return { amount, isCr };
    };

    const prevBal = getBalanceInfo(account?.ClosingBalance || account?.closingBalance || account?.balance || account?.Balance || account?.CurrentBalance || 0);
    const prevBalValueSigned = prevBal.isCr ? -prevBal.amount : prevBal.amount;
    const totalBalValueSigned = prevBalValueSigned + dueAmt; // adding due amount increases Dr (positive)

    const prevBalStr = Math.abs(prevBalValueSigned).toFixed(2) + (prevBalValueSigned >= 0 ? " Dr" : " Cr");
    const totalBalStr = Math.abs(totalBalValueSigned).toFixed(2) + (totalBalValueSigned >= 0 ? " Dr" : " Cr");

    const numberToWordsString = numberToWords(netAmt);

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Challan ${series}-${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; font-size: 15px; }
            .header { text-align: center; position: relative; display: flex; align-items: center; justify-content: center; height: 100px; }
            .header h1 { margin: 0; font-size: 32px; font-weight: bold; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/sadguru_logo.svg" style="height: 85px; object-fit: contain; position: absolute; left: 0;" alt="Sadguru Logo" />
            <h1>SALE CHALLAN</h1>
            <div style="position: absolute; right: 0; text-align: right;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ orderId: getId(challan._id), orderType: 'challan' }))}&size=100x100" alt="Order QR Code" style="width: 80px; height: 80px; border: 1px solid #eee; padding: 4px;"/>
              <p style="font-size: 10px; margin: 2px 0 0 0; color: #666; text-align: center;">Scan for Delivery</p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 10px 0; margin-bottom: 15px;">
            <div style="flex: 1;">
              <table style="width: 100%; border: none; margin: 0; font-size: 14px;">
                <tr><td style="padding: 2px 5px 2px 0; width: 100px; font-weight: bold;">Party Name</td><td style="padding: 2px 0;">: ${partyName}</td></tr>
                ${address ? `<tr><td style="padding: 2px 5px 2px 0; font-weight: bold;">Address</td><td style="padding: 2px 0;">: ${address}</td></tr>` : ""}
                ${state ? `<tr><td style="padding: 2px 5px 2px 0; font-weight: bold;">State</td><td style="padding: 2px 0;">: ${state}</td></tr>` : ""}
              </table>
            </div>
            <div style="flex: 1;">
              <table style="width: 100%; border: none; margin: 0; font-size: 14px;">
                <tr><td style="padding: 2px 5px 2px 0; font-weight: bold; text-align: right; width: 150px;">Bill Series</td><td style="padding: 2px 0 2px 5px;">: ${series}</td></tr>
                <tr><td style="padding: 2px 5px 2px 0; font-weight: bold; text-align: right;">Bill No</td><td style="padding: 2px 0 2px 5px;">: ${billNo}</td></tr>
                <tr><td style="padding: 2px 5px 2px 0; font-weight: bold; text-align: right;">Date</td><td style="padding: 2px 0 2px 5px;">: ${billDate}</td></tr>
              </table>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #000; font-size: 14px;">
            <thead>
              <tr>
                <th style="border: 1px solid #000; padding: 6px;">SR No</th>
                <th style="border: 1px solid #000; padding: 6px;">Item Name</th>
                <th style="border: 1px solid #000; padding: 6px;">Order No</th>
                <th style="border: 1px solid #000; padding: 6px;">Eye</th>
                <th style="border: 1px solid #000; padding: 6px;">Sph</th>
                <th style="border: 1px solid #000; padding: 6px;">Cyl</th>
                <th style="border: 1px solid #000; padding: 6px;">Axis</th>
                <th style="border: 1px solid #000; padding: 6px;">Add</th>
                <th style="border: 1px solid #000; padding: 6px;">Qty</th>
                <th style="border: 1px solid #000; padding: 6px;">Sale Price</th>
                <th style="border: 1px solid #000; padding: 6px;">Disc</th>
                <th style="border: 1px solid #000; padding: 6px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
              <tr>
                <td colspan="8" style="text-align: center; border: 1px solid #000; padding: 6px; font-weight: bold;">Total</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${totalQty}</td>
                <td style="border: 1px solid #000; padding: 6px;"></td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatPrice(totalDisc)}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatPrice(netAmt)}</td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; margin-top: 15px; align-items: flex-start; font-size: 14px;">
            <div style="flex: 1; padding-right: 15px;">
              <p style="margin: 0; font-weight: bold;">Total Invoice value ( In Words ) :</p>
              <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px;">${numberToWordsString}</p>
              
              ${customMessage ? `
              <div style="margin-top: 25px;">
                <p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 16px; text-align: left;">NEW ITEM RECEIVED</p>
                <p style="margin: 10px 0 0 0; font-weight: bold; font-style: italic; white-space: pre-wrap; font-size: 15px;">${customMessage}</p>
              </div>
              ` : ""}
            </div>
            <div style="min-width: 250px;">
              <table style="width: 100%; border: none; font-size: 14px; font-weight: bold;">
                <tr>
                  <td style="padding: 4px;">Total Amount</td>
                  <td style="padding: 4px; text-align: right;">${formatPrice(netAmt)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Paid Amt</td>
                  <td style="padding: 4px; text-align: right;">${formatPrice(paidAmt)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Due Amt</td>
                  <td style="padding: 4px; text-align: right;">${formatPrice(dueAmt)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Prev.Bal</td>
                  <td style="padding: 4px; text-align: right;">${prevBalStr}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Total Bal</td>
                  <td style="padding: 4px; text-align: right;">${totalBalStr}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
            This is a computer-generated challan
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const generateBulkPrint = (challansToPrint) => {
    const allPrintsHTML = challansToPrint.map(challan => {
      const itemsHTML = (challan.items || [])
        .map(
          (item, i) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 16px;">${i + 1}</td>
          <td style="border: 1px solid #ddd; padding: 10px; font-size: 16px;">${getPrintItemName(item)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 16px;">${item.qty || 0}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 16px;">${item.eye || "-"}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 16px;">${item.sph ?? "-"}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 16px;">${item.cyl ?? "-"}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 16px;">${formatPrice(item.salePrice || 0)}</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 16px;">${formatPrice(item.totalAmount || 0)}</td>
        </tr>
      `
        )
        .join("");

      const series = challan?.billData?.billSeries || "-";
      const billNo = challan?.billData?.billNo || "-";
      const partyName = challan?.partyData?.partyAccount || "-";

      const account = accounts.find(a => a.Name?.toLowerCase() === partyName?.toLowerCase());
      const address = challan?.partyData?.address || account?.Address || "";
      const city = challan?.partyData?.city || account?.City || "";
      const state = challan?.partyData?.state || challan?.partyData?.stateCode || account?.State || "";

      const billDate = formatToDDMMYYYY(challan?.billData?.date);
      const netAmt = Number(challan?.netAmount || 0);

      return `
        <div class="print-page">
          <div class="header">
            <h1>SALE CHALLAN</h1>
            <p><strong>Bill Series:</strong> ${series} | <strong>Bill No:</strong> ${billNo}</p>
            <p><strong>Date:</strong> ${billDate}</p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div class="details" style="margin: 0; flex: 1;">
              <div class="details-row" style="margin: 0;">
                <div>
                  <div style="margin-bottom: 5px;"><span class="details-label">Party Name:</span> ${partyName}</div>
                  ${address ? `<div style="font-size: 14px; margin-bottom: 2px;"><strong>Address:</strong> ${address}</div>` : ""}
                  ${city ? `<div style="font-size: 14px; margin-bottom: 2px;"><strong>City:</strong> ${city}</div>` : ""}
                  ${state ? `<div style="font-size: 14px;"><strong>State:</strong> ${state}</div>` : ""}
                </div>
              </div>
            </div>
            <div style="text-align: right; margin-left: 20px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ orderId: getId(challan._id), orderType: 'challan' }))}&size=100x100" alt="Order QR Code" style="width: 100px; height: 100px; border: 1px solid #eee; padding: 5px;"/>

              <p style="font-size: 10px; margin: 2px 0; color: #666;">Scan for Delivery</p>
            </div>
          </div>


          <table>
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Bill Item Name</th>
                <th>Qty</th>
                <th>Eye</th>
                <th>Sph</th>
                <th>Cyl</th>
                <th>Sale Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
              <tr class="total-row">
                <td colspan="7" style="text-align: right; border: 1px solid #ddd; padding: 10px; font-size: 17px;">Net Amount:</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 17px;">${formatPrice(roundAmount(netAmt))}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p style="margin-top: 20px; color: #666;">This is a computer-generated challan</p>
          </div>
        </div>
      `;
    }).join("");

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Bulk Sale Challans</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
            .print-page { page-break-after: always; padding: 20px; font-size: 16px; box-sizing: border-box; }
            .print-page:last-child { page-break-after: auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .header p { margin: 5px 0; font-size: 16px; }
            .details { margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; }
            .details-label { font-weight: bold; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 16px; }
            th { background-color: #f0f0f0; border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold; font-size: 16px; }
            td { border: 1px solid #ddd; padding: 10px; font-size: 16px; }
            .total-row { background-color: #f9f9f9; font-weight: bold; font-size: 17px; }
            .footer { margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          ${allPrintsHTML}
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>

    `);
    printWindow.document.close();

  };

   const generateBarcodePrint = (challan) => {
    printBarcodeStickers(challan, allLenses, allItems);
  };

  const generateCardPrint = (challan) => {
    printAuthenticityCard(challan, allLenses, allItems);
  };

  const handlePrintAll = (challan) => {
    if (printingId) return;
    setPrintingId(challan._id);
    toast.dismiss();
    toast.loading("Preparing print queue...", { duration: 1000 });

    // 1. Invoice
    setTimeout(() => {
      generateNormalPrint(challan);
    }, 100);

    // 2. Barcode (after 1.5s delay)
    setTimeout(() => {
      generateBarcodePrint(challan);
    }, 1600);

    // 3. Card (after 3s delay)
    setTimeout(() => {
      generateCardPrint(challan);
      toast.success("All prints initiated!");
      setPrintingId(null);
    }, 3200);
  };

  const handleExportToExcel = () => {
    const dataToExport = filteredChallans.map((o, i) => {
      const row = {};
      if (visibleColumns.srNo) row["Sr. No."] = i + 1;
      if (visibleColumns.billDate) row["Bill Date"] = formatToDDMMYYYY(o?.billData?.date);
      if (visibleColumns.billSeries) row["Bill Series"] = o?.billData?.billSeries || o?.billSeries || "-";
      if (visibleColumns.billNo) row["Bill No."] = o?.billData?.billNo || o?.billNo || "-";
      if (visibleColumns.partyName) row["Party Name"] = o?.partyData?.partyAccount || "-";
      if (visibleColumns.netAmt) row["Net Amt"] = o?.netAmount ?? o?.netAmt ?? 0;
      if (visibleColumns.usedIn) row["Used In"] = Array.isArray(o.usedIn) ? o.usedIn.map(u => `${u.type}(${u.number})`).join(", ") : "-";
      if (visibleColumns.status) row["Status"] = o?.status || "pending";
      if (visibleColumns.time) row["Time"] = o?.time || "-";
      if (visibleColumns.ordQ) row["Ord Q"] = o?.orderQty || 0;
      if (visibleColumns.usdQ) row["Usd Q"] = o?.usedQty || 0;
      if (visibleColumns.balQ) row["Bal Q"] = o?.balQty || 0;
      if (visibleColumns.deliveryPerson) row["Delivery Person"] = o?.deliveryPerson || "";
      if (visibleColumns.reason) row["Reason"] = o?.cancelReason || "";
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SaleChallans");
    XLSX.writeFile(workbook, "SaleChallans.xlsx");
  };

  const handlePrintMainTable = () => {
    const printWindow = window.open("", "", "height=900,width=1200");
    const tableHeader = Object.keys(visibleColumns)
      .filter(key => visibleColumns[key])
      .map(key => {
        const labels = {
          srNo: "Sr. No.",
          billDate: "Bill Date",
          billSeries: "Bill Series",
          billNo: "Bill No.",
          partyName: "Party Name",
          netAmt: "Net Amt",
          usedIn: "Used In",
          status: "Status",
          time: "Time",
          ordQ: "Ord Q",
          usdQ: "Usd Q",
          balQ: "Bal Q",
          deliveryPerson: "Delivery Person",
          reason: "Reason"
        };
        return `<th>${labels[key]}</th>`;
      })
      .join("");

    const tableRows = filteredChallans.map((o, i) => {
      let rowHtml = "<tr>";
      if (visibleColumns.srNo) rowHtml += `<td>${i + 1}</td>`;
      if (visibleColumns.billDate) rowHtml += `<td>${formatToDDMMYYYY(o?.billData?.date)}</td>`;
      if (visibleColumns.billSeries) rowHtml += `<td>${o?.billData?.billSeries || o?.billSeries || "-"}</td>`;
      if (visibleColumns.billNo) rowHtml += `<td>${o?.billData?.billNo || o?.billNo || "-"}</td>`;
      if (visibleColumns.partyName) rowHtml += `<td>${o?.partyData?.partyAccount || "-"}</td>`;
      if (visibleColumns.netAmt) rowHtml += `<td>${formatPrice(o?.netAmount ?? o?.netAmt ?? 0)}</td>`;
      if (visibleColumns.usedIn) rowHtml += `<td>${Array.isArray(o.usedIn) ? o.usedIn.map(u => `${u.type}(${u.number})`).join(", ") : "-"}</td>`;
      if (visibleColumns.status) rowHtml += `<td>${o?.status || "pending"}</td>`;
      if (visibleColumns.time) rowHtml += `<td>${o?.time || "-"}</td>`;
      if (visibleColumns.ordQ) rowHtml += `<td>${o?.orderQty || 0}</td>`;
      if (visibleColumns.usdQ) rowHtml += `<td>${o?.usedQty || 0}</td>`;
      if (visibleColumns.balQ) rowHtml += `<td>${o?.balQty || 0}</td>`;
      if (visibleColumns.deliveryPerson) rowHtml += `<td>${o?.deliveryPerson || ""}</td>`;
      if (visibleColumns.reason) rowHtml += `<td>${o?.cancelReason || ""}</td>`;
      rowHtml += "</tr>";
      return rowHtml;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Sale Challans Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 14px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Sale Challans Report</h1>
          <table>
            <thead><tr>${tableHeader}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handlePrintClick = () => {
    if (selectedChallans.length > 0) {
      const challansToPrint = filteredChallans.filter(ch => selectedChallans.includes(ch._id));
      generateBulkPrint(challansToPrint);
    } else {
      handlePrintMainTable();
    }
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Sale Challans
          </h1>
          <p className="text-slate-600">Manage sales challans and deliveries</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Bill Series,Party Name,Bill No..."
                value={filters.billSeries}
                onChange={(e) =>
                  handleFilterChange("billSeries", e.target.value)
                }
                className="peer w-full px-3 py-2 border border-slate-300 rounded-lg 
           focus:ring-0 focus:border-blue-500 transition-all duration-200 
           outline-none text-sm bg-white"
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
                Date From
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
              onClick={handleAddLensChallan}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Sale Challan
            </button>


            <div className="relative">
              <button
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200 transition-colors duration-200"
              >
                <Eye className="w-3.5 h-3.5" />
                Columns
              </button>
              {showColumnFilter && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px] p-2">
                  <div className="flex justify-between items-center mb-2 px-2 py-1 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Show/Hide Columns</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleAllColumns(true)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        All
                      </button>
                      <button
                        onClick={() => toggleAllColumns(false)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.srNo}
                        onChange={() => toggleColumn("srNo")}
                        className="w-4 h-4"
                      />
                      <span>Sr. No.</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.billDate}
                        onChange={() => toggleColumn("billDate")}
                        className="w-4 h-4"
                      />
                      <span>Bill Date</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.billSeries}
                        onChange={() => toggleColumn("billSeries")}
                        className="w-4 h-4"
                      />
                      <span>Bill Series</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.billNo}
                        onChange={() => toggleColumn("billNo")}
                        className="w-4 h-4"
                      />
                      <span>Bill No.</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.partyName}
                        onChange={() => toggleColumn("partyName")}
                        className="w-4 h-4"
                      />
                      <span>Party Name</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.netAmt}
                        onChange={() => toggleColumn("netAmt")}
                        className="w-4 h-4"
                      />
                      <span>Net Amt</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.usedIn}
                        onChange={() => toggleColumn("usedIn")}
                        className="w-4 h-4"
                      />
                      <span>Used In</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.status}
                        onChange={() => toggleColumn("status")}
                        className="w-4 h-4"
                      />
                      <span>Status</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.time}
                        onChange={() => toggleColumn("time")}
                        className="w-4 h-4"
                      />
                      <span>Time</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.ordQ}
                        onChange={() => toggleColumn("ordQ")}
                        className="w-4 h-4"
                      />
                      <span>Ord Q</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.usdQ}
                        onChange={() => toggleColumn("usdQ")}
                        className="w-4 h-4"
                      />
                      <span>Usd Q</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.balQ}
                        onChange={() => toggleColumn("balQ")}
                        className="w-4 h-4"
                      />
                      <span>Bal Q</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.deliveryPerson}
                        onChange={() => toggleColumn("deliveryPerson")}
                        className="w-4 h-4"
                      />
                      <span>Delivery Person</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={visibleColumns.reason}
                        onChange={() => toggleColumn("reason")}
                        className="w-4 h-4"
                      />
                      <span>Reason</span>
                    </label>
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
            <button
              onClick={handleExportToExcel}
              className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrintClick}
              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm"
              title="Print Table or Bulk Print Selected"
            >
              <Printer className="w-4 h-4" />
            </button>

          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.srNo && (
                    <th className="w-24 text-center border-gray-300 border-r py-4 px-3 text-slate-700 font-bold text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          checked={filteredChallans.length > 0 && selectedChallans.length === filteredChallans.length}
                          onChange={(e) => handleSelectAllChallans(e.target.checked)}
                        />
                        Sr. No.
                      </div>
                    </th>
                  )}
                  {visibleColumns.billDate && (
                    <th className="min-w-[100px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Bill Date
                    </th>
                  )}
                  {visibleColumns.billSeries && (
                    <th className="min-w-[100px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Bill Series
                    </th>
                  )}
                  {visibleColumns.billNo && (
                    <th className="min-w-[70px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Bill No.
                    </th>
                  )}
                  {visibleColumns.partyName && (
                    <th className="min-w-[180px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Party Name
                    </th>
                  )}
                  {visibleColumns.netAmt && (
                    <th className="min-w-[100px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Net Amt
                    </th>
                  )}
                  {visibleColumns.usedIn && (
                    <th className="min-w-[100px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Used In
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th className="min-w-[100px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Status
                    </th>
                  )}
                  {visibleColumns.time && (
                    <th className="min-w-[100px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Time
                    </th>
                  )}
                  {visibleColumns.ordQ && (
                    <th className="min-w-[70px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Ord Q
                    </th>
                  )}
                  {visibleColumns.usdQ && (
                    <th className="min-w-[70px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Usd Q
                    </th>
                  )}
                  {visibleColumns.balQ && (
                    <th className="min-w-[70px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Bal Q
                    </th>
                  )}
                  {visibleColumns.deliveryPerson && (
                    <th className="min-w-[150px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Delivery Person
                    </th>
                  )}
                  {visibleColumns.reason && (
                    <th className="min-w-[180px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                      Reason
                    </th>
                  )}
                  <th className="w-[420px] min-w-[420px] border-gray-300 border-r text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredChallans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={17}
                      className="p-10 text-center text-slate-500"
                    >
                      <p className="text-xl">No Challans found</p>
                      <p className="text-md">
                        Try adjusting your search criteria
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredChallans.map((o, i) => {
                    const idStr = String(o._id);
                    // safe shortcuts
                    const billDate = o?.billData?.date;
                    const series =
                      o?.billData?.billSeries || o?.billSeries || "-";
                    const billNo = o?.billData?.billNo || o?.billNo || "-";
                    const partyName = o?.partyData?.partyAccount || "-";
                    const netAmt = Number(o?.netAmount ?? o?.netAmt ?? 0);
                    const paidAmt = Number(o?.paidAmount ?? 0);
                    const dueAmt = Number(
                      o?.dueAmount ?? o?.balanceAmount ?? 0
                    );
                    const deliveryDate = o?.deliveryDate;
                    const time = o?.time || "-";
                    const orderQty =
                      (o?.orderQty ?? o?.orderQuantity ?? 0) || "0";
                    const usedQty = (o?.usedQty ?? 0) || "0";
                    const balQty = (o?.balQty ?? 0) || "0";
                    // usageHistory may be array — show first ref or hyphen
                    const usedIn =
                      Array.isArray(o?.usageHistory) &&
                        o.usageHistory.length > 0
                        ? o.usageHistory[0].billNo || "-"
                        : "-";

                     const isReadOnly = (o?.status || "").toLowerCase() === "done" || (o?.status || "").toLowerCase() === "received";

                     return (
                       <React.Fragment key={idStr}>
                         <tr className={`hover:bg-slate-50 transition-colors duration-150 group text-sm ${isReadOnly ? "bg-slate-50/50" : ""}`}>
                          {visibleColumns.srNo && (
                            <td className="w-24 text-center border-gray-300 border-r text-slate-600 font-medium py-5 px-2 align-top whitespace-nowrap">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                    checked={selectedChallans.includes(o._id)}
                                    onChange={(e) => handleSelectChallan(o._id, e.target.checked)}
                                  />
                                  <span className="text-base">{i + 1}</span>
                                </div>
                                {o.isInvoiced && (
                                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold border border-green-200">
                                    INVOICED
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          {visibleColumns.billDate && (
                            <td className="py-5 border-gray-300 border-r px-3 text-slate-800 align-top text-center">
                              {formatToDDMMYYYY(billDate)}
                            </td>
                          )}

                          {visibleColumns.billSeries && (
                            <td className="py-5 border-gray-300 border-r px-3 text-slate-800 align-top text-center">
                              {series}
                            </td>
                          )}

                          {visibleColumns.billNo && (
                            <td className="py-5 border-gray-300 border-r px-3 text-slate-800 align-top text-center">
                              {billNo}
                            </td>
                          )}

                          {visibleColumns.partyName && (
                            <td className="py-5 border-gray-300 border-r px-3 text-slate-700 align-top">
                              <div className="whitespace-normal text-center break-words">
                                {partyName}
                              </div>
                            </td>
                          )}

                          {visibleColumns.netAmt && (
                            <td className="text-center border-gray-300 border-r text-slate-900 font-medium py-5 px-3 align-top">
                              {netAmt ? formatPrice(netAmt) : "-"}
                            </td>
                          )}
                          {visibleColumns.usedIn && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 text-slate-800 text-[10px] font-bold align-top">
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
                                  ? `SI(${o.usageHistory[0].billNo})`
                                  : "-"
                              )}
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 align-top">
                              <StatusDropdown
                                currentStatus={o?.status || "pending"}
                                isLoading={updatingStatusId === o._id}
                                disabled={isReadOnly}
                                onStatusChange={(newStatus) =>
                                  !isReadOnly && handleStatusChange(o._id, newStatus)
                                }
                              />
                            </td>
                          )}


                          {visibleColumns.time && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 text-slate-700 align-top">
                              {time}
                            </td>
                          )}

                          {visibleColumns.ordQ && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 text-slate-700 align-top">
                              {orderQty}
                            </td>
                          )}

                          {visibleColumns.usdQ && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 text-slate-700 align-top">
                              {usedQty}
                            </td>
                          )}

                          {visibleColumns.balQ && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 text-slate-700 align-top">
                              {balQty}
                            </td>
                          )}


                          {visibleColumns.deliveryPerson && (
                            <td className="text-center border-gray-300 border-r py-5 px-3 align-top">
                              <input
                                type="text"
                                placeholder="Enter name"
                                defaultValue={o?.deliveryPerson || ""}
                                onBlur={(e) => {
                                  if (isReadOnly) return;
                                  const value = e.target.value;
                                  if (value !== (o?.deliveryPerson || "")) {
                                    handleDeliveryPersonChange(o._id, value);
                                  }
                                }}
                                disabled={updatingDeliveryPersonId === o._id || isReadOnly}
                                className={`w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm ${isReadOnly ? "bg-slate-100 cursor-not-allowed opacity-70" : "disabled:bg-slate-100 disabled:cursor-not-allowed"}`}
                              />
                            </td>
                          )}

                          {visibleColumns.reason && (
                            <td className="py-5 px-3 border-gray-300 border-r align-top">
                              <textarea
                                value={cancelReasonValues[o._id] !== undefined ? cancelReasonValues[o._id] : (o.cancelReason || "")}
                                disabled={isReadOnly}
                                onChange={(e) => handleCancelReasonChange(o._id, e.target.value)}
                                onBlur={() => saveCancelReason(o._id)}
                                placeholder={isReadOnly ? "Order completed" : "Edit reason..."}
                                className={`w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none overflow-hidden ${isReadOnly ? "bg-slate-100 cursor-not-allowed text-slate-400" : ""}`}
                                rows={1}
                                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                style={{ minHeight: '38px' }}
                              />
                            </td>
                          )}

                          <td className="py-5 px-3 border-gray-300 border-r align-top text-center min-w-[420px]">
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                onClick={() => handleInfo(o._id)}
                                className="p-2.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors duration-200"
                                title="Info"
                              >
                                <Info className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => !isReadOnly && handleEdit(o._id)}
                                disabled={isReadOnly}
                                className={`p-2.5 rounded-lg transition-all duration-200 ${isReadOnly ? "text-slate-300 cursor-not-allowed" : "text-blue-600 hover:bg-blue-50"}`}
                                title={isReadOnly ? "Cannot edit completed challan" : "Edit"}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => !isReadOnly && handleDelete(o._id)}
                                disabled={isReadOnly}
                                className={`p-2.5 rounded-lg transition-all duration-200 ${isReadOnly ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"}`}
                                title={isReadOnly ? "Cannot delete completed challan" : "Delete"}
                              >
                                <Trash className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleNormalPrintClick(o)}
                                className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                title="Print Challan"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => generateBarcodePrint(o)}
                                className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                                title="Print Barcode"
                              >
                                <Barcode className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => generateCardPrint(o)}
                                className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                title="Print Card"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handlePrintAll(o)}
                                disabled={printingId === o._id}
                                className={`p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors duration-200 ${printingId === o._id ? "opacity-50 cursor-not-allowed" : ""
                                  }`}
                                title="Print All (Invoice + Barcode + Card)"
                              >
                                <Layers className="w-4 h-4" />
                              </button>

                              {/* Removed spreadsheet icon from action column */}

                              {/* Open WhatsApp web with pre-filled message (uses party's phone from Account Master) */}
                              <a
                                href={getWhatsAppUrl(o)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2.5 bg-[#25D366] text-white rounded-full hover:bg-[#20b857] transition-colors duration-200 inline-flex items-center justify-center"
                                title={`Open WhatsApp for ${o?.partyData?.partyAccount || 'party'}${Number(o.dueAmount) > 0 ? ` — ₹${roundAmount(o.dueAmount)} due` : ' — No pending amount'}`}
                              >
                                <FaWhatsapp className="w-4 h-4" />
                              </a>

                            </div>
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {expandedRow === idStr && (
                          <>
                            {/* FIRST TR — Items table */}
                            <tr>
                              <td colSpan={17} className="bg-slate-50 p-4">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full table-fixed text-sm">
                                    <thead>
                                      <tr className="bg-white">
                                        <th className="py-2 px-3 text-center font-medium">
                                          Item Name
                                        </th>
                                        <th className="py-2 px-3 text-center font-medium">Eye</th>
                                        <th className="py-2 px-3 text-center font-medium">Sph</th>
                                        <th className="py-2 px-3 text-center font-medium">Cyl</th>
                                        <th className="py-2 px-3 text-center font-medium">Axis</th>
                                        <th className="py-2 px-3 text-center font-medium">Add</th>
                                        <th className="py-2 px-3 text-center font-medium min-w-[150px]">Remark</th>
                                        <th className="py-2 px-3 text-center font-medium">
                                          Qty
                                        </th>
                                        <th className="py-2 px-3 text-center font-medium">
                                          Sale Price
                                        </th>
                                        <th className="py-2 px-3 text-center font-medium">
                                          Discount
                                        </th>
                                        <th className="py-2 px-3 text-center font-medium">
                                          Total
                                        </th>
                                        <th className="min-w-[150px]">Item Status</th>
                                        <th className="py-2 px-3 text-center font-medium">
                                          Select
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Array.isArray(o.items) &&
                                        o.items.length > 0 ? (
                                        o.items.map((item, idx) => (
                                          <tr
                                            key={item._id || idx}
                                            className="even:bg-white odd:bg-slate-50"
                                          >
                                            <td className="py-2 px-3 text-center">
                                              {item.itemName || "-"}
                                            </td>
                                            <td className="py-2 px-3 text-center">{item.eye || "-"}</td>
                                            <td className="py-2 px-3 text-center">{item.sph ?? "-"}</td>
                                            <td className="py-2 px-3 text-center">{item.cyl ?? "-"}</td>
                                            <td className="py-2 px-3 text-center">{item.axis ?? "-"}</td>
                                            <td className="py-2 px-3 text-center">{item.add ?? "-"}</td>
                                            <td className="py-2 px-3 text-center min-w-[150px]">
                                              <textarea
                                                defaultValue={item.remark || ""}
                                                disabled={isReadOnly}
                                                onBlur={(e) => {
                                                  if (!isReadOnly && e.target.value !== (item.remark || "")) {
                                                    handleUpdateItemRemark(o._id, item._id, e.target.value);
                                                  }
                                                }}
                                                placeholder={isReadOnly ? "" : "Remark"}
                                                className={`bg-transparent text-center border-b border-transparent focus:border-blue-500 focus:outline-none transition-colors w-full resize-none min-h-[1.5rem] overflow-hidden leading-tight ${isReadOnly ? "cursor-not-allowed opacity-60" : ""}`}
                                                onInput={(e) => {
                                                  e.target.style.height = "auto";
                                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                                }}
                                              />
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {item.qty ?? "-"}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {formatPrice(item.salePrice ?? 0)}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {item.discount ?? 0}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {formatPrice(
                                                item.totalAmount ?? 0
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              <StatusDropdown
                                                currentStatus={item.itemStatus || "Pending"}
                                                disabled={isReadOnly}
                                                onStatusChange={(status) =>
                                                  !isReadOnly && handleItemStatusChange(o._id, item._id, status)
                                                }
                                              />
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {!item.isInvoiced ? (
                                                  <input
                                                    type="checkbox"
                                                    disabled={isReadOnly}
                                                    checked={selectedItems.some(
                                                      (i) => i._id === item._id
                                                    )}
                                                    onChange={(e) =>
                                                      !isReadOnly && handleSelect(item, e.target.checked)
                                                    }
                                                    className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isReadOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                                  />
                                              ) : (
                                                <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">
                                                  Invoiced
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan={13}
                                            className="p-3 text-center text-slate-500"
                                          >
                                            No items available
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>



                            <tr>
                              <td
                                colSpan={17}
                                className="bg-slate-50 py-4 px-6 border-t text-right"
                              >
                                  <button
                                    onClick={() => !isReadOnly && handleCreateInvoice(o)}
                                    disabled={isReadOnly}
                                    className={`px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-200 ${isReadOnly ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:shadow-md hover:bg-blue-700"}`}
                                  >
                                    {isReadOnly ? "Locked" : "Create Invoice"}
                                  </button>
                              </td>
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {filteredChallans.length > 0 && (
                <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-t-2 border-slate-300">
                  <tr className="divide-x divide-slate-200">
                    <td
                      colSpan={Object.keys(visibleColumns).filter(k => visibleColumns[k]).indexOf("netAmt")}
                      className="py-4 px-3 text-right text-slate-700 uppercase tracking-wider text-sm font-black"
                    >
                      Grand Totals:
                    </td>
                    {visibleColumns.netAmt && (
                      <td className="text-center py-4 px-3 text-slate-900 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                        {formatPrice(grandTotals.netAmt)}
                      </td>
                    )}
                    {/* Columns between netAmt and ordQ */}
                    {(["usedIn", "status", "time"].filter(k => visibleColumns[k])).length > 0 && (
                      <td
                        colSpan={["usedIn", "status", "time"].filter(k => visibleColumns[k]).length}
                        className="bg-slate-50/50"
                      ></td>
                    )}
                    {visibleColumns.ordQ && (
                      <td className="text-center py-4 px-3 text-blue-600 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                        {grandTotals.ordQ}
                      </td>
                    )}
                    {visibleColumns.usdQ && (
                      <td className="text-center py-4 px-3 text-emerald-600 text-lg font-black underline decoration-double decoration-emerald-500 underline-offset-4">
                        {grandTotals.usdQ}
                      </td>
                    )}
                    {visibleColumns.balQ && (
                      <td className="text-center py-4 px-3 text-red-600 text-lg font-black underline decoration-double decoration-red-500 underline-offset-4">
                        {grandTotals.balQ}
                      </td>
                    )}
                    {/* Columns after balQ (deliveryPerson, reason) and Action */}
                    <td
                      colSpan={
                        (["deliveryPerson", "reason"].filter(k => visibleColumns[k]).length) + 1
                      }
                      className="bg-slate-50/50"
                    ></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
      {/* Print Modal with Custom Message */}
      {printModalOpen && selectedChallanForPrint && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
              <h3 className="text-white font-bold text-lg">Print Sale Challan</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Custom Message (Appears under NEW ITEM RECEIVED)
              </label>
              <textarea
                value={printCustomMessage}
                onChange={(e) => setPrintCustomMessage(e.target.value)}
                placeholder="Enter custom message before printing..."
                className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-slate-700"
                autoFocus
              ></textarea>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    generateNormalPrint(selectedChallanForPrint, "");
                    setPrintModalOpen(false);
                    setSelectedChallanForPrint(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("lastCustomPrintMessage", printCustomMessage);
                    generateNormalPrint(selectedChallanForPrint, printCustomMessage);
                    setPrintModalOpen(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                >
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
  );
}

export default SaleChallan;
