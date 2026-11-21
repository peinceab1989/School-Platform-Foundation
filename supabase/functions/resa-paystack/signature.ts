export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha512Hex(secret: string, data: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const safeBytes = new Uint8Array(data.length);
  safeBytes.set(data);
  const digest = await crypto.subtle.sign("HMAC", key, safeBytes.buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyPaystackWebhookSignature(input: {
  modernSignature: string | null;
  legacySignature: string | null;
  rawBody: Uint8Array;
  webhookSecret: string;
  secretKey: string;
  nowMs?: number;
}) {
  const { modernSignature, legacySignature, rawBody, webhookSecret, secretKey } = input;
  if (modernSignature && webhookSecret.startsWith("whsec_")) {
    const fields = modernSignature.split(",").map((part) => part.trim());
    const timestampFields = fields.filter((part) => part.startsWith("t="));
    const signatureFields = fields.filter((part) => part.startsWith("v1="));
    if (timestampFields.length !== 1 || signatureFields.length === 0) return false;
    const timestamp = timestampFields[0].slice(2);
    if (!/^\d+$/.test(timestamp)) return false;
    const signatures = signatureFields.map((part) => part.slice(3));
    const seconds = Number(timestamp);
    const nowSeconds = (input.nowMs ?? Date.now()) / 1000;
    if (!Number.isSafeInteger(seconds) || Math.abs(nowSeconds - seconds) > 300) return false;

    const prefix = new TextEncoder().encode(timestamp + ".");
    const payload = new Uint8Array(prefix.length + rawBody.length);
    payload.set(prefix);
    payload.set(rawBody, prefix.length);
    const expected = await hmacSha512Hex(webhookSecret, payload);
    return signatures.some((item) => {
      const separator = item.indexOf(":");
      if (separator < 1) return false;
      const keyId = item.slice(0, separator);
      const signature = item.slice(separator + 1);
      return /^whk_[A-Za-z0-9]+$/.test(keyId) && /^[0-9a-f]{128}$/.test(signature) &&
        constantTimeEqual(expected, signature);
    });
  }

  if (!secretKey || !legacySignature || !/^[0-9a-f]{128}$/.test(legacySignature)) return false;
  return constantTimeEqual(await hmacSha512Hex(secretKey, rawBody), legacySignature);
}
