import React, { useState, useEffect } from 'react';
import ApiClient from '../../ApiClient';
import { CreditCard, Download, Search, FileText, CheckCircle, XCircle, Clock, Building, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { roundAmount } from '../../utils/amountUtils';

const PaymentHistory = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            const res = await ApiClient.get('/super-admin/payments');
            setPayments(res.data);
        } catch (error) {
            toast.error("Failed to load payment history");
        } finally {
            setLoading(false);
        }
    };

    const filteredPayments = payments.filter(p => 
        (p.companyId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDownloadInvoice = (payment) => {
        const printWindow = window.open("", "_blank");
        const subtotal = payment.amount || 0;
        const gstAmount = payment.gstAmount || 0;
        const total = payment.totalAmount || 0;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice - ${payment.invoiceNumber}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
                        .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                        .brand { color: #4f46e5; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
                        .invoice-meta { text-align: right; }
                        .invoice-meta h1 { font-size: 32px; font-weight: 900; margin: 0; color: #0f172a; }
                        .billing-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                        .bill-to h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.05em; }
                        .bill-to p { margin: 0; font-weight: 600; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th { text-align: left; padding: 12px; background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
                        td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                        .totals { margin-left: auto; width: 250px; }
                        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
                        .grand-total { border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 12px; font-weight: 800; font-size: 18px; color: #4f46e5; }
                        .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 12px; }
                        @media print {
                            body { padding: 0; }
                            .container { border: none; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div>
                                <div class="brand">LensBackup SaaS</div>
                                <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Subscription Payment Receipt</p>
                            </div>
                            <div class="invoice-meta">
                                <h1>INVOICE</h1>
                                <p style="font-weight: 700; margin-top: 4px;"># ${payment.invoiceNumber}</p>
                            </div>
                        </div>

                        <div class="billing-grid">
                            <div class="bill-to">
                                <h3>Billed To</h3>
                                <p>${payment.companyId?.name || 'N/A'}</p>
                                <p style="font-weight: 400; color: #64748b; font-size: 13px; margin-top: 4px;">${payment.companyId?.email || ''}</p>
                            </div>
                            <div class="bill-to" style="text-align: right;">
                                <h3>Payment Details</h3>
                                <p>Date: ${new Date(payment.paymentDate).toLocaleDateString()}</p>
                                <p style="font-weight: 400; color: #64748b; font-size: 13px; margin-top: 4px;">Method: ${payment.paymentMethod.toUpperCase()}</p>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Cycle</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <div style="font-weight: 700;">${payment.planId?.name || 'Subscription Plan'}</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Valid until ${new Date(payment.expiryDate).toLocaleDateString()}</div>
                                    </td>
                                    <td style="text-transform: capitalize;">${payment.billingCycle}</td>
                                    <td style="text-align: right; font-weight: 600;">₹${roundAmount(subtotal)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="totals">
                            <div class="total-row">
                                <span style="color: #64748b;">Subtotal</span>
                                <span>₹${roundAmount(subtotal)}</span>
                            </div>
                             <div class="total-row">
                                <span style="color: #64748b;">GST (0%)</span>
                                <span>₹${roundAmount(gstAmount)}</span>
                            </div>
                            <div class="total-row grand-total">
                                <span>Total Paid</span>
                                <span>₹${roundAmount(total)}</span>
                            </div>
                        </div>

                        <div class="footer">
                            <p>Thank you for your business!</p>
                            <p style="margin-top: 4px;">This is a system generated invoice and does not require a physical signature.</p>
                        </div>
                    </div>
                </body>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    }
                </script>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Billing & Payment History</h1>
                <p className="text-slate-500 text-sm">View all subscription transactions and invoices across all tenants.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="relative max-w-md mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by company or invoice..." 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-medium text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto text-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-4 py-4">Invoice / Transaction</th>
                                <th className="px-4 py-4">Company</th>
                                <th className="px-4 py-4">Plan & Cycle</th>
                                <th className="px-4 py-4">Amount Paid</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-10 text-slate-400">Loading payments...</td></tr>
                            ) : filteredPayments.map(payment => (
                                <tr key={payment._id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-xs uppercase tracking-wider">{payment.invoiceNumber}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 font-bold text-slate-700">
                                        {payment.companyId?.name}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-bold text-slate-600">{payment.planId?.name}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-black">{payment.billingCycle}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <p className="text-sm font-black text-slate-900">₹{roundAmount(payment.totalAmount)}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">{payment.paymentMethod}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                            {payment.status === 'paid' ? (
                                                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                    <CheckCircle size={12} /> PAID
                                                </div>
                                            ) : payment.status === 'failed' ? (
                                                <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                                                    <XCircle size={12} /> FAILED
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                                    <Clock size={12} /> PENDING
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <button 
                                            onClick={() => handleDownloadInvoice(payment)}
                                            className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-slate-100"
                                            title="Download Invoice"
                                        >
                                            <Download size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistory;
