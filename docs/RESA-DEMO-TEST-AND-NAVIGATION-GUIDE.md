# RESA Demo Test & Portal Navigation Guide

**Test date:** 2 November 2026  
**Portal:** https://resa-school-portal.netlify.app/  
**School:** RHEMA EXPLOITS SCIENCE ACADEMY INT'L  
**Test environment:** Existing main RESA portal and existing DEMO records only  
**Test run reference:** bc6d6e5c-5d23-423e-969d-a7608fd055ad

> **DEMO DATA WARNING:** Every fee, payment, receipt, lesson note, announcement, message, theory assessment and report card created for this run is marked DEMO ONLY. The simulated ₦250 payment is not money received. Do not use these figures as real school accounts or official student results.

## 1. What was checked and prepared

| Area | Result |
|---|---|
| JSS 1, JSS 2 and JSS 3 subject coverage | 14 of 14 subjects assigned in each class |
| New teacher assignments | 39 additional assignment rows, all restricted to JSS 1–JSS 3 |
| Teacher accounts used for new assignments | DEMO Teacher Chukwudi and DEMO Teacher Osas; both have active teacher memberships |
| Existing JSS 1 assignments | Preserved; JSS 1 has 15 assignment rows because Basic Science already had two teachers |
| DEMO lesson material | Published JSS 1 Computer Studies lesson note on digital safety and strong passwords |
| Existing published DEMO assignments | 3 assignments with 18 graded submissions in total |
| Objective CBT | 6 submitted DEMO attempts, 10 questions each; scores 9/10, 8/10, 10/10, 7/10, 9/10 and 8/10 |
| Theory examination | 1 published DEMO theory exam, 2 written questions, 6 submitted attempts and 12 manually marked answers |
| Continuous assessment and term results | 6 DEMO students × 14 subjects = 84 subject-result rows; all CA and examination marks present |
| Result workflow | All 6 DEMO term results moved to published |
| Parent notice and messages | 1 published DEMO announcement, 1 school-to-parent private message and 1 teacher-to-student private message |
| Parent fees | 1 DEMO fee assignment, simulated partial payment and DEMO receipt |
| Build check | TypeScript and production build passed in GitHub Actions run 544 |

### Important coverage limits

- The six existing DEMO students are all in **JSS 1**. There are no DEMO students enrolled in JSS 2 or JSS 3, so those classes have teacher-subject assignments but no DEMO report cards.
- Only **one of the six DEMO student accounts** is currently active for portal sign-in.
- Only **one of the six DEMO parent records** currently has an active parent portal account. That account is linked to DEMO student Samuel Ojo.
- DEMO Teacher Chukwudi and DEMO Teacher Osas have active teacher memberships. DEMO Teacher Amina has no linked login account.
- The database records and workflows were checked directly. A live, authenticated browser session was not available for every teacher, student and parent account, so the sign-in screens and every role's visual experience still need a final hands-on check.
- The AI practice function has been corrected so the lesson text is passed into the question-generation prompt. Actual AI generation was not invoked because the OpenAI secret/quota was not verified and a live request may incur provider charges.
- Browser notifications can work while the portal is open after permission is granted. Background push, email and WhatsApp delivery are not confirmed as configured.
- The portal does not currently provide online card/bank checkout. The fee screen records payments already verified by RESA Finance.

## 2. Teacher assignment procedure

1. Sign in using an administrator account.
2. Open **Teaching Assignments** (/teaching-assignments).
3. Select the active academic session.
4. Select the teacher.
5. Select the class: JSS 1, JSS 2 or JSS 3.
6. Select a subject that belongs to that class.
7. Save the assignment.
8. Repeat for each teacher/class/subject combination.
9. Refresh the list and confirm that each class shows all 14 subjects and the correct teacher.
10. Do not create assignments for other classes unless the school has approved them.

For this DEMO run, 39 missing assignments were added. Existing assignments were retained. JSS 1 Basic Science already had two existing assignments (Ihide Abraham and DEMO Teacher Amina), so JSS 1 shows 15 assignment rows for 14 unique subjects. JSS 2 and JSS 3 each have 14 assignment rows for 14 subjects.

## 3. Lesson notes, learning materials and AI practice drills

1. Open **Teaching Materials** (/teaching-materials) as an administrator or authorised teacher.
2. Choose the class and subject.
3. Add a descriptive title and topic.
4. Upload a readable document or paste the lesson text into the material content field.
5. Save the material.
6. Review the text for accuracy and publish it when ready.
7. Use the AI practice/question-generation action to request a question set from the selected material.
8. Review every generated question, answer and explanation before publishing or assigning it to learners.
9. Open the student practice-drill area to verify that the learner can see the drill.

A DEMO Computer Studies lesson note on digital safety and strong passwords was published for JSS 1 by assigned DEMO Teacher Chukwudi. The earlier Basic Science test note was unpublished after setup so the active lesson-material test uses a subject assigned to the uploading teacher. The AI Edge Function was updated to use the supplied lesson text as the primary source, rather than generating generic questions from only a topic label. **The actual AI provider request remains untested** until the school confirms the API secret and acceptable usage budget.

## 4. Assignments and continuous assessment

1. The teacher signs in and opens the teacher dashboard.
2. Confirm that the assigned class and subjects appear.
3. Open the assignments area.
4. Create an assignment with a clear title, instructions, class, subject, due date and maximum score.
5. Save it as a draft, review it, then publish it.
6. A learner opens **Student Assignments** (/student-assignments), reads the task and submits the work.
7. The teacher opens the submission list, reviews each submission and records marks.
8. Check that the graded work is reflected in the appropriate assessment workflow.

Three existing DEMO assignments had 18 graded submissions in total (six per assignment). Two older assignment records had no submissions; they were left unchanged.

## 5. CBT and theory examination procedure

### Create and publish an examination

1. Open **Examinations** (/examinations) as an administrator.
2. Create an examination and select its academic session, term, class and subject.
3. Set the title, instructions, duration, total marks and availability dates.
4. Open **Manage questions**.
5. Add questions and ensure that the sum of question marks equals the examination total.
6. Review the questions and answers.
7. Publish the examination only after the questions and schedule are correct.

### Student examination procedure

1. The student signs in and opens **Student CBT** (/student-cbt).
2. The student selects an available published examination.
3. The student starts the attempt, answers the questions and submits before the timer expires.
4. Objective multiple-choice answers are automatically marked.
5. Written/theory answers are saved for manual marking.

### Mark theory answers and transfer marks

1. Open **Examinations** and scroll to **CBT submissions & result transfer**.
2. Select **Review / mark** for a submitted attempt.
3. Read each written answer and enter a mark within the maximum shown.
4. Save each written mark.
5. Transfer a complete attempt only when all written answers are marked and the question total matches the exam total.
6. Confirm that the result appears in the correct student's term and subject record.

The six DEMO objective attempts were already submitted. A separate DEMO theory examination was prepared with two written questions; all 12 written answers were marked. The six existing Computer Studies result rows already contain examination scores, so the transfer function correctly refuses to overwrite them. The separate theory scores were therefore not substituted into those existing term results.

## 6. Results, CA, approval and printing

1. Open **Results Management** (/results-management).
2. Select the academic session and term.
3. Select the class.
4. Select the student and subject.
5. Enter the continuous-assessment mark and examination mark within the configured maximums.
6. Save and review the total and grade.
7. Complete all subjects for the learner.
8. Submit the result for approval.
9. An authorised administrator reviews the broadsheet and approves the result.
10. Publish only after all scores, names, positions and remarks have been checked.
11. Use the print action/browser print to print the report card or broadsheet.

For this DEMO run, all six JSS 1 DEMO results have 14 subject rows each, with no missing CA or examination marks. They were moved through draft → submitted → approved → published. Their report cards are sample records only and must not be treated as official school results.

Parents with active linked accounts can open **Published Results** (/my-results) to view and print their linked learner's report card.

## 7. Parent and guardian setup

1. Open **Parent Management** (/parent-management) or the **Staff & other users** tab in School Settings.
2. Find or register the parent/guardian record.
3. Confirm the parent's current email address and phone number.
4. Link the parent to the correct student.
5. Send the portal invitation.
6. The parent must accept the invitation and set a password before the portal account becomes active.
7. Confirm that the parent portal account and parent-school membership are active.
8. Confirm that the correct child is linked.
9. Ask the parent to sign in using the current registered email or registered phone/login ID and their password.
10. The parent should land on the Parent & Guardian Dashboard (/parent-dashboard).
11. Use the visible **Sign out** button to end the session.

The parent dashboard includes fee summaries, payments, receipts, attendance, published announcements, results, messages and notifications. The default parent landing route was corrected to open the parent dashboard instead of the separate school-monitoring page.

## 8. School fees and receipts

1. Open **School Services** (/school-services).
2. Select **Fees & Payments**.
3. Choose **Open fee management** (/fees-management).
4. Create a fee type with a clear name, amount and description.
5. Assign the fee to the correct student and academic session.
6. Enter the due date and verify the amount before saving.
7. The system creates parent fee visibility for active parent-child portal links.
8. When Finance has verified that a payment was actually received, select the student's outstanding fee.
9. Enter the amount received, payment method and reference (if applicable).
10. Record the payment and issue the receipt.
11. View/print the receipt and refresh the fee register.
12. Ask the parent to open the dashboard and confirm the fee, payment and outstanding balance.

**Never record a real payment before Finance has verified receipt of funds.** This portal does not currently perform online card or bank checkout.

The DEMO fee example is ₦1,000 due, ₦250 simulated payment, ₦750 outstanding and receipt DEMO-RECEIPT-2026-0001. It is a fictional test only.

## 9. Messages, announcements and notifications

- **Announcements:** administrator opens /announcements, creates a notice, reviews it and publishes it.
- **Messages:** authorised users open /school-communication to send private school messages.
- **Notifications:** open /notifications to view received private messages and published announcements.
- **Browser alerts:** select **Enable browser alerts** and grant permission on the device. Alerts work while the portal is open.
- **External delivery:** email, WhatsApp and reliable background push require a configured external notification service; do not assume they are active.

Two DEMO private messages and one published DEMO announcement were created for this test.

## 10. Attendance and parent monitoring

1. Administrator opens **Attendance** (/attendance) to review class attendance.
2. An authorised form teacher opens **Form Teacher Attendance** (/form-teacher-attendance) for an assigned class.
3. Select the date and class.
4. Mark each learner accurately and save.
5. Review attendance summaries.
6. A parent can see attendance for linked learners in the Parent Dashboard when attendance records are available.

The existing six DEMO JSS 1 students each had one attendance record dated 31 October 2026. Five were recorded present and one late.

## 11. DEMO JSS 1 broadsheet

| Position | Student | Admission no. | Total / 1,400 | Average | Result state |
|---:|---|---|---:|---:|---|
| 1 | DEMO Favour Ibrahim | DEMO-RESA-2026-004 | 1,162 | 83.00% | Published |
| 2 | DEMO Daniel Aigbe | DEMO-RESA-2026-002 | 1,158 | 82.71% | Published |
| 3 | DEMO Ada Okafor | DEMO-RESA-2026-001 | 1,156 | 82.57% | Published |
| 4 | DEMO Samuel Ojo | DEMO-RESA-2026-006 | 1,147 | 81.93% | Published |
| 5 | DEMO Grace Omoregie | DEMO-RESA-2026-005 | 1,145 | 81.79% | Published |
| 6 | DEMO David Eze | DEMO-RESA-2026-003 | 1,141 | 81.50% | Published |

Each student's individual report contains all 14 subjects with CA, examination mark, total and grade. The detailed printable cards are supplied separately in the accompanying PDF.

## 12. Final launch-readiness actions still required

1. Activate the remaining five DEMO parent portal accounts through the normal invitation/acceptance process if they are still needed for testing.
2. Activate or link the remaining DEMO student portal accounts if they are still needed for student-side testing.
3. Create clearly labelled JSS 2 and JSS 3 DEMO learners only if the school wants sample report cards for those classes.
4. Test teacher, student and parent sign-ins through the actual portal using their own current passwords.
5. Confirm the AI provider secret and approve a usage budget before running a live AI generation request.
6. Configure and test any desired email, WhatsApp or background push provider.
7. Configure official school fee types, real student charges and confirmed payment instructions only after Finance approves them.
8. Verify the latest Netlify deployment before declaring the portal launch-ready.
9. Keep the DEMO dataset separate from official school records; clean test data only when the school explicitly authorises the cleanup.

**Build evidence:** GitHub Actions run 544 completed successfully: https://github.com/peinceab1989/School-Platform-Foundation/actions/runs/41442376228
