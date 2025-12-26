// km -> zone 결정
export function getZoneByKm(km, distanceZones) {
  for (const z of distanceZones) {
    if (z.maxKm == null || km <= z.maxKm) {
      return z.zone;
    }
  }
  return 5;
}

// IC카드 월 비용 (성인)
export function calcRegularMonthlyCost({ km, days = 20, fares }) {
  const zone = getZoneByKm(km, fares.distanceZones);
  const oneWay = fares.regularFare.adult[String(zone)];
  return {
    zone,
    oneWay,
    daily: oneWay * 2,
    monthly: oneWay * 2 * days,
  };
}

// 통근 정기권 비용
export function calcCommuterPassCost({ km, months, fares }) {
  const zone = getZoneByKm(km, fares.distanceZones);
  const price = fares.commuterPass[String(months)][String(zone)];
  return {
    zone,
    months,
    price,
  };
}

// 손익분기 계산
export function calcBreakEvenDays({ km, months, fares }) {
  const zone = getZoneByKm(km, fares.distanceZones);
  const oneWay = fares.regularFare.adult[String(zone)];
  const daily = oneWay * 2;

  const passPrice = fares.commuterPass[String(months)][String(zone)];

  // 기간 전체 기준 손익분기 탑승일수
  const days = Math.ceil(passPrice / daily);

  return { zone, months, days, passPrice, daily };
}
