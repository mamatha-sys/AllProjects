import { Link } from 'react-router-dom';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const money2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function ageInfo(dueDate, pending) {
  if (pending <= 0.5) return { label: 'Settled', cls: 'priority-low' };
  if (!dueDate) return { label: 'No due date', cls: '' };
  const days = Math.floor((Date.now() - new Date(dueDate)) / 86400000);
  if (days < 0) return { label: 'Not due yet', cls: '' };
  if (days <= 30) return { label: '0–30 days', cls: 'priority-medium' };
  if (days <= 60) return { label: '31–60 days', cls: 'priority-medium' };
  if (days <= 90) return { label: '61–90 days', cls: 'priority-high' };
  return { label: '90+ days', cls: 'priority-high' };
}

// The reference Work page's invoice-account detail — shown inline under an
// expanded invoice row: what the invoice is made of, its dates & papers,
// the payments recorded against it, and the same actions the row's own
// buttons offer (kept as one implementation, not a second copy of them).
export default function InvoiceAccountPanel({ group, onPrint, onPay, onClose }) {
  const g = group;
  const payments = g.rows.flatMap((r) => (r.payments || []).map((p) => ({ ...p, candidate: r.candidate?.name || r.candidateName || '—' })));
  const age = ageInfo(g.dueDate, g.pending);
  const tdsCerts = g.rows.map((r) => r.tdsCertificate).filter(Boolean);
  const tdsLabel = g.tds <= 0.5
    ? 'no TDS'
    : tdsCerts.length && tdsCerts.every((c) => c.status === 'Received') ? 'received' : 'not received';

  return (
    <div style={{ padding: '12px 0' }}>
      <div className="grid-2">
        <div className="card section" style={{ margin: 0 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>What this invoice is made of</h3>
          <div className="kv"><span className="k">Fee before GST</span><span>{money2(g.before)}</span></div>
          <div className="kv"><span className="k">GST charged</span><span>{money2(g.gst)}</span></div>
          <div className="kv"><span className="k">Invoice value after GST</span><span>{money2(g.before + g.gst)}</span></div>
          <div className="kv"><span className="k">Less TDS deducted by client</span><span>({money2(g.tds)})</span></div>
          <div className="kv" style={{ fontWeight: 700 }}><span className="k">Amount receivable</span><span>{money2(g.before + g.gst - g.tds)}</span></div>
          <div className="kv"><span className="k">Received so far</span><span style={{ color: 'var(--ok, #1e8449)' }}>{money2(g.received)}</span></div>
          <div className="kv" style={{ fontWeight: 700 }}><span className="k">Still pending</span><span style={{ color: g.pending > 0.5 ? 'var(--danger, #c0392b)' : 'var(--ok, #1e8449)' }}>{money2(g.pending)}</span></div>
        </div>
        <div className="card section" style={{ margin: 0 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Dates &amp; papers</h3>
          <div className="kv"><span className="k">Invoice date</span><span>{fmtD(g.invoiceDate)}</span></div>
          <div className="kv"><span className="k">Payment due</span><span>{fmtD(g.dueDate)}</span></div>
          <div className="kv"><span className="k">Age</span><span><span className={`status ${age.cls}`}>{age.label}</span></span></div>
          <div className="kv"><span className="k">TDS certificate</span><span className="small-muted">{tdsLabel}</span></div>
        </div>
      </div>

      <div className="card section">
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Payments against this invoice</h3>
        {payments.length === 0 ? (
          <div className="small-muted">No payment recorded against this invoice yet.</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Date</th><th>Candidate</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}><td>{p.date}</td><td>{p.candidate}</td><td>{money(p.amount)}</td><td>{p.method}</td><td>{p.reference || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="qa-row">
        <button className="btn btn-sm" onClick={onClose}>▴ Close</button>
        <Link className="btn btn-sm btn-primary" to={`/invoices/${g.rows[0].id}`}>₹ Full account</Link>
        {g.invoiceNumber && <button className="btn btn-sm" onClick={onPrint}>👁 Printable invoice</button>}
        {g.pending > 0.5 && <button className="btn btn-sm" onClick={onPay}>+ Record a payment</button>}
      </div>
    </div>
  );
}
