import express from 'express';
const router = express.Router();
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { isAdmin } from '../middlewares/roleMiddleware.js';

// Auth routes
router.post('/login', [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
], authController.login);

// Admin routes
router.post('/admin/create-user', 
  authMiddleware, 
  isAdmin,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role").isIn(["admin", "manager", "employee"]).withMessage("Invalid role"),
  ],
  authController.createUser
);

router.get('/admin/userdata', authMiddleware, isAdmin, authController.getUserData);

router.put('/admin/change-pass', authMiddleware, isAdmin, authController.changePassword);

// Logout route
router.post('/logout', authMiddleware, authController.logout);

// Forgot Password routes (Public)
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

export default router;