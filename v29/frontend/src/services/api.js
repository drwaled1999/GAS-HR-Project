export async function uploadAttendanceFile(file, month, year, username) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("month", String(month));
    formData.append("year", String(year));
    formData.append("username", String(username || "system"));

    const response = await api.post("/api/attendance/upload", formData, {
      headers: buildAuthHeaders({
        "Content-Type": "multipart/form-data",
      }),
      timeout: 120000,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to upload attendance CSV");
  }
}

export async function getAttendanceSheet({
  month,
  year,
  batchId,
  employeeCode,
  employeeName,
  employeeView,
}) {
  try {
    const params = {};

    if (month !== undefined && month !== null && month !== "") {
      params.month = month;
    }

    if (year !== undefined && year !== null && year !== "") {
      params.year = year;
    }

    if (batchId) {
      params.batchId = batchId;
    }

    if (employeeCode) {
      params.employeeCode = employeeCode;
    }

    if (employeeName) {
      params.employeeName = employeeName;
    }

    if (employeeView !== undefined) {
      params.employeeView = employeeView;
    }

    const response = await api.get("/api/attendance/sheet", {
      headers: buildAuthHeaders(),
      params,
    });

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to load attendance sheet");
  }
}

export async function updateAttendanceImportRow(rowId, payload) {
  try {
    const response = await api.post(
      `/api/attendance/row/${rowId}/override`,
      payload,
      {
        headers: buildAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update attendance row");
  }
}

export async function approveAttendanceBatch(batchId, payload) {
  try {
    const response = await api.post(
      `/api/attendance/approve/${batchId}`,
      payload,
      {
        headers: buildAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to approve attendance batch");
  }
}
