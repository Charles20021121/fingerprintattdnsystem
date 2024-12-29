import EmployeeDetail from './EmployeeDetail';

export default function Page({ params }) {
  return <EmployeeDetail id={params.id} />;
} 