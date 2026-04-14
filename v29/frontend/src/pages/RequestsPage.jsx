import { useEffect, useMemo, useState } from 'react';
import { apiFetch, getProtectedFileUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../hooks_useDevice';

const initialForm = {
  employeeId: '',
  employeeGasId: '',
  type: 'annual_leave',
  startDate: '',
  endDate: '',
  note: '',
  attachment: null,
  currentBank: '',
  newBank: '',
  newIban: ''
};

const bankFriendlyKeys = new Set(['Salary Transfer', 'salary_transfer']);

function getStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'success';
  if (normalized === 'rejected') return 'danger';
  return 'warning';
}

function formatTypeLabel(item) {
  return item?.type || item?.newStatus || 'Request';
}

export default function RequestsPage() {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [attendanceRequests, setAttendanceRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [mobileTab, setMobileTab] = useState('queue');
  const [queueFilter, setQueueFilter] = useState('all');
  const [reviewMode, setReviewMode] = useState(false);

  const canReview = ['System Owner', 'Project Manager', 'CM', 'HR Manager', 'HR'].includes(user?.role);
  const canCreate = ['System Owner', 'Engineer', 'HR Manager', 'HR', 'Employee'].includes(user?.role);

  async function loadData() {
    try {
      setError('');

      const [requestResponse, typeResponse, usersResponse] = await Promise.all([
        apiFetch(`/requests-center/list?username=${encodeURIComponent(user.username)}`),
        apiFetch('/requests-center/types'),
        apiFetch(`/users?username=${encodeURIComponent(user.username)}`)
      ]);

      setAttendanceRequests(requestResponse?.attendanceAdjustments || []);
      setLeaveRequests(requestResponse?.leaveRequests || []);
      setTypes(typeResponse?.types || []);
      setEmployees(usersResponse?.employees || []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    }
  }

  useEffect(() => {
    if (user?.username) {
      loadData();
    }
  }, [user?.username]);

  const selectedType = useMemo(() => {
    return types.find((item) => item.code === form.type);
  }, [types, form.type]);

  const pendingLeaveRequests = useMemo(() => {
    return leaveRequests.filter((item) => item.status === 'pending');
  }, [leaveRequests]);

  const pendingAttendanceRequests = useMemo(() => {
    return attendanceRequests.filter((item) => item.status === 'pending');
  }, [attendanceRequests]);

  const needsBankFields = selectedType?.requiresBankFields;

  const mobileQueueItems = useMemo(() => {
    const leave = leaveRequests.map((item) => ({ ...item, queueType: 'leave' }));
    const attendance = attendanceRequests.map((item) => ({ ...item, queueType: 'attendance' }));

    let merged = [...leave, ...attendance];

    if (queueFilter === 'pending') {
      merged = merged.filter((item) => item.status === 'pending');
    }

    if (queueFilter === 'salary_transfer') {
      merged = merged.filter((item) => bankFriendlyKeys.has(item.type || item.newStatus));
    }

    if (queueFilter === 'leave') {
      merged = merged.filter(
        (item) => item.queueType === 'leave' && !bankFriendlyKeys.has(item.type || '')
      );
    }

    if (queueFilter === 'attendance') {
      merged = merged.filter((item) => item.queueType === 'attendance');
    }

    return merged.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
  }, [leaveRequests, attendanceRequests, queueFilter]);

  const reviewQueue = useMemo(() => {
    return mobileQueueItems.filter((item) => item.status === 'pending');
  }, [mobileQueueItems]);

  const activeReviewItem = reviewMode ? reviewQueue[0] : null;

  function onFormChange(event) {
    const { name, value, files } = event.target;
    let nextValue = files ? files[0] : value;

    if (name === 'newIban') {
      nextValue = String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim();
    }

    setForm((prev) => ({
      ...prev,
      [name]: nextValue
    }));
  }

  async function submitLeaveRequest(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const body = new FormData();

      body.append('username', user.username);

      if (form.employeeId) body.append('employeeId', form.employeeId);
      if (form.employeeGasId) body.append('employeeGasId', form.employeeGasId);

      body.append('type', form.type);

      if (selectedType?.requiresDateRange) {
        body.append('startDate', form.startDate);
        body.append('endDate', form.endDate);
      }

      body.append('note', form.note || '');

      if (needsBankFields) {
        body.append('currentBank', form.currentBank || '');
        body.append('newBank', form.newBank || '');
        body.append('newIban', (form.newIban || '').replace(/\s+/g, ''));
      }

      if (form.attachment) {
        body.append('attachment', form.attachment);
      }

      await apiFetch('/requests-center/leave', {
        method: 'POST',
        body
      });

      setMessage('تم إرسال الطلب بنجاح');
      setForm(initialForm);
      setMobileTab('queue');
      setReviewMode(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    }
  }

  async function reviewLeave(id, decision) {
    try {
      setMessage('');
      setError('');

      await apiFetch(`/requests-center/leave/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          decision,
          rejectionReason: decision === 'rejected' ? 'Rejected from mobile review UI' : ''
        })
      });

      setMessage(decision === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to review leave request');
    }
  }

  async function reviewAttendance(id, decision) {
    try {
      setMessage('');
      setError('');

      await apiFetch(`/attendance/adjustments/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reviewerId: user?.id,
          reviewerName: user?.name,
          rejectionReason: decision === 'rejected' ? 'Rejected from mobile review UI' : ''
        })
      });

      setMessage(
        decision === 'approved'
          ? 'تمت الموافقة على طلب تعديل الحضور'
          : 'تم رفض طلب تعديل الحضور'
      );

      loadData();
    } catch (err) {
      setError(err.message || 'Failed to review attendance request');
    }
  }

  if (isMobile) {
    return (
      <div className="mobile-page mobile-admin-requests-page">
        <section className="card request-hero-card">
          <div className="page-header compact">
            <div>
              <h1>Requests</h1>
              <p>مراجعة سريعة للطلبات، وتحويلات الرواتب، واعتمادات الحضور من الجوال.</p>
            </div>
          </div>

          <div className="mobile-stat-grid">
            <article className="card mobile-stat info">
              <span>Pending Leave / Task</span>
              <strong>{pendingLeaveRequests.length}</strong>
            </article>
            <article className="card mobile-stat warning">
              <span>Pending Attendance</span>
              <strong>{pendingAttendanceRequests.length}</strong>
            </article>
          </div>

          <div className="mobile-tab-row">
            <button
              className={`tab-pill ${mobileTab === 'queue' ? 'active' : ''}`}
              onClick={() => setMobileTab('queue')}
            >
              Approval Queue
            </button>
            <button
              className={`tab-pill ${mobileTab === 'new' ? 'active' : ''}`}
              onClick={() => setMobileTab('new')}
            >
              New Request
            </button>
          </div>
        </section>

        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        {mobileTab === 'queue' ? (
          <>
            <section className="card mobile-list-card quick-review-shell">
              <div className="page-header compact">
                <div>
                  <h2>Approval Queue</h2>
                  <p className="muted">فلترة ذكية + وضع مراجعة سريع من الجوال.</p>
                </div>
                <button className="ghost" onClick={() => setReviewMode((prev) => !prev)}>
                  {reviewMode ? 'Exit Review' : 'Quick Review'}
                </button>
              </div>

              <div className="chip-row">
                <button className={`chip ${queueFilter === 'all' ? 'active' : ''}`} onClick={() => setQueueFilter('all')}>All</button>
                <button className={`chip ${queueFilter === 'pending' ? 'active' : ''}`} onClick={() => setQueueFilter('pending')}>Pending</button>
                <button className={`chip ${queueFilter === 'salary_transfer' ? 'active' : ''}`} onClick={() => setQueueFilter('salary_transfer')}>Salary Transfer</button>
                <button className={`chip ${queueFilter === 'leave' ? 'active' : ''}`} onClick={() => setQueueFilter('leave')}>Leave</button>
                <button className={`chip ${queueFilter === 'attendance' ? 'active' : ''}`} onClick={() => setQueueFilter('attendance')}>Attendance</button>
              </div>

              {reviewMode ? (
                <div className="review-mode-card">
                  {activeReviewItem ? (
                    <>
                      <div className="request-title-row">
                        <strong>{activeReviewItem.employeeName || activeReviewItem.employeeId}</strong>
                        <span className={`soft-badge ${getStatusClass(activeReviewItem.status)}`}>
                          {activeReviewItem.queueType}
                        </span>
                      </div>

                      <p>{formatTypeLabel(activeReviewItem)}</p>

                      <div className="request-detail-grid" style={{ marginTop: 12 }}>
                        <div>
                          <span>Status</span>
                          <strong>{activeReviewItem.status}</strong>
                        </div>
                        <div>
                          <span>Date</span>
                          <strong>{activeReviewItem.date || activeReviewItem.startDate || '-'}</strong>
                        </div>
                        {activeReviewItem.note ? (
                          <div className="span-2">
                            <span>Note</span>
                            <strong>{activeReviewItem.note}</strong>
                          </div>
                        ) : null}
                        {activeReviewItem.reason ? (
                          <div className="span-2">
                            <span>Reason</span>
                            <strong>{activeReviewItem.reason}</strong>
                          </div>
                        ) : null}
                      </div>

                      <div className="review-mode-actions">
                        {activeReviewItem.queueType === 'leave' ? (
                          <>
                            <button onClick={() => reviewLeave(activeReviewItem.id, 'approved')}>
                              Approve
                            </button>
                            <button
                              className="ghost"
                              onClick={() => reviewLeave(activeReviewItem.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => reviewAttendance(activeReviewItem.id, 'approved')}>
                              Approve
                            </button>
                            <button
                              className="ghost"
                              onClick={() => reviewAttendance(activeReviewItem.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="muted">لا توجد طلبات معلقة في وضع المراجعة السريعة.</p>
                  )}
                </div>
              ) : null}
            </section>

            <section className="card mobile-list-card">
              <div className="page-header compact">
                <div>
                  <h2>Leave / Task Queue</h2>
                  <p className="muted">بطاقات مخصصة لمراجعة الطلبات بسرعة من الجوال.</p>
                </div>
              </div>

              <div className="mobile-request-list enhanced-request-list">
                {leaveRequests.length ? (
                  leaveRequests.map((item) => (
                    <article className="card request-mobile-card-v2" key={`leave-mobile-${item.id}`}>
                      <div className="request-card-top">
                        <div>
                          <div className="request-title-row">
                            <strong>{item.employeeName}</strong>
                            <span className={`soft-badge ${getStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <p>{item.type}</p>
                        </div>

                        {item.attachmentPath ? (
                          <a
                            className="ghost-link"
                            href={getProtectedFileUrl(`/files/request/${item.id}`)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Attachment
                          </a>
                        ) : null}
                      </div>

                      <div className="request-detail-grid">
                        <div>
                          <span>Requested By</span>
                          <strong>{item.requestedByName || '-'}</strong>
                        </div>
                        <div>
                          <span>Date Range</span>
                          <strong>
                            {item.startDate}
                            {item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ''}
                          </strong>
                        </div>

                        {bankFriendlyKeys.has(item.type) ? (
                          <>
                            <div>
                              <span>Current Bank</span>
                              <strong>{item.currentBank || '-'}</strong>
                            </div>
                            <div>
                              <span>New Bank</span>
                              <strong>{item.newBank || '-'}</strong>
                            </div>
                            <div className="span-2">
                              <span>New IBAN</span>
                              <strong>{item.newIban || '-'}</strong>
                            </div>
                          </>
                        ) : null}

                        {item.note ? (
                          <div className="span-2">
                            <span>Note</span>
                            <strong>{item.note}</strong>
                          </div>
                        ) : null}
                      </div>

                      {canReview && item.status === 'pending' ? (
                        <div className="request-card-actions">
                          <button onClick={() => reviewLeave(item.id, 'approved')}>Approve</button>
                          <button className="ghost" onClick={() => reviewLeave(item.id, 'rejected')}>
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="muted">لا توجد طلبات حالياً.</p>
                )}
              </div>
            </section>

            <section className="card mobile-list-card">
              <div className="page-header compact">
                <div>
                  <h2>Attendance Adjustments</h2>
                  <p className="muted">اعتماد سريع لتعديلات الحضور.</p>
                </div>
              </div>

              <div className="mobile-request-list enhanced-request-list">
                {attendanceRequests.length ? (
                  attendanceRequests.map((item) => (
                    <article className="card request-mobile-card-v2" key={`att-mobile-${item.id}`}>
                      <div className="request-card-top">
                        <div>
                          <div className="request-title-row">
                            <strong>{item.employeeName || item.employeeId}</strong>
                            <span className={`soft-badge ${getStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <p>{item.date}</p>
                        </div>
                      </div>

                      <div className="request-detail-grid">
                        <div>
                          <span>Current</span>
                          <strong>{item.currentValue}</strong>
                        </div>
                        <div>
                          <span>Requested</span>
                          <strong>{item.newStatus}</strong>
                        </div>
                        <div className="span-2">
                          <span>Reason</span>
                          <strong>{item.reason || '-'}</strong>
                        </div>
                      </div>

                      {canReview && item.status === 'pending' ? (
                        <div className="request-card-actions">
                          <button onClick={() => reviewAttendance(item.id, 'approved')}>Approve</button>
                          <button className="ghost" onClick={() => reviewAttendance(item.id, 'rejected')}>
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="muted">لا توجد طلبات تعديل حضور.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="card mobile-list-card">
            <div className="page-header compact">
              <div>
                <h2>Create Request</h2>
                <p className="muted">واجهة جوال موحدة للإجازات، المهام، وتحويلات الرواتب.</p>
              </div>
            </div>

            {canCreate ? (
              <form className="form-grid mobile-form request-form-enhanced" onSubmit={submitLeaveRequest}>
                <label>
                  Employee
                  <select name="employeeId" value={form.employeeId} onChange={onFormChange}>
                    <option value="">اختر الموظف</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.gasId}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Or GAS ID
                  <input
                    name="employeeGasId"
                    value={form.employeeGasId}
                    onChange={onFormChange}
                    placeholder="مثال: 2036"
                  />
                </label>

                <label>
                  Request Type
                  <select name="type" value={form.type} onChange={onFormChange}>
                    {types.map((type) => (
                      <option key={type.code} value={type.code}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedType?.requiresDateRange ? (
                  <>
                    <label>
                      Start Date
                      <input type="date" name="startDate" value={form.startDate} onChange={onFormChange} required />
                    </label>
                    <label>
                      End Date
                      <input type="date" name="endDate" value={form.endDate} onChange={onFormChange} required />
                    </label>
                  </>
                ) : null}

                {needsBankFields ? (
                  <>
                    <label>
                      Current Bank
                      <input
                        name="currentBank"
                        value={form.currentBank}
                        onChange={onFormChange}
                        placeholder="البنك الحالي"
                        required
                      />
                    </label>
                    <label>
                      New Bank
                      <input
                        name="newBank"
                        value={form.newBank}
                        onChange={onFormChange}
                        placeholder="البنك الجديد"
                        required
                      />
                    </label>
                    <label className="span-2">
                      New IBAN
                      <input
                        name="newIban"
                        value={form.newIban}
                        onChange={onFormChange}
                        placeholder="SA00 0000 0000 0000 0000 0000"
                        required
                      />
                    </label>
                  </>
                ) : null}

                <label className="span-2 upload-card">
                  Attachment {selectedType?.requiresAttachment ? '(Required)' : '(Optional)'}
                  <input type="file" name="attachment" onChange={onFormChange} />
                  {form.attachment ? <span className="file-chip">{form.attachment.name}</span> : null}
                </label>

                <label className="span-2">
                  Note
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={onFormChange}
                    rows="4"
                    placeholder="سبب الطلب أو تفاصيل إضافية"
                  />
                </label>

                <div className="span-2 sticky-submit-row">
                  <button type="submit">Submit Request</button>
                </div>
              </form>
            ) : (
              <p className="muted">ليس لديك صلاحية إنشاء طلبات جديدة.</p>
            )}
          </section>
        )}

        {mobileTab === 'queue' ? (
          <button className="floating-review-fab" onClick={() => setReviewMode(true)}>
            Review Pending
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Request Center</h1>
          <p>إجازات، سكاليف، مهام عمل، وتحويلات رواتب مع معاينة المرفقات والموافقة.</p>
        </div>
      </div>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-two">
        <section className="card">
          <div className="page-header compact">
            <div>
              <h2>Create Leave / Task / Salary Transfer</h2>
              <p className="muted">للسعوديين وغير السعوديين مع مرفق إجباري حسب النوع.</p>
            </div>
          </div>

          {canCreate ? (
            <form className="form-grid" onSubmit={submitLeaveRequest}>
              <label>
                Employee
                <select name="employeeId" value={form.employeeId} onChange={onFormChange}>
                  <option value="">اختر الموظف</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} — {employee.gasId}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Or GAS ID
                <input
                  name="employeeGasId"
                  value={form.employeeGasId}
                  onChange={onFormChange}
                  placeholder="مثال: 2036"
                />
              </label>

              <label>
                Request Type
                <select name="type" value={form.type} onChange={onFormChange}>
                  {types.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedType?.requiresDateRange ? (
                <>
                  <label>
                    Start Date
                    <input type="date" name="startDate" value={form.startDate} onChange={onFormChange} required />
                  </label>
                  <label>
                    End Date
                    <input type="date" name="endDate" value={form.endDate} onChange={onFormChange} required />
                  </label>
                </>
              ) : null}

              {needsBankFields ? (
                <>
                  <label>
                    Current Bank
                    <input
                      name="currentBank"
                      value={form.currentBank}
                      onChange={onFormChange}
                      placeholder="البنك الحالي"
                      required
                    />
                  </label>
                  <label>
                    New Bank
                    <input
                      name="newBank"
                      value={form.newBank}
                      onChange={onFormChange}
                      placeholder="البنك الجديد"
                      required
                    />
                  </label>
                  <label className="span-2">
                    New IBAN
                    <input
                      name="newIban"
                      value={form.newIban}
                      onChange={onFormChange}
                      placeholder="SA00 0000 0000 0000 0000 0000"
                      required
                    />
                  </label>
                </>
              ) : null}

              <label>
                Attachment {selectedType?.requiresAttachment ? '(Required)' : '(Optional)'}
                <input type="file" name="attachment" onChange={onFormChange} />
              </label>

              <label className="span-2">
                Note
                <input
                  name="note"
                  value={form.note}
                  onChange={onFormChange}
                  placeholder="سبب الطلب أو أي ملاحظة"
                />
              </label>

              <div className="span-2 modal-actions">
                <button type="submit">Submit Request</button>
              </div>
            </form>
          ) : (
            <p className="muted">ليس لديك صلاحية إنشاء طلبات جديدة.</p>
          )}
        </section>

        <section className="card">
          <div className="page-header compact">
            <div>
              <h2>Queue Snapshot</h2>
              <p className="muted">المعلقة حاليًا ضمن نطاقك.</p>
            </div>
          </div>

          <div className="mobile-stat-grid">
            <article className="card mobile-stat info">
              <span>Pending Leave / Task</span>
              <strong>{pendingLeaveRequests.length}</strong>
            </article>
            <article className="card mobile-stat warning">
              <span>Pending Attendance</span>
              <strong>{pendingAttendanceRequests.length}</strong>
            </article>
          </div>

          <div className="badge-cluster" style={{ marginTop: 16 }}>
            {types.map((type) => (
              <span
                key={type.code}
                className={`soft-badge ${type.requiresAttachment ? 'warning' : ''}`}
              >
                {type.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="card table-wrap compact-table">
        <div className="page-header compact">
          <div>
            <h2>Leave / Task Requests</h2>
            <p className="muted">معاينة المرفقات، البنك، والآيبان عند الحاجة.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Bank Details</th>
              <th>Attachment</th>
              <th>Requested By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.map((item) => (
              <tr key={`leave-${item.id}`}>
                <td>{item.employeeName}</td>
                <td>{item.type}</td>
                <td>
                  {item.startDate}
                  {item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ''}
                </td>
                <td>
                  <span className={`soft-badge ${getStatusClass(item.status)}`}>{item.status}</span>
                </td>
                <td>
                  {bankFriendlyKeys.has(item.type) ? (
                    <div className="small">
                      <div>{item.currentBank} → {item.newBank}</div>
                      <div>{item.newIban}</div>
                    </div>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
                <td>
                  {item.attachmentPath ? (
                    <a
                      href={getProtectedFileUrl(`/files/request/${item.id}`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.attachmentName || 'Preview'}
                    </a>
                  ) : (
                    <span className="muted small">No attachment</span>
                  )}
                </td>
                <td>{item.requestedByName || '-'}</td>
                <td>
                  {canReview && item.status === 'pending' ? (
                    <div className="inline-actions wrap-actions">
                      <button onClick={() => reviewLeave(item.id, 'approved')}>Approve</button>
                      <button className="ghost" onClick={() => reviewLeave(item.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="muted small">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card table-wrap compact-table">
        <div className="page-header compact">
          <div>
            <h2>Attendance Adjustment Requests</h2>
            <p className="muted">طلبات تعديل الحضور المرتبطة بالجدول الشهري.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Current</th>
              <th>Requested</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Requested By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRequests.map((item) => (
              <tr key={`att-${item.id}`}>
                <td>{item.employeeName || item.employeeId}</td>
                <td>{item.date}</td>
                <td>{item.currentValue}</td>
                <td>{item.newStatus}</td>
                <td>{item.reason || '-'}</td>
                <td>
                  <span className={`soft-badge ${getStatusClass(item.status)}`}>{item.status}</span>
                </td>
                <td>{item.requestedByName || '-'}</td>
                <td>
                  {canReview && item.status === 'pending' ? (
                    <div className="inline-actions wrap-actions">
                      <button onClick={() => reviewAttendance(item.id, 'approved')}>Approve</button>
                      <button className="ghost" onClick={() => reviewAttendance(item.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="muted small">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
