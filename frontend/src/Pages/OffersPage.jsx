import React, { useState, useMemo, useEffect } from "react";
import {
    Plus,
    Search,
    RotateCcw,
    Save,
    Package,
    Layers,
    ChevronRight,
    Copy,
} from "lucide-react";
import { getAllGroups } from "../controllers/groupcontroller";
import { getOffersByGroup, bulkUpsertOffers } from "../controllers/OfferController";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

export default function OffersPage() {
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [products, setProducts] = useState([]);
    const [rowStates, setRowStates] = useState({}); // { productId: { percentage, qty, offerPrice, status } }
    const [searchText, setSearchText] = useState("");
    const [groupSearch, setGroupSearch] = useState("");

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await getAllGroups();
            const list = res.groups || res.data || (Array.isArray(res) ? res : []);
            setGroups(list);
        } catch (err) {
            console.error("Fetch groups error:", err);
            toast.error("Failed to load groups");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedGroup) {
            fetchProductsWithOffers();
        } else {
            setProducts([]);
            setRowStates({});
        }
    }, [selectedGroup]);

    const fetchProductsWithOffers = async () => {
        try {
            setLoading(true);
            const res = await getOffersByGroup(selectedGroup.groupName);
            if (res.success) {
                setProducts(res.data);
                const initialStates = {};
                res.data.forEach((p) => {
                    if (p.offer) {
                        initialStates[p.id] = {
                            percentage: p.offer.percentage || "",
                            qty: p.offer.qty || "",
                            offerPrice: p.offer.offerPrice || p.defaultPrice,
                            status: p.offer.status || "OFFER SET"
                        };
                    } else {
                        initialStates[p.id] = {
                            percentage: "",
                            qty: "",
                            offerPrice: p.defaultPrice,
                            status: "DEFAULT"
                        };
                    }
                });
                setRowStates(initialStates);
            }
        } catch (err) {
            console.error("Fetch products error:", err);
            toast.error("Failed to load products for this group");
        } finally {
            setLoading(false);
        }
    };

    const handlePercentageChange = (productId, value, defaultPrice) => {
        if (value !== "" && (parseFloat(value) < 0 || parseFloat(value) > 100)) return;

        setRowStates((prev) => {
            const current = prev[productId] || {};
            const percentage = value;
            const qty = current.qty || "";
            let offerPrice = defaultPrice;
            let status = "DEFAULT";

            if (percentage !== "" && parseFloat(percentage) > 0) {
                const p = parseFloat(percentage);
                offerPrice = Math.round((defaultPrice - (defaultPrice * p) / 100) * 100) / 100;
                status = "OFFER SET";
            }

            return {
                ...prev,
                [productId]: { ...current, percentage, offerPrice, status }
            };
        });
    };

    const handleQtyChange = (productId, value) => {
        if (value !== "" && parseInt(value) < 0) return;

        setRowStates((prev) => {
            const current = prev[productId] || {};
            return {
                ...prev,
                [productId]: { ...current, qty: value }
            };
        });
    };

    const calculateRow = (productId, percentage, defaultPrice) => {
        if (percentage === "" || parseFloat(percentage) === 0) {
            return { offerPrice: defaultPrice, status: "DEFAULT" };
        }
        const p = parseFloat(percentage);
        const offerPrice = Math.round((defaultPrice - (defaultPrice * p) / 100) * 100) / 100;
        return { offerPrice, status: "OFFER SET" };
    };

    const copyFirstRowToAll = () => {
        if (products.length < 2) return;
        const firstProdId = products[0].id;
        const firstRow = rowStates[firstProdId];
        if (!firstRow) return;

        const newStates = { ...rowStates };
        products.forEach((p, index) => {
            if (index === 0) return;
            const res = calculateRow(p.id, firstRow.percentage, p.defaultPrice);
            newStates[p.id] = {
                ...newStates[p.id],
                percentage: firstRow.percentage,
                qty: firstRow.qty,
                offerPrice: res.offerPrice,
                status: res.status
            };
        });
        setRowStates(newStates);
        toast.success("Values copied to all rows");
    };

    const handleSave = async () => {
        if (!selectedGroup) {
            toast.error("Please select a group first");
            return;
        }

        try {
            setLoading(true);
            const offersToSave = products.map(p => {
                const state = rowStates[p.id] || {};
                return {
                    id: p.id,
                    isLens: p.isLens,
                    defaultPrice: p.defaultPrice,
                    percentage: parseFloat(state.percentage) || 0,
                    qty: parseInt(state.qty) || 0,
                    offerPrice: state.offerPrice,
                    status: state.status
                };
            }).filter(o => o.percentage > 0 && o.qty > 0);

            if (offersToSave.length === 0) {
                // Actually keep it flexible, maybe they want to clear offers?
                // The requirement says "Save group-wise offer configuration"
            }

            const res = await bulkUpsertOffers(selectedGroup.groupName, offersToSave);
            if (res.success) {
                toast.success("Offers saved successfully");
            } else {
                toast.error(res.message || "Failed to save offers");
            }
        } catch (err) {
            console.error("Save error:", err);
            toast.error("Error while saving");
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = useMemo(() => {
        if (!groupSearch) return groups;
        return groups.filter((g) =>
            g.groupName.toLowerCase().includes(groupSearch.toLowerCase())
        );
    }, [groups, groupSearch]);

    const filteredProducts = useMemo(() => {
        if (!searchText) return products;
        const q = searchText.toLowerCase();
        return products.filter((p) =>
            p.name.toLowerCase().includes(q)
        );
    }, [products, searchText]);

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans">
            <Toaster position="top-right" />
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            Group Offers Management
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium italic">
                            Set group-wise offers with minimum quantity conditions
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={loading || !selectedGroup}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-100"
                        >
                            <Save className="w-5 h-5" />
                            Save Offers
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Group List Card */}
                    <div className="lg:col-span-1 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search Group..."
                                    value={groupSearch}
                                    onChange={(e) => setGroupSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2">
                            {filteredGroups.map((g) => (
                                <button
                                    key={g._id}
                                    onClick={() => setSelectedGroup(g)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 mb-1 group ${selectedGroup?._id === g._id
                                        ? "bg-blue-50 text-blue-700 border-blue-100 border shadow-sm"
                                        : "hover:bg-slate-50 text-slate-600"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${selectedGroup?._id === g._id ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-white'}`}>
                                            <Layers className="w-4 h-4" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold truncate max-w-[150px]">{g.groupName}</p>
                                        </div>
                                    </div>
                                    {selectedGroup?._id === g._id && (
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
                                    {selectedGroup ? `Offers for: ${selectedGroup.groupName}` : "Products List"}
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                {selectedGroup && products.length > 0 && (
                                    <button
                                        onClick={copyFirstRowToAll}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                                        title="Copy percentage and qty from first row to all others"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        Copy First Row to All
                                    </button>
                                )}
                                <div className="relative group min-w-[250px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search Product..."
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto flex-1">
                            {!selectedGroup ? (
                                <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white min-h-[400px]">
                                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                        <Layers className="w-10 h-10 opacity-20" />
                                    </div>
                                    <p className="text-lg font-bold">Selection Required</p>
                                    <p className="text-sm">Please select a product group from the left to manage offers</p>
                                </div>
                            ) : (
                                <table className="w-full table-auto">
                                    <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Sr.</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Product Info</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Default Price</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Percentage (%)</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Qty ✅</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Offer Price</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredProducts.map((p, index) => {
                                            const state = rowStates[p.id] || { percentage: "", qty: "", offerPrice: p.defaultPrice, status: "DEFAULT" };
                                            const isOfferSet = state.status === "OFFER SET";

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
                                                                <p className="text-slate-500 text-[11px] font-semibold mt-0.5">
                                                                    {p.isLens ? 'Lens Group' : 'Product'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="text-slate-600 font-bold text-sm bg-slate-100 px-2.5 py-1 rounded-md">
                                                            ₹{p.defaultPrice}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <div className="relative group/input">
                                                                <input
                                                                    type="number"
                                                                    value={state.percentage}
                                                                    onChange={(e) => handlePercentageChange(p.id, e.target.value, p.defaultPrice)}
                                                                    placeholder="0"
                                                                    className="w-20 px-3 py-2 border-2 border-slate-100 rounded-xl text-sm font-bold transition-all outline-none text-right focus:border-blue-400 focus:bg-white text-slate-700"
                                                                />
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none">%</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <div className="relative group/input">
                                                                <input
                                                                    type="number"
                                                                    value={state.qty}
                                                                    onChange={(e) => handleQtyChange(p.id, e.target.value)}
                                                                    placeholder="Min Qty"
                                                                    className="w-24 px-3 py-2 border-2 border-slate-100 rounded-xl text-sm font-bold transition-all outline-none text-right focus:border-blue-400 focus:bg-white text-slate-700"
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <div className="relative group/input">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                                                                <input
                                                                    type="number"
                                                                    readOnly
                                                                    value={state.offerPrice}
                                                                    className={`w-28 pl-7 pr-3 py-2 border-2 rounded-xl text-sm font-bold transition-all outline-none text-right ${isOfferSet
                                                                        ? "border-blue-200 bg-blue-50/30 text-blue-700 font-black"
                                                                        : "border-slate-100 bg-slate-50 text-slate-500"
                                                                        }`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        {isOfferSet ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                                Offer Set
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
                        {selectedGroup && (
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center px-8 text-xs text-slate-500 font-bold uppercase tracking-wider">
                                <p>Total Products: <span className="text-slate-900">{filteredProducts.length}</span></p>
                                <button
                                    onClick={() => {
                                        const reset = {};
                                        products.forEach(p => reset[p.id] = { percentage: "", qty: "", offerPrice: p.defaultPrice, status: "DEFAULT" });
                                        setRowStates(reset);
                                    }}
                                    className="text-rose-500 hover:text-rose-700 transition-colors">
                                    Clear All
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
