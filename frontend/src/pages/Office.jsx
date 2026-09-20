import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { downloadCsv } from '../utils/csv.js';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

const BLANK = {
  category: '', location: '', monthlyAmount: '', vendor: '',
  expenseDate: today(), gstAmount: '', paidStatus: 'Paid',
};

// Additive sub-tabs matching the reference Office & Accounts page. "Bills &
// expenses" is the existing, unmodified default view.
const OFF_TABS = [['bills', 'Bills & expenses'], ['gst', 'GST position'], ['pnl', 'Profit & Loss'], ['summary', 'Category & month summary']];

export default function Office() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState('');
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');
  const [offTab, setOffTab] = useState('bills');
  const [gst, setGst] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [basis, setBasis] = useState('accrual');

  const load = useCallback(() => {
    api.get('/office-expenses').then((res) => setExpenses(res.data));
    api.get('/office-expenses/summary', { params: month ? { month } : {} }).then((res) => setSummary(res.data));
  }, [month]);
  useEffect(load, [load]);

  useEffect(() => {
    if (offTab === 'gst') api.get('/office-expenses/gst-position').then((res) => setGst(res.data));
    if (offTab === 'pnl') api.get('/office-expenses/pnl', { params: { basis } }).then((res) => setPnl(res.data));
  }, [offTab, basis]);

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

      <div className="tabbar">
        {OFF_TABS.map(([key, label]) => (
          <button key={key} className={`tab-btn ${offTab === key ? 'active' : ''}`} onClick={() => setOffTab(key)}>{label}</button>
        ))}
      </div>

      {offTab === 'bills' && (
      <>
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
      </>
      )}

      {offTab === 'gst' && gst && (
        <div>
          <div className="card section">
            <h3>Filing position</h3>
            <div className="kv"><span className="k">Taxable value billed</span><span>{money(gst.filingPosition.taxableValue)}</span></div>
            <div className="kv"><span className="k">Output tax @18%</span><span>{money(gst.filingPosition.outputTax)}</span></div>
            <div className="kv"><span className="k">Purchases with GST</span><span>{money(gst.filingPosition.purchasesWithGst)}</span></div>
            <div className="kv"><span className="k">Input tax credit</span><span>{money(gst.filingPosition.inputTaxCredit)}</span></div>
            <div className="kv"><span className="k">Vendor bill numbers on file</span><span>{gst.filingPosition.vendorBillsOnFile}</span></div>
            <div className="kv"><span className="k">Vendor names on file</span><span>{gst.filingPosition.vendorNamesOnFile}</span></div>
          </div>
          <div className="card section">
            <h3>GST paid to vendors</h3>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Vendor</th><th>Entries</th><th>Bill amount</th><th>GST paid</th></tr></thead>
                <tbody>
                  {gst.byVendor.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td>{v.entries}</td><td>{money(v.billAmount)}</td><td>{money(v.gst)}</td></tr>)}
                  {gst.byVendor.length === 0 && <tr><td colSpan="4" className="small-muted">No vendor GST on file.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card section">
            <h3>Month-wise GST statement</h3>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Month</th><th>Invoices</th><th>GST charged</th><th>Purchase entries</th><th>GST paid</th><th>Net to Government</th><th>Position</th></tr></thead>
                <tbody>
                  {gst.byMonth.map((m) => (
                    <tr key={m.month}><td>{m.month}</td><td>{m.invoices}</td><td>{money(m.gstCharged)}</td><td>{m.purchaseEntries}</td><td>{money(m.gstPaid)}</td><td>{money(m.net)}</td><td><span className={`status ${m.position === 'Pay' ? 'priority-high' : 'priority-low'}`}>{m.position}</span></td></tr>
                  ))}
                  {gst.byMonth.length === 0 && <tr><td colSpan="7" className="small-muted">No GST activity yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card section">
            <h3>Every purchase with GST</h3>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>Taxable value</th><th>GST paid</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {gst.purchases.map((p, i) => (
                    <tr key={i}><td>{p.date || '—'}</td><td>{p.vendor}</td><td>{p.category}</td><td>{money(p.gross - p.gst)}</td><td>{money(p.gst)}</td><td>{money(p.gross)}</td><td><span className={`status ${p.status === 'Unpaid' ? 'priority-high' : 'priority-low'}`}>{p.status}</span></td></tr>
                  ))}
                  {gst.purchases.length === 0 && <tr><td colSpan="7" className="small-muted">No purchases with GST yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="small-muted">GST is never income and never a cost — it is collected on the government's behalf and paid across after setting off what was already paid to vendors. The Profit &amp; Loss page ignores GST completely on both sides.</div>
        </div>
      )}

      {offTab === 'pnl' && pnl && (
        <div>
          <div className="filter-row">
            <label className="field"><span>Basis</span>
              <select value={basis} onChange={(e) => setBasis(e.target.value)}>
                <option value="accrual">Accrual — work done &amp; bills raised</option>
                <option value="cash">Cash — money in &amp; out of the bank</option>
              </select>
            </label>
          </div>
          <div className="card section" style={{ borderColor: pnl.headline.profitOrLoss >= 0 ? 'var(--ok, #1e8449)' : 'var(--danger, #c0392b)' }}>
            <h3 style={{ fontSize: 22 }}>{pnl.headline.profitOrLoss >= 0 ? 'PROFIT' : 'LOSS'} {money(Math.abs(pnl.headline.profitOrLoss))}</h3>
            <div className="small-muted">Income {money(pnl.headline.income)} − Spend {money(pnl.headline.spend)} · Margin {pnl.headline.marginPct}%</div>
          </div>
          <div className="card section">
            <h3>Profit / loss by month</h3>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Month</th><th>Joins</th><th>Fee billed / Received</th><th>Expense entries</th><th>Office cost / Paid out</th><th>Profit / loss</th><th>Result</th><th>Running total</th></tr></thead>
                <tbody>
                  {pnl.months.map((m) => (
                    <tr key={m.month}><td>{m.month}</td><td>{m.joins}</td><td>{money(m.income)}</td><td>{m.expenseEntries}</td><td>{money(m.spend)}</td><td>{money(m.profitLoss)}</td><td><span className={`status ${m.result === 'Profit' ? 'priority-low' : 'priority-high'}`}>{m.result}</span></td><td>{money(m.runningTotal)}</td></tr>
                  ))}
                  {pnl.months.length === 0 && <tr><td colSpan="8" className="small-muted">Nothing on this basis yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card section">
            <h3>Not profit or loss — money held for someone else</h3>
            <div className="kv"><span className="k">GST collected</span><span>{money(pnl.notMoneyHeld.gstCollected)}</span></div>
            <div className="kv"><span className="k">GST paid to vendors (credit)</span><span>{money(pnl.notMoneyHeld.gstPaid)}</span></div>
            <div className="kv"><span className="k">TDS deducted by clients</span><span>{money(pnl.notMoneyHeld.tdsDeductedByClients)}</span></div>
          </div>
        </div>
      )}

      {offTab === 'summary' && summary && (
        <div>
          <div className="grid-2">
            <div className="card section">
              <h3>Category-wise summary</h3>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Category</th><th>Entries</th><th>Bill amount</th><th>GST</th><th>Net paid</th></tr></thead>
                  <tbody>
                    {summary.byCategory.map((c) => <tr key={c.key}><td>{c.key}</td><td>{c.count}</td><td>{money(c.gross)}</td><td>{money(c.gst)}</td><td>{money(c.net)}</td></tr>)}
                    {summary.byCategory.length === 0 && <tr><td colSpan="5" className="small-muted">Nothing yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => downloadCsv('expenses-by-category.csv', ['Category', 'Entries', 'Bill amount', 'GST', 'Net paid'], summary.byCategory.map((c) => [c.key, c.count, c.gross, c.gst, c.net]))}>⬇ CSV</button>
            </div>
            <div className="card section">
              <h3>Monthly summary</h3>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Month</th><th>Entries</th><th>Bill amount</th><th>GST</th><th>Net paid</th></tr></thead>
                  <tbody>
                    {summary.byMonth.map((m) => <tr key={m.key}><td>{m.key}</td><td>{m.count}</td><td>{money(m.gross)}</td><td>{money(m.gst)}</td><td>{money(m.net)}</td></tr>)}
                    {summary.byMonth.length === 0 && <tr><td colSpan="5" className="small-muted">No dated bills yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => downloadCsv('expenses-by-month.csv', ['Month', 'Entries', 'Bill amount', 'GST', 'Net paid'], summary.byMonth.map((m) => [m.key, m.count, m.gross, m.gst, m.net]))}>⬇ CSV</button>
            </div>
          </div>
          <div className="small-muted">"Net paid" is on a cash basis; "Actual paid" vs "Amortised" spreads recurring bills across the months they cover.</div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
