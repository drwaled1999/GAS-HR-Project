import { useAuth } from '../../context/AuthContext';

export default function EmployeeProfilePage() {
  const { user, logout } = useAuth();
  return (
    <div className="page mobile-page">
      <section className="card profile-card mobile-list-card">
        <h1>Profile</h1>
        <div className="detail-list profile-grid">
          <div className="list-row"><span>Name</span><strong>{user?.name}</strong></div>
          <div className="list-row"><span>GAS ID</span><strong>{user?.gasId}</strong></div>
          <div className="list-row"><span>Role</span><strong>{user?.role}</strong></div>
          <div className="list-row"><span>Division</span><strong>{user?.division}</strong></div>
          <div className="list-row"><span>Project</span><strong>{user?.project}</strong></div>
          <div className="list-row"><span>Package</span><strong>{user?.package}</strong></div>
        </div>
        <button onClick={logout}>Logout</button>
      </section>
    </div>
  );
}
