/**
 * Shared auth instance module
 *
 * Exports the requireAuth and middleware handlers from the @vitalpoint/near-phantom-auth
 * instance so that route files can import them without coupling to index.ts.
 *
 * Pattern: auth instance is initialized lazily in index.ts via setAuthInstance(),
 * then route files call getRequireAuth() to get the middleware.
 */

import type { RequestHandler } from 'express';

let _requireAuth: RequestHandler | null = null;
let _middleware: RequestHandler | null = null;

/**
 * Called once in index.ts after createAnonAuth() to register the auth instance.
 */
export function setAuthInstance(requireAuth: RequestHandler, middleware: RequestHandler): void {
  _requireAuth = requireAuth;
  _middleware = middleware;
}

/**
 * Returns the requireAuth middleware (401 if not authenticated).
 * Must be called after server startup (index.ts calls setAuthInstance first).
 */
export function getRequireAuth(): RequestHandler {
  if (!_requireAuth) {
    // Fallback: reject all requests if auth not initialized (should not happen in production)
    return (_req, res, _next) => {
      res.status(503).json({ error: 'Auth service not initialized' });
    };
  }
  return _requireAuth;
}

/**
 * Returns the optional auth middleware (attaches user if authenticated, no 401).
 */
export function getAuthMiddleware(): RequestHandler {
  if (!_middleware) {
    return (_req, _res, next) => next();
  }
  return _middleware;
}

/**
 * Convenience: requireAuth as a directly-usable middleware.
 * This wrapper allows: router.get('/path', requireAuth, handler)
 * The actual middleware is resolved at call time (after init).
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  getRequireAuth()(req, res, next);
};
