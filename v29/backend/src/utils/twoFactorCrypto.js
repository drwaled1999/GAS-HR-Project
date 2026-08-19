import crypto from "crypto";

function getKey() {
  const source = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error("TWO_FACTOR_ENCRYPTION_KEY or JWT_SECRET is required");
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptTwoFactorSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptTwoFactorSecret(value) {
  const [ivText, tagText, encryptedText] = String(value || "").split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid two-factor secret");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-")
  );
}

export function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(String(code || "").replace(/[\s-]/g, "").toUpperCase()).digest("hex");
}
