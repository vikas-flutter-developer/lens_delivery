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
} from "lucide-react";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
  addRxPurchaseReturn,
  getRxPurchaseReturn,
  editRxPurchaseReturn,
  getNextBillNumberForParty,
} from "../controllers/RxPurchaseReturn.controller";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { roundAmount } from "../utils/amountUtils";

function AddRxPurchaseReturn() {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const [purchaseData, setPurchaseData] = useState(null);
  const today = new Date().toISOString().split("T")[0];

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
    godown: "",
    bookedBy: "",
  });



  useEffect(() => {
    if (!id) return;
    const fetchById = async () => {
      const res = await getRxPurchaseReturn(id);

      if (res.success) {
        const data = res.data.data;

        // fill billData
        setBillData(data.billData);
        setPartyData(data.partyData);
        setItems(data.items);
        setTaxes(data.taxes);
        setPaidAmount(data.paidAmount);
        setRemark(data.remark);
        setStatus(data.status);
        setPurchaseData(data);
      }
    };

    fetchById();
  }, [id]);

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

  const [accountWisePrices, setAccountWisePrices] = useState({}); // { productId: price }

  const [items, setItems] = useState([
    {
      id: 1,
      barcode: "",
      itemName: "",
      unit: "",
      dia: "",
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
      refId: "0",
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

  useEffect(() => {
    if (!purchaseData) return;
    const bd = purchaseData.billData || {};

    setBillData({
      billSeries: purchaseData.billData?.billSeries || "",
      billNo: purchaseData.billData?.billNo || "",
      date: safeDate(purchaseData.billData?.date),
      billType: purchaseData.billData?.billType || "",
      godown: purchaseData.billData?.godown || "",
      bookedBy: purchaseData.billData?.bookedBy || "",
    });

    // partyData (preserve shape)
    setPartyData({
      partyAccount: purchaseData.partyData?.partyAccount || "",
      address: purchaseData.partyData?.address || "",
      contactNumber: purchaseData.partyData?.contactNumber || "",
      stateCode: purchaseData.partyData?.stateCode || "",
      creditLimit: purchaseData.partyData?.creditLimit || 0,
      CurrentBalance: {
        amount: purchaseData.partyData?.CurrentBalance?.amount ?? 0,
        type: purchaseData.partyData?.CurrentBalance?.type || "Dr",
      },
    });

    // items: map DB items -> UI rows. keep id as row index + 1 for UI
    const mappedItems =
      Array.isArray(purchaseData.items) && purchaseData.items.length
        ? purchaseData.items.map((it, i) => ({
          id: i + 1,
          barcode: it.barcode || "",
          itemName: it.itemName || "",
          unit: it.unit || "",
          dia: it.dia || "",
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
            : (it.qty || 0) * (it.purchasePrice || it.salePrice || 0) -
            (it.discount || 0)
          ).toString(),
          sellPrice: it.sellPrice ?? "",
          remark: it.remark || "",
          refId: it.refId ?? 0,
          combinationId: it.combinationId || "",
          _id: it._id || undefined,
        }))
        : [
          {
            id: 1,
            barcode: "",
            itemName: "",
            unit: "",
            dia: "",
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
            refId: 0,
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
      Array.isArray(purchaseData.taxes) && purchaseData.taxes.length
        ? purchaseData.taxes.map((t) => ({
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
    setRemark(purchaseData.remark || "");
    setStatus(purchaseData.status || "Pending");
    setPaidAmount(purchaseData.paidAmount ?? "");
  }, [purchaseData]);

  // autocomplete / suggestions states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  const query = (partyData.partyAccount || "").trim();
  const filteredAccounts =
    query.length > 0
      ? accounts.filter((acc) =>
        String(acc.Name || "")
          .toLowerCase()
          .includes(query.toLowerCase())
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

  const selectAccount = (acc) => {
    setPartyData((p) => ({
      ...p,
      partyAccount: acc.Name || "",
      contactNumber: acc.MobileNumber || "",
      stateCode: acc.State || "",
      address: acc.Address || "",
      creditLimit: acc.CreditLimit || "",
      CurrentBalance: {
        amount: acc.CurrentBalance.amount,
        type: acc.CurrentBalance.type,
      },
    }));

    // Fetch account-wise custom prices (Purchase Type)
    try {
      getAccountWisePrices(acc._id, "Purchase").then((res) => {
        if (res.success) {
          const pricesMap = {};
          res.data.forEach((p) => {
            const key = p.itemId || p.lensGroupId;
            pricesMap[key] = p.customPrice;
          });
          setAccountWisePrices(pricesMap);
        } else {
          setAccountWisePrices({});
        }
      });
    } catch (err) {
      console.error("Error fetching custom prices:", err);
      setAccountWisePrices({});
    }

    setShowSuggestions(false);
    setActiveIndex(-1);

    // Fetch next bill number for this party
    try {
      getNextBillNumberForParty(acc.Name || "").then((nextNo) => {
        const currentFY = getFinancialYearSeries("RXPR ");
        setBillData((prev) => ({
          ...prev,
          billNo: prev.billNo || String(nextNo),
          billSeries: prev.billSeries || currentFY,
          godown: prev.godown || "HO",
          bookedBy: prev.bookedBy || user?.name || "",
        }));
      });
    } catch (err) {
      console.error("Error fetching next bill number:", err);
      const currentFY = getFinancialYearSeries("RXPR ");
      setBillData((prev) => ({
        ...prev,
        billSeries: prev.billSeries || currentFY,
        godown: prev.godown || "HO",
        bookedBy: prev.bookedBy || user?.name || "",
      }));
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
    // taxObj example fields: localTax1, localTax2, centralTax, cessTax, Name, _id ...
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

  // Items / lenses autocomplete per-row
  const [itemQueries, setItemQueries] = useState({}); // { [rowIndex]: query }
  const [showItemSuggestions, setShowItemSuggestions] = useState({}); // { [rowIndex]: boolean }
  const [activeItemIndexes, setActiveItemIndexes] = useState({}); // { [rowIndex]: number }

  // --- HELPER: getPriceForItem(itemOrLens) ---
  const getPriceForItem = (item) => {
    if (!item) return { purchase: 0, sale: 0 };

    // 1. Check if custom purchase price exists for this account
    const itemId = item._id || item.id;
    let purchasePrice = item.purchasePrice || 0;
    if (accountWisePrices[itemId] !== undefined) {
      purchasePrice = accountWisePrices[itemId];
    }

    let salePrice = 0;
    if (item.salePrice && typeof item.salePrice === "object") {
      salePrice = item.salePrice.default || 0;
    } else {
      salePrice = item.salePrice || 0;
    }

    return { purchase: purchasePrice, sale: salePrice };
  };

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

  const selectLens = (lens, index) => {
    // apply lens data into the row and validate
    setItems((prev) => {
      const copy = [...prev];
      const prices = getPriceForItem(lens);
      copy[index] = {
        ...copy[index],
        itemName: lens.productName || "",
        salePrice: prices.sale,
        purchasePrice: prices.purchase,
        eye: lens.eye ?? copy[index].eye ?? "",
      };
      const qty = parseFloat(copy[index].qty) || 0;
      const price =
        parseFloat(copy[index].purchasePrice || copy[index].salePrice) || 0;
      const disc = parseFloat(copy[index].discount) || 0;
      copy[index].totalAmount = (qty * price - disc).toFixed(2);
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
        unit: "",
        dia: "",
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
      },
    ]);
  };
  const tableRef = useRef(null);

  useEffect(() => {
    console.log(tableRef);
    const handleKeyDown = (e) => {
      if (
        e.key === "Enter" &&
        tableRef.current?.contains(document.activeElement)
      ) {
        e.preventDefault();
        addItemRow();
        console.log("added");
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
          return { exists: true, combinationId: comb._id };
        }
      }
    }

    return {
      exists: false,
      reason: "Combination not found for given SPH/CYL/ADD/Eye",
    };
  };

  const validateAllRows = () => {
    const newErrors = {};
    // We'll build updated items only if something changes to avoid extra re-renders
    let itemsChanged = false;
    const newItems = items.map((r, idx) => {
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

  // updateItem: synchronous update + validation
  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };

      // if user typed itemName manually, optionally lift matching lens data
      if (field === "itemName") {
        const selectedItem = allLens.find((lens) => lens.productName === value);
        if (selectedItem) {
          const prices = getPriceForItem(selectedItem);
          copy[index].salePrice = prices.sale;
          copy[index].purchasePrice = prices.purchase;
          copy[index].eye = selectedItem.eye ?? copy[index].eye ?? "";
        } else {
          // don't wipe prices if not found; set 0 to be safe
          copy[index].salePrice = copy[index].salePrice ?? 0;
          copy[index].purchasePrice = copy[index].purchasePrice ?? 0;
        }
      }

      // calculate totalAmount (based on purchasePrice by default)
      const qty = parseFloat(copy[index].qty) || 0;
      const price =
        parseFloat(copy[index].purchasePrice ?? copy[index].salePrice) || 0;
      const disc = Number(copy[index].discount) || 0;
      const discountAmount = qty * price * (disc / 100);
      copy[index].totalAmount = (qty * price - discountAmount).toFixed(2);

      return copy;
    });
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
    // gross = sum(qty * purchasePrice) WITHOUT subtracting discounts
    return items.reduce((sum, it) => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.purchasePrice ?? it.salePrice) || 0;
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
      Array.isArray(newItems) && newItems.length ? newItems : items;

    const itemsForPayload = sourceItems.map((it) => ({
      barcode: it.barcode || "",
      itemName: it.itemName || "",
      unit: it.unit || "",
      dia: it.dia || "",
      eye: it.eye || "",
      sph: Number(it.sph) || 0,
      cyl: Number(it.cyl) || 0,
      axis: it.axis || 0,
      add: Number(it.add) || 0,
      qty: Number(it.qty) || 0,
      purchasePrice: Number(it.purchasePrice) || 0,
      salePrice: Number(it.salePrice) || 0,
      discount: Number(it.discount) || 0,
      totalAmount: Number(it.totalAmount) || 0,
      sellPrice: it.sellPrice || 0,
      reamrk: it.remark || "",
      refId: it.refId || 0,
      combinationId: it.combinationId || it.CombinationId || "",
      _id: it._id,
    }));
    console.log("payload.items ->", itemsForPayload);
    const subtotal = computeSubtotal();
    const taxesAmount = computeTotalTaxes();
    const netAmount = subtotal + taxesAmount;
    const grossAmount = computeGross();
    const paid = Number(paidAmount) || "";

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
      time: purchaseData?.time || new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };

    let res;

    if (id) {
      // UPDATE
      res = await editRxPurchaseReturn(id, payload);

      if (res.success) {
        toast.success("Purchase Return updated successfully!");
        navigate("/lenstransaction/purchasereturn");
      } else {
        toast.error(res.error || "Update failed");
      }
    } else {
      // CREATE
      res = await addRxPurchaseReturn(payload);

      if (res.success) {
        toast.success("Purchase Return added successfully!");
        navigate("/lenstransaction/purchasereturn");
      } else {
        toast.error(res.message || "Failed to create");
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
        combinationId: "",
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
          // return initStock (use common fallback names)
          return (
            comb.initStock ?? comb.stock ?? comb.available ?? comb.quantity ?? 0
          );
        }
      }
    }

    return "-";
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans selection:bg-blue-100">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Eye className="w-6 h-6 text-white" />
              </div>
              Rx Purchase Return Entry
            </h1>
            <p className="text-slate-500 text-sm mt-1 ml-1">
              Return and manage inventory stock
            </p>
          </div>

          <div className="flex gap-3">
            {/* Credit Limit Box */}
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 w-40 text-right shadow-sm">
              <div className="text-xs text-slate-400 font-medium uppercase">
                Credit Limit
              </div>
              <div className="font-bold text-slate-700">
                {partyData.creditLimit
                  ? `₹ ${parseFloat(partyData.creditLimit).toFixed(2)}`
                  : "00.00"}
              </div>
            </div>

            {/* Account Balance Box */}
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 w-40 text-right shadow-sm">
              <div className="text-xs text-slate-400 font-medium uppercase">
                Account Balance
              </div>
              <div className="font-bold text-slate-700">
                {console.log()}
                {partyData.CurrentBalance
                  ? `₹ ${roundAmount(partyData.CurrentBalance.amount)} ${partyData.CurrentBalance.type}`
                  : "₹ 0 Dr"}
              </div>
            </div>
          </div>
        </div>

        {/* Forms grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Invoice */}
          <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-700">Invoice Details</h3>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Bill Series */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Bill Series
                </label>
                <input
                  type="text"
                  value={billData.billSeries}
                  onChange={(e) =>
                    setBillData((b) => ({ ...b, billSeries: e.target.value }))
                  }
                  placeholder="Ex. PUR"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {/* Bill No */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Bill No
                </label>
                <input
                  type="text"
                  value={billData.billNo}
                  onChange={(e) =>
                    setBillData((b) => ({ ...b, billNo: e.target.value }))
                  }
                  placeholder="00001"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={safeDate(billData.date)}
                  onChange={(e) =>
                    setBillData((b) => ({ ...b, date: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {/* Bill Type / Tax Input */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Bill Type
                </label>
                <input
                  type="text"
                  value={billData.billType}
                  onChange={(e) => {
                    setTaxQuery(e.target.value);
                    setBillData((b) => ({ ...b, billType: e.target.value }));
                  }}
                  onFocus={() => setShowTaxSuggestions(true)}
                  onKeyDown={handleTaxInputKeyDown}
                  placeholder="Credit/Cash or select Tax"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
                {showTaxSuggestions && filteredTaxes.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow rounded z-10 max-h-48 overflow-y-auto">
                    {filteredTaxes.map((tax, idx) => (
                      <div
                        key={tax.id ?? idx}
                        className={`p-2 cursor-pointer ${activeTaxIndex === idx ? "bg-slate-200" : ""
                          }`}
                        onMouseDown={() => selectTax(tax)}
                      >
                        {tax.Name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Godown */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Godown
                </label>
                <input
                  type="text"
                  value={billData.godown}
                  onChange={(e) =>
                    setBillData((b) => ({ ...b, godown: e.target.value }))
                  }
                  placeholder="Main Store"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              {/* Booked By */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Booked By
                </label>
                <input
                  type="text"
                  value={billData.bookedBy}
                  onChange={(e) =>
                    setBillData((b) => ({ ...b, bookedBy: e.target.value }))
                  }
                  placeholder="User ID"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Party */}
          <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-slate-700">Supplier / Party</h3>
            </div>

            <div className="p-5 flex-1 space-y-4">
              <div ref={containerRef} className="relative">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  Party Account
                </label>
                <input
                  type="text"
                  value={partyData.partyAccount}
                  onChange={(e) => {
                    setPartyData((p) => ({
                      ...p,
                      partyAccount: e.target.value,
                    }));
                    setShowSuggestions(true);
                    setActiveIndex(-1);
                  }}
                  onFocus={() => {
                    setShowSuggestions(true);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={onPartyInputKeyDown}
                  placeholder="Search Supplier..."
                  autoComplete="off"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />

                {showSuggestions && filteredAccounts.length > 0 && (
                  <ul className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                    {filteredAccounts.map((acc, idx) => (
                      <li
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectAccount(acc);
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`px-3 py-2 cursor-pointer text-sm ${idx === activeIndex
                          ? "bg-blue-50 text-slate-900"
                          : "hover:bg-slate-50 text-slate-700"
                          }`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="font-medium">{acc.Name || "-"}</div>
                          <div className="text-xs text-slate-400">
                            {acc.MobileNumber || ""}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {acc.Address ? String(acc.Address).slice(0, 80) : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Contact
                  </label>
                  <input
                    type="text"
                    value={partyData.contactNumber}
                    onChange={(e) =>
                      setPartyData((p) => ({
                        ...p,
                        contactNumber: e.target.value,
                      }))
                    }
                    placeholder="+91..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> State
                  </label>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                    {partyData.stateCode || ""}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Address
                </label>
                <input
                  type="text"
                  value={partyData.address}
                  onChange={(e) =>
                    setPartyData((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Full billing address"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-3 p-1">
          {[
            // { label: "Particular", color: "bg-blue-600", icon: ShoppingCart },
            { label: "Add Order", color: "bg-emerald-600", icon: Plus },
            // { label: "Add CHLN", color: "bg-purple-600", icon: Plus },
            { label: "Add RxOrder", color: "bg-orange-600", icon: Plus },
            // { label: "Add SaleLens", color: "bg-teal-600", icon: Plus },
          ].map((action, idx) => (
            <button
              key={idx}
              className={`inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold uppercase rounded-lg ${action.color}`}
            >
              <action.icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          ))}
        </div>

        {/* Items Table Section */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col min-h-[400px]">
          {/* Table Header Controls */}
          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Item Details</h3>
                <p className="text-xs text-slate-500">
                  {items.length} items added
                </p>
              </div>
            </div>
            <button
              onClick={addItemRow}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              Add New Row
            </button>
          </div>

          {/* Scrollable Table Area */}
          <div ref={tableRef} tabIndex={0} className="flex-1 overflow-auto pb-10">
            <table className="min-w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  {[
                    { l: "#", w: "w-10", align: "center" },
                    { l: "Barcode", w: "w-32" },
                    { l: "Item Description", w: "min-w-[220px]" },
                    { l: "Unit", w: "w-16" },
                    { l: "Dia", w: "w-14" },
                    { l: "Eye", w: "w-14", group: "lens" },
                    { l: "Sph", w: "w-14", group: "lens" },
                    { l: "Cyl", w: "w-14", group: "lens" },
                    { l: "Axis", w: "w-14", group: "lens" },
                    { l: "Add", w: "w-14", group: "lens" },
                    { l: "Qty", w: "w-16", align: "right" },
                    { l: "Price", w: "w-20", align: "right" },
                    { l: "Disc%", w: "w-16", align: "right" },
                    { l: "Total", w: "w-24", align: "right" },
                    { l: "S.Price", w: "w-20", align: "right" },
                    { l: "Remark", w: "min-w-[140px]", align: "center" },
                    ,
                    { l: "", w: "w-10" },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={`${h.w
                        } py-3 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 
              ${h.group === "lens"
                          ? "bg-blue-50/50 text-blue-600"
                          : "bg-slate-50"
                        }
              ${h.align === "right"
                          ? "text-right"
                          : h.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const rowError = rowErrors[index];
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`group transition-colors duration-150 relative ${rowError
                          ? "bg-red-50/60"
                          : "hover:bg-slate-50 focus-within:bg-blue-50/20"
                          }`}
                      >
                        {/* Index */}
                        <td className="px-2 py-2 text-center text-xs font-medium text-slate-400 bg-slate-50/50 group-hover:bg-transparent">
                          {index + 1}
                        </td>

                        {/* Barcode */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={item.barcode}
                            onChange={(e) =>
                              updateItem(index, "barcode", e.target.value)
                            }
                            className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded transition-all outline-none font-medium text-slate-700"
                            placeholder="Scan..."
                          />
                        </td>

                        {/* Item Name with ENHANCED DROPDOWN */}
                        <td className="p-1 relative">
                          <div className="relative">
                            <Search
                              className={`w-3 h-3 absolute left-2 top-2.5 text-slate-400 ${itemQueries[index] ? "hidden" : "block"
                                }`}
                            />
                            <input
                              type="text"
                              value={itemQueries[index] ?? item.itemName ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemQueries((prev) => ({
                                  ...prev,
                                  [index]: val,
                                }));
                                setShowItemSuggestions((prev) => ({
                                  ...prev,
                                  [index]: true,
                                }));
                                updateItem(index, "itemName", val);
                              }}
                              onFocus={() =>
                                setShowItemSuggestions((prev) => ({
                                  ...prev,
                                  [index]: true,
                                }))
                              }
                              onBlur={() =>
                                setTimeout(
                                  () =>
                                    setShowItemSuggestions((prev) => ({
                                      ...prev,
                                      [index]: false,
                                    })),
                                  200
                                )
                              }
                              className={`w-full ${itemQueries[index] ? "pl-2" : "pl-7"
                                } pr-2 py-1.5 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded transition-all outline-none font-medium text-slate-800 placeholder:text-slate-400`}
                              placeholder="Search Item..."
                            />

                            {/* Modern Dropdown */}
                            {showItemSuggestions[index] &&
                              getFilteredLens(index).length > 0 && (
                                <div className="absolute top-[calc(100%+4px)] left-0 w-[300px] bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                  <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    Suggestions
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto">
                                    {getFilteredLens(index).map((lens, i) => (
                                      <div
                                        key={lens._id ?? i}
                                        onMouseDown={() =>
                                          selectLens(lens, index)
                                        }
                                        className={`px-3 py-2 cursor-pointer flex flex-col gap-0.5 border-b border-slate-50 last:border-0 ${activeItemIndexes[index] === i
                                          ? "bg-blue-50"
                                          : "hover:bg-slate-50"
                                          }`}
                                      >
                                        <span className="text-sm font-medium text-slate-700">
                                          {lens.productName}
                                        </span>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                          <span className="bg-slate-100 px-1.5 rounded">
                                            Stock: {lens.stock || 0}
                                          </span>
                                          <span>MRP: {lens.mrp}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(index, "unit", e.target.value)
                            }
                            className="w-full px-2 py-1.5 text-xs text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded outline-none"
                          />
                        </td>

                        {/* Dia */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={item.dia}
                            onChange={(e) =>
                              updateItem(index, "dia", e.target.value)
                            }
                            className="w-full px-2 py-1.5 text-xs text-center bg-transparent border border-transparent focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded outline-none"
                          />
                        </td>

                        {/* LENS POWER GROUP (Subtle Blue Background) */}
                        <td className="p-1 bg-blue-50/20 border-l border-blue-100/50">
                          <span className="w-full bg-transparent text-xs p-1 outline-none ml-2 text-center font-medium text-slate-600 appearance-none">
                            {item.eye}
                          </span>
                        </td>
                        <td className="p-1 bg-blue-50/20">
                          <input
                            type="text"
                            placeholder="+0.00"
                            value={item.sph}
                            onChange={(e) =>
                              updateItem(index, "sph", e.target.value)
                            }
                            className="w-full px-1 py-1.5 text-xs text-center font-mono bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:bg-white rounded-none outline-none"
                          />
                        </td>
                        <td className="p-1 bg-blue-50/20">
                          <input
                            type="text"
                            placeholder="-0.00"
                            value={item.cyl}
                            onChange={(e) =>
                              updateItem(index, "cyl", e.target.value)
                            }
                            className="w-full px-1 py-1.5 text-xs text-center font-mono bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:bg-white rounded-none outline-none"
                          />
                        </td>
                        <td className="p-1 bg-blue-50/20">
                          <input
                            type="text"
                            placeholder="0"
                            value={item.axis}
                            onChange={(e) =>
                              updateItem(index, "axis", e.target.value)
                            }
                            className="w-full px-1 py-1.5 text-xs text-center font-mono bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:bg-white rounded-none outline-none"
                          />
                        </td>
                        <td className="p-1 bg-blue-50/20 border-r border-blue-100/50">
                          <input
                            type="text"
                            placeholder="+0.00"
                            value={item.add}
                            onChange={(e) =>
                              updateItem(index, "add", e.target.value)
                            }
                            className="w-full px-1 py-1.5 text-xs text-center font-mono bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:bg-white rounded-none outline-none"
                          />
                        </td>

                        {/* Qty (Bold for emphasis) */}
                        <td className="p-1">
                          <input
                            type="number"
                            min={0}
                            value={item.qty}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (Number(val) < 0) val = "0";
                              updateItem(index, "qty", val);
                            }}
                            className="w-full px-2 py-1.5 text-xs text-right font-bold text-slate-700 bg-emerald-50/50 border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded outline-none"
                          />
                        </td>

                        {/* Price */}
                        <td className="p-1">
                          <span className=" text-center ml-3 px-2 py-1.5 text-xs bg-transparent border border-transparent focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded outline-none">
                            {roundAmount(item.purchasePrice)}
                          </span>
                        </td>

                        {/* Disc */}
                        <td className="p-1">
                          <input
                            type="number"
                            min={0}
                            value={item.discount}
                            onChange={(e) => {
                              let val = e.target.value;
                              // forbid negative values
                              if (Number(val) < 0) val = "0";
                              updateItem(index, "discount", val);
                            }}
                            className="w-full px-2 py-1.5 text-xs text-right text-red-500 bg-transparent border border-transparent focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded outline-none"
                          />
                        </td>

                        {/* Total (Read Only - Grey background) */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={roundAmount(item.totalAmount)}
                            readOnly
                            className="w-full px-2 py-1.5 text-xs text-right font-bold text-slate-800 bg-slate-100 rounded border-none"
                          />
                        </td>

                        {/* Sale Price */}
                        <td className="p-1 text-right text-xs text-slate-500 px-3">
                          {roundAmount(item.salePrice)}
                        </td>

                        <td className="p-1">
                          <input
                            type="text"
                            value={item.remark ?? ""}
                            onChange={(e) =>
                              updateItem(index, "remark", e.target.value)
                            }
                            placeholder="Remark"
                            className="
      w-full px-2 py-1.5 text-xs bg-white
      border border-slate-200 rounded-md
      focus:border-blue-500 focus:ring-2 focus:ring-blue-100
      outline-none transition-all
      text-slate-700
    "
                          />
                        </td>
                        {/* Delete Action */}
                        <td className="p-1 text-center">
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remove Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Error Row */}
                      {rowError && (
                        <tr>
                          <td
                            colSpan={16}
                            className="px-4 py-1.5 bg-red-50 border-b border-red-100"
                          >
                            <div className="flex items-center gap-2 text-xs font-medium text-red-600">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {rowError}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Empty State */}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50/30">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-medium text-slate-500">No items added yet</p>
                <p className="text-sm mb-4">
                  Start by searching for a lens or scanning a barcode
                </p>
                <button
                  onClick={addItemRow}
                  className="text-sm text-blue-600 font-semibold hover:underline"
                >
                  Add First Item
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <Calculator className="w-4 h-4 text-orange-500" /> Taxes &
                Charges
              </div>
              <button
                onClick={addTaxRow}
                className="text-xs font-medium text-emerald-600"
              >
                + Add Charge
              </button>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 font-medium uppercase tracking-wide border-b border-slate-200">
                    <th className="pb-2 font-medium">Charge Name</th>
                    <th className="pb-2 font-medium w-32">Type</th>
                    <th className="pb-2 font-medium w-24">%</th>
                    <th className="pb-2 font-medium w-32">Amount</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>

                <tbody>
                  {taxes.map((tax, idx) => (
                    <tr
                      key={tax.id}
                      className="group border-b border-slate-100 last:border-0"
                    >
                      <td className="pr-2 py-2">
                        <input
                          type="text"
                          value={tax.taxName}
                          onChange={(e) =>
                            updateTax(idx, "taxName", e.target.value)
                          }
                          placeholder="Ex. GST 18%"
                          className="w-full px-3 py-2 text-sm border rounded"
                        />
                      </td>
                      <td className="pr-2 py-2">
                        <select
                          value={tax.type}
                          onChange={(e) =>
                            updateTax(idx, "type", e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm border rounded bg-white"
                        >
                          <option>Additive</option>
                          <option>Subtractive</option>
                        </select>
                      </td>
                      <td className="pr-2 py-2">
                        <input
                          type="number"
                          min={0}
                          value={tax.percentage}
                          onChange={(e) =>
                            updateTax(idx, "percentage", e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm border rounded text-right"
                        />
                      </td>
                      <td className="pr-2 py-2">
                        <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm text-right font-medium text-slate-700 border border-slate-200">
                          {roundAmount(tax.amount || "0.00")}
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        <button
                          onClick={() => deleteTax(tax.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
            {/* Summary Header */}
            <div className="p-6 border-b border-slate-100 flex-1 flex flex-col justify-center">
              <div className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-1">
                Net Amount
              </div>

              <div className="text-4xl font-bold text-slate-800 flex items-baseline gap-1">
                <span className="text-2xl font-normal text-slate-500">₹</span>
                {roundAmount(computeNetAmount())}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                {/* Subtotal */}
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Sub Total</span>
                  <span className="font-medium text-slate-700">
                    {roundAmount(computeSubtotal())}
                  </span>
                </div>

                {/* Total Taxes */}
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Total Taxes</span>
                  <span className="font-medium text-emerald-600">
                    + {roundAmount(computeTotalTaxes())}
                  </span>
                </div>
              </div>
            </div>

            {/* Paid Amount Section */}
            <div className="p-6 flex items-center gap-4">
              <label className="text-sm text-slate-600">Paid Amount</label>
              <input
                type="number"
                min={0}
                max={computeNetAmount()}
                step="0.01"
                value={paidAmount}
                onChange={(e) => {
                  let val = e.target.value;
                  if (Number(val) < 0) val = "0";
                  const net = computeNetAmount();
                  if (Number(val) > net) val = net;
                  setPaidAmount(val);
                }}
                placeholder="0.00"
                className="w-36 px-3 py-2 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="text-sm text-slate-500">
                Due: ₹{" "}
                {roundAmount(computeNetAmount() - (Number(paidAmount) || 0))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-3">
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>

              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg"
              >
                <Save className="w-4 h-4" />
                {id ? "Update" : "Save"}
              </button>
            </div>
          </div>

          <div className="w-full p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex gap-2 flex-col">
              {/* Remarks */}
              <div className="flex flex-col w-full">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter remarks..."
                  className="border rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                />
              </div>

              {/* Status */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value || "Pending")}
                  className="border w-35 rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
                >
                  <option value="">Pending</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Received">Received</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddRxPurchaseReturn;
