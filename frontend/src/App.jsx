import { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AlertTriangle, Clock } from "lucide-react";
import { AuthProvider, AuthContext } from "./AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import Navbar from "./Components/Navbar";
import GlobalLoader from "./Components/GlobalLoader";
import HomePlaceholder from "./Pages/Home";
import AccountGroupMaster from './Pages/AccountGroupMaster'
import CloseComapny from './Pages/CloseCompany'
import ModifyCompany from './Pages/ModifyCompany'
import AccountMaster from "./Pages/AccountMaster";

import AddVoucher from "./Pages/AddVoucher";
import useGlobalScroll from "./hooks/useGlobalScroll";

import VoucherEntry from "./Pages/VoucherEntry";
import RxOrder from "./Pages/RxOrder";
import LensGroupCreation from "./Pages/LensGroupCreation";
import SaleOrder from "./Pages/SaleOrder";
import SaleChallan from "./Pages/SaleChallan";
import SaleReturnVoucher from "./Pages/SaleReturn";
import LensPrice from "./Pages/LensPrice"

import LensSphCylWise from "./Pages/LensSphCylWise";
import DamageAndShrinkage from "./Pages/DamageAndShrinkage";
import AddDamageEntry from "./Pages/AddDamageEntry";
import ProductExchange from "./Pages/ProductExchange";
import AddProductExchange from "./Pages/AddProductExchange";
import ProductListForUpdate from "./Pages/ProductListForUpdate";
import Auth from "./Pages/Auth";
import AdminDashboard from "./Pages/AdminDashboard";

import AddAccountGroup from "./Pages/AddAccountGroup";
import AddAccount from "./Pages/AddAccount";
import ProductPriceAccountCategoryWise from "./Pages/ProductPriceAccountCategoryWise";
import LensPurchaseInvoice from "./Pages/LensPurchaseInvoice";
import AddLensPurchase from "./Pages/AddLensPurchase";
import TaxCategory from "./Pages/TaxCategory";
import AddTaxCategory from "./Pages/AddTaxCategory";
import LensSaleInvoice from "./Pages/LensSaleInvoice";
import AddLensSale from "./Pages/AddLensSale";
import AddLensSaleOrder from "./Pages/AddLensSaleOrder";
import AddLensSaleChallan from "./Pages/AddLensSaleChallan";
import PurchaseOrder from "./Pages/PurchaseOrder";
import AddLensPurchaseOrder from "./Pages/AddLensPurchaseOrder";
import PurchaseChallan from "./Pages/PurchaseChallan";
import AddLensPurchaseChallan from "./Pages/AddLensPurchaseChallan";
import AddSaleReturn from "./Pages/AddSaleReturn";
import PurchaseReturn from "./Pages/PurchaseReturn";
import AddPurchaseReturn from "./Pages/AddPurchaseReturn";
import AddRxOrder from "./Pages/AddRxOrder";
import RxPurchase from "./Pages/RxPurchase";
import AddRxPurchase from "./Pages/AddRxPurchase";
import AddRxPurchaseInvoice from "./Pages/AddRxPurchaseInvoice";
import AddRxSale from "./Pages/AddRxSale";
import AddRxSaleReturn from "./Pages/AddRxSaleReturn";
import AddRxPurchaseReturn from "./Pages/AddRxPurchaseReturn";
import LensAddMultipleItems from "./Pages/LensAddMultipleItems"
import Active from "./Pages/Active";
import AccountLedger from "./Pages/AccountLedger";
import AccountLedgerDetails from "./Pages/AccountLedgerDetails";
import Outstanding from "./Pages/Outstanding";
import LensStockReport from "./Pages/LensStockReport";
import PartyWiseItemReport from "./Pages/PartyWiseItemReport";
import InventoryMasterCreation from "./Pages/InventoryMasterCreation";
import LensMovementReport from "./Pages/LensMovementReport";
import DayBook from "./Pages/DayBook";
import CashBankBook from "./Pages/CashBankBook";
import ProfitAndLossCombined from "./Pages/ProfitAndLossCombined";
import TransactionSummary from "./Pages/TransactionSummary";
import TransactionDetailsCombined from "./Pages/TransactionDetailsCombined";
import BalanceSheet from "./Pages/BalanceSheet";
import CollectionReport from "./Pages/CollectionReport";
import DeletedDataReport from "./Pages/DeletedDataReport";
import ItemStockReorder from "./Pages/ItemStockReorder";
import SaleItemGroupWiseReport from "./Pages/SaleItemGroupWiseReport";
import CustomerAnalysis from "./Pages/CustomerAnalysis";
import DeliveryPersonActivityReport from "./Pages/DeliveryPersonActivityReport";
import BookedByReport from "./Pages/BookedByReport";
import VerifyLensStock from "./Pages/VerifyLensStock";
import VerifyBilling from "./Pages/VerifyBilling";
import AddContactLensSaleOrder from "./Pages/AddContactLensSaleOrder";
import AddContactLensPurchaseOrder from "./Pages/AddContactLensPurchaseOrder";
import OffersPage from "./Pages/OffersPage";
import LensLocation from "./Pages/LensLocation";
import LensRate from "./Pages/LensRate";
import PowerMovementReport from "./Pages/PowerMovementReport";
import SaleReturnRatioReport from "./Pages/SaleReturnRatioReport";
import SaleTargetReport from "./Pages/SaleTargetReport";
import CancelledOrderRatioReport from "./Pages/CancelledOrderRatioReport";
import OrderToChallanTimeReport from "./Pages/OrderToChallanTimeReport";
import CustomerVendorCollectionReport from "./Pages/CustomerVendorCollectionReport";
import CustomerItemSalesReport from "./Pages/CustomerItemSalesReport";
import ItemStockSummaryReport from "./Pages/ItemStockSummaryReport";
import SalesGrowthComparisonReport from "./Pages/SalesGrowthComparisonReport";
import ShortcutKeys from "./Pages/ShortcutKeys";
import ShortcutManager from "./Components/ShortcutManager";
import BackupAndRestore from "./Pages/BackupAndRestore";
import VerifyBankStatement from "./Pages/VerifyBankStatement";
import SuperAdminDashboard from "./Pages/SuperAdmin/SuperAdminDashboard";
import CompanyManagement from "./Pages/SuperAdmin/CompanyManagement";
import UserManagement from "./Pages/SuperAdmin/UserManagement";
import PlanManagement from "./Pages/SuperAdmin/PlanManagement";
import SystemSettings from "./Pages/SuperAdmin/SystemSettings";
import SubscriptionManagement from "./Pages/SuperAdmin/SubscriptionManagement";
import PaymentHistory from "./Pages/SuperAdmin/PaymentHistory";


function AppLayout() {
  const { user, stopImpersonating } = useContext(AuthContext);
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";

  // Enable global horizontal scroll via keyboard
  useGlobalScroll();

  // Public routes (Auth page)
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    );
  }

  // Protected routes
  return (
    <ProtectedRoute>
      <ShortcutManager />
      {user?.isImpersonated && (
        <div className="bg-amber-500 text-white px-4 py-2 flex justify-between items-center sticky top-0 z-[100] shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold">IMPERSONATING:</span>
            <span>{user.name} ({user.role})</span>
          </div>
          <button 
            onClick={stopImpersonating}
            className="bg-white text-amber-500 px-3 py-1 rounded-md text-sm font-bold hover:bg-amber-50 transition-colors"
          >
            Stop Impersonating
          </button>
        </div>
      )}

      {user?.role !== 'super_admin' && user?.company?.subscriptionStatus === 'expired' && (
        <div className="bg-rose-600 text-white px-4 py-3 text-center border-b border-rose-700 sticky top-0 z-[100] animate-pulse">
            <span className="font-bold flex items-center justify-center gap-2">
                <AlertTriangle size={18} />
                Your subscription has expired. Please contact support or renew to restore full access.
            </span>
        </div>
      )}

      {user?.role !== 'super_admin' && user?.company?.planExpiryDate && new Date(user.company.planExpiryDate) < new Date() && user.company.subscriptionStatus !== 'expired' && (
        <div className="bg-amber-100 text-amber-800 px-4 py-3 text-center border-b border-amber-200 indent-2 sticky top-0 z-[100]">
            <span className="text-sm font-bold flex items-center justify-center gap-2">
                <Clock size={16} />
                Subscription Grace Period: Your plan expired on {new Date(user.company.planExpiryDate).toLocaleDateString()}. Please renew soon.
            </span>
        </div>
      )}
      <div className="flex h-screen print:h-auto print:block print:overflow-visible text-slate-900">
        {/* Left Sidebar */}
        <div className="print:hidden">
          <Navbar />
        </div>
        {/* Right Content */}
        <div className={`flex-1 overflow-y-auto print:overflow-visible print:p-0 ${location.pathname.includes("/AddLensSale") || location.pathname.includes("/AddLensSaleOrder") || location.pathname.includes("/AddLensSaleChallan") || location.pathname.includes("/AddLensPurchase") || location.pathname.includes("/AddLensPurchaseOrder") || location.pathname.includes("/AddLensPurchaseChallan") || location.pathname.includes("/masters/inventorymaster/creation") ? "p-0" : "p-6"}`}>
          <Routes>
            {/* Root */}
            <Route path="/" element={user?.role === 'super_admin' ? <Navigate to="/super-admin/dashboard" replace /> : <HomePlaceholder />} />
            <Route path="/dashboard" element={user?.role === 'super_admin' ? <Navigate to="/super-admin/dashboard" replace /> : <HomePlaceholder />} />

            {/* Normal User Routes */}
            {user?.role !== 'super_admin' && (
              <>
                {/* Admin Dashboard */}
                <Route path="/AdminDashboard" element={<AdminDashboard />} />

                {/* Company */}
                <Route path="/company/modifycompany" element={<ModifyCompany />} />
                <Route path="/company/closecompany" element={<CloseComapny />} />
                <Route path="/active" element={<Active></Active>} />

                {/* Masters -> Account Master */}
                <Route path="/masters/accountmaster/accountgroupmaster" element={<AccountGroupMaster />} />
                <Route path="/add/accountgroupmaster/:id?" element={<AddAccountGroup />} />
                <Route path="/masters/accountmaster/accountmaster" element={<AccountMaster />} />
                <Route path="/add/accountmaster/:id?" element={<AddAccount />} />
                <Route path="/masters/accountmaster/transporter" element={<HomePlaceholder />} />

                {/* Masters -> Inventory Master */}
                <Route path="/masters/inventorymaster/creation" element={<InventoryMasterCreation />} />
                <Route path="/masters/inventorymaster/lensprice" element={<LensPrice />} />
                <Route path="/masters/inventorymaster/productpriceaccountcategorywise" element={<ProductPriceAccountCategoryWise />} />

                {/* Masters -> Bill & Other Master */}
                <Route path="/masters/billandothermaster/taxcategory" element={<TaxCategory />} />
                <Route path="/masters/billandothermaster/Addtaxcategory/:id?" element={<AddTaxCategory />} />



                {/* Transaction */}
                <Route path="/transaction/payrecptumicntr/addvoucher" element={<AddVoucher />} />
                <Route path="/transaction/payrecptumicntr/voucherentry/:id?" element={<VoucherEntry />} />

                {/* Rx Transaction Routes */}
                <Route path="/rxtransaction/rxorder/addrxorder/:id?" element={<AddRxOrder />} />
                <Route path="/rxtransaction/rxpurchase/addRxPurchase/:id?" element={<AddRxPurchase />} />
                <Route path="/rxtransaction/rxpurchase/addRxPurchaseInvoice/:id?" element={<AddRxPurchaseInvoice />} />
                <Route path="/rxtransaction/addrxpurchasereturn/:id?" element={<AddRxPurchaseReturn />} />
                <Route path="/rxtransaction/rxsale/addRxSale/:id?" element={<AddRxSale />} />
                <Route path="/rxtransaction/rxsale/saleinvoice" element={<LensSaleInvoice />} />
                <Route path="/rxtransaction/addrxsalereturn/:id?" element={<AddRxSaleReturn />} />

                {/* Lens Transaction */}
                <Route path="/lenstransaction/lensgroupcreation" element={<LensGroupCreation />} />
                <Route path="/lenstransaction/sale/saleinvoice" element={<LensSaleInvoice />} />
                <Route path="/lenstransaction/sale/AddLensSale/:id?" element={<AddLensSale />} />
                <Route path="/lenstransaction/sale/saleorder" element={<SaleOrder />} />
                <Route path="/lenstransaction/sale/AddLensSaleOrder/:id?" element={<AddLensSaleOrder />} />
                <Route path="/lenstransaction/sale/salechallan" element={<SaleChallan />} />
                <Route path="/lenstransaction/sale/AddLensSaleChallan/:id?" element={<AddLensSaleChallan />} />
                <Route path="/contactlens/sale/addcontactlensorder/:id?" element={<AddContactLensSaleOrder />} />
                <Route path="/lenstransaction/salereturn" element={<SaleReturnVoucher />} />
                <Route path="/lenstransaction/addsalereturn/:id?" element={<AddSaleReturn />} />
                <Route path="/lenstransaction/lensratemaster/:id?" element={<LensRate />} />
                <Route path="/lenstransaction/purchase/purchaseinvoice" element={<LensPurchaseInvoice />} />
                <Route path="/lenstransaction/purchase/AddLensPurchase/:id?" element={<AddLensPurchase />} />
                <Route path="/lenstransaction/purchase/purchaseorder" element={<PurchaseOrder />} />
                <Route path="/lenstransaction/multipleitems" element={<LensAddMultipleItems />} />
                <Route path="/lenstransaction/purchase/AddLensPurchaseOrder/:id?" element={<AddLensPurchaseOrder />} />
                <Route path="/contactlens/purchase/addcontactlensorder/:id?" element={<AddContactLensPurchaseOrder />} />
                <Route path="/lenstransaction/purchase/purchasechallan" element={<PurchaseChallan />} />
                <Route path="/lenstransaction/purchase/AddLensPurchaseChallan/:id?" element={<AddLensPurchaseChallan />} />
                <Route path="/lenstransaction/purchasereturn" element={<PurchaseReturn />} />
                <Route path="/lenstransaction/addpurchasereturn/:id?" element={<AddPurchaseReturn />} />
                <Route path="/lenstransaction/lensstockreport/lensstockwithoutbarcode" element={<LensStockReport />} />
                <Route path="/lenstransaction/lensstockreport/lensstockwithbarcode" element={<LensStockReport />} />
                <Route path="/lenstransaction/lensstockreport/partywiseitemreport" element={<PartyWiseItemReport />} />
                <Route path="/lenstransaction/lensstockreport/verifybilling" element={<VerifyBilling />} />
                <Route path="/lenstransaction/lensstockreport/lensmovement" element={<LensMovementReport />} />
                <Route path="/lenstransaction/lensstockreport/lenspricesummary" element={<HomePlaceholder />} />
                <Route path="/lenstransaction/lensstockreport/verifylensstock" element={<VerifyLensStock />} />
                <Route path="/lenstransaction/lensstockreport/lenslocation" element={<LensLocation />} />
                <Route path="/lenstransaction/lenssphcylwisestock" element={<LensSphCylWise />} />
                <Route path="/lenstransaction/lensstockreport/customeritemsalesreport" element={<CustomerItemSalesReport />} />
                <Route path="/lenstransaction/lensstockreport/itemstocksummaryreport" element={<ItemStockSummaryReport />} />
                <Route path="/reports/otherreports/salesgrowthcomparisonreport" element={<SalesGrowthComparisonReport />} />
                <Route path="/lenstransaction/damageandshrinkage" element={<DamageAndShrinkage />} />
                <Route path="/lenstransaction/adddamageentry/:id?" element={<AddDamageEntry />} />
                <Route path="/lenstransaction/productexchange" element={<ProductExchange />} />
                <Route path="/add/addproductexchange/:id?" element={<AddProductExchange />} />

                {/* Reports -> Transaction Details */}
                <Route path="/reports/transactiondetails/transactionsummary" element={<TransactionDetailsCombined />} />
                <Route path="/reports/transactiondetails/transactiondetail" element={<TransactionDetailsCombined />} />
                <Route path="/reports/transactiondetails/salesummaryformats" element={<TransactionDetailsCombined />} />

                {/* Reports -> Books */}
                <Route path="/reports/books/daybook" element={<DayBook />} />
                <Route path="/reports/books/cashbankbook" element={<CashBankBook />} />
                <Route path="/reports/books/profitandlossitem" element={<ProfitAndLossCombined />} />
                <Route path="/reports/books/profitandlossaccount" element={<ProfitAndLossCombined />} />
                <Route path="/reports/books/balancesheet" element={<BalanceSheet />} />
                <Route path="/reports/books/collectionreport" element={<CollectionReport />} />

                {/* Reports -> Ledger */}
                <Route path="/reports/ledger/accountledger" element={<AccountLedger />} />
                <Route path="/reports/ledger/accountledgerdetails" element={<AccountLedgerDetails />} />
                <Route path="/reports/ledger/outstanding" element={<Outstanding />} />

                {/* Reports -> Stock & Inventory */}
                <Route path="/reports/stockandinventory/itemstockreorder" element={<ItemStockReorder />} />

                {/* Reports -> GST Reports */}
                <Route path="/reports/gstreports/gstsummary" element={<HomePlaceholder />} />
                <Route path="/reports/gstreports/gstr1" element={<HomePlaceholder />} />
                <Route path="/reports/gstreports/gstr2" element={<HomePlaceholder />} />
                <Route path="/reports/gstreports/gstr38" element={<HomePlaceholder />} />
                <Route path="/reports/gstreports/gstsundrycharge" element={<HomePlaceholder />} />

                {/* Reports -> Other Sale/Order Reports */}
                <Route path="/reports/othersaleorderreports/saleitemgroupwisereport" element={<SaleItemGroupWiseReport />} />

                {/* Reports -> Other Reports */}
                <Route path="/reports/otherreports/bookedbyreport" element={<BookedByReport />} />
                <Route path="/reports/otherreports/customeranalysis" element={<CustomerAnalysis />} />
                <Route path="/reports/otherreports/deleteddatareport" element={<DeletedDataReport />} />
                <Route path="/reports/otherreports/useractivityreport" element={<DeliveryPersonActivityReport />} />
                <Route path="/reports/otherreports/powermovementreport" element={<PowerMovementReport />} />
                <Route path="/reports/otherreports/salereturnratioreport" element={<SaleReturnRatioReport />} />
                <Route path="/reports/otherreports/saletargetreport" element={<SaleTargetReport />} />
                <Route path="/reports/otherreports/cancelledorderratioreport" element={<CancelledOrderRatioReport />} />
                <Route path="/reports/otherreports/ordertochallantimereport" element={<OrderToChallanTimeReport />} />
                <Route path="/reports/otherreports/collectiontargetreport" element={<CustomerVendorCollectionReport />} />



                {/* Utilities -> Database Backup/Restore */}
                <Route path="/utilities/databasebackuprestore/backupandrestore" element={<BackupAndRestore />} />
                {/* Utilities -> Bulk Updation */}
                <Route path="/utilities/bulkupdation/productlistforupdate" element={<ProductListForUpdate />} />

                {/* Remaining Utilities */}
                <Route path="/utilities/softwareupdate" element={<HomePlaceholder />} />
                <Route path="/utilities/offers" element={<OffersPage />} />
                <Route path="/reports/verification/billing" element={<VerifyBilling />} />
                <Route path="/reports/verification/bank-statement" element={<VerifyBankStatement />} />
                <Route path="/utilities/shortcutkeys" element={<ShortcutKeys />} />

                {/* Fallback for normal users */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            )}

            {/* Super Admin Routes */}
            {user?.role === 'super_admin' && (
              <>
                <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                <Route path="/super-admin/companies" element={<CompanyManagement />} />
                <Route path="/super-admin/users" element={<UserManagement />} />
                <Route path="/super-admin/plans" element={<PlanManagement />} />
                <Route path="/super-admin/subscriptions" element={<SubscriptionManagement />} />
                <Route path="/super-admin/payments" element={<PaymentHistory />} />
                <Route path="/super-admin/settings" element={<SystemSettings />} />
                
                {/* Fallback for Super Admin */}
                <Route path="*" element={<Navigate to="/super-admin/dashboard" replace />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Router>
        <GlobalLoader />
        <AppLayout />
        <Toaster position="top-center" />
    </Router>
  );
}