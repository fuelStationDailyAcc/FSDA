// Higher-order function that wraps async route handlers to automatically handle errors
const asyncHandler = (requestHandler) => { // Wrap async controllers to pass errors to Express error handler
    // Return a new function that Express can use as middleware
    return (req, res, next) => {
        // Wrap the async function in Promise.resolve to handle both sync and async functions
        Promise.resolve(requestHandler(req, res, next)).catch((err)=> next(err))
    }
}

// Export the asyncHandler function for use in controllers and middleware
export {asyncHandler} // Named export for importing in other files

// Alternative implementation using try-catch (commented out for reference)
// const asyncHandle = (fn) => async (res, req, next) => {
//     try {
//         await fn(res, req, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }