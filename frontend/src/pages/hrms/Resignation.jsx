import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Resignation() {
  return (
    <SimpleRecordPage
      title="Resignation Management"
      apiPath="/resignations"
      titleLabel="Reason"
      detailLabel="Notes"
      showDate
      dateLabel="Last Working Date"
      statuses={['Submitted', 'Accepted', 'Withdrawn']}
      decisions={['Accepted', 'Withdrawn']}
    />
  );
}
