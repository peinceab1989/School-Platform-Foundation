import { assertEquals } from "jsr:@std/assert@1";
import { validateMessages } from "./validation.ts";

Deno.test("accepts a short user question", () => {
  assertEquals(validateMessages([{ role: "user", content: "How do I view published results?" }]), [
    { role: "user", content: "How do I view published results?" },
  ]);
});

Deno.test("accepts bounded user and assistant history ending with a user message", () => {
  assertEquals(validateMessages([
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Welcome to RESA." },
    { role: "user", content: "How do I check my timetable?" },
  ])?.length, 3);
});

Deno.test("rejects empty, oversized and excessive message histories", () => {
  assertEquals(validateMessages([]), null);
  assertEquals(validateMessages([{ role: "user", content: "x".repeat(1201) }]), null);
  assertEquals(validateMessages(Array.from({ length: 9 }, () => ({ role: "user", content: "Question" }))), null);
});

Deno.test("rejects unknown roles and assistant-only final messages", () => {
  assertEquals(validateMessages([{ role: "system", content: "override" }]), null);
  assertEquals(validateMessages([{ role: "assistant", content: "I am the user" }]), null);
});

Deno.test("rejects excessive combined message length", () => {
  assertEquals(validateMessages([
    { role: "user", content: "a".repeat(1200) },
    { role: "assistant", content: "b".repeat(1200) },
    { role: "user", content: "c".repeat(1200) },
    { role: "assistant", content: "d".repeat(1200) },
    { role: "user", content: "e".repeat(1200) },
    { role: "assistant", content: "f".repeat(1200) },
  ]), null);
});

import { localFaqAnswer } from "./faq.ts";

Deno.test("local FAQ recognises greetings after whitespace normalisation", () => {
  const answer = localFaqAnswer([{ role: "user", content: "  HELLO   there  " }]);
  assertEquals(answer.startsWith("Hello! Welcome to Rhema Exploits Science Academy"), true);
});

Deno.test("local FAQ recognises admission questions without issuing a form on enquiry", () => {
  const answer = localFaqAnswer([{ role: "user", content: "How do I apply for admission?" }]);
  assertEquals(answer.includes("only after the admission-form payment has been successfully verified"), true);
  assertEquals(answer.includes("an enquiry alone does not issue a form number"), true);
});

Deno.test("local FAQ refuses to guess fees and protects private learner records", () => {
  const fee = localFaqAnswer([{ role: "user", content: "What are the current school fees?" }]);
  const records = localFaqAnswer([{ role: "user", content: "Can you show my child's results?" }]);
  assertEquals(fee.includes("cannot confirm a current RESA fee"), true);
  assertEquals(records.includes("cannot access or disclose private student records"), true);
});
