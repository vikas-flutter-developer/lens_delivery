import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ShoppingCart, PlusCircle, Package, RefreshCw, BarChart2, 
  Settings, Plus, Trash2, Edit2, X, Check, Search, MoveRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const DEFAULT_SHORTCUTS = [
  { id: '1', label: 'Sale Order', route: '/lenstransaction/sale/saleorder', icon: 'FileText', color: 'bg-blue-500' },
  { id: '2', label: 'Sale Challan', route: '/lenstransaction/sale/salechallan', icon: 'ShoppingCart', color: 'bg-indigo-500' },
  { id: '3', label: 'Purchase Order', route: '/lenstransaction/purchase/purchaseorder', icon: 'Package', color: 'bg-emerald-500' },
  { id: '4', label: 'Purchase Challan', route: '/lenstransaction/purchase/purchasechallan', icon: 'FileText', color: 'bg-teal-500' },
  { id: '5', label: 'Add Voucher', route: '/transaction/payrecptumicntr/addvoucher', icon: 'PlusCircle', color: 'bg-amber-500' },
  { id: '6', label: 'Lens SPH CYL Stock', route: '/lenstransaction/lenssphcylwisestock', icon: 'BarChart2', color: 'bg-rose-500' },
  { id: '7', label: 'Party Wise Item Report', route: '/lenstransaction/lensstockreport/partywiseitemreport', icon: 'BarChart2', color: 'bg-purple-500' },
  { id: '8', label: 'Product Exchange', route: '/lenstransaction/productexchange', icon: 'RefreshCw', color: 'bg-orange-500' },
];

const ICON_MAP = {
  FileText, ShoppingCart, PlusCircle, Package, RefreshCw, BarChart2, Search
};

const COLOR_OPTIONS = [
  { label: 'Blue', value: 'bg-blue-500' },
  { label: 'Indigo', value: 'bg-indigo-500' },
  { label: 'Emerald', value: 'bg-emerald-500' },
  { label: 'Teal', value: 'bg-teal-500' },
  { label: 'Amber', value: 'bg-amber-500' },
  { label: 'Rose', value: 'bg-rose-500' },
  { label: 'Purple', value: 'bg-purple-500' },
  { label: 'Orange', value: 'bg-orange-500' },
  { label: 'Slate', value: 'bg-slate-500' },
  { label: 'Cyan', value: 'bg-cyan-500' },
];

const PRESET_ROUTES = [
  // Dashboard & Common
  { label: 'Dashboard', value: '/' },
  { label: 'Admin Dashboard', value: '/AdminDashboard' },
  { label: 'Shortcut Keys', value: '/utilities/shortcutkeys' },
  
  // Masters
  { label: 'Account Group Master', value: '/masters/accountmaster/accountgroupmaster' },
  { label: 'Account Master', value: '/masters/accountmaster/accountmaster' },
  { label: 'Inventory Creation', value: '/masters/inventorymaster/creation' },
  { label: 'Lens Price Master', value: '/masters/inventorymaster/lensprice' },
  { label: 'Tax Category', value: '/masters/billandothermaster/taxcategory' },
  
  // Transactions -> Lens
  { label: 'Sale Order', value: '/lenstransaction/sale/saleorder' },
  { label: 'Add Sale Order', value: '/lenstransaction/sale/AddLensSaleOrder' },
  { label: 'Sale Challan', value: '/lenstransaction/sale/salechallan' },
  { label: 'Add Sale Challan', value: '/lenstransaction/sale/AddLensSaleChallan' },
  { label: 'Sale Invoice', value: '/lenstransaction/sale/saleinvoice' },
  { label: 'Add Sale Invoice', value: '/lenstransaction/sale/AddLensSale' },
  { label: 'Purchase Order', value: '/lenstransaction/purchase/purchaseorder' },
  { label: 'Add Purchase Order', value: '/lenstransaction/purchase/AddLensPurchaseOrder' },
  { label: 'Purchase Challan', value: '/lenstransaction/purchase/purchasechallan' },
  { label: 'Add Purchase Challan', value: '/lenstransaction/purchase/AddLensPurchaseChallan' },
  { label: 'Purchase Invoice', value: '/lenstransaction/purchase/purchaseinvoice' },
  { label: 'Add Purchase Invoice', value: '/lenstransaction/purchase/AddLensPurchase' },
  { label: 'Sale Return', value: '/lenstransaction/salereturn' },
  { label: 'Add Sale Return', value: '/lenstransaction/addsalereturn' },
  { label: 'Purchase Return', value: '/lenstransaction/purchasereturn' },
  { label: 'Add Purchase Return', value: '/lenstransaction/addpurchasereturn' },
  
  // Transactions -> Rx
  { label: 'Add Rx Order', value: '/rxtransaction/rxorder/addrxorder' },
  { label: 'Add Rx Purchase', value: '/rxtransaction/rxpurchase/addRxPurchase' },
  { label: 'Add Rx Sale', value: '/rxtransaction/rxsale/addRxSale' },
  
  // Transactions -> Others
  { label: 'Add Voucher', value: '/transaction/payrecptumicntr/addvoucher' },
  { label: 'Product Exchange', value: '/lenstransaction/productexchange' },
  { label: 'Add Product Exchange', value: '/add/addproductexchange' },
  { label: 'Damage & Shrinkage', value: '/lenstransaction/damageandshrinkage' },
  { label: 'Add Damage Entry', value: '/lenstransaction/adddamageentry' },
  
  // Reports -> Stock
  { label: 'Lens SPH CYL Stock', value: '/lenstransaction/lenssphcylwisestock' },
  { label: 'Party Wise Item Report', value: '/lenstransaction/lensstockreport/partywiseitemreport' },
  { label: 'Lens Stock (No Barcode)', value: '/lenstransaction/lensstockreport/lensstockwithoutbarcode' },
  { label: 'Lens Stock (With Barcode)', value: '/lenstransaction/lensstockreport/lensstockwithbarcode' },
  { label: 'Lens Movement Report', value: '/lenstransaction/lensstockreport/lensmovement' },
  { label: 'Verify Lens Stock', value: '/lenstransaction/lensstockreport/verifylensstock' },
  { label: 'Lens Location', value: '/lenstransaction/lensstockreport/lenslocation' },
  
  // Reports -> Accounts
  { label: 'Day Book', value: '/reports/books/daybook' },
  { label: 'Cash/Bank Book', value: '/reports/books/cashbankbook' },
  { label: 'Account Ledger', value: '/reports/ledger/accountledger' },
  { label: 'Account Ledger Details', value: '/reports/ledger/accountledgerdetails' },
  { label: 'Outstanding Report', value: '/reports/ledger/outstanding' },
  { label: 'Balance Sheet', value: '/reports/books/balancesheet' },
  { label: 'Profit & Loss (Account)', value: '/reports/books/profitandlossaccount' },
  { label: 'Profit & Loss (Item)', value: '/reports/books/profitandlossitem' },
  { label: 'Collection Report', value: '/reports/books/collectionreport' },
  
  // Reports -> Others
  { label: 'Deleted Data Report', value: '/reports/otherreports/deleteddatareport' },
  { label: 'Booked By Report', value: '/reports/otherreports/bookedbyreport' },
  { label: 'Customer Analysis', value: '/reports/otherreports/customeranalysis' },
  { label: 'User Activity Report', value: '/reports/otherreports/useractivityreport' },
  { label: 'Power Movement Report', value: '/reports/otherreports/powermovementreport' },
  { label: 'Sale Return Ratio Report', value: '/reports/otherreports/salereturnratioreport' },
  { label: 'Sale Target Report', value: '/reports/otherreports/saletargetreport' },
  
  // Utilities
  { label: 'Database Backup', value: '/utilities/databasebackuprestore/backupandrestore' },
  { label: 'Bulk Product Update', value: '/utilities/bulkupdation/productlistforupdate' },
  { label: 'Offers', value: '/utilities/offers' },
  { label: 'Verify Bank Statement', value: '/reports/verification/bank-statement' },
];

const QuickShortcuts = () => {
  const navigate = useNavigate();
  const [shortcuts, setShortcuts] = useState([]);
  const [isManageMode, setIsManageMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState(null);
  
  const [formData, setFormData] = useState({
    label: '',
    route: '',
    icon: 'FileText',
    color: 'bg-blue-500'
  });

  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteResults, setShowRouteResults] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_shortcuts');
    if (saved) {
      try {
        setShortcuts(JSON.parse(saved));
      } catch (e) {
        setShortcuts(DEFAULT_SHORTCUTS);
      }
    } else {
      setShortcuts(DEFAULT_SHORTCUTS);
      localStorage.setItem('dashboard_shortcuts', JSON.stringify(DEFAULT_SHORTCUTS));
    }
  }, []);

  const saveShortcuts = (updated) => {
    setShortcuts(updated);
    localStorage.setItem('dashboard_shortcuts', JSON.stringify(updated));
  };

  const handleAddOrEdit = () => {
    if (!formData.label || !formData.route) {
      toast.error('Please fill label and route');
      return;
    }

    if (editingShortcut) {
      const updated = shortcuts.map(s => 
        s.id === editingShortcut.id ? { ...s, ...formData } : s
      );
      saveShortcuts(updated);
      toast.success('Shortcut updated');
    } else {
      const newItem = {
        ...formData,
        id: Date.now().toString()
      };
      saveShortcuts([...shortcuts, newItem]);
      toast.success('Shortcut added');
    }
    
    closeModal();
  };

  const removeShortcut = (id) => {
    const updated = shortcuts.filter(s => s.id !== id);
    saveShortcuts(updated);
    toast.success('Shortcut removed');
  };

  const openEditModal = (shortcut) => {
    setEditingShortcut(shortcut);
    setFormData({
      label: shortcut.label,
      route: shortcut.route,
      icon: shortcut.icon,
      color: shortcut.color
    });
    setRouteSearch(shortcut.route);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingShortcut(null);
    setFormData({ label: '', route: '', icon: 'FileText', color: 'bg-blue-500' });
    setRouteSearch('');
    setShowRouteResults(false);
  };

  const ShortcutIcon = ({ name, className }) => {
    const IconComponent = ICON_MAP[name] || FileText;
    return <IconComponent className={className} />;
  };

  // Filter routes for shortcut selection
  const filteredRoutes = routeSearch.trim().length > 0
    ? PRESET_ROUTES.filter(route => 
        route.label.toLowerCase().includes(routeSearch.toLowerCase()) ||
        route.value.toLowerCase().includes(routeSearch.toLowerCase())
      ).slice(0, 15)
    : PRESET_ROUTES.slice(0, 15);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 over">
      <div className="flex items-center justify-between mb-6">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <span className="p-2 bg-blue-50 rounded-lg mr-3">
              <MoveRight className="w-6 h-6 text-blue-600" />
            </span>
            Quick Actions
          </h2>
          <p className="text-gray-500 text-sm mt-1">Access your most frequent tasks instantly</p>
        </div>
        <button 
          onClick={() => setIsManageMode(!isManageMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${
            isManageMode 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings className={`w-4 h-4 ${isManageMode ? 'animate-spin-slow' : ''}`} />
          {isManageMode ? 'Finish Managing' : 'Manage Shortcuts'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.id} className="relative group">
            <button
              onClick={() => !isManageMode && navigate(shortcut.route)}
              className={`w-full flex items-center p-4 rounded-xl border border-gray-100 transition-all duration-300 h-20 shadow-sm ${
                isManageMode ? 'cursor-default opacity-80' : 'hover:shadow-md hover:border-gray-200 hover:-translate-y-1 bg-white'
              }`}
            >
              <div className={`${shortcut.color} p-3 rounded-lg text-white mr-4 shadow-sm group-hover:scale-110 transition-transform`}>
                <ShortcutIcon name={shortcut.icon} className="w-5 h-5" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-bold text-gray-800 text-sm truncate">{shortcut.label}</p>
                <p className="text-[10px] text-gray-400 font-medium truncate opacity-60">Navigate to Page</p>
              </div>
            </button>

            {isManageMode && (
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button
                  onClick={() => openEditModal(shortcut)}
                  className="p-1.5 bg-white border border-gray-200 text-blue-600 rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeShortcut(shortcut.id)}
                  className="p-1.5 bg-white border border-gray-200 text-rose-600 rounded-lg shadow-sm hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {isManageMode && (
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all h-20 bg-gray-50/50"
          >
            <div className="flex flex-col items-center">
              <Plus className="w-6 h-6 mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider">Add Shortcut</span>
            </div>
          </button>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 focus-within:ring-0">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                {editingShortcut ? 'Edit Shortcut' : 'Add New Shortcut'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Label</label>
                <input
                  type="text"
                  placeholder="e.g. Sales Report"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Redirect Route</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for a page (e.g. Sale Order)"
                    value={routeSearch}
                    onChange={(e) => {
                      setRouteSearch(e.target.value);
                      setFormData({ ...formData, route: e.target.value });
                      setShowRouteResults(true);
                    }}
                    onFocus={() => setShowRouteResults(true)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition-all bg-gray-50/50 focus:bg-white"
                  />
                  {routeSearch && (
                    <button 
                      onClick={() => {setRouteSearch(''); setFormData({...formData, route: ''});}}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {showRouteResults && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowRouteResults(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 shadow-2xl rounded-xl z-[70] max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-1 duration-200">
                      {filteredRoutes.length > 0 ? (
                        filteredRoutes.map((r, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setFormData({ ...formData, route: r.value, label: formData.label || r.label });
                              setRouteSearch(r.label);
                              setShowRouteResults(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-b-0 transition-colors group"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-xs font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{r.label}</p>
                                <p className="text-[10px] text-gray-400 font-medium group-hover:text-blue-400/70 transition-colors">{r.value}</p>
                              </div>
                              <MoveRight className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-center">
                          <p className="text-xs text-blue-600 font-bold">Custom Route Mode</p>
                          <p className="text-[10px] text-gray-400 mt-1">Press anywhere to use your typed route</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Icon</label>
                <div className="flex flex-wrap gap-3">
                  {Object.keys(ICON_MAP).map(iconName => (
                    <button
                      key={iconName}
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      className={`p-3 rounded-xl border transition-all ${
                        formData.icon === iconName 
                        ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-100' 
                        : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <ShortcutIcon name={iconName} className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${c.value} ${
                        formData.color === c.value ? 'ring-4 ring-offset-2 ring-blue-200 scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {formData.color === c.value && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl font-semibold hover:bg-white transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOrEdit}
                className="flex-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                {editingShortcut ? 'Update Shortcut' : 'Create Shortcut'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 4s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
};

export default QuickShortcuts;
