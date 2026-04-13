import jwt from "jsonwebtoken";
import config from "../config/env.js";

const JWT_SECRET = config.JWT_SECRET;

/**
 * Customer Authentication Middleware
 * Verifies JWT token for customer routes and attaches customer info to req.customer
 */
const customerAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    const token =
      req.headers.authorization?.split(" ")[1] ||
      req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization required",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if this is a customer token (not admin)
    if (decoded.type !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Invalid token type for customer access",
      });
    }

    // Attach customer info to request
    req.customer = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    console.error("Customer auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

export default customerAuthMiddleware;
