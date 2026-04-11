export default function AttendanceCell({ cell, onClick }) {
  const value = cell?.value;
  let className = 'cell';
  if (value === 'Absent') className += ' cell-absent';
  else if (value === 'Single Punch') className += ' cell-single';
  else if (typeof value === 'string' && value !== 'Present') className += ' cell-status';
  else className += ' cell-hours';
  if (cell?.isModified) className += ' cell-modified';

  return (
    <td className={className} onClick={onClick} title={cell?.note || ''}>
      <div className="attendance-cell-content">
        <span>{value}</span>
        {cell?.isModified ? <small>✏️</small> : null}
      </div>
    </td>
  );
}
