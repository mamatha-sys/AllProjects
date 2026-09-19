const crypto = require('crypto');
const prisma = require('../db');

// Builds the service-agreement text for a client. Mirrors the reference
// prototype's generateAgreementDocument() — same clause structure, rendered as
// plain text so it can be stored in SQLite and shown in the client portal.
function buildAgreementDocument(client) {
  const fee = client.agreementFeePercent != null ? client.agreementFeePercent : 8.33;
  const sections = [
    [
      'PARTIES',
      `This Recruitment / Staffing Services Agreement ("Agreement") is entered into between ${client.name}` +
        `${client.location ? `, ${client.location}` : ''} ("Client") and TeamLink Consultants (OPC) Pvt. Ltd., ` +
        'having its principal place of business at Hyderabad, Telangana, India ("Consultant").',
    ],
    [
      '1. DEFINITIONS',
      '1.1 "Candidate" means any individual identified, screened or referred by Consultant to Client.\n' +
        '1.2 "Placed Candidate" means a Candidate who accepts an offer from Client and commences work.\n' +
        '1.3 "Placement Fee" means the fee payable by Client under Clause 5.',
    ],
    [
      '2. TERM AND TERMINATION',
      '2.1 This Agreement commences on the Effective Date and continues for twelve (12) months, renewing\n' +
        'automatically unless either Party gives thirty (30) days written notice of non-renewal.\n' +
        '2.2 Either Party may terminate for convenience on thirty (30) days notice, or immediately for uncured breach.',
    ],
    [
      '3. SCOPE OF SERVICES',
      '3.1 Consultant shall identify, screen and refer Candidates suitable for roles specified by Client.\n' +
        '3.2 Client retains sole discretion to interview, evaluate, select, reject or make an offer to any Candidate.',
    ],
    [
      '4. CLIENT OBLIGATIONS',
      '4.1 Client shall provide accurate job profiles including role requirements and compensation range.\n' +
        '4.2 Client is responsible for verifying each Candidate’s credentials and for all joining formalities.\n' +
        '4.3 Client shall notify Consultant within five (5) business days of an offer, joining or withdrawal.',
    ],
    [
      '5. FEES AND PAYMENT TERMS',
      `5.1 Client shall pay Consultant a Placement Fee of ${fee}% of the Placed Candidate’s annual CTC, plus\n` +
        'applicable taxes, for each Candidate referred by Consultant who is selected and joins Client.\n' +
        '5.2 Consultant raises an invoice six (6) business days after the date of joining; payment due within 30 days.',
    ],
    [
      '6. REPLACEMENT GUARANTEE',
      '6.1 Consultant provides a thirty (30) day guarantee period, offering one free replacement Candidate of\n' +
        'comparable calibre if the Placed Candidate leaves of their own will within that period.\n' +
        '6.2 The guarantee does not apply to termination by Client, redundancy or mutual separation.',
    ],
    [
      '7. NON-CIRCUMVENTION',
      '7.1 If Client engages a Candidate first referred by Consultant within twelve (12) months of referral —\n' +
        'directly, through another vendor or its own team — the Placement Fee remains payable.',
    ],
    [
      '8. CONFIDENTIALITY & DATA PROTECTION',
      '8.1 Each Party shall keep the other’s confidential information confidential.\n' +
        '8.2 Candidate personal data shall be used only for recruitment purposes, in compliance with the\n' +
        'Digital Personal Data Protection Act, 2023.',
    ],
    [
      '9. GOVERNING LAW',
      '9.1 This Agreement is governed by the laws of India. Disputes are referred to arbitration under the\n' +
        'Arbitration and Conciliation Act, 1996, seated in Hyderabad, Telangana.',
    ],
  ];

  return [
    'TEAMLINK CONSULTANTS',
    'RECRUITMENT / STAFFING SERVICES AGREEMENT',
    `Client: ${client.name}${client.industry ? ` (${client.industry})` : ''}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    ...sections.map(([heading, body]) => `${heading}\n${body}\n`),
  ].join('\n');
}

// Human-readable agreement reference (AGR0001, AGR0002 ...), assigned the first
// time an agreement is sent — the prototype's agreementIdFor().
async function nextAgreementId() {
  const used = await prisma.client.count({ where: { agreementId: { not: null } } });
  return `AGR${String(used + 1).padStart(4, '0')}`;
}

// Opaque token that goes into the client-facing signing link
// (/agreement/<token>), so the client can e-sign without a TeamLink login.
function newEsignToken() {
  return `ESN-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
}

module.exports = { buildAgreementDocument, nextAgreementId, newEsignToken };
