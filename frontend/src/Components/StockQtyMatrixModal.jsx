import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Save, RotateCcw, Filter, Search, Info, Grid3X3, ChevronDown, Upload } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

/**
 * StockQtyMatrixModal
 * 
 * Props:
 *   - groups      : addGroups array from the LensGroup document
 *   - powerGroups : powerGroups array from the LensGroup document (saved ranges)
 *   - isOpen      : boolean
 *   - onClose     : function
 *   - onSave      : function(editedValues)
 *   - eyeFilter   : string ("R" | "L" | "RL" | "R/L")
 */
const StockQtyMatrixModal = ({ groups, powerGroups = [], isOpen, onClose, onSave, eyeFilter }) => {

    // --- Power Group checkbox state ---
    const [selectedPowerGroups, setSelectedPowerGroups] = useState([]);
    const [pgDropdownOpen, setPgDropdownOpen] = useState(false);
    const pgDropdownRef = useRef(null);

    const [eyeMode, setEyeMode] = useState("RL");
    const [editedValues, setEditedValues] = useState({});
    const [editedBarcodes, setEditedBarcodes] = useState({});
    const [activeInfoCell, setActiveInfoCell] = useState(null);
    const [appliedPowerGroups, setAppliedPowerGroups] = useState([]);
    
    // Track file info and the specific edits it provided
    const [uploadedFile, setUploadedFile] = useState({ name: null, edits: {}, barcodeEdits: {} });

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (pgDropdownRef.current && !pgDropdownRef.current.contains(e.target)) {
                setPgDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Initialize on open
    useEffect(() => {
        if (isOpen && groups && groups.length > 0) {
            setEditedValues({});

            let mappedEye = "RL";
            if (eyeFilter === "R") mappedEye = "R";
            else if (eyeFilter === "L") mappedEye = "L";
            setEyeMode(mappedEye);

            // Reset power group selection — pre-select all if available
            if (powerGroups && powerGroups.length > 0) {
                setSelectedPowerGroups([...powerGroups]);
                setAppliedPowerGroups([...powerGroups]);
            } else {
                setSelectedPowerGroups([]);
                setAppliedPowerGroups([]);
            }
        }
    }, [isOpen, groups, eyeFilter, powerGroups]);

    // When Show is clicked
    const handleGenerate = () => {
        setAppliedPowerGroups([...selectedPowerGroups]);
        toast.success("Matrix Updated");
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // ── Step 1: Read raw rows as arrays to detect the real header row ──
                // (Client files often have a title row like "Lense Configuaration" before headers)
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                // ── Step 2: Scan rows to find the one that contains "SPH" ──
                let headerRowIdx = -1;
                const headerMap = {}; // colIndex → fieldName

                for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
                    const row = rawRows[i];
                    const normalised = row.map(c => String(c ?? "").toUpperCase().trim().replace(/[\s\.]/g, ""));
                    if (normalised.some(c => c === "SPH")) {
                        headerRowIdx = i;
                        normalised.forEach((col, idx) => {
                            if (col === "SPH")                                                          headerMap[idx] = "SPH";
                            else if (col === "CYL")                                                     headerMap[idx] = "CYL";
                            else if (col.startsWith("AXI") || col === "AXIS")                           headerMap[idx] = "AXIS";
                            else if (col === "ADD")                                                     headerMap[idx] = "ADD";
                            else if (col === "EYE")                                                     headerMap[idx] = "EYE";
                            else if (col.includes("QTY") || col.includes("QUANTITY") || col.includes("STOCK")) headerMap[idx] = "QTY";
                            else if (col.includes("BARCODE") || col.includes("BCODE") || col.includes("CODE")) headerMap[idx] = "BARCODE";
                            else {
                                // Matrix-style ADD column e.g. "ADD100" → ADD_1.00
                                const addMatch = col.match(/ADD([+-]?\d+)/);
                                if (addMatch) headerMap[idx] = `ADD_${parseFloat(addMatch[1]) / 100}`;
                            }
                        });
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    toast.error("Cannot find column headers. Ensure the file has an SPH column.");
                    e.target.value = "";
                    return;
                }

                // ── Step 3: Extract data rows ──
                const dataRows = rawRows
                    .slice(headerRowIdx + 1)
                    .filter(row => row.some(c => c !== "" && c !== null && c !== undefined));

                const getField = (row, field) => {
                    const entry = Object.entries(headerMap).find(([, f]) => f === field);
                    return entry ? row[Number(entry[0])] : undefined;
                };

                let importsCount = 0;
                let skippedCount = 0;
                const newFileEdits = {};
                const newBarcodeEdits = {};

                function processCombo(sph, cyl, add, axis, qty, barcode) {
                    if (isNaN(sph) || isNaN(cyl) || isNaN(qty)) return false;
                    const cleanAdd = isNaN(add) ? 0 : add;

                    // Strategy:
                    // • Exact ADD match → use only that group
                    // • ADD = 0 and no group with addValue=0 → fan-out to ALL groups
                    const exactGroup = groups.find(g => Math.abs((parseFloat(g.addValue) || 0) - cleanAdd) < 0.01);
                    const targetGroups = exactGroup
                        ? [exactGroup]
                        : (Math.abs(cleanAdd) < 0.001 ? groups : []);

                    if (targetGroups.length === 0) return false;

                    let anyMatched = false;
                    targetGroups.forEach(group => {
                        const combo = (group.combinations || []).find(c => {
                            const dbSph = parseFloat(c.sph) || 0;
                            const dbCyl = parseFloat(c.cyl) || 0;
                            const dbAxis = parseFloat(c.axis) || 0;
                            
                            const matchesSph = Math.abs(dbSph - sph) < 0.01;
                            const matchesCyl = Math.abs(dbCyl - cyl) < 0.01;
                            
                            // Axis: lenient when axis=0 in file
                            const matchesAxis = (isNaN(axis) || axis === 0)
                                ? true
                                : Math.abs(dbAxis - axis) < 1;
                                
                            if (!matchesSph || !matchesCyl || !matchesAxis) return false;

                            const cEye = (c.eye || "").toUpperCase().replace(/[\/\s]/g, "");
                            if (eyeMode === "RL") return true; // match anything in RL mode
                            const modeNorm = eyeMode.replace(/[\/\s]/g, "");
                            return cEye === modeNorm || cEye === "RL" || cEye === "R/L" || cEye === "" || cEye === "BOTH";
                        });

                        if (combo) {
                            const key = getKey(group._id, combo);
                            if (qty !== undefined && !isNaN(qty)) newFileEdits[key] = qty;
                            if (barcode !== undefined) newBarcodeEdits[key] = barcode;
                            anyMatched = true;
                        }
                    });
                    return anyMatched;
                }

                dataRows.forEach(row => {
                    // Check for matrix-style ADD columns (e.g. ADD_1.00, ADD_1.25)
                    const matrixAddCols = Object.entries(headerMap).filter(([, f]) => f.startsWith("ADD_"));

                    if (matrixAddCols.length > 0) {
                        // Matrix format: one row, multiple ADD columns
                        const sph = parseFloat(getField(row, "SPH"));
                        const cyl = parseFloat(getField(row, "CYL"));
                        const axis = parseFloat(getField(row, "AXIS") ?? 0);
                        matrixAddCols.forEach(([idx, field]) => {
                            const add = parseFloat(field.replace("ADD_", ""));
                            const qty = parseFloat(row[Number(idx)]);
                            // In matrix format, we usually don't have per-ADD barcodes in the same row unless specified.
                            // But if we do have a barcode field, we'll try to use it.
                            const barcode = getField(row, "BARCODE"); 
                            if (!isNaN(qty) && qty > 0) {
                                if (processCombo(sph, cyl, add, axis, qty, barcode)) importsCount++;
                                else skippedCount++;
                            }
                        });
                    } else {
                        // Flat format: one row = one SPH/CYL/ADD combination
                        const sph = parseFloat(getField(row, "SPH"));
                        const cyl = parseFloat(getField(row, "CYL"));
                        const add = parseFloat(getField(row, "ADD") ?? 0);
                        const axis = parseFloat(getField(row, "AXIS") ?? 0);
                        const qtyRaw = getField(row, "QTY");
                        const barcode = getField(row, "BARCODE");

                        if (qtyRaw === undefined || qtyRaw === "") {
                            // If quantity is missing but barcode exists, we still process it
                            if (barcode !== undefined && barcode !== "") {
                                if (processCombo(sph, cyl, add, axis, undefined, barcode)) importsCount++;
                                else skippedCount++;
                            } else {
                                skippedCount++; 
                            }
                            return; 
                        }
                        const qty = parseFloat(qtyRaw);
                        if (isNaN(qty)) { skippedCount++; return; }

                        if (processCombo(sph, cyl, add, axis, qty, barcode)) importsCount++;
                        else skippedCount++;
                    }
                });

                if (importsCount > 0) {
                    setUploadedFile({ name: file.name, edits: newFileEdits, barcodeEdits: newBarcodeEdits });
                    const skippedNote = skippedCount > 0 ? ` · ${skippedCount} rows skipped` : "";
                    toast.success(`${importsCount} values loaded from ${file.name}${skippedNote}`);
                } else if (dataRows.length === 0) {
                    toast.error("No data rows found in the file.");
                } else {
                    toast.error(`No matching combinations found. ${skippedCount} rows checked — verify SPH/CYL values match the matrix.`);
                }
            } catch (err) {
                console.error(err);
                toast.error("Failed to parse file. Make sure it's a valid Excel (.xlsx / .xls) file.");
            }
            e.target.value = ""; // reset input
        };
        reader.readAsArrayBuffer(file);
    };



    const handleRemoveFile = () => {
        setUploadedFile({ name: null, edits: {}, barcodeEdits: {} });
        toast.success("Imported file removed");
    };

    // Helper: given a list of selected power groups, compute the union of SPH, CYL, ADD ranges
    const getEffectiveRanges = (pgs) => {
        if (!pgs || pgs.length === 0) return null;
        const sphMins = pgs.map(p => parseFloat(p.sphMin)).filter(v => !isNaN(v));
        const sphMaxs = pgs.map(p => parseFloat(p.sphMax)).filter(v => !isNaN(v));
        const cylMins = pgs.map(p => parseFloat(p.cylMin)).filter(v => !isNaN(v));
        const cylMaxs = pgs.map(p => parseFloat(p.cylMax)).filter(v => !isNaN(v));
        const addMins = pgs.map(p => parseFloat(p.addMin)).filter(v => !isNaN(v));
        const addMaxs = pgs.map(p => parseFloat(p.addMax)).filter(v => !isNaN(v));

        return {
            sphMin: sphMins.length ? Math.min(...sphMins) : -Infinity,
            sphMax: sphMaxs.length ? Math.max(...sphMaxs) : Infinity,
            cylMin: cylMins.length ? Math.min(...cylMins) : -Infinity,
            cylMax: cylMaxs.length ? Math.max(...cylMaxs) : Infinity,
            addMin: addMins.length ? Math.min(...addMins) : -Infinity,
            addMax: addMaxs.length ? Math.max(...addMaxs) : Infinity,
        };
    };

    // Check if a combination falls into ANY of the selected power groups
    const matchesAnyPowerGroup = (sph, cyl, add, pgs) => {
        if (!pgs || pgs.length === 0) return true; // no filter = show all
        const s = parseFloat(sph);
        const c = parseFloat(cyl);
        const a = parseFloat(add);

        return pgs.some(pg => {
            const sMin = parseFloat(pg.sphMin); const sMax = parseFloat(pg.sphMax);
            const cMin = parseFloat(pg.cylMin); const cMax = parseFloat(pg.cylMax);
            const aMin = parseFloat(pg.addMin); const aMax = parseFloat(pg.addMax);

            const sphOk = !isNaN(sMin) && !isNaN(sMax) ? (s >= sMin - 0.001 && s <= sMax + 0.001) : true;
            const cylOk = !isNaN(cMin) && !isNaN(cMax) ? (c >= cMin - 0.001 && c <= cMax + 0.001) : true;
            const addOk = !isNaN(aMin) && !isNaN(aMax) ? (a >= aMin - 0.001 && a <= aMax + 0.001) : true;

            return sphOk && cylOk && addOk;
        });
    };

    const { matrixRows, addCols } = useMemo(() => {
        if (!groups || groups.length === 0) return { matrixRows: [], addCols: [] };

        const sphSet = new Set();
        const cylSet = new Set();
        const addSet = new Set();
        const axisSet = new Set();
        const rowKeys = new Set();

        const eyeList = eyeMode === "RL" ? ["R", "L", "RL", "R/L"] : [eyeMode];

        groups.forEach(group => {
            const addVal = parseFloat(group.addValue);
            (group.combinations || []).forEach(c => {
                const cEye = (c.eye || "").toUpperCase();
                if (!eyeList.includes(cEye) && eyeMode !== "RL") return;

                const s = parseFloat(c.sph);
                const cv = parseFloat(c.cyl);
                const ax = parseFloat(c.axis || 0);

                if (matchesAnyPowerGroup(s, cv, addVal, appliedPowerGroups)) {
                    sphSet.add(s);
                    cylSet.add(cv);
                    addSet.add(addVal);
                    axisSet.add(ax);
                    rowKeys.add(`${s.toFixed(2)}_${cv.toFixed(2)}_${ax}`);
                }
            });
        });

        const sphs = Array.from(sphSet).sort((a, b) => a - b);
        const cyls = Array.from(cylSet).sort((a, b) => a - b);
        const adds = Array.from(addSet).sort((a, b) => a - b);

        const rows = [];
        sphs.forEach(sph => {
            cyls.forEach(cyl => {
                const axesForRow = Array.from(axisSet).filter(ax => rowKeys.has(`${sph.toFixed(2)}_${cyl.toFixed(2)}_${ax}`)).sort((a, b) => a - b);
                axesForRow.forEach(ax => {
                    rows.push({ sph: sph.toFixed(2), cyl: cyl.toFixed(2), axis: ax });
                });
            });
        });

        return {
            matrixRows: rows,
            addCols: adds.map(a => a.toFixed(2)),
            sphList: sphs.map(s => s.toFixed(2)),
            cylList: cyls.map(c => c.toFixed(2)),
        };
    }, [groups, appliedPowerGroups, eyeMode]);

    // Determine layout mode
    const hasAdd = addCols.some(a => Math.abs(parseFloat(a)) > 0.001);
    const sphList = useMemo(() => [...new Set(matrixRows.map(r => r.sph))], [matrixRows]);
    const cylList = useMemo(() => [...new Set(matrixRows.map(r => r.cyl))], [matrixRows]);
    const fixedAdd = addCols[0] || "0.00";

    if (!isOpen || !groups || groups.length === 0) return null;

    const getKey = (groupId, c) => `${groupId}_${c.sph}_${c.cyl}_${c.eye || ''}`;

    const findCombination = (sph, cyl, add, axis) => {
        const tSph = parseFloat(sph) || 0;
        const tCyl = parseFloat(cyl) || 0;
        const tAdd = parseFloat(add) || 0;
        const tAxis = (axis !== undefined && axis !== null) ? parseFloat(axis) : null;
        
        const modeNorm = eyeMode.replace(/[\/\s]/g, "");

        const group = groups.find(g => Math.abs((parseFloat(g.addValue) || 0) - tAdd) < 0.01);
        if (!group) return null;

        const combo = group.combinations?.find(c => {
            const dbSph = parseFloat(c.sph) || 0;
            const dbCyl = parseFloat(c.cyl) || 0;
            const dbAxis = parseFloat(c.axis) || 0;
            const cEye = (c.eye || "").toUpperCase().replace(/[\/\s]/g, "");

            const matchesSph = Math.abs(dbSph - tSph) < 0.01;
            const matchesCyl = Math.abs(dbCyl - tCyl) < 0.01;
            const matchesAxis = tAxis !== null ? Math.abs(dbAxis - tAxis) < 0.01 : true;
            
            if (!matchesSph || !matchesCyl || !matchesAxis) return false;
            
            if (eyeMode === "RL") return true;
            return cEye === modeNorm || cEye === "RL" || cEye === "R/L" || cEye === "" || cEye === "BOTH";
        });

        if (!combo) return null;
        return { ...combo, groupId: group._id };
    };

    const getRowAxis = (row) => {
        return row.axis ?? "-";
    };

    const handleInputChange = (sph, cyl, add, val) => {
        const targetAddNum = parseFloat(add);
        const group = groups.find(g => Math.abs(parseFloat(g.addValue) - targetAddNum) < 0.01);
        if (!group) return;

        setEditedValues(prev => {
            const next = { ...prev };
            group.combinations?.forEach(c => {
                const matchesSph = Math.abs(parseFloat(c.sph) - parseFloat(sph)) < 0.01;
                const matchesCyl = Math.abs(parseFloat(c.cyl) - parseFloat(cyl)) < 0.01;
                if (!matchesSph || !matchesCyl) return;

                const cEye = (c.eye || "").toUpperCase();
                let shouldUpdate = false;
                if (eyeMode === "RL") shouldUpdate = true;
                else if (cEye === "RL" || cEye === "R/L") shouldUpdate = true;
                else if (cEye === eyeMode) shouldUpdate = true;

                if (shouldUpdate) {
                    const key = getKey(group._id, c);
                    next[key] = val;
                }
            });
            return next;
        });
    };

    const handleBarcodeChange = (sph, cyl, add, val) => {
        const targetAddNum = parseFloat(add);
        const group = groups.find(g => Math.abs(parseFloat(g.addValue) - targetAddNum) < 0.01);
        if (!group) return;

        setEditedBarcodes(prev => {
            const next = { ...prev };
            group.combinations?.forEach(c => {
                const matchesSph = Math.abs(parseFloat(c.sph) - parseFloat(sph)) < 0.01;
                const matchesCyl = Math.abs(parseFloat(c.cyl) - parseFloat(cyl)) < 0.01;
                if (!matchesSph || !matchesCyl) return;

                const cEye = (c.eye || "").toUpperCase();
                let shouldUpdate = false;
                if (eyeMode === "RL") shouldUpdate = true;
                else if (cEye === "RL" || cEye === "R/L") shouldUpdate = true;
                else if (cEye === eyeMode) shouldUpdate = true;

                if (shouldUpdate) {
                    const key = getKey(group._id, c);
                    next[key] = val;
                }
            });
            return next;
        });
    };

    const handleReset = () => {
        setEditedValues({});
        setEditedBarcodes({});
        setUploadedFile({ name: null, edits: {}, barcodeEdits: {} });
        toast.success("Reset all changes");
    };

    const handleSave = () => {
        const mergedQty = { ...uploadedFile.edits, ...editedValues };
        const mergedBarcodes = { ...uploadedFile.barcodeEdits, ...editedBarcodes };
        
        if (Object.keys(mergedQty).length === 0 && Object.keys(mergedBarcodes).length === 0) {
            toast.error("No changes to save");
            return;
        }
        onSave({ qty: mergedQty, barcode: mergedBarcodes });
    };

    const handleMatrixKeyDown = (e, rowIdx, colIdx) => {
        let targetRow = rowIdx;
        let targetCol = colIdx;

        if (e.key === "Enter") {
            e.preventDefault();
            targetRow++;
            if (targetRow >= matrixRows.length) { targetRow = 0; targetCol++; }
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

    const isPgChecked = (pg) => selectedPowerGroups.some(s =>
        s.sphMin === pg.sphMin && s.sphMax === pg.sphMax &&
        s.cylMin === pg.cylMin && s.cylMax === pg.cylMax &&
        s.addMin === pg.addMin && s.addMax === pg.addMax
    );

    const togglePg = (pg) => {
        if (isPgChecked(pg)) {
            setSelectedPowerGroups(prev => prev.filter(s =>
                !(s.sphMin === pg.sphMin && s.sphMax === pg.sphMax &&
                    s.cylMin === pg.cylMin && s.cylMax === pg.cylMax &&
                    s.addMin === pg.addMin && s.addMax === pg.addMax)
            ));
        } else {
            setSelectedPowerGroups(prev => [...prev, pg]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Grid3X3 className="w-5 h-5 text-blue-400" />
                            Stock Quantity Matrix
                        </h2>
                        <p className="text-slate-400 text-xs mt-0.5">Bulk update Stock Quantities across ADD Groups. Supports Excel import.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters Section */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
                    <div className="flex flex-wrap items-end gap-4">

                        {/* Power Group Dropdown */}
                        <div className="flex-1 min-w-[280px]" ref={pgDropdownRef}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                Power Group
                                {selectedPowerGroups.length > 0 && (
                                    <span className="ml-2 text-[9px] bg-blue-100 text-blue-600 font-extrabold px-1.5 py-0.5 rounded-full">
                                        {selectedPowerGroups.length} selected
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setPgDropdownOpen(prev => !prev)}
                                    className="w-full flex items-center justify-between px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:border-blue-400 focus:border-blue-500 outline-none transition-all"
                                >
                                    <span className={selectedPowerGroups.length > 0 ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                                        {powerGroups.length === 0
                                            ? 'No saved power groups'
                                            : selectedPowerGroups.length === 0
                                                ? 'Select power ranges...'
                                                : `${selectedPowerGroups.length} range(s) selected`}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${pgDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {pgDropdownOpen && powerGroups.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden min-w-[320px]">
                                        {/* Select All */}
                                        <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
                                            <label className="flex items-center gap-2.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPowerGroups.length === powerGroups.length && powerGroups.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedPowerGroups([...powerGroups]);
                                                        else setSelectedPowerGroups([]);
                                                    }}
                                                    className="w-3.5 h-3.5 accent-blue-600"
                                                />
                                                <span className="text-xs font-extrabold text-slate-700">
                                                    Select All ({powerGroups.length})
                                                </span>
                                            </label>
                                        </div>

                                        {/* Individual ranges */}
                                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                                            {powerGroups.map((pg, idx) => {
                                                const checked = isPgChecked(pg);
                                                const label = pg.label ||
                                                    `SPH: ${pg.sphMin ?? '?'} to ${pg.sphMax ?? '?'} | CYL: ${pg.cylMin ?? '?'} to ${pg.cylMax ?? '?'} | ADD: ${pg.addMin ?? '?'} to ${pg.addMax ?? '?'}`;
                                                return (
                                                    <label
                                                        key={idx}
                                                        className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-blue-50 ${checked ? 'bg-blue-50/60' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => togglePg(pg)}
                                                            className="w-3.5 h-3.5 accent-blue-600 mt-0.5 flex-shrink-0"
                                                        />
                                                        <span className="text-xs font-semibold text-slate-700 leading-relaxed">{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {/* Footer actions */}
                                        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPowerGroups([])}
                                                className="text-[11px] font-bold text-slate-500 hover:text-rose-500 transition-colors"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPgDropdownOpen(false)}
                                                className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 transition-colors"
                                            >
                                                Done ✓
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Show Button & Upload */}
                        <div className="flex-shrink-0 flex items-center gap-3">
                            {uploadedFile.name ? (
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-emerald-600 uppercase leading-none">Imported File</span>
                                        <span className="text-xs font-semibold text-slate-700 max-w-[150px] truncate">{uploadedFile.name}</span>
                                    </div>
                                    <button 
                                        onClick={handleRemoveFile}
                                        className="p-1 hover:bg-rose-100 text-rose-500 rounded-full transition-colors"
                                        title="Remove file and its edits"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-1 cursor-pointer">
                                    <Upload className="w-3 h-3" /> Import Excel
                                    <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" />
                                </label>
                            )}
                            
                            <button
                                onClick={handleGenerate}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-6 rounded text-sm transition-colors flex items-center justify-center gap-1"
                            >
                                <Search className="w-3 h-3" /> Show
                            </button>
                        </div>
                    </div>

                    {/* Eye Selector */}
                    <div className="flex items-center gap-4 border-t border-slate-200 pt-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Selected Eye:</span>
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                            <span className="px-4 py-1 text-xs font-bold rounded-md transition-all bg-slate-800 text-white shadow-sm cursor-default">
                                {eyeMode}
                            </span>
                        </div>
                        {appliedPowerGroups.length > 0 && (
                            <div className="ml-2 flex flex-wrap gap-1.5">
                                {appliedPowerGroups.map((pg, i) => (
                                    <span key={i} className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                        {pg.label || `Range ${i + 1}`}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Matrix Content */}
                <div className="flex-1 overflow-auto bg-slate-100 p-4 relative">
                    {matrixRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                            <Filter className="w-10 h-10 opacity-30" />
                            <p className="text-sm font-semibold">
                                {appliedPowerGroups.length === 0
                                    ? "Select power groups and click Show to load the matrix"
                                    : "No combinations found for the selected power groups"}
                            </p>
                        </div>
                    ) : hasAdd ? (
                        /* ── WITH-ADD LAYOUT: SPH+CYL rows × ADD columns ── */
                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-fit">
                            <table className="w-full border-collapse text-sm">
                                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-slate-200 w-20 text-center font-bold bg-slate-100">SPH</th>
                                        <th className="px-3 py-2 border-b border-r border-slate-200 w-20 text-center font-bold bg-slate-100">CYL</th>
                                        <th className="px-3 py-2 border-b border-r border-slate-200 w-20 text-center font-bold bg-slate-100">AXIS</th>
                                        {addCols.map(add => (
                                            <th key={add} className="px-3 py-2 border-b border-r border-slate-200 min-w-[100px] text-center font-bold">
                                                {parseFloat(add).toFixed(2)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {matrixRows.map((row, rowIdx) => (
                                        <tr key={`${row.sph}_${row.cyl}_${row.axis}`} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-700 bg-slate-50/50">{row.sph}</td>
                                            <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-700 bg-slate-50/50">{row.cyl}</td>
                                            <td className="px-3 py-2 border-r border-slate-100 text-center font-medium text-slate-500 bg-slate-50/50">{row.axis}</td>
                                            {addCols.map((add, colIdx) => {
                                                const combo = findCombination(row.sph, row.cyl, add, row.axis);
                                                if (!combo) return (
                                                    <td key={add} className="border-r border-slate-100 bg-slate-50/20 text-slate-300 text-center text-[10px]">-</td>
                                                );                                                const key = getKey(combo.groupId, combo);
                                                const value = editedValues[key] !== undefined
                                                    ? editedValues[key]
                                                    : (uploadedFile.edits[key] !== undefined
                                                        ? uploadedFile.edits[key]
                                                        : (combo.initStock ?? ""));

                                                const isManualEdited = editedValues[key] !== undefined && editedValues[key] != (combo.initStock ?? "");
                                                const isFileEdited = !isManualEdited && uploadedFile.edits[key] !== undefined;
                                                const isQtyEdited = isManualEdited || isFileEdited;

                                                const barcodeVal = editedBarcodes[key] !== undefined
                                                    ? editedBarcodes[key]
                                                    : (uploadedFile.barcodeEdits[key] !== undefined
                                                        ? uploadedFile.barcodeEdits[key]
                                                        : (combo.barcode ?? ""));
                                                const isBarcodeManualEdited = editedBarcodes[key] !== undefined && editedBarcodes[key] != (combo.barcode ?? "");
                                                const isBarcodeFileEdited = !isBarcodeManualEdited && uploadedFile.barcodeEdits[key] !== undefined;
                                                const isBarcodeEdited = isBarcodeManualEdited || isBarcodeFileEdited;

                                                return (
                                                    <td key={add} className={`p-1 border-r border-slate-100 relative group/cell ${(isQtyEdited || isBarcodeEdited) ? 'bg-blue-50/50' : ''}`}>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="relative group/qty">
                                                                <input
                                                                    type="number" min="0" placeholder="Qty" value={value}
                                                                    onChange={e => handleInputChange(row.sph, row.cyl, add, e.target.value)}
                                                                    onKeyDown={e => handleMatrixKeyDown(e, rowIdx, colIdx)}
                                                                    data-matrix-input data-row={rowIdx} data-col={colIdx}
                                                                    className={`w-full h-7 text-center text-[11px] font-bold outline-none rounded transition-all focus:ring-2 focus:ring-blue-500/20
                                                                        ${value !== "" ? "bg-slate-50 border border-slate-200" : "bg-transparent border border-transparent hover:border-slate-100"}
                                                                        ${isManualEdited ? "border-blue-300 text-blue-700 font-extrabold" : (isFileEdited ? "border-emerald-300 text-emerald-700" : "")}`}
                                                                />
                                                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover/qty:opacity-100 transition-opacity uppercase">Stock</span>
                                                            </div>
                                                            <div className="relative group/barcode">
                                                                <input
                                                                    type="text" placeholder="B.Code" value={barcodeVal}
                                                                    onChange={e => handleBarcodeChange(row.sph, row.cyl, add, e.target.value)}
                                                                    className={`w-full h-6 text-center text-[9px] font-mono outline-none rounded transition-all focus:ring-2 focus:ring-blue-500/20
                                                                        ${barcodeVal !== "" ? "bg-slate-50/50 border border-slate-200" : "bg-transparent border border-transparent hover:border-slate-100"}
                                                                        ${isBarcodeManualEdited ? "border-blue-300 text-blue-700" : (isBarcodeFileEdited ? "border-emerald-300 text-emerald-700" : "")}`}
                                                                />
                                                                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover/barcode:opacity-100 transition-opacity uppercase tracking-tighter">Barcode</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onMouseEnter={() => setActiveInfoCell({ sph: row.sph, cyl: row.cyl, add, combo })}
                                                            onMouseLeave={() => setActiveInfoCell(null)}
                                                            className="absolute top-1 right-1 text-slate-200 hover:text-blue-500 transition-colors shrink-0 z-10"
                                                        >
                                                            <Info className="w-2.5 h-2.5" />
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* ── NO-ADD LAYOUT: SPH rows × CYL columns ── */
                        (() => {
                            const grandTotal = sphList.reduce((gSum, sph) =>
                                gSum + cylList.reduce((rSum, cyl) => {
                                    const combo = findCombination(sph, cyl, fixedAdd, null);
                                    if (!combo) return rSum;
                                    const key = getKey(combo.groupId, combo);
                                    const val = editedValues[key] !== undefined ? editedValues[key] : (uploadedFile.edits[key] !== undefined ? uploadedFile.edits[key] : (combo.initStock ?? 0));
                                    return rSum + (parseFloat(val) || 0);
                                }, 0), 0);
                            return (
                                <div>
                                    <div className="flex justify-end mb-2">
                                        <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                                            Grand Total: <span className="text-blue-700 font-black">{grandTotal}</span>
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-fit">
                                        <table className="w-full border-collapse text-sm">
                                            <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 shadow-sm">
                                                <tr>
                                                    <th className="px-3 py-2.5 border-b border-r border-slate-200 min-w-[72px] text-center font-bold bg-slate-100 text-xs">SPH / CYL</th>
                                                    {cylList.map(cyl => (
                                                        <th key={cyl} className="px-2 py-2.5 border-b border-r border-slate-200 min-w-[72px] text-center font-bold text-xs text-blue-700 bg-blue-50/40">
                                                            {Number(cyl).toFixed(2)}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-2.5 border-b border-slate-200 min-w-[60px] text-center font-bold text-xs bg-emerald-50 text-emerald-700">Row Σ</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {sphList.map((sph, sphIdx) => {
                                                    let rowSum = 0;
                                                    const cells = cylList.map((cyl, cylIdx) => {
                                                        const combo = findCombination(sph, cyl, fixedAdd, null);
                                                        if (!combo) return <td key={cyl} className="border-r border-slate-100 bg-slate-50/20 text-slate-300 text-center text-[10px] px-2 py-2">-</td>;
                                                        const key = getKey(combo.groupId, combo);
                                                        const value = editedValues[key] !== undefined
                                                            ? editedValues[key]
                                                            : (uploadedFile.edits[key] !== undefined ? uploadedFile.edits[key] : (combo.initStock ?? ""));
                                                        rowSum += parseFloat(value) || 0;
                                                        const isManualEdited = editedValues[key] !== undefined && editedValues[key] != (combo.initStock ?? "");
                                                        const isFileEdited = !isManualEdited && uploadedFile.edits[key] !== undefined;
                                                        const isQtyEdited = isManualEdited || isFileEdited;

                                                        const barcodeVal = editedBarcodes[key] !== undefined
                                                            ? editedBarcodes[key]
                                                            : (uploadedFile.barcodeEdits[key] !== undefined
                                                                ? uploadedFile.barcodeEdits[key]
                                                                : (combo.barcode ?? ""));
                                                        const isBarcodeManualEdited = editedBarcodes[key] !== undefined && editedBarcodes[key] != (combo.barcode ?? "");
                                                        const isBarcodeFileEdited = !isBarcodeManualEdited && uploadedFile.barcodeEdits[key] !== undefined;
                                                        const isBarcodeEdited = isBarcodeManualEdited || isBarcodeFileEdited;

                                                        return (
                                                            <td key={cyl} className={`p-1 border-r border-slate-100 relative group/cell ${(isQtyEdited || isBarcodeEdited) ? 'bg-blue-50/50' : ''}`}>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <input
                                                                        type="number" min="0" placeholder="Qty" value={value}
                                                                        onChange={e => handleInputChange(sph, cyl, fixedAdd, e.target.value)}
                                                                        onKeyDown={e => handleMatrixKeyDown(e, sphIdx, cylIdx)}
                                                                        data-matrix-input data-row={sphIdx} data-col={cylIdx}
                                                                        className={`w-full h-7 text-center text-[11px] font-bold outline-none rounded transition-all focus:ring-2 focus:ring-blue-500/20
                                                                            ${String(value) !== "" ? "bg-slate-50 border border-slate-200" : "bg-transparent border border-transparent hover:border-slate-100"}
                                                                            ${isManualEdited ? "border-blue-300 text-blue-700 font-extrabold" : (isFileEdited ? "border-emerald-300 text-emerald-700" : "")}`}
                                                                    />
                                                                    <input
                                                                        type="text" placeholder="Barcode" value={barcodeVal}
                                                                        onChange={e => handleBarcodeChange(sph, cyl, fixedAdd, e.target.value)}
                                                                        className={`w-full h-5 text-center text-[8px] font-mono outline-none rounded transition-all focus:ring-2 focus:ring-blue-500/20
                                                                            ${barcodeVal !== "" ? "bg-white/80 border border-slate-200" : "bg-transparent border border-transparent hover:border-slate-50"}
                                                                            ${isBarcodeManualEdited ? "border-blue-300 text-blue-700" : (isBarcodeFileEdited ? "border-emerald-300 text-emerald-700" : "")}`}
                                                                    />
                                                                </div>
                                                            </td>
                                                        );
                                                    });
                                                    return (
                                                        <tr key={sph} className="hover:bg-blue-50/20 transition-colors">
                                                            <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-slate-700 bg-slate-50/80 text-xs sticky left-0 z-10">{sph}</td>
                                                            {cells}
                                                            <td className={`px-3 py-2 text-center font-black text-xs border-l border-slate-200 ${rowSum > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-slate-300 bg-emerald-50/30'}`}>{rowSum || 0}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()
                    )}

                    {/* Popover/Tooltip */}
                    {activeInfoCell && (
                        <div
                            className="fixed z-[110] bg-slate-900 text-white p-3 rounded-lg shadow-xl text-[11px] pointer-events-none animate-in fade-in duration-100"
                            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', minWidth: '180px' }}
                        >
                            <div className="font-bold border-b border-white/10 pb-1 mb-1 text-blue-300">
                                {activeInfoCell.sph} / {activeInfoCell.cyl} (ADD {activeInfoCell.add})
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between gap-4"><span className="text-slate-400">Barcode:</span><span className="font-mono text-xs">{activeInfoCell.combo.barcode || "N/A"}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-slate-400">Eye:</span><span className="font-bold">{activeInfoCell.combo.eye}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-slate-400">Axis:</span><span className="font-bold">{activeInfoCell.combo.axis || "0"}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-slate-400">P. Price:</span><span className="font-bold">₹{activeInfoCell.combo.pPrice || 0}</span></div>
                                <div className="flex justify-between gap-4"><span className="text-slate-400">S. Price:</span><span className="font-bold">₹{activeInfoCell.combo.sPrice || 0}</span></div>
                                <div className="flex justify-between gap-4 border-t border-white/10 pt-1 mt-1"><span className="text-slate-400 font-bold">Current Stock:</span><span className="font-bold text-green-400">{activeInfoCell.combo.initStock || 0}</span></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-sm text-slate-500 flex flex-col">
                        <div>
                            <span className="font-bold text-slate-700">{Object.keys(editedValues).length}</span> combinations manually modified
                        </div>
                        {uploadedFile.name && (
                            <div className="text-[10px] text-emerald-600 font-semibold italic">
                                + {Object.keys(uploadedFile.edits).length} combinations auto-filled from {uploadedFile.name}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold text-sm flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" /> Reset
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 font-bold text-sm tracking-wide active:scale-95 transition-all"
                        >
                            <Save className="w-4 h-4" /> Save Changes
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StockQtyMatrixModal;
