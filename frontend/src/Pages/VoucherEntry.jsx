import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, Search, Save, XCircle, Plus, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAllAccounts } from '../controllers/Account.controller';
import { createVoucher, updateVoucher, getVoucherById, getNextBillNo } from '../controllers/Voucher.controller';
import { roundAmount } from '../utils/amountUtils';

export default function VoucherEntry() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(false);

    // Auto-fetch current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const [headerData, setHeaderData] = useState({
        recordType: 'Payment',
        billSeries: 'P(25-26)',
        billNo: '',
        date: today
    });

    const [rows, setRows] = useState([({
        sn: 1,
        account: '',
        accountId: '',
        balance: 0,
        debit: 0,
        credit: 0,
        modeOfPayment: 'Cash',
        chqDocNo: '',
        chqDocDate: '',
        remark: '',
        showSuggestions: false
    })]);

    // Master data
    const [accounts, setAccounts] = useState([]);
    const wrapperRef = useRef(null);

    // Bill series logic
    const getBillSeriesOptions = (type) => {
        if (type === 'Payment') return ['P(25-26)', 'PUR_26', 'BPAY_25'];
        if (type === 'Receipt') return ['S(25-26)', 'SAL_26', 'BRCPT_25'];
        if (type === 'Journal') return ['JRNL_25-26'];
        if (type === 'Contra') return ['CONTRA_25-26'];
        if (type === 'Debit') return ['DR_NOTE_25'];
        if (type === 'Credit') return ['CR_NOTE_25'];
        return ['GEN_25'];
    };

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const res = await getAllAccounts();
                if (res && res.data) {
                    setAccounts(res.data);
                } else if (Array.isArray(res)) {
                    setAccounts(res);
                }
            } catch (err) {
                console.error("Error fetching accounts", err);
            }
        };
        fetchAccounts();

        if (id) {
            fetchVoucher(id);
        } else {
            fetchNextBillNo(headerData.recordType, headerData.billSeries);
        }
    }, [id]);

    // Handle clicks outside account suggestions
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setRows(prev => prev.map(row => ({ ...row, showSuggestions: false })));
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchVoucher = async (voucherId) => {
        try {
            setLoading(true);
            const res = await getVoucherById(voucherId);
            if (res.success) {
                const v = res.data;
                const dDate = v.date ? new Date(v.date).toISOString().split('T')[0] : today;
                setHeaderData({
                    recordType: v.recordType,
                    billSeries: v.billSeries,
                    billNo: v.billNo,
                    date: dDate
                });

                if (v.rows && v.rows.length > 0) {
                    setRows(v.rows.map((r, i) => ({
                        ...r,
                        sn: i + 1,
                        showSuggestions: false,
                        remark: r.remark || r.shortNarration || '',
                        chqDocDate: r.chqDocDate ? new Date(r.chqDocDate).toISOString().split('T')[0] : ''
                    })));
                }
            }
        } catch (error) {
            toast.error('Failed to fetch voucher details');
        } finally {
            setLoading(false);
        }
    };

    const fetchNextBillNo = async (rType, bSeries) => {
        if (!rType || !bSeries) return;
        try {
            const res = await getNextBillNo(rType, bSeries);
            if (res.success && res.nextBillNo) {
                setHeaderData(prev => ({ ...prev, billNo: res.nextBillNo }));
            }
        } catch (error) {
            console.error("Error fetching bill no", error);
        }
    };

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeaderData(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'recordType') {
                newData.billSeries = getBillSeriesOptions(value)[0];
                fetchNextBillNo(newData.recordType, newData.billSeries);
            } else if (name === 'billSeries') {
                fetchNextBillNo(newData.recordType, newData.billSeries);
            }
            return newData;
        });
    };

    const getEmptyRow = () => ({
        sn: rows.length + 1,
        account: '',
        accountId: '',
        balance: 0,
        debit: 0,
        credit: 0,
        modeOfPayment: 'Cash',
        chqDocNo: '',
        chqDocDate: '',
        remark: '',
        showSuggestions: false
    });

    const handleRowChange = (index, field, value) => {
        const updatedRows = [...rows];
        updatedRows[index][field] = value;

        // Reset the other to 0 if one is filled
        if (field === 'debit' && value > 0) updatedRows[index].credit = 0;
        if (field === 'credit' && value > 0) updatedRows[index].debit = 0;

        setRows(updatedRows);
    };

    const addRow = () => {
        setRows([...rows, { ...getEmptyRow(), sn: rows.length + 1 }]);
    };

    const removeRow = (index) => {
        if (rows.length === 1) return;
        const newRows = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, sn: i + 1 }));
        setRows(newRows);
    };

    const selectAccount = (index, acc) => {
        const updatedRows = [...rows];
        updatedRows[index].account = acc.Name;
        updatedRows[index].accountId = acc._id;
        // Fetch actual balance from account object
        updatedRows[index].balance = acc.CurrentBalance?.amount || 0;
        updatedRows[index].balanceType = acc.CurrentBalance?.type || 'Dr';
        updatedRows[index].showSuggestions = false;

        setRows(updatedRows);
    };

    const getTotals = () => {
        return rows.reduce((acc, row) => ({
            debit: acc.debit + Number(row.debit || 0),
            credit: acc.credit + Number(row.credit || 0)
        }), { debit: 0, credit: 0 });
    };

    const totals = getTotals();

    const handleSave = async () => {
        // Validations
        if (!headerData.billNo || !headerData.billSeries || !headerData.date) {
            return toast.error('Please fill all mandatory header fields');
        }

        const validRows = rows.filter(r => r.account && (Number(r.debit) > 0 || Number(r.credit) > 0));
        if (validRows.length === 0) {
            return toast.error('Please add at least one valid row with an Amount and Account');
        }

        const payload = {
            ...headerData,
            rows: validRows.map(r => ({
                dc: r.debit > 0 ? 'D' : 'C', // Autocalculate dc based on amount
                account: r.account,
                accountId: r.accountId,
                balance: Number(parseFloat(r.balance) || 0),
                debit: Number(r.debit),
                credit: Number(r.credit),
                modeOfPayment: r.modeOfPayment,
                chqDocNo: r.chqDocNo,
                chqDocDate: r.chqDocDate,
                remark: r.remark
            })),
            totalDebit: totals.debit,
            totalCredit: totals.credit
        };

        try {
            setLoading(true);
            if (id) {
                const res = await updateVoucher(id, payload);
                if (res.success) {
                    toast.success('Voucher updated successfully');
                    navigate('/transaction/payrecptumicntr/addvoucher');
                }
            } else {
                const res = await createVoucher(payload);
                if (res.success) {
                    toast.success('Voucher created successfully');
                    navigate('/transaction/payrecptumicntr/addvoucher');
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save voucher');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
            {/* Top Bar */}
            <div className="bg-blue-600 text-white px-4 py-2 flex items-center shadow-md">
                <h1 className="text-lg font-bold">{id ? 'Edit Voucher' : 'Add Vouchers'}</h1>
            </div>

            <div className="flex-1 p-2 md:p-3 max-w-[100vw] overflow-x-hidden">
                <div className="bg-white border rounded shadow-sm border-gray-300">

                    {/* Header Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border-b border-gray-300 bg-blue-50/30">
                        <div className="space-y-3">
                            <div className="flex items-center">
                                <label className="w-32 text-sm text-gray-700 font-medium">Record Type :</label>
                                <select
                                    name="recordType"
                                    value={headerData.recordType}
                                    onChange={handleHeaderChange}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                                >
                                    {['Payment', 'Receipt', 'Journal', 'Contra', 'Debit', 'Credit'].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center">
                                <label className="w-28 text-sm text-gray-700 font-medium whitespace-nowrap">Bill Series :</label>
                                <select
                                    name="billSeries"
                                    value={headerData.billSeries}
                                    onChange={handleHeaderChange}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                                >
                                    {getBillSeriesOptions(headerData.recordType).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center">
                                <label className="w-20 text-sm text-gray-700 font-medium">Bill No. :</label>
                                <input
                                    type="text"
                                    name="billNo"
                                    value={headerData.billNo}
                                    onChange={handleHeaderChange}
                                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-end">
                                <label className="w-16 text-sm text-gray-700 font-medium">Date :</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={headerData.date}
                                    onChange={handleHeaderChange}
                                    className="w-36 border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-2 text-sm text-red-600 font-medium bg-gray-50 border-b border-gray-300 flex items-center">
                        <span className="text-gray-800 mr-2">Particular</span>
                        (Press alt+2 for add acc)
                    </div>

                    {/* Table Area layout */}
                    <div className="flex flex-col xl:flex-row h-full">
                        <div className="flex-1 overflow-x-auto border-r border-gray-300" ref={wrapperRef}>
                            <table className="w-full text-sm min-w-[900px]">
                                <thead className="bg-[#e8f0fe] border-b border-blue-200">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left text-gray-700 w-10 border-r border-white font-medium">SN.</th>
                                        <th className="px-2 py-1.5 text-left text-gray-700 border-r border-white font-medium text-blue-900 w-[240px]">Account</th>
                                        <th className="px-2 py-1.5 text-right text-gray-700 w-28 border-r border-white font-medium">Balance</th>
                                        <th className="px-2 py-1.5 text-right text-gray-700 w-32 border-r border-white font-medium text-blue-900">Debit</th>
                                        <th className="px-2 py-1.5 text-right text-gray-700 w-32 border-r border-white font-medium">Credit</th>
                                        <th className="px-2 py-1.5 text-center text-gray-700 w-32 border-r border-white font-medium">Mode of Payment</th>
                                        <th className="px-2 py-1.5 text-left text-gray-700 w-32 border-r border-white font-medium">Chq/Doc No</th>
                                        <th className="px-2 py-1.5 text-left text-gray-700 w-[130px] border-r border-white font-medium">Chq/Doc Dt</th>
                                        <th className="px-2 py-1.5 text-left text-gray-700 border-r border-white font-medium min-w-[150px]">Remark</th>
                                        <th className="px-2 py-1.5 text-center text-gray-700 w-12 font-medium">Dlt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition-colors group">
                                            <td className="px-2 py-1.5 text-gray-600 border-r border-gray-200 font-medium text-center">{index + 1}</td>
                                            <td className="p-0.5 border-r border-gray-200 relative">
                                                <input
                                                    type="text"
                                                    value={row.account}
                                                    onChange={(e) => handleRowChange(index, 'account', e.target.value)}
                                                    onFocus={() => handleRowChange(index, 'showSuggestions', true)}
                                                    className="w-full bg-transparent p-1 px-2 outline-none uppercase font-semibold text-gray-800"
                                                />
                                                {row.showSuggestions && (
                                                    <div className="absolute top-full left-0 w-[400px] z-50 bg-white border border-blue-400 shadow-xl max-h-60 overflow-y-auto">
                                                        <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 sticky top-0 z-10 flex justify-between">
                                                            <span>Text Suggestion</span>
                                                            <button onClick={() => handleRowChange(index, 'showSuggestions', false)}><X className="w-3 h-3 hover:text-red-200" /></button>
                                                        </div>
                                                        <div className="p-1">
                                                            {accounts
                                                                .filter(a => a.Name?.toLowerCase().includes(row.account.toLowerCase()))
                                                                .map(acc => (
                                                                    <div
                                                                        key={acc._id}
                                                                        onClick={() => selectAccount(index, acc)}
                                                                        className="px-2 py-1 text-sm hover:bg-blue-100 cursor-pointer border-b border-gray-50 last:border-0"
                                                                    >
                                                                        {acc.Name}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200 text-right">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={row.balance ? `${roundAmount(row.balance)} ${row.balanceType || 'Dr'}` : '0 Dr'}
                                                    className="w-full bg-gray-50 p-1 outline-none text-right text-gray-500 cursor-not-allowed text-xs"
                                                />
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={row.debit === 0 ? '' : row.debit}
                                                    onChange={(e) => handleRowChange(index, 'debit', e.target.value)}
                                                    className="w-full bg-transparent p-1 outline-none text-right font-medium text-gray-800 hide-arrows"
                                                />
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={row.credit === 0 ? '' : row.credit}
                                                    onChange={(e) => handleRowChange(index, 'credit', e.target.value)}
                                                    className="w-full bg-transparent p-1 outline-none text-right font-medium text-gray-800 hide-arrows"
                                                />
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200">
                                                <select
                                                    value={row.modeOfPayment}
                                                    onChange={(e) => handleRowChange(index, 'modeOfPayment', e.target.value)}
                                                    className="w-full bg-transparent p-1 outline-none text-center appearance-none cursor-pointer"
                                                >
                                                    <option value="Cash">Cash</option>
                                                    <option value="Bank">Bank</option>
                                                    <option value="Cheque">Cheque</option>
                                                </select>
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200">
                                                <input type="text" value={row.chqDocNo} onChange={e => handleRowChange(index, 'chqDocNo', e.target.value)} className="w-full bg-transparent p-1 outline-none" />
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200 relative">
                                                <input type="date" value={row.chqDocDate} onChange={e => handleRowChange(index, 'chqDocDate', e.target.value)} className="w-full bg-transparent p-1 outline-none text-xs" />
                                            </td>
                                            <td className="p-0.5 border-r border-gray-200">
                                                <textarea
                                                    rows="1"
                                                    value={row.remark}
                                                    onChange={e => handleRowChange(index, 'remark', e.target.value)}
                                                    onInput={(e) => {
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                    className="w-full bg-transparent p-1 px-2 outline-none resize-none overflow-hidden block min-h-[32px]"
                                                    placeholder="Enter remark..."
                                                />
                                            </td>
                                            <td className="p-1 text-center">
                                                <button
                                                    onClick={() => removeRow(index)}
                                                    className="w-6 h-6 inline-flex items-center justify-center bg-[#add8e6] text-[#004e6b] font-bold text-xs rounded hover:bg-blue-300 transition-colors"
                                                >
                                                    X
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Empty filler rows for UI resemblance */}
                                    {[...Array(Math.max(0, 5 - rows.length))].map((_, i) => (
                                        <tr key={`filler-${i}`} className="border-b border-gray-200">
                                            <td className="px-2 py-3 border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="border-r border-gray-200 bg-gray-50/30"></td>
                                            <td className="bg-gray-50/30"></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                                        <td colSpan="4" className="text-right px-4 py-2 text-gray-700"></td>
                                        <td className="text-right px-3 py-2 text-gray-900">{roundAmount(totals.debit)}</td>
                                        <td className="text-right px-3 py-2 text-gray-900">{roundAmount(totals.credit)}</td>
                                        <td colSpan="4" className="px-4 py-2 text-right">
                                            <span className={totals.debit !== totals.credit ? 'text-red-500 text-xs italic mr-4' : 'hidden'}>Warning: Unbalanced</span>
                                        </td>
                                        <td className="text-center py-2">
                                            <button
                                                onClick={addRow}
                                                className="w-6 h-6 inline-flex items-center justify-center bg-[#add8e6] text-[#004e6b] font-bold text-sm rounded hover:bg-blue-300 transition-colors"
                                                title="Add Row"
                                            >
                                                +
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Compact Footer for Sum */}
                    <div className="px-4 py-3 border-t border-gray-300 bg-gray-50 flex justify-between items-center">
                        <div className="text-sm font-bold text-gray-800">
                             Total Amount: ₹{roundAmount(totals.debit)}
                        </div>
                    </div>

                </div>

                {/* Action Buttons */}
                <div className="flex justify-center md:justify-end gap-3 mt-3 mb-4 px-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-[#d94838] hover:bg-[#c0392b] text-white px-8 py-2 rounded font-semibold shadow transition flex items-center gap-2"
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={() => navigate('/transaction/payrecptumicntr/addvoucher')}
                        className="bg-[#d94838] hover:bg-[#c0392b] text-white px-6 py-2 rounded font-semibold shadow transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <style>{`
                .hide-arrows::-webkit-outer-spin-button,
                .hide-arrows::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .hide-arrows {
                    -moz-appearance: textfield;
                }
            `}</style>
        </div>
    );
}
