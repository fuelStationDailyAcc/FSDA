import "./dnsFix.js";
import "./loadEnv.js";
import { connectDB } from "./db/index.js";
import { app } from "./app.js";

const port = process.env.PORT || 8000;

connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });
