import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  ShoppingCart,
  Receipt,
  Eye,
  Calculator,
  User,
  MapPin,
  Phone,
  Search,
  AlertCircle,
  Package,
  ArrowRightLeft,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Copy,
} from "lucide-react";
import * as XLSX from "xlsx";
import BulkLensMatrixV2 from "../Components/BulkLensMatrixV2";
import { getAllAccounts } from "../controllers/Account.controller";

import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
  addLensPurchaseOrder,
  getLensPurchaseOrder,
  editLensPurchaseOrder,
  getNextBillNumberForPurchaseOrder,
} from "../controllers/LensPurchaseOrder.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { useSelector, useDispatch } from "react-redux";
import { clearItems } from "../Store/Slices/lensItemSlice.js";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const Header = ({ isReadOnly, id, partyData }) => (
  <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-1.5 bg-blue-600 rounded shadow-sm">
        <ShoppingCart className="w-4 h-4 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{id ? "Edit Lens Purchase" : "New Lens Purchase"}</h1>
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[8px] font-black uppercase tracking-wider">Locked</span>
            </div>
          )}
        </div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{isReadOnly ? "Transaction Completed" : "Order Entry Portal"}</p>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <div className="h-6 w-px bg-slate-200 mx-1"></div>
      <div className="flex flex-col items-end">
        <span className="text-[8px] font-black text-blue-500 uppercase leading-none">Powered By</span>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">LensBackup</span>
      </div>
    </div>
  </div>
);

function AddLensPurchaseOrder() {
  const dispatch = useDispatch();
  const reduxLensItems = useSelector((state) => state.lensItems.items || []);

  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [purchaseData, setPurchaseData] = useState(null);
  const [category, setCategory] = useState("");
  const { user } = useContext(AuthContext);
  const [customPrices, setCustomPrices] = useState({});
  const [sourceSaleId, setSourceSaleId] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const safeDate = (d) => {
    try {
      if (!d) return new Date().toISOString().split("T")[0];
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return new Date().toISOString().split("T")[0];
      return dt.toISOString().split("T")[0];
    } catch { return new Date().toISOString().split("T")[0]; }
  };

  const [billData, setBillData] = useState({
    billSeries: "",
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    billType: "",
    godown: "",
    bookedBy: "",
  });

  const [partyData, setPartyData] = useState({
    partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: 0,
    CurrentBalance: { amount: 0, type: "Dr" },
  });

  const [items, setItems] = useState([{
    id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", sellPrice: "", combinationId: "", vendor: ""
  }]);

  const [taxes, setTaxes] = useState([{ id: 1, taxName: "", type: "Additive", percentage: "2.5", amount: "0.00" }]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");
  const isReadOnly = (status || "").toLowerCase() === "done";

  // Bulk Order State
  const [bulkOrderModal, setBulkOrderModal] = useState(false);
  const [bulkOrderItem, setBulkOrderItem] = useState(null);

  // Suggestion States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [activeTaxIndex, setActiveTaxIndex] = useState(-1);
  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [vendorQueries, setVendorQueries] = useState({});
  const [showVendorSuggestions, setShowVendorSuggestions] = useState({});
  const [rowErrors, setRowErrors] = useState({});

  const initializedRef = useRef(false);
  const containerRef = useRef(null);
  const tableRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    const fetchById = async () => {
      const res = await getLensPurchaseOrder(id);
      if (res.success) setPurchaseData(res.data.data);
    };
    fetchById();
  }, [id]);

  useEffect(() => {
    if (!Array.isArray(reduxLensItems) || reduxLensItems.length === 0) return;
    setItems((prev) => {
      // Filter out 'selection' rows that were used to trigger bulk add but have no qty/details
      const filteredPrev = prev.filter(it => (it.itemName && (Number(it.qty) > 0 || it.sph || it.cyl)) || it.barcode);
      const copy = [...filteredPrev];
      reduxLensItems.forEach((r) => {
        const foundIndex = copy.findIndex((it) => (
          String(it.itemName || "").toLowerCase() === String(r.itemName || "").toLowerCase() &&
          Number(it.sph || 0) === Number(r.sph || 0) &&
          Number(it.cyl || 0) === Number(r.cyl || 0) &&
          Number(it.add || 0) === Number(r.addValue || r.add || 0) &&
          String((it.eye || "RL")) === String((r.eye || "RL")) &&
          String(it.vendor || "").toLowerCase() === String(partyData.partyAccount || "").toLowerCase()
        ));
        const mappedRow = {
          id: copy.length + 1, barcode: r.barcode || "", itemName: r.itemName || "",
          eye: r.eye || "RL", sph: r.sph ?? "", cyl: r.cyl ?? "", axis: r.axis ?? 0,
          add: r.addValue ?? r.add ?? 0, remark: "", qty: r.qty ?? 0, purchasePrice: r.purchasePrice ?? 0,
          discount: 0, totalAmount: Number((Number(r.purchasePrice || 0) * Number(r.qty || 0)).toFixed(2)),
          sellPrice: r.salePrice?.default ?? r.salePrice ?? 0, combinationId: r.combinationId || "",
          vendor: partyData.partyAccount || "",
          vendorItemName: r.vendorItemName || "",
          billItemName: r.billItemName || ""
        };
        if (foundIndex !== -1) {
          copy[foundIndex].qty = Number(copy[foundIndex].qty || 0) + Number(mappedRow.qty || 0);
          copy[foundIndex].totalAmount = Number((copy[foundIndex].qty * (copy[foundIndex].purchasePrice || 0)).toFixed(2));
        } else {
          copy.push(mappedRow);
        }
      });
      return copy.map((it, idx) => ({ ...it, id: idx + 1 }));
    });
  }, [reduxLensItems]);

  useEffect(() => {
    // Check for transfer payload in URL
    const params = new URLSearchParams(location.search);
    const transferId = params.get('transferId');
    if (transferId) {
      const stored = localStorage.getItem(`transfer_${transferId} `);
      if (stored) {
        try {
          const { vendor, items: transferredItems } = JSON.parse(stored);
          const vendorAcc = accounts.find(a => a.Name?.toLowerCase() === vendor?.toLowerCase());
          if (vendorAcc) {
            selectAccount(vendorAcc);
          } else {
            setPartyData(p => ({ ...p, partyAccount: vendor }));
          }

          const mappedItems = transferredItems.map((it, idx) => ({
            ...it,
            id: idx + 1,
            vendor: vendor // Ensure it's the new vendor
          }));
          setItems(mappedItems);
          const iq = {};
          mappedItems.forEach((it, i) => iq[i] = it.itemName || "");
          setItemQueries(iq);

          localStorage.removeItem(`transfer_${transferId} `);
          initializedRef.current = true;
          // Clear URL params without refresh
          window.history.replaceState({}, '', location.pathname);
          return;
        } catch (e) { console.error("Transfer load error:", e); }
      }
    }

    if (initializedRef.current || !location.state || !allLens?.length) return;

    const hasExistingData = items.some(it => it.itemName || it.barcode || (it.qty && it.qty > 0));

    const applyData = () => {
      let incomingItems = [];
      const incomingVendor = location.state?.vendor || location.state?.partyName || partyData.partyAccount || "";

      if (location.state?.items?.length) {
        incomingItems = location.state.items;
      } else if (location.state?.itemName) {
        // Single item redirection from Sale Order
        incomingItems = [{
          productName: location.state.itemName,
          qty: location.state.requiredQty || 1,
          sph: location.state.sph,
          cyl: location.state.cyl,
          axis: location.state.axis,
          add: location.state.add,
          eye: location.state.eye || "RL"
        }];
      }

      if (!incomingItems.length) return;

      const newItems = incomingItems.map((incoming, idx) => {
        const lens = allLens.find(
          (l) =>
            String(l.productName || "").trim().toLowerCase() ===
            String(incoming.productName || incoming.itemName || "").trim().toLowerCase()
        );
        const pp = incoming.purchasePrice || incoming.price || lens?.purchasePrice || 0;
        const q = Number(incoming.qty || 0);

        // Resolve combinationId immediately
        let combId = "";
        if (lens && lens.addGroups) {
          const incomingAdd = incoming.addValue ?? incoming.add ?? 0;
          const incomingSph = incoming.sph ?? "";
          const incomingCyl = incoming.cyl ?? "";
          const incomingEye = incoming.eye || "RL";

          const ag = lens.addGroups.find(g => Number(g.addValue) === Number(incomingAdd));
          if (ag && ag.combinations) {
            const comb = ag.combinations.find(c =>
              Number(c.sph) === Number(incomingSph) &&
              Number(c.cyl) === Number(incomingCyl) &&
              (incomingEye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === incomingEye)
            );
            if (comb) combId = comb._id;
          }
        }

        return {
          id: idx + 1,
          barcode: incoming.barcode || "",
          itemName: incoming.productName || incoming.itemName || "",
          eye: incoming.eye || lens?.eye || "RL",
          sph: incoming.sph ?? "",
          cyl: incoming.cyl ?? "",
          axis: incoming.axis || 0,
          add: incoming.add ?? 0,
          remark: "",
          qty: q,
          purchasePrice: pp,
          discount: 0,
          totalAmount: Number((q * pp).toFixed(2)),
          sellPrice: incoming.salePrice ?? (lens?.salePrice?.default ?? lens?.salePrice ?? 0),
          combinationId: combId,
          orderNo: incoming.orderNo || "",
          vendor: incomingVendor,
          saleOrderItemId: incoming.saleOrderItemId || undefined,
          vendorItemName: incoming.vendorItemName || lens?.vendorItemName || "",
          billItemName: incoming.billItemName || lens?.billItemName || "",
        };
      });

      if (incomingVendor) {
        const vendorAcc = accounts.find(
          (a) => a.Name?.toLowerCase() === incomingVendor.toLowerCase()
        );
        if (vendorAcc) selectAccount(vendorAcc);
        else setPartyData((p) => ({ ...p, partyAccount: incomingVendor }));
      }

      setItems(newItems);
      if (location.state?.billData) {
        setBillData((prev) => ({
          ...prev,
          ...location.state.billData,
        }));
      }
      if (location.state?.remark) {
        setRemark(location.state.remark);
      }
      if (location.state?.sourceSaleId) {
        setSourceSaleId(location.state.sourceSaleId);
      }
      initializedRef.current = true;
      const iq = {};
      newItems.forEach((it, idx) => (iq[idx] = it.itemName || ""));
      setItemQueries(iq);
    };

    if (hasExistingData) {
      if (window.confirm("Replace existing items with incoming data?")) {
        applyData();
      } else {
        initializedRef.current = true;
      }
    } else {
      applyData();
    }
  }, [location.state, allLens, accounts]);

  useEffect(() => {
    const fetch = async () => {
      try { const res = await getAllAccounts(); setAccounts(Array.isArray(res) ? res : []); }
      catch (err) { console.error(err); }
    };
    const fetchTax = async () => {
      try {
        const resTaxes = await getAllTaxCategories();
        const dataArr = resTaxes?.data?.data ?? resTaxes;
        const taxesList = Array.isArray(dataArr) ? dataArr : [];
        setAllTaxes(taxesList);
        const defaultTax = taxesList.find(t => t.isDefault);
        if (defaultTax) {
          setBillData(v => ({ ...v, billType: defaultTax.Name || "" }));
          const m = [];
          if (defaultTax.localTax1 > 0) m.push({ id: genTaxId("c"), taxName: "CGST", type: "Additive", percentage: defaultTax.localTax1, amount: 0 });
          if (defaultTax.localTax2 > 0) m.push({ id: genTaxId("s"), taxName: "SGST", type: "Additive", percentage: defaultTax.localTax2, amount: 0 });
          if (defaultTax.centralTax > 0) m.push({ id: genTaxId("i"), taxName: "IGST", type: "Additive", percentage: defaultTax.centralTax, amount: 0 });
          setTaxes(m);
        }
      } catch (err) { console.error(err); }
    };
    const fetchLenses = async () => {
      try { const res = await getAllLensPower(); setAllLens(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])); }
      catch (err) { console.error(err); }
    };
    fetch(); fetchTax(); fetchLenses();
  }, []);

  useEffect(() => {
    if (!purchaseData) return;
    setBillData({
      billSeries: purchaseData.billData?.billSeries || "",
      billNo: purchaseData.billData?.billNo || "",
      date: safeDate(purchaseData.billData?.date),
      billType: purchaseData.billData?.billType || "",
      godown: purchaseData.billData?.godown || "",
      bookedBy: purchaseData.billData?.bookedBy || "",
    });
    setPartyData({
      partyAccount: purchaseData.partyData?.partyAccount || "",
      address: purchaseData.partyData?.address || "",
      contactNumber: purchaseData.partyData?.contactNumber || "",
      stateCode: purchaseData.partyData?.stateCode || "",
      creditLimit: purchaseData.partyData?.creditLimit ?? 0,
      CurrentBalance: {
        amount: purchaseData.partyData?.CurrentBalance?.amount ?? 0,
        type: purchaseData.partyData?.CurrentBalance?.type || "Dr"
      }
    });
    setItems(purchaseData.items?.length ? purchaseData.items.map((it, i) => ({
      id: i + 1,
      barcode: it.barcode || "",
      itemName: it.itemName || "",
      orderNo: it.orderNo || "",
      eye: it.eye || "",
      sph: it.sph ?? "",
      cyl: it.cyl ?? "",
      axis: it.axis ?? 0,
      add: it.add ?? 0,
      remark: it.remark || "",
      qty: it.qty ?? "",
      purchasePrice: it.purchasePrice ?? 0,
      discount: it.discount ?? 0,
      totalAmount: String(it.totalAmount || "0.00"),
      sellPrice: it.sellPrice ?? 0,
      combinationId: it.combinationId || "",
      vendor: it.vendor || ""
    })) : items);
    setTaxes(purchaseData.taxes?.length ? purchaseData.taxes.map((t, i) => ({
      id: t._id || t.id || i + 1,
      taxName: t.taxName || "",
      type: t.type || "Additive",
      percentage: t.percentage ?? 0,
      amount: String(t.amount || "0.00")
    })) : taxes);
    setRemark(purchaseData.remark || "");
    setStatus(purchaseData.status || "Pending");
    setPaidAmount(String(purchaseData.paidAmount || ""));
    const iq = {}; purchaseData.items?.forEach((it, i) => iq[i] = it.itemName || ""); setItemQueries(iq);
  }, [purchaseData]);

  const genTaxId = (s = "") => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}${s} `;

  const selectAccount = async (acc) => {
    setPartyData({
      partyAccount: acc.Name || "", contactNumber: acc.MobileNumber || "", stateCode: acc.State || "", address: acc.Address || "", creditLimit: acc.CreditLimit || "",
      CurrentBalance: { amount: acc.CurrentBalance?.amount ?? 0, type: acc.CurrentBalance?.type || "Dr" }
    });
    setCategory(acc.AccountCategory || "");
    try {
      const b = await getNextBillNumberForPurchaseOrder(acc.Name || "");
      const currentFY = getFinancialYearSeries('P');
      setBillData(v => ({
        ...v,
        billNo: String(b),
        billSeries: v.billSeries || currentFY,
        godown: v.godown || "HO",
        bookedBy: v.bookedBy || user?.name || "",
      }));
      const pr = await getAccountWisePrices(acc._id, "Purchase");
      if (pr.success) { const m = {}; pr.data.forEach(p => m[p.itemId || p.lensGroupId] = p.customPrice); setCustomPrices(m); }
    } catch (e) { console.error(e); }
    setShowSuggestions(false);

    // Sync row vendors to match main vendor if they were defaulting to empty or previous vendor
    setItems(prev => prev.map(it => {
      if (!it.vendor || it.vendor === partyData.partyAccount) return { ...it, vendor: acc.Name };
      return it;
    }));
  };

  const onPartyInputKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") setActiveIndex(v => Math.min(v + 1, filteredAccounts.length - 1));
    else if (e.key === "ArrowUp") setActiveIndex(v => Math.max(v - 1, 0));
    else if (e.key === "Enter" && activeIndex >= 0) selectAccount(filteredAccounts[activeIndex]);
    else if (e.key === "Escape") setShowSuggestions(false);
  };

  const filteredAccounts = partyData.partyAccount ? accounts.filter(a => a.Name?.toLowerCase().includes(partyData.partyAccount.toLowerCase())) : accounts.slice(0, 10);
  const filteredTaxes = taxQuery ? allTaxes.filter(t => t.Name?.toLowerCase().includes(taxQuery.toLowerCase())) : allTaxes.slice(0, 10);

  const selectTax = (t) => {
    setBillData(v => ({ ...v, billType: t.Name || "" })); setTaxQuery(t.Name || ""); setShowTaxSuggestions(false);
    const m = [];
    if (t.localTax1 > 0) m.push({ id: genTaxId("c"), taxName: "CGST", type: "Additive", percentage: t.localTax1, amount: 0 });
    if (t.localTax2 > 0) m.push({ id: genTaxId("s"), taxName: "SGST", type: "Additive", percentage: t.localTax2, amount: 0 });
    if (t.centralTax > 0) m.push({ id: genTaxId("i"), taxName: "IGST", type: "Additive", percentage: t.centralTax, amount: 0 });
    if (m.length) setTaxes(m);
  };

  const getFilteredLens = (idx) => {
    const q = itemQueries[idx] || "";
    return q ? allLens.filter(l => l.productName?.toLowerCase().includes(q.toLowerCase())) : allLens.slice(0, 10);
  };

  const selectLens = (l, idx) => {
    const pp = customPrices[l._id] || l.purchasePrice || 0;
    const sp = l.salePrice?.default || l.salePrice || 0;
    setItems(prev => {
      const c = [...prev];

      // Resolve combinationId
      let combId = "";
      if (l && l.addGroups) {
        const itemAdd = c[idx].add || 0;
        const itemSph = c[idx].sph || "";
        const itemCyl = c[idx].cyl || "";
        const itemEye = l.eye || c[idx].eye || "RL";

        const ag = l.addGroups.find(g => Number(g.addValue) === Number(itemAdd));
        if (ag && ag.combinations) {
          const comb = ag.combinations.find(cb =>
            Number(cb.sph) === Number(itemSph) &&
            Number(cb.cyl) === Number(itemCyl) &&
            (itemEye === "RL" ? (cb.eye === "R" || cb.eye === "L" || cb.eye === "RL") : cb.eye === itemEye)
          );
          if (comb) combId = comb._id;
        }
      }

      c[idx] = {
        ...c[idx],
        itemName: l.productName,
        purchasePrice: pp,
        sellPrice: sp,
        eye: l.eye || c[idx].eye || "",
        combinationId: combId,
        vendorItemName: l.vendorItemName || "",
        billItemName: l.billItemName || ""
      };

      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].purchasePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = (q * p - q * p * (d / 100)).toFixed(2);
      return c;
    });
    setItemQueries(p => ({ ...p, [idx]: l.productName })); setShowItemSuggestions(p => ({ ...p, [idx]: false }));
  };

  const addItemRow = () => setItems(p => [...p, { id: p.length + 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", sellPrice: "", combinationId: "", vendor: partyData.partyAccount || "" }]);
  const deleteItem = (id) => setItems(p => p.filter(it => it.id !== id));

  const handleTransferOrder = () => {
    const mainVendor = partyData.partyAccount;
    const itemsToTransfer = items.filter(it => it.vendor && it.vendor !== mainVendor && it.itemName);

    if (itemsToTransfer.length === 0) {
      toast.error("No items selected for transfer (Change vendor in rows first)");
      return;
    }

    // Group by vendor
    const grouped = itemsToTransfer.reduce((acc, it) => {
      if (!acc[it.vendor]) acc[it.vendor] = [];
      acc[it.vendor].push(it);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([vendor, vendorItems]) => {
      const transferId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 5)} `;
      localStorage.setItem(`transfer_${transferId} `, JSON.stringify({
        vendor,
        items: vendorItems
      }));
      window.open(`${window.location.origin} /lenstransaction/purchase / AddLensPurchaseOrder ? transferId = ${transferId} `, '_blank');
    });

    // Remove transferred items from current order
    const transferIds = new Set(itemsToTransfer.map(it => it.id));
    setItems(prev => {
      const remaining = prev.filter(it => !transferIds.has(it.id));
      if (remaining.length === 0) {
        return [{ id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", sellPrice: "", combinationId: "", vendor: mainVendor }];
      }
      return remaining.map((it, idx) => ({ ...it, id: idx + 1 }));
    });
    // Explicitly update item queries for remaining items
    const newIq = {};
    items.filter(it => !transferIds.has(it.id)).forEach((it, idx) => newIq[idx] = it.itemName);
    setItemQueries(newIq);

    toast.success(`Transferred items to ${Object.keys(grouped).length} new order(s)`);
  };

  const checkComb = (r) => {
    const l = allLens.find(lx => lx.productName?.toLowerCase() === r.itemName?.toLowerCase());
    if (!l) return { exists: false, reason: "N/A" };
    const ag = l.addGroups?.find(g => Number(g.addValue) === Number(r.add));
    const rEyeNorm = String(r.eye || "").toUpperCase().replace(/[\/\s]/g, "");
    const comb = ag?.combinations?.find(c => {
      const cEyeNorm = String(c.eye || "").toUpperCase().replace(/[\/\s]/g, "");
      const eyeMatch = rEyeNorm === "RL" 
        ? (cEyeNorm === "RL" || cEyeNorm === "BOTH" || cEyeNorm === "") 
        : (cEyeNorm === rEyeNorm || cEyeNorm === "RL" || cEyeNorm === "BOTH" || cEyeNorm === "");
      return Number(c.sph) === Number(r.sph) && Number(c.cyl) === Number(r.cyl) && eyeMatch;
    });
    return comb ? { exists: true, id: comb._id, stock: comb.stock || 0 } : { exists: false, reason: "N/C" };
  };

  const validateRow = (idx) => {
    const r = items[idx]; if (!r || !r.itemName) return;
    const ck = checkComb(r);
    setRowErrors(p => { const c = { ...p }; if (ck.exists) delete c[idx]; else c[idx] = ck.reason; return c; });
    setItems(prev => { const c = [...prev]; c[idx].combinationId = ck.id || ""; return c; });
  };

  const updateItem = (idx, f, v) => {
    setItems(prev => {
      const c = [...prev]; c[idx][f] = v;
      if (f === "itemName") {
        const l = allLens.find(lx => lx.productName === v);
        if (l) { c[idx].purchasePrice = customPrices[l._id] || l.purchasePrice || 0; c[idx].sellPrice = l.salePrice?.default || l.salePrice || 0; c[idx].eye = l.eye || c[idx].eye || ""; c[idx].vendorItemName = l.vendorItemName || ""; c[idx].billItemName = l.billItemName || ""; }
      }
      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].purchasePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = (q * p - q * p * (d / 100)).toFixed(2);
      return c;
    });
  };

  const addTaxRow = () => setTaxes(p => [...p, { id: genTaxId("m"), taxName: "", type: "Additive", percentage: "", amount: "0.00" }]);
  const deleteTax = (id) => setTaxes(p => p.filter(t => t.id !== id));
  const updateTax = (idx, f, v) => setTaxes(p => { const c = [...p]; c[idx][f] = v; const sub = computeSubtotal(), pct = parseFloat(f === "percentage" ? v : c[idx].percentage) || 0; c[idx].amount = ((sub * pct) / 100).toFixed(2); return c; });

  const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
  const computeTotalTaxes = () => taxes.reduce((s, t) => {
    const amt = parseFloat(t.amount) || 0;
    return t.type === "Subtractive" ? s - amt : s + amt;
  }, 0);
  const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();

  const copyFirstPriceToAll = () => {
    if (isReadOnly || items.length < 2) return;
    const firstPrice = parseFloat(items[0].purchasePrice) || 0;
    setItems(prev => prev.map((it, idx) => {
      if (idx === 0) return it;
      const q = parseFloat(it.qty) || 0, d = parseFloat(it.discount) || 0;
      const totalAmount = (q * firstPrice - q * firstPrice * (d / 100)).toFixed(2);
      return { ...it, purchasePrice: firstPrice, totalAmount };
    }));
    toast.success("Price from first row copied to all items");
  };

  useEffect(() => {
    const sub = computeSubtotal();
    setTaxes(prev => {
      let changed = false;
      const updated = prev.map(t => {
        const pct = parseFloat(t.percentage) || 0;
        const newAmt = ((sub * pct) / 100).toFixed(2);
        if (t.amount !== newAmt) {
          changed = true;
          return { ...t, amount: newAmt };
        }
        return t;
      });
      return changed ? updated : prev;
    });
  }, [items]);

  const handleSave = async () => {
    const sub = computeSubtotal(), tx = computeTotalTaxes(), net = sub + tx;
    const p = {
      billData,
      partyData,
      items,
      taxes,
      subtotal: sub,
      taxesAmount: tx,
      netAmount: net,
      paidAmount,
      dueAmount: net - Number(paidAmount),
      remark,
      status,
      sourceSaleId,
      companyId: user?.companyId // Link to tenant
    };
    const res = id ? await editLensPurchaseOrder(id, p) : await addLensPurchaseOrder(p);
    if (res.success) { toast.success("Success!"); navigate("/lenstransaction/purchase/purchaseorder"); } else toast.error(res.message || "Failed");
  };

  const handleReset = () => window.location.reload();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processUploadedData(data, file.name);
        } catch (err) {
          console.error("Excel error:", err);
          toast.error("Failed to parse Excel file");
        }
      };
      reader.readAsBinaryString(file);
    } else if (file.name.endsWith(".pdf")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        // pdfjsLib worker is handled at the top level

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let allRows = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          const items = textContent.items.map(item => ({
            str: item.str,
            y: Math.round(item.transform[5]),
            x: Math.round(item.transform[4])
          }));

          const rowsByY = items.reduce((acc, item) => {
            if (!acc[item.y]) acc[item.y] = [];
            acc[item.y].push(item);
            return acc;
          }, {});

          Object.values(rowsByY).forEach(rowItems => {
            rowItems.sort((a, b) => a.x - b.x);
            const rowText = rowItems.map(ri => ri.str).join(" ");
            const parts = rowText.split(/\s+/).filter(p => !isNaN(parseFloat(p)) || p.length <= 2);
            if (parts.length >= 3) {
              allRows.push({
                rawText: rowText,
                parts: parts
              });
            }
          });
        }

        const mappedData = allRows.map(r => {
          const numbers = r.parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
          return {
            Eye: r.parts.find(p => ["R", "L", "RL"].includes(p.toUpperCase())) || "RL",
            Sph: numbers[0] || 0,
            Cyl: numbers[1] || 0,
            Add: numbers[2] || 0
          };
        });

        processUploadedData(mappedData, file.name);
        toast.error("PDF Parsing is experimental. Please verify data.");
      } catch (err) {
        console.error("PDF error:", err);
        toast.error("Failed to parse PDF");
      }
    }
    e.target.value = "";
  };

  const processUploadedData = (data, fileName) => {
    let newItems = [];

    data.forEach((row) => {
      const getVal = (patterns) => {
        const key = Object.keys(row).find((k) =>
          patterns.some((p) => k.toLowerCase().includes(p.toLowerCase()))
        );
        return key ? row[key] : "";
      };

      const sph = getVal(["sph"]) || 0;
      const cyl = getVal(["cyl"]) || 0;
      const eye = getVal(["eye"]) || "RL";
      const barcode = getVal(["barcode"]) || "";
      const itemName = getVal(["item", "product"]) || "";
      const orderNo = getVal(["order"]) || "";
      const price = Number(getVal(["price", "cost", "purchase"])) || 0;
      const discount = getVal(["discount"]) || 0;
      const remark = getVal(["remark"]) || "";
      const axis = getVal(["axis"]) || "";

      // 1. Look for Matrix Add columns like "Add +1.00", "Add 1.50"
      const matrixAddKeys = Object.keys(row).filter(k =>
        k.toLowerCase().includes("add") && /[-+]?\d+\.?\d*/.test(k)
      );

      let rowProcessedAsMatrix = false;
      if (matrixAddKeys.length > 0) {
        matrixAddKeys.forEach(key => {
          const qty = Number(row[key]);
          if (!isNaN(qty) && qty > 0) {
            const match = key.match(/[-+]?\d+\.?\d*/);
            const addPower = match ? match[0] : null;

            if (addPower !== null && Number(addPower) !== 0) {
              newItems.push({
                barcode,
                itemName,
                orderNo,
                eye,
                sph,
                cyl,
                axis,
                add: addPower,
                remark,
                qty,
                purchasePrice: price,
                discount,
                totalAmount: (qty * price).toFixed(2),
                sellPrice: 0,
                combinationId: "",
                vendor: partyData.partyAccount || "",
                fromFile: fileName,
              });
              rowProcessedAsMatrix = true;
            }
          }
        });
      }

      // 2. Fallback for Flat format
      if (!rowProcessedAsMatrix) {
        const add = getVal(["add"]);
        const qty = Number(getVal(["qty", "quantity"])) || 0;

        if (Number(add) !== 0 && qty > 0) {
          newItems.push({
            barcode,
            itemName,
            orderNo,
            eye,
            sph,
            cyl,
            axis,
            add,
            remark,
            qty,
            purchasePrice: price,
            discount,
            totalAmount: (qty * price).toFixed(2),
            sellPrice: 0,
            combinationId: "",
            vendor: partyData.partyAccount || "",
            fromFile: fileName,
          });
        }
      }
    });

    if (newItems.length === 0) {
      toast.error("No valid items found to import (Check columns and quantities)");
      return;
    }

    const existing = items.filter((it) => it.itemName || it.sph || (it.qty && Number(it.qty) > 0));
    const combined = [...existing, ...newItems].map((it, i) => ({
      ...it,
      id: i + 1,
    }));

    const nIq = {};
    combined.forEach((it, i) => {
      if (it.itemName) nIq[i] = it.itemName;
    });

    setItems(combined);
    setItemQueries(nIq);

    setUploadedFile(fileName);
    toast.success(`Imported ${newItems.length} items from ${fileName}`);
  };

  const handleDeleteUploadedFile = () => {
    if (!uploadedFile) return;
    setItems((prev) => {
      const remaining = prev.filter(it => it.fromFile !== uploadedFile);
      if (remaining.length === 0) {
        return [{ id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", sellPrice: "", combinationId: "", vendor: partyData.partyAccount || "" }];
      }
      return remaining.map((it, i) => ({ ...it, id: i + 1 }));
    });
    setUploadedFile(null);
    toast.success("Uploaded file data removed");
  };

  const getInitStockForRow = (idx) => {
    const r = items[idx]; if (!r || !r.itemName) return "-";
    const ck = checkComb(r); return ck.exists ? ck.stock : "-";
  };

  const openBulkOrderModal = (item) => {
    if (!item.itemName) {
      toast.error("Please select an item first");
      return;
    }
    setBulkOrderItem(item);
    setBulkOrderModal(true);
  };



  return (
    <div className="h-screen bg-slate-50 relative selection:bg-blue-100 flex flex-col overflow-hidden">
      <Header isReadOnly={isReadOnly} id={id} partyData={partyData} />
      
      <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-3 pt-3 pb-3 gap-3 overflow-hidden">
        
        {/* Top section wrapper */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 bg-white rounded-xl shadow-sm border border-slate-200 flex-shrink-0" style={{overflow: 'visible'}}>
          
          {/* Column 1: Order Details */}
          <div className="p-4 border-r border-slate-100 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Order Details</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Series & No</label>
                <div className="flex gap-1.5">
                   <input type="text" value={billData.billSeries} onChange={(e) => setBillData((b) => ({ ...b, billSeries: e.target.value }))} className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="EX. PO" />
                   <input type="text" value={billData.billNo} onChange={(e) => setBillData((b) => ({ ...b, billNo: e.target.value }))} className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="Auto" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Date</label>
                <input type="date" value={safeDate(billData.date)} onChange={(e) => setBillData((b) => ({ ...b, date: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} />
              </div>
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Bill Type</label>
                <div className="relative">
                  <input type="text" value={billData.billType} onFocus={() => !isReadOnly && setShowTaxSuggestions(true)}
                    onChange={(e) => { setTaxQuery(e.target.value); setBillData((b) => ({ ...b, billType: e.target.value })); }}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} />
                  {showTaxSuggestions && filteredTaxes.length > 0 && (
                    <div className="absolute top-full left-0 w-48 bg-white border border-slate-200 shadow-2xl rounded-lg z-[300] mt-1 max-h-40 overflow-y-auto">
                      {filteredTaxes.map((tax, idx) => (
                        <div key={idx} className="px-3 py-1.5 text-[10px] font-black text-slate-600 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 uppercase" onMouseDown={() => selectTax(tax)}>{tax.Name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Godown / Store</label>
                <input type="text" value={billData.godown} onChange={(e) => setBillData((b) => ({ ...b, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="Main Store" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Booked By</label>
                <input type="text" value={billData.bookedBy} onChange={(e) => setBillData((b) => ({ ...b, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="Name" />
              </div>
            </div>
          </div>

          {/* Column 2: Vendor / Party Info */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Vendor / Account</h3>
              </div>
              <div className="flex gap-2">
                 <div className="flex flex-col items-end px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[9px] font-black text-blue-400 uppercase leading-none">Credit Limit</span>
                    <span className="text-xs font-black text-blue-700 tracking-tight leading-none mt-0.5">₹{partyData.creditLimit ? parseFloat(String(partyData.creditLimit)).toLocaleString() : "0"}</span>
                 </div>
                 <div className="flex flex-col items-end px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[9px] font-black text-emerald-400 uppercase leading-none">Balance</span>
                    <span className="text-xs font-black text-emerald-700 tracking-tight leading-none mt-0.5">{partyData.CurrentBalance ? `${parseFloat(String(partyData.CurrentBalance.amount)).toLocaleString()} ${partyData.CurrentBalance.type}` : "0"}</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6" style={{position: 'relative', zIndex: 50}}>
                 <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">Account</label>
                 <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" value={partyData.partyAccount || ""} onChange={(e) => { setPartyData(v => ({ ...v, partyAccount: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-black" placeholder="Search Vendor..." disabled={isReadOnly} />
                 </div>
                 {showSuggestions && filteredAccounts.length > 0 && (
                   <div style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: '4px'}} className="bg-white border border-slate-200 shadow-2xl rounded-lg max-h-56 overflow-y-auto">
                     {filteredAccounts.map((acc, idx) => (
                       <div key={idx} className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors" onMouseDown={() => selectAccount(acc)}>
                         <div className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{acc.Name}</div>
                         <div className="flex justify-between items-center mt-0.5">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{acc.AccountGroup?.Name || "NO GROUP"}</span>
                           <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${acc.CurrentBalance?.type === 'Cr' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>₹{parseFloat(String(acc.CurrentBalance?.amount || 0)).toLocaleString()} {acc.CurrentBalance?.type}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                 <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">State</label>
                 <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-500 h-9 flex items-center uppercase">{partyData.stateCode || "—"}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </label>
                <input type="text" value={partyData.address || ""} onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="Address" disabled={isReadOnly} />
              </div>
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Contact No
                </label>
                <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-600 h-9 flex items-center tabular-nums">
                  {partyData.contactNumber || "Not available"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions & Table Section */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-1.5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Order Items</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{items.length} Lines Added</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isReadOnly && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 border border-indigo-100 transition-all">
                    <Upload className="w-3.5 h-3.5" /> Import {uploadedFile && <span className="max-w-[100px] truncate">({uploadedFile})</span>}
                  </button>
                  <button onClick={handleTransferOrder} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-100 border border-amber-100 transition-all">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
                  </button>
                  <button onClick={addItemRow} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-100 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/30" style={{maxHeight: 'calc(100vh - 420px)'}} ref={tableRef}>
            <table className="min-w-full text-left border-collapse table-fixed">
              <thead className="bg-white sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-100">
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="w-8 py-2 text-center border-r border-slate-50">#</th>
                  <th className="w-28 py-2 px-2 border-r border-slate-50">Barcode</th>
                  <th className="w-56 py-2 px-2 border-r border-slate-50">Product Description</th>
                  <th className="w-20 py-2 text-center border-r border-slate-50">Order No</th>
                  <th className="w-10 py-2 text-center border-r border-slate-50">Eye</th>
                  <th className="w-14 py-2 text-center bg-blue-50/30 text-blue-500 border-r border-slate-100">Sph</th>
                  <th className="w-14 py-2 text-center bg-blue-50/30 text-blue-500 border-r border-slate-100">Cyl</th>
                  <th className="w-14 py-2 text-center bg-blue-50/30 text-blue-500 border-r border-slate-100">Axis</th>
                  <th className="w-14 py-2 text-center bg-blue-50/30 text-blue-500 border-r border-slate-100">Add</th>
                  <th className="w-20 py-2 px-2 border-r border-slate-50">Remark</th>
                  <th className="w-14 py-2 text-right px-2 border-r border-slate-50">Qty</th>
                  <th className="w-32 py-2 px-2 border-r border-slate-50">Vendor</th>
                  <th className="w-24 py-2 text-right px-2 border-r border-slate-50">
                    <div className="flex items-center justify-end gap-1">
                      <span>P.Price</span>
                      {!isReadOnly && items.length > 1 && (
                        <button onClick={copyFirstPriceToAll} className="p-0.5 hover:bg-blue-100 rounded text-blue-400 transition-all active:scale-90" title="Copy first price">
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="w-16 py-2 text-right px-2 border-r border-slate-50">Disc%</th>
                  <th className="w-24 py-2 text-right px-2 border-r border-slate-50 text-blue-600">Total</th>
                  <th className="w-10 py-2 text-center">STK</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((it, idx) => (
                  <React.Fragment key={it.id}>
                    <tr className="hover:bg-blue-50/30 transition-colors group h-10" onDoubleClick={() => !isReadOnly && openBulkOrderModal(it)}>
                      <td className="py-1 text-center text-slate-300 text-[10px] font-bold border-r border-slate-50 tabular-nums">{idx + 1}</td>
                      <td className="p-1 border-r border-slate-50">
                        <input type="text" value={it.barcode || ""} onChange={(e) => updateItem(idx, "barcode", e.target.value)}
                          className="w-full h-7 px-1.5 py-1 bg-transparent text-[10px] font-black text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all tabular-nums"
                          placeholder="..." disabled={isReadOnly} />
                      </td>
                      <td className="p-1 border-r border-slate-50 relative">
                        <input type="text" value={itemQueries[idx] ?? it.itemName ?? ""}
                          onFocus={() => !isReadOnly && setShowItemSuggestions(p => ({ ...p, [idx]: true }))}
                          onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)}
                          onChange={(e) => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }}
                          className="w-full h-7 px-1.5 py-1 bg-transparent text-[10px] font-black text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all uppercase"
                          placeholder="Search Item..." disabled={isReadOnly} />
                        {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                          <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mt-0.5 p-1 max-h-48 overflow-y-auto">
                            {getFilteredLens(idx).map((l, i) => (
                              <div key={i} onMouseDown={() => selectLens(l, idx)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] font-black text-slate-600 border-b border-slate-50 last:border-0 uppercase tracking-tight">{l.productName}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-1 border-r border-slate-50">
                        <input type="text" value={it.orderNo || ""} onChange={(e) => updateItem(idx, "orderNo", e.target.value)}
                          className="w-full h-7 px-1 py-1 bg-transparent text-[10px] font-black text-slate-400 text-center outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded uppercase"
                          placeholder="-" disabled={isReadOnly} />
                      </td>
                      <td className="p-1 border-r border-slate-50">
                        <span className="block w-full text-[11px] text-center text-blue-600 font-black uppercase leading-none">{it.eye || "—"}</span>
                      </td>
                      {["sph", "cyl", "axis", "add"].map((field) => (
                        <td key={field} className="p-0 border-r border-slate-100 bg-blue-50/20">
                          <input type="text" value={it[field] || ""} onBlur={() => validateRow(idx)} onChange={(e) => updateItem(idx, field, e.target.value)}
                            className="w-full h-9 px-1 py-1 bg-transparent text-[12px] font-black text-center text-slate-800 outline-none focus:bg-white/80 focus:ring-1 focus:ring-blue-100 tabular-nums"
                            placeholder="0.00" disabled={isReadOnly} />
                        </td>
                      ))}
                      <td className="p-1 border-r border-slate-50">
                        <input type="text" value={it.remark || ""} onChange={(e) => updateItem(idx, "remark", e.target.value)}
                          className="w-full h-7 px-2 py-1 bg-transparent text-[9px] font-black text-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all uppercase italic"
                          placeholder="REMARK" disabled={isReadOnly} />
                      </td>
                      <td className="p-1 border-r border-slate-50 bg-emerald-50/10">
                        <input type="number" value={it.qty || ""} onChange={(e) => updateItem(idx, "qty", e.target.value)}
                          className="w-full h-7 px-1 py-1 bg-transparent text-[11px] font-black text-right text-emerald-600 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-100 rounded transition-all tabular-nums"
                          placeholder="0" disabled={isReadOnly} />
                      </td>
                      <td className="p-1 border-r border-slate-50 relative">
                        <input type="text" value={vendorQueries[idx] ?? it.vendor ?? ""}
                          onFocus={() => !isReadOnly && setShowVendorSuggestions(p => ({ ...p, [idx]: true }))}
                          onBlur={() => setTimeout(() => setShowVendorSuggestions(p => ({ ...p, [idx]: false })), 200)}
                          onChange={(e) => { setVendorQueries(p => ({ ...p, [idx]: e.target.value })); setShowVendorSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "vendor", e.target.value); }}
                          className={`w-full h-7 px-1.5 py-1 bg-transparent text-[9px] font-black outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all uppercase ${it.vendor && it.vendor !== partyData.partyAccount ? 'text-amber-600 bg-amber-50' : 'text-slate-500'}`}
                          placeholder="Vendor..." disabled={isReadOnly} />
                        {it.vendor && it.vendor !== partyData.partyAccount && (
                          <div className="absolute -top-1 right-0 px-1 bg-amber-500 text-white text-[7px] font-black rounded-sm shadow-sm scale-75 origin-top-right uppercase">Diff</div>
                        )}
                        {showVendorSuggestions[idx] && (
                          <div className="absolute top-full left-0 w-48 bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mt-0.5 p-1 max-h-40 overflow-y-auto">
                            {accounts.filter(a => a.Name?.toLowerCase().includes((vendorQueries[idx] || "").toLowerCase())).slice(0, 10).map((a, i) => (
                              <div key={i} onMouseDown={() => { updateItem(idx, "vendor", a.Name); setVendorQueries(p => ({ ...p, [idx]: a.Name })); setShowVendorSuggestions(p => ({ ...p, [idx]: false })); }}
                                className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[9px] font-black text-slate-600 border-b border-slate-50 last:border-0 uppercase">{a.Name}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-1 border-r border-slate-50 bg-blue-50/10">
                        <input type="number" value={it.purchasePrice} onChange={(e) => updateItem(idx, "purchasePrice", Number(e.target.value))}
                          className="w-full h-7 px-1 py-1 bg-transparent text-[11px] font-black text-right text-blue-600 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all tabular-nums"
                          placeholder="0.00" disabled={isReadOnly} />
                      </td>
                      <td className="p-1 border-r border-slate-50">
                        <input type="number" value={it.discount || ""} onChange={(e) => updateItem(idx, "discount", e.target.value)}
                          className="w-full h-7 px-1 py-1 bg-transparent text-[11px] font-black text-right text-red-400 outline-none focus:bg-white focus:ring-1 focus:ring-red-100 rounded transition-all tabular-nums"
                          placeholder="0" disabled={isReadOnly} />
                      </td>
                      <td className="p-1 text-right text-[11px] font-black text-slate-800 pr-2 border-r border-slate-50 tabular-nums">
                        {parseFloat(String(it.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 text-center text-[10px] font-black text-slate-400 bg-slate-50/50 tabular-nums">
                        {getInitStockForRow(idx)}
                      </td>
                      <td className="p-1 text-center">
                        <button onClick={() => !isReadOnly && deleteItem(it.id)} className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-all ${isReadOnly ? "hidden" : "text-slate-300 hover:text-red-500 hover:bg-red-50"}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {rowErrors[idx] && (
                      <tr>
                        <td colSpan={17} className="px-3 py-0.5 bg-red-50 text-[8px] font-black text-red-500 uppercase italic tracking-tighter">
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            {rowErrors[idx]}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Panel: Tax & Summary */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0">
          
          {/* Tax Component */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 min-h-[160px]">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                      <Calculator className="w-4 h-4" />
                   </div>
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Adjustment & Charges</h3>
                </div>
                {!isReadOnly && (
                   <button onClick={addTaxRow} className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1 active:scale-95 transition-all">
                      <Plus className="w-3 h-3" /> Add Charge
                   </button>
                )}
             </div>

             <div className="flex-1 overflow-y-auto pr-1">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                         <th className="py-2 px-3">Description</th>
                         <th className="w-24 px-2">Type</th>
                         <th className="w-16 text-right">%</th>
                         <th className="w-24 text-right px-3">Amount</th>
                         <th className="w-10"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {taxes.map((tax, idx) => (
                         <tr key={tax.id} className="group hover:bg-slate-50/50">
                            <td className="py-1.5 px-3">
                               <input type="text" value={tax.taxName} onChange={(e) => updateTax(idx, "taxName", e.target.value)}
                                  className="w-full bg-transparent text-[10px] font-black text-slate-700 outline-none uppercase"
                                  placeholder="Charge/Tax Name" disabled={isReadOnly} />
                            </td>
                            <td className="px-2">
                               <select value={tax.type} onChange={(e) => updateTax(idx, "type", e.target.value)}
                                  className="w-full bg-transparent text-[10px] font-black text-slate-600 outline-none uppercase appearance-none"
                                  disabled={isReadOnly}>
                                  <option value="Additive">(+) Additive</option>
                                  <option value="Subtractive">(-) Discount</option>
                               </select>
                            </td>
                            <td className="text-right">
                               <input type="number" value={tax.percentage} onChange={(e) => updateTax(idx, "percentage", e.target.value)}
                                  className="w-full bg-transparent text-[10px] font-black text-slate-700 text-right outline-none tabular-nums"
                                  placeholder="0" disabled={isReadOnly} />
                            </td>
                            <td className="text-right px-3 text-[10px] font-black text-slate-800 tabular-nums whitespace-nowrap">
                               ₹{parseFloat(String(tax.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-center">
                               <button onClick={() => !isReadOnly && deleteTax(tax.id)} className="p-1 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

          {/* Billing Summary */}
          <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl p-4 shadow-lg border border-slate-800 flex flex-col gap-3">
             <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtotal (Gross)</span>
                   <span className="text-xs font-black text-slate-300 tabular-nums">₹{computeSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Adjustment Total</span>
                   <span className={`text-xs font-black tabular-nums ${computeTotalTaxes() >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {computeTotalTaxes() >= 0 ? "+" : "-"} ₹{Math.abs(computeTotalTaxes()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                   </span>
                </div>
                
                <div className="border-t border-slate-800/50 my-1"></div>
                
                <div className="flex justify-between items-baseline px-1">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none">Net Amount Due</span>
                   </div>
                   <div className="text-3xl font-black text-white tabular-nums tracking-tighter flex items-center gap-1">
                      <span className="text-xl text-slate-600 font-bold">₹</span>
                      {computeNetAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                   <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Paid (Advance)</label>
                   <div className="relative">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-black">₹</span>
                      <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                         className="w-full bg-slate-900/50 pl-4 pr-2 py-1.5 rounded text-sm font-black text-emerald-400 outline-none focus:ring-1 focus:ring-blue-500 transition-all tabular-nums"
                         placeholder="0.00" disabled={isReadOnly} />
                   </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                   <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Due Balance</label>
                   <div className="text-sm font-black text-amber-500 tabular-nums flex items-center h-8 justify-end pr-1">
                      ₹{(computeNetAmount() - Number(paidAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                   </div>
                </div>
             </div>

             <div className="flex gap-2 mt-auto">
                <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-lg transition-all active:scale-95 border border-slate-700/50 disabled:opacity-50" disabled={isReadOnly}>
                   <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
                <button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-widest rounded-lg shadow-xl shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50" disabled={isReadOnly}>
                   {isReadOnly ? <AlertCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                   {isReadOnly ? "ORDER LOCKED" : "Commit Order"}
                </button>
             </div>
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .pdf" className="hidden" />
      <Toaster position="top-right" />

      {/* Bulk Order Modal */}
      {bulkOrderModal && bulkOrderItem && (
        <BulkLensMatrixV2
          product={allLens.find(l => String(l.productName).toLowerCase() === String(bulkOrderItem.itemName).toLowerCase())}
          baseItem={bulkOrderItem}
          priceKey="purchasePrice"
          onClose={() => setBulkOrderModal(false)}
          onAddItems={(newItems) => {
            setItems(prev => {
              const existing = prev.filter(it => 
                (it.id !== bulkOrderItem.id) && 
                ((it.itemName && (Number(it.qty) > 0 || it.sph || it.cyl)) || it.barcode)
              );
              const combined = [...existing, ...newItems].map((it, idx) => ({
                ...it,
                id: idx + 1,
                purchasePrice: parseFloat(String(it.purchasePrice || 0)),
                sellPrice: parseFloat(String(it.sellPrice || 0)),
                vendor: it.vendor || partyData.partyAccount || ""
              }));
              return combined;
            });
            toast.success(`Added ${newItems.length} items from matrix`);
          }}
        />
      )}
    </div>
  );
}

export default AddLensPurchaseOrder;
