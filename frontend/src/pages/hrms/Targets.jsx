import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Targets() {
  return (
    <SimpleRecordPage
      title="Targets"
      apiPath="/targets"
      titleLabel="Goal"
      detailLabel="Notes"
      showDate
      dateLabel="Due Date"
      statuses={['In Progress', 'Achieved', 'Missed']}
      decisions={['Achieved', 'Missed']}
    />
  );
}
