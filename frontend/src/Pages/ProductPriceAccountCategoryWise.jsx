import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  RotateCcw,
  Save,
  User,
  Package,
  Layers,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import { getAllItems } from "../controllers/itemcontroller";
import { getAllAccounts } from "../controllers/Account.controller";
import {
  bulkUpsertAccountWisePrices,
  getAccountWisePrices,
} from "../controllers/AccountWisePriceController";
import {
  upsertPowerGroupPricing,
  getPowerGroupPricing,
} from "../controllers/ProductPowerGroupPricingController";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

export default function ProductPriceAccountCategoryWise() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [products, setProducts] = useState([]);
  const [customPrices, setCustomPrices] = useState({}); // { productId: price }
  const [percentages, setPercentages] = useState({}); // { productId: percentage }
  const [searchText, setSearchText] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [priceType, setPriceType] = useState("Sale");
  const [selectedPGs, setSelectedPGs] = useState({}); // { productId: { powerGroupId: boolean } }
  const [pgPricingData, setPgPricingData] = useState({}); // { productId: { powerGroupId: price } }

  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [accRes, lensRes, itemRes] = await Promise.all([
        getAllAccounts(),
        getAllLensPower(),
        getAllItems(),
      ]);

      // Accounts handle (Backend returns array directly)
      const accountsList = Array.isArray(accRes) ? accRes : (accRes.accounts || accRes.data || []);
      setAccounts(accountsList);

      let allProds = [];
      // Lenses handle
      const lensesList = lensRes.data || (Array.isArray(lensRes) ? lensRes : []);
      allProds = [...allProds, ...lensesList.map(l => ({ ...l, isLens: true, id: l._id, name: l.productName }))];

      // Items handle
      const itemsData = itemRes.items || itemRes.data?.items || (Array.isArray(itemRes) ? itemRes : []);
      allProds = [...allProds, ...itemsData.map(i => ({ ...i, isLens: false, id: i._id, name: i.itemName }))];

      setProducts(allProds);
    } catch (err) {
      console.error("Fetch initial data error:", err);
      toast.error("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      fetchCustomPrices();
      fetchPowerGroupPrices();
    } else {
      setCustomPrices({});
      setPercentages({});
      setPgPricingData({});
      setSelectedPGs({});
    }
  }, [selectedAccount, priceType]);

  const fetchCustomPrices = async () => {
    try {
      const res = await getAccountWisePrices(selectedAccount._id, priceType);
      if (res.success) {
        const pricesMap = {};
        const percentsMap = {};
        res.data.forEach((p) => {
          const key = p.itemId || p.lensGroupId;
          pricesMap[key] = p.customPrice;
          percentsMap[key] = p.percentage || "";
        });
        setCustomPrices(pricesMap);
        setPercentages(percentsMap);
      }
    } catch (err) {
      console.error("Fetch custom prices error:", err);
    }
  };

  const fetchPowerGroupPrices = async () => {
    try {
      const res = await getPowerGroupPricing(selectedAccount._id, priceType);
      if (res.success) {
        const pgMap = {};
        const selectedMap = {};
        res.data.forEach((p) => {
          if (!pgMap[p.productId]) pgMap[p.productId] = {};
          pgMap[p.productId][p.powerGroupId] = p.customPrice;

          if (!selectedMap[p.productId]) selectedMap[p.productId] = {};
          selectedMap[p.productId][p.powerGroupId] = true;
        });
        setPgPricingData(pgMap);
        setSelectedPGs(selectedMap);
      }
    } catch (err) {
      console.error("Fetch PG prices error:", err);
    }
  };

  const handlePGSelect = (productId, pgId, checked) => {
    setSelectedPGs(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [pgId]: checked
      }
    }));
  };

  const handlePriceChange = (productId, value, basePrice) => {
    const numericValue = value === "" ? "" : parseFloat(value);
    setCustomPrices((prev) => ({
      ...prev,
      [productId]: numericValue,
    }));

    if (value === "" || !basePrice) {
      setPercentages((prev) => ({
        ...prev,
        [productId]: "",
      }));
    } else {
      const numericBasePrice = parseFloat(basePrice);
      if (numericBasePrice > 0) {
        const percent = ((numericBasePrice - numericValue) / numericBasePrice) * 100;
        setPercentages((prev) => ({
          ...prev,
          [productId]: Number.isInteger(percent) ? percent : Number(percent.toFixed(2)),
        }));
      }
    }
  };

  const handlePercentageChange = (productId, value, basePrice) => {
    if (value !== "" && (parseFloat(value) < 0 || parseFloat(value) > 100)) {
      return; // Validation: 0-100 only
    }

    setPercentages((prev) => ({
      ...prev,
      [productId]: value,
    }));

    if (value === "") {
      // If cleared, revert custom price to default (empty in state)
      setCustomPrices((prev) => ({
        ...prev,
        [productId]: "",
      }));
    } else {
      const percent = parseFloat(value);
      const newPrice = basePrice - (basePrice * percent) / 100;
      setCustomPrices((prev) => ({
        ...prev,
        [productId]: Math.round(newPrice * 100) / 100, // Round to 2 decimals
      }));
    }
  };

  const handleSave = async () => {
    if (!selectedAccount) {
      toast.error("Please select an account first");
      return;
    }

    try {
      setLoading(true);

      // Traditional Product/Lens prices
      const pricesToSave = Object.entries(customPrices)
        .filter(([_, price]) => price !== "" && price !== null)
        .map(([productId, price]) => {
          const prod = products.find((p) => p.id === productId);
          if (!prod) return null; // Safety check
          return {
            accountId: selectedAccount._id,
            itemId: prod.isLens ? undefined : productId,
            lensGroupId: prod.isLens ? productId : undefined,
            customPrice: price,
            percentage: percentages[productId] || 0,
            type: priceType,
          };
        })
        .filter(Boolean); // Filter out null values

      // New Power Group granular prices
      const pgPricesToSave = [];
      Object.entries(selectedPGs).forEach(([productId, pgSelection]) => {
        const rowPrice = customPrices[productId];
        if (rowPrice === undefined || rowPrice === "" || rowPrice === null) return;

        Object.entries(pgSelection).forEach(([pgId, isSelected]) => {
          if (isSelected) {
            pgPricesToSave.push({
              partyId: selectedAccount._id,
              productId: productId,
              powerGroupId: pgId,
              customPrice: rowPrice,
              priceType: priceType
            });
          }
        });
      });

      if (pricesToSave.length === 0 && pgPricesToSave.length === 0) {
        toast.error("No prices to save");
        setLoading(false);
        return;
      }

      const promises = [];
      if (pricesToSave.length > 0) promises.push(bulkUpsertAccountWisePrices(pricesToSave));
      if (pgPricesToSave.length > 0) promises.push(upsertPowerGroupPricing(pgPricesToSave));

      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.success);

      if (allSuccess) {
        toast.success("Prices saved successfully");
        fetchPowerGroupPrices(); // Refresh PG data
      } else {
        toast.error("Some prices failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Error while saving");
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return accounts;
    return accounts.filter((a) =>
      a.Name.toLowerCase().includes(accountSearch.toLowerCase())
    );
  }, [accounts, accountSearch]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.groupName && p.groupName.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [products, searchText]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <Toaster position="top-right" />
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Customer Specific Pricing
            </h1>
            <p className="text-slate-500 mt-1 font-medium italic">
              Assign custom prices to individual parties for products and lenses
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
              <button
                onClick={() => setPriceType("Sale")}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${priceType === "Sale"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                Sale Price
              </button>
              <button
                onClick={() => setPriceType("Purchase")}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${priceType === "Purchase"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                Purchase Price
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={loading || !selectedAccount}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-100"
            >
              <Save className="w-5 h-5" />
              Save Prices
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Account List Card */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search Party..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {filteredAccounts.map((acc) => (
                <button
                  key={acc._id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 mb-1 group ${selectedAccount?._id === acc._id
                    ? "bg-blue-50 text-blue-700 border-blue-100 border shadow-sm"
                    : "hover:bg-slate-50 text-slate-600"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selectedAccount?._id === acc._id ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-white'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold truncate max-w-[150px]">{acc.Name}</p>
                      <p className="text-[10px] opacity-70 truncate">{acc.AccountId}</p>
                    </div>
                  </div>
                  {selectedAccount?._id === acc._id && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Product List Card */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3 text-slate-800">
                <Package className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold tracking-tight">
                  {selectedAccount ? `Pricing for: ${selectedAccount.Name}` : "Products List"}
                </h2>
              </div>
              <div className="relative group min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search Product or Group..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {!selectedAccount ? (
                <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white min-h-[400px]">
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <User className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-lg font-bold">Selection Required</p>
                  <p className="text-sm">Please select a customer from the left to manage prices</p>
                </div>
              ) : (
                <table className="w-full table-auto">
                  <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Sr.</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Product Info</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Power Group</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Default Price</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Percentage (%)</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Custom Price</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p, index) => {
                      const basePrice = p.isLens ? p.salePrice?.default : p.salePrice;
                      const hasCustom = customPrices[p.id] !== undefined && customPrices[p.id] !== "";

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-all duration-150 group">
                          <td className="px-6 py-5 text-slate-400 text-sm font-medium">{index + 1}</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg flex-shrink-0 ${p.isLens ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                                {p.isLens ? <Layers className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-slate-900 font-bold text-sm leading-tight group-hover:text-blue-700 transition-colors">{p.name}</p>
                                <p className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5 mt-0.5">
                                  {p.groupName}
                                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                  {p.isLens ? 'Lens' : 'Item'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {p.isLens && p.powerGroups && p.powerGroups.length > 0 ? (
                              <div className="flex flex-col gap-2 min-w-[200px] max-h-40 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200">
                                {p.powerGroups.map(pg => (
                                  <label key={pg._id} className="flex items-center gap-2 group/pg cursor-pointer">
                                    <div className="relative flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={!!selectedPGs[p.id]?.[pg._id]}
                                        onChange={(e) => handlePGSelect(p.id, pg._id, e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-bold text-slate-700 group-hover/pg:text-blue-600 transition-colors">
                                        {pg.label}
                                      </span>
                                      {pgPricingData[p.id]?.[pg._id] && (
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">
                                          Current Party: ₹{pgPricingData[p.id][pg._id]}
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-slate-400">
                                <RotateCcw className="w-3 h-3 opacity-30" />
                                <span className="text-[11px] font-medium italic">No Power Groups</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="text-slate-600 font-bold text-sm bg-slate-100 px-2.5 py-1 rounded-md">
                              ₹{basePrice || 0}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex justify-center">
                              <div className="relative group/input">
                                <input
                                  type="number"
                                  value={percentages[p.id] ?? ""}
                                  onChange={(e) => handlePercentageChange(p.id, e.target.value, basePrice || 0)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handlePercentageChange(p.id, e.target.value, basePrice || 0);
                                      toast.success("Price calculated", { id: "calc-" + p.id, duration: 1000 });
                                    }
                                  }}
                                  placeholder="0"
                                  className="w-20 px-3 py-2 border-2 border-slate-100 rounded-xl text-sm font-bold transition-all outline-none text-right focus:border-blue-400 focus:bg-white text-slate-700"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex justify-center">
                              <div className="relative group/input">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold group-focus-within/input:text-blue-500">₹</span>
                                <input
                                  type="number"
                                  value={customPrices[p.id] ?? ""}
                                  onChange={(e) => handlePriceChange(p.id, e.target.value, basePrice)}
                                  placeholder={basePrice || "0"}
                                  className={`w-28 pl-7 pr-3 py-2 border-2 rounded-xl text-sm font-bold transition-all outline-none text-right ${hasCustom
                                    ? "border-blue-200 bg-blue-50/30 text-blue-700 focus:border-blue-500 ring-4 ring-blue-500/5"
                                    : "border-slate-100 focus:border-blue-400 focus:bg-white text-slate-700"
                                    }`}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {hasCustom ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                Custom Set
                              </span>
                            ) : (
                              <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                Default
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {selectedAccount && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center px-8">
                <p className="text-xs text-slate-500 font-bold tracking-wider uppercase">
                  Total Products: <span className="text-slate-900">{filteredProducts.length}</span>
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setCustomPrices({});
                      setPercentages({});
                    }}
                    className="text-xs font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors">
                    Clear All Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
