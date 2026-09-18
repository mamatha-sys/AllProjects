export default function Integrations() {
  return (
    <div>
      <div className="page-head"><h1>Integrations</h1></div>
      <div className="card">
        <h3 style={{ fontSize: 13, marginBottom: 10 }}>Job Portal Connection</h3>
        <div className="kv"><span className="k">Status</span><span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#1e8449', marginRight: 6 }} />Connected</span></div>
        <div className="kv"><span className="k">Public site</span><span><a href="/careers" target="_blank" rel="noreferrer">/careers →</a></span></div>
        <div className="kv"><span className="k">Sync behavior</span><span>Applications submitted on the public Job Portal land directly in the ATS pipeline at the New stage.</span></div>
      </div>
    </div>
  );
}
