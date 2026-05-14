export function calculateAttendanceDisciplineScore(stats = {}) {
  const absentDays = Number(stats.absent_days || 0);
  const singlePunchDays = Number(stats.single_punch_days || 0);
  const lowHoursDays = Number(stats.low_hours_days || 0);
  const warnings = Number(stats.warning_count || 0);

  let score = 100;

  score -= absentDays * 8;
  score -= singlePunchDays * 3;
  score -= lowHoursDays * 2;
  score -= warnings * 10;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
}

export function calculatePunctualityScore(stats = {}) {
  const lateCount = Number(stats.late_count || 0);

  let score = 100;

  score -= lateCount * 5;

  if (score < 0) score = 0;

  return Math.round(score);
}

export function calculateOverallAutoScore(stats = {}) {
  const discipline = calculateAttendanceDisciplineScore(stats);
  const punctuality = calculatePunctualityScore(stats);

  return {
    discipline,
    punctuality,
    overall: Math.round((discipline + punctuality) / 2),
  };
}
