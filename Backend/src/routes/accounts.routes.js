import { Router } from "express";
import { requireAnyPermission, requirePermission, verifyJWT } from "../middlewares/auth.middleware.js";
import {
    addExpense,
    addReading,
    addTransaction,
    closeDay,
    createCustomer,
    createExpenseCategory,
    createPaymentMethod,
    createProduct,
    createVendor,
    deleteCustomer,
    deleteExpense,
    deleteExpenseCategory,
    deletePaymentMethod,
    deleteProduct,
    deleteTransaction,
    getDailyAccount,
    getLedgerTotals,
    listDailyAccounts,
    listCustomers,
    listExpenseCategories,
    listLedgerNames,
    listPaymentMethods,
    listProducts,
    listTxnCategories,
    listVendors,
    reopenDay,
    updateCashTaken,
    updateCustomer,
    updateExpenseCategory,
    updatePaymentMethod,
    updateProduct,
    updateReading,
    updateVendor,
    upsertCollection,
} from "../controllers/accounts.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/history", requirePermission("accounts.read"), listDailyAccounts);
router.get("/daily", requirePermission("accounts.read"), getDailyAccount);
router.patch("/daily/cash-taken", requirePermission("accounts.write"), updateCashTaken);
router.put("/daily/collections", requirePermission("accounts.write"), upsertCollection);
router.post("/daily/readings", requirePermission("accounts.write"), addReading);
router.patch("/daily/readings/:id", requirePermission("accounts.write"), updateReading);
router.post("/daily/expenses", requirePermission("accounts.write"), addExpense);
router.delete("/daily/expenses/:id", requirePermission("accounts.write"), deleteExpense);
router.post(
    "/daily/transactions",
    requireAnyPermission("accounts.write", "ledger.write"),
    addTransaction
);
router.delete(
    "/daily/transactions/:id",
    requireAnyPermission("accounts.write", "ledger.write"),
    deleteTransaction
);
router.post("/daily/close", requirePermission("accounts.write"), closeDay);
router.post("/daily/reopen", requirePermission("accounts.write"), reopenDay);

router.get("/products", requireAnyPermission("accounts.read", "settings.read"), listProducts);
router.post("/products", requirePermission("settings.write"), createProduct);
router.patch("/products/:id", requirePermission("settings.write"), updateProduct);
router.delete("/products/:id", requirePermission("settings.write"), deleteProduct);

router.get(
    "/payment-methods",
    requireAnyPermission("accounts.read", "settings.read"),
    listPaymentMethods
);
router.post("/payment-methods", requirePermission("settings.write"), createPaymentMethod);
router.patch("/payment-methods/:id", requirePermission("settings.write"), updatePaymentMethod);
router.delete("/payment-methods/:id", requirePermission("settings.write"), deletePaymentMethod);

router.get(
    "/expense-categories",
    requireAnyPermission("accounts.read", "settings.read"),
    listExpenseCategories
);
router.post("/expense-categories", requirePermission("settings.write"), createExpenseCategory);
router.patch("/expense-categories/:id", requirePermission("settings.write"), updateExpenseCategory);
router.delete("/expense-categories/:id", requirePermission("settings.write"), deleteExpenseCategory);

router.get(
    "/transaction-categories",
    requireAnyPermission("accounts.read", "ledger.read"),
    listTxnCategories
);

router.get("/ledger-names", requireAnyPermission("accounts.read", "ledger.read"), listLedgerNames);
router.get("/ledger-totals", requirePermission("ledger.read"), getLedgerTotals);

router.get("/customers", requireAnyPermission("accounts.read", "ledger.read"), listCustomers);
router.post(
    "/customers",
    requireAnyPermission("accounts.write", "ledger.write"),
    createCustomer
);
router.patch("/customers/:id", requirePermission("ledger.write"), updateCustomer);
router.delete("/customers/:id", requirePermission("ledger.write"), deleteCustomer);

router.get("/vendors", requireAnyPermission("accounts.read", "ledger.read"), listVendors);
router.post("/vendors", requireAnyPermission("accounts.write", "ledger.write"), createVendor);
router.patch("/vendors/:id", requirePermission("ledger.write"), updateVendor);

export default router;
