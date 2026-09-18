import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function WeeklyIdeas() {
  return (
    <SimpleRecordPage
      title="Weekly Ideas"
      apiPath="/weekly-ideas"
      titleLabel="Idea"
      detailLabel="Description"
      statuses={['Submitted', 'Approved', 'Rejected']}
      decisions={['Approved', 'Rejected']}
    />
  );
}
