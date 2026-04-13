import React, { useState, useContext } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Eye, EyeOff, Mail, Lock, User, LogIn, X, KeyRound, ShieldCheck, ArrowRight, RefreshCcw } from "lucide-react";
import ApiClient from "../ApiClient";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [role, setRole] = useState("Admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Forgot Password States
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: Reset
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const validate = () => {
    const e = {};
    if (!email) e.email = "Email is required.";
    else {
      const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!re.test(email)) e.email = "Enter a valid email address.";
    }

    if (!password) e.password = "Password is required.";
    else if (password.length < 6) e.password = "Password must be at least 6 characters.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors before submitting.");
      return;
    }

    setLoading(true);
    try {
      await login(role, email, password);
      toast.success("Logged in successfully");
      setEmail("");
      setPassword("");
      navigate("/"); // Redirect to home page after successful login
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your registered email.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await ApiClient.post('/auth/forgot-password', { email: forgotEmail });
      toast.success(res.data.message);
      setForgotStep(2);
      setCountdown(300); // 5 minutes
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) {
      toast.error("Please enter the OTP.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await ApiClient.post('/auth/verify-otp', { email: forgotEmail, otp });
      toast.success(res.data.message);
      setResetToken(res.data.resetToken);
      setForgotStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await ApiClient.post('/auth/reset-password', { resetToken, newPassword });
      toast.success(res.data.message);
      closeForgotModal();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgot(false);
    setForgotStep(1);
    setForgotEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setResetToken("");
  };



  React.useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">

      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <LogIn className="w-6 h-6 text-blue-600" />
            Sign in to your account
          </h2>
          <p className="text-md font-bold text-slate-600 mt-2  text-center">Welcome back.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-2">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option>Admin</option>
              <option>Manager</option>
              <option>Employee</option>
              <option>Super Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                
                placeholder="you@company.com"
                className={`w-full pl-11 pr-4 py-3 border rounded-lg outline-none transition-all duration-150 ${
                  errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-slate-300 focus:ring-2 focus:ring-blue-200'
                }`}
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-2 text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full pl-11 pr-12 py-3 border rounded-lg outline-none transition-all duration-150 ${
                  errors.password ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-slate-300 focus:ring-2 focus:ring-blue-200'
                }`}
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={errors.password ? "password-error" : undefined}
              />

              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-600 hover:bg-slate-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-2 text-sm text-red-600">
                {errors.password}
              </p>
            )}
            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 disabled:opacity-60 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-150 shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity="0.25" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="4" strokeLinecap="round" />
                </svg>
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{loading ? "Signing in..." : "Sign In"}</span>
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-gradient-to-t from-white/60 to-transparent text-slate-600 text-xs text-center">
          <div>By signing in you agree to the company policies.</div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                Forgot Password
              </h3>
              <button 
                onClick={closeForgotModal}
                className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6">
              {/* Step Indicators */}
              <div className="flex items-center justify-center gap-2 mb-8">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      forgotStep >= step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step}
                    </div>
                    {step < 3 && (
                      <div className={`w-8 h-0.5 transition-colors ${
                        forgotStep > step ? 'bg-blue-600' : 'bg-slate-100'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {forgotStep === 1 && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="text-center mb-6">
                    <p className="text-slate-600">Enter your registered email address to receive a verification OTP.</p>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition-all font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    Send OTP
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="text-center mb-6">
                    <p className="text-slate-600">We've sent a 6-digit code to <span className="font-bold">{forgotEmail}</span></p>
                  </div>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition-all text-center text-xl font-black tracking-[0.5em]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      {countdown > 0 ? `Expires in ${formatTime(countdown)}` : 'OTP Expired'}
                    </span>
                    <button 
                      type="button"
                      onClick={handleSendOTP}
                      className="text-blue-600 font-bold hover:underline disabled:opacity-50"
                      disabled={countdown > 240} // Prevent resending within 1 min
                    >
                      Resend OTP
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : "Verify OTP"}
                  </button>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="text-center mb-6">
                    <p className="text-slate-600 font-medium">OTP Verified! Set your new password below.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : "Set Password"}
                  </button>
                </form>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
              <button 
                onClick={closeForgotModal}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
