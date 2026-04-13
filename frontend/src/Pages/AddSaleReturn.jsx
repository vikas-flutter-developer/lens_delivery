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
  addLensSaleReturn,
  getLensSaleReturn,
  editLensSaleReturn,
  getNextBillNumberForParty,
} from "../controllers/SaleReturn.controller";
import { getAllLensSaleOrder } from "../controllers/LensSale.controller";
import { getAllRxSaleOrder } from "../controllers/RxSaleOrder.controller";
import { getAllContactLensSaleOrder } from "../controllers/ContactLensSaleOrder.controller";
import { getAllLensSaleChallan } from "../controllers/LensSaleChallan.controller";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { roundAmount } from "../utils/amountUtils";

const Header = ({ isReadOnly, id, partyData }) => (
  <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-1.5 bg-blue-600 rounded shadow-sm">
        <RotateCcw className="w-4 h-4 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{id ? "Edit Lens Sale Return" : "New Lens Sale Return"}</h1>
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[8px] font-black uppercase tracking-wider">Completed</span>
            </div>
          )}
        </div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{isReadOnly ? "Transaction Completed" : "Returns Management System"}</p>
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

function AddSaleReturn() {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const [saleData, setSaleData] = useState(null);
  const today = new Date().toISOString().split("T")[0];
  const [category, setCategory] = useState(""); // <-- selected account category
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [saleOrders, setSaleOrders] = useState([]);
  const [selectedOrdersItems, setSelectedOrdersItems] = useState({});
  const [orderItemFilter, setOrderItemFilter] = useState("");
  const [orderSphFilter, setOrderSphFilter] = useState("");
  const [orderCylFilter, setOrderCylFilter] = useState("");
  const [orderScIdFilter, setOrderScIdFilter] = useState("");
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");

  const filteredOrders = useMemo(() => {
    return saleOrders.filter(order => {
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
        const matches = order.items?.some(it => String(it.sph || "").replace(/\s/g,'').toLowerCase().includes(orderSphFilter.replace(/\s/g,'').toLowerCase()));
        if (!matches) return false;
      }
      if (orderCylFilter) {
        const matches = order.items?.some(it => String(it.cyl || "").replace(/\s/g,'').toLowerCase().includes(orderCylFilter.replace(/\s/g,'').toLowerCase()));
        if (!matches) return false;
      }
      if (orderScIdFilter) {
        const billNoMatch = String(order.billData?.billNo || "").toLowerCase().includes(orderScIdFilter.toLowerCase());
        if (!billNoMatch) return false;
      }
      return true;
    });
  }, [saleOrders, orderItemFilter, orderSphFilter, orderCylFilter, orderScIdFilter, orderStartDate, orderEndDate]);

  const safeDate = (d) => {
    try {
      if (!d) return new Date().toISOString().split("T")[0];
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return new Date().toISOString().split("T")[0];
      return dt.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };

  const [billData, setBillData] = useState({
    billSeries: "",
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    billType: "",
    godown: "",
    bookedBy: "",
  });

  useEffect(() => {
    if (!id) return;
    const fetchById = async () => {
      const res = await getLensSaleReturn(id);
      if (res.success) setSaleData(res.data.data);
    };
    fetchById();
  }, [id]);

  useEffect(() => {
    const fetch = async () => {
      try { const res = await getAllAccounts(); setAccounts(Array.isArray(res) ? res : []); }
      catch (err) { console.error(err); setAccounts([]); }
    };
    const fetchTax = async () => {
      try {
        const resTaxes = await getAllTaxCategories();
        const dataArr = resTaxes?.data?.data ?? resTaxes;
        const taxesList = Array.isArray(dataArr) ? dataArr : [];
        setAllTaxes(taxesList);
        const defaultTax = taxesList.find((tax) => tax.isDefault === true);
        if (defaultTax) {
          setBillData((prev) => ({ ...prev, billType: defaultTax.Name ?? defaultTax.name ?? "" }));
          const mappedDefaultTaxes = [];
          if (defaultTax.localTax1 > 0) mappedDefaultTaxes.push({ id: genTaxId("_default_cgst"), taxName: "CGST", type: "Additive", percentage: defaultTax.localTax1, amount: 0 });
          if (defaultTax.localTax2 > 0) mappedDefaultTaxes.push({ id: genTaxId("_default_sgst"), taxName: "SGST", type: "Additive", percentage: defaultTax.localTax2, amount: 0 });
          if (defaultTax.centralTax > 0) mappedDefaultTaxes.push({ id: genTaxId("_default_igst"), taxName: "IGST", type: "Additive", percentage: defaultTax.centralTax, amount: 0 });
          if (defaultTax.cessTax > 0) mappedDefaultTaxes.push({ id: genTaxId("_default_cess"), taxName: "CESS", type: "Additive", percentage: defaultTax.cessTax, amount: 0 });
          setTaxes(mappedDefaultTaxes);
        }
      } catch (err) { console.error(err); setAllTaxes([]); }
    };
    const fetchlenses = async () => {
      try { const res = await getAllLensPower(); const dataArr = res?.data ?? res; setAllLens(Array.isArray(dataArr) ? dataArr : []); }
      catch (err) { console.log(err); setAllLens([]); }
    };
    fetch(); fetchTax(); fetchlenses();
  }, []);

  const [partyData, setPartyData] = useState({
    partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: "",
    CurrentBalance: { amount: 0, type: "Dr" },
  });

  const [items, setItems] = useState([{
    id: 1, barcode: "", itemName: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", salePrice: 0, discount: "", totalAmount: "", sellPrice: "", combinationId: ""
  }]);

  const [taxes, setTaxes] = useState([{ id: 1, taxName: "", type: "Additive", percentage: "2.5", amount: "0.00" }]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");
  const isReadOnly = (status || "").toLowerCase() === "done" || (status || "").toLowerCase() === "received";

  useEffect(() => {
    if (!saleData) return;
    setBillData({
      billSeries: saleData.billData?.billSeries || "",
      billNo: saleData.billData?.billNo || "",
      date: safeDate(saleData.billData?.date),
      billType: saleData.billData?.billType || "",
      godown: saleData.billData?.godown || "",
      bookedBy: saleData.billData?.bookedBy || "",
    });
    setPartyData({
      partyAccount: saleData.partyData?.partyAccount || "",
      address: saleData.partyData?.address || "",
      contactNumber: saleData.partyData?.contactNumber || "",
      stateCode: saleData.partyData?.stateCode || "",
      creditLimit: saleData.partyData?.creditLimit || 0,
      CurrentBalance: { amount: saleData.partyData?.CurrentBalance?.amount ?? 0, type: saleData.partyData?.CurrentBalance?.type || "Dr" },
    });
    setCategory(saleData.partyData?.AccountCategory ?? "");
    const mappedItems = saleData.items?.length ? saleData.items.map((it, i) => ({
      ...it, id: i + 1, totalAmount: roundAmount(it.totalAmount).toString()
    })) : items;
    setItems(mappedItems);
    const mappedTaxes = saleData.taxes?.length ? saleData.taxes.map((t) => ({
      ...t, id: t._id || genTaxId("_loaded")
    })) : taxes;
    setTaxes(mappedTaxes);
    setRemark(saleData.remark || ""); setStatus(saleData.status || "Pending"); setPaidAmount(saleData.paidAmount ?? "");
  }, [saleData]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef(null);
  const query = (partyData.partyAccount || "").trim();
  const filteredAccounts = query.length > 0 ? accounts.filter(acc => String(acc.Name || "").toLowerCase().includes(query.toLowerCase())) : accounts.slice(0, 10);

  const genTaxId = (suffix = "") => `tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;

  const selectAccount = async (acc) => {
    setPartyData({
      partyAccount: acc.Name || "", contactNumber: acc.MobileNumber || "", stateCode: acc.State || "", address: acc.Address || "", creditLimit: acc.CreditLimit || "",
      CurrentBalance: { amount: acc.CurrentBalance?.amount ?? 0, type: acc.CurrentBalance?.type || "Dr" }
    });
    setCategory(acc.AccountCategory || "");
    try {
      const nextBillNo = await getNextBillNumberForParty(acc.Name || "");
      const currentFY = getFinancialYearSeries("SR");
      setBillData(prev => ({ ...prev, billNo: prev.billNo || String(nextBillNo), billSeries: prev.billSeries || currentFY, godown: "HO", bookedBy: prev.bookedBy || user?.name || "" }));
    } catch (err) { console.error(err); }
    setShowSuggestions(false);
  };

  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const filteredTaxes = taxQuery ? allTaxes.filter(tax => String(tax.Name || "").toLowerCase().includes(taxQuery.toLowerCase())) : allTaxes.slice(0, 10);

  const handleShowOrders = async () => {
    if (!partyData.partyAccount) return toast.error("Please select a party first");
    try {
      const [lensRes, rxRes, clRes, challanRes] = await Promise.all([
        getAllLensSaleOrder(), 
        getAllRxSaleOrder(), 
        getAllContactLensSaleOrder(),
        getAllLensSaleChallan()
      ]);
      let allOrders = [];
      if (lensRes.success) allOrders = [...allOrders, ...lensRes.data.map(o => ({ ...o, sourceTitle: "LENS SALE ORDER" }))];
      if (rxRes.success) allOrders = [...allOrders, ...rxRes.data.map(o => ({ ...o, sourceTitle: "RX SALE ORDER" }))];
      if (clRes.success) allOrders = [...allOrders, ...clRes.data.map(o => ({ ...o, sourceTitle: "CONTACT LENS & SOLUTION" }))];
      if (challanRes?.success) allOrders = [...allOrders, ...challanRes.data.map(o => ({ ...o, sourceTitle: "LENS SALE CHALLAN" }))];
      else if (challanRes?.data) allOrders = [...allOrders, ...(Array.isArray(challanRes.data) ? challanRes.data : []).map(o => ({ ...o, sourceTitle: "LENS SALE CHALLAN" }))];

      const pendingOrders = allOrders.filter(o => o.partyData?.partyAccount === partyData.partyAccount && (o.balQty > 0 || !o.isInvoiced) && o.status !== "Received");
      setSaleOrders(pendingOrders); setShowOrdersModal(true);
      if (!pendingOrders.length) toast.success("No pending orders found");
    } catch (err) { console.error(err); }
  };

  const handleSelectOrderItem = (orderId, itemIndex) => setSelectedOrdersItems(prev => ({ ...prev, [`${orderId}-${itemIndex}`]: !prev[`${orderId}-${itemIndex}`] }));

  const handleAddOrderItems = () => {
    let baseItems = items.filter(it => it.itemName || it.barcode);
    const newItems = [...baseItems]; let addedCount = 0; let first = false;
    saleOrders.forEach(order => {
      if (order.items?.some((_, idx) => selectedOrdersItems[`${order._id}-${idx}`])) {
        if (!first && order.billData) {
          setBillData({ ...order.billData, date: safeDate(order.billData?.date) });
          if (order.taxes?.length) setTaxes(order.taxes.map(t => ({ ...t, id: t._id || genTaxId("_o") })));
          first = true;
        }
        order.items.forEach((it, idx) => {
          if (selectedOrdersItems[`${order._id}-${idx}`] && !newItems.some(ex => ex._id === it._id)) {
            newItems.push({ ...it, id: newItems.length + 1, _id: it._id }); addedCount++;
          }
        });
      }
    });
    if (addedCount) { setItems(newItems); setShowOrdersModal(false); setSelectedOrdersItems({}); toast.success(`Added ${addedCount} items`); }
    else toast.error("Select items");
  };

  const selectTax = (taxObj) => {
    setBillData(b => ({ ...b, billType: taxObj.Name || "" })); setTaxQuery(taxObj.Name || ""); setShowTaxSuggestions(false);
    const newTaxes = []; const lt1 = Number(taxObj.localTax1 || 0), lt2 = Number(taxObj.localTax2 || 0), ct = Number(taxObj.centralTax || 0), cess = Number(taxObj.cessTax || 0);
    if (lt1 > 0) newTaxes.push({ id: genTaxId("_cgst"), taxName: "CGST", type: "Additive", percentage: String(lt1), amount: "0.00" });
    if (lt2 > 0) newTaxes.push({ id: genTaxId("_sgst"), taxName: "SGST", type: "Additive", percentage: String(lt2), amount: "0.00" });
    if (ct > 0) newTaxes.push({ id: genTaxId("_igst"), taxName: "IGST", type: "Additive", percentage: String(ct), amount: "0.00" });
    if (cess > 0) newTaxes.push({ id: genTaxId("_cess"), taxName: "CESS", type: "Additive", percentage: String(cess), amount: "0.00" });
    if (newTaxes.length) setTaxes(newTaxes);
  };

  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const getFilteredLens = (index) => {
    const q = (itemQueries[index] || "").trim();
    return q ? allLens.filter(l => String(l.productName || "").toLowerCase().includes(q.toLowerCase())) : allLens.slice(0, 10);
  };

  const getSalePriceForCategory = (lens, categoryName) => {
    if (!lens) return 0; const sp = lens.salePrice ?? lens.salePrices ?? 0;
    if (sp && typeof sp === "object" && !Array.isArray(sp)) {
      for (const k in sp) if (k.toLowerCase() === categoryName.toLowerCase()) return Number(sp[k]);
      return Number(sp.default ?? sp.Default ?? sp.retail ?? Object.values(sp)[0] ?? 0);
    }
    return Number(sp || 0);
  };

  const selectLens = (lens, index) => {
    setItems(prev => {
      const copy = [...prev]; copy[index] = { ...copy[index], itemName: lens.productName, salePrice: getSalePriceForCategory(lens, category), eye: lens.eye || copy[index].eye || "" };
      const qty = parseFloat(copy[index].qty) || 0, price = parseFloat(copy[index].salePrice) || 0, disc = parseFloat(copy[index].discount) || 0;
      copy[index].totalAmount = roundAmount(qty * price - qty * price * (disc / 100)).toString(); return copy;
    });
    setItemQueries(p => ({ ...p, [index]: lens.productName })); setShowItemSuggestions(p => ({ ...p, [index]: false }));
  };

  const addItemRow = () => setItems(p => [...p, { id: p.length + 1, barcode: "", itemName: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", salePrice: 0, discount: "", totalAmount: "", sellPrice: "", combinationId: "" }]);
  const deleteItem = (id) => setItems(p => p.filter(it => it.id !== id));
  const [rowErrors, setRowErrors] = useState({});

  const combinationExistsForRow = (row) => {
    const normalize = (str) => String(str || "").trim().replace(/\s+/g, " ").toLowerCase();
    const lens = allLens.find(l => normalize(l.productName) === normalize(row.itemName));
    if (!lens) return { exists: false, reason: "Product N/F" };
    if (row.sph === "" || row.cyl === "" || row.add === "" || !row.eye) return { exists: false, reason: "Powers missing" };
    const targetAdd = Number(row.add), targetSph = Number(row.sph), targetCyl = Number(row.cyl), targetEye = String(row.eye).toUpperCase();
    const ag = lens.addGroups?.find(g => Number(g.addValue) === targetAdd);
    const comb = ag?.combinations?.find(c => Number(c.sph) === targetSph && Number(c.cyl) === targetCyl && (targetEye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === targetEye));
    return comb ? { exists: true, combinationId: comb._id, initStock: comb.stock || 0 } : { exists: false, reason: "Comb N/F" };
  };

  const validateAllRows = () => {
    const errs = {}; let changed = false;
    const ni = items.map((r, idx) => {
      const res = combinationExistsForRow(r); if (!res.exists) errs[idx] = res.reason;
      if (r.combinationId !== (res.combinationId || "")) { changed = true; return { ...r, combinationId: res.combinationId || "" }; }
      return r;
    });
    setRowErrors(errs); if (changed) setItems(ni);
    return { ok: !Object.keys(errs).length, newItems: ni };
  };

  const updateItem = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev]; copy[index][field] = value;
      if (field === "itemName") {
        const lens = allLens.find(l => l.productName === value);
        if (lens) { copy[index].salePrice = getSalePriceForCategory(lens, category); copy[index].eye = lens.eye || copy[index].eye || ""; }
      }
      const qty = parseFloat(copy[index].qty) || 0, price = parseFloat(copy[index].salePrice) || 0, disc = Number(copy[index].discount) || 0;
      copy[index].totalAmount = roundAmount(qty * price - qty * price * (disc / 100)).toString(); return copy;
    });
  };

  const updateTax = (idx, field, value) => {
    setTaxes(prev => {
      const c = [...prev]; c[idx][field] = value;
      const pct = parseFloat(field === "percentage" ? value : c[idx].percentage) || 0;
      c[idx].amount = roundAmount((computeSubtotal() * pct) / 100).toString(); return c;
    });
  };

  const addTaxRow = () => setTaxes(p => [...p, { id: genTaxId("_manual"), taxName: "", type: "Additive", percentage: "", amount: "0.00" }]);
  const deleteTax = (id) => setTaxes(p => p.filter(it => it.id !== id));

  const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
  const computeTotalTaxes = () => taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();
  const computeGross = () => items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.salePrice) || 0), 0);

  const handleSave = async () => {
    const { ok, newItems } = validateAllRows(); if (!ok) return toast.error("Fix errors");
    const payload = {
      billData, partyData, items: newItems, taxes: taxes.map(t => ({ ...t, percentage: Number(t.percentage), amount: Number(t.amount) })),
      grossAmount: computeGross(), subtotal: computeSubtotal(), taxesAmount: computeTotalTaxes(), netAmount: computeNetAmount(),
      paidAmount: Number(paidAmount) || 0, dueAmount: computeNetAmount() - (Number(paidAmount) || 0), remark, status
    };
    const res = id ? await editLensSaleReturn(id, payload) : await addLensSaleReturn(payload);
    if (res.success) { toast.success("Saved!"); navigate("/lenstransaction/salereturn"); } else toast.error(res.message || "Failed");
  };

  const getInitStockForRow = (index) => {
    const res = combinationExistsForRow(items[index]);
    return res.exists ? res.initStock : "-";
  };

  const tableRef = useRef(null);

  useEffect(() => {
    if (!category || !allLens.length) return;
    setItems(prev => {
      let changed = false;
      const updated = prev.map(it => {
        if (!it.itemName) return it;
        const lens = allLens.find(l => String(l.productName).toLowerCase() === String(it.itemName).toLowerCase());
        if (!lens) return it;
        const newPrice = getSalePriceForCategory(lens, category);
        if (Number(newPrice) !== Number(it.salePrice)) {
          changed = true; const qty = parseFloat(it.qty) || 0, disc = Number(it.discount) || 0;
          return { ...it, salePrice: newPrice, totalAmount: roundAmount(qty * newPrice - qty * newPrice * (disc / 100)).toString() };
        }
        return it;
      });
      return changed ? updated : prev;
    });
  }, [category]);

  return (
    <div className="h-screen bg-slate-50 relative selection:bg-blue-100 flex flex-col overflow-hidden text-[11px]">
      <Header isReadOnly={isReadOnly} id={id} partyData={partyData} />
      
      <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-3 pt-2 pb-2 gap-2 overflow-hidden">
        
        {/* Top Information Grid */}
        <div className="grid grid-cols-12 gap-2 flex-shrink-0 font-black">
          
          {/* Return Details */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="font-black text-slate-700 uppercase tracking-wide text-[10px]">Reference & Context</h3>
            </div>
            <div className="p-3 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase">Series & Number</label>
                <div className="flex gap-1.5 h-8">
                   <input type="text" value={billData.billSeries} onChange={e => setBillData(v => ({ ...v, billSeries: e.target.value }))} className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black uppercase outline-none focus:border-blue-500" placeholder="Series" />
                   <input type="text" value={billData.billNo} onChange={e => setBillData(v => ({ ...v, billNo: e.target.value }))} className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black outline-none focus:border-blue-500" placeholder="Auto" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase">Return Date</label>
                <input type="date" value={safeDate(billData.date)} onChange={e => setBillData(v => ({ ...v, date: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1 relative">
                <label className="block text-[9px] text-slate-400 uppercase">Bill Category / Type</label>
                <input type="text" value={billData.billType} onFocus={() => setShowTaxSuggestions(true)} onChange={e => { setTaxQuery(e.target.value); setBillData(v => ({ ...v, billType: e.target.value })) }} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" placeholder="Select..." />
                {showTaxSuggestions && filteredTaxes.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg z-[400] p-1 mt-1">
                    {filteredTaxes.map((t, i) => <div key={i} onMouseDown={() => selectTax(t)} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase font-black border-b border-slate-50 last:border-0">{t.Name}</div>)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase font-black">Godown / Point</label>
                <input type="text" value={billData.godown} onChange={e => setBillData(v => ({ ...v, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" placeholder="HO" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block text-[9px] text-slate-400 uppercase">Booked By / Operator</label>
                <input type="text" value={billData.bookedBy} onChange={e => setBillData(v => ({ ...v, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="col-span-12 lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col uppercase font-black tracking-tighter">
            <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-purple-600" />
                <h3 className="font-black text-slate-700 uppercase tracking-widest text-[10px]">Party / Customer Balance</h3>
              </div>
              <div className="flex gap-2 font-black">
                 <div className="flex flex-col items-end px-2 py-0.5 bg-blue-50 rounded border border-blue-100 min-w-[60px]">
                    <span className="text-[7px] text-blue-400 leading-none uppercase">Limit</span>
                    <span className="text-[10px] font-black text-blue-700 mt-0.5 leading-none">₹{partyData.creditLimit ? parseFloat(partyData.creditLimit).toLocaleString() : "0"}</span>
                 </div>
                 <div className="flex flex-col items-end px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100 min-w-[60px]">
                    <span className="text-[7px] text-emerald-400 leading-none uppercase">Balance</span>
                    <span className="text-[10px] font-black text-emerald-700 mt-0.5 leading-none">{partyData.CurrentBalance ? `${parseFloat(partyData.CurrentBalance.amount).toLocaleString()} ${partyData.CurrentBalance.type}` : "0 Dr"}</span>
                 </div>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div ref={containerRef} className="relative z-100">
                <label className="block text-[9px] text-slate-400 uppercase mb-1 ml-0.5 font-black">Account / Search Name</label>
                <div className="relative group">
                   <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                   <input type="text" value={partyData.partyAccount} onFocus={() => setShowSuggestions(true)} onChange={e => { setPartyData(v => ({ ...v, partyAccount: e.target.value })); setShowSuggestions(true); }} className="w-full pl-9 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 shadow-inner focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-500 transition-all uppercase" placeholder="Search Customer..." />
                </div>
                {showSuggestions && filteredAccounts.length > 0 && (
                  <div className="absolute left-0 right-0 z-[500] mt-1 max-h-40 overflow-auto bg-white border border-slate-200 shadow-2xl rounded-lg p-1 uppercase">
                    {filteredAccounts.map((a, i) => (
                      <div key={i} onMouseDown={() => selectAccount(a)} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0">
                         <div className="text-[10px] font-black text-slate-800 leading-none">{a.Name}</div>
                         <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400">
                            <span>{a.MobileNumber || "N/A"}</span>
                            <span>{a.State || "N/A"}</span>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 font-black">
                 <div className="space-y-0.5">
                   <label className="block text-[9px] text-slate-400 uppercase"><Phone className="w-2.5 h-2.5 inline mr-1" /> Mobile / Contact</label>
                   <input type="text" value={partyData.contactNumber} onChange={e => setPartyData(v => ({ ...v, contactNumber: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 outline-none focus:border-blue-500" />
                 </div>
                 <div className="space-y-0.5">
                   <label className="block text-[9px] text-slate-400 uppercase"><MapPin className="w-2.5 h-2.5 inline mr-1" /> State / Region</label>
                   <div className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black flex items-center h-8 text-slate-500">{partyData.stateCode || "—"}</div>
                 </div>
              </div>
              <div className="space-y-0.5 font-black">
                <label className="block text-[9px] text-slate-400 uppercase ml-0.5">Full Registered Address</label>
                <input type="text" value={partyData.address} onChange={e => setPartyData(v => ({ ...v, address: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex gap-2 flex-shrink-0 font-black">
          <button onClick={handleShowOrders} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"><Plus className="w-3.5 h-3.5" /> Pull Sale History</button>
        </div>

        {/* Primary Product Return Grid */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 font-black">
          <div className="px-3 py-1.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0 text-black">
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-500" /> Return Line Items <span className="text-slate-400 font-bold ml-1">[{items.length}]</span>
             </h3>
             <button onClick={addItemRow} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] transition-all active:scale-95 flex items-center gap-1.5 shadow-blue-100 shadow-sm"><Plus className="w-3 h-3" /> New Return Row</button>
          </div>

          <div ref={tableRef} className="flex-1 overflow-auto bg-white font-black uppercase tracking-tight">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-slate-50 sticky top-0 z-20">
                <tr className="border-b border-slate-200 text-[8px] text-slate-400 h-8 tracking-widest font-black uppercase">
                  <th className="w-8 py-1 text-center border-r border-slate-100 font-black uppercase">#</th>
                  <th className="w-32 py-1 px-3 border-r border-slate-100 font-black uppercase">Barcode</th>
                  <th className="min-w-[200px] py-1 px-3 font-black uppercase">Product Context</th>
                  <th className="w-20 py-1 text-center font-black uppercase">ORDER NO</th>
                  <th className="w-14 py-1 text-center bg-blue-50/50 text-blue-600 font-black uppercase">Eye</th>
                  <th className="w-16 py-1 text-center bg-blue-50/50 text-blue-600 font-black uppercase">Sph</th>
                  <th className="w-16 py-1 text-center bg-blue-50/50 text-blue-600 font-black uppercase">Cyl</th>
                  <th className="w-14 py-1 text-center bg-blue-50/50 text-blue-600 font-black uppercase">Axis</th>
                  <th className="w-14 py-1 text-center bg-blue-50/50 text-blue-600 font-black uppercase">Add</th>
                  <th className="w-24 py-1 px-3 font-black uppercase">REMARKS</th>
                  <th className="w-14 py-1 text-right font-black uppercase">Qty</th>
                  <th className="w-20 py-1 text-right font-black uppercase">Price</th>
                  <th className="w-14 py-1 text-right text-red-500 font-bold font-black uppercase">Disc%</th>
                  <th className="w-20 py-1 text-right border-l border-slate-50 font-black uppercase">Total</th>
                  <th className="w-8 text-center font-black uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-black">
                {items.map((it, idx) => (
                  <React.Fragment key={it.id || idx}>
                    <tr className="hover:bg-blue-50/20 group h-8 transition-colors">
                      <td className="py-0 text-center text-slate-300 text-[10px] border-r border-slate-100 font-black uppercase">{idx + 1}</td>
                      <td className="p-0 border-r border-slate-100 uppercase">
                        <input type="text" value={it.barcode} onChange={e => updateItem(idx, "barcode", e.target.value)} className="w-full px-2 py-0 text-[10px] font-black text-blue-600 h-8 bg-transparent outline-none focus:bg-white uppercase h-8" placeholder="SCAN..." />
                      </td>
                      <td className="p-0 relative px-2 uppercase">
                        <input type="text" value={itemQueries[idx] ?? it.itemName} onFocus={() => setShowItemSuggestions(p => ({ ...p, [idx]: true }))} onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)} onChange={e => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }} className="w-full py-0 text-[10px] outline-none h-8 font-black uppercase bg-transparent h-8" placeholder="Line item name" />
                        {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                          <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 shadow-2xl z-50 rounded-lg p-1 uppercase">
                            {getFilteredLens(idx).map((l, i) => <div key={i} onMouseDown={() => selectLens(l, idx)} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[9px] font-black border-b border-slate-50 last:border-0">{l.productName}</div>)}
                          </div>
                        )}
                      </td>
                      <td className="p-0"><input type="text" value={it.orderNo} onChange={e => updateItem(idx, "orderNo", e.target.value)} className="w-full text-center text-[9px] text-slate-400 h-8 bg-transparent outline-none uppercase font-black" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.eye} onChange={e => updateItem(idx, "eye", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent text-blue-600 outline-none uppercase h-8" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.sph} onChange={e => updateItem(idx, "sph", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none uppercase h-8" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.cyl} onChange={e => updateItem(idx, "cyl", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none uppercase h-8" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.axis} onChange={e => updateItem(idx, "axis", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none uppercase h-8" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.add} onChange={e => updateItem(idx, "add", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none uppercase h-8" /></td>
                      <td className="p-0 px-2"><input type="text" value={it.remark} onChange={e => updateItem(idx, "remark", e.target.value)} className="w-full text-[8px] text-center outline-none bg-transparent h-8 font-bold uppercase h-8" placeholder="NOTES" /></td>
                      <td className="p-0"><input type="number" value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} className="w-full text-right px-2 py-0 text-[10px] font-black h-8 bg-emerald-50/30 text-emerald-700 outline-none h-8" /></td>
                      <td className="p-0"><input type="number" value={it.salePrice} onChange={e => updateItem(idx, "salePrice", Number(e.target.value))} className="w-full text-right px-2 py-0 text-[10px] font-black h-8 bg-blue-50/20 text-blue-800 outline-none h-8" /></td>
                      <td className="p-0 px-1 relative"><input type="number" value={it.discount} onChange={e => updateItem(idx, "discount", e.target.value)} className="w-full text-right pr-2 py-0 text-[10px] font-black h-8 bg-red-50/20 text-red-600 outline-none h-8" placeholder="0" /><span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-red-300 font-bold">%</span></td>
                      <td className="p-0 text-right pr-2 text-[10px] font-black text-slate-800 tabular-nums border-l border-slate-50 font-mono h-8">₹{parseFloat(it.totalAmount || 0).toLocaleString()}</td>
                      <td className="p-0 text-center"><button onClick={() => deleteItem(it.id)} className="p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90"><Trash2 className="w-3 h-3" /></button></td>
                    </tr>
                    {rowErrors[idx] && <tr><td colSpan={15} className="px-6 py-0.5 bg-red-50 text-[8px] text-red-500 uppercase tracking-tighter italic font-black uppercase">Structure Issue: {rowErrors[idx]}</td></tr>}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Block Container */}
        <div className="grid grid-cols-12 gap-2 flex-shrink-0 font-black uppercase">
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-col min-h-0 uppercase">
             <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-100 text-[8px] text-slate-400 px-1 tracking-widest font-black uppercase">
                <span className="flex items-center gap-1.5 font-black uppercase"><Calculator className="w-3.5 h-3.5 text-orange-400 uppercase" /> Additional Taxes & Dynamic Adjustments</span>
                <button onClick={addTaxRow} className="text-blue-600 hover:underline font-bold uppercase">+ NEW TAX ROW</button>
             </div>
             <div className="grid grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto max-h-[80px] p-1 pr-1 font-black uppercase">
               {taxes.map((t, idx) => (
                 <div key={t.id || idx} className="flex gap-1.5 items-center bg-slate-50/50 p-1 rounded-lg border border-slate-100 group uppercase h-8">
                    <select value={t.type} onChange={e => updateTax(idx, "type", e.target.value)} className="w-14 text-[8px] bg-white border border-slate-200 rounded h-7 outline-none font-black uppercase">
                       <option>Additive</option><option>Subtractive</option>
                    </select>
                    <input type="text" value={t.taxName} onChange={e => updateTax(idx, "taxName", e.target.value)} className="flex-1 text-[9px] bg-white border border-slate-200 rounded px-2 h-7 outline-none font-black uppercase leading-none" placeholder="Context" />
                    <div className="relative w-12 uppercase">
                       <input type="number" value={t.percentage} onChange={e => updateTax(idx, "percentage", e.target.value)} className="w-full text-[9px] bg-white border border-slate-200 rounded px-1 h-7 text-right font-black font-mono uppercase" />
                       <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-300 font-bold uppercase">%</span>
                    </div>
                    <div className="w-20 bg-slate-100 rounded px-2 h-7 flex items-center justify-end text-[9px] font-black text-slate-700 font-mono uppercase">₹{parseFloat(t.amount || 0).toLocaleString()}</div>
                    <button onClick={() => deleteTax(t.id)} className="p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase h-8"><Trash2 className="w-3 h-3 uppercase" /></button>
                 </div>
               ))}
               {taxes.length === 0 && <span className="text-[9px] text-slate-300 italic p-1 uppercase tracking-widest font-black uppercase leading-none">NO DYNAMIC ADJUSTMENTS RECORDED</span>}
             </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-slate-950 rounded-xl p-3 shadow-xl border border-slate-800 flex flex-col gap-2 font-black uppercase">
             <div className="grid grid-cols-2 gap-3 flex-shrink-0 uppercase tracking-tighter uppercase font-black">
                <div className="space-y-1.5 border-r border-slate-900 pr-3 uppercase">
                   <div className="flex justify-between items-center text-[8px] text-slate-500 uppercase tracking-widest uppercase font-black leading-none uppercase"><span>GROSS VAL:</span><span className="text-slate-100 font-mono uppercase">₹{computeSubtotal().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                   <div className="flex justify-between items-center text-[8px] text-slate-500 uppercase tracking-widest uppercase font-black leading-none uppercase"><span>TAXES:</span><span className="text-blue-400 font-mono uppercase">₹{computeTotalTaxes().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                   <div className="h-px bg-slate-800 my-1 uppercase"></div>
                   <div className="flex justify-between items-center uppercase"><span className="text-[9px] text-slate-400 uppercase tracking-widest uppercase font-black leading-none uppercase">REFUND TOTAL:</span><span className="text-xl text-white font-mono uppercase font-black shadow-blue-500/10 leading-none">₹{computeNetAmount().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                </div>
                <div className="space-y-2 uppercase uppercase font-black">
                   <div className="flex items-center justify-between gap-1 h-7 flex-shrink-0 uppercase font-black uppercase tracking-tighter leading-none">
                      <span className="text-[7px] text-slate-500 uppercase tracking-tighter uppercase font-black leading-none">PAID VAL:</span>
                      <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-0 h-7 text-right text-xs text-white font-mono outline-none focus:border-blue-700 font-black" placeholder="0.00" />
                   </div>
                   <div className="flex items-center justify-between h-7 border-b border-slate-900 flex-shrink-0 uppercase font-black leading-none">
                      <span className="text-[7px] text-slate-500 uppercase tracking-tighter uppercase font-black leading-none">DUE ACC:</span>
                      <span className="text-sm text-blue-500 font-mono tracking-tighter uppercase font-black">₹{(computeNetAmount() - Number(paidAmount)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                   </div>
                </div>
             </div>
             <div className="flex flex-col gap-2 uppercase uppercase font-black">
                <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={1} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[8px] text-slate-600 outline-none focus:border-blue-950 h-8 uppercase resize-none placeholder:text-slate-800 font-bold overflow-hidden shadow-inner font-black shadow-black uppercase" placeholder="INTERNAL TRANSACTION REMARKS / NOTES..." />
                <div className="grid grid-cols-2 gap-2 uppercase font-black">
                   <button onClick={() => window.location.reload()} className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-950 text-slate-500 border border-slate-800 rounded-lg font-black text-[9px] hover:bg-slate-900 transition-all uppercase tracking-widest active:scale-95"><RotateCcw className="w-3 h-3" /> REFRESH</button>
                   <button onClick={handleSave} className="flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded-lg font-black text-[9px] hover:bg-blue-500 shadow transition-all uppercase tracking-widest active:scale-95"><Save className="w-3 h-3" /> {id ? "UPDATE" : "FINALIZE"}</button>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Backlog Selection Modal */}
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
<div className="bg-slate-50 w-full max-w-[1400px] shadow-2xl flex flex-col border border-slate-200" style={{borderRadius: "16px", overflow: "hidden", maxHeight: "95vh"}}>
  <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white sticky top-0 z-10 w-full flex-shrink-0">
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center justify-center mr-2">
        <input type="checkbox" checked={allChecked} onChange={toggleAllOrders} className="w-6 h-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm" />
        <span className="text-[10px] font-black uppercase text-slate-500 mt-1 tracking-widest">ALL</span>
      </div>
      <Package className="w-10 h-10 text-blue-600" strokeWidth={1.5} />
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-[#1a1f33] tracking-tight leading-none uppercase">ACTIVE SALE BACKLOG</h2>
        <p className="text-[11px] text-slate-400 mt-1.5 font-bold uppercase tracking-widest leading-none">
          PICK ITEMS FROM PENDING ORDERS TO AUTO-POPULATE RETURN DETAILS
        </p>
      </div>
    </div>
    <button onClick={() => setShowOrdersModal(false)} className="rounded p-2 text-slate-400 hover:text-[#1a1f33] transition-colors">
      <X className="w-8 h-8" strokeWidth={1.5} />
    </button>
  </div>
  
  <div className="flex-1 overflow-y-auto">
    <div className="px-6 py-6 border-b border-slate-100">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-4 items-end mb-6">
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[11px] text-slate-400 font-black uppercase tracking-widest">ITEM</label>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input type="text" placeholder="NAME..." value={orderItemFilter} onChange={e => setOrderItemFilter(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm font-black uppercase bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400" />
          </div>
        </div>
        <div className="w-24 space-y-2">
          <label className="text-[11px] text-slate-400 font-black uppercase tracking-widest">SPH</label>
          <input type="text" placeholder="+/-" value={orderSphFilter} onChange={e => setOrderSphFilter(e.target.value)} className="w-full px-4 py-3 text-sm font-black uppercase bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400" />
        </div>
        <div className="w-24 space-y-2">
          <label className="text-[11px] text-slate-400 font-black uppercase tracking-widest">CYL</label>
          <input type="text" placeholder="+/-" value={orderCylFilter} onChange={e => setOrderCylFilter(e.target.value)} className="w-full px-4 py-3 text-sm font-black uppercase bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400" />
        </div>
        <div className="w-24 space-y-2">
          <label className="text-[11px] text-slate-400 font-black uppercase tracking-widest">SC ID</label>
          <input type="text" placeholder="ID" value={orderScIdFilter} onChange={e => setOrderScIdFilter(e.target.value)} className="w-full px-4 py-3 text-sm font-black uppercase bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400" />
        </div>
        <div className="space-y-2 w-40">
          <label className="text-[11px] text-slate-400 font-black uppercase tracking-widest">START DATE</label>
          <input type="date" value={orderStartDate} onChange={e => setOrderStartDate(e.target.value)} className="w-full px-4 py-3 text-sm font-black uppercase bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700" />
        </div>
        <div className="space-y-2 w-40">
          <label className="text-[11px] text-slate-400 font-black uppercase tracking-widest">END DATE</label>
          <input type="date" value={orderEndDate} onChange={e => setOrderEndDate(e.target.value)} className="w-full px-4 py-3 text-sm font-black uppercase bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700" />
        </div>
        <button onClick={() => { setOrderItemFilter(""); setOrderSphFilter(""); setOrderCylFilter(""); setOrderScIdFilter(""); setOrderStartDate(""); setOrderEndDate(""); }} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-[#1a1f33] font-black uppercase tracking-widest text-[11px] rounded-xl transition-colors h-[46px]">
          RESET
        </button>
      </div>

      <div className="space-y-5">
        {filteredOrders.length === 0 ? <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest">NO MATCHING ORDERS FOUND</div> : filteredOrders.map(o => (
          <div key={o._id} className="bg-white rounded-[16px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-5">
                <input type="checkbox" checked={o.items?.every((_, i) => selectedOrdersItems[`${o._id}-${i}`]) || false} onChange={e => { const next = { ...selectedOrdersItems }; o.items?.forEach((_, i) => next[`${o._id}-${i}`] = e.target.checked); setSelectedOrdersItems(next); }} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black text-[#1a1f33] uppercase tracking-tight">ORDER GROUP #{o.billData?.billNo || 'UNTITLED'}</span>
                    <span className="px-2.5 py-1 bg-blue-50 text-[10px] text-blue-600 font-black uppercase tracking-widest rounded-md">{o.sourceTitle || "LENS SALE ORDER"}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">DATED: {safeDate(o.billData?.date)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-blue-600 tabular-nums tracking-tight">₹ {Number(o.netAmount || o.totals?.netAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-widest">NET AMOUNT</div>
              </div>
            </div>
            
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-white">
                  <tr className="text-[10px] font-black text-slate-400 tracking-widest uppercase items-center">
                    <th className="px-6 py-4 w-16 text-center">SELECT</th>
                    <th className="px-4 py-4">ITEM DESCRIPTION</th>
                    <th className="px-4 py-4 text-center">ORDER NO</th>
                    <th className="px-2 py-4 text-center">EYE</th>
                    <th className="px-2 py-4 text-center">SPH</th>
                    <th className="px-2 py-4 text-center">CYL</th>
                    <th className="px-2 py-4 text-center">AXIS</th>
                    <th className="px-2 py-4 text-center">ADD</th>
                    <th className="px-4 py-4 text-center">QTY</th>
                    <th className="px-6 py-4 text-right">PRICE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 bg-white pb-2">
                  {o.items?.map((it, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-center">
                        <input type="checkbox" checked={selectedOrdersItems[`${o._id}-${i}`] || false} onChange={e => setSelectedOrdersItems({ ...selectedOrdersItems, [`${o._id}-${i}`]: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-[12px] font-black text-[#1a1f33] uppercase tracking-tight">{it.itemName}</div>
                        {(it.barcode || it.productCode) && <div className="text-[9px] font-black text-slate-400 mt-0.5 tracking-widest uppercase">REF: {it.barcode || it.productCode}</div>}
                      </td>
                      <td className="px-4 py-4 text-center text-[11px] font-black text-slate-500 uppercase">{it.orderNo || '—'}</td>
                      <td className="px-2 py-4 text-center text-[11px] font-black text-blue-600 uppercase"><span className="bg-blue-50 px-2 py-0.5 rounded">{it.eye || "—"}</span></td>
                      <td className="px-2 py-4 text-center text-[12px] font-black text-slate-600 tabular-nums">{it.sph || "—"}</td>
                      <td className="px-2 py-4 text-center text-[12px] font-black text-slate-600 tabular-nums">{it.cyl || "—"}</td>
                      <td className="px-2 py-4 text-center text-[12px] font-black text-slate-600 tabular-nums">{it.axis || "—"}</td>
                      <td className="px-2 py-4 text-center text-[12px] font-black text-slate-600 tabular-nums">{it.add || "—"}</td>
                      <td className="px-4 py-4 text-center text-[12px] font-black text-[#1a1f33] tabular-nums tracking-widest rounded-lg bg-slate-50/50">{it.qty} PCS</td>
                      <td className="px-6 py-4 text-right text-[12px] font-black text-[#1a1f33] tabular-nums tracking-wider leading-none">₹ {Number(it.salePrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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

  <div className="px-8 py-5 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0 w-full z-10">
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">SELECTION SUMMARY</span>
      <span className="text-xl font-black text-[#1a1f33] uppercase tracking-tight mt-1.5 cursor-default">
        {Object.values(selectedOrdersItems).filter(Boolean).length} ITEMS SELECTED
      </span>
    </div>
    <div className="flex gap-4 items-center">
      <button onClick={() => setShowOrdersModal(false)} className="px-8 py-3 text-[12px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 border border-slate-200 rounded-xl transition-all h-[52px]">
        CANCEL
      </button>
      <button onClick={handleAddOrderItems} disabled={!Object.values(selectedOrdersItems).some(v => v)} className="px-8 py-3 bg-[#1a5eff] hover:bg-blue-700 text-white font-black text-[12px] uppercase tracking-widest rounded-xl shadow-[0_4px_15px_-4px_rgba(26,94,255,0.4)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2 h-[52px]">
        <Plus className="w-4 h-4" /> ADD SELECTED ITEMS
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

export default AddSaleReturn;
