
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link } from 'wouter';
import UnreadMessageBadge from '@/components/unread-message-badge';
import ProfilePhotoCard from '@/components/profile-photo-card';
import { getSupabaseClient } from '@/lib/supabase/client';

type TeacherStaff = {
  id: string;
  person_id: string;
  staff_number: string | null;
  job_title: string | null;
  department: string | null;
  status: string | null;
};

type TeachingAssignment = {
  id: string;
  staff_id: string;
  academic_session_id: string;
  class_id: string;
  subject_id: string;
};

type SchoolClass = {
  id: string;
  name: string;
  level: string | null;
};

type SchoolSubject = {
  id: string;
  name: string;
};

type Homework = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  status: string;
  class_id: string;
  subject_id: string;
  max_score: number;
};

type TimetableEntry = {
  id: string;
  class_id: string;
  subject_id: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  room?: string | null;
};

type OnlineExam = {
  id: string;
  title: string;
  class_id: string;
  subject_id: string;
  instructions: string | null;
  duration_minutes: number | null;
  total_marks: number;
  status: string;
  start_at: string | null;
  end_at: string | null;
};

type ExamQuestion = {
  question_text: string;
  question_type: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  marks: number;
};

type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
};

type StudentRecord = {
  id: string;
  admission_number: string;
};

type StaffPrintPermission = { document_type: 'id_card' | 'admission_letter'; can_print: boolean };

type TeacherDashboardProps = {
  schoolId: string;
  schoolName?: string;
  email?: string;
  userId: string;
  onSignOut: () => void;
};

const pageStyle = {
  minHeight: '100vh',
  padding: 16,
  background: '#f4f7f4',
  color: '#17251b',
  fontFamily: 'Arial, sans-serif',
  boxSizing: 'border-box' as const,
};

const panelStyle = {
  background: '#fff',
  border: '1px solid #e0e7e0',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  overflowWrap: 'anywhere' as const,
};

const buttonStyle = {
  border: 'none',
  borderRadius: 8,
  padding: '11px 15px',
  background: '#e6c66b',
  color: '#17251b',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#e9f0eb',
};

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  border: '1px solid #ccd8ce',
  borderRadius: 8,
  padding: 11,
  fontSize: 15,
  background: '#fff',
  color: '#17251b',
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 12,
};

const sectionTitleStyle = {
  marginTop: 0,
  color: '#123d2b',
};

const tabs = [
  'Overview',
  'Assignments',
  'Online CBT',
  'Marking',
  'Results',
  'Timetable',
] as const;

type TabName = (typeof tabs)[number];

const emptyQuestion = (): ExamQuestion => ({
  question_text: '',
  question_type: 'multiple_choice',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'A',
  marks: 1,
});

export default function TeacherDashboard({
  schoolId,
  schoolName,
  email,
  userId,
  onSignOut,
}: TeacherDashboardProps) {
  const [staff, setStaff] = useState<TeacherStaff | null>(null);
  const [printPermissions, setPrintPermissions] = useState({ id_card: false, admission_letter: false });
  const [printDocument, setPrintDocument] = useState<'id_card' | 'admission_letter' | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [teachingAssignments, setTeachingAssignments] = useState<
    TeachingAssignment[]
  >([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [assignments, setAssignments] = useState<Homework[]>([]);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  const [homeworkForm, setHomeworkForm] = useState({
    title: '',
    description: '',
    instructions: '',
    classId: '',
    subjectId: '',
    dueDate: '',
    maxScore: '100',
  });

  const [examForm, setExamForm] = useState({
    title: '',
    instructions: '',
    classId: '',
    subjectId: '',
    duration: '30',
    startAt: '',
    endAt: '',
  });

  const [questions, setQuestions] = useState<ExamQuestion[]>([
    emptyQuestion(),
  ]);

  const [grading, setGrading] = useState<
    Record<string, { score: string; feedback: string }>
  >({});

  const className = useCallback(
    (classId: string) =>
      classes.find((item) => item.id === classId)?.name ??
      'Class name unavailable',
    [classes],
  );

  const subjectName = useCallback(
    (subjectId: string) =>
      subjects.find((item) => item.id === subjectId)?.name ??
      'Subject name unavailable',
    [subjects],
  );

  const myClassIds = useMemo(
    () => new Set(teachingAssignments.map((item) => item.class_id)),
    [teachingAssignments],
  );

  const mySubjectIds = useMemo(
    () => new Set(teachingAssignments.map((item) => item.subject_id)),
    [teachingAssignments],
  );

  // A subject is available for a class only when the signed-in teacher
  // has an assignment linking that exact class and subject.
  const availableSubjectsForClass = useCallback(
    (classId: string) => {
      const allowedSubjectIds = new Set(
        teachingAssignments
          .filter((item) => item.class_id === classId)
          .map((item) => item.subject_id),
      );

      return subjects.filter((subject) =>
        allowedSubjectIds.has(subject.id),
      );
    },
    [teachingAssignments, subjects],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    setNoticeText(null);

    try {
      const client = getSupabaseClient();

      // Resolve the signed-in teacher's staff record.
      const { data: directStaff, error: directStaffError } = await client
        .from('staff')
        .select('id, person_id, staff_number, job_title, department, status')
        .eq('school_id', schoolId)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (directStaffError) throw directStaffError;

      let staffRecord = directStaff as TeacherStaff | null;

      if (!staffRecord) {
        const { data: person, error: personError } = await client
          .from('people')
          .select('id')
          .eq('school_id', schoolId)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (personError) throw personError;

        if (person?.id) {
          const { data: linkedStaff, error: linkedStaffError } =
            await client
              .from('staff')
              .select('id, staff_number, job_title, department, status')
              .eq('school_id', schoolId)
              .eq('person_id', person.id)
              .limit(1)
              .maybeSingle();

          if (linkedStaffError) throw linkedStaffError;

          staffRecord = linkedStaff as TeacherStaff | null;
        }
      }

      if (!staffRecord) {
        setStaff(null);
        setTeachingAssignments([]);
        setClasses([]);
        setSubjects([]);
        setTimetable([]);
        setAssignments([]);
        setExams([]);
        setSubmissions([]);
        setStudents([]);
        setNoticeText(
          'No staff record is linked to your account. Please ask an administrator to check your teacher profile.',
        );
        return;
      }

      setStaff(staffRecord);

      const { data: permissionRows, error: permissionError } = await client
        .from('staff_document_permissions')
        .select('document_type, can_print')
        .eq('school_id', schoolId)
        .eq('staff_id', staffRecord.id);
      if (permissionError) throw permissionError;
      const granted = { id_card: false, admission_letter: false };
      for (const permission of (permissionRows ?? []) as StaffPrintPermission[]) {
        granted[permission.document_type] = permission.can_print;
      }
      setPrintPermissions(granted);

      // Resolve the teacher's real name from the linked people record.
      const { data: teacherPerson, error: teacherPersonError } = await client
        .from('people')
        .select('first_name, middle_name, last_name')
        .eq('school_id', schoolId)
        .eq('id', staffRecord.person_id)
        .maybeSingle();

      if (teacherPersonError) throw teacherPersonError;

      const fullTeacherName = [
        teacherPerson?.first_name,
        teacherPerson?.middle_name,
        teacherPerson?.last_name,
      ].filter((part) => typeof part === 'string' && part.trim()).join(' ').trim();

      setTeacherName(fullTeacherName || null);

      // Honour the academic session selected in School Settings first.
      // Older data may still rely on academic_sessions.is_current, so keep
      // that as a safe fallback for schools that have not selected a default.
      const { data: schoolSettings, error: settingsError } = await (client as any)
        .from('school_settings')
        .select('current_academic_session_id')
        .eq('school_id', schoolId)
        .maybeSingle();

      if (settingsError) throw settingsError;

      let currentSessionId = schoolSettings?.current_academic_session_id ?? null;
      if (!currentSessionId) {
        const { data: currentSession, error: sessionError } = await client
          .from('academic_sessions')
          .select('id')
          .eq('school_id', schoolId)
          .eq('is_current', true)
          .limit(1)
          .maybeSingle();

        if (sessionError) throw sessionError;
        currentSessionId = currentSession?.id ?? null;
      }

      setCurrentSessionId(currentSessionId);

      // Teacher assignments determine the classes and subjects
      // this teacher is allowed to work with.
      const { data: teacherRows, error: teacherRowsError } = await client
        .from('teacher_assignments')
        .select(
          'id, staff_id, academic_session_id, class_id, subject_id',
        )
        .eq('school_id', schoolId)
        .eq('staff_id', staffRecord.id);

      if (teacherRowsError) throw teacherRowsError;

      const allTeacherRows = (teacherRows ?? []) as TeachingAssignment[];

      const sessionRows = currentSessionId
        ? allTeacherRows.filter(
            (item) => item.academic_session_id === currentSessionId,
          )
        : allTeacherRows;

      setTeachingAssignments(sessionRows);

      const [timetableResult, homeworkResult, examResult] =
        await Promise.all([
          client
            .from('class_timetables')
            .select(
              'id, class_id, subject_id, day_of_week, start_time, end_time, room',
            )
            .eq('school_id', schoolId)
            .eq('staff_id', staffRecord.id),

          client
            .from('assignments')
            .select(
              'id, title, description, instructions, due_date, status, class_id, subject_id, max_score',
            )
            .eq('school_id', schoolId)
            .eq('staff_id', staffRecord.id)
            .order('created_at', { ascending: false }),

          client
            .from('online_exams')
            .select(
              'id, title, class_id, subject_id, instructions, duration_minutes, total_marks, status, start_at, end_at',
            )
            .eq('school_id', schoolId)
            .eq('created_by', userId)
            .order('created_at', { ascending: false }),
        ]);

      if (timetableResult.error) throw timetableResult.error;
      if (homeworkResult.error) throw homeworkResult.error;

      if (examResult.error) {
        setNoticeText(
          'Your profile and teaching records loaded. Online exam records could not be listed under the current database permissions. An administrator may need to review the existing exam access policies.',
        );
      }

      const timetableRows = (timetableResult.data ??
        []) as TimetableEntry[];
      const homeworkRows = (homeworkResult.data ?? []) as Homework[];
      const examRows = (examResult.data ?? []) as OnlineExam[];

      setTimetable(timetableRows);
      setAssignments(homeworkRows);
      setExams(examRows);

      const classIds = [
        ...new Set([
          ...sessionRows.map((item) => item.class_id),
          ...timetableRows.map((item) => item.class_id),
          ...homeworkRows.map((item) => item.class_id),
          ...examRows.map((item) => item.class_id),
        ]),
      ];

      const subjectIds = [
        ...new Set([
          ...sessionRows.map((item) => item.subject_id),
          ...timetableRows.map((item) => item.subject_id),
          ...homeworkRows.map((item) => item.subject_id),
          ...examRows.map((item) => item.subject_id),
        ]),
      ];

      if (classIds.length) {
        const { data, error } = await client
          .from('school_classes')
          .select('id, name, level')
          .eq('school_id', schoolId)
          .in('id', classIds);

        if (error) throw error;

        setClasses((data ?? []) as SchoolClass[]);
      } else {
        setClasses([]);
      }

      // FIX: Subject records are stored in the actual "subjects" table.
      // Class-to-subject access comes from teacher_assignments, not
      // from a class_id column on the subjects table.
      if (subjectIds.length) {
        const { data, error } = await client
          .from('subjects')
          .select('id, name')
          .eq('school_id', schoolId)
          .in('id', subjectIds);

        if (error) throw error;

        setSubjects((data ?? []) as SchoolSubject[]);
      } else {
        setSubjects([]);
      }

      // Load submissions only for assignments belonging to this teacher.
      const homeworkIds = homeworkRows.map((item) => item.id);

      if (homeworkIds.length) {
        const { data, error } = await client
          .from('assignment_submissions')
          .select(
            'id, assignment_id, student_id, submission_text, attachment_url, submitted_at, score, feedback, status',
          )
          .eq('school_id', schoolId)
          .in('assignment_id', homeworkIds)
          .order('created_at', { ascending: false });

        if (error) {
          setSubmissions([]);
          setNoticeText(
            'Your teaching records loaded, but submissions could not be listed. An administrator may need to review submission access permissions.',
          );
        } else {
          const submissionRows = (data ?? []) as Submission[];

          setSubmissions(submissionRows);

          const studentIds = [
            ...new Set(submissionRows.map((item) => item.student_id)),
          ];

          if (studentIds.length) {
            const { data: studentRows, error: studentError } =
              await client
                .from('students')
                .select('id, admission_number')
                .eq('school_id', schoolId)
                .in('id', studentIds);

            if (!studentError) {
              setStudents((studentRows ?? []) as StudentRecord[]);
            }
          } else {
            setStudents([]);
          }

          setGrading((previous) => {
            const next = { ...previous };

            for (const submission of submissionRows) {
              if (!next[submission.id]) {
                next[submission.id] = {
                  score:
                    submission.score === null
                      ? ''
                      : String(submission.score),
                  feedback: submission.feedback ?? '',
                };
              }
            }

            return next;
          });
        }
      } else {
        setSubmissions([]);
        setStudents([]);
      }

      // Default forms to the first real teaching assignment.
      if (sessionRows.length) {
        const first = sessionRows[0];

        setHomeworkForm((previous) => ({
          ...previous,
          classId: previous.classId || first.class_id,
          subjectId: previous.subjectId || first.subject_id,
        }));

        setExamForm((previous) => ({
          ...previous,
          classId: previous.classId || first.class_id,
          subjectId: previous.subjectId || first.subject_id,
        }));
      }
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'The teacher dashboard could not load its records.',
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, userId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleHomeworkSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setErrorText(null);
    setNoticeText(null);

    if (!staff || !currentSessionId) {
      setErrorText(
        'A current academic session and linked teacher profile are required before homework can be created. Ask an administrator to check the academic session settings.',
      );
      return;
    }

    const assignmentIsAllowed = teachingAssignments.some(
      (item) =>
        item.class_id === homeworkForm.classId &&
        item.subject_id === homeworkForm.subjectId,
    );

    if (!assignmentIsAllowed) {
      setErrorText(
        'You can only create homework for a class and subject assigned to your teacher profile.',
      );
      return;
    }

    if (!homeworkForm.title.trim()) {
      setErrorText('Enter a title for this assignment.');
      return;
    }

    const maxScore = Number(homeworkForm.maxScore);

    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setErrorText('The maximum score must be greater than zero.');
      return;
    }

    setSaving(true);

    try {
      const client = getSupabaseClient();

      const { error } = await (client as any).from('assignments').insert({
        school_id: schoolId,
        academic_session_id: currentSessionId,
        class_id: homeworkForm.classId,
        subject_id: homeworkForm.subjectId,
        staff_id: staff.id,
        title: homeworkForm.title.trim(),
        description: homeworkForm.description.trim() || null,
        instructions: homeworkForm.instructions.trim() || null,
        due_date: homeworkForm.dueDate
          ? new Date(homeworkForm.dueDate).toISOString()
          : null,
        max_score: maxScore,
        status: 'published',
      });

      if (error) throw error;

      setHomeworkForm((previous) => ({
        ...previous,
        title: '',
        description: '',
        instructions: '',
        dueDate: '',
      }));

      setNoticeText('Assignment created successfully.');
      await loadDashboard();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'The assignment could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExamSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setErrorText(null);
    setNoticeText(null);

    if (!staff || !currentSessionId) {
      setErrorText(
        'A linked teacher profile and current academic session are required to create an online exam.',
      );
      return;
    }

    const assignmentIsAllowed = teachingAssignments.some(
      (item) =>
        item.class_id === examForm.classId &&
        item.subject_id === examForm.subjectId,
    );

    if (!assignmentIsAllowed) {
      setErrorText(
        'You can only create an exam for a class and subject assigned to your teacher profile.',
      );
      return;
    }

    if (!examForm.title.trim()) {
      setErrorText('Enter an exam title.');
      return;
    }

    const validQuestions = questions.filter(
      (question) =>
        question.question_text.trim() &&
        question.option_a.trim() &&
        question.option_b.trim() &&
        question.option_c.trim() &&
        question.option_d.trim() &&
        ['A', 'B', 'C', 'D'].includes(question.correct_answer) &&
        Number.isFinite(Number(question.marks)) &&
        Number(question.marks) > 0,
    );

    if (!validQuestions.length) {
      setErrorText(
        'Add at least one complete multiple-choice question, all four options, a correct answer, and positive marks.',
      );
      return;
    }

    if (questions.some((question) => !validQuestions.includes(question))) {
      setErrorText(
        'Complete every question row or remove the unfinished question before saving.',
      );
      return;
    }

    if (
      examForm.startAt &&
      examForm.endAt &&
      new Date(examForm.endAt) <= new Date(examForm.startAt)
    ) {
      setErrorText('The exam end time must be after the start time.');
      return;
    }

    const duration = Number(examForm.duration);

    if (!Number.isFinite(duration) || duration < 1) {
      setErrorText('Exam duration must be at least one minute.');
      return;
    }

    setSaving(true);

    try {
      const client = getSupabaseClient();

      const totalMarks = validQuestions.reduce(
        (sum, question) => sum + Number(question.marks),
        0,
      );

      const { data: exam, error: examError } = await client
        .from('online_exams')
        .insert({
          school_id: schoolId,
          academic_session_id: currentSessionId,
          class_id: examForm.classId,
          subject_id: examForm.subjectId,
          title: examForm.title.trim(),
          instructions: examForm.instructions.trim() || null,
          duration_minutes: duration,
          total_marks: totalMarks,
          start_at: examForm.startAt
            ? new Date(examForm.startAt).toISOString()
            : null,
          end_at: examForm.endAt
            ? new Date(examForm.endAt).toISOString()
            : null,
          status: 'draft',
          created_by: userId,
        })
        .select('id')
        .single();

      if (examError) throw examError;

      const questionRows = validQuestions.map((question, index) => ({
        school_id: schoolId,
        exam_id: exam.id,
        question_text: question.question_text.trim(),
        question_type: 'multiple_choice',
        option_a: question.option_a.trim(),
        option_b: question.option_b.trim(),
        option_c: question.option_c.trim(),
        option_d: question.option_d.trim(),
        correct_answer: question.correct_answer,
        marks: Number(question.marks),
        sort_order: index + 1,
      }));

      const { error: questionsError } = await client
        .from('online_exam_questions')
        .insert(questionRows);

      if (questionsError) {
        setErrorText(
          `The exam record was created, but its questions could not be saved: ${questionsError.message}. The exam has not been published; check the exam access policies before retrying.`,
        );
        return;
      }

      setExamForm((previous) => ({
        ...previous,
        title: '',
        instructions: '',
        duration: '30',
        startAt: '',
        endAt: '',
      }));

      setQuestions([emptyQuestion()]);
      setNoticeText(
        'Online exam and questions saved as a draft. Review the exam access rules before making it available to students.',
      );

      await loadDashboard();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'The online exam could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGradeSubmission = async (submission: Submission) => {
    setErrorText(null);
    setNoticeText(null);

    const value = grading[submission.id];
    const homework = assignments.find(
      (item) => item.id === submission.assignment_id,
    );

    if (!value || value.score.trim() === '') {
      setErrorText('Enter a score before saving the grade.');
      return;
    }

    const score = Number(value.score);
    const maximum = Number(homework?.max_score ?? 100);

    if (!Number.isFinite(score) || score < 0 || score > maximum) {
      setErrorText(`Enter a score between 0 and ${maximum}.`);
      return;
    }

    setSaving(true);

    try {
      const client = getSupabaseClient();

      const { error } = await (client as any)
        .from('assignment_submissions')
        .update({
          score,
          feedback: value.feedback.trim() || null,
          status: 'graded',
          graded_by: userId,
          graded_at: new Date().toISOString(),
        })
        .eq('school_id', schoolId)
        .eq('id', submission.id)
        .eq('assignment_id', submission.assignment_id);

      if (error) throw error;

      setNoticeText('Grade saved successfully.');
      await loadDashboard();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'The grade could not be saved. Check the submission access policies.',
      );
    } finally {
      setSaving(false);
    }
  };

  const studentNumber = (studentId: string) =>
    students.find((item) => item.id === studentId)?.admission_number ??
    studentId;

  const dayName = (day?: number) => {
    if (day === undefined) return 'Day not specified';

    return (
      [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ][day] ?? `Day ${day}`
    );
  };

  useEffect(() => {
    if (!printDocument) return;
    const timer = window.setTimeout(() => window.print(), 120);
    const clearAfterPrint = () => setPrintDocument(null);
    window.addEventListener('afterprint', clearAfterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clearAfterPrint);
    };
  }, [printDocument]);

  return (
    <main style={pageStyle}>
      <style>{`
        .resa-print-document { display: none; }
        @media print {
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .resa-print-document, .resa-print-document * { visibility: visible !important; }
          .resa-print-document { display: block !important; position: absolute; inset: 0; width: 100%; padding: 18mm; box-sizing: border-box; background: #fff; color: #111; font-family: Arial, sans-serif; }
          .resa-print-document[data-kind="id_card"] { width: 85.6mm; min-height: 54mm; padding: 6mm; border: 1px solid #164e36; border-radius: 3mm; }
          @page { size: auto; margin: 12mm; }
        }
      `}</style>
      {printDocument === 'id_card' && staff && (
        <section className="resa-print-document" data-kind="id_card">
          <div style={{ borderBottom: '2px solid #d6b75a', paddingBottom: 5, marginBottom: 8, color: '#164e36', fontWeight: 800, fontSize: 11 }}>RHEMA EXPLOITS SCIENCE ACADEMY (RESA)</div>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>STAFF IDENTIFICATION CARD</div>
          <div style={{ fontSize: 11, lineHeight: 1.7 }}>
            <div><strong>Name:</strong> {teacherName || 'Staff member'}</div>
            <div><strong>Staff ID:</strong> {staff.staff_number || 'Not assigned'}</div>
            <div><strong>Designation:</strong> {staff.job_title || 'Staff'}</div>
            <div><strong>Department:</strong> {staff.department || 'Not specified'}</div>
            <div><strong>Status:</strong> {staff.status || 'Not specified'}</div>
          </div>
          <div style={{ marginTop: 8, borderTop: '1px solid #d6b75a', paddingTop: 5, textAlign: 'center', fontSize: 8 }}>School identification · If found, return to RESA administration</div>
        </section>
      )}
      {printDocument === 'admission_letter' && staff && (
        <section className="resa-print-document" data-kind="admission_letter">
          <header style={{ borderBottom: '3px solid #166534', paddingBottom: 14, marginBottom: 26 }}>
            <h1 style={{ margin: 0, color: '#14532d', fontSize: 22 }}>RHEMA EXPLOITS SCIENCE ACADEMY (RESA)</h1>
            <p style={{ margin: '6px 0 0', fontSize: 11 }}>PASSION • SKILLS • EXCELLENT SPIRIT</p>
            <p style={{ margin: '5px 0 0', fontSize: 10 }}>1, Smiling George Way, Behind Mat Ice, Opp. Winners’ Chapel, Sapele Road, Benin City, Edo State, Nigeria</p>
          </header>
          <p style={{ textAlign: 'right' }}>Date: {new Date().toLocaleDateString()}</p>
          <h2 style={{ textAlign: 'center', textDecoration: 'underline', fontSize: 17 }}>STAFF ADMISSION LETTER</h2>
          <p>Dear {teacherName || 'Staff Member'},</p>
          <p>We are pleased to confirm your admission to the staff of RESA in the position listed below. This staff admission confirmation is issued for your records by the school administration.</p>
          <p><strong>Name:</strong> {teacherName || 'Staff member'}<br/><strong>Staff ID:</strong> {staff.staff_number || 'Not assigned'}<br/><strong>Position:</strong> {staff.job_title || 'Not specified'}<br/><strong>Department:</strong> {staff.department || 'Not specified'}</p>
          <p>Please retain this letter for your records. Detailed employment terms, reporting date, and any other conditions remain as stated in the separate official notice issued by Human Resources or the school administration.</p>
          <p style={{ marginTop: 48 }}>Yours faithfully,</p>
          <p style={{ marginTop: 28 }}><strong>Human Resources / School Administration</strong><br/>RHEMA EXPLOITS SCIENCE ACADEMY (RESA)</p>
        </section>
      )}
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}><ProfilePhotoCard userId={userId} displayName={teacherName || email} roleLabel="Teacher / Staff" /></div>
        <header
          style={{
            background: '#123d2b',
            color: '#fff',
            borderRadius: 14,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color: '#e6c66b',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.5,
            }}
          >
            RESA • TEACHER WORKSPACE
          </div>

          <h1 style={{ margin: '10px 0', fontSize: 28 }}>
            Teacher Dashboard
          </h1>

          <p style={{ margin: '0 0 8px' }}>
            {schoolName || 'RHEMA EXPLOITS SCIENCE ACADEMY'}
          </p>

          <p style={{ margin: '0 0 16px', overflowWrap: 'anywhere' }}>
            Signed in as: {teacherName || email || 'Teacher account'}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading || saving}
              style={buttonStyle}
            >
              {loading ? 'Refreshing…' : 'Refresh dashboard'}
            </button>

            <Link href="/notifications" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Notifications <UnreadMessageBadge schoolId={schoolId} /></Link>
            <Link href="/form-teacher-attendance" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Form Teacher Attendance</Link>
            <Link href="/school-communication" style={{ ...secondaryButtonStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>School messages</Link>
            <button
              type="button"
              onClick={onSignOut}
              style={secondaryButtonStyle}
            >
              Sign out
            </button>
          </div>
        </header>

        {errorText && (
          <section
            role="alert"
            style={{
              ...panelStyle,
              borderColor: '#d68a8a',
              color: '#8b1e1e',
            }}
          >
            <strong>Action needs attention</strong>
            <p style={{ marginBottom: 0 }}>{errorText}</p>
          </section>
        )}

        {noticeText && (
          <section
            role="status"
            style={{
              ...panelStyle,
              borderColor: '#e5ca7a',
              background: '#fffaf0',
            }}
          >
            {noticeText}
          </section>
        )}

        <nav
          aria-label="Teacher workspace sections"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              style={{
                ...buttonStyle,
                background: activeTab === tab ? '#123d2b' : '#fff',
                color: activeTab === tab ? '#fff' : '#17251b',
                border:
                  activeTab === tab
                    ? '1px solid #123d2b'
                    : '1px solid #d8e1d9',
              }}
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === 'Overview' && (
          <>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>My staff profile</h2>

              {staff && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 14px' }}>
                  {printPermissions.id_card ? (
                    <button type="button" style={buttonStyle} onClick={() => setPrintDocument('id_card')}>Print staff ID card</button>
                  ) : (
                    <span style={{ ...secondaryButtonStyle, display: 'inline-block' }}>ID card printing awaits HR/admin approval</span>
                  )}
                  {printPermissions.admission_letter ? (
                    <button type="button" style={buttonStyle} onClick={() => setPrintDocument('admission_letter')}>Print admission letter</button>
                  ) : (
                    <span style={{ ...secondaryButtonStyle, display: 'inline-block' }}>Admission letter awaits HR/admin approval</span>
                  )}
                </div>
              )}

              {loading && !staff ? (
                <p>Loading your staff profile…</p>
              ) : staff ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 14,
                  }}
                >
                  <div>
                    <strong>Staff number</strong>
                    <p>{staff.staff_number || 'Not assigned'}</p>
                  </div>
                  <div>
                    <strong>Job title</strong>
                    <p>{staff.job_title || 'Not specified'}</p>
                  </div>
                  <div>
                    <strong>Department</strong>
                    <p>{staff.department || 'Not specified'}</p>
                  </div>
                  <div>
                    <strong>Staff status</strong>
                    <p>{staff.status || 'Not specified'}</p>
                  </div>
                </div>
              ) : (
                <p>No linked staff profile is available.</p>
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>My teaching overview</h2>
              <p style={{ color: "#536456", lineHeight: 1.6, margin: "0 0 12px" }}>Enter marks for your assigned subjects and submit results to the administrator for approval.</p>
              <Link href="/results-management" style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "11px 15px", background: "#123d2b", color: "#fff", fontWeight: 700, textDecoration: "none", marginBottom: 14 }}>Open Results & Broadsheet</Link> <Link href="/teaching-materials" style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "11px 15px", background: "#e6c66b", color: "#17251b", fontWeight: 700, textDecoration: "none", marginBottom: 14 }}>Teaching Materials & AI Drills</Link> <Link href="/resa-chat" style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "11px 15px", background: "#d9efe2", color: "#123d2b", fontWeight: 700, textDecoration: "none", marginBottom: 14 }}>School Chat</Link>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(135px, 1fr))',
                  gap: 12,
                }}
              >
                {[
                  { label: 'Assigned classes', value: myClassIds.size },
                  { label: 'Assigned subjects', value: mySubjectIds.size },
                  { label: 'Timetable entries', value: timetable.length },
                  { label: 'Homework tasks', value: assignments.length },
                  { label: 'Online exams', value: exams.length },
                  { label: 'Submissions', value: submissions.length },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      padding: 15,
                      background: '#f1f6f1',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#536456' }}>
                      {stat.label}
                    </div>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: 27,
                        marginTop: 8,
                      }}
                    >
                      {loading ? '—' : stat.value}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>
                My assigned classes and subjects
              </h2>

              {loading && <p>Loading teacher assignments…</p>}

              {!loading && teachingAssignments.length === 0 && (
                <p>
                  No teacher assignments were found for the current academic
                  session. Ask the administrator to assign classes and
                  subjects to your staff profile.
                </p>
              )}

              <div style={{ display: 'grid', gap: 10 }}>
                {teachingAssignments.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      border: '1px solid #e0e7e0',
                      borderRadius: 9,
                      padding: 13,
                    }}
                  >
                    <strong>{className(item.class_id)}</strong>
                    <div>{subjectName(item.subject_id)}</div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'Assignments' && (
          <>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>
                Create homework or assignment
              </h2>

              {!currentSessionId && !loading && (
                <p>
                  No current academic session is configured. Ask the
                  administrator to set the current session before creating
                  assignments.
                </p>
              )}

              <form onSubmit={handleHomeworkSubmit}>
                <label style={labelStyle}>
                  Assignment title
                  <input
                    style={fieldStyle}
                    value={homeworkForm.title}
                    onChange={(event) =>
                      setHomeworkForm((previous) => ({
                        ...previous,
                        title: event.target.value,
                      }))
                    }
                    required
                    maxLength={200}
                    placeholder="e.g. Introduction to computer hardware"
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Assigned class
                    <select
                      style={fieldStyle}
                      value={homeworkForm.classId}
                      onChange={(event) => {
                        const classId = event.target.value;
                        const allowed = availableSubjectsForClass(classId);

                        setHomeworkForm((previous) => ({
                          ...previous,
                          classId,
                          subjectId: allowed[0]?.id ?? '',
                        }));
                      }}
                      required
                    >
                      <option value="">Choose a class</option>
                      {classes
                        .filter((item) => myClassIds.has(item.id))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Assigned subject
                    <select
                      style={fieldStyle}
                      value={homeworkForm.subjectId}
                      onChange={(event) =>
                        setHomeworkForm((previous) => ({
                          ...previous,
                          subjectId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Choose a subject</option>
                      {availableSubjectsForClass(homeworkForm.classId).map(
                        (item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <label style={labelStyle}>
                  Description
                  <textarea
                    style={{ ...fieldStyle, minHeight: 85 }}
                    value={homeworkForm.description}
                    onChange={(event) =>
                      setHomeworkForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Briefly describe the assignment."
                  />
                </label>

                <label style={labelStyle}>
                  Instructions for students
                  <textarea
                    style={{ ...fieldStyle, minHeight: 85 }}
                    value={homeworkForm.instructions}
                    onChange={(event) =>
                      setHomeworkForm((previous) => ({
                        ...previous,
                        instructions: event.target.value,
                      }))
                    }
                    placeholder="Explain how students should complete and submit the work."
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Due date and time
                    <input
                      style={fieldStyle}
                      type="datetime-local"
                      value={homeworkForm.dueDate}
                      onChange={(event) =>
                        setHomeworkForm((previous) => ({
                          ...previous,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label style={labelStyle}>
                    Maximum score
                    <input
                      style={fieldStyle}
                      type="number"
                      min="1"
                      max="10000"
                      value={homeworkForm.maxScore}
                      onChange={(event) =>
                        setHomeworkForm((previous) => ({
                          ...previous,
                          maxScore: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  style={{
                    ...buttonStyle,
                    opacity: saving || !currentSessionId ? 0.6 : 1,
                  }}
                  disabled={saving || loading || !currentSessionId}
                >
                  {saving ? 'Saving…' : 'Create assignment'}
                </button>
              </form>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>My assignments</h2>

              {!loading && assignments.length === 0 && (
                <p>No homework assignments have been created by you yet.</p>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                {assignments.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      border: '1px solid #e0e7e0',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>{item.title}</h3>
                    <p>
                      {className(item.class_id)} ·{' '}
                      {subjectName(item.subject_id)}
                    </p>
                    {item.description && <p>{item.description}</p>}
                    {item.instructions && <p>{item.instructions}</p>}
                    <small>
                      Status: {item.status} · Maximum score: {item.max_score}
                      {' · '}Due:{' '}
                      {item.due_date
                        ? new Date(item.due_date).toLocaleString()
                        : 'No due date'}
                    </small>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'Online CBT' && (
          <>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>
                Create an online CBT examination
              </h2>

              <p>
                Create a multiple-choice exam, enter the answer options,
                select the correct answer, and set marks. New exams are
                saved as drafts.
              </p>

              <form onSubmit={handleExamSubmit}>
                <label style={labelStyle}>
                  Examination title
                  <input
                    style={fieldStyle}
                    value={examForm.title}
                    onChange={(event) =>
                      setExamForm((previous) => ({
                        ...previous,
                        title: event.target.value,
                      }))
                    }
                    required
                    maxLength={200}
                    placeholder="e.g. Basic Technology — First Test"
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Assigned class
                    <select
                      style={fieldStyle}
                      value={examForm.classId}
                      onChange={(event) => {
                        const classId = event.target.value;
                        const allowed = availableSubjectsForClass(classId);

                        setExamForm((previous) => ({
                          ...previous,
                          classId,
                          subjectId: allowed[0]?.id ?? '',
                        }));
                      }}
                      required
                    >
                      <option value="">Choose a class</option>
                      {classes
                        .filter((item) => myClassIds.has(item.id))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Assigned subject
                    <select
                      style={fieldStyle}
                      value={examForm.subjectId}
                      onChange={(event) =>
                        setExamForm((previous) => ({
                          ...previous,
                          subjectId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Choose a subject</option>
                      {availableSubjectsForClass(examForm.classId).map(
                        (item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Duration (minutes)
                    <input
                      style={fieldStyle}
                      type="number"
                      min="1"
                      max="600"
                      value={examForm.duration}
                      onChange={(event) =>
                        setExamForm((previous) => ({
                          ...previous,
                          duration: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>

                <label style={labelStyle}>
                  Instructions
                  <textarea
                    style={{ ...fieldStyle, minHeight: 75 }}
                    value={examForm.instructions}
                    onChange={(event) =>
                      setExamForm((previous) => ({
                        ...previous,
                        instructions: event.target.value,
                      }))
                    }
                    placeholder="Instructions students should read before starting."
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                  }}
                >
                  <label style={labelStyle}>
                    Start date and time (optional)
                    <input
                      style={fieldStyle}
                      type="datetime-local"
                      value={examForm.startAt}
                      onChange={(event) =>
                        setExamForm((previous) => ({
                          ...previous,
                          startAt: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label style={labelStyle}>
                    End date and time (optional)
                    <input
                      style={fieldStyle}
                      type="datetime-local"
                      value={examForm.endAt}
                      onChange={(event) =>
                        setExamForm((previous) => ({
                          ...previous,
                          endAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <h3>Questions</h3>

                {questions.map((question, index) => (
                  <article
                    key={index}
                    style={{
                      border: '1px solid #dce5dd',
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 12,
                      background: '#fbfdfb',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <h4>Question {index + 1}</h4>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          onClick={() =>
                            setQuestions((previous) =>
                              previous.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <label style={labelStyle}>
                      Question text
                      <textarea
                        style={{ ...fieldStyle, minHeight: 70 }}
                        value={question.question_text}
                        onChange={(event) =>
                          setQuestions((previous) =>
                            previous.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    question_text: event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                        required
                      />
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(190px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                        const optionKey = `option_${letter.toLowerCase()}` as
                          | 'option_a'
                          | 'option_b'
                          | 'option_c'
                          | 'option_d';

                        return (
                          <label key={letter} style={labelStyle}>
                            Option {letter}
                            <input
                              style={fieldStyle}
                              value={question[optionKey]}
                              onChange={(event) =>
                                setQuestions((previous) =>
                                  previous.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          [optionKey]: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              required
                            />
                          </label>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <label style={labelStyle}>
                        Correct answer
                        <select
                          style={fieldStyle}
                          value={question.correct_answer}
                          onChange={(event) =>
                            setQuestions((previous) =>
                              previous.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      correct_answer: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      </label>

                      <label style={labelStyle}>
                        Marks
                        <input
                          style={fieldStyle}
                          type="number"
                          min="1"
                          max="1000"
                          value={question.marks}
                          onChange={(event) =>
                            setQuestions((previous) =>
                              previous.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      marks: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                          required
                        />
                      </label>
                    </div>
                  </article>
                ))}

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 16,
                  }}
                >
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={() =>
                      setQuestions((previous) => [
                        ...previous,
                        emptyQuestion(),
                      ])
                    }
                  >
                    + Add another question
                  </button>

                  <strong style={{ alignSelf: 'center' }}>
                    Total marks:{' '}
                    {questions.reduce(
                      (sum, question) =>
                        sum + Number(question.marks || 0),
                      0,
                    )}
                  </strong>
                </div>

                <button
                  type="submit"
                  style={{
                    ...buttonStyle,
                    opacity: saving || !currentSessionId ? 0.6 : 1,
                  }}
                  disabled={saving || loading || !currentSessionId}
                >
                  {saving ? 'Saving exam…' : 'Save exam as draft'}
                </button>
              </form>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>My online examinations</h2>

              {!loading && exams.length === 0 && (
                <p>No online exams created by your account were found.</p>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                {exams.map((exam) => (
                  <article
                    key={exam.id}
                    style={{
                      border: '1px solid #e0e7e0',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>{exam.title}</h3>
                    <p>
                      {className(exam.class_id)} ·{' '}
                      {subjectName(exam.subject_id)}
                    </p>
                    <p>
                      Duration: {exam.duration_minutes ?? 'Not set'} minutes
                      {' · '}Total marks: {exam.total_marks}
                    </p>
                    <p>
                      Status: <strong>{exam.status}</strong>
                    </p>
                    {exam.instructions && <p>{exam.instructions}</p>}
                    <small>
                      Start:{' '}
                      {exam.start_at
                        ? new Date(exam.start_at).toLocaleString()
                        : 'Not scheduled'}
                      {' · '}End:{' '}
                      {exam.end_at
                        ? new Date(exam.end_at).toLocaleString()
                        : 'Not scheduled'}
                    </small>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'Marking' && (
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Review and grade submissions</h2>

            <p>
              Scores are checked against the maximum mark for each assignment.
              The database must authorize the teacher to update each submission.
            </p>

            {!loading && submissions.length === 0 && (
              <p>
                No submissions were found for your assignments. Submissions
                will appear here when students submit their work.
              </p>
            )}

            <div style={{ display: 'grid', gap: 14 }}>
              {submissions.map((submission) => {
                const homework = assignments.find(
                  (item) => item.id === submission.assignment_id,
                );

                const value = grading[submission.id] ?? {
                  score: '',
                  feedback: '',
                };

                return (
                  <article
                    key={submission.id}
                    style={{
                      border: '1px solid #dce5dd',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>
                      {homework?.title ?? 'Assignment'}
                    </h3>

                    <p>
                      Student admission number:{' '}
                      {studentNumber(submission.student_id)}
                    </p>

                    <p>
                      Class: {homework ? className(homework.class_id) : '—'}
                      {' · '}Subject:{' '}
                      {homework ? subjectName(homework.subject_id) : '—'}
                    </p>

                    <p>
                      Submitted:{' '}
                      {submission.submitted_at
                        ? new Date(submission.submitted_at).toLocaleString()
                        : 'Submission time unavailable'}
                    </p>

                    <p>
                      Status: <strong>{submission.status}</strong>
                    </p>

                    {submission.submission_text && (
                      <div
                        style={{
                          background: '#f5f8f5',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 12,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <strong>Student response</strong>
                        <p style={{ marginBottom: 0 }}>
                          {submission.submission_text}
                        </p>
                      </div>
                    )}

                    {submission.attachment_url && (
                      <p>
                        <a
                          href={submission.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open submitted attachment
                        </a>
                      </p>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <label style={labelStyle}>
                        Score (maximum {homework?.max_score ?? 100})
                        <input
                          style={fieldStyle}
                          type="number"
                          min="0"
                          max={homework?.max_score ?? 100}
                          value={value.score}
                          onChange={(event) =>
                            setGrading((previous) => ({
                              ...previous,
                              [submission.id]: {
                                ...value,
                                score: event.target.value,
                              },
                            }))
                          }
                          required
                        />
                      </label>

                      <label style={labelStyle}>
                        Feedback for student
                        <textarea
                          style={fieldStyle}
                          value={value.feedback}
                          onChange={(event) =>
                            setGrading((previous) => ({
                              ...previous,
                              [submission.id]: {
                                ...value,
                                feedback: event.target.value,
                              },
                            }))
                          }
                          placeholder="Teacher comments"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      style={buttonStyle}
                      disabled={saving}
                      onClick={() => void handleGradeSubmission(submission)}
                    >
                      {saving ? 'Saving…' : 'Save grade and feedback'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'Results' && (
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Results and broadsheets</h2>
            <p style={{ color: '#536456', lineHeight: 1.7, margin: '0 0 14px' }}>
              Enter CA and examination scores for your assigned classes and subjects, save drafts, and submit completed results for administrator approval. You can export a broadsheet for the classes and subjects assigned to you.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Link href="/results-management" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '11px 15px', background: '#123d2b', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
                Open Results & Broadsheet
              </Link>
            </div>
          </section>
        )}

        {activeTab === 'Timetable' && (
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>My teaching timetable</h2>

            {!loading && timetable.length === 0 && (
              <p>
                No timetable entries are linked to your staff record yet. An
                administrator needs to assign timetable periods to you.
              </p>
            )}

            <div style={{ display: 'grid', gap: 12 }}>
              {timetable.map((entry) => (
                <article
                  key={entry.id}
                  style={{
                    border: '1px solid #e0e7e0',
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {className(entry.class_id)}
                  </h3>
                  <p>{subjectName(entry.subject_id)}</p>
                  <p>
                    {dayName(entry.day_of_week)}
                    {' · '}
                    {entry.start_time ?? 'Start time unavailable'}
                    {' – '}
                    {entry.end_time ?? 'End time unavailable'}
                  </p>
                  {entry.room && <p>Room: {entry.room}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        <footer
          style={{
            textAlign: 'center',
            color: '#68766b',
            padding: 12,
          }}
        >
          RESA Teacher Workspace · JETAB TECH
        </footer>
      </div>
    </main>
  );
}
