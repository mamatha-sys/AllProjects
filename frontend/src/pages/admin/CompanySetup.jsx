import { useEffect, useState } from 'react';
import api from '../../api';

const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB — keeps the invoice payload small

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CompanySetup() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [saved, setSaved] = useState(false);
  const [imgError, setImgError] = useState('');

  useEffect(() => {
    api.get('/admin/company').then((res) => setForm(res.data));
  }, []);

  async function save(e) {
    e.preventDefault();
    await api.put('/admin/company', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function onImage(field, e) {
    setImgError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setImgError('That image is over 1 MB — pick a smaller one.');
      e.target.value = '';
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    setForm((f) => ({ ...f, [field]: dataUrl }));
  }

  return (
    <div>
      <div className="page-head"><h1>Company Setup</h1></div>
      <form className="card section" onSubmit={save} style={{ maxWidth: 640 }}>
        <h3 style={{ marginTop: 0 }}>Basic</h3>
        <div className="grid-2">
          <label className="field"><span>Company Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span>Contact Email</span><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span>Contact Phone</span><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field"><span>Address</span><input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        </div>

        {/* --- Additive: invoice letterhead / GST / bank / signature block --- */}
        <h3>Invoice letterhead</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>This is what prints on every invoice raised from Invoices — legal name, GSTIN and address on the header, bank details and the signature block on the footer.</div>
        <div className="grid-2">
          <label className="field"><span>Legal name</span><input value={form.legalName || ''} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="TEAMLINK CONSULTANTS (OPC) PVT LTD" /></label>
          <label className="field"><span>GSTIN</span><input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="36AAICT5941J1ZX" /></label>
          <label className="field"><span>PAN</span><input value={form.pan || ''} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></label>
          <label className="field"><span>Country</span><input value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="India" /></label>
          <label className="field full"><span>Address line 1</span><input value={form.addressLine1 || ''} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></label>
          <label className="field full"><span>Address line 2</span><input value={form.addressLine2 || ''} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></label>
          <label className="field"><span>City</span><input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label className="field"><span>State</span><input value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Telangana" /></label>
          <label className="field"><span>Pincode</span><input value={form.pincode || ''} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></label>
        </div>

        <h3>Bank details</h3>
        <div className="grid-2">
          <label className="field"><span>Bank name</span><input value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></label>
          <label className="field"><span>Account name</span><input value={form.bankAccName || ''} onChange={(e) => setForm({ ...form, bankAccName: e.target.value })} /></label>
          <label className="field"><span>Account number</span><input value={form.bankAccNo || ''} onChange={(e) => setForm({ ...form, bankAccNo: e.target.value })} /></label>
          <label className="field"><span>IFSC</span><input value={form.bankIfsc || ''} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} /></label>
          <label className="field"><span>Branch</span><input value={form.bankBranch || ''} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} /></label>
        </div>

        <h3>Logo, stamp &amp; signature</h3>
        {imgError && <div className="error-text" style={{ marginBottom: 8 }}>{imgError}</div>}
        <div className="grid-2">
          <label className="field">
            <span>Company logo</span>
            <input type="file" accept="image/*" onChange={(e) => onImage('logo', e)} />
            {form.logo && <img src={form.logo} alt="Logo preview" style={{ marginTop: 6, maxHeight: 48 }} />}
          </label>
          <label className="field">
            <span>Company stamp</span>
            <input type="file" accept="image/*" onChange={(e) => onImage('stamp', e)} />
            {form.stamp && <img src={form.stamp} alt="Stamp preview" style={{ marginTop: 6, maxHeight: 64 }} />}
          </label>
          <label className="field">
            <span>Signature</span>
            <input type="file" accept="image/*" onChange={(e) => onImage('signature', e)} />
            {form.signature && <img src={form.signature} alt="Signature preview" style={{ marginTop: 6, maxHeight: 48 }} />}
          </label>
          <label className="field"><span>Signatory name</span><input value={form.signatoryName || ''} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} /></label>
          <label className="field"><span>Signatory title</span><input value={form.signatoryTitle || ''} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} placeholder="Director" /></label>
        </div>

        <button className="btn btn-primary btn-sm" type="submit">Save</button>
        {saved && <span className="small-muted" style={{ marginLeft: 10 }}>Saved.</span>}
      </form>
    </div>
  );
}
