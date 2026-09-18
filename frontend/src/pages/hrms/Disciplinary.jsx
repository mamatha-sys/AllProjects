import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Disciplinary() {
  return (
    <SimpleRecordPage
      title="Disciplinary"
      apiPath="/disciplinary"
      titleLabel="Issue"
      detailLabel="Notes"
      showDate
      dateLabel="Date"
      statuses={['Open', 'Under Review', 'Closed']}
      decisions={['Under Review', 'Closed']}
    />
  );
}
