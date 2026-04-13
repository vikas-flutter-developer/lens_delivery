import React, { useState, useEffect } from "react";
import { useParams , useNavigate } from "react-router-dom";
import { Save, RotateCcw } from "lucide-react";
import {
  addAccountGroup,
  getAccountGroupById,
  updateAccountGroup,
} from "../controllers/AccountGroupController";
import { Toaster, toast } from "react-hot-toast";

function AddAccountGroup() {
  const { id } = useParams(); // id present → edit, id missing → add
    const navigate = useNavigate();
  const [formData, setFormData] = useState({
    accountGroupName: "",
    primaryGroup: "Y",
    LedgerGroup: "",
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ----------------------------------------
  // SUBMIT HANDLER (ADD + UPDATE BOTH)
  // ----------------------------------------
  const handleSubmit = async () => {
  try {
    if (
      !formData.accountGroupName ||
      !formData.primaryGroup ||
      !formData.LedgerGroup
    ) {
      toast.error("Please fill all required fields!");
      return;
    }

    let res;

    if (id) {
      // EDIT MODE
      res = await updateAccountGroup(id, formData);
    } else {
      // ADD MODE
      res = await addAccountGroup(formData);
    }

    if (!res) {
      toast.error("Something went wrong!");
      return;
    }

    if (res.success === false) {
      toast.error(res.message || "Already exists!");
      return;
    }

    if (res.success === true) {
      toast.success(
        id
          ? "Account Group Updated Successfully!"
          : "Account Group Created Successfully!"
      );

      // Redirect after success
      setTimeout(() => {
    navigate("/masters/accountmaster/accountgroupmaster");
  }, 500);
      return;
    }

    toast.error("Unexpected response!");
  } catch (err) {
    toast.error("Something went wrong!");
    console.log(err);
  }
};

  // RESET FORM
  const handleReset = () => {
    setFormData({
      accountGroupName: "",
      primaryGroup: "Y",
      LedgerGroup: "",
    });
  };

  // ----------------------------------------
  // LOAD DATA IF IN EDIT MODE
  // ----------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return; // in ADD mode → skip loading

      try {
        const res = await getAccountGroupById(id);
        console.log(res);

        if (res?.success && res.group) {
          setFormData({
            accountGroupName: res.group.accountGroupName,
            primaryGroup: res.group.primaryGroup,
            LedgerGroup: res.group.LedgerGroup,
          });
        } else {
          toast.error("Failed to load data!");
        }
      } catch (err) {
        toast.error("Error loading data!");
      }
    };

    fetchData();
  }, [id]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      

      <div className="w-full">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            {id ? "Edit Account Group" : "Add Account Group Master"}
          </h1>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-6">
          {/* Group Information */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Group Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Group Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.accountGroupName}
                  onChange={(e) =>
                    handleInputChange("accountGroupName", e.target.value)
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Enter group name"
                />
              </div>

              {/* Primary Group */}
              <div>
                <label className="block ml-5 text-xs font-medium text-slate-700 mb-1.5">
                  Primary Group <span className="text-red-500">*</span>
                </label>

                <div className="ml-5 flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="primaryGroup"
                      value="Y"
                      checked={formData.primaryGroup === "Y"}
                      onChange={(e) =>
                        handleInputChange("primaryGroup", e.target.value)
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Yes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="primaryGroup"
                      value="N"
                      checked={formData.primaryGroup === "N"}
                      onChange={(e) =>
                        handleInputChange("primaryGroup", e.target.value)
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">No</span>
                  </label>
                </div>
              </div>

              {/* Ledger Group */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Ledger Group <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.LedgerGroup}
                  onChange={(e) =>
                    handleInputChange("LedgerGroup", e.target.value)
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Enter ledger group"
                />
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="mt-5 flex flex-col sm:flex-row justify-center items-center gap-4 mx-auto">
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                {id ? "Update Group" : "Save Group"}
              </button>

              <button
                onClick={handleReset}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddAccountGroup;
