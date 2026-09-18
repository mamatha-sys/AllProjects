import { Routes, Route } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

import Requirements from './pages/Requirements.jsx';
import RequirementDetail from './pages/RequirementDetail.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Candidates from './pages/Candidates.jsx';
import CandidateDetail from './pages/CandidateDetail.jsx';
import Team from './pages/ats/Team.jsx';
import InterviewCalendar from './pages/ats/InterviewCalendar.jsx';
import Search from './pages/ats/Search.jsx';

import Employees from './pages/Employees.jsx';
import EmployeeDetail from './pages/EmployeeDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import Leave from './pages/Leave.jsx';
import Payroll from './pages/Payroll.jsx';
import Performance from './pages/hrms/Performance.jsx';
import Lms from './pages/hrms/Lms.jsx';
import Projects from './pages/hrms/Projects.jsx';
import Surveys from './pages/hrms/Surveys.jsx';
import Documents from './pages/hrms/Documents.jsx';
import Announcements from './pages/hrms/Announcements.jsx';
import OrgStructure from './pages/hrms/OrgStructure.jsx';
import KT from './pages/hrms/KT.jsx';
import Targets from './pages/hrms/Targets.jsx';
import Resignation from './pages/hrms/Resignation.jsx';
import Recognition from './pages/hrms/Recognition.jsx';
import Disciplinary from './pages/hrms/Disciplinary.jsx';
import ShiftRoster from './pages/hrms/ShiftRoster.jsx';
import Timesheet from './pages/hrms/Timesheet.jsx';
import Assets from './pages/hrms/Assets.jsx';
import Expenses from './pages/hrms/Expenses.jsx';
import Helpdesk from './pages/hrms/Helpdesk.jsx';
import AccessManagement from './pages/hrms/AccessManagement.jsx';
import WeeklyIdeas from './pages/hrms/WeeklyIdeas.jsx';

import Invoices from './pages/Invoices.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Bank from './pages/Bank.jsx';
import Office from './pages/Office.jsx';

import AtsReports from './pages/reports/AtsReports.jsx';
import JobPortalReports from './pages/reports/JobPortalReports.jsx';
import AccountsReports from './pages/reports/AccountsReports.jsx';

import CompanySetup from './pages/admin/CompanySetup.jsx';
import Users from './pages/admin/Users.jsx';
import RoleCatalog from './pages/admin/RoleCatalog.jsx';
import Integrations from './pages/admin/Integrations.jsx';
import Notifications from './pages/admin/Notifications.jsx';
import AuditLogs from './pages/admin/AuditLogs.jsx';
import Profile from './pages/admin/Profile.jsx';

import Careers from './pages/Careers.jsx';
import JobDetail from './pages/JobDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Public Job Portal — no login required */}
      <Route path="/careers" element={<Careers />} />
      <Route path="/careers/:id" element={<JobDetail />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />

        {/* HRMS */}
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leave" element={<Leave />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="performance" element={<Performance />} />
        <Route path="lms" element={<Lms />} />
        <Route path="projects" element={<Projects />} />
        <Route path="surveys" element={<Surveys />} />
        <Route path="documents" element={<Documents />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="hrms/org-structure" element={<OrgStructure />} />
        <Route path="hrms/kt" element={<KT />} />
        <Route path="hrms/targets" element={<Targets />} />
        <Route path="hrms/resignation" element={<Resignation />} />
        <Route path="hrms/recognition" element={<Recognition />} />
        <Route path="hrms/disciplinary" element={<Disciplinary />} />
        <Route path="hrms/shift-roster" element={<ShiftRoster />} />
        <Route path="hrms/timesheet" element={<Timesheet />} />
        <Route path="hrms/assets" element={<Assets />} />
        <Route path="hrms/expenses" element={<Expenses />} />
        <Route path="hrms/helpdesk" element={<Helpdesk />} />
        <Route path="hrms/access-management" element={<AccessManagement />} />
        <Route path="hrms/weekly-ideas" element={<WeeklyIdeas />} />

        {/* ATS */}
        <Route path="requirements" element={<Requirements />} />
        <Route path="requirements/:id" element={<RequirementDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="candidates/:id" element={<CandidateDetail />} />
        <Route path="ats/team" element={<Team />} />
        <Route path="ats/calendar" element={<InterviewCalendar />} />
        <Route path="ats/search" element={<Search />} />

        {/* Accounts */}
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="bank" element={<Bank />} />
        <Route path="office" element={<Office />} />

        {/* Reports */}
        <Route path="reports/ats" element={<AtsReports />} />
        <Route path="reports/job-portal" element={<JobPortalReports />} />
        <Route path="reports/accounts" element={<AccountsReports />} />

        {/* Administration */}
        <Route path="admin/company" element={<CompanySetup />} />
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/roles" element={<RoleCatalog />} />
        <Route path="admin/integrations" element={<Integrations />} />
        <Route path="admin/notifications" element={<Notifications />} />
        <Route path="admin/audit" element={<AuditLogs />} />
        <Route path="admin/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
