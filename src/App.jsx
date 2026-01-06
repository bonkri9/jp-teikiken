import { useEffect, useMemo, useState } from "react";
import { formatKm } from "./utils/format";
import { countTransfers } from "./utils/route";
import { useNagoyaPassData } from "./hooks/useNagoyaPassData";

export default function App() {
  const { dist, meta, fares, stationsByLine, computeDerived } =
    useNagoyaPassData();

  const [fromLine, setFromLine] = useState("ALL");
  const [toLine, setToLine] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workDays, setWorkDays] = useState(20);
  const [isMyPathOpen, setIsMyPathOpen] = useState(false);
  const [isPassPathOpen, setIsPassPathOpen] = useState(false);

  // 초기 from/to 세팅 (dist 로드 후)
  useEffect(() => {
    if (!dist) return;
    const stations = dist.stations ?? [];
    setFrom((prev) => prev || stations[0] || "");
    setTo((prev) => prev || stations[1] || stations[0] || "");
  }, [dist]);

  // 노선 변경 시 역 보정
  useEffect(() => {
    const list = stationsByLine[fromLine] ?? [];
    if (list.length && from && !list.includes(from)) setFrom(list[0]);
    if (list.length && !from) setFrom(list[0] ?? "");
  }, [fromLine, stationsByLine, from]);

  useEffect(() => {
    const list = stationsByLine[toLine] ?? [];
    if (list.length && to && !list.includes(to)) setTo(list[0]);
    if (list.length && !to) setTo(list[0] ?? "");
  }, [toLine, stationsByLine, to]);

  const derived = useMemo(
    () => computeDerived({ from, to, workDays }),
    [computeDerived, from, to, workDays]
  );

  const {
    route,
    km,
    fareResult,
    passAnalysis,
    bestExtendedPass,
    myTransferSet,
    passTransferSet,
  } = derived ?? {};

  useEffect(() => {
    setIsPassPathOpen(false);
    setIsMyPathOpen(false);
  }, [from, to, fromLine, toLine]);

  if (!dist || !meta) return <div style={{ padding: 24 }}>loading...</div>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>名古屋 定期券ナビ</h1>

      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        {/* 출발 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 1fr",
            gap: 10,
          }}
        >
          <div>출발</div>

          <select
            value={fromLine}
            onChange={(e) => setFromLine(e.target.value)}
          >
            <option value="ALL">全体</option>
            {meta.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {(stationsByLine[fromLine] ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* 도착 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 1fr",
            gap: 10,
          }}
        >
          <div>도착</div>

          <select value={toLine} onChange={(e) => setToLine(e.target.value)}>
            <option value="ALL">全体</option>
            {meta.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {(stationsByLine[toLine] ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* 결과 */}
        <div style={{ marginTop: 8 }}>
          {km == null ? (
            <p>거리 데이터를 찾지 못했어</p>
          ) : (
            <p>
              영업 거리: <b>{formatKm(km)}</b> km
            </p>
          )}
        </div>
        {/* 내 구간 경로(아코디언) */}
        {route && (
          <div style={{ marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setIsMyPathOpen((v) => !v)}
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
              {isMyPathOpen ? "내 구간 경로 접기 ▲" : "내 구간 경로 보기 ▼"}
            </button>

            {isMyPathOpen && (
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
                  내 구간 경로(총 {route.path.length}역)
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                  커버 거리: {formatKm(route.km)} km / 환승:{" "}
                  {countTransfers(route.segments)}회
                </div>

                <div style={{ lineHeight: 1.7 }}>
                  {route.path.map((s, idx) => {
                    const isTransfer = myTransferSet.has(idx);
                    const isEnd = idx === route.path.length - 1;

                    return (
                      <span key={`${s}-${idx}`}>
                        <span
                          style={
                            isTransfer
                              ? {
                                  fontWeight: 800,
                                  textDecoration: "underline",
                                }
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
        )}

        {/* 출근 일수 입력 */}
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
              setWorkDays(
                Number.isFinite(n) ? Math.max(1, Math.min(31, n)) : 1
              );
            }}
            style={{ width: 60 }}
          />
          <span>일 / 월</span>
        </div>

        {fareResult && km != null && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <h3 style={{ margin: "0 0 8px" }}>요금 비교 (성인 · 통근)</h3>

            <div style={{ display: "grid", gap: 6 }}>
              <div>
                구간: <b>{fareResult.regular.zone}区</b> / 편도:{" "}
                <b>{fareResult.regular.oneWay.toLocaleString()}円</b>
              </div>

              <div>
                IC카드 월 비용({workDays}일):{" "}
                <b>{fareResult.regular.monthly.toLocaleString()}円</b>
              </div>

              <div>
                통근정기 1개월:{" "}
                <b>{fareResult.commuter1.price.toLocaleString()}円</b>
              </div>
              <div>
                통근정기 3개월:{" "}
                <b>{fareResult.commuter3.price.toLocaleString()}円</b>
              </div>
              <div>
                통근정기 6개월:{" "}
                <b>{fareResult.commuter6.price.toLocaleString()}円</b>
              </div>
            </div>
          </div>
        )}

        {passAnalysis && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              출근 일수({workDays}일) 기준 결론
            </div>

            {passAnalysis.best && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                {passAnalysis.best.type === "pass" ? (
                  <>
                    <div style={{ fontWeight: 800 }}>
                      추천: 1/3/6 중 가장 이득인 옵션은{" "}
                      {passAnalysis.best.months} 개월 (이득{" "}
                      {passAnalysis.best.yen.toLocaleString()}円)
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      현재 출근일수 기준으로 정기권을 사는 것이 합리적입니다.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800 }}>
                      현재 출근일수 기준, 정기권을 사지 않는 것이 합리적입니다.
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      참고: 가장 덜 손해인 정기권은 {passAnalysis.best.months}{" "}
                      개월이며, {passAnalysis.best.yen.toLocaleString()}円
                      손해입니다.
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {[
                { label: "1개월", data: passAnalysis.m1 },
                { label: "3개월", data: passAnalysis.m3 },
                { label: "6개월", data: passAnalysis.m6 },
              ].map(({ label, data }) => (
                <div
                  key={label}
                  style={{
                    padding: 10,
                    border: "1px solid #eee",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    통근정기 {label}
                  </div>

                  {data.status === "pass_better" ? (
                    <>
                      <div>
                        정기권이 <b>{data.diffYen.toLocaleString()}円</b> 이득
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        손익분기({label})는 {data.breakEvenDays}일 이상이며,
                        현재는 {data.extraDaysBeyondBreakEven}일 더 탑승한 상태
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        IC카드가 <b>{data.diffYen.toLocaleString()}円</b> 이득
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        정기권이 이득이 되려면 최소 {data.breakEvenDays}일 이상
                        필요. 지금 기준으로는 {data.moreDaysToBreakEven}일 더
                        탑승해야 본전
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    (실제탑승 {workDays * data.months}일)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {bestExtendedPass && (
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
              추천 구간: <b>{bestExtendedPass.from}</b> -{" "}
              <b>{bestExtendedPass.to}</b>
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
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setIsPassPathOpen((v) => !v)}
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
                {isPassPathOpen ? "경로 접기 ▲" : "경로 보기 ▼"}
              </button>

              {isPassPathOpen && (
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
                    경로(총 {bestExtendedPass.path.length}역)
                  </div>

                  <div style={{ lineHeight: 1.7 }}>
                    {bestExtendedPass.path.map((s, idx) => {
                      const isTransfer = passTransferSet.has(idx);
                      const isEnd = idx === bestExtendedPass.path.length - 1;

                      return (
                        <span key={`${s}-${idx}`}>
                          <span
                            style={
                              isTransfer
                                ? {
                                    fontWeight: 800,
                                    textDecoration: "underline",
                                  }
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
          </div>
        )}

        <p style={{ fontSize: 12, opacity: 0.7 }}>
          stations={dist.stations.length}, edges={dist.edges.length}
        </p>
      </div>
    </div>
  );
}
