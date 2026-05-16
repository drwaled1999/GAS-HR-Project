import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Search,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Users,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  Printer,
  ShieldCheck,
  Filter,
  Download,
} from "lucide-react";
import {
  generateTimesheetReport,
  downloadOfficialTimesheetPdf,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return String(Math.round(number));
}

function getMonthName(month, year) {
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function exportExcel(report, filters) {
  const days = safeArray(report?.days);
  const employees = safeArray(report?.employees);

  const rows = [
    ["GAS Arabian Services"],
    ["Timesheet Report"],
    [`Period: ${getMonthName(filters.month, filters.year)}`],
    [`Source: ${report?.source || filters.source}`],
    [],
    [
      "Employee Name",
      "GAS ID",
      "Type",
      "Project",
      "Package",
      "Nationality",
      ...days.map((day) => day.label),
      "Total Hours",
      "Working Days",
      "Absent",
      "SP",
      "AL",
      "SL",
      "EL",
      "PM",
      "TK",
    ],
    ...employees.map((employee) => [
      employee.employeeName || "-",
      employee.gasId || "-",
      employee.employeeType || "-",
      employee.project || "-",
      employee.package || "-",
      employee.nationality || "-",
      ...safeArray(employee.cells).map((cell) => cell?.value || ""),
      formatNumber(employee.totalHours),
      formatNumber(employee.workingDays),
      formatNumber(employee.absent),
      formatNumber(employee.singlePunch),
      formatNumber(employee.annualLeave),
      formatNumber(employee.sickLeave),
      formatNumber(employee.emergencyLeave),
      formatNumber(employee.permission),
      formatNumber(employee.takleef),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

  const fileName = `Timesheet_${filters.month}_${filters.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="tsg-stat-card">
      <div className="tsg-stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

function CellBadge({ cell }) {
  const value = String(cell?.value || "").trim() || "-";
  const type = String(cell?.type || "normal");

  return <span className={`tsg-cell-badge ${type}`}>{value}</span>;
}

export default function TimesheetReportGeneratorPage() {
  const { user } = useAuth();
  const now = new Date();

  const [filters, setFilters] = useState({
    source: "auto",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    projectKey: "",
    projectName: "",
    packageName: "",
    employeeType: "all",
    search: "",
    customerName: "",
    poNumber: "",
    projectCode: "",
  });

  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const days = safeArray(report?.days);
  const employees = safeArray(report?.employees);
  const summary = report?.summary || {};

  const filteredSourceLabel = useMemo(() => {
    if (report?.source === "project") return "Project Attendance";
    if (report?.source === "general") return "General Attendance";
    return "Auto Detect";
  }, [report?.source]);

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleGenerate() {
    try {
      setLoading(true);
      setMessage("");
      setMessageType("success");

      const result = await generateTimesheetReport(filters);

      setReport(result?.report || null);
      setMessage(result?.message || "Timesheet report generated successfully.");
      setMessageType(result?.report?.employees?.length ? "success" : "warning");
    } catch (error) {
      console.error(error);
      setReport(null);
      setMessage(error.message || "Failed to generate timesheet report.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleOfficialPdf() {
    try {
      setPdfLoading(true);
      setMessage("");
      setMessageType("success");

      await downloadOfficialTimesheetPdf(filters);

      setMessage("Official PDF downloaded successfully.");
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Failed to download official PDF.");
      setMessageType("error");
    } finally {
      setPdfLoading(false);
    }
  }

  function handleReset() {
    setFilters({
      source: "auto",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      projectKey: "",
      projectName: "",
      packageName: "",
      employeeType: "all",
      search: "",
      customerName: "",
      poNumber: "",
      projectCode: "",
    });
    setReport(null);
    setMessage("");
  }

  const canExport = employees.length > 0;

  return (
    <div className="tsg-page">
      <style>{`
        .tsg-page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 34%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
          color: #0f172a;
        }

        .tsg-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .tsg-title-block {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .tsg-logo {
          width: 58px;
          height: 58px;
          border-radius: 20px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
          overflow: hidden;
        }

        .tsg-logo img {
          width: 42px;
          height: 42px;
          object-fit: contain;
        }

        .tsg-header h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.04em;
        }

        .tsg-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .tsg-header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .tsg-btn {
          border: 0;
          border-radius: 14px;
          padding: 11px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 800;
          cursor: pointer;
          color: #0f172a;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }

        .tsg-btn.primary {
          background: linear-gradient(135deg, #0f766e, #0f172a);
          color: #ffffff;
        }

        .tsg-btn.official {
          background: linear-gradient(135deg, #1d4ed8, #0f172a);
          color: #ffffff;
        }

        .tsg-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .tsg-grid {
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .tsg-panel {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 26px;
          box-shadow: 0 18px 55px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(14px);
        }

        .tsg-filter-panel {
          padding: 18px;
          position: sticky;
          top: 18px;
        }

        .tsg-section-title {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0 0 14px;
          font-size: 15px;
          font-weight: 900;
        }

        .tsg-form-grid {
          display: grid;
          gap: 12px;
        }

        .tsg-field label {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: #475569;
          margin-bottom: 7px;
        }

        .tsg-field input,
        .tsg-field select {
          width: 100%;
          border: 1px solid #dbe3ef;
          background: #ffffff;
          border-radius: 14px;
          padding: 11px 12px;
          outline: none;
          font-weight: 700;
          color: #0f172a;
        }

        .tsg-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .tsg-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 2px 0;
        }

        .tsg-mini-note {
          margin: -3px 0 0;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.4;
        }

        .tsg-alert {
          margin-top: 14px;
          padding: 12px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 800;
        }

        .tsg-alert.success {
          background: #ecfdf5;
          color: #047857;
        }

        .tsg-alert.error {
          background: #fef2f2;
          color: #b91c1c;
        }

        .tsg-alert.warning {
          background: #fffbeb;
          color: #92400e;
        }

        .tsg-content {
          display: grid;
          gap: 18px;
        }

        .tsg-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .tsg-stat-card {
          padding: 16px;
          border-radius: 22px;
          background: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.24);
          box-shadow: 0 14px 35px rgba(15, 23, 42, 0.07);
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .tsg-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          color: #0f766e;
        }

        .tsg-stat-card p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .tsg-stat-card strong {
          display: block;
          margin-top: 3px;
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .tsg-stat-card span {
          display: block;
          margin-top: 2px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
        }

        .tsg-report-panel {
          overflow: hidden;
        }

        .tsg-report-top {
          padding: 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .tsg-report-top h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.03em;
        }

        .tsg-report-top p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .tsg-source-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .tsg-table-wrap {
          overflow: auto;
          max-height: 68vh;
        }

        .tsg-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 1200px;
          font-size: 12px;
        }

        .tsg-table th {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #f8fafc;
          color: #334155;
          text-align: center;
          padding: 10px 8px;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 900;
        }

        .tsg-table th.employee-col,
        .tsg-table td.employee-col {
          position: sticky;
          left: 0;
          z-index: 6;
          background: #ffffff;
          text-align: left;
          min-width: 230px;
          border-right: 1px solid #e2e8f0;
        }

        .tsg-table th.employee-col {
          background: #f8fafc;
          z-index: 8;
        }

        .tsg-table td {
          padding: 9px 8px;
          text-align: center;
          border-bottom: 1px solid #eef2f7;
          color: #0f172a;
          font-weight: 700;
        }

        .tsg-employee-name {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .tsg-employee-name strong {
          font-size: 13px;
        }

        .tsg-employee-name span {
          color: #64748b;
          font-size: 11px;
        }

        .tsg-cell-badge {
          min-width: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 7px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
        }

        .tsg-cell-badge.hours {
          background: #ecfdf5;
          color: #047857;
        }

        .tsg-cell-badge.absent {
          background: #fef2f2;
          color: #b91c1c;
        }

        .tsg-cell-badge.single_punch,
        .tsg-cell-badge.single {
          background: #fffbeb;
          color: #b45309;
        }

        .tsg-cell-badge.weekend {
          background: #e2e8f0;
          color: #475569;
        }

        .tsg-cell-badge.annual_leave,
        .tsg-cell-badge.sick_leave,
        .tsg-cell-badge.emergency_leave,
        .tsg-cell-badge.permission,
        .tsg-cell-badge.takleef {
          background: #eef2ff;
          color: #3730a3;
        }

        .tsg-empty {
          padding: 56px 18px;
          text-align: center;
          color: #64748b;
        }

        .tsg-empty svg {
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .tsg-empty h3 {
          margin: 0 0 6px;
          color: #0f172a;
        }

        .tsg-signatures {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          padding: 18px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .tsg-sign-box {
          background: #ffffff;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 14px;
          min-height: 82px;
        }

        .tsg-sign-box strong {
          display: block;
          font-size: 12px;
          margin-bottom: 22px;
        }

        .tsg-sign-box span {
          color: #94a3b8;
          font-size: 11px;
        }

        @media print {
          .tsg-filter-panel,
          .tsg-header-actions,
          .tsg-kpis,
          .tsg-alert {
            display: none !important;
          }

          .tsg-page {
            padding: 0;
            background: #ffffff;
          }

          .tsg-grid {
            display: block;
          }

          .tsg-panel {
            box-shadow: none;
            border: 0;
            border-radius: 0;
          }

          .tsg-table-wrap {
            max-height: none;
            overflow: visible;
          }

          .tsg-table {
            min-width: 100%;
            font-size: 10px;
          }

          .tsg-table th.employee-col,
          .tsg-table td.employee-col {
            position: static;
          }
        }

        @media (max-width: 1100px) {
          .tsg-grid {
            grid-template-columns: 1fr;
          }

          .tsg-filter-panel {
            position: static;
          }

          .tsg-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .tsg-page {
            padding: 14px;
          }

          .tsg-header {
            flex-direction: column;
          }

          .tsg-header h1 {
            font-size: 22px;
          }

          .tsg-header-actions {
            width: 100%;
          }

          .tsg-btn {
            flex: 1;
          }

          .tsg-two,
          .tsg-kpis,
          .tsg-signatures {
            grid-template-columns: 1fr;
          }

          .tsg-report-top {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="tsg-header">
        <div className="tsg-title-block">
          <div className="tsg-logo">
            <img src="/logo.svg" alt="GAS" />
          </div>

          <div>
            <h1>Timesheet Report Generator</h1>
            <p>
              Generate official monthly timesheets from Project Attendance and General Attendance.
            </p>
          </div>
        </div>

        <div className="tsg-header-actions">
          <button
            type="button"
            className="tsg-btn"
            onClick={() => window.print()}
            disabled={!canExport}
          >
            <Printer size={17} />
            Print / PDF
          </button>

          <button
            type="button"
            className="tsg-btn"
            onClick={() => exportExcel(report, filters)}
            disabled={!canExport}
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>

          <button
            type="button"
            className="tsg-btn official"
            onClick={handleOfficialPdf}
            disabled={pdfLoading || loading}
            title="Download official GAS-style PDF"
          >
            {pdfLoading ? <RefreshCcw size={17} /> : <Download size={17} />}
            {pdfLoading ? "Preparing..." : "Official PDF"}
          </button>

          <button
            type="button"
            className="tsg-btn primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? <RefreshCcw size={17} /> : <FileText size={17} />}
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      <div className="tsg-grid">
        <aside className="tsg-panel tsg-filter-panel">
          <h3 className="tsg-section-title">
            <Filter size={17} />
            Report Filters
          </h3>

          <div className="tsg-form-grid">
            <div className="tsg-field">
              <label>Data Source</label>
              <select
                value={filters.source}
                onChange={(event) => updateFilter("source", event.target.value)}
              >
                <option value="auto">Auto Detect</option>
                <option value="project">Project Attendance</option>
                <option value="general">General Attendance</option>
              </select>
            </div>

            <div className="tsg-two">
              <div className="tsg-field">
                <label>Month</label>
                <select
                  value={filters.month}
                  onChange={(event) => updateFilter("month", Number(event.target.value))}
                >
                  {Array.from({ length: 12 }).map((_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {new Date(2026, index, 1).toLocaleString("en-US", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tsg-field">
                <label>Year</label>
                <input
                  type="number"
                  value={filters.year}
                  onChange={(event) => updateFilter("year", Number(event.target.value))}
                />
              </div>
            </div>

            <div className="tsg-field">
              <label>Project Key</label>
              <input
                value={filters.projectKey}
                onChange={(event) => updateFilter("projectKey", event.target.value)}
                placeholder="Example: qatif / project uuid"
              />
            </div>

            <div className="tsg-field">
              <label>Project Name</label>
              <input
                value={filters.projectName}
                onChange={(event) => updateFilter("projectName", event.target.value)}
                placeholder="Example: Qatif PKG-12"
              />
            </div>

            <div className="tsg-field">
              <label>Package</label>
              <input
                value={filters.packageName}
                onChange={(event) => updateFilter("packageName", event.target.value)}
                placeholder="Example: PKG-12"
              />
            </div>

            <div className="tsg-field">
              <label>Employee Type</label>
              <select
                value={filters.employeeType}
                onChange={(event) => updateFilter("employeeType", event.target.value)}
              >
                <option value="all">All Employees</option>
                <option value="gas">GAS Employees</option>
                <option value="rental">Rental Manpower</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="tsg-field">
              <label>Search</label>
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Name, GAS ID, project, package..."
              />
            </div>

            <div className="tsg-divider" />

            <h3 className="tsg-section-title" style={{ marginBottom: 0 }}>
              <FileText size={17} />
              Official PDF Header
            </h3>
            <p className="tsg-mini-note">
              These fields are optional and will appear in the official PDF header.
            </p>

            <div className="tsg-field">
              <label>Customer Name</label>
              <input
                value={filters.customerName}
                onChange={(event) => updateFilter("customerName", event.target.value)}
                placeholder="Example: ARAMCO"
              />
            </div>

            <div className="tsg-field">
              <label>PO Number</label>
              <input
                value={filters.poNumber}
                onChange={(event) => updateFilter("poNumber", event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="tsg-field">
              <label>Project Code</label>
              <input
                value={filters.projectCode}
                onChange={(event) => updateFilter("projectCode", event.target.value)}
                placeholder="Optional"
              />
            </div>

            <button
              type="button"
              className="tsg-btn primary"
              onClick={handleGenerate}
              disabled={loading}
            >
              <Search size={17} />
              Generate Report
            </button>

            <button
              type="button"
              className="tsg-btn official"
              onClick={handleOfficialPdf}
              disabled={pdfLoading || loading}
            >
              {pdfLoading ? <RefreshCcw size={17} /> : <Download size={17} />}
              {pdfLoading ? "Preparing PDF..." : "Download Official PDF"}
            </button>

            <button type="button" className="tsg-btn" onClick={handleReset}>
              <RefreshCcw size={17} />
              Reset
            </button>
          </div>

          {message ? (
            <div className={`tsg-alert ${messageType}`}>
              {message}
            </div>
          ) : null}
        </aside>

        <main className="tsg-content">
          <div className="tsg-kpis">
            <StatCard
              icon={Users}
              label="Employees"
              value={formatNumber(summary.totalEmployees)}
              hint={`GAS ${formatNumber(summary.gasEmployees)} / Rental ${formatNumber(summary.rentalEmployees)}`}
            />

            <StatCard
              icon={Clock3}
              label="Total Hours"
              value={formatNumber(summary.totalHours)}
              hint="Rounded hours"
            />

            <StatCard
              icon={CheckCircle2}
              label="Working Days"
              value={formatNumber(summary.workingDays)}
              hint="Present records"
            />

            <StatCard
              icon={AlertTriangle}
              label="Issues"
              value={formatNumber(Number(summary.absent || 0) + Number(summary.singlePunch || 0))}
              hint={`Absent ${formatNumber(summary.absent)} / SP ${formatNumber(summary.singlePunch)}`}
            />
          </div>

          <section className="tsg-panel tsg-report-panel">
            <div className="tsg-report-top">
              <div>
                <h2>Official Timesheet Preview</h2>
                <p>
                  {getMonthName(filters.month, filters.year)} · Generated by{" "}
                  {user?.name || user?.username || "System"}
                </p>
              </div>

              <div className="tsg-source-pill">
                <ShieldCheck size={15} />
                {filteredSourceLabel}
              </div>
            </div>

            {employees.length ? (
              <>
                <div className="tsg-table-wrap">
                  <table className="tsg-table">
                    <thead>
                      <tr>
                        <th className="employee-col">Employee</th>
                        <th>Type</th>
                        <th>Project</th>
                        <th>Package</th>
                        {days.map((day) => (
                          <th key={day.key}>{day.label}</th>
                        ))}
                        <th>Total</th>
                        <th>Work Days</th>
                        <th>A</th>
                        <th>SP</th>
                      </tr>
                    </thead>

                    <tbody>
                      {employees.map((employee) => (
                        <tr key={`${employee.employeeCode}-${employee.employeeName}`}>
                          <td className="employee-col">
                            <div className="tsg-employee-name">
                              <strong>{employee.employeeName || "-"}</strong>
                              <span>GAS ID: {employee.gasId || "-"}</span>
                            </div>
                          </td>

                          <td>{employee.employeeType || "-"}</td>
                          <td>{employee.project || "-"}</td>
                          <td>{employee.package || "-"}</td>

                          {safeArray(employee.cells).map((cell, index) => (
                            <td key={`${employee.employeeCode}-${days[index]?.key || index}`}>
                              <CellBadge cell={cell} />
                            </td>
                          ))}

                          <td>{formatNumber(employee.totalHours)}</td>
                          <td>{formatNumber(employee.workingDays)}</td>
                          <td>{formatNumber(employee.absent)}</td>
                          <td>{formatNumber(employee.singlePunch)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="tsg-signatures">
                  <div className="tsg-sign-box">
                    <strong>Prepared By</strong>
                    <span>Name / Signature</span>
                  </div>

                  <div className="tsg-sign-box">
                    <strong>Checked By</strong>
                    <span>Name / Signature</span>
                  </div>

                  <div className="tsg-sign-box">
                    <strong>Approved By</strong>
                    <span>Name / Signature</span>
                  </div>

                  <div className="tsg-sign-box">
                    <strong>Client Signature</strong>
                    <span>Name / Signature</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="tsg-empty">
                <CalendarDays size={42} />
                <h3>No report generated yet</h3>
                <p>Select filters, then click Generate Report.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
