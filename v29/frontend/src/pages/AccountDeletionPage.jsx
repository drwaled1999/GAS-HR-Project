export default function AccountDeletionPage() {
  return (
    <div style={{
      minHeight: "100vh",
      padding: "40px 20px",
      fontFamily: "Arial, sans-serif",
      background: "#f8fafc",
      color: "#0f172a"
    }}>
      <div style={{
        maxWidth: 850,
        margin: "0 auto",
        background: "#fff",
        padding: 32,
        borderRadius: 18,
        boxShadow: "0 10px 30px rgba(0,0,0,.08)"
      }}>
        <h1>Account Deletion Request</h1>

        <p>
          GAS HR respects user privacy and provides employees with a way to request
          deletion of their account and associated personal data.
        </p>

        <h2>How to request account deletion</h2>
        <p>
          To request deletion of your GAS HR account, please contact the GAS HR
          administration team using the email below:
        </p>

        <p>
          <strong>Email:</strong>{" "}
          <a href="mailto:drwaled1999@gmail.com">drwaled1999@gmail.com</a>
        </p>

        <h2>Required information</h2>
        <p>Please include the following details in your request:</p>

        <ul>
          <li>Full name</li>
          <li>Employee ID / GAS ID</li>
          <li>Registered username or email</li>
          <li>Reason for account deletion request</li>
        </ul>

        <h2>What data may be deleted</h2>
        <p>
          Upon approval, your account access and associated personal profile data
          may be deleted or disabled according to company policies and legal or
          operational requirements.
        </p>

        <h2>Data retention</h2>
        <p>
          Some employment, attendance, payroll, leave, or compliance records may be
          retained where required for business, legal, audit, or HR operational
          purposes.
        </p>

        <h2>Processing time</h2>
        <p>
          Account deletion requests are reviewed by GAS HR administration and may
          take up to 30 days to process.
        </p>

        <p style={{ marginTop: 30, color: "#64748b" }}>
          Last updated: June 2026
        </p>
      </div>
    </div>
  );
}
