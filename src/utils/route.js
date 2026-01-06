export function buildNeighborGraph({ dist, meta }) {
  const kmMap = new Map();
  for (const e of dist.edges) {
    const a = e.from;
    const b = e.to;
    const key1 = `${a}__${b}`;
    const key2 = `${b}__${a}`;
    kmMap.set(key1, e.km);
    kmMap.set(key2, e.km);
  }

  const adj = new Map();
  const addEdge = (a, b, km, lineId) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, km, lineId });
    adj.get(b).push({ to: a, km, lineId });
  };

  const stationMeta = new Map(meta.stations.map((s) => [s.name, s]));

  for (const line of meta.lines) {
    const lineId = line.id;

    const lineStations = meta.stations
      .filter((s) => s.orders && s.orders[lineId] != null)
      .sort((a, b) => a.orders[lineId] - b.orders[lineId])
      .map((s) => s.name);

    for (let i = 0; i < lineStations.length - 1; i++) {
      const a = lineStations[i];
      const b = lineStations[i + 1];
      const km = kmMap.get(`${a}__${b}`);
      if (km == null) {
        continue;
      }
      addEdge(a, b, km, lineId);
    }
  }

  return adj;
}

export function dijkstraPath(adj, start, goal) {
  if (start === goal) return { km: 0, path: [start], segments: [] };

  const dist = new Map();
  const prev = new Map(); // to -> { node: prevNode, edge: {from,to,km,lineId} }
  const visited = new Set();

  const pq = [{ node: start, d: 0 }];
  dist.set(start, 0);

  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { node, d } = pq.shift();

    if (visited.has(node)) continue;
    visited.add(node);

    if (node === goal) break;

    const edges = adj.get(node) ?? [];
    for (const { to, km, lineId } of edges) {
      const nd = d + km;
      const cur = dist.get(to);
      if (cur == null || nd < cur) {
        dist.set(to, nd);
        prev.set(to, { node, edge: { from: node, to, km, lineId } });
        pq.push({ node: to, d: nd });
      }
    }
  }

  const best = dist.get(goal);
  if (best == null) return { km: null, path: [], segments: [] };

  // 경로 복원
  const path = [];
  const segments = [];

  let cur = goal;
  while (cur !== start) {
    const p = prev.get(cur);
    if (!p) return { km: null, path: [], segments: [] };
    path.push(cur);
    segments.push(p.edge);
    cur = p.node;
  }
  path.push(start);

  path.reverse();
  segments.reverse();

  return { km: best, path, segments };
}

export function pathIncludesSegment(path, from, to) {
  const i = path.indexOf(from);
  const j = path.indexOf(to);
  if (i === -1 || j === -1) return false;
  return i <= j;
}

export function pathIncludesSubpath(outerPath, innerPath) {
  if (innerPath.length === 0) return false;
  const first = innerPath[0];
  for (let start = 0; start <= outerPath.length - innerPath.length; start++) {
    if (outerPath[start] !== first) continue;
    let ok = true;
    for (let k = 1; k < innerPath.length; k++) {
      if (outerPath[start + k] !== innerPath[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function countTransfers(segments) {
  if (!segments?.length) return 0;

  let transfers = 0;
  let cur = segments[0].lineId ?? null;

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i].lineId ?? null;
    if (cur !== null && next !== null && next !== cur) transfers++;
    cur = next;
  }
  return transfers;
}

export function summarizeRoute(route) {
  if (!route || route.km == null) {
    return {
      km: -Infinity,
      transfers: Infinity,
      stations: 0,
    };
  }

  return {
    km: route.km, // 커버 km
    transfers: countTransfers(route.segments), // 환승 횟수
    stations: route.path.length, // 역 개수
  };
}

export function compareRoutesForRecommend(a, b) {
  const A = summarizeRoute(a);
  const B = summarizeRoute(b);

  // 1. 커버 km (내림차순)
  if (A.km !== B.km) return B.km - A.km;

  // 2. 환승 횟수 (오름차순)
  if (A.transfers !== B.transfers) return A.transfers - B.transfers;

  // 3. 역 개수 (내림차순)
  if (A.stations !== B.stations) return B.stations - A.stations;

  return 0;
}

export function isValidPassCandidate(passRoute, myRoute) {
  if (!passRoute || !myRoute) return false;
  return pathIncludesSubpath(passRoute.path, myRoute.path);
}

// 환승역 인덱스 Set 반환 (path에서 강조할 위치)
export function getTransferStationIndexSet(route) {
  const set = new Set();
  if (!route?.segments?.length || !route?.path?.length) return set;

  for (let i = 1; i < route.segments.length; i++) {
    const prev = route.segments[i - 1]?.lineId ?? null;
    const cur = route.segments[i]?.lineId ?? null;

    // lineId가 둘 다 있고, 바뀌면 환승으로 간주
    if (prev && cur && prev !== cur) {
      // segments[i]는 path[i] -> path[i+1] 구간이므로 환승역은 path[i]
      set.add(i);
    }
  }
  return set;
}

// 특정 index가 환승역인지 바로 체크
export function isTransferStation(route, pathIndex) {
  if (!route?.segments?.length) return false;
  if (pathIndex <= 0 || pathIndex >= route.segments.length) return false;

  const prev = route.segments[pathIndex - 1]?.lineId ?? null;
  const cur = route.segments[pathIndex]?.lineId ?? null;
  return !!prev && !!cur && prev !== cur;
}
