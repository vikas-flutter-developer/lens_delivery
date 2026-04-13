import React, { useState, useEffect, useRef } from "react";
import { Save, RotateCcw, Plus, Trash, Eye } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { getAllAccountGroups } from "../controllers/AccountGroupController";
import { useNavigate, useParams } from "react-router-dom";
import {
  addAccount,
  getAccountById,
  updateAccount,
  getNextAccountId,
} from "../controllers/Account.controller";
export default function AddAccount() {
  const initialState = {
    Name: "",
    Alias: "",
    PrintName: "",
    AccountId: "",
    Group: [""],
    Station: [""],
    AccountDealerType: "",
    GSTIN: "",
    Transporter: "",
    ContactPerson: "",
    OpeningBalance_balance: 0,
    OpeningBalance_type: "Dr",
    PreviousYearBalance_balance: 0,
    PreviousYearBalance_type: "Dr",
    CreditLimit: 0,
    EnableLoyality: "Y",
    AccountCategory: "",
    CardNumber: "",
    Address: "",
    Addresses: [],
    State: "",
    Email: "",
    TelNumber: "",
    MobileNumber: "",
    Pincode: "",
    Distance: "",
    ItPlan: "",
    LstNumber: "",
    CstNumber: "",
    AdharCardNumber: "",
    Dnd: "",
    Ex1: "",
    DayLimit: "",
    AccountType: "",
    Password: "",
    Remark: "",
    Tags: "",
  };
  const { id } = useParams(); // optional - edit mode when id exists
  const navigate = useNavigate();

  // fetched groups from backend
  const [accountGroups, setAccountGroups] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getAllAccountGroups();
        // res might be array or wrapped; accept both common shapes
        if (Array.isArray(res)) setAccountGroups(res);
        else if (res?.groups) setAccountGroups(res.groups);
        else setAccountGroups(res?.data || []);
      } catch (err) {
        console.error("Failed to load account groups", err);
        setAccountGroups([]);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!id) {
      const fetchNextId = async () => {
        try {
          const res = await getNextAccountId();
          if (res?.success) {
            setForm((p) => ({ ...p, AccountId: res.nextAccountId }));
          }
        } catch (err) {
          console.error("Failed to fetch next account ID", err);
        }
      };
      fetchNextId();
    }
  }, [id]);

  const [form, setForm] = useState(initialState);
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        const res = await getAccountById(id);

        if (!res?.success) {
          toast.error("Failed to load data!");
          return;
        }

        const data = res.account; // <-- yahi actual object hai

        setForm({
          Name: data.Name || "",
          Alias: data.Alias || "",
          PrintName: data.PrintName || "",
          AccountId: data.AccountId || "",
          Group: data.Groups || [""],
          Station: data.Stations || [""],
          AccountDealerType: data.AccountDealerType || "",
          GSTIN: data.GSTIN || "",
          Transporter: data.Transporter || "",
          ContactPerson: data.ContactPerson || "",

          OpeningBalance_balance: data.OpeningBalance?.balance ?? 0,
          OpeningBalance_type: data.OpeningBalance?.type ?? "Dr",

          PreviousYearBalance_balance: data.PreviousYearBalance?.balance ?? 0,
          PreviousYearBalance_type: data.PreviousYearBalance?.type ?? "Dr",

          CreditLimit: data.CreditLimit ?? 0,
          EnableLoyality: data.EnableLoyality || "Y",
          AccountCategory: data.AccountCategory || "",

          CardNumber: data.CardNumber || "",
          Address: data.Address || "",
          Addresses: data.Addresses || [],
          State: data.State || "",
          Email: data.Email || "",
          TelNumber: data.TelNumber || "",
          MobileNumber: data.MobileNumber || "",
          Pincode: data.Pincode || "",
          Distance: data.Distance || "",
          ItPlan: data.ItPlan || "",
          LstNumber: data.LstNumber ?? "",
          CstNumber: data.CstNumber ?? "",
          AdharCardNumber: data.AdharCardNumber ?? "",
          Dnd: data.Dnd || "",
          Ex1: data.Ex1 || "",
          DayLimit: data.DayLimit || "",
          AccountType: data.AccountType || "",
          Password: data.Password || "",
          Remark: data.Remark || "",
          Tags: Array.isArray(data.Tags) ? data.Tags.join(", ") : "",
        });
      } catch (err) {
        console.log(err);
        toast.error("Error loading data!");
      }
    };

    fetchData();
  }, [id]);

  // ---------- AUTOCOMPLETE STATES ----------
  // current suggestions (for focused group input)
  const [suggestions, setSuggestions] = useState([]);
  // which group input's dropdown is open (-1 none)
  const [openSuggestionIndex, setOpenSuggestionIndex] = useState(-1);
  // for click outside
  const containerRef = useRef(null);

  // build list of group names from fetched accountGroups
  const groupNames = accountGroups
    .map(
      (g) =>
        (g.accountGroupName && String(g.accountGroupName)) ||
        (g.Name && String(g.Name)) ||
        (g.groupName && String(g.groupName)) ||
        (g.name && String(g.name)) ||
        ""
    )
    .filter(Boolean);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenSuggestionIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ----- helpers for simple fields -----
  const handleChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  // ----- Group dynamic fields (with autocomplete) -----
  const addGroupField = () => {
    setForm((p) => ({ ...p, Group: [...p.Group, ""] }));
    // open suggestions on newly added index (optional)
    const newIndex = form.Group.length;
    // small timeout to allow input to focus if you programmatically focus later
    setTimeout(() => {
      setOpenSuggestionIndex(newIndex);
    }, 50);
  };
  const removeGroupField = (idx) => {
    setForm((p) => {
      const arr = p.Group.filter((_, i) => i !== idx);
      return { ...p, Group: arr.length ? arr : [""] };
    });
    setOpenSuggestionIndex(-1);
  };
  const handleGroupChange = (idx, value) => {
    setForm((p) => {
      const arr = [...p.Group];
      arr[idx] = value;
      return { ...p, Group: arr };
    });

    // update suggestions based on typed value
    const q = value.trim().toLowerCase();
    if (q.length === 0) {
      setSuggestions([]);
      setOpenSuggestionIndex(-1);
      return;
    }

    const filtered = Array.from(
      new Set( // unique
        groupNames
          .filter((name) => name.toLowerCase().includes(q))
          // don't suggest exact same value if already present in other groups
          .filter((name) => !form.Group.includes(name))
      )
    ).slice(0, 10);

    setSuggestions(filtered);
    setOpenSuggestionIndex(idx);
  };

  const handleSelectSuggestion = (idx, name) => {
    // set the group input to selected name
    setForm((p) => {
      const arr = [...p.Group];
      arr[idx] = name;
      return { ...p, Group: arr };
    });
    setOpenSuggestionIndex(-1);
    setSuggestions([]);
  };

  // ----- Station dynamic fields -----
  const addStationField = () => {
    setForm((p) => ({ ...p, Station: [...p.Station, ""] }));
  };
  const removeStationField = (idx) => {
    setForm((p) => ({
      ...p,
      Station: p.Station.filter((_, i) => i !== idx) || [""],
    }));
  };

  // ----- Addresses dynamic fields -----
  const addAddressField = () => {
    setForm((p) => ({ ...p, Addresses: [...(p.Addresses || []), ""] }));
  };
  const removeAddressField = (idx) => {
    setForm((p) => ({
      ...p,
      Addresses: p.Addresses.filter((_, i) => i !== idx),
    }));
  };
  const handleAddressesChange = (idx, value) => {
    setForm((p) => {
      const arr = [...(p.Addresses || [])];
      arr[idx] = value;
      return { ...p, Addresses: arr };
    });
  };

  const handleReset = async () => {
    setForm(initialState);
    toast.success("Form reset");
    setOpenSuggestionIndex(-1);
    setSuggestions([]);
    
    // If adding a new account, refetch the next ID
    if (!id) {
      try {
        const res = await getNextAccountId();
        if (res?.success) {
          setForm((p) => ({ ...p, AccountId: res.nextAccountId }));
        }
      } catch (err) {
        console.error("Failed to refetch next account ID", err);
      }
    }
  };

  const validate = () => {
    if (!form.Name.trim()) return "Name is required";
    if (!form.PrintName.trim()) return "Print Name is required";
    if (!form.AccountId || String(form.AccountId).trim() === "")
      return "Enter Valid Account unique Id";
    // group must have at least one non-empty entry
    if (!form.Group.some((g) => g.trim()))
      return "At least one Group is required";
    if (!form.Station.some((s) => s.trim()))
      return "At least one Station is required";
    if (!form.State.trim()) return "State is required";
    const allowedDealerTypes = [
      "Registerd",
      "unregisterd",
      "composition",
      "uin holder",
    ];
    if (
      !form.AccountDealerType ||
      !allowedDealerTypes.includes(form.AccountDealerType)
    ) {
      return "Please select a valid Account Dealer Type";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile numbers
    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i;

    if (form.Email.trim() && !emailRegex.test(form.Email.trim())) {
      return "Invalid email address";
    }
    if (form.MobileNumber.trim() && !phoneRegex.test(form.MobileNumber.trim())) {
      return "Invalid mobile number (10 digits, starts with 6-9)";
    }
    if (form.GSTIN.trim() && !gstRegex.test(form.GSTIN.trim())) {
      return "Invalid GST number";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    // front-end validations
    const err = validate();
    if (err) {
      toast.error(err); // front-end validation toast
      return;
    }

    // build payload exactly as backend expects
    const payload = {
      Name: form.Name,
      Alias: form.Alias,
      PrintName: form.PrintName,
      AccountId: form.AccountId,
      Groups: form.Group.map((s) => s.trim()).filter(Boolean),
      Stations: form.Station.map((s) => s.trim()).filter(Boolean),
      AccountDealerType: form.AccountDealerType,
      GSTIN: form.GSTIN,
      Transporter: form.Transporter,
      ContactPerson: form.ContactPerson,
      OpeningBalance: {
        balance: Number(form.OpeningBalance_balance) || 0,
        type: form.OpeningBalance_type,
      },
      PreviousYearBalance: {
        balance: Number(form.PreviousYearBalance_balance) || 0,
        type: form.PreviousYearBalance_type,
      },
      CreditLimit: Number(form.CreditLimit) || 0,
      EnableLoyality: form.EnableLoyality,
      AccountCategory:
        typeof form.AccountCategory === "string" ? form.AccountCategory : "",

      CardNumber: form.CardNumber,
      Address: form.Address,
      Addresses: (form.Addresses || []).map((a) => a.trim()).filter(Boolean),
      State: form.State,
      Email: form.Email,
      TelNumber: form.TelNumber,
      MobileNumber: form.MobileNumber,
      Pincode: form.Pincode,
      Distance: form.Distance,
      ItPlan: form.ItPlan,
      LstNumber: form.LstNumber ? Number(form.LstNumber) : 0,
      CstNumber: form.CstNumber ? Number(form.CstNumber) : 0,
      AdharCardNumber: form.AdharCardNumber ? Number(form.AdharCardNumber) : 0,
      Dnd: form.Dnd,
      Ex1: form.Ex1,
      DayLimit: form.DayLimit,
      AccountType: form.AccountType,
      Password: form.Password,
      Remark: form.Remark,
      Tags: form.Tags
        ? form.Tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    };

    try {
      let res;
      if (id) {
        // EDIT mode
        res = await updateAccount(id, payload);
      } else {
        // ADD mode
        console.log("addAccount called");
        res = await addAccount(payload);
      }

      // no response at all
      if (!res) {
        toast.error("Something went wrong!");
        return;
      }

      // backend says failure (e.g. duplicate)
      if (res.success === false) {
        // show backend's message if provided otherwise generic "Already exists!"
        toast.error(res.message || "Already exists!");
        return;
      }

      // success
      if (res.success === true) {
        toast.success(
          id ? "Account updated successfully!" : "Account created successfully!"
        );
        // navigate back to list (adjust path if you use different route)
        setTimeout(() => {
          navigate("/masters/accountmaster/accountmaster");
        }, 450);
        return;
      }

      // unexpected response shape
      toast.error("Something went wrong!");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Something went wrong!");
    }
  };

  const categories = [
    "default",
    "category1",
    "category2",
    "category3",
    "category4",
    "category5",
  ];

  const mumbaiStations = [
    // Western Line
    "Churchgate",
    "Marine Lines",
    "Charni Road",
    "Grant Road",
    "Mumbai Central",
    "Mahalaxmi",
    "Lower Parel",
    "Prabhadevi",
    "Dadar",
    "Matunga Road",
    "Mahim",
    "Bandra",
    "Khar Road",
    "Santacruz",
    "Vile Parle",
    "Andheri",
    "Jogeshwari",
    "Goregaon",
    "Malad",
    "Kandivali",
    "Borivali",
    "Dahisar",
    "Mira Road",
    "Bhayandar",
    "Naigaon",
    "Vasai Road",
    "Nala Sopara",
    "Virar",
    // Central Line
    "Chhatrapati Shivaji Maharaj Terminus (CST)",
    "Masjid",
    "Sandhurst Road",
    "Byculla",
    "Currey Road",
    "Parel",
    "Dadar",
    "Matunga",
    "Sion",
    "Kurla",
    "Vidyavihar",
    "Ghatkopar",
    "Vikhroli",
    "Kanjurmarg",
    "Bhandup",
    "Mulund",
    "Thane",
    "Kalwa",
    "Mumbra",
    "Diva",
    "Belapur",
    "Panvel",
    // Harbour Line (subset)
    "CST",
    "Masjid",
    "Dockyard Road",
    "Reay Road",
    "Cotton Green",
    "Seepz",
    "Kurla",
    "Chembur",
    "Govandi",
    "Mankhurd",
    "Vashi",
    "Sanpada",
    "Belapur",
    "Kharghar",
    "Panvel",
  ];

  const [stationSuggestions, setStationSuggestions] = useState([]);
  const [openStationIndex, setOpenStationIndex] = useState(-1);
  const [showPassword, setShowPassword] = useState(false);

  const handleStationChange = (idx, value) => {
    setForm((p) => {
      const arr = [...p.Station];
      arr[idx] = value;
      return { ...p, Station: arr };
    });

    // Update suggestions
    const q = value.trim().toLowerCase();
    if (!q) {
      setStationSuggestions([]);
      setOpenStationIndex(-1);
      return;
    }

    const filtered = Array.from(
      new Set(
        mumbaiStations
          .filter((name) => name.toLowerCase().includes(q))
          .filter((name) => !form.Station.includes(name)) // prevent duplicates
      )
    ).slice(0, 10); // limit suggestions

    setStationSuggestions(filtered);
    setOpenStationIndex(idx);
  };

  const handleSelectStation = (idx, name) => {
    setForm((p) => {
      const arr = [...p.Station];
      arr[idx] = name;
      return { ...p, Station: arr };
    });
    setStationSuggestions([]);
    setOpenStationIndex(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto" ref={containerRef}>
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Add Account</h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6"
        >
          {/* Basic Info */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.Name}
                  onChange={(e) => handleChange("Name", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Account name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Print Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.PrintName}
                  onChange={(e) => handleChange("PrintName", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Print name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Id<span className="text-red-500">*</span>
                </label>
                <input
                  value={form.AccountId}
                  onChange={(e) => handleChange("AccountId", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Account Unique Id"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alias
                </label>
                <input
                  value={form.Alias}
                  onChange={(e) => handleChange("Alias", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Alias (optional)"
                />
              </div>
            </div>
          </section>

          {/* Group (dynamic) */}
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Groups{" "}
              <span className="text-xs text-slate-400 ml-2">
                add one or more
              </span>
            </h3>

            <div className="space-y-2">
              {form.Group.map((g, idx) => (
                <div key={`group-${idx}`} className="relative">
                  <div className="flex items-center gap-2">
                    <input
                      value={g}
                      onChange={(e) => handleGroupChange(idx, e.target.value)}
                      onFocus={() => {
                        // open suggestions for this input if there's text
                        const q = (form.Group[idx] || "").trim();
                        if (q.length > 0) {
                          const filtered = Array.from(
                            new Set(
                              groupNames
                                .filter((name) =>
                                  name.toLowerCase().includes(q.toLowerCase())
                                )
                                .filter((name) => !form.Group.includes(name))
                            )
                          ).slice(0, 10);
                          setSuggestions(filtered);
                          setOpenSuggestionIndex(idx);
                        }
                      }}
                      className="flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Group ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeGroupField(idx)}
                      className="px-2 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                      aria-label="Remove group"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Suggestions dropdown for this input */}
                  {openSuggestionIndex === idx && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-40 mt-1 bg-white border border-slate-200 rounded-md shadow-sm max-h-40 overflow-auto">
                      {suggestions.map((name, i) => (
                        <div
                          key={`${name}-${i}`}
                          onMouseDown={() => handleSelectSuggestion(idx, name)}
                          className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={addGroupField}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" /> Add Group
                </button>
              </div>
            </div>
          </section>

          {/* Station (dynamic) */}
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Stations{" "}
              <span className="text-xs text-slate-400 ml-2">
                add one or more
              </span>
            </h3>

            <div className="space-y-2">
              {form.Station.map((s, idx) => (
                <div key={idx} className="relative">
                  <input
                    value={s}
                    onChange={(e) => handleStationChange(idx, e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Station ${idx + 1}`}
                  />
                  {openStationIndex === idx &&
                    stationSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 z-40 mt-1 bg-white border rounded-md shadow max-h-40 overflow-auto">
                        {stationSuggestions.map((name, i) => (
                          <div
                            key={`${name}-${i}`}
                            onMouseDown={() => handleSelectStation(idx, name)}
                            className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer"
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={addStationField}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" /> Add Station
                </button>
              </div>
            </div>
          </section>

          {/* Contact & Identifiers (condensed) */}
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Contact & IDs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  value={form.ContactPerson}
                  onChange={(e) =>
                    handleChange("ContactPerson", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  value={form.MobileNumber}
                  onChange={(e) => handleChange("MobileNumber", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  value={form.Email}
                  onChange={(e) => handleChange("Email", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Account Type Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Type
                </label>
                <select
                  value={form.AccountType}
                  onChange={(e) => handleChange("AccountType", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="Sale">Sale</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              {/* Password - Visible if Sale (or always, but highlighted for Sale) */}
              {form.AccountType === "Sale" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.Password}
                      onChange={(e) => handleChange("Password", e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="App Login Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-blue-500"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Newly added fields */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Dealer Type <span className="text-red-500">*</span>
                </label>

                <select
                  value={form.AccountDealerType}
                  onChange={(e) =>
                    handleChange("AccountDealerType", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select dealer type</option>
                  <option value="Registerd">Registerd</option>
                  <option value="unregisterd">unregisterd</option>
                  <option value="composition">composition</option>
                  <option value="uin holder">uin holder</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  GSTIN
                </label>
                <input
                  value={form.GSTIN}
                  onChange={(e) => handleChange("GSTIN", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="GSTIN"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transporter
                </label>
                <input
                  value={form.Transporter}
                  onChange={(e) => handleChange("Transporter", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Transporter"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  IT Plan
                </label>
                <input
                  value={form.ItPlan}
                  onChange={(e) => handleChange("ItPlan", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="IT Plan"
                />
              </div>
            </div>
          </section>

          {/* Address & Location */}
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Address & Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-4">
                {/* Primary Address */}
                <div className="relative border border-slate-200 rounded-lg p-3 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
                  <label className="block text-xs font-semibold text-blue-600 mb-1">
                    Primary Address
                  </label>
                  <textarea
                    value={form.Address}
                    onChange={(e) => handleChange("Address", e.target.value)}
                    rows={3}
                    className="w-full text-sm outline-none focus:ring-0 resize-y bg-transparent"
                    placeholder="Main building or street address..."
                  />
                </div>

                {/* Additional Addresses */}
                {(form.Addresses || []).map((addr, idx) => (
                  <div key={idx} className="relative border border-slate-200 rounded-lg p-3 bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Additional Address {idx + 1}
                      </label>
                      <button
                        type="button"
                        onClick={() => removeAddressField(idx)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md transition-colors"
                        title="Remove address"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={addr}
                      onChange={(e) => handleAddressesChange(idx, e.target.value)}
                      rows={2}
                      className="w-full text-sm outline-none bg-transparent focus:ring-0 resize-y"
                      placeholder="Secondary or delivery address..."
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addAddressField}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Address
                </button>
              </div>

              {/* Remark */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Remark
                </label>
                <textarea
                  value={form.Remark}
                  onChange={(e) => handleChange("Remark", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes"
                />
              </div>

              {/* Tags */}
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  value={form.Tags}
                  onChange={(e) => handleChange("Tags", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. wholesale, local"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.State}
                  onChange={(e) => handleChange("State", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={form.Pincode}
                    onChange={(e) => handleChange("Pincode", e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pincode"
                  />
                  <input
                    value={form.Distance}
                    onChange={(e) => handleChange("Distance", e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Distance"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Balances & Financials */}
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Balances & Financials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Opening Balance
                </label>
                <input
                  type="number"
                  value={form.OpeningBalance_balance}
                  onChange={(e) =>
                    handleChange("OpeningBalance_balance", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Type
                </label>
                <select
                  value={form.OpeningBalance_type}
                  onChange={(e) =>
                    handleChange("OpeningBalance_type", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Dr">Dr</option>
                  <option value="Cr">Cr</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Previous Year Balance
                </label>
                <input
                  type="number"
                  value={form.PreviousYearBalance_balance}
                  onChange={(e) =>
                    handleChange("PreviousYearBalance_balance", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Type
                </label>
                <select
                  value={form.PreviousYearBalance_type}
                  onChange={(e) =>
                    handleChange("PreviousYearBalance_type", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Dr">Dr</option>
                  <option value="Cr">Cr</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Credit Limit
                </label>
                <input
                  type="number"
                  value={form.CreditLimit}
                  onChange={(e) => handleChange("CreditLimit", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Enable Loyality
                </label>
                <select
                  value={form.EnableLoyality}
                  onChange={(e) =>
                    handleChange("EnableLoyality", e.target.value)
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Day Limit
                </label>
                <input
                  value={form.DayLimit}
                  onChange={(e) => handleChange("DayLimit", e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          </section>
          
          {/* IDs & codes */}
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              IDs & Codes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                value={form.LstNumber}
                onChange={(e) => handleChange("LstNumber", e.target.value)}
                className="px-3 py-2 border rounded-md"
                placeholder="Lst Number"
              />
              <input
                value={form.CstNumber}
                onChange={(e) => handleChange("CstNumber", e.target.value)}
                className="px-3 py-2 border rounded-md"
                placeholder="Cst Number"
              />
              <input
                value={form.AdharCardNumber}
                onChange={(e) =>
                  handleChange("AdharCardNumber", e.target.value)
                }
                className="px-3 py-2 border rounded-md"
                placeholder="Aadhar Card Number"
              />
              <input
                value={form.Dnd}
                onChange={(e) => handleChange("Dnd", e.target.value)}
                className="px-3 py-2 border rounded-md"
                placeholder="DND"
              />
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-center items-center gap-3">
            <button
              type="submit"
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
            >
              <Save className="w-4 h-4" /> Save
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-md flex items-center gap-2 hover:bg-slate-200"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
