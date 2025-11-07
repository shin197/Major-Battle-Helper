export type DiceResult = {
  S: number | null // 필수 (null = 아직 없음)
  isCritical: boolean // 필수
  unitCount?: number // 선택
}

const KEY = "ccf:lastDiceResult"

let memCache: DiceResult | null = null

function load(): DiceResult | null {
  if (memCache) return memCache
  try {
    const raw = window.localStorage.getItem(KEY)
    memCache = raw ? (JSON.parse(raw) as DiceResult) : null
    return memCache
  } catch {
    return null
  }
}

function save(v: DiceResult | null) {
  memCache = v
  try {
    if (v) window.localStorage.setItem(KEY, JSON.stringify(v))
    else window.localStorage.removeItem(KEY)
  } catch {
    // 용량/권한 이슈 시 조용히 무시
  }
}

/** 최신 판정 저장 */
export function setLastDiceResult(res: DiceResult) {
  // 타입 방어
  const safe: DiceResult = {
    S: res.S ?? null,
    isCritical: !!res.isCritical,
    unitCount: typeof res.unitCount === "number" ? res.unitCount : undefined
  }
  save(safe)
}

/** 최신 판정 불러오기 */
export function getLastDiceResult(): DiceResult | null {
  return load()
}

/** 초기화 */
export function clearLastDiceResult() {
  save(null)
}
