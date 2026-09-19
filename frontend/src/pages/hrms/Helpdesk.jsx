import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Helpdesk() {
  return (
    <SimpleRecordPage
      title="Helpdesk"
      apiPath="/helpdesk"
      titleLabel="Subject"
      detailLabel="Description"
      showCategory
      categoryLabel="Category"
      categoryOptions={['IT', 'HR', 'Admin', 'Grievance', 'Facilities', 'Payroll']}
      showPriority
      statuses={['Open', 'In Progress', 'Resolved']}
      decisions={['In Progress', 'Resolved']}
    />
  );
}
