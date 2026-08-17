import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
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
    deleteTransaction,
    getDailyAccount,
    getLedgerTotals,
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

router.get("/daily", getDailyAccount);
router.patch("/daily/cash-taken", updateCashTaken);
router.put("/daily/collections", upsertCollection);
router.post("/daily/readings", addReading);
router.patch("/daily/readings/:id", updateReading);
router.post("/daily/expenses", addExpense);
router.delete("/daily/expenses/:id", deleteExpense);
router.post("/daily/transactions", addTransaction);
router.delete("/daily/transactions/:id", deleteTransaction);
router.post("/daily/close", closeDay);
router.post("/daily/reopen", reopenDay);

router.get("/products", listProducts);
router.post("/products", createProduct);
router.patch("/products/:id", updateProduct);

router.get("/payment-methods", listPaymentMethods);
router.post("/payment-methods", createPaymentMethod);
router.patch("/payment-methods/:id", updatePaymentMethod);

router.get("/expense-categories", listExpenseCategories);
router.post("/expense-categories", createExpenseCategory);
router.patch("/expense-categories/:id", updateExpenseCategory);

router.get("/transaction-categories", listTxnCategories);

router.get("/ledger-names", listLedgerNames);
router.get("/ledger-totals", getLedgerTotals);

router.get("/customers", listCustomers);
router.post("/customers", createCustomer);
router.patch("/customers/:id", updateCustomer);
router.delete("/customers/:id", deleteCustomer);

router.get("/vendors", listVendors);
router.post("/vendors", createVendor);
router.patch("/vendors/:id", updateVendor);

export default router;
