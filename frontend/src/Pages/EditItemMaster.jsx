import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItemById, updateItem, getNextAlias } from '../controllers/itemcontroller'
import { getAllTaxCategories } from '../controllers/TaxCategoryController.js'
import toast from 'react-hot-toast'
import { Save, RotateCcw } from 'lucide-react'

function EditItemMaster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [groupNames, setGroupNames] = useState([])

  const [formData, setFormData] = useState({
    itemName: '',
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
    typeOfsupply: '',
    location: '',
    boxNo: '',
    imageFile: null,
    taxCategory: ''
  })

  const [taxCategories, setTaxCategories] = useState([])

  const [itemAttributes, setItemAttributes] = useState([
    { id: 1, attribute: '', value: '', type: '', category: '' }
  ])

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true)
      try {
        // fetch groups for select (best-effort)
        try {
          const grp = await getAllGroups()
          const names = (grp.groups || []).map(g => g.groupName)
          setGroupNames(names)
        } catch (e) {
          console.warn('Failed fetching groups', e)
        }

        // fetch tax categories
        try {
          const res = await getAllTaxCategories();
          const dataArr = res.data?.data || res.data || [];
          setTaxCategories(Array.isArray(dataArr) ? dataArr : []);
        } catch (e) {
          console.warn('Failed fetching tax categories', e)
        }

        const res = await getItemById(id)
        const item = res.item || res
        if (item) {
          setFormData({
            itemName: item.itemName || '',
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
            typeOfsupply: item.typeOfsupply || '',
            location: item.location || '',
            boxNo: item.boxNo || '',
            taxCategory: item.TaxCategory || ''
          })

          if (Array.isArray(item.attributes) && item.attributes.length > 0) {
            setItemAttributes(item.attributes.map((a, idx) => ({ id: idx+1, attribute: a.attribute||'', value: a.value||'', type: a.type||'', category: a.category||'' })))
          }
        } else {
          toast.error('Item not found')
          navigate('/masters/inventorymaster/itemgroupmaster')
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed fetching item')
        navigate('/masters/inventorymaster/itemgroupmaster')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchItem()
  }, [id, navigate])

  const handleInputChange = (field, value) => {
    setFormData((p) => ({ ...p, [field]: value }))
  }

  const handleAttributeChange = (index, field, value) => {
    setItemAttributes(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addAttributeRow = () => {
    setItemAttributes(prev => [...prev, { id: prev.length + 1, attribute: '', value: '', type: '', category: '' }])
  }

  const toNumberOrNull = (v) => {
    if (v === undefined || v === null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!formData.itemName || !formData.itemName.trim()) {
      toast.error('Item Name required')
      return
    }
    setSubmitting(true)
    const payload = {
      itemName: formData.itemName,
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
      forLensProduct: !!formData.forLensProduct
      ,
      typeOfsupply: formData.typeOfsupply || null,
      location: formData.location || null,
      boxNo: formData.boxNo || null,
      TaxCategory: formData.taxCategory || null,
      attributes: itemAttributes
    }

    try {
      const res = await updateItem(id, payload)
      toast.success(res?.message || 'Item updated')
      navigate('/masters/inventorymaster/itemgroupmaster')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to update item')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0]
    handleInputChange('imageFile', f)
  }

  const handleResetForm = async () => {
    // reload from server
    setLoading(true)
    try {
      const res = await getItemById(id)
      const item = res.item || res
      if (item) {
        setFormData(prev => ({
          ...prev,
          itemName: item.itemName || '',
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
          typeOfsupply: item.typeOfsupply || '',
          location: item.location || '',
          boxNo: item.boxNo || '',
          taxCategory: item.TaxCategory || ''
        }))
        if (Array.isArray(item.attributes) && item.attributes.length > 0) {
          setItemAttributes(item.attributes.map((a, idx) => ({ id: idx+1, attribute: a.attribute||'', value: a.value||'', type: a.type||'', category: a.category||'' })))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Edit Item Master</h1>
          <p className="text-slate-600">Modify the inventory item details</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Item Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.itemName} onChange={(e) => handleInputChange('itemName', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>

                <div className="row-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Item Image</label>
                  <div className="relative">
                    <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors duration-200 cursor-pointer">
                      <div className="text-center">
                        <p className="text-sm text-slate-600">Click to upload image</p>
                        <p className="text-xs text-slate-400">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                    <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Alias</label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => handleInputChange('alias', e.target.value)}
                    onBlur={async () => {
                      if (formData.alias) {
                        try {
                           await updateItem(id, { alias: formData.alias });
                           toast.success('Alias auto-saved', { duration: 1000, position: 'bottom-right' });
                        } catch (err) { console.error(err); }
                      }
                    }}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Print Name</label>
                  <input type="text" value={formData.printName} onChange={(e) => handleInputChange('printName', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Group Name</label>
                  <div className="flex gap-2">
                    <select value={formData.groupName} onChange={(e) => handleInputChange('groupName', e.target.value)} className="flex-1 px-4 py-3 border border-slate-300 rounded-lg">
                      <option value="">Select group</option>
                      {groupNames.map((group, index) => (
                        <option key={index} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Unit</label>
                  <input type="text" value={formData.unit} onChange={(e) => handleInputChange('unit', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">All Unit</label>
                  <div className="flex gap-2">
                    <select value={formData.allUnit} onChange={(e) => handleInputChange('allUnit', e.target.value)} className="flex-1 px-4 py-3 border border-slate-300 rounded-lg">
                      <option value="">Select unit</option>
                      <option value="piece">Piece</option>
                      <option value="box">Box</option>
                      <option value="kg">Kilogram</option>
                      <option value="liter">Liter</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tax Category</label>
                  <input
                    list="tax-categories-list"
                    type="text"
                    value={formData.taxCategory}
                    onChange={(e) => handleInputChange('taxCategory', e.target.value)}
                    onBlur={() => {
                        updateItem(id, { TaxCategory: formData.taxCategory }).then(() => {
                           toast.success('Tax Category auto-saved', { duration: 1000, position: 'bottom-right' });
                        }).catch(err => console.error(err));
                    }}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                    placeholder="e.g. GST 5%"
                  />
                  <datalist id="tax-categories-list">
                    {taxCategories.map((tax) => (
                      <option key={tax._id} value={tax.Name} />
                    ))}
                  </datalist>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={3} className="w-full px-4 py-3 border border-slate-300 rounded-lg resize-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Item Attributes</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-50 to-slate-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Attribute</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Value</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemAttributes.map((attr, index) => (
                      <tr key={attr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input type="text" value={attr.attribute} onChange={(e) => handleAttributeChange(index, 'attribute', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={attr.value} onChange={(e) => handleAttributeChange(index, 'value', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={attr.type} onChange={(e) => handleAttributeChange(index, 'type', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={attr.category} onChange={(e) => handleAttributeChange(index, 'category', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <button type="button" onClick={addAttributeRow} className="px-3 py-2 bg-slate-100 rounded-lg">Add attribute</button>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Item Tax Settings</h3>
                <select value={formData.taxSetting} onChange={(e) => handleInputChange('taxSetting', e.target.value)} className="px-4 py-3 border border-slate-300 rounded-lg">
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Item Price & Stock Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Opening Stock (Qty)</label>
                  <input type="number" value={formData.openingStock} onChange={(e) => handleInputChange('openingStock', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Opening Stock (Value)</label>
                  <input type="number" value={formData.openingStockValue} onChange={(e) => handleInputChange('openingStockValue', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Price</label>
                  <input type="number" value={formData.purchasePrice} onChange={(e) => handleInputChange('purchasePrice', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sale Profit %</label>
                  <input type="number" value={formData.saleProfit} onChange={(e) => handleInputChange('saleProfit', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sale Price</label>
                  <input type="number" value={formData.salePrice} onChange={(e) => handleInputChange('salePrice', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">MRP Price</label>
                  <input type="number" value={formData.mrpPrice} onChange={(e) => handleInputChange('mrpPrice', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sale Discount</label>
                  <input type="number" value={formData.saleDiscount} onChange={(e) => handleInputChange('saleDiscount', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Discount</label>
                  <input type="number" value={formData.purchaseDiscount} onChange={(e) => handleInputChange('purchaseDiscount', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Min Sale Price</label>
                  <input type="number" value={formData.minSalePrice} onChange={(e) => handleInputChange('minSalePrice', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsnCode}
                    onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                    onBlur={async () => {
                      try {
                         await updateItem(id, { hsnCode: formData.hsnCode });
                         toast.success('HSN Code auto-saved', { duration: 1000, position: 'bottom-right' });
                      } catch (err) { console.error(err); }
                    }}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Barcode</label>
                  <input type="text" value={formData.barcode} onChange={(e) => handleInputChange('barcode', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Loyalty Points</label>
                  <input type="number" value={formData.loyaltyPoints} onChange={(e) => handleInputChange('loyaltyPoints', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
              </div>

              <div className="mt-6">
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" checked={formData.forLensProduct} onChange={(e) => handleInputChange('forLensProduct', e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded" />
                  For Lens Product
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Item Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sell Stock Level</label>
                  <input type="text" value={formData.sellStockLevel} onChange={(e) => handleInputChange('sellStockLevel', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Batch Wise Details</label>
                  <input type="text" value={formData.batchWiseDetails} onChange={(e) => handleInputChange('batchWiseDetails', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                  <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Box No</label>
                  <input type="text" value={formData.boxNo} onChange={(e) => handleInputChange('boxNo', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col gap-3">
                <button onClick={handleSubmit} disabled={submitting} className={`w-full px-4 py-3 rounded-lg ${submitting ? 'bg-blue-400 text-white cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {submitting ? 'Updating...' : 'Update Item'}
                </button>
                <button onClick={handleResetForm} className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg">Reset</button>
                <button onClick={() => navigate(-1)} className="w-full px-4 py-3 bg-red-100 text-red-700 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditItemMaster
