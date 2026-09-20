import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { readFilesAsCsvText } from '../utils/fileImport.js';

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
  const [dupes, setDupes] = useState(null);
  const [autoPost, setAutoPost] = useState(true);
  const [filesBusy, setFilesBusy] = useState(false);

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
    api.get('/bank/duplicates').then((res) => setDupes(res.data)).catch(() => setDupes(null));
  }, []);
  useEffect(load, [load]);

  async function dropDupes(ids) {
    setError('');
    try {
      await api.post('/bank/duplicates/drop', { ids });
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not remove those duplicates.');
    }
  }

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
      const res = await api.post('/bank/import', { csv, autoPost });
      setNote(importSummary(res.data));
      setCsv('');
      setShowImport(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed.');
    }
  }

  function importSummary(data) {
    return `${data.imported} line(s) imported, ${data.duplicates} already on file`
      + (data.autoPosted ? `, ${data.autoPosted} auto-reconciled against a matching invoice` : '') + '.';
  }

  // Real uploaded files (.csv or .xlsx/.xls, one or many at once) — each is
  // read client-side and sent through the same /bank/import endpoint the
  // pasted-CSV box uses, so a statement from the bank's own export works
  // exactly like typing it in by hand.
  async function runFileImport(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    setError('');
    setNote('');
    setFilesBusy(true);
    try {
      const parsed = await readFilesAsCsvText(files);
      let imported = 0; let duplicates = 0; let posted = 0; let failed = 0;
      for (const f of parsed) {
        try {
          const res = await api.post('/bank/import', { csv: f.csv, autoPost });
          imported += res.data.imported;
          duplicates += res.data.duplicates;
          posted += res.data.autoPosted || 0;
        } catch (e) {
          failed += 1;
        }
      }
      setNote(importSummary({ imported, duplicates, autoPosted: posted }) + (failed ? ` ${failed} file(s) could not be read.` : ''));
      setShowImport(false);
      load();
    } catch (e) {
      setError('Could not read one of those files.');
    } finally {
      setFilesBusy(false);
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
            Upload the statement file(s) exported from net banking (.csv, .xlsx or .xls — pick several at
            once to import them all in one go), or paste the CSV text below instead. A header row naming
            a date and an amount (or separate debit and credit) column is all it needs. Lines already on
            file are skipped.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontWeight: 600, fontSize: 13 }}>
            <input type="checkbox" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)} />
            Auto-reconcile credits that match an invoice's outstanding amount exactly
          </label>
          <div className="small-muted" style={{ marginTop: -6, marginBottom: 10 }}>
            Anything not an exact, unambiguous match is left as a "Suggested" line for you to confirm — this never guesses on a close-but-not-exact amount.
          </div>
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            multiple
            disabled={filesBusy}
            onChange={(e) => { if (e.target.files.length) runFileImport(e.target.files); e.target.value = ''; }}
          />
          {filesBusy && <div className="small-muted" style={{ marginTop: 6 }}>Reading file(s)…</div>}
          <div className="small-muted" style={{ margin: '12px 0 6px' }}>— or paste CSV text —</div>
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

      {dupes && dupes.groups.length > 0 && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <h3>The same line imported more than once · {dupes.groups.length}</h3>
          <div className="page-sub">{dupes.extraCount} extra copy(ies) · {money(dupes.extraAmount)} of double counting</div>
          {dupes.groups.map((g, gi) => (
            <div key={gi} className="tbl-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Reference</th><th>Keep or remove</th></tr></thead>
                <tbody>
                  {g.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td><td>{t.description}</td><td>{money(t.amount)}</td><td>{t.reference || '—'}</td>
                      <td><span className={`status ${t.isKeep ? 'priority-low' : 'priority-high'}`}>{t.isKeep ? 'keep' : 'extra'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => dropDupes(g.filter((t) => !t.isKeep).map((t) => t.id))}>
                Remove the {g.length - 1} extra cop{g.length - 1 === 1 ? 'y' : 'ies'}
              </button>
            </div>
          ))}
        </div>
      )}

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
