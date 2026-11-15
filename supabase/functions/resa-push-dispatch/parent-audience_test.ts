import { assertEquals } from "jsr:@std/assert@1";
import { resolveEligibleParentUserIds } from "./parent-audience.ts";

const base = {
  studentLinks: [{ parent_guardian_id: "guardian-a" }, { parent_guardian_id: "guardian-b" }],
  activeAccess: [
    { parent_guardian_id: "guardian-a", is_active: true },
    { parent_guardian_id: "guardian-b", is_active: true },
  ],
  guardians: [
    { id: "guardian-a", person_id: "person-a", portal_enabled: true },
    { id: "guardian-b", person_id: "person-b", portal_enabled: true },
  ],
  people: [
    { id: "person-a", user_id: "user-a" },
    { id: "person-b", user_id: "user-b" },
  ],
  accounts: [
    { parent_guardian_id: "guardian-a", user_id: "user-a", is_active: true },
    { parent_guardian_id: "guardian-b", user_id: "user-b", is_active: true },
  ],
  memberships: [
    { user_id: "user-a", role: "parent", status: "active" },
    { user_id: "user-b", role: "parent", status: "active" },
  ],
};

Deno.test("allows only fully active linked parent accounts", () => {
  assertEquals(resolveEligibleParentUserIds(base), ["user-a", "user-b"]);
});

Deno.test("denies a suspended parent membership", () => {
  assertEquals(resolveEligibleParentUserIds({
    ...base,
    memberships: [{ user_id: "user-a", role: "parent", status: "suspended" }],
  }), []);
});

Deno.test("denies disabled guardian and inactive child access", () => {
  assertEquals(resolveEligibleParentUserIds({
    ...base,
    guardians: [{ ...base.guardians[0], portal_enabled: false }, base.guardians[1]],
    activeAccess: [{ parent_guardian_id: "guardian-a", is_active: false }, base.activeAccess[1]],
  }), ["user-b"]);
});

Deno.test("denies account/person identity mismatch", () => {
  assertEquals(resolveEligibleParentUserIds({
    ...base,
    accounts: [{ ...base.accounts[0], user_id: "other-user" }, base.accounts[1]],
  }), ["user-b"]);
});

Deno.test("attendance scope cannot notify a different linked guardian", () => {
  assertEquals(resolveEligibleParentUserIds({
    ...base,
    requestedGuardianIds: ["guardian-b"],
  }), ["user-b"]);
});

Deno.test("denies a guardian without an active parent membership", () => {
  assertEquals(resolveEligibleParentUserIds({
    ...base,
    memberships: [{ user_id: "user-a", role: "teacher", status: "active" }],
  }), []);
});
