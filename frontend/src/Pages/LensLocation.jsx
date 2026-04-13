import React, { useState, useRef, useEffect, useMemo } from "react";
import { getAllItems } from "../controllers/itemcontroller";
import { getLensPower, updateLensGroupLocations } from "../controllers/LensGroupCreationController";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import {
    RotateCcw,
    Plus,
    Filter,
    Save,
    ChevronDown,
    Eye,
    FileSpreadsheet,
    Printer,
    Barcode
} from "lucide-react";
import * as XLSX from "xlsx";

function LensLocation() {
    const [formData, setFormData] = useState({
        groupName: "",
        productName: "",
        sphMin: "",
        sphMax: "",
        cylMin: "",
        cylMax: "",
        axis: "",
        addMin: "",
        addMax: "",
        eye: "",
        godown: "",
        rackNo: "",
        boxNo: ""
    });

    const [Items, setItems] = useState([]);
    const [lensData, setLensData] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [matrixData, setMatrixData] = useState({}); // Stores synced stock: { "sph_cyl_eye_add": qty }
    const [locationMap, setLocationMap] = useState({}); // Stores array of locations: { "sph_cyl_eye_add": [{ godown, rack, box }] }
    const [locationQtyMap, setLocationQtyMap] = useState({}); // Stores manual qty per location: { "sph_cyl_eye_add": qty }
    const [modifiedKeys, setModifiedKeys] = useState(new Set());

    const handleQtyChange = (key, val) => {
        setLocationQtyMap(prev => ({ ...prev, [key]: val }));
        setModifiedKeys(prev => new Set(prev).add(key));
    };

    const handleQtyBlur = async (key) => {
        const val = locationQtyMap[key];
        if (!formData.productName) return;
        const [sph, cyl, eye, add] = key.split("_");
        try {
            await updateLensGroupLocations({
                productName: formData.productName,
                locationsToSave: [{
                    sph, cyl, eye, add: Number(add),
                    locationQty: val || ""
                }]
            });
        } catch (err) {
            console.error("Auto-save Qty failed", err);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const items = await getAllItems();
                setItems(items.items || []);
            } catch (err) {
                console.log("Error fetching items", err);
            }
        };
        fetchData();
    }, []);

    const [productSuggestions, setProductSuggestions] = useState([]);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);
    const [productActiveIndex, setProductActiveIndex] = useState(-1);
    const productRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (productRef.current && !productRef.current.contains(e.target)) {
                setShowProductSuggestions(false);
                setProductActiveIndex(-1);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));

        if (field === "productName") {
            const q = value.trim().toLowerCase();
            if (q.length === 0) {
                setProductSuggestions([]);
                setShowProductSuggestions(false);
            } else {
                const filtered = (Items || [])
                    .map((item) => item.itemName)
                    .filter((name) => name && name.toLowerCase().includes(q));
                setProductSuggestions(filtered);
                setShowProductSuggestions(filtered.length > 0);
                setProductActiveIndex(-1);
            }
        }
    };

    const selectProductSuggestion = (value) => {
        const selectedItem = (Items || []).find((item) => item.itemName === value);
        const groupName = selectedItem?.groupName || "";

        setFormData((prev) => ({ ...prev, productName: value, groupName: groupName }));
        setShowProductSuggestions(false);
        setProductActiveIndex(-1);

        fetchLensConfig(value);
    };

    const fetchLensConfig = async (productName) => {
        try {
            const result = await getLensPower({ productName });
            if (result && result.success !== false) {
                const data = result.data || result;
                setFormData(prev => ({
                    ...prev,
                    sphMin: data.sphMin,
                    sphMax: data.sphMax,
                    cylMin: data.cylMin,
                    cylMax: data.cylMax,
                    addMin: data.addMin,
                    addMax: data.addMax,
                    eye: data.eye,
                    axis: data.axis
                }));
            }
        } catch (err) {
            console.error("Error fetching lens config:", err);
        }
    };

    const handleShowMatrix = async () => {
        if (!formData.productName) {
            toast.error("Please select an item first.");
            return;
        }

        try {
            const result = await getLensPower({ productName: formData.productName });
            if (!result.success && !result.data?._id && !result._id) {
                toast.error("No lens configuration found.");
                return;
            }
            const data = result.data || result;
            setLensData(data);
            setShowDetails(true);

            // SYNC STOCK AND LOCATIONS FROM MASTER
            const mData = {};
            const lMap = {};
            const lQtyMap = {};
            (data.addGroups || []).forEach(ag => {
                (ag.combinations || []).forEach(comb => {
                    const key = `${comb.sph}_${comb.cyl}_${comb.eye}_${ag.addValue}`;
                    mData[key] = comb.initStock || 0;
                    lMap[key] = comb.locations || [];
                    lQtyMap[key] = comb.locationQty || "";
                });
            });
            setMatrixData(mData);
            setLocationMap(lMap);
            setLocationQtyMap(lQtyMap);
            setModifiedKeys(new Set());
            
            toast.success("Matrix loaded with Master Stock.");
        } catch (err) {
            console.error(err);
            toast.error("Failed to load matrix.");
        }
    };

    const handleAddLocation = (sph, cyl, eye, add) => {
        if (!formData.godown && !formData.rackNo && !formData.boxNo) {
            toast.error("Please enter a Godown, Rack, or Box first.");
            return;
        }

        const key = `${sph}_${cyl}_${eye}_${add}`;
        const newLoc = {
            godown: formData.godown || "-",
            rack: formData.rackNo || "-",
            box: formData.boxNo || "-"
        };

        const currentLocs = locationMap[key] || [];
        const isDuplicate = currentLocs.some(l => 
            l.godown === newLoc.godown && 
            l.rack === newLoc.rack && 
            l.box === newLoc.box
        );

        if (isDuplicate) {
            toast.error("Location already assigned to this cell.");
            return;
        }

        setLocationMap(prev => ({
            ...prev,
            [key]: [...currentLocs, newLoc]
        }));
        setModifiedKeys(prev => new Set(prev).add(key));
    };

    const handleRemoveLocation = (key, index) => {
        setLocationMap(prev => {
            const newList = prev[key].filter((_, i) => i !== index);
            return {
                ...prev,
                [key]: newList
            };
        });
        setModifiedKeys(prev => new Set(prev).add(key));
    };

    const handleSave = async () => {
        if (!formData.productName) {
            toast.error("No product selected.");
            return;
        }

        const locationsToSave = [];
        modifiedKeys.forEach(key => {
            const [sph, cyl, eye, add] = key.split("_");
            locationsToSave.push({
                sph, cyl, eye, add: Number(add),
                locations: locationMap[key] || [],
                locationQty: locationQtyMap[key] || ""
            });
        });

        if (locationsToSave.length === 0) {
            toast.error("No changes to save.");
            return;
        }

        try {
            const res = await updateLensGroupLocations({
                productName: formData.productName,
                locationsToSave
            });
            if (res.success) {
                toast.success(res.message);
                setModifiedKeys(new Set());
            } else {
                toast.error(res.message || "Failed to save mapping.");
            }
        } catch (err) {
            toast.error("Error saving mapping.");
        }
    };

    const handleReset = () => {
        setFormData({
            groupName: "",
            productName: "",
            sphMin: "",
            sphMax: "",
            cylMin: "",
            cylMax: "",
            axis: "",
            addMin: "",
            addMax: "",
            eye: "",
            godown: "",
            rackNo: "",
            boxNo: ""
        });
        setLensData(null);
        setShowDetails(false);
        setMatrixData({});
        setLocationMap({});
        setLocationQtyMap({});
        setModifiedKeys(new Set());
    };

    const handleExportExcel = () => {
        if (!matrix.rows.length) {
            toast.error("No data to export.");
            return;
        }

        const headers = ["SPH", "CYL", "Eye"];
        matrix.addValues.forEach(add => {
            headers.push(`+${add.toFixed(2)}`, "G/R/B");
        });
        headers.push("Row Total");

        const rows = matrix.rows.map(row => {
            const rowData = [
                row.sph.toFixed(2),
                row.cyl.toFixed(2),
                row.eye
            ];
            matrix.addValues.forEach(add => {
                const cellKey = `${row.sph}_${row.cyl}_${row.eye}_${add}`;
                rowData.push(matrixData[cellKey] || 0);
                rowData.push(locationMap[cellKey] || "-");
            });
            rowData.push(calculateRowTotal(row));
            return rowData;
        });

        // Add Column Totals row
        const totalRow = ["Totals", "", ""];
        matrix.addValues.forEach(add => {
            totalRow.push(calculateColTotal(add), "");
        });
        totalRow.push(calculateGrandTotal());
        rows.push(totalRow);

        const worksheetData = [
            [`Lens Stock Report - ${formData.productName}`],
            [`Date: ${new Date().toLocaleDateString("en-IN")}`],
            [],
            headers,
            ...rows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Merge title cells
        if (!worksheet['!merges']) worksheet['!merges'] = [];
        worksheet['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
        );

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lens Stock");
        XLSX.writeFile(workbook, `Lens_Stock_${formData.productName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success("Excel exported.");
    };

    const handlePrint = () => {
        if (!matrix.rows.length) {
            toast.error("No data to print.");
            return;
        }

        const printWindow = window.open("", "_blank");
        
        const html = `
            <html>
                <head>
                    <title>Lens Stock Report - ${formData.productName}</title>
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                            padding: 20px; 
                            color: #333; 
                            line-height: 1.4;
                        }
                        h1 { font-size: 24px; margin: 0 0 15px 0; color: #1e293b; }
                        .info-grid { 
                            display: grid; 
                            grid-template-columns: 1fr 1fr; 
                            gap: 10px; 
                            margin-bottom: 20px; 
                            font-size: 13px; 
                            border: 1px solid #e2e8f0;
                            padding: 15px;
                            border-radius: 8px;
                            background: #f8fafc;
                        }
                        .info-item { margin-bottom: 2px; }
                        .info-label { font-weight: bold; color: #475569; width: 100px; display: inline-block; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                        th, td { border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; }
                        th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
                        .add-header { color: #2563eb; }
                        .loc-header { color: #64748b; font-weight: normal; font-size: 9px; }
                        .total-row { background-color: #334155; color: white; font-weight: bold; }
                        .row-total { background-color: #f0fdf4; font-weight: bold; color: #166534; }
                        
                        @media print {
                            @page { size: landscape; margin: 10mm; }
                            body { padding: 0; }
                            .total-row { background-color: #334155 !important; -webkit-print-color-adjust: exact; color: white !important; }
                            th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
                            .row-total { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Lens Stock Report</h1>
                    <div class="info-grid">
                        <div class="info-item"><span class="info-label">Item:</span> ${formData.productName}</div>
                        <div class="info-item"><span class="info-label">Date:</span> ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                        <div class="info-item"><span class="info-label">Group:</span> ${formData.groupName}</div>
                        <div class="info-item">
                            <span class="info-label">Range:</span> 
                            SPH: ${formData.sphMin || "-"} to ${formData.sphMax || "-"} | 
                            CYL: ${formData.cylMin || "-"} to ${formData.cylMax || "-"}
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>SPH</th>
                                <th>CYL</th>
                                <th>Eye</th>
                                ${matrix.addValues.map(add => `
                                    <th class="add-header">+${add.toFixed(2)}</th>
                                    <th class="loc-header">G/R/B</th>
                                `).join('')}
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${matrix.rows.map(row => `
                                <tr>
                                    <td><strong>${row.sph.toFixed(2)}</strong></td>
                                    <td><strong>${row.cyl.toFixed(2)}</strong></td>
                                    <td>${row.eye}</td>
                                    ${matrix.addValues.map(add => {
                                        const cellKey = `${row.sph}_${row.cyl}_${row.eye}_${add}`;
                                        return `
                                            <td>${matrixData[cellKey] || "0"}</td>
                                            <td style="color: #64748b;">${locationMap[cellKey] || "-"}</td>
                                        `;
                                    }).join('')}
                                    <td class="row-total">${calculateRowTotal(row)}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="3" style="text-align: right; padding-right: 15px;">COLUMN TOTALS:</td>
                                ${matrix.addValues.map(add => `
                                    <td colspan="2">${calculateColTotal(add)}</td>
                                `).join('')}
                                <td>${calculateGrandTotal()}</td>
                            </tr>
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for styles and content to load
        setTimeout(() => {
            printWindow.print();
            // printWindow.close(); // Optional: close after print
        }, 500);
    };

    const handleBarcodePrint = () => {
        const nonZeroCells = [];
        matrix.rows.forEach(row => {
            matrix.addValues.forEach(add => {
                const cellKey = `${row.sph}_${row.cyl}_${row.eye}_${add}`;
                const qty = matrixData[cellKey];
                if (qty && Number(qty) > 0) {
                    nonZeroCells.push({
                        sph: row.sph.toFixed(2),
                        cyl: row.cyl.toFixed(2),
                        eye: row.eye,
                        add: `+${add.toFixed(2)}`,
                        qty: qty
                    });
                }
            });
        });

        if (nonZeroCells.length === 0) {
            toast.error("No non-zero cells to print barcodes for.");
            return;
        }

        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
                <head>
                    <title>Barcode Print</title>
                    <style>
                        body { font-family: sans-serif; margin: 0; padding: 20px; }
                        .barcode-grid { 
                            display: grid; 
                            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); 
                            gap: 15px; 
                        }
                        .label { 
                            border: 1px dashed #ccc; 
                            padding: 10px; 
                            text-align: center; 
                            page-break-inside: avoid;
                        }
                        .item-title { font-size: 10px; color: #666; margin-bottom: 5px; }
                        .power-row { font-weight: bold; font-size: 14px; }
                        .eye-add { font-size: 12px; margin-top: 3px; }
                        .qty { font-size: 10px; font-weight: normal; margin-top: 5px; color: #444; }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="barcode-grid">
                        ${nonZeroCells.map(c => `
                            <div class="label">
                                <div class="item-title">${formData.productName}</div>
                                <div class="power-row">S: ${c.sph} C: ${c.cyl}</div>
                                <div class="eye-add">Eye: ${c.eye} | Add: ${c.add}</div>
                                <div class="qty">Qty: ${c.qty}</div>
                            </div>
                        `).join('')}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Matrix construction
    const matrix = useMemo(() => {
        if (!lensData) return { addValues: [], rows: [] };

        const sourceRows = (lensData.addGroups || [])
            .flatMap((g) =>
                (g.combinations || []).map((c) => ({ ...c, addValue: g.addValue }))
            )
            .filter(r => {
                const sph = Number(r.sph);
                const cyl = Number(r.cyl);
                const add = Number(r.addValue);

                // Filter logic
                const sMin = formData.sphMin !== "" ? Number(formData.sphMin) : -Infinity;
                const sMax = formData.sphMax !== "" ? Number(formData.sphMax) : Infinity;
                if (sph < sMin || sph > sMax) return false;

                const cMin = formData.cylMin !== "" ? Number(formData.cylMin) : -Infinity;
                const cMax = formData.cylMax !== "" ? Number(formData.cylMax) : Infinity;
                if (cyl < cMin || cyl > cMax) return false;

                const aMin = formData.addMin !== "" ? Number(formData.addMin) : -Infinity;
                const aMax = formData.addMax !== "" ? Number(formData.addMax) : Infinity;
                if (add < aMin || add > aMax) return false;

                return true;
            });

        const addValues = Array.from(
            new Set(sourceRows.map((r) => parseFloat(r.addValue)))
        ).sort((a, b) => a - b);

        const comboMap = new Map();
        sourceRows.forEach((r) => {
            const sph = Number(r.sph);
            const cyl = Number(r.cyl);
            const eye = r.eye;
            const key = `${sph}__${cyl}__${eye}`;
            if (!comboMap.has(key)) comboMap.set(key, { sph, cyl, eye });
        });

        const rows = Array.from(comboMap.values()).sort((x, y) => {
            if (x.sph !== y.sph) return x.sph - y.sph;
            if (x.cyl !== y.cyl) return x.cyl - y.cyl;
            return x.eye.localeCompare(y.eye);
        });

        return { addValues, rows };
    }, [lensData, formData.sphMin, formData.sphMax, formData.cylMin, formData.cylMax, formData.addMin, formData.addMax]);

    const calculateRowTotal = (row) => {
        return matrix.addValues.reduce((sum, add) => {
            const qty = matrixData[`${row.sph}_${row.cyl}_${row.eye}_${add}`] || 0;
            return sum + Number(qty);
        }, 0);
    };

    const calculateColTotal = (add) => {
        return matrix.rows.reduce((sum, row) => {
            const qty = matrixData[`${row.sph}_${row.cyl}_${row.eye}_${add}`] || 0;
            return sum + Number(qty);
        }, 0);
    };

    const calculateGrandTotal = () => {
        return matrix.addValues.reduce((sum, add) => sum + calculateColTotal(add), 0);
    };

    const animeFadeIn = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .anime-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @media print {
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area { position: absolute; left: 0; top: 0; width: 100%; }
      .no-print { display: none !important; }
      input { border: none !important; appearance: none; -moz-appearance: none; }
    }
  `;

    return (
        <div className="p-4 bg-slate-100 min-h-screen font-sans">
            <style>{animeFadeIn}</style>
            <div className="max-w-[98vw] mx-auto">
                <div className="mb-8 no-print">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Lens Location</h1>
                    <p className="text-slate-600">Assign and manage lens stock locations</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8 anime-fade-in no-print">
                    <div className="p-8">
                        <h3 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
                            <Filter className="w-5 h-5 text-blue-500" />
                            Stock Filters & Location
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <div className="relative" ref={productRef}>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Item Name</label>
                                <input
                                    type="text"
                                    value={formData.productName}
                                    onChange={(e) => handleInputChange("productName", e.target.value)}
                                    onFocus={() => { if (productSuggestions.length > 0) setShowProductSuggestions(true); }}
                                    placeholder="Type item name..."
                                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all duration-200 outline-none"
                                />
                                {showProductSuggestions && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 max-h-60 overflow-y-auto anime-fade-in">
                                        {productSuggestions.map((s, i) => (
                                            <div
                                                key={i}
                                                onClick={() => selectProductSuggestion(s)}
                                                className={`px-4 py-2.5 rounded-xl cursor-pointer transition-colors ${i === productActiveIndex ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}
                                            >
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Group Name</label>
                                <input
                                    type="text"
                                    list="group-names-list"
                                    value={formData.groupName}
                                    onChange={(e) => handleInputChange("groupName", e.target.value)}
                                    placeholder="Type or select group..."
                                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all duration-200 outline-none"
                                />
                                <datalist id="group-names-list">
                                    {Array.from(new Set(Items.map(item => item.groupName).filter(Boolean))).sort().map(g => (
                                        <option key={g} value={g} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Eye</label>
                                <div className="px-4 py-2.5 border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-500 italic">
                                    {formData.eye || "-"}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            {['sphMin', 'sphMax', 'cylMin', 'cylMax', 'addMin', 'addMax'].map((field) => (
                                <div key={field} className="relative">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 ml-1">
                                        {field.replace(/Min|Max/, "").toUpperCase()} {field.includes("Min") ? "From" : "To"}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData[field]}
                                        onChange={(e) => handleInputChange(field, e.target.value)}
                                        className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg bg-white text-slate-700 font-bold text-sm text-center focus:ring-2 focus:ring-blue-400 outline-none"
                                        placeholder="-"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* LOCATION SECTION */}
                        <h3 className="text-lg font-semibold text-emerald-700 mb-6 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-emerald-500" />
                            Location Settings
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Godown</label>
                                <input
                                    type="text"
                                    value={formData.godown}
                                    onChange={(e) => handleInputChange("godown", e.target.value)}
                                    placeholder="Enter Godown..."
                                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all duration-200 outline-none"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Rack No</label>
                                <input
                                    type="text"
                                    value={formData.rackNo}
                                    onChange={(e) => handleInputChange("rackNo", e.target.value)}
                                    placeholder="Enter Rack No..."
                                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all duration-200 outline-none"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Box No</label>
                                <input
                                    type="text"
                                    value={formData.boxNo}
                                    onChange={(e) => handleInputChange("boxNo", e.target.value)}
                                    placeholder="Enter Box No..."
                                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all duration-200 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleShowMatrix}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg active:scale-95"
                                >
                                    <Eye className="w-5 h-5" />
                                    Show
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    Reset
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    title="Export to Excel"
                                    className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition border border-emerald-200"
                                >
                                    <FileSpreadsheet className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handlePrint}
                                    title="Print Matrix"
                                    className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition border border-blue-200"
                                >
                                    <Printer className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleBarcodePrint}
                                    title="Print Barcodes"
                                    className="inline-flex items-center gap-2 px-4 py-3 bg-slate-50 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition border border-slate-200"
                                >
                                    <Barcode className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={handleSave}
                                className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg active:scale-95"
                            >
                                <Save className="w-5 h-5" />
                                Save Stock Mapping
                            </button>
                        </div>
                    </div>
                </div>

                {showDetails && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden anime-fade-in p-6 print-area">
                        <div className="hidden print:block mb-6">
                            <h1 className="text-2xl font-bold">Lens Stock Report</h1>
                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                <div><span className="font-bold">Item:</span> {formData.productName}</div>
                                <div><span className="font-bold">Date:</span> {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                                <div className="col-span-2">
                                    <span className="font-bold">Power Range:</span> SPH {Number(formData.sphMin).toFixed(2)} to {Number(formData.sphMax).toFixed(2)} | CYL {Number(formData.cylMin).toFixed(2)} to {Number(formData.cylMax).toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-6 no-print">Stock Matrix</h3>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-full table-auto text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                                        <th className="py-4 px-4 text-left font-bold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[100px] w-[100px]">SPH</th>
                                        <th className="py-4 px-4 text-left font-bold text-slate-700 sticky left-[100px] bg-slate-50 z-10 min-w-[100px] w-[100px] border-r border-slate-100">CYL</th>
                                        <th className="py-4 px-4 text-left font-bold text-slate-700 sticky left-[200px] bg-slate-50 z-10 min-w-[80px] w-[80px] border-r border-slate-200">Eye</th>
                                        {matrix.addValues.map((add) => (
                                            <React.Fragment key={add}>
                                                <th className="py-4 px-4 text-center font-bold text-blue-700 bg-blue-50/50 min-w-[100px]">
                                                    +{add.toFixed(2)}
                                                </th>
                                                <th className="py-4 px-4 text-center font-bold text-amber-700 bg-amber-50 min-w-[100px]">
                                                    Qty
                                                </th>
                                                <th className="py-4 px-4 text-center font-bold text-slate-500 bg-slate-100/50 min-w-[120px]">
                                                    G/R/B
                                                </th>
                                            </React.Fragment>
                                        ))}
                                        <th className="py-4 px-4 text-center font-bold text-emerald-700 bg-emerald-50 min-w-[100px]">Row Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {matrix.rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10 min-w-[100px] w-[100px]">
                                                {row.sph.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-900 sticky left-[100px] bg-white group-hover:bg-slate-50 z-10 min-w-[100px] w-[100px] border-r border-slate-100">
                                                {row.cyl.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 text-center font-bold sticky left-[200px] bg-white group-hover:bg-slate-50 z-10 min-w-[80px] w-[80px] border-r border-slate-200">
                                                {row.eye}
                                            </td>
                                            {matrix.addValues.map((add) => {
                                                const cellKey = `${row.sph}_${row.cyl}_${row.eye}_${add}`;
                                                return (
                                                    <React.Fragment key={add}>
                                                  <td className="py-2 px-2 text-center">
                                                      <input
                                                          type="number"
                                                          value={matrixData[cellKey] ?? ""}
                                                          readOnly
                                                          placeholder="0"
                                                          title="Stock synced from Inventory Master"
                                                          className="w-full px-2 py-2 text-center rounded-lg border border-slate-100 bg-slate-50 text-blue-600 outline-none transition-all font-bold cursor-help"
                                                      />
                                                  </td>
                                                  <td className="py-2 px-2 text-center align-middle">
                                                      <textarea
                                                          value={locationQtyMap[cellKey] ?? ""}
                                                          onChange={(e) => {
                                                              e.target.style.height = "inherit";
                                                              e.target.style.height = `${Math.max(38, e.target.scrollHeight)}px`;
                                                              handleQtyChange(cellKey, e.target.value);
                                                          }}
                                                          onBlur={() => handleQtyBlur(cellKey)}
                                                          placeholder="Qty..."
                                                          className="w-full min-h-[38px] px-2 py-2 text-sm font-bold text-center rounded-lg border border-slate-200 outline-none transition-all resize-none shadow-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-amber-50/30 text-amber-900"
                                                          rows={1}
                                                      />
                                                  </td>
                                                  <td className="py-2 px-2 text-center min-w-[150px]">
                                                      <div className="flex flex-wrap items-center justify-center gap-1 mb-1">
                                                          {(locationMap[cellKey] || []).map((loc, idx) => (
                                                              <div key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold group/loc">
                                                                  {loc.godown}/{loc.rack}/{loc.box}
                                                                  <X 
                                                                    onClick={() => handleRemoveLocation(cellKey, idx)}
                                                                    className="w-3 h-3 cursor-pointer hover:bg-emerald-200 rounded-full transition-colors hidden group-hover/loc:block" 
                                                                  />
                                                              </div>
                                                          ))}
                                                          {(!locationMap[cellKey] || locationMap[cellKey].length === 0) && (
                                                              <span className="text-[10px] text-slate-300 italic">No Location</span>
                                                          )}
                                                      </div>
                                                      <button
                                                          onClick={() => handleAddLocation(row.sph, row.cyl, row.eye, add)}
                                                          title="Add Current G/R/B to this cell"
                                                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm"
                                                      >
                                                          <Plus className="w-3 h-3" />
                                                      </button>
                                                  </td>
                                              </React.Fragment>
                                          );
                                      })}
                                            <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/30">
                                                {calculateRowTotal(row)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-900 text-white font-bold">
                                        <td colSpan="3" className="py-4 px-4 text-right pr-6 uppercase tracking-wider">Column Totals:</td>
                                        {matrix.addValues.map((add) => (
                                            <td key={add} colSpan="2" className="py-4 px-4 text-center text-blue-300">
                                                {calculateColTotal(add)}
                                            </td>
                                        ))}
                                        <td className="py-4 px-4 text-center text-emerald-400 text-lg">
                                            {calculateGrandTotal()}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LensLocation;
