export default function WorkDaysInput({ workDays, setWorkDays }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label>출근 일수:</label>
      <input
        type="number"
        min={1}
        max={31}
        value={workDays}
        onChange={(e) => {
          const v = e.target.value;
          const n = v === "" ? 1 : Number(v);
          setWorkDays(Number.isFinite(n) ? Math.max(1, Math.min(31, n)) : 1);
        }}
        style={{ width: 60 }}
      />
      <span>일 / 월</span>
    </div>
  );
}
