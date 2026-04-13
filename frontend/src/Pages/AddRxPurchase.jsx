import React, { useEffect, useRef, useState, useContext } from "react";
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
  Lock,
  ArrowRightLeft,
  Copy,
} from "lucide-react";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllTaxCategories } from "../controllers/TaxCategoryController";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
  addRxPurchaseOrder,
  getRxPurchaseOrder,
  editRxPurchaseOrder,
  getNextBillNumberForRxPurchaseOrder,
} from "../controllers/RxPurchaseOrder.controller";
import { getAllVendors } from "../controllers/RxPurchase.controller";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import { getAccountWisePrices } from "../controllers/AccountWisePriceController";
import { getFinancialYearSeries } from "../utils/billingUtils";
import { Mail } from "lucide-react";

const Header = () => (
  <header className="flex flex-shrink-0 items-center justify-between px-3 py-1.5 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-[100]">
    <div className="flex items-center gap-2.5">
      <div className="p-1.5 bg-indigo-600 rounded-md shadow-md shadow-indigo-100">
        <ShoppingCart className="w-4 h-4 text-white" />
      </div>
      <div>
        <h1 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          Lens Purchase Entry (RX)
          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] rounded-full border border-indigo-100 uppercase tracking-widest">RX-PUR</span>
        </h1>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">Management System v2.0</p>
      </div>
    </div>
  </header>
);
function AddRxPurchase() {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [allTaxes, setAllTaxes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [allLens, setAllLens] = useState([]);
  const [paidAmount, setPaidAmount] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [purchaseData, setPurchaseData] = useState(null);
  const today = new Date().toISOString().split("T")[0];
  const [sourceSaleId, setSourceSaleId] = useState(null);
  const [accountWisePrices, setAccountWisePrices] = useState({}); // { productId: price }
  const isReadOnly = purchaseData?.status === "Completed" || purchaseData?.status === "Locked";

  const roundAmount = (num) => {
    if (!num) return 0;
    return Math.round(Number(num) * 100) / 100;
  };
 
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
      const res = await getRxPurchaseOrder(id);
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

    const fetchVendors = async () => {
      try {
        const res = await getAllVendors();
        const dataArr = res?.data ?? res;
        console.log(dataArr);
        setVendors(Array.isArray(dataArr) ? dataArr : []);
      } catch (err) {
        console.log("getAllLensPower failed", err);
        setAllLens([]);
      }
    };

    fetch();
    fetchTax();
    fetchlenses();
    fetchVendors();
  }, []);

  // Handle location state pre-filling (from SaleOrder)
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
    if (data.sourceSaleId) setSourceSaleId(data.sourceSaleId);

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
        unit: it.unit || "PCS",
        orderNo: it.orderNo || "",
        dia: it.dia || "",
        eye: it.eye || "",
        sph: it.sph ?? "",
        cyl: it.cyl ?? "",
        axis: it.axis ?? "",
        add: it.add ?? "",
        qty: qty,
        purchasePrice: purchasePrice,
        salePrice: it.salePrice || lens?.salePrice?.default || 0,
        discount: 0,
        totalAmount: roundAmount(qty * purchasePrice).toString(),
        sellPrice: it.salePrice || lens?.salePrice?.default || "",
        remark: "",
        vendor: data.vendor || "",
        refId: "0"
      };
    });

    setItems(mappedItems);
    const iq = {};
    mappedItems.forEach((it, i) => iq[i] = it.itemName || "");
    setItemQueries(iq);

    initializedRef.current = true;
    toast.success("Pre-filled from Sale Order");

  }, [location.state, allLens, accounts]);

  // Handle reorder pre-filling (legacy)
  useEffect(() => {
    if (id || initializedRef.current) return;

    const data = localStorage.getItem('reorderItem');
    if (data) {
      try {
        const item = JSON.parse(data);
        // Only trigger if it's NOT a lens type (since this is AddRxPurchase)
        if (item.type !== 'Lens') {
          setItems([{
            id: 1,
            barcode: item.barcode || "",
            itemName: item.productName || "",
            unit: item.unit || "PCS",
            dia: item.dia || "",
            eye: item.eye || "",
            sph: item.sph ?? "",
            cyl: item.cyl ?? "",
            axis: item.axis ?? "",
            add: item.add ?? "",
            qty: 1,
            orderNo: "",
            purchasePrice: item.pPrice || 0,
            salePrice: item.sPrice || 0,
            discount: 0,
            totalAmount: (item.pPrice || 0).toString(),
            sellPrice: item.sPrice || "",
            remark: "",
            vendor: "",
            refId: "0",
          }]);
          setItemQueries({ 0: item.productName || "" });
          toast.success(`Pre-filled reorder for ${item.productName}`);
        }
      } catch (err) {
        console.error("Failed to parse reorder data", err);
      } finally {
        localStorage.removeItem('reorderItem');
      }
    }
  }, [id]);

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
      unit: "",
      orderNo: "",
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
      vendor: "",
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
      billSeries: data.billData?.billSeries || "",
      billNo: data.billData?.billNo || "",
      date: safeDate(data.billData?.date),
      billType: data.billData?.billType || "",
      godown: data.billData?.godown || "",
      bookedBy: data.billData?.bookedBy || "",
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
          orderNo: it.orderNo || "",
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
          totalAmount: roundAmount(typeof it.totalAmount !== "undefined"
            ? it.totalAmount
            : (it.qty || 0) * (it.purchasePrice || it.salePrice || 0) -
            (it.discount || 0)
          ).toString(),
          sellPrice: it.sellPrice ?? "",
          remark: it.remark || "",
          vendor: it.vendor || null,
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
            orderNo: "",
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
            vendor: null,
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

    // Fetch account-wise custom prices
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

    // Fetch next bill number
    try {
      getNextBillNumberForRxPurchaseOrder(acc.Name).then((nextNo) => {
        const currentFY = getFinancialYearSeries("RXP");
        setBillData((b) => ({
          ...b,
          billNo: b.billNo || String(nextNo),
          billSeries: b.billSeries || currentFY,
          godown: b.godown || "HO",
          bookedBy: b.bookedBy || user?.name || "",
          date: safeDate(b.date),
        }));
      }).catch(err => {
        console.error("Error fetching bill number:", err);
        const currentFY = getFinancialYearSeries("RXP");
        setBillData((b) => ({
          ...b,
          billSeries: b.billSeries || currentFY,
          godown: b.godown || "HO",
          bookedBy: b.bookedBy || user?.name || "",
        }));
      });
    } catch (e) {
      console.error(e);
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
      copy[index].totalAmount = roundAmount(qty * price - disc).toString();
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
      copy[index].totalAmount = roundAmount(qty * price - discountAmount).toString();

      return copy;
    });
  };

  const [vendorQueries, setVendorQueries] = useState({});
  const [showVendorSuggestions, setShowVendorSuggestions] = useState({});
  const [activeVendorIndexes, setActiveVendorIndexes] = useState({});
  const vendorInputRefs = useRef({});

  const getFilteredVendors = (index) => {
    const q = (vendorQueries[index] || "").toLowerCase().trim();
    if (!q) return vendors.slice(0, 10);

    return vendors.filter((v) => (v.name || "").toLowerCase().includes(q));
  };
  const vendorContainerRefs = useRef({});

  // when user selects a vendor
  const selectVendor = (vendor, index) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            vendor: vendor._id,
            vendorName: vendor.name,
          }
          : item
      )
    );

    setVendorQueries((prev) => ({ ...prev, [index]: vendor.name }));
    setShowVendorSuggestions((prev) => ({ ...prev, [index]: false }));
    setActiveVendorIndexes((prev) => ({ ...prev, [index]: -1 }));
  };

  // OUTSIDE CLICK CLOSE
  useEffect(() => {
    function handleOutside(e) {
      let clickedInsideAny = false;

      Object.values(vendorContainerRefs.current).forEach((ref) => {
        if (ref && ref.contains(e.target)) {
          clickedInsideAny = true;
        }
      });

      if (!clickedInsideAny) {
        setShowVendorSuggestions({});
        setActiveVendorIndexes({});
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // KEYBOARD HANDLING per-row
  const onVendorInputKeyDown = (e, index) => {
    const filtered = getFilteredVendors(index);

    if (!showVendorSuggestions[index]) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveVendorIndexes((prev) => ({
        ...prev,
        [index]: Math.min((prev[index] || 0) + 1, filtered.length - 1),
      }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveVendorIndexes((prev) => ({
        ...prev,
        [index]: Math.max((prev[index] || 0) - 1, 0),
      }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = activeVendorIndexes[index];
      if (active >= 0 && active < filtered.length) {
        selectVendor(filtered[active], index);
      }
    } else if (e.key === "Escape") {
      setShowVendorSuggestions((prev) => ({ ...prev, [index]: false }));
      setActiveVendorIndexes((prev) => ({ ...prev, [index]: -1 }));
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
      c[idx].amount = roundAmount(newAmountNum).toString();

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
      const newAmountStr = roundAmount(newAmountNum).toString();
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
      vendor: it.vendor || null,
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
      sourceSaleId,
    };

    let res;

    if (id) {
      // UPDATE
      res = await editRxPurchaseOrder(id, payload);

      if (res.success) {
        toast.success("Purchase Order updated successfully!");
        navigate("/lenstransaction/purchase/purchaseorder?type=rx");
      } else {
        toast.error(res.error || "Update failed");
      }
    } else {
      // CREATE
      res = await addRxPurchaseOrder(payload);

      if (res.success) {
        toast.success("Purchase Order added successfully!");
        navigate("/lenstransaction/purchase/purchaseorder?type=rx");
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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-black">
      <Header />

      <div className="flex-1 overflow-hidden p-1 space-y-2 flex flex-col min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-shrink-0">
          {/* Order Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Order Details</h3>
              </div>
              <div className="flex gap-2">
                 <div className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase">{billData.billSeries || "SERIES"}-{billData.billNo || "000"}</div>
                 <div className="px-2 py-1 bg-blue-50 rounded text-[10px] font-black text-blue-600 uppercase tracking-tighter">{safeDate(billData.date)}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Bill Series</label>
                <input type="text" value={billData.billSeries || ""} onChange={(e) => setBillData(b => ({ ...b, billSeries: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="SERIES" disabled={isReadOnly} />
              </div>
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Bill No</label>
                <input type="text" value={billData.billNo || ""} onChange={(e) => setBillData(b => ({ ...b, billNo: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="000" disabled={isReadOnly} />
              </div>
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block tracking-tighter">Date</label>
                <input type="date" value={safeDate(billData.date)} onChange={(e) => setBillData(b => ({ ...b, date: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" disabled={isReadOnly} />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-4">
                 <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">Bill Type</label>
                 <div className="relative">
                    <input type="text" value={billData.billType} onChange={(e) => { setTaxQuery(e.target.value); setBillData(b => ({ ...b, billType: e.target.value })); }} onFocus={() => setShowTaxSuggestions(true)} onKeyDown={handleTaxInputKeyDown} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="Select Type..." disabled={isReadOnly} />
                    {showTaxSuggestions && filteredTaxes.length > 0 && (
                      <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mt-1 p-1 max-h-48 overflow-y-auto">
                        {filteredTaxes.map((tax, idx) => (
                          <div key={tax.id ?? idx} onMouseDown={() => selectTax(tax)} className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${activeTaxIndex === idx ? "bg-blue-50" : ""}`}>
                            <div className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{tax.Name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block">Godown</label>
                <input type="text" value={billData.godown || ""} onChange={(e) => setBillData(b => ({ ...b, godown: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="Godown" disabled={isReadOnly} />
              </div>
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block tracking-tighter">Booked By (User)</label>
                <input type="text" value={billData.bookedBy || ""} onChange={(e) => setBillData(b => ({ ...b, bookedBy: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="User ID" disabled={isReadOnly} />
              </div>
            </div>
          </div>

          {/* Vendor Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Vendor Info</h3>
              </div>
              <div className="flex gap-2">
                 <div className="flex flex-col items-end px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[9px] font-black text-blue-400 uppercase leading-none">Credit Limit</span>
                    <span className="text-xs font-black text-blue-700 tracking-tight leading-none mt-0.5">₹{partyData.creditLimit ? roundAmount(partyData.creditLimit) : "0"}</span>
                 </div>
                 <div className="flex flex-col items-end px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[9px] font-black text-emerald-400 uppercase leading-none">Balance</span>
                    <span className="text-xs font-black text-emerald-700 tracking-tight leading-none mt-0.5">
                       {partyData.CurrentBalance 
                          ? `${roundAmount(partyData.CurrentBalance.amount)} ${partyData.CurrentBalance.type}` 
                          : "₹0 Dr"}
                    </span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6" ref={containerRef} style={{position: 'relative', zIndex: 50}}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 block mb-1">Account</label>
                  <div className="relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" value={partyData.partyAccount || ""} 
                      onChange={(e) => { setPartyData(p => ({ ...p, partyAccount: e.target.value })); setShowSuggestions(true); setActiveIndex(-1); }} 
                      onFocus={() => { setShowSuggestions(true); setActiveIndex(-1); }}
                      onKeyDown={onPartyInputKeyDown}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 uppercase outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-black" 
                      placeholder="Search Vendor..." disabled={isReadOnly} autoComplete="off" />
                  </div>
                  {showSuggestions && filteredAccounts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 shadow-2xl rounded-lg overflow-hidden">
                      {filteredAccounts.map((acc, idx) => (
                        <div key={idx} onMouseDown={(e) => { e.preventDefault(); selectAccount(acc); }} onMouseEnter={() => setActiveIndex(idx)}
                          className={`px-3 py-2 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${idx === activeIndex ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                          <div className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{acc.Name || "-"}</div>
                          <div className="flex justify-between items-center mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{acc.MobileNumber || "No Mobile"}</span>
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">SELECT Account</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</label>
                <input type="text" value={partyData.address || ""} onChange={(e) => setPartyData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 uppercase font-black" placeholder="Address" disabled={isReadOnly} />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> Contact No</label>
                <input type="text" value={partyData.contactNumber || ""} onChange={(e) => setPartyData(p => ({ ...p, contactNumber: e.target.value }))} className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-700 h-9 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 font-black tabular-nums" placeholder="+91..." disabled={isReadOnly} />
              </div>
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase px-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> State</label>
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
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Purchase Items</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{items.length} Lines Added</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isReadOnly && (
                <button onClick={addItemRow} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/30 font-black" style={{maxHeight: 'calc(100vh - 425px)'}}>
            <table className="min-w-[1800px] text-left border-collapse table-fixed">
              <thead className="bg-white sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-100">
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                  <th className="w-8 py-2 border-r border-slate-50">#</th>
                  <th className="w-28 py-2 px-2 border-r border-slate-50">Barcode</th>
                  <th className="w-56 py-2 px-2 border-r border-slate-50 text-left">Product Name</th>
                  <th className="w-24 py-2 border-r border-slate-50">Order No</th>
                  <th className="w-10 py-2 border-r border-slate-50">Eye</th>
                  <th className="w-14 py-2 bg-blue-50/30 text-blue-500 border-r border-slate-100">Sph</th>
                  <th className="w-14 py-2 bg-blue-50/30 text-blue-500 border-r border-slate-100">Cyl</th>
                  <th className="w-14 py-2 bg-blue-50/30 text-blue-500 border-r border-slate-100">Axis</th>
                  <th className="w-14 py-2 bg-blue-50/30 text-blue-500 border-r border-slate-100">Add</th>
                  <th className="w-14 py-2 text-right px-2 border-r border-slate-50">Qty</th>
                  <th className="w-20 py-2 text-right px-2 border-r border-slate-50">P.Price</th>
                  <th className="w-16 py-2 text-right px-2 border-r border-slate-50">Disc%</th>
                  <th className="w-24 py-2 text-right px-2 border-r border-slate-50 text-blue-600">Total</th>
                  <th className="w-16 py-2 text-right px-2 border-r border-slate-50 text-slate-400">S.Price</th>
                  <th className="w-40 py-2 px-2 border-r border-slate-50 text-left">Remark</th>
                  <th className="w-48 py-2 px-2 border-r border-slate-50 text-left">Vendor</th>
                  <th className="w-10 py-2 border-r border-slate-50">Mail</th>
                  <th className="w-16 py-2 border-r border-slate-50">RefId</th>
                  <th className="w-10 py-2 border-r border-slate-50">STK</th>
                  <th className="w-10 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white uppercase">
                {items.map((item, index) => {
                  const rowError = rowErrors[index];
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-blue-50/30 transition-colors group h-10">
                        <td className="py-1 text-center text-slate-300 text-[10px] font-bold border-r border-slate-50 tabular-nums">{index + 1}</td>
                        <td className="p-0.5 border-r border-slate-50">
                          <input type="text" value={item.barcode || ""} onChange={(e) => updateItem(index, "barcode", e.target.value)}
                            className="w-full h-8 px-1.5 py-1 bg-transparent text-[10px] font-black text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all tabular-nums"
                            placeholder="Barcode" disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 border-r border-slate-50 relative">
                          <input type="text" value={itemQueries[index] ?? item.itemName ?? ""}
                            onFocus={() => !isReadOnly && setShowItemSuggestions(p => ({ ...p, [index]: true }))}
                            onBlur={() => setTimeout(() => setShowItemSuggestions(p => ({ ...p, [index]: false })), 200)}
                            onChange={(e) => { setItemQueries(p => ({ ...p, [index]: e.target.value })); setShowItemSuggestions(p => ({ ...p, [index]: true })); updateItem(index, "itemName", e.target.value); }}
                            className="w-full h-8 px-1.5 py-1 bg-transparent text-[10px] font-black text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all uppercase"
                            placeholder="Search Item..." disabled={isReadOnly} />
                          {showItemSuggestions[index] && getFilteredLens(index).length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mt-0.5 p-1 max-h-48 overflow-y-auto">
                              {getFilteredLens(index).map((l, i) => (
                                <div key={i} onMouseDown={() => selectLens(l, index)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px] font-black text-slate-600 border-b border-slate-50 last:border-0 uppercase tracking-tight text-left">
                                  {l.productName}
                                  <div className="text-[8px] text-slate-400 mt-0.5 flex justify-between">
                                    <span>MRP: ₹{l.mrp}</span>
                                    {l.stock && <span>STK: {l.stock}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-0.5 border-r border-slate-50">
                          <input type="text" value={item.orderNo || ""} onChange={(e) => updateItem(index, "orderNo", e.target.value)}
                            className="w-full h-8 px-1 py-1 bg-transparent text-[10px] font-black text-slate-400 text-center outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded uppercase"
                            placeholder="Order #" disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 border-r border-slate-50 bg-blue-50/10">
                          <span className="block w-full text-[11px] text-center text-blue-600 font-black uppercase leading-none">{item.eye || "—"}</span>
                        </td>
                        {["sph", "cyl", "axis", "add"].map((field) => (
                          <td key={field} className="p-0 border-r border-slate-100 bg-blue-50/20">
                            <input type="text" value={item[field] || ""} onChange={(e) => updateItem(index, field, e.target.value)}
                              className="w-full h-9 px-1 py-1 bg-transparent text-[12px] font-black text-center text-slate-800 outline-none focus:bg-white/80 focus:ring-1 focus:ring-blue-100 tabular-nums"
                              placeholder="0.00" disabled={isReadOnly} />
                          </td>
                        ))}
                        <td className="p-0.5 border-r border-slate-50 bg-emerald-50/10">
                          <input type="number" value={item.qty || ""} onChange={(e) => { let v = e.target.value; if(Number(v)<0) v=0; updateItem(index, "qty", v); }}
                            className="w-full h-8 px-1 py-1 bg-transparent text-[11px] font-black text-right text-emerald-600 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-100 rounded transition-all tabular-nums"
                            placeholder="0" disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 border-r border-slate-50 bg-blue-50/10">
                           <input type="number" value={item.purchasePrice || ""} onChange={(e) => updateItem(index, "purchasePrice", e.target.value)}
                              className="w-full h-8 px-1 py-1 bg-transparent text-[11px] font-black text-right text-blue-600 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all tabular-nums font-black"
                              placeholder="0.00" disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 border-r border-slate-50">
                          <input type="number" value={item.discount || ""} onChange={(e) => { let v = e.target.value; if(Number(v)<0) v=0; updateItem(index, "discount", v); }}
                            className="w-full h-8 px-1 py-1 bg-transparent text-[11px] font-black text-right text-red-400 outline-none focus:bg-white focus:ring-1 focus:ring-red-100 rounded transition-all tabular-nums"
                            placeholder="0" disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 text-right text-[11px] font-black text-slate-800 pr-2 border-r border-slate-50 tabular-nums">
                           ₹{parseFloat(String(item.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-0.5 text-right text-[10px] font-black text-slate-400 pr-2 border-r border-slate-50 tabular-nums">
                           ₹{parseFloat(String(item.salePrice || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-0.5 border-r border-slate-50">
                           <input type="text" value={item.remark || ""} onChange={(e) => updateItem(index, "remark", e.target.value)}
                              className="w-full h-8 px-2 py-1 bg-transparent text-[9px] font-black text-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all uppercase italic"
                              placeholder="Remark..." disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 border-r border-slate-50 relative" ref={(el) => (vendorContainerRefs.current[index] = el)}>
                           <div className="relative group/vend">
                              <Search className={`w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-300 ${vendorQueries[index] ? 'hidden' : ''}`} />
                              <input type="text" value={vendorQueries[index] ?? item.vendorName ?? ""} 
                                 onChange={(e) => { setVendorQueries(p => ({ ...p, [index]: e.target.value })); setShowVendorSuggestions(p => ({ ...p, [index]: true })); updateItem(index, "vendorName", e.target.value); }} 
                                 onFocus={() => setShowVendorSuggestions(p => ({ ...p, [index]: true }))}
                                 onKeyDown={(e) => onVendorInputKeyDown(e, index)}
                                 className={`w-full h-8 ${vendorQueries[index] ? 'pl-2' : 'pl-6'} pr-2 py-1 bg-transparent text-[10px] font-black text-slate-600 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded transition-all uppercase text-left`}
                                 placeholder="Vendor..." disabled={isReadOnly} />
                              {showVendorSuggestions[index] && getFilteredVendors(index).length > 0 && (
                                 <div className="absolute bottom-full left-0 w-64 bg-white border border-slate-200 shadow-2xl z-50 rounded-lg mb-1 p-1 max-h-48 overflow-y-auto">
                                    <div className="px-2 py-1 bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">Select Vendor</div>
                                    {getFilteredVendors(index).map((v, i) => (
                                       <div key={v._id ?? i} onMouseDown={() => selectVendor(v, index)}
                                          className={`px-2 py-1.5 cursor-pointer border-b border-slate-50 last:border-0 rounded transition-colors ${activeVendorIndexes[index] === i ? 'bg-blue-50' : 'hover:bg-blue-50/50'} text-left`}>
                                          <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{v.name}</div>
                                          {v.phone && <div className="text-[8px] text-slate-400 font-bold mt-0.5">📞 {v.phone}</div>}
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        </td>
                        <td className="p-0.5 border-r border-slate-50 text-center">
                           <button className="p-1.5 rounded-full hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-all active:scale-90" title="Send Email">
                              <Mail className="w-3.5 h-3.5" />
                           </button>
                        </td>
                        <td className="p-0.5 border-r border-slate-50 text-center">
                           <input type="text" value={item.refId ?? ""} onChange={(e) => updateItem(index, "refId", e.target.value.trim())}
                              className="w-full h-8 px-1 py-1 bg-transparent text-[10px] font-black text-center text-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 rounded tabular-nums"
                              placeholder="0" disabled={isReadOnly} />
                        </td>
                        <td className="p-0.5 border-r border-slate-50 text-center text-[10px] font-black text-slate-400 bg-slate-50/30 tabular-nums">
                            {getInitStockForRow(index)}
                        </td>
                        <td className="p-0.5 text-center">
                           <button onClick={() => !isReadOnly && deleteItem(item.id)} className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-all ${isReadOnly ? "hidden" : "text-slate-300 hover:text-red-500 hover:bg-red-50"}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </td>
                      </tr>
                      {rowError && (
                        <tr>
                           <td colSpan={22} className="px-3 py-0.5 bg-red-50 text-[8px] font-black text-red-500 uppercase italic tracking-tighter">
                              <div className="flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> Validation Note: {rowError}</div>
                           </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-12 gap-3 flex-shrink-0">
          
          {/* Tax Section */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 min-h-[160px]">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                      <Calculator className="w-4 h-4" />
                   </div>
                   <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Adjustment & Taxes</h3>
                </div>
                {!isReadOnly && (
                   <button onClick={addTaxRow} className="text-[10px] font-black text-emerald-600 uppercase hover:underline flex items-center gap-1 active:scale-95 transition-all">
                      <Plus className="w-3 h-3" /> New Charge
                   </button>
                )}
             </div>

             <div className="flex-1 overflow-y-auto pr-1">
                <table className="w-full text-left font-black">
                   <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-[9px] text-slate-400 uppercase tracking-widest text-left">
                         <th className="py-2 px-3">Description</th>
                         <th className="w-24 px-2">Type</th>
                         <th className="w-16 text-right">%</th>
                         <th className="w-24 text-right px-3">Amount</th>
                         <th className="w-10"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {taxes.map((tax, idx) => (
                         <tr key={tax.id} className="group hover:bg-slate-50/50">
                            <td className="py-1.5 px-3">
                               <input type="text" value={tax.taxName} onChange={(e) => updateTax(idx, "taxName", e.target.value)}
                                  className="w-full bg-transparent text-[10px] font-black text-slate-700 outline-none uppercase"
                                  placeholder="Charge Name" disabled={isReadOnly} />
                            </td>
                            <td className="px-2">
                               <select value={tax.type} onChange={(e) => updateTax(idx, "type", e.target.value)}
                                  className="w-full bg-transparent text-[10px] font-black text-slate-600 outline-none uppercase appearance-none"
                                  disabled={isReadOnly}>
                                  <option value="Additive">(+) Additive</option>
                                  <option value="Subtractive">(-) Discount</option>
                               </select>
                            </td>
                            <td className="text-right">
                               <input type="number" value={tax.percentage} onChange={(e) => updateTax(idx, "percentage", e.target.value)}
                                  className="w-full bg-transparent text-[10px] font-black text-slate-700 text-right outline-none tabular-nums"
                                  placeholder="0" disabled={isReadOnly} />
                            </td>
                            <td className="text-right px-3 text-[10px] font-black text-slate-800 tabular-nums whitespace-nowrap">
                               ₹{parseFloat(String(tax.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-center">
                               <button onClick={() => !isReadOnly && deleteTax(tax.id)} className="p-1 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>

          {/* Totals Section */}
          <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-800 flex flex-col gap-3 font-black">
             <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtotal (Gross)</span>
                   <span className="text-xs font-black text-slate-300 tabular-nums">₹{computeSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center px-1 text-[10px]">
                   <span className="text-slate-500 uppercase tracking-widest font-black">Adjustments</span>
                   <span className={`tabular-nums font-black ${computeTotalTaxes() >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {computeTotalTaxes() >= 0 ? "+" : "-"} ₹{Math.abs(computeTotalTaxes()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                   </span>
                </div>
                
                <div className="border-t border-slate-800/50 my-1"></div>
                
                <div className="flex justify-between items-baseline px-1">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none">Net Amount Due</span>
                   </div>
                   <div className="text-3xl font-black text-white tabular-nums tracking-tighter flex items-center gap-1">
                      <span className="text-xl text-slate-600 font-bold">₹</span>
                      {computeNetAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                   <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Paid (Adjustment)</label>
                   <div className="relative">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-black">₹</span>
                      <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                         className="w-full bg-slate-900/50 pl-4 pr-2 py-1.5 rounded text-sm font-black text-emerald-400 outline-none focus:ring-1 focus:ring-indigo-500 transition-all tabular-nums"
                         placeholder="0.00" disabled={isReadOnly} />
                   </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                   <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Final Balance</label>
                   <div className="text-sm font-black text-amber-500 tabular-nums flex items-center h-8 justify-end pr-1 text-right">
                      ₹{(computeNetAmount() - Number(paidAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                   </div>
                </div>
             </div>

             <div className="flex gap-2 mt-auto">
                <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-lg transition-all active:scale-95 border border-slate-700/50 disabled:opacity-50" disabled={isReadOnly}>
                   <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
                <button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-widest rounded-lg shadow-xl shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50" disabled={isReadOnly}>
                   {isReadOnly ? <Lock className="w-4 h-4 text-amber-400" /> : <Save className="w-4 h-4 text-white" />}
                   {isReadOnly ? "LOCKED" : "Confirm Entry"}
                </button>
             </div>
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default AddRxPurchase;
