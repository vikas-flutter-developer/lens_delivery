import React, { useState, useEffect } from 'react';
import { Printer, Plus, Trash2, Search, User, Settings as SettingsIcon } from 'lucide-react';
import { getAllAccounts } from '../controllers/Account.controller';
import { getAllItems } from '../controllers/itemcontroller';
import { Toaster, toast } from 'react-hot-toast';
import QuickShortcuts from '../Components/QuickShortcuts';

function Home() {
  // ==================== Customer Section ====================
  const [accounts, setAccounts] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [customerData, setCustomerData] = useState({
    partyName: '',
    contact: '',
    state: '',
    address: ''
  });

  // ==================== Barcode Section ====================
  const [items, setItems] = useState([]);
  const [barcodeRows, setBarcodeRows] = useState([{ id: Date.now(), barcode: '' }]);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [showBarcodeDropdown, setShowBarcodeDropdown] = useState(false);
  const [activeBarcodeRowId, setActiveBarcodeRowId] = useState(null);

  // ==================== Load Data ====================
  useEffect(() => {
    const loadData = async () => {
      try {
        const accountsRes = await getAllAccounts();
        setAccounts(Array.isArray(accountsRes) ? accountsRes : []);
      } catch (err) {
        console.error('Failed to load accounts:', err);
        toast.error('Failed to load accounts');
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const itemsRes = await getAllItems();
        const itemsData = itemsRes?.data || itemsRes;
        setItems(Array.isArray(itemsData) ? itemsData : []);
      } catch (err) {
        console.error('Failed to load items:', err);
        toast.error('Failed to load barcodes');
      }
    };
    loadItems();
  }, []);

  // ==================== Party/Customer Handlers ====================
  const filteredAccounts = accounts.filter(acc => {
    const searchTerm = partySearch.toLowerCase();
    const name = (acc.Name || acc.name || '').toLowerCase();
    const printName = (acc.PrintName || acc.printName || '').toLowerCase();
    const alias = (acc.Alias || acc.alias || '').toLowerCase();
    return name.includes(searchTerm) || printName.includes(searchTerm) || alias.includes(searchTerm);
  });

  const handlePartySelect = (party) => {
    console.log('Selected party data:', party); // Debug log
    
    // Determine contact field - check all possible field names
    let contactValue = '';
    if (party.MobileNumber) contactValue = party.MobileNumber;
    else if (party.mobileNumber) contactValue = party.mobileNumber;
    else if (party.MobileNo) contactValue = party.MobileNo;
    else if (party.mobileNo) contactValue = party.mobileNo;
    else if (party.Contact) contactValue = party.Contact;
    else if (party.contact) contactValue = party.contact;
    else if (party.Phone) contactValue = party.Phone;
    else if (party.phone) contactValue = party.phone;
    else if (party.ContactPerson) contactValue = party.ContactPerson;
    else if (party.contactPerson) contactValue = party.contactPerson;
    else if (party.Email) contactValue = party.Email;
    else if (party.email) contactValue = party.email;
    
    setSelectedParty(party);
    setCustomerData({
      partyName: party.Name || party.name || '',
      contact: contactValue,
      state: party.State || party.state || '',
      address: party.Address || party.address || ''
    });
    setPartySearch('');
    setShowPartyDropdown(false);
  };

  const handlePrintCustomerSection = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Information</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .field-row { display: flex; margin-bottom: 12px; }
          .field-label { width: 150px; font-weight: bold; }
          .field-value { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="section">
          <div class="section-title">Customer / Party Information</div>
          <div class="field-row">
            <div class="field-label">Party Account:</div>
            <div class="field-value">${customerData.partyName}</div>
          </div>
          <div class="field-row">
            <div class="field-label">Contact:</div>
            <div class="field-value">${customerData.contact}</div>
          </div>
          <div class="field-row">
            <div class="field-label">State:</div>
            <div class="field-value">${customerData.state}</div>
          </div>
          <div class="field-row">
            <div class="field-label">Address:</div>
            <div class="field-value">${customerData.address}</div>
          </div>
        </div>
        <div class="no-print" style="margin-top: 20px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
          <button onclick="window.close()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  // ==================== Barcode Handlers ====================
  const filteredBarcodes = items.filter(item => {
    const searchTerm = barcodeSearch.toLowerCase();
    const barcode = (item.Barcode || item.barcode || '').toLowerCase();
    const itemName = (item.ItemName || item.itemName || '').toLowerCase();
    return barcode.includes(searchTerm) || itemName.includes(searchTerm);
  });

  const addBarcodeRow = () => {
    const newRow = {
      id: Date.now(),
      barcode: ''
    };
    setBarcodeRows([...barcodeRows, newRow]);
  };

  const removeBarcodeRow = (id) => {
    setBarcodeRows(barcodeRows.filter(row => row.id !== id));
  };

  const updateBarcodeRow = (id, barcode) => {
    setBarcodeRows(barcodeRows.map(row =>
      row.id === id ? { ...row, barcode } : row
    ));
  };

  const handleBarcodeSelect = (item) => {
    const barcode = item.Barcode || item.barcode || '';
    if (activeBarcodeRowId) {
      updateBarcodeRow(activeBarcodeRowId, barcode);
      setActiveBarcodeRowId(null);
    }
    setBarcodeSearch('');
    setShowBarcodeDropdown(false);
  };

  const handlePrintBarcodes = () => {
    if (barcodeRows.length === 0) {
      toast.error('Please add at least one barcode');
      return;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    const barcodeRows_Str = barcodeRows
      .filter(row => row.barcode)
      .map(row => `<div style="margin: 20px; padding: 15px; border: 1px solid #ccc; text-align: center; page-break-inside: avoid;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Barcode</div>
        <div style="font-size: 32px; letter-spacing: 5px; font-family: 'Courier New'; font-weight: bold;">${row.barcode}</div>
        <div style="font-size: 12px; margin-top: 10px;">${row.barcode}</div>
      </div>`)
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
          .barcode-container { display: flex; flex-wrap: wrap; justify-content: center; }
          @media print {
            body { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="barcode-container">
          ${barcodeRows_Str}
        </div>
        <div style="text-align: center; margin-top: 20px; page-break-before: always;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
          <button onclick="window.close()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-1">Dashboard</h1>
            <p className="text-gray-500 font-medium tracking-wide">Business Overview & Quick Tools</p>
          </div>
          <div className="hidden md:block text-right">
             <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Current Session</p>
             <p className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Main Content Area: Horizontal Row for Customer and Barcode */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8 items-stretch">
          
          {/* ==================== Customer Section ==================== */}
          <div className="lg:w-[60%] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <span className="p-2 bg-blue-50 rounded-lg mr-3">
                  <User className="w-5 h-5 text-blue-600" />
                </span>
                Customer / Party
              </h2>
              <button
                onClick={handlePrintCustomerSection}
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition duration-200 text-sm font-semibold shadow-lg shadow-blue-100"
                title="Print Customer Section"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </button>
            </div>

            <div className="space-y-5 flex-grow">
              {/* Party Account Field */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Party Account
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Search Party Name..."
                    value={partySearch || selectedParty?.Name || ''}
                    onChange={(e) => {
                      setPartySearch(e.target.value);
                      setShowPartyDropdown(true);
                    }}
                    onFocus={() => setShowPartyDropdown(true)}
                    className="w-full px-4 py-3 text-sm border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 group-hover:bg-white"
                  />
                  {showPartyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-56 overflow-y-auto z-30 animate-in slide-in-from-top-2 duration-200">
                      {filteredAccounts.length > 0 ? (
                        filteredAccounts.map(acc => (
                          <div
                            key={acc._id || acc.id}
                            onClick={() => handlePartySelect(acc)}
                            className="px-5 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
                          >
                            <div className="font-bold text-gray-800 text-sm">{acc.Name || acc.name}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-thinner">{acc.PrintName || acc.printName}</div>
                          </div>
                        ))
                      ) : (
                        <div className="px-5 py-4 text-gray-400 text-xs italic">No matching results found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact and State Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                    Contact
                  </label>
                  <input
                    type="text"
                    value={customerData.contact}
                    readOnly
                    className="w-full px-4 py-3 text-sm border border-gray-100 rounded-xl bg-gray-50/80 text-gray-600 font-bold shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={customerData.state}
                    readOnly
                    className="w-full px-4 py-3 text-sm border border-gray-100 rounded-xl bg-gray-50/80 text-gray-600 font-bold shadow-inner"
                  />
                </div>
              </div>

              {/* Address Field */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Address
                </label>
                <textarea
                  value={customerData.address}
                  readOnly
                  rows="2"
                  className="w-full px-4 py-3 text-sm border border-gray-100 rounded-xl bg-gray-50/80 text-gray-600 font-bold resize-none shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* ==================== Barcode Section ==================== */}
          <div className="lg:w-[40%] bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <span className="p-2 bg-emerald-50 rounded-lg mr-3">
                  <Search className="w-5 h-5 text-emerald-600" />
                </span>
                Barcode Print
              </h2>
              <button
                onClick={handlePrintBarcodes}
                className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition duration-200 text-sm font-semibold shadow-lg shadow-emerald-100"
                title="Print barcodes"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </button>
            </div>

            {/* Barcode Rows */}
            <div className="space-y-4 mb-5 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar flex-grow">
              {barcodeRows.map((row) => (
                <div key={row.id} className="flex gap-2 items-end group animate-in slide-in-from-right-2 duration-200">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Enter or scan barcode..."
                      value={row.barcode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBarcodeSearch(val);
                        setActiveBarcodeRowId(row.id);
                        updateBarcodeRow(row.id, val);
                      }}
                      onFocus={() => {
                        setShowBarcodeDropdown(true);
                        setActiveBarcodeRowId(row.id);
                        setBarcodeSearch(row.barcode || '');
                      }}
                      onBlur={() => setTimeout(() => setShowBarcodeDropdown(false), 200)}
                      className="w-full px-4 py-3 text-sm border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-gray-50/50"
                    />
                    {showBarcodeDropdown && activeBarcodeRowId === row.id && filteredBarcodes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-30">
                        {filteredBarcodes.map(item => (
                          <div
                            key={item._id || item.id}
                            onClick={() => handleBarcodeSelect(item)}
                            className="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
                          >
                            <div className="font-bold text-gray-800 text-xs">{item.Barcode || item.barcode}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{item.ItemName || item.itemName}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeBarcodeRow(row.id)}
                    className="p-3 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Remove row"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              
              {barcodeRows.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  No barcode rows added yet.
                </div>
              )}
            </div>

            {/* Add Row Button */}
            <button
              onClick={addBarcodeRow}
              className="mt-auto flex items-center justify-center w-full bg-slate-900 hover:bg-black text-white px-5 py-3.5 rounded-xl transition duration-200 font-bold text-sm shadow-xl shadow-slate-200"
            >
              <Plus className="w-5 h-5 mr-3" />
              Add Barcode Row
            </button>
          </div>
        </div>

        {/* ==================== Quick Actions Section ==================== */}
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-150">
          <QuickShortcuts />
        </div>
      </div>
    </div>
  );
}

export default Home;