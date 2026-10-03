/* Live smoke test against the running dev server. */
const BASE = 'http://127.0.0.1:5092';
const EMAIL = 'smoke@test.local';
const PASSWORD = 'Smoke#2026';

async function api(path, opts = {}, token) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

let pass = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok:', label); }
  else { console.error('  FAIL:', label); process.exitCode = 1; }
}

const health = await fetch(BASE + '/health').then((r) => r.json());
ok(health.ok === true, 'health check');

let reg = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Smoke Test', email: EMAIL, password: PASSWORD }) });
if (reg.status === 409) {
  reg = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
}
ok(reg.status === 201 || reg.status === 200, 'auth (register/login)');
const token = reg.body.accessToken;

const orch = await api('/api/orchards', { method: 'POST', body: JSON.stringify({ name: 'Smoke Bagicha', village: 'Theog', latitude: 31.21, longitude: 77.42, elevationM: 2250 }) }, token);
ok(orch.status === 201, 'create orchard');
const orchardId = orch.body.orchard.id;

const tree = await api(`/api/trees/orchards/${orchardId}/trees`, { method: 'POST', body: JSON.stringify({ code: 'S-1', variety: 'Royal Delicious', latitude: 31.2101, longitude: 77.4202 }) }, token);
ok(tree.status === 201, 'create tree');
const treeId = tree.body.treeId;

const plan = await api(`/api/spray/orchards/${orchardId}/plan?season=2026`, {}, token);
ok(plan.status === 200 && plan.body.stages.length === 12, `spray plan materialised (${plan.body.stages.length} stages)`);
const shiftNote = plan.body.stages[0].plannedStart;
console.log('  info: first stage plannedStart =', shiftNote, '(2250 m => +7d shift)');

const survey = await api(`/api/surveys/orchards/${orchardId}/surveys`, { method: 'POST', body: JSON.stringify({ type: 'harvest', season: '2026' }) }, token);
ok(survey.status === 201, 'create harvest survey');
const entry = await api(`/api/surveys/${survey.body.surveyId}/entries`, { method: 'POST', body: JSON.stringify({ treeId, fruitCountEst: 180, avgFruitWeightG: 150, canopyDensity: 65 }) }, token);
ok(entry.status === 201 && entry.body.estimatedYieldKg === 27, `survey entry yield=${entry.body.estimatedYieldKg}kg`);
const sum = await api(`/api/surveys/${survey.body.surveyId}`, {}, token);
ok(sum.body.summary.projectedOrchardKg === 27, 'orchard projection');

const hb = await api('/api/advice/handbook');
ok(hb.body.articles.length >= 20 && hb.body.diseases.length >= 12, 'advice handbook offline bundle');

console.log(`\nSMOKE RESULT: ${pass} checks passed${process.exitCode ? ' (with failures)' : ''}`);
