import SimpleRecordPage from '../../components/SimpleRecordPage.jsx';

export default function Targets() {
  return (
    <SimpleRecordPage
      title="Goals & KPI / KRA / OKR"
      apiPath="/targets"
      titleLabel="Goal"
      detailLabel="Notes"
      showDate
      dateLabel="Due Date"
      showProgress
      statuses={['In Progress', 'Achieved', 'Missed']}
      decisions={['Achieved', 'Missed']}
      createByHrOnly
    />
  );
}
