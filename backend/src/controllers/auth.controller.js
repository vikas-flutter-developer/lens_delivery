import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import config from '../config/env.js';
import { sendOTPEmail } from '../utils/emailService.js';
import crypto from 'crypto';

const JWT_SECRET = config.JWT_SECRET;

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email, role: req.body.role });
    console.log("JWT_SECRET available:", !!JWT_SECRET);

    const user = await User.findOne({ email }).populate('companyId');
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Role validation (handling Super Admin display name)
    const requestedRole = req.body.role?.toLowerCase().replace(' ', '_');
    if (user.role !== requestedRole) {
       return res.status(400).json({ message: `Access denied. You are not registered as ${req.body.role}` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    user.lastLogin = new Date();
    user.loginHistory.push(new Date());
    await user.save();

    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId?._id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });

    // Set JWT in HTTP-only cookie
    res.cookie('jwt', token, {
      httpOnly: true, // Prevents JavaScript access
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId?._id,
        company: user.companyId ? {
            name: user.companyId.name,
            subscriptionStatus: user.companyId.subscriptionStatus,
            planExpiryDate: user.companyId.planExpiryDate,
            gracePeriodEndDate: user.companyId.gracePeriodEndDate
        } : null,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Login bug:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role, companyId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      companyId: companyId || null,
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserData = async (req, res) => {
  try {
    const response = await User.find()
      .select("name email lastLogin _id role companyId")
      .sort({ lastLogin: -1 });
    res.json({ response })
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const changePassword = async (req, res) => {
  const { id, newPassword } = req.body;

  try {
    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password should be at least 6 characters long" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password cannot be the same as the old password" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email not registered in the system." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    const emailResult = await sendOTPEmail(user.email, otp);
    if (!emailResult.success) {
      return res.status(500).json({ message: "Error sending email. Please try again later." });
    }

    res.json({ message: "OTP sent to your registered email ID." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ 
      email, 
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please try again." });
    }

    // Return a short-lived token for password reset
    const resetToken = jwt.sign({ id: user._id, type: 'reset' }, JWT_SECRET, { expiresIn: '10m' });
    
    res.json({ message: "OTP verified successfully.", resetToken });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;
  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.type !== 'reset') {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    
    // Clear OTP fields
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(401).json({ message: "Token expired or invalid. Please request a new OTP." });
  }
};

export const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0), // Expire immediately
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.status(200).json({ message: 'Logged out successfully' });
};
export default {
  login,
  logout,
  createUser,
  getUserData,
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword
};