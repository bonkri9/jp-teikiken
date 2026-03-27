import { formatKm } from "../utils/format";
import { countTransfers } from "../utils/route";

export default function RouteAccordion({
  titleClosed,
  titleOpen,
  isOpen,
  onToggle,
  routeLike, // { path, km, segments }
  transferSet, // Set<number>
}) {
  if (!routeLike) return null;

  const { path, km, segments } = routeLike;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          padding: "6px 10px",
          border: "1px solid #ccc",
          borderRadius: 6,
          background: "#fff",
          cursor: "pointer",
          fontSize: 12,
          color: "black",
        }}
      >
        {isOpen ? titleOpen : titleClosed}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 8,
            background: "#fafafa",
            color: "black",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
            경로(총 {path.length}역)
          </div>

          {km != null && (
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
              커버 거리: {formatKm(km)} km / 환승: {countTransfers(segments)}회
            </div>
          )}

          <div style={{ lineHeight: 1.7 }}>
            {path.map((s, idx) => {
              const isTransfer = transferSet?.has(idx);
              const isEnd = idx === path.length - 1;

              return (
                <span key={`${s}-${idx}`}>
                  <span
                    style={
                      isTransfer
                        ? { fontWeight: 800, textDecoration: "underline" }
                        : undefined
                    }
                  >
                    {s}
                  </span>

                  {isTransfer && (
                    <span
                      style={{
                        marginLeft: 6,
                        padding: "1px 6px",
                        borderRadius: 999,
                        border: "1px solid #ddd",
                        fontSize: 11,
                        opacity: 0.9,
                      }}
                    >
                      환승
                    </span>
                  )}

                  {!isEnd ? " → " : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
