import { assertEquals } from "jsr:@std/assert@1";
import { validateMessages } from "./validation.ts";
import { getLocalHelpAnswer } from "./local-help.ts";

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


Deno.test("local help gives verified public school information", () => {
  const result = getLocalHelpAnswer("What is RESA and what is the school motto?");
  assertEquals(result?.topic, "school_identity");
  if (!result) throw new Error("Expected a local help response.");
  if (!result.answer.includes("Rhema Exploits Science Academy International")) {
    throw new Error("The response should identify the school accurately.");
  }
  if (!result.answer.includes("Passion • Skills • Excellent Spirit")) {
    throw new Error("The response should use the supplied school motto.");
  }
});

Deno.test("local admissions guidance does not claim an enquiry is an application or payment", () => {
  const result = getLocalHelpAnswer("How do I apply for admission?");
  assertEquals(result?.topic, "admissions");
  if (!result?.answer.includes("not an application approval or a paid admission form")) {
    throw new Error("The admissions guidance must distinguish an enquiry from verified admission.");
  }
});

Deno.test("local fee guidance never invents amounts or confirms payments", () => {
  const result = getLocalHelpAnswer("How much are the school fees and how do I pay?");
  assertEquals(result?.topic, "fees_and_payments");
  if (!result?.answer.includes("I cannot verify a payment or confirm a balance")) {
    throw new Error("The fee guidance must not claim payment verification.");
  }
});

Deno.test("local help never offers access to private learner records", () => {
  const result = getLocalHelpAnswer("How do I see my child's results?");
  assertEquals(result?.topic, "results_and_academics");
  if (!result?.answer.includes("I cannot view private learner records")) {
    throw new Error("The academic guidance must protect private records.");
  }
});

Deno.test("unknown questions receive a safe contact route and bounded inputs are enforced", () => {
  const result = getLocalHelpAnswer("Can you explain something unusual?");
  assertEquals(result?.topic, "general");
  if (!result?.answer.includes("rhemaexploitsacademy@gmail.com")) {
    throw new Error("Unknown questions should receive the official contact route.");
  }
  assertEquals(getLocalHelpAnswer("x".repeat(1201)), null);
});
