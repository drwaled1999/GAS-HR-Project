import { useEffect, useMemo, useState } from 'react';
import { apiFetch, getProtectedFileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatSaudiIban, normalizeSaudiIban, saudiBanks } from '../../data/banks';

const today = '2026-04-10';

function prettyStatus(status) {
  const map = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return map[status] || status;
}

function statusClass(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function typeIcon(code) {
  const icons = {
    annual_leave: '🌴',
    sick_leave: '🩺',
    emergency_leave: '⚠️',
    hajj_leave: '🕋',
    umrah_leave: '🕌',
    business_trip: '🚗',
    task_assignment: '📌',
    salary_transfer: '🏦'
  };
  return icons[code] || '📝';
}

export default function EmployeeRequestsPage() {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('new');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employeeGasId: user?.gasId || '2036',
    type: 'annual_leave',
    startDate: today,
    endDate: today,
    note: '',
    currentBank: '',
    newBank: '',
    newIban: ''
  });

  const selectedType = useMemo(() => types.find((item) => item.code === form.type), [types, form.type]);
  const quickTypes = useMemo(() => types.slice(0, 4), [types]);

  async function load() {
    const [typesResponse, listResponse, balancesResponse] = await Promise.all([
      apiFetch('/requests-center/types'),
      apiFetch('/requests-center/list'),
      apiFetch('/requests-center/balances')
    ]);
    setTypes(typesResponse.types || []);
    setRequests(listResponse.leaveRequests || []);
    setBalances(balancesResponse.balances || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      employeeGasId: user?.gasId || prev.employeeGasId,
      startDate: selectedType?.requiresDateRange === false ? '' : (prev.startDate || today),
      endDate: selectedType?.requiresDateRange === false ? '' : (prev.endDate || today)
    }));
    setAttachment(null);
  }, [selectedType?.code, user?.gasId]);


  const myBalance = useMemo(() => balances.find((item) => String(item.employeeId) === String(user?.employeeId || 1)) || balances[0], [balances, user?.employeeId]);

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((request) => request.status === filter);
  }, [requests, filter]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedType) {
      setError('اختر نوع الطلب');
      return;
    }

    if (selectedType.requiresBankFields) {
      const iban = normalizeSaudiIban(form.newIban);
      if (!form.currentBank || !form.newBank || !iban) {
        setError('أكمل بيانات تحويل الراتب');
        return;
      }
      if (!/^SA[0-9A-Z]{22}$/.test(iban)) {
        setError('أدخل آيبان سعودي صحيح يبدأ بـ SA');
        return;
      }
    }

    if (selectedType.requiresAttachment && !attachment) {
      setError('المرفق مطلوب لهذا النوع من الطلبات');
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('employeeGasId', form.employeeGasId);
      body.append('type', form.type);
      body.append('note', form.note);
      if (selectedType.requiresDateRange !== false) {
        body.append('startDate', form.startDate);
        body.append('endDate', form.endDate);
      }
      if (selectedType.requiresBankFields) {
        body.append('currentBank', form.currentBank);
        body.append('newBank', form.newBank);
        body.append('newIban', normalizeSaudiIban(form.newIban));
      }
      if (attachment) body.append('attachment', attachment);
      await apiFetch('/requests-center/leave', { method: 'POST', body });
      setMessage('تم إرسال الطلب بنجاح');
      setTab('history');
      setForm((prev) => ({
        ...prev,
        type: 'annual_leave',
        startDate: today,
        endDate: today,
        note: '',
        currentBank: '',
        newBank: '',
        newIban: '',
        employeeGasId: user?.gasId || prev.employeeGasId
      }));
      setAttachment(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page mobile-page">
      <section className="card mobile-list-card request-hero-card">
        <div className="page-header compact">
          <div>
            <h2>Requests Center</h2>
            <p>قدّم إجازة أو سكليف أو تحويل راتب من جوالك بخطوات بسيطة.</p>
          </div>
          <span className="soft-badge">GAS ID: {user?.gasId || form.employeeGasId}</span>
        </div>
        <div className="mobile-tab-row">
          <button type="button" className={`tab-pill ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>New Request</button>
          <button type="button" className={`tab-pill ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>My Requests</button>
        </div>
      </section>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      {tab === 'new' ? (
        <>
          {myBalance ? (
            <section className="card mobile-list-card">
              <div className="page-header compact">
                <div><h2>Leave Balance</h2><p>Your current leave balance snapshot.</p></div>
              </div>
              <div className="snapshot-grid">
                <div className="mini-card"><span>Annual</span><strong>{myBalance.annualLeaveRemaining}</strong></div>
                <div className="mini-card"><span>Emergency</span><strong>{myBalance.emergencyLeaveRemaining}</strong></div>
                <div className="mini-card"><span>Sick</span><strong>{myBalance.sickLeaveRemaining}</strong></div>
              </div>
            </section>
          ) : null}
          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Quick Types</h2>
                <p>اختر النوع بسرعة لبدء الطلب.</p>
              </div>
            </div>
            <div className="quick-type-grid">
              {quickTypes.map((type) => (
                <button
                  type="button"
                  key={type.code}
                  className={`quick-type-card ${form.type === type.code ? 'active' : ''}`}
                  onClick={() => updateField('type', type.code)}
                >
                  <span className="quick-type-icon">{typeIcon(type.code)}</span>
                  <strong>{type.label}</strong>
                  <small>{type.requiresAttachment ? 'Attachment required' : 'Simple request'}</small>
                </button>
              ))}
              <button
                type="button"
                className={`quick-type-card ${form.type === 'salary_transfer' ? 'active payroll' : 'payroll'}`}
                onClick={() => updateField('type', 'salary_transfer')}
              >
                <span className="quick-type-icon">🏦</span>
                <strong>Salary Transfer</strong>
                <small>Current bank → New bank</small>
              </button>
            </div>
          </section>

          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Request Details</h2>
                <p>أكمل التفاصيل ثم أرسل الطلب.</p>
              </div>
              {selectedType ? (
                <span className={`soft-badge ${selectedType.requiresAttachment ? 'warning' : ''}`}>{selectedType.label}</span>
              ) : null}
            </div>

            <form className="form-grid mobile-form request-form-enhanced" onSubmit={handleSubmit}>
              <label className="span-2">
                Request Type
                <select value={form.type} onChange={(e) => updateField('type', e.target.value)}>
                  {types.map((type) => <option key={type.code} value={type.code}>{type.label}</option>)}
                </select>
              </label>

              {selectedType?.requiresDateRange !== false ? (
                <>
                  <label>
                    Start Date
                    <input type="date" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} />
                  </label>
                  <label>
                    End Date
                    <input type="date" value={form.endDate} onChange={(e) => updateField('endDate', e.target.value)} />
                  </label>
                </>
              ) : null}

              {selectedType?.requiresBankFields ? (
                <>
                  <label className="span-2">
                    Current Bank
                    <select value={form.currentBank} onChange={(e) => updateField('currentBank', e.target.value)}>
                      <option value="">Select current bank</option>
                      {saudiBanks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                    </select>
                  </label>
                  <label className="span-2">
                    New Bank
                    <select value={form.newBank} onChange={(e) => updateField('newBank', e.target.value)}>
                      <option value="">Select new bank</option>
                      {saudiBanks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                    </select>
                  </label>
                  <label className="span-2">
                    New IBAN
                    <input
                      value={form.newIban}
                      onChange={(e) => updateField('newIban', formatSaudiIban(e.target.value))}
                      placeholder="SA00 0000 0000 0000 0000 0000"
                    />
                  </label>
                </>
              ) : null}

              <label className="span-2">
                Note
                <textarea rows="3" value={form.note} onChange={(e) => updateField('note', e.target.value)} placeholder={selectedType?.requiresBankFields ? 'مثال: تحويل الراتب من البنك الحالي للبنك الجديد' : 'اكتب ملاحظة مختصرة'} />
              </label>

              <label className="span-2 upload-card">
                <span>Attachment {selectedType?.requiresAttachment ? '(required)' : '(optional)'}</span>
                <input type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                <small className="muted">يمكنك رفع صورة أو PDF. وفي تحويل الراتب أرفق مستند الآيبان الجديد.</small>
                {attachment ? <strong className="file-chip">{attachment.name}</strong> : null}
              </label>

              <div className="span-2 mobile-submit-row sticky-submit-row">
                <button type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Submit Request'}</button>
              </div>
            </form>
          </section>
        </>
      ) : (
        <>
          <section className="card mobile-filter-card">
            <div className="mobile-chip-row">
              {['all', 'pending', 'approved', 'rejected'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip-button ${filter === item ? 'active' : ''}`}
                  onClick={() => setFilter(item)}
                >
                  {item === 'all' ? 'All' : prettyStatus(item)}
                </button>
              ))}
            </div>
          </section>

          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>My Requests</h2>
                <p>تابع حالة كل طلب مع المرفقات والتفاصيل.</p>
              </div>
              <span className="soft-badge">{filteredRequests.length} requests</span>
            </div>
            <div className="mobile-request-list enhanced-request-list">
              {filteredRequests.map((request) => (
                <article key={request.id} className="request-mobile-card request-mobile-card-v2">
                  <div className="request-card-top">
                    <div>
                      <div className="request-title-row">
                        <span className="quick-type-icon">{typeIcon(types.find((t) => t.label === request.type)?.code)}</span>
                        <strong>{request.type}</strong>
                      </div>
                      <p>{request.startDate} {request.endDate && request.endDate !== request.startDate ? `→ ${request.endDate}` : ''}</p>
                    </div>
                    <span className={`soft-badge ${statusClass(request.status)}`}>{prettyStatus(request.status)}</span>
                  </div>

                  {request.newBank ? (
                    <div className="request-detail-grid">
                      <div><span>From</span><strong>{request.currentBank || '-'}</strong></div>
                      <div><span>To</span><strong>{request.newBank}</strong></div>
                      <div className="span-2"><span>IBAN</span><strong>{formatSaudiIban(request.newIban)}</strong></div>
                    </div>
                  ) : null}

                  {request.note ? <p className="request-note">{request.note}</p> : null}

                  <div className="request-card-actions">
                    {request.attachmentPath ? (
                      <a className="ghost-link" href={getProtectedFileUrl(`/files/request/${request.id}`)} target="_blank" rel="noreferrer">View Attachment</a>
                    ) : <span className="muted small">No attachment</span>}
                    {request.reviewerName ? <span className="muted small">By: {request.reviewerName}</span> : null}
                  </div>
                </article>
              ))}
              {!filteredRequests.length ? <p className="muted">لا توجد طلبات في هذه الحالة.</p> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
