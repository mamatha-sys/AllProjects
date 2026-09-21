import { useCallback, useEffect, useState } from 'react';
import api from '../api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);

// Office & Accounts is one module with four tabs, exactly as the accounting
// application arranges it: the bills themselves, the GST position, the profit
// & loss, and the category / month summary. GST has no page of its own — the
// output side comes from invoices, the input side from bills.
const OFF_TABS = [
  ['bills', 'Bills & expenses', 'Every office bill, grouped whichever way you need'],
  ['gst', 'GST position', 'What we charged clients against what we paid vendors — month by month, the way GSTR-3B reads it'],
  ['pnl', 'Profit & Loss', 'Income against office spend, on bills raised and on cash actually moved'],
  ['summary', 'Category & month summary', 'Where the money goes, by category and by month'],
];

const PERIODS = (() => {
  const fy = new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return [
    ['all', 'Every month on record'],
    [`FY:${fy}`, `FY ${fy}–${String(fy + 1).slice(2)}`],
    [`H1:${fy}`, `Apr–Sep ${fy}`],
    [`H2:${fy}`, `Oct–Mar ${fy}–${String(fy + 1).slice(2)}`],
    [`FY:${fy - 1}`, `FY ${fy - 1}–${String(fy).slice(2)}`],
  ];
})();

const BLANK = {
  category: '', vendor: '', vendorGstin: '', billNumber: '', location: '', expenseDate: today(),
  monthlyAmount: '', gstAmount: '', tdsAmount: '', frequency: 'Monthly', monthsCovered: '',
  paymentMode: 'Cash', paidStatus: 'Paid', description: '',
};

export default function Office() {
  const [tab, setTab] = useState('bills');
  const [period, setPeriod] = useState('all');
  const [error, setError] = useState('');

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Office / Business</h1>
          <div className="page-sub">
            Office spend, the category and month summary, profit &amp; loss, and the GST position —
            charged to clients against paid to vendors.
          </div>
        </div>
      </div>

      <div className="tabbar">
        {OFF_TABS.map(([k, label]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="small-muted" style={{ marginTop: -8, marginBottom: 14 }}>
        {(OFF_TABS.find(([k]) => k === tab) || [])[2]}
      </div>

      <div className="filter-row">
        <label className="field" style={{ minWidth: 220 }}><span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="card section error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {tab === 'bills' && <Bills period={period} onError={setError} />}
      {tab === 'gst' && <Gst period={period} />}
      {tab === 'pnl' && <Pnl period={period} />}
      {tab === 'summary' && <Summary period={period} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bills & expenses
// ---------------------------------------------------------------------------
function Bills({ period, onError }) {
  const [data, setData] = useState(null);
  const [f, setF] = useState({ category: 'All', vendor: 'All', status: 'All', gst: 'All', q: '' });
  const [form, setForm] = useState(BLANK);

  const load = useCallback(() => {
    api.get('/office-expenses/bills', { params: { period, ...f } }).then((res) => setData(res.data));
  }, [period, f]);
  useEffect(load, [load]);

  async function run(fn) {
    onError('');
    try { await fn(); load(); } catch (e) { onError(e.response?.data?.error || 'That did not work.'); }
  }

  const add = (e) => {
    e.preventDefault();
    run(async () => { await api.post('/office-expenses', form); setForm(BLANK); });
  };

  if (!data) return <div className="small-muted">Loading…</div>;
  const t = data.totals;
  const g = data.gst;
  const whole = data.filtered ? ' · whole period, not this filter' : '';

  return (
    <>
      <div className="statbar">
        <Stat n={t.n} l="Entries" s={`${data.options.categories.length} categor${data.options.categories.length === 1 ? 'y' : 'ies'}`} />
        <Stat n={money(t.net)} l="Total amount" s={`before GST ${money(t.base)} · GST ${money(t.gst)} · after GST ${money(t.gross)}`} />
        <Stat n={money(t.paid)} l="Paid" s={t.paid ? 'Cash already out' : 'nothing paid yet'} tone="good" />
        <Stat n={money(t.pendingValue)} l="Pending to pay" s={t.pendingValue ? 'still to be paid' : 'nobody — everything is paid'} tone={t.pendingValue > 0.5 ? 'bad' : 'good'} />
        <Stat n={money(g.out)} l="GST received from clients" s={`${money(g.outReceived)} actually collected · ${money(g.pending)} still to come${whole}`} />
        <Stat n={money(g.input)} l="GST paid to vendors" s={`Input credit you can claim${whole}`} />
        <Stat
          n={money(Math.abs(g.net))}
          l={g.net >= 0 ? 'GST payable to Government' : 'GST credit carried'}
          s={`charged ${money(g.out)} − paid ${money(g.input)}${whole}`}
          tone={g.net >= 0 ? 'bad' : 'good'}
        />
        <Stat n={money(t.tds)} l="TDS we cut" s={`Held back from vendors and paid on their behalf${data.filtered ? ' · in this filter' : ''}`} />
        <Stat
          n={money(Math.abs(data.profit.pl))}
          l={data.profit.pl >= 0 ? 'Profit' : 'Loss'}
          s={`income ${money(data.profit.income)} − spend ${money(data.profit.spend)}${whole}`}
          tone={data.profit.pl >= 0 ? 'good' : 'bad'}
        />
        <Stat
          n={money(Math.abs(data.cashProfit.pl))}
          l={data.cashProfit.pl >= 0 ? 'Profit on cash' : 'Loss on cash'}
          s={`${money(data.cashProfit.cashIn)} in − ${money(data.cashProfit.paid)} out${whole}`}
          tone={data.cashProfit.pl >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="filter-row">
        <label className="field"><span>Category · {data.options.categories.length}</span>
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option>All</option>{data.options.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>Vendor · {data.options.vendors.length}</span>
          <select value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>
            <option>All</option>{data.options.vendors.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="field"><span>Status</span>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {data.options.statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field"><span>GST</span>
          <select value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })}>
            {data.options.gst.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 200 }}><span>Search anything</span>
          <input value={f.q} placeholder="Category, vendor, reason…" onChange={(e) => setF({ ...f, q: e.target.value })} />
        </label>
        {data.filtered && <button className="btn btn-sm" onClick={() => setF({ category: 'All', vendor: 'All', status: 'All', gst: 'All', q: '' })}>Reset</button>}
      </div>

      {data.outsidePeriod > 0 && (
        <div className="notice amber">
          <span>{data.outsidePeriod} bill(s) on record fall outside the period you picked, so they are not in the figures above.</span>
        </div>
      )}

      <div className="card section">
        <h3>{data.rows.length} bill(s) · {money(t.net)}</h3>
        <div className="small-muted" style={{ marginBottom: 10 }}>
          One table — group it whichever way you need
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Paid to</th><th>Category</th><th>Bill no</th><th>Vendor GSTIN</th>
                <th className="num">Before GST</th><th className="num">GST</th><th className="num">TDS</th>
                <th className="num">Total</th><th className="num">Paid</th><th className="num">Pending</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((e) => (
                <tr key={e.id}>
                  <td>{e.expenseDate || '—'}</td>
                  <td>{e.vendor || '—'}</td>
                  <td>{e.category}</td>
                  <td className="small-muted">{e.billNumber || '—'}</td>
                  <td className="small-muted">{e.vendorGstin || <span className="status priority-high">missing</span>}</td>
                  <td className="num">{money(e.base)}</td>
                  <td className="num">{e.gst ? money(e.gst) : '—'}</td>
                  <td className="num">{e.tds ? money(e.tds) : '—'}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(e.total)}</td>
                  <td className="num">{money(e.paidValue)}</td>
                  <td className="num">{money(e.pendingValue)}</td>
                  <td><span className={`status ${e.statusLabel === 'Pending' ? 'priority-high' : 'priority-low'}`}>{e.statusLabel}</span></td>
                  <td>
                    <div className="qa-row">
                      {e.statusLabel === 'Pending' && <button className="btn btn-sm" onClick={() => run(() => api.patch(`/office-expenses/${e.id}`, { paidStatus: 'Paid' }))}>Mark paid</button>}
                      <button className="btn btn-sm" onClick={() => run(() => api.delete(`/office-expenses/${e.id}`))}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan="13" className="small-muted">No expenses in this period.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="5">TOTAL</td>
                <td className="num">{money(t.base)}</td>
                <td className="num">{money(t.gst)}</td>
                <td className="num">{money(t.tds)}</td>
                <td className="num">{money(t.gross)}</td>
                <td className="num">{money(t.paid)}</td>
                <td className="num">{money(t.pendingValue)}</td>
                <td colSpan="2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <form className="card section" onSubmit={add} style={{ marginTop: 16 }}>
        <h3>New expense</h3>
        <div className="small-muted" style={{ marginBottom: 10 }}>
          A loan is not a cost — it stays out of profit and GST. GST here is what you <b>paid</b> the
          vendor (input credit); TDS is what you <b>deducted</b> from the vendor and must deposit.
        </div>
        <div className="grid-3">
          <label className="field"><span>Expense account *</span><input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label className="field"><span>Expense date *</span><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></label>
          <label className="field"><span>Vendor</span><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
          <label className="field"><span>Vendor GSTIN</span><input value={form.vendorGstin} onChange={(e) => setForm({ ...form, vendorGstin: e.target.value })} /></label>
          <label className="field"><span>Bill no</span><input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} /></label>
          <label className="field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          <label className="field"><span>Reason / description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="field"><span>Bill amount incl. GST (₹) *</span><input required type="number" step="0.01" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} /></label>
          <label className="field"><span>of which GST (₹)</span><input type="number" step="0.01" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} /></label>
          <label className="field"><span>TDS deducted (₹)</span><input type="number" step="0.01" value={form.tdsAmount} onChange={(e) => setForm({ ...form, tdsAmount: e.target.value })} /></label>
          <label className="field"><span>Payment frequency</span>
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {data.options.frequencies.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="field"><span>Custom months covered</span><input type="number" min="1" placeholder="leave blank = by frequency" value={form.monthsCovered} onChange={(e) => setForm({ ...form, monthsCovered: e.target.value })} /></label>
          <label className="field"><span>Payment mode</span>
            <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
              {data.options.modes.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="field"><span>Paid?</span>
            <select value={form.paidStatus} onChange={(e) => setForm({ ...form, paidStatus: e.target.value })}>
              <option>Paid</option><option>Pending</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Add expense</button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// GST position
// ---------------------------------------------------------------------------
function Gst({ period }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/office-expenses/gst', { params: { period } }).then((r) => setData(r.data)); }, [period]);
  if (!data) return <div className="small-muted">Loading…</div>;
  const t = data.totals;

  return (
    <>
      <div className="statbar">
        <Stat n={money(t.output)} l="Output GST — charged to clients" s="On our invoices" />
        <Stat n={money(t.input)} l="Input GST — paid to vendors" s="Credit we can claim" />
        <Stat
          n={money(Math.abs(t.net))}
          l={t.net >= 0 ? 'Payable to Government' : 'Credit carried'}
          s={`charged ${money(t.output)} − paid ${money(t.input)}`}
          tone={t.net >= 0 ? 'bad' : 'good'}
        />
        <Stat
          n={money(data.unclaimable.value)}
          l="Cannot be claimed yet"
          s={data.unclaimable.count ? `${data.unclaimable.count} bill(s) with no vendor GSTIN` : 'every bill has a GSTIN'}
          tone={data.unclaimable.value > 0.5 ? 'bad' : 'good'}
        />
      </div>

      <div className="card section">
        <h3>Month by month</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>{data.period.label} — the way GSTR-3B reads it</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th><th className="num">Invoices</th><th className="num">Taxable value (out)</th><th className="num">Output GST</th>
                <th className="num">Bills</th><th className="num">Taxable value (in)</th><th className="num">Input GST</th><th className="num">Net payable</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.label}</td>
                  <td className="num">{r.invoices}</td>
                  <td className="num">{money(r.taxableOutput)}</td>
                  <td className="num">{money(r.output)}</td>
                  <td className="num">{r.bills}</td>
                  <td className="num">{money(r.taxableInput)}</td>
                  <td className="num">{money(r.input)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(r.net)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan="8" className="small-muted">No data in this period.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td><td /><td /><td className="num">{money(t.output)}</td>
                <td /><td /><td className="num">{money(t.input)}</td><td className="num">{money(t.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="notice" style={{ marginTop: 12 }}>
          <span>GST is never income and never an expense — it is collected on Government&apos;s behalf and paid across after setting off what we already paid our vendors.</span>
        </div>
      </div>

      {data.unclaimable.count > 0 && (
        <div className="card section">
          <h3>Input credit that cannot be claimed yet</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>These bills carry GST but no vendor GSTIN is on file.</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Date</th><th>Expense account</th><th>Vendor</th><th className="num">GST</th></tr></thead>
              <tbody>
                {data.unclaimable.rows.map((r) => (
                  <tr key={r.id}><td>{r.expenseDate}</td><td>{r.category}</td><td>{r.vendor || '—'}</td><td className="num">{money(r.gst)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Profit & Loss
// ---------------------------------------------------------------------------
function Pnl({ period }) {
  const [basis, setBasis] = useState('accrual');
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/office-expenses/pnl', { params: { period, basis } }).then((r) => setData(r.data)); }, [period, basis]);
  if (!data) return <div className="small-muted">Loading…</div>;
  const t = data.totals;
  const profit = t.pl >= 0;

  return (
    <>
      <div className="filter-row">
        <label className="field" style={{ minWidth: 260 }}><span>Basis</span>
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="accrual">Accrual — work done &amp; bills raised</option>
            <option value="cash">Cash — money in &amp; out of the bank</option>
          </select>
        </label>
        <label className="field" style={{ minWidth: 300 }}><span>What this means</span>
          <input
            disabled
            value={basis === 'accrual'
              ? 'Fee billed (GST excluded) minus office cost (GST excluded)'
              : 'Money received from clients minus money actually paid out'}
          />
        </label>
      </div>

      <div className="card section">
        <h3>{basis === 'accrual' ? 'Business result' : 'Cash result'} · {data.rows.length} month(s)</h3>
        <div style={{ fontSize: 30, fontWeight: 700, color: profit ? 'var(--teal)' : 'var(--red)', margin: '6px 0' }}>
          {profit ? 'PROFIT' : 'LOSS'} {money(Math.abs(t.pl))}
        </div>
        <div className="small-muted">
          {money(t.income)} {basis === 'accrual' ? 'billed' : 'received'} − {money(t.spend)} {basis === 'accrual' ? 'office cost' : 'paid out'}
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div>
            <div className="kv"><span className="k">{basis === 'accrual' ? 'Fee billed (excl GST)' : 'Received from clients'}</span><span>{money(t.income)}</span></div>
            <div className="kv"><span className="k">{basis === 'accrual' ? 'Office expenses (excl GST)' : 'Paid out of the bank'}</span><span>({money(t.spend)})</span></div>
            <div className="kv" style={{ fontWeight: 700 }}><span className="k">{profit ? 'Profit' : 'Loss'}</span><span>{money(Math.abs(t.pl))}</span></div>
            <div className="kv"><span className="k">Margin on income</span><span>{t.income ? Math.round((t.pl / t.income) * 100) : 0}%</span></div>
          </div>
          <div className="notice">
            <span>
              {basis === 'accrual'
                ? `On paper you have ${data.accrual.pl >= 0 ? 'made' : 'lost'} ${money(Math.abs(data.accrual.pl))}. On cash the position is ${data.cash.pl >= 0 ? 'a surplus of ' : 'a shortfall of '}${money(Math.abs(data.cash.pl))} — the gap is money billed but not yet collected (${money(data.receivable)} still pending).`
                : `In the bank you are ${data.cash.pl >= 0 ? 'up' : 'down'} ${money(Math.abs(data.cash.pl))}. On work done the result is ${data.accrual.pl >= 0 ? 'a profit of ' : 'a loss of '}${money(Math.abs(data.accrual.pl))} — ${money(data.receivable)} billed is still to be collected.`}
            </span>
          </div>
        </div>
      </div>

      <div className="card section">
        <h3>Month by month</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>{basis === 'accrual' ? 'Billing against office cost' : 'Collections against payments'}</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th><th className="num">Joins</th><th className="num">{basis === 'accrual' ? 'Fee billed' : 'Received'}</th>
                <th className="num">Expense entries</th><th className="num">{basis === 'accrual' ? 'Office cost' : 'Paid out'}</th>
                <th className="num">Profit / loss</th><th>Result</th><th className="num">Running total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.month}>
                  <td>
                    {r.label}
                    {r.noExp && <div className="small-muted">no expenses recorded</div>}
                    {r.noInc && <div className="small-muted">no billing recorded</div>}
                  </td>
                  <td className="num">{r.joins || '—'}</td>
                  <td className="num">{money(r.income)}</td>
                  <td className="num">{r.entries || '—'}</td>
                  <td className="num">{money(r.spend)}</td>
                  <td className="num" style={{ fontWeight: 700, color: r.pl >= 0 ? 'var(--teal)' : 'var(--red)' }}>{r.pl < 0 ? '−' : ''}{money(Math.abs(r.pl))}</td>
                  <td><span className={`status ${r.pl >= 0 ? 'priority-low' : 'priority-high'}`}>{r.pl >= 0 ? 'Profit' : 'Loss'}</span></td>
                  <td className="num">{r.cum < 0 ? '−' : ''}{money(Math.abs(r.cum))}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan="8" className="small-muted">No data yet.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td><td className="num">{t.joins}</td><td className="num">{money(t.income)}</td>
                <td className="num">{t.entries}</td><td className="num">{money(t.spend)}</td>
                <td className="num">{t.pl < 0 ? '−' : ''}{money(Math.abs(t.pl))}</td><td /><td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Category & month summary
// ---------------------------------------------------------------------------
function Summary({ period }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/office-expenses/summary-tabs', { params: { period } }).then((r) => setData(r.data)); }, [period]);
  if (!data) return <div className="small-muted">Loading…</div>;
  const t = data.totals;

  return (
    <>
      <div className="statbar">
        <Stat n={money(t.net)} l="Total spend (net)" s={`${t.n} entries`} />
        <Stat n={money(t.paid)} l="Cash paid" s="Settled" tone="good" />
        <Stat n={money(t.gst)} l="GST input credit" s={`${data.gstEntries} entries with GST`} />
        <Stat n={money(t.tds)} l="TDS deducted" s={`${data.tdsEntries} entries with TDS`} />
      </div>

      <div className="card section">
        <h3>GST &amp; TDS compliance</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>For your returns</div>
        <div className="kv"><span className="k">Entries with GST applicable</span><span>{data.gstEntries}</span></div>
        <div className="kv"><span className="k">Total GST paid (input credit)</span><span>{money(t.gst)}</span></div>
        <div className="kv"><span className="k">Entries with TDS applicable</span><span>{data.tdsEntries}</span></div>
        <div className="kv"><span className="k">Total TDS deducted</span><span>{money(t.tds)}</span></div>
        <div className="kv"><span className="k">Bill amount (base)</span><span>{money(t.base)}</span></div>
        <div className="kv" style={{ fontWeight: 700 }}><span className="k">Net amount paid</span><span>{money(t.net)}</span></div>
        <div className="notice" style={{ marginTop: 12 }}>
          <span>
            GST here is what you <b>paid</b> vendors — input credit against the GST you collect on
            invoices. TDS here is what you <b>deducted</b> from vendors and must deposit.
          </span>
        </div>
      </div>

      <div className="card section">
        <h3>Category-wise summary</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>{data.byCategory.length} categories</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Category</th><th className="num">Entries</th><th className="num">Bill amount</th><th className="num">GST</th><th className="num">TDS</th><th className="num">Net paid</th><th className="num">Share</th></tr>
            </thead>
            <tbody>
              {data.byCategory.map((c) => (
                <tr key={c.key}>
                  <td><b>{c.key}</b></td>
                  <td className="num">{c.n}</td>
                  <td className="num">{money(c.base)}</td>
                  <td className="num">{c.gst ? money(c.gst) : '—'}</td>
                  <td className="num">{c.tds ? money(c.tds) : '—'}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(c.net)}</td>
                  <td className="num">{t.net ? Math.round((c.net / t.net) * 100) : 0}%</td>
                </tr>
              ))}
              {data.byCategory.length === 0 && <tr><td colSpan="7" className="small-muted">No data.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td>TOTAL</td><td className="num">{t.n}</td><td className="num">{money(t.base)}</td><td className="num">{money(t.gst)}</td><td className="num">{money(t.tds)}</td><td className="num">{money(t.net)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Monthly summary</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>Cash basis vs amortised</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Month</th><th className="num">Actual paid</th><th className="num">Amortised</th><th className="num">GST</th><th className="num">TDS</th><th className="num">Pending</th><th className="num">Entries</th></tr>
            </thead>
            <tbody>
              {data.byMonth.map((r) => (
                <tr key={r.month}>
                  <td><b>{r.label}</b></td>
                  <td className="num">{money(r.cash)}</td>
                  <td className="num">{money(r.amortised)}</td>
                  <td className="num">{r.gst ? money(r.gst) : '—'}</td>
                  <td className="num">{r.tds ? money(r.tds) : '—'}</td>
                  <td className="num">{r.pending ? money(r.pending) : '—'}</td>
                  <td className="num">{r.n}</td>
                </tr>
              ))}
              {data.byMonth.length === 0 && <tr><td colSpan="7" className="small-muted">No data.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="small-muted" style={{ marginTop: 8 }}>
          &quot;Actual paid&quot; is what left the bank that month. &quot;Amortised&quot; spreads a yearly or
          one-time payment across the months it covers — same as the workbook.
        </div>
      </div>
    </>
  );
}

function Stat({ n, l, s, tone }) {
  return (
    <div className={`statitem${tone ? ` acct-${tone}` : ''}`}>
      <div className="n">{n}</div>
      <div className="l">{l}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}
