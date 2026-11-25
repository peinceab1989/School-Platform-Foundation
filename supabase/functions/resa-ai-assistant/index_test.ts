import { assertEquals } from "jsr:@std/assert@1";
import { validateMessages } from "./index.ts";

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
