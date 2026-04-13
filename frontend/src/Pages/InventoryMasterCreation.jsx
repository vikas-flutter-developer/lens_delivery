import React, { useState } from "react";
import { Boxes, Package, Eye, PlusCircle } from "lucide-react";
import AddItemGroupMaster from "./AddItemGroupMaster";
import AddItemMaster from "./AddItemMaster";
import LensGroupCreation from "./LensGroupCreation";

const InventoryMasterCreation = () => {
    const [activeTab, setActiveTab] = useState("item-group");

    const tabs = [
        {
            id: "item-group",
            label: "Item Group",
            icon: Boxes,
            component: <AddItemGroupMaster hideHeader={true} onSaveSuccess={() => setActiveTab("item-master")} />,
            color: "blue",
        },
        {
            id: "item-master",
            label: "Item Master",
            icon: Package,
            component: <AddItemMaster hideHeader={true} />,
            color: "emerald",
        },
        {
            id: "lens-group",
            label: "Lens Group",
            icon: Eye,
            component: <LensGroupCreation hideHeader={true} />,
            color: "purple",
        },
    ];

    const activeTabData = tabs.find((t) => t.id === activeTab);

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[98vw] mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                <PlusCircle className="w-8 h-8 text-blue-600" />
                                Inventory Master Creation
                            </h1>
                            <p className="text-slate-500 text-xs font-medium ml-10">
                                Consolidated management for Groups, Items and Lens Specifications
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
                                            ? "bg-white text-blue-600 shadow-md transform scale-105"
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
            <main className="max-w-[98vw] mx-auto px-4 py-6 sm:px-6 lg:px-8">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTabData.component}
                </div>
            </main>

            <footer className="mt-auto py-4 text-center text-[10px] text-slate-400 font-medium">
                Inventory Master Consolidated View • v1.0
            </footer>
        </div>
    );
};

export default InventoryMasterCreation;
