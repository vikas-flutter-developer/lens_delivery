import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "Pending", label: "Pending", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "In Progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "Done", label: "Done", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "Cancelled", label: "Cancelled", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "On Approval", label: "On Approval", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

const MOBILE_STATUS_DISPLAY = {
  "Shipped": { label: "Shipped", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  "Delivered": { label: "Delivered", color: "bg-emerald-100 text-emerald-700 border-emerald-200" }
};

const StatusDropdown = ({ currentStatus, onStatusChange, isLoading = false, readOnly = false, size = "md" }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getFormattedStatus = (status) => {
    if (!status) return "Pending";
    // Check if it's one of our exact values first
    const exactMatch = STATUS_OPTIONS.find(opt => opt.value.toLowerCase() === status.toLowerCase());
    if (exactMatch) return exactMatch.value;
    
    // Fallback to title case
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const formattedStatus = getFormattedStatus(currentStatus);

  // Check if it's one of our standard options
  let currentOption = STATUS_OPTIONS.find(
    (opt) => opt.value === formattedStatus
  );

  // If not standard, check if it's a mobile status for display only
  if (!currentOption) {
    const mobileStatusKey = Object.keys(MOBILE_STATUS_DISPLAY).find(k => k.toLowerCase() === formattedStatus.toLowerCase());
    if (mobileStatusKey) {
      currentOption = { value: mobileStatusKey, ...MOBILE_STATUS_DISPLAY[mobileStatusKey] };
    }
  }

  // Fallback
  if (!currentOption) currentOption = STATUS_OPTIONS[0];

  const handleStatusSelect = async (newStatus) => {
    if (readOnly || newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    try {
      await onStatusChange(newStatus);
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Failed to update status");
    }
  };

  const sizeClasses = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  return (
    <div className={`relative inline-block ${size === 'sm' ? 'w-auto' : 'w-full'}`}>
      <button
        onClick={() => !readOnly && setIsOpen(!isOpen)}
        disabled={isLoading || readOnly}
        className={`w-full rounded-lg border border-slate-300 flex items-center justify-between gap-2 transition-all duration-200 ${currentOption.color
          } ${sizeClasses} ${isLoading || readOnly ? "cursor-default" : "hover:shadow-md"}`}
      >
        <span className="font-semibold">{currentOption.label}</span>
        {!readOnly && (
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
              }`}
          />
        )}
      </button>

      {!readOnly && isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 min-w-[120px] bg-white border border-slate-300 rounded-lg shadow-lg z-50">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusSelect(option.value)}
              className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-slate-100 first:rounded-t-lg last:rounded-b-lg ${option.value === formattedStatus
                ? `${option.color} bg-opacity-20`
                : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              <span className="inline-flex items-center gap-2">
                {option.value === formattedStatus && (
                  <span className="text-sm">✓</span>
                )}
                {option.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusDropdown;
