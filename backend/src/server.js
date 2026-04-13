import 'dotenv/config';
import app from './app.js'
import './config/dbConfig/Db.js';
import config from './config/env.js';
import cron from 'node-cron';
import { runSubscriptionJobs } from './jobs/subscriptionJobs.js';
import authRoutes from './routes/auth.routes.js'
import customerRoutes from './routes/customer.routes.js'
import groupRoutes from './routes/group.routes.js'
import itemRoutes from './routes/item.routes.js'
import lensGroupCreation from './routes/LensGroupCreation.routes.js'
import lensRate from './routes/LensRate.routes.js'
import AccountGroup from './routes/AccountGroup.routes.js'
import Account from './routes/Account.routes.js'
import TaxCategory from './routes/TaxCategory.routes.js'
import LensPurchase from './routes/LensPurchase.routes.js'
import LensPurchaseOrder from './routes/LensPurchaseOrder.routes.js'
import LensSale from './routes/LensSale.routes.js'

import LensSaleOrder from './routes/LensSaleOrder.routes.js'
import LensSaleChallan from './routes/LensSaleChallan.routes.js'
import LensPurchaseChallan from './routes/LensPurchaseChallan.routes.js'
import SaleReturn from './routes/SaleReturn.routes.js';
import PurchaseReturn from './routes/PurchaseReturn.routes.js'
import RxPurchase from './routes/RxPurchase.routes.js'
import RxSale from './routes/RxSale.routes.js'

import RxSaleReturn from './routes/RxSaleReturn.routes.js';
import RxPurchaseReturn from "./routes/RxPurchaseReturn.routes.js"
import Active from "./routes/Active.routes.js"
import Ledger from "./routes/Ledger.routes.js"
import Outstanding from "./routes/Outstanding.routes.js"
import reportsRoutes from "./routes/reports.routes.js"
import deletedLogRoutes from "./routes/deletedLog.routes.js"
import inventoryRoutes from "./routes/inventory.routes.js"
import RxSaleOrder from "./routes/RxSaleOrder.routes.js"
import RxPurchaseOrder from "./routes/RxPurchaseOrder.routes.js"
import ContactLensSaleOrder from "./routes/ContactLensSaleOrder.routes.js"
import ContactLensPurchaseOrder from "./routes/ContactLensPurchaseOrder.routes.js"
import accountWisePrice from "./routes/accountWisePrice.routes.js"
import offerRoutes from "./routes/offer.routes.js"
import lensLocationRoutes from "./routes/LensLocationStock.routes.js"
import productExchangeRoutes from "./routes/ProductExchange.routes.js"
import voucherRoutes from "./routes/Voucher.routes.js"
import damageEntryRoutes from "./routes/DamageEntry.routes.js"
import barcodeRoutes from "./routes/barcode.routes.js"
import productPowerGroupPricingRoutes from "./routes/productPowerGroupPricing.routes.js"
import mobileOrderRoutes from "./routes/mobileOrder.routes.js"
import deliveryRoutes from "./routes/delivery.routes.js"
import customerWhitelistRoutes from "./routes/customerWhitelist.routes.js"

import shortcutKeyRoutes from './routes/ShortcutKey.routes.js'
import backupRoutes from './routes/Backup.routes.js'
import superAdminRoutes from './routes/superAdmin.routes.js'
import suggestionRoutes from './routes/suggestion.routes.js'
import companyRoutes from './routes/Company.routes.js'
import analyticsRoutes from './routes/analytics.routes.js'

import { startAutoInvoiceJob } from './jobs/autoInvoiceJob.js';

import { startReminderJob } from './jobs/reminderJob.js';
import { startBackupJobs } from './jobs/backupJob.js';

// Health check route
app.get('/', (req, res) => {
    res.json({ message: "Server is working fine" });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/lens', lensGroupCreation)
app.use('/api/lensRate', lensRate)
app.use('/api/account-groups', AccountGroup)
app.use('/api/accounts', Account)
app.use('/api/tax', TaxCategory)
app.use('/api/lensPurchase', LensPurchase)
app.use('/api/lensPurchaseOrder', LensPurchaseOrder)
app.use('/api/lensPurchaseChallan', LensPurchaseChallan)
app.use('/api/lensSale', LensSale)
app.use('/api/lensSaleOrder', LensSaleOrder)
app.use('/api/lensSaleChallan', LensSaleChallan)
app.use('/api/SaleReturn', SaleReturn)
app.use('/api/PurchaseReturn', PurchaseReturn)
app.use('/api/rxPurchase', RxPurchase)
app.use('/api/rxSale', RxSale)
app.use('/api/rxSaleReturn', RxSaleReturn)
app.use('/api/rxPurchaseReturn', RxPurchaseReturn)
app.use('/api/rxSaleOrder', RxSaleOrder)
app.use('/api/rxPurchaseOrder', RxPurchaseOrder)
app.use('/api/active', Active)
app.use('/api/ledger', Ledger)
app.use('/api/outstanding', Outstanding)
app.use('/api/reports', reportsRoutes)
app.use('/api/deleted-logs', deletedLogRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/contactLensSaleOrder', ContactLensSaleOrder)
app.use('/api/contactLensPurchaseOrder', ContactLensPurchaseOrder)
app.use('/api/accountWisePrice', accountWisePrice)
app.use('/api/offers', offerRoutes)
app.use('/api/lensLocation', lensLocationRoutes)
app.use('/api/productExchange', productExchangeRoutes)
app.use('/api/vouchers', voucherRoutes)
app.use('/api/damageEntry', damageEntryRoutes)
app.use('/api/barcodes', barcodeRoutes)
app.use('/api/productPowerGroupPricing', productPowerGroupPricingRoutes)
app.use('/api/mobile/orders', mobileOrderRoutes)
app.use('/api/delivery', deliveryRoutes)
app.use('/api/customers', customerWhitelistRoutes)
app.use('/api/shortcuts', shortcutKeyRoutes)
app.use('/api/backups', backupRoutes)
app.use('/api/super-admin', superAdminRoutes)
app.use('/api/suggestions', suggestionRoutes)
app.use('/api/company', companyRoutes)
app.use('/api/analytics', analyticsRoutes)


// Start server
const PORT = config.PORT;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startAutoInvoiceJob();
    startReminderJob();
    startBackupJobs();

    // Daily subscription sweep at 1 AM
    cron.schedule('0 1 * * *', runSubscriptionJobs);
});
