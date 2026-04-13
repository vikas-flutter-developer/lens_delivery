import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Trash2, 
  RefreshCcw, 
  ShieldCheck, 
  Clock, 
  HardDrive, 
  Cloud, 
  AlertTriangle,
  FileArchive,
  Play,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getBackups, triggerBackup, downloadBackup, deleteBackup, restoreBackup } from '../controllers/Backup.controller';

const BackupAndRestore = () => {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [filter, setFilter] = useState("All");
    const [now, setNow] = useState(Date.now());

    // Update 'now' every second to refresh elapsed time for in-progress backups
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchBackups();
    }, [filter]);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            const data = await getBackups(filter);
            setBackups(data);
        } catch (error) {
            toast.error("Failed to load backups");
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerBackup = async (type = 'manual') => {
        try {
            setActionLoading(true);
            toast.loading("Starting backup process...", { id: 'backup-task' });
            await triggerBackup(type);
            toast.success("Backup created successfully", { id: 'backup-task' });
            fetchBackups();
        } catch (error) {
            toast.error("Backup failed: " + error.message, { id: 'backup-task' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this backup? This action cannot be undone.")) return;
        try {
            await deleteBackup(id);
            toast.success("Backup deleted");
            fetchBackups();
        } catch (error) {
            toast.error("Failed to delete backup");
        }
    };

    const handleDownload = async (id) => {
        try {
            toast.loading("Preparing download...", { id: 'download-task' });
            await downloadBackup(id);
            toast.success("Download started", { id: 'download-task' });
        } catch (error) {
            toast.error("Download failed", { id: 'download-task' });
        }
    };

    const handleRestore = async (id) => {
        const confirmCode = prompt("WARNING: Restoration will overwrite existing data! Type 'RESTORE' to confirm:");
        if (confirmCode !== 'RESTORE') return;

        try {
            setActionLoading(true);
            toast.loading("Restoration in progress... DO NOT close this page.", { id: 'restore-task', duration: 10000 });
            await restoreBackup(id);
            toast.success("Restoration completed. The system is now up to date.", { id: 'restore-task' });
        } catch (error) {
            toast.error("Restoration failed: " + error.message, { id: 'restore-task' });
        } finally {
            setActionLoading(false);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return 'Pending...';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getDuration = (backup) => {
        const start = new Date(backup.createdAt).getTime();
        
        if (backup.status === 'pending') {
            // Find average duration of last 5 successful backups of the same type
            const completedBackups = backups.filter(b => b.status === 'completed' && b.type === backup.type);
            
            if (completedBackups.length > 0) {
                const totalDuration = completedBackups.reduce((acc, b) => {
                    const bStart = new Date(b.createdAt).getTime();
                    const bEnd = new Date(b.updatedAt).getTime();
                    return acc + (bEnd - bStart);
                }, 0);
                const avgMs = totalDuration / completedBackups.length;
                const avgSec = Math.floor(avgMs / 1000);
                const mins = Math.floor(avgSec / 60);
                const secs = avgSec % 60;
                
                return `Est. ~${mins > 0 ? `${mins}m ` : ''}${secs}s`;
            }
            return "Est. ~1-2 mins";
        }

        const end = backup.status === 'completed' || backup.status === 'failed' 
            ? new Date(backup.updatedAt).getTime() 
            : now;
        
        const diffMs = end - start;
        const diffSec = Math.floor(diffMs / 1000);
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                <Database className="w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Database Backup & Restore</h1>
                                <p className="text-slate-500 text-sm">Automated system backups, cloud storage, and one-click recovery.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button 
                                onClick={() => handleTriggerBackup('manual')}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Run Manual Backup
                            </button>
                            <button 
                                onClick={fetchBackups}
                                className="p-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                                title="Refresh List"
                            >
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 text-slate-600 mb-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Last Backup</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800">
                                {backups[0] ? new Date(backups[0].createdAt).toLocaleDateString() : 'Never'}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 text-slate-600 mb-2">
                                <HardDrive className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Local Storage</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800">Active</div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 text-slate-600 mb-2">
                                <Cloud className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Cloud Storage</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800 text-emerald-600 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5" /> Secure
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 text-slate-600 mb-2">
                                <FileArchive className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-wider">Backup Count</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800">{backups.length} Files</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex gap-2 p-1 bg-white rounded-lg border border-slate-200">
                        {['All', 'Daily', 'Weekly', 'Monthly', 'Manual'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    filter === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="text-sm text-slate-500 hidden md:block">
                        Retention: <span className="font-semibold text-slate-700">7 Daily, 4 Weekly, 12 Monthly</span>
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Backup Name</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Size</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Duration</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Location</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Created At</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                                <span>Fetching backup vault...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : backups.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2 py-8">
                                                <AlertTriangle className="w-10 h-10 text-slate-200" />
                                                <span className="text-lg">No backups found.</span>
                                                <button 
                                                    onClick={() => handleTriggerBackup('manual')}
                                                    className="mt-2 text-blue-600 hover:underline font-medium"
                                                >
                                                    Start your first backup now
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    backups.map((backup) => (
                                        <tr key={backup._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                                                        <FileArchive className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-semibold text-slate-800 text-sm">{backup.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    backup.type === 'daily' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                    backup.type === 'weekly' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                    backup.type === 'monthly' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    'bg-slate-50 text-slate-600 border border-slate-100'
                                                }`}>
                                                    {backup.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{formatSize(backup.size)}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-500">
                                                {backup.status === 'pending' ? (
                                                    <span className="text-blue-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {getDuration(backup)}
                                                    </span>
                                                ) : getDuration(backup)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold">
                                                    {backup.status === 'completed' ? (
                                                        <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> <span className="text-emerald-600">SUCCESS</span></>
                                                    ) : backup.status === 'failed' ? (
                                                        <><XCircle className="w-4 h-4 text-red-500" /> <span className="text-red-600">FAILED</span></>
                                                    ) : (
                                                        <><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> <span className="text-blue-600">IN PROGRESS</span></>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <HardDrive className={`w-4 h-4 ${backup.localPath ? 'text-blue-500' : 'text-slate-200'}`} title="Local" />
                                                    <Cloud className={`w-4 h-4 ${backup.cloudPath ? 'text-blue-500' : 'text-slate-200'}`} title="Cloud" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(backup.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleDownload(backup._id)}
                                                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                        title="Download"
                                                        disabled={backup.status !== 'completed'}
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRestore(backup._id)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Restore"
                                                        disabled={backup.status !== 'completed' || actionLoading}
                                                    >
                                                        <RefreshCcw className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(backup._id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Logs Footer Info */}
                <div className="mt-8 flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-1">Backup Protection Active</h4>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            Your database is protected by automated daily, weekly, and monthly cycles. Backups are encrypted at rest and replicated to off-site cloud storage. Restoring a backup will override current data; always ensure you have a manual export of your current state before proceeding with a full restoration.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackupAndRestore;
