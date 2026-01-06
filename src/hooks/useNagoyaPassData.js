import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getZoneByKm,
  calcRegularMonthlyCost,
  calcCommuterPassCost,
  calcBreakEvenDays,
} from "../utils/fare";
import {
  buildNeighborGraph,
  dijkstraPath,
  isValidPassCandidate,
  compareRoutesForRecommend,
  getTransferStationIndexSet,
} from "../utils/route";

function buildStationMetaMap(meta) {
  const map = new Map();
  if (!meta) return map;
  for (const s of meta.stations) map.set(s.name, s);
  return map;
}

function buildStationsByLine({ dist, meta, stationMetaMap }) {
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

        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        return a.localeCompare(b, "ja");
      });

    result[lineId] = filtered;
  }

  return result;
}

function computeFareResult({ fares, km, workDays }) {
  if (!fares || km == null) return null;

  return {
    regular: calcRegularMonthlyCost({ km, days: workDays, fares }),
    commuter1: calcCommuterPassCost({ km, months: 1, fares }),
    commuter3: calcCommuterPassCost({ km, months: 3, fares }),
    commuter6: calcCommuterPassCost({ km, months: 6, fares }),
  };
}

function computePassAnalysis({ fares, fareResult, km, workDays }) {
  if (!fares || !fareResult || km == null) return null;

  const be1 = calcBreakEvenDays({ km, months: 1, fares });
  const be3 = calcBreakEvenDays({ km, months: 3, fares });
  const be6 = calcBreakEvenDays({ km, months: 6, fares });

  const daily = be1.daily;

  const analyze = (months, passPrice, breakEvenDaysTotal) => {
    const actualDaysTotal = workDays * months;
    const icCost = daily * actualDaysTotal;

    const diff = icCost - passPrice; // +면 정기권 이득
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
    arr.sort((a, b) => a.diffYen - b.diffYen);
    return { type: "ic", months: arr[0].months, yen: arr[0].diffYen };
  })();

  return { daily, m1, m3, m6, best };
}

function computeBestExtendedPass({ fares, route, graph, dist }) {
  if (!fares || !route || !graph || !dist) return null;

  const myZone = getZoneByKm(route.km, fares.distanceZones);
  const myPassPrice = fares.commuterPass["1"][String(myZone)];

  const stations = dist.stations ?? [];
  let best = null;

  for (let a = 0; a < stations.length; a++) {
    for (let b = a + 1; b < stations.length; b++) {
      const u = stations[a];
      const v = stations[b];

      const passRoute = dijkstraPath(graph, u, v);
      if (passRoute.km == null) continue;

      const zone = getZoneByKm(passRoute.km, fares.distanceZones);
      const price = fares.commuterPass["1"][String(zone)];

      if (price !== myPassPrice) continue;
      if (!isValidPassCandidate(passRoute, route)) continue;

      if (!best || compareRoutesForRecommend(passRoute, best.passRoute) < 0) {
        best = { from: u, to: v, zone, price, passRoute };
      }
    }
  }

  if (!best) return null;

  const extraStations = Math.max(
    0,
    best.passRoute.path.length - route.path.length
  );

  return {
    from: best.from,
    to: best.to,
    km: best.passRoute.km,
    path: best.passRoute.path,
    segments: best.passRoute.segments,
    zone: best.zone,
    price: best.price,
    extraStations,
    myZone,
    myPassPrice,
  };
}

export function useNagoyaPassData() {
  const [dist, setDist] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fares, setFares] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}distances.json`),
      fetch(`${import.meta.env.BASE_URL}stations-meta.json`),
      fetch(`${import.meta.env.BASE_URL}fares.json`),
    ])
      .then(async ([a, b, c]) => [
        await a.json(),
        await b.json(),
        await c.json(),
      ])
      .then(([distJson, metaJson, faresJson]) => {
        setDist(distJson);
        setMeta(metaJson);
        setFares(faresJson);
      });
  }, []);

  const stationMetaMap = useMemo(() => buildStationMetaMap(meta), [meta]);

  const stationsByLine = useMemo(
    () => buildStationsByLine({ dist, meta, stationMetaMap }),
    [dist, meta, stationMetaMap]
  );

  const graph = useMemo(() => {
    if (!dist || !meta) return null;
    return buildNeighborGraph({ dist, meta });
  }, [dist, meta]);

  const computeRoute = useCallback(
    (from, to) => {
      if (!graph || !from || !to) return null;
      const r = dijkstraPath(graph, from, to);
      if (r.km == null) return null;
      return r;
    },
    [graph]
  );

  const computeDerived = useCallback(
    ({ from, to, workDays }) => {
      const route = computeRoute(from, to);
      const km = route?.km ?? null;

      const fareResult = computeFareResult({ fares, km, workDays });
      const passAnalysis = computePassAnalysis({
        fares,
        fareResult,
        km,
        workDays,
      });

      const bestExtendedPass = computeBestExtendedPass({
        fares,
        route,
        graph,
        dist,
      });

      const myTransferSet = route
        ? getTransferStationIndexSet(route)
        : new Set();
      const passTransferSet = bestExtendedPass
        ? getTransferStationIndexSet({
            path: bestExtendedPass.path,
            segments: bestExtendedPass.segments,
          })
        : new Set();

      return {
        route,
        km,
        fareResult,
        passAnalysis,
        bestExtendedPass,
        myTransferSet,
        passTransferSet,
      };
    },
    [computeRoute, fares, graph, dist]
  );

  return { dist, meta, fares, stationsByLine, computeDerived };
}
