// Generic integration catalog shown on Administration > Integrations, grouped
// by INTEGRATION_GROUPS. Configuration-only — nothing here calls a real
// provider; "Save & Connect" just records that credentials were entered.
const INTEGRATION_GROUPS = ['Messaging', 'Email', 'Calling', 'Scheduling', 'Job Boards', 'Storage', 'Finance', 'Workforce', 'Developer'];

const INTEGRATION_CATALOG = [
  { id: 'whatsapp', name: 'WhatsApp Business', group: 'Messaging', desc: 'Send candidate updates, interview reminders and client approvals over WhatsApp.', fields: [{ label: 'Business phone number', default: '+91 ' }, { label: 'WhatsApp Business ID' }, { label: 'Permanent access token' }, { label: 'Template namespace' }] },
  { id: 'sms', name: 'SMS Gateway', group: 'Messaging', desc: 'Transactional SMS for OTPs, interview alerts and offer notifications.', fields: [{ label: 'Provider' }, { label: 'Sender ID (6 chars)' }, { label: 'API key' }, { label: 'DLT template ID' }] },
  { id: 'email', name: 'Email (SMTP)', group: 'Email', desc: 'Outbound email for offer letters, invoices, payslips and system notifications.', fields: [{ label: 'SMTP host' }, { label: 'Port', default: '587' }, { label: 'From address' }, { label: 'Username' }, { label: 'Password / app key' }] },
  { id: 'email-inbox', name: 'Shared Inbox (IMAP)', group: 'Email', desc: 'Pull candidate replies and client mail into the requirement timeline.', fields: [{ label: 'IMAP host' }, { label: 'Port', default: '993' }, { label: 'Mailbox address' }, { label: 'Password / app key' }] },
  { id: 'telephony', name: 'Cloud Telephony / IVR', group: 'Calling', desc: 'Click-to-call from a candidate profile, IVR routing and call recording.', fields: [{ label: 'Provider' }, { label: 'Account SID' }, { label: 'Auth token' }, { label: 'Caller ID number' }, { label: 'Recording storage URL' }] },
  { id: 'click-to-call', name: 'Click-to-Call Widget', group: 'Calling', desc: 'Dial a candidate or client contact straight from any list or profile page.', fields: [{ label: 'Agent extension prefix' }, { label: 'Default country code', default: '+91' }] },
  { id: 'video', name: 'Video Interviews', group: 'Calling', desc: 'Auto-create meeting links when an interview is scheduled.', fields: [{ label: 'Provider (Meet / Zoom / Teams)' }, { label: 'Client ID' }, { label: 'Client secret' }] },
  { id: 'calendar', name: 'Calendar Sync', group: 'Scheduling', desc: 'Two-way sync of interview slots with Google or Outlook calendars.', fields: [{ label: 'Provider (Google / Outlook)' }, { label: 'Client ID' }, { label: 'Client secret' }, { label: 'Default calendar' }] },
  { id: 'naukri', name: 'Naukri', group: 'Job Boards', desc: 'Post requirements and pull applicant responses into the candidate database.', fields: [{ label: 'Recruiter account email' }, { label: 'API key' }] },
  { id: 'linkedin', name: 'LinkedIn Recruiter', group: 'Job Boards', desc: 'Publish jobs and import candidate profiles.', fields: [{ label: 'Organization ID' }, { label: 'Client ID' }, { label: 'Client secret' }] },
  { id: 'storage', name: 'Document Storage', group: 'Storage', desc: 'Where resumes, offer letters and employee documents are stored.', fields: [{ label: 'Provider (S3 / Drive)' }, { label: 'Bucket / folder' }, { label: 'Access key' }, { label: 'Secret key' }] },
  { id: 'esign', name: 'e-Signature', group: 'Storage', desc: 'Send offer letters and client agreements for signature.', fields: [{ label: 'Provider' }, { label: 'API key' }] },
  { id: 'tally', name: 'Tally / Accounting', group: 'Finance', desc: 'Push invoices and payments into the accounting ledger.', fields: [{ label: 'Company name in Tally' }, { label: 'Connector URL' }, { label: 'Sync frequency', default: 'Daily' }] },
  { id: 'payments', name: 'Payment Gateway', group: 'Finance', desc: 'Collect client invoice payments online and auto-reconcile receipts.', fields: [{ label: 'Provider' }, { label: 'Key ID' }, { label: 'Key secret' }, { label: 'Webhook secret' }] },
  { id: 'biometric', name: 'Biometric / Attendance Device', group: 'Workforce', desc: 'Import daily punch data from attendance devices into HRMS.', fields: [{ label: 'Device vendor' }, { label: 'Device / site ID' }, { label: 'Sync endpoint' }] },
  { id: 'webhooks', name: 'Webhooks', group: 'Developer', desc: 'Notify your own systems when a candidate joins, an invoice is paid, and similar events.', fields: [{ label: 'Endpoint URL' }, { label: 'Signing secret' }, { label: 'Events (comma separated)', default: 'candidate.joined, invoice.paid' }] },
  { id: 'api', name: 'REST API Access', group: 'Developer', desc: 'Issue API keys for external systems to read and write platform data.', fields: [{ label: 'Key label' }, { label: 'Allowed IP range' }, { label: 'Scope (read / write)', default: 'read' }] },
];

module.exports = { INTEGRATION_GROUPS, INTEGRATION_CATALOG };
