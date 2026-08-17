import mongoose from "mongoose";

const objectId = mongoose.Schema.Types.ObjectId;

const dailyAccountSchema = new mongoose.Schema(
    {
        accountDate: { type: String, required: true, unique: true },
        status: { type: String, enum: ["open", "closed"], default: "open" },
        cashTakenPaise: { type: Number, default: 0 },
        actualClosingCashPaise: { type: Number, default: null },
        notes: { type: String, default: null },
        closedAt: { type: Date, default: null },
        closedBy: { type: objectId, ref: "User", default: null },
        reopenedAt: { type: Date, default: null },
        reopenedBy: { type: objectId, ref: "User", default: null },
        createdBy: { type: objectId, ref: "User", default: null },
    },
    { timestamps: true, collection: "daily_accounts" }
);

const fuelMeterReadingSchema = new mongoose.Schema(
    {
        dailyAccountId: { type: objectId, ref: "DailyAccount", required: true, index: true },
        productId: { type: objectId, ref: "FuelProduct", required: true },
        meterLabel: { type: String, default: null },
        newReading: { type: Number, default: 0 },
        oldReading: { type: Number, default: 0 },
        oldReadingManual: { type: Boolean, default: false },
        litres: { type: Number, default: 0 },
        testingLitres: { type: Number, default: 0 },
        netLitres: { type: Number, default: 0 },
        ratePaise: { type: Number, default: 0 },
        totalSalePaise: { type: Number, default: 0 },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "fuel_meter_readings" }
);

const dailyPaymentCollectionSchema = new mongoose.Schema(
    {
        dailyAccountId: { type: objectId, ref: "DailyAccount", required: true, index: true },
        paymentMethodId: { type: objectId, ref: "PaymentMethod", required: true },
        amountPaise: { type: Number, default: 0 },
        description: { type: String, default: "" },
    },
    { timestamps: true, collection: "daily_payment_collections" }
);

const expenseSchema = new mongoose.Schema(
    {
        dailyAccountId: { type: objectId, ref: "DailyAccount", required: true, index: true },
        categoryId: { type: objectId, ref: "ExpenseCategory", default: null },
        description: { type: String, required: true },
        amountPaise: { type: Number, required: true, min: 1 },
        paymentMethodId: { type: objectId, ref: "PaymentMethod", default: null },
        notes: { type: String, default: null },
        createdBy: { type: objectId, ref: "User", default: null },
    },
    { timestamps: true, collection: "expenses" }
);

const ledgerTransactionSchema = new mongoose.Schema(
    {
        dailyAccountId: { type: objectId, ref: "DailyAccount", required: true, index: true },
        type: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
        txnDate: { type: String, required: true, index: true },
        txnTime: { type: String, default: null },
        description: { type: String, required: true },
        partyType: {
            type: String,
            enum: ["customer", "vendor", "other"],
            default: null,
        },
        partyId: { type: objectId, default: null },
        category: { type: String, required: true },
        paymentMethodId: { type: objectId, ref: "PaymentMethod", default: null },
        amountPaise: { type: Number, required: true, min: 1 },
        referenceNumber: { type: String, default: null },
        notes: { type: String, default: null },
        idempotencyKey: { type: String, unique: true, sparse: true },
        createdBy: { type: objectId, ref: "User", default: null },
    },
    { timestamps: true, collection: "ledger_transactions" }
);

ledgerTransactionSchema.index({ partyType: 1, partyId: 1 });

export const DailyAccount =
    mongoose.models.DailyAccount || mongoose.model("DailyAccount", dailyAccountSchema);
export const FuelMeterReading =
    mongoose.models.FuelMeterReading || mongoose.model("FuelMeterReading", fuelMeterReadingSchema);
export const DailyPaymentCollection =
    mongoose.models.DailyPaymentCollection ||
    mongoose.model("DailyPaymentCollection", dailyPaymentCollectionSchema);
export const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
export const LedgerTransaction =
    mongoose.models.LedgerTransaction ||
    mongoose.model("LedgerTransaction", ledgerTransactionSchema);
