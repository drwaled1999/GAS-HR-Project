import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../hooks_useDevice';

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="card dashboard-section">
      <div className="page-header compact">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function MobileActionButton({ label, onClick }) {
  return <button className="mobile-quick-button" onClick={onClick}>{label}</button>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await apiFetch(`/dashboard/summary?username=${user.username}`);
        setData(response);
      } catch (err) {
        setError(err.message);
      }
    }

    if (user?.username) loadDashboard();
  }, [user]);

  const quickActions = useMemo(() => {
    if (!user) return [];
    if (user.role === 'System Owner') {
      return ['إنشاء مستخدم جديد', 'رفع ملف البصمة', 'تشغيل أو إيقاف الصيانة', 'مراجعة الطلبات'];
    }
    if (user.role === 'HR Manager') {
      return ['إنشاء حساب سعودي', 'تعديل الحضور مباشرة', 'متابعة الغياب اليومي', 'تصدير Excel'];
    }
    if (user.role === 'Engineer') {
      return ['رفع ملف البصمة', 'إرسال طلب تعديل حضور', 'متابعة فريق البكج', 'مراجعة الطلبات المرسلة'];
    }
    return ['مراجعة الحضور', 'متابعة الطلبات'];
  }, [user]);

  if (!data && !error) {
    return <div className="page"><div className="card">Loading dashboard...</div></div>;
  }

  if (isMobile) {
    const cards = data?.cards || [];
    return (
      <div className="mobile-page admin-mobile-pro-dashboard">
        <section className="card admin-mobile-hero">
          <div className="page-header compact">
            <div>
              <h1>Admin Dashboard</h1>
              <p>ملخص سريع للطلبات، التنبيهات، والحضور ضمن نطاقك.</p>
            </div>
          </div>
          <div className="badge-cluster">
            <span className="soft-badge">{user?.role}</span>
            <span className="soft-badge">{user?.division}</span>
            {data?.user?.maintenanceMode ? <span className="soft-badge warning">Maintenance Mode</span> : null}
          </div>
        </section>

        {error ? <div className="alert error">{error}</div> : null}

        <section className="mobile-stat-grid admin-mobile-grid">
          {cards.slice(0, 4).map((item) => (
            <article key={`${item.label}-${item.value}`} className="card mobile-stat emphasis-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </article>
          ))}
        </section>

        <section className="card quick-action-card">
          <div className="page-header compact">
            <div>
              <h2>Quick Actions</h2>
              <p className="muted">إجراءات سريعة من الجوال.</p>
            </div>
          </div>
          <div className="mobile-action-grid">
            <MobileActionButton label="Review Requests" onClick={() => navigate('/requests')} />
            <MobileActionButton label="Attendance Issues" onClick={() => navigate('/attendance')} />
            <MobileActionButton label="Notifications" onClick={() => navigate('/notifications')} />
            <MobileActionButton label="Reports" onClick={() => navigate('/reports')} />
            <MobileActionButton label="Payroll" onClick={() => navigate('/payroll')} />
          </div>
        </section>

        <section className="card compact-snapshot-card">
          <div className="page-header compact">
            <div>
              <h2>Today Snapshot</h2>
              <p className="muted">لمحة سريعة بدون جداول ثقيلة.</p>
            </div>
          </div>
          <div className="snapshot-grid compact-mobile-snapshot">
            <div className="mini-card"><span>Present</span><strong>{data?.today?.present ?? 0}</strong></div>
            <div className="mini-card"><span>Absent</span><strong>{data?.today?.absent ?? 0}</strong></div>
            <div className="mini-card"><span>Single Punch</span><strong>{data?.today?.singlePunch ?? 0}</strong></div>
            <div className="mini-card"><span>Date</span><strong>{data?.today?.date || '-'}</strong></div>
          </div>
        </section>

        <section className="card recent-activity-card">
          <div className="page-header compact">
            <div>
              <h2>Recent Activity</h2>
              <p className="muted">آخر الطلبات والتحركات داخل نطاقك.</p>
            </div>
          </div>
          <div className="activity-list mobile-activity-list">
            {(data?.recentActivity || []).slice(0, 5).map((item) => (
              <div className="activity-item mobile-activity-item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <div className="activity-meta">
                  <span className="soft-badge">{item.status}</span>
                </div>
              </div>
            ))}
            {!data?.recentActivity?.length ? <p className="muted">لا توجد حركة حديثة حاليًا.</p> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>لوحة تحكم مخصصة حسب دورك ونطاق وصولك داخل النظام.</p>
        </div>
        <div className="badge-cluster">
          <span className="soft-badge">{user?.role}</span>
          <span className="soft-badge">{user?.division}</span>
          {data?.user?.maintenanceMode ? <span className="soft-badge warning">Maintenance Mode</span> : null}
        </div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="stat-grid">
        {(data?.cards || []).map((item) => (
          <article key={`${item.label}-${item.value}`} className="stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </article>
        ))}
      </section>

      <section className="grid-two dashboard-main">
        <SectionCard title="Quick Actions" subtitle="اختصارات مفيدة حسب صلاحياتك">
          <div className="action-list">
            {quickActions.map((item) => (
              <div key={item} className="action-item">{item}</div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Today Snapshot" subtitle="ملخص سريع لليوم الحالي">
          <div className="snapshot-grid">
            <div className="mini-card"><span>Present</span><strong>{data?.today?.present ?? 0}</strong></div>
            <div className="mini-card"><span>Absent</span><strong>{data?.today?.absent ?? 0}</strong></div>
            <div className="mini-card"><span>Single Punch</span><strong>{data?.today?.singlePunch ?? 0}</strong></div>
            <div className="mini-card"><span>Date</span><strong>{data?.today?.date || '-'}</strong></div>
          </div>
        </SectionCard>
      </section>

      <section className="grid-two dashboard-main">
        <SectionCard title="Projects in Scope" subtitle="المشاريع التي تدخل ضمن نطاقك">
          <div className="list-table">
            {(data?.projects || []).length ? data.projects.map((project) => (
              <div className="list-row" key={project.id}>
                <span>{project.name}</span>
                <strong>{project.employees} موظف</strong>
              </div>
            )) : <p className="muted">لا توجد مشاريع ضمن هذا النطاق.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Packages in Scope" subtitle="البكجات التي تتبع نطاقك الحالي">
          <div className="list-table">
            {(data?.packages || []).length ? data.packages.map((pkg) => (
              <div className="list-row" key={pkg.id}>
                <span>{pkg.name}</span>
                <strong>{pkg.employees} موظف</strong>
              </div>
            )) : <p className="muted">لا توجد بكجات ضمن هذا النطاق.</p>}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Recent Activity" subtitle="أحدث الطلبات والتعديلات ضمن نطاقك">
        <div className="activity-list">
          {(data?.recentActivity || []).length ? data.recentActivity.map((item) => (
            <div className="activity-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.subtitle}</p>
              </div>
              <div className="activity-meta">
                <span className="soft-badge">{item.status}</span>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
            </div>
          )) : <p className="muted">لا توجد حركة حديثة حاليًا.</p>}
        </div>
      </SectionCard>
    </div>
  );
}
