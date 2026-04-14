import { useEffect, useState } from "react";
import axios from "axios";

export default function AttendancePage() {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    axios.get("/attendance/sheet?month=3&year=2026")
      .then(res => {
        setData(res.data.employees);
        setDays(res.data.days);
      });
  }, []);

  return (
    <table border="1">
      <thead>
        <tr>
          <th>Name</th>
          {[...Array(days)].map((_, i) => (
            <th key={i}>{i + 1}</th>
          ))}
        </tr>
      </thead>

      <tbody>
        {data.map((emp, i) => (
          <tr key={i}>
            <td>{emp.name}</td>

            {[...Array(days)].map((_, d) => {
              const val = emp.days[d + 1];

              let bg = "#f8d7da";
              if (val === "P") bg = "lightgreen";
              if (val === "SP") bg = "orange";

              return (
                <td key={d} style={{ background: bg }}>
                  {val || "A"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}