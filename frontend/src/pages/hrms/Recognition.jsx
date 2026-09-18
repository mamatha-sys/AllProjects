import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Recognition() {
  return (
    <SimpleRecordPage
      title="Recognition"
      apiPath="/recognition"
      titleLabel="Award"
      detailLabel="Message"
      showDate
      dateLabel="Date"
      statuses={['Awarded']}
      decisions={null}
    />
  );
}
