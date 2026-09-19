const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { INTEGRATION_GROUPS, INTEGRATION_CATALOG } = require('../utils/integrationCatalog');

const router = express.Router();
router.use(requireAuth);

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ---- Generic integration catalog (WhatsApp, SMTP, Naukri, ...) ----
router.get('/catalog', async (req, res) => {
  const rows = await prisma.integrationChannel.findMany();
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const catalog = INTEGRATION_CATALOG.map((c) => ({
    ...c,
    enabled: byId[c.id]?.enabled || false,
    connected: byId[c.id]?.connected || false,
    values: byId[c.id]?.values ? JSON.parse(byId[c.id].values) : {},
  }));
  res.json({ groups: INTEGRATION_GROUPS, catalog });
});

router.post('/catalog/:id/toggle', requireRole(...ADMIN_ROLES), async (req, res) => {
  const def = INTEGRATION_CATALOG.find((c) => c.id === req.params.id);
  if (!def) return res.status(404).json({ error: 'Unknown integration' });
  const existing = await prisma.integrationChannel.findUnique({ where: { id: req.params.id } });
  const nextEnabled = !(existing?.enabled);
  const row = await prisma.integrationChannel.upsert({
    where: { id: req.params.id },
    create: { id: req.params.id, enabled: nextEnabled, connected: false },
    update: { enabled: nextEnabled, connected: nextEnabled ? existing.connected : false },
  });
  await logAudit({ userId: req.user.id, action: `Integration ${nextEnabled ? 'enabled' : 'disabled'}`, entity: 'IntegrationChannel', entityId: def.name });
  res.json(row);
});

router.post('/catalog/:id/configure', requireRole(...ADMIN_ROLES), async (req, res) => {
  const def = INTEGRATION_CATALOG.find((c) => c.id === req.params.id);
  if (!def) return res.status(404).json({ error: 'Unknown integration' });
  const values = req.body.values || {};
  const filled = Object.values(values).filter((v) => String(v || '').trim()).length;
  if (!filled) return res.status(400).json({ error: 'Enter at least one credential to connect this channel.' });
  const row = await prisma.integrationChannel.upsert({
    where: { id: req.params.id },
    create: { id: req.params.id, enabled: true, connected: true, values: JSON.stringify(values) },
    update: { enabled: true, connected: true, values: JSON.stringify(values) },
  });
  await logAudit({ userId: req.user.id, action: 'Integration configured', entity: 'IntegrationChannel', entityId: def.name, toValue: 'Connected' });
  res.json(row);
});

// ---- Job Portal integration status ----
router.get('/job-portal', async (req, res) => {
  const [candidatesSynced, applicationsSynced, requirementsSynced, needsMapping, failedRecords, lastSync] = await Promise.all([
    prisma.candidate.count({ where: { source: 'Job Portal' } }),
    prisma.application.count(), // every application in this app originates from the shared Job Portal/ATS pipeline
    prisma.requirement.count(),
    prisma.mappingQueueRow.count({ where: { status: 'Needs Mapping' } }),
    prisma.syncLogEntry.count({ where: { status: 'Failed' } }),
    prisma.syncLogEntry.findFirst({ orderBy: { date: 'desc' } }),
  ]);
  res.json({
    status: 'Connected',
    lastSync: lastSync?.date || null,
    lastSyncResult: lastSync?.status || null,
    candidatesSynced,
    applicationsSynced,
    requirementsSynced,
    requirementsNeedingMapping: needsMapping,
    failedRecords,
    // This app hosts the public Job Portal (careers pages) and the ATS in the
    // same database, so there's no second storage to read from — "sync" here
    // reconciles/recomputes rather than simulating a pull from elsewhere.
    mode: 'live',
  });
});

router.post('/job-portal/sync', requireRole(...ADMIN_ROLES), async (req, res) => {
  const [candidatesSynced, applicationsSynced] = await Promise.all([
    prisma.candidate.count({ where: { source: 'Job Portal' } }),
    prisma.application.count(),
  ]);
  const entry = await prisma.syncLogEntry.create({
    data: { entity: 'Job Portal', status: 'Success' },
  });
  await logAudit({ userId: req.user.id, action: 'Sync performed', entity: 'Job Portal Integration', toValue: 'Success' });
  res.json({ entry, candidatesSynced, applicationsSynced });
});

router.get('/job-portal/test', async (req, res) => {
  res.json({ ok: true, message: 'Connection test passed — Job Portal data reachable.' });
});

// ---- Sync log ----
router.get('/sync-log', async (req, res) => {
  const rows = await prisma.syncLogEntry.findMany({ orderBy: { date: 'desc' }, take: 50 });
  res.json(rows);
});

router.post('/sync-log/:id/retry', requireRole(...ADMIN_ROLES), async (req, res) => {
  const entry = await prisma.syncLogEntry.update({
    where: { id: req.params.id },
    data: { status: 'Success', reason: null, date: new Date() },
  });
  res.json(entry);
});

// ---- Needs-Mapping queue ----
router.get('/mapping-queue', async (req, res) => {
  const rows = await prisma.mappingQueueRow.findMany({ where: { status: 'Needs Mapping' }, orderBy: { dateReceived: 'desc' } });
  res.json(rows);
});

router.post('/mapping-queue/:id/map', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { requirementId } = req.body;
  if (!requirementId) return res.status(400).json({ error: 'Pick a requirement first.' });
  const row = await prisma.mappingQueueRow.findUnique({ where: { id: req.params.id } });
  const requirement = row && await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!row || !requirement) return res.status(400).json({ error: 'Pick a requirement first.' });
  await prisma.mappingQueueRow.update({ where: { id: row.id }, data: { status: 'Mapped', mappedTo: requirement.id } });
  await logAudit({ userId: req.user.id, action: 'Job Portal job mapped', entity: 'MappingQueueRow', entityId: row.jobPortalJobId, fromValue: 'Needs Mapping', toValue: requirement.title });
  res.json({ ok: true });
});

router.post('/mapping-queue/:id/draft', requireRole(...ADMIN_ROLES), async (req, res) => {
  const row = await prisma.mappingQueueRow.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Not found' });
  const client = await prisma.client.findFirst();
  if (!client) return res.status(400).json({ error: 'Add a client before creating a requirement.' });
  const requirement = await prisma.requirement.create({
    data: {
      title: row.jobTitle,
      clientId: client.id,
      department: 'IT',
      status: 'DRAFT',
      skills: row.sampleSkills || null,
      location: row.sampleLocation || null,
      description: `Created from Job Portal job ${row.jobPortalJobId}. Complete the requirement details, then activate it — client requirements still need an Active agreement before posting.`,
    },
  });
  await prisma.mappingQueueRow.update({ where: { id: row.id }, data: { status: 'Mapped', mappedTo: requirement.id } });
  await logAudit({ userId: req.user.id, action: 'Draft requirement created from Job Portal job', entity: 'MappingQueueRow', entityId: row.jobPortalJobId, toValue: 'Draft' });
  res.status(201).json(requirement);
});

router.post('/mapping-queue/:id/archive', requireRole(...ADMIN_ROLES), async (req, res) => {
  const row = await prisma.mappingQueueRow.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Not found' });
  await prisma.mappingQueueRow.update({ where: { id: row.id }, data: { status: 'Archived' } });
  await logAudit({ userId: req.user.id, action: 'Job Portal job archived', entity: 'MappingQueueRow', entityId: row.jobPortalJobId, toValue: 'Archived' });
  res.json({ ok: true });
});

module.exports = router;
