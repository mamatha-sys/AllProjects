import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function AccessManagement() {
  return (
    <SimpleRecordPage
      title="Access Management"
      apiPath="/access-requests"
      titleLabel="System / Resource"
      detailLabel="Reason"
      statuses={['Pending', 'Granted', 'Denied']}
      decisions={['Granted', 'Denied']}
    />
  );
}
