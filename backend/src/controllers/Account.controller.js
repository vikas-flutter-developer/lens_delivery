import Account from "../models/Account.js";
import { logDeletion } from "../utils/logDeletion.js";
const addAccount = async (req, res) => {
  try {
    const { companyId } = req.user;
    const {
      Name,
      Alias = "",
      PrintName,
      AccountId,
      Groups,
      Stations,
      AccountDealerType,
      GSTIN = "",
      Transporter = "",
      ContactPerson = "",
      OpeningBalance,
      OpeningBalance_balance,
      OpeningBalance_type,
      PreviousYearBalance,
      PreviousYearBalance_balance,
      PreviousYearBalance_type,
      CreditLimit = 0,
      EnableLoyality = "Y",
      AccountCategory,
      CardNumber = "",
      Address = "",
      Addresses = [],
      State,
      Email = "",
      TelNumber = "",
      MobileNumber = "",
      Pincode = "",
      Distance = "",
      ItPlan = "",
      LstNumber = null,
      CstNumber = null,
      AdharCardNumber = null,
      Dnd = "",
      Ex1 = "",
      DayLimit = "",
      AccountType = "Both",
      Password = "",
      CreditDays = 0,
      Remark = "",
      Tags = [],
    } = req.body;
    // --- Basic validations (required fields) ---
    if (!Name || !String(Name).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    if (!PrintName || !String(PrintName).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "PrintName is required" });
    }
    if (!AccountId) {
      return res.status(400).json({
        success: false,
        message: "AccountId is required!",
      });
    }
    const allowedDealerTypes = [
      "Registerd",
      "unregisterd",
      "composition",
      "uin holder",
    ];
    if (!AccountDealerType || !allowedDealerTypes.includes(AccountDealerType)) {
      return res.status(400).json({
        success: false,
        message: `AccountDealerType is required and must be one of: ${allowedDealerTypes.join(
          ", "
        )}`,
      });
    }

    if (
      !Array.isArray(Groups) ||
      Groups.length === 0 ||
      !Groups.some((g) => String(g).trim())
    ) {
      return res
        .status(400)
        .json({ success: false, message: "At least one Group is required" });
    }
    if (
      !Array.isArray(Stations) ||
      Stations.length === 0 ||
      !Stations.some((s) => String(s).trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one Station is required",
      });
    }
    if (!State || !String(State).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "State is required" });
    }

    // normalize scalars
    const name = String(Name).trim();
    const printName = String(PrintName).trim();
    const groupsArr = (Groups || [])
      .map((g) => String(g || "").trim())
      .filter(Boolean);
    const stationsArr = (Stations || [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);

    const existingAccountId = await Account.findOne({ AccountId, companyId });

    if (existingAccountId) {
      return res.status(200).json({
        success: false,
        message: "Account ID already exists. Please use a unique ID.",
        existingAccount: existingAccountId?._id,
      });
    }

    // --- Build OpeningBalance / PreviousYearBalance robustly ---
    const openingBalanceObj = {
      balance:
        (OpeningBalance && typeof OpeningBalance.balance !== "undefined"
          ? Number(OpeningBalance.balance)
          : typeof OpeningBalance_balance !== "undefined"
            ? Number(OpeningBalance_balance)
            : 0) || 0,
      type:
        (OpeningBalance && OpeningBalance.type) || OpeningBalance_type || "Dr",
    };

    const prevYearBalanceObj = {
      balance:
        (PreviousYearBalance &&
          typeof PreviousYearBalance.balance !== "undefined"
          ? Number(PreviousYearBalance.balance)
          : typeof PreviousYearBalance_balance !== "undefined"
            ? Number(PreviousYearBalance_balance)
            : 0) || 0,
      type:
        (PreviousYearBalance && PreviousYearBalance.type) ||
        PreviousYearBalance_type ||
        "Dr",
    };

    const currentBalanceObj = {
      balance: 0,
      type: "Dr",
    };

    // --- Build account document ---
    const accountDoc = new Account({
      companyId,
      Name: name,
      Alias: String(Alias || "").trim(),
      PrintName: printName,
      AccountId: String(AccountId).trim(),
      Groups: groupsArr,
      Stations: stationsArr,
      AccountDealerType: String(AccountDealerType).trim(),
      GSTIN: String(GSTIN || "").trim(),
      Transporter: String(Transporter || "").trim(),
      ContactPerson: String(ContactPerson || "").trim(),
      OpeningBalance: openingBalanceObj,
      PreviousYearBalance: prevYearBalanceObj,
      CurrentBalance: currentBalanceObj,
      CreditLimit: Number(CreditLimit) || 0,
      EnableLoyality: EnableLoyality || "Y",
      AccountCategory:
        typeof AccountCategory === "string" && AccountCategory.trim()
          ? AccountCategory.trim()
          : "default",
      CardNumber: String(CardNumber || "").trim(),
      Address: String(Address || "").trim(),
      Addresses: Array.isArray(Addresses) ? Addresses.map(a => String(a).trim()).filter(Boolean) : [],
      State: String(State).trim(),
      Email: String(Email || "").trim(),
      TelNumber: String(TelNumber || "").trim(),
      MobileNumber: String(MobileNumber || "").trim(),
      Pincode: String(Pincode || "").trim(),
      Distance: String(Distance || "").trim(),
      ItPlan: String(ItPlan || "").trim(),
      LstNumber:
        LstNumber !== null && LstNumber !== ""
          ? Number(LstNumber) !== 0
            ? Number(LstNumber)
            : null
          : null,
      CstNumber:
        CstNumber !== null && CstNumber !== ""
          ? Number(CstNumber) !== 0
            ? Number(CstNumber)
            : null
          : null,
      AdharCardNumber:
        AdharCardNumber !== null && AdharCardNumber !== ""
          ? Number(AdharCardNumber) !== 0
            ? Number(AdharCardNumber)
            : null
          : null,
      Dnd: String(Dnd || "").trim(),
      Ex1: String(Ex1 || "").trim(),
      DayLimit: String(DayLimit || "").trim(),
      AccountType: String(AccountType || "Both").trim(),
      Password: String(Password || "").trim(),
      CreditDays: Number(CreditDays) || 0,
      Remark: String(Remark || "").trim(),
      Tags: Array.isArray(Tags) ? Tags : [],
    });

    // save
    await accountDoc.save();

    // success response (frontend expects res.success === true)
    return res.status(201).json({
      success: true,
      message: "Account added successfully!",
      account: accountDoc,
    });
  } catch (err) {
    console.error("addAccount error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong!",
    });
  }
};
const getAllAccounts = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { type } = req.query;
    const filter = { companyId };
    if (type) {
      filter.AccountType = type;
    }
    const accounts = await Account.find(filter);
    res.status(200).json(accounts);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error !!" });
  }
};

const getAccountById = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const account = await Account.findOne({ _id: id, companyId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Account fetched successfully",
      account,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
};
const updateAccount = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    // accept both nested and flat shapes from frontend
    const {
      Name,
      Alias = "",
      PrintName,
      AccountId,
      Groups,
      Stations,
      AccountDealerType,
      GSTIN = "",
      Transporter = "",
      ContactPerson,
      OpeningBalance,
      OpeningBalance_balance,
      OpeningBalance_type,
      PreviousYearBalance,
      PreviousYearBalance_balance,
      PreviousYearBalance_type,
      CreditLimit = 0,
      EnableLoyality = "Y",
      AccountCategory,
      CardNumber = "",
      Address = "",
      Addresses = [],
      State,
      Email = "",
      TelNumber = "",
      MobileNumber = "",
      Pincode = "",
      Distance = "",
      ItPlan = "",
      LstNumber = null,
      CstNumber = null,
      AdharCardNumber = null,
      Dnd = "",
      Ex1 = "",
      DayLimit = "",
      AccountType = "Both",
      Password = "",
      CreditDays = 0,
      Remark = "",
      Tags = [],
    } = req.body;

    const allowedDealerTypes = [
      "Registerd",
      "unregisterd",
      "composition",
      "uin holder",
    ];

    // --- Validate AccountDealerType ---
    if (!AccountDealerType || !allowedDealerTypes.includes(AccountDealerType)) {
      return res.status(400).json({
        success: false,
        message: `AccountDealerType is required and must be one of: ${allowedDealerTypes.join(
          ", "
        )}`,
      });
    }
    // --- basic validations (same as addAccount) ---
    if (!Name || !String(Name).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    if (!PrintName || !String(PrintName).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "PrintName is required" });
    }
    if (!AccountId && AccountId !== 0) {
      return res.status(400).json({
        success: false,
        message: "AccountId is required!",
      });
    }
    if (
      !Array.isArray(Groups) ||
      Groups.length === 0 ||
      !Groups.some((g) => String(g).trim())
    ) {
      return res
        .status(400)
        .json({ success: false, message: "At least one Group is required" });
    }
    if (
      !Array.isArray(Stations) ||
      Stations.length === 0 ||
      !Stations.some((s) => String(s).trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one Station is required",
      });
    }
    if (!State || !String(State).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "State is required" });
    }

    // normalize scalars
    const name = String(Name).trim();
    const printName = String(PrintName).trim();
    const groupsArr = (Groups || [])
      .map((g) => String(g || "").trim())
      .filter(Boolean);
    const stationsArr = (Stations || [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);

    // find existing account to update
    const account = await Account.findOne({ _id: id, companyId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found!",
      });
    }

    // check duplicate AccountId (exclude current doc)
    const existingAccountId = await Account.findOne({
      AccountId,
      companyId,
      _id: { $ne: id },
    });
    if (existingAccountId) {
      return res.status(200).json({
        success: false,
        message: "Account ID already exists. Please use a unique ID.",
        existingAccount: existingAccountId?._id,
      });
    }

    // Build OpeningBalance / PreviousYearBalance robustly (accept nested or flat)
    const openingBalanceObj = {
      balance:
        (OpeningBalance && typeof OpeningBalance.balance !== "undefined"
          ? Number(OpeningBalance.balance)
          : typeof OpeningBalance_balance !== "undefined"
            ? Number(OpeningBalance_balance)
            : 0) || 0,
      type:
        (OpeningBalance && OpeningBalance.type) || OpeningBalance_type || "Dr",
    };

    const prevYearBalanceObj = {
      balance:
        (PreviousYearBalance &&
          typeof PreviousYearBalance.balance !== "undefined"
          ? Number(PreviousYearBalance.balance)
          : typeof PreviousYearBalance_balance !== "undefined"
            ? Number(PreviousYearBalance_balance)
            : 0) || 0,
      type:
        (PreviousYearBalance && PreviousYearBalance.type) ||
        PreviousYearBalance_type ||
        "Dr",
    };

    // --- Update fields on found document ---
    account.Name = name;
    account.Alias = String(Alias || "").trim();
    account.PrintName = printName;
    account.AccountId = String(AccountId).trim();
    account.Groups = groupsArr;
    account.Stations = stationsArr;
    account.AccountDealerType = String(AccountDealerType).trim();
    account.GSTIN = String(GSTIN || "").trim();
    account.Transporter = String(Transporter || "").trim();
    account.ContactPerson = String(ContactPerson || "").trim();
    account.OpeningBalance = openingBalanceObj;
    account.PreviousYearBalance = prevYearBalanceObj;
    account.CurrentBalance = account.CurrentBalance;
    account.CreditLimit = Number(CreditLimit) || 0;
    account.EnableLoyality = EnableLoyality || "Y";
    account.AccountCategory =
      typeof AccountCategory === "string" && AccountCategory.trim()
        ? AccountCategory.trim()
        : account.AccountCategory || "default";
    account.CardNumber = String(CardNumber || "").trim();
    account.Address = String(Address || "").trim();
    account.Addresses = Array.isArray(Addresses) ? Addresses.map(a => String(a).trim()).filter(Boolean) : [];
    account.State = String(State).trim();
    account.Email = String(Email || "").trim();
    account.TelNumber = String(TelNumber || "").trim();
    account.MobileNumber = String(MobileNumber || "").trim();
    account.Pincode = String(Pincode || "").trim();
    account.Distance = String(Distance || "").trim();
    account.ItPlan = String(ItPlan || "").trim();

    account.LstNumber =
      LstNumber !== null && LstNumber !== ""
        ? Number(LstNumber) !== 0
          ? Number(LstNumber)
          : null
        : null;

    account.CstNumber =
      CstNumber !== null && CstNumber !== ""
        ? Number(CstNumber) !== 0
          ? Number(CstNumber)
          : null
        : null;

    account.AdharCardNumber =
      AdharCardNumber !== null && AdharCardNumber !== ""
        ? Number(AdharCardNumber) !== 0
          ? Number(AdharCardNumber)
          : null
        : null;

    account.Dnd = String(Dnd || "").trim();
    account.Ex1 = String(Ex1 || "").trim();
    account.DayLimit = String(DayLimit || "").trim();
    account.AccountType = String(AccountType || "Both").trim();
    account.Password = String(Password || "").trim();
    account.CreditDays = Number(CreditDays) || 0;
    account.Remark = String(Remark || "").trim();
    account.Tags = Array.isArray(Tags) ? Tags : [];

    // save updated doc
    await account.save();

    return res.status(200).json({
      success: true,
      message: "Account updated successfully!",
      account,
    });
  } catch (err) {
    console.error("updateAccount error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while updating the account!",
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const account = await Account.findOne({ _id: id, companyId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found!",
      });
    }
    await logDeletion({
      type: "account",
      name: account.Name,
      originalData: account
    });

    await Account.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Account Group deleted successfully!",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
};
const patchAccount = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    const account = await Account.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updates },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found!",
      });
    }

    return res.status(200).json({
      success: true,
      account,
    });
  } catch (err) {
    console.error("patchAccount error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong!",
    });
  }
};

const getNextAccountId = async (req, res) => {
  try {
    const { companyId } = req.user;

    // Fetch all AccountIds for the company
    const accounts = await Account.find({ companyId }).select("AccountId");

    let maxNum = 1000; // Default starting number if no numeric IDs found

    accounts.forEach((acc) => {
      // Try to extract the numeric part from the end of AccountId
      const match = String(acc.AccountId || "").match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextId = maxNum + 1;

    return res.status(200).json({
      success: true,
      nextAccountId: String(nextId),
    });
  } catch (err) {
    console.error("getNextAccountId error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate next Account ID",
    });
  }
};

export {
  addAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  patchAccount,
  getNextAccountId,
};
