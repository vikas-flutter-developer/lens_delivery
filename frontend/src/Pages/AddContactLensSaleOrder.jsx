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
import BulkLensMatrixV2 from "../Components/BulkLensMatrixV2";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower, getCombinationStock } from "../controllers/LensGroupCreationController";
import {
    addContactLensSaleOrder,
    getContactLensSaleOrder,
    editContactLensSaleOrder,
    getNextBillNumberForContactLensSaleOrder,
} from "../controllers/ContactLensSaleOrder.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { validateAccountLimits, getValidationErrorMessage } from "../utils/accountLimitValidator";
import { getSuggestions, learnSuggestions, deleteSuggestion } from "../controllers/Suggestion.controller";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";

const Header = ({ isReadOnly, id, partyData }) => (
  <div className="flex items-center justify-between px-4 py-1 bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm flex-shrink-0">
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <h1 className="text-xs font-black text-slate-800 uppercase tracking-tighter">
          {id ? "Edit Contact Lens Order" : "New Contact Lens Order"}
        </h1>
        <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] font-black rounded-full uppercase tracking-widest">
          Order Entry Portal
        </span>
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

function AddContactLensSaleOrder() {
    const { user } = useContext(AuthContext);
    const [accounts, setAccounts] = useState([]);
    const [allTaxes, setAllTaxes] = useState([]);
    const [allLens, setAllLens] = useState([]);
    const [paidAmount, setPaidAmount] = useState("");
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const [orderData, setOrderData] = useState(null); // Renamed from orderData for consistency

    const [taxAutoSuggestions, setTaxAutoSuggestions] = useState([]);
    const [customerAutoSuggestions, setCustomerAutoSuggestions] = useState([]);
    const [showTaxDetailsSuggestions, setShowTaxDetailsSuggestions] = useState({});
    const [activeTaxDetailsIndexes, setActiveTaxDetailsIndexes] = useState({});

    const [category, setCategory] = useState("");
    const [rowErrors, setRowErrors] = useState({});

    const isReadOnly = (!!id && (orderData?.status === "Invoiced" || orderData?.status === "Challaned"));

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef(null);
    const tableRef = useRef(null);

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
        billSeries: "CLSO",
        billNo: "",
        date: new Date().toISOString().split("T")[0],
        billType: "",
        godown: "Main Store",
        bookedBy: user?.name || "",
    });

    // --- HELPER: getSalePriceForCategory(lens, category) ---
    const getSalePriceForCategory = (lens, categoryName, fallback = true) => {
        if (!lens) return 0;
        const sp = lens.salePrice ?? lens.salePrices ?? null;

        if (sp && typeof sp === "object" && !Array.isArray(sp)) {
            // exact match case-insensitive
            const keys = Object.keys(sp);
            for (const k of keys) {
                if (String(k).toLowerCase() === String(categoryName).toLowerCase()) {
                    return Number(sp[k]) || 0;
                }
            }
            // fallback keys
            if (sp.default || sp.Default || sp.retail) {
                return Number(sp.default ?? sp.Default ?? sp.retail) || 0;
            }
            if (fallback) {
                const firstVal = keys
                    .map((k) => Number(sp[k]))
                    .find((v) => !Number.isNaN(v) && v !== 0);
                return Number(firstVal || 0);
            }
        }

        // number shapes
        if (typeof sp === "number") return sp;
        if (sp && sp.default && typeof sp.default === "number") return sp.default;
        if (lens.salePrice && typeof lens.salePrice === "number")
            return lens.salePrice;
        if (lens.salePrice?.default) return Number(lens.salePrice.default) || 0;

        return 0;
    };

    const combinationExistsForRow = (row) => {
        const normalize = (str) =>
            String(str || "")
                .trim()
                .replace(/\s+/g, " ") // multiple spaces -> single
                .toLowerCase(); // case-insensitive

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
        const targetEye = String(row.eye || "")
            .trim()
            .toUpperCase();

        for (const ag of addGroups) {
            const agAddValue = Number(ag.addValue);
            if (Number.isNaN(agAddValue)) continue;

            const addCombinationValue = agAddValue;
            if (addCombinationValue !== targetAdd) continue;

            const combos = Array.isArray(ag.combinations) ? ag.combinations : [];

            for (const comb of combos) {
                const combSph = Number(comb.sph);
                const combCyl = Number(comb.cyl);
                const combEye = String(comb.eye || "")
                    .trim()
                    .toUpperCase();

                if (Number.isNaN(combSph) || Number.isNaN(combCyl)) continue;

                const sphMatch = combSph === targetSph;
                const cylMatch = combCyl === targetCyl;
                const eyeMatch =
                    targetEye === "RL"
                        ? combEye === "R" || combEye === "L" || combEye === "RL"
                        : combEye === targetEye;
                if (sphMatch && cylMatch && eyeMatch) {
                    return {
                        exists: true,
                        combinationId: comb._id,
                        initStock:
                            comb.initStock ??
                            comb.stock ??
                            comb.available ??
                            comb.quantity ??
                            0,
                        pPrice: comb.pPrice ?? lens.purchasePrice ?? 0,
                    };
                }
            }
        }

        return {
            exists: false,
            reason: "Combination not found for given SPH/CYL/ADD/Eye",
        };
    };

    const validateRow = (index) => {
        const row = items[index];
        if (!row) {
            setRowErrors((prev) => {
                const copy = { ...prev };
                delete copy[index];
                return copy;
            });
            return;
        }
        const res = combinationExistsForRow(row);
        setRowErrors((prev) => {
            const copy = { ...prev };
            if (!res.exists) copy[index] = res.reason;
            else delete copy[index];
            return copy;
        });
        const newComboId = res.exists ? res.combinationId || "" : "";
        setItems((prev) => {
            const copy = [...prev];
            if (!copy[index]) return prev;
            const current = copy[index].combinationId || "";
            if (current === newComboId) return prev; // no change
            copy[index] = { ...copy[index], combinationId: newComboId };
            return copy;
        });
    };

    const validateAllRows = () => {
        const newErrors = {};
        let itemsChanged = false;
        const newItems = items.map((r, idx) => {
            // Skip validation for empty rows
            if (!r.itemName || r.itemName.trim() === "") {
                return r;
            }
            const res = combinationExistsForRow(r);
            if (!res.exists) newErrors[idx] = res.reason;

            const newComboId = res.exists ? res.combinationId || "" : "";
            const current = r.combinationId || "";
            if (current !== newComboId) {
                itemsChanged = true;
                return { ...r, combinationId: newComboId };
            }
            return r;
        });

        setRowErrors(newErrors);
        if (itemsChanged) setItems(newItems);

        const ok = Object.keys(newErrors).length === 0;
        return { ok, newItems };
    };

    useEffect(() => {
        if (!id) return;
        const fetchById = async () => {
            const res = await getContactLensSaleOrder(id);
            if (res.success) {
                setorderData(res.data.data);
            }
        };
        fetchById();
    }, [id]);

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
    const fetchAutoSuggestions = async () => {
        try {
            const tRes = await getSuggestions('tax');
            if(tRes.success) setTaxAutoSuggestions(tRes.data);
            const cRes = await getSuggestions('customer');
            if(cRes.success) setCustomerAutoSuggestions(cRes.data);
        } catch(e) {}
    };

    const handleDeleteSuggestion = async (val, type) => {
        if(!window.confirm(`Remove "${val}" from suggestions?`)) return;
        const res = await deleteSuggestion(val, type);
        if(res.success) {
            toast.success("Suggestion removed");
            fetchAutoSuggestions();
        } else {
            toast.error("Failed to remove");
        }
    };

    useEffect(() => {
        fetch();
        fetchTax();
        fetchLenses();
        fetchAutoSuggestions();
    }, []);

    // Merge tax suggestions
    const mergedTaxSuggestions = React.useMemo(() => {
        const map = new Map();
        allTaxes.forEach((t) => map.set(String(t.Name || "").toLowerCase(), t.Name));
        taxAutoSuggestions.forEach((t) => {
            const lower = String(t || "").toLowerCase();
            if (!map.has(lower)) map.set(lower, t);
        });
        return Array.from(map.values());
    }, [allTaxes, taxAutoSuggestions]);

    const [partyData, setPartyData] = useState({
        partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: "",
        CurrentBalance: { amount: 0, type: "Dr" },
    });

    const [customPrices, setCustomPrices] = useState({}); // { productOrLensGroupId: price }

    const [items, setItems] = useState(
        Array.from({ length: 5 }, (_, i) => ({
            id: Date.now() + i,
            barcode: "",
            itemName: "",
            orderNo: "",
            eye: "",
            sph: "",
            cyl: "",
            axis: "",
            add: "",
            importDate: "",
            expiryDate: "",
            qty: "",
            mrp: 0,
            salePrice: 0,
            discount: "",
            totalAmount: "0.00",
            combinationId: "",
            remark: "",
            dia: "",
            vendor: "",
            bookedBy: user?.Name || user?.name || ""
        }))
    );

    const [taxes, setTaxes] = useState([]);
    const [remark, setRemark] = useState("");
    const [status, setStatus] = useState("Pending");

    const query = (partyData.partyAccount || "").trim();
    const filteredAccounts = query.length > 0
        ? accounts.filter(acc => String(acc.Name || "").toLowerCase().includes(query.toLowerCase()))
        : accounts.slice(0, 10);

    const [taxQuery, setTaxQuery] = useState("");
    const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
    const [activeTaxIndex, setActiveTaxIndex] = useState(-1);
    const filteredTaxes = taxQuery ? allTaxes.filter(t => String(t.Name || "").toLowerCase().includes(taxQuery.toLowerCase())) : allTaxes.slice(0, 10);

    const [itemQueries, setItemQueries] = useState({});
    const [showItemSuggestions, setShowItemSuggestions] = useState({});
    const [activeItemIndexes, setActiveItemIndexes] = useState({});

    const [vendorQueries, setVendorQueries] = useState({});
    const [showVendorSuggestions, setShowVendorSuggestions] = useState({});

    useEffect(() => {
        if (!orderData && user) {
            setBillData(prev => ({ ...prev, bookedBy: user?.Name || user?.name || "" }));
            setItems(prev => prev.map(it => ({ ...it, bookedBy: user?.Name || user?.name || "" })));
        }
    }, [user, orderData]);

    useEffect(() => {
        setItems(prev => prev.map(it => ({ ...it, bookedBy: billData.bookedBy })));
    }, [billData.bookedBy]);

    useEffect(() => {
        if (!orderData) return;
        setBillData({
            billSeries: orderData.billData?.billSeries || "CLSO",
            billNo: orderData.billData?.billNo || "",
            date: safeDate(orderData.billData?.date),
            billType: orderData.billData?.billType || "",
            godown: orderData.billData?.godown || "Main Store",
            bookedBy: orderData.billData?.bookedBy || "",
        });
        setPartyData({
            partyAccount: orderData.partyData?.partyAccount || "",
            address: orderData.partyData?.address || "",
            contactNumber: orderData.partyData?.contactNumber || "",
            stateCode: orderData.partyData?.stateCode || "",
            creditLimit: orderData.partyData?.creditLimit || 0,
            CurrentBalance: orderData.partyData?.CurrentBalance || { amount: 0, type: "Dr" },
        });
        setCategory(orderData.partyData?.AccountCategory || "");
        const mapped = (orderData.items || []).map((it, i) => ({
            id: i + 1,
            barcode: it.barcode || "",
            itemName: it.itemName || "",
            orderNo: it.orderNo || "",
            eye: it.eye || "",
            sph: it.sph ?? "",
            cyl: it.cyl ?? "",
            axis: it.axis ?? "",
            add: it.add ?? "",
            importDate: it.importDate ? safeDate(it.importDate) : "",
            expiryDate: it.expiryDate ? safeDate(it.expiryDate) : "",
            qty: it.qty ?? "",
            mrp: it.mrp ?? 0,
            salePrice: it.salePrice ?? 0,
            discount: it.discount ?? "",
            totalAmount: String(it.totalAmount || "0.00"),
            combinationId: it.combinationId || "",
            remark: it.remark || "",
            dia: it.dia || "",
            vendor: it.vendor || "",
            bookedBy: it.bookedBy || orderData.billData?.bookedBy || "",
        }));
        setItems(mapped.length ? mapped : [{ id: Date.now(), barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", dia: "", importDate: "", expiryDate: "", qty: "", mrp: 0, salePrice: 0, discount: "", totalAmount: "0.00", combinationId: "", vendor: "", bookedBy: billData.bookedBy }]);
        setTaxes((orderData.taxes || []).map(t => ({ ...t, id: t._id || genTaxId() })));
        setRemark(orderData.remark || "");
        setStatus(orderData.status || "Pending");
        setPaidAmount(String(orderData.paidAmount || ""));

        const iq = {};
        const vq = {};
        mapped.forEach((it, idx) => {
            iq[idx] = it.itemName || "";
            vq[idx] = it.vendor || "";
        });
        setItemQueries(iq);
        setVendorQueries(vq);
    }, [orderData]);

    const selectAccount = async (acc) => {
        const primaryAddr = acc.Address || "";
        const addrs = acc.Addresses || [];
        const allAddresses = Array.from(new Set([primaryAddr, ...addrs].filter(Boolean)));
        setPartyData({
            partyAccount: acc.Name || "",
            contactNumber: acc.MobileNumber || "",
            stateCode: acc.State || "",
            address: "",
            allAddresses: allAddresses,
            creditLimit: acc.CreditLimit || "",
            CurrentBalance: acc.CurrentBalance || { amount: 0, type: "Dr" },
        });
        setCategory(acc.AccountCategory || "");
        const nextBillNo = await getNextBillNumberForContactLensSaleOrder(acc.Name || "");
        setBillData(prev => ({ ...prev, billNo: String(nextBillNo) }));
        setShowSuggestions(false);

        // Fetch custom prices for this account
        try {
            const res = await getAccountWisePrices(acc._id, "Sale");
            if (res.success) {
                const pricesMap = {};
                res.data.forEach((p) => {
                    const key = p.itemId || p.lensGroupId;
                    pricesMap[key] = p; // Store the whole object
                });
                setCustomPrices(pricesMap);
            }
        } catch (err) {
            console.error("Error fetching custom prices:", err);
        }
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

    const getFilteredLens = (index) => {
        const q = (itemQueries[index] || "").trim().toLowerCase();
        return q ? allLens.filter(l => l.productName?.toLowerCase().includes(q)) : allLens.slice(0, 10);
    };

    const getFilteredVendors = (index) => {
        const q = (vendorQueries[index] || "").trim().toLowerCase();
        
        const nameMap = new Map();
        accounts.forEach((a) => nameMap.set(String(a.Name || "").toLowerCase(), a.Name));
        customerAutoSuggestions.forEach((n) => {
            const lower = String(n || "").toLowerCase();
            if (!nameMap.has(lower)) nameMap.set(lower, n);
        });
        const mergedObjList = Array.from(nameMap.values()).map((Name) => ({ Name }));

        return mergedObjList
            .filter((acc) => String(acc.Name || "").toLowerCase().includes(q))
            .slice(0, 10);
    };

    const selectVendor = (acc, index) => {
        updateItem(index, "vendor", acc.Name);
        setVendorQueries((prev) => ({ ...prev, [index]: acc.Name }));
        setShowVendorSuggestions((prev) => ({ ...prev, [index]: false }));
    };

    const showTaxDetailsSuggestionsForIdx = (idx) => setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: true }));
    const hideTaxDetailsSuggestionsForIdx = (idx) => setTimeout(() => setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: false })), 200);

    const updateItem = (index, field, value) => {
        setItems(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };

            if (field === "itemName") {
                const selectedItem = allLens.find((l) => l.productName === value);
                if (selectedItem) {
                    const customPriceObj = customPrices[selectedItem._id];
                    let computedPrice = getSalePriceForCategory(selectedItem, category);
                    if (customPriceObj) {
                        if (customPriceObj.percentage > 0) {
                            copy[index].discount = customPriceObj.percentage;
                        } else if (customPriceObj.customPrice > 0) {
                            computedPrice = customPriceObj.customPrice;
                        }
                    }
                    copy[index].salePrice = computedPrice;
                    copy[index].billItemName = selectedItem.billItemName || "";
                    copy[index].vendorItemName = selectedItem.vendorItemName || "";
                    copy[index].mrp = selectedItem.mrp || 0;
                }
            }

            const qty = parseFloat(copy[index].qty) || 0;
            const price = parseFloat(copy[index].salePrice) || 0;
            const disc = parseFloat(copy[index].discount) || 0;
            const discountAmount = qty * price * (disc / 100);
            copy[index].totalAmount = (qty * price - discountAmount).toFixed(2);

            // --- REAL-TIME STOCK & BARCODE REFRESH ---
            const powerFields = ["itemName", "sph", "cyl", "add", "axis", "eye"];
            if (powerFields.includes(field)) {
                // Validate only if we have itemName and at least one power field
                const { itemName, sph, cyl, add, axis, eye } = copy[index];
                if (itemName && (sph !== "" || cyl !== "" || add !== "")) {
                    const fetchStock = async () => {
                        try {
                            const stockRes = await getCombinationStock({
                                productName: itemName,
                                sph, cyl, add, axis, eye
                            });
                            if (stockRes.success) {
                                setItems(prevItems => {
                                    const itemsCopy = [...prevItems];
                                    if (itemsCopy[index]) {
                                        itemsCopy[index] = { 
                                            ...itemsCopy[index], 
                                            barcode: stockRes.barcode || itemsCopy[index].barcode || "" 
                                        };
                                    }
                                    return itemsCopy;
                                });
                            }
                        } catch (err) {
                            console.error("Stock refresh error:", err);
                        }
                    };
                    fetchStock();
                }
            }

            return copy;
        });
    };

    const selectLens = (lens, index) => {
        const customPriceObj = customPrices[lens._id];
        let computedPrice = getSalePriceForCategory(lens, category);
        let discount = 0;

        if (customPriceObj) {
            if (customPriceObj.percentage > 0) {
                discount = customPriceObj.percentage;
            } else if (customPriceObj.customPrice > 0) {
                computedPrice = customPriceObj.customPrice;
            }
        }

        // Find first combination to auto-populate power values
        let firstComb = null;
        if (lens.addGroups && lens.addGroups.length > 0) {
            const ag = lens.addGroups[0];
            if (ag.combinations && ag.combinations.length > 0) {
                firstComb = ag.combinations[0];
            }
        }

        setItems(prev => {
            const copy = [...prev];
            copy[index] = {
                ...copy[index],
                itemName: lens.productName,
                billItemName: lens.billItemName || "",
                vendorItemName: lens.vendorItemName || "",
                salePrice: computedPrice,
                mrp: lens.mrp || 0,
                eye: firstComb ? firstComb.eye || "" : "",
                sph: firstComb ? firstComb.sph || "" : "",
                cyl: firstComb ? firstComb.cyl || "" : "",
                axis: firstComb ? firstComb.axis || "0" : "0",
                add: (lens.addGroups && lens.addGroups.length > 0) ? lens.addGroups[0].addValue || "" : "",
                qty: 1,
                discount: discount,
                combinationId: firstComb ? firstComb._id : "",
                totalAmount: (1 * computedPrice * (1 - discount / 100)).toFixed(2)
            };

            // --- REAL-TIME STOCK & BARCODE REFRESH ---
            const { itemName, sph, cyl, add, axis, eye } = copy[index];
            if (itemName && (sph !== "" || cyl !== "" || add !== "")) {
                const fetchStock = async () => {
                    try {
                        const stockRes = await getCombinationStock({
                            productName: itemName,
                            sph, cyl, add, axis, eye
                        });
                        if (stockRes.success) {
                            setItems(prevItems => {
                                const itemsCopy = [...prevItems];
                                if (itemsCopy[index]) {
                                    itemsCopy[index] = { 
                                        ...itemsCopy[index], 
                                        barcode: stockRes.barcode || itemsCopy[index].barcode || "" 
                                    };
                                }
                                return itemsCopy;
                            });
                        }
                    } catch (err) {
                        console.error("Stock refresh error:", err);
                    }
                };
                fetchStock();
            }

            return copy;
        });

        setItemQueries(prev => ({ ...prev, [index]: lens.productName }));
        setShowItemSuggestions(prev => ({ ...prev, [index]: false }));
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Enter" && tableRef.current?.contains(document.activeElement)) {
                if (e.shiftKey) return;
                e.preventDefault();
                const inputs = Array.from(
                    tableRef.current.querySelectorAll(
                        'input:not([disabled]):not([readonly]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]):not([readonly])'
                    )
                ).filter(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                });
                const index = inputs.indexOf(document.activeElement);
                if (index > -1) {
                    if (index < inputs.length - 1) {
                        inputs[index + 1].focus();
                        if (inputs[index + 1].select) inputs[index + 1].select();
                    } else {
                        addItemRow();
                        setTimeout(() => {
                            const newInputs = Array.from(
                                tableRef.current.querySelectorAll(
                                    'input:not([disabled]):not([readonly]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]):not([readonly])'
                                )
                            ).filter(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            });
                            newInputs[index + 1]?.focus();
                        }, 50);
                    }
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [items]);

    const addItemRow = () => setItems(prev => [...prev, { id: Date.now() + Math.random(), barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", remark: "", importDate: "", expiryDate: "", qty: "", mrp: 0, salePrice: 0, discount: "", totalAmount: "0.00", combinationId: "", vendor: "", bookedBy: billData.bookedBy }]);
    const deleteItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

    const [bulkOrderModal, setBulkOrderModal] = useState(false);
    const [bulkOrderItem, setBulkOrderItem] = useState(null);

    const openBulkOrderModal = (item, itemIndex) => {
        if (!item.itemName) {
            toast.error("Please select an item first");
            return;
        }

        const lens = allLens.find(l =>
            String(l.productName).toLowerCase() === String(item.itemName).toLowerCase()
        );

        if (!lens) {
            toast.error("Lens data not found");
            return;
        }

        setBulkOrderItem({
            ...item,
            itemIndex // for row identification if needed
        });
        setBulkOrderModal(true);
    };

    const updateTax = (idx, field, value) => {
        setTaxes(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            const pct = parseFloat(copy[idx].percentage) || 0;
            copy[idx].amount = (computeSubtotal() * pct / 100).toFixed(2);
            return copy;
        });
    };

    const addTaxRow = () => setTaxes(prev => [...prev, { id: genTaxId(), taxName: "", type: "Additive", percentage: "0", amount: "0.00" }]);
    const deleteTax = (id) => setTaxes(prev => prev.filter(t => t.id !== id));

    const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
    const computeTotalTaxes = () => taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();

    const handleSave = async () => {
        const { ok, newItems } = validateAllRows();
        if (!ok) {
            toast.error("Please fix errors in the item table before saving.");
            return;
        }

        // Explicitly map and filter items to ensure only filled items are saved
        const itemsForPayload = newItems
            .filter((it) => it.itemName && it.itemName.trim() !== "")
            .map((it) => ({
                barcode: it.barcode || "",
                itemName: it.itemName || "",
                billItemName: it.billItemName || "",
                vendorItemName: it.vendorItemName || "",
                orderNo: it.orderNo || "",
                eye: it.eye || "",
                sph: it.sph || "",
                cyl: it.cyl || "",
                axis: it.axis || "",
                add: it.add || "",
                importDate: it.importDate || "",
                expiryDate: it.expiryDate || "",
                qty: Number(it.qty) || 0,
                mrp: Number(it.mrp) || 0,
                salePrice: Number(it.salePrice) || 0,
                discount: Number(it.discount) || 0,
                totalAmount: Number(it.totalAmount) || 0,
                combinationId: it.combinationId || "",
                remark: it.remark || "",
                vendor: it.vendor || "",
                bookedBy: it.bookedBy || billData.bookedBy || "",
                _id: it._id || it.id, // Ensure we send the database ID if it exists
            }));

        if (itemsForPayload.length === 0) {
            toast.error("Please add at least one item before saving");
            return;
        }

        const net = computeNetAmount();
        
        // Validate account credit limit and day limit before saving (for new orders only)
        if (!id && partyData?.partyAccount) {
            const validation = await validateAccountLimits(partyData.partyAccount, net, "contact");
            
            if (!validation.success) {
                const errorMessage = getValidationErrorMessage(validation.messages);
                toast.error(errorMessage);
                console.warn("Account validation failed:", validation);
                return;
            }
        }
        
        const paid = Number(paidAmount) || 0;
        const payload = {
            billData,
            partyData,
            items: itemsForPayload,
            taxes,
            subtotal: computeSubtotal(),
            netAmount: net,
            paidAmount: paid,
            dueAmount: net - paid,
            remark,
            status,
            companyId: user?.companyId // Link to tenant
        };

        console.log("Payload items:", itemsForPayload); // Debug log

        const res = id ? await editContactLensSaleOrder(id, payload) : await addContactLensSaleOrder(payload);
        if (res.success) { 
            toast.success(id ? "Order updated!" : "Order saved!"); 
            try {
               const stdTaxes = new Set(['CGST', 'SGST', 'IGST', 'CESS']);
               const learnedTaxes = taxes
                    .map(t => t.taxName?.trim())
                    .filter(n => n && isNaN(n) && !stdTaxes.has(n.toUpperCase()));
               
               const learnedCustomers = itemsForPayload
                    .map(it => it.vendor?.trim())
                    .filter(n => n && isNaN(n));
                    
               if(learnedTaxes.length > 0 || learnedCustomers.length > 0) {
                   await learnSuggestions({ taxes: learnedTaxes, customers: learnedCustomers }).catch(console.error);
               }
            } catch (e) {}
            navigate("/lenstransaction/sale/saleorder"); 
        } else {
            toast.error(res.message);
        }
    };

    const getInitStockForRow = (idx) => {
        const it = items[idx];
        if (!it) return "-";
        const res = combinationExistsForRow(it);
        if (res.exists) return res.initStock ?? res.stock ?? res.available ?? "-";

        // Fallback for simple items if no combination logic applies (optional, but good for safety)
        if (it.itemName) {
            const lens = allLens.find(l => l.productName === it.itemName);
            if (lens && (lens.stock || lens.stock === 0)) return lens.stock;
        }
        return "-";
    };

    useEffect(() => {
        const sub = computeSubtotal();
        setTaxes(prev => prev.map(t => ({ ...t, amount: (sub * (parseFloat(t.percentage) || 0) / 100).toFixed(2) })));
    }, [items]);

    return (
        <div className="h-screen flex flex-col bg-[#f8fafc] overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-700">
            <Header isReadOnly={isReadOnly} id={id} partyData={partyData} />

            <main className="flex-1 flex flex-col min-h-0 container mx-auto px-1 py-1 gap-1.5 overflow-hidden">
                {/* Top Info Grid */}
                <div className="grid grid-cols-12 gap-3 flex-shrink-0">
                    {/* Section 1: Order Details */}
                    <div className="col-span-12 lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight">Order Details</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded-md border border-blue-100">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Status:</span>
                                    <span className={`text-[10px] font-black uppercase ${status === "Pending" ? "text-amber-600" : "text-emerald-600"}`}>{status}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 grid grid-cols-3 gap-3">
                            {[
                                { label: "Series", value: billData.billSeries, key: "billSeries", placeholder: "Series" },
                                { label: "Order No", value: billData.billNo, key: "billNo", placeholder: "Order #" },
                                { label: "Date", value: safeDate(billData.date), key: "date", type: "date" }
                            ].map((field) => (
                                <div key={field.key}>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">{field.label}</label>
                                    <input
                                        type={field.type || "text"}
                                        value={field.value}
                                        disabled={isReadOnly || field.key === "billNo"}
                                        onChange={(e) => setBillData(b => ({ ...b, [field.key]: e.target.value }))}
                                        className={`w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 ${field.key === 'billNo' ? 'bg-slate-100 italic' : 'bg-slate-50'} border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:opacity-50`}
                                    />
                                </div>
                            ))}

                            <div className="relative">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Bill Type</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={billData.billType}
                                        disabled={isReadOnly}
                                        onChange={(e) => {
                                            setTaxQuery(e.target.value);
                                            setBillData(b => ({ ...b, billType: e.target.value }));
                                        }}
                                        onFocus={() => setShowTaxSuggestions(true)}
                                        className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:opacity-50"
                                    />
                                    {showTaxSuggestions && filteredTaxes.length > 0 && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg z-[1000] overflow-hidden max-h-48 overflow-y-auto">
                                            {filteredTaxes.map((tax, idx) => (
                                                <div
                                                    key={idx}
                                                    onMouseDown={() => selectTax(tax)}
                                                    className={`px-3 py-2 text-xs font-bold uppercase transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${activeTaxIndex === idx ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-slate-700"}`}
                                                >
                                                    {tax.Name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Location</label>
                                <input
                                    type="text"
                                    value={billData.godown}
                                    disabled={isReadOnly}
                                    onChange={(e) => setBillData(b => ({ ...b, godown: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Booked By</label>
                                <input
                                    type="text"
                                    value={billData.bookedBy}
                                    disabled={isReadOnly}
                                    onChange={(e) => setBillData(b => ({ ...b, bookedBy: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Party / Account */}
                    <div className="col-span-12 lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-purple-600" />
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight">Party / Account</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 rounded-md border border-purple-100">
                                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Bal:</span>
                                    <span className="text-[11px] font-black text-slate-800 tracking-tight">₹ {parseFloat(partyData.CurrentBalance?.amount || 0).toLocaleString()} {partyData.CurrentBalance?.type}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 grid grid-cols-2 gap-3">
                            {/* Row 1: Party Account (Search) & State */}
                            <div className="relative" ref={containerRef}>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Party Account Search</label>
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={partyData.partyAccount}
                                        disabled={isReadOnly}
                                        onChange={(e) => {
                                            setPartyData(p => ({ ...p, partyAccount: e.target.value }));
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all disabled:opacity-50"
                                    />
                                    {showSuggestions && filteredAccounts.length > 0 && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg z-[1000] overflow-hidden max-h-48 overflow-y-auto">
                                            {filteredAccounts.map((acc, idx) => (
                                                <div
                                                    key={idx}
                                                    onMouseDown={() => selectAccount(acc)}
                                                    className={`px-3 py-2 text-xs font-bold uppercase transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${activeIndex === idx ? "bg-purple-600 text-white" : "hover:bg-purple-50 text-slate-700"}`}
                                                >
                                                    {acc.Name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">State</label>
                                <input
                                    type="text"
                                    value={partyData.stateCode}
                                    readOnly
                                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg outline-none cursor-default"
                                />
                            </div>

                            {/* Row 2: Address & Contact No */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Address</label>
                                <input
                                    type="text"
                                    value={partyData.address || ""}
                                    disabled={isReadOnly}
                                    list="address-options-contact"
                                    onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all disabled:opacity-50"
                                    placeholder="Select or enter address..."
                                />
                                <datalist id="address-options-contact">
                                    {partyData.allAddresses?.map((addr, idx) => (
                                        <option key={idx} value={addr} />
                                    ))}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Contact No</label>
                                <input
                                    type="text"
                                    value={partyData.contactNumber}
                                    disabled={isReadOnly}
                                    onChange={(e) => setPartyData(p => ({ ...p, contactNumber: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all disabled:opacity-50"
                                    placeholder="N/A"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Order Items Table */}
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ShoppingCart className="w-4 h-4" /></div>
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Item Details</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{items.length} items added</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider italic">Double-click row for bulk entry</span>
                            <button
                                type="button"
                                onClick={addItemRow}
                                disabled={isReadOnly}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-all shadow-sm shadow-blue-100"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-wider">Add Item</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto relative">
                        <table className="w-full border-separate border-spacing-0" ref={tableRef}>
                            <thead>
                                <tr className="sticky top-0 z-20">
                                    {[
                                        { label: "#", width: "w-8", align: "center" },
                                        { label: "Barcode / Scan", width: "w-28" },
                                        { label: "Item Description", width: "w-48" },
                                        { label: "Order #", width: "w-20" },
                                        { label: "Eye", width: "w-12", group: "lens" },
                                        { label: "Sph", width: "w-16", group: "lens" },
                                        { label: "Cyl", width: "w-16", group: "lens" },
                                        { label: "Axis", width: "w-14", group: "lens" },
                                        { label: "Add", width: "w-16", group: "lens" },
                                        { label: "Remark / Detail", width: "w-32" },
                                        { label: "Qty", width: "w-14", align: "center" },
                                        { label: "Price", width: "w-20", align: "right" },
                                        { label: "Disc%", width: "w-14", align: "right" },
                                        { label: "Total", width: "w-24", align: "right" },
                                        { label: "Vendor", width: "w-32" },
                                        { label: "Import", width: "w-24" },
                                        { label: "Expiry", width: "w-24" },
                                        { label: "Stock", width: "w-14", align: "center" },
                                        { label: "", width: "w-8" }
                                    ].map((h, i) => (
                                        <th
                                            key={i}
                                            className={`${h.width} py-2 px-2 text-[10px] font-black uppercase tracking-tight border-b border-slate-200 
                                            ${h.group === "lens" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}
                                            ${h.align === "right" ? "text-right" : h.align === "center" ? "text-center" : "text-left"}`}
                                        >
                                            {h.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((it, idx) => (
                                    <React.Fragment key={it._id || it.id}>
                                        <tr
                                            onDoubleClick={() => openBulkOrderModal(it, idx)}
                                            className={`group transition-colors ${rowErrors[idx] ? "bg-red-50/50" : "hover:bg-blue-50/30"} ${isReadOnly ? "opacity-75" : ""}`}
                                        >
                                            <td className="py-2 px-2 text-center text-[10px] font-black text-slate-400 bg-slate-50/30">{idx + 1}</td>
                                            
                                            <td className="p-1">
                                                <input
                                                    className="w-full px-2 py-1.5 text-xs font-bold text-slate-600 bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded-md outline-none uppercase"
                                                    value={it.barcode}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "barcode", e.target.value)}
                                                    placeholder="Scan..."
                                                />
                                            </td>

                                            <td className="p-1 relative">
                                                <div className="relative group">
                                                    <input
                                                        className="w-full px-2 py-1.5 text-xs font-black text-slate-800 bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded-md outline-none"
                                                        value={itemQueries[idx] ?? it.itemName ?? ""}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setItemQueries(prev => ({ ...prev, [idx]: val }));
                                                            setShowItemSuggestions(prev => ({ ...prev, [idx]: true }));
                                                            updateItem(idx, "itemName", val);
                                                        }}
                                                        onFocus={() => setShowItemSuggestions(prev => ({ ...prev, [idx]: true }))}
                                                        placeholder="Search Item..."
                                                    />
                                                    {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                                                        <div className="absolute top-full left-0 w-80 mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl z-[1001] overflow-hidden max-h-60 overflow-y-auto">
                                                            {getFilteredLens(idx).map((lens, i) => (
                                                                <div
                                                                    key={i}
                                                                    onMouseDown={() => selectLens(lens, idx)}
                                                                    className="px-3 py-2 border-b border-slate-50 last:border-0 hover:bg-blue-50 cursor-pointer flex justify-between items-center group/item"
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[13px] font-black text-slate-800 uppercase leading-none">{lens.productName}</span>
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Stock: {lens.stock || 0} | MRP: {lens.mrp || 0}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-1">
                                                <input
                                                    className="w-full px-2 py-1.5 text-xs font-bold text-slate-500 bg-transparent border-none text-center outline-none"
                                                    value={it.orderNo || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "orderNo", e.target.value)}
                                                    placeholder="Order#"
                                                />
                                            </td>

                                            {["eye", "sph", "cyl", "axis", "add"].map(field => (
                                                <td key={field} className="p-1 bg-blue-50/20">
                                                    <input
                                                        type="text"
                                                        value={it[field] || ""}
                                                        disabled={isReadOnly}
                                                        onChange={e => updateItem(idx, field, e.target.value)}
                                                        className="w-full px-1 py-1.5 text-[11px] font-black text-blue-700 bg-transparent text-center border-b border-dashed border-blue-200 focus:border-blue-500 focus:bg-white outline-none"
                                                        placeholder={field.toUpperCase()}
                                                    />
                                                </td>
                                            ))}

                                            <td className="p-1">
                                                <input
                                                    className="w-full px-2 py-1.5 text-xs font-bold text-slate-600 bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded-md outline-none"
                                                    value={it.remark || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "remark", e.target.value)}
                                                    placeholder="Remark"
                                                />
                                            </td>

                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    className="w-full px-1 py-1.5 text-[11px] font-black text-slate-800 bg-emerald-50/40 text-center border border-transparent focus:border-emerald-500 focus:bg-white rounded-md outline-none"
                                                    value={it.qty || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "qty", e.target.value)}
                                                />
                                            </td>

                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    className="w-full px-1 py-1.5 text-[11px] font-black text-slate-800 bg-emerald-50/40 text-right border border-transparent focus:border-emerald-500 focus:bg-white rounded-md outline-none"
                                                    value={it.salePrice || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "salePrice", e.target.value)}
                                                />
                                            </td>

                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    className="w-full px-1 py-1.5 text-[11px] font-black text-red-600 bg-transparent text-right border-none outline-none"
                                                    value={it.discount || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "discount", e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>

                                            <td className="p-1">
                                                <div className="w-full px-2 py-1.5 text-[11px] font-black text-slate-900 text-right bg-slate-50/50 border-l border-slate-100 italic">
                                                    ₹{parseFloat(it.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </td>

                                            <td className="p-1 relative">
                                                <div className="relative">
                                                    <input
                                                        className="w-full px-2 py-1.5 text-[10px] font-bold text-slate-600 bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded-md outline-none"
                                                        value={vendorQueries[idx] ?? it.vendor ?? ""}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setVendorQueries(p => ({ ...p, [idx]: val }));
                                                            setShowVendorSuggestions(p => ({ ...p, [idx]: true }));
                                                            updateItem(idx, "vendor", val);
                                                        }}
                                                        onFocus={() => setShowVendorSuggestions(p => ({ ...p, [idx]: true }))}
                                                        placeholder="Vendor..."
                                                    />
                                                    {showVendorSuggestions[idx] && (
                                                        <div className="absolute top-full right-0 w-64 mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl z-[1001] overflow-hidden max-h-48 overflow-y-auto">
                                                            {getFilteredVendors(idx).map((v, i) => (
                                                                <div
                                                                    key={i}
                                                                    onMouseDown={() => selectVendor(v, idx)}
                                                                    className="px-3 py-2 border-b border-slate-50 last:border-0 hover:bg-purple-50 cursor-pointer flex flex-col group/v"
                                                                >
                                                                    <span className="text-[10px] font-black text-slate-700 uppercase leading-none">{v.Name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-1">
                                                <input
                                                    type="date"
                                                    className="w-full px-1 py-1 text-[10px] font-bold text-slate-500 bg-transparent border-none outline-none text-center"
                                                    value={it.importDate || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "importDate", e.target.value)}
                                                />
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="date"
                                                    className="w-full px-1 py-1 text-[10px] font-bold text-slate-500 bg-transparent border-none outline-none text-center"
                                                    value={it.expiryDate || ""}
                                                    disabled={isReadOnly}
                                                    onChange={e => updateItem(idx, "expiryDate", e.target.value)}
                                                />
                                            </td>

                                            <td className="py-2 px-2 text-center text-[10px] font-black text-slate-400 bg-slate-50/10">
                                                {getInitStockForRow(idx)}
                                            </td>

                                            <td className="p-1">
                                                <button
                                                    onClick={() => deleteItem(it.id)}
                                                    disabled={isReadOnly}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 rounded-md transition-colors disabled:opacity-0"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                        {rowErrors[idx] && (
                                            <tr className="bg-red-50/50">
                                                <td colSpan={19} className="px-4 py-1 border-b border-red-100">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-red-600 uppercase tracking-tight">
                                                        <AlertCircle className="w-3 h-3" />
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

                {/* Bottom Section: Taxes & Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[160px]">
                    <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                <Calculator className="w-3.5 h-3.5 text-orange-500" /> Taxes & Charges
                            </div>
                            <button onClick={addTaxRow} className="text-[10px] font-black text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded tracking-widest uppercase">+ Add Charge</button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full">
                                <thead className="bg-white border-b sticky top-0">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                                        <th className="px-5 py-2">Charge Name</th>
                                        <th className="px-5 py-2 w-32">Type</th>
                                        <th className="px-5 py-2 w-20 text-right">%</th>
                                        <th className="px-5 py-2 w-32 text-right">Amount</th>
                                        <th className="w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {taxes.map((t, idx) => (
                                        <tr key={t.id} className="hover:bg-slate-50/50">
                                            <td className="p-1 px-5 relative">
                                                 <input
                                                     type="text"
                                                     value={t.taxName}
                                                     onChange={e => updateTax(idx, "taxName", e.target.value)}
                                                     onFocus={() => showTaxDetailsSuggestionsForIdx(idx)}
                                                     onBlur={() => hideTaxDetailsSuggestionsForIdx(idx)}
                                                     onKeyDown={(e) => {
                                                        const suggestions = mergedTaxSuggestions.filter(st => String(st).toLowerCase().includes(String(t.taxName || "").toLowerCase()));
                                                        if (e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            setActiveTaxDetailsIndexes(prev => ({ ...prev, [idx]: Math.min((prev[idx] ?? -1) + 1, suggestions.length - 1) }));
                                                        } else if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            setActiveTaxDetailsIndexes(prev => ({ ...prev, [idx]: Math.max((prev[idx] ?? 0) - 1, 0) }));
                                                        } else if (e.key === "Enter") {
                                                            const activeIdx = activeTaxDetailsIndexes[idx] ?? -1;
                                                            if (activeIdx >= 0 && activeIdx < suggestions.length) {
                                                                updateTax(idx, "taxName", suggestions[activeIdx]);
                                                                setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: false }));
                                                            }
                                                        }
                                                     }}
                                                     className="w-full text-xs font-black text-slate-700 bg-transparent outline-none uppercase"
                                                     placeholder="Charge Name"
                                                 />
                                                 {showTaxDetailsSuggestions[idx] && (
                                                     <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 shadow-2xl z-[9999] rounded-lg mt-1 p-1 max-h-40 overflow-hidden mt-1">
                                                        <div className="max-h-[150px] overflow-y-auto">
                                                            {mergedTaxSuggestions
                                                                .filter(st => String(st).toLowerCase().includes((t.taxName || "").toLowerCase()))
                                                                .map((st, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className={`px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 text-[10px] font-bold uppercase transition-colors flex items-center justify-between group/suggestion ${activeTaxDetailsIndexes[idx] === i ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}
                                                                    >
                                                                        <div 
                                                                            className="flex-1"
                                                                            onMouseDown={() => {
                                                                                updateTax(idx, "taxName", st);
                                                                                setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: false }));
                                                                            }}
                                                                        >
                                                                            {st}
                                                                        </div>
                                                                        <button
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                handleDeleteSuggestion(st, 'tax');
                                                                            }}
                                                                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/suggestion:opacity-100 transition-opacity"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                     </div>
                                                 )}
                                             </td>
                                            <td className="p-1 px-5"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Additive</span></td>
                                            <td className="p-1 px-5 text-right"><input className="w-16 text-right text-xs font-black text-slate-700 bg-transparent outline-none" value={t.percentage} onChange={e => updateTax(idx, "percentage", e.target.value)} /></td>
                                            <td className="p-1 px-5 text-right font-black text-xs text-slate-800">₹ {t.amount}</td>
                                            <td className="p-1 px-4 text-center"><button onClick={() => deleteTax(t.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-5 bg-white rounded-xl shadow-lg border border-slate-200 p-4 flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Subtotal</span>
                                <span className="text-slate-900 font-black">₹ {computeSubtotal().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Total Tax</span>
                                <span className="text-emerald-600 font-black">+ ₹ {computeTotalTaxes().toFixed(2)}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Amount</span>
                                <span className="text-2xl font-black text-slate-900">₹ {computeNetAmount().toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paid Amount</label>
                                <input className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:border-blue-500 outline-none shadow-inner" placeholder="0.00" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
                            </div>
                            <div className="text-right">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Amount</label>
                                <div className={`text-lg font-black ${(computeNetAmount() - (Number(paidAmount) || 0)) > 0 ? "text-red-500" : "text-slate-400"}`}>₹ {(computeNetAmount() - (Number(paidAmount) || 0)).toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] font-black text-slate-400 uppercase">Status</div>
                                <select className="text-xs font-black text-slate-700 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg outline-none" value={status} onChange={e => setStatus(e.target.value)}>
                                    <option>Pending</option><option>Confirmed</option><option>Delivered</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-sm"><RotateCcw className="w-5 h-5" /></button>
                                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-200 transform hover:-translate-y-0.5 transition-all"><Save className="w-5 h-5" /> Save Order</button>
                            </div>
                        </div>
                    </div>
                </div>
        </main>

        {bulkOrderModal && bulkOrderItem && (
          <BulkLensMatrixV2
            product={allLens.find(l => String(l.productName).toLowerCase() === String(bulkOrderItem.itemName).toLowerCase())}
            baseItem={bulkOrderItem}
            onClose={() => setBulkOrderModal(false)}
            onAddItems={(newItems) => {
              setItems(prev => {
                const existing = prev.filter(it => 
                  (it.id !== bulkOrderItem.id) && 
                  ((it.itemName && (Number(it.qty) > 0 || it.sph || it.cyl)) || it.barcode)
                );
                const combined = [...existing, ...newItems].map((it, idx) => ({
                  ...it,
                  id: idx + 1
                }));
                return combined;
              });
              toast.success(`Added ${newItems.length} items from matrix`);
            }}
          />
        )}

        <Toaster position="top-right" />
      </div>
    );
}

const genTaxId = (suffix = "") => `tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;

export default AddContactLensSaleOrder;
