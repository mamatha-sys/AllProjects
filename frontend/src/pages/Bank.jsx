import { useCallback, useEffect, useState } from 'react';
import api from '../api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// The reconciliation state machine, as the accountant sees it.
const STATES = ['All', 'Unmatched', 'Matched', 'Reconciled', 'Ignored'];

const STATE_CLASS = {
  Reconciled: 'priority-low',
  Matched: 'priority-medium',
  Unmatched: 'priority-high',
  Ignored: '',
};

export default function Bank() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [state, setState] = useState('All');
  const [picked, setPicked] = useState({}); // txnId -> invoiceId chosen for a manual match
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [csv, setCsv] = useState('');
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get('/bank'),
      api.get('/bank/summary'),
      api.get('/invoices'),
    ]).then(([t, s, i]) => {
      setTransactions(t.data);
      setSummary(s.data);
      setInvoices(i.data);
    });
  }, []);
  useEffect(load, [load]);

  // Every transition goes through here so the failure message from the API is
  // the one the accountant reads, rather than a silent no-op.
  async function act(id, verb, body) {
    setBusy(`${id}:${verb}`);
    setError('');
    setNote('');
    try {
      const res = await api.post(`/bank/${id}/${verb}`, body || {});
      if (verb === 'reconcile' && res.data.unallocated > 0.5) {
        setNote(`Reconciled — ${money(res.data.unallocated)} of this credit is more than the invoice owed and is left unallocated.`);
      } else if (verb === 'unmatch' && res.data.reversed > 0) {
        setNote(`Unmatched — ${money(res.data.reversed)} went back to outstanding.`);
      }
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    setError('');
    setNote('');
    try {
      const res = await api.post('/bank/import', { csv });
      setNote(`${res.data.imported} line(s) imported, ${res.data.duplicates} already on file.`);
      setCsv('');
      setShowImport(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed.');
    }
  }

  const rows = state === 'All' ? transactions : transactions.filter((t) => t.state === state);
  // Only invoices with something still owed can absorb a credit.
  const openInvoices = invoices.filter((i) => i.status !== 'Cancelled' && i.outstanding > 0.5);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Bank &amp; Reconciliation</h1>
          <div className="page-sub">Match every credit to an invoice, then reconcile it to record the receipt.</div>
        </div>
        <button className="btn btn-sm" onClick={() => setShowImport((v) => !v)}>
          {showImport ? 'Close import' : 'Import statement'}
        </button>
      </div>

      {summary && (
        <div className="statbar">
          <Stat n={summary.unmatched} l="Unmatched" />
          <Stat n={summary.matched} l="Matched, not reconciled" />
          <Stat n={summary.reconciled} l="Reconciled" />
          <Stat n={summary.ignored} l="Ignored" />
          <Stat n={money(summary.unmatchedValue)} l="Still to deal with" />
          <Stat n={money(summary.netMovement)} l="Net movement" />
        </div>
      )}

      {showImport && (
        <div className="card section">
          <h3>Import a bank statement</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>
            Paste the CSV exported from net banking. A header row naming a date and an amount
            (or separate debit and credit) column is all it needs. Lines already on file are skipped.
          </div>
          <textarea
            rows={6}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            placeholder={'Date,Narration,Ref,Debit,Credit,Balance\n19/09/2026,NEFT CR-ACME LTD,UTR55,,75000,1200000'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={!csv.trim()} onClick={runImport}>
            Import
          </button>
        </div>
      )}

      {error && <div className="card section error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {note && <div className="card section small-muted" style={{ marginBottom: 12 }}>{note}</div>}

      <div className="tabbar">
        {STATES.map((s) => (
          <button key={s} className={`tab-btn ${state === s ? 'active' : ''}`} onClick={() => setState(s)}>
            {s}
            {summary && s !== 'All' ? ` (${summary[s.toLowerCase()]})` : ''}
          </button>
        ))}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th>In / Out</th><th>Amount</th>
              <th>State</th><th>Matched to</th><th style={{ minWidth: 300 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  {t.description}
                  {t.reference && <div className="small-muted">Ref {t.reference}</div>}
                </td>
                <td>{t.type}</td>
                <td>{money(t.amount)}</td>
                <td><span className={`status ${STATE_CLASS[t.state] || ''}`}>{t.state}</span></td>
                <td>
                  {t.matchedInvoice ? (
                    <>
                      <div>{t.matchedInvoice.invoiceNumber || '—'}</div>
                      <div className="small-muted">{t.matchedInvoice.client}</div>
                      {t.matchedBy && <div className="small-muted">by {t.matchedBy} · {t.matchedDate}</div>}
                    </>
                  ) : t.suggestion ? (
                    <div className="small-muted">
                      Suggested: {t.suggestion.invoiceNumber} · {t.suggestion.client}
                      {t.suggestion.diff > 0 ? ` (${money(t.suggestion.diff)} out)` : ' (exact)'}
                    </div>
                  ) : t.state === 'Ignored' ? (
                    <span className="small-muted">{t.ignoredReason || 'Ignored'}</span>
                  ) : (
                    <span className="small-muted">—</span>
                  )}
                </td>
                <td>
                  <Actions
                    txn={t}
                    openInvoices={openInvoices}
                    picked={picked[t.id] || ''}
                    onPick={(v) => setPicked({ ...picked, [t.id]: v })}
                    act={act}
                    busy={busy}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="7" className="small-muted">Nothing in this state.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The buttons a line actually offers depend on where it sits in the state machine.
function Actions({ txn, openInvoices, picked, onPick, act, busy }) {
  const waiting = (verb) => busy === `${txn.id}:${verb}`;

  if (txn.state === 'Ignored') {
    return <button className="btn btn-sm" disabled={waiting('unignore')} onClick={() => act(txn.id, 'unignore')}>Restore</button>;
  }

  if (txn.state === 'Reconciled') {
    return (
      <>
        <span className="small-muted" style={{ marginRight: 8 }}>Closed off.</span>
        <button className="btn btn-sm" disabled={waiting('unmatch')} onClick={() => act(txn.id, 'unmatch')}>Undo</button>
      </>
    );
  }

  if (txn.state === 'Matched') {
    return (
      <div className="qa-row">
        <button className="btn btn-primary btn-sm" disabled={waiting('reconcile')} onClick={() => act(txn.id, 'reconcile')}>Reconcile</button>
        <button className="btn btn-sm" disabled={waiting('unmatch')} onClick={() => act(txn.id, 'unmatch')}>Unmatch</button>
        <button className="btn btn-sm" disabled={waiting('ignore')} onClick={() => act(txn.id, 'ignore')}>Ignore</button>
      </div>
    );
  }

  // Unmatched. Debits are never matched to an invoice — they can only be parked.
  if (txn.type !== 'Credit') {
    return <button className="btn btn-sm" disabled={waiting('ignore')} onClick={() => act(txn.id, 'ignore')}>Ignore</button>;
  }

  return (
    <div className="qa-row">
      {txn.suggestion && (
        <button className="btn btn-primary btn-sm" disabled={waiting('match')} onClick={() => act(txn.id, 'match')}>
          Match to {txn.suggestion.invoiceNumber}
        </button>
      )}
      <select value={picked} onChange={(e) => onPick(e.target.value)} style={{ maxWidth: 230 }}>
        <option value="">— match by hand —</option>
        {openInvoices.map((i) => (
          <option key={i.id} value={i.id}>
            {i.invoiceNumber || i.id.slice(-6)} · {i.client?.name} · {money(i.outstanding)} due
          </option>
        ))}
      </select>
      <button className="btn btn-sm" disabled={!picked || waiting('match')} onClick={() => act(txn.id, 'match', { invoiceId: picked })}>
        Match
      </button>
      <button className="btn btn-sm" disabled={waiting('ignore')} onClick={() => act(txn.id, 'ignore')}>Ignore</button>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
