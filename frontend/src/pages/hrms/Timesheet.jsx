import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Timesheet() {
  return (
    <SimpleRecordPage
      title="Timesheet"
      apiPath="/timesheet"
      titleLabel="Task"
      detailLabel="Notes"
      showDate
      dateLabel="Date"
      showHours
      statuses={['Logged']}
      decisions={null}
    />
  );
}
