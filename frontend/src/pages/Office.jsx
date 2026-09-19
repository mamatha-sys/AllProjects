import { useCallback, useEffect, useState } from 'react';
import api from '../api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

const BLANK = {
  category: '', location: '', monthlyAmount: '', vendor: '',
  expenseDate: today(), gstAmount: '', paidStatus: 'Paid',
};

export default function Office() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState('');
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/office-expenses').then((res) => setExpenses(res.data));
    api.get('/office-expenses/summary', { params: month ? { month } : {} }).then((res) => setSummary(res.data));
  }, [month]);
  useEffect(load, [load]);

  async function run(fn) {
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'That did not work.');
    }
  }

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/office-expenses', form);
      setForm(BLANK);
    });
  };

  const rows = month ? expenses.filter((x) => x.month === month) : expenses;
  const months = [...new Set(expenses.map((x) => x.month).filter(Boolean))].sort().reverse();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Office / Business</h1>
          <div className="page-sub">Office spend by category and month, the profit &amp; loss, and the GST position — charged to clients against paid to vendors.</div>
        </div>
      </div>

      {error && <div className="card section error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {summary && (
        <>
          <div className="statbar">
            <Stat n={money(summary.profitAndLoss.incomeNet)} l="Income (excl. GST)" />
            <Stat n={money(summary.profitAndLoss.spendNet)} l="Spend (excl. GST)" />
            <Stat n={money(summary.profitAndLoss.profit)} l="Profit" />
            <Stat n={`${summary.profitAndLoss.marginPct}%`} l="Margin" />
            <Stat n={summary.unpaidCount} l="Bills unpaid" />
            <Stat n={money(summary.unpaidValue)} l="Unpaid value" />
          </div>

          <div className="card section">
            <h3>GST position</h3>
            <div className="kv"><span className="k">GST charged to clients (output)</span><span>{money(summary.gstPosition.charged)}</span></div>
            <div className="kv"><span className="k">GST paid to vendors (input credit)</span><span>− {money(summary.gstPosition.paid)}</span></div>
            <div className="kv">
              <span className="k">{summary.gstPosition.payable >= 0 ? 'Payable to the government' : 'Credit carried forward'}</span>
              <span style={{ fontWeight: 700 }}>{money(Math.abs(summary.gstPosition.payable))}</span>
            </div>
          </div>
        </>
      )}

      <div className="filter-row">
        <label className="field" style={{ minWidth: 200 }}>
          <span>Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {summary && (
        <div className="grid-2">
          <div className="card section">
            <h3>By category</h3>
            {summary.byCategory.map((c) => (
              <div className="kv" key={c.key}>
                <span className="k">{c.key} <span className="small-muted">({c.count})</span></span>
                <span>{money(c.net)} <span className="small-muted">net</span></span>
              </div>
            ))}
            {summary.byCategory.length === 0 && <div className="small-muted">Nothing in this period.</div>}
          </div>
          <div className="card section">
            <h3>By month</h3>
            {summary.byMonth.map((m) => (
              <div className="kv" key={m.key}>
                <span className="k">{m.key} <span className="small-muted">({m.count})</span></span>
                <span>{money(m.net)} <span className="small-muted">net</span></span>
              </div>
            ))}
            {summary.byMonth.length === 0 && <div className="small-muted">No dated bills yet.</div>}
          </div>
        </div>
      )}

      <form className="card section" onSubmit={add}>
        <h3>Add a bill</h3>
        <div className="grid-2">
          <label className="field"><span>Category</span><input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label className="field"><span>Vendor</span><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
          <label className="field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          <label className="field"><span>Date</span><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></label>
          <label className="field"><span>Amount incl. GST (₹)</span><input required type="number" step="0.01" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} /></label>
          <label className="field"><span>of which GST (₹)</span><input type="number" step="0.01" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} /></label>
          <label className="field"><span>Paid?</span>
            <select value={form.paidStatus} onChange={(e) => setForm({ ...form, paidStatus: e.target.value })}>
              <option>Paid</option><option>Unpaid</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Add expense</button>
      </form>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Location</th><th>Gross</th><th>GST</th><th>Net</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{e.expenseDate || '—'}</td>
                <td>{e.category}</td>
                <td>{e.vendor || '—'}</td>
                <td>{e.location || 'All'}</td>
                <td>{money(e.gross)}</td>
                <td>{money(e.gst)}</td>
                <td>{money(e.net)}</td>
                <td><span className={`status ${e.paidStatus === 'Unpaid' ? 'priority-high' : 'priority-low'}`}>{e.paidStatus}</span></td>
                <td>
                  <div className="qa-row">
                    {e.paidStatus === 'Unpaid' && (
                      <button className="btn btn-sm" onClick={() => run(() => api.patch(`/office-expenses/${e.id}`, { paidStatus: 'Paid' }))}>Mark paid</button>
                    )}
                    <button className="btn btn-sm" onClick={() => run(() => api.delete(`/office-expenses/${e.id}`))}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="9" className="small-muted">No expenses in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
