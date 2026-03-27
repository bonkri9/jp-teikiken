export default function StationPickerRow({
  label,
  lineValue,
  onLineChange,
  stationValue,
  onStationChange,
  lines,
  stations,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 1fr",
        gap: 10,
      }}
    >
      <div>{label}</div>

      <select value={lineValue} onChange={(e) => onLineChange(e.target.value)}>
        <option value="ALL">全体</option>
        {lines.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        value={stationValue}
        onChange={(e) => onStationChange(e.target.value)}
      >
        {(stations ?? []).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
