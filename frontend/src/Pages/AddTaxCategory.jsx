import React, { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  addTaxCategory,
  getTaxCategoryById,
  editTaxCategory,
} from "../controllers/TaxCategoryController";
import { useNavigate, useParams } from "react-router-dom";

function AddTaxCategory() {
  const [formData, setFormData] = useState({
    Name: "",
    type: "goods",
    localTax1: "",
    localTax2: "",
    centralTax: "",
    isDefault: "no",
    remarks: "",
  });

  const [loading, setLoading] = useState(false); // loading for fetch
  const [submitting, setSubmitting] = useState(false); // for submit button
  const navigate = useNavigate();
  const { id } = useParams();

  // --- handleChange with numeric clamp fix ---
  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;

    let updates = { [name]: value };

    if (["localTax1", "localTax2", "centralTax"].includes(name)) {
      if (value !== "") {
        value = value.replace(/[^\d.]/g, "");
        const parts = value.split(".");
        if (parts.length > 2) value = parts[0] + "." + parts.slice(1).join("");
        if (Number(value) < 0) value = "0";
        updates[name] = value;
      }
    }

    // Auto-fill tax values when Category Name contains numbers
    if (name === "Name") {
      const match = value.match(/\d+(\.\d+)?/);
      if (match) {
        const taxNum = parseFloat(match[0]);
        updates.localTax1 = String(taxNum / 2);
        updates.localTax2 = String(taxNum / 2);
        updates.centralTax = String(taxNum);
      } else {
        updates.localTax1 = "";
        updates.localTax2 = "";
        updates.centralTax = "";
      }
    }

    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // --- fetch existing category when id is present ---
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getTaxCategoryById(id);

        if (res.success && res.data) {
          const raw = res.data;
          setFormData({
            Name: raw.Name ?? raw.name ?? "",
            type: raw.type ?? "goods",
            localTax1: raw.localTax1 != null ? String(raw.localTax1) : "",
            localTax2: raw.localTax2 != null ? String(raw.localTax2) : "",
            centralTax: raw.centralTax != null ? String(raw.centralTax) : "",
            isDefault: raw.isDefault === true ? "yes" : "no",
            remarks: raw.remarks ?? "",
          });
        } else {
          const errMsg = res.error?.message || "Failed to fetch category";
          toast.error(errMsg);
        }
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong while fetching the category");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // --- submit handler for add or update ---
  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    // basic validations (same as you had)
    const { Name, localTax1, localTax2, centralTax } = formData;
    const cgst = Number(localTax1) || 0;
    const sgst = Number(localTax2) || 0;
    const igst = Number(centralTax) || 0;

    if (!Name || String(Name).trim() === "") {
      toast.error("Please Enter Name");
      return;
    }
    if (cgst > 0 && sgst === 0) {
      toast.error("Please Enter SGST Value");
      return;
    }
    if (sgst > 0 && cgst === 0) {
      toast.error("Please Enter CGST Value");
      return;
    }

    if (cgst < 0 || sgst < 0 || igst < 0) {
      toast.error("Value can't be negative");
      return;
    }
    if (cgst === 0 && sgst === 0 && igst === 0) {
      toast.error("Enter at least one tax value (CGST/SGST or IGST)");
      return;
    }

    // prepare payload - convert numeric strings to numbers
    const payload = {
      Name: String(formData.Name).trim(),
      type: formData.type,
      localTax1: cgst,
      localTax2: sgst,
      centralTax: igst,
      cessTax: 0,
      taxOnMRP: "no",
      isDefault: formData.isDefault === "yes", 
      remarks: formData.remarks || "",
    };

    try {
      setSubmitting(true);
      if (id) {
        const res = await editTaxCategory(id, payload);
        if (res && res.success) {
          toast.success(res.data?.message || "Tax Category updated!");
          navigate("/masters/billandothermaster/taxcategory");
        } else {
          toast.error(res.error?.message || "Failed to update Tax Category.");
        }
      } else {
        // create flow
        const res = await addTaxCategory(payload);
        if (res && res.success) {
          toast.success(
            res.data?.message || "Tax Category saved successfully!"
          );
          // reset
          setFormData({
            Name: "",
            type: "goods",
            localTax1: "",
            localTax2: "",
            centralTax: "",
            remarks: "",
          });
          navigate("/masters/billandothermaster/taxcategory");
        } else {
          toast.error(res.error?.message || "Failed to save Tax Category.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5">
  
      <h2 className="text-xl font-semibold mb-4 text-gray-700">
        {id ? "Edit Tax Category" : "Add Tax Category"}
      </h2>

      <div className="bg-white shadow-md rounded-xl p-6 border border-slate-200">
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={handleSubmit}
        >
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Category Name
            </label>
            <input
              type="text"
              name="Name"
              value={formData.Name}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="Ex: GST @12%"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-gray-600">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
            >
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
          </div>

          {/* Local Tax 1 (CGST) */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Local Tax 1 (CGST %)
            </label>
            <input
              type="text"
              inputMode="decimal"
              name="localTax1"
              value={formData.localTax1}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="0"
            />
          </div>

          {/* Local Tax 2 (SGST) */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Local Tax 2 (SGST %)
            </label>
            <input
              type="text"
              inputMode="decimal"
              name="localTax2"
              value={formData.localTax2}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="0"
            />
          </div>

          {/* Central Tax (IGST) */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Central Tax (IGST %)
            </label>
            <input
              type="text"
              inputMode="decimal"
              name="centralTax"
              value={formData.centralTax}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="0"
            />
          </div>


          {/* Default Category */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Default Tax
            </label>
            <select
              name="isDefault"
              value={formData.isDefault}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          {/* Remarks */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-600">Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg h-24 outline-none border-slate-300 focus:border-blue-500"
              placeholder="Remarks (optional)"
            />
          </div>

          {/* Submit Button */}
          <div className="md:col-span-2 flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {id
                ? submitting
                  ? "Updating..."
                  : "Update Category"
                : submitting
                ? "Saving..."
                : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTaxCategory;
