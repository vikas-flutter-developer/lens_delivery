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
  addLensSale,
  getLensSale,
  editLensSale,
  getNextBillNumberForParty,
} from "../controllers/LensSale.controller";
import { getAllLensSaleChallan } from "../controllers/LensSaleChallan.controller";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { roundAmount } from "../utils/amountUtils";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";

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

function AddLensSale() {
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const [saleData, setSaleData] = useState(null);
  const [accountWisePrices, setAccountWisePrices] = useState({}); // { productId: price }
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [saleOrders, setSaleOrders] = useState([]);
  const [selectedOrdersItems, setSelectedOrdersItems] = useState({});
  const [sourceSaleId, setSourceSaleId] = useState(null);
  const [category, setCategory] = useState("");
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

  const [billData, setBillData] = useState({
    billSeries: "",
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    billType: "",
    bankAccount: "",
    godown: "",
    bookedBy: "",
  });

  // Fetch by ID -> set saleData (mapping effect will run)
  useEffect(() => {
    if (!id) return;

    const fetchById = async () => {
      const res = await getLensSale(id);
      if (res.success) {
        const data = res.data.data;
        setSaleData(data); // mapping effect will pick it up
      }
    };

    fetchById();
  }, [id]);

  // Load accounts, taxes, lenses once
  useEffect(() => {
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

    fetch();
    fetchTax();
    fetchlenses();
  }, []);

  const [partyData, setPartyData] = useState({
    partyAccount: "",
    address: "",
    contactNumber: "",
    stateCode: "",
    creditLimit: "",
    CurrentBalance: {
      amount: 0,
      type: "Dr",
    },
  });

  const [items, setItems] = useState([
    {
      id: 1,
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
    },
  ]);

  const [taxes, setTaxes] = useState([
    {
      id: 1,
      taxName: "",
      type: "Additive",
      percentage: "2.5",
      amount: "0.00",
    },
  ]);

  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("Pending");
  const isReadOnly = (status || "").toLowerCase() === "done" || (status || "").toLowerCase() === "received";

  // When saleData is loaded (from fetchById), map it to UI and set category
  useEffect(() => {
    if (!saleData) return;

    setBillData({
      billSeries: saleData.billData?.billSeries || "",
      billNo: saleData.billData?.billNo || "",
      date: safeDate(saleData.billData?.date),
      billType: saleData.billData?.billType || "",
      bankAccount: saleData.billData?.bankAccount || "",
      godown: saleData.billData?.godown || "",
      bookedBy: saleData.billData?.bookedBy || "",
    });

    // partyData (preserve shape)
    setPartyData({
      partyAccount: saleData.partyData?.partyAccount || "",
      address: saleData.partyData?.address || "",
      contactNumber: saleData.partyData?.contactNumber || "",
      stateCode: saleData.partyData?.stateCode || "",
      creditLimit: saleData.partyData?.creditLimit || 0,
      CurrentBalance: {
        amount: saleData.partyData?.CurrentBalance?.amount ?? 0,
        type: saleData.partyData?.CurrentBalance?.type || "Dr",
      },
    });

    // When party changes, fetch custom prices
    if (saleData.partyData?.partyAccount) {
      const acc = accounts.find(a => a.Name === saleData.partyData.partyAccount);
      if (acc) {
        getAccountWisePrices(acc._id, "Sale").then((res) => {
          if (res.success) {
            const pricesMap = {};
            res.data.forEach((p) => {
              const key = p.itemId || p.lensGroupId;
              pricesMap[key] = p.customPrice;
            });
            setAccountWisePrices(pricesMap);
          }
        });
      }
    }

    // items: map DB items -> UI rows. keep id as row index + 1 for UI
    const mappedItems =
      Array.isArray(saleData.items) && saleData.items.length
        ? saleData.items.map((it, i) => ({
          id: i + 1,
          barcode: it.barcode || "",
          itemName: it.itemName || "",
          orderNo: it.orderNo || "",
          eye: it.eye || "",
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
              : String((it.qty || 0) * (it.salePrice || 0) - (it.discount || 0)),
          sellPrice: it.sellPrice ?? "",
          purchasePrice: it.purchasePrice ?? 0,
          combinationId: it.combinationId || it.CombinationId || "",
          _id: it._id || undefined,
        }))
        : [
          {
            id: 1,
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
          },
        ];

    setItems(mappedItems);

    // set itemQueries so UI search shows names (optional)
    const iq = {};
    mappedItems.forEach((it, idx) => {
      iq[idx] = it.itemName || "";
    });
    setItemQueries(iq);

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
            amount: "0",
          },
        ];

    setTaxes(mappedTaxes);

    // monetary summary fields
    setRemark(saleData.remark || "");
    setStatus(saleData.status || "Pending");
    setPaidAmount(saleData.paidAmount ?? "");
  }, [saleData]);

  // autocomplete / suggestions states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  const query = (partyData.partyAccount || "").trim();
  const filteredAccounts =
    query.length > 0
      ? accounts.filter((acc) =>
        String(acc.Name || "").toLowerCase().includes(query.toLowerCase())
      )
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

    // Update party data with account details
    setPartyData((p) => ({
      ...p,
      partyAccount: acc.Name || "",
      contactNumber: acc.MobileNumber || "",
      stateCode: acc.State || "",
      address: acc.Address || "",
      creditLimit: acc.CreditLimit || "",
      CurrentBalance: {
        amount: acc.CurrentBalance?.amount ?? 0,
        type: acc.CurrentBalance?.type || "Dr",
      },
    }));
    setCategory(accCategory);

    // Fetch next bill number for this party
    try {
      const nextBillNo = await getNextBillNumberForParty(acc.Name || "");
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
    }

    setShowSuggestions(false);
    setActiveIndex(-1);
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

  // tax autocomplete
  const [taxQuery, setTaxQuery] = useState("");
  const [showTaxSuggestions, setShowTaxSuggestions] = useState(false);
  const [activeTaxIndex, setActiveTaxIndex] = useState(-1);

  const filteredTaxes = taxQuery
    ? allTaxes.filter((tax) =>
      String(tax.Name || "").toLowerCase().includes(taxQuery.toLowerCase())
    )
    : allTaxes.slice(0, 10);

  const genTaxId = (suffix = "") =>
    `tax_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;

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
        newTaxes.push({
          id: genTaxId("_cgst"),
          taxName: "CGST",
          type: "Additive",
          percentage: String(lt1),
          amount: "0",
          meta: { sourceTaxId: taxObj._id },
        });
      }
      if (lt2 > 0) {
        newTaxes.push({
          id: genTaxId("_sgst"),
          taxName: "SGST",
          type: "Additive",
          percentage: String(lt2),
          amount: "0",
          meta: { sourceTaxId: taxObj._id },
        });
      }
    } else if (ct > 0) {
      newTaxes.push({
        id: genTaxId("_igst"),
        taxName: "IGST",
        type: "Additive",
        percentage: String(ct),
        amount: "0",
        meta: { sourceTaxId: taxObj._id },
      });
    }

    if (cess > 0) {
      newTaxes.push({
        id: genTaxId("_cess"),
        taxName: "CESS",
        type: "Additive",
        percentage: String(cess),
        amount: "0",
        meta: { sourceTaxId: taxObj._id },
      });
    }
    if (newTaxes.length > 0) {
      setTaxes(newTaxes);
    }
  };

  const [itemQueries, setItemQueries] = useState({});
  const [showItemSuggestions, setShowItemSuggestions] = useState({});
  const [activeItemIndexes, setActiveItemIndexes] = useState({});

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

  const getSalePriceForItem = (item) => {
    if (!item) return 0;
    const itemId = item._id || item.id;
    if (accountWisePrices[itemId] !== undefined) {
      return accountWisePrices[itemId];
    }
    if (item.salePrice && typeof item.salePrice === "object") {
      return item.salePrice.default || 0;
    }
    return item.salePrice || 0;
  };

  const selectLens = (lens, index) => {
    setItems((prev) => {
      const copy = [...prev];
      const computedPrice = getSalePriceForItem(lens);

      copy[index] = {
        ...copy[index],
        itemName: lens.productName || "",
        salePrice: computedPrice,
        eye: lens.eye ?? copy[index].eye ?? "",
      };

      const qty = parseFloat(copy[index].qty) || 0;
      const price = parseFloat(copy[index].salePrice) || 0;
      const disc = parseFloat(copy[index].discount) || 0;
      copy[index].totalAmount = roundAmount(qty * price - qty * price * (disc / 100));
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
        e.preventDefault();
        addItemRow();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const [rowErrors, setRowErrors] = useState({});

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
      if (Number(ag.addValue) !== targetAdd) continue;
      const combos = Array.isArray(ag.combinations) ? ag.combinations : [];
      for (const comb of combos) {
        const sphMatch = Number(comb.sph) === targetSph;
        const cylMatch = Number(comb.cyl) === targetCyl;
        const combEye = String(comb.eye || "").trim().toUpperCase();
        const eyeMatch =
          targetEye === "RL"
            ? combEye === "R" || combEye === "L" || combEye === "RL"
            : combEye === targetEye;
        if (sphMatch && cylMatch && eyeMatch) {
          return { exists: true, combinationId: comb._id, initStock: comb.initStock ?? comb.stock ?? 0, pPrice: comb.pPrice ?? lens.purchasePrice ?? 0 };
        }
      }
    }

    return { exists: false, reason: "Combination not found" };
  };

  const validateRow = (index) => {
    const row = items[index];
    if (!row) return;
    const res = combinationExistsForRow(row);
    setRowErrors((prev) => {
      const copy = { ...prev };
      if (!res.exists) copy[index] = res.reason;
      else delete copy[index];
      return copy;
    });
    setItems((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      const newComboId = res.exists ? res.combinationId || "" : "";
      const newPrice = res.exists ? (res.pPrice ?? copy[index].purchasePrice) : copy[index].purchasePrice;
      copy[index] = { ...copy[index], combinationId: newComboId, purchasePrice: newPrice };
      return copy;
    });
  };

  const validateAllRows = () => {
    const newErrors = {};
    const newItems = items.map((r, idx) => {
      const res = combinationExistsForRow(r);
      if (!res.exists) newErrors[idx] = res.reason;
      return { ...r, combinationId: res.exists ? res.combinationId : "", purchasePrice: res.exists ? (res.pPrice ?? r.purchasePrice) : r.purchasePrice };
    });
    setRowErrors(newErrors);
    setItems(newItems);
    return { ok: Object.keys(newErrors).length === 0, newItems };
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === "itemName") {
        const selectedItem = allLens.find((lens) => lens.productName === value);
        if (selectedItem) {
          copy[index].salePrice = getSalePriceForItem(selectedItem);
          copy[index].purchasePrice = selectedItem.purchasePrice ?? 0;
          copy[index].eye = selectedItem.eye ?? copy[index].eye ?? "";
        }
      }
      const qty = parseFloat(copy[index].qty) || 0;
      const price = parseFloat(copy[index].salePrice) || 0;
      const disc = Number(copy[index].discount) || 0;
      copy[index].totalAmount = roundAmount(qty * price - qty * price * (disc / 100));

      // ── Real-time Stock Lookup ──────────────────────────────────────────
      // If itemName or power fields change, fetch real-time stock
      if (["itemName", "sph", "cyl", "add", "eye"].includes(field)) {
        const item = copy[index];
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
                if (updated[index]) {
                   updated[index].avlStk = res.initStock;
                }
                return updated;
              });
            }
          }).catch(err => console.error("Stock fetch error:", err));
        }
      }
      // ───────────────────────────────────────────────────────────────────

      return copy;
    });
  };

  const addTaxRow = () => {
    setTaxes((prev) => [
      ...prev,
      { id: genTaxId("_manual"), taxName: "", type: "Additive", percentage: "", amount: "0" },
    ]);
  };
  const deleteTax = (id) => setTaxes((prev) => prev.filter((t) => t.id !== id));
  const updateTax = (idx, field, value) => {
    setTaxes((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      const sub = computeSubtotal();
      const pct = parseFloat(field === "percentage" ? value : c[idx].percentage) || 0;
      c[idx].amount = roundAmount((sub * pct) / 100);
      return c;
    });
  };

  const computeSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
  const computeTotalTaxes = () => taxes.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const computeNetAmount = () => computeSubtotal() + computeTotalTaxes();
  const computeGross = () => items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.salePrice) || 0), 0);

  const handleShowChallans = async () => {
    if (!partyData.partyAccount) return toast.error("Select party first");
    try {
      const res = await getAllLensSaleChallan();
      // res might be { success: true, data: [...] } or just [...]
      const dataArr = res?.data?.data || res?.data || res || [];
      if (Array.isArray(dataArr)) {
        const pending = dataArr.filter(
          (o) =>
            o.partyData?.partyAccount === partyData.partyAccount &&
            o.balQty > 0 &&
            o.status !== "Received"
        );
        setSaleOrders(pending);
        setSelectedOrdersItems({});
        setShowOrdersModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectOrderItem = (orderId, idx) => {
    setSelectedOrdersItems(prev => ({ ...prev, [`${orderId}-${idx}`]: !prev[`${orderId}-${idx}`] }));
  };

  const handleAddOrderItems = () => {
    const existing = items.filter(it => it.itemName && it.itemName.trim() !== "");
    const newItems = [...existing];
    let isFirst = false;
    saleOrders.forEach(order => {
      if (order.items?.some((_, idx) => selectedOrdersItems[`${order._id}-${idx}`])) {
        if (!isFirst) {
          setSourceSaleId(order._id);
          setBillData({ ...order.billData, date: safeDate(order.billData?.date) });
          if (order.taxes?.length) setTaxes(order.taxes.map(t => ({ ...t, id: t._id || genTaxId("_order") })));
          isFirst = true;
        }
        order.items.forEach((it, idx) => {
          if (selectedOrdersItems[`${order._id}-${idx}`]) {
            newItems.push({ ...it, id: newItems.length + 1, _id: it._id });
          }
        });
      }
    });
    setItems(newItems);
    setShowOrdersModal(false);
  };

  const handleSave = async () => {
    const { ok, newItems } = validateAllRows();
    if (!ok) return toast.error("Fix errors");
    const sub = computeSubtotal();
    const tx = computeTotalTaxes();
    const net = sub + tx;
    const payload = {
      billData,
      partyData,
      items: newItems,
      taxes,
      grossAmount: computeGross(),
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
    const res = id ? await editLensSale(id, payload) : await addLensSale(payload);
    if (res.success) {
      toast.success("Success!");
      navigate("/lenstransaction/sale/saleinvoice");
    } else toast.error(res.message || "Failed");
  };

  const handleReset = () => window.location.reload();

  const getInitStockForRow = (index) => {
    const row = items[index];
    if (!row || !row.itemName) return "-";
    
    // Prioritize real-time avlStk
    if (row.avlStk !== undefined) return row.avlStk;

    const lens = allLens.find(l => l.productName === row.itemName);
    if (!lens) return "-";
    const ag = lens.addGroups?.find(g => Number(g.addValue) === Number(row.add));
    const comb = ag?.combinations?.find(c => Number(c.sph) === Number(row.sph) && Number(c.cyl) === Number(row.cyl) && (row.eye === "RL" ? (c.eye === "R" || c.eye === "L" || c.eye === "RL") : c.eye === row.eye));
    return comb?.stock ?? "-";
  };
  return (
    <div className="h-screen bg-slate-50 relative selection:bg-blue-100 flex flex-col overflow-hidden text-[11px]">
      <Header isReadOnly={isReadOnly} id={id} partyData={partyData} />
      
      <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-3 pt-3 pb-3 gap-3 overflow-hidden">
        
        {/* Top section wrapper: 2nd column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 bg-white rounded-xl shadow-sm border border-slate-200 flex-shrink-0" style={{overflow: 'visible'}}>
          
          {/* Column 1: Invoice Details */}
          <div className="p-4 border-r border-slate-100 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Invoice Details</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Series & No</label>
                <div className="flex gap-1.5">
                   <input type="text" value={billData.billSeries} onChange={(e) => setBillData((b) => ({ ...b, billSeries: e.target.value }))} className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="SR" />
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
                    <div className="absolute top-full left-0 w-48 bg-white border border-slate-200 shadow-2xl rounded-lg z-[300] mt-1 max-h-40 overflow-y-auto p-1">
                      {filteredTaxes.map((tax, idx) => (
                        <div key={idx} className="px-3 py-1.5 text-[10px] font-black text-slate-600 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 uppercase" onMouseDown={() => selectTax(tax)}>{tax.Name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Godown / Store</label>
                <input type="text" value={billData.godown} onChange={(e) => setBillData((b) => ({ ...b, godown: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} placeholder="HO" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-0.5">Booked By</label>
                <input type="text" value={billData.bookedBy} onChange={(e) => setBillData((b) => ({ ...b, bookedBy: e.target.value }))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} />
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
                    <span className="text-xs font-black text-emerald-700 tracking-tight leading-none mt-0.5">{partyData.CurrentBalance ? `${parseFloat(partyData.CurrentBalance.amount).toLocaleString()} ${partyData.CurrentBalance.type}` : "0 Dr"}</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6" style={{position: 'relative', zIndex: 100}}>
                 <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">Search Account</label>
                 <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" value={partyData.partyAccount} onChange={(e) => { setPartyData(p => ({ ...p, partyAccount: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-black" placeholder="Search..." disabled={isReadOnly} />
                 </div>
                 {showSuggestions && filteredAccounts.length > 0 && (
                   <div style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: '4px'}} className="bg-white border border-slate-200 shadow-2xl rounded-lg max-h-56 overflow-y-auto p-1">
                     {filteredAccounts.map((acc, idx) => (
                       <div key={idx} className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors" onMouseDown={() => selectAccount(acc)}>
                         <div className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{acc.Name}</div>
                         <div className="flex justify-between items-center mt-0.5">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{acc.MobileNumber || "NO MOBILE"}</span>
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

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-7 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </label>
                <input type="text" value={partyData.address} onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase" disabled={isReadOnly} />
              </div>
              <div className="col-span-12 sm:col-span-5 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Contact No
                </label>
                <input type="text" value={partyData.contactNumber} onChange={(e) => setPartyData(p => ({ ...p, contactNumber: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar (Minor) */}
        <div className="flex gap-2 flex-shrink-0">
           <button onClick={handleShowChallans} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-black uppercase transition-all shadow-sm active:scale-95">
              <Plus className="w-4 h-4" /> Import Sale Challan
           </button>
        </div>

        {/* Order Items Table */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                <ShoppingCart className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Order Items <span className="ml-2 text-slate-400 font-bold">[{items.length}]</span></h3>
            </div>
            <button onClick={addItemRow} className="group flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">
              <Plus className="w-3 h-3 transition-transform group-hover:rotate-90" /> New Row
            </button>
          </div>

          <div ref={tableRef} className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-8 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-center bg-slate-50">#</th>
                  <th className="w-32 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase bg-slate-50">Barcode</th>
                  <th className="min-w-[200px] py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase bg-slate-50">Description</th>
                  <th className="w-20 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-center bg-slate-50">Order</th>
                  <th className="w-16 py-1.5 px-2 text-[10px] font-black text-blue-600 uppercase text-center bg-blue-50/50">Eye</th>
                  <th className="w-20 py-1.5 px-2 text-[10px] font-black text-blue-600 uppercase text-center bg-blue-50/50">Sph</th>
                  <th className="w-20 py-1.5 px-2 text-[10px] font-black text-blue-600 uppercase text-center bg-blue-50/50">Cyl</th>
                  <th className="w-16 py-1.5 px-2 text-[10px] font-black text-blue-600 uppercase text-center bg-blue-50/50">Axis</th>
                  <th className="w-20 py-1.5 px-2 text-[10px] font-black text-blue-600 uppercase text-center bg-blue-50/50">Add</th>
                  <th className="w-24 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-center bg-slate-50">Remark</th>
                  <th className="w-16 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-right bg-slate-50">Qty</th>
                  <th className="w-24 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-right bg-slate-50">Price</th>
                  <th className="w-16 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-right bg-slate-50">Disc%</th>
                  <th className="w-24 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-right bg-slate-50">Total</th>
                  <th className="w-16 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-right bg-slate-50">Stk</th>
                  <th className="w-10 py-1.5 px-2 text-[10px] font-black text-slate-500 uppercase text-center bg-slate-50">Op</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <React.Fragment key={it.id}>
                    <tr className="hover:bg-blue-50/30 transition-colors group h-9">
                      <td className="px-2 py-0 text-[10px] font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-1 py-0">
                        <input type="text" value={it.barcode} onChange={(e) => updateItem(idx, "barcode", e.target.value)} className="w-full px-1 py-0 text-[11px] bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-bold text-slate-700 h-7" placeholder="Barcode" disabled={isReadOnly} />
                      </td>
                      <td className="px-1 py-0 relative">
                        <input type="text" value={itemQueries[idx] ?? it.itemName}
                          onChange={(e) => { setItemQueries(p => ({ ...p, [idx]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [idx]: true })); updateItem(idx, "itemName", e.target.value); }}
                          onFocus={() => setShowItemSuggestions(p => ({ ...p, [idx]: true }))}
                          onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [idx]: false })), 200)}
                          className="w-full px-1 py-0 text-[11px] bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-black text-slate-800 h-7 uppercase" placeholder="Search Item..." disabled={isReadOnly} />
                        {showItemSuggestions[idx] && getFilteredLens(idx).length > 0 && (
                          <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 shadow-xl z-[150] rounded-lg overflow-hidden mt-1 p-1">
                            {getFilteredLens(idx).map((l, i) => (
                              <div key={i} onMouseDown={() => selectLens(l, idx)} className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-[10px] font-black uppercase text-slate-600 border-b border-slate-50 last:border-0">{l.productName}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-0">
                         <input type="text" value={it.orderNo} onChange={(e) => updateItem(idx, "orderNo", e.target.value)} className="w-full px-1 py-0 text-[11px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-bold text-slate-500 h-7 uppercase" placeholder="ORD#" disabled={isReadOnly} />
                      </td>
                      <td className="px-0.5 py-0 bg-blue-50/20">
                         <input type="text" value={it.eye} onChange={(e) => updateItem(idx, "eye", e.target.value)} className="w-full px-0.5 py-0 text-[11px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="R/L" disabled={isReadOnly} />
                      </td>
                      <td className="px-0.5 py-0 bg-blue-50/20">
                         <input type="text" value={it.sph} onChange={(e) => updateItem(idx, "sph", e.target.value)} onBlur={() => validateRow(idx)} className="w-full px-0.5 py-0 text-[11px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="+0.0" disabled={isReadOnly} />
                      </td>
                      <td className="px-0.5 py-0 bg-blue-50/20">
                         <input type="text" value={it.cyl} onChange={(e) => updateItem(idx, "cyl", e.target.value)} onBlur={() => validateRow(idx)} className="w-full px-0.5 py-0 text-[11px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="+0.0" disabled={isReadOnly} />
                      </td>
                      <td className="px-0.5 py-0 bg-blue-50/20">
                         <input type="text" value={it.axis} onChange={(e) => updateItem(idx, "axis", e.target.value)} className="w-full px-0.5 py-0 text-[11px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="0" disabled={isReadOnly} />
                      </td>
                      <td className="px-0.5 py-0 bg-blue-50/20">
                         <input type="text" value={it.add} onChange={(e) => updateItem(idx, "add", e.target.value)} onBlur={() => validateRow(idx)} className="w-full px-0.5 py-0 text-[11px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-500 rounded-none outline-none font-black h-7" placeholder="+0.0" disabled={isReadOnly} />
                      </td>
                      <td className="px-1 py-0">
                         <input type="text" value={it.remark} onChange={(e) => updateItem(idx, "remark", e.target.value)} className="w-full px-1 py-0 text-[10px] text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-400 rounded outline-none font-bold text-slate-500 h-7 uppercase" placeholder="NOTE" disabled={isReadOnly} />
                      </td>
                      <td className="px-1 py-0">
                         <input type="number" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} className="w-full px-1 py-0 text-[11px] text-right font-black text-emerald-700 bg-emerald-50/30 border border-transparent focus:bg-white focus:border-emerald-500 rounded h-7 outline-none" disabled={isReadOnly} />
                      </td>
                      <td className="px-1 py-0">
                         <input type="number" value={it.salePrice} onChange={(e) => updateItem(idx, "salePrice", e.target.value)} className="w-full px-1 py-0 text-[11px] text-right font-black text-blue-700 bg-blue-50/30 border border-transparent focus:bg-white focus:border-blue-400 rounded h-7 outline-none" disabled={isReadOnly} />
                      </td>
                      <td className="px-1 py-0 relative">
                         <input type="number" value={it.discount} onChange={(e) => updateItem(idx, "discount", e.target.value)} className="w-full pr-3 py-0 text-[11px] text-right text-red-600 bg-red-50/30 border border-transparent focus:bg-white focus:border-red-400 rounded h-7 outline-none font-black" placeholder="0" disabled={isReadOnly} />
                         <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-red-500 font-bold text-[9px]">%</span>
                      </td>
                      <td className="px-1 py-0 text-right">
                         <span className="text-[11px] font-black text-slate-800 tabular-nums">₹{roundAmount(it.totalAmount)}</span>
                      </td>
                      <td className="px-1 py-0 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${Number(getInitStockForRow(idx)) > 0 ? "bg-emerald-100/50 text-emerald-700" : "bg-red-100/50 text-red-700"}`}>
                           {getInitStockForRow(idx)}
                        </span>
                      </td>
                      <td className="px-2 py-0 text-center">
                        <button onClick={() => deleteItem(it.id)} disabled={isReadOnly} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 group-hover:opacity-100 opacity-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {rowErrors[idx] && (
                      <tr><td colSpan={16} className="px-6 py-0.5 bg-red-50 text-[9px] font-bold text-red-600 uppercase tracking-tighter italic"><div className="flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> Validation: {rowErrors[idx]}</div></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section: Taxes and Totals */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0">
           {/* Taxes */}
           <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col min-h-0">
             <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
               <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><Calculator className="w-4 h-4 text-blue-500" /> Taxes & Charges</h4>
               <button onClick={addTaxRow} disabled={isReadOnly} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-blue-700 active:scale-95 disabled:opacity-50">+ Add Tax</button>
             </div>
             <div className="space-y-1.5 overflow-y-auto max-h-[140px] pr-1">
               {taxes.map((t, idx) => (
                 <div key={t.id} className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100 group">
                    <select value={t.type} onChange={(e) => updateTax(idx, "type", e.target.value)} className="w-12 text-[10px] font-black bg-white border border-slate-200 rounded-lg px-1 py-0 h-8 text-center outline-none">
                       <option>Additive</option>
                       <option>Subtractive</option>
                    </select>
                    <input type="text" value={t.taxName} onChange={(e) => updateTax(idx, "taxName", e.target.value)} className="flex-1 text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-0 h-8 outline-none uppercase focus:border-blue-400" placeholder="Tax Description" disabled={isReadOnly} />
                    <div className="relative w-16">
                       <input type="number" value={t.percentage} onChange={(e) => updateTax(idx, "percentage", e.target.value)} className="w-full text-[10px] font-black bg-white border border-slate-200 rounded-lg px-2 py-0 pr-4 text-right h-8 outline-none focus:border-blue-400" disabled={isReadOnly} />
                       <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">%</span>
                    </div>
                    <div className="w-24 px-2 py-0 h-8 bg-slate-100 border border-transparent rounded-lg flex items-center justify-end text-[10px] font-black text-slate-700">₹{roundAmount(t.amount)}</div>
                    <button onClick={() => deleteTax(t.id)} disabled={isReadOnly} className="p-1 px-2 text-slate-300 hover:text-red-500 transition-opacity group-hover:opacity-100 opacity-0 disabled:hidden"><Trash2 className="w-3.5 h-3.5" /></button>
                 </div>
               ))}
               {taxes.length === 0 && <div className="text-center py-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">No entries</div>}
             </div>
           </div>

           {/* Summary */}
           <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl p-4 shadow-lg border border-slate-800 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest"><span>Subtotal:</span><span className="text-slate-100 font-black font-mono">₹{computeSubtotal().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest"><span>Tax Total:</span><span className="text-emerald-400 font-black font-mono">₹{computeTotalTaxes().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    <div className="h-px bg-slate-800 my-1"></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Net:</span><span className="text-xl font-black text-white font-mono">₹{computeNetAmount().toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Paid:</span>
                       <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-black text-white outline-none focus:border-blue-500 h-8" placeholder="0.00" disabled={isReadOnly} />
                    </div>
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/5">
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Remaining:</span>
                       <span className="text-sm font-black text-amber-400 tabular-nums">₹{(computeNetAmount() - (Number(paidAmount) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={1} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[9px] text-slate-400 outline-none focus:border-blue-500 uppercase resize-none placeholder:text-slate-600" placeholder="REMARKS..." disabled={isReadOnly} />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-auto">
                 <button onClick={handleReset} className="flex items-center justify-center gap-2 py-2 bg-slate-800 text-slate-400 rounded-lg font-black text-[10px] uppercase hover:bg-slate-700 active:scale-95 transition-all outline-none border border-slate-700 tracking-widest"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
                 <button onClick={handleSave} disabled={isReadOnly} className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase hover:bg-blue-500 shadow-lg active:scale-95 transition-all outline-none tracking-widest disabled:bg-slate-700 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {isReadOnly ? "Locked" : (id ? "Update Sale" : "Save Invoice")}</button>
              </div>
           </div>
        </div>
      </div>

      {/* Challan Selection Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-t-8 border-emerald-500 font-sans">
            <div className="px-6 flex justify-between items-center py-4 border-b border-slate-100">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                     <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase">Import Sale Challan</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Filtering for: <span className="text-emerald-500">{partyData.partyAccount}</span></p>
                  </div>
               </div>
               <button onClick={() => setShowOrdersModal(false)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-all group">
                  <X className="w-6 h-6" />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 space-y-4">
              {saleOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                   <div className="p-4 bg-slate-50 rounded-full mb-4">
                      <Search className="w-10 h-10 text-slate-300" />
                   </div>
                   <span className="text-xs font-black text-slate-400 uppercase tracking-widest">No pending challans found</span>
                </div>
              ) : (
                saleOrders.map(order => (
                  <div key={order._id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-blue-400 transition-colors">
                    <div className="px-4 py-3 bg-slate-50/50 flex justify-between items-center border-b">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" onChange={(e) => {
                          const next = { ...selectedOrdersItems };
                          order.items?.forEach((_, i) => next[`${order._id}-${i}`] = e.target.checked);
                          setSelectedOrdersItems(next);
                        }} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                        <div>
                          <span className="text-[12px] font-black text-slate-800 uppercase">CHALLAN #{order.billData?.billNo || '000'}</span>
                          <span className="ml-3 text-[10px] font-black text-slate-400 uppercase">Date: {safeDate(order.billData?.date)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-bold text-slate-400 uppercase mr-2 tracking-widest">Amount:</span>
                         <span className="text-[12px] font-black text-emerald-600">₹{parseFloat(order.netAmount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-black">
                        <thead className="bg-slate-50 text-[9px] text-slate-400 uppercase tracking-widest border-b">
                          <tr>
                            <th className="px-4 py-2 w-12 text-center">Select</th>
                            <th className="px-3 py-2">Item Group / Name</th>
                            <th className="px-3 py-2 text-center">Eye</th>
                            <th className="px-3 py-2 text-center">Sph</th>
                            <th className="px-3 py-2 text-center">Cyl</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-4 py-2 text-right">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[10px] uppercase">
                          {order.items?.map((it, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-4 py-3 text-center">
                                <input type="checkbox" checked={selectedOrdersItems[`${order._id}-${idx}`] || false} onChange={() => handleSelectOrderItem(order._id, idx)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                              </td>
                              <td className="px-3 py-3 text-slate-700">{it.itemName}</td>
                              <td className="px-3 py-3 text-center text-blue-600 font-bold">{it.eye || "—"}</td>
                              <td className="px-3 py-3 text-center text-slate-500">{it.sph ?? "0.00"}</td>
                              <td className="px-3 py-3 text-center text-slate-500">{it.cyl ?? "0.00"}</td>
                              <td className="px-3 py-3 text-center font-black bg-emerald-50/30 text-emerald-700">{it.qty} {it.unit || 'PCS'}</td>
                              <td className="px-4 py-3 text-right text-blue-700 font-bold">₹{parseFloat(it.salePrice || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Selected: <span className="text-blue-600">{Object.values(selectedOrdersItems).filter(v => v).length} Items</span>
              </span>
              <div className="flex gap-4">
                 <button onClick={() => setShowOrdersModal(false)} className="px-5 py-2 text-[10px] font-black text-slate-400 hover:text-red-500 transition-all uppercase tracking-widest">Cancel</button>
                 <button onClick={handleAddOrderItems} disabled={!Object.values(selectedOrdersItems).some(v => v)} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[11px] tracking-widest uppercase hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-emerald-100/50">Pull Selected Items</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}

export default AddLensSale;
