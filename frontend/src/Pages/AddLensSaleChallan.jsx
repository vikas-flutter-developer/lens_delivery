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
  AlertCircle,
  X,
} from "lucide-react";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower, getCombinationStock } from "../controllers/LensGroupCreationController";
import {
  addLensSaleChallan,
  getLensSaleChallan,
  editLensSaleChallan,
  getAllLensSaleOrder,
  getNextBillNumberForSaleChallan,
} from "../controllers/LensSaleChallan.controller";
import { getDeliveryPersons } from "../controllers/UserController";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";

const Header = ({ isReadOnly, id, partyData }) => (
  <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-1.5 bg-blue-600 rounded shadow-sm">
        <Receipt className="w-4 h-4 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{id ? "Edit Lens Sale Challan" : "New Lens Sale Challan"}</h1>
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[8px] font-black uppercase tracking-wider">Completed</span>
            </div>
          )}
        </div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{isReadOnly ? "Transaction Completed" : "Delivery & Performance Tracking"}</p>
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


function AddLensSaleChallan() {
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [deliveryPersonsList, setDeliveryPersonsList] = useState([]);
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const [saleData, setSaleData] = useState(null);
  const [category, setCategory] = useState("");
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [saleOrders, setSaleOrders] = useState([]);
  const [selectedOrdersItems, setSelectedOrdersItems] = useState({});
  const [validBarcodes, setValidBarcodes] = useState({}); // Map: barcode -> item object
  const [sourceSaleId, setSourceSaleId] = useState(null);
  const { user } = useContext(AuthContext);

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

  useEffect(() => {
    if (!id) return;
    const fetchById = async () => {
      const res = await getLensSaleChallan(id);
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
        const defaultTax = taxesList.find(t => t.isDefault);
        if (defaultTax) {
          setBillData(v => ({ ...v, billType: defaultTax.Name || "" }));
          const m = [];
          if (defaultTax.localTax1 > 0) m.push({ id: genTaxId("cgst"), taxName: "CGST", type: "Additive", percentage: defaultTax.localTax1, amount: 0 });
          if (defaultTax.localTax2 > 0) m.push({ id: genTaxId("sgst"), taxName: "SGST", type: "Additive", percentage: defaultTax.localTax2, amount: 0 });
          if (defaultTax.centralTax > 0) m.push({ id: genTaxId("igst"), taxName: "IGST", type: "Additive", percentage: defaultTax.centralTax, amount: 0 });
          setTaxes(m);
        }
      } catch (err) { console.error(err); }
    };
    const fetchLenses = async () => {
      try { const res = await getAllLensPower(); setAllLens(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])); }
      catch (err) { console.error(err); }
    };
    const fetchDeliveryPersons = async () => {
      try {
        const persons = await getDeliveryPersons();
        setDeliveryPersonsList(persons);
      } catch (err) { console.error(err); }
    };
    fetch(); fetchTax(); fetchLenses(); fetchDeliveryPersons();
  }, []);

  const [partyData, setPartyData] = useState({
    partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: "",
    CurrentBalance: { amount: 0, type: "Dr" },
  });

  const [items, setItems] = useState([{
    id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", salePrice: 0, discount: "", totalAmount: "", combinationId: ""
  }]);

  const [taxes, setTaxes] = useState([{ id: 1, taxName: "", type: "Additive", percentage: "2.5", amount: "0.00" }]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");
  const isReadOnly = (status || "").toLowerCase() === "done" || (status || "").toLowerCase() === "received";

  useEffect(() => {
    if (!saleData) return;
    setBillData({ ...saleData.billData, date: safeDate(saleData.billData?.date) });
    setPartyData({ ...saleData.partyData, creditLimit: saleData.partyData?.creditLimit || 0 });
    setItems(saleData.items?.length ? saleData.items.map((it, i) => ({ ...it, id: i + 1, totalAmount: String(it.totalAmount) })) : items);
    setTaxes(saleData.taxes?.length ? saleData.taxes.map(t => ({ ...t, id: t._id || genTaxId("load") })) : taxes);
    setRemark(saleData.remark || ""); setStatus(saleData.status || "Pending"); setPaidAmount(saleData.paidAmount || "");
    setDeliveryPerson(saleData.deliveryPerson || "");
  }, [saleData]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  const filteredAccounts = partyData.partyAccount ? accounts.filter(a => a.Name?.toLowerCase().includes(partyData.partyAccount.toLowerCase())) : accounts.slice(0, 10);

  const selectAccount = async (acc) => {
    setPartyData({
      partyAccount: acc.Name || "", contactNumber: acc.MobileNumber || "", stateCode: acc.State || "", address: acc.Address || "", creditLimit: acc.CreditLimit || "",
      CurrentBalance: { amount: acc.CurrentBalance?.amount ?? 0, type: acc.CurrentBalance?.type || "Dr" }
    });
    setCategory(acc.AccountCategory || "");
    try {
      const b = await getNextBillNumberForSaleChallan(acc.Name || "");
      const currentFY = getFinancialYearSeries();
      setBillData(v => ({
        ...v,
        billNo: String(b),
        billSeries: v.billSeries || currentFY,
        godown: v.godown || "HO",
        bookedBy: v.bookedBy || user?.name || "",
      }));

      // Fetch pending orders for barcode validation
      const res = await getAllLensSaleOrder();
      if (res.success) {
        const pendingOrders = res.data.filter(o => 
          o.partyData?.partyAccount === (acc.Name || "") && 
          o.balQty > 0 && 
          (o.status || "").toLowerCase() !== "done" && 
          (o.status || "").toLowerCase() !== "received"
        );
        
        const barcodeMap = {};
        pendingOrders.forEach(order => {
          order.items.forEach(item => {
            if (item.barcode) {
              // Store item with its parent order ID for backend validation
              barcodeMap[item.barcode] = { ...item, sourceOrderId: order._id };
            }
          });
        });
        setValidBarcodes(barcodeMap);
      }
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

  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [activeTaxIndex, setActiveTaxIndex] = useState(-1);
  const filteredTaxes = taxQuery ? allTaxes.filter(t => t.Name?.toLowerCase().includes(taxQuery.toLowerCase())) : allTaxes.slice(0, 10);

  const genTaxId = (s = "") => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}${s}`;

  const selectTax = (t) => {
    setBillData(v => ({ ...v, billType: t.Name || "" })); setTaxQuery(t.Name || ""); setShowTaxSuggestions(false);
    const m = [];
    if (t.localTax1 > 0) m.push({ id: genTaxId("c"), taxName: "CGST", type: "Additive", percentage: t.localTax1, amount: 0 });
    if (t.localTax2 > 0) m.push({ id: genTaxId("s"), taxName: "SGST", type: "Additive", percentage: t.localTax2, amount: 0 });
    if (t.centralTax > 0) m.push({ id: genTaxId("i"), taxName: "IGST", type: "Additive", percentage: t.centralTax, amount: 0 });
    if (m.length) setTaxes(m);
  };

  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const getFilteredLens = (idx) => {
    const q = itemQueries[idx] || "";
    return q ? allLens.filter(l => l.productName?.toLowerCase().includes(q.toLowerCase())) : allLens.slice(0, 10);
  };

  const selectLens = (l, idx) => {
    setItems(prev => {
      const c = [...prev];
      c[idx] = { ...c[idx], itemName: l.productName, billItemName: l.billItemName || "", vendorItemName: l.vendorItemName || "", salePrice: l.salePrice?.default || l.salePrice || 0, eye: l.eye || c[idx].eye || "" };
      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].salePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = (q * p - q * p * (d / 100)).toFixed(2);
      return c;
    });
    setItemQueries(p => ({ ...p, [idx]: l.productName })); setShowItemSuggestions(p => ({ ...p, [idx]: false }));
  };

  const addItemRow = () => setItems(p => [...p, { id: p.length + 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", salePrice: 0, discount: "", totalAmount: "", combinationId: "" }]);
  const deleteItem = (id) => setItems(p => p.filter(it => it.id !== id));

  const [rowErrors, setRowErrors] = useState({});

  const checkComb = (r) => {
    const l = allLens.find(lx => lx.productName?.toLowerCase() === r.itemName?.toLowerCase());
    if (!l) return { exists: false, reason: "N/A" };
    const ag = l.addGroups?.find(g => Number(g.addValue) === Number(r.add));
    const comb = ag?.combinations?.find(c => Number(c.sph) === Number(r.sph) && Number(c.cyl) === Number(r.cyl) && (r.eye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === r.eye));
    return comb ? { exists: true, id: comb._id, stock: comb.stock || 0 } : { exists: false, reason: "N/C" };
  };

  const validateRow = (idx) => {
    const r = items[idx]; if (!r) return;
    const ck = checkComb(r);
    setRowErrors(p => { const c = { ...p }; if (ck.exists) delete c[idx]; else c[idx] = ck.reason; return c; });
    setItems(prev => { const c = [...prev]; c[idx].combinationId = ck.id || ""; return c; });
  };

  const [highlightedRow, setHighlightedRow] = useState(null);

  const updateItem = (idx, f, v) => {
    setItems(prev => {
      const c = [...prev];
      
      if (f === "barcode" && v.trim() !== "") {
        // 1. Check if the barcode is valid from the selected party's orders
        const match = validBarcodes[v];
        if (!match) {
          toast.error("Invalid barcode: This item does not belong to the selected Sale Order");
          c[idx].barcode = ""; 
          return c;
        }

        // 2. Check for duplicate scan in current table
        const existingRowIdx = c.findIndex((row, rowIdx) => row.barcode === v && rowIdx !== idx);
        if (existingRowIdx !== -1) {
          // Record exists, increment qty instead of adding new row
          const nextQty = (parseFloat(c[existingRowIdx].qty) || 0) + 1;
          
          // Qty check against SO
          if (nextQty > match.qty) {
            toast.error(`Quantity Limit Exceeded: Only ${match.qty} units allowed for this item.`);
            c[idx].barcode = "";
            return c;
          }

          c[existingRowIdx].qty = nextQty;
          const p = parseFloat(c[existingRowIdx].salePrice) || 0, d = parseFloat(c[existingRowIdx].discount) || 0;
          c[existingRowIdx].totalAmount = (nextQty * p - nextQty * p * (d / 100)).toFixed(2);
          
          toast.success(`Incremented quantity for ${match.itemName}`);
          setHighlightedRow(existingRowIdx);
          setTimeout(() => setHighlightedRow(null), 1000);
          
          // Clear current row since we updated another one
          c[idx].barcode = "";
          return c;
        }

        // 3. First time scanning this barcode in this challan
        toast.success(`Matched: ${match.itemName}`);
        c[idx] = { 
          ...c[idx], 
          barcode: v,
          itemName: match.itemName,
          orderNo: match.orderNo || "",
          eye: match.eye || "",
          sph: match.sph || "",
          cyl: match.cyl || "",
          axis: match.axis || "",
          add: match.add || "",
          qty: 1, // Start with 1 on first scan
          salePrice: match.salePrice || 0,
          discount: match.discount || 0,
          combinationId: match.combinationId || "",
          _id: match._id, 
        };
        if (!sourceSaleId) setSourceSaleId(match.sourceOrderId);
        
        setHighlightedRow(idx);
        setTimeout(() => setHighlightedRow(null), 1000);

        // Auto-add next row if this was the last one
        if (idx === c.length - 1) {
          setTimeout(() => addItemRow(), 100);
        }
      } else {
        c[idx][f] = v;
      }

      if (f === "itemName" || f === "barcode") {
        const itemName = c[idx].itemName;
        const l = allLens.find(lx => lx.productName === itemName);
        if (l) {
          c[idx].salePrice = l.salePrice?.default || l.salePrice || 0;
          c[idx].eye = l.eye || c[idx].eye || "";
          c[idx].billItemName = l.billItemName || "";
          c[idx].vendorItemName = l.vendorItemName || "";
        }
      }
      
      const q = parseFloat(c[idx].qty) || 0, p = parseFloat(c[idx].salePrice) || 0, d = parseFloat(c[idx].discount) || 0;
      c[idx].totalAmount = (q * p - q * p * (d / 100)).toFixed(2);

      // ── Real-time Stock Lookup ──────────────────────────────────────────
      if (["itemName", "sph", "cyl", "add", "eye", "barcode"].includes(f)) {
        const item = c[idx];
        if (item.itemName && (item.sph !== "" || item.cyl !== "" || item.add !== "")) {
          getCombinationStock({
            productName: item.itemName,
            sph: item.sph,
            cyl: item.cyl,
            add: item.add,
            eye: item.eye
          }).then(res => {
            if (res.success) {
              setItems(current => {
                const updated = [...current];
                if (updated[idx]) {
                   updated[idx].avlStk = res.initStock;
                }
                return updated;
              });
            }
          }).catch(err => console.error("Stock fetch error:", err));
        }
      }
      // ───────────────────────────────────────────────────────────────────

      return c;
    });
  };

  const addTaxRow = () => setTaxes(p => [...p, { id: genTaxId("m"), taxName: "", type: "Additive", percentage: "", amount: "0.00" }]);
  const deleteTax = (id) => setTaxes(p => p.filter(t => t.id !== id));
  const updateTax = (idx, f, v) => setTaxes(p => { const c = [...p]; c[idx][f] = v; const sub = computeSubtotal(), pct = parseFloat(f === "percentage" ? v : c[idx].percentage) || 0; c[idx].amount = ((sub * pct) / 100).toFixed(2); return c; });

  const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
  const computeTotalTaxes = () => taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();

  const handleShowOrders = async () => {
    if (!partyData.partyAccount) return toast.error("Select party");
    try {
      const res = await getAllLensSaleOrder();
      if (res.success) setSaleOrders(res.data.filter(o => o.partyData?.partyAccount === partyData.partyAccount && o.balQty > 0 && (o.status || "").toLowerCase() !== "done" && (o.status || "").toLowerCase() !== "received"));
      setShowOrdersModal(true);
    } catch (e) { console.error(e); }
  };

  const handleAddOrderItems = () => {
    // Strip out the default blank placeholder row before adding order items
    const existing = items.filter(it => it.itemName && it.itemName.trim() !== "");
    const ni = [...existing]; let first = false;
    saleOrders.forEach(o => {
      if (o.items?.some((_, i) => selectedOrdersItems[`${o._id}-${i}`])) {
        if (!first) { setSourceSaleId(o._id); setBillData({ ...o.billData, date: safeDate(o.billData?.date) }); first = true; }
        o.items.forEach((it, i) => { if (selectedOrdersItems[`${o._id}-${i}`]) ni.push({ ...it, id: ni.length + 1, _id: it._id }); });
      }
    });
    // If no real items were added and nothing existed, keep one blank row
    setItems(ni.length > 0 ? ni : [{ id: 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", qty: "", salePrice: 0, discount: "", totalAmount: "", combinationId: "" }]);
    setShowOrdersModal(false);
    setSelectedOrdersItems({});
  };

  const handleSelectOrderItem = (orderId, itemIndex) => {
    setSelectedOrdersItems(prev => ({
      ...prev,
      [`${orderId}-${itemIndex}`]: !prev[`${orderId}-${itemIndex}`]
    }));
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
      deliveryPerson,
      sourceSaleId,
      companyId: user?.companyId // Link to tenant
    };
    const res = id ? await editLensSaleChallan(id, p) : await addLensSaleChallan(p);
    if (res.success) { toast.success("Success!"); navigate("/lenstransaction/sale/salechallan"); } else toast.error(res.message || "Failed");
  };

  const handleReset = () => window.location.reload();

  const getInitStockForRow = (idx) => {
    const r = items[idx];
    if (!r || !r.itemName) return "-";
    
    // Prioritize real-time avlStk if fetched
    if (r.avlStk !== undefined) return r.avlStk;

    const ck = checkComb(r);
    return ck.exists ? ck.stock : "-";
  };

  const tableRef = useRef(null);

  return (
    <div className="h-screen bg-slate-50 relative selection:bg-blue-100 flex flex-col overflow-hidden text-[11px]">
      <Header isReadOnly={isReadOnly} id={id} partyData={partyData} />
      
      <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-3 pt-2 pb-2 gap-2 overflow-hidden">
        
        {/* Top Information Grid */}
        <div className="grid grid-cols-12 gap-2 flex-shrink-0 font-black">
          
          {/* Challan Details */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="font-black text-slate-700 uppercase tracking-wide text-[10px]">Reference & Context</h3>
            </div>
            <div className="p-3 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase">Series & Number</label>
                <div className="flex gap-1.5 h-8">
                   <input type="text" value={billData.billSeries} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, billSeries: e.target.value }))} className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black uppercase outline-none focus:border-blue-500" placeholder="Series" />
                   <input type="text" value={billData.billNo} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, billNo: e.target.value }))} className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black outline-none focus:border-blue-500" placeholder="Auto" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase">Billing Date</label>
                <input type="date" value={safeDate(billData.date)} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, date: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1 relative">
                <label className="block text-[9px] text-slate-400 uppercase">Bill Category / Type</label>
                <input type="text" value={billData.billType} disabled={isReadOnly} onFocus={() => !isReadOnly && setShowTaxSuggestions(true)} onChange={e => { setTaxQuery(e.target.value); setBillData(v => ({ ...v, billType: e.target.value })) }} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" placeholder="Select..." />
                {showTaxSuggestions && filteredTaxes.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg z-[400] p-1 mt-1">
                    {filteredTaxes.map((t, i) => <div key={i} onMouseDown={() => selectTax(t)} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase font-black border-b border-slate-50 last:border-0">{t.Name}</div>)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] text-slate-400 uppercase font-black">Godown / Point</label>
                <input type="text" value={billData.godown} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" placeholder="HO" />
              </div>
              <div className="space-y-1 col-span-1">
                <label className="block text-[9px] text-slate-400 uppercase">Booked By</label>
                <input type="text" value={billData.bookedBy} disabled={isReadOnly} onChange={e => setBillData(v => ({ ...v, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1 col-span-1 relative">
                <label className="block text-[9px] text-slate-400 uppercase">Delivery Person</label>
                <input 
                  type="text" 
                  value={deliveryPerson} 
                  disabled={isReadOnly} 
                  onChange={e => setDeliveryPerson(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" 
                  placeholder="Assign Person..." 
                />
                {!isReadOnly && deliveryPerson && deliveryPersonsList.length > 0 && !deliveryPersonsList.some(p => p.name === deliveryPerson) && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg z-[400] p-1 mt-1 max-h-32 overflow-auto">
                    {deliveryPersonsList
                      .filter(p => p.name.toLowerCase().includes(deliveryPerson.toLowerCase()))
                      .map((p, i) => (
                        <div 
                          key={i} 
                          onMouseDown={() => setDeliveryPerson(p.name)} 
                          className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] uppercase font-black border-b border-slate-50 last:border-0"
                        >
                          {p.name}
                        </div>
                      ))}
                  </div>
                )}
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
                   <input type="text" value={partyData.partyAccount} disabled={isReadOnly} onFocus={() => !isReadOnly && setShowSuggestions(true)} onChange={e => { setPartyData(v => ({ ...v, partyAccount: e.target.value })); setShowSuggestions(true); }} className="w-full pl-9 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 shadow-inner focus:bg-white focus:ring-1 focus:ring-blue-100 focus:border-blue-500 transition-all uppercase" placeholder="Search Customer..." />
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
                   <input type="text" value={partyData.contactNumber} disabled={isReadOnly} onChange={e => setPartyData(v => ({ ...v, contactNumber: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 outline-none focus:border-blue-500" />
                 </div>
                 <div className="space-y-0.5">
                   <label className="block text-[9px] text-slate-400 uppercase"><MapPin className="w-2.5 h-2.5 inline mr-1" /> State / Region</label>
                   <div className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black flex items-center h-8 text-slate-500">{partyData.stateCode || "—"}</div>
                 </div>
              </div>
              <div className="space-y-0.5 font-black">
                <label className="block text-[9px] text-slate-400 uppercase ml-0.5">Full Registered Address</label>
                <input type="text" value={partyData.address} disabled={isReadOnly} onChange={e => setPartyData(v => ({ ...v, address: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black h-8 uppercase outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex gap-2 flex-shrink-0 font-black">
          <button onClick={handleShowOrders} disabled={isReadOnly} className={`px-4 py-1.5 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95 ${isReadOnly ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"}`}><Plus className="w-3.5 h-3.5" /> Pull Backlog Orders</button>
        </div>

        {/* Primary Inventory Grid */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 font-black">
          <div className="px-3 py-1.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-500" /> Line Items / Goods Context <span className="text-slate-400 font-bold ml-1">[{items.length}]</span>
             </h3>
             <button onClick={addItemRow} disabled={isReadOnly} className={`px-3 py-1 text-white rounded-lg text-[9px] transition-all active:scale-95 flex items-center gap-1.5 shadow-sm ${isReadOnly ? "hidden" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"}`}><Plus className="w-3 h-3" /> New Asset Row</button>
          </div>

          <div ref={tableRef} className="flex-1 overflow-auto bg-white font-black uppercase tracking-tight">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-slate-50 sticky top-0 z-20">
                <tr className="border-b border-slate-200 text-[8px] text-slate-400 h-8 tracking-widest font-black uppercase">
                  <th className="w-8 py-1 text-center border-r border-slate-100">#</th>
                  <th className="w-32 py-1 px-3 border-r border-slate-100">Barcode</th>
                  <th className="min-w-[200px] py-1 px-3">Entry Descriptor / Product Name</th>
                  <th className="w-20 py-1 text-center">ORDER NO</th>
                  <th className="w-14 py-1 text-center bg-blue-50/50 text-blue-600">Eye</th>
                  <th className="w-16 py-1 text-center bg-blue-50/50 text-blue-600">Sph</th>
                  <th className="w-16 py-1 text-center bg-blue-50/50 text-blue-600">Cyl</th>
                  <th className="w-14 py-1 text-center bg-blue-50/50 text-blue-600">Axis</th>
                  <th className="w-14 py-1 text-center bg-blue-50/50 text-blue-600">Add</th>
                  <th className="w-24 py-1 px-3">REMARKS</th>
                  <th className="w-14 py-1 text-right">Qty</th>
                  <th className="w-20 py-1 text-right">Price</th>
                  <th className="w-14 py-1 text-right text-red-500 font-bold">Disc%</th>
                  <th className="w-20 py-1 text-right border-l border-slate-50">Total</th>
                  <th className="w-14 py-1 text-right bg-blue-50 px-2 text-blue-700">Back</th>
                  <th className="w-14 py-1 text-right bg-slate-50 px-2">Stk</th>
                  <th className="w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-black">
                {items.map((it, idx) => (
                  <React.Fragment key={it.id}>
                    <tr className={`hover:bg-blue-50/20 group h-8 transition-colors ${highlightedRow === idx ? "bg-emerald-50 ring-1 ring-emerald-400 inset" : ""}`}>
                      <td className="py-0 text-center text-slate-300 text-[10px] border-r border-slate-100 font-black">{idx + 1}</td>
                      <td className="p-0 border-r border-slate-100 uppercase">
                        <input type="text" value={it.barcode} disabled={isReadOnly} autoFocus={idx === items.length - 1 && it.barcode === ""} onChange={e => updateItem(idx, "barcode", e.target.value)} className="w-full px-2 py-0 text-[10px] font-black text-blue-600 h-8 bg-transparent outline-none focus:bg-white" placeholder="SCAN..." />
                      </td>
                      <td className="p-0 relative px-2 uppercase">
                        <input type="text" value={itemQueries[idx] ?? it.itemName} disabled={isReadOnly} onFocus={() => !isReadOnly && setShowItemSuggestions(p => ({ ...p, [idx]: true }))} onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)} onChange={e => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }} className="w-full py-0 text-[10px] outline-none h-8 font-black uppercase bg-transparent" placeholder="Line item name" />
                        {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                          <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 shadow-2xl z-50 rounded-lg p-1 uppercase">
                            {getFilteredLens(idx).map((l, i) => <div key={i} onMouseDown={() => selectLens(l, idx)} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-[9px] font-black border-b border-slate-50 last:border-0">{l.productName}</div>)}
                          </div>
                        )}
                      </td>
                      <td className="p-0"><input type="text" value={it.orderNo} disabled={isReadOnly} onChange={e => updateItem(idx, "orderNo", e.target.value)} className="w-full text-center text-[9px] text-slate-400 h-8 bg-transparent outline-none uppercase font-black" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.eye} disabled={isReadOnly} onChange={e => updateItem(idx, "eye", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent text-blue-600 outline-none uppercase" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.sph} disabled={isReadOnly} onBlur={() => validateRow(idx)} onChange={e => updateItem(idx, "sph", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.cyl} disabled={isReadOnly} onBlur={() => validateRow(idx)} onChange={e => updateItem(idx, "cyl", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.axis} disabled={isReadOnly} onChange={e => updateItem(idx, "axis", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none" /></td>
                      <td className="p-0 bg-blue-50/20"><input type="text" value={it.add} disabled={isReadOnly} onBlur={() => validateRow(idx)} onChange={e => updateItem(idx, "add", e.target.value)} className="w-full text-center text-[10px] font-black h-8 bg-transparent outline-none" /></td>
                      <td className="p-0 px-2"><input type="text" value={it.remark} disabled={isReadOnly} onChange={e => updateItem(idx, "remark", e.target.value)} className="w-full text-[8px] text-center outline-none bg-transparent h-8 font-bold uppercase" placeholder="NOTES" /></td>
                      <td className="p-0"><input type="number" value={it.qty} disabled={isReadOnly} onChange={e => updateItem(idx, "qty", e.target.value)} className="w-full text-right px-2 py-0 text-[10px] font-black h-8 bg-emerald-50/30 text-emerald-700 outline-none" /></td>
                      <td className="p-0"><input type="number" value={it.salePrice} disabled={isReadOnly} onChange={e => updateItem(idx, "salePrice", Number(e.target.value))} className="w-full text-right px-2 py-0 text-[10px] font-black h-8 bg-blue-50/20 text-blue-800 outline-none" /></td>
                      <td className="p-0 px-1 relative"><input type="number" value={it.discount} disabled={isReadOnly} onChange={e => updateItem(idx, "discount", e.target.value)} className="w-full text-right pr-2 py-0 text-[10px] font-black h-8 bg-red-50/20 text-red-600 outline-none" placeholder="0" /><span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-red-300 font-bold">%</span></td>
                      <td className="p-0 text-right pr-2 text-[10px] font-black text-slate-800 tabular-nums border-l border-slate-50 font-mono">₹{parseFloat(it.totalAmount || 0).toLocaleString()}</td>
                      <td className="py-0 text-right pr-2 text-[9px] font-black bg-blue-50/20 text-blue-700 font-mono">{it.barcode && validBarcodes[it.barcode] ? validBarcodes[it.barcode].qty : "—"}</td>
                      <td className={`py-0 text-right pr-2 text-[9px] font-black bg-slate-50/50 font-mono ${Number(getInitStockForRow(idx)) <= 0 ? "text-red-500 shadow-inner" : "text-slate-600 shadow-inner"}`}>{getInitStockForRow(idx)}</td>
                      <td className="p-0 text-center flex items-center justify-center h-8"><button onClick={() => !isReadOnly && deleteItem(it.id)} disabled={isReadOnly} className={`p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 disabled:hidden transition-all active:scale-90`}><Trash2 className="w-3 h-3" /></button></td>
                    </tr>
                    {rowErrors[idx] && <tr><td colSpan={17} className="px-6 py-0.5 bg-red-50 text-[8px] text-red-500 uppercase tracking-tighter italic font-black">Structure Issue: {rowErrors[idx]}</td></tr>}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Account Panel */}
        <div className="grid grid-cols-12 gap-2 flex-shrink-0 font-black uppercase">
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-col min-h-0">
             <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-100 text-[8px] text-slate-400 px-1 tracking-widest font-black uppercase">
                <span className="flex items-center gap-1.5 font-black uppercase tracking-widest"><Calculator className="w-3.5 h-3.5 text-orange-400" /> Additional Taxes & Dynamic Line Adjustments</span>
                {!isReadOnly && <button onClick={addTaxRow} className="text-blue-600 hover:underline font-bold">+ NEW ADJUSTMENT</button>}
             </div>
             <div className="grid grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto max-h-[80px] p-1 pr-1 font-black">
               {taxes.map((t, idx) => (
                 <div key={t.id} className="flex gap-1.5 items-center bg-slate-50/50 p-1 rounded-lg border border-slate-100 group">
                    <select value={t.type} disabled={isReadOnly} onChange={e => updateTax(idx, "type", e.target.value)} className="w-14 text-[8px] bg-white border border-slate-200 rounded h-7 outline-none font-black uppercase">
                       <option>Additive</option><option>Subtractive</option>
                    </select>
                    <input type="text" value={t.taxName} disabled={isReadOnly} onChange={e => updateTax(idx, "taxName", e.target.value)} className="flex-1 text-[9px] bg-white border border-slate-200 rounded px-2 h-7 outline-none font-black uppercase leading-none" placeholder="Context" />
                    <div className="relative w-12">
                       <input type="number" value={t.percentage} disabled={isReadOnly} onChange={e => updateTax(idx, "percentage", e.target.value)} className="w-full text-[9px] bg-white border border-slate-200 rounded px-1 h-7 text-right font-black font-mono" />
                       <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-300 font-bold">%</span>
                    </div>
                    <div className="w-20 bg-slate-100 rounded px-2 h-7 flex items-center justify-end text-[9px] font-black text-slate-700 font-mono">₹{parseFloat(t.amount || 0).toLocaleString()}</div>
                    <button onClick={() => !isReadOnly && deleteTax(t.id)} className="p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                 </div>
               ))}
               {taxes.length === 0 && <span className="text-[9px] text-slate-300 italic p-1 uppercase tracking-widest font-black leading-none">NO DYNAMIC ADJUSTMENTS RECORDED</span>}
             </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-slate-950 rounded-xl p-3 shadow-xl border border-slate-800 flex flex-col gap-2 font-black">
             <div className="grid grid-cols-2 gap-3 flex-shrink-0 uppercase tracking-tighter">
                <div className="space-y-1.5 border-r border-slate-900 pr-3">
                   <div className="flex justify-between items-center text-[8px] text-slate-500 uppercase tracking-widest leading-none"><span>GROSS:</span><span className="text-slate-100 font-mono">₹{computeSubtotal().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                   <div className="flex justify-between items-center text-[8px] text-slate-500 uppercase tracking-widest leading-none"><span>TAXES:</span><span className="text-emerald-500 font-mono">+₹{computeTotalTaxes().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                   <div className="h-px bg-slate-800 my-1"></div>
                   <div className="flex justify-between items-center"><span className="text-[9px] text-slate-400 uppercase tracking-widest leading-none">NET TOTAL:</span><span className="text-xl text-white font-mono leading-none font-black shadow-blue-500/10">₹{computeNetAmount().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                </div>
                <div className="space-y-2 font-black uppercase">
                   <div className="flex items-center justify-between gap-1 h-7 flex-shrink-0 uppercase">
                      <span className="text-[7px] text-slate-500 uppercase tracking-tighter leading-none">PAID VAL:</span>
                      <input type="number" value={paidAmount} disabled={isReadOnly} onChange={e => setPaidAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-0 h-7 text-right text-xs text-white font-mono outline-none focus:border-blue-700 font-black" placeholder="0.00" />
                   </div>
                   <div className="flex items-center justify-between h-7 border-b border-slate-900 flex-shrink-0">
                      <span className="text-[7px] text-slate-500 uppercase tracking-tighter leading-none">REMAINING:</span>
                      <span className="text-sm text-amber-500 font-mono tracking-tighter font-black">₹{(computeNetAmount() - Number(paidAmount)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                   </div>
                </div>
             </div>
             <div className="flex flex-col gap-2 font-black uppercase">
                <textarea value={remark} disabled={isReadOnly} onChange={e => setRemark(e.target.value)} rows={1} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[8px] text-slate-600 outline-none focus:border-blue-950 h-8 uppercase resize-none placeholder:text-slate-800 font-bold overflow-hidden shadow-inner font-black" placeholder="INTERNAL TRANSACTION REMARKS / NOTES..." />
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={handleReset} disabled={isReadOnly} className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-950 text-slate-500 border border-slate-800 rounded-lg font-black text-[9px] hover:bg-slate-900 transition-all uppercase tracking-widest active:scale-95"><RotateCcw className="w-3 h-3" /> REFRESH</button>
                   <button onClick={handleSave} disabled={isReadOnly} className="flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded-lg font-black text-[9px] hover:bg-blue-500 shadow transition-all uppercase tracking-widest active:scale-95"><Save className="w-3 h-3" /> {isReadOnly ? "LOCKED" : (id ? "UPDATE" : "FINALIZE")}</button>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Backlog Modal Container */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[500] p-4 font-black uppercase tracking-tight">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-t-8 border-emerald-500 uppercase font-black">
            <div className="px-6 flex justify-between items-center py-4 border-b border-slate-100 bg-white shadow-sm flex-shrink-0">
               <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-emerald-600 cursor-pointer" checked={saleOrders.length > 0 && saleOrders.every(o => o.items?.every((_, i) => selectedOrdersItems[`${o._id}-${i}`]))} onChange={(e) => { const next = {}; if (e.target.checked) { saleOrders.forEach(o => { o.items?.forEach((_, i) => { next[`${o._id}-${i}`] = true; }); }); } setSelectedOrdersItems(next); }} />
                    <span className="text-[7px] text-slate-400 uppercase font-black leading-none">ALL</span>
                  </div>
                  <div className="flex flex-col uppercase font-black">
                    <h2 className="text-xl font-black text-slate-800 leading-none tracking-tight">TRANSACTION ASSET BACKLOG HUB</h2>
                    <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest leading-none">Active pending items for reference: <span className="text-emerald-500 font-black underline decoration-dotted underline-offset-2">{partyData.partyAccount}</span></p>
                  </div>
               </div>
               <button onClick={() => setShowOrdersModal(false)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-all active:scale-90"><X className="w-6 h-6 outline-none" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 space-y-4 font-black">
              {saleOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-inner"><Search className="w-12 h-12 text-slate-200 mb-4" /><span className="text-xs text-slate-300 font-black tracking-widest font-sans uppercase">NO PENDING TRANSACTIONS RECOVERED</span></div>
              ) : (
                saleOrders.map(order => (
                  <div key={order._id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
                    <div className="px-5 py-3 bg-slate-50/50 flex justify-between items-center border-b uppercase font-black">
                      <div className="flex items-center gap-4">
                        <input type="checkbox" checked={order.items?.length > 0 && order.items.every((_, i) => selectedOrdersItems[`${order._id}-${i}`])} onChange={(e) => { const next = { ...selectedOrdersItems }; order.items?.forEach((_, i) => next[`${order._id}-${i}`] = e.target.checked); setSelectedOrdersItems(next); }} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm" />
                        <div className="flex flex-col uppercase font-black leading-none"><div className="text-[12px] text-slate-800 leading-none mb-1 font-black tracking-tight">MASTER VOUCHER #{order.billData?.billNo || 'UNTITLED'}</div><div className="text-[8px] text-slate-400 tracking-widest leading-none font-bold uppercase">REGISTERED: {safeDate(order.billData?.date)} | SOURCE: {order.sourceTitle || "MASTER VOUCHER"}</div></div>
                      </div>
                      <div className="text-right flex flex-col font-black uppercase leading-none"><div className="text-[12px] font-black text-blue-600 tabular-nums leading-none font-mono">₹{parseFloat(order.netAmount || 0).toLocaleString()}</div><div className="text-[7px] text-slate-400 uppercase mt-0.5 font-black tracking-widest leading-none uppercase leading-none">TOTAL VAL</div></div>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full text-left font-black tracking-tight uppercase"><thead className="bg-slate-50 text-[8px] text-slate-400 border-b h-8 font-black uppercase tracking-widest"><tr><th className="px-5 py-0 w-16 text-center shadow-inner">SEL</th><th className="px-4 py-0">VOUCHER ASSET DESCRIPTOR / PRODUCT CONTEXT</th><th className="px-2 py-0 text-center">EYE</th><th className="px-2 py-0 text-center h-8 bg-blue-50/10">SPH</th><th className="px-2 py-0 text-center text-emerald-600 font-black h-8 bg-emerald-50/10">QTY</th><th className="px-5 py-0 text-right">UNIT VAL</th></tr></thead><tbody className="divide-y divide-slate-50 text-[10px] font-black">{order.items?.map((it, idx) => (<tr key={idx} className="hover:bg-blue-50/20 transition-all h-9"><td className="px-5 py-0 text-center"><input type="checkbox" checked={selectedOrdersItems[`${order._id}-${idx}`] || false} onChange={() => handleSelectOrderItem(order._id, idx)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-inner" /></td><td className="px-4 py-0 text-slate-700 font-black uppercase leading-tight italic">{it.itemName}</td><td className="px-3 py-0 text-center text-blue-600 font-black">{it.eye || "—"}</td><td className="px-3 py-0 text-center text-slate-400 font-black font-mono">{it.sph || "—"}</td><td className="px-3 py-0 text-center font-black bg-emerald-50/30 text-emerald-700 font-mono">{it.qty} {it.unit || 'PCS'}</td><td className="px-5 py-0 text-right text-blue-700 font-bold tabular-nums font-mono leading-none">₹{parseFloat(it.salePrice || 0).toLocaleString()}</td></tr>))}</tbody></table></div>
                  </div>
                ))
              )}
            </div>
            <div className="px-8 py-4 border-t border-slate-100 bg-white flex justify-between items-center shadow-inner flex-shrink-0 uppercase font-black"><span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">CURRENT SELECTION CONTEXT: <span className="text-blue-600 ml-1 font-black">{Object.values(selectedOrdersItems).filter(v => v).length} ASSETS</span></span><div className="flex gap-4 font-black uppercase"><button onClick={() => setShowOrdersModal(false)} className="px-5 py-2 text-[9px] text-slate-500 hover:text-red-500 transition-all font-black tracking-widest uppercase active:scale-95">ABORT</button><button onClick={handleAddOrderItems} disabled={!Object.values(selectedOrdersItems).some(v => v)} className="px-10 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black tracking-widest uppercase hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 disabled:grayscale disabled:opacity-30 active:scale-95 transition-all">LINK ASSETS</button></div></div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default AddLensSaleChallan;
