import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <h1 className="text-6xl font-bold text-red-600 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">
        Page Not Found
      </h2>
      <p className="text-slate-600 mb-6">
        The page you are looking for does not exist or you don’t have access.
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
      >
        Go Back Home
      </button>
    </div>
  );
}
