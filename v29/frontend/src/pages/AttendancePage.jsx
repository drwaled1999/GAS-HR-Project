import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://gas-hr-project.onrender.com"; // غيره لو عندك دومين ثاني

export default function AttendancePage() {
  const [file, setFile] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // =========================
  // رفع ملف البصمة
  // =========================
  const uploadFile = async () => {
    if (!file) return alert("اختر ملف");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const res = await axios.post(`${API}/attendance/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setBatchId(res.data.importBatchId);
      alert("تم رفع الملف ✅");

    } catch (err) {
      console.error(err);
      alert("فشل رفع الملف");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // جلب البيانات بعد الرفع
  // =========================
  const loadBatch = async () => {
    if (!batchId) return;

    try {
      const res = await axios.get(`${API}/attendance/imports/${batchId}`);
      setRows(res.data.rows);
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // اعتماد البيانات
  // =========================
  const approve = async () => {
    if (!batchId) return;

    try {
      await axios.post(`${API}/attendance/imports/${batchId}/approve`, {
        onlyMatched: true,
      });

      alert("تم الاعتماد ✅");
      loadMonthly();

    } catch (err) {
      console.error(err);
      alert("فشل الاعتماد");
    }
  };

  // =========================
  // جلب الاتندنس الشهري
  // =========================
  const loadMonthly = async () => {
    try {
      const res = await axios.get(`${API}/attendance/monthly`, {
        params: { month, year },
      });

      setRows(res.data.rows);
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // تعديل سجل يدوي
  // =========================
  const updateRow = async (row) => {
    try {
      await axios.post(`${API}/attendance/adjust`, {
        employeeId: row.employee_id,
        workDate: row.work_date,
        status: row.status,
        hours: row.hours,
      });

      alert("تم التعديل");
      loadMonthly();
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // تصدير Excel
  // =========================
  const exportExcel = () => {
    window.open(
      `${API}/attendance/export?month=${month}&year=${year}`,
      "_blank"
    );
  };

  useEffect(() => {
    if (batchId) loadBatch();
  }, [batchId]);

  return (
    <div style={{ padding: 20 }}>
      <h2>📊 Attendance System</h2>

      {/* رفع ملف */}
      <div style={{ marginBottom: 20 }}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={uploadFile} disabled={loading}>
          Upload
        </button>

        <button onClick={approve} style={{ marginLeft: 10 }}>
          Approve
        </button>
      </div>

      {/* اختيار الشهر */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="number"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="Month"
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Year"
        />

        <button onClick={loadMonthly}>Load</button>
        <button onClick={exportExcel} style={{ marginLeft: 10 }}>
          Export Excel
        </button>
      </div>

      {/* الجدول */}
      <table border="1" cellPadding="8" width="100%">
        <thead>
          <tr>
            <th>GAS ID</th>
            <th>Name</th>
            <th>Date</th>
            <th>Status</th>
            <th>Hours</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.gas_id || row.user_id_value}</td>
              <td>{row.full_name || row.employee_name}</td>
              <td>{row.work_date}</td>

              <td>
                <input
                  value={row.status || ""}
                  onChange={(e) =>
                    (row.status = e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  value={row.hours || ""}
                  onChange={(e) =>
                    (row.hours = e.target.value)
                  }
                />
              </td>

              <td>
                <button onClick={() => updateRow(row)}>Update</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}