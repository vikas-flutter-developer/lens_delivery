import React, { useState } from "react";
import { Plus, Users } from "lucide-react";
import AddUser from "./AddUser";
import CheckUser from "./CheckUser";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("addUser");

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl text-center font-bold">Admin Dashboard</h1>
        </div>
      </header>

      {/* Navbar */}
      <div className="bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("addUser")}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-base font-semibold border-b-4 transition-all duration-300 ${
                activeTab === "addUser"
                  ? "border-blue-500 text-blue-700 bg-blue-50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Plus className="w-5 h-5" />
              <span>Add User</span>
            </button>
            <button
              onClick={() => setActiveTab("checkUser")}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-base font-semibold border-b-4 transition-all duration-300 ${
                activeTab === "checkUser"
                  ? "border-blue-500 text-blue-700 bg-blue-50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Check User</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto py-8">
        {activeTab === "addUser" && <AddUser />}
        {activeTab === "checkUser" && <CheckUser />}
      </div>
    </div>
  );
}
