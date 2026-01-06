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
  const addEdge = (a, b, km) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, km });
    adj.get(b).push({ to: a, km });
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
      addEdge(a, b, km);
    }
  }

  return adj;
}

export function dijkstraPath(adj, start, goal) {
  if (start === goal) return { km: 0, path: [start] };

  const dist = new Map();
  const prev = new Map();
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
    for (const { to, km } of edges) {
      const nd = d + km;
      const cur = dist.get(to);
      if (cur == null || nd < cur) {
        dist.set(to, nd);
        prev.set(to, node);
        pq.push({ node: to, d: nd });
      }
    }
  }

  const best = dist.get(goal);
  if (best == null) return { km: null, path: [] };

  // 경로 복원
  const path = [];
  let cur = goal;
  while (cur != null) {
    path.push(cur);
    cur = prev.get(cur);
  }
  path.reverse();

  return { km: best, path };
}

export function pathIncludesSegment(path, from, to) {
  const i = path.indexOf(from);
  const j = path.indexOf(to);
  if (i === -1 || j === -1) return false;
  return true;
}
