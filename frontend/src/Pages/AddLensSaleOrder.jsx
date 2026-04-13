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
} from "lucide-react";
import BulkLensMatrixV2 from "../Components/BulkLensMatrixV2";
import { getAllAccounts, updateAccount, patchAccount } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import {
  getAllLensPower, // Keeping this as it was not explicitly removed by the instruction's snippet
  getPowerRangeLibrary,
  getCombinationStock,
} from "../controllers/LensGroupCreationController";
import {
  addLensSaleOrder,
  getLensSaleOrder,
  editLensSaleOrder,
  getNextBillNumberForLensSaleOrder,
} from "../controllers/LensSaleOrder.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { getOfferForProduct } from "../controllers/OfferController";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { validateAccountLimits, getValidationErrorMessage } from "../utils/accountLimitValidator";
import { checkStockAvailability } from "../controllers/lensLocation.controller";
import { getSuggestions, learnSuggestions, deleteSuggestion } from "../controllers/Suggestion.controller";

const Header = ({ isReadOnly, id, partyData }) => (
  <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-1.5 bg-blue-600 rounded shadow-sm">
        <ShoppingCart className="w-4 h-4 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{id ? "Edit Lens Sale" : "New Lens Sale"}</h1>
          {isReadOnly && (
            <div className="flex items-center gap-1 px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
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

function AddLensSaleOrder() {
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isBulkAdd = queryParams.get("bulk") === "true";

  const [taxAutoSuggestions, setTaxAutoSuggestions] = useState([]);
  const [customerAutoSuggestions, setCustomerAutoSuggestions] = useState([]);

  // Tax suggestions state for details section
  const [showTaxDetailsSuggestions, setShowTaxDetailsSuggestions] = useState({});
  const [activeTaxDetailsIndexes, setActiveTaxDetailsIndexes] = useState({});

  const [saleData, setSaleData] = useState(null);
  const [category, setCategory] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const { user } = useContext(AuthContext);

  const safeDate = (d) => {
    try {
      if (!d) return new Date().toISOString().split("T")[0];

      const dt = new Date(d);
      if (isNaN(dt.getTime())) return new Date().toISOString().split("T")[0];

      // Always returns YYYY-MM-DD
      return dt.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };

  const [partyQuery, setPartyQuery] = useState("");
  const [billData, setBillData] = useState({
    billSeries: "",
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    billType: "",
    godown: "",
    bookedBy: "",
  });

  // Fetch by ID -> set saleData (mapping effect will run)
  useEffect(() => {
    if (!id) return;

    const fetchById = async () => {
      const res = await getLensSaleOrder(id);

      if (res.success) {
        const data = res.data.data;

        setSaleData(data); // mapping effect will pick it up
      }
    };

    fetchById();
  }, [id]);

  // Load accounts, taxes, lenses once
  // Load accounts, taxes, lenses once
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

        // CGST
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

        // SGST
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

        // IGST
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

        // CESS
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

        setTaxes(mappedDefaultTaxes);
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
      if(tRes.success) setTaxAutoSuggestions(tRes.data || []);
      const cRes = await getSuggestions('customer');
      if(cRes.success) setCustomerAutoSuggestions(cRes.data || []);
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

  // Show bulk mode notification
  useEffect(() => {
    if (isBulkAdd) {
      toast("Bulk Add Mode: Select an item and click the green grid icon to add multiple powers at once.", {
        icon: '📊',
        duration: 5000,
      });
    }
  }, [isBulkAdd]);

  const [partyData, setPartyData] = useState({
    _id: "", // Added
    partyAccount: "",
    address: "",
    contactNumber: "",
    stateCode: "",
    creditLimit: "",
    creditDays: 0, // Added
    CurrentBalance: {
      amount: 0,
      type: "Dr",
    },
  });

  const [customPrices, setCustomPrices] = useState({}); // { productOrLensGroupId: price }

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
      remark: "",
      qty: "",
      salePrice: 0,
      discount: "",
      totalAmount: "",
      sellPrice: "",
      purchasePrice: 0,
      combinationId: "",
      partyName: "",
      vendor: "",
      avlStk: "-", // added
    }))
  );

  const [taxes, setTaxes] = useState([
    {
      id: 1,
      taxName: "",
      type: "Additive",
      percentage: "2.5",
      amount: "0.00",
    },
  ]);

  // Prefill from forwarded challan (if any)
  useEffect(() => {
    if (id) return;
    const dataStr = localStorage.getItem("forwardedChallan");
    if (!dataStr) return;
    try {
      const challan = JSON.parse(dataStr);
      if (challan.billData) {
        setBillData((prev) => ({
          ...prev,
          billSeries: challan.billData.billSeries || prev.billSeries,
          billNo: challan.billData.billNo || prev.billNo,
          date: safeDate(challan.billData.date) || prev.date,
          billType: challan.billData.billType || prev.billType,
          godown: challan.billData.godown || prev.godown,
          bookedBy: challan.billData.bookedBy || prev.bookedBy,
        }));
      }

      if (challan.partyData) {
        setPartyData((prev) => ({
          ...prev,
          partyAccount: challan.partyData.partyAccount || prev.partyAccount,
          address: challan.partyData.address || prev.address,
          contactNumber: challan.partyData.contactNumber || prev.contactNumber,
          stateCode: challan.partyData.stateCode || prev.stateCode,
        }));
      }

      if (Array.isArray(challan.items)) {
        const mapped = challan.items.map((it, idx) => ({
          id: Date.now() + idx,
          _id: it._id,
          barcode: it.barcode || "",
          itemName: it.itemName || it.name || "",
          orderNo: challan.billData?.billNo || "",
          eye: it.eye || "",
          sph: it.sph ?? "",
          cyl: it.cyl ?? "",
          axis: it.axis || "",
          add: it.add ?? "",
          qty: it.qty ?? it.quantity ?? 1,
          salePrice: it.salePrice ?? it.price ?? 0,
          discount: it.discount ?? 0,
          totalAmount: it.totalAmount ?? ((it.salePrice ?? it.price ?? 0) * (it.qty ?? 1)),
          sellPrice: it.sellPrice ?? it.salePrice ?? 0,
          combinationId: it.combinationId || "",
          partyName: challan.partyData?.partyAccount || "",
        }));
        setItems(mapped);
      }

      localStorage.removeItem("forwardedChallan");
      toast.success("Prefilled order from challan");
    } catch (e) {
      console.error("Failed to parse forwardedChallan", e);
    }
  }, [id]);

  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");

  // Bulk order modal state
  const [bulkOrderModal, setBulkOrderModal] = useState(false);
  const [bulkOrderItem, setBulkOrderItem] = useState(null);
  const [bulkOrderMatrix, setBulkOrderMatrix] = useState({});
  const [sphValues, setSphValues] = useState([]);
  const [cylValues, setCylValues] = useState([]);

  // When saleData is loaded (from fetchById), map it to UI and set category
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

    // partyData (preserve shape)
    const partyName = saleData.partyData?.partyAccount || "";
    setPartyQuery(partyName);
    setPartyData({
      _id: saleData.partyData?._id || saleData.partyData?.id || "",
      partyAccount: saleData.partyData?.partyAccount || "",
      address: saleData.partyData?.address || "",
      contactNumber: saleData.partyData?.contactNumber || "",
      stateCode: saleData.partyData?.stateCode || "",
      creditLimit: saleData.partyData?.creditLimit || 0,
      creditDays: saleData.partyData?.creditDays || 0,
      CurrentBalance: {
        amount: saleData.partyData?.CurrentBalance?.amount ?? 0,
        type: saleData.partyData?.CurrentBalance?.type || "Dr",
      },
    });

    setCategory(
      saleData.partyData?.AccountCategory ??
      saleData.partyData?.accountCategory ??
      saleData.partyData?.category ??
      ""
    );

    // items: map DB items -> UI rows. keep id as row index + 1 for UI
    const mappedItems =
      Array.isArray(saleData.items) && saleData.items.length
        ? saleData.items.map((it, i) => ({
          id: i + 1,
          barcode: it.barcode || "",
          itemName: it.itemName || "",
          orderNo: it.orderNo || "",
          eye: it.eye || "",
          isInvoiced: !!it.isInvoiced,
          isChallaned: !!it.isChallaned,
          sph: it.sph ?? "",
          cyl: it.cyl ?? "",
          axis: it.axis ?? "",
          add: it.add ?? "",
          remark: it.remark || "",
          qty: it.qty ?? 0,
          salePrice: it.salePrice ?? 0,
          discount: it.discount ?? 0,
          totalAmount:
            typeof it.totalAmount !== "undefined"
              ? String(it.totalAmount)
              : String(
                (it.qty || 0) * (it.salePrice || 0) - (it.discount || 0)
              ),
          sellPrice: it.sellPrice ?? "",
          purchasePrice: it.purchasePrice ?? 0,
          combinationId: it.combinationId || it.CombinationId || "",
          _id: it._id || undefined,
          partyName: it.partyName || "",
          vendor: it.vendor || "",
        }))
        : [
          {
            id: 1,
            barcode: "",
            itemName: "",
            orderNo: "",
            eye: "",
            isInvoiced: false,
            isChallaned: false,
            sph: "",
            cyl: "",
            axis: "",
            add: "",
            remark: "",
            qty: "",
            salePrice: 0,
            discount: "",
            totalAmount: "",
            sellPrice: "",
            purchasePrice: 0,
            combinationId: "",
            partyName: "",
            vendor: "",
          },
        ];
    setItems(mappedItems);

    // set itemQueries so UI search shows names (optional)
    const iq = {};
    const vq = {};
    const pq = {};
    mappedItems.forEach((it, idx) => {
      iq[idx] = it.itemName || "";
      vq[idx] = it.vendor || "";
      pq[idx] = it.partyName || "";
    });
    setItemQueries(iq);
    setVendorQueries(vq);
    setPartyQueries(pq);

    // taxes - map DB tax objects to UI tax rows (use _id as id for keys)
    const mappedTaxes =
      Array.isArray(saleData.taxes) && saleData.taxes.length
        ? saleData.taxes.map((t) => ({
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

    // monetary summary fields
    setRemark(saleData.remark || "");
    setPaidAmount(saleData.paidAmount ?? "");
    setStatus(saleData.status || "Pending");
  }, [saleData]);

  const isReadOnly = status === "Done";

  // autocomplete / suggestions states
  const [showPartyAccSuggestions, setShowPartyAccSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  const filteredAccounts =
    partyQuery.length > 0
      ? accounts.filter((acc) =>
        String(acc.Name || "")
          .toLowerCase()
          .includes(partyQuery.toLowerCase())
      )
      : accounts.slice(0, 10);

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowPartyAccSuggestions(false);
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
    setPartyQuery(acc.Name || "");
    // Update party data with account details
    setPartyData((p) => ({
      ...p,
      _id: acc._id || "",
      partyAccount: acc.Name || "",
      contactNumber: acc.MobileNumber || "",
      stateCode: acc.State || "",
      address: "",
      allAddresses: allAddresses,
      creditLimit: acc.CreditLimit || "",
      creditDays: acc.CreditDays || 0,
      CurrentBalance: {
        amount: acc.CurrentBalance?.amount ?? 0,
        type: acc.CurrentBalance?.type || "Dr",
      },
    }));
    setCategory(accCategory); // <-- set category on account select
    // Fetch next bill number for this party
    try {
      console.log("Fetching bill number for party:", acc.Name);
      const nextBillNo = await getNextBillNumberForLensSaleOrder(acc.Name || "");
      console.log("Next bill number calculated:", nextBillNo);
      const currentFY = getFinancialYearSeries();
      setBillData((prev) => ({
        ...prev,
        billNo: String(nextBillNo),
        billSeries: prev.billSeries || currentFY,
        godown: prev.godown || "HO",
        bookedBy: prev.bookedBy || user?.name || "",
      }));
    } catch (err) {
      console.error("Error fetching next bill number:", err);
      // Don't show error to user, just leave bill number as is
    }
    setShowPartyAccSuggestions(false);
    setActiveIndex(-1);

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

  const onPartyInputKeyDown = (e) => {
    if (!showPartyAccSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = Math.min(prev + 1, filteredAccounts.length - 1);
        setTimeout(() => document.getElementById(`party-item-${next}`)?.scrollIntoView({ block: "nearest" }), 0);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        setTimeout(() => document.getElementById(`party-item-${next}`)?.scrollIntoView({ block: "nearest" }), 0);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIndex >= 0 && activeIndex < filteredAccounts.length) {
        selectAccount(filteredAccounts[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setShowPartyAccSuggestions(false);
      setActiveIndex(-1);
    }
  };

  // tax autocomplete
  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [activeTaxIndex, setActiveTaxIndex] = useState(-1);

  const filteredTaxes = taxQuery
    ? allTaxes.filter((tax) =>
      String(tax.Name || "")
        .toLowerCase()
        .includes(taxQuery.toLowerCase())
    )
    : allTaxes.slice(0, 10);

  const genTaxId = (suffix = "") =>
    `tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;

  const selectTax = (taxObj) => {
    setBillData((b) => ({ ...b, billType: taxObj.Name || "" }));
    setTaxQuery(taxObj.Name || "");
    setShowTaxSuggestions(false);
    setActiveTaxIndex(-1);

    // Build tax rows according to what's present in the selected tax object
    const newTaxes = [];

    // If local taxes exist (CGST + SGST)
    const lt1 = Number(taxObj.localTax1 || 0);
    const lt2 = Number(taxObj.localTax2 || 0);
    const ct = Number(taxObj.centralTax || 0);
    const cess = Number(taxObj.cessTax || 0);

    if (lt1 > 0 || lt2 > 0) {
      if (lt1 > 0) {
        newTaxes.push({
          id: genTaxId("_cgst"),
          taxName: "CGST",
          type: "Additive",
          percentage: String(lt1),
          amount: "0.00",
          meta: { sourceTaxId: taxObj._id },
        });
      }
      if (lt2 > 0) {
        newTaxes.push({
          id: genTaxId("_sgst"),
          taxName: "SGST",
          type: "Additive",
          percentage: String(lt2),
          amount: "0.00",
          meta: { sourceTaxId: taxObj._id },
        });
      }
    } else if (ct > 0) {
      // IGST
      newTaxes.push({
        id: genTaxId("_igst"),
        taxName: "IGST",
        type: "Additive",
        percentage: String(ct),
        amount: "0.00",
        meta: { sourceTaxId: taxObj._id },
      });
    }

    if (cess > 0) {
      newTaxes.push({
        id: genTaxId("_cess"),
        taxName: "CESS",
        type: "Additive",
        percentage: String(cess),
        amount: "0.00",
        meta: { sourceTaxId: taxObj._id },
      });
    }
    if (newTaxes.length > 0) {
      setTaxes(newTaxes);
    }
  };

  // Items / lenses autocomplete per-row
  const [itemQueries, setItemQueries] = useState({}); // { [rowIndex]: query }
  const [showItemSuggestions, setShowItemSuggestions] = useState({}); // { [rowIndex]: boolean }
  const [activeItemIndexes, setActiveItemIndexes] = useState({}); // { [rowIndex]: number }

  const [vendorQueries, setVendorQueries] = useState({});
  const [showVendorSuggestions, setShowVendorSuggestions] = useState({});
  const [activeVendorIndexes, setActiveVendorIndexes] = useState({});

  const [partyQueries, setPartyQueries] = useState({});
  const [showPartySuggestions, setShowPartySuggestions] = useState({});
  const [activePartyIndexes, setActivePartyIndexes] = useState({});

  const getFilteredLens = (index) => {
    const q = (itemQueries[index] || "").trim();
    return q
      ? allLens.filter((lens) =>
        String(lens.productName || "")
          .toLowerCase()
          .includes(q.toLowerCase())
      )
      : allLens.slice(0, 10);
  };

  const getFilteredVendors = (index) => {
    const q = (vendorQueries[index] || "").trim();
    return q
      ? accounts.filter((acc) => String(acc.Name || "").toLowerCase().includes(q.toLowerCase()))
      : accounts.slice(0, 10);
  };

  const getFilteredParties = (index) => {
    const q = (partyQueries[index] || "").trim().toLowerCase();
    
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

  const selectLens = async (lens, index) => {
    let computedPrice = 0;
    let discount = items[index].discount || "";
    const customPriceObj = customPrices[lens._id];

    // Check for offers first
    try {
      const offerRes = await getOfferForProduct(lens._id, true);
      const qty = parseFloat(items[index].qty) || 1; // Use current qty or default to 1 for new selection

      if (offerRes.success && offerRes.data && qty > offerRes.data.qty) {
        computedPrice = offerRes.data.offerPrice;
      } else {
        computedPrice = getSalePriceForCategory(lens, category);
        if (customPriceObj) {
          if (customPriceObj.percentage > 0) {
            discount = customPriceObj.percentage;
          } else if (customPriceObj.customPrice > 0) {
            computedPrice = customPriceObj.customPrice;
          }
        }
      }
    } catch (err) {
      console.error("Error checking offer:", err);
      computedPrice = getSalePriceForCategory(lens, category);
      if (customPriceObj) {
        if (customPriceObj.percentage > 0) {
          discount = customPriceObj.percentage;
        } else if (customPriceObj.customPrice > 0) {
          computedPrice = customPriceObj.customPrice;
        }
      }
    }

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        itemName: lens.productName || "",
        billItemName: lens.billItemName || "",
        vendorItemName: lens.vendorItemName || "",
        salePrice: computedPrice,
        discount: discount,
        eye: lens.eye ?? copy[index].eye ?? "",
      };

      const qty = parseFloat(copy[index].qty) || 1; // Ensure we use updated qty
      if (copy[index].qty === "") copy[index].qty = 1;

      const price = parseFloat(copy[index].salePrice) || 0;
      const disc = parseFloat(copy[index].discount) || 0;
      copy[index].totalAmount = (
        qty * price -
        qty * price * (disc / 100)
      ).toFixed(2);
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
        id: prev.length + 1,
        barcode: "",
        itemName: "",
        orderNo: "",
        eye: "",
        sph: "",
        cyl: "",
        axis: "",
        add: "",
        remark: "",
        qty: "",
        salePrice: 0,
        discount: "",
        totalAmount: "",
        sellPrice: "",
        purchasePrice: 0,
        combinationId: "",
        partyName: "",
        vendor: "",
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
        if (e.shiftKey) return; // Allow Shift+Enter for newlines in textareas if needed

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
            if (inputs[index + 1].select) {
              inputs[index + 1].select();
            }
          } else {
            // Last input in table, add new row and focus next
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
  }, []);

  const deleteItem = (id) => {
    setItems((prev) => {
      const newItems = prev.filter((it) => it.id !== id);
      return newItems;
    });
  };

  // per-row error messages { index: reason }
  const [rowErrors, setRowErrors] = useState({});

  const combinationExistsForRow = (row) => {
    // normalize function
    const normalize = (str) =>
      String(str || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

    const targetName = normalize(row.itemName);

    const lens = allLens.find((l) => normalize(l.productName) === targetName);

    if (!lens)
      return { exists: false, reason: `Product "${row.itemName}" not found` };

    // SPH/CYL/ADD are generally required for matching, but let's allow 0 for single vision
    const targetSph = Number(row.sph || 0);
    const targetCyl = Number(row.cyl || 0);
    const targetAdd = Number(row.add || 0);
    const targetAxis = Number(row.axis || 0);
    const targetEye = String(row.eye || "").trim().toUpperCase();

    const addGroups = Array.isArray(lens.addGroups) ? lens.addGroups : [];

    for (const ag of addGroups) {
      const agAddValue = Number(ag.addValue);
      if (Number.isNaN(agAddValue)) continue;

      // Tolerance-based match for float precision
      if (Math.abs(agAddValue - targetAdd) > 0.001) continue;

      const combos = Array.isArray(ag.combinations) ? ag.combinations : [];

      for (const comb of combos) {
        const combSph = Number(comb.sph);
        const combCyl = Number(comb.cyl);
        const combAxis = Number(comb.axis || 0);
        
        if (Number.isNaN(combSph) || Number.isNaN(combCyl)) continue;

        const sphMatch = Math.abs(combSph - targetSph) < 0.001;
        const cylMatch = Math.abs(combCyl - targetCyl) < 0.001;
        const axisMatch = Math.abs(combAxis - targetAxis) < 0.001;
        
        const combEyeNorm = String(comb.eye || "").toUpperCase().replace(/[\/\s]/g, "");
        const targetEyeNorm = String(row.eye || "").toUpperCase().replace(/[\/\s]/g, "");
        
        // Comprehensive eye matching
        const eyeMatch = (targetEyeNorm === "RL" || targetEyeNorm === "R/L" || targetEyeNorm === "BOTH")
            ? (combEyeNorm === "RL" || combEyeNorm === "R/L" || combEyeNorm === "BOTH" || combEyeNorm === "R" || combEyeNorm === "L" || combEyeNorm === "")
            : (combEyeNorm === targetEyeNorm || combEyeNorm === "RL" || combEyeNorm === "BOTH" || combEyeNorm === "");

        if (sphMatch && cylMatch && axisMatch && eyeMatch) {
          return {
            exists: true,
            combinationId: comb._id || comb.id,
            visionType: lens.visionType,
            initStock: comb.initStock ?? comb.stock ?? comb.available ?? 0,
            pPrice: comb.pPrice ?? lens.purchasePrice ?? 0,
            barcode: comb.barcode || "", 
            axis: comb.axis || 0, // Added to return axis
          };
        }
      }
    }

    return {
      exists: false,
      reason: "No matching power found in stock matrix",
    };
  };

  const validateRow = (index, inputRow = null) => {
    // If inputRow is provided, use it, otherwise use state (knowing state might be stale if called immediately after setItems)
    const row = inputRow || items[index];
    if (!row) {
      setRowErrors((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      return;
    }

    const res = combinationExistsForRow(row);
    
    // Set errors if not exists and either it's bifocal missing add or something else
    setRowErrors((prev) => {
      const copy = { ...prev };
      if (!res.exists) {
         copy[index] = res.reason;
         // Special case: "Add missing" only if it's supposed to be bifocal
         if (res.visionType === "bifocal" && Number(row.add || 0) === 0) {
            copy[index] = "Add missing";
         }
      } else {
         delete copy[index];
      }
      return copy;
    });

    const newComboId = res.exists ? res.combinationId || "" : "";
    const newBarcode = res.exists ? res.barcode || "" : ""; 
    const newAxis = res.exists ? (res.axis || 0) : ""; // Default axis from combination

    setItems((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      
      const current = copy[index].combinationId || "";
      const currentBarcode = copy[index].barcode || "";
      const currentAxis = copy[index].axis;

      // Only skip update if literally nothing changed. If axis is missing but found, we update.
      if (current === newComboId && currentBarcode === newBarcode && (currentAxis === newAxis || !newAxis)) return prev; 

      copy[index] = {
        ...copy[index],
        combinationId: newComboId,
        barcode: newBarcode || copy[index].barcode || "",
        axis: (currentAxis === "" || currentAxis === 0 || currentAxis == null) ? (newAxis || currentAxis) : currentAxis
      };
      return copy;
    });
  };

  const validateAllRows = () => {
    const newErrors = {};
    let itemsChanged = false;
    const newItems = items.map((r, idx) => {
      if (!r.itemName || r.itemName.trim() === "") return r;
      const res = combinationExistsForRow(r);
      if (!res.exists) {
         newErrors[idx] = res.reason;
         if (res.visionType === "bifocal" && Number(r.add || 0) === 0) {
            newErrors[idx] = "Add missing";
         }
      }

      const newComboId = res.exists ? res.combinationId || "" : "";
      if (r.combinationId !== newComboId) {
        itemsChanged = true;
        return { ...r, combinationId: newComboId, barcode: res.barcode || r.barcode || "" };
      }
      return r;
    });

    setRowErrors(newErrors);
    if (itemsChanged) setItems(newItems);

    const ok = Object.keys(newErrors).length === 0;
    return { ok, newItems };
  };

  // updateItem: synchronous update + validation
  const updateItem = async (index, field, value) => {
    let newItemObj = { ...items[index], [field]: value };

    // If itemName or qty changes, we might need to recalculate price based on offers
    if (field === "itemName" || field === "qty") {
      const itemName = field === "itemName" ? value : newItemObj.itemName;
      const qty = parseFloat(field === "qty" ? value : newItemObj.qty) || 0;

      const selectedItem = allLens.find((lens) => lens.productName === itemName);
      if (selectedItem) {
        try {
          const offerRes = await getOfferForProduct(selectedItem._id, true);
          const customPriceObj = customPrices[selectedItem._id];

          if (offerRes.success && offerRes.data && qty > offerRes.data.qty) {
            newItemObj.salePrice = offerRes.data.offerPrice;
          } else {
            let computedPrice = getSalePriceForCategory(selectedItem, category);
            if (customPriceObj) {
              if (customPriceObj.percentage > 0) {
                newItemObj.discount = customPriceObj.percentage;
              } else if (customPriceObj.customPrice > 0) {
                computedPrice = customPriceObj.customPrice;
              }
            }
            newItemObj.salePrice = computedPrice;
          }
          newItemObj.billItemName = selectedItem.billItemName || "";
          newItemObj.vendorItemName = selectedItem.vendorItemName || "";
          newItemObj.purchasePrice = selectedItem.purchasePrice ?? 0;
          newItemObj.eye = selectedItem.eye ?? newItemObj.eye ?? "";
        } catch (err) {
          console.error("Error checking offer in updateItem:", err);
        }
      }
    }

    setItems((prev) => {
      const copy = [...prev];
      const qty = parseFloat(newItemObj.qty) || 0;
      const price = parseFloat(newItemObj.salePrice) || 0;
      const disc = Number(newItemObj.discount) || 0;
      const discountAmount = qty * price * (disc / 100);
      newItemObj.totalAmount = (qty * price - discountAmount).toFixed(2);

      copy[index] = newItemObj;
      return copy;
    });

    // --- REAL-TIME STOCK & BARCODE REFRESH ---
    const powerFields = ["itemName", "sph", "cyl", "add", "axis", "eye"];
    if (powerFields.includes(field)) {
      // Validate immediately with the NEW object to avoid state lag
      validateRow(index, newItemObj);
      
      const { itemName, sph, cyl, add, axis, eye } = newItemObj;
      // Only fetch if we have enough info
      if (itemName && (sph !== "" || cyl !== "" || add !== "")) {
        const fetchStock = async () => {
          try {
            const stockRes = await getCombinationStock({
              productName: itemName,
              sph: sph,
              cyl: cyl,
              add: add,
              axis: axis,
              eye: eye
            });
            if (stockRes.success) {
              setItems(prev => {
                const copy = [...prev];
                if (copy[index]) {
                  copy[index] = { 
                    ...copy[index], 
                    avlStk: stockRes.stock,
                    barcode: stockRes.barcode || copy[index].barcode || "" // Populate barcode from backend
                  };
                }
                return copy;
              });
            }
          } catch (err) {
            console.error("Stock refresh error:", err);
          }
        };
        fetchStock();
      }
    }
  };

  const addTaxRow = () => {
    setTaxes((prev) => [
      ...prev,
      {
        id: genTaxId("_manual"),
        taxName: "",
        type: "Additive",
        percentage: "",
        amount: "0.00",
      },
    ]);
  };
  const deleteTax = (id) => setTaxes((prev) => prev.filter((t) => t.id !== id));
  const updateTax = (idx, field, value) => {
    setTaxes((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      const pct =
        parseFloat(field === "percentage" ? value : c[idx].percentage) || 0;

      const subtotal = computeSubtotal();
      const newAmountNum = (subtotal * pct) / 100;
      c[idx].amount = Number.isFinite(newAmountNum)
        ? newAmountNum.toFixed(2)
        : "0.00";

      return c;
    });
  };

  const computeSubtotal = () =>
    items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
  useEffect(() => {
    const subtotal = computeSubtotal();
    if (!Array.isArray(taxes) || taxes.length === 0) return;

    let changed = false;
    const newTaxes = taxes.map((t) => {
      const pct = parseFloat(t.percentage) || 0;
      const newAmountNum = (subtotal * pct) / 100;
      const newAmountStr = Number.isFinite(newAmountNum)
        ? newAmountNum.toFixed(2)
        : "0.00";
      if (String(t.amount || "") !== newAmountStr) changed = true;
      return { ...t, amount: newAmountStr };
    });

    if (changed) {
      setTaxes(newTaxes);
    }
  }, [items]);

  const computeTotalTaxes = () =>
    taxes.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const computeNetAmount = () => {
    const subtotal = computeSubtotal();
    const totalTaxes = computeTotalTaxes();
    return subtotal + totalTaxes;
  };
  const computeGross = () => {
    // gross = sum(qty * salePrice)
    return items.reduce((sum, it) => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.salePrice) || 0;
      return sum + qty * price;
    }, 0);
  };

  const handleSave = async () => {
    const { ok, newItems } = validateAllRows();

    if (!ok) {
      toast.error("Fix errors before saving");
      return;
    }
    const sourceItems =
      (Array.isArray(newItems) && newItems.length ? newItems : items).filter(
        (it) => it.itemName && it.itemName.trim() !== ""
      );

    if (sourceItems.length === 0) {
      toast.error("Please add at least one item before saving");
      return;
    }

    const itemsForPayload = sourceItems.map((it) => ({
      barcode: it.barcode || "",
      itemName: it.itemName || "",
      billItemName: it.billItemName || "",
      vendorItemName: it.vendorItemName || "",
      orderNo: it.orderNo || "",
      eye: it.eye || "",
      sph: Number(it.sph) || 0,
      cyl: Number(it.cyl) || 0,
      axis: it.axis || 0,
      add: Number(it.add) || 0,
      remark: it.remark || "",
      qty: Number(it.qty) || 0,
      salePrice: Number(it.salePrice) || 0,
      purchasePrice: Number(it.purchasePrice) || 0,
      discount: Number(it.discount) || 0,
      totalAmount: Number(it.totalAmount) || 0,
      sellPrice: it.sellPrice || 0,
      combinationId: it.combinationId || it.CombinationId || "",
      vendor: it.vendor || "",
      partyName: it.partyName || "",
      _id: it._id,
    }));
    console.log("payload.items ->", itemsForPayload);
    const subtotal = computeSubtotal();
    const taxesAmount = computeTotalTaxes();
    const netAmount = subtotal + taxesAmount;
    const grossAmount = computeGross();
    const paid = Number(paidAmount) || "";

    // Validate account credit limit and day limit before saving (for new orders only)
    if (!id && partyData?.partyAccount) {
      const validation = await validateAccountLimits(partyData.partyAccount, netAmount, "lens");
      
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
      items: itemsForPayload,
      taxes: taxes.map((t) => ({
        ...t,
        percentage: Number(t.percentage),
        amount: Number(t.amount),
      })),
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount: paid,
      dueAmount: Number((netAmount - paid).toFixed(2)),
      remark,
      status,
      companyId: user?.companyId // Link to tenant
    };

    // ── Stock Availability Check ──────────────────────────────────────────────
    const stockItemsToCheck = itemsForPayload
      .filter(it => it.itemName)
      .map(it => ({
        itemName: it.itemName,
        sph: it.sph,
        cyl: it.cyl,
        add: it.add,
        eye: it.eye,
        qty: it.qty,
      }));

    if (stockItemsToCheck.length > 0) {
      try {
        const stockCheck = await checkStockAvailability(stockItemsToCheck);
        if (stockCheck.success && !stockCheck.allSufficient) {
          const insufficient = stockCheck.results.filter(r => r.found && !r.sufficient);
          insufficient.forEach(r => {
            toast.error(
              `Insufficient stock for "${r.itemName}" (SPH: ${r.sph}, CYL: ${r.cyl}). Available: ${r.availableStock}, Requested: ${r.requestedQty}`,
              { duration: 6000 }
            );
          });
          return;
        }
      } catch (stockErr) {
        console.warn("Stock check failed, proceeding anyway:", stockErr);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    let res;

    if (id) {
      res = await editLensSaleOrder(id, payload);

      if (res.success) {
        toast.success("Order updated successfully!");
        try {
           const stdTaxes = new Set(['CGST', 'SGST', 'IGST', 'CESS']);
           const learnedTaxes = taxes
                .map(t => t.taxName?.trim())
                .filter(n => n && isNaN(n) && !stdTaxes.has(n.toUpperCase()));
           
           const learnedCustomers = itemsForPayload
                .map(it => it.partyName?.trim())
                .filter(n => n && isNaN(n));
                
           if(learnedTaxes.length > 0 || learnedCustomers.length > 0) {
               await learnSuggestions({ taxes: learnedTaxes, customers: learnedCustomers }).catch(console.error);
           }
        } catch (e) {}
        navigate("/lenstransaction/sale/saleorder");
      } else {
        toast.error(res.message || "Failed to update order");
      }
    } else {
      // CREATE
      res = await addLensSaleOrder(payload);

      if (res.success) {
        toast.success("Sale added successfully!");
        try {
           const stdTaxes = new Set(['CGST', 'SGST', 'IGST', 'CESS']);
           const learnedTaxes = taxes
                .map(t => t.taxName?.trim())
                .filter(n => n && isNaN(n) && !stdTaxes.has(n.toUpperCase()));
           
           const learnedCustomers = itemsForPayload
                .map(it => it.partyName?.trim())
                .filter(n => n && isNaN(n));
                
           if(learnedTaxes.length > 0 || learnedCustomers.length > 0) {
               await learnSuggestions({ taxes: learnedTaxes, customers: learnedCustomers }).catch(console.error);
           }
        } catch (e) {}
        navigate("/lenstransaction/sale/saleorder");
      } else {
        // Check for stock-specific error
        if (res.stockErrors && res.stockErrors.length > 0) {
          res.stockErrors.forEach(err => toast.error(err.message, { duration: 6000 }));
        } else {
          toast.error(res.message || "Failed to create");
        }
      }
    }
  };

  const handleReset = () => {
    setBillData({
      billSeries: "",
      billNo: "",
      date: "",
      billType: "",
      godown: "",
      bookedBy: "",
    });
    setPartyData({
      partyAccount: "",
      address: "",
      contactNumber: "",
      stateCode: "",
      creditLimit: "",
    });
    setItems([
      {
        id: 1,
        barcode: "",
        itemName: "",
        unit: "",
        dia: "",
        eye: "",
        isInvoiced: false,
        isChallaned: false,
        sph: "",
        cyl: "",
        axis: "",
        add: "",
        qty: "",
        salePrice: 0,
        discount: "",
        totalAmount: "",
        sellPrice: "",
        combinationId: "",
        vendor: "",
        avlStk: "-", // added
      },
    ]);
    setTaxes([
      {
        id: 1,
        taxName: "",
        type: "Additive",
        percentage: "2.5",
        amount: "0.00",
      },
    ]);
    setRowErrors({});
    setItemQueries({});
    setShowItemSuggestions({});
    setActiveItemIndexes({});
    setVendorQueries({});
    setShowVendorSuggestions({});
    setActiveVendorIndexes({});
    setPartyQueries({});
    setShowPartySuggestions({});
    setActivePartyIndexes({});
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

  // WHEN category or allLens changes, update existing items' salePrice where possible
  useEffect(() => {
    if (!category || !allLens || allLens.length === 0) return;
    setItems((prev) => {
      let changed = false;
      const updated = prev.map((it) => {
        if (!it.itemName) return it;
        const lens = allLens.find(
          (l) =>
            String(l.productName || "").toLowerCase() ===
            String(it.itemName || "").toLowerCase()
        );
        if (!lens) return it;
        const newPrice = getSalePriceForCategory(lens, category);
        if (Number(newPrice) !== Number(it.salePrice)) {
          changed = true;
          const qty = parseFloat(it.qty) || 0;
          const disc = Number(it.discount) || 0;
          const totalAmount = (
            qty * newPrice -
            qty * newPrice * (disc / 100)
          ).toFixed(2);
          return { ...it, salePrice: newPrice, totalAmount };
        }
        return it;
      });
      return changed ? updated : prev;
    });
  }, [category, allLens]);

  // ========== Bulk Order Handlers ==========
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

    // Extract all unique SPH, CYL, and ADD from this lens
    const sphSet = new Set();
    const cylSet = new Set();
    const addValuesSet = new Set();

    const addGroups = Array.isArray(lens.addGroups) ? lens.addGroups : [];
    addGroups.forEach(ag => {
      if (ag.addValue !== undefined) addValuesSet.add(parseFloat(ag.addValue));
      const combos = Array.isArray(ag.combinations) ? ag.combinations : [];
      combos.forEach(comb => {
        if (comb.sph !== undefined) sphSet.add(parseFloat(comb.sph));
        if (comb.cyl !== undefined) cylSet.add(parseFloat(comb.cyl));
      });
    });

    const sortedSph = Array.from(sphSet).sort((a, b) => b - a); // descending (+ to -)
    const sortedCyl = Array.from(cylSet).sort((a, b) => a - b); // ascending (0 to -)
    const sortedAdds = Array.from(addValuesSet).sort((a, b) => a - b);

    setSphValues(sortedSph);
    setCylValues(sortedCyl);
    setBulkOrderItem({
      ...item,
      itemIndex,
      availableAdds: sortedAdds,
      selectedAdd: item.add || (sortedAdds[0] !== undefined ? sortedAdds[0] : 0),
      selectedEye: item.eye || "RL"
    });
    setBulkOrderMatrix({});
    setBulkOrderModal(true);
  };

  const updateBulkOrderQuantity = (sph, cyl, qty) => {
    const key = `${sph}_${cyl}`;
    setBulkOrderMatrix(prev => ({
      ...prev,
      [key]: qty === "" ? "" : parseInt(qty)
    }));
  };

  const addBulkOrderItems = () => {
    const bulkItemsToAdd = [];
    const selectedAdd = bulkOrderItem.selectedAdd;
    const selectedEye = bulkOrderItem.selectedEye;

    Object.entries(bulkOrderMatrix).forEach(([key, qty]) => {
      if (qty && qty > 0) {
        const [sph, cyl] = key.split('_').map(v => parseFloat(v));

        // Find if this combo exists to get combinationId and stock
        const rowData = {
          itemName: bulkOrderItem.itemName,
          sph: sph.toFixed(2),
          cyl: cyl.toFixed(2),
          axis: bulkOrderItem.axis || 0,
          add: selectedAdd,
          eye: selectedEye
        };
        const res = combinationExistsForRow(rowData);

        bulkItemsToAdd.push({
          id: Date.now() + Math.random(),
          barcode: res.exists ? res.barcode || "" : "", // Get barcode from combination match
          itemName: bulkOrderItem.itemName,
          eye: selectedEye,
          sph: sph.toFixed(2),
          cyl: cyl.toFixed(2),
          axis: bulkOrderItem.axis || 0,
          add: selectedAdd,
          remark: "",
          qty: qty,
          salePrice: bulkOrderItem.salePrice || 0,
          discount: bulkOrderItem.discount || 0,
          totalAmount: (qty * (bulkOrderItem.salePrice || 0) * (1 - (Number(bulkOrderItem.discount) || 0) / 100)).toFixed(2),
          sellPrice: bulkOrderItem.sellPrice || "",
          combinationId: res.exists ? res.combinationId : "",
          partyName: bulkOrderItem.partyName || partyData.partyAccount || "",
          vendor: bulkOrderItem.vendor || "",
        });
      }
    });

    if (bulkItemsToAdd.length === 0) {
      toast.error("Please enter quantity for at least one power");
      return;
    }

    setItems(prev => {
      const filteredPrev = prev.filter(it => it.itemName || it.sph || it.cyl);
      const combined = [...filteredPrev, ...bulkItemsToAdd].map((it, idx) => ({
        ...it,
        id: idx + 1
      }));
      return combined;
    });

    toast.success(`Successfully added ${bulkItemsToAdd.length} items`);
    setBulkOrderModal(false);
    setBulkOrderItem(null);
    setBulkOrderMatrix({});
  };


  return (
    <div className="h-screen bg-slate-50 relative selection:bg-blue-100 flex flex-col overflow-hidden">
      <Header isReadOnly={isReadOnly} id={id} partyData={partyData} />
      
      <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-3 pt-3 pb-3 gap-3 overflow-hidden">
        
        {/* Top section wrapper: overflow-visible so dropdowns can escape */}
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
                   <input type="text" value={billData.billSeries} onChange={(e) => setBillData((b) => ({ ...b, billSeries: e.target.value }))} className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="EX. SO" />
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
                        <div key={tax.id ?? idx} className="px-3 py-1.5 text-[10px] font-black text-slate-600 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 uppercase" onMouseDown={() => selectTax(tax)}>{tax.Name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Godown / Store</label>
                <input type="text" value={billData.godown} onChange={(e) => setBillData((b) => ({ ...b, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="HO" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Booked By</label>
                <input type="text" value={billData.bookedBy} onChange={(e) => setBillData((b) => ({ ...b, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="Name of booking agent" />
              </div>
            </div>
          </div>

          {/* Column 2: Customer / Party Info */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Party / Account</h3>
              </div>
              <div className="flex gap-2">
                 <div className="flex flex-col items-end px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[9px] font-black text-blue-400 uppercase leading-none">Credit Limit</span>
                    <span className="text-xs font-black text-blue-700 tracking-tight leading-none mt-0.5">₹{partyData.creditLimit ? parseFloat(partyData.creditLimit).toLocaleString() : "0"}</span>
                 </div>
                 <div className="flex flex-col items-end px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[9px] font-black text-emerald-400 uppercase leading-none">Balance</span>
                    <span className="text-xs font-black text-emerald-700 tracking-tight leading-none mt-0.5">{partyData.CurrentBalance ? `${parseFloat(partyData.CurrentBalance.amount).toLocaleString()} ${partyData.CurrentBalance.type}` : "0"}</span>
                 </div>
              </div>
            </div>

            {/* Row 1: Party Search & State */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6" style={{position: 'relative', zIndex: 50}}>
                 <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">Party Account</label>
                 <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" value={partyQuery} onChange={(e) => { setPartyQuery(e.target.value); setPartyData(p => ({ ...p, partyAccount: e.target.value })); setShowPartyAccSuggestions(true); }} onFocus={() => setShowPartyAccSuggestions(true)} onBlur={() => setTimeout(() => setShowPartyAccSuggestions(false), 200)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="Search Party Account..." disabled={isReadOnly} />
                 </div>
                 {showPartyAccSuggestions && filteredAccounts.length > 0 && (
                   <div style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: '4px'}} className="bg-white border border-slate-200 shadow-2xl rounded-lg max-h-56 overflow-y-auto">
                     {filteredAccounts.map((acc, idx) => (
                       <div key={acc._id ?? idx} className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors" onMouseDown={() => selectAccount(acc)}>
                         <div className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{acc.Name}</div>
                         <div className="flex justify-between items-center mt-0.5">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{acc.AccountGroup?.Name || "NO GROUP"}</span>
                           <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${acc.CurrentBalance?.type === 'Cr' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>₹{parseFloat(acc.CurrentBalance?.amount || 0).toLocaleString()} {acc.CurrentBalance?.type}</span>
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

            {/* Row 2: Address & Contact No */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </label>
                <div className="relative">
                  <input
                    list="address-options"
                    type="text"
                    value={partyData.address || ""}
                    onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    placeholder="Select address..."
                    disabled={isReadOnly}
                  />
                  <datalist id="address-options">
                    {(partyData.allAddresses || []).map((addr, i) => (
                      <option key={i} value={addr} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Contact No
                </label>
                <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-600 h-9 flex items-center tabular-nums">
                  {partyData.contactNumber || <span className="text-slate-300 font-medium italic text-[11px]">Not available</span>}
                </div>
              </div>
            </div>
          </div>
        </div>


      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-1.5 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Order Items</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/rxtransaction/rxsale/addRxSale")} className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">
              <Plus className="w-3 h-3" /> Rx Sale
            </button>
            <button onClick={addItemRow} className="group flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm hover:shadow-md active:scale-95">
              <Plus className="w-3 h-3 transition-transform group-hover:rotate-90" /> New Row
            </button>
          </div>
        </div>

        <div ref={tableRef} className="bg-white flex flex-col flex-1 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    { l: "#", w: "w-8", align: "center" },
                    { l: "Barcode", w: "w-32" },
                    { l: "Item Description", w: "min-w-[240px]" },
                    { l: "Order#", w: "w-20" },
                    { l: "Side", w: "w-16", group: "lens" },
                    { l: "Sph", w: "w-20", group: "lens" },
                    { l: "Cyl", w: "w-20", group: "lens" },
                    { l: "Axis", w: "w-16", group: "lens" },
                    { l: "Add", w: "w-20", group: "lens" },
                    { l: "Notes", w: "w-20" },
                    { l: "Qty", w: "w-20", align: "right" },
                    { l: "Price", w: "w-24", align: "right" },
                    { l: "Disc%", w: "w-16", align: "right" },
                    { l: "Total", w: "w-28", align: "right" },
                    { l: "Vendor", w: "w-28" },
                    { l: "Customer", w: "w-32" },
                    { l: "Stk", w: "w-16", align: "right" },
                    { l: "Op", w: "w-12", align: "center" },

                  ].map((h, i) => (
                    <th key={i} className={`${h.w} py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter border-b border-slate-200 ${h.group === "lens" ? "bg-blue-50/50 text-blue-600" : "bg-slate-50"} ${h.align === "right" ? "text-right" : h.align === "center" ? "text-center" : "text-left"}`}>
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const isEditable = (item) => !isReadOnly && !item?.isInvoiced && !item?.isChallaned;
                  const rowError = rowErrors[index];
                  return (
                    <React.Fragment key={item._id ?? item.id}>
                      {(item.isInvoiced || item.isChallaned) && (
                        <tr>
                          <td colSpan={18} className="px-2 py-0 bg-slate-50">
                            <div className="flex gap-1 items-center">
                              {item.isInvoiced && <span className="text-[8px] font-black px-1 py-0 bg-yellow-100 text-yellow-800 rounded uppercase tracking-tighter">Invoiced</span>}
                              {item.isChallaned && <span className="text-[8px] font-black px-1 py-0 bg-blue-100 text-blue-800 rounded uppercase tracking-tighter">Challaned</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr onDoubleClick={() => !isReadOnly && openBulkOrderModal(item, index)} className={`group transition-colors h-10 ${rowError ? "bg-red-50/60" : "hover:bg-blue-50 focus-within:bg-blue-50/20"}`}>
                        <td className="px-1 py-0 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 group-hover:bg-transparent">{index + 1}</td>
                        <td className="px-1 py-0">
                          {isEditable(item) ? (
                            <input type="text" value={item.barcode} onChange={(e) => updateItem(index, "barcode", e.target.value)} className="w-full px-1 py-0 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-bold text-slate-700 h-7" placeholder="Barcode" />
                          ) : (
                            <span className="block px-1 py-0 text-xs font-bold text-slate-600 truncate">{item.barcode || "-"}</span>
                          )}
                        </td>
                        <td className="px-1 py-0 relative">
                          {isEditable(item) ? (
                            <div className="relative flex items-center">
                              {!itemQueries[index] && <Search className="w-2.5 h-2.5 absolute left-1 text-slate-300" />}
                              <input type="text" value={itemQueries[index] ?? item.itemName ?? ""}
                                onChange={(e) => { setItemQueries(p => ({ ...p, [index]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [index]: true })); updateItem(index, "itemName", e.target.value); }}
                                onFocus={() => setShowItemSuggestions(p => ({ ...p, [index]: true }))}
                                onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [index]: false })), 200)}
                                className={`w-full ${itemQueries[index] ? "pl-1" : "pl-4"} pr-1 py-0 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-black text-slate-800 h-7 truncate`} placeholder="Item..." />
                              {showItemSuggestions[index] && getFilteredLens(index).length > 0 && (
                                <div className="absolute top-full left-0 w-72 bg-white rounded-lg shadow-xl border border-slate-200 z-[120]">
                                  {getFilteredLens(index).map((lens, i) => (
                                    <div key={lens._id ?? i} onMouseDown={() => selectLens(lens, index)} className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 border-b border-slate-50 text-xs font-bold text-slate-700 flex justify-between uppercase">
                                      <span>{lens.productName}</span><span className="text-blue-500">Stk: {lens.stock}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="block px-1 py-0 text-xs font-black text-slate-700 truncate">{item.itemName || "-"}</span>
                          )}
                        </td>
                        <td className="px-1 py-0">
                          {isEditable(item) ? (
                            <input type="text" value={item.orderNo} onChange={(e) => updateItem(index, "orderNo", e.target.value)} className="w-full px-1 py-0 text-xs text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none h-7 uppercase font-bold" placeholder="ORD#" />
                          ) : (
                            <span className="block px-1 py-0 text-xs text-center font-bold text-slate-700">{item.orderNo || "-"}</span>
                          )}
                        </td>
                        <td className="px-0.5 py-0 bg-blue-50/20">
                          <input type="text" value={item.eye} onChange={(e) => updateItem(index, "eye", e.target.value)} className="w-full px-0.5 py-0 text-xs text-center bg-transparent border-b border-dotted border-slate-300 focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="R/L" />
                        </td>
                        <td className="px-0.5 py-0 bg-blue-50/20">
                          <input type="text" value={item.sph} onChange={(e) => updateItem(index, "sph", e.target.value)} className="w-full px-0.5 py-0 text-xs text-center bg-transparent border-b border-dotted border-slate-300 focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="+0.0" />
                        </td>
                        <td className="px-0.5 py-0 bg-blue-50/20">
                          <input type="text" value={item.cyl} onChange={(e) => updateItem(index, "cyl", e.target.value)} className="w-full px-0.5 py-0 text-xs text-center bg-transparent border-b border-dotted border-slate-300 focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="+0.0" />
                        </td>
                        <td className="px-0.5 py-0 bg-blue-50/20">
                          <input type="text" value={item.axis} onChange={(e) => updateItem(index, "axis", e.target.value)} className="w-full px-0.5 py-0 text-xs text-center bg-transparent border-b border-dotted border-slate-300 focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="0" />
                        </td>
                        <td className="px-0.5 py-0 bg-blue-50/20">
                          <input type="text" value={item.add} onChange={(e) => updateItem(index, "add", e.target.value)} className="w-full px-0.5 py-0 text-xs text-center bg-transparent border-b border-dotted border-slate-300 focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="+0.0" />
                        </td>
                        <td className="px-1 py-0">
                          <input type="text" value={item.remark} onChange={(e) => updateItem(index, "remark", e.target.value)} className="w-full px-1 py-0 text-xs text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none h-7 uppercase font-bold" placeholder="NOTE" />
                        </td>
                        <td className="px-1 py-0">
                          <input type="number" min={0} value={item.qty} onChange={(e) => updateItem(index, "qty", Number(e.target.value) || 0)} className="w-full px-1 py-0 text-xs text-right font-black text-slate-700 bg-emerald-50/30 border border-transparent focus:bg-white focus:border-emerald-500 rounded h-7 outline-none" />
                        </td>
                        <td className="px-1 py-0 relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">₹</span>
                          <input type="number" min={0} value={item.salePrice} onChange={(e) => updateItem(index, "salePrice", parseFloat(e.target.value) || 0)} className="w-full pl-3 pr-0.5 py-0 text-xs text-right bg-blue-50/20 border border-transparent focus:bg-white focus:border-blue-400 rounded h-7 outline-none font-black text-slate-700" />
                        </td>
                        <td className="px-1 py-0 relative">
                          <input type="number" min={0} value={item.discount} onChange={(e) => updateItem(index, "discount", e.target.value)} className="w-full pr-3 pl-0.5 py-0 text-xs text-right text-red-600 bg-red-50/20 border border-transparent focus:bg-white focus:border-red-400 rounded h-7 outline-none font-black" />
                          <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-red-500 font-bold text-[9px]">%</span>
                        </td>
                        <td className="px-1 py-0 relative">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">₹</span>
                          <input type="text" value={parseFloat(item.totalAmount || 0).toFixed(2)} readOnly className="w-full pl-3 pr-0.5 py-0 text-xs text-right font-black text-slate-800 bg-slate-100/30 rounded h-7 border-none outline-none" />
                        </td>
                        <td className="px-1 py-0 relative">
                          <input type="text" value={vendorQueries[index] ?? item.vendor ?? ""}
                            onChange={(e) => { setVendorQueries(p => ({ ...p, [index]: e.target.value })); setShowVendorSuggestions(p => ({ ...p, [index]: true })); updateItem(index, "vendor", e.target.value); }}
                            onFocus={() => setShowVendorSuggestions(p => ({ ...p, [index]: true }))}
                            onBlur={() => setTimeout(() => setShowVendorSuggestions(p => ({ ...p, [index]: false })), 200)}
                            className="w-full px-1 py-0 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-bold text-slate-500 h-7 uppercase truncate" placeholder="Vendor" />
                           {showVendorSuggestions[index] && getFilteredVendors(index).length > 0 && (
                             <div className="absolute top-full left-0 w-52 bg-white shadow-xl rounded-lg border border-slate-100 z-[120]">
                               {getFilteredVendors(index).map((acc, i) => (
                                 <div key={acc._id ?? i} onMouseDown={() => { updateItem(index, "vendor", acc.Name); setVendorQueries(p => ({ ...p, [index]: acc.Name })); setShowVendorSuggestions(p => ({ ...p, [index]: false })); }} className="px-3 py-1.5 cursor-pointer hover:bg-slate-50 text-xs font-black uppercase text-slate-600 border-b border-slate-50">{acc.Name}</div>
                               ))}
                             </div>
                           )}
                        </td>
                        <td className="px-1 py-0 relative">
                          <input type="text" value={partyQueries[index] ?? item.partyName ?? ""}
                            onChange={(e) => { setPartyQueries(p => ({ ...p, [index]: e.target.value })); setShowPartySuggestions(p => ({ ...p, [index]: true })); updateItem(index, "partyName", e.target.value); }}
                            onFocus={() => setShowPartySuggestions(p => ({ ...p, [index]: true }))}
                            onBlur={() => setTimeout(() => setShowPartySuggestions(p => ({ ...p, [index]: false })), 200)}
                            className="w-full px-1 py-0 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-black text-slate-500 h-7 uppercase truncate" placeholder="Customer" />
                           {showPartySuggestions[index] && getFilteredParties(index).length > 0 && (
                             <div className="absolute top-full left-0 w-52 bg-white shadow-xl rounded-lg border border-slate-100 z-[120]">
                               {getFilteredParties(index).map((acc, i) => (
                                 <div key={acc._id ?? i} onMouseDown={() => { updateItem(index, "partyName", acc.Name); setPartyQueries(p => ({ ...p, [index]: acc.Name })); setShowPartySuggestions(p => ({ ...p, [index]: false })); }} className="px-3 py-1.5 cursor-pointer hover:bg-slate-50 text-xs font-black uppercase text-slate-600 border-b border-slate-50">{acc.Name}</div>
                               ))}
                             </div>
                           )}
                        </td>
                        <td className="px-1 py-0 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${Number((item.avlStk !== undefined && item.avlStk !== "-") ? item.avlStk : getInitStockForRow(index)) > 0 ? "bg-emerald-100/50 text-emerald-700" : "bg-red-100/50 text-red-700"}`}>
                            {(item.avlStk !== undefined && item.avlStk !== "-") ? item.avlStk : getInitStockForRow(index)}
                          </span>
                        </td>
                        <td className="px-1 py-0 text-center">
                          <button onClick={() => deleteItem(item.id)} disabled={item.isInvoiced || item.isChallaned} className={`p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all ${item.isInvoiced || item.isChallaned ? "opacity-20 cursor-not-allowed" : "group-hover:opacity-100 opacity-0"}`}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                      {rowError && (
                        <tr><td colSpan={18} className="px-4 py-0 bg-red-50 text-[8px] font-bold text-red-600 uppercase tracking-tighter shadow-inner"><div className="flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> {rowError}</div></td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Bottom Panel: Taxes & Summary */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0">
          
          {/* Column 1: Taxes Detail (7/12) */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100">
               <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><Calculator className="w-4 h-4 text-blue-500" /> Tax Details</h4>
               <button onClick={addTaxRow} disabled={isReadOnly} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-blue-700 active:scale-95 disabled:opacity-50">+ Add Tax</button>
            </div>
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
               {taxes.map((t, idx) => (
                 <div key={t.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100 group">
                    <select value={t.type} onChange={(e) => updateTax(idx, "type", e.target.value)} className="w-12 text-xs font-black bg-white border border-slate-200 rounded-lg px-1 py-0 h-8 text-center outline-none">
                       <option value="Additive">+</option>
                       <option value="Subtractive">-</option>
                    </select>
                    <div className="flex-1 relative">
                       <input type="text" value={t.taxName} onChange={(e) => updateTax(idx, "taxName", e.target.value)} onFocus={() => setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: true }))} onBlur={() => setTimeout(() => setShowTaxDetailsSuggestions(prev => ({ ...prev, [idx]: false })), 200)} className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-0 h-8 outline-none uppercase focus:border-blue-400" placeholder="Tax Name" />
                       {showTaxDetailsSuggestions[idx] && (
                          <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-slate-200 z-[150] rounded-lg overflow-hidden mt-1">
                             {mergedTaxSuggestions.filter(st => String(st || "").toLowerCase().includes(String(t.taxName || "").toLowerCase())).map((st, i) => (
                                <div key={i} onMouseDown={() => updateTax(idx, "taxName", st)} className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-[10px] font-black uppercase text-slate-600 border-b border-slate-50">{st}</div>
                             ))}
                          </div>
                       )}
                    </div>
                    <div className="relative w-16">
                       <input type="text" value={t.percentage} onChange={(e) => updateTax(idx, "percentage", e.target.value)} className="w-full text-xs font-black bg-white border border-slate-200 rounded-lg px-2 py-0 pr-5 text-right h-8 outline-none focus:border-blue-400" />
                       <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                    </div>
                    <div className="relative w-24">
                       <input type="text" value={parseFloat(t.amount || 0).toFixed(2)} readOnly className="w-full text-xs font-black bg-slate-100 border border-transparent rounded-lg px-2 py-0 text-right text-slate-700 h-8" />
                    </div>
                    <button onClick={() => deleteTax(t.id)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-red-50"><X className="w-4 h-4" /></button>
                 </div>
               ))}
               {taxes.length === 0 && <div className="text-center py-4 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">No taxes applied</div>}
            </div>
          </div>

          {/* Column 2: Order Summary (5/12) */}
          <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl p-4 shadow-lg border border-slate-800 flex flex-col gap-3">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <div className="flex justify-between items-center text-xs font-bold text-slate-400"><span>Subtotal:</span><span className="text-slate-100">₹{computeSubtotal().toFixed(2)}</span></div>
                   <div className="flex justify-between items-center text-xs font-bold text-slate-400"><span>Tax Total:</span><span className="text-emerald-400">₹{computeTotalTaxes().toFixed(2)}</span></div>
                   <div className="h-px bg-slate-700 my-1"></div>
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-400 uppercase">Net:</span><span className="text-lg font-black text-white">₹{computeNetAmount().toFixed(2)}</span></div>
                </div>
                <div className="space-y-2">
                   <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Paid:</span>
                      <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-right text-xs font-black text-white outline-none focus:border-blue-500 h-8" placeholder="0.00" />
                   </div>
                   <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Due:</span>
                      <span className="text-sm font-black text-amber-400 tracking-tight">₹{(computeNetAmount() - (Number(paidAmount) || 0)).toFixed(2)}</span>
                   </div>
                   <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500 uppercase resize-none" placeholder="REMARKS..." />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-3 mt-auto">
                <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-black text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all outline-none border border-slate-700 tracking-wider"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
                <button onClick={handleSave} disabled={isReadOnly} className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-black text-xs uppercase hover:bg-blue-500 shadow-lg active:scale-95 transition-all outline-none tracking-widest disabled:bg-slate-700"><Save className="w-3.5 h-3.5" /> {id ? "Update" : "Save Order"}</button>
             </div>
          </div>
        </div>

       </div>


       {/* Bulk Order Modal - Lens Detail Matrix */}
       {bulkOrderModal && bulkOrderItem && (
         <BulkLensMatrixV2
           product={allLens.find(l => String(l.productName).toLowerCase() === String(bulkOrderItem.itemName).toLowerCase())}
           baseItem={bulkOrderItem}
           onClose={() => setBulkOrderModal(false)}
           onAddItems={(newItems) => {
             setItems(prev => {
               // Filter out empty rows, and specifically the row used to open the bulk order modal
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

 export default AddLensSaleOrder;
