import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import {
  addVendor,
  getVendorById,
  editVendor,
} from "../controllers/Vendor.controller";

function AddVendor() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    gstNo: "",
    remark: "",
    tags: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();

  /* ---------------- handle change ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* ---------------- fetch vendor (edit mode) ---------------- */
  useEffect(() => {
    if (!id) return;

    const fetchVendor = async () => {
      try {
        setLoading(true);
        const res = await getVendorById(id);

        if (res?.success && res.data) {
          const v = res.data;
          setFormData({
            name: v.name ?? "",
            email: v.email ?? "",
            phone: v.phone ?? "",
            address: v.address ?? "",
            gstNo: v.gstNo ?? "",
            remark: v.remark ?? "",
            tags: Array.isArray(v.tags) ? v.tags.join(", ") : "",
          });
        } else {
          toast.error("Failed to fetch vendor");
        }
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [id]);

  /* ---------------- submit handler ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }

    const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const phoneRegex =
  /^[6-9]\d{9}$/; // Indian mobile numbers

const gstRegex =
  /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i;
const email = formData.email.trim();
const phone = formData.phone.trim();
const gstNo = formData.gstNo.trim().toUpperCase();

if (email && !emailRegex.test(email)) {
  toast.error("Invalid email address");
  return;
}

if (phone && !phoneRegex.test(phone)) {
  toast.error("Invalid mobile number (10 digits, starts with 6-9)");
  return;
}

if (gstNo && !gstRegex.test(gstNo)) {
  toast.error("Invalid GST number");
  return;
}


    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      gstNo: formData.gstNo.trim(),
      remark: formData.remark.trim(),
      tags: formData.tags
        ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    };

    try {
      setSubmitting(true);

      if (id) {
        const res = await editVendor(id, payload);
        if (res?.success) {
          toast.success("Vendor updated successfully");
          navigate("/masters/vendors");
        } else {
          toast.error("Failed to update vendor");
        }
      } else {
        const res = await addVendor(payload);
        if (res?.success) {
          toast.success("Vendor added successfully");
          navigate("/masters/vendors");
        } else {
          toast.error("Failed to add vendor");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="p-5">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">
        {id ? "Edit Vendor" : "Add Vendor"}
      </h2>

      <div className="bg-white shadow-md rounded-xl p-6 border border-slate-200">
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={handleSubmit}
        >
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Vendor Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="Vendor name"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-gray-600">
              Mobile Number
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="9876543210"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-gray-600">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="vendor@email.com"
            />
          </div>

          {/* GST */}
          <div>
            <label className="text-sm font-medium text-gray-600">GST No</label>
            <input
              type="text"
              name="gstNo"
              value={formData.gstNo}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="27AAAAA0000A1Z5"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-600">Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="Vendor address"
            />
          </div>

          {/* Tags */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-600">
              Tags (comma separated)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="wholesale, local, premium"
            />
          </div>

          {/* Remark */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-600">Remark</label>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              className="w-full mt-1 px-3 py-2 border rounded-lg outline-none border-slate-300 focus:border-blue-500"
              placeholder="Remarks (optional)"
            />
          </div>

          {/* Submit */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {id
                ? submitting
                  ? "Updating..."
                  : "Update Vendor"
                : submitting
                ? "Saving..."
                : "Save Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddVendor;
