import { useAuth } from "../../context/AuthContext";

function valueOrDash(value) {
  if (value === null || value === undefined) return "-";
  if (String(value).trim() === "") return "-";
  return String(value);
}

export default function EmployeeProfilePage() {
  const { user, logout } = useAuth();

  const profileName =
    user?.name ||
    user?.fullName ||
    user?.username ||
    "-";

  const profileGasId =
    user?.gasId ||
    user?.employeeCode ||
    "-";

  const profileRole =
    user?.role ||
    user?.roleName ||
    "Employee";

  const profileDivision =
    user?.division ||
    user?.nationalityType ||
    "-";

  const profileProject =
    user?.projectName ||
    user?.project ||
    user?.projectId ||
    "-";

  const profilePackage =
    user?.packageName ||
    user?.package ||
    user?.packageId ||
    "-";

  return (
    <div className="page mobile-page">
      <section className="card profile-card mobile-list-card">
        <h1>Profile</h1>

        <div className="detail-list profile-grid">
          <div className="list-row">
            <span>Name</span>
            <strong>{valueOrDash(profileName)}</strong>
          </div>

          <div className="list-row">
            <span>GAS ID</span>
            <strong>{valueOrDash(profileGasId)}</strong>
          </div>

          <div className="list-row">
            <span>Role</span>
            <strong>{valueOrDash(profileRole)}</strong>
          </div>

          <div className="list-row">
            <span>Division</span>
            <strong>{valueOrDash(profileDivision)}</strong>
          </div>

          <div className="list-row">
            <span>Project</span>
            <strong>{valueOrDash(profileProject)}</strong>
          </div>

          <div className="list-row">
            <span>Package</span>
            <strong>{valueOrDash(profilePackage)}</strong>
          </div>
        </div>

        <button onClick={logout}>Logout</button>
      </section>
    </div>
  );
}
