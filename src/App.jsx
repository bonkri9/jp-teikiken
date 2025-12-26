import { useEffect, useMemo, useState } from "react";
import { formatKm } from "./utils/format";
import {
  getZoneByKm,
  calcRegularMonthlyCost,
  calcCommuterPassCost,
  calcBreakEvenDays,
} from "./utils/fare";

export default function App() {
  const [dist, setDist] = useState(null); // distances.json
  const [meta, setMeta] = useState(null); // stations-meta.json

  const [fromLine, setFromLine] = useState("ALL");
  const [toLine, setToLine] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workDays, setWorkDays] = useState(20);

  // 데이터 로드
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}distances.json`),
      fetch(`${import.meta.env.BASE_URL}stations-meta.json`),
    ])
      .then(async ([a, b]) => [await a.json(), await b.json()])
      .then(([distJson, metaJson]) => {
        setDist(distJson);
        setMeta(metaJson);

        const stations = distJson.stations ?? [];
        setFrom(stations[0] ?? "");
        setTo(stations[1] ?? stations[0] ?? "");
      });
  }, []);

  // station name -> meta 매핑
  const stationMetaMap = useMemo(() => {
    const map = new Map();
    if (!meta) return map;
    for (const s of meta.stations) {
      map.set(s.name, s);
    }
    return map;
  }, [meta]);

  // 노선별 역 목록 (order 기준 정렬)
  const stationsByLine = useMemo(() => {
    if (!dist || !meta) return { ALL: [] };

    const allStations = dist.stations ?? [];
    const result = { ALL: [...allStations] };

    for (const line of meta.lines) {
      const lineId = line.id;

      const filtered = allStations
        .filter((name) => {
          const m = stationMetaMap.get(name);
          return m?.lines?.includes(lineId);
        })
        .sort((a, b) => {
          const ma = stationMetaMap.get(a);
          const mb = stationMetaMap.get(b);

          const oa = ma?.orders?.[lineId];
          const ob = mb?.orders?.[lineId];

          // 둘 다 order 있으면 order 기준
          if (oa != null && ob != null) return oa - ob;
          // 하나만 있으면 있는 쪽 우선
          if (oa != null) return -1;
          if (ob != null) return 1;
          // 둘 다 없으면 이름순
          return a.localeCompare(b, "ja");
        });

      result[lineId] = filtered;
    }

    return result;
  }, [dist, meta, stationMetaMap]);

  // 노선 변경 시 역 보정
  useEffect(() => {
    const list = stationsByLine[fromLine] ?? [];
    if (list.length && !list.includes(from)) {
      setFrom(list[0]);
    }
  }, [fromLine, stationsByLine]); // eslint-disable-line

  useEffect(() => {
    const list = stationsByLine[toLine] ?? [];
    if (list.length && !list.includes(to)) {
      setTo(list[0]);
    }
  }, [toLine, stationsByLine]); // eslint-disable-line

  // 최소 거리 계산
  const km = useMemo(() => {
    if (!dist || !from || !to) return null;

    let best = Infinity;
    for (const e of dist.edges) {
      if (
        (e.from === from && e.to === to) ||
        (e.from === to && e.to === from)
      ) {
        if (e.km < best) best = e.km;
      }
    }
    return Number.isFinite(best) ? best : null;
  }, [dist, from, to]);

  // fares.json 로드
  const [fares, setFares] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}fares.json`)
      .then((r) => r.json())
      .then(setFares);
  }, []);

  // 비용 계산 결과
  const fareResult = useMemo(() => {
    if (!fares || km == null) return null;

    return {
      regular: calcRegularMonthlyCost({
        km,
        days: workDays,
        fares,
      }),
      commuter1: calcCommuterPassCost({
        km,
        months: 1,
        fares,
      }),
      commuter3: calcCommuterPassCost({
        km,
        months: 3,
        fares,
      }),
      commuter6: calcCommuterPassCost({
        km,
        months: 6,
        fares,
      }),
    };
  }, [fares, km, workDays]);

  const passAnalysis = useMemo(() => {
    if (!fares || !fareResult || km == null) return null;

    const be1 = calcBreakEvenDays({ km, months: 1, fares });
    const be3 = calcBreakEvenDays({ km, months: 3, fares });
    const be6 = calcBreakEvenDays({ km, months: 6, fares });

    const daily = be1.daily;

    const analyze = (months, passPrice, breakEvenDaysTotal) => {
      const actualDaysTotal = workDays * months;
      const icCost = daily * actualDaysTotal;

      const diff = icCost - passPrice; // 양수면 정기권이 이득

      if (diff >= 0) {
        return {
          months,
          status: "pass_better",
          diffYen: diff,
          breakEvenDays: breakEvenDaysTotal,
          extraDaysBeyondBreakEven: Math.max(
            0,
            actualDaysTotal - breakEvenDaysTotal
          ),
          moreDaysToBreakEven: 0,
        };
      }

      return {
        months,
        status: "ic_better",
        diffYen: -diff,
        breakEvenDays: breakEvenDaysTotal,
        moreDaysToBreakEven: Math.max(0, breakEvenDaysTotal - actualDaysTotal),
        extraDaysBeyondBreakEven: 0,
      };
    };

    const m1 = analyze(1, fareResult.commuter1.price, be1.days);
    const m3 = analyze(3, fareResult.commuter3.price, be3.days);
    const m6 = analyze(6, fareResult.commuter6.price, be6.days);

    // 추천 계산 (중복 없이 m1/m3/m6만 사용)
    const best = (() => {
      const arr = [m1, m3, m6];

      const passBetter = arr.filter((x) => x.status === "pass_better");
      if (passBetter.length > 0) {
        passBetter.sort((a, b) => b.diffYen - a.diffYen);
        return {
          type: "pass",
          months: passBetter[0].months,
          yen: passBetter[0].diffYen,
        };
      }

      // 정기권이 전부 손해면: "정기권을 사지 않는 것" 추천
      // 참고용으로 "가장 덜 손해" 정기권도 함께 제공
      arr.sort((a, b) => a.diffYen - b.diffYen);
      return { type: "ic", months: arr[0].months, yen: arr[0].diffYen };
    })();

    return { daily, m1, m3, m6, best };
  }, [fares, fareResult, km, workDays]);

  if (!dist || !meta) {
    return <div style={{ padding: 24 }}>loading...</div>;
  }

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

        {fares && fareResult && km != null && (
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

        <p style={{ fontSize: 12, opacity: 0.7 }}>
          stations={dist.stations.length}, edges={dist.edges.length}
        </p>
      </div>
    </div>
  );
}
