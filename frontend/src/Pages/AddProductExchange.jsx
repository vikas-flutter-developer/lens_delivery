import React, { useState, useCallback, useEffect, useContext, useRef } from "react";
import { X, Plus, Save, RotateCcw, ChevronUp, ChevronDown, Search } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import { getAllAccounts } from "../controllers/Account.controller";
import { getAllLensPower } from "../controllers/LensGroupCreationController";
import {
  addProductExchange,
  getProductExchangeById,
  updateProductExchange,
  getAllProductExchanges
} from "../controllers/ProductExchange.controller";
import { toast } from "react-hot-toast";

function AddProductExchange() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // ---- form state ----
  const [formData, setFormData] = useState({
    billSeries: "Exchange",
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    type: "Lens",
    godown: "MT-1",
    bookedBy: user?.name || "",
    partyName: "",
    address: "",
    contactNo: "",
    remarks: ""
  });

  const [exchangeOutProducts, setExchangeOutProducts] = useState([
    {
      id: Date.now(),
      code: "",
      itemName: "",

      dia: "",
      eye: "",
      sph: "",
      cyl: "",
      axis: "",
      add: "",
      remark: "",
      qty: "",
      price: "",
      totalAmount: ""
    }
  ]);

  const [exchangeInProducts, setExchangeInProducts] = useState([
    {
      id: Date.now() + 1,
      code: "",
      itemName: "",

      dia: "",
      eye: "",
      sph: "",
      cyl: "",
      axis: "",
      add: "",
      remark: "",
      qty: "",
      price: "",
      totalAmount: ""
    }
  ]);

  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([]);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [itemSuggestions, setItemSuggestions] = useState({ out: {}, in: {} });
  const [itemSearch, setItemSearch] = useState({ out: {}, in: {} });

  const partyRef = useRef(null);

  // ---- init ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, itemRes] = await Promise.all([
          getAllAccounts(),
          getAllLensPower()
        ]);
        setAccounts(Array.isArray(accRes) ? accRes : []);
        setItems(Array.isArray(itemRes?.data) ? itemRes.data : Array.isArray(itemRes) ? itemRes : []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    fetchData();

    if (id) {
      const fetchExchange = async () => {
        try {
          const res = await getProductExchangeById(id);
          if (res.success) {
            const data = res.data;
            setFormData({
              billSeries: data.billData.billSeries,
              billNo: data.billData.billNo,
              date: new Date(data.billData.date).toISOString().split("T")[0],
              type: data.billData.type,
              godown: data.billData.godown,
              bookedBy: data.billData.bookedBy,
              partyName: data.partyData.partyAccount,
              address: data.partyData.address,
              contactNo: data.partyData.contactNumber,
              remarks: data.remarks
            });
            setPartySearch(data.partyData.partyAccount);
            setExchangeOutProducts(data.exchangeOutItems.map((it, idx) => ({ ...it, id: Date.now() + idx })));
            setExchangeInProducts(data.exchangeInItems.map((it, idx) => ({ ...it, id: Date.now() + idx + 100 })));
          }
        } catch (err) {
          toast.error("Failed to fetch exchange record");
        }
      };
      fetchExchange();
    } else {
      const fetchNextBillNo = async () => {
        try {
          const res = await getAllProductExchanges();
          if (res.success && res.data.length > 0) {
            const maxBillNo = Math.max(...res.data.map(e => parseInt(e.billData.billNo) || 0));
            setFormData(prev => ({ ...prev, billNo: String(maxBillNo + 1) }));
          } else {
            setFormData(prev => ({ ...prev, billNo: "1" }));
          }
        } catch (err) {
          console.error("Failed to fetch next bill no:", err);
        }
      };
      fetchNextBillNo();
    }
  }, [id]);

  useEffect(() => {
    if (!id && user?.name) {
      setFormData(prev => ({ ...prev, bookedBy: user.name }));
    }
  }, [user, id]);

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value ?? "" }));
    if (field === "partyName") setPartySearch(value);
  };

  const handleProductChange = (productType, productId, field, value) => {
    const setProducts = productType === "out" ? setExchangeOutProducts : setExchangeInProducts;
    setProducts(prev =>
      prev.map(product => {
        if (product.id === productId) {
          const updated = { ...product, [field]: value ?? "" };
          const qty = parseFloat(updated.qty) || 0;
          const price = parseFloat(updated.price) || 0;
          updated.totalAmount = (qty * price).toFixed(2);
          return updated;
        }
        return product;
      })
    );
  };

  const addNewRow = (productType) => {
    const setProducts = productType === "out" ? setExchangeOutProducts : setExchangeInProducts;
    setProducts(prev => [...prev, {
      id: Date.now() + Math.random(),
      code: "",
      itemName: "",

      dia: "",
      eye: "",
      sph: "",
      cyl: "",
      axis: "",
      add: "",
      remark: "",
      qty: "",
      price: "",
      totalAmount: ""
    }]);
  };

  const deleteRow = (productType, productId) => {
    const products = productType === "out" ? exchangeOutProducts : exchangeInProducts;
    const setProducts = productType === "out" ? setExchangeOutProducts : setExchangeInProducts;
    if (products.length <= 1) return;
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleSave = async () => {
    if (!formData.partyName) return toast.error("Please select a party");
    if (!formData.billNo) return toast.error("Bill No is required");

    const totals = {
      totalExchOutQty: exchangeOutProducts.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0),
      totalExchOutAmnt: exchangeOutProducts.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0),
      totalExchInQty: exchangeInProducts.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0),
      totalExchInAmnt: exchangeInProducts.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0),
    };

    const payload = {
      billData: {
        billSeries: formData.billSeries,
        billNo: formData.billNo,
        date: formData.date,
        type: formData.type,
        godown: formData.godown,
        bookedBy: formData.bookedBy
      },
      partyData: {
        partyAccount: formData.partyName,
        address: formData.address,
        contactNumber: formData.contactNo
      },
      exchangeOutItems: exchangeOutProducts,
      exchangeInItems: exchangeInProducts,
      totals,
      remarks: formData.remarks,
      status: "Completed"
    };

    try {
      const res = id ? await updateProductExchange(id, payload) : await addProductExchange(payload);
      if (res.success) {
        toast.success(id ? "Exchange record updated" : "Exchange record saved");
        navigate("/lenstransaction/productexchange");
      }
    } catch (err) {
      toast.error("Failed to save exchange record");
    }
  };

  const handleReset = () => {
    window.location.reload();
  };

  const [openBilling, setOpenBilling] = useState(true);
  const [openParty, setOpenParty] = useState(true);

  const filteredAccounts = accounts.filter(acc =>
    String(acc.Name || "").toLowerCase().includes(partySearch.toLowerCase())
  ).slice(0, 10);

  const selectAccount = (acc) => {
    setFormData(prev => ({
      ...prev,
      partyName: acc.Name,
      address: acc.Address || "",
      contactNo: acc.MobileNumber || ""
    }));
    setPartySearch(acc.Name);
    setShowPartySuggestions(false);
  };

  const selectItem = (item, rowId, type) => {
    const setProducts = type === "out" ? setExchangeOutProducts : setExchangeInProducts;
    setProducts(prev => prev.map(p => {
      if (p.id === rowId) {
        return {
          ...p,
          itemName: item.productName,
          code: item.productCode || item._id?.slice(-6) || "",

          price: item.salePrice?.default || 0,
          dia: item.dia || "",
          eye: item.eye || "",
          sph: item.sph || "",
          cyl: item.cyl || "",
          axis: item.axis || "",
          add: item.add || "",
          remark: item.remark || "",
          totalAmount: (parseFloat(p.qty || 0) * (item.salePrice?.default || 0)).toFixed(2)
        };
      }
      return p;
    }));
    setItemSuggestions(prev => ({
      ...prev,
      [type]: { ...prev[type], [rowId]: false }
    }));
    setItemSearch(prev => ({
      ...prev,
      [type]: { ...prev[type], [rowId]: item.productName }
    }));
  };

  return (
    <div className="p-4 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-[98vw] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Add Product Exchange</h1>
            <p className="text-slate-600">Create a new product exchange transaction</p>
          </div>
          <button onClick={() => navigate("/lenstransaction/productexchange")} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 flex items-center gap-2">
            <X size={18} /> Cancel
          </button>
        </div>

        {/* Billing Details */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 mb-6 overflow-hidden">
          <button onClick={() => setOpenBilling(!openBilling)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 outline-none">
            <div className="font-medium text-slate-800">Billing Details</div>
            {openBilling ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {openBilling && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="relative">
                  <select value={formData.billSeries} onChange={(e) => handleFormChange("billSeries", e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300">
                    <option value="Exchange">Exchange</option>
                  </select>
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Bill Series</label>
                </div>
                <div className="relative">
                  <input type="text" value={formData.billNo} onChange={(e) => handleFormChange("billNo", e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300" />
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Bill No.</label>
                </div>
                <div className="relative">
                  <input type="date" value={formData.date} onChange={(e) => handleFormChange("date", e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300" />
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Date</label>
                </div>
                <div className="relative">
                  <select value={formData.type} onChange={(e) => handleFormChange("type", e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300">
                    <option value="Lens">Lens</option>
                    <option value="Optics">Optics</option>
                    <option value="Glasses">Glasses</option>
                  </select>
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Type</label>
                </div>
                <div className="relative">
                  <select value={formData.godown} onChange={(e) => handleFormChange("godown", e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300">
                    <option value="MT-1">MT-1</option>
                    <option value="MC-1">MC-1</option>
                    <option value="MB-1">MB-1</option>
                  </select>
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Godown</label>
                </div>
                <div className="relative">
                  <input type="text" value={formData.bookedBy} onChange={(e) => handleFormChange("bookedBy", e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300" />
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Booked By</label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Party Details */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 mb-6">
          <button onClick={() => setOpenParty(!openParty)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 outline-none">
            <div className="font-medium text-slate-800">Party Details</div>
            {openParty ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {openParty && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="relative" ref={partyRef}>
                  <input
                    type="text"
                    value={partySearch}
                    onChange={(e) => {
                      setPartySearch(e.target.value);
                      setShowPartySuggestions(true);
                      handleFormChange("partyName", e.target.value);
                    }}
                    onFocus={() => setShowPartySuggestions(true)}
                    placeholder="Search Party..."
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300"
                  />
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Party A/c</label>
                  {showPartySuggestions && partySearch && (
                    <div className="absolute z-[100] w-full mt-1 bg-white border rounded-lg shadow-2xl max-h-60 overflow-y-auto left-0 top-full">
                      {filteredAccounts.map(acc => (
                        <div key={acc._id} onClick={() => selectAccount(acc)} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm">
                          {acc.Name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input type="text" value={formData.address} onChange={(e) => handleFormChange("address", e.target.value)} placeholder="Address" className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300" />
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Address</label>
                </div>
                <div className="relative">
                  <input type="tel" value={formData.contactNo} onChange={(e) => handleFormChange("contactNo", e.target.value)} placeholder="Contact No" className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300" />
                  <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Contact No.</label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Exchange Out / In tables */}
        {[
          { type: "out", title: "Exchange Out Product List", list: exchangeOutProducts },
          { type: "in", title: "Exchange In Product List", list: exchangeInProducts }
        ].map((table) => (
          <div key={table.type} className="bg-white rounded-xl shadow-md border border-slate-200 mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{table.title}</h3>
              <button onClick={() => addNewRow(table.type)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
                <Plus size={14} /> Add Row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="w-12 py-3 px-1 text-[10px] font-bold text-slate-700">Sr.</th>
                    <th className="w-20 py-3 px-1 text-[10px] font-bold text-slate-700">Code</th>
                    <th className="min-w-[150px] py-3 px-1 text-[10px] font-bold text-slate-700">Item Name</th>

                    <th className="w-14 py-3 px-1 text-[10px] font-bold text-slate-700">Dia</th>
                    <th className="w-14 py-3 px-1 text-[10px] font-bold text-slate-700">Eye</th>
                    <th className="w-14 py-3 px-1 text-[10px] font-bold text-slate-700">SPH</th>
                    <th className="w-14 py-3 px-1 text-[10px] font-bold text-slate-700">CYL</th>
                    <th className="w-14 py-3 px-1 text-[10px] font-bold text-slate-700">Axis</th>
                    <th className="w-14 py-3 px-1 text-[10px] font-bold text-slate-700">Add</th>
                    <th className="min-w-[150px] py-3 px-1 text-[10px] font-bold text-slate-700 text-center">Remark</th>
                    <th className="w-16 py-3 px-1 text-[10px] font-bold text-slate-700">Qty</th>
                    <th className="w-20 py-3 px-1 text-[10px] font-bold text-slate-700">Price</th>
                    <th className="w-24 py-3 px-1 text-[10px] font-bold text-slate-700">Total</th>
                    <th className="w-10 py-3 px-1 text-[10px] font-bold text-slate-700">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {table.list.map((product, idx) => (
                    <tr key={product.id} className="hover:bg-slate-50 transition">
                      <td className="text-center text-xs py-2">{idx + 1}</td>
                      <td><input type="text" value={product.code} onChange={(e) => handleProductChange(table.type, product.id, "code", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none" /></td>
                      <td className="relative">
                        <input
                          type="text"
                          value={itemSearch[table.type]?.[product.id] ?? product.itemName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemSearch(prev => ({ ...prev, [table.type]: { ...prev[table.type], [product.id]: val } }));
                            setItemSuggestions(prev => ({ ...prev, [table.type]: { ...prev[table.type], [product.id]: true } }));
                            handleProductChange(table.type, product.id, "itemName", val);
                          }}
                          onFocus={() => setItemSuggestions(prev => ({ ...prev, [table.type]: { ...prev[table.type], [product.id]: true } }))}
                          className="w-full px-1 py-1 text-xs border rounded outline-none"
                        />
                        {itemSuggestions[table.type]?.[product.id] && (itemSearch[table.type]?.[product.id] || product.itemName) && (
                          <div className="absolute z-[100] w-full mt-1 bg-white border rounded shadow-2xl max-h-60 overflow-y-auto left-0 top-full">
                            {items.filter(i => i.productName.toLowerCase().includes((itemSearch[table.type]?.[product.id] || product.itemName || "").toLowerCase())).slice(0, 10).map(item => (
                              <div key={item._id} onClick={() => selectItem(item, product.id, table.type)} className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-[10px]">
                                {item.productName}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td><input type="text" value={product.dia} onChange={(e) => handleProductChange(table.type, product.id, "dia", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td><input type="text" value={product.eye} onChange={(e) => handleProductChange(table.type, product.id, "eye", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td><input type="text" value={product.sph} onChange={(e) => handleProductChange(table.type, product.id, "sph", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td><input type="text" value={product.cyl} onChange={(e) => handleProductChange(table.type, product.id, "cyl", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td><input type="text" value={product.axis} onChange={(e) => handleProductChange(table.type, product.id, "axis", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td><input type="text" value={product.add} onChange={(e) => handleProductChange(table.type, product.id, "add", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td>
                        <textarea
                          rows={1}
                          value={product.remark}
                          onChange={(e) => handleProductChange(table.type, product.id, "remark", e.target.value)}
                          onInput={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = (e.target.scrollHeight) + 'px';
                          }}
                          className="w-full px-1 py-1 text-xs border rounded outline-none resize-none overflow-hidden min-h-[30px] leading-tight"
                          placeholder="REMARK"
                        />
                      </td>
                      <td><input type="number" value={product.qty} onChange={(e) => handleProductChange(table.type, product.id, "qty", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center font-bold" /></td>
                      <td><input type="number" value={product.price} onChange={(e) => handleProductChange(table.type, product.id, "price", e.target.value)} className="w-full px-1 py-1 text-xs border rounded outline-none text-center" /></td>
                      <td><input type="text" value={product.totalAmount} readOnly className="w-full px-1 py-1 text-xs bg-slate-50 text-right pr-2 border rounded outline-none font-bold text-slate-700" /></td>
                      <td className="text-center">
                        <button onClick={() => deleteRow(table.type, product.id)} className="text-red-500 hover:text-red-700 p-1"><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 relative">
            <input type="text" value={formData.remarks} onChange={(e) => handleFormChange("remarks", e.target.value)} placeholder="Remarks" className="w-full px-3 py-2 border rounded-lg outline-none text-sm border-slate-300" />
            <label className="absolute left-2 -top-2 text-xs font-medium bg-white px-1 text-gray-500">Remarks</label>
          </div>
          <div className="flex gap-4">
            <button onClick={handleSave} className="px-8 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-lg transition">
              <Save size={18} /> Save
            </button>
            <button onClick={handleReset} className="px-8 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 flex items-center gap-2 shadow transition">
              <RotateCcw size={18} /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddProductExchange;
