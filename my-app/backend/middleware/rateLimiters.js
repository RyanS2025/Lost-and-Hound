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

// Image screening is the one route that spends real money: each call costs 2
// billable Google Vision units, or 4 when an ambiguous image needs a second
// look, against a 1000/month free tier we deliberately stay inside.
//
// writeLimiter (60/15min) is far too generous for that. It would let a single
// account burn 240 units in fifteen minutes, so four accounts could clear a
// whole month's budget before lunch — and since we stay under the free tier by
// choice, that means photo uploads switch off for everyone until the 1st.
//
// 15 per 15 minutes caps one account at 60 units per window while staying well
// clear of real use: nobody legitimately posts fifteen lost items in a quarter
// of an hour.
export const imageScreenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.cookies?.sb_session || req.headers?.authorization || ipKeyGenerator(req),
  message: { error: "Too many photo uploads in a short time. Please wait a few minutes." },
});
