
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type TeacherStaff = {
  id: string;
  staff_number: string | null;
  job_title: string | null;
  department: string | null;
  status: string | null;
};

type TeachingAssignment = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string | null;
  class_id: string;
  subject_id: string;
};

type TimetableEntry = {
  id: string;
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
  class_id: string;
};

type TeacherDashboardProps = {
  schoolId: string;
  schoolName?: string;
  email?: string;
  userId: string;
  onSignOut: () => void;
};

const pageStyle = {
  minHeight: '100vh',
  padding: 18,
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

export default function TeacherDashboard({
  schoolId,
  schoolName,
  email,
  userId,
  onSignOut,
}: TeacherDashboardProps) {
  const [staff, setStaff] = useState<TeacherStaff | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    setNoticeText(null);

    try {
      const client = getSupabaseClient();

      // Resolve this user's staff record without accessing another account.
      const { data: directStaff, error: directStaffError } = await client
        .from('staff')
        .select('id, staff_number, job_title, department, status')
        .eq('school_id', schoolId)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (directStaffError) throw directStaffError;

      let staffRecord = directStaff as TeacherStaff | null;

      // Some existing staff records link to a person rather than directly
      // to the authentication user. Support that existing relationship too.
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
          const { data: linkedStaff, error: linkedStaffError } = await client
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
        setClasses([]);
        setSubjects([]);
        setTimetable([]);
        setAssignments([]);
        setNoticeText(
          'Your active teacher membership was found, but no linked staff record was found. Please ask an administrator to check your staff profile.',
        );
        return;
      }

      setStaff(staffRecord);

      // Only retrieve teaching records linked to this teacher's staff ID.
      const [timetableResult, assignmentResult] = await Promise.all([
        client
          .from('class_timetables')
          .select('id, class_id, subject_id')
          .eq('school_id', schoolId)
          .eq('staff_id', staffRecord.id),

        client
          .from('assignments')
          .select(
            'id, title, description, due_date, status, class_id, subject_id',
          )
          .eq('school_id', schoolId)
          .eq('staff_id', staffRecord.id)
          .order('created_at', { ascending: false }),
      ]);

      if (timetableResult.error) throw timetableResult.error;
      if (assignmentResult.error) throw assignmentResult.error;

      const timetableRows = (timetableResult.data ?? []) as TimetableEntry[];
      const assignmentRows = (assignmentResult.data ??
        []) as TeachingAssignment[];

      setTimetable(timetableRows);
      setAssignments(assignmentRows);

      const classIds = [
        ...new Set([
          ...timetableRows.map((item) => item.class_id),
          ...assignmentRows.map((item) => item.class_id),
        ]),
      ];

      const subjectIds = [
        ...new Set([
          ...timetableRows.map((item) => item.subject_id),
          ...assignmentRows.map((item) => item.subject_id),
        ]),
      ];

      if (classIds.length > 0) {
        const { data, error } = await client
          .from('school_classes')
          .select('id, name, level')
          .eq('school_id', schoolId)
          .in('id', classIds);

        if (error) {
          setNoticeText(
            'Your teaching records loaded, but class names could not be displayed with your current database permissions.',
          );
        } else {
          setClasses((data ?? []) as SchoolClass[]);
        }
      } else {
        setClasses([]);
      }

      if (subjectIds.length > 0) {
        const { data, error } = await client
          .from('school_subjects')
          .select('id, name, class_id')
          .eq('school_id', schoolId)
          .in('id', subjectIds);

        if (error) {
          setNoticeText(
            'Some subject details are unavailable under your current database permissions. Ask an administrator to review teacher subject access.',
          );
        } else {
          setSubjects((data ?? []) as SchoolSubject[]);
        }
      } else {
        setSubjects([]);
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

  const className = (classId: string) =>
    classes.find((item) => item.id === classId)?.name ??
    'Class name unavailable';

  const subjectName = (subjectId: string) =>
    subjects.find((item) => item.id === subjectId)?.name ??
    'Subject name unavailable';

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            background: '#123d2b',
            color: '#fff',
            borderRadius: 14,
            padding: 22,
            marginBottom: 18,
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
            Signed in as: {email || 'Teacher account'}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh dashboard'}
            </button>

            <button type="button" onClick={onSignOut} style={buttonStyle}>
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
            <strong>Could not load dashboard data.</strong>
            <p>{errorText}</p>
            <p>
              Your account's database permissions have not been bypassed.
              Please ask an administrator to check the relevant access policies.
            </p>
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

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>My staff profile</h2>

          {loading && !staff ? (
            <p>Loading your staff profile…</p>
          ) : staff ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
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
                <strong>Staff record status</strong>
                <p>{staff.status || 'Not specified'}</p>
              </div>
            </div>
          ) : (
            !loading && (
              <p>
                No linked staff profile is available for this account yet.
              </p>
            )
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>My teaching overview</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {[
              { label: 'Assigned classes', value: classes.length },
              { label: 'Available subjects', value: subjects.length },
              { label: 'Timetable entries', value: timetable.length },
              { label: 'My assignments', value: assignments.length },
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
                <strong style={{ display: 'block', fontSize: 28, marginTop: 8 }}>
                  {loading ? '—' : stat.value}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>My classes and subjects</h2>

          {loading && <p>Loading teaching assignments…</p>}

          {!loading && timetable.length === 0 && assignments.length === 0 && (
            <p>
              No timetable entries or assignments were found for your staff
              record. Ask an administrator to confirm your class and subject
              assignments.
            </p>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {timetable.map((entry) => (
              <article
                key={entry.id}
                style={{
                  border: '1px solid #e0e7e0',
                  borderRadius: 9,
                  padding: 13,
                }}
              >
                <strong>{className(entry.class_id)}</strong>
                <div>{subjectName(entry.subject_id)}</div>
                <small style={{ color: '#68766b' }}>
                  From your timetable assignment
                </small>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>My assignments</h2>

          {loading && <p>Loading assignments…</p>}

          {!loading && assignments.length === 0 && (
            <p>No assignments were found for your staff record.</p>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {assignments.map((assignment) => (
              <article
                key={assignment.id}
                style={{
                  border: '1px solid #e0e7e0',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <h3 style={{ margin: '0 0 8px' }}>{assignment.title}</h3>

                <p style={{ margin: '0 0 8px' }}>
                  {className(assignment.class_id)} ·{' '}
                  {subjectName(assignment.subject_id)}
                </p>

                {assignment.description && <p>{assignment.description}</p>}

                <p style={{ marginBottom: 0, fontSize: 13, color: '#536456' }}>
                  Status: {assignment.status || 'Not specified'}
                  {' · '}
                  Due: {assignment.due_date || 'No due date'}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer style={{ textAlign: 'center', color: '#68766b', padding: 12 }}>
          RESA Teacher Workspace
        </footer>
      </div>
    </main>
  );
}
