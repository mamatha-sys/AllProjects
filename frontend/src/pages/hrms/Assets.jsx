import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Assets() {
  return (
    <SimpleRecordPage
      title="Assets"
      apiPath="/assets"
      titleLabel="Asset"
      detailLabel="Serial / Details"
      showCategory
      categoryLabel="Asset Type"
      categoryOptions={['Laptop', 'Mobile', 'Monitor', 'Printer', 'Furniture', 'Other']}
      showAmount
      amountLabel="Cost (₹)"
      showDate
      dateLabel="Issued Date"
      statuses={['Assigned', 'In Store', 'Under Repair', 'Disposed']}
      decisions={['In Store', 'Under Repair', 'Disposed']}
      createByHrOnly
    />
  );
}
