import React, { useState, useMemo, useEffect, useRef } from "react";
import { printBarcodeStickers } from "../utils/BarcodeStickerHelper";
import { printAuthenticityCard } from "../utils/AuthenticityCardHelper";
import { useLocation, useNavigate } from "react-router-dom";
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
  BoxesIcon,
  Barcode,
  CreditCard,
  Layers,
  Check,
  Eye,
  EyeOff,
  Filter,
} from "lucide-react";

import { getAllLensSale, removeLensSale, updateSaleInvoiceStatus, updateLensInvoiceItemStatus, updateLensSaleItemRemark, updateDeliveryPerson } from "../controllers/LensSale.controller";
import { getAllRxSale, removeRxSale, updateRxSaleStatus, updateRxSaleItemRemark, updateRxDeliveryPerson } from "../controllers/RxSale.contoller";
import { createChallanFromInvoice } from "../controllers/LensSaleChallan.controller";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import { getAllItems } from "../controllers/itemcontroller";
import { Toaster, toast } from "react-hot-toast";
import StatusDropdown from "../Components/StatusDropdown";
import * as XLSX from "xlsx";
import { roundAmount } from "../utils/amountUtils";
import { numberToWords } from "../utils/numberToWords";

function LensSaleInvoice() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [LensSales, setSales] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [allLenses, setAllLenses] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [updatingDeliveryPersonId, setUpdatingDeliveryPersonId] = useState(null);

  // Print Modal State for normal print custom message
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);
  const [printCustomMessage, setPrintCustomMessage] = useState("");

  const [visibleColumns, setVisibleColumns] = useState({
    srNo: true,
    billDate: true,
    billSeries: true,
    billNo: true,
    partyName: true,
    netAmount: true,
    paidAmount: true,
    dueAmount: true,
    time: true,
    deliveryPerson: true,
    actions: true,
  });
  const [showColumnFilter, setShowColumnFilter] = useState(false);

  const [selectedStatuses, setSelectedStatuses] = useState(["Pending", "In Progress", "Done", "Cancelled", "On Approval"]);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);
  const columnFilterRef = useRef(null);

  const STATUS_OPTIONS = ["Pending", "In Progress", "Done", "Cancelled", "On Approval"];

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const lensRes = await getAllLensSale();
        const lensData = (lensRes?.data || []).map(item => ({ ...item, orderType: "LENS" }));

        const rxRes = await getAllRxSale();
        const rxData = (rxRes?.data || []).map(item => ({ ...item, orderType: "RX" }));

        setSales([...lensData, ...rxData]);

        const accRes = await getAllAccounts();
        setAccounts(Array.isArray(accRes) ? accRes : []);

        const [lensesRes, itemsRes] = await Promise.all([
          getAllLensPower(),
          getAllItems()
        ]);
        setAllLenses(Array.isArray(lensesRes?.data) ? lensesRes.data : (Array.isArray(lensesRes) ? lensesRes : []));
        setAllItems(Array.isArray(itemsRes?.items) ? itemsRes.items : (Array.isArray(itemsRes) ? itemsRes : []));
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };

    fetchData();
  }, []);

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
    const exportData = visibleInvoices.map((inv, index) => {
      const row = {};
      if (visibleColumns.srNo) row["Sr No."] = index + 1;
      if (visibleColumns.billDate) row["Bill Date"] = formatDate(inv.billDate);
      if (visibleColumns.billSeries) row["Bill Series"] = inv.billSeries || "-";
      if (visibleColumns.billNo) row["Bill No."] = inv.billNo || "-";
      if (visibleColumns.partyName) row["Party Name"] = inv.partyName || "-";
      if (visibleColumns.netAmount) row["Net Amount"] = inv.netAmount || 0;
      if (visibleColumns.paidAmount) row["Paid Amount"] = inv.paidAmount || 0;
      if (visibleColumns.dueAmount) row["Due Amount"] = inv.dueAmount || 0;
      if (visibleColumns.time) row["Time"] = inv.time || "-";
      if (visibleColumns.deliveryPerson) row["Delivery Person"] = inv.deliveryPerson || "-";
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sale Invoices");
    XLSX.writeFile(workbook, "SaleInvoices.xlsx");
  };

  const handlePrintTable = () => {
    if (visibleInvoices.length === 0) {
      return toast.error("No data to print");
    }

    const printWindow = window.open("", "_blank");
    const tableHeader = Object.keys(visibleColumns)
      .filter(key => visibleColumns[key] && key !== 'actions')
      .map(key => {
        const labels = {
          srNo: "Sr No.",
          billDate: "Bill Date",
          billSeries: "Bill Series",
          billNo: "Bill No.",
          partyName: "Party Name",
          netAmount: "Net Amount",
          paidAmount: "Paid Amount",
          dueAmount: "Due Amount",
          time: "Time",
          deliveryPerson: "Delivery Person"
        };
        return `<th style="background-color: #f2f2f2; border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 14px; font-weight: bold;">${labels[key] || key}</th>`;
      })
      .join("");

    const tableRows = visibleInvoices.map((inv, index) => {
      let rowHtml = "<tr>";
      if (visibleColumns.srNo) rowHtml += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${index + 1}</td>`;
      if (visibleColumns.billDate) rowHtml += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${formatDate(inv.billDate)}</td>`;
      if (visibleColumns.billSeries) rowHtml += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.billSeries || "-"}</td>`;
      if (visibleColumns.billNo) rowHtml += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.billNo || "-"}</td>`;
      if (visibleColumns.partyName) rowHtml += `<td style="border: 1px solid #ddd; padding: 8px;">${inv.partyName || "-"}</td>`;
      if (visibleColumns.netAmount) rowHtml += `<td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${roundAmount(inv.netAmount || 0)}</td>`;
      if (visibleColumns.paidAmount) rowHtml += `<td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${roundAmount(inv.paidAmount || 0)}</td>`;
      if (visibleColumns.dueAmount) rowHtml += `<td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${roundAmount(inv.dueAmount || 0)}</td>`;
      if (visibleColumns.time) rowHtml += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.time || "-"}</td>`;
      if (visibleColumns.deliveryPerson) rowHtml += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${inv.deliveryPerson || "-"}</td>`;
      rowHtml += "</tr>";
      return rowHtml;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Sale Invoice Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Sale Invoice Report</h1>
          <table>
            <thead>
              <tr>
                ${tableHeader}
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

  const handleAddSale = () => {
    navigate("/lenstransaction/sale/AddLensSale");
  };

  const handleEdit = (invoice) => {
    const type = invoice.orderType || "LENS";
    const id = invoice._id;
    navigate(
      type === "LENS"
        ? `/lenstransaction/sale/AddLensSale/${id}`
        : `/rxtransaction/rxsale/addRxSale/${id}`
    );
  };

  const handleDelete = async (invoice) => {
    if (!window.confirm("Are you sure?")) return;
    const type = invoice.orderType || "LENS";
    const id = invoice._id;

    const res =
      type === "LENS"
        ? await removeLensSale(id)
        : await removeRxSale(id);

    if (res.success) {
      toast.success("Deleted successfully");
      setSales((prev) => prev.filter((x) => x._id !== id));
    }
  };

  const handleStatusChange = async (invoiceId, newStatus, orderType) => {
    setUpdatingStatusId(invoiceId);
    try {
      const res = orderType === "LENS"
        ? await updateSaleInvoiceStatus(invoiceId, newStatus)
        : await updateRxSaleStatus(invoiceId, newStatus);
      if (res.success) {
        setSales((prevSales) =>
          prevSales.map((sale) =>
            sale._id === invoiceId ? { ...sale, status: newStatus } : sale
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

  const handleItemStatusChange = async (invoiceId, itemId, newStatus) => {
    try {
      const res = await updateLensInvoiceItemStatus(invoiceId, [itemId], newStatus);
      if (res.success) {
        setSales(prev => prev.map(inv => {
          if (inv._id === invoiceId) {
            const updatedItems = inv.items.map(it =>
              String(it._id) === String(itemId) ? { ...it, itemStatus: newStatus } : it
            );
            return {
              ...inv,
              items: updatedItems,
              status: res.data.data.status // Derived status from backend
            };
          }
          return inv;
        }));
        toast.success("Item status updated");
      } else {
        toast.error(res.error || "Failed to update item status");
      }
    } catch (err) {
      toast.error("Error updating item status");
    }
  };

  const handleUpdateItemRemark = async (invoiceId, itemId, remark, orderType) => {
    try {
      const res = orderType === "LENS"
        ? await updateLensSaleItemRemark(invoiceId, itemId, remark)
        : await updateRxSaleItemRemark(invoiceId, itemId, remark);

      if (res.success) {
        setSales((prev) =>
          prev.map((s) => {
            if (s._id === invoiceId) {
              const updatedItems = s.items.map((it) =>
                String(it._id) === String(itemId) ? { ...it, remark } : it
              );
              return { ...s, items: updatedItems };
            }
            return s;
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

  const handleCreateChallan = async (invoice) => {
    try {
      const payload = {
        invoiceId: invoice._id,
        billData: invoice.billData || {},
        partyData: invoice.partyData || {},
        items: invoice.items || [],
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
      } else {
        toast.error(res.error || "Failed to create challan");
      }
    } catch (err) {
      toast.error("Error creating challan: " + err.message);
    }
  };

  const handleDeliveryPersonChange = async (invoiceId, value, orderType) => {
    setUpdatingDeliveryPersonId(invoiceId);
    try {
      const res = orderType === "LENS"
        ? await updateDeliveryPerson(invoiceId, value)
        : await updateRxDeliveryPerson(invoiceId, value);

      if (res.success) {
        setSales((prev) =>
          prev.map((s) => (s._id === invoiceId ? { ...s, deliveryPerson: value } : s))
        );
        toast.success("Delivery person updated");
      } else {
        toast.error(res.error || "Failed to update delivery person");
      }
    } catch (err) {
      toast.error("Error updating delivery person");
    } finally {
      setUpdatingDeliveryPersonId(null);
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
    return (LensSales || []).map((lp) => {
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
      const deliveryDate = lp?.deliveryDate || "";
      const time = lp?.time || "";
      const deliveryPerson = lp?.deliveryPerson || "";
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
        deliveryDate,
        time,
        deliveryPerson,
        orderType: lp.orderType,
        items: lp.items || [], // include items here for nested table
        raw: lp,
      };
    });
  }, [LensSales]);

  const visibleInvoices = useMemo(() => {
    let filtered = invoicesFromDB.slice();
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter((inv) => {
        const fields = `${inv.billSeries} ${inv.partyName} ${inv.billNo}`.toLowerCase();
        return fields.includes(q);
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((inv) => inv.billDate && new Date(inv.billDate) <= to);
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

  const handleInfo = (id) => {
    const idStr = getId(id);
    setExpandedRow((prev) => (prev === idStr ? null : idStr)); // toggle row
  };

  // Print functions
  const handleNormalPrintClick = (o) => {
    setSelectedInvoiceForPrint(o);
    setPrintCustomMessage(localStorage.getItem("lastCustomPrintMessage") || "");
    setPrintModalOpen(true);
  };

  // Print functions
  const generateNormalPrint = (invoice, customMessage = "") => {
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
        <td style="border: 1px solid #000; padding: 8px;">${getPrintItemName(item)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.orderNo || invoice.raw?.sourceSaleId?.orderNo || "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${challanDate}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${challanNo}</td>
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

    const customMessageHTML = customMessage ? `
              <div style="margin-top: 25px;">
                <p style="margin: 0; font-weight: bold; text-decoration: underline; font-size: 16px; text-align: left;">NEW ITEM RECEIVED</p>
                <p style="margin: 10px 0 0 0; font-weight: bold; font-style: italic; white-space: pre-wrap; font-size: 15px;">${customMessage}</p>
              </div>
    ` : "";

    const printWindow = window.open("", "", "height=900,width=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${series}-${billNo}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; font-size: 15px; }
            .header { text-align: center; position: relative; display: flex; align-items: center; justify-content: center; height: 100px; }
            .header h1 { margin: 0; font-size: 32px; font-weight: bold; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${window.location.origin}/sadguru_logo.svg" style="height: 85px; object-fit: contain; position: absolute; left: 0;" alt="Sadguru Logo" />
            <h1>INVOICE</h1>
            <div style="position: absolute; right: 0; text-align: right;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ orderId: getId(invoice._id), orderType: invoice.orderType === 'RX' ? 'rx' : 'lens' }))}&size=100x100" alt="Order QR Code" style="width: 80px; height: 80px; border: 1px solid #eee; padding: 4px;"/>
              <p style="font-size: 10px; margin: 2px 0 0 0; color: #666; text-align: center;">Scan for Delivery</p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 10px 0; margin-bottom: 15px;">
            <div style="flex: 1;">
              <table style="width: 100%; border: none; margin: 0; font-size: 14px;">
                <tr><td style="padding: 2px 5px 2px 0; width: 100px; font-weight: bold;">Party Name</td><td style="padding: 2px 0;">: ${partyName}</td></tr>
                ${address ? `<tr><td style="padding: 2px 5px 2px 0; font-weight: bold;">Address</td><td style="padding: 2px 0;">: ${address}${city ? ', ' + city : ''}</td></tr>` : ""}
                ${state ? `<tr><td style="padding: 2px 5px 2px 0; font-weight: bold;">State</td><td style="padding: 2px 0;">: ${state}</td></tr>` : ""}
                ${mobile ? `<tr><td style="padding: 2px 5px 2px 0; font-weight: bold;">Mobile</td><td style="padding: 2px 0;">: ${mobile}</td></tr>` : ""}
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
                <th style="border: 1px solid #000; padding: 6px;">Sale Price</th>
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
              
              ${customMessageHTML}
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
            <p>This is a computer-generated invoice</p>
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
    printBarcodeStickers(invoice.raw || invoice, allLenses, allItems);
  };

  const generateCardPrint = (invoice) => {
    printAuthenticityCard(invoice.raw || invoice, allLenses, allItems);
  };


  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">

      <div className="max-w-[98vw] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Lens Sale Invoice</h1>
          <p className="text-slate-600">Manage lens Sale invoices and payments</p>
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
              <button onClick={handleAddSale} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200">
                <Plus className="w-3.5 h-3.5" /> Add Sale
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
              <div className="relative">
                <button
                  onClick={() => setShowColumnFilter(!showColumnFilter)}
                  className={`p-2 rounded-lg transition-colors duration-200 hover:shadow-sm ${showColumnFilter ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  title="Toggle Columns"
                >
                  <Layers className="w-4 h-4" />
                </button>
                {showColumnFilter && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3" ref={columnFilterRef}>
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                      <span className="text-sm font-bold text-slate-800">Columns</span>
                      <div className="flex gap-2">
                        <button onClick={() => toggleAllColumns(true)} className="text-[10px] text-blue-600 hover:underline font-bold">ALL</button>
                        <button onClick={() => toggleAllColumns(false)} className="text-[10px] text-blue-600 hover:underline font-bold">NONE</button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                      {Object.keys(visibleColumns).map((key) => (
                        <div
                          key={key}
                          onClick={() => toggleColumn(key)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${visibleColumns[key] ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-400 font-medium"}`}
                        >
                          <span className="text-xs uppercase tracking-wider">{key.replace(/([A-Z])/g, " $1")}</span>
                          {visibleColumns[key] && <Check className="w-4 h-4 text-blue-600" />}
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
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.srNo && <th className="w-16 text-center py-4 px-3 text-slate-700 font-bold text-sm">Sr No.</th>}
                  {visibleColumns.billDate && <th className="min-w-[110px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Bill Date</th>}
                  {visibleColumns.billSeries && <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Bill Series</th>}
                  {visibleColumns.billNo && <th className="min-w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Bill No.</th>}
                  {visibleColumns.partyName && <th className="min-w-[180px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Party Name</th>}
                  {visibleColumns.netAmount && <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Net Amount</th>}
                  {visibleColumns.paidAmount && <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Paid Amount</th>}
                  {visibleColumns.dueAmount && <th className="min-w-[120px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Due Amount</th>}
                  {visibleColumns.time && <th className="min-w-[100px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Time</th>}
                  {visibleColumns.deliveryPerson && <th className="min-w-[150px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Delivery Person</th>}
                  {visibleColumns.actions && <th className="w-[160px] text-center py-4 px-3 text-slate-700 font-bold text-sm">Actions</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {visibleInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="p-10 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="w-12 h-12 text-slate-300" />
                        <p className="text-xl">No invoices found</p>
                        <p className="text-md">Try adjusting your filters or add a new sale invoice</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleInvoices.map((invoice, index) => {
                    const idStr = getId(invoice._id);
                    return (
                      <React.Fragment key={idStr || index}>
                        <tr className="hover:bg-slate-50 transition-colors duration-150 group text-sm">
                          {visibleColumns.srNo && <td className="text-center text-slate-600 font-medium py-4 px-2">{index + 1}</td>}
                          {visibleColumns.billDate && <td className="text-center text-slate-700 py-4 px-3">{formatDate(invoice.billDate)}</td>}
                          {visibleColumns.billSeries && (
                            <td className="text-center py-4 px-3">
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">{invoice.billSeries || "-"}</span>
                            </td>
                          )}
                          {visibleColumns.billNo && <td className="text-center text-slate-800 font-semibold py-4 px-3">{invoice.billNo || "-"}</td>}
                          {visibleColumns.partyName && <td className="text-center text-slate-800 py-4 px-3"><div className="font-medium">{invoice.partyName || "-"}</div></td>}
                          {visibleColumns.netAmount && <td className="text-center text-slate-900 font-bold py-4 px-3">{formatPrice(invoice.netAmount || 0)}</td>}
                          {visibleColumns.paidAmount && <td className="text-center text-green-700 font-semibold py-4 px-3">{formatPrice(invoice.paidAmount || 0)}</td>}
                          {visibleColumns.dueAmount && (
                            <td className="text-center py-4 px-3">
                              <span className={`font-bold ${invoice.dueAmount > 0 ? "text-red-600" : "text-green-600"} `}>{formatPrice(invoice.dueAmount || 0)}</span>
                            </td>
                          )}

                          {visibleColumns.time && <td className="text-center text-slate-600 py-4 px-3 text-xs">{invoice.time}</td>}
                          {visibleColumns.deliveryPerson && (
                            <td className="text-center border-gray-300 border-r py-4 px-3 align-middle">
                              <input
                                type="text"
                                placeholder="Enter name"
                                defaultValue={invoice.deliveryPerson || ""}
                                onBlur={(e) => {
                                  const value = e.target.value;
                                  if (value !== (invoice.deliveryPerson || "")) {
                                    handleDeliveryPersonChange(invoice._id, value, invoice.orderType);
                                  }
                                }}
                                disabled={updatingDeliveryPersonId === invoice._id}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                              />
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className="py-4 px-2 text-center">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <button onClick={() => handleInfo(invoice._id)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors duration-200" title="Info">
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleEdit(invoice)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200" title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete(invoice)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200" title="Delete">
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleNormalPrintClick(invoice)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200" title="Print Invoice">
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => generateBarcodePrint(invoice)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200" title="Print Barcode">
                                  <Barcode className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => generateCardPrint(invoice)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200" title="Print Card">
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleCreateChallan(invoice)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200" title="Create Challan">
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expandable Items Row */}
                        {expandedRow === idStr && (
                          <tr>
                            <td colSpan="12" className="bg-slate-50 p-4">
                              <div className="overflow-x-auto">
                                <table className="min-w-full table-fixed text-sm">
                                  <thead>
                                    <tr className="bg-white">
                                      <th className="py-2 px-3 text-center font-medium">Item Name</th>

                                      <th className="py-2 px-3 text-center font-medium">Order No</th>
                                      <th className="py-2 px-3 text-center font-medium">Eye</th>
                                      <th className="py-2 px-3 text-center font-medium">Sph</th>
                                      <th className="py-2 px-3 text-center font-medium">Cyl</th>
                                      <th className="py-2 px-3 text-center font-medium">Axis</th>
                                      <th className="py-2 px-3 text-center font-medium">Add</th>
                                      <th className="py-2 px-3 text-center font-medium min-w-[150px]">Remark</th>
                                      <th className="py-2 px-3 text-center font-medium">Qty</th>
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

                                          <td className="py-2 px-3 text-center">{item.orderNo || "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.eye || "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.sph ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.cyl ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.axis ?? "-"}</td>
                                          <td className="py-2 px-3 text-center">{item.add ?? "-"}</td>
                                          <td className="py-2 px-3 text-center min-w-[150px]">
                                            <textarea
                                              defaultValue={item.remark || ""}
                                              onBlur={(e) => {
                                                if (e.target.value !== (item.remark || "")) {
                                                  handleUpdateItemRemark(invoice._id, item._id, e.target.value, invoice.orderType);
                                                }
                                              }}
                                              placeholder="Remark"
                                              className="bg-transparent text-center border-b border-transparent focus:border-blue-500 focus:outline-none transition-colors w-full resize-none min-h-[1.5rem] overflow-hidden leading-tight"
                                              onInput={(e) => {
                                                e.target.style.height = "auto";
                                                e.target.style.height = `${e.target.scrollHeight} px`;
                                              }}
                                            />
                                          </td>
                                          <td className="py-2 px-3 text-center">{item.qty ?? "-"}</td>
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

              {visibleInvoices.length > 0 && (
                <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                  <tr className="border-t-2 border-slate-300">
                    <td
                      colSpan={Object.keys(visibleColumns).filter(k => visibleColumns[k]).indexOf("netAmount")}
                      className="py-4 px-3 text-right text-slate-700 uppercase tracking-wider text-sm font-black"
                    >
                      Grand Totals:
                    </td>
                    {visibleColumns.netAmount && (
                      <td className="text-center py-4 px-3 text-slate-900 text-lg font-black underline decoration-double decoration-blue-500 underline-offset-4">
                        {formatPrice(grandTotals.netAmount)}
                      </td>
                    )}
                    {visibleColumns.paidAmount && (
                      <td className="text-center py-4 px-3 text-green-700 text-lg font-black underline decoration-double decoration-green-500 underline-offset-4">
                        {formatPrice(grandTotals.paidAmount)}
                      </td>
                    )}
                    {visibleColumns.dueAmount && (
                      <td className="text-center py-4 px-3 text-red-600 text-lg font-black underline decoration-double decoration-red-500 underline-offset-4">
                        {formatPrice(grandTotals.dueAmount)}
                      </td>
                    )}
                    <td
                      colSpan={
                        Object.keys(visibleColumns).filter(k => visibleColumns[k]).length -
                        Object.keys(visibleColumns).filter(k => visibleColumns[k]).indexOf("dueAmount") - 1
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

      {/* Print Modal with Custom Message */}
      {printModalOpen && selectedInvoiceForPrint && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
              <h3 className="text-white font-bold text-lg">Print Sale Invoice</h3>
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
                    generateNormalPrint(selectedInvoiceForPrint, "");
                    setPrintModalOpen(false);
                    setSelectedInvoiceForPrint(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("lastCustomPrintMessage", printCustomMessage);
                    generateNormalPrint(selectedInvoiceForPrint, printCustomMessage);
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
    </div>
  );
}

export default LensSaleInvoice;
