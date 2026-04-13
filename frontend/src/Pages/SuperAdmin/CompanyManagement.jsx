import React, { useState, useEffect } from 'react';
import ApiClient from '../../ApiClient';
import { Plus, Edit2, Trash2, Power, Building2, Search, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const CompanyManagement = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phoneNumber: '',
        address: '',
        password: '',
        isActive: true
    });

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const res = await ApiClient.get('/super-admin/companies');
            setCompanies(res.data);
        } catch (error) {
            toast.error("Failed to fetch companies");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (company) => {
        try {
            await ApiClient.put(`/super-admin/companies/${company._id}`, {
                isActive: !company.isActive
            });
            toast.success(`Company ${!company.isActive ? 'activated' : 'deactivated'}`);
            fetchCompanies();
        } catch (error) {
            toast.error("Status update failed");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedCompany) {
                await ApiClient.put(`/super-admin/companies/${selectedCompany._id}`, formData);
                toast.success("Company updated successfully");
            } else {
                await ApiClient.post('/super-admin/companies', formData);
                toast.success("Company created successfully");
            }
            setIsModalOpen(false);
            fetchCompanies();
        } catch (error) {
            toast.error(error.response?.data?.message || "Operation failed");
        }
    };

    const openModal = (company = null) => {
        if (company) {
            setSelectedCompany(company);
            setFormData({
                name: company.name,
                email: company.email,
                phoneNumber: company.phoneNumber,
                address: company.address,
                password: '',   // Never pre-fill password
                isActive: company.isActive
            });
        } else {
            setSelectedCompany(null);
            setFormData({ name: '', email: '', phoneNumber: '', address: '', password: '', isActive: true });
        }
        setIsModalOpen(true);
    };

    const filteredCompanies = companies.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Company Management</h1>
                    <p className="text-slate-500 text-sm">Create and manage tenant accounts on your SaaS platform.</p>
                </div>
                <button 
                    onClick={() => openModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                >
                    <Plus size={20} />
                    New Company
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="relative max-w-md mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search companies by name or email..." 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-4 py-4">Company Name</th>
                                <th className="px-4 py-4">Contact</th>
                                <th className="px-4 py-4">Plan & Expiry</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-10 text-slate-400">Loading companies...</td></tr>
                            ) : filteredCompanies.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-10 text-slate-400">No companies found</td></tr>
                            ) : filteredCompanies.map(company => (
                                <tr key={company._id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                <Building2 size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{company.name}</p>
                                                <p className="text-xs text-slate-400">ID: {company._id.substring(0, 8)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <p className="text-sm font-medium text-slate-700">{company.email}</p>
                                        <p className="text-xs text-slate-400">{company.phoneNumber}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                            {company.planId?.name || 'Default Plan'}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {company.planExpiryDate ? new Date(company.planExpiryDate).toLocaleDateString() : 'No Expiry'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                            company.isActive 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                            : 'bg-rose-50 text-rose-700 border-rose-100'
                                        }`}>
                                            {company.isActive ? 'Active' : 'Deactivated'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleToggleStatus(company)}
                                                className={`p-2 rounded-lg transition-colors ${company.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                                title={company.isActive ? "Deactivate" : "Activate"}
                                            >
                                                <Power size={18} />
                                            </button>
                                            <button 
                                                onClick={() => openModal(company)}
                                                className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Delete">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-50">
                            <h3 className="text-xl font-bold text-slate-900">{selectedCompany ? 'Edit Company' : 'New Company'}</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Company Name</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Public Email</label>
                                <input 
                                    type="email" 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        value={formData.phoneNumber}
                                        onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-indigo-600 rounded"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Active</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {selectedCompany ? 'New Password (leave blank to keep current)' : 'Login Password'}
                                    {!selectedCompany && <span className="text-rose-500 ml-1">*</span>}
                                </label>
                                <input 
                                    type="password"
                                    required={!selectedCompany}
                                    placeholder={selectedCompany ? "Enter new password to change..." : "Set login password"}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                />
                                <p className="text-xs text-slate-400 mt-1">This password will also be used to create/update the Admin user for this company.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                                <textarea 
                                    rows="3"
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    value={formData.address}
                                    onChange={e => setFormData({...formData, address: e.target.value})}
                                ></textarea>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                >
                                    {selectedCompany ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyManagement;
