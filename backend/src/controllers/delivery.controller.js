import LensSale from "../models/LensSale.js";
import LensSaleChallan from "../models/LensSaleChallan.js";
import RxSale from "../models/RxSale.js";
import Account from "../models/Account.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import moment from "moment";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Generate a 6-digit numeric OTP */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Resolve the Mongoose model + a human-readable label from an orderType string.
 * Accepts: 'challan' | 'lens' | 'lens-invoice' | 'rx' | 'rx-invoice'
 */
const resolveModel = (orderType) => {
  switch ((orderType || "").toLowerCase()) {
    case "challan":
      return { Model: LensSaleChallan, label: "Challan" };
    case "lens-invoice":
    case "lens":
      return { Model: LensSale, label: "Lens Invoice" };
    case "rx-invoice":
    case "rx":
      return { Model: RxSale, label: "Rx Invoice" };
    default:
      return null;
  }
};

/**
 * Look up whether the party name on an order belongs to a whitelisted account.
 * We match on Account.Name (case-insensitive).
 */
const isPartyWhitelisted = async (partyName, companyId) => {
  if (!partyName) return false;
  const query = {
    Name: { $regex: `^${partyName.trim()}$`, $options: "i" },
    isOtpWhitelisted: true,
  };
  if (companyId) query.companyId = new mongoose.Types.ObjectId(companyId);
  const account = await Account.findOne(query).select("_id").lean();
  return !!account;
};

/**
 * Fetches the full address and contact info for a customer from the Account model.
 * Falls back to challan data if account not found.
 */
const getFullCustomerInfo = async (partyName, companyId, fallbackData) => {
  if (!partyName) return { name: "N/A", address: "N/A", phone: "N/A" };
  
  try {
    const account = await Account.findOne({
      Name: { $regex: `^${partyName.trim()}$`, $options: "i" },
      companyId: companyId ? new mongoose.Types.ObjectId(companyId) : { $exists: true }
    }).select("Address State Pincode MobileNumber TelNumber Name").lean();

    if (account) {
      // Construct full address: [Address], [State] - [Pincode]
      const components = [
        account.Address,
        account.State,
      ].filter(v => v && v.trim() !== "").join(", ");
      
      const fullAddress = account.Pincode 
        ? (components ? `${components} - ${account.Pincode}` : account.Pincode)
        : (components || fallbackData?.address || "N/A");

      return {
        name: account.Name || partyName,
        address: fullAddress,
        phone: account.MobileNumber || account.TelNumber || fallbackData?.phone || "N/A",
      };
    }
  } catch (err) {
    console.warn("Error fetching full customer info:", err.message);
  }

  // Fallback to data provided by the caller (from Challan/Invoice document)
  return {
    name: partyName || "N/A",
    address: fallbackData?.address || "N/A",
    phone: fallbackData?.phone || "N/A",
  };
};

// ─────────────────────────────────────────────
// Whitelist Management
// ─────────────────────────────────────────────

/**
 * GET /api/customers/whitelist
 * Returns all accounts with isOtpWhitelisted = true.
 */
export const getWhitelist = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const query = { isOtpWhitelisted: true };
    if (companyId) query.companyId = new mongoose.Types.ObjectId(companyId);

    const customers = await Account.find(query)
      .select("_id Name MobileNumber TelNumber Address AccountId")
      .lean();

    return res.status(200).json({
      success: true,
      data: customers.map((c) => ({
        id: c._id,
        name: c.Name,
        phone: c.MobileNumber || c.TelNumber || "",
        address: c.Address || "",
        accountId: c.AccountId,
      })),
    });
  } catch (err) {
    console.error("getWhitelist error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/customers/whitelist
 * Body: { customerId }
 * Adds the account to the whitelist.
 */
export const addToWhitelist = async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }

    const account = await Account.findByIdAndUpdate(
      customerId,
      { $set: { isOtpWhitelisted: true } },
      { new: true }
    ).select("_id Name MobileNumber isOtpWhitelisted");

    if (!account) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({
      success: true,
      message: `${account.Name} added to OTP whitelist`,
      data: account,
    });
  } catch (err) {
    console.error("addToWhitelist error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * DELETE /api/customers/whitelist/:customerId
 * Removes the account from the whitelist.
 */
export const removeFromWhitelist = async (req, res) => {
  try {
    const { customerId } = req.params;

    const account = await Account.findByIdAndUpdate(
      customerId,
      { $set: { isOtpWhitelisted: false } },
      { new: true }
    ).select("_id Name isOtpWhitelisted");

    if (!account) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({
      success: true,
      message: `${account.Name} removed from OTP whitelist`,
      data: account,
    });
  } catch (err) {
    console.error("removeFromWhitelist error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// Delivery Workflow
// ─────────────────────────────────────────────

/**
 * POST /api/delivery/start
 * Triggered by the delivery person scanning the QR code.
 * Body: { qrData, deliveryPersonId, orderType? }
 *
 * qrData can be:
 *   - A MongoDB ObjectId (direct _id lookup)
 *   - A billNo string (we search across all three models)
 *
 * Sets dispatchTime, generates OTP (if not whitelisted), updates status.
 */
export const startDelivery = async (req, res) => {
  try {
    let { qrData, deliveryPersonId, orderType } = req.body;
    const companyId = req.user?.companyId;

    if (!qrData || !deliveryPersonId) {
      return res
        .status(400)
        .json({ success: false, message: "qrData and deliveryPersonId are required" });
    }

    // ── 0. Parse JSON QR Data (Compatibility with React ERP) ───────────────
    // The ERP generates QR as JSON string: {"orderId": "...", "orderType": "..."}
    if (typeof qrData === "string" && qrData.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.orderId) {
          qrData = parsed.orderId;
          // Use orderType from JSON if not provided in top-level body
          if (!orderType && parsed.orderType) {
            orderType = parsed.orderType;
          }
        }
      } catch (e) {
        console.warn("QR Data appears to be JSON but failed to parse:", e.message);
        // Fall back to using qrData as a plain string
      }
    }

    // ── 1. Find the order ──────────────────────────────────────────────────
    let order = null;
    let Model = null;
    let modelLabel = "";

    const isObjectId = mongoose.Types.ObjectId.isValid(qrData);

    if (orderType) {
      // Caller told us the type; do a targeted lookup
      const resolved = resolveModel(orderType);
      if (!resolved) {
        return res.status(400).json({ success: false, message: "Invalid orderType" });
      }
      ({ Model, label: modelLabel } = resolved);
      order = isObjectId
        ? await Model.findById(qrData)
        : await Model.findOne({ "billData.billNo": qrData });
    } else {
      // Try all three models in priority order
      const candidates = [
        { Model: LensSaleChallan, label: "Challan" },
        { Model: LensSale, label: "Lens Invoice" },
        { Model: RxSale, label: "Rx Invoice" },
      ];
      for (const c of candidates) {
        const found = isObjectId
          ? await c.Model.findById(qrData)
          : await c.Model.findOne({ "billData.billNo": qrData });
        if (found) {
          order = found;
          Model = c.Model;
          modelLabel = c.label;
          break;
        }
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found for the given QR data" });
    }

    // ── 2. Prevent re-dispatch if already delivered ────────────────────────
    const partyName = order.partyData?.partyAccount || "";
    if (order.deliveryStatus === "Delivered") {
      return res.status(200).json({
        success: true,
        alreadyDelivered: true,
        message: "Order has already been delivered",
        orderId: order._id,
        customer: await getFullCustomerInfo(partyName, companyId, {
          address: order.partyData?.address,
          phone: order.partyData?.contactNumber,
        }),
      });
    }

    // ── 3. Whitelist check ─────────────────────────────────────────────────
    const isWhitelisted = await isPartyWhitelisted(partyName, companyId);

    // ── 4. Generate / reuse OTP ────────────────────────────────────────────
    let otp = order.deliveryOtp;
    const forceRegenerate = req.body.forceRegenerate === true;

    if (!isWhitelisted && (!otp || forceRegenerate)) {
      otp = generateOtp();
    }

    // ── 5. Persist dispatch info (Resolve Real Name) ───────────────────────
    let deliveryPersonName = deliveryPersonId; // Fallback to whatever was sent
    try {
      if (mongoose.Types.ObjectId.isValid(deliveryPersonId)) {
        const user = await User.findById(deliveryPersonId).select("name").lean();
        if (user) deliveryPersonName = user.name;
      }
    } catch (e) {
      console.warn("Failed to resolve delivery person name:", e.message);
    }

    const updateFields = {
      dispatchTime: new Date(),
      deliveryStatus: "Out for Delivery",
      outForDeliveryTime: order.outForDeliveryTime || new Date(),
      deliveryPerson: deliveryPersonName,
    };

    if (!isWhitelisted) {
      updateFields.deliveryOtp = otp;
      // If we are generating/regenerating, reset the 300s timer
      if (otp) {
        updateFields.otpExpiresAt = new Date(Date.now() + 300 * 1000);
      }
    }
    
    if (otp) {
      console.log("\n************************************************");
      console.log(`*  [TESTING] OTP FOR ORDER ${order._id}: ${otp}  *`);
      console.log("************************************************\n");
    }

    const updated = await Model.findByIdAndUpdate(
      order._id,
      { $set: updateFields },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      orderId: updated.id,
      orderType: modelLabel,
      isWhitelisted,
      customer: await getFullCustomerInfo(partyName, companyId, {
        address: updated.partyData?.address,
        phone: updated.partyData?.contactNumber,
      }),
      billData: updated.billData || {},
      partyData: updated.partyData || {},
      billNo: updated.billData?.billNo || "",
    });
  } catch (err) {
    console.error("startDelivery error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};

/**
 * GET /api/delivery/order/:orderId/otp
 * Used by the Lens Retail app to display the OTP to the customer.
 * The OTP was set during startDelivery.
 */
export const getDeliveryOtp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderType } = req.query; // optional hint

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid orderId" });
    }

    // Find order
    let order = null;
    if (orderType) {
      const resolved = resolveModel(orderType);
      if (resolved) order = await resolved.Model.findById(orderId).select("deliveryOtp deliveryStatus partyData");
    }
    if (!order) {
      // Try all models
      for (const M of [LensSaleChallan, LensSale, RxSale]) {
        order = await M.findById(orderId).select("deliveryOtp deliveryStatus partyData");
        if (order) break;
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.deliveryOtp) {
      // Could be whitelisted (no OTP set) or delivery not started
      if (order.deliveryStatus === "Pending") {
        return res.status(400).json({ success: false, message: "Delivery has not been started yet" });
      }
      return res.status(200).json({
        success: true,
        otp: null,
        isWhitelisted: true,
        message: "Customer is whitelisted — no OTP required",
      });
    }

    return res.status(200).json({
      success: true,
      otp: order.deliveryOtp,
    });
  } catch (err) {
    console.error("getDeliveryOtp error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/delivery/arrive
 * Triggered when the delivery person reaches the customer address.
 * Body: { orderId, orderType? }
 *
 * Captures arrivalTime and returns whitelist status to the app.
 */
export const recordArrival = async (req, res) => {
  try {
    const { orderId, orderType } = req.body;
    const companyId = req.user?.companyId;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    // 1. Find order
    let order = null;
    let Model = null;
    let modelLabel = "";

    if (orderType) {
      const resolved = resolveModel(orderType);
      if (resolved) { Model = resolved.Model; modelLabel = resolved.label; }
    }
    
    if (!Model) {
      const candidates = [
        { Model: LensSaleChallan, label: "Challan" },
        { Model: LensSale, label: "Lens Invoice" },
        { Model: RxSale, label: "Rx Invoice" },
      ];
      for (const c of candidates) {
        order = await c.Model.findById(orderId);
        if (order) { Model = c.Model; modelLabel = c.label; break; }
      }
    } else {
      order = await Model.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 2. Already delivered?
    if (order.deliveryStatus === "Delivered") {
      return res.status(200).json({
        success: true,
        alreadyDelivered: true,
        message: "Order already delivered",
      });
    }

    // 3. Whitelist check
    const partyName = order.partyData?.partyAccount || "";
    const isWhitelisted = await isPartyWhitelisted(partyName, companyId);

    // 4. Record Arrival Time and Set OTP Expiry (300 seconds)
    const otpExpiresAt = new Date(Date.now() + 300 * 1000);
    const updated = await Model.findByIdAndUpdate(
      orderId,
      { 
        $set: { 
          arrivalTime: new Date(),
          otpExpiresAt: otpExpiresAt
        } 
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Arrival recorded",
      orderId: updated.id,
      orderType: modelLabel,
      isWhitelisted,
      customer: await getFullCustomerInfo(partyName, companyId, {
        address: updated.partyData?.address,
        phone: updated.partyData?.contactNumber,
      }),
      billData: updated.billData || {},
      partyData: updated.partyData || {},
      billNo: updated.billData?.billNo || "",
    });
  } catch (err) {
    console.error("recordArrival error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/delivery/complete
 * Triggered when the delivery person reaches the customer.
 * Body: { orderId, deliveryPersonId, otp?, orderType? }
 *
 * - If the customer is whitelisted: mark as Delivered immediately.
 * - Otherwise: validate the OTP first.
 */
export const completeDelivery = async (req, res) => {
  try {
    const { orderId, deliveryPersonId, otp, orderType } = req.body;
    const companyId = req.user?.companyId;

    if (!orderId || !deliveryPersonId) {
      return res.status(400).json({ success: false, message: "orderId and deliveryPersonId are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid orderId" });
    }

    // ── 1. Find order ──────────────────────────────────────────────────────
    let order = null;
    let Model = null;
    let modelLabel = "";

    if (orderType) {
      const resolved = resolveModel(orderType);
      if (!resolved) return res.status(400).json({ success: false, message: "Invalid orderType" });
      ({ Model, label: modelLabel } = resolved);
      order = await Model.findById(orderId);
    } else {
      for (const c of [
        { Model: LensSaleChallan, label: "Challan" },
        { Model: LensSale, label: "Lens Invoice" },
        { Model: RxSale, label: "Rx Invoice" },
      ]) {
        order = await c.Model.findById(orderId);
        if (order) { Model = c.Model; modelLabel = c.label; break; }
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ── 2. Whitelist / OTP check ───────────────────────────────────────────
    const partyName = order.partyData?.partyAccount || "";
    const isWhitelisted = await isPartyWhitelisted(partyName, companyId);

    // If an OTP exists in the database, we should ALWAYS verify it if provided,
    // or if the customer is not whitelisted.
    if (!isWhitelisted || (otp && order.deliveryOtp)) {
      // 1. Expiry Check
      if (order.otpExpiresAt && new Date() > new Date(order.otpExpiresAt)) {
        return res.status(401).json({ 
          success: false, 
          message: "OTP has expired. Please regenerate your OTP to continue.",
          isExpired: true 
        });
      }

      // 2. Presence Check
      if (!otp && !isWhitelisted) {
        return res.status(400).json({ success: false, message: "OTP is required for non-whitelisted customers" });
      }
      
      if (otp) {
        if (!order.deliveryOtp) {
          // If whitelisted and no OTP was generated, but user sent one...
          // This shouldn't normally happen if the app logic is correct.
          if (!isWhitelisted) {
             return res.status(400).json({ success: false, message: "No OTP found for this order. Please start delivery first." });
          }
        } else if (String(otp).trim() !== String(order.deliveryOtp).trim()) {
          return res.status(401).json({ success: false, message: "Invalid OTP. Delivery could not be confirmed." });
        }
      }
    }

    // ── 3. Already delivered? ──────────────────────────────────────────────
    // Check this AFTER OTP validation to ensure that a wrong OTP for an already 
    // delivered order still shows 'Invalid OTP' rather than 'Already Delivered'.
    if (order.deliveryStatus === "Delivered") {
      return res.status(200).json({
        success: true,
        message: "Order was already marked as delivered",
        completionTime: order.deliveryCompletionTime || order.deliveredTime,
      });
    }

    // ── 4. Mark as Delivered (Resolve Real Name) ──────────────────────────
    let deliveryPersonName = deliveryPersonId;
    try {
      if (mongoose.Types.ObjectId.isValid(deliveryPersonId)) {
        const user = await User.findById(deliveryPersonId).select("name").lean();
        if (user) deliveryPersonName = user.name;
      }
    } catch (e) {
      console.warn("Failed to resolve delivery person name in completion:", e.message);
    }

    const completionTime = new Date();
    const updateFields = {
      status: "Done", // Mark order as finished in ERP
      deliveryStatus: "Delivered",
      deliveryCompletionTime: completionTime,
      deliveredTime: completionTime,
      deliveryPerson: deliveryPersonName,
      deliveryOtp: null, // Clear OTP after use
    };

    const updated = await Model.findByIdAndUpdate(
      orderId,
      { $set: updateFields },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Delivery successful",
      orderId: updated.id,
      orderType: modelLabel,
      customer: await getFullCustomerInfo(partyName, companyId, {
        address: updated.partyData?.address,
        phone: updated.partyData?.contactNumber,
      }),
      billNo: updated.billData?.billNo || "",
      billData: updated.billData || {},
      partyData: updated.partyData || {},
      completionTime: completionTime.toISOString(),
    });
  } catch (err) {
    console.error("completeDelivery error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};

/**
 * Legacy — kept for backward compatibility with the original confirm endpoint.
 */
export const confirmDelivery = async (req, res) => {
  try {
    const { orderId, orderType, deliveryPerson } = req.body;

    if (!orderId || !orderType || !deliveryPerson) {
      return res.status(400).json({
        success: false,
        message: "Order ID, Order Type, and Delivery Person are required",
      });
    }

    const resolved = resolveModel(orderType);
    if (!resolved) return res.status(400).json({ success: false, message: "Invalid order type" });
    const { Model, label } = resolved;

    const order = await Model.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: `${label} not found` });

    const now = new Date();
    const updateFields = { deliveryPerson };

    if (!order.outForDeliveryTime) {
      updateFields.outForDeliveryTime = now;
      updateFields.deliveryStatus = "Out for Delivery";
      if (orderType.toLowerCase() === "challan") {
        updateFields.deliveryPersonAssignedAt = now;
      }
    } else if (!order.deliveredTime) {
      updateFields.deliveredTime = now;
      updateFields.deliveryStatus = "Delivered";
      // Update status to "Done" for challans when delivery is completed
      if (orderType.toLowerCase() === "challan") {
        updateFields.status = "Done";
      }
    } else {
      return res.status(200).json({ success: true, message: "Order already delivered", data: order });
    }

    const updated = await Model.findByIdAndUpdate(orderId, { $set: updateFields }, { new: true });
    return res.status(200).json({ success: true, message: updateFields.deliveryStatus || "Updated", data: updated });
  } catch (err) {
    console.error("confirmDelivery error:", err);
    return res.status(500).json({ success: false, message: "Failed to confirm delivery", error: err.message });
  }
};

/**
 * GET /api/delivery/assigned
 * Returns all challans assigned to the logged-in delivery person
 * that are not yet "Done" or "Cancelled".
 */
export const getAssignedOrders = async (req, res) => {
  try {
    const deliveryPersonName = req.user?.name;
    if (!deliveryPersonName) {
      return res.status(401).json({ success: false, message: "User name not found in token" });
    }

    const todayStart = moment().startOf('day').toDate();
    const query = {
      deliveryPerson: deliveryPersonName,
      $or: [
        { status: { $nin: ["Done", "Cancelled"] } },
        { 
          deliveryStatus: "Delivered", 
          deliveredTime: { $gte: todayStart } 
        }
      ]
    };

    const orders = await LensSaleChallan.find(query).sort({ deliveredTime: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (err) {
    console.error("getAssignedOrders error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/delivery/history
 * Returns the delivery history for the logged-in delivery person.
 * Supports date filtering via ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 */
export const getDeliveryHistory = async (req, res) => {
  try {
    const deliveryPersonName = req.user?.name;
    const { dateFrom, dateTo } = req.query;

    if (!deliveryPersonName) {
      return res.status(401).json({ success: false, message: "User name not found in token" });
    }

    const query = {
      deliveryPerson: deliveryPersonName,
      status: "Done" // Usually history means completed deliveries
    };

    if (dateFrom || dateTo) {
      query.deliveryPersonAssignedAt = {};
      if (dateFrom) query.deliveryPersonAssignedAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.deliveryPersonAssignedAt.$lte = end;
      }
    }

    const history = await LensSaleChallan.find(query).sort({ deliveryPersonAssignedAt: -1 });

    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    console.error("getDeliveryHistory error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/delivery/stats
 * Aggregates statistics for the logged-in delivery person across all models.
 */
export const getDeliveryStats = async (req, res) => {
  try {
    const deliveryPersonName = req.user?.name;
    if (!deliveryPersonName) {
      return res.status(401).json({ success: false, message: "User name not found in token" });
    }

    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const models = [LensSaleChallan, LensSale, RxSale];
    
    let totalAssignedToday = 0;
    let completedToday = 0;
    let onHand = 0;

    for (const Model of models) {
      // 1. Total Assigned Today (Dispatched Today)
      const assignedCount = await Model.countDocuments({
        deliveryPerson: deliveryPersonName,
        dispatchTime: { $gte: todayStart, $lte: todayEnd }
      });
      totalAssignedToday += assignedCount;

      // 2. Completed Today (Delivered Today)
      const completedCount = await Model.countDocuments({
        deliveryPerson: deliveryPersonName,
        deliveryStatus: "Delivered",
        deliveredTime: { $gte: todayStart, $lte: todayEnd }
      });
      completedToday += completedCount;

      // 3. On Hand (Currently Out for Delivery, regardless of when dispatched)
      const onHandCount = await Model.countDocuments({
        deliveryPerson: deliveryPersonName,
        deliveryStatus: "Out for Delivery"
      });
      onHand += onHandCount;
    }

    return res.status(200).json({
      success: true,
      data: {
        todayOrders: totalAssignedToday,
        completed: completedToday,
        onHand: onHand
      }
    });
  } catch (err) {
    console.error("getDeliveryStats error:", err);
    return res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};
