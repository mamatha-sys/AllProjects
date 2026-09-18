import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

export default function Surveys() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [surveys, setSurveys] = useState([]);
  const [form, setForm] = useState({ title: '', questions: '' });
  const [answers, setAnswers] = useState({});

  function load() {
    api.get('/surveys').then((res) => setSurveys(res.data));
  }
  useEffect(load, []);

  async function createSurvey(e) {
    e.preventDefault();
    const questions = form.questions.split('\n').map((q) => q.trim()).filter(Boolean);
    await api.post('/surveys', { title: form.title, questions });
    setForm({ title: '', questions: '' });
    load();
  }

  async function respond(surveyId, questions) {
    const answerList = questions.map((_, i) => answers[`${surveyId}-${i}`] || '');
    await api.post(`/surveys/${surveyId}/respond`, { answers: answerList });
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Surveys</h1></div>

      {isHR && (
        <form className="card section" onSubmit={createSurvey}>
          <h3>Create survey</h3>
          <label className="field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="field" style={{ marginTop: 8 }}>
            <span>Questions (one per line)</span>
            <textarea rows="3" value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} style={{ padding: 8, borderRadius: 7, border: '1px solid var(--line)' }} />
          </label>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} type="submit">Create</button>
        </form>
      )}

      {surveys.map((s) => (
        <div className="card section" key={s.id}>
          <h3>{s.title} <span className="status">{s.status}</span></h3>
          {!isHR ? (
            <div>
              {s.questions.map((q, i) => (
                <label className="field" key={i} style={{ marginBottom: 8 }}>
                  <span>{q}</span>
                  <input value={answers[`${s.id}-${i}`] || ''} onChange={(e) => setAnswers({ ...answers, [`${s.id}-${i}`]: e.target.value })} />
                </label>
              ))}
              <button className="btn btn-sm btn-primary" onClick={() => respond(s.id, s.questions)}>Submit response</button>
            </div>
          ) : (
            <div className="small-muted">{s.responses.length} response(s) collected</div>
          )}
        </div>
      ))}
      {surveys.length === 0 && <div className="small-muted">No surveys yet.</div>}
    </div>
  );
}
