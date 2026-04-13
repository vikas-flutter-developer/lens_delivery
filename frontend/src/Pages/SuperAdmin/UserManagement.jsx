import React, { useState, useEffect, useContext } from 'react';
import ApiClient from '../../ApiClient';
import { Users, Search, UserCheck, Shield, ExternalLink, Mail, Building, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthContext } from '../../AuthContext';

const UserManagement = () => {
    const { impersonate } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await ApiClient.get('/super-admin/users');
            setUsers(res.data);
        } catch (error) {
            toast.error("Failed to fetch users");
        } finally {
            setLoading(false);
        }
    };

    const handleImpersonate = async (targetUser) => {
        try {
            const res = await ApiClient.post(`/super-admin/impersonate/${targetUser._id}`);
            const { token, user: impersonatedData } = res.data;
            
            impersonate(token, impersonatedData);
            toast.success(`Now impersonating ${targetUser.name}`);
            // Force redirect to dashboard to see new context
            window.location.href = '/dashboard';
        } catch (error) {
            toast.error("Impersonation failed");
        }
    };

    const handleToggleUserStatus = async (user) => {
        // Implement status toggle logically (e.g., via a generic update user endpoint)
        toast.info("Status toggle feature coming soon to global view");
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.companyId?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">User Management (Global)</h1>
                <p className="text-slate-500 text-sm">View and manage all system users across all tenant companies.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="relative max-w-md mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search users by name, email or company..." 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-4 py-4">User Details</th>
                                <th className="px-4 py-4">Company</th>
                                <th className="px-4 py-4">Role</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-10 text-slate-400">Loading users...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-10 text-slate-400">No users found</td></tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user._id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold uppercase">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{user.name}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Mail size={12} /> {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Building size={16} className="text-slate-400" />
                                            <span className="text-sm font-medium">{user.companyId?.name || 'Super Admin'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                                            user.role === 'super_admin' ? 'bg-indigo-100 text-indigo-700' :
                                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            {user.isActive ? 'Online/Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {user.role !== 'super_admin' && (
                                                <button 
                                                    onClick={() => handleImpersonate(user)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all border border-amber-200"
                                                    title="Login as this user"
                                                >
                                                    <ExternalLink size={14} />
                                                    Impersonate
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleToggleUserStatus(user)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                <Power size={18} />
                                            </button>
                                        </div>
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

export default UserManagement;
