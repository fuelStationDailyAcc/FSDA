// Custom error class that extends the built-in Error class for standardized API error responses
class ApiError extends Error { // Standardized error object for API responses with consistent structure
    // Constructor to initialize error with status code, message, and additional details
    constructor(
        statusCode, // HTTP status code for the error
        message="Something went wrong", // Default error message
        errors = [], // Array of detailed error messages
        stack = "" // Custom stack trace (optional)
    ){
        // Call parent Error constructor with the message
        super(message)
        // Set HTTP status code for the error response
        this.statusCode = statusCode
        // Set data to null for error responses
        this.data = null
        // Set the error message
        this.message = message
        // Set success flag to false for all errors
        this.success = false // Always false for error responses
        // Set array of detailed error messages
        this.errors = errors

        // Handle stack trace
        if (stack) {
            // Use provided stack trace
            this.stack = stack
        } else {
            // Capture current stack trace for debugging
            Error.captureStackTrace(this, this.constructor) // Preserve stack trace for debugging
        }
    }
}

// Export the ApiError class for use throughout the application
export {ApiError} // Named export for importing in other files