const config = require('../config');

// Simple in-memory token cache to avoid hitting auth-service on every request
const tokenCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // Cache valid tokens for 60 seconds

/**
 * Auth middleware that validates JWT tokens by calling the auth-service.
 * Forwards the Authorization header and checks if the token is valid.
 */
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid Authorization header',
        });
    }

    const token = authHeader.substring(7);

    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        req.user = cached.user;
        return next();
    }

    try {
        const response = await fetch(`${config.authServiceUrl}/auth/me`, {
            headers: {
                Authorization: authHeader,
            },
        });

        if (!response.ok) {
            // Clear expired cache entry
            tokenCache.delete(token);
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
            });
        }

        const user = await response.json();

        // Cache the valid token
        tokenCache.set(token, { user, timestamp: Date.now() });

        // Attach user info to request
        req.user = user;
        next();
    } catch (error) {
        console.error('[Auth] Failed to validate token:', error.message);
        return res.status(503).json({
            success: false,
            error: 'Auth service unavailable',
        });
    }
}

// Periodically clean expired cache entries
setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of tokenCache) {
        if (now - entry.timestamp >= CACHE_TTL_MS) {
            tokenCache.delete(token);
        }
    }
}, CACHE_TTL_MS);

module.exports = { authMiddleware };
