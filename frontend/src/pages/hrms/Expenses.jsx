import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Expenses() {
  return (
    <SimpleRecordPage
      title="Expense Claims"
      apiPath="/expenses"
      titleLabel="Claim"
      detailLabel="Notes"
      showDate
      dateLabel="Date"
      showAmount
      statuses={['Pending', 'Approved', 'Rejected']}
      decisions={['Approved', 'Rejected']}
    />
  );
}
