import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

export default function InterviewCalendar() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/ats/calendar').then((res) => setRows(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Interview Calendar</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Candidate</th><th>Requirement</th><th>Client</th><th>When</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/candidates/${a.candidate.id}`}>{a.candidate.name}</Link></td>
                <td><Link to={`/requirements/${a.requirement.id}`}>{a.requirement.title}</Link></td>
                <td>{a.requirement.client?.name}</td>
                <td>{a.interviewAt ? new Date(a.interviewAt).toLocaleString() : '—'}</td>
                <td><span className="status">{a.interviewStatus}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="small-muted">No interviews scheduled.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
