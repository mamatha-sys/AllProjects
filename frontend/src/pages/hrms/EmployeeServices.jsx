import TabsPage from '../../components/TabsPage.jsx';
import Helpdesk from './Helpdesk.jsx';
import Assets from './Assets.jsx';
import Announcements from './Announcements.jsx';
import Surveys from './Surveys.jsx';
import Resignation from './Resignation.jsx';
import Documents from './Documents.jsx';
import ShiftRoster from './ShiftRoster.jsx';
import Timesheet from './Timesheet.jsx';
import Expenses from './Expenses.jsx';
import AccessManagement from './AccessManagement.jsx';
import WeeklyIdeas from './WeeklyIdeas.jsx';

export default function EmployeeServices() {
  return (
    <TabsPage
      title="Employee Services"
      subtitle="Help desk, assets, announcements, surveys and resignation — plus the rest of self-service"
      tabs={[
        { key: 'helpdesk', label: 'Help Desk', element: <Helpdesk /> },
        { key: 'assets', label: 'Assets', element: <Assets /> },
        { key: 'announcements', label: 'Announcements', element: <Announcements /> },
        { key: 'surveys', label: 'Engagement Survey', element: <Surveys /> },
        { key: 'resignation', label: 'Resignation', element: <Resignation /> },
        { key: 'documents', label: 'Documents', element: <Documents /> },
        { key: 'shift', label: 'Shift Roster', element: <ShiftRoster /> },
        { key: 'timesheet', label: 'Timesheet', element: <Timesheet /> },
        { key: 'expenses', label: 'Expense Claims', element: <Expenses /> },
        { key: 'access', label: 'Access Management', element: <AccessManagement /> },
        { key: 'ideas', label: 'Weekly Ideas', element: <WeeklyIdeas /> },
      ]}
    />
  );
}
