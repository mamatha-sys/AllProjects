import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Helpdesk() {
  return (
    <SimpleRecordPage
      title="Employee Services / Helpdesk"
      apiPath="/helpdesk"
      titleLabel="Subject"
      detailLabel="Description"
      statuses={['Open', 'In Progress', 'Resolved']}
      decisions={['In Progress', 'Resolved']}
    />
  );
}
