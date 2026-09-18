require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const requirementRoutes = require('./routes/requirements');
const candidateRoutes = require('./routes/candidates');
const applicationRoutes = require('./routes/applications');
const dashboardRoutes = require('./routes/dashboard');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const payrollRoutes = require('./routes/payroll');
const invoiceRoutes = require('./routes/invoices');
const bankRoutes = require('./routes/bank');
const publicRoutes = require('./routes/public');
const performanceRoutes = require('./routes/performance');
const lmsRoutes = require('./routes/lms');
const projectRoutes = require('./routes/projects');
const surveyRoutes = require('./routes/surveys');
const documentRoutes = require('./routes/documents');
const announcementRoutes = require('./routes/announcements');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const officeRoutes = require('./routes/office');
const atsExtrasRoutes = require('./routes/atsExtras');
const employeeRecordRouter = require('./routes/employeeRecords');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/office-expenses', officeRoutes);
app.use('/api/ats', atsExtrasRoutes);

// EmployeeRecord-backed HRMS long-tail areas — one generic model, one route per type.
app.use('/api/kt', employeeRecordRouter('KT'));
app.use('/api/targets', employeeRecordRouter('TARGET'));
app.use('/api/resignations', employeeRecordRouter('RESIGNATION'));
app.use('/api/recognition', employeeRecordRouter('RECOGNITION'));
app.use('/api/disciplinary', employeeRecordRouter('DISCIPLINARY'));
app.use('/api/shift-roster', employeeRecordRouter('SHIFT'));
app.use('/api/timesheet', employeeRecordRouter('TIMESHEET'));
app.use('/api/assets', employeeRecordRouter('ASSET'));
app.use('/api/expenses', employeeRecordRouter('EXPENSE'));
app.use('/api/helpdesk', employeeRecordRouter('HELPDESK'));
app.use('/api/access-requests', employeeRecordRouter('ACCESS_REQUEST'));
app.use('/api/weekly-ideas', employeeRecordRouter('WEEKLY_IDEA'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`TeamLink API listening on http://localhost:${PORT}`));
