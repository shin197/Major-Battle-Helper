// {S}, {S.#}, {S.!} 변수 확장 (await 없음)
// status/params보다 "우선"해서 이 함수를 먼저 돌리면 됩니다.

import { getLastDiceResult } from "./dice-result"

export type DiceExpandOptions = {
  /**
   * S가 null일 때 대체 문자열 (기본: "")
   * ex) "?" 로 보이게 하고 싶으면 "?" 지정
   */
  nullSPlaceholder?: string

  /**
   * unitCount가 undefined일 때 대체 문자열 (기본: "")
   */
  nullUnitPlaceholder?: string

  /**
   * isCritical을 숫자(1/0)로 반환 (기본: true)
   */
  criticalAsNumber?: boolean

  /**
   * unitCount가 없을 때 S로부터 계산하는 보조 로직(선택)
   * - 항상 계산되는 값이 아니라면 제공하지 않아도 됩니다.
   */
  computeUnitCount?: (S: number) => number
}

const DEFAULTS: Required<DiceExpandOptions> = {
  nullSPlaceholder: "",
  nullUnitPlaceholder: "",
  criticalAsNumber: true,
  computeUnitCount: undefined as any // 미지정
}

/**
 * 텍스트 안의 {S}, {S.#}, {S.!}를 치환합니다.
 * - 반환값은 원본을 복사한 문자열
 */
export function expandDiceVars(
  text: string,
  options?: DiceExpandOptions
): string {
  const opt = { ...DEFAULTS, ...(options ?? {}) }
  const last = getLastDiceResult()

  // 빠른 탈출
  if (!/\{S(?:\.(?:#|!))?\}/.test(text)) return text

  let Sstr = opt.nullSPlaceholder
  let unitStr = opt.nullUnitPlaceholder
  let critStr = "0"

  if (last) {
    // S
    if (typeof last.S === "number") {
      Sstr = String(last.S)
    }

    // unitCount
    if (typeof last.unitCount === "number") {
      unitStr = String(last.unitCount)
    } else if (
      typeof last.S === "number" &&
      typeof opt.computeUnitCount === "function"
    ) {
      try {
        unitStr = String(opt.computeUnitCount(last.S))
      } catch {
        unitStr = opt.nullUnitPlaceholder
      }
    }

    // isCritical
    if (opt.criticalAsNumber) {
      critStr = last.crit ? "1" : "0"
    } else {
      critStr = String(last.crit)
    }
  }

  // 하나의 정규식으로 3가지 토큰 모두 처리
  return text.replace(/\{S(?:\.(#|!))?\}/g, (_, mod: string | undefined) => {
    if (!mod) return Sstr // {S}
    if (mod === "#") return unitStr // {S.#}
    // mod === "!"
    return critStr // {S.!}
  })
}
