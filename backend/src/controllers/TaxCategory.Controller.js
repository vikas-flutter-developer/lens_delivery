import TaxCategory from "../models/TaxCategory.js";

const addTaxCategory = async (req, res) => {
  try {
    const {
      Name,
      type,
      localTax1,
      localTax2,
      centralTax,
      cessTax,
      taxOnMRP,
      isDefault,
      remarks,
    } = req.body;
    if (!Name || typeof Name !== "string") {
      return res
        .status(400)
        .json({ message: "Invalid or missing Category Name" });
    }

    if (!type || !["goods", "services"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Type must be goods or services" });
    }

    const cgst = Number(localTax1) || 0;
    const sgst = Number(localTax2) || 0;
    const igst = Number(centralTax) || 0;
    const cess = Number(cessTax) || 0;

    if (cgst < 0 || sgst < 0 || igst < 0 || cess < 0) {
      return res.status(400).json({ message: "Tax values cannot be negative" });
    }

    if (cgst > 0 && sgst === 0) {
      return res
        .status(400)
        .json({ message: "Please enter SGST when CGST is filled" });
    }

    if (sgst > 0 && cgst === 0) {
      return res
        .status(400)
        .json({ message: "Please enter CGST when SGST is filled" });
    }



    if (cgst === 0 && sgst === 0 && igst === 0) {
      return res
        .status(400)
        .json({ message: "Enter at least one tax value (CGST/SGST or IGST)" });
    }

    const exists = await TaxCategory.findOne({ Name });

    if (exists) {
      return res.status(409).json({ message: "Tax Category already exists" });
    }

    if (isDefault === true || isDefault === "yes") {
      await TaxCategory.updateMany(
        { isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const newTaxCategory = new TaxCategory({
      Name,
      type,
      localTax1: cgst,
      localTax2: sgst,
      centralTax: igst,
      cessTax: cess,
      taxOnMRP: taxOnMRP === "yes" ? "yes" : "no",
      isDefault: isDefault === true || isDefault === "yes",
      remarks: remarks || "",
    });

    await newTaxCategory.save();

    return res.status(201).json({
      message: "Tax Category created successfully",
      category: newTaxCategory,
    });
  } catch (err) {
    console.error("Error creating tax category:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

const getAllTaxCategories = async (req, res) => {
  try {
    const taxCategories = await TaxCategory.find();

    return res.status(200).json({
      success: true,
      data: taxCategories || [],
      message: taxCategories && taxCategories.length > 0 ? "Tax Categories fetched successfully" : "No Tax Categories found",
    });
  } catch (err) {
    console.error("Error fetching Tax Categories:", err);
    return res.status(500).json({
      success: false,
      error: { message: "Server error while fetching Tax Categories" },
    });
  }
};

const getTaxCategoryById = async (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ message: "ID is required" });
  }
  try {
    const taxCategory = await TaxCategory.findById(id);
    if (!taxCategory) {
      return res.status(404).json({ message: "Tax Category not found" });
    }
    return res.status(200).json({ success: true, data: taxCategory });
  } catch (err) {
    console.error("Error fetching tax category:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const editTaxCategory = async (req, res) => {
  const { id, payload } = req.body;
  try {
    const existing = await TaxCategory.findById(id);

    if (!existing) {
      return res.status(404).json({ message: "Tax Category not found" });
    }

    if (payload.isDefault === true || payload.isDefault === "yes") {
      await TaxCategory.updateMany(
        { _id: { $ne: id }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const updated = await TaxCategory.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Tax Category updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating tax category:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

const deleteTaxCategory = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID is required",
      });
    }
    const existing = await TaxCategory.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Tax Category not found",
      });
    }
    await TaxCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Tax Category deleted successfully",
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
export {
  addTaxCategory,
  getAllTaxCategories,
  editTaxCategory,
  getTaxCategoryById,
  deleteTaxCategory,
};
