import { formatKm } from "../utils/format";
import { countTransfers } from "../utils/route";
import RouteAccordion from "./routeAccordion";

export default function PassExtensionCard({
  bestExtendedPass,
  isOpen,
  onToggle,
  passTransferSet,
}) {
  if (!bestExtendedPass) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        같은 가격으로 더 넓게 커버하는 정기권(1개월 기준)
      </div>

      <div>
        추천 구간: <b>{bestExtendedPass.from}</b> - <b>{bestExtendedPass.to}</b>
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        가격: {bestExtendedPass.myPassPrice.toLocaleString()}円 (구간{" "}
        {bestExtendedPass.myZone}区 동일)
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        커버 경로 역 수: {bestExtendedPass.path.length}개
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {bestExtendedPass.extraStations > 0
          ? `내 구간 대비 추가 커버: ${bestExtendedPass.extraStations}역`
          : "내 구간 그대로가 가장 효율적인 정기권 구간입니다"}
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        커버 거리: {formatKm(bestExtendedPass.km)} km / 환승:{" "}
        {countTransfers(bestExtendedPass.segments)}회
      </div>

      <RouteAccordion
        titleClosed="경로 보기 ▼"
        titleOpen="경로 접기 ▲"
        isOpen={isOpen}
        onToggle={onToggle}
        routeLike={{
          path: bestExtendedPass.path,
          km: bestExtendedPass.km,
          segments: bestExtendedPass.segments,
        }}
        transferSet={passTransferSet}
      />
    </div>
  );
}
