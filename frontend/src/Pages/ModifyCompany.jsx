import React, { useState, useEffect } from "react";
import { Settings, Save, Calendar, CheckCircle2, Shield } from "lucide-react";
import { toast } from "react-hot-toast";
import ApiClient from "../ApiClient";

export default function ModifyCompany() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [companyName, setCompanyName] = useState("");
    const [autoInvoiceEnabled, setAutoInvoiceEnabled] = useState(false);
    const [invoiceDates, setInvoiceDates] = useState([]);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await ApiClient.get("/company/settings");
            if (res.data.success) {
                const { name, autoInvoiceEnabled, invoiceDates } = res.data.data;
                setCompanyName(name);
                setAutoInvoiceEnabled(autoInvoiceEnabled || false);
                setInvoiceDates(invoiceDates || []);
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
            toast.error("Failed to load company settings");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleDate = (date) => {
        if (invoiceDates.includes(date)) {
            setInvoiceDates(invoiceDates.filter(d => d !== date));
        } else {
            if (invoiceDates.length < 2) {
                setInvoiceDates([...invoiceDates, date].sort((a, b) => a - b));
            } else {
                toast.error("You can select up to 2 billing dates per month.");
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await ApiClient.put("/company/settings", {
                autoInvoiceEnabled,
                invoiceDates
            });
            toast.success("Settings updated successfully");
        } catch (err) {
            console.error("Save error:", err);
            toast.error(err.response?.data?.message || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-black rounded-xl">
                        <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{companyName}</h1>
                        <p className="text-slate-500 text-sm">Configure your company preferences and automation</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                    {saving ? "Saving..." : <><Save size={18} /> Save Settings</>}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto-Invoicing Module */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                            <h2 className="font-bold text-slate-900">Auto-Invoicing</h2>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={autoInvoiceEnabled}
                                onChange={(e) => setAutoInvoiceEnabled(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                    <div className="p-6 space-y-6">
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Select up to two dates per month to automatically generate invoices for all pending challans.
                        </p>

                        <div className={`space-y-4 transition-all duration-300 ${autoInvoiceEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-700">Select Billing Dates</label>
                                <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                                    {invoiceDates.length} / 2 Selected
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                    <button
                                        key={day}
                                        onClick={() => handleToggleDate(day)}
                                        className={`h-10 w-full rounded-lg text-sm font-semibold transition-all flex items-center justify-center border ${
                                            invoiceDates.includes(day)
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                                <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-800 leading-normal">
                                    <strong>Advanced Scheduling:</strong> If dates 29, 30, or 31 are selected, the system will run on the <strong>last day</strong> of February to ensure no month is missed.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coming Soon / Info Module */}
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <Save className="w-8 h-8 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">More Settings Coming Soon</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            We are working on more branding and automation features to help you manage your business better.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}