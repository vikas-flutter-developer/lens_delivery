import React, { useEffect, useState } from "react";
import ApiClient from "../ApiClient";
import { Filter, X, Eye, EyeOff } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

export default function CheckUser() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passError, setPassError] = useState(false);
  const [filter, setFilter] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [filteredUsers, setFilteredUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await ApiClient.get("/admin/userdata");
        const list = res.data.response || [];
        setUsers(list);
        setFilteredUsers(list);
      } catch (err) {
        console.error(err);
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let result = users;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (user) =>
          (user.name || "").toLowerCase().includes(q) ||
          (user.email || "").toLowerCase().includes(q)
      );
    }

    if (roleFilter !== "All") {
      result = result.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(result);
  }, [users, searchTerm, roleFilter]);

  const HandleChangePass = (id) => {
    setEditingUser(id);
    setNewPassword("");
    setShowPassword(false);
    setPassError(false);
  };

  const HandlePass = async (id) => {
    if (!newPassword || newPassword.length < 6) {
      setPassError(true);
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await ApiClient.put(
        "/admin/change-pass",
        {
          id,
          newPassword,
        }
      );

      toast.success(res.data.message || "Password updated successfully");
      setEditingUser(null);
      setNewPassword("");
      setPassError(false);
    } catch (err) {
      console.error(err);
      setPassError(true);
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Failed to update password");
      }
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setRoleFilter("All");
  };

  if (loading) {
    return (
      <div className="w-full bg-white p-8 rounded-2xl shadow-lg text-gray-800 text-center">
        <div className="py-8">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-white p-8 rounded-2xl shadow-lg text-gray-800 text-center">
        <div className="py-8 text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-lg text-gray-800">


        {/* Header and Filter Button Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              Manage Users
            </h2>
            <div className="text-sm text-gray-600 block sm:hidden">
              <span className="mr-2">Total: {users.length}</span>
              <span>Shown: {filteredUsers.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <button
              onClick={() => setFilter(!filter)}
              aria-label="Toggle filters"
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
            >
              <Filter size={18} />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <div className="text-sm text-gray-600 hidden sm:block">
              <span className="mr-4">Total: {users.length}</span>
              <span>Shown: {filteredUsers.length}</span>
            </div>
          </div>
        </div>

        {/* Filter Section - Horizontal Layout */}
        {filter && (
          <div className="flex flex-col sm:flex-row gap-3 p-4 mb-4 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              placeholder="Search by Name or Email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border p-2 rounded-md w-full sm:w-64 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border p-2 rounded-md w-full sm:w-auto focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All Roles</option>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setRoleFilter("All");
                }}
                className="px-4 py-2 border rounded-md hover:bg-slate-100 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* User Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-12">
                  SR
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[200px]">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[220px]">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[160px]">
                  Last Login
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[120px]">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[180px]">
                  Password
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    <p className="text-lg font-medium">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u._id || idx} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-700 font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-4 text-slate-800">
                      <div className="font-medium">{u.name || "-"}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <a
                        className="text-blue-600 hover:underline"
                        href={`mailto:${u.email}`}
                      >
                        {u.email || "-"}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {u.lastLogin ? (
                        <div className="flex flex-col">
                          <span>
                            {new Date(u.lastLogin).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                          </span>
                          <span className="mt-1 text-gray-500">
                            {new Date(u.lastLogin).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {u.role || "-"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {editingUser === u._id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setPassError(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                HandlePass(u._id);
                              }
                            }}
                            className={`border px-2 py-1 rounded-lg w-44 transition-all ${passError
                                ? "border-red-500 animate-shake"
                                : "border-gray-300"
                              }`}
                            placeholder="New password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-2 border rounded-md"
                            aria-label="Toggle show password"
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              HandlePass(u._id);
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"
                          >
                            Change
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-2 rounded-full border border-gray-200 hover:bg-red-50 flex items-center justify-center"
                            title="Cancel"
                            aria-label="Cancel password change"
                          >
                            <X size={16} className="text-gray-600" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="px-4 py-2 bg-black text-white rounded-lg shadow hover:bg-gray-700 transition-colors duration-200"
                          onClick={() => HandleChangePass(u._id)}
                        >
                          Change Password
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </>
  );
}
