// encryptPrisma.js – AES-256-CTR encryption for sensitive User fields
// Encrypts: email, name, nickname, plan before storing in DB as JSON string
// Decrypts on read

import crypto from "crypto";

const KEY = process.env.ENCRYPTION_KEY;
if (!KEY || KEY.length < 64) {
  console.warn("[WARN] ENCRYPTION_KEY not set or too short – encryption disabled, using plaintext");
}

function getKey() {
  if (!KEY) return null;
  return Buffer.from(KEY, "hex");
}

export function encrypt(plaintext) {
  const key = getKey();
  if (!key) return plaintext; // fallback: no encryption

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
  let encrypted = cipher.update(JSON.stringify(plaintext), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), data: encrypted };
}

export function decrypt(encryptedObj) {
  const key = getKey();
  if (!key || typeof encryptedObj === "string") return encryptedObj; // already plaintext

  const { iv, data } = encryptedObj;
  if (!iv || !data) return encryptedObj;

  const decipher = crypto.createDecipheriv("aes-256-ctr", key, Buffer.from(iv, "hex"));
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// Helper for User creation – returns values for DB storage
// NOTE: email is kept as plaintext for login lookups. Other fields are encrypted.
export function encryptUserData({ email, name, nickname, plan }) {
  return {
    email, // Keep plaintext for login lookups
    name: JSON.stringify(encrypt(name)),
    nickname: JSON.stringify(encrypt(nickname)),
    plan: JSON.stringify(encrypt(plan)),
  };
}

// Helper for reading User – parse JSON then decrypt
export function decryptUser(user) {
  if (!user) return user;
  const parseAndDecrypt = (val) => {
    if (!val || typeof val !== "string") return val;
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && parsed.iv && parsed.data) {
        return decrypt(parsed);
      }
    } catch {}
    return val; // already plaintext
  };
  return {
    ...user,
    email: parseAndDecrypt(user.email),
    name: parseAndDecrypt(user.name),
    nickname: parseAndDecrypt(user.nickname),
    plan: parseAndDecrypt(user.plan),
  };
}
