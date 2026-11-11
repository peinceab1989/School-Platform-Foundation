import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type ActivityRow = {
  id: string;
  actor_user_id: string | null;
  school_id: string | null;
  actor_role: string;
  dashboard: string;
  route: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  school_id: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
};

type PersonRow = {
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
};

type CaseRow = {
  id: string;
  case_number: string;
  subject_user_id: string | null;
  issuer_user_id: string | null;
  school_id: string | null;
  case_type: string;
  severity: string;
  title: string;
  allegation: string;
  policy_reference: string | null;
  status: string;
  response_due_at: string | null;
  decision: string | null;
  created_at: string;
};

type Tab = 'activity' | 'people' | 'compliance';

const panel: CSSProperties = {
  background: '#fff',
  border: '1px solid #dfe6df',
  borderRadius: 12,
  padding: 18,
  marginTop: 16,
};
const field: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5cc',
  borderRadius: 8,
  padding: '10px 11px',
  background: '#fff',
  color: '#17251b',
  fontSize: 14,
};
const actionButton: CSSProperties = {
  border: '1px solid #cbd5cc',
  borderRadius: 8,
  padding: '9px 12px',
  background: '#123d2b',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const mutedButton: CSSProperties = {
  ...actionButton,
  background: '#f3f6f3',
  color: '#263a2b',
};
const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
};

function lagosDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function lagosDayBounds(day: string) {
  const start = new Date(`${day}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function JetabCommandCentre({ ownerUserId }: { ownerUserId: string }) {
  const [tab, setTab] = useState<Tab>('activity');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const [day, setDay] = useState(lagosDate());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleRole, setPeopleRole] = useState('all');
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatus, setCaseStatus] = useState('all');

  const [caseTarget, setCaseTarget] = useState('');
  const [caseType, setCaseType] = useState<'query' | 'warning'>('query');
  const [caseSeverity, setCaseSeverity] = useState('standard');
  const [caseTitle, setCaseTitle] = useState('');
  const [caseAllegation, setCaseAllegation] = useState('');
  const [casePolicy, setCasePolicy] = useState('');
  const [caseDue, setCaseDue] = useState('');
  const [warningReviewed, setWarningReviewed] = useState(false);

  const client = useMemo(() => getSupabaseClient() as any, []);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { start, end } = lagosDayBounds(day);
      const result = await client.from('nexus_activity_events')
        .select('id,actor_user_id,school_id,actor_role,dashboard,route,action,target_type,target_id,outcome,metadata,created_at')
        .gte('created_at', start).lt('created_at', end)
        .order('created_at', { ascending: false }).limit(1000);
      if (result.error) throw result.error;
      setActivity((result.data ?? []) as ActivityRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Daily activity records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [client, day]);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const membershipResult = await client.from('school_memberships')
        .select('id,user_id,school_id,role,status,created_at')
        .order('created_at', { ascending: false }).limit(1000);
      if (membershipResult.error) throw membershipResult.error;
      const rows = (membershipResult.data ?? []) as MembershipRow[];
      setMemberships(rows);
      const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
      if (ids.length) {
        const peopleResult = await client.from('people')
          .select('user_id,first_name,last_name,email').in('user_id', ids);
        if (peopleResult.error) throw peopleResult.error;
        setPeople((peopleResult.data ?? []) as PersonRow[]);
      } else {
        setPeople([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'User access records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await client.from('nexus_compliance_cases')
        .select('id,case_number,subject_user_id,issuer_user_id,school_id,case_type,severity,title,allegation,policy_reference,status,response_due_at,decision,created_at')
        .order('created_at', { ascending: false }).limit(500);
      if (result.error) throw result.error;
      setCases((result.data ?? []) as CaseRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compliance cases could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (tab === 'activity') void loadActivity();
    if (tab === 'people') void loadPeople();
    if (tab === 'compliance') void loadCases();
  }, [tab, loadActivity, loadPeople, loadCases]);

  const personName = useCallback((userId: string | null) => {
    if (!userId) return 'Account unavailable';
    const p = people.find((item) => item.user_id === userId);
    return p ? `${p.first_name} ${p.last_name}`.trim() || p.email || userId : userId;
  }, [people]);

  const filteredActivity = activity.filter((row) => {
    const q = search.trim().toLowerCase();
    const haystack = [
      row.actor_user_id, personName(row.actor_user_id), row.dashboard,
      row.route, row.action, row.target_type, row.target_id, row.outcome,
      JSON.stringify(row.metadata ?? {}),
    ].join(' ').toLowerCase();
    return (!q || haystack.includes(q))
      && (roleFilter === 'all' || row.actor_role === roleFilter)
      && (dashboardFilter === 'all' || row.dashboard === dashboardFilter)
      && (outcomeFilter === 'all' || row.outcome === outcomeFilter);
  });

  const filteredPeople = memberships.filter((row) => {
    const p = people.find((item) => item.user_id === row.user_id);
    const haystack = [row.user_id, row.school_id, row.role, row.status, p?.first_name, p?.last_name, p?.email].join(' ').toLowerCase();
    return (!peopleSearch.trim() || haystack.includes(peopleSearch.trim().toLowerCase()))
      && (peopleRole === 'all' || row.role === peopleRole);
  });

  const filteredCases = cases.filter((item) => {
    const haystack = [item.case_number, item.title, item.allegation, item.status, item.case_type, personName(item.subject_user_id)].join(' ').toLowerCase();
    return (!caseSearch.trim() || haystack.includes(caseSearch.trim().toLowerCase()))
      && (caseStatus === 'all' || item.status === caseStatus);
  });

  const updateMembership = async (row: MembershipRow, patch: Partial<Pick<MembershipRow, 'status' | 'role'>>) => {
    const label = patch.status ? `change ${personName(row.user_id)} to ${patch.status}` : `change ${personName(row.user_id)}'s role`;
    if (!window.confirm(`Confirm: ${label}? This changes portal access, not the person's school record or Auth account.`)) return;
    setBusyId(row.id); setError(''); setMessage('');
    try {
      const result = await client.from('school_memberships').update(patch).eq('id', row.id);
      if (result.error) throw result.error;
      setMessage('Membership updated. The change is recorded in the audit history.');
      await loadPeople();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Membership could not be updated.');
    } finally { setBusyId(null); }
  };

  const removeMembership = async (row: MembershipRow) => {
    if (!window.confirm(`Remove ${row.role} portal membership for ${personName(row.user_id)}? This removes this school access only. It does not delete the Auth account or person/student/staff record.`)) return;
    setBusyId(row.id); setError(''); setMessage('');
    try {
      const result = await client.from('school_memberships').delete().eq('id', row.id);
      if (result.error) throw result.error;
      setMessage('School membership removed. The historical audit record is preserved.');
      await loadPeople();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Membership could not be removed.');
    } finally { setBusyId(null); }
  };

  const issueCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!caseTarget || !caseTitle.trim() || !caseAllegation.trim()) {
      setError('Choose a person and complete the title and incident details.');
      return;
    }
    if (caseType === 'warning' && !warningReviewed) {
      setError('A warning requires confirmation that a human reviewer has examined the evidence and made the decision.');
      return;
    }
    setBusyId('new-case'); setError(''); setMessage('');
    try {
      const target = memberships.find((row) => row.user_id === caseTarget);
      const result = await client.from('nexus_compliance_cases').insert({
        subject_user_id: caseTarget,
        issuer_user_id: ownerUserId,
        school_id: target?.school_id ?? null,
        case_type: caseType,
        severity: caseSeverity,
        title: caseTitle.trim(),
        allegation: caseAllegation.trim(),
        policy_reference: casePolicy.trim() || null,
        response_due_at: caseDue ? new Date(`${caseDue}T23:59:00+01:00`).toISOString() : null,
        status: 'issued',
      });
      if (result.error) throw result.error;
      setCaseTitle(''); setCaseAllegation(''); setCasePolicy(''); setCaseDue('');
      setWarningReviewed(false);
      setMessage('Formal case issued. The recipient can see the case after their response inbox is connected; keep a separate delivery record until then.');
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The query or warning could not be issued.');
    } finally { setBusyId(null); }
  };

  const updateCase = async (item: CaseRow, status: string) => {
    if (!window.confirm(`Move ${item.case_number} to "${status.replaceAll('_', ' ')}"?`)) return;
    setBusyId(item.id); setError(''); setMessage('');
    try {
      const result = await client.from('nexus_compliance_cases')
        .update({ status, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (result.error) throw result.error;
      setMessage(`${item.case_number} updated.`);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Case status could not be updated.');
    } finally { setBusyId(null); }
  };

  const downloadDailyCsv = () => {
    const header = ['time_lagos','actor_user_id','actor_name','role','dashboard','route','action','outcome','target_type','target_id','metadata'];
    const rows = filteredActivity.map((row) => [
      new Date(row.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      row.actor_user_id ?? '', personName(row.actor_user_id), row.actor_role,
      row.dashboard, row.route ?? '', row.action, row.outcome,
      row.target_type ?? '', row.target_id ?? '', JSON.stringify(row.metadata ?? {}),
    ]);
    const csv = [header, ...rows].map((values) => values.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `JETAB-activity-${day}.csv`;
    anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <section style={panel}>
      <h2 style={{ margin: '0 0 8px', color: '#123d2b' }}>JETAB Command Centre</h2>
      <p style={{ marginTop: 0, color: '#58675b', lineHeight: 1.55 }}>
        Daily oversight, membership administration and compliance case management. All times are displayed in Africa/Lagos.
      </p>
      <nav aria-label="Command centre sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {([
          ['activity', 'Daily activity'],
          ['people', 'People and access'],
          ['compliance', 'Queries and warnings'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={tab === key ? actionButton : mutedButton}>{label}</button>
        ))}
      </nav>

      {error && <div role="alert" style={{ padding: 12, borderRadius: 8, background: '#fff0f0', color: '#8b1e1e', marginBottom: 12 }}>{error}</div>}
      {message && <div role="status" style={{ padding: 12, borderRadius: 8, background: '#edf7ef', color: '#155b30', marginBottom: 12 }}>{message}</div>}

      {tab === 'activity' && <>
        <div style={grid}>
          <label>Daily record date (Nigeria)<input style={field} type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label>Search user, action or page<input style={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, action, route…" /></label>
          <label>Role<select style={field} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">All roles</option>{['admin','teacher','student','parent','staff','unknown'].map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Dashboard<select style={field} value={dashboardFilter} onChange={(e) => setDashboardFilter(e.target.value)}><option value="all">All dashboards</option>{['admin','teacher','student','parent','staff','public','unknown'].map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Outcome<select style={field} value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}><option value="all">All outcomes</option>{['success','failure','attempt','unknown'].map((r) => <option key={r}>{r}</option>)}</select></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
          <strong>{filteredActivity.length} matching visit/activity records</strong>
          <div style={{ display: 'flex', gap: 8 }}><button type="button" style={mutedButton} onClick={() => void loadActivity()} disabled={loading}>Refresh</button><button type="button" style={actionButton} onClick={downloadDailyCsv}>Export CSV</button></div>
        </div>
        {loading ? <p>Loading daily records…</p> : filteredActivity.length === 0 ? <p>No recorded activity matches these filters for this date. This is not proof that no one used the portal: only events recorded after tracking is enabled will appear.</p> : (
          <div style={{ display: 'grid', gap: 9 }}>
            {filteredActivity.map((row) => <article key={row.id} style={{ border: '1px solid #e1e8e1', borderRadius: 9, padding: 12, background: '#fbfcfb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{row.action.replaceAll('_', ' ')}</strong>
                <span style={{ fontSize: 12, color: '#536456' }}>{new Date(row.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</span>
              </div>
              <div style={{ marginTop: 5 }}>{personName(row.actor_user_id)} · {row.actor_role} · {row.dashboard} dashboard</div>
              <div style={{ fontSize: 13, color: '#536456', overflowWrap: 'anywhere' }}>{row.route || 'Route not supplied'} · {row.outcome}</div>
              {(row.target_type || row.target_id) && <div style={{ fontSize: 12, marginTop: 4 }}>Target: {row.target_type || 'record'} {row.target_id || ''}</div>}
              {row.metadata && Object.keys(row.metadata).length > 0 && <details style={{ marginTop: 6 }}><summary>Event details</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(row.metadata, null, 2)}</pre></details>}
            </article>)}
          </div>
        )}
      </>}

      {tab === 'people' && <>
        <p style={{ color: '#58675b', lineHeight: 1.55 }}>Manage a person's school membership without deleting their authentication account or permanent school records. Removing a membership revokes that school access only.</p>
        <div style={grid}>
          <label>Search people<input style={field} value={peopleSearch} onChange={(e) => setPeopleSearch(e.target.value)} placeholder="Name, user ID, role…" /></label>
          <label>Role<select style={field} value={peopleRole} onChange={(e) => setPeopleRole(e.target.value)}><option value="all">All roles</option>{['admin','teacher','student','parent'].map((r) => <option key={r}>{r}</option>)}</select></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0', gap: 8 }}><strong>{filteredPeople.length} memberships</strong><button type="button" style={mutedButton} onClick={() => void loadPeople()} disabled={loading}>Refresh</button></div>
        {loading ? <p>Loading memberships…</p> : filteredPeople.map((row) => <article key={row.id} style={{ border: '1px solid #e1e8e1', borderRadius: 9, padding: 12, marginTop: 9 }}>
          <strong>{personName(row.user_id)}</strong><div style={{ fontSize: 12, color: '#68766b', overflowWrap: 'anywhere' }}>{row.user_id} · School {row.school_id}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9, alignItems: 'center' }}>
            <label style={{ fontSize: 12 }}>Role <select style={{ ...field, width: 'auto', display: 'inline-block' }} value={row.role} disabled={busyId === row.id} onChange={(e) => void updateMembership(row, { role: e.target.value as MembershipRow['role'] })}>{['admin','teacher','student','parent'].map((r) => <option key={r}>{r}</option>)}</select></label>
            <label style={{ fontSize: 12 }}>Access <select style={{ ...field, width: 'auto', display: 'inline-block' }} value={row.status} disabled={busyId === row.id} onChange={(e) => void updateMembership(row, { status: e.target.value as MembershipRow['status'] })}>{['active','invited','suspended'].map((r) => <option key={r}>{r}</option>)}</select></label>
            <button type="button" style={{ ...mutedButton, color: '#8b1e1e' }} disabled={busyId === row.id} onClick={() => void removeMembership(row)}>Remove school access</button>
          </div>
        </article>)}
        <p style={{ fontSize: 12, color: '#68766b', marginTop: 12 }}>Adding new users still requires the existing secure invitation/account-creation workflow. This screen manages existing memberships; it does not create passwords or expose Auth secrets.</p>
      </>}

      {tab === 'compliance' && <>
        <p style={{ color: '#58675b', lineHeight: 1.55 }}>Issue a formal query or a human-reviewed warning. A report or automated alert is an allegation to investigate, not a finding of guilt. Preserve the subject's right to respond and request review.</p>
        <form onSubmit={(e) => void issueCase(e)} style={{ border: '1px solid #dfe6df', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Issue query or warning</h3>
          <div style={grid}>
            <label>Person<select required style={field} value={caseTarget} onChange={(e) => setCaseTarget(e.target.value)}><option value="">Select a person</option>{memberships.map((m) => <option key={m.id} value={m.user_id}>{personName(m.user_id)} · {m.role} · {m.status}</option>)}</select></label>
            <label>Document type<select style={field} value={caseType} onChange={(e) => { setCaseType(e.target.value as 'query' | 'warning'); setWarningReviewed(false); }}><option value="query">Formal query (request explanation)</option><option value="warning">Written warning (after review)</option></select></label>
            <label>Severity<select style={field} value={caseSeverity} onChange={(e) => setCaseSeverity(e.target.value)}>{['low','standard','serious','urgent'].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Response deadline<input style={field} type="date" value={caseDue} onChange={(e) => setCaseDue(e.target.value)} /></label>
          </div>
          <label style={{ display: 'block', marginTop: 10 }}>Subject/title<input required style={field} value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} maxLength={180} /></label>
          <label style={{ display: 'block', marginTop: 10 }}>Incident details and alleged rule breach<textarea required style={{ ...field, minHeight: 100 }} value={caseAllegation} onChange={(e) => setCaseAllegation(e.target.value)} maxLength={6000} /></label>
          <label style={{ display: 'block', marginTop: 10 }}>Policy / rule reference<input style={field} value={casePolicy} onChange={(e) => setCasePolicy(e.target.value)} maxLength={300} placeholder="School policy, staff handbook section, portal terms…" /></label>
          {caseType === 'warning' && <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '12px 0' }}><input type="checkbox" checked={warningReviewed} onChange={(e) => setWarningReviewed(e.target.checked)} /> I confirm that a human reviewer has considered the available evidence and decided that a written warning is appropriate.</label>}
          <button type="submit" style={actionButton} disabled={busyId === 'new-case'}>{busyId === 'new-case' ? 'Issuing…' : caseType === 'query' ? 'Issue formal query' : 'Issue written warning'}</button>
        </form>
        <div style={grid}>
          <label>Search cases<input style={field} value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} placeholder="Reference, person, title…" /></label>
          <label>Status<select style={field} value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)}><option value="all">All statuses</option>{['draft','issued','response_received','under_review','warning_issued','escalated','resolved','closed','withdrawn'].map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
        <strong style={{ display: 'block', margin: '14px 0 8px' }}>{filteredCases.length} compliance cases</strong>
        {loading ? <p>Loading cases…</p> : filteredCases.map((item) => <article key={item.id} style={{ border: '1px solid #e1e8e1', borderRadius: 9, padding: 12, marginTop: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong>{item.case_number} · {item.title}</strong><span style={{ fontSize: 12 }}>{item.status.replaceAll('_', ' ')}</span></div>
          <div style={{ fontSize: 13, color: '#536456', marginTop: 5 }}>{personName(item.subject_user_id)} · {item.case_type} · {item.severity} · {new Date(item.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.allegation}</p>
          {item.policy_reference && <div style={{ fontSize: 12 }}>Policy: {item.policy_reference}</div>}
          {item.response_due_at && <div style={{ fontSize: 12 }}>Response due: {new Date(item.response_due_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</div>}
          <label style={{ display: 'block', marginTop: 8 }}>Update case status<select style={field} value={item.status} disabled={busyId === item.id} onChange={(e) => void updateCase(item, e.target.value)}>{['issued','response_received','under_review','warning_issued','escalated','resolved','closed','withdrawn'].map((s) => <option key={s}>{s}</option>)}</select></label>
          {item.decision && <p><strong>Decision:</strong> {item.decision}</p>}
        </article>)}
        <p style={{ fontSize: 12, color: '#68766b', marginTop: 12 }}>The case record is created in the database. Recipient-facing delivery, response inbox and appeal workflow must be tested before this centre is used for formal disciplinary notices.</p>
      </>}
    </section>
  );
}
