import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, RotateCcw, Save, Filter, Search } from "lucide-react";
import { toast } from "react-hot-toast";

const BulkLensMatrixV2 = ({ product, onClose, onAddItems, baseItem, priceKey = "salePrice" }) => {
    // --- Range State ---
    const [filters, setFilters] = useState({
        sphFrom: 0,
        sphTo: 0,
        cylFrom: 0,
        cylTo: 0,
        addFrom: 0,
        addTo: 0,
        eye: "R/L",
    });

    // --- Matrix State ---
    const [matrixData, setMatrixData] = useState({});

    // Helper to generate steps
    const generateRange = (start, end, step = 0.25) => {
        const fullList = [];
        const s = parseFloat(start);
        const e = parseFloat(end);
        if (isNaN(s) || isNaN(e)) return [];
        const minVal = Math.min(s, e);
        const maxVal = Math.max(s, e);
        for (let i = minVal; i <= maxVal + 0.0001; i += step) {
            fullList.push(parseFloat(i.toFixed(2)));
        }
        const zeroVal = fullList.filter(v => v === 0);
        const negativeVals = fullList.filter(v => v < 0).sort((a, b) => b - a);
        const positiveVals = fullList.filter(v => v > 0).sort((a, b) => a - b);
        return [...zeroVal, ...negativeVals, ...positiveVals].map(v => v.toFixed(2));
    };

    // Initialize ranges based on product data
    useEffect(() => {
        if (!product) return;
        const sphSet = new Set();
        const cylSet = new Set();
        const addSet = new Set();
        const addGroups = Array.isArray(product.addGroups) ? product.addGroups : [];
        
        // Initial matrix data for axes
        const initialAxes = {};

        addGroups.forEach((ag) => {
            if (ag.addValue !== undefined) addSet.add(parseFloat(ag.addValue));
            const combos = Array.isArray(ag.combinations) ? ag.combinations : [];
            combos.forEach((c) => {
                if (c.sph !== undefined) sphSet.add(parseFloat(c.sph));
                if (c.cyl !== undefined) cylSet.add(parseFloat(c.cyl));
                
                // Collect default axis for each SPH/CYL combo
                const key = `${parseFloat(c.sph).toFixed(2)}_${parseFloat(c.cyl).toFixed(2)}`;
                if (c.axis && !initialAxes[key]) {
                  initialAxes[key] = c.axis;
                }
            });
        });
        
        const sphs = Array.from(sphSet).sort((a, b) => a - b);
        const cyls = Array.from(cylSet).sort((a, b) => a - b);
        const adds = Array.from(addSet).sort((a, b) => a - b);
        
        if (sphs.length) setFilters(prev => ({ ...prev, sphFrom: sphs[0], sphTo: sphs[sphs.length - 1] }));
        if (cyls.length) setFilters(prev => ({
            ...prev,
            cylFrom: Math.min(...cyls),
            cylTo: Math.max(...cyls)
        }));
        if (adds.length) setFilters(prev => ({
            ...prev,
            addFrom: Math.min(...adds),
            addTo: Math.max(...adds)
        }));

        // Populate matrixData with default axes
        const newMatrixData = {};
        Object.entries(initialAxes).forEach(([key, axis]) => {
          newMatrixData[key] = { axis: axis, adds: {} };
        });
        setMatrixData(newMatrixData);

    }, [product]);

    // Generate rows/cols
    const sphRows = useMemo(() => generateRange(filters.sphFrom, filters.sphTo, 0.25), [filters.sphFrom, filters.sphTo]);
    const cylRows = useMemo(() => generateRange(filters.cylFrom, filters.cylTo, 0.25), [filters.cylFrom, filters.cylTo]);
    const addCols = useMemo(() => generateRange(filters.addFrom, filters.addTo, 0.25), [filters.addFrom, filters.addTo]);

    // ── Key decision: does this product have meaningful ADD values? ──
    const hasAdd = useMemo(() => addCols.some(a => Math.abs(parseFloat(a)) > 0.001), [addCols]);

    // For WITH-ADD layout: rows = SPH × CYL combinations
    const matrixRows = useMemo(() => {
        const rows = [];
        sphRows.forEach(sph => {
            cylRows.forEach(cyl => {
                rows.push({ sph, cyl });
            });
        });
        return rows;
    }, [sphRows, cylRows]);

    const handleQtyChange = (sph, cyl, add, val) => {
        const rowKey = `${sph}_${cyl}`;
        setMatrixData(prev => {
            const row = prev[rowKey] || { axis: "", adds: {} };
            const newAdds = { ...row.adds, [add]: val };
            return { ...prev, [rowKey]: { ...row, adds: newAdds } };
        });
    };

    const handleAxisChange = (sph, cyl, val) => {
        const rowKey = `${sph}_${cyl}`;
        setMatrixData(prev => {
            const row = prev[rowKey] || { axis: "", adds: {} };
            return { ...prev, [rowKey]: { ...row, axis: val } };
        });
    };

    const getCombinationData = (sph, cyl, add, eye) => {
        if (!product) return { combinationId: "", barcode: "" };
        const tSph = parseFloat(sph);
        const tCyl = parseFloat(cyl);
        const tAdd = parseFloat(add);
        const tEyeNorm = String(eye || "").toUpperCase().replace(/[\/\s]/g, "");
        const addGroups = Array.isArray(product.addGroups) ? product.addGroups : [];
        for (const ag of addGroups) {
            if (Math.abs(parseFloat(ag.addValue) - tAdd) < 0.001) {
                const combos = ag.combinations || [];
                for (const c of combos) {
                    const cSph = parseFloat(c.sph);
                    const cCyl = parseFloat(c.cyl);
                    const cEyeNorm = String(c.eye || "").toUpperCase().replace(/[\/\s]/g, "");
                    const eyeMatch = tEyeNorm === "RL"
                        ? (cEyeNorm === "RL" || cEyeNorm === "BOTH" || cEyeNorm === "")
                        : (cEyeNorm === tEyeNorm || cEyeNorm === "RL" || cEyeNorm === "BOTH" || cEyeNorm === "");
                    if (cSph === tSph && cCyl === tCyl && eyeMatch) {
                        return { combinationId: c._id || "", barcode: c.barcode || "" };
                    }
                }
            }
        }
        return { combinationId: "", barcode: "" };
    };

    const handleGenerate = () => { toast.success("Matrix Updated"); };
    const handleReset = () => { setMatrixData({}); toast.success("Matrix Cleared"); };

    const handleSubmit = () => {
        const items = [];
        // For no-ADD mode, iterate sph×cyl with fixed add="0.00"
        if (!hasAdd) {
            sphRows.forEach(sph => {
                cylRows.forEach(cyl => {
                    const rowKey = `${sph}_${cyl}`;
                    const data = matrixData[rowKey];
                    const fixedAdd = addCols[0] || "0.00";
                    const qtyStr = data?.adds?.[fixedAdd];
                    const qty = parseFloat(qtyStr);
                    if (qty > 0) {
                        const { combinationId, barcode } = getCombinationData(sph, cyl, fixedAdd, filters.eye);
                        const price = parseFloat(baseItem[priceKey] || 0);
                        const discount = parseFloat(baseItem.discount || 0);
                        items.push({
                            ...baseItem,
                            id: Date.now() + Math.random(),
                            barcode: barcode || "",
                            sph: parseFloat(sph).toFixed(2),
                            cyl: parseFloat(cyl).toFixed(2),
                            axis: data?.axis || baseItem.axis || "",
                            add: parseFloat(fixedAdd).toFixed(2),
                            qty,
                            eye: filters.eye,
                            combinationId: combinationId || "",
                            totalAmount: (qty * price * (1 - discount / 100)).toFixed(2)
                        });
                    }
                });
            });
        } else {
            Object.entries(matrixData).forEach(([rowKey, data]) => {
                const [sph, cyl] = rowKey.split("_");
                const { axis, adds } = data;
                Object.entries(adds).forEach(([add, qtyStr]) => {
                    const qty = parseFloat(qtyStr);
                    if (qty > 0) {
                        const { combinationId, barcode } = getCombinationData(sph, cyl, add, filters.eye);
                        const price = parseFloat(baseItem[priceKey] || 0);
                        const discount = parseFloat(baseItem.discount || 0);
                        items.push({
                            ...baseItem,
                            id: Date.now() + Math.random(),
                            barcode: barcode || "",
                            sph: parseFloat(sph).toFixed(2),
                            cyl: parseFloat(cyl).toFixed(2),
                            axis: axis || baseItem.axis || "",
                            add: parseFloat(add).toFixed(2),
                            qty,
                            eye: filters.eye,
                            combinationId: combinationId || "",
                            totalAmount: (qty * price * (1 - discount / 100)).toFixed(2)
                        });
                    }
                });
            });
        }

        if (items.length === 0) {
            toast.error("No items entered");
            return;
        }
        onAddItems(items);
        onClose();
    };

    // Arrow-key / Enter navigation
    const handleMatrixKeyDown = (e, rowIdx, colIdx) => {
        let targetRow = rowIdx;
        let targetCol = colIdx;
        const totalCols = hasAdd ? addCols.length : cylRows.length;

        if (e.key === "Enter") {
            e.preventDefault();
            targetRow++;
            if (targetRow >= (hasAdd ? matrixRows.length : sphRows.length)) {
                targetRow = 0;
                targetCol++;
            }
        } else if (e.key === "ArrowDown") { targetRow++; }
        else if (e.key === "ArrowUp") { targetRow--; }
        else if (e.key === "ArrowRight") { targetCol++; }
        else if (e.key === "ArrowLeft") { targetCol--; }
        else { return; }

        const nextInput = document.querySelector(`[data-matrix-input][data-row="${targetRow}"][data-col="${targetCol}"]`);
        if (nextInput) {
            e.preventDefault();
            nextInput.focus();
            if (nextInput.select) nextInput.select();
        }
    };

    // Totals (work for both layouts since matrixData structure is identical)
    const totalItems = Object.values(matrixData).reduce((acc, row) =>
        acc + Object.values(row.adds).filter(v => parseFloat(v) > 0).length, 0);
    const totalQty = Object.values(matrixData).reduce((acc, row) =>
        acc + Object.values(row.adds).reduce((sum, v) => sum + (parseFloat(v) || 0), 0), 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Filter className="w-5 h-5 text-blue-400" />
                            Bulk Lens Order Matrix
                        </h2>
                        <p className="text-slate-400 text-xs mt-0.5">{product?.productName || "Unknown Product"}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters Section */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
                        {/* SPH Range */}
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">SPH From</label>
                            <input type="number" step="0.25" value={filters.sphFrom}
                                onChange={e => setFilters(p => ({ ...p, sphFrom: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none" />
                        </div>
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">SPH To</label>
                            <input type="number" step="0.25" value={filters.sphTo}
                                onChange={e => setFilters(p => ({ ...p, sphTo: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none" />
                        </div>

                        {/* CYL Range */}
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CYL From</label>
                            <input type="number" step="0.25" value={filters.cylFrom}
                                onChange={e => setFilters(p => ({ ...p, cylFrom: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none" />
                        </div>
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CYL To</label>
                            <input type="number" step="0.25" value={filters.cylTo}
                                onChange={e => setFilters(p => ({ ...p, cylTo: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none" />
                        </div>

                        {/* ADD Range */}
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ADD From</label>
                            <input type="number" step="0.25" min="0" value={filters.addFrom}
                                onChange={e => setFilters(p => ({ ...p, addFrom: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none" />
                        </div>
                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ADD To</label>
                            <input type="number" step="0.25" min="0" value={filters.addTo}
                                onChange={e => setFilters(p => ({ ...p, addTo: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 outline-none" />
                        </div>

                        {/* Show Button */}
                        <div className="col-span-1">
                            <button onClick={handleGenerate}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded text-sm transition-colors flex items-center justify-center gap-1">
                                <Search className="w-3 h-3" /> Show
                            </button>
                        </div>
                    </div>

                    {/* Eye Selector + Layout Badge */}
                    <div className="flex items-center gap-4 border-t border-slate-200 pt-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Select Eye:</span>
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                            {["R/L", "R", "L"].map(e => (
                                <button
                                    key={e}
                                    onClick={() => setFilters(prev => ({ ...prev, eye: e }))}
                                    className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${filters.eye === e
                                        ? "bg-slate-800 text-white shadow-sm"
                                        : "text-slate-500 hover:bg-slate-100"
                                        }`}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full ${hasAdd
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-emerald-100 text-emerald-700"
                            }`}>
                            {hasAdd ? "SPH+CYL × ADD  Mode" : "SPH × CYL  Mode"}
                        </span>
                    </div>
                </div>

                {/* Matrix Table */}
                <div className="flex-1 overflow-auto bg-slate-100 p-4">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-fit">
                        {hasAdd ? (
                            /* ─── WITH-ADD LAYOUT: SPH+CYL rows × ADD columns ─── */
                            <table className="w-full border-collapse text-sm">
                                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-slate-200 w-20 text-center font-bold bg-slate-100">SPH</th>
                                        <th className="px-3 py-2 border-b border-r border-slate-200 w-20 text-center font-bold bg-slate-100">CYL</th>
                                        <th className="px-3 py-2 border-b border-r border-slate-200 w-24 text-center font-bold bg-slate-100">AXIS</th>
                                        {addCols.map(add => (
                                            <th key={add} className="px-3 py-2 border-b border-r border-slate-200 min-w-[80px] text-center font-bold">
                                                ADD {Number(add).toFixed(2)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {matrixRows.map((row, idx) => {
                                        const rowKey = `${row.sph}_${row.cyl}`;
                                        const rowData = matrixData[rowKey] || { axis: "", adds: {} };
                                        return (
                                            <tr key={rowKey} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-700 bg-slate-50/50">
                                                    {Number(row.sph).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-700 bg-slate-50/50">
                                                    {Number(row.cyl).toFixed(2)}
                                                </td>
                                                <td className="p-1 border-r border-slate-100">
                                                    <input type="text" placeholder="Axis" value={rowData.axis}
                                                        onChange={e => handleAxisChange(row.sph, row.cyl, e.target.value)}
                                                        onKeyDown={e => handleMatrixKeyDown(e, idx, 0)}
                                                        data-matrix-input data-row={idx} data-col={0}
                                                        className="w-full h-8 text-center bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-400 rounded outline-none text-xs font-semibold" />
                                                </td>
                                                {addCols.map((add, addIdx) => {
                                                    const qty = rowData.adds[add] || "";
                                                    const currentCol = addIdx + 1;
                                                    return (
                                                        <td key={add} className="p-1 border-r border-slate-100">
                                                            <input type="number" min="0" placeholder="-" value={qty}
                                                                onChange={e => handleQtyChange(row.sph, row.cyl, add, e.target.value)}
                                                                onKeyDown={e => handleMatrixKeyDown(e, idx, currentCol)}
                                                                data-matrix-input data-row={idx} data-col={currentCol}
                                                                className={`w-full h-8 text-center text-xs font-bold outline-none rounded transition-all focus:ring-2 focus:ring-blue-500/20 ${qty ? "bg-blue-100 text-blue-700" : "bg-transparent hover:bg-slate-50"}`} />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            /* ─── NO-ADD LAYOUT: SPH rows × CYL columns ─── */
                            <table className="w-full border-collapse text-sm">
                                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2.5 border-b border-r border-slate-200 min-w-[70px] text-center font-bold bg-slate-100 text-xs">
                                            SPH ╲ CYL
                                        </th>
                                        {cylRows.map(cyl => (
                                            <th key={cyl} className="px-2 py-2.5 border-b border-r border-slate-200 min-w-[64px] text-center font-bold text-xs text-blue-700 bg-blue-50/60">
                                                {Number(cyl).toFixed(2)}
                                            </th>
                                        ))}
                                        <th className="px-3 py-2.5 border-b border-slate-200 min-w-[56px] text-center font-bold text-xs bg-emerald-50 text-emerald-700">
                                            Row Σ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sphRows.map((sph, sphIdx) => {
                                        const fixedAdd = addCols[0] || "0.00";
                                        const rowSum = cylRows.reduce((sum, cyl) => {
                                            const qty = parseFloat(matrixData[`${sph}_${cyl}`]?.adds?.[fixedAdd]) || 0;
                                            return sum + qty;
                                        }, 0);
                                        return (
                                            <tr key={sph} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-700 bg-slate-50/80 text-xs sticky left-0 z-10">
                                                    {Number(sph).toFixed(2)}
                                                </td>
                                                {cylRows.map((cyl, cylIdx) => {
                                                    const rowKey = `${sph}_${cyl}`;
                                                    const qty = matrixData[rowKey]?.adds?.[fixedAdd] || "";
                                                    return (
                                                        <td key={cyl} className="p-1 border-r border-slate-100">
                                                            <input
                                                                type="number" min="0" placeholder="-"
                                                                value={qty}
                                                                onChange={e => handleQtyChange(sph, cyl, fixedAdd, e.target.value)}
                                                                onKeyDown={e => handleMatrixKeyDown(e, sphIdx, cylIdx)}
                                                                data-matrix-input data-row={sphIdx} data-col={cylIdx}
                                                                className={`w-full h-8 text-center text-xs font-bold outline-none rounded transition-all focus:ring-2 focus:ring-blue-500/20 ${qty ? "bg-blue-100 text-blue-700" : "bg-transparent hover:bg-slate-50"}`}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                                <td className={`px-3 py-2 border-l border-slate-200 text-center font-black text-xs ${rowSum > 0 ? "text-emerald-700 bg-emerald-50" : "text-slate-300 bg-emerald-50/30"}`}>
                                                    {rowSum || 0}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {(hasAdd ? matrixRows : sphRows).length === 0 && (
                        <div className="text-center py-20 text-slate-400 font-medium">
                            Adjust filters and click Show to view matrix
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="flex gap-4 text-sm font-medium text-slate-600">
                        <div className="flex items-center gap-2">
                            <span>Total Items:</span>
                            <span className="font-bold text-slate-900">{totalItems}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Total Qty:</span>
                            <span className="font-bold text-slate-900">{totalQty}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleReset}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold text-sm flex items-center gap-2">
                            <RotateCcw className="w-4 h-4" /> Reset
                        </button>
                        <button onClick={handleSubmit}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 font-bold text-sm tracking-wide active:scale-95 transition-all">
                            <Plus className="w-4 h-4" /> Add Items
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BulkLensMatrixV2;
