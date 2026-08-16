// Import Cloudinary SDK for cloud-based file storage and management
import { v2 as cloudinary } from "cloudinary" // Cloudinary SDK for file uploads and management
// Import dotenv to load environment variables
import dotenv from "dotenv"; // Load credentials from environment file
// Import file system module for temporary file cleanup
import fs from "fs" // File system operations for temp file cleanup

// Load environment variables from .env file
dotenv.config({ path: "./.env" }); // Load environment variables for Cloudinary configuration

// Configure Cloudinary client with credentials from environment variables
cloudinary.config({ // Initialize Cloudinary client with API credentials
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Cloudinary cloud name
    api_key: process.env.CLOUDINARY_API_KEY, // Cloudinary API key
    api_secret: process.env.CLOUDINARY_API_SECRET // Cloudinary API secret
});

// Function to upload local file to Cloudinary and clean up temporary file
const uploadOnCloudinary = async(localFilePath) => { // Upload local file to Cloudinary; delete temp file after upload
    try {
        // If no file path provided, return null
        if (!localFilePath) return null
        // Upload the file to Cloudinary with automatic resource type detection
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto" // Automatically detect if it's image, video, etc.
        })
        // File has been uploaded successfully
        // console.log(response); // Uncomment for debugging
        // Remove the temporary local file after successful upload
        fs.unlinkSync(localFilePath); // Clean up temporary file from local storage
        
        // Return the Cloudinary response with file details
        return response;
        
    } catch (error) {
        // If upload fails, still remove the temporary file to prevent disk space issues
        fs.unlinkSync(localFilePath) // Remove temp file if upload failed
        // Return null to indicate upload failure
        return null
    }
}

// Export the upload function for use in controllers
export {uploadOnCloudinary} // Named export for importing in other files