import Vendor from "../models/Vendor.js";
import { logDeletion } from "../utils/logDeletion.js";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const addVendor = async (req, res) => {
  try {
    let { name, email, phone, address, gstNo, remark, tags } = req.body;

    // ---- Name validation ----
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vendor name is required",
      });
    }
    name = name.trim();

    // ---- Email validation ----
    if (email) {
      email = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
    }

    // ---- Phone validation (India) ----
    if (phone) {
      phone = phone.trim();
      if (!PHONE_REGEX.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number",
        });
      }
    }

    // ---- GST validation ----
    if (gstNo) {
      gstNo = gstNo.trim().toUpperCase();
      if (!GST_REGEX.test(gstNo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid GST number",
        });
      }
    }

    // ---- Tags validation ----
    if (tags && !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: "Tags must be an array",
      });
    }

    // ---- Duplicate checks ----
    const exists = await Vendor.findOne({
      $or: [
        { name },
        ...(phone ? [{ phone }] : []),
        ...(gstNo ? [{ gstNo }] : []),
      ],
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Vendor already exists",
      });
    }

    // ---- Create vendor ----
    const newVendor = new Vendor({
      name,
      email: email || "",
      phone: phone || "",
      address: address?.trim() || "",
      gstNo: gstNo || "",
      remark: remark?.trim() || "",
      tags: Array.isArray(tags) ? tags : [],
    });

    await newVendor.save();

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: newVendor,
    });
  } catch (err) {
    console.error("Error creating vendor:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

const getAllVendors = async (req, res) => {
  try {
    const taxCategories = await Vendor.find();
    if (!taxCategories || taxCategories.length === 0) {
      return res.status(404).json({
        success: false,
        data: [],
        message: "No Vendors found",
      });
    }

    return res.status(200).json({
      success: true,
      data: taxCategories,
      message: "Vendors fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching Vendors:", err);
    return res.status(500).json({
      success: false,
      error: { message: "Server error while fetching Vendors" },
    });
  }
};

const getVendorById = async (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ message: "ID is required" });
  }
  try {
    const taxCategory = await Vendor.findById(id);
    if (!taxCategory) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    return res.status(200).json({ success: true, data: taxCategory });
  } catch (err) {
    console.error("Error fetching tax category:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const editVendor = async (req, res) => {
  const { id, payload } = req.body;
  try {
    const existing = await Vendor.findById(id);

    if (!existing) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (payload.isDefault === true || payload.isDefault === "yes") {
      await Vendor.updateMany(
        { _id: { $ne: id }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const phoneRegex = /^[6-9]\d{9}$/;
    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i;

    if (payload.email !== undefined) {
      const email = payload.email.trim().toLowerCase();
      if (email && !emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }
    }

    // ---- Phone ----
    if (payload.phone !== undefined) {
      const phone = payload.phone.trim();
      if (phone && !phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid mobile number (10 digits, starts with 6-9)",
        });
      }
    }

    // ---- GST ----
    if (payload.gstNo !== undefined) {
      const gstNo = payload.gstNo.trim().toUpperCase();
      if (gstNo && !gstRegex.test(gstNo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid GST number",
        });
      }
    }

    const updated = await Vendor.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating Vendor:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID is required",
      });
    }
    const existing = await Vendor.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }
    await logDeletion({
      type: "vendor",
      name: existing.name,
      originalData: existing
    });

    await Vendor.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
export { addVendor, getAllVendors, editVendor, getVendorById, deleteVendor };
