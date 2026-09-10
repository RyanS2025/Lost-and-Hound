import express from "express";
import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { supabase } from "../lib/supabase.js";
import { requireAuth, require2FA } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimiters.js";
import { sanitize, dbError } from "../lib/validation.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASSKEYS (WebAuthn)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PASSKEY_RP_NAME = "Lost & Hound";
const PASSKEY_RP_ID   = process.env.PASSKEY_RP_ID   || "localhost";
// Support comma-separated list of origins (e.g. www and non-www variants)
const PASSKEY_ORIGINS = (process.env.PASSKEY_ORIGIN || "http://localhost:5173")
  .split(",").map(o => o.trim()).filter(Boolean);

// In-memory challenge store — challenge -> { userId/email, expiry }
// TTL of 5 minutes per challenge.
const paskeyChallenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function storeChallenge(key, challenge) {
  paskeyChallenges.set(key, { challenge, expiry: Date.now() + CHALLENGE_TTL_MS });
}
function consumeChallenge(key) {
  const entry = paskeyChallenges.get(key);
  paskeyChallenges.delete(key);
  if (!entry || Date.now() > entry.expiry) return null;
  return entry.challenge;
}

// POST /api/passkeys/register/options — generate registration options for logged-in user
router.post("/api/passkeys/register/options", requireAuth, require2FA, async (req, res) => {
  const { data: authUser } = await supabase.auth.admin.getUserById(req.user.id);
  if (!authUser?.user?.email) return res.status(400).json({ error: "User not found" });

  const { data: existing } = await supabase
    .from("passkey_credentials")
    .select("credential_id")
    .eq("user_id", req.user.id);

  const options = await generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: PASSKEY_RP_ID,
    userID: Buffer.from(req.user.id),
    userName: authUser.user.email,
    userDisplayName: authUser.user.email,
    attestationType: "none",
    authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
    excludeCredentials: (existing || []).map(c => ({
      id: c.credential_id,
      type: "public-key",
    })),
  });

  storeChallenge(`reg:${req.user.id}`, options.challenge);
  res.json(options);
});

// POST /api/passkeys/register/verify — verify registration and store credential
router.post("/api/passkeys/register/verify", requireAuth, require2FA, async (req, res) => {
  const { response, deviceName } = req.body;
  if (!response) return res.status(400).json({ error: "Missing response" });

  const expectedChallenge = consumeChallenge(`reg:${req.user.id}`);
  if (!expectedChallenge) return res.status(400).json({ error: "Challenge expired or not found" });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: PASSKEY_ORIGINS,
      expectedRPID: PASSKEY_RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Registration verification failed" });
  }

  if (!verification.verified) return res.status(400).json({ error: "Verification failed" });

  const { credential, aaguid } = verification.registrationInfo;
  const { error } = await supabase.from("passkey_credentials").insert({
    user_id:       req.user.id,
    credential_id: credential.id,
    public_key:    isoBase64URL.fromBuffer(credential.publicKey),
    counter:       credential.counter,
    device_name:   sanitize(deviceName || "My Device", 50),
    transports:    credential.transports ? JSON.stringify(credential.transports) : null,
    aaguid:        aaguid || null,
  });

  if (error) return dbError(res, error, "POST /api/passkeys/register/verify");
  res.json({ verified: true });
});

// GET /api/passkeys — list user's registered passkeys
router.get("/api/passkeys", requireAuth, require2FA, async (req, res) => {
  const { data, error } = await supabase
    .from("passkey_credentials")
    .select("id, device_name, created_at, last_used_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return dbError(res, error, "GET /api/passkeys");
  res.json({ passkeys: data || [] });
});

// DELETE /api/passkeys/:id — remove a passkey
router.delete("/api/passkeys/:id", requireAuth, require2FA, async (req, res) => {
  const { error } = await supabase
    .from("passkey_credentials")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) return dbError(res, error, "DELETE /api/passkeys");
  res.json({ success: true });
});

// POST /api/passkeys/authenticate/options — generate challenge for sign-in (public)
router.post("/api/passkeys/authenticate/options", strictLimiter, async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  if (!email.endsWith("@northeastern.edu")) {
    return res.status(400).json({ error: "Must use a @northeastern.edu email address" });
  }

  // Look up the Supabase user by email
  let authUser = null;
  for (let page = 1; page <= 100; page++) {
    const { data: usersData } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (!usersData?.users?.length) break;
    authUser = usersData.users.find(u => u.email === email);
    if (authUser) break;
  }
  if (!authUser) return res.status(404).json({ error: "No account found with this email" });
  if (!authUser.email_confirmed_at) return res.status(403).json({ error: "Email not confirmed" });

  const { data: credentials } = await supabase
    .from("passkey_credentials")
    .select("credential_id, transports")
    .eq("user_id", authUser.id);

  if (!credentials || credentials.length === 0) {
    return res.status(404).json({ error: "No passkeys registered for this account" });
  }

  const options = await generateAuthenticationOptions({
    rpID: PASSKEY_RP_ID,
    userVerification: "required",
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
      type: "public-key",
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  });

  storeChallenge(`auth:${email}`, options.challenge);
  res.json(options);
});

// POST /api/passkeys/authenticate/verify — verify sign-in assertion and issue session (public)
router.post("/api/passkeys/authenticate/verify", strictLimiter, async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  const { response } = req.body;
  if (!email || !response) return res.status(400).json({ error: "Missing email or response" });

  const expectedChallenge = consumeChallenge(`auth:${email}`);
  if (!expectedChallenge) return res.status(400).json({ error: "Challenge expired or not found" });

  // Look up credential in DB by credential_id
  const credentialId = response.id;
  const { data: credRow } = await supabase
    .from("passkey_credentials")
    .select("id, user_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();

  if (!credRow) return res.status(400).json({ error: "Passkey not recognized" });

  const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = usersData?.users?.find(u => u.email === email);
  if (!authUser || authUser.id !== credRow.user_id) {
    return res.status(403).json({ error: "Credential does not belong to this account" });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: PASSKEY_ORIGINS,
      expectedRPID: PASSKEY_RP_ID,
      requireUserVerification: true,
      credential: {
        id: credentialId,
        publicKey: isoBase64URL.toBuffer(credRow.public_key),
        counter: Number(credRow.counter),
        transports: credRow.transports ? JSON.parse(credRow.transports) : undefined,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Authentication verification failed" });
  }

  if (!verification.verified) return res.status(400).json({ error: "Verification failed" });

  // Update counter and last_used_at
  await supabase
    .from("passkey_credentials")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("id", credRow.id);

  // Generate a Supabase magic link for the user to establish a session
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return res.status(500).json({ error: "Failed to generate session" });
  }

  // Issue a device token so require2FA is satisfied for subsequent requests
  const rawToken = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const deviceInfo = req.headers["user-agent"]?.slice(0, 200) || null;

  await supabase.from("trusted_devices").insert({
    user_id: credRow.user_id, token_hash: tokenHash, expires_at: expiresAt, device_info: deviceInfo,
  });

  res.json({
    verified: true,
    hashedToken: linkData.properties.hashed_token,
    email,
    deviceToken: rawToken,
  });
});

export default router;
