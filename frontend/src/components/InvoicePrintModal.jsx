import { useEffect, useState } from 'react';
import api from '../api';

const money2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// The printable tax invoice — company letterhead, itemised candidate rows,
// CGST/SGST (or IGST) split, amount in words, and the stamp/signature block.
// Every candidate who joined the same client in the same month and shares
// this invoice number is listed as one line item.
export default function InvoicePrintModal({ invoiceNumber, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/invoices/group/${encodeURIComponent(invoiceNumber)}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error || 'Could not load this invoice.'));
  }, [invoiceNumber]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border, #e2e2e2)' }}>
          <strong>Invoice {invoiceNumber}</strong>
          <div>
            <button className="btn btn-sm" onClick={() => window.print()} disabled={!data} style={{ marginRight: 8 }}>🖨 Print</button>
            <button className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {error && <div className="error-text">{error}</div>}
          {!error && !data && <div className="small-muted">Loading…</div>}
          {data && <PrintableInvoice data={data} />}
        </div>
      </div>
    </div>
  );
}

function PrintableInvoice({ data }) {
  const { company, client, rows, totals, gstSplit, amountInWords, netPayableInWords } = data;
  const hasBranding = company.logo || company.stamp || company.signature;

  return (
    <div id="printable-invoice" style={{ fontFamily: 'Georgia, serif', color: '#111', maxWidth: 780, margin: '0 auto', border: '1px solid #333' }}>
      {!hasBranding && (
        <div className="no-print small-muted" style={{ background: '#fff8e1', padding: 8, borderBottom: '1px solid #333' }}>
          No logo, stamp or signature saved yet — add them in Administration → Company Setup and every invoice will carry them.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: '2px solid #333' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {company.logo && <img src={company.logo} alt="" style={{ maxHeight: 54 }} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{company.legalName || company.name}</div>
            <div style={{ fontSize: 12, maxWidth: 320 }}>
              {[company.addressLine1, company.addressLine2, [company.city, company.state, company.pincode].filter(Boolean).join(', '), company.country].filter(Boolean).join(', ')}
            </div>
            {company.gstin && <div style={{ fontSize: 12 }}>GSTIN {company.gstin}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 20, fontWeight: 700 }}>TAX INVOICE</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          <tr>
            <Cell label="#" value={data.invoiceNumber} />
            <Cell label="Place of Supply" value={gstSplit.same ? `${client?.state || '—'} (intra-state)` : `${client?.state || '—'} (inter-state)`} />
          </tr>
          <tr>
            <Cell label="Invoice Date" value={fmtD(data.invoiceDate)} />
            <Cell label="Due Date" value={fmtD(data.dueDate)} />
          </tr>
          <tr>
            <Cell label="Terms" value={data.paymentTerms || '—'} />
            <Cell label="HSN/SAC" value={rows[0]?.hsnSac || '998512'} />
          </tr>
        </tbody>
      </table>

      <div style={{ padding: '10px 16px', borderTop: '1px solid #333', borderBottom: '1px solid #333', background: '#fafafa' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#666' }}>Bill To</div>
        <div style={{ fontWeight: 700 }}>{client?.name}</div>
        <div style={{ fontSize: 12 }}>{[client?.houseNumber, client?.street, client?.area, client?.state, client?.pincode].filter(Boolean).join(', ') || client?.location}</div>
        {client?.gst && <div style={{ fontSize: 12 }}>GSTIN {client.gst}</div>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#eee' }}>
            <Th>#</Th><Th>Item &amp; Description</Th><Th>HSN/SAC</Th><Th align="right">Amount</Th>
            {gstSplit.same ? (<><Th align="right">CGST 9%</Th><Th align="right">SGST 9%</Th></>) : (<Th align="right">IGST 18%</Th>)}
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const rowGstSplit = gstSplit.same
              ? { cgst: Math.round((r.gst / 2) * 100) / 100, sgst: Math.round((r.gst / 2) * 100) / 100 }
              : { igst: r.gst };
            return (
              <tr key={r.id}>
                <Td>{idx + 1}</Td>
                <Td>{r.name}{r.role ? <div className="small-muted" style={{ fontSize: 10 }}>{r.role}</div> : null}</Td>
                <Td>{r.hsnSac}</Td>
                <Td align="right">{money2(r.amount)}</Td>
                {gstSplit.same ? (
                  <><Td align="right">{money2(rowGstSplit.cgst)}</Td><Td align="right">{money2(rowGstSplit.sgst)}</Td></>
                ) : (<Td align="right">{money2(rowGstSplit.igst)}</Td>)}
                <Td align="right">{money2(r.amount + r.gst)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, borderTop: '2px solid #333' }}>
        <tbody>
          <tr><Td colSpan={gstSplit.same ? 5 : 4} align="right" strong>Sub Total</Td><Td align="right">{money2(totals.before)}</Td></tr>
          {gstSplit.same ? (
            <>
              <tr><Td colSpan={gstSplit.same ? 5 : 4} align="right">CGST (9%)</Td><Td align="right">{money2(gstSplit.cgst)}</Td></tr>
              <tr><Td colSpan={gstSplit.same ? 5 : 4} align="right">SGST (9%)</Td><Td align="right">{money2(gstSplit.sgst)}</Td></tr>
            </>
          ) : (
            <tr><Td colSpan={4} align="right">IGST (18%)</Td><Td align="right">{money2(gstSplit.igst)}</Td></tr>
          )}
          <tr style={{ borderTop: '1px solid #333' }}><Td colSpan={gstSplit.same ? 5 : 4} align="right" strong>Total</Td><Td align="right" strong>{money2(totals.after)}</Td></tr>
          {totals.tds > 0.5 && (
            <>
              <tr><Td colSpan={gstSplit.same ? 5 : 4} align="right">TDS deducted at source</Td><Td align="right">−{money2(totals.tds)}</Td></tr>
              <tr><Td colSpan={gstSplit.same ? 5 : 4} align="right" strong>Net Payable</Td><Td align="right" strong>{money2(totals.receivable)}</Td></tr>
            </>
          )}
        </tbody>
      </table>

      <div style={{ padding: '10px 16px', fontSize: 12 }}>
        <div><i>Total In Words:</i> <b>{amountInWords}</b></div>
        {totals.tds > 0.5 && <div style={{ marginTop: 4 }}><i>Net Payable After TDS In Words:</i> <b>{netPayableInWords}</b></div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderTop: '1px solid #333' }}>
        <div style={{ fontSize: 11 }}>
          {company.bankName && (
            <div>
              <div style={{ fontWeight: 700 }}>Bank details</div>
              <div>{company.bankName}{company.bankBranch ? ` · ${company.bankBranch}` : ''}</div>
              {company.bankAccName && <div>A/C name: {company.bankAccName}</div>}
              {company.bankAccNo && <div>A/C no: {company.bankAccNo}</div>}
              {company.bankIfsc && <div>IFSC: {company.bankIfsc}</div>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          {company.stamp && <img src={company.stamp} alt="" style={{ maxHeight: 70, display: 'block', margin: '0 auto' }} />}
          {company.signature && <img src={company.signature} alt="" style={{ maxHeight: 40, display: 'block', margin: '4px auto' }} />}
          <div style={{ borderTop: '1px solid #333', marginTop: 4, paddingTop: 2, fontSize: 11 }}>
            {company.signatoryName || 'Authorised Signatory'}{company.signatoryTitle ? ` · ${company.signatoryTitle}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <>
      <td style={{ padding: '4px 16px', color: '#666', width: '25%' }}>{label}</td>
      <td style={{ padding: '4px 16px', fontWeight: 600 }}>{value}</td>
    </>
  );
}
function Th({ children, align }) {
  return <th style={{ padding: '6px 8px', textAlign: align || 'left', border: '1px solid #ccc' }}>{children}</th>;
}
function Td({ children, align, strong, colSpan }) {
  return <td colSpan={colSpan} style={{ padding: '5px 8px', textAlign: align || 'left', border: '1px solid #ccc', fontWeight: strong ? 700 : 400 }}>{children}</td>;
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3vh 16px', overflowY: 'auto',
};
const panelStyle = {
  background: '#fff', borderRadius: 8, width: '100%', maxWidth: 860, maxHeight: '94vh',
  display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
};
