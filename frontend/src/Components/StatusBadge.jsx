import React from 'react';

/**
 * Status Badge Component for displaying item or parent status
 * @param {String} status - The status value: "Pending" | "In Progress" | "Done" | "Cancelled"
 * @param {String} size - Size variant: "sm" | "md" | "lg"
 */
export const StatusBadge = ({ status = "Pending", size = "md" }) => {
  const statusConfig = {
    "Pending": {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      border: "border-yellow-300",
      label: "📋 Pending"
    },
    "In Progress": {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-300",
      label: "⏳ In Progress"
    },
    "Done": {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-300",
      label: "✅ Done"
    },
    "Cancelled": {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-300",
      label: "❌ Cancelled"
    },
    "Shipped": {
      bg: "bg-indigo-100",
      text: "text-indigo-800",
      border: "border-indigo-300",
      label: "🚚 Shipped"
    },
    "Delivered": {
      bg: "bg-emerald-100",
      text: "text-emerald-800",
      border: "border-emerald-300",
      label: "🎯 Delivered"
    }
  };

  const config = statusConfig[status] || statusConfig["Pending"];

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };

  return (
    <span className={`inline-flex items-center ${sizeClasses[size]} rounded-full border ${config.bg} ${config.text} ${config.border} font-medium whitespace-nowrap`}>
      {config.label}
    </span>
  );
};

export const getStatusColor = (status) => {
  const colors = {
    "Pending": "yellow",
    "In Progress": "blue",
    "Done": "green",
    "Cancelled": "red"
  };
  return colors[status] || "gray";
};

export const getStatusIcon = (status) => {
  const icons = {
    "Pending": "📋",
    "In Progress": "⏳",
    "Done": "✅",
    "Cancelled": "❌"
  };
  return icons[status] || "ℹ️";
};

export default StatusBadge;
