import { buildPayrollSummaryRepo } from "../data/payrollRepository.js";

export async function buildPayrollSummary({ user, month, year }) {
  return buildPayrollSummaryRepo({ user, month, year });
}
