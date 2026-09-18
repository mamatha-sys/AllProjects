import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Assets() {
  return (
    <SimpleRecordPage
      title="Assets"
      apiPath="/assets"
      titleLabel="Asset"
      detailLabel="Details"
      showDate
      dateLabel="Issued Date"
      statuses={['Issued', 'Returned', 'Lost']}
      decisions={['Returned', 'Lost']}
    />
  );
}
