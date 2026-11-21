export type GenericNotificationPreference = {
  user_id: string;
  enabled: boolean;
  phone_notifications_enabled: boolean;
};

export type ParentAttendancePreference = GenericNotificationPreference & {
  parent_guardian_id: string;
};

export function selectPushRecipients(input: {
  eventType: string;
  recipientIds: string[];
  parentGuardianId?: string | null;
  genericPreferences: GenericNotificationPreference[];
  parentAttendancePreferences: ParentAttendancePreference[];
}): string[] {
  const recipients = new Set(input.recipientIds);
  const preferences = input.eventType === "attendance"
    ? input.parentAttendancePreferences.filter((row) =>
      row.parent_guardian_id === input.parentGuardianId
    )
    : input.genericPreferences;

  return [...new Set(preferences
    .filter((row) => recipients.has(row.user_id) && row.enabled && row.phone_notifications_enabled)
    .map((row) => row.user_id))];
}
