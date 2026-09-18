import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function ShiftRoster() {
  return (
    <SimpleRecordPage
      title="Shift Roster"
      apiPath="/shift-roster"
      titleLabel="Shift"
      detailLabel="Notes"
      showDate
      dateLabel="Date"
      statuses={['Scheduled', 'Completed']}
      decisions={['Completed']}
    />
  );
}
