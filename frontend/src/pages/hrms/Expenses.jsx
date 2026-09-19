import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Expenses() {
  return (
    <SimpleRecordPage
      title="Expense & Travel Claims"
      apiPath="/expenses"
      titleLabel="Description"
      detailLabel="Notes"
      showCategory
      categoryLabel="Category"
      categoryOptions={['Food', 'Travel', 'Accommodation', 'Other']}
      showLocation
      showDate
      dateLabel="Date"
      showAmount
      amountLabel="Amount (₹)"
      statuses={['Pending', 'Approved', 'Reimbursed', 'Rejected']}
      decisions={['Approved', 'Reimbursed', 'Rejected']}
    />
  );
}
