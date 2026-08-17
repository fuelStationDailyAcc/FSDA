import {
    DailyAccount,
    Expense,
    LedgerTransaction,
} from "../models/accounts.model.js";
import { FuelProductModel } from "../models/fuelProduct.model.js";
import { PaymentMethodModel } from "../models/paymentMethod.model.js";
import { ExpenseCategoryModel, TransactionCategoryModel } from "../models/catalog.model.js";
import { CustomerModel, VendorModel } from "../models/party.model.js";
import { UserModel } from "../models/user.model.js";

const UNSCOPED = { $or: [{ ownerId: null }, { ownerId: { $exists: false } }] };

async function dropIndexSafe(model, indexName) {
    try {
        await model.collection.dropIndex(indexName);
        console.log(`Dropped leftover index ${model.collection.collectionName}.${indexName}`);
    } catch (error) {
        if (error?.codeName !== "IndexNotFound" && error?.code !== 27) {
            console.warn(
                `Could not drop ${model.collection.collectionName}.${indexName}:`,
                error.message
            );
        }
    }
}

async function earliestOwnerId() {
    const owner = await UserModel.findOne({
        $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    })
        .sort({ createdAt: 1 })
        .select("_id")
        .lean();
    return owner?._id || null;
}

async function assignOwner(model, filter, ownerId) {
    if (!ownerId) return 0;
    const result = await model.updateMany(filter, { $set: { ownerId } });
    return result.modifiedCount || 0;
}

export async function migrateTenancy() {
    await dropIndexSafe(DailyAccount, "accountDate_1");
    await dropIndexSafe(PaymentMethodModel, "code_1");
    await dropIndexSafe(ExpenseCategoryModel, "name_1");
    await dropIndexSafe(LedgerTransaction, "idempotencyKey_1");

    const fallbackOwnerId = await earliestOwnerId();
    if (!fallbackOwnerId) {
        console.log("Tenancy migration: no station owners yet, skipping data backfill");
        return;
    }

    await assignOwner(DailyAccount, UNSCOPED, fallbackOwnerId);

    const days = await DailyAccount.find().select("_id ownerId").lean();
    for (const day of days) {
        if (!day.ownerId) continue;
        await Expense.updateMany(
            { dailyAccountId: day._id, ...UNSCOPED },
            { $set: { ownerId: day.ownerId } }
        );
        await LedgerTransaction.updateMany(
            { dailyAccountId: day._id, ...UNSCOPED },
            { $set: { ownerId: day.ownerId } }
        );
    }

    await assignOwner(Expense, UNSCOPED, fallbackOwnerId);
    await assignOwner(LedgerTransaction, UNSCOPED, fallbackOwnerId);
    await assignOwner(FuelProductModel, UNSCOPED, fallbackOwnerId);
    await assignOwner(PaymentMethodModel, UNSCOPED, fallbackOwnerId);
    await assignOwner(ExpenseCategoryModel, UNSCOPED, fallbackOwnerId);
    await assignOwner(TransactionCategoryModel, UNSCOPED, fallbackOwnerId);
    await assignOwner(CustomerModel, UNSCOPED, fallbackOwnerId);
    await assignOwner(VendorModel, UNSCOPED, fallbackOwnerId);

    const modelsToSync = [
        DailyAccount,
        Expense,
        LedgerTransaction,
        FuelProductModel,
        PaymentMethodModel,
        ExpenseCategoryModel,
        TransactionCategoryModel,
        CustomerModel,
        VendorModel,
    ];
    for (const model of modelsToSync) {
        try {
            await model.syncIndexes();
        } catch (error) {
            console.warn(`Index sync failed for ${model.collection.collectionName}:`, error.message);
        }
    }
}
