// Custom response class for standardized API success responses
class ApiResponse { // Consistent success response structure across all API endpoints
    // Constructor to initialize response with status code, data, and message
    constructor(statusCode, data, message = "Success"){
        // Set HTTP status code for the response
        this.statusCode = statusCode
        // Set the response data payload
        this.data = data
        // Set the response message (defaults to "Success")
        this.message = message
        // Set success flag based on status code (true for 2xx and 3xx status codes)
        this.success = statusCode < 400 // true for 2xx/3xx status codes, false for 4xx/5xx
    }
}

// Export the ApiResponse class for use throughout the application
export { ApiResponse } // Named export for importing in other files