const jwt = require("jsonwebtoken");

const AUTH_STATE = Symbol("accessTokenAuthState");

const readBearerToken = (authorization) => {
  if (!authorization) return { token: null, malformed: false };

  const match = /^Bearer\s+([^\s]+)$/i.exec(String(authorization).trim());
  if (!match) return { token: null, malformed: true };

  return { token: match[1], malformed: false };
};

/**
 * Parse and verify the access token at most once for a request.
 *
 * Authentication is optional at this stage because login, refresh-token and
 * other public routes share the same tenant-loading pipeline. Protected routes
 * turn anonymous/invalid states into a 401 response in `protect`.
 */
const getAccessTokenState = (req) => {
  if (req[AUTH_STATE]) return req[AUTH_STATE];

  const { token, malformed } = readBearerToken(req.headers?.authorization);
  if (malformed) {
    req[AUTH_STATE] = {
      status: "invalid",
      error: Object.assign(new Error("Malformed authorization header"), {
        name: "JsonWebTokenError",
      }),
    };
    return req[AUTH_STATE];
  }

  if (!token) {
    req[AUTH_STATE] = { status: "anonymous" };
    return req[AUTH_STATE];
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    req[AUTH_STATE] = { status: "authenticated", token, claims };
  } catch (error) {
    req[AUTH_STATE] = { status: "invalid", token, error };
  }

  return req[AUTH_STATE];
};

const authenticate = (req, res, next) => {
  getAccessTokenState(req);
  next();
};

module.exports = { authenticate, getAccessTokenState, readBearerToken };
