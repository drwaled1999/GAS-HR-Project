function getCellClass(val) {
  const value = String(val || "").trim().toUpperCase();

  if (value === "A") return "bg-white text-red-700";
  if (value === "SP") return "bg-orange-300 text-slate-900";

  if (["AL", "SL", "EL", "UL", "V"].includes(value)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["H", "NH", "W"].includes(value)) {
    return "bg-gray-200 text-gray-700";
  }

  if (["BT", "TA", "TK", "PM", "M"].includes(value)) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (value !== "" && !Number.isNaN(Number(value))) {
    return "bg-white text-slate-900";
  }

  return "bg-white text-slate-500";
}

export default function AttendanceCell({ value, onClick }) {
  const normalizedValue =
    value === null || value === undefined || String(value).trim() === ""
      ? "-"
      : String(value);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full min-h-[72px] w-full px-2 py-4 text-center text-3xl font-bold transition hover:bg-slate-50 ${getCellClass(
        normalizedValue
      )}`}
    >
      {normalizedValue}
    </button>
  );
}