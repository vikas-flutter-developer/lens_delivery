import Account from "../models/Account.js";
import jwt from "jsonwebtoken";
import config from "../config/env.js";

const JWT_SECRET = config.JWT_SECRET;

/**
 * Customer Registration
 * Creates a new sale party account
 */
export const registerCustomer = async (req, res) => {
  try {
    const {
      accountId,
      name,
      password,
      email,
      mobileNumber,
      address,
      state,
      gstin,
      dealerType
    } = req.body;

    // Validate mandatory fields
    if (!accountId || !name || !password || !state || !dealerType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: accountId, name, password, state, dealerType",
      });
    }

    // Check if accountId already exists
    const existingAccount = await Account.findOne({ AccountId: accountId });
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "Account ID already exists",
      });
    }

    // Create new account
    const newAccount = new Account({
      AccountId: accountId,
      Name: name,
      PrintName: name, // Default to Name
      Password: password,
      Email: email || "",
      MobileNumber: mobileNumber || "",
      Address: address || "",
      State: state,
      GSTIN: gstin || "",
      AccountDealerType: dealerType,
      AccountType: "Sale", // Explicitly set as Sale party
      Groups: [],
      Stations: [],
    });

    await newAccount.save();

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer: {
        id: newAccount._id,
        accountId: newAccount.AccountId,
        name: newAccount.Name,
      }
    });
  } catch (error) {
    console.error("Customer registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during registration",
      error: error.message
    });
  }
};

/**
 * Customer Login
 * Authenticates sale customers using AccountId and Password
 */
export const customerLogin = async (req, res) => {
  try {
    const { accountId, password } = req.body;
    console.log("Login attempt for AccountId:", accountId);

    // Validate inputs
    if (!accountId || !password) {
      return res.status(400).json({
        success: false,
        message: "Account ID and password are required",
      });
    }

    // Convert accountId to string and trim
    const accountIdStr = String(accountId).trim();

    // Find account by AccountId
    const account = await Account.findOne({ AccountId: accountIdStr });

    if (!account) {
      return res.status(400).json({
        success: false,
        message: "Invalid Account ID or password",
      });
    }

    // Check if account is a sale type account
    if (
      account.AccountType !== "Sale" &&
      account.AccountType !== "Both"
    ) {
      return res.status(403).json({
        success: false,
        message: "This account is not authorized for customer access",
      });
    }

    // Check password
    if (account.Password !== password) {
      return res.status(400).json({
        success: false,
        message: "Invalid Account ID or password",
      });
    }

    // Generate JWT token with account info
    const payload = {
      id: account._id,
      accountId: account.AccountId,
      name: account.Name,
      accountType: account.AccountType,
      type: "customer", // identifier for customer vs admin
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      customer: {
        id: account._id,
        accountId: account.AccountId,
        name: account.Name,
        email: account.Email,
        mobileNumber: account.MobileNumber,
        address: account.Address,
        state: account.State,
        creditLimit: account.CreditLimit,
        accountType: account.AccountType,
      },
    });
  } catch (error) {
    console.error("Customer login error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during login",
    });
  }
};

/**
 * Get Customer Profile
 * Returns the logged-in customer's information
 */
export const getCustomerProfile = async (req, res) => {
  try {
    // req.customer is set by the customerAuthMiddleware
    const customerId = req.customer?.id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const account = await Account.findById(customerId);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer: {
        id: account._id,
        accountId: account.AccountId,
        name: account.Name,
        alias: account.Alias,
        email: account.Email,
        mobileNumber: account.MobileNumber,
        address: account.Address,
        state: account.State,
        creditLimit: account.CreditLimit,
        enableLoyality: account.EnableLoyality,
        accountType: account.AccountType,
      },
    });
  } catch (error) {
    console.error("Get customer profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

/**
 * Update Customer Password
 * Allows customer to update their password
 */
export const updateCustomerPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const customerId = req.customer?.id;

    // Validate inputs
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password and new password are required",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 4 characters",
      });
    }

    const account = await Account.findById(customerId);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found",
      });
    }

    // Verify old password
    if (account.Password !== oldPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    account.Password = newPassword;
    await account.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
