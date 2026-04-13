import React, { useState, useMemo, useEffect, useRef } from "react";
import { printBarcodeStickers } from "../utils/BarcodeStickerHelper";
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
  Filter,
  Check,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getAllLensPurchase,
  removeLensPurchase,
  updateLensPurchaseDcId
} from "../controllers/LensPurchase.controller";
import {
  getAllRxPurchase,
  removeRxPurchase,
  updateRxPurchaseDcId
} from "../controllers/RxPurchase.controller";
import { createChallanFromInvoice } from "../controllers/LensPurchaseChallan.controller";
import { getAllAccounts } from "../controllers/Account.controller";
import { Toaster, toast } from "react-hot-toast";
import StatusDropdown from "../Components/StatusDropdown";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import { getAllItems } from "../controllers/itemcontroller";

import * as XLSX from "xlsx";
import { roundAmount } from "../utils/amountUtils";
import { numberToWords } from "../utils/numberToWords";
function LensPurchaseInvoice() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [purchases, setPurchases] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedItemsByOrder, setSelectedItemsByOrder] = useState({});
  const [dcIds, setDcIds] = useState({});
  const [allLenses, setAllLenses] = useState([]);
  const [allItems, setAllItems] = useState([]);

  const [selectedStatuses, setSelectedStatuses] = useState(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);
  const STATUS_OPTIONS = ["Pending", "In Progress", "Done", "Cancelled", "On Approval"];

  useEffect(() => {
    const initialDcIds = {};
    purchases.forEach(o => {
      initialDcIds[o._id] = o.dcId || "";
    });
    setDcIds(initialDcIds);
  }, [purchases]);

  const handleDcIdChange = (id, value) => {
    setDcIds(prev => ({ ...prev, [id]: value }));
  };

  const handleDcIdBlur = async (id) => {
    const value = dcIds[id];
    // check if it's lens purchase or rx purchase
    const inv = purchases.find(p => p._id === id);
    if (!inv) return;
    try {
      let res;
      if (inv.orderType === 'RX' || inv.raw?.orderType === 'RX') {
        res = await updateRxPurchaseDcId(id, value);
      } else {
        res = await updateLensPurchaseDcId(id, value);
      }

      if (res.success) {
        toast.success("DC ID saved");
        setPurchases(prev => prev.map(c => c._id === id ? { ...c, dcId: value } : c));
      } else {
        toast.error(res.error || "Failed to save DC ID");
      }
    } catch (err) {
      toast.error("Error saving DC ID");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      let lensData = [];
      let rxData = [];

      const lensRes = await getAllLensPurchase();
      lensData = lensRes?.data || [];

      const rxRes = await getAllRxPurchase();
      rxData = rxRes?.data || [];

      setPurchases([...lensData, ...rxData]);

      try {
        const accRes = await getAllAccounts();
        setAccounts(Array.isArray(accRes) ? accRes : []);
      } catch (err) {
        console.error("Failed to fetch accounts", err);
      }
    };
    const fetchMasterData = async () => {
      try {
        const [lensMasterRes, itemMasterRes] = await Promise.all([
          getAllLensPower(),
          getAllItems(),
        ]);
        setAllLenses(lensMasterRes?.data || []);
        const itemsArray = Array.isArray(itemMasterRes) 
          ? itemMasterRes 
          : (itemMasterRes?.items || itemMasterRes?.data || []);
        setAllItems(itemsArray);
      } catch (err) {
        console.error("Error fetching master data:", err);
      }
    };
    fetchData();
    fetchMasterData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target)) {
        setShowStatusFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddPurchase = () => {
    navigate("/lenstransaction/purchase/AddLensPurchase");
  };

  const handleEdit = (invoice) => {
    const type = invoice.raw?.orderType || "LENS";
    const id = invoice._id;
    navigate(
      type === "RX"
        ? `/rxtransaction/rxpurchase/addRxPurchaseInvoice/${id}`
        : `/lenstransaction/purchase/AddLensPurchase/${id}`
    );
  };

  const handleReset = () => {
    setSearchText("");
    setDateFrom(today);
    setDateTo(today);
    setSelectedStatuses(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  };

  const handleDownloadExcel = () => {
    if (visibleInvoices.length === 0) {
      return toast.error("No data to export");
    }
    const exportData = visibleInvoices.map((inv, index) => ({
      "Sr No.": index + 1,
      "Bill Date": formatDate(inv.billDate),
      "Bill Series": inv.billSeries || "-",
      "Bill No.": inv.billNo || "-",
      "Party Name": inv.partyName || "-",
      "DC ID": inv.dcId || "-",
      "Net Amount": inv.netAmount || 0,
      "Paid Amount": inv.paidAmount || 0,
      "Due Amount": inv.dueAmount || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Invoices");
    XLSX.writeFile(workbook, "PurchaseInvoices.xlsx");
  };

  const handlePrintTable = () => {
    if (visibleInvoices.length === 0) {
      return toast.error("No data to print");
    }

    const printWindow = window.open("", "_blank");
    const tableRows = visibleInvoices.map((inv, index) => `
      <tr>
        <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${formatDate(inv.billDate)}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.billSeries || "-"}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.billNo || "-"}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${inv.partyName || "-"}</td>
        <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.dcId || "-"}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${roundAmount(inv.netAmount || 0)}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${roundAmount(inv.paidAmount || 0)}</td>
        <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${roundAmount(inv.dueAmount || 0)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Invoice Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 14px; font-weight: bold; }
            td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Purchase Invoice Report</h1>
          <table>
            <thead>
              <tr>
                <th>Sr No.</th>
                <th>Bill Date</th>
                <th>Bill Series</th>
                <th>Bill No.</th>
                <th>Party Name</th>
                <th>DC ID</th>
                <th>Net Amount</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleDelete = async (invoice) => {
    if (!window.confirm("Are you sure?")) return;
    const type = invoice.raw?.orderType || "LENS";
    const id = invoice._id;

    const res =
      type === "RX"
        ? await removeRxPurchase(id)
        : await removeLensPurchase(id);

    if (res.success) {
      toast.success("Purchase deleted successfully!");
      const lensRes = await getAllLensPurchase();
      const rxRes = await getAllRxPurchase();
      setPurchases([...(lensRes?.data || []), ...(rxRes?.data || [])]);
    } else {
      toast.error(res.error || "Failed to delete");
    }
  };

  const handleCreateChallan = async (invoice) => {
    try {
      const idStr = getId(invoice._id);
      const selectedItemIds = selectedItemsByOrder[idStr] || [];
      const itemsToUse = selectedItemIds.length > 0
        ? (invoice.items || []).filter(it => selectedItemIds.includes(it._id))
        : (invoice.items || []);

      const payload = {
        invoiceId: invoice._id,
        billData: invoice.billData || {},
        partyData: invoice.partyData || {},
        items: itemsToUse,
        taxes: invoice.taxes || [],
        grossAmount: invoice.grossAmount || 0,
        subtotal: invoice.subtotal || 0,
        taxesAmount: invoice.taxesAmount || 0,
        netAmount: invoice.netAmount || 0,
        paidAmount: invoice.paidAmount || 0,
        dueAmount: invoice.dueAmount || 0,
        deliveryDate: invoice.deliveryDate || Date.now(),
        remark: invoice.remark || "",
        status: invoice.status || "Pending",
      };

      const res = await createChallanFromInvoice(payload);
      if (res.success) {
        toast.success("Challan created successfully from invoice!");
        setSelectedItemsByOrder(prev => ({ ...prev, [idStr]: [] }));
        navigate("/lenstransaction/purchase/purchasechallan");
      } else {
        toast.error(res.error || "Failed to create challan");
      }
    } catch (err) {
      toast.error("Error creating challan: " + err.message);
    }
  };

  const formatPrice = (price) => `₹${roundAmount(price || 0)}`;
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB");
  };

  const invoicesFromDB = useMemo(() => {
    let filtered = purchases || [];

    return filtered.map((lp) => {
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
          : Number(roundAmount(netAmount - paidAmount));
      const remark = lp?.remark || "";
      const status = lp?.status || "";
      const dcId = lp?.dcId || "";

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
        dcId,
        items: lp.items || [],
        raw: lp,
      };
    });
  }, [purchases]);

  const visibleInvoices = useMemo(() => {
    let filtered = invoicesFromDB.slice();
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter((inv) => {
        const fields =
          `${inv.billSeries} ${inv.partyName} ${inv.billNo} `.toLowerCase();
        return fields.includes(q);
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (inv) => inv.billDate && new Date(inv.billDate) <= to
      );
    }
    // Status Filtering
    filtered = filtered.filter((o) => {
      const orderStatus = o.status || "Pending";
      return selectedStatuses.some(s => {
        const sClean = s.toLowerCase().replace(/[- ]/g, '');
        const oClean = orderStatus.toLowerCase().replace(/[- ]/g, '');
        return sClean === oClean;
      });
    });
    return filtered;
  }, [invoicesFromDB, searchText, dateFrom, dateTo, selectedStatuses]);

  const grandTotals = useMemo(() => {
    return visibleInvoices.reduce(
      (acc, inv) => {
        acc.netAmount += Number(inv.netAmount || 0);
        acc.paidAmount += Number(inv.paidAmount || 0);
        acc.dueAmount += Number(inv.dueAmount || 0);
        return acc;
      },
      { netAmount: 0, paidAmount: 0, dueAmount: 0 }
    );
  }, [visibleInvoices]);

  // helper to get string id (works with Mongo ObjectId or plain string)
  const getId = (id) => {
    if (!id && id !== 0) return null;
    if (typeof id === "object" && id !== null) return id.$oid || String(id);
    return String(id);
  };

  const handleToggleItem = (orderId, itemId, isChecked) => {
    setSelectedItemsByOrder((prev) => {
      const currentSelected = prev[orderId] || [];
      if (isChecked) {
        return { ...prev, [orderId]: [...currentSelected, itemId] };
      } else {
        return {
          ...prev,
          [orderId]: currentSelected.filter((id) => id !== itemId),
        };
      }
    });
  };

  const handleSelectAllItems = (orderId, items, isChecked) => {
    if (isChecked) {
      const availableItemIds = items
        .filter(it => it.itemStatus !== "Done")
        .map(it => it._id);
      setSelectedItemsByOrder(prev => ({
        ...prev,
        [orderId]: availableItemIds
      }));
    } else {
      setSelectedItemsByOrder(prev => ({
        ...prev,
        [orderId]: []
      }));
    }
  };

  const handleInfo = (id) => {
    const idStr = getId(id);
    setExpandedRow((prev) => (prev === idStr ? null : idStr)); // toggle row
  };

  const getWhatsAppItemName = (item) => {
    if (item.vendorItemName) return item.vendorItemName;
    
    const target = (item.itemName || "").trim().toLowerCase();
    if (!target) return item.itemName || "-";

    // Search in Lenses
    const foundLens = allLenses.find(l => 
      (l.productName || "").trim().toLowerCase() === target
    );
    if (foundLens && foundLens.vendorItemName) return foundLens.vendorItemName;

    // Search in General Items
    const foundItem = allItems.find(i => 
      (i.itemName || "").trim().toLowerCase() === target
    );
    if (foundItem && foundItem.vendorItemName) return foundItem.vendorItemName;

    return item.itemName || "-";
  };

  const handleShareWhatsApp = (order) => {
    const mobile = order.raw?.partyData?.contactNumber || "";
    if (!mobile) {
      toast.error("Contact number not found for this vendor");
      return;
    }

    let typeLabel = "Purchase Invoice";
    if (order.raw?.orderType === "RX") typeLabel = "Rx Purchase Invoice";
    else if (order.raw?.orderType === "CONTACT") typeLabel = "Contact Lens Purchase Invoice";

    let message = `*Transaction Type:* ${typeLabel}\n`;
    message += `*Party Name:* ${order.partyName || "-"}\n\n`;

    (order.items || []).forEach((item, index) => {
      const displayItemName = getWhatsAppItemName(item);
      message += `*Item ${index + 1}:* ${displayItemName}\n`;
      message += `*Order No:* ${item.orderNo || order.billNo || "-"}\n`;
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
    let totalQty = 0;
    let totalDisc = 0;
    const itemsHTML = (invoice.items || [])
      .map(
        (item, i) => {
          totalQty += (Number(item.qty) || 0);
          totalDisc += (Number(item.discount) || 0);

          let challanNo = "-";
          if (item.challanNo) challanNo = item.challanNo;
          else if (invoice.raw?.sourceChallanId?.billData?.billNo) challanNo = invoice.raw.sourceChallanId.billData.billNo;
          else if (invoice.sourceChallanId?.billData?.billNo) challanNo = invoice.sourceChallanId.billData.billNo;
          else if (typeof invoice.sourceChallanId === 'string' && invoice.sourceChallanId) challanNo = invoice.sourceChallanId.slice(-4);
          
          let challanDate = "-";
          if (item.challanDate) challanDate = formatDate(item.challanDate);
          else if (invoice.raw?.sourceChallanId?.billData?.date) challanDate = formatDate(invoice.raw.sourceChallanId.billData.date);
          else if (invoice.sourceChallanId?.billData?.date) challanDate = formatDate(invoice.sourceChallanId.billData.date);
          else challanDate = formatDate(invoice.billDate);

          return `
      <tr>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${i + 1}</td>
        <td style="border: 1px solid #000; padding: 8px;">${getWhatsAppItemName(item)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.orderNo || invoice.raw?.sourcePurchaseId?.orderNo || "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${challanDate}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${challanNo}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.eye || "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.sph ?? "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.cyl ?? "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.axis ?? "0"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.add ?? "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty || 0}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatPrice(item.purchasePrice || 0)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatPrice(item.discount || 0)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatPrice(item.totalAmount || 0)}</td>
      </tr>
    `})
      .join("");

    const series = invoice.billSeries || "-";
    const billNo = invoice.billNo || "-";
    const partyName = invoice.partyName || "-";

    const account = accounts.find(a => a.Name?.toLowerCase() === partyName?.toLowerCase());
    const address = invoice.raw?.partyData?.address || account?.Address || "";
    const city = invoice.raw?.partyData?.city || account?.City || "";
    const state = invoice.raw?.partyData?.state || invoice.raw?.partyData?.stateCode || account?.State || "";
    const mobile = invoice.raw?.partyData?.contactNumber || account?.Phone || "";

    const billDate = formatDate(invoice.billDate);
    const netAmt = Number(invoice.netAmount || 0);
    const paidAmt = Number(invoice.paidAmount || 0);
    const dueAmt = Number(invoice.dueAmount || 0);

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
    const totalBalValueSigned = prevBalValueSigned + dueAmt;

    const prevBalStr = Math.abs(prevBalValueSigned).toFixed(2) + (prevBalValueSigned >= 0 ? " Dr" : " Cr");
    const totalBalStr = Math.abs(totalBalValueSigned).toFixed(2) + (totalBalValueSigned >= 0 ? " Dr" : " Cr");

    const numberToWordsString = numberToWords(netAmt);

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Invoice ${series}-${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; font-size: 15px; }
            .header { text-align: center; position: relative; display: flex; align-items: center; justify-content: center; height: 100px; }
            .header h1 { margin: 0; font-size: 32px; font-weight: bold; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/sadguru_logo.svg" style="height: 85px; object-fit: contain; position: absolute; left: 0;" alt="Sadguru Logo" />
            <h1>PURCHASE INVOICE</h1>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 10px 0; margin-bottom: 15px;">
            <div style="flex: 1;">
              <table style="width: 100%; border: none; margin: 0; font-size: 14px;">
                <tr><td style="padding: 2px 5px 2px 0; width: 100px; font-weight: bold;">Party Name</td><td style="padding: 2px 0;">: ${partyName}</td></tr>
                ${address ? "<tr><td style='padding: 2px 5px 2px 0; font-weight: bold;'>Address</td><td style='padding: 2px 0;'>: " + address + (city ? ", " + city : "") + "</td></tr>" : ""}
                ${state ? "<tr><td style='padding: 2px 5px 2px 0; font-weight: bold;'>State</td><td style='padding: 2px 0;'>: " + state + "</td></tr>" : ""}
                ${mobile ? "<tr><td style='padding: 2px 5px 2px 0; font-weight: bold;'>Mobile</td><td style='padding: 2px 0;'>: " + mobile + "</td></tr>" : ""}
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
                <th style="border: 1px solid #000; padding: 6px;">Sr No</th>
                <th style="border: 1px solid #000; padding: 6px;">Item Name</th>
                <th style="border: 1px solid #000; padding: 6px;">Order No</th>
                <th style="border: 1px solid #000; padding: 6px;">Challan Date</th>
                <th style="border: 1px solid #000; padding: 6px;">Challan No</th>
                <th style="border: 1px solid #000; padding: 6px;">Eye</th>
                <th style="border: 1px solid #000; padding: 6px;">Sph</th>
                <th style="border: 1px solid #000; padding: 6px;">Cyl</th>
                <th style="border: 1px solid #000; padding: 6px;">Axis</th>
                <th style="border: 1px solid #000; padding: 6px;">Add</th>
                <th style="border: 1px solid #000; padding: 6px;">Qty</th>
                <th style="border: 1px solid #000; padding: 6px;">Purchase Price</th>
                <th style="border: 1px solid #000; padding: 6px;">Disc</th>
                <th style="border: 1px solid #000; padding: 6px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
              <tr>
                <td colspan="10" style="text-align: center; border: 1px solid #000; padding: 6px; font-weight: bold;">Total</td>
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
            <p>${invoice.remark || ""}</p>
            <p>This is a computer-generated purchase invoice</p>
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

   const generateBarcodePrint = (invoice) => {
    printBarcodeStickers(invoice.raw || invoice, allLenses, allItems, true);
  };

  const generateCardPrint = (invoice) => {
    printAuthenticityCard(invoice.raw || invoice, allLenses, allItems);
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Purchase Invoice
          </h1>

          <button
            onClick={() => navigate("/lenstransaction/purchase/AddLensPurchase")}
          >
            Add Purchase
          </button>

          <p className="text-slate-600">
            Manage purchase invoices and payments
          </p>
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
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Search
              </label>
            </div>
            <div className="lg:col-span-2 relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Date From
              </label>
            </div>
            <div className="lg:col-span-2 relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-0 focus:border-blue-500 transition-all duration-200 outline-none text-sm"
              />
              <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">
                Date To
              </label>
            </div>
            <div className="lg:col-span-4 flex flex-wrap justify-start gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                onClick={handleAddPurchase}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <Plus className="w-3.5 h-3.5" /> Add Purchase
              </button>
              <button
                onClick={handleDownloadExcel}
                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors duration-200 hover:shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrintTable}
                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 hover:shadow-sm"
              >
                <Printer className="w-4 h-4" />
              </button>

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
                  <th className="min-w-[110px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill Date
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill Series
                  </th>
                  <th className="min-w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Bill No.
                  </th>
                  <th className="min-w-[180px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Party Name
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    DC ID
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Net Amount
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Paid Amount
                  </th>
                  <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Due Amount
                  </th>

                  <th className="w-[160px] text-center py-4 px-3 text-slate-700 font-bold text-sm">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {visibleInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="p-10 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="w-12 h-12 text-slate-300" />
                        <p className="text-xl">No invoices found</p>
                        <p className="text-md">
                          Try adjusting your filters or add a new purchase
                          invoice
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleInvoices.map((invoice, index) => {
                    const idStr = getId(invoice._id);
                    return (
                      <React.Fragment key={idStr || index}>
                        <tr className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                          <td className="text-center text-slate-600 font-medium py-4 px-2">
                            {index + 1}
                          </td>
                          <td className="text-center text-slate-700 py-4 px-3">
                            {formatDate(invoice.billDate)}
                          </td>
                          <td className="text-center py-4 px-3">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {invoice.billSeries || "-"}
                            </span>
                          </td>
                          <td className="text-center text-slate-800 font-semibold py-4 px-3">
                            {invoice.billNo || "-"}
                          </td>
                          <td className="text-center text-slate-800 py-4 px-3">
                            <div className="font-medium">
                              {invoice.partyName || "-"}
                            </div>
                          </td>
                          <td className="py-2 border-gray-300 border-r px-2 align-top text-center">
                            <textarea
                              className="w-[100px] min-h-[40px] border border-gray-300 rounded p-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 overflow-hidden break-words"
                              value={dcIds[idStr] || ""}
                              onChange={(e) => {
                                handleDcIdChange(idStr, e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              onBlur={() => handleDcIdBlur(idStr)}
                              placeholder="DC ID"
                              rows={1}
                            />
                          </td>
                          <td className="text-center text-slate-900 font-bold py-4 px-3">
                            {formatPrice(invoice.netAmount || 0)}
                          </td>
                          <td className="text-center text-green-700 font-semibold py-4 px-3">
                            {formatPrice(invoice.paidAmount || 0)}
                          </td>
                          <td className="text-center py-4 px-3">
                            <span
                              className={`font - bold ${invoice.dueAmount > 0
                                ? "text-red-600"
                                : "text-green-600"
                                } `}
                            >
                              {formatPrice(invoice.dueAmount || 0)}
                            </span>
                          </td>

                          <td className="py-4 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleInfo(invoice._id)}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors duration-200"
                                title="Info"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEdit(invoice)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(invoice)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                title="Delete"
                              >
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
                              <button
                                onClick={() => handleCreateChallan(invoice)}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200"
                                title="Create Challan"
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleShareWhatsApp(invoice)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                                title="Share via WhatsApp"
                              >
                                <FaWhatsapp className="w-3.5 h-3.5" />
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
                                      <th className="py-2 px-3 text-center font-medium">
                                        Item Name
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Unit
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Order No
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Eye
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Sph
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Cyl
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Add
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Qty
                                      </th>
                                      <th className="py-2 px-3 text-center font-medium">
                                        Purchase Price
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
                                      <th className="py-2 px-3 text-center font-medium">
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="text-[10px] uppercase font-bold text-slate-500">Select</span>
                                          <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                                            onChange={(e) => handleSelectAllItems(idStr, invoice.items || [], e.target.checked)}
                                            checked={
                                              (invoice.items || []).length > 0 &&
                                              (invoice.items || []).filter(it => it.itemStatus !== "Done").every(it =>
                                                (selectedItemsByOrder[idStr] || []).includes(it._id)
                                              )
                                            }
                                          />
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.isArray(invoice.items) &&
                                      invoice.items.length > 0 ? (
                                      invoice.items.map((item, i) => (
                                        <tr
                                          key={item._id?.$oid || item._id || i}
                                          className="even:bg-white odd:bg-slate-50"
                                        >
                                          <td className="py-2 px-3 text-center">
                                            {item.itemName || "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.unit || "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.orderNo || "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.eye || "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.sph ?? "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.cyl ?? "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.add ?? "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.qty ?? "-"}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {formatPrice(
                                              item.purchasePrice ?? 0
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {formatPrice(item.salePrice ?? 0)}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.discount ?? 0}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {formatPrice(item.totalAmount ?? 0)}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <input
                                              type="checkbox"
                                              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                              checked={(selectedItemsByOrder[idStr] || []).includes(item._id)}
                                              onChange={(e) => handleToggleItem(idStr, item._id, e.target.checked)}
                                              disabled={item.itemStatus === "Done"}
                                            />
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan="13"
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
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {visibleInvoices.length > 0 && (
                <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] border-t-2 border-slate-300">
                  <tr className="divide-x divide-slate-200">
                    <td
                      colSpan={6}
                      className="py-4 px-3 text-right text-slate-700 uppercase tracking-wider text-sm font-black"
                    >
                      Grand Totals:
                    </td>
                    <td className="text-center py-4 px-3 text-slate-900 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                      {formatPrice(grandTotals.netAmount)}
                    </td>
                    <td className="text-center py-4 px-3 text-green-700 text-lg font-black underline decoration-double decoration-green-500 underline-offset-4">
                      {formatPrice(grandTotals.paidAmount)}
                    </td>
                    <td className="text-center py-4 px-3 text-red-600 text-lg font-black underline decoration-double decoration-red-500 underline-offset-4">
                      {formatPrice(grandTotals.dueAmount)}
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

export default LensPurchaseInvoice;
