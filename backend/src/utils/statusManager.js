/**
 * Status Management Utility for Sale Orders, Challans, and Invoices
 * Implements automatic status derivation based on item statuses
 */

export const STATUSES = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
  ON_APPROVAL: "On Approval"
};

export const STATUS_COLORS = {
  [STATUSES.PENDING]: "yellow",
  [STATUSES.IN_PROGRESS]: "blue",
  [STATUSES.DONE]: "green",
  [STATUSES.CANCELLED]: "red",
  [STATUSES.ON_APPROVAL]: "purple"
};

/**
 * Derive order status from items
 * Item status is the source of truth
 * Order status is derived from item statuses, EXCEPT when manually set to "Cancelled" or "On Approval"
 * 
 * @param {Array} items - Array of items with itemStatus field
 * @param {String} currentOrderStatus - Current order status
 * @returns {String} - Derived status: "Pending" | "In Progress" | "Done" | "Cancelled" | "On Approval"
 */
export function deriveOrderStatus(items, currentOrderStatus) {
  if (currentOrderStatus === "Cancelled") return "Cancelled";
  if (currentOrderStatus === "On Approval") return "On Approval";
  if (currentOrderStatus === "Done") return "Done";

  if (!Array.isArray(items) || items.length === 0) {
    return "Pending";
  }

  const activeItems = items.filter(i => i.itemStatus !== "Cancelled");
  const total = activeItems.length;

  if (total === 0) return "Pending";

  const done = activeItems.filter(i => i.itemStatus === "Done").length;
  const inProgress = activeItems.filter(i => i.itemStatus === "In Progress").length;

  // 1. If all active items are 'Done', parent status is 'Done'
  if (done === total) return "Done";

  // 2. If any active item is 'In Progress' or 'Done', parent status is 'In Progress'
  if (done > 0 || inProgress > 0) return "In Progress";

  // 3. Otherwise, if all active items are 'Pending' (or no In Progress/Done), it's 'Pending'
  return "Pending";
}

/**
 * Update specific item statuses in a document
 */
export const updateItemStatuses = (items, selectedItemIds, newStatus) => {
  const selectedSet = new Set((selectedItemIds || []).map(id => String(id)));

  return (items || []).map(item => {
    // If item is already Cancelled, it stays Cancelled permanently (unless manually changed)
    // But here we check if it's in the selected list
    if (selectedSet.has(String(item._id))) {
      return {
        ...item,
        itemStatus: newStatus
      };
    }
    return item;
  });
};

/**
 * Recalculate and update the status of a document
 */
export const recalculateDocStatus = (doc) => {
  if (!doc) return;
  const newStatus = deriveOrderStatus(doc.items || [], doc.status || doc.parentStatus);
  doc.status = newStatus;
  if (doc.parentStatus) doc.parentStatus = newStatus;
  return newStatus;
};

/**
 * Initialize item statuses when creating new order
 */
export const initializeItemStatuses = (items) => {
  return (items || []).map(item => ({
    ...item,
    itemStatus: item.itemStatus || "Pending"
  }));
};

/**
 * Get status summary of items
 */
export const getItemStatusSummary = (items) => {
  const summary = {
    total: 0,
    pending: 0,
    inProgress: 0,
    done: 0,
    cancelled: 0,
    onApproval: 0
  };

  if (!Array.isArray(items)) return summary;

  items.forEach(item => {
    summary.total++;
    switch (item.itemStatus) {
      case "Pending": summary.pending++; break;
      case "In Progress": summary.inProgress++; break;
      case "Done": summary.done++; break;
      case "Cancelled": summary.cancelled++; break;
      case "On Approval": summary.onApproval++; break;
      default: summary.pending++;
    }
  });

  return summary;
};

/**
 * Derive Purchase order status from items
 * Follows strict progression: Pending -> In Progress (when all are at least In Progress) -> Done (when all are Done)
 * 
 * @param {Array} items - Array of items with itemStatus field
 * @param {String} currentOrderStatus - Current order status
 * @returns {String} - Derived status
 */
export function derivePurchaseOrderStatus(items, currentOrderStatus) {
  if (currentOrderStatus === "Cancelled") return "Cancelled";
  if (currentOrderStatus === "Done") return "Done";
  if (currentOrderStatus === "Received") return "Received";

  if (!Array.isArray(items) || items.length === 0) {
    return "Pending";
  }

  const activeItems = items.filter(i => i.itemStatus !== "Cancelled");
  const total = activeItems.length;

  if (total === 0) return "Pending";

  const done = activeItems.filter(i => i.itemStatus === "Done").length;
  const inProgress = activeItems.filter(i => i.itemStatus === "In Progress").length;

  // If all active items are 'Done', parent status is 'Done'
  if (done === total) return "Done";

  // If any active item is 'In Progress' or 'Done', parent status is 'In Progress'
  if (done > 0 || inProgress > 0) return "In Progress";

  // Otherwise, if all active items are 'Pending', it stays 'Pending'
  return "Pending";
}

export default {
  deriveOrderStatus,
  derivePurchaseOrderStatus,
  initializeItemStatuses,
  updateItemStatuses,
  recalculateDocStatus,
  getItemStatusSummary,
  STATUSES,
  STATUS_COLORS
};
