import React, { useState, useEffect } from "react";
import { FileText, List, BarChart2, Layout } from "lucide-react";
import TransactionSummary from "./TransactionSummary";
import TransactionDetail from "./TransactionDetail";
import SaleSummaryFormat from "./SaleSummaryFormat";
import { useLocation } from "react-router-dom";

const TransactionDetailsCombined = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState("summary");

    // Sync tab with URL if possible, or just default to summary
    useEffect(() => {
        if (location.pathname.includes("transactionsummary")) setActiveTab("summary");
        else if (location.pathname.includes("transactiondetail")) setActiveTab("detail");
        else if (location.pathname.includes("salesummaryformats")) setActiveTab("sale-format");
    }, [location.pathname]);

    const tabs = [
        {
            id: "summary",
            label: "Transaction Summary",
            icon: List,
            component: <TransactionSummary hideHeader={true} />,
            color: "blue",
        },
        {
            id: "detail",
            label: "Transaction Detail",
            icon: FileText,
            component: <TransactionDetail hideHeader={true} />,
            color: "emerald",
        },
        {
            id: "sale-format",
            label: "Sale Summary Format",
            icon: BarChart2,
            component: <SaleSummaryFormat hideHeader={true} />,
            color: "purple",
        },
    ];

    const activeTabData = tabs.find((t) => t.id === activeTab) || tabs[0];

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
                <div className="max-w-[98vw] mx-auto px-4 py-3 sm:px-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                <Layout className="w-6 h-6 text-blue-600" />
                                Transaction Details Module
                            </h1>
                            <p className="text-slate-500 text-[10px] font-medium ml-8 uppercase letter-spacing-widest">
                                Comprehensive Transaction Analysis & Reporting
                            </p>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${isActive
                                            ? "bg-white text-blue-600 shadow-md transform scale-105 border border-slate-100"
                                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                            }`}
                                    >
                                        <Icon
                                            className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"
                                                }`}
                                        />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col">
                    {activeTabData.component}
                </div>
            </main>

            <footer className="shrink-0 bg-white border-t border-slate-100 py-2 text-center text-[9px] text-slate-400 font-medium">
                Transaction Insight Dashboard • Unified Reporting Engine • v1.0
            </footer>
        </div>
    );
};

export default TransactionDetailsCombined;
