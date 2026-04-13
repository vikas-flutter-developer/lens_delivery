import React, { useState, useEffect } from 'react';
import ApiClient from '../../ApiClient';
import { Building2, Users, ShoppingCart, Activity, ShieldCheck, AlertCircle } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
    <div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-3xl font-bold mt-1 text-slate-800">{value}</h3>
    </div>
    <div className={`p-4 rounded-xl ${color} text-white`}>
      <Icon size={24} />
    </div>
  </div>
);

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalUsers: 0,
    activeCompanies: 0,
    inactiveCompanies: 0,
    totalSales: 0,
    totalOrders: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await ApiClient.get('/super-admin/dashboard');
      setStats(prev => ({ ...prev, ...res.data }));
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Super Admin Overview</h1>
        <p className="text-slate-500 mt-2">Manage all aspects of your SaaS platform from one central control panel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Companies" 
          value={stats.totalCompanies} 
          icon={Building2} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers} 
          icon={Users} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Active Accounts" 
          value={stats.activeCompanies} 
          icon={ShieldCheck} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Potential Alerts" 
          value={stats.inactiveCompanies} 
          icon={AlertCircle} 
          color="bg-amber-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Companies */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-lg">System Health & Distribution</h3>
          </div>
          <div className="p-8 flex items-center justify-center h-[300px] text-slate-400">
            {/* Chart would go here */}
            <Activity size={48} className="opacity-20 animate-pulse" />
            <span className="ml-4 font-medium italic">Analytics visualization coming soon</span>
          </div>
        </div>

        {/* System Logs Preview */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-bold text-slate-800 text-lg">Recent System Logs</h3>
          </div>
          <div className="p-4 space-y-4">
            {stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((log, i) => (
                <div key={i} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{log.action}</p>
                    <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-slate-400 italic text-sm">No recent activity found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
