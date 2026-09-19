import { useEffect, useState } from 'react';
import api from '../../api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AccountsReports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/reports/accounts').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Accounts Reports</h1>
          <div className="page-sub">Totals are amount + GST − TDS, so they match what the client actually pays.</div>
        </div>
      </div>

      <div className="statbar">
        <Stat n={money(data.profitAndLoss.incomeNet)} l="Income (excl. GST)" />
        <Stat n={money(data.profitAndLoss.spendNet)} l="Spend (excl. GST)" />
        <Stat n={money(data.profitAndLoss.profit)} l="Profit" />
        <Stat n={money(data.tdsDeducted)} l="TDS deducted" />
        <Stat n={data.reconciliation.unmatched} l="Unmatched bank lines" />
      </div>

      <div className="card section">
        <h3>Invoices by status</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Status</th><th>Count</th><th>Total</th><th>Outstanding</th></tr></thead>
            <tbody>
              {data.byStatus.map((r) => (
                <tr key={r.status}><td>{r.status}</td><td>{r.count}</td><td>{money(r.amount)}</td><td>{money(r.outstanding)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Receivables ageing</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Bucket</th><th>Invoices</th><th>Outstanding</th></tr></thead>
            <tbody>
              {data.ageing.map((r) => (
                <tr key={r.bucket}><td>{r.bucket}</td><td>{r.count}</td><td>{money(r.outstanding)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Outstanding by client</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Client</th><th>Open invoices</th><th>Outstanding</th></tr></thead>
            <tbody>
              {data.byClient.map((r) => (
                <tr key={r.client}><td>{r.client}</td><td>{r.count}</td><td>{money(r.outstanding)}</td></tr>
              ))}
              {data.byClient.length === 0 && <tr><td colSpan="3" className="small-muted">Nothing outstanding.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card section">
          <h3>GST position</h3>
          <div className="kv"><span className="k">Charged to clients</span><span>{money(data.gstPosition.charged)}</span></div>
          <div className="kv"><span className="k">Paid to vendors</span><span>− {money(data.gstPosition.paid)}</span></div>
          <div className="kv">
            <span className="k">{data.gstPosition.payable >= 0 ? 'Payable' : 'Credit carried'}</span>
            <span style={{ fontWeight: 700 }}>{money(Math.abs(data.gstPosition.payable))}</span>
          </div>
        </div>
        <div className="card section">
          <h3>Reconciliation position</h3>
          <div className="kv"><span className="k">Statement lines</span><span>{data.reconciliation.total}</span></div>
          <div className="kv"><span className="k">Unmatched</span><span>{data.reconciliation.unmatched}</span></div>
          <div className="kv"><span className="k">Matched, not reconciled</span><span>{data.reconciliation.matched}</span></div>
          <div className="kv"><span className="k">Reconciled</span><span>{data.reconciliation.reconciled}</span></div>
          <div className="kv"><span className="k">Ignored</span><span>{data.reconciliation.ignored}</span></div>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
