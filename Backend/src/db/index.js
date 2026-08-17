import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { seedDefaults } from "./seed.js";

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
    });
    await seedDefaults();
    const { host, name } = mongoose.connection;
    console.log(`MongoDB connected (${host}/${name})`);
}
