import React, { useEffect, useRef, useState, useMemo } from "react";
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
  X,
  Package,
} from "lucide-react";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
  addLensPurchaseReturn,
  getLensPurchaseReturn,
  editLensPurchaseReturn,
  getNextBillNumberForParty,
} from "../controllers/PurchaseReturn.controller";
import { getAllLensPurchaseOrder } from "../controllers/LensPurchaseOrder.controller";
import { getAllRxPurchaseOrder } from "../controllers/RxPurchaseOrder.controller";
import { getAllContactLensPurchaseOrder } from "../controllers/ContactLensPurchaseOrder.controller";
import { getAllLensPurchaseChallan } from "../controllers/LensPurchaseChallan.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { roundAmount } from "../utils/amountUtils";

const Header = ({ isReadOnly, id, title = "Purchase Return Entry" }) => (
    <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-600 rounded shadow-sm">
                <RotateCcw className="w-4 h-4 text-white" />
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
                    {isReadOnly ? "Transaction Completed" : "Inventory Return Portal"}
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

function AddPurchaseReturn() {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const [purchaseData, setPurchaseData] = useState(null);
  const [category, setCategory] = useState("");
  const [accountWisePrices, setAccountWisePrices] = useState({});
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedOrdersItems, setSelectedOrdersItems] = useState({});
  const [sourcePurchaseId, setSourcePurchaseId] = useState(null);
  
  const [orderItemFilter, setOrderItemFilter] = useState("");
  const [orderSphFilter, setOrderSphFilter] = useState("");
  const [orderCylFilter, setOrderCylFilter] = useState("");
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(order => {
      const orderDate = order.billData?.date ? new Date(order.billData.date).setHours(0,0,0,0) : null;
      const start = orderStartDate ? new Date(orderStartDate).setHours(0,0,0,0) : null;
      const end = orderEndDate ? new Date(orderEndDate).setHours(0,0,0,0) : null;
      if (start && orderDate && orderDate < start) return false;
      if (end && orderDate && orderDate > end) return false;
      if (orderItemFilter) {
        const matches = order.items?.some(it => String(it.itemName || "").toLowerCase().includes(orderItemFilter.toLowerCase()));
        if (!matches) return false;
      }
      if (orderSphFilter) {
        const matches = order.items?.some(it => String(it.sph || "").replace(/\s/g, '').toLowerCase().includes(orderSphFilter.replace(/\s/g, '').toLowerCase()));
        if (!matches) return false;
      }
      if (orderCylFilter) {
        const matches = order.items?.some(it => String(it.cyl || "").replace(/\s/g, '').toLowerCase().includes(orderCylFilter.replace(/\s/g, '').toLowerCase()));
        if (!matches) return false;
      }
      return true;
    });
  }, [purchaseOrders, orderItemFilter, orderSphFilter, orderCylFilter, orderStartDate, orderEndDate]);

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
    partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: "",
    CurrentBalance: { amount: 0, type: "Dr" }, allAddresses: []
  });

  const [items, setItems] = useState([{
    id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", combinationId: ""
  }]);

  const [taxes, setTaxes] = useState([{ id: 1, taxName: "", type: "Additive", percentage: "2.5", amount: "0" }]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");

  // Suggestion States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [rowErrors, setRowErrors] = useState({});

  const containerRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    const fetchById = async () => {
      const res = await getLensPurchaseReturn(id);
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
      const b = await getNextBillNumberForParty(acc.Name || "");
      const currentFY = getFinancialYearSeries('PR');
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
      c[idx] = { ...c[idx], itemName: l.productName, purchasePrice: pp, eye: l.eye || c[idx].eye || "" };
      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].purchasePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = roundAmount(q * p - d);
      return c;
    });
    setItemQueries(p => ({ ...p, [idx]: l.productName })); setShowItemSuggestions(p => ({ ...p, [idx]: false }));
  };

  const addItemRow = () => setItems(p => [...p, { id: p.length + 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", purchasePrice: 0, discount: "", totalAmount: "", combinationId: "" }]);
  const deleteItem = (id) => setItems(p => p.filter(it => it.id !== id));
  const updateItem = (idx, f, v) => {
    setItems(prev => {
      const c = [...prev]; c[idx][f] = v;
      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].purchasePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = roundAmount(q * p - d);
      return c;
    });
  };

  const addTaxRow = () => setTaxes(p => [...p, { id: genTaxId("m"), taxName: "", type: "Additive", percentage: "", amount: "0" }]);
  const deleteTax = (id) => setTaxes(p => p.filter(t => t.id !== id));
  const updateTax = (idx, f, v) => setTaxes(p => { const c = [...p]; c[idx][f] = v; const sub = computeSubtotal(), pct = parseFloat(f === "percentage" ? v : c[idx].percentage) || 0; c[idx].amount = roundAmount((sub * pct) / 100); return c; });

  const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
  const computeTotalTaxes = () => taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();

  const handleShowOrders = async () => {
    if (!partyData.partyAccount) return toast.error("Select party");
    try {
      const [lensRes, rxRes, clRes, challanRes] = await Promise.all([
        getAllLensPurchaseOrder(),
        getAllRxPurchaseOrder(),
        getAllContactLensPurchaseOrder(),
        getAllLensPurchaseChallan()
      ]);
      let allOrders = [];
      if (lensRes.success) allOrders = [...allOrders, ...lensRes.data.map(o => ({...o, sourceTitle: "LENS PURCHASE ORDER"}))];
      if (rxRes.success) allOrders = [...allOrders, ...rxRes.data.map(o => ({...o, sourceTitle: "RX PURCHASE ORDER"}))];
      if (clRes.success) allOrders = [...allOrders, ...clRes.data.map(o => ({...o, sourceTitle: "CONTACT LENS & SOLUTION"}))];
      
      if (challanRes?.success) allOrders = [...allOrders, ...challanRes.data.map(o => ({ ...o, sourceTitle: "LENS PURCHASE CHALLAN" }))];
      else if (challanRes?.data) allOrders = [...allOrders, ...(Array.isArray(challanRes.data) ? challanRes.data : []).map(o => ({ ...o, sourceTitle: "LENS PURCHASE CHALLAN" }))];

      setPurchaseOrders(allOrders.filter(o => o.partyData?.partyAccount === partyData.partyAccount && (o.balQty > 0 || !o.isInvoiced)));
      setShowOrdersModal(true);
    } catch (e) { console.error(e); }
  };

  const handleAddOrderItems = () => {
    const existing = items.filter(it => it.itemName && it.itemName.trim() !== "");
    const ni = [...existing];
    let first = false;
    purchaseOrders.forEach(o => {
      if (o.items?.some((_, i) => selectedOrdersItems[`${o._id}-${i}`])) {
        if (!first) { setSourcePurchaseId(o._id); setBillData(v => ({ ...v, date: safeDate(o.billData?.date) })); first = true; }
        o.items.forEach((it, i) => { if (selectedOrdersItems[`${o._id}-${i}`]) ni.push({ ...it, id: ni.length + 1, _id: it._id }); });
      }
    });
    setItems(ni); setShowOrdersModal(false);
  };

  const handleSave = async () => {
    const sub = computeSubtotal(), tx = computeTotalTaxes(), net = sub + tx;
    const p = {
      billData, partyData, items, taxes, subtotal: sub, taxesAmount: tx, netAmount: net, paidAmount, dueAmount: net - Number(paidAmount), remark, status, sourcePurchaseId
    };
    const res = id ? await editLensPurchaseReturn(id, p) : await addLensPurchaseReturn(p);
    if (res.success) { toast.success("Saved!"); navigate("/lenstransaction/purchasereturn"); } else toast.error(res.message || "Failed");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-black">
      <Header isReadOnly={status === "Completed" || status === "Locked"} id={id} />

      <div className="flex-1 overflow-hidden p-3 space-y-3 flex flex-col min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Receipt className="w-4 h-4" /></div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Return Voucher</h3>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3 font-black">
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">Series</label><input type="text" value={billData.billSeries} onChange={e => setBillData(v => ({ ...v, billSeries: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">Number</label><input type="text" value={billData.billNo} onChange={e => setBillData(v => ({ ...v, billNo: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">Date</label><input type="date" value={safeDate(billData.date)} onChange={e => setBillData(v => ({ ...v, date: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none" /></div>
              <div className="col-span-1 space-y-1 relative">
                <label className="text-[10px] text-slate-400 uppercase">Bill Type</label>
                <input type="text" value={taxQuery || billData.billType} onFocus={() => setShowTaxSuggestions(true)} onBlur={() => setTimeout(() => setShowTaxSuggestions(false), 200)} onChange={e => { setTaxQuery(e.target.value); setShowTaxSuggestions(true); setBillData(v=>({...v, billType: e.target.value})); }} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" />
                {showTaxSuggestions && filteredTaxes.length > 0 && (
                  <div className="absolute left-0 right-0 z-[110] mt-1 bg-white border border-slate-200 rounded shadow-xl p-1 max-h-40 overflow-auto">
                    {filteredTaxes.map((t, i) => <div key={i} onMouseDown={() => selectTax(t)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase border-b last:border-0">{t.Name}</div>)}
                  </div>
                )}
              </div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">Godown</label><select value={billData.godown} onChange={e => setBillData(v => ({ ...v, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none font-black"><option>HO</option><option>Main</option></select></div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">Booked By</label><input type="text" value={billData.bookedBy} onChange={e => setBillData(v => ({ ...v, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none font-black" /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3 flex flex-col font-black">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><User className="w-4 h-4" /></div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Supplier Info</h3>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-[8px] font-black text-blue-400 uppercase">Balance:</span>
                <span className="text-[10px] font-black text-blue-700 uppercase leading-none mt-0.5">{partyData.CurrentBalance ? `${roundAmount(partyData.CurrentBalance.amount)} ${partyData.CurrentBalance.type}` : "₹0 Dr"}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 flex-1 font-black">
              <div className="col-span-2 relative">
                <label className="text-[10px] text-slate-400 uppercase">Account</label>
                <div className="relative group">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" value={partyData.partyAccount} onFocus={() => setShowSuggestions(true)} onChange={e => { setPartyData(v => ({ ...v, partyAccount: e.target.value })); setShowSuggestions(true); }} onKeyDown={onPartyInputKeyDown} className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" />
                </div>
                {showSuggestions && filteredAccounts.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border border-slate-200 rounded-lg shadow-2xl p-1">
                    {filteredAccounts.map((a, i) => <div key={i} onMouseDown={() => selectAccount(a)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase font-black border-b border-slate-50 last:border-0">{a.Name}</div>)}
                  </div>
                )}
              </div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">Contact</label><input type="text" value={partyData.contactNumber} onChange={e => setPartyData(v => ({ ...v, contactNumber: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] outline-none" /></div>
              <div className="col-span-1 space-y-1"><label className="text-[10px] text-slate-400 uppercase">State</label><input type="text" value={partyData.stateCode} onChange={e => setPartyData(v => ({ ...v, stateCode: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" /></div>
              <div className="col-span-4 space-y-1 relative">
                <label className="text-[10px] text-slate-400 uppercase">Address</label>
                <input type="text" value={partyData.address} onChange={e => setPartyData(v => ({ ...v, address: e.target.value }))} list="returnAddresses" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] uppercase outline-none" />
                <datalist id="returnAddresses">
                  {partyData.allAddresses?.map((addr, idx) => (
                    <option key={idx} value={addr} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleShowOrders} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-black uppercase flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Pull Backlog</button>
          <button onClick={addItemRow} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-black uppercase flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Add Row</button>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0 overflow-hidden font-black uppercase">
          <div className="flex-1 overflow-auto tabular-nums">
            <table className="w-full border-collapse table-auto">
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
                  <th className="w-16 text-center text-rose-400">Qty</th>
                  <th className="w-16 text-center text-rose-400">Disc%</th>
                  <th className="w-24 text-right">Unit Price</th>
                  <th className="w-24 text-right px-2">Amount</th>
                  <th className="w-32 text-center">Remark</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-1 text-center text-[10px] text-slate-400 font-bold">{idx + 1}</td>
                    <td><input type="text" value={it.barcode} onChange={e => updateItem(idx, "barcode", e.target.value)} placeholder="BARCODE" className="w-full px-2 py-1 text-[11px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td className="relative">
                      <input type="text" value={itemQueries[idx] ?? it.itemName} onFocus={() => setShowItemSuggestions(p => ({ ...p, [idx]: true }))} onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)} onChange={e => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }} placeholder="ITEM NAME" className="w-full px-2 py-1 text-[11px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" />
                      {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl z-[70] rounded-lg p-1 max-h-48 overflow-auto">
                          {getFilteredLens(idx).map((l, i) => <div key={i} onMouseDown={() => selectLens(l, idx)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase font-black border-b border-slate-50 last:border-0">{l.productName}</div>)}
                        </div>
                      )}
                    </td>
                    <td><input type="text" value={it.orderNo} onChange={e => updateItem(idx, "orderNo", e.target.value)} placeholder="ORDER NO" className="w-full px-2 py-1 text-[11px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><div className="text-center text-[10px] text-blue-600 font-black">{it.eye ||"—"}</div></td>
                    <td><input type="text" value={it.sph} onChange={e => updateItem(idx, "sph", e.target.value)} placeholder="0.00" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="text" value={it.cyl} onChange={e => updateItem(idx, "cyl", e.target.value)} placeholder="0.00" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="text" value={it.axis} onChange={e => updateItem(idx, "axis", e.target.value)} placeholder="0" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="text" value={it.add} onChange={e => updateItem(idx, "add", e.target.value)} placeholder="0.00" className="w-full text-center py-1 text-[11px] bg-transparent outline-none font-black tabular-nums placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td><input type="number" value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="0" className="w-full text-center py-1 text-[11px] bg-rose-50/50 text-rose-700 outline-none font-black tabular-nums placeholder:font-bold placeholder:text-rose-300/70" /></td>
                    <td><input type="number" value={it.discount} onChange={e => updateItem(idx, "discount", e.target.value)} placeholder="0" className="w-full text-center py-1 text-[11px] bg-blue-50/10 text-blue-600 outline-none font-black tabular-nums placeholder:font-bold placeholder:text-blue-300/70" /></td>
                    <td><input type="number" value={it.purchasePrice} onChange={e => updateItem(idx, "purchasePrice", Number(e.target.value))} placeholder="0.00" className="w-full text-right px-2 py-1 text-[11px] bg-blue-50/50 text-blue-700 outline-none font-black tabular-nums placeholder:font-bold placeholder:text-blue-300/70" /></td>
                    <td className="text-right px-2 text-[11px] font-black text-rose-600">₹{roundAmount(it.totalAmount)}</td>
                    <td><input type="text" value={it.remark} onChange={e => updateItem(idx, "remark", e.target.value)} placeholder="REMARK" className="w-full px-2 py-1 text-[10px] bg-transparent outline-none uppercase font-black placeholder:font-bold placeholder:text-slate-300/70" /></td>
                    <td className="text-center">
                      <button onClick={() => deleteItem(it.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-black uppercase"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-shrink-0 font-black uppercase tabular-nums">
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col min-h-[140px]">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="text-[11px] font-black text-slate-700 uppercase">Tax Summary</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[10px] uppercase font-black">
                <thead className="bg-slate-50 text-slate-400 border-b"><tr className="text-left"><th className="px-3 py-1">Type</th><th className="w-16 text-right">%</th><th className="w-24 text-right px-3">Amount</th><th className="w-8"></th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {taxes.map((t, i) => (
                    <tr key={t.id}>
                      <td className="py-1 px-3"><input type="text" value={t.taxName} onChange={e => updateTax(i, "taxName", e.target.value)} className="w-full bg-transparent outline-none" /></td>
                      <td className="text-right py-1"><input type="number" value={t.percentage} onChange={e => updateTax(i, "percentage", e.target.value)} className="w-full text-right bg-transparent outline-none" /></td>
                      <td className="text-right px-3 text-blue-700 font-black py-1">₹{roundAmount(t.amount)}</td>
                      <td className="text-center py-1"><button onClick={() => deleteTax(t.id)} className="text-slate-200 hover:text-red-500 font-black uppercase"><Trash2 className="w-3 h-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 bg-rose-950 rounded-xl p-4 shadow-xl border border-rose-900 flex flex-col gap-3 font-black tabular-nums uppercase tracking-tighter">
             <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-rose-400/50">
                   <span>GROSS VALUE</span>
                   <span className="text-rose-200 tabular-nums">₹{roundAmount(computeSubtotal()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-rose-400/50">
                   <span>TAX REVERSAL</span>
                   <span className="text-rose-400 tabular-nums">+ ₹{roundAmount(computeTotalTaxes()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-rose-900/50 my-1"></div>
                <div className="flex justify-between items-baseline">
                   <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] leading-none">NET CREDIT</span>
                   <div className="text-3xl font-black text-white tabular-nums tracking-tighter leading-none"><span className="text-lg text-rose-600 mr-1">₹</span>{roundAmount(computeNetAmount()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
             </div>
             <button onClick={handleSave} className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded shadow-xl transition-all active:scale-95 leading-none">POST RETURN</button>
          </div>
        </div>
      </div>

      {showOrdersModal && (
        <div className="fixed inset-0 bg-slate-100/80 backdrop-blur-sm flex justify-center z-[500] p-4 font-sans uppercase">
          {(() => {
            const allChecked = Object.values(selectedOrdersItems).filter(Boolean).length > 0 && 
              filteredOrders.every(o => o.items?.every((_, i) => selectedOrdersItems[`${o._id}-${i}`]));

            const toggleAllOrders = (e) => {
              const isChecked = e.target.checked;
              const next = { ...selectedOrdersItems };
              filteredOrders.forEach(o => {
                o.items?.forEach((_, i) => {
                  next[`${o._id}-${i}`] = isChecked;
                });
              });
              setSelectedOrdersItems(next);
            };

            return (
<div className="bg-slate-50 w-full max-w-[1400px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] flex flex-col border-t-[6px] border-emerald-500 overflow-hidden" style={{borderRadius: "0 0 16px 16px", maxHeight: "95vh"}}>
  <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white sticky top-0 z-10 w-full flex-shrink-0">
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center justify-center mr-2 text-[#1a1f33]">
        <input type="checkbox" checked={allChecked} onChange={toggleAllOrders} className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer shadow-sm" />
        <span className="text-[9px] font-black uppercase text-[#1a1f33] mt-1 tracking-widest leading-none">ALL</span>
      </div>
      <Package className="w-8 h-8 text-emerald-500" strokeWidth={2.5} />
      <div className="flex flex-col">
        <h2 className="text-2xl font-black text-[#1a1f33] tracking-tight leading-none uppercase">ACTIVE PURCHASE BACKLOG</h2>
        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest leading-none">
          PENDING ITEMS FROM: <span className="text-emerald-600 font-black">{partyData.partyAccount}</span>
        </p>
      </div>
    </div>
    <button onClick={() => setShowOrdersModal(false)} className="rounded p-2 text-slate-400 hover:text-red-500 transition-colors">
      <X className="w-8 h-8" strokeWidth={1.5} />
    </button>
  </div>
  
  <div className="flex-1 overflow-y-auto">
    <div className="px-6 py-6 pb-2 border-b border-slate-100">
      <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm flex flex-wrap gap-4 items-end mb-6">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">ITEM</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="NAME..." value={orderItemFilter} onChange={e => setOrderItemFilter(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-xs font-black uppercase bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-400" />
          </div>
        </div>
        <div className="w-24 space-y-1.5">
          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">SPH</label>
          <input type="text" placeholder="+/-" value={orderSphFilter} onChange={e => setOrderSphFilter(e.target.value)} className="w-full px-4 py-2.5 text-xs font-black uppercase bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-400" />
        </div>
        <div className="w-24 space-y-1.5">
          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">CYL</label>
          <input type="text" placeholder="+/-" value={orderCylFilter} onChange={e => setOrderCylFilter(e.target.value)} className="w-full px-4 py-2.5 text-xs font-black uppercase bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-400" />
        </div>
        <div className="space-y-1.5 w-40">
          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">START DATE</label>
          <input type="date" value={orderStartDate} onChange={e => setOrderStartDate(e.target.value)} className="w-full px-3 py-2.5 text-xs font-black uppercase bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-700" />
        </div>
        <div className="space-y-1.5 w-40">
          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">END DATE</label>
          <input type="date" value={orderEndDate} onChange={e => setOrderEndDate(e.target.value)} className="w-full px-3 py-2.5 text-xs font-black uppercase bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-700" />
        </div>
        <button onClick={() => { setOrderItemFilter(""); setOrderSphFilter(""); setOrderCylFilter(""); setOrderStartDate(""); setOrderEndDate(""); }} className="px-5 py-2.5 bg-[#f1f3f9] hover:bg-[#e4e7ef] text-[#1a1f33] font-black uppercase tracking-widest text-[10px] rounded-lg transition-colors h-[42px]">
          RESET
        </button>
      </div>

      <div className="space-y-5">
        {filteredOrders.length === 0 ? <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest">NO MATCHING ORDERS FOUND</div> : filteredOrders.map(o => (
          <div key={o._id} className="bg-white rounded-[12px] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-4">
                <input type="checkbox" checked={o.items?.every((_, i) => selectedOrdersItems[`${o._id}-${i}`]) || false} onChange={e => { const next = { ...selectedOrdersItems }; o.items?.forEach((_, i) => next[`${o._id}-${i}`] = e.target.checked); setSelectedOrdersItems(next); }} className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-black text-[#1a1f33] uppercase tracking-tight">ORDER GROUP #{o.billData?.billNo || 'UNTITLED'}</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-[10px] text-emerald-600 font-black uppercase tracking-widest rounded">{o.sourceTitle || "LENS PURCHASE ORDER"}</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">DATED: {safeDate(o.billData?.date)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-black text-blue-600 tabular-nums tracking-tight">₹ {Number(o.netAmount || o.totals?.netAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <div className="text-[8px] font-black text-slate-400 mt-0.5 uppercase tracking-widest">NET AMOUNT</div>
              </div>
            </div>
            
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-white">
                  <tr className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
                    <th className="px-5 py-3 w-16 text-center">SELECT</th>
                    <th className="px-4 py-3">ITEM DESCRIPTION</th>
                    <th className="px-4 py-3 text-center">ORDER NO</th>
                    <th className="px-2 py-3 text-center">EYE</th>
                    <th className="px-2 py-3 text-center">SPH</th>
                    <th className="px-2 py-3 text-center">CYL</th>
                    <th className="px-2 py-3 text-center">AXIS</th>
                    <th className="px-2 py-3 text-center">ADD</th>
                    <th className="px-4 py-3 text-center">QTY</th>
                    <th className="px-5 py-3 text-right">PRICE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 bg-white pb-2">
                  {o.items?.map((it, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        <input type="checkbox" checked={selectedOrdersItems[`${o._id}-${i}`] || false} onChange={e => setSelectedOrdersItems({ ...selectedOrdersItems, [`${o._id}-${i}`]: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-[11px] font-black text-[#1a1f33] uppercase tracking-tight">{it.itemName}</div>
                        {(it.barcode || it.productCode) && <div className="text-[8px] font-black text-slate-400 mt-0.5 tracking-widest uppercase">REF: {it.barcode || it.productCode}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-center text-[10px] font-black text-slate-500 uppercase">{it.orderNo || '—'}</td>
                      <td className="px-2 py-3.5 text-center text-[10px] font-black text-blue-600 uppercase"><span className="text-blue-600 font-black">{it.eye || "—"}</span></td>
                      <td className="px-2 py-3.5 text-center text-[11px] font-black text-slate-600 tabular-nums">{it.sph || "—"}</td>
                      <td className="px-2 py-3.5 text-center text-[11px] font-black text-slate-600 tabular-nums">{it.cyl || "—"}</td>
                      <td className="px-2 py-3.5 text-center text-[11px] font-black text-slate-600 tabular-nums">{it.axis || "—"}</td>
                      <td className="px-2 py-3.5 text-center text-[11px] font-black text-slate-600 tabular-nums">{it.add || "—"}</td>
                      <td className="px-4 py-3.5 text-center text-[11px] font-black text-emerald-600 tabular-nums tracking-widest"><span className="bg-emerald-50/80 px-2 py-0.5 rounded text-emerald-600">{it.qty} {it.unit || "PCS"}</span></td>
                      <td className="px-5 py-3.5 text-right text-[11px] font-black text-[#1a1f33] tabular-nums tracking-wider leading-none">₹ {Number(it.purchasePrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>

  <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-end flex-shrink-0 w-full z-10">
    <div className="flex gap-4 items-center">
      <button onClick={() => setShowOrdersModal(false)} className="px-6 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-[#1a1f33] transition-colors rounded">
        DISCARD
      </button>
      <button onClick={handleAddOrderItems} disabled={!Object.values(selectedOrdersItems).some(v => v)} className="px-8 py-3 bg-[#a2dfcb] hover:bg-emerald-400 text-[#1a1f33] font-black text-[12px] uppercase tracking-widest rounded-lg shadow-sm disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2">
        <Plus className="w-4 h-4" /> PULL ORDER DATA
      </button>
    </div>
  </div>
</div>
            );
          })()}
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default AddPurchaseReturn;
