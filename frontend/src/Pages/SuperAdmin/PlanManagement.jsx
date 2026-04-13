import React, { useState, useEffect } from 'react';
import ApiClient from '../../ApiClient';
import { Plus, Edit2, Zap, Shield, Star, Check, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PlanManagement = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        prices: { monthly: 0, quarterly: 0, yearly: 0 },
        limits: { maxUsers: 5, maxStorageGB: 1, maxOrdersPerMonth: 100, maxItems: 1000 },
        features: []
    });

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await ApiClient.get('/super-admin/plans');
            setPlans(res.data);
        } catch (error) {
            toast.error("Failed to fetch plans");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (plan) => {
        setSelectedPlan(plan);
        setFormData({
            name: plan.name,
            prices: { ...plan.prices },
            limits: { ...plan.limits },
            features: [...(plan.features || [])]
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (planId) => {
        if (!window.confirm("Are you sure you want to delete this plan? This action cannot be undone and will fail if companies are currently using this plan.")) return;
        
        try {
            await ApiClient.delete(`/super-admin/plans/${planId}`);
            toast.success("Plan deleted successfully");
            fetchPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete plan");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedPlan) {
                await ApiClient.put(`/super-admin/plans/${selectedPlan._id}`, formData);
                toast.success("Plan updated successfully!");
            } else {
                await ApiClient.post('/super-admin/plans', formData);
                toast.success("Plan created successfully!");
            }
            setIsModalOpen(false);
            fetchPlans();
        } catch (error) {
            toast.error("Failed to save plan");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
                    <p className="text-slate-500 text-sm">Define tiers and pricing for different billing cycles.</p>
                </div>
                <button 
                    onClick={() => { 
                        setSelectedPlan(null); 
                        setFormData({
                            name: '',
                            prices: { monthly: 0, quarterly: 0, yearly: 0 },
                            limits: { maxUsers: 5, maxStorageGB: 1, maxOrdersPerMonth: 100, maxItems: 1000 },
                            features: []
                        });
                        setIsModalOpen(true); 
                    }}
                    className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100"
                >
                    <Plus size={20} />
                    New Plan
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-3 text-center py-20 text-slate-400">Loading plans...</div>
                ) : plans.length === 0 ? (
                    <div className="col-span-3 text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium">
                        No plans defined yet. Click "New Plan" to get started.
                    </div>
                ) : plans.map((plan) => (
                    <div key={plan._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col hover:shadow-md transition-all relative overflow-hidden group border-b-4 border-b-transparent hover:border-b-indigo-500">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                             <button 
                                onClick={() => handleEdit(plan)}
                                className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors"
                                title="Edit Plan"
                             >
                                 <Edit2 size={16} />
                             </button>
                             <button 
                                onClick={() => handleDelete(plan._id)}
                                className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors"
                                title="Delete Plan"
                             >
                                 <Trash2 size={16} />
                             </button>
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl bg-indigo-50 text-indigo-600`}>
                                <Zap size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                        </div>
                        
                        <div className="space-y-3 mb-8">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Monthly</span>
                                <span className="font-bold text-slate-900">₹{plan.prices?.monthly}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500">
                                <span className="font-medium">Quarterly</span>
                                <span className="font-bold text-slate-900">₹{plan.prices?.quarterly}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-slate-50 pt-3">
                                <span className="text-slate-500 font-medium">Yearly</span>
                                <span className="font-bold text-emerald-600">₹{plan.prices?.yearly}</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 mb-8 flex-1">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Limits & Features</h4>
                            <div className="grid grid-cols-2 gap-y-3 text-xs">
                                <div className="text-slate-500">Users: <span className="text-slate-800 font-bold">{plan.limits?.maxUsers}</span></div>
                                <div className="text-slate-500">Storage: <span className="text-slate-800 font-bold">{plan.limits?.maxStorageGB}GB</span></div>
                                <div className="text-slate-500">Orders: <span className="text-slate-800 font-bold">{plan.limits?.maxOrdersPerMonth}</span></div>
                                <div className="text-slate-500">Items: <span className="text-slate-800 font-bold">{plan.limits?.maxItems}</span></div>
                            </div>
                            {plan.features?.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                                    {plan.features.slice(0, 3).map((f, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                            <Check size={12} className="text-emerald-500" /> {f}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => handleEdit(plan)}
                            className="w-full py-3 rounded-xl border-2 border-slate-100 font-bold text-slate-600 hover:bg-slate-50 transition-colors mt-auto flex items-center justify-center gap-2"
                        >
                            <Edit2 size={16} />
                            Modify Details
                        </button>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-50 bg-indigo-50/30">
                            <h2 className="text-2xl font-bold text-slate-900">
                                {selectedPlan ? 'Update Plan' : 'Create New Plan'}
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                {selectedPlan ? `Modifying settings for ${selectedPlan.name}` : 'Configure pricing and limits for new tiers.'}
                            </p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 font-display">Plan Name</label>
                                <input 
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:border-indigo-500 focus:bg-white outline-none text-slate-900 font-medium transition-all" 
                                    placeholder="e.g. Enterprise Pro" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                             </div>
                             
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-4 text-center bg-slate-100 py-1 rounded-lg">Pricing Cycles (₹)</label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Monthly</span>
                                        <input required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold" placeholder="Monthly" type="number" value={formData.prices.monthly} onChange={e => setFormData({...formData, prices: {...formData.prices, monthly: Number(e.target.value)}})} />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Quarterly</span>
                                        <input required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold" placeholder="Quarterly" type="number" value={formData.prices.quarterly} onChange={e => setFormData({...formData, prices: {...formData.prices, quarterly: Number(e.target.value)}})} />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Yearly</span>
                                        <input required className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-emerald-600 text-sm" placeholder="Yearly" type="number" value={formData.prices.yearly} onChange={e => setFormData({...formData, prices: {...formData.prices, yearly: Number(e.target.value)}})} />
                                    </div>
                                </div>
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3 bg-slate-100 py-1 rounded-lg text-center font-display">Usage Limits</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Max Users</span>
                                        <input className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-sm" placeholder="Max Users" type="number" value={formData.limits.maxUsers} onChange={e => setFormData({...formData, limits: {...formData.limits, maxUsers: Number(e.target.value)}})} />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Storage (GB)</span>
                                        <input className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-sm" placeholder="Storage (GB)" type="number" value={formData.limits.maxStorageGB} onChange={e => setFormData({...formData, limits: {...formData.limits, maxStorageGB: Number(e.target.value)}})} />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Orders / Mo</span>
                                        <input className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-sm" placeholder="Orders/Mo" type="number" value={formData.limits.maxOrdersPerMonth} onChange={e => setFormData({...formData, limits: {...formData.limits, maxOrdersPerMonth: Number(e.target.value)}})} />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Max Items</span>
                                        <input className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-sm" placeholder="Max Items" type="number" value={formData.limits.maxItems} onChange={e => setFormData({...formData, limits: {...formData.limits, maxItems: Number(e.target.value)}})} />
                                    </div>
                                </div>
                             </div>

                             <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold shadow-indigo-200 shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
                                    {selectedPlan ? 'Update Plan' : 'Save Plan'}
                                </button>
                             </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanManagement;
