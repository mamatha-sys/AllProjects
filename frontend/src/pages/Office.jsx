import { useEffect, useState } from 'react';
import api from '../api';

export default function Office() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ category: '', location: '', monthlyAmount: '' });

  function load() {
    api.get('/office-expenses').then((res) => setExpenses(res.data));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    await api.post('/office-expenses', form);
    setForm({ category: '', location: '', monthlyAmount: '' });
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Office / Business</h1></div>

      <form className="card section" onSubmit={add}>
        <div className="grid-2">
          <label className="field"><span>Category</span><input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label className="field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          <label className="field"><span>Monthly Amount (₹)</span><input required type="number" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Add expense</button>
      </form>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Category</th><th>Location</th><th>Monthly</th></tr></thead>
          <tbody>
            {expenses.map((e) => <tr key={e.id}><td>{e.category}</td><td>{e.location || 'All'}</td><td>₹{e.monthlyAmount.toLocaleString('en-IN')}</td></tr>)}
            {expenses.length === 0 && <tr><td colSpan="3" className="small-muted">No expenses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
