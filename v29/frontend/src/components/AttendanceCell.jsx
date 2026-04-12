function getCellClass(val) {
  if (val === "A") return "bg-white text-red-700";
  if (val === "SP") return "bg-orange-300 text-slate-900";
  if (["V", "SL", "EL", "UL", "HL", "UM"].includes(val)) return "bg-blue-100 text-blue-700";
  if (["H", "NH", "W"].includes(val)) return "bg-gray-200 text-gray-700";
  if (["BT", "TA", "M"].includes(val)) return "bg-yellow-100 text-yellow-700";
  if (!Number.isNaN(Number(val))) return "bg-white text-slate-900";
  return "bg-white text-slate-900";
}

export default function AttendanceCell({ value, onClick }) {
  const finalValue = value || "A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full min-h-[72px] w-full px-2 py-4 text-center text-3xl font-bold transition hover:bg-slate-50 ${getCellClass(
        String(finalValue)
      )}`}
    >
      {finalValue}
    </button>
  );
}