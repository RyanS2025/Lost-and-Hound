import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const AUTH_CRITICAL_PATHS = new Set(["/profile", "/auth/check-device", "/auth/trust-device"]);

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.cookies?.sb_session || req.headers?.authorization || ipKeyGenerator(req),
  skip: (req) => AUTH_CRITICAL_PATHS.has(req.path),
  message: { error: "Too many requests. Please try again later." },
});

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.cookies?.sb_session || req.headers?.authorization || ipKeyGenerator(req),
  message: { error: "Too many requests. Please slow down." },
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

export const guestUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload attempts. Please try again later." },
});
