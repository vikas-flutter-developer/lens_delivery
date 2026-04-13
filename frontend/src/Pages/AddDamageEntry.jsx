import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import ReactDOM from "react-dom";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
    createDamageEntry,
    getDamageEntry,
    updateDamageEntry,
    getNextDamageBillNo,
} from "../controllers/DamageEntry.controller";
import { getAllAccounts } from "../controllers/Account.controller";

// ─── helpers ────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);

const blankItem = () => ({
    _key: Math.random().toString(36).slice(2),
    code: "",
    itemName: "",
    partyName: "",
    orderNo: "",
    eye: "",
    sph: "",
    cyl: "",
    axis: "",
    add: "",
    qty: "",
    price: "",
    totalAmt: "",
    combinationId: "",
});

// ─── Portal Dropdown ─────────────────────────────────────────────────────────
function PortalDropdown({ anchorRef, show, children }) {
    const [style, setStyle] = useState({});

    useEffect(() => {
        if (!show || !anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        setStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 300),
            zIndex: 99999,
        });
    }, [show, anchorRef]);

    if (!show) return null;

    return ReactDOM.createPortal(
        <div
            style={style}
            className="bg-white border border-blue-200 rounded-xl shadow-2xl overflow-hidden"
        >
            {children}
        </div>,
        document.body
    );
}

// ────────────────────────────────────────────────────────────────────────────
export default function AddDamageEntry() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    // ── header state ──
    const [header, setHeader] = useState({
        billSeries: "DMG",
        billNo: "",
        date: todayISO(),
        type: "Damage",
        godown: "HO",
        remark: "",
    });

    // ── items state ──
    const [items, setItems] = useState([blankItem()]);

    // ── item-name dropdown state (per-row) ──
    const [allLens, setAllLens] = useState([]);         // all lens products from DB
    const [itemQueries, setItemQueries] = useState({}); // { [idx]: string }
    const [showItemDD, setShowItemDD] = useState({});   // { [idx]: boolean }
    
    // -- party dropdown state --
    const [allAccounts, setAllAccounts] = useState([]);
    const [partyQueries, setPartyQueries] = useState({});
    const [showPartyDD, setShowPartyDD] = useState({});
    const partyInputRefs = useRef({});

    const [saving, setSaving] = useState(false);

    // Refs for each item-name input (for portal positioning)
    const inputRefs = useRef({});

    // ── load all lens products via correct API ──
    useEffect(() => {
        getAllLensPower()
            .then((res) => {
                const arr = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setAllLens(arr);
            })
            .catch(() => setAllLens([]));

        getAllAccounts()
            .then((res) => {
                const arr = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
                setAllAccounts(arr);
            })
            .catch(() => setAllAccounts([]));
    }, []);

    // ── auto-fill bill number (only on new entry) ──
    useEffect(() => {
        if (isEdit) return;
        getNextDamageBillNo(header.billSeries).then((no) =>
            setHeader((h) => ({ ...h, billNo: String(no) }))
        );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── load existing entry for edit ──
    useEffect(() => {
        if (!isEdit) return;
        (async () => {
            const res = await getDamageEntry(id);
            if (res.success && res.data) {
                const d = res.data;
                setHeader({
                    billSeries: d.billSeries || "DMG",
                    billNo: d.billNo || "",
                    date: d.date ? d.date.slice(0, 10) : todayISO(),
                    type: d.type || "Damage",
                    godown: d.godown || "HO",
                    remark: d.remark || "",
                });
                const mapped = (d.items || []).map((it) => ({
                    _key: Math.random().toString(36).slice(2),
                    code: it.code || "",
                    itemName: it.itemName || "",
                    partyName: it.partyName || "",
                    orderNo: it.orderNo || "",
                    eye: it.eye || "",
                    sph: it.sph != null ? String(it.sph) : "",
                    cyl: it.cyl != null ? String(it.cyl) : "",
                    axis: it.axis != null ? String(it.axis) : "",
                    add: it.add != null ? String(it.add) : "",
                    qty: it.qty != null ? String(it.qty) : "",
                    price: it.price != null ? String(it.price) : "",
                    totalAmt: it.totalAmt != null ? String(it.totalAmt) : "",
                    combinationId: it.combinationId || "",
                }));
                setItems(mapped);
                // Pre-fill item queries for edit mode display
                const iq = {};
                const pq = {};
                mapped.forEach((it, i) => { 
                    iq[i] = it.itemName; 
                    pq[i] = it.partyName;
                });
                setItemQueries(iq);
                setPartyQueries(pq);
            }
        })();
    }, [isEdit, id]);

    // ── header change ──
    const onHeaderChange = (field, value) => {
        setHeader((h) => ({ ...h, [field]: value }));
        if (field === "billSeries") {
            getNextDamageBillNo(value).then((no) =>
                setHeader((h) => ({ ...h, billNo: String(no) }))
            );
        }
    };

    // ── item row helpers ──
    const addRow = () => setItems((prev) => [...prev, blankItem()]);

    const deleteRow = (idx) =>
        setItems((prev) =>
            prev.length === 1 ? [blankItem()] : prev.filter((_, i) => i !== idx)
        );

    const updateItem = (idx, field, value) => {
        setItems((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            // auto-calc total when qty or price changes
            if (field === "qty" || field === "price") {
                const q = parseFloat(field === "qty" ? value : next[idx].qty) || 0;
                const p = parseFloat(field === "price" ? value : next[idx].price) || 0;
                next[idx].totalAmt = (q * p).toFixed(2);
            }
            return next;
        });
    };

    // -- party dropdown helpers --
    const getFilteredParties = useCallback(
        (query) => {
            const q = (query || "").trim().toLowerCase();
            if (!q) return allAccounts.slice(0, 40);
            return allAccounts
                .filter((acc) =>
                    String(acc.Name || "").toLowerCase().includes(q)
                )
                .slice(0, 60);
        },
        [allAccounts]
    );

    const onPartyNameFocus = (idx) => {
        const q = partyQueries[idx] ?? items[idx]?.partyName ?? "";
        setPartyQueries((p) => ({ ...p, [idx]: q }));
        setShowPartyDD((p) => ({ ...p, [idx]: true }));
    };

    const onPartyNameChange = (idx, value) => {
        setPartyQueries((p) => ({ ...p, [idx]: value }));
        updateItem(idx, "partyName", value);
        setShowPartyDD((p) => ({ ...p, [idx]: true }));
    };

    const onPartyNameBlur = (idx) => {
        setTimeout(() => {
            setShowPartyDD((p) => ({ ...p, [idx]: false }));
            // Auto-save if editing
            if (isEdit && items[idx]?.partyName !== partyQueries[idx]) {
                handleSave();
            }
        }, 220);
    };

    const selectParty = (idx, party) => {
        const name = party.Name || "";
        updateItem(idx, "partyName", name);
        setPartyQueries((p) => ({ ...p, [idx]: name }));
        setShowPartyDD((p) => ({ ...p, [idx]: false }));
    };
    const getFilteredLens = useCallback(
        (query) => {
            const q = (query || "").trim().toLowerCase();
            if (!q) return allLens.slice(0, 40);
            return allLens
                .filter((l) =>
                    String(l.productName || "").toLowerCase().includes(q)
                )
                .slice(0, 60);
        },
        [allLens]
    );

    const onItemNameFocus = (idx) => {
        const q = itemQueries[idx] ?? items[idx]?.itemName ?? "";
        setItemQueries((p) => ({ ...p, [idx]: q }));
        setShowItemDD((p) => ({ ...p, [idx]: true }));
    };

    const onItemNameChange = (idx, value) => {
        setItemQueries((p) => ({ ...p, [idx]: value }));
        updateItem(idx, "itemName", value);
        setShowItemDD((p) => ({ ...p, [idx]: true }));
    };

    const onItemNameBlur = (idx) => {
        // Delay so mouse-click on dropdown fires first
        setTimeout(() => setShowItemDD((p) => ({ ...p, [idx]: false })), 220);
    };

    const selectLens = (idx, lens) => {
        const name = lens.productName || "";
        const unit = lens.unit || "";
        // Try to get salePrice from lens group
        let price = "";
        const sp = lens.salePrice;
        if (sp && typeof sp === "object" && sp.default != null) {
            price = String(sp.default);
        } else if (typeof sp === "number") {
            price = String(sp);
        }

        setItems((prev) => {
            const next = [...prev];
            const q = parseFloat(next[idx].qty) || 0;
            const p = parseFloat(price) || 0;
            next[idx] = {
                ...next[idx],
                itemName: name,
                price,
                totalAmt: q && p ? (q * p).toFixed(2) : next[idx].totalAmt,
            };
            return next;
        });
        setItemQueries((p) => ({ ...p, [idx]: name }));
        setShowItemDD((p) => ({ ...p, [idx]: false }));
    };

    // ── grand totals ──
    const grandQty = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
    const grandAmt = items.reduce((s, it) => s + (parseFloat(it.totalAmt) || 0), 0);

    // ── save ──
    const handleSave = async () => {
        if (!header.billNo) { toast.error("Bill No is required"); return; }
        const validItems = items.filter((it) => it.itemName.trim());
        if (!validItems.length) { toast.error("Add at least one item"); return; }
        setSaving(true);
        try {
            const payload = {
                ...header,
                items: validItems.map((it) => ({
                    code: it.code || "",
                    itemName: it.itemName,
                    partyName: it.partyName || "",
                    orderNo: it.orderNo || "",
                    eye: it.eye || "",
                    sph: Number(it.sph) || 0,
                    cyl: Number(it.cyl) || 0,
                    axis: Number(it.axis) || 0,
                    add: Number(it.add) || 0,
                    qty: Number(it.qty) || 0,
                    price: Number(it.price) || 0,
                    totalAmt: Number(it.totalAmt) || 0,
                    combinationId: it.combinationId || "",
                })),
            };
            const res = isEdit
                ? await updateDamageEntry(id, payload)
                : await createDamageEntry(payload);

            if (res.success) {
                toast.success(isEdit ? "Entry updated!" : "Entry saved!");
                navigate("/lenstransaction/damageandshrinkage");
            } else {
                toast.error(res.error || "Save failed");
            }
        } finally {
            setSaving(false);
        }
    };

    const inputCls =
        "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white";
    const labelFloat =
        "absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500 pointer-events-none";
    const cellInput =
        "w-full px-1.5 py-1.5 border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded text-xs outline-none bg-transparent";

    return (
        <div className="p-4 bg-slate-50 min-h-screen font-sans">
            <div className="max-w-[99vw] mx-auto">

                {/* ─── Page Header ─── */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/lenstransaction/damageandshrinkage")}
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">
                                {isEdit ? "Edit Damage Entry" : "Add Damage Entry"}
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {isEdit
                                    ? "Modify existing record"
                                    : "Create a new damage / shrinkage record"}
                            </p>
                        </div>
                    </div>

                </div>

                {/* ─── Bill Header ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow p-5 mb-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {/* Bill Series */}
                        <div className="relative">
                            <input
                                className={inputCls}
                                value={header.billSeries}
                                onChange={(e) => onHeaderChange("billSeries", e.target.value)}
                            />
                            <label className={labelFloat}>Bill Series</label>
                        </div>
                        {/* Bill No */}
                        <div className="relative">
                            <input
                                className={inputCls}
                                value={header.billNo}
                                onChange={(e) => onHeaderChange("billNo", e.target.value)}
                            />
                            <label className={labelFloat}>Bill No</label>
                        </div>
                        {/* Date */}
                        <div className="relative">
                            <input
                                type="date"
                                className={inputCls}
                                value={header.date}
                                onChange={(e) => onHeaderChange("date", e.target.value)}
                            />
                            <label className={labelFloat}>Date</label>
                        </div>
                        {/* Type */}
                        <div className="relative">
                            <select
                                className={inputCls}
                                value={header.type}
                                onChange={(e) => onHeaderChange("type", e.target.value)}
                            >
                                <option value="Damage">Damage</option>
                                <option value="Shrinkage">Shrinkage</option>
                            </select>
                            <label className={labelFloat}>Type</label>
                        </div>
                        {/* Godown */}
                        <div className="relative">
                            <select
                                className={inputCls}
                                value={header.godown}
                                onChange={(e) => onHeaderChange("godown", e.target.value)}
                            >
                                <option value="HO">HO</option>
                                <option value="Branch">Branch</option>
                                <option value="Main Store">Main Store</option>
                                <option value="Branch Store">Branch Store</option>
                            </select>
                            <label className={labelFloat}>Godown</label>
                        </div>
                        {/* Remark */}
                        <div className="relative">
                            <input
                                className={inputCls}
                                value={header.remark}
                                onChange={(e) => onHeaderChange("remark", e.target.value)}
                                placeholder="Optional remark"
                            />
                            <label className={labelFloat}>Remark</label>
                        </div>
                    </div>
                </div>

                {/* ─── Items Table ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">
                            Particular
                        </h2>
                        <button
                            onClick={addRow}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Row
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wide">
                                    <th className="py-3 px-2 text-center w-9 border-r border-slate-200">SN</th>
                                    <th className="py-3 px-2 text-center w-20 border-r border-slate-200">Code</th>
                                    <th className="py-3 px-2 text-left min-w-[220px] border-r border-slate-200">Item Name</th>
                                    <th className="py-3 px-2 text-left min-w-[200px] border-r border-slate-200">Party Name</th>
                                    <th className="py-3 px-2 text-center w-24 border-r border-slate-200">Order No</th>
                                    <th className="py-3 px-2 text-center w-16 border-r border-slate-200">Eye</th>
                                    <th className="py-3 px-2 text-center w-16 border-r border-slate-200">SPH</th>
                                    <th className="py-3 px-2 text-center w-16 border-r border-slate-200">CYL</th>
                                    <th className="py-3 px-2 text-center w-16 border-r border-slate-200">Axis</th>
                                    <th className="py-3 px-2 text-center w-16 border-r border-slate-200">Add</th>
                                    <th className="py-3 px-2 text-center w-16 border-r border-slate-200">Qty</th>
                                    <th className="py-3 px-2 text-center w-20 border-r border-slate-200">Price</th>
                                    <th className="py-3 px-2 text-center w-24 border-r border-slate-200">Total Amt</th>
                                    <th className="py-3 px-2 text-center w-9"></th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => {
                                    const suggestions = getFilteredLens(itemQueries[idx]);
                                    const showDD = showItemDD[idx] === true;

                                    // Ensure ref map entry
                                    if (!inputRefs.current[idx]) {
                                        inputRefs.current[idx] = React.createRef();
                                    }

                                    return (
                                        <tr key={item._key} className="hover:bg-slate-50/60 transition">
                                            {/* SN */}
                                            <td className="py-1.5 px-2 text-center text-slate-500 text-xs font-semibold border-r border-slate-100">
                                                {idx + 1}
                                            </td>
                                            {/* Code */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    className={cellInput}
                                                    value={item.code}
                                                    onChange={(e) => updateItem(idx, "code", e.target.value)}
                                                />
                                            </td>

                                            {/* Item Name cell — input + portal dropdown */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    ref={inputRefs.current[idx]}
                                                    className={`${cellInput} placeholder:text-slate-400 font-medium`}
                                                    value={itemQueries[idx] ?? item.itemName}
                                                    onChange={(e) => onItemNameChange(idx, e.target.value)}
                                                    onFocus={() => onItemNameFocus(idx)}
                                                    onBlur={() => onItemNameBlur(idx)}
                                                    autoComplete="off"
                                                    placeholder="🔍  Search item…"
                                                />
                                                <PortalDropdown anchorRef={inputRefs.current[idx]} show={showDD}>
                                                    {/* Dropdown header */}
                                                    <div className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5">
                                                        <span>🔍</span>
                                                        <span>
                                                            {allLens.length === 0
                                                                ? "Loading items…"
                                                                : `${suggestions.length} item${suggestions.length !== 1 ? "s" : ""} found`}
                                                        </span>
                                                    </div>
                                                    {/* Item list */}
                                                    <div className="max-h-64 overflow-y-auto">
                                                        {suggestions.length === 0 ? (
                                                            <div className="px-4 py-6 text-sm text-slate-400 text-center">
                                                                {allLens.length === 0 ? "Loading…" : "No items match your search"}
                                                            </div>
                                                        ) : (
                                                            suggestions.map((lens, si) => (
                                                                <div
                                                                    key={lens._id || si}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault(); // prevent blur before click
                                                                        selectLens(idx, lens);
                                                                    }}
                                                                    className="px-4 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 last:border-0 flex items-center gap-2 transition-colors"
                                                                >
                                                                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span>
                                                                    {lens.productName}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </PortalDropdown>
                                            </td>

                                            {/* Party Name cell — input + portal dropdown */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    ref={(el) => (partyInputRefs.current[idx] = { current: el })}
                                                    className={`${cellInput} placeholder:text-slate-400 font-medium`}
                                                    value={partyQueries[idx] ?? item.partyName}
                                                    onChange={(e) => onPartyNameChange(idx, e.target.value)}
                                                    onFocus={() => onPartyNameFocus(idx)}
                                                    onBlur={() => onPartyNameBlur(idx)}
                                                    autoComplete="off"
                                                    placeholder="🔍  Search party…"
                                                />
                                                <PortalDropdown anchorRef={partyInputRefs.current[idx]} show={showPartyDD[idx] === true}>
                                                    <div className="px-3 py-2 bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5">
                                                        <span>🔍</span>
                                                        <span>
                                                            {allAccounts.length === 0
                                                                ? "Loading parties…"
                                                                : `${getFilteredParties(partyQueries[idx]).length} part${getFilteredParties(partyQueries[idx]).length !== 1 ? "ies" : "y"} found`}
                                                        </span>
                                                    </div>
                                                    <div className="max-h-64 overflow-y-auto">
                                                        {getFilteredParties(partyQueries[idx]).length === 0 ? (
                                                            <div className="px-4 py-6 text-sm text-slate-400 text-center">
                                                                {allAccounts.length === 0 ? "Loading…" : "No parties match your search"}
                                                            </div>
                                                        ) : (
                                                            getFilteredParties(partyQueries[idx]).map((party, pi) => (
                                                                <div
                                                                    key={party._id || pi}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        selectParty(idx, party);
                                                                    }}
                                                                    className="px-4 py-2.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 hover:text-slate-900 border-b border-slate-100 last:border-0 flex items-center gap-2 transition-colors"
                                                                >
                                                                    <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span>
                                                                    {party.Name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </PortalDropdown>
                                            </td>

                                            {/* Order No */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    className={`${cellInput} text-center`}
                                                    value={item.orderNo}
                                                    onChange={(e) => updateItem(idx, "orderNo", e.target.value)}
                                                />
                                            </td>
                                            {/* Eye */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <select
                                                    className={`${cellInput} text-center`}
                                                    value={item.eye}
                                                    onChange={(e) => updateItem(idx, "eye", e.target.value)}
                                                >
                                                    <option value="">-</option>
                                                    <option value="R">R</option>
                                                    <option value="L">L</option>
                                                    <option value="RL">RL</option>
                                                </select>
                                            </td>
                                            {/* SPH */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    className={`${cellInput} text-center`}
                                                    value={item.sph}
                                                    onChange={(e) => updateItem(idx, "sph", e.target.value)}
                                                />
                                            </td>
                                            {/* CYL */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    className={`${cellInput} text-center`}
                                                    value={item.cyl}
                                                    onChange={(e) => updateItem(idx, "cyl", e.target.value)}
                                                />
                                            </td>
                                            {/* Axis */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    className={`${cellInput} text-center`}
                                                    value={item.axis}
                                                    onChange={(e) => updateItem(idx, "axis", e.target.value)}
                                                />
                                            </td>
                                            {/* Add */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    className={`${cellInput} text-center`}
                                                    value={item.add}
                                                    onChange={(e) => updateItem(idx, "add", e.target.value)}
                                                />
                                            </td>
                                            {/* Qty */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    type="number"
                                                    className={`${cellInput} text-center`}
                                                    value={item.qty}
                                                    onChange={(e) => updateItem(idx, "qty", e.target.value)}
                                                    min="0"
                                                />
                                            </td>
                                            {/* Price */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    type="number"
                                                    className={`${cellInput} text-right`}
                                                    value={item.price}
                                                    onChange={(e) => updateItem(idx, "price", e.target.value)}
                                                    min="0"
                                                />
                                            </td>
                                            {/* Total Amt (read-only) */}
                                            <td className="py-1.5 px-1 border-r border-slate-100">
                                                <input
                                                    readOnly
                                                    tabIndex={-1}
                                                    className="w-full px-1.5 py-1.5 border border-transparent rounded text-xs outline-none bg-slate-50 text-right font-semibold text-slate-700"
                                                    value={
                                                        item.totalAmt !== ""
                                                            ? Number(item.totalAmt).toFixed(2)
                                                            : ""
                                                    }
                                                />
                                            </td>
                                            {/* Delete */}
                                            <td className="py-1.5 px-1 text-center">
                                                <button
                                                    onClick={() => deleteRow(idx)}
                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                    title="Delete row"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>

                            {/* Totals footer */}
                            <tfoot>
                                <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold text-sm">
                                    <td colSpan={11} className="py-3 px-3 text-right text-slate-700">
                                        Grand Total
                                    </td>
                                    <td className="py-3 px-2 text-center text-blue-800">
                                        {grandQty}
                                    </td>
                                    <td className="py-3 px-2" />
                                    <td className="py-3 px-2 text-right text-blue-800 pr-3">
                                        ₹{grandAmt.toFixed(2)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Bottom bar */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <button
                            onClick={addRow}
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                            <Plus className="w-4 h-4" /> Add Row
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition disabled:opacity-60"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving…" : "Save Entry"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
