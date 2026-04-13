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
  MessageSquareText,
  Package,
  CheckCircle2,
  Mail,
  X,
  FileSpreadsheet,
} from "lucide-react";
import BulkLensMatrixV2 from "../Components/BulkLensMatrixV2";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower, getCombinationStock } from "../controllers/LensGroupCreationController";
import {
  addRxSaleOrder,
  getRxSaleOrder,
  editRxSaleOrder,
  getNextBillNumberForRxSaleOrder,
  updateRxItemRemark,
} from "../controllers/RxSaleOrder.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { useNavigate, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { Toaster, toast } from "react-hot-toast";
import { validateAccountLimits, getValidationErrorMessage } from "../utils/accountLimitValidator";
import { getSuggestions, learnSuggestions, deleteSuggestion } from "../controllers/Suggestion.controller";

const Header = ({ isReadOnly, id, partyData }) => (
  <div className="flex items-center justify-between px-4 py-1 bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm flex-shrink-0">
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <h1 className="text-xs font-black text-slate-800 uppercase tracking-tighter">
          {id ? "Edit Rx Sale Order" : "New Rx Sale Order"}
        </h1>
        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full uppercase tracking-widest">
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

function AddRxOrder() {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [category, setCategory] = useState("");
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const [orderData, setOrderData] = useState(null);

  const [taxAutoSuggestions, setTaxAutoSuggestions] = useState([]);
  const [customerAutoSuggestions, setCustomerAutoSuggestions] = useState([]);
  const [showTaxDetailsSuggestions, setShowTaxDetailsSuggestions] = useState({});
  const [activeTaxDetailsIndexes, setActiveTaxDetailsIndexes] = useState({});

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

  const [partyData, setPartyData] = useState({
    partyAccount: "",
    address: "",
    contactNumber: "",
    stateCode: "",
    creditLimit: "",
    CurrentBalance: { amount: 0, type: "Dr" },
  });

  const [items, setItems] = useState(
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      barcode: "",
      itemName: "",
      orderNo: "",
      eye: "",
      sph: "",
      cyl: "",
      axis: "",
      add: "",
      qty: "",
      purchasePrice: 0,
      salePrice: 0,
      discount: "",
      totalAmount: "",
      sellPrice: "",
      remark: "",
      customer: "",
      vendor: "",
      combinationId: "",
    }))
  );

  const [taxes, setTaxes] = useState([{ id: 1, taxName: "", type: "Additive", percentage: "2.5", amount: "0.00" }]);
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  // Load existing order if ID present
  useEffect(() => {
    if (!id) return;

    const fetchById = async () => {
      const res = await getRxSaleOrder(id);
      if (res.success) {
        const data = res.data.data;
        if (data) {
          setOrderData(data); // Will trigger useEffect below
        }
      }
    };
    fetchById();
  }, [id]);

  // Once orderData is set (edit mode), populate fields
  useEffect(() => {
    if (!orderData) return;

    setBillData({
      billSeries: orderData.billData?.billSeries || "",
      billNo: orderData.billData?.billNo || "",
      date: safeDate(orderData.billData?.date),
      billType: orderData.billData?.billType || "",
      godown: orderData.billData?.godown || "",
      bookedBy: orderData.billData?.bookedBy || "",
    });

    setPartyData({
      partyAccount: orderData.partyData?.partyAccount || "",
      address: orderData.partyData?.address || "",
      contactNumber: orderData.partyData?.contactNumber || "",
      stateCode: orderData.partyData?.stateCode || "",
      creditLimit: orderData.partyData?.creditLimit || 0,
      CurrentBalance: {
        amount: orderData.partyData?.CurrentBalance?.amount ?? 0,
        type: orderData.partyData?.CurrentBalance?.type || "Dr",
      },
    });

    setCategory(
      orderData.partyData?.AccountCategory ??
      orderData.partyData?.accountCategory ??
      orderData.partyData?.category ??
      ""
    );

    const mappedItems =
      Array.isArray(orderData.items) && orderData.items.length
        ? orderData.items.map((it, i) => ({
          id: i + 1,
          barcode: it.barcode || "",
          itemName: it.itemName || "",
          eye: it.eye || "",
          sph: it.sph ?? "",
          cyl: it.cyl ?? "",
          axis: it.axis ?? "",
          add: it.add ?? "",
          qty: it.qty ?? 0,
          purchasePrice: it.purchasePrice ?? 0,
          salePrice: it.salePrice ?? 0,
          discount: it.discount ?? 0,
          totalAmount: (typeof it.totalAmount !== "undefined"
            ? it.totalAmount
            : (it.qty || 0) * (it.salePrice || 0) * (1 - (it.discount || 0) / 100)
          ).toString(),
          sellPrice: it.sellPrice ?? "",
          remark: it.remark || "",
          customer: it.customer || it.remark || "",
          vendor: it.vendor || "",
          combinationId: it.combinationId || "",
          _id: it._id || undefined,
        }))
        : [
          {
            id: 1,
            barcode: "",
            itemName: "",
            eye: "",
            sph: "",
            cyl: "",
            axis: "",
            add: "",
            qty: "",
            purchasePrice: 0,
            salePrice: 0,
            discount: "",
            totalAmount: "",
            sellPrice: "",
            remark: "",
            customer: "",
            vendor: "",
            combinationId: "",
          }
        ];

    setItems(mappedItems);

    const iq = {};
    mappedItems.forEach((it, idx) => {
      iq[idx] = it.itemName || "";
    });
    setItemQueries(iq);

    const mappedTaxes =
      Array.isArray(orderData.taxes) && orderData.taxes.length
        ? orderData.taxes.map((t) => ({
          id: t._id || genTaxId("_loaded"),
          taxName: t.taxName || "",
          type: t.type || "Additive",
          percentage: t.percentage ?? 0,
          amount: t.amount ?? 0,
          meta: t.meta || {},
        }))
        : [
          {
            id: 1,
            taxName: "",
            type: "Additive",
            percentage: "2.5",
            amount: "0.00",
          },
        ];

    setTaxes(mappedTaxes);
    setRemark(orderData.remark || "");
    setStatus(orderData.status || "Pending");
    setPaidAmount(orderData.paidAmount ?? "");
  }, [orderData]);


  // Initial fetch of master data
  const fetch = async () => {
    try {
      const res = await getAllAccounts();
      setAccounts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("getAllAccounts failed:", err);
      setAccounts([]);
    }
  };
  const fetchTax = async () => {
    try {
      const resTaxes = await getAllTaxCategories();
      const dataArr = resTaxes?.data?.data ?? resTaxes;
      const taxesList = Array.isArray(dataArr) ? dataArr : [];
      setAllTaxes(taxesList);
      const defaultTax = taxesList.find((tax) => tax.isDefault === true);
      if (defaultTax) {
        setBillData((prev) => ({
          ...prev,
          billType: defaultTax.Name ?? defaultTax.name ?? "",
        }));
        const mappedDefaultTaxes = [];

        if (defaultTax.localTax1 && Number(defaultTax.localTax1) > 0) {
          mappedDefaultTaxes.push({
            id: genTaxId("_default_cgst"),
            taxName: "CGST",
            type: "Additive",
            percentage: defaultTax.localTax1,
            amount: 0,
            meta: defaultTax,
          });
        }
        if (defaultTax.localTax2 && Number(defaultTax.localTax2) > 0) {
          mappedDefaultTaxes.push({
            id: genTaxId("_default_sgst"),
            taxName: "SGST",
            type: "Additive",
            percentage: defaultTax.localTax2,
            amount: 0,
            meta: defaultTax,
          });
        }
        if (defaultTax.centralTax && Number(defaultTax.centralTax) > 0) {
          mappedDefaultTaxes.push({
            id: genTaxId("_default_igst"),
            taxName: "IGST",
            type: "Additive",
            percentage: defaultTax.centralTax,
            amount: 0,
            meta: defaultTax,
          });
        }
        if (defaultTax.cessTax && Number(defaultTax.cessTax) > 0) {
          mappedDefaultTaxes.push({
            id: genTaxId("_default_cess"),
            taxName: "CESS",
            type: "Additive",
            percentage: defaultTax.cessTax,
            amount: 0,
            meta: defaultTax,
          });
        }
        if (mappedDefaultTaxes.length > 0) setTaxes(mappedDefaultTaxes);
      }
    } catch (err) {
      console.error("getAllTaxCategories failed:", err);
      setAllTaxes([]);
    }
  };

  const fetchlenses = async () => {
    try {
      const res = await getAllLensPower();
      const dataArr = res?.data ?? res;
      setAllLens(Array.isArray(dataArr) ? dataArr : []);
    } catch (err) {
      console.log("getAllLensPower failed", err);
      setAllLens([]);
    }
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
    fetchlenses();
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

  // Bulk order modal state
  const [bulkOrderModal, setBulkOrderModal] = useState(false);
  const [bulkOrderItem, setBulkOrderItem] = useState(null);

  const [customPrices, setCustomPrices] = useState({}); // { productOrLensGroupId: price }

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
      itemIndex
    });
    setBulkOrderModal(true);
  };

  const query = (partyData.partyAccount || "").trim();
  const filteredAccounts = query.length > 0
    ? accounts.filter((acc) => String(acc.Name || "").toLowerCase().includes(query.toLowerCase()))
    : accounts.slice(0, 10);

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectAccount = async (acc) => {
    const accCategory = acc.AccountCategory || "";
    const primaryAddr = acc.Address || "";
    const addrs = acc.Addresses || [];
    const allAddresses = Array.from(new Set([primaryAddr, ...addrs].filter(Boolean)));
    setPartyData((p) => ({
      ...p,
      partyAccount: acc.Name || "",
      contactNumber: acc.MobileNumber || "",
      stateCode: acc.State || "",
      address: "",
      allAddresses: allAddresses,
      creditLimit: acc.CreditLimit || "",
      CurrentBalance: {
        amount: acc.CurrentBalance?.amount || 0,
        type: acc.CurrentBalance?.type || "Dr"
      },
    }));
    setCategory(accCategory);
    setShowSuggestions(false);
    setActiveIndex(-1);

    // Fetch next bill number for this party
    try {
      const nextBillNo = await getNextBillNumberForRxSaleOrder(acc.Name);
      const currentFY = getFinancialYearSeries("RXS");
      setBillData(b => ({
        ...b,
        billNo: b.billNo || nextBillNo.toString(),
        billSeries: b.billSeries || currentFY,
        godown: b.godown || "HO",
        bookedBy: b.bookedBy || user?.name || "",
      }));
      console.log("Next bill number calculated:", nextBillNo);
    } catch (err) {
      console.error("Error fetching bill number:", err);
      const currentFY = getFinancialYearSeries("RXS");
      setBillData(b => ({
        ...b,
        billSeries: b.billSeries || currentFY,
        godown: b.godown || "HO",
        bookedBy: b.bookedBy || user?.name || "",
      }));
    }

    // Fetch custom prices for this account
    try {
      const res = await getAccountWisePrices(acc._id, "Sale");
      if (res.success) {
        const pricesMap = {};
        res.data.forEach((p) => {
          const key = p.itemId || p.lensGroupId;
          pricesMap[key] = p; // Store the whole object (including percentage)
        });
        setCustomPrices(pricesMap);
      }
    } catch (err) {
      console.error("Error fetching custom prices:", err);
    }
  };

  const onPartyInputKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filteredAccounts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredAccounts.length) {
        selectAccount(filteredAccounts[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  // Tax Autocomplete
  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [activeTaxIndex, setActiveTaxIndex] = useState(-1);

  const filteredTaxes = taxQuery
    ? allTaxes.filter((tax) => String(tax.Name || "").toLowerCase().includes(taxQuery.toLowerCase()))
    : allTaxes.slice(0, 10);

  const genTaxId = (suffix = "") => `tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;

  const selectTax = (taxObj) => {
    setBillData((b) => ({ ...b, billType: taxObj.Name || "" }));
    setTaxQuery(taxObj.Name || "");
    setShowTaxSuggestions(false);
    setActiveTaxIndex(-1);

    const newTaxes = [];
    const lt1 = Number(taxObj.localTax1 || 0);
    const lt2 = Number(taxObj.localTax2 || 0);
    const ct = Number(taxObj.centralTax || 0);
    const cess = Number(taxObj.cessTax || 0);

    if (lt1 > 0 || lt2 > 0) {
      if (lt1 > 0) {
        newTaxes.push({ id: genTaxId("_cgst"), taxName: "CGST", type: "Additive", percentage: String(lt1), amount: "0.00", meta: { sourceTaxId: taxObj._id } });
      }
      if (lt2 > 0) {
        newTaxes.push({ id: genTaxId("_sgst"), taxName: "SGST", type: "Additive", percentage: String(lt2), amount: "0.00", meta: { sourceTaxId: taxObj._id } });
      }
    } else if (ct > 0) {
      newTaxes.push({ id: genTaxId("_igst"), taxName: "IGST", type: "Additive", percentage: String(ct), amount: "0.00", meta: { sourceTaxId: taxObj._id } });
    }
    if (cess > 0) {
      newTaxes.push({ id: genTaxId("_cess"), taxName: "CESS", type: "Additive", percentage: String(cess), amount: "0.00", meta: { sourceTaxId: taxObj._id } });
    }
    if (newTaxes.length > 0) setTaxes(newTaxes);
  };

  const handleTaxInputKeyDown = (e) => {
    if (!showTaxSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveTaxIndex((prev) => Math.min(prev + 1, filteredTaxes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveTaxIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeTaxIndex >= 0 && activeTaxIndex < filteredTaxes.length) {
        selectTax(filteredTaxes[activeTaxIndex]);
      }
    } else if (e.key === "Escape") {
      setShowTaxSuggestions(false);
      setActiveTaxIndex(-1);
    }
  };

  // Item Autocomplete
  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [activeItemIndexes, setActiveItemIndexes] = useState({});

  // Vendor & Customer Autocomplete
  const [vendorQueries, setVendorQueries] = useState({});
  const [showVendorSuggestions, setShowVendorSuggestions] = useState({});
  const [customerQueries, setCustomerQueries] = useState({});
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState({});

  const getFilteredVendors = (index) => {
    const q = (vendorQueries[index] || "").trim().toLowerCase();
    return accounts
      .filter((acc) => String(acc.Name || "").toLowerCase().includes(q))
      .slice(0, 10);
  };

  const getFilteredCustomers = (index) => {
    const q = (customerQueries[index] || "").trim().toLowerCase();
    
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

  const selectCustomer = (acc, index) => {
    updateItem(index, "customer", acc.Name);
    setCustomerQueries((prev) => ({ ...prev, [index]: acc.Name }));
    setShowCustomerSuggestions((prev) => ({ ...prev, [index]: false }));
  };

  const getFilteredLens = (index) => {
    const q = (itemQueries[index] || "").trim();
    return q
      ? allLens.filter((lens) => String(lens.productName || "").toLowerCase().includes(q.toLowerCase()))
      : allLens.slice(0, 10);
  };

  const getSalePriceForCategory = (lens, categoryName, fallback = true) => {
    if (!lens) return 0;
    const sp = lens.salePrice ?? lens.salePrices ?? null;
    if (sp && typeof sp === "object" && !Array.isArray(sp)) {
      const keys = Object.keys(sp);
      for (const k of keys) {
        if (String(k).toLowerCase() === String(categoryName).toLowerCase()) return Number(sp[k]) || 0;
      }
      if (sp.default || sp.Default || sp.retail) return Number(sp.default ?? sp.Default ?? sp.retail) || 0;
      if (fallback) {
        const firstVal = keys.map((k) => Number(sp[k])).find((v) => !Number.isNaN(v) && v !== 0);
        return Number(firstVal || 0);
      }
    }
    return 0; // Default
  };

  // compute initStock directly from the current row values (no dependency on stored combinationId)
  const getInitStockForRow = (index) => {
    const row = items[index];
    if (!row) return "-";

    // normalize function (same as combinationExistsForRow uses)
    const normalize = (str) =>
      String(str || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

    const targetName = normalize(row.itemName);
    if (!targetName) return "-";

    const targetSph = Number(row.sph);
    const targetCyl = Number(row.cyl);
    const targetAdd = Number(row.add);
    const targetEye = String(row.eye || "")
      .trim()
      .toUpperCase();

    // find lens by name
    const lens = allLens.find((l) => normalize(l.productName) === targetName);
    if (!lens) return "-";

    const addGroups = Array.isArray(lens.addGroups) ? lens.addGroups : [];

    for (const ag of addGroups) {
      const agAddValue = Number(ag.addValue);
      if (Number.isNaN(agAddValue)) continue;
      if (agAddValue !== targetAdd) continue;

      const combos = Array.isArray(ag.combinations) ? ag.combinations : [];
      for (const comb of combos) {
        const combSph = Number(comb.sph);
        const combCyl = Number(comb.cyl);
        if (Number.isNaN(combSph) || Number.isNaN(combCyl)) continue;
        const sphMatch = combSph === targetSph;
        const cylMatch = combCyl === targetCyl;
        const combEyeNorm = String(comb.eye || "").toUpperCase().replace(/[\/\s]/g, "");
        const targetEyeNorm = String(row.eye || "").toUpperCase().replace(/[\/\s]/g, "");
        const eyeMatch = targetEyeNorm === "RL"
            ? (combEyeNorm === "RL" || combEyeNorm === "BOTH" || combEyeNorm === "")
            : (combEyeNorm === targetEyeNorm || combEyeNorm === "RL" || combEyeNorm === "BOTH" || combEyeNorm === "");

        if (sphMatch && cylMatch && eyeMatch) {
          // return initStock (use common fallback names)
          return (
            comb.initStock ?? comb.stock ?? comb.available ?? comb.quantity ?? 0
          );
        }
      }
    }

    return "-";
  };

  const selectLens = (lens, index) => {
    setItems((prev) => {
      const copy = [...prev];
      const customPriceObj = customPrices[lens._id];
      let computedPrice = getSalePriceForCategory(lens, category);
      let discount = copy[index].discount || "";

      if (customPriceObj) {
        if (customPriceObj.percentage > 0) {
          discount = customPriceObj.percentage;
        } else if (customPriceObj.customPrice > 0) {
          computedPrice = customPriceObj.customPrice;
        }
      }

      const currentQty = parseFloat(copy[index].qty);
      const qty = isNaN(currentQty) || currentQty <= 0 ? 1 : currentQty;
      
      copy[index] = {
        ...copy[index],
        itemName: lens.productName || "",
        billItemName: lens.billItemName || "",
        vendorItemName: lens.vendorItemName || "",
        salePrice: computedPrice,
        discount: discount,
        qty: qty,
        purchasePrice: lens.purchasePrice ?? 0,
        eye: lens.eye ?? copy[index].eye ?? "",
      };

      const price = parseFloat(copy[index].salePrice) || 0;
      const disc = parseFloat(copy[index].discount) || 0;
      copy[index].totalAmount = (qty * price * (1 - disc / 100)).toFixed(2);

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
                    avlStk: stockRes.stock,
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

    setItemQueries((prev) => ({ ...prev, [index]: lens.productName || "" }));
    setShowItemSuggestions((prev) => ({ ...prev, [index]: false }));
    setActiveItemIndexes((prev) => ({ ...prev, [index]: -1 }));
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: prev.length + 1, barcode: "", itemName: "", orderNo: "", eye: "", sph: "", cyl: "", axis: "", add: "", qty: "",
        purchasePrice: 0, salePrice: 0, discount: "", totalAmount: "", sellPrice: "", remark: "", customer: "", vendor: "", combinationId: ""
      },
    ]);
  };

  const tableRef = useRef(null);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "Enter" &&
        tableRef.current?.contains(document.activeElement)
      ) {
        // If we are in a textarea, we might want to allow newlines if Shift+Enter, 
        // but the requirement says Enter moves cursor to next column.
        if (e.shiftKey) return;

        e.preventDefault();
        const inputs = Array.from(
          tableRef.current.querySelectorAll(
            'input:not([disabled]):not([readonly]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]):not([readonly])'
          )
        );
        const index = inputs.indexOf(document.activeElement);
        if (index > -1) {
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
            if (inputs[index + 1].select) {
              inputs[index + 1].select();
            }
          } else {
            // If it's the last input, add a new row and focus it
            addItemRow();
            setTimeout(() => {
              const newInputs = Array.from(
                tableRef.current.querySelectorAll(
                  'input:not([disabled]):not([readonly]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]):not([readonly])'
                )
              );
              newInputs[index + 1]?.focus();
            }, 0);
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [items]); // Re-run when items change to update querySelector lists

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };


  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };

      if (field === "itemName") {
        const selectedItem = allLens.find((lens) => lens.productName === value);
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
          copy[index].eye = selectedItem.eye ?? copy[index].eye ?? "";
          
          // Default qty to 1 if empty or 0
          const currentQty = parseFloat(copy[index].qty);
          if (isNaN(currentQty) || currentQty <= 0) {
            copy[index].qty = 1;
          }
        }
      }
 
      const qty = parseFloat(copy[index].qty) || 0;
      const price = parseFloat(copy[index].salePrice) || 0;
      const disc = Number(copy[index].discount) || 0;
 
      const discountAmount = qty * price * (disc / 100);
      copy[index].totalAmount = (qty * price - discountAmount).toFixed(2);

      // --- REAL-TIME STOCK & BARCODE REFRESH ---
      const powerFields = ["itemName", "sph", "cyl", "add", "axis", "eye"];
      if (powerFields.includes(field)) {
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
                      avlStk: stockRes.stock,
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

  const addTaxRow = () => {
    setTaxes((prev) => [...prev, { id: genTaxId("_manual"), taxName: "", type: "Additive", percentage: "", amount: "0.00" }]);
  };

  const deleteTax = (id) => setTaxes((prev) => prev.filter((t) => t.id !== id));

  const updateTax = (idx, field, value) => {
    setTaxes((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      return c;
    });
  };

  const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);

  // Recalculate tax amounts whenever subtotal or tax % changes
  useEffect(() => {
    const subtotal = computeSubtotal();
    if (!Array.isArray(taxes) || taxes.length === 0) return;

    let changed = false;
    const newTaxes = taxes.map(t => {
      const pct = parseFloat(t.percentage) || 0;
      const newAmt = (subtotal * pct / 100).toFixed(2);
      if (newAmt !== t.amount) {
        changed = true;
        return { ...t, amount: newAmt };
      }
      return t;
    });

    if (changed) setTaxes(newTaxes);
  }, [items, taxes]); // Caution: adding taxes dependency might cause loops if not careful, but logic checks value diff

  const computeTotalTax = () => taxes.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const computeNetAmount = () => computeSubtotal() + computeTotalTax();

  const handleSave = async () => {
    const subtotal = computeSubtotal();
    const taxesAmount = computeTotalTax();
    const netAmount = subtotal + taxesAmount;

    const activeItems = items.filter(it => it.itemName && it.itemName.trim() !== "");

    if (activeItems.length === 0) {
      toast.error("Please add at least one item before saving");
      return;
    }

    // Validate account credit limit and day limit before saving (for new orders only)
    if (!id && partyData?.partyAccount) {
      const validation = await validateAccountLimits(partyData.partyAccount, netAmount, "rx");
      
      if (!validation.success) {
        const errorMessage = getValidationErrorMessage(validation.messages);
        toast.error(errorMessage);
        console.warn("Account validation failed:", validation);
        return;
      }
    }

    const payload = {
      billData,
      partyData,
      items: activeItems.map((it) => ({
        barcode: it.barcode,
        itemName: it.itemName,
        billItemName: it.billItemName || "",
        vendorItemName: it.vendorItemName || "",
        orderNo: it.orderNo || "",
        eye: it.eye,
        sph: Number(it.sph) || 0,
        cyl: Number(it.cyl) || 0,
        axis: Number(it.axis) || 0,
        add: Number(it.add) || 0,
        qty: Number(it.qty) || 0,
        purchasePrice: Number(it.purchasePrice) || 0,
        salePrice: Number(it.salePrice) || 0,
        discount: Number(it.discount) || 0,
        totalAmount: Number(it.totalAmount) || 0,
        sellPrice: Number(it.sellPrice) || 0,
        remark: it.remark,
        customer: it.customer || it.remark || "",
        vendor: it.vendor || "",
        combinationId: it.combinationId || "",
        _id: it._id, // important for updates
      })),
      taxes: taxes.map((t) => ({
        taxName: t.taxName,
        type: t.type,
        percentage: Number(t.percentage) || 0,
        amount: Number(t.amount) || 0,
        meta: t.meta || {},
      })),
      grossAmount: items.reduce((acc, curr) => acc + (Number(curr.qty) * Number(curr.salePrice) || 0), 0),
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount: Number(paidAmount) || 0,
      dueAmount: netAmount - (Number(paidAmount) || 0),
      remark,
      status,
    };

    let res;
    if (id) {
      res = await editRxSaleOrder(id, payload);
    } else {
      res = await addRxSaleOrder(payload);
    }

    if (res.success) {
      toast.success(id ? "Order updated!" : "Order saved!");
      
       // Trigger background learning of new strings
       try {
          const stdTaxes = new Set(['CGST', 'SGST', 'IGST', 'CESS']);
          const learnedTaxes = taxes
               .map(t => t.taxName?.trim())
               .filter(n => n && isNaN(n) && !stdTaxes.has(n.toUpperCase()));
          
          const learnedCustomers = activeItems
               .map(it => it.customer?.trim())
               .filter(n => n && isNaN(n));
               
          if(learnedTaxes.length > 0 || learnedCustomers.length > 0) {
              await learnSuggestions({ taxes: learnedTaxes, customers: learnedCustomers }).catch(console.error);
          }
       } catch (e) {}

      navigate("/lenstransaction/sale/saleorder"); // Redirect to Sale Order page
    } else {
      toast.error(res.error || res.message || "Failed to save");
    }
  };

  const handleReset = () => {
    setBillData({ billSeries: "", billNo: "", date: new Date().toISOString().split("T")[0], billType: "", godown: "", bookedBy: "" });
    setPartyData({ partyAccount: "", address: "", contactNumber: "", stateCode: "", creditLimit: "", CurrentBalance: { amount: 0, type: "Dr" } });
    setItems([{ id: 1, barcode: "", itemName: "", unit: "", dia: "", eye: "", sph: "", cyl: "", axis: "", add: "", qty: "", purchasePrice: 0, salePrice: 0, discount: "", totalAmount: "", sellPrice: "", remark: "" }]);
    setTaxes([{ id: 1, taxName: "", type: "Additive", percentage: "", amount: "0.00" }]);
    setPaidAmount("");
    setRemark("");
    setStatus("Pending");
  };

  const isReadOnly = (!!id && (orderData?.status === "Invoiced" || orderData?.status === "Challaned"));

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
                    disabled={isReadOnly}
                    onChange={(e) => setBillData(b => ({ ...b, [field.key]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              ))}

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
                    value={partyData.partyAccount || ""}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setPartyData(p => ({ ...p, partyAccount: e.target.value }));
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={onPartyInputKeyDown}
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
                  value={partyData.stateCode || ""}
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
                  list="address-options-rx-main"
                  onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all disabled:opacity-50"
                  placeholder="Select or enter address..."
                />
                <datalist id="address-options-rx-main">
                  {partyData.allAddresses?.map((addr, idx) => (
                    <option key={idx} value={addr} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Contact No</label>
                <input
                  type="text"
                  value={partyData.contactNumber || ""}
                  disabled={isReadOnly}
                  onChange={(e) => setPartyData(p => ({ ...p, contactNumber: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all disabled:opacity-50"
                  placeholder="N/A"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Items Table */}
        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight">Order Items</h3>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1">{items.length} Rows</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addItemRow}
                disabled={isReadOnly}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm shadow-emerald-100 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> Add Row
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#fdfdfe]" ref={tableRef}>
            <table className="w-full border-collapse isolate">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/90 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <th className="w-10 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center border-b border-slate-100">#</th>
                  <th className="w-32 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left border-b border-slate-100 italic">Barcode</th>
                  <th className="min-w-[200px] px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left border-b border-slate-100">Item Description</th>
                  <th className="w-20 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center border-b border-slate-100 italic">Order#</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-blue-600 uppercase tracking-wider text-center border-b border-blue-100 bg-blue-50/30">Eye</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-blue-600 uppercase tracking-wider text-center border-b border-blue-100 bg-blue-50/30">Sph</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-blue-600 uppercase tracking-wider text-center border-b border-blue-100 bg-blue-50/30">Cyl</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-blue-600 uppercase tracking-wider text-center border-b border-blue-100 bg-blue-50/30">Axis</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-blue-600 uppercase tracking-wider text-center border-b border-blue-100 bg-blue-50/30">Add</th>
                  <th className="w-20 px-2 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-wider text-right border-b border-emerald-100 bg-emerald-50/30 font-mono">Qty</th>
                  <th className="w-24 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right border-b border-slate-100 font-mono">Price</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-red-500 uppercase tracking-wider text-right border-b border-red-100 bg-red-50/30 font-mono">Disc%</th>
                  <th className="w-28 px-2 py-2 text-[10px] font-black text-slate-800 uppercase tracking-wider text-right border-b border-slate-100 font-mono">Total Amnt</th>
                  <th className="w-28 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left border-b border-slate-100 italic">Vendor</th>
                  <th className="w-32 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left border-b border-slate-100 italic">Customer</th>
                  <th className="w-16 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right border-b border-slate-100 font-mono">Stk</th>
                  <th className="w-12 px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center border-b border-slate-100">Op</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    onDoubleClick={() => !isReadOnly && openBulkOrderModal(item, index)}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    <td className="px-1 py-1 text-center text-[10px] font-black text-slate-400 font-mono">{index + 1}</td>
                    
                    <td className="p-1 px-1.5 focus-within:z-20">
                      <input
                        type="text"
                        value={item.barcode || ""}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(index, "barcode", e.target.value)}
                        className="w-full px-2 py-1.5 text-xs font-bold text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition-all placeholder:text-[10px] placeholder:italic placeholder:font-medium"
                        placeholder="Scan..."
                      />
                    </td>

                    <td className="p-1 px-1.5 relative focus-within:z-20">
                      <div className="relative">
                        <input
                          type="text"
                          value={itemQueries[index] ?? item.itemName ?? ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemQueries(p => ({ ...p, [index]: val }));
                            setShowItemSuggestions(p => ({ ...p, [index]: true }));
                            updateItem(index, "itemName", val);
                          }}
                          onFocus={() => setShowItemSuggestions(p => ({ ...p, [index]: true }))}
                          onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [index]: false })), 200)}
                          className="w-full px-2 py-1.5 text-sm font-black text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md outline-none transition-all"
                          placeholder="Search Item..."
                        />
                        {showItemSuggestions[index] && getFilteredLens(index).length > 0 && (
                          <div className="absolute top-full left-0 w-[350px] mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl z-[9999] overflow-hidden py-1">
                            {getFilteredLens(index).map((lens, i) => (
                              <div
                                key={i}
                                onMouseDown={() => selectLens(lens, index)}
                                className={`px-4 py-2 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex flex-col gap-0.5 ${activeItemIndexes[index] === i ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-slate-700"}`}
                              >
                                <span className={`text-[13px] font-black ${activeItemIndexes[index] === i ? "text-white" : "text-slate-800"}`}>{lens.productName}</span>
                                <div className="flex items-center gap-3">
                                  <span className={`text-[10px] font-bold ${activeItemIndexes[index] === i ? "text-blue-100" : "text-slate-500"} uppercase tracking-wider`}>Stock: {lens.stock || 0}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-1 px-1.5">
                      <input
                        type="text"
                        value={item.orderNo || ""}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(index, "orderNo", e.target.value)}
                        className="w-full px-2 py-1.5 text-xs font-bold text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 rounded-md outline-none transition-all text-center uppercase"
                        placeholder="ORD#"
                      />
                    </td>

                    {["eye", "sph", "cyl", "axis", "add"].map((pow) => (
                      <td key={pow} className={`p-1 px-1 bg-blue-50/20 shadow-inner w-16`}>
                        <input
                          type="text"
                          value={item[pow]}
                          disabled={isReadOnly}
                          onChange={(e) => updateItem(index, pow, e.target.value)}
                          className="w-full px-1 py-1.5 text-sm font-black text-center text-blue-700 bg-transparent border-b border-dashed border-blue-200 focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all placeholder:text-[10px] placeholder:text-blue-300"
                          placeholder={pow === "eye" ? "RL" : "0.00"}
                        />
                      </td>
                    ))}

                    <td className="p-1 px-1.5 bg-emerald-50/20">
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(index, "qty", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm font-black text-right text-emerald-700 bg-transparent border border-transparent hover:border-emerald-200 focus:bg-white focus:border-emerald-500 rounded-md outline-none transition-all font-mono"
                      />
                    </td>

                    <td className="p-1 px-1.5">
                      <input
                        type="number"
                        min="0"
                        value={item.salePrice}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(index, "salePrice", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm font-black text-right text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 rounded-md outline-none transition-all font-mono"
                      />
                    </td>

                    <td className="p-1 px-1.5 bg-red-50/20 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.discount}
                        disabled={isReadOnly}
                        onChange={(e) => updateItem(index, "discount", e.target.value)}
                        className="w-full px-2 py-1.5 text-sm font-black text-right text-red-600 bg-transparent border border-transparent hover:border-red-200 focus:bg-white focus:border-red-400 rounded-md outline-none transition-all font-mono"
                      />
                    </td>

                    <td className="p-1 px-2.5 text-right">
                      <span className="text-sm font-black text-slate-800 tracking-tighter font-mono">₹ {(Number(item.totalAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>

                    {/* Vendor Autocomplete */}
                    <td className="p-1 px-1.5 relative focus-within:z-20">
                      <div className="relative">
                        <input
                          type="text"
                          value={vendorQueries[index] ?? item.vendor ?? ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVendorQueries(p => ({ ...p, [index]: val }));
                            setShowVendorSuggestions(p => ({ ...p, [index]: true }));
                            updateItem(index, "vendor", val);
                          }}
                          onFocus={() => setShowVendorSuggestions(p => ({ ...p, [index]: true }))}
                          onBlur={() => setTimeout(() => setShowVendorSuggestions(p => ({ ...p, [index]: false })), 200)}
                          className="w-full px-2 py-1.5 text-xs font-bold text-slate-500 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 rounded-md outline-none transition-all uppercase truncate"
                          placeholder="Vendor"
                        />
                        {showVendorSuggestions[index] && getFilteredVendors(index).length > 0 && (
                          <div className="absolute top-full left-0 w-52 bg-white rounded-lg shadow-xl border border-slate-200 z-[120]">
                            {getFilteredVendors(index).map((acc, i) => (
                              <div key={i} onMouseDown={() => selectVendor(acc, index)} className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 border-b border-slate-50 text-[10px] font-black text-slate-700 uppercase">
                                {acc.Name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Customer Autocomplete */}
                    <td className="p-1 px-1.5 relative focus-within:z-20">
                      <div className="relative">
                        <input
                          type="text"
                          value={customerQueries[index] ?? item.customer ?? ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomerQueries(p => ({ ...p, [index]: val }));
                            setShowCustomerSuggestions(p => ({ ...p, [index]: true }));
                            updateItem(index, "customer", val);
                          }}
                          onFocus={() => setShowCustomerSuggestions(p => ({ ...p, [index]: true }))}
                          onBlur={() => setTimeout(() => setShowCustomerSuggestions(p => ({ ...p, [index]: false })), 200)}
                          className="w-full px-2 py-1.5 text-xs font-black text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 rounded-md outline-none transition-all truncate"
                          placeholder="Customer"
                        />
                        {showCustomerSuggestions[index] && getFilteredCustomers(index).length > 0 && (
                          <div className="absolute top-full left-0 w-52 bg-white rounded-lg shadow-xl border border-slate-200 z-[120]">
                            {getFilteredCustomers(index).map((acc, i) => (
                              <div key={i} onMouseDown={() => selectCustomer(acc, index)} className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 border-b border-slate-50 text-[10px] font-black text-slate-700 uppercase">
                                {acc.Name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-1 py-1 text-right text-[11px] font-black text-slate-400 font-mono tabular-nums">
                      {getInitStockForRow(index)}
                    </td>

                    <td className="p-1 px-1 text-center">
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={isReadOnly}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        title="Remove Row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Bottom Section: Taxes & Summary */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0 bg-white p-3 rounded-xl border border-slate-200">
          {/* Section 4: Tax Details */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-2">
            <div className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <div className="flex items-center gap-1.5 ">
                <Calculator className="w-3 h-3 text-blue-600" />
                <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Tax Details</h3>
              </div>
              <button
                onClick={addTaxRow}
                disabled={isReadOnly}
                className="text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded transition-all"
              >
                + Add Tax
              </button>
            </div>

            <div className="space-y-1.5 max-h-[100px] overflow-auto pr-1">
              {taxes.map((t, idx) => (
                <div key={t.id} className="flex gap-1.5 items-center bg-slate-50/50 p-1 rounded-lg border border-slate-100 group">
                  <select
                    value={t.type}
                    disabled={isReadOnly}
                    onChange={(e) => updateTax(idx, "type", e.target.value)}
                    className="w-16 text-[10px] font-bold border border-slate-200 rounded p-1 outline-none focus:border-blue-400"
                  >
                    <option value="Additive">+</option>
                    <option value="Subtractive">-</option>
                  </select>
                  
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={t.taxName}
                      disabled={isReadOnly}
                      onChange={(e) => updateTax(idx, "taxName", e.target.value)}
                      onFocus={() => setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: true }))}
                      onBlur={() => setTimeout(() => setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: false })), 200)}
                      className="w-full text-[10px] font-black uppercase border border-slate-200 rounded p-1 outline-none focus:border-blue-400"
                      placeholder="Tax Name"
                    />
                    {showTaxDetailsSuggestions[idx] && (
                      <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-slate-200 shadow-2xl rounded-lg z-[100] overflow-hidden py-1">
                        {mergedTaxSuggestions
                          .filter(st => String(st).toLowerCase().includes(String(t.taxName || "").toLowerCase()))
                          .map((st, i) => (
                            <div
                              key={i}
                              onMouseDown={() => {
                                updateTax(idx, "taxName", st);
                                setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: false }));
                              }}
                              className="px-3 py-1.5 text-[10px] font-black uppercase hover:bg-blue-50 cursor-pointer text-slate-700"
                            >
                              {st}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="relative w-14">
                    <input
                      type="text"
                      value={t.percentage}
                      disabled={isReadOnly}
                      onChange={(e) => updateTax(idx, "percentage", e.target.value)}
                      className="w-full text-[10px] font-black border border-slate-200 rounded p-1 pr-4 text-right outline-none focus:border-blue-400"
                    />
                    <span className="absolute right-1 top-1 text-[9px] font-bold text-slate-400">%</span>
                  </div>

                  <input
                    type="text"
                    value={t.amount}
                    readOnly
                    className="w-20 text-[10px] font-black bg-slate-100 border border-slate-200 rounded p-1 text-right text-slate-800"
                  />

                  <button
                    onClick={() => deleteTax(t.id)}
                    disabled={isReadOnly}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Summary Panel */}
          <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl p-3 text-white shadow-xl flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider italic">Subtotal</span>
                <span className="text-xs font-black tracking-tight font-mono">₹ {computeSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider italic">Tax Total</span>
                <span className="text-xs font-black tracking-tight font-mono text-blue-300">₹ {computeTotalTax().toFixed(2)}</span>
              </div>
              <div className="col-span-2 flex justify-between items-center mt-1 py-1 px-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-widest">Net Amount</span>
                <span className="text-xl font-black tracking-tighter text-emerald-400 font-mono italic">₹ {computeNetAmount().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-white/10">
              <div className="flex-1 flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg">
                <span className="text-[9px] font-black text-slate-400 uppercase">Paid</span>
                <input
                  type="number"
                  value={paidAmount}
                  disabled={isReadOnly}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full bg-transparent border-none text-xs font-black text-emerald-400 focus:ring-0 p-0 text-right font-mono"
                  placeholder="0.00"
                />
              </div>
              <div className="flex-1 flex items-center justify-between px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due</span>
                <span className="text-xs font-black text-amber-400 font-mono tracking-tighter">₹ {(computeNetAmount() - (Number(paidAmount) || 0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleReset}
                disabled={isReadOnly}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-white/5 hover:border-white/10"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <button
                onClick={handleSave}
                disabled={isReadOnly}
                className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Order
              </button>
            </div>
          </div>
        </div>
      </main>

      <Toaster position="top-right" />

      {/* Modals */}
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
    </div>
  );
}

export default AddRxOrder;