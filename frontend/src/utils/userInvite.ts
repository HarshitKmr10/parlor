import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

export interface InvitePayload {
  email: string;
  role: string;
  password: string;
  expiresAt: string;
}

export const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const getSecretKey = () => {
  const secret = process.env.USER_INVITE_SECRET;

  if (!secret) {
    throw new Error("USER_INVITE_SECRET is not configured");
  }

  return createHash("sha256").update(secret).digest();
};

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded =
    padding > 0 ? normalized.padEnd(normalized.length + (4 - padding), "=") : normalized;
  return Buffer.from(padded, "base64");
};

export const generateInviteToken = (payload: InvitePayload) => {
  const key = getSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return base64UrlEncode(Buffer.concat([iv, authTag, encrypted]));
};

export const decodeInviteToken = (token: string): InvitePayload => {
  if (!token) {
    throw new Error("Missing invite token");
  }

  const key = getSecretKey();
  const buffer = base64UrlDecode(token);
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  const payload = JSON.parse(decrypted.toString("utf8")) as InvitePayload;

  if (!payload?.expiresAt) {
    throw new Error("Invite token is invalid");
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new Error("Invite link has expired");
  }

  return payload;
};

