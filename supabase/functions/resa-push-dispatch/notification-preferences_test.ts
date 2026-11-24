import { assertEquals } from "jsr:@std/assert@1";
import { selectPushRecipients } from "./notification-preferences.ts";

Deno.test("attendance push uses the parent's attendance preference, not generic preference", () => {
  const recipients = selectPushRecipients({
    eventType: "attendance",
    recipientIds: ["parent-user", "other-user"],
    parentGuardianId: "guardian-1",
    genericPreferences: [
      { user_id: "parent-user", enabled: true, phone_notifications_enabled: false },
      { user_id: "other-user", enabled: true, phone_notifications_enabled: true },
    ],
    parentAttendancePreferences: [
      { user_id: "parent-user", parent_guardian_id: "guardian-1", enabled: true, phone_notifications_enabled: true },
      { user_id: "other-user", parent_guardian_id: "guardian-2", enabled: true, phone_notifications_enabled: true },
    ],
  });
  assertEquals(recipients, ["parent-user"]);
});

Deno.test("attendance push respects a parent's disabled or phone-disabled preference", () => {
  const recipients = selectPushRecipients({
    eventType: "attendance",
    recipientIds: ["parent-user"],
    parentGuardianId: "guardian-1",
    genericPreferences: [],
    parentAttendancePreferences: [
      { user_id: "parent-user", parent_guardian_id: "guardian-1", enabled: true, phone_notifications_enabled: false },
    ],
  });
  assertEquals(recipients, []);
});

Deno.test("other RESA push events continue using general notification preferences", () => {
  const recipients = selectPushRecipients({
    eventType: "chat_message",
    recipientIds: ["teacher-user", "parent-user"],
    genericPreferences: [
      { user_id: "teacher-user", enabled: true, phone_notifications_enabled: true },
      { user_id: "parent-user", enabled: false, phone_notifications_enabled: true },
    ],
    parentAttendancePreferences: [
      { user_id: "parent-user", parent_guardian_id: "guardian-1", enabled: true, phone_notifications_enabled: true },
    ],
  });
  assertEquals(recipients, ["teacher-user"]);
});
