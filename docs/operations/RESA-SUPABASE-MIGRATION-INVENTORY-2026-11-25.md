# RESA Supabase migration inventory — 25 November 2026

> Read-only snapshot. This document is an inventory, not an instruction to apply, skip, delete, rename, or insert migration history.

## Counts

| Source | Versions/files | Exact versions present in live registry | Source versions absent from live registry |
|---|---:|---:|---:|
| Live Supabase registry | 133 | — | — |
| Root deployment directory `supabase/migrations/` | 57 | 37 | 20 |
| Workspace directory `artifacts/school-platform/supabase/migrations/` | 54 | 8 | 46 |

Live versions with no exact version match in root deployment directory: 96.
Live versions with no exact version match in workspace directory: 125.

## Live versions missing from root deployment directory

- 20261024051415 — add_secure_teacher_suspension
- 20261024051428 — restrict_teacher_suspension_rpc
- 20261025075623 — add_unsuspend_school_teacher
- 20261027061113 — restrict_student_result_visibility
- 20261027173328 — secure_school_message_contact_lookup
- 20261027175644 — pin_resa_test_function_search_path
- 20261027210107 — restrict_unpublished_announcements
- 20261027211829 — secure_school_message_delivery
- 20261029031544 — add_form_teacher_assignments_and_attendance_access
- 20261029031734 — support_people_linked_form_teachers
- 20261029063220 — teacher_assigned_results_access
- 20261029064246 — teacher_assigned_results_access
- 20261029064930 — resa_teaching_materials_library
- 20261029065309 — resa_student_published_material_file_access
- 20261029065420 — resa_scope_student_materials_to_enrolled_class
- 20261029065454 — resa_require_admin_to_publish_materials
- 20261029065819 — resa_dashboard_chat_with_admin_control
- 20261029070018 — resa_fix_chat_conversation_school_scope
- 20261029070030 — resa_validate_chat_target_membership
- 20261029070146 — resa_allow_direct_chat_with_admin
- 20261029070300 — resa_enable_realtime_chat_messages
- 20261029070644 — resa_chat_message_notifications
- 20261029073450 — student_messaging_access_and_customer_care
- 20261029074033 — secure_customer_care_and_message_metadata
- 20261029074140 — allow_admin_customer_care_initiation
- 20261029074359 — restrict_internal_messaging_access_check
- 20261029074450 — harden_message_helper_search_paths
- 20261029111624 — enable_resa_drive_video_and_file_uploads
- 20261029125943 — add_student_parent_attendance_read_policies
- 20261029130722 — admin_customer_care_toggle
- 20261031080029 — resa_profile_photos
- 20261031080143 — secure_published_assignment_visibility
- 20261031114150 — restrict_student_and_people_directory_reads
- 20261031135213 — harden_biometric_primary_keys_and_public_rpc
- 20261031135333 — reuse_biometric_event_primary_key
- 20261031173658 — cbt_exam_term_link
- 20261031173702 — cbt_result_transfer_audit
- 20261031173712 — cbt_result_transfer_rpc
- 20261031173720 — cbt_written_answer_marking_rpc
- 20261031173955 — student_subject_result_uuid_default
- 20261031175815 — cbt_transfer_grade_alignment
- 20261031175850 — protect_transferred_cbt_exam_links
- 20261102121714 — refresh_cbt_score_after_theory_marking
- 20261104081659 — student_assignment_submission_insert_policy
- 20261104082207 — secure_teacher_assignment_grading
- 20261104095113 — student_id_card_permissions
- 20261104095246 — student_id_card_photo_storage
- 20261104095633 — student_card_upload_school_folder
- 20261104095644 — student_card_read_photo_policy
- 20261104095715 — student_card_upload_school_folder_fix
- 20261104100918 — resa_practical_assessment_support
- 20261104101124 — link_practical_grades_to_academic_results
- 20261104101541 — tighten_student_id_card_read_access
- 20261104101908 — share_resa_drive_media_with_school_members
- 20261104102810 — allow_assigned_teachers_to_read_practical_scores
- 20261104102843 — allow_assigned_teachers_to_read_practical_evidence
- 20261104105006 — tighten_student_id_card_photo_access
- 20261105073713 — restrict_private_resa_drive_metadata
- 20261105110035 — allow_announcement_channel_in_school_messages
- 20261105111436 — add_admin_managed_resa_chat_groups
- 20261105111453 — add_secure_admin_group_creation_rpc
- 20261105111606 — allow_parent_members_to_view_chat_status
- 20261105111743 — allow_parent_admin_direct_chat
- 20261105112537 — resa_chat_media_and_per_user_read_receipts
- 20261105112549 — fix_resa_chat_media_storage_policy_scope
- 20261105112712 — allow_chat_participants_to_see_receipts
- 20261105113154 — fix_resa_chat_media_path_validation
- 20261108093209 — enforce_assignment_deadlines_on_submission
- 20261108094853 — atomic_verified_fee_receipts
- 20261108101629 — resa_admissions_external_cbt_foundation
- 20261108104934 — resa_secure_smart_access_safeguarding
- 20261108105051 — resa_drive_free_plan_upload_limit
- 20261108110543 — resa_atomic_student_class_enrolments
- 20261108110734 — resa_atomic_student_class_enrolments
- 20261108112802 — resa_parent_staff_qr_id_cards
- 20261108113809 — resa_attendance_customer_care_alerts
- 20261108131649 — resa_staff_appointment_letter_permissions
- 20261108153404 — stable_resa_id_card_qr_references
- 20261111104433 — resa_expand_background_push_events
- 20261111104645 — jetab_engine_room_command_centre
- 20261111104853 — fix_jetab_engine_room_audit_delete
- 20261115060828 — scope_public_customer_care_status_to_resa
- 20261115102316 — allow_school_visibility_for_resa_drive
- 20261120092928 — harden_parent_portal_access_helpers_20261120
- 20261120093152 — scope_teacher_student_record_access_20261120
- 20261120095002 — idempotent_verified_fee_payments_20261120
- 20261120095527 — require_active_membership_for_chat_access_20261120
- 20261120100006 — scope_child_collection_and_parent_qr_20261120
- 20261120100227 — scope_qr_attendance_operator_20261120
- 20261120100440 — parent_policies_use_hardened_helpers_20261120
- 20261125142207 — resa_staff_appointments_and_responsibilities
- 20261125142243 — restrict_staff_appointments_table_grants
- 20261125161548 — multi_gateway_payment_foundation
- 20261125161557 — proprietor_payment_gateway_vault
- 20261125161601 — secure_payment_gateway_vault_rpc
- 20261125161604 — one_active_fee_checkout

## Root deployment files absent from live registry

- `20261031000100_cbt_results_integration.sql`
- `20261031000200_student_subject_result_uuid_default.sql`
- `20261031153000_reuse_biometric_event_primary_key.sql`
- `20261031170000_cbt_transfer_grade_alignment.sql`
- `20261031171000_protect_transferred_cbt_exam_links.sql`
- `20261102090000_school_contact_settings.sql`
- `20261102130000_refresh_cbt_score_after_theory_marking.sql`
- `20261105073000_staff_can_view_own_attendance.sql`
- `20261105080000_enable_student_attendance_dashboard_realtime.sql`
- `20261105090000_persist_parent_attendance_notification_preferences.sql`
- `20261105100000_add_attendance_audit_fk_indexes.sql`
- `20261105110000_scope_student_teaching_material_access_to_enrolment.sql`
- `20261105120000_index_teaching_material_storage_path.sql`
- `20261105150000_index_supabase_advisor_foreign_keys.sql`
- `20261105160000_optimize_auth_rls_policy_initplans.sql`
- `20261105170000_align_attendance_notifications_with_in_app_delivery.sql`
- `20261108170000_stable_resa_id_card_qr_references.sql`
- `20261110150000_resa_expand_background_push_events.sql`
- `20261111104840_fix_jetab_engine_room_audit_delete.sql`
- `20261111180000_jetab_engine_room_command_centre.sql`

## Workspace files absent from live registry

- `20261005000000_foundation_access.sql`
- `20261027000000_cctv_monitoring.sql`
- `20261027010000_staff_print_permissions.sql`
- `20261027020000_restrict_unpublished_announcements.sql`
- `20261027030000_secure_school_message_delivery.sql`
- `20261029000000_results_publication_workflow.sql`
- `20261029010000_teacher_assigned_results_access.sql`
- `20261029020000_resa_teaching_materials_library.sql`
- `20261029030000_resa_dashboard_chat.sql`
- `20261029040000_resa_chat_message_notifications.sql`
- `20261029050000_student_messaging_access_and_customer_care.sql`
- `20261029060000_secure_customer_care_and_message_metadata.sql`
- `20261029070000_allow_admin_customer_care_initiation.sql`
- `20261029080000_restrict_internal_messaging_access_check.sql`
- `20261029090000_harden_message_helper_search_paths.sql`
- `20261029140000_admin_customer_care_toggle.sql`
- `20261031090000_resa_profile_photos.sql`
- `20261031100000_secure_published_assignment_visibility.sql`
- `20261102010000_role_targeted_school_notifications.sql`
- `20261104110000_student_assignment_submission_insert_policy.sql`
- `20261104113000_secure_teacher_assignment_grading.sql`
- `20261104130000_student_id_card_permissions.sql`
- `20261104131000_student_id_card_photo_storage.sql`
- `20261104133000_practical_assessment_support.sql`
- `20261104134000_link_practical_grades_to_results.sql`
- `20261104135000_share_resa_drive_media_with_school.sql`
- `20261104135000_tighten_student_id_card_access.sql`
- `20261104136000_allow_assigned_teachers_read_practical_scores.sql`
- `20261104137000_allow_assigned_teachers_read_practical_evidence.sql`
- `20261104138000_tighten_student_id_card_photo_access.sql`
- `20261108111000_resa_atomic_student_class_enrolments.sql`
- `20261108124000_resa_parent_staff_qr_id_cards.sql`
- `20261108130000_resa_attendance_customer_care_alerts.sql`
- `20261108130000_staff_appointment_letter_permissions.sql`
- `20261108153000_atomic_verified_fee_receipts.sql`
- `20261108170000_resa_admissions_external_cbt.sql`
- `20261108220000_resa_secure_smart_access_safeguarding.sql`
- `20261108230000_resa_drive_free_plan_upload_limit.sql`
- `20261115110000_allow_school_visibility_for_resa_drive.sql`
- `20261120100000_idempotent_verified_fee_payments.sql`
- `20261120101500_require_active_membership_for_chat_access.sql`
- `20261120103000_harden_parent_portal_access_helpers.sql`
- `20261120110000_scope_teacher_student_record_access.sql`
- `20261120120000_scope_child_collection_and_parent_qr.sql`
- `20261120123000_scope_qr_attendance_operator.sql`
- `20261120130000_parent_policies_use_hardened_helpers.sql`

## Safety and required next steps

- Freeze production migration replay and new schema changes until source-of-truth is agreed.
- Retrieve exact historical SQL for every live version from repository history, deployment artifacts, and documented manual SQL Editor changes.
- Compare filename, version, SQL body and content hash; do not infer equivalence from timestamps or similar names.
- Build a reviewed immutable archive of exact applied SQL and separately identify unapplied files.
- Test a clean replay in an isolated Supabase project before any production reconciliation.
- Never insert/delete rows in `supabase_migrations.schema_migrations` or replay historical migrations as a shortcut.
- Preserve all existing RESA data, authentication, payment settings and Edge Function state.