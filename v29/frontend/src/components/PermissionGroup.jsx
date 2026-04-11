export default function PermissionGroup({ title, items, selected = [], onToggle }) {
  return (
    <section className="permission-section">
      <div className="permission-section-header">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <div className="permission-grid">
        {items.map((item) => (
          <label key={item.key} className="checkbox-row permission-pill">
            <input
              type="checkbox"
              checked={selected.includes(item.key)}
              onChange={() => onToggle(item.key)}
            />
            <div>
              <span>{item.label}</span>
              {item.help && <small className="muted block-help">{item.help}</small>}
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
