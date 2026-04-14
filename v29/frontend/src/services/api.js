export async function getAttendanceSheet({ month, year, batchId, employeeCode, employeeName, employeeView }) {
  try {
    const params = { month, year, batchId, employeeCode, employeeName, employeeView };
    const response = await api.get("/attendance/sheet", {
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
    const response = await api.post(`/attendance/row/${rowId}/override`, payload, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to update attendance row");
  }
}

export async function approveAttendanceBatch(batchId, payload) {
  try {
    const response = await api.post(`/attendance/approve/${batchId}`, payload, {
      headers: buildAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to approve attendance batch");
  }
}
