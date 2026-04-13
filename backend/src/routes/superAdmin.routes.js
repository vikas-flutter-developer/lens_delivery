import express from 'express';
import SuperAdminController from '../controllers/superAdmin.controller.js';
import authMiddleware from '../middlewares/AuthMiddleware.js';
import { isSuperAdmin } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// All routes here are protected by Super Admin check
router.use(authMiddleware, isSuperAdmin);

router.get('/dashboard', SuperAdminController.getDashboardStats);

// Company management
router.get('/companies', SuperAdminController.getAllCompanies);
router.post('/companies', SuperAdminController.createCompany);
router.put('/companies/:id', SuperAdminController.updateCompany);
router.delete('/companies/:id', SuperAdminController.deleteCompany);

// User management
router.get('/users', SuperAdminController.getAllUsers);
router.post('/impersonate/:userId', SuperAdminController.impersonateUser);

// Plan management
router.get('/plans', SuperAdminController.getAllPlans);
router.post('/plans', SuperAdminController.createPlan);
router.put('/plans/:id', SuperAdminController.updatePlan);
router.delete('/plans/:id', SuperAdminController.deletePlan);

// Subscription & Payments
router.post('/assign-subscription', SuperAdminController.assignSubscription.bind(SuperAdminController));
router.get('/payments', SuperAdminController.getPaymentsHistory);
router.get('/payments/:id/invoice', SuperAdminController.getPaymentInvoice);

export default router;
