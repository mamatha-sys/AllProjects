import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function KT() {
  return <SimpleRecordPage title="Knowledge Transfer" apiPath="/kt" titleLabel="Topic" detailLabel="Notes" statuses={['Open', 'In Progress', 'Completed']} decisions={['Completed']} />;
}
