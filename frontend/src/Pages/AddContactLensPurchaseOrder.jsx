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
    FileSpreadsheet,
    Grid3X3,
} from "lucide-react";
const Header = ({ isReadOnly, id, title = "Contact Lens Purchase Order" }) => (
    <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded shadow-sm">
                <ShoppingCart className="w-4 h-4 text-white" />
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
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
    addContactLensPurchaseOrder,
    getContactLensPurchaseOrder,
    editContactLensPurchaseOrder,
    getNextBillNumberForContactLensPurchaseOrder,
} from "../controllers/ContactLensPurchaseOrder.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";

function AddContactLensPurchaseOrder() {
    const [accounts, setAccounts] = useState([]);
    const [allTaxes, setAllTaxes] = useState([]);
    const [allLens, setAllLens] = useState([]);
    const [paidAmount, setPaidAmount] = useState("");
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const { user } = useContext(AuthContext);

    const [purchaseData, setPurchaseData] = useState(null);
    const isReadOnly = purchaseData?.status === "Completed" || purchaseData?.status === "Locked";
    const [category, setCategory] = useState("");
    const [rowErrors, setRowErrors] = useState({});

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
        billSeries: "CLPO",
        billNo: "",
        date: new Date().toISOString().split("T")[0],
        billType: "",
        godown: "Main Store",
        bookedBy: user?.Name || user?.name || "",
    });

    const combinationExistsForRow = (row) => {
        const normalize = (str) =>
            String(str || "")
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();

        const targetName = normalize(row.itemName);
        const lens = allLens.find((l) => normalize(l.productName) === targetName);

        if (!lens)
            return { exists: false, reason: `Product "${row.itemName}" not found` };

        if (row.sph === "" || row.sph == null)
            return { exists: false, reason: "SPH missing" };
        if (row.cyl === "" || row.cyl == null)
            return { exists: false, reason: "CYL missing" };
        if (row.add === "" || row.add == null)
            return { exists: false, reason: "Add missing" };
        if (!row.eye) return { exists: false, reason: "Eye (R/L) missing" };

        const addGroups = Array.isArray(lens.addGroups) ? lens.addGroups : [];
        const targetSph = Number(row.sph);
        const targetCyl = Number(row.cyl);
        const targetAdd = Number(row.add);
        const targetEye = String(row.eye || "").trim().toUpperCase();

        for (const ag of addGroups) {
            const agAddValue = Number(ag.addValue);
            if (Number.isNaN(agAddValue)) continue;
            if (agAddValue !== targetAdd) continue;

            const combos = Array.isArray(ag.combinations) ? ag.combinations : [];
            for (const comb of combos) {
                const combSph = Number(comb.sph);
                const combCyl = Number(comb.cyl);
                const combEye = String(comb.eye || "").trim().toUpperCase();

                if (Number.isNaN(combSph) || Number.isNaN(combCyl)) continue;

                const sphMatch = combSph === targetSph;
                const cylMatch = combCyl === targetCyl;
                const eyeMatch = targetEye === "RL"
                    ? (combEye === "R" || combEye === "L" || combEye === "RL")
                    : combEye === targetEye;

                if (sphMatch && cylMatch && eyeMatch) {
                    return {
                        exists: true,
                        combinationId: comb._id,
                        initStock: comb.initStock ?? comb.stock ?? comb.available ?? 0,
                    };
                }
            }
        }

        return { exists: false, reason: "Combination not found" };
    };

    const validateAllRows = () => {
        const newErrors = {};
        const newItems = items.map((r, idx) => {
            const res = combinationExistsForRow(r);
            if (!res.exists) newErrors[idx] = res.reason;
            return { ...r, combinationId: res.exists ? res.combinationId : "" };
        });
        setRowErrors(newErrors);
        setItems(newItems);
        return { ok: Object.keys(newErrors).length === 0, newItems };
    };

    useEffect(() => {
        if (!id) return;
        const fetchById = async () => {
            const res = await getContactLensPurchaseOrder(id);
            if (res.success) setPurchaseData(res.data.data);
        };
        fetchById();
    }, [id]);

    useEffect(() => {
        const fetch = async () => {
            const res = await getAllAccounts();
            setAccounts(Array.isArray(res) ? res : []);
        };
        const fetchTax = async () => {
            const resTaxes = await getAllTaxCategories();
            const dataArr = resTaxes?.data?.data ?? resTaxes;
            const taxesList = Array.isArray(dataArr) ? dataArr : [];
            setAllTaxes(taxesList);
            const defaultTax = taxesList.find((tax) => tax.isDefault === true);
            if (defaultTax) {
                const newTaxes = [];
                if (Number(defaultTax.localTax1 || 0) > 0) newTaxes.push({ id: genTaxId("_cgst"), taxName: "CGST", type: "Additive", percentage: String(defaultTax.localTax1), amount: "0.00" });
                if (Number(defaultTax.localTax2 || 0) > 0) newTaxes.push({ id: genTaxId("_sgst"), taxName: "SGST", type: "Additive", percentage: String(defaultTax.localTax2), amount: "0.00" });
                if (Number(defaultTax.centralTax || 0) > 0) newTaxes.push({ id: genTaxId("_igst"), taxName: "IGST", type: "Additive", percentage: String(defaultTax.centralTax), amount: "0.00" });
                setBillData(prev => ({ ...prev, billType: defaultTax.Name || "" }));
                setTaxes(newTaxes);
            }
        };
        const fetchLenses = async () => {
            try {
                const res = await getAllLensPower();
                setAllLens(Array.isArray(res?.data) ? res.data : []);
            } catch (e) { console.error("Failed to load lenses", e); setAllLens([]); }
        };
        fetch();
        fetchTax();
        fetchLenses();
    }, []);

    const [sourceSaleId, setSourceSaleId] = useState("");

    // Handle incoming state from Sale Order redirection
    useEffect(() => {
        if (!id && location.state && location.state.items) {
            const { items: incomingItems, billData: incomingBillData, remark: incomingRemark, sourceSaleId: incomingSourceSaleId } = location.state;

            if (incomingSourceSaleId) {
                setSourceSaleId(incomingSourceSaleId);
            }

            if (incomingItems && incomingItems.length > 0) {
                setItems(incomingItems.map((it, idx) => ({
                    id: Date.now() + idx + Math.random(),
                    barcode: it.barcode || "",
                    itemName: it.productName || it.itemName || "",
                    orderNo: it.orderNo || "",
                    eye: it.eye || "",
                    sph: it.sph || "",
                    cyl: it.cyl || "",
                    axis: it.axis || "",
                    add: it.add || "",
                    importDate: it.importDate ? safeDate(it.importDate) : "",
                    expiryDate: it.expiryDate ? safeDate(it.expiryDate) : "",
                    qty: it.qty || "",
                    mrp: it.mrp || 0,
                    purchasePrice: it.purchasePrice || 0,
                    salePrice: it.salePrice || 0,
                    discount: it.discount || "",
                    totalAmount: (Number(it.qty || 0) * Number(it.purchasePrice || 0)).toFixed(2),
                    combinationId: it.combinationId || "",
                    vendor: it.vendor || "",
                    bookedBy: it.bookedBy || (incomingBillData && incomingBillData.bookedBy) || user?.Name || user?.name || ""
                })));
            }

            if (incomingBillData) {
                setBillData(prev => ({
                    ...prev,
                    bookedBy: incomingBillData.bookedBy || prev.bookedBy,
                    godown: incomingBillData.godown || prev.godown,
                }));
            }

            if (incomingRemark) {
                setRemark(incomingRemark);
            }
        }
    }, [id, location.state]);

    // Handle vendor/account selection from incoming state
    useEffect(() => {
        if (!id && location.state && location.state.vendor && accounts.length > 0) {
            const vendorName = location.state.vendor;
            const acc = accounts.find(a => String(a.Name).toLowerCase() === String(vendorName).toLowerCase());
            if (acc) {
                selectAccount(acc);
            } else {
                setPartyData(prev => ({ ...prev, partyAccount: vendorName }));
            }
        }
    }, [id, location.state, accounts]);

    const [partyData, setPartyData] = useState({
        partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: "",
        CurrentBalance: { amount: 0, type: "Dr" },
    });

    const [items, setItems] = useState([
        { id: Date.now(), barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", importDate: "", expiryDate: "", qty: "", mrp: 0, purchasePrice: 0, salePrice: 0, discount: "", totalAmount: "0.00", combinationId: "", vendor: "", bookedBy: user?.Name || user?.name || "" }
    ]);

    useEffect(() => {
        if (!purchaseData && user && !location.state) {
            setBillData(prev => ({ ...prev, bookedBy: user?.Name || user?.name || "" }));
            setItems(prev => prev.map(it => ({ ...it, bookedBy: user?.Name || user?.name || "" })));
        }
    }, [user, purchaseData, location.state]);

    useEffect(() => {
        setItems(prev => prev.map(it => ({ ...it, bookedBy: billData.bookedBy })));
    }, [billData.bookedBy]);

    const [taxes, setTaxes] = useState([]);
    const [remark, setRemark] = useState("");
    const [status, setStatus] = useState("Pending");

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [itemQueries, setItemQueries] = useState({});
    const [showItemSuggestions, setShowItemSuggestions] = useState({});
    const [vendorQueries, setVendorQueries] = useState({});
    const [showVendorSuggestions, setShowVendorSuggestions] = useState({});
    const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
    const [taxQuery, setTaxQuery] = useState("");

    const query = (partyData.partyAccount || "").trim();
    const filteredAccounts = query.length > 0
        ? accounts.filter(acc => String(acc.Name || "").toLowerCase().includes(query.toLowerCase()))
        : accounts.slice(0, 10);

    const filteredTaxes = taxQuery ? allTaxes.filter(t => String(t.Name || "").toLowerCase().includes(taxQuery.toLowerCase())) : allTaxes.slice(0, 10);

    useEffect(() => {
        if (!purchaseData) return;
        setBillData({
            billSeries: purchaseData.billData?.billSeries || "CLPO",
            billNo: purchaseData.billData?.billNo || "",
            date: safeDate(purchaseData.billData?.date),
            billType: purchaseData.billData?.billType || "",
            godown: purchaseData.billData?.godown || "Main Store",
            bookedBy: purchaseData.billData?.bookedBy || "",
        });
        setPartyData({
            partyAccount: purchaseData.partyData?.partyAccount || "",
            address: purchaseData.partyData?.address || "",
            contactNumber: purchaseData.partyData?.contactNumber || "",
            stateCode: purchaseData.partyData?.stateCode || "",
            creditLimit: purchaseData.partyData?.creditLimit || 0,
            CurrentBalance: purchaseData.partyData?.CurrentBalance || { amount: 0, type: "Dr" },
        });
        setItems((purchaseData.items || []).map((it, i) => ({
            id: i + 1,
            barcode: it.barcode || "",
            itemName: it.itemName || "",
            orderNo: it.orderNo || "",
            eye: it.eye || "",
            sph: it.sph ?? "",
            cyl: it.cyl ?? "",
            axis: it.axis ?? "",
            add: it.add ?? "",
            qty: it.qty ?? "",
            mrp: it.mrp ?? 0,
            purchasePrice: it.purchasePrice ?? 0,
            salePrice: it.salePrice ?? 0,
            discount: it.discount ?? "",
            totalAmount: String(it.totalAmount || "0.00"),
            combinationId: it.combinationId || "",
            vendor: it.vendor || "",
            remark: it.remark || "",
            importDate: it.importDate ? safeDate(it.importDate) : "",
            expiryDate: it.expiryDate ? safeDate(it.expiryDate) : "",
            bookedBy: it.bookedBy || purchaseData.billData?.bookedBy || "",
        })));
        setTaxes((purchaseData.taxes || []).map(t => ({
            id: t._id || genTaxId(),
            taxName: t.taxName || "",
            type: t.type || "Additive",
            percentage: t.percentage ?? "0",
            amount: t.amount ?? "0.00"
        })));
        setRemark(purchaseData.remark || "");
        setStatus(purchaseData.status || "Pending");
        setPaidAmount(String(purchaseData.paidAmount || ""));
        setSourceSaleId(purchaseData.sourceSaleId || "");
    }, [purchaseData]);

    const selectAccount = async (acc) => {
        setPartyData({
            partyAccount: acc.Name || "",
            contactNumber: acc.MobileNumber || "",
            stateCode: acc.State || "",
            address: acc.Address || "",
            creditLimit: acc.CreditLimit || "",
            CurrentBalance: acc.CurrentBalance || { amount: 0, type: "Dr" },
        });
        const nextBillNo = await getNextBillNumberForContactLensPurchaseOrder(acc.Name || "");
        setBillData(prev => ({ ...prev, billNo: String(nextBillNo) }));
        setShowSuggestions(false);
    };

    const selectTax = (taxObj) => {
        setBillData(b => ({ ...b, billType: taxObj.Name || "" }));
        setTaxQuery(taxObj.Name || "");
        setShowTaxSuggestions(false);
        const newTaxes = [];
        if (taxObj.localTax1 > 0) newTaxes.push({ id: genTaxId("_cgst"), taxName: "CGST", type: "Additive", percentage: String(taxObj.localTax1), amount: "0.00" });
        if (taxObj.localTax2 > 0) newTaxes.push({ id: genTaxId("_sgst"), taxName: "SGST", type: "Additive", percentage: String(taxObj.localTax2), amount: "0.00" });
        if (taxObj.centralTax > 0) newTaxes.push({ id: genTaxId("_igst"), taxName: "IGST", type: "Additive", percentage: String(taxObj.centralTax), amount: "0.00" });
        setTaxes(newTaxes);
    };

    const updateItem = (index, field, value) => {
        setItems(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            const qty = parseFloat(copy[index].qty) || 0;
            const price = parseFloat(copy[index].purchasePrice) || 0;
            const disc = parseFloat(copy[index].discount) || 0;
            copy[index].totalAmount = (qty * price * (1 - disc / 100)).toFixed(2);
            return copy;
        });
    };

    const selectLens = (lens, index) => {
        updateItem(index, "itemName", lens.productName);
        if (lens.eye) updateItem(index, "eye", lens.eye);
        updateItem(index, "purchasePrice", lens.purchasePrice || 0);
        updateItem(index, "salePrice", lens.salePrice?.default || lens.salePrice || 0);
        updateItem(index, "mrp", lens.mrp || 0);
        setItemQueries(prev => ({ ...prev, [index]: lens.productName }));
        setShowItemSuggestions(prev => ({ ...prev, [index]: false }));
    };

    const addItemRow = () => setItems(prev => [...prev, { id: Date.now() + Math.random(), barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", importDate: "", expiryDate: "", qty: "", mrp: 0, purchasePrice: 0, salePrice: 0, discount: "", totalAmount: "0.00", combinationId: "", vendor: "" }]);
    const deleteItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

    const addTaxRow = () => setTaxes(p => [...p, { id: genTaxId("_manual"), taxName: "", type: "Additive", percentage: "0", amount: "0.00" }]);
    const deleteTax = (id) => setTaxes(p => p.filter(t => t.id !== id));
    const updateTax = (idx, f, v) => setTaxes(p => {
        const c = [...p];
        c[idx][f] = v;
        const sub = computeSubtotal();
        const pct = parseFloat(f === "percentage" ? v : c[idx].percentage) || 0;
        c[idx].amount = ((sub * pct) / 100).toFixed(2);
        return c;
    });

    const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
    const computeTotalTaxes = () => taxes.reduce((s, t) => {
        const amt = parseFloat(t.amount) || 0;
        return t.type === "Subtractive" ? s - amt : s + amt;
    }, 0);
    const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();

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

    const handleReset = () => window.location.reload();

    const handleSave = async () => {
        const { newItems } = validateAllRows();

        // Basic validation for essential fields
        const missingFields = newItems.some(it => !it.itemName || !it.qty);
        if (missingFields) {
            toast.error("Please ensure all items have a name and quantity.");
            return;
        }

        const payload = {
            billData, partyData,
            items: newItems.map(it => ({ ...it, qty: Number(it.qty), mrp: Number(it.mrp), purchasePrice: Number(it.purchasePrice), salePrice: Number(it.salePrice), discount: Number(it.discount), totalAmount: Number(it.totalAmount) })),
            taxes, subtotal: computeSubtotal(), netAmount: computeNetAmount(),
            paidAmount: Number(paidAmount) || 0, dueAmount: computeNetAmount() - (Number(paidAmount) || 0),
            remark, status, sourceSaleId
        };

        const res = id ? await editContactLensPurchaseOrder(id, payload) : await addContactLensPurchaseOrder(payload);
        if (res.success) { toast.success("Purchase Order Saved!"); navigate("/lenstransaction/purchase/purchaseorder?type=contact"); }
        else toast.error(res.message || res.error);
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-black">
            <Header isReadOnly={isReadOnly} id={id} />

            <div className="flex-1 overflow-hidden p-3 space-y-3 flex flex-col min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-shrink-0">
                    {/* Invoice Details */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                                    <Receipt className="w-4 h-4" />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Invoice Details</h3>
                            </div>
                            <div className="flex gap-2">
                                <div className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase">{billData.billSeries || "PO"}-{billData.billNo || "000"}</div>
                                <div className="px-2 py-1 bg-blue-50 rounded text-[10px] font-black text-blue-600 uppercase tracking-tighter">{safeDate(billData.date)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Series</label>
                                <input type="text" value={billData.billSeries || ""} onChange={(e) => setBillData(b => ({ ...b, billSeries: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" placeholder="SERIES" />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Bill No</label>
                                <input type="text" value={billData.billNo || ""} className="w-full px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-500 h-9 outline-none cursor-not-allowed" readOnly />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Date</label>
                                <input type="date" value={safeDate(billData.date)} onChange={(e) => setBillData(b => ({ ...b, date: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1 relative">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bill Type</label>
                                <input className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" value={billData.billType || ""} onChange={e => { setTaxQuery(e.target.value); setBillData({ ...billData, billType: e.target.value }) }} onFocus={() => setShowTaxSuggestions(true)} onBlur={() => setTimeout(() => setShowTaxSuggestions(false), 200)} />
                                {showTaxSuggestions && filteredTaxes.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg z-50 max-h-40 overflow-auto mt-1 p-1">
                                        {filteredTaxes.map(t => <div key={t._id} className="p-2 text-[10px] font-black uppercase hover:bg-blue-50 cursor-pointer rounded-md border-b border-slate-50 last:border-0" onMouseDown={() => selectTax(t)}>{t.Name}</div>)}
                                    </div>
                                )}
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Godown</label>
                                <input type="text" value={billData.godown || ""} onChange={(e) => setBillData(b => ({ ...b, godown: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Booked By</label>
                                <input type="text" value={billData.bookedBy || ""} onChange={(e) => setBillData(b => ({ ...b, bookedBy: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" />
                            </div>
                        </div>
                    </div>

                    {/* Party Details */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                                    <User className="w-4 h-4" />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Party / Supplier</h3>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex flex-col items-end px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                                    <span className="text-[8px] font-black text-blue-400 uppercase leading-none">Limit</span>
                                    <span className="text-[11px] font-black text-blue-700 tracking-tight leading-none mt-0.5">₹{partyData.creditLimit || "0"}</span>
                                </div>
                                <div className="flex flex-col items-end px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[8px] font-black text-emerald-400 uppercase leading-none">Balance</span>
                                    <span className="text-[11px] font-black text-emerald-700 tracking-tight leading-none mt-0.5">₹{partyData.CurrentBalance?.amount || "0"} {partyData.CurrentBalance?.type || "Dr"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-6 relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">Account</label>
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input type="text" value={partyData.partyAccount || ""} onChange={(e) => { setPartyData(p => ({ ...p, partyAccount: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full pl-9 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" placeholder="Search Vendor..." />
                                </div>
                                {showSuggestions && filteredAccounts.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-2xl rounded-xl z-50 max-h-48 overflow-auto mt-1 divide-y">
                                        {filteredAccounts.map(acc => (
                                            <div key={acc._id} className="p-2 hover:bg-purple-50 cursor-pointer" onMouseDown={() => selectAccount(acc)}>
                                                <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{acc.Name}</div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase">{acc.Address?.slice(0, 40)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="col-span-6 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Contact No</label>
                                <input type="text" value={partyData.contactNumber || ""} onChange={(e) => setPartyData(p => ({ ...p, contactNumber: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-8 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Address</label>
                                <input type="text" value={partyData.address || ""} onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" placeholder="Address" />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">State</label>
                                <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-500 h-9 flex items-center uppercase">{partyData.stateCode || "—"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
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
                            <button onClick={addItemRow} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all">
                                <Plus className="w-3.5 h-3.5" /> Add Row
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-slate-50/30" style={{maxHeight: 'calc(100vh - 425px)'}}>
                        <table className="min-w-[1800px] text-left border-collapse table-fixed">
                            <thead className="bg-white sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-100">
                                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                    <th className="w-8 py-2 border-r border-slate-50">#</th>
                                    <th className="w-28 py-2 px-2 border-r border-slate-50">Barcode</th>
                                    <th className="w-48 py-2 px-2 border-r border-slate-50 text-left">Product Name</th>
                                    <th className="w-20 py-2 border-r border-slate-50">Order No</th>
                                    <th className="w-10 py-2 border-r border-slate-50">Eye</th>
                                    <th className="w-12 py-2 bg-blue-50/50 text-blue-600 border-r border-slate-100">Sph</th>
                                    <th className="w-12 py-2 bg-blue-50/50 text-blue-600 border-r border-slate-100">Cyl</th>
                                    <th className="w-12 py-2 bg-blue-50/50 text-blue-600 border-r border-slate-100">Axis</th>
                                    <th className="w-12 py-2 bg-blue-50/50 text-blue-600 border-r border-slate-100">Add</th>
                                    <th className="w-32 py-2 px-2 border-r border-slate-50">Remark</th>
                                    <th className="w-14 py-2 text-right px-2 border-r border-slate-50">Qty</th>
                                    <th className="w-16 py-2 text-right px-2 border-r border-slate-50">MRP</th>
                                    <th className="w-16 py-2 text-right px-2 border-r border-slate-50">P.Price</th>
                                    <th className="w-12 py-2 text-right px-2 border-r border-slate-50">Disc%</th>
                                    <th className="w-24 py-2 text-right px-2 border-r border-slate-50 text-blue-600">Total</th>
                                    <th className="w-32 py-2 px-2 border-r border-slate-50">Vendor</th>
                                    <th className="w-24 py-2 px-2 border-r border-slate-50">By</th>
                                    <th className="w-24 py-2 text-center border-r border-slate-50">Imp.Date</th>
                                    <th className="w-24 py-2 text-center border-r border-slate-50">Exp.Date</th>
                                    <th className="w-8 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white uppercase">
                                {items.map((it, idx) => (
                                    <tr key={it.id} className="hover:bg-blue-50/30 transition-colors group h-10">
                                        <td className="py-1 text-center text-slate-300 text-[10px] font-bold border-r border-slate-50">{idx + 1}</td>
                                        <td className="p-0.5 border-r border-slate-50"><input value={it.barcode || ""} onChange={e => updateItem(idx, "barcode", e.target.value)} className="w-full h-8 px-1.5 py-1 bg-transparent text-[10px] font-black text-slate-700 outline-none tabular-nums" placeholder="..." /></td>
                                        <td className="p-0.5 border-r border-slate-50 relative">
                                            <input value={itemQueries[idx] ?? it.itemName ?? ""} onChange={e => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }} onFocus={() => setShowItemSuggestions(p => ({ ...p, [idx]: true }))} onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)} className="w-full h-8 px-1.5 py-1 bg-transparent text-[10px] font-black text-slate-700 outline-none uppercase" placeholder="Search..." />
                                            {showItemSuggestions[idx] && (
                                                <div className="absolute top-full left-0 w-[400px] bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mt-0.5 p-1 max-h-48 overflow-y-auto">
                                                    {allLens.filter(l => l.productName?.toLowerCase().includes((itemQueries[idx] || "").toLowerCase())).slice(0, 10).map(lens => <div key={lens._id} onMouseDown={() => selectLens(lens, idx)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] font-black text-slate-600 border-b border-slate-50 last:border-0 uppercase">{lens.productName}</div>)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-0.5 border-r border-slate-50"><input value={it.orderNo || ""} onChange={e => updateItem(idx, "orderNo", e.target.value)} className="w-full h-8 text-center text-[10px] font-black text-slate-400 outline-none" /></td>
                                        <td className="p-0.5 border-r border-slate-50 text-center font-black text-[10px] text-blue-600">{it.eye || "—"}</td>
                                        {["sph", "cyl", "axis", "add"].map(f => (
                                            <td key={f} className="p-0 border-r border-slate-100 bg-blue-50/10"><input value={it[f] || ""} onChange={e => updateItem(idx, f, e.target.value)} className="w-full h-9 text-center text-[11px] font-black text-slate-800 outline-none tabular-nums" placeholder="0.00" /></td>
                                        ))}
                                        <td className="p-0.5 border-r border-slate-50"><input value={it.remark || ""} onChange={e => updateItem(idx, "remark", e.target.value)} className="w-full h-8 px-2 text-[9px] font-black text-slate-400 italic outline-none uppercase" placeholder="REMARK" /></td>
                                        <td className="p-0.5 border-r border-slate-50 bg-emerald-50/5"><input type="number" value={it.qty || ""} onChange={e => updateItem(idx, "qty", e.target.value)} className="w-full h-8 text-right text-[11px] font-black text-emerald-600 outline-none tabular-nums" /></td>
                                        <td className="p-0.5 border-r border-slate-50"><input type="number" value={it.mrp || 0} onChange={e => updateItem(idx, "mrp", e.target.value)} className="w-full h-8 text-right text-[10px] font-black text-slate-400 outline-none tabular-nums" /></td>
                                        <td className="p-0.5 border-r border-slate-50 bg-blue-50/5"><input type="number" value={it.purchasePrice || 0} onChange={e => updateItem(idx, "purchasePrice", e.target.value)} className="w-full h-8 text-right text-[11px] font-black text-blue-600 outline-none tabular-nums" /></td>
                                        <td className="p-0.5 border-r border-slate-50"><input type="number" value={it.discount || ""} onChange={e => updateItem(idx, "discount", e.target.value)} className="w-full h-8 text-right text-[11px] font-black text-red-400 outline-none tabular-nums" /></td>
                                        <td className="p-0.5 border-r border-slate-50 text-right text-[11px] font-black text-slate-800 pr-2 tabular-nums">₹{it.totalAmount}</td>
                                        <td className="p-0.5 border-r border-slate-50 relative">
                                            <input value={vendorQueries[idx] ?? it.vendor ?? ""} onChange={e => { setVendorQueries(p => ({ ...p, [idx]: e.target.value })); setShowVendorSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "vendor", e.target.value); }} onFocus={() => setShowVendorSuggestions(p => ({ ...p, [idx]: true }))} onBlur={() => setTimeout(() => setShowVendorSuggestions(p => ({ ...p, [idx]: false })), 200)} className="w-full h-8 px-1.5 text-[10px] font-black text-slate-500 outline-none uppercase" />
                                            {showVendorSuggestions[idx] && (
                                                <div className="absolute top-full left-0 w-48 bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mt-0.5 p-1 max-h-40 overflow-y-auto">
                                                    {accounts.filter(a => (a.Name || "").toLowerCase().includes((vendorQueries[idx] ?? "").toLowerCase())).slice(0, 10).map(a => <div key={a._id} onMouseDown={() => { updateItem(idx, "vendor", a.Name); setVendorQueries(p => ({ ...p, [idx]: a.Name })); }} className="px-2 py-1 hover:bg-blue-50 cursor-pointer text-[10px] font-black text-slate-500 border-b border-slate-50 last:border-0 uppercase">{a.Name}</div>)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-0.5 border-r border-slate-50 text-center"><span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded uppercase">{it.bookedBy || "-"}</span></td>
                                        <td className="p-0.5 border-r border-slate-50"><input type="date" value={it.importDate || ""} onChange={e => updateItem(idx, "importDate", e.target.value)} className="w-full h-8 text-[9px] text-center font-black text-slate-400 outline-none" /></td>
                                        <td className="p-0.5 border-r border-slate-50"><input type="date" value={it.expiryDate || ""} onChange={e => updateItem(idx, "expiryDate", e.target.value)} className="w-full h-8 text-[9px] text-center font-black text-slate-400 outline-none" /></td>
                                        <td className="p-0.5 text-center"><button onClick={() => deleteItem(it.id)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="grid grid-cols-12 gap-3 flex-shrink-0 font-black">
                    {/* Tax Section */}
                    <div className="col-span-7 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col gap-2 min-h-[160px]">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
                            <div className="flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-orange-500" />
                                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-tight">Post-Tax Adjustments</h3>
                            </div>
                            <button onClick={addTaxRow} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> New Charge</button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 sticky top-0"><tr className="text-[9px] text-slate-400 uppercase tracking-widest"><th className="py-1 px-2">Description</th><th className="w-20">Type</th><th className="w-12 text-right">%</th><th className="w-24 text-right px-2">Amount</th><th className="w-8"></th></tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {taxes.map((t, i) => (
                                        <tr key={t.id} className="group hover:bg-slate-50/50">
                                            <td className="py-1 px-2"><input value={t.taxName} onChange={e => updateTax(i, "taxName", e.target.value)} className="w-full bg-transparent text-[10px] font-black text-slate-700 outline-none uppercase" placeholder="..." /></td>
                                            <td><select value={t.type} onChange={e => updateTax(i, "type", e.target.value)} className="w-full bg-transparent text-[10px] font-black text-slate-500 outline-none appearance-none uppercase"><option value="Additive">+</option><option value="Subtractive">-</option></select></td>
                                            <td className="text-right"><input type="number" value={t.percentage} onChange={e => updateTax(i, "percentage", e.target.value)} className="w-full bg-transparent text-[10px] font-black text-right outline-none tabular-nums" /></td>
                                            <td className="text-right px-2 text-[10px] font-black text-slate-800 tabular-nums">₹{t.amount}</td>
                                            <td className="text-center"><button onClick={() => deleteTax(t.id)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Section */}
                    <div className="col-span-5 bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-800 flex flex-col gap-3">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest">
                                <span>Gross Subtotal</span>
                                <span className="text-slate-300 tabular-nums font-black">₹{computeSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest">
                                <span>Adjustment Total</span>
                                <span className={`tabular-nums font-black ${computeTotalTaxes() >= 0 ? "text-emerald-400" : "text-red-400"}`}>{computeTotalTaxes() >= 0 ? "+" : "-"} ₹{Math.abs(computeTotalTaxes()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="border-t border-slate-800/50 my-1"></div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Net Due</span>
                                <div className="text-3xl font-black text-white tabular-nums tracking-tighter"><span className="text-lg text-slate-600 mr-1">₹</span>{computeNetAmount().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-auto">
                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/30">
                                <label className="text-[9px] text-slate-500 uppercase block mb-1">Paid (Advance)</label>
                                <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="w-full bg-slate-900/50 p-1.5 rounded text-sm font-black text-emerald-400 outline-none tabular-nums" placeholder="0.00" />
                            </div>
                            <div className="bg-slate-800/40 rounded-lg p-2 border border-slate-700/30">
                                <label className="text-[9px] text-slate-500 uppercase block mb-1">Due Balance</label>
                                <div className="text-sm font-black text-amber-500 tabular-nums text-right pr-1 pt-1.5">₹{(computeNetAmount() - Number(paidAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleReset} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-lg border border-slate-700/50 transition-all active:scale-95"><RotateCcw className="w-3.5 h-3.5 mx-auto" /></button>
                            <button onClick={handleSave} className="flex-[3] py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-lg shadow-xl shadow-blue-900/40 transition-all active:scale-95">Commit Order</button>
                        </div>
                    </div>
                </div>
            </div>
            <Toaster position="top-right" />
        </div>
    );
}

const genTaxId = (suffix = "") => `tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;
export default AddContactLensPurchaseOrder;
