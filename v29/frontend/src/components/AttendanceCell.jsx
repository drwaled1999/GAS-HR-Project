function getCellClass(val) {
  if (val === "A") return "bg-red-100 text-red-700 border-red-200";
  if (val === "SP") return "bg-orange-100 text-orange-700 border-orange-200";
  if (["V", "SL", "EL", "UL", "HL", "UM"].includes(val)) {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  if (["H", "NH", "W"].includes(val)) {
    return "bg-gray-200 text-gray-700 border-gray-300";
  }
  if (["BT", "TA", "M"].includes(val)) {
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }
  if (!Number.isNaN(Number(val))) {
    return "bg-green-50 text-green-700 border-green-200";
  }
  return "bg-white text-gray-700 border-gray-200";
}

export default function AttendanceCell({ value, onClick }) {
  const finalValue = value || "A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[48px] rounded border px-1 py-2 text-center text-sm font-medium transition hover:opacity-90 ${getCellClass(
        String(finalValue)
      )}`}
    >
      {finalValue}
    </button>
  );
}