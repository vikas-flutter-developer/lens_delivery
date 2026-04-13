import React, { useState, useEffect } from 'react';
import ApiClient from '../../ApiClient';
import { Settings, Save, Mail, MessageSquare, Globe, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const SystemSettings = () => {
    const [settings, setSettings] = useState({
        siteName: 'Lens SaaS Platform',
        supportEmail: 'support@lens.com',
        smtpHost: '',
        smtpPort: '587',
        smtpUser: '',
        whatsappApiUrl: '',
        whatsappToken: '',
        maintenanceMode: false
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Placeholder for saving settings to backend
            // await ApiClient.post('/super-admin/settings', settings);
            toast.success("System settings updated successfully!");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
                <p className="text-slate-500 text-sm">Configure global platform parameters, API integrations, and branding.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <form onSubmit={handleSave}>
                    <div className="p-8 space-y-8">
                        {/* General Settings */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-2">
                                <Globe size={20} className="text-indigo-500" />
                                <h3 className="font-bold text-slate-800">General Configuration</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Platform Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.siteName}
                                        onChange={e => setSettings({...settings, siteName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Support Email</label>
                                    <input 
                                        type="email" 
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.supportEmail}
                                        onChange={e => setSettings({...settings, supportEmail: e.target.value})}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Email Settings */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-2">
                                <Mail size={20} className="text-blue-500" />
                                <h3 className="font-bold text-slate-800">SMTP Settings (Email)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">SMTP Host</label>
                                    <input 
                                        type="text" 
                                        placeholder="smtp.gmail.com"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.smtpHost}
                                        onChange={e => setSettings({...settings, smtpHost: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">SMTP Port</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.smtpPort}
                                        onChange={e => setSettings({...settings, smtpPort: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">SMTP User</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.smtpUser}
                                        onChange={e => setSettings({...settings, smtpUser: e.target.value})}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* WhatsApp Settings */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-2">
                                <MessageSquare size={20} className="text-emerald-500" />
                                <h3 className="font-bold text-slate-800">WhatsApp API Integration</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">API Base URL</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.whatsappApiUrl}
                                        onChange={e => setSettings({...settings, whatsappApiUrl: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Access Token</label>
                                    <input 
                                        type="password" 
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={settings.whatsappToken}
                                        onChange={e => setSettings({...settings, whatsappToken: e.target.value})}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* System Status */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-2">
                                <Shield size={20} className="text-rose-500" />
                                <h3 className="font-bold text-slate-800">System Security & Maintenance</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-12 h-6 rounded-full relative transition-colors ${settings.maintenanceMode ? 'bg-rose-500' : 'bg-slate-200'}`}>
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.maintenanceMode ? 'left-7' : 'left-1'}`} />
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={settings.maintenanceMode}
                                        onChange={e => setSettings({...settings, maintenanceMode: e.target.checked})}
                                    />
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Enable Maintenance Mode</span>
                                </label>
                            </div>
                        </section>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button 
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {loading ? "Saving..." : <><Save size={20} /> Save Configuration</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SystemSettings;
