import React, { useEffect, useRef, useState } from "react";
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
  X,
  AlertCircle,
  Package,
  Copy,
} from "lucide-react";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
  addLensPurchaseChallan,
  getLensPurchaseChallan,
  editLensPurchaseChallan,
  getNextBillNumberForPurchaseChallan,
} from "../controllers/LensPurchaseChallan.controller";
import { getAllLensPurchaseOrder } from "../controllers/LensPurchaseOrder.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";

const Header = ({ isReadOnly, id, title = "Lens Purchase Challan" }) => (
    <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded shadow-sm">
                <Package className="w-4 h-4 text-white" />
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">
                        {id ? `Edit ${title}` : `New ${title}`}
                    </h1>
                    {isReadOnly && (
                        <div className="flex items-center gap-1 px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[8px] font-black uppercase tracking-wider">Locked</span>
                        </div>
                    )}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                    {isReadOnly ? "Transaction Completed" : "Order Entry Portal"}
                </p>
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

function AddLensPurchaseChallan() {
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [purchaseData, setPurchaseData] = useState(null);
  const [category, setCategory] = useState("");
  const { user } = useContext(AuthContext);
  const [accountWisePrices, setAccountWisePrices] = useState({});
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedOrdersItems, setSelectedOrdersItems] = useState({});
  const [sourcePurchaseId, setSourcePurchaseId] = useState(null);
  const [orderType, setOrderType] = useState("LENS");

  const roundAmount = (num) => {
    if (!num) return 0;
    return Math.round(Number(num) * 100) / 100;
  };

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
    CurrentBalance: { amount: 0, type: "Dr" }, allAddresses: []
  });

  const [items, setItems] = useState([{
    id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", combinationId: ""
  }]);

  const [taxes, setTaxes] = useState([{ id: 1, taxName: "", type: "Additive", percentage: "2.5", amount: "0.00" }]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");
  const isReadOnly = (status || "").toLowerCase() === "done" || (status || "").toLowerCase() === "received";

  // Suggestion States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [activeTaxIndex, setActiveTaxIndex] = useState(-1);
  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [rowErrors, setRowErrors] = useState({});

  const containerRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    const fetchById = async () => {
      const res = await getLensPurchaseChallan(id);
      if (res.success) setPurchaseData(res.data.data);
    };
    fetchById();
  }, [id]);

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

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !location.state?.items?.length || !allLens?.length) return;

    const data = location.state;
    if (data.vendor) {
      const vendorAcc = accounts.find(a => a.Name?.toLowerCase() === data.vendor.toLowerCase());
      if (vendorAcc) {
        selectAccount(vendorAcc);
      } else {
        setPartyData(p => ({ ...p, partyAccount: data.vendor }));
      }
    }

    if (data.billData) {
      setBillData(prev => ({
        ...prev,
        godown: data.billData.godown || prev.godown,
        bookedBy: data.billData.bookedBy || prev.bookedBy,
      }));
    }

    if (data.remark) setRemark(data.remark);
    if (data.sourceSaleId) {
      setSourcePurchaseId(data.sourceSaleId);
      setOrderType("RX");
    }

    const mappedItems = data.items.map((it, idx) => {
      const lens = allLens.find(l =>
        String(l.productName || "").trim().toLowerCase() === String(it.productName || "").trim().toLowerCase()
      );

      const purchasePrice = it.purchasePrice || lens?.purchasePrice || 0;
      const qty = Number(it.qty || 0);

      return {
        id: idx + 1,
        barcode: it.barcode || "",
        itemName: it.productName || "",
        orderNo: it.orderNo || "",
        eye: it.eye || "",
        sph: it.sph ?? "",
        cyl: it.cyl ?? "",
        axis: it.axis ?? "",
        add: it.add ?? "",
        qty: qty,
        purchasePrice: purchasePrice,
        discount: 0,
        totalAmount: (qty * purchasePrice).toFixed(2),
        remark: "",
        combinationId: it.combinationId || "",
        _id: it.saleOrderItemId, // Preserving item ID for backend syncing
        vendorItemName: it.vendorItemName || lens?.vendorItemName || "",
        billItemName: it.billItemName || lens?.billItemName || "",
      };
    });

    setItems(mappedItems);
    const iq = {};
    mappedItems.forEach((it, i) => iq[i] = it.itemName || "");
    setItemQueries(iq);

    initializedRef.current = true;
    toast.success("Pre-filled from Sale Order");

  }, [location.state, allLens, accounts]);

  useEffect(() => {
    if (!purchaseData) return;
    setBillData({ ...purchaseData.billData, date: safeDate(purchaseData.billData?.date) });
    setPartyData({ ...purchaseData.partyData, creditLimit: purchaseData.partyData?.creditLimit || 0 });
    setItems(purchaseData.items?.length ? purchaseData.items.map((it, i) => ({ ...it, id: i + 1, totalAmount: String(it.totalAmount) })) : items);
    setTaxes(purchaseData.taxes?.length ? purchaseData.taxes.map(t => ({ ...t, id: t._id || genTaxId("l") })) : taxes);
    setRemark(purchaseData.remark || ""); setStatus(purchaseData.status || "Pending"); setPaidAmount(purchaseData.paidAmount || "");
    const iq = {}; purchaseData.items?.forEach((it, i) => iq[i] = it.itemName || ""); setItemQueries(iq);
  }, [purchaseData]);

  const genTaxId = (s = "") => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}${s}`;

  const selectAccount = async (acc) => {
    const primaryAddr = acc.Address || "";
    const addrs = acc.Addresses || [];
    const allAddresses = Array.from(new Set([primaryAddr, ...addrs].filter(Boolean)));
    setPartyData({
      partyAccount: acc.Name || "", contactNumber: acc.MobileNumber || "", stateCode: acc.State || "", address: primaryAddr, creditLimit: acc.CreditLimit || "",
      CurrentBalance: { amount: acc.CurrentBalance?.amount ?? 0, type: acc.CurrentBalance?.type || "Dr" },
      allAddresses: allAddresses
    });
    setCategory(acc.AccountCategory || "");
    try {
      const b = await getNextBillNumberForPurchaseChallan(acc.Name || "");
      const currentFY = getFinancialYearSeries('P');
      setBillData(v => ({
        ...v,
        billNo: String(b),
        billSeries: v.billSeries || currentFY,
        godown: v.godown || "HO",
        bookedBy: v.bookedBy || user?.name || "",
      }));
      const pr = await getAccountWisePrices(acc._id, "Purchase");
      if (pr.success) { const m = {}; pr.data.forEach(p => m[p.itemId || p.lensGroupId] = p.customPrice); setAccountWisePrices(m); }
    } catch (e) { console.error(e); }
    setShowSuggestions(false);
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
    const pp = accountWisePrices[l._id] || l.purchasePrice || 0;
    setItems(prev => {
      const c = [...prev];
      c[idx] = { 
        ...c[idx], 
        itemName: l.productName, 
        purchasePrice: pp, 
        eye: l.eye || c[idx].eye || "",
        vendorItemName: l.vendorItemName || "",
        billItemName: l.billItemName || ""
      };
      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].purchasePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = (q * p - q * p * (d / 100)).toFixed(2);
      return c;
    });
    setItemQueries(p => ({ ...p, [idx]: l.productName })); setShowItemSuggestions(p => ({ ...p, [idx]: false }));
  };

  const addItemRow = () => setItems(p => [...p, { id: p.length + 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", combinationId: "" }]);
  const deleteItem = (id) => setItems(p => p.filter(it => it.id !== id));

  const checkComb = (r) => {
    const l = allLens.find(lx => lx.productName?.toLowerCase() === r.itemName?.toLowerCase());
    if (!l) return { exists: false, reason: "N/A" };
    const ag = l.addGroups?.find(g => Number(g.addValue) === Number(r.add));
    const comb = ag?.combinations?.find(c => Number(c.sph) === Number(r.sph) && Number(c.cyl) === Number(r.cyl) && (r.eye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === r.eye));
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
        if (l) { 
          c[idx].purchasePrice = accountWisePrices[l._id] || l.purchasePrice || 0; 
          c[idx].eye = l.eye || c[idx].eye || ""; 
          c[idx].vendorItemName = l.vendorItemName || "";
          c[idx].billItemName = l.billItemName || "";
        }
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
  const computeTotalTaxes = () => taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
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

  const handleShowOrders = async () => {
    if (!partyData.partyAccount) return toast.error("Select party");
    try {
      const res = await getAllLensPurchaseOrder();
      if (res.success) setPurchaseOrders(res.data.filter(o => o.partyData?.partyAccount === partyData.partyAccount && (o.balQty > 0 || !o.isInvoiced) && (o.status || "").toLowerCase() !== "done"));
      setShowOrdersModal(true);
    } catch (e) { console.error(e); }
  };

  const handleAddOrderItems = () => {
    // Strip out the default blank placeholder row before adding order items
    const existing = items.filter(it => it.itemName && it.itemName.trim() !== "");
    const ni = [...existing]; let first = false;
    purchaseOrders.forEach(o => {
      if (o.items?.some((_, i) => selectedOrdersItems[`${o._id}-${i}`])) {
        if (!first) { setSourcePurchaseId(o._id); setBillData({ ...o.billData, date: safeDate(o.billData?.date) }); first = true; }
        o.items.forEach((it, i) => { if (selectedOrdersItems[`${o._id}-${i}`]) ni.push({ ...it, id: ni.length + 1, _id: it._id }); });
      }
    });
    // If no real items were added and nothing existed, keep one blank row
    setItems(ni.length > 0 ? ni : [{ id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", combinationId: "" }]);
    setShowOrdersModal(false);
    setSelectedOrdersItems({});
  };

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
      sourcePurchaseId,
      orderType,
      companyId: user?.companyId // Link to tenant
    };
    const res = id ? await editLensPurchaseChallan(id, p) : await addLensPurchaseChallan(p);
    if (res.success) { toast.success("Success!"); navigate("/lenstransaction/purchase/purchasechallan"); } else toast.error(res.message || "Failed");
  };

  const handleReset = () => window.location.reload();

  const getInitStockForRow = (idx) => {
    const r = items[idx]; if (!r || !r.itemName) return "-";
    const ck = checkComb(r); return ck.exists ? ck.stock : "-";
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-black">
      <Header isReadOnly={isReadOnly} id={id} />

      <div className="flex-1 overflow-hidden p-3 space-y-3 flex flex-col min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
          {/* Voucher Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Voucher Info</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><label className="text-[10px] text-slate-400 uppercase">Series</label><input type="text" value={billData.billSeries} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, billSeries: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] text-slate-400 uppercase">Number</label><input type="text" value={billData.billNo} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, billNo: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] text-slate-400 uppercase">Date</label><input type="date" value={safeDate(billData.date)} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, date: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none" /></div>
              <div className="space-y-1 relative"><label className="text-[10px] text-slate-400 uppercase">Bill Type</label><input type="text" value={billData.billType} disabled={isReadOnly} onFocus={() => !isReadOnly && setShowTaxSuggestions(true)} onChange={e => { setTaxQuery(e.target.value); setBillData(v => ({ ...v, billType: e.target.value })) }} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" />
                {showTaxSuggestions && filteredTaxes.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg z-50 p-1">
                    {filteredTaxes.map((t, i) => <div key={i} onMouseDown={() => selectTax(t)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase">{t.Name}</div>)}
                  </div>
                )}
              </div>
              <div className="space-y-1"><label className="text-[10px] text-slate-400 uppercase">Godown</label><input type="text" value={billData.godown} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] text-slate-400 uppercase">Booked By</label><input type="text" value={billData.bookedBy} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
            </div>
          </div>

          {/* Supplier Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Supplier Info</h3>
              </div>
              <div className="flex gap-2">
                 <div className="flex flex-col items-end px-3 py-1 bg-orange-50 rounded-lg border border-orange-100">
                    <span className="text-[8px] font-black text-orange-400 uppercase leading-none">Limit</span>
                    <span className="text-[10px] font-black text-orange-700 leading-none mt-0.5">₹{partyData.creditLimit ? roundAmount(partyData.creditLimit) : "0"}</span>
                 </div>
                 <div className="flex flex-col items-end px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[8px] font-black text-blue-400 uppercase leading-none">Balance</span>
                    <span className="text-[10px] font-black text-blue-700 leading-none mt-0.5">{partyData.CurrentBalance ? `${roundAmount(partyData.CurrentBalance.amount)} ${partyData.CurrentBalance.type}` : "₹0 Dr"}</span>
                 </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 flex-1">
              <div ref={containerRef} className="col-span-2 relative">
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Account</label>
                <div className="relative group">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" value={partyData.partyAccount} disabled={isReadOnly} onFocus={() => !isReadOnly && setShowSuggestions(true)} onChange={e => { setPartyData(v => ({ ...v, partyAccount: e.target.value })); setShowSuggestions(true); }} onKeyDown={onPartyInputKeyDown} className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" />
                </div>
                {showSuggestions && filteredAccounts.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border border-slate-200 rounded-lg shadow-2xl p-1">
                    {filteredAccounts.map((a, i) => <div key={i} onMouseDown={() => selectAccount(a)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase border-b border-slate-50 last:border-0">{a.Name}</div>)}
                  </div>
                )}
              </div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase block mb-1">Contact</label><input type="text" value={partyData.contactNumber} disabled={isReadOnly} onChange={e => setPartyData(v => ({ ...v, contactNumber: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none" /></div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase block mb-1">State</label><input type="text" value={partyData.stateCode} disabled={isReadOnly} onChange={e => setPartyData(v => ({ ...v, stateCode: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="col-span-4 space-y-1 relative">
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Address</label>
                <input type="text" value={partyData.address} disabled={isReadOnly} onChange={e => setPartyData(v => ({ ...v, address: e.target.value }))} list="challanAddresses" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" />
                <datalist id="challanAddresses">
                  {partyData.allAddresses?.map((addr, idx) => (
                    <option key={idx} value={addr} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            {!isReadOnly && (
              <div className="flex gap-2">
                <button onClick={handleShowOrders} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase flex items-center gap-1.5 transition-all active:scale-95"><Plus className="w-3.5 h-3.5" /> Bulk Order Backlog</button>
                <button onClick={addItemRow} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-black uppercase flex items-center gap-1.5 transition-all active:scale-95"><Plus className="w-3.5 h-3.5" /> Add New Item</button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-900 text-white sticky top-0 z-30">
                <tr className="text-[9px] uppercase tracking-wider text-left">
                  <th className="w-8 py-2 text-center">#</th>
                  <th className="w-32 px-2">Barcode</th>
                  <th className="px-2">Item Name</th>
                  <th className="w-24 px-2">Order No</th>
                  <th className="w-16 text-center">Eye</th>
                  <th className="w-16 text-center">Sph</th>
                  <th className="w-16 text-center">Cyl</th>
                  <th className="w-16 text-center">Axis</th>
                  <th className="w-16 text-center">Add</th>
                  <th className="w-16 text-center">Qty</th>
                  <th className="w-16 text-center text-blue-400">Disc%</th>
                  <th className="w-24 text-right">
                    <div className="flex items-center justify-end gap-1 px-1">
                      <span>Price</span>
                      {!isReadOnly && items.length > 1 && <button onClick={copyFirstPriceToAll} className="p-0.5 hover:bg-white/20 rounded"><Copy className="w-2.5 h-2.5" /></button>}
                    </div>
                  </th>
                  <th className="w-24 text-right px-2">Total</th>
                  <th className="w-32 text-center">Remark</th>
                  <th className="w-8 text-center bg-slate-800">S</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-slate-50/50 group transition-colors">
                    <td className="py-1 text-center text-[10px] text-slate-400 font-bold">{idx + 1}</td>
                    <td><input type="text" value={it.barcode} disabled={isReadOnly} onChange={e => updateItem(idx, "barcode", e.target.value)} placeholder="BARCODE" className="w-full px-2 py-1 text-[11px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td className="relative">
                      <input type="text" value={itemQueries[idx] ?? it.itemName} disabled={isReadOnly} onFocus={() => !isReadOnly && setShowItemSuggestions(p => ({ ...p, [idx]: true }))} onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)} onChange={e => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }} placeholder="ITEM NAME" className="w-full px-2 py-1 text-[11px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" />
                      {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl z-[70] rounded-lg p-1 max-h-48 overflow-auto">
                          {getFilteredLens(idx).map((l, i) => <div key={i} onMouseDown={() => selectLens(l, idx)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase font-black border-b border-slate-50 last:border-0">{l.productName}</div>)}
                        </div>
                      )}
                    </td>
                    <td><input type="text" value={it.orderNo} disabled={isReadOnly} onChange={e => updateItem(idx, "orderNo", e.target.value)} placeholder="ORDER NO" className="w-full px-2 py-1 text-[11px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><div className="text-center text-[10px] text-blue-600 font-black">{it.eye ||"—"}</div></td>
                    <td><input type="text" value={it.sph} disabled={isReadOnly} onBlur={() => !isReadOnly && validateRow(idx)} onChange={e => updateItem(idx, "sph", e.target.value)} placeholder="0.00" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="text" value={it.cyl} disabled={isReadOnly} onBlur={() => !isReadOnly && validateRow(idx)} onChange={e => updateItem(idx, "cyl", e.target.value)} placeholder="0.00" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="text" value={it.axis} disabled={isReadOnly} onBlur={() => !isReadOnly && validateRow(idx)} onChange={e => updateItem(idx, "axis", e.target.value)} placeholder="0" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="text" value={it.add} disabled={isReadOnly} onBlur={() => !isReadOnly && validateRow(idx)} onChange={e => updateItem(idx, "add", e.target.value)} placeholder="0.00" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="number" value={it.qty} disabled={isReadOnly} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="0" className="w-full text-center py-1 text-[11px] bg-emerald-50/50 text-emerald-700 outline-none font-black tabular-nums placeholder:font-bold placeholder:text-emerald-300/70" /></td>
                    <td><input type="number" value={it.discount} disabled={isReadOnly} onChange={e => updateItem(idx, "discount", e.target.value)} placeholder="0" className="w-full text-center py-1 text-[11px] bg-blue-50/10 text-blue-600 outline-none font-black tabular-nums placeholder:font-bold placeholder:text-blue-300/70" /></td>
                    <td><input type="number" value={it.purchasePrice} disabled={isReadOnly} onChange={e => updateItem(idx, "purchasePrice", Number(e.target.value))} placeholder="0.00" className="w-full text-right px-2 py-1 text-[11px] bg-blue-50/50 text-blue-700 outline-none font-black tabular-nums placeholder:font-bold placeholder:text-blue-300/70" /></td>
                    <td className="text-right px-2 text-[11px] font-black text-slate-800">₹{it.totalAmount || "0.00"}</td>
                    <td><input type="text" value={it.remark} disabled={isReadOnly} onChange={e => updateItem(idx, "remark", e.target.value)} placeholder="REMARK" className="w-full px-2 py-1 text-[10px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td className="text-center text-[9px] text-slate-400 bg-slate-50/50 font-bold">{getInitStockForRow(idx)}</td>
                    <td className="text-center">
                      {!isReadOnly && <button onClick={() => deleteItem(it.id)} className="p-1 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0">
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col min-h-[140px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-50 text-orange-600 rounded">
                  <Calculator className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase">Adjustment & Taxes</h3>
              </div>
              {!isReadOnly && <button onClick={addTaxRow} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ New Charge</button>}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[10px] uppercase">
                <thead className="bg-slate-50 sticky top-0"><tr className="text-slate-400"><th className="px-3 py-1 text-left">Desc</th><th className="w-24 text-center">Type</th><th className="w-16 text-right">%</th><th className="w-24 text-right px-3">Amount</th><th className="w-8"></th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {taxes.map((t, i) => (
                    <tr key={t.id}>
                      <td className="py-1 px-3"><input type="text" value={t.taxName} disabled={isReadOnly} onChange={e => updateTax(i, "taxName", e.target.value)} className="w-full bg-transparent outline-none font-black" /></td>
                      <td className="text-center"><select value={t.type} disabled={isReadOnly} onChange={e => updateTax(i, "type", e.target.value)} className="bg-white border rounded px-1 text-[9px] font-black"><option>Additive</option><option>Subtractive</option></select></td>
                      <td className="text-right"><input type="number" value={t.percentage} disabled={isReadOnly} onChange={e => updateTax(i, "percentage", e.target.value)} className="w-full text-right bg-transparent outline-none font-black" /></td>
                      <td className="text-right px-3 text-slate-500 font-black">₹{t.amount}</td>
                      <td className="text-center">{!isReadOnly && <button onClick={() => deleteTax(t.id)} className="text-slate-200 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-800 flex flex-col gap-3">
             <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest">
                   <span>Subtotal Gross</span>
                   <span className="text-slate-300 tabular-nums font-black">₹{computeSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest">
                   <span>Tax & Adjust</span>
                   <span className="text-emerald-400 tabular-nums font-black">+ ₹{computeTotalTaxes().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-slate-800/50 my-1"></div>
                <div className="flex justify-between items-baseline">
                   <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Net Due</span>
                   <div className="text-3xl font-black text-white tabular-nums tracking-tighter"><span className="text-lg text-slate-600 mr-1">₹</span>{computeNetAmount().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
             </div>

             <div className="flex gap-2">
                <button onClick={handleReset} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded border border-slate-700/50 transition-all active:scale-95"><RotateCcw className="w-3.5 h-3.5 mx-auto" /></button>
                <button onClick={handleSave} disabled={isReadOnly} className={`flex-[3] py-2 ${isReadOnly ? 'bg-slate-700 cursor-not-allowed text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white'} font-black text-[11px] uppercase tracking-[0.2em] rounded shadow-xl transition-all active:scale-95`}>Commit Challan</button>
             </div>
          </div>
        </div>
      </div>
      
      {/* Backlog Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <input type="checkbox" className="w-4 h-4" checked={purchaseOrders.length > 0 && purchaseOrders.every(o => o.items?.every((_, i) => selectedOrdersItems[`${o._id}-${i}`]))} onChange={(e) => { const next = {}; if (e.target.checked) { purchaseOrders.forEach(o => { o.items?.forEach((_, i) => { next[`${o._id}-${i}`] = true; }); }); } setSelectedOrdersItems(next); }} />
                  <span className="text-[8px] font-black text-slate-400 uppercase">All</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Purchase Backlog</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase">{partyData.partyAccount}</p>
                </div>
              </div>
              <button onClick={() => setShowOrdersModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-50/50">
              {purchaseOrders.length === 0 ? <div className="text-center py-20 text-slate-300 font-black uppercase">No pending orders found</div> : purchaseOrders.map(o => (
                <div key={o._id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 flex justify-between items-center border-b font-black uppercase text-[10px]">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" onChange={e => { const next = { ...selectedOrdersItems }; o.items?.forEach((_, i) => next[`${o._id}-${i}`] = e.target.checked); setSelectedOrdersItems(next); }} className="w-4 h-4" />
                      <span>Order #{o.billData?.billNo} | {safeDate(o.billData?.date)}</span>
                    </div>
                    <span className="text-blue-600">₹{o.netAmount?.toFixed(2)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[10px] uppercase font-black">
                      <thead className="bg-slate-50 text-slate-400 border-b"><tr><th className="p-2 w-10"></th><th className="p-2">Item</th><th className="p-2 text-center">Eye</th><th className="p-2 text-center">Powers</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Price</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {o.items?.map((it, i) => (
                          <tr key={i} className="hover:bg-blue-50/30">
                            <td className="p-2 text-center"><input type="checkbox" checked={selectedOrdersItems[`${o._id}-${i}`] || false} onChange={e => setSelectedOrdersItems(p => ({ ...p, [`${o._id}-${i}`]: e.target.checked }))} className="w-3.5 h-3.5" /></td>
                            <td className="p-2">{it.itemName}</td>
                            <td className="p-2 text-center text-blue-600">{it.eye ||"—"}</td>
                            <td className="p-2 text-center text-slate-500">{it.sph}/{it.cyl}/{it.axis}/{it.add}</td>
                            <td className="p-2 text-right text-emerald-700">{it.qty}</td>
                            <td className="p-2 text-right text-blue-700">₹{it.purchasePrice?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowOrdersModal(false)} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase hover:bg-slate-100 rounded">Discard</button>
              <button onClick={handleAddOrderItems} disabled={!Object.values(selectedOrdersItems).some(v => v)} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shadow-lg transition-all active:scale-95">Pull Order Data</button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default AddLensPurchaseChallan;
