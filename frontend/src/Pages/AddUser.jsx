import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Eye, EyeOff, Mail, Lock, User, Plus } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import ApiClient from "../ApiClient";
import { selectIsLoading } from "../Store/Slices/loadingSlice";

export default function AddUser() {
  const [role, setRole] = useState("employee");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isGlobalLoading = useSelector(selectIsLoading);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!email) e.email = "Email is required.";
    else {
      const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!re.test(email)) e.email = "Enter a valid email address.";
    }
    if (!password) e.password = "Password is required.";
    else if (password.length < 6) e.password = "Password must be at least 6 characters.";
    if (!confirmPassword) e.confirmPassword = "Please confirm the password.";
    else if (confirmPassword !== password) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setRole("employee");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
  };

  const handleSubmit = async (ev) => {
    ev?.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors before submitting.");
      return;
    }
    
    try {
      // ApiClient now handles startLoading/stopLoading automatically dispatching to Redux
      await ApiClient.post("/admin/create-user", {
        role,
        name,
        email,
        password,
      });
      toast.success("User created successfully");
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to create user. Try again.");
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center pt-4 pb-6">
      <div className="w-1/2 max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
        {/* Header */}
        <div className="bg-black px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create New User</h2>
              <p className="text-blue-100 text-sm">Add a new team member</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="space-y-5">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full pl-10 pr-3 py-2.5 text-sm border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-3 py-2.5 text-sm border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isGlobalLoading}
              className="w-full bg-black text-white py-3 rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl relative"
            >
              {isGlobalLoading ? "Processing..." : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
