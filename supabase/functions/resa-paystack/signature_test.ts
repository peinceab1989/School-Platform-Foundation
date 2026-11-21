import { assertEquals } from "jsr:@std/assert@1";
import { hmacSha512Hex, verifyPaystackWebhookSignature } from "./signature.ts";

const encoder = new TextEncoder();
const rawBody = encoder.encode('{"event":"charge.success","data":{"reference":"RESA-TEST"}}');
const webhookSecret = "whsec_test_secret_for_unit_tests";
const secretKey = "sk_test_unit_test_secret";

Deno.test("accepts a valid timestamped Paystack-Signature", async () => {
  const nowMs = 1_800_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000));
  const prefix = encoder.encode(timestamp + ".");
  const payload = new Uint8Array(prefix.length + rawBody.length);
  payload.set(prefix);
  payload.set(rawBody, prefix.length);
  const digest = await hmacSha512Hex(webhookSecret, payload);
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: `t=${timestamp},v1=whk_test:${digest}`,
    legacySignature: null,
    rawBody,
    webhookSecret,
    secretKey,
    nowMs,
  });
  assertEquals(accepted, true);
});

Deno.test("rejects a timestamped signature outside the five-minute window", async () => {
  const nowMs = 1_800_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000) - 301);
  const prefix = encoder.encode(timestamp + ".");
  const payload = new Uint8Array(prefix.length + rawBody.length);
  payload.set(prefix);
  payload.set(rawBody, prefix.length);
  const digest = await hmacSha512Hex(webhookSecret, payload);
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: `t=${timestamp},v1=whk_test:${digest}`,
    legacySignature: null,
    rawBody,
    webhookSecret,
    secretKey,
    nowMs,
  });
  assertEquals(accepted, false);
});

Deno.test("rejects a valid signature if the raw body changes", async () => {
  const nowMs = 1_800_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000));
  const prefix = encoder.encode(timestamp + ".");
  const payload = new Uint8Array(prefix.length + rawBody.length);
  payload.set(prefix);
  payload.set(rawBody, prefix.length);
  const digest = await hmacSha512Hex(webhookSecret, payload);
  const changedBody = encoder.encode('{"event":"charge.success","data":{"reference":"ALTERED"}}');
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: `t=${timestamp},v1=whk_test:${digest}`,
    legacySignature: null,
    rawBody: changedBody,
    webhookSecret,
    secretKey,
    nowMs,
  });
  assertEquals(accepted, false);
});

Deno.test("accepts the legacy x-paystack-signature during migration", async () => {
  const digest = await hmacSha512Hex(secretKey, rawBody);
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: null,
    legacySignature: digest,
    rawBody,
    webhookSecret: "",
    secretKey,
  });
  assertEquals(accepted, true);
});

Deno.test("accepts secret rotation when any v1 signature matches", async () => {
  const nowMs = 1_800_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000));
  const prefix = encoder.encode(timestamp + ".");
  const payload = new Uint8Array(prefix.length + rawBody.length);
  payload.set(prefix);
  payload.set(rawBody, prefix.length);
  const oldDigest = await hmacSha512Hex("whsec_previous_secret", payload);
  const currentDigest = await hmacSha512Hex(webhookSecret, payload);
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: `t=${timestamp},v1=whk_old:${oldDigest},v1=whk_current:${currentDigest}`,
    legacySignature: null,
    rawBody,
    webhookSecret,
    secretKey,
    nowMs,
  });
  assertEquals(accepted, true);
});

Deno.test("rejects duplicate timestamp fields", async () => {
  const nowMs = 1_800_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000));
  const prefix = encoder.encode(timestamp + ".");
  const payload = new Uint8Array(prefix.length + rawBody.length);
  payload.set(prefix);
  payload.set(rawBody, prefix.length);
  const digest = await hmacSha512Hex(webhookSecret, payload);
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: `t=${timestamp},t=${timestamp},v1=whk_current:${digest}`,
    legacySignature: null,
    rawBody,
    webhookSecret,
    secretKey,
    nowMs,
  });
  assertEquals(accepted, false);
});

Deno.test("rejects non-decimal timestamp values", async () => {
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: "t=1e9,v1=whk_current:" + "a".repeat(128),
    legacySignature: null,
    rawBody,
    webhookSecret,
    secretKey,
  });
  assertEquals(accepted, false);
});

Deno.test("rejects malformed legacy signatures", async () => {
  const accepted = await verifyPaystackWebhookSignature({
    modernSignature: null,
    legacySignature: "not-a-signature",
    rawBody,
    webhookSecret: "",
    secretKey,
  });
  assertEquals(accepted, false);
});
