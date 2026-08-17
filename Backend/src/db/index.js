import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { seedDefaults } from "./seed.js";
import { migrateTenancy } from "./migrateTenancy.js";
import { UserModel } from "../models/user.model.js";
import { DailyPaymentCollection } from "../models/accounts.model.js";

mongoose.set("strictQuery", true);

function mongoUri() {
    const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL;
    if (!uri) {
        throw new Error("MONGODB_URI is required");
    }
    return uri;
}

export async function connectDB() {
    const uri = mongoUri();
    await mongoose.connect(uri, {
        dbName: process.env.DB_NAME || DB_NAME,
        family: 4,
        serverSelectionTimeoutMS: 15000,
    });
    try {
        await UserModel.syncIndexes();
    } catch (error) {
        console.warn("User index sync failed, rebuilding email index:", error.message);
        try {
            await UserModel.collection.dropIndex("email_1");
        } catch {
            // Index may already be gone.
        }
        await UserModel.syncIndexes();
    }
    try {
        await DailyPaymentCollection.collection.dropIndex("dailyAccountId_1_paymentMethodId_1");
    } catch {
        // Unique one-row-per-method index may already be gone.
    }
    try {
        await DailyPaymentCollection.syncIndexes();
    } catch (error) {
        console.warn("Payment collection index sync failed:", error.message);
    }
    await migrateTenancy();
    await seedDefaults();
    const { host, name } = mongoose.connection;
    console.log(`MongoDB connected (${host}/${name})`);
}
