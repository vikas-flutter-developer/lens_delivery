import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { tenantStorage } from './tenantSupport.js';

export default function authMiddleware(req, res, next) {
  let token;

  // Check for Authorization header first (most reliable for API requests)
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  // Fallback to cookies
  else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({ message: "Authentication required. Please log in." });
  }
  try {
    if (!config.JWT_SECRET) {
      console.error("AuthMiddleware Error: JWT_SECRET is not defined in environment config.");
      return res.status(500).json({ message: "Server configuration error." });
    }
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;

    // Determine tenant context (super_admin bypasses tenant isolation)
    const tenantId = (decoded.role !== 'super_admin' && decoded.companyId) ? decoded.companyId : null;
    
    // Wrap next() inside the AsyncLocalStorage context
    tenantStorage.run(tenantId, () => {
        next();
    });
  } catch (err) {
    console.error("JWT Verification Error for token:", token?.substring(0, 10) + "...", "Error:", err.message);
    // Clear the invalid cookie if present
    if (req.cookies && req.cookies.jwt) {
      res.clearCookie('jwt');
    }
    return res.status(403).json({ message: "Session expired or invalid. Please log in again.", error: err.message });
  }
}
