import React, { useEffect, useState } from 'react'
import { Plus, Save, RotateCcw, Upload, X, Search, Edit, Trash2, Calendar, Layout, List, FileSpreadsheet, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { getAllGroups } from '../controllers/groupcontroller.js'
import { useNavigate } from 'react-router-dom'
import { addItem, getAllItems, deleteItem, updateItem, getNextAlias } from '../controllers/itemcontroller.js'
import { getAllTaxCategories } from '../controllers/TaxCategoryController.js'
import toast from 'react-hot-toast'

function AddItemMaster({ hideHeader = false, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    itemName: '',
    vendorItemName: '',
    billItemName: '',
    alias: '',
    printName: '',
    groupName: '',
    unit: '',
    allUnit: '',
    description: '',
    taxSetting: 'N',
    openingStock: '',
    openingStockValue: '',
    purchasePrice: '',
    saleProfit: '',
    salePrice: '',
    mrpPrice: '',
    saleDiscount: '',
    purchaseDiscount: '',
    minSalePrice: '',
    hsnCode: '',
    barcode: '',
    stockable: '',
    godown: '',
    loyaltyPoints: '',
    refAmn: '',
    refAmntIndia: '',
    forLensProduct: false,
    sellStockLevel: '',
    batchWiseDetails: '',
    taxCategory: ''
  })

  const [taxCategories, setTaxCategories] = useState([])

  const [groupNames, setGroupNames] = useState([])
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const navigate = useNavigate()

  const fetchGroups = async () => {
    try {
      const data = await getAllGroups();
      const names = (data.groups || []).map(group => group.groupName);
      setGroupNames(names);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  }

  const fetchItems = async () => {
    setLoadingItems(true)
    try {
      const data = await getAllItems()
      setItems(data.items || [])
      setFilteredItems(data.items || [])
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    } finally {
      setLoadingItems(false)
    }
  }

  const fetchTaxCategories = async () => {
    try {
      const res = await getAllTaxCategories();
      const dataArr = res.data?.data || res.data || [];
      setTaxCategories(Array.isArray(dataArr) ? dataArr : []);
    } catch (error) {
      console.error('Error fetching tax categories:', error);
    }
  }

  const fetchNextAlias = async () => {
    if (!editingId) {
      try {
        const res = await getNextAlias();
        if (res?.nextAlias) {
          setFormData(prev => ({ ...prev, alias: res.nextAlias }));
        }
      } catch (error) {
        console.error('Error fetching next alias:', error);
      }
    }
  }

  useEffect(() => {
    fetchGroups();
    fetchItems();
    fetchTaxCategories();
  }, []);

  useEffect(() => {
    if (!editingId) {
      fetchNextAlias();
    }
  }, [editingId]);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(item =>
        (item.itemName || '').toLowerCase().includes(term) ||
        (item.groupName || '').toLowerCase().includes(term) ||
        (item.unit || '').toLowerCase().includes(term) ||
        (item.alias || '').toLowerCase().includes(term)
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, items]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleReset = () => {
    setFormData({
      itemName: '',
      vendorItemName: '',
      billItemName: '',
      alias: '',
      printName: '',
      groupName: '',
      unit: '',
      allUnit: '',
      description: '',
      taxSetting: 'N',
      openingStock: '',
      openingStockValue: '',
      purchasePrice: '',
      saleProfit: '',
      salePrice: '',
      mrpPrice: '',
      saleDiscount: '',
      purchaseDiscount: '',
      minSalePrice: '',
      hsnCode: '',
      barcode: '',
      stockable: '',
      godown: '',
      loyaltyPoints: '',
      refAmn: '',
      refAmntIndia: '',
      forLensProduct: false,
      sellStockLevel: '',
      batchWiseDetails: '',
      taxCategory: ''
    })
    setEditingId(null)
    fetchNextAlias();
  }

  const addGroupName = () => {
    // Typically this would open a modal or navigate to group creation
    // For now, let's just show a toast or keep the existing dummy behavior
    toast.success('Navigate to Item Group tab to add new group')
  }

  const toNumberOrNull = (v) => {
    if (v === undefined || v === null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()

    if (!formData.itemName || !formData.itemName.trim()) {
      toast.error('Item Name is required')
      return
    }
    if (!formData.groupName || !formData.groupName.trim()) {
      toast.error('Group Name is required')
      return
    }

    setSubmitting(true)

    const payload = {
      itemName: formData.itemName,
      vendorItemName: formData.vendorItemName || '',
      billItemName: formData.billItemName || '',
      alias: formData.alias || null,
      printName: formData.printName || null,
      groupName: formData.groupName || null,
      unit: formData.unit || null,
      altUnit: formData.allUnit || null,
      description: formData.description || null,
      taxSetting: formData.taxSetting || 'N',
      openingStockQty: toNumberOrNull(formData.openingStock),
      openingStockValue: toNumberOrNull(formData.openingStockValue),
      purchasePrice: toNumberOrNull(formData.purchasePrice),
      saleProfit: toNumberOrNull(formData.saleProfit),
      salePrice: toNumberOrNull(formData.salePrice),
      mrpPrice: toNumberOrNull(formData.mrpPrice),
      saleDiscount: toNumberOrNull(formData.saleDiscount),
      purchaseDiscount: toNumberOrNull(formData.purchaseDiscount),
      minSalePrice: toNumberOrNull(formData.minSalePrice),
      hsnCode: formData.hsnCode || null,
      barcode: formData.barcode || null,
      stockable: formData.stockable || null,
      godown: formData.godown || null,
      loyaltyPoints: toNumberOrNull(formData.loyaltyPoints),
      refAmn: formData.refAmn || null,
      refAmntIndia: formData.refAmntIndia || null,
      forLensProduct: !!formData.forLensProduct,
      typeOfsupply: null,
      location: null,
      boxNo: null,
      TaxCategory: formData.taxCategory || null
    }

    try {
      if (editingId) {
        await updateItem(editingId, payload)
        toast.success('Item updated successfully')
      } else {
        await addItem(payload)
        toast.success('Item added successfully')
      }
      handleReset()
      fetchItems()
      if (onSaveSuccess && !editingId) {
        onSaveSuccess()
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (item) => {
    setEditingId(item._id)
    setFormData({
      itemName: item.itemName || '',
      vendorItemName: item.vendorItemName || '',
      billItemName: item.billItemName || '',
      alias: item.alias || '',
      printName: item.printName || '',
      groupName: item.groupName || '',
      unit: item.unit || '',
      allUnit: item.altUnit || '',
      description: item.description || '',
      taxSetting: item.taxSetting || 'N',
      openingStock: item.openingStockQty ?? '',
      openingStockValue: item.openingStockValue ?? '',
      purchasePrice: item.purchasePrice ?? '',
      saleProfit: item.saleProfit ?? '',
      salePrice: item.salePrice ?? '',
      mrpPrice: item.mrpPrice ?? '',
      saleDiscount: item.saleDiscount ?? '',
      purchaseDiscount: item.purchaseDiscount ?? '',
      minSalePrice: item.minSalePrice ?? '',
      hsnCode: item.hsnCode || '',
      barcode: item.barcode || '',
      stockable: item.stockable || '',
      godown: item.godown || '',
      loyaltyPoints: item.loyaltyPoints ?? '',
      refAmn: item.refAmn || '',
      refAmntIndia: item.refAmntIndia || '',
      forLensProduct: !!item.forLensProduct,
      sellStockLevel: item.sellStockLevel || '',
      batchWiseDetails: item.batchWiseDetails || '',
      taxCategory: item.TaxCategory || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return
    try {
      await deleteItem(id)
      toast.success('Item deleted successfully')
      fetchItems()
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete item')
    }
  }

  const handleDownloadExcel = () => {
    if (filteredItems.length === 0) {
      toast.error('No records to download');
      return;
    }
    const exportData = filteredItems.map((item, index) => ({
      'Sr No.': index + 1,
      'Created On': item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
      'Group': item.groupName || '-',
      'Item Name': item.itemName || '-',
      'Unit': item.unit || '-',
      'Alias': item.alias || '-',
      'Purchase Price': item.purchasePrice || 0,
      'Selling Price': item.salePrice || 0,
      'Purchase Discount (%)': item.purchaseDiscount || 0
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
    XLSX.writeFile(workbook, 'ItemMaster.xlsx');
  };

  const handlePrint = () => {
    if (filteredItems.length === 0) {
      toast.error('No data to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    const tableRows = filteredItems.map((item, index) => `
      <tr>
        <td style="text-align: center;">${String(index + 1).padStart(2, '0')}</td>
        <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</td>
        <td>${item.groupName || '-'}</td>
        <td style="font-weight: 600;">${item.itemName || '-'}</td>
        <td>${item.unit || '-'}</td>
        <td style="text-align: right;">₹${item.purchasePrice || 0}</td>
        <td style="text-align: right;">₹${item.salePrice || 0}</td>
        <td style="text-align: right;">${item.purchaseDiscount || 0}%</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Item Master</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; background: white; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
            .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 11px; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Item Master</h1>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">Sr No.</th>
                <th>Created On</th>
                <th>Group</th>
                <th>Item Name</th>
                <th>Unit</th>
                <th style="text-align: right;">P. Price</th>
                <th style="text-align: right;">S. Price</th>
                <th style="text-align: right;">P. Disc%</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleString('en-IN')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const formatDate = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className={hideHeader ? "" : "min-h-screen bg-slate-50 p-6"}>
      <div className={hideHeader ? "" : "max-w-7xl mx-auto"}>
        {/* Header */}
        {!hideHeader && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Item Master Creation</h1>
            <p className="text-slate-600 font-medium">Create and manage your inventory items with detailed specifications</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layout className="w-5 h-5" />
                  {editingId ? 'Edit Item Details' : 'New Item Registration'}
                </h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Item Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.itemName}
                      onChange={(e) => handleInputChange('itemName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                      placeholder="e.g. Blue Cut Lens"
                    />
                  </div>

                  {/* Vendor Item Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Vendor Item Name</label>
                    <input
                      type="text"
                      value={formData.vendorItemName}
                      onChange={(e) => handleInputChange('vendorItemName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                      placeholder="Name shown to vendor (WhatsApp)"
                    />
                  </div>

                  {/* Bill Item Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bill Item Name</label>
                    <input
                      type="text"
                      value={formData.billItemName}
                      onChange={(e) => handleInputChange('billItemName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                      placeholder="Name shown in print/bill"
                    />
                  </div>

                  {/* Group Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.groupName}
                        onChange={(e) => handleInputChange('groupName', e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium appearance-none"
                      >
                        <option value="">Select Category</option>
                        {groupNames.map((group, index) => (
                          <option key={index} value={group}>{group}</option>
                        ))}
                      </select>
                      <button
                        onClick={addGroupName}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                        title="Add New Group"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Alias / Code */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Alias / Code</label>
                    <input
                      type="text"
                      value={formData.alias}
                      onChange={(e) => handleInputChange('alias', e.target.value)}
                      onBlur={async () => {
                        if (editingId && formData.alias) {
                          try {
                             await updateItem(editingId, { alias: formData.alias });
                          } catch (err) { console.error(err); }
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                      placeholder="Internal code"
                    />
                  </div>

                  {/* Unit */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Unit</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium appearance-none"
                    >
                      <option value="">Select Unit</option>
                      <option value="Pcs">Pieces</option>
                      <option value="Box">Box</option>
                      <option value="Pair">Pair</option>
                      <option value="Nos">Number</option>
                    </select>
                  </div>

                  {/* HSN Code */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">HSN Code</label>
                    <input
                      type="text"
                      value={formData.hsnCode}
                      onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                      onBlur={async () => {
                        if (editingId) {
                          try {
                             await updateItem(editingId, { hsnCode: formData.hsnCode });
                             toast.success('HSN Code auto-saved', { duration: 1000, position: 'bottom-right' });
                          } catch (err) { console.error(err); }
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                      placeholder="e.g. 9004"
                    />
                  </div>

                  {/* Tax Category */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tax Category</label>
                    <input
                      list="tax-categories"
                      type="text"
                      value={formData.taxCategory}
                      onChange={(e) => handleInputChange('taxCategory', e.target.value)}
                      onBlur={() => {
                        if (editingId) {
                          updateItem(editingId, { TaxCategory: formData.taxCategory }).then(() => {
                            toast.success('Tax Category auto-saved', { duration: 1000, position: 'bottom-right' });
                          }).catch(err => console.error(err));
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                      placeholder="e.g. GST 12%"
                    />
                    <datalist id="tax-categories">
                      {taxCategories.map((tax) => (
                        <option key={tax._id} value={tax.Name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Purchase Price */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Purchase Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
                      onBlur={() => {
                        if (editingId) {
                          updateItem(editingId, { purchasePrice: formData.purchasePrice }).then(() => {
                            toast.success('Purchase Price auto-saved', { duration: 1000, position: 'bottom-right' });
                          }).catch(err => console.error(err));
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium shadow-sm"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Selling Price */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Selling Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.salePrice}
                      onChange={(e) => handleInputChange('salePrice', e.target.value)}
                      onBlur={() => {
                        if (editingId) {
                          updateItem(editingId, { salePrice: formData.salePrice }).then(() => {
                            toast.success('Selling Price auto-saved', { duration: 1000, position: 'bottom-right' });
                          }).catch(err => console.error(err));
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium shadow-sm"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Purchase Discount */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Purchase Discount (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchaseDiscount}
                      onChange={(e) => handleInputChange('purchaseDiscount', e.target.value)}
                      onBlur={() => {
                        if (editingId) {
                          updateItem(editingId, { purchaseDiscount: formData.purchaseDiscount }).then(() => {
                            toast.success('Purchase Discount auto-saved', { duration: 1000, position: 'bottom-right' });
                          }).catch(err => console.error(err));
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium shadow-sm"
                      placeholder="0.00"
                    />
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Actions
              </h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${submitting
                    ? 'bg-slate-100 text-slate-400 cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                    }`}
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingId ? 'Update Item' : 'Save Item'}
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="w-full py-3.5 bg-slate-50 text-slate-600 rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  {editingId ? 'Cancel Edit' : 'Reset Form'}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
              <h4 className="text-xs font-black text-amber-800 uppercase mb-2">Pro Tip</h4>
              <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                Make sure to select the correct Group Name for reporting and stock categorization.
              </p>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="mt-12 mb-10">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <List className="w-6 h-6 text-blue-600" />
                    Inventory Registry
                  </h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-tight mt-1">
                    Total {filteredItems.length} items found
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadExcel}
                      className="h-12 w-12 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 border border-emerald-100 shadow-sm transition-all active:scale-95"
                      title="Download Excel"
                    >
                      <FileSpreadsheet className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handlePrint}
                      className="h-12 w-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 border border-blue-100 shadow-sm transition-all active:scale-95"
                      title="Print Registry"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="relative group max-w-md w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Quick search by name, group or code..."
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Sr No.</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created On
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Group</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor Item Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill Item Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">P. Price</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">S. Price</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">P. Disc %</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingItems ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                          <p className="text-slate-400 text-sm font-bold animate-pulse">Synchronizing inventory...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <tr key={item._id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-5 text-sm font-bold text-slate-400">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                            {formatDate(item.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                            {item.groupName}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{item.itemName}</span>
                            {item.alias && (
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{item.alias}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600">{item.vendorItemName || <span className="text-slate-300 text-xs">—</span>}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600">{item.billItemName || <span className="text-slate-300 text-xs">—</span>}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                            {item.unit || '---'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-bold text-slate-700">₹{item.purchasePrice || 0}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-bold text-blue-600">₹{item.salePrice || 0}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-sm font-bold text-amber-600">{item.purchaseDiscount || 0}%</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit Item"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-40">
                          <Search className="w-12 h-12 text-slate-300" />
                          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No matching items found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddItemMaster
