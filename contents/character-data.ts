import { getCharacterListButton } from "~utils/elements"
import { toNum } from "~utils/utils"
import {
  waitFor,
  waitForDialogByTitle,
  waitForDialogByTitleWithButton,
  type DialogWaitResult
} from "~utils/wait-for"

import type { CharacterData } from "./character-store"
import { makeCharacterIdFromName, store } from "./character-store"
import { showToast } from "./toast"

export function extractCharacterData(
  dialog: HTMLDivElement,
  doClose
): CharacterData {
  const form = dialog.querySelector("form")

  // 간판 아이콘 찾기
  const iconUrl =
    form.querySelector<HTMLImageElement>(":scope > div:first-of-type img")
      ?.src ?? null
  const firstSection = form.querySelectorAll<HTMLDivElement>(":scope > div")[0]

  // 이름 / 이니셔티브: 'name' 속성으로 직접 검색 (직계 자식이 아님!)
  const nameInput =
    firstSection?.querySelector<HTMLInputElement>('input[name="name"]') ??
    form.querySelector<HTMLInputElement>('input[name="name"]')

  const initiativeInput =
    firstSection?.querySelector<HTMLInputElement>('input[name="initiative"]') ??
    form.querySelector<HTMLInputElement>('input[name="initiative"]')

  const name = nameInput?.value?.trim() ?? ""
  const initiative = toNum(initiativeInput?.value)

  /* ------------------------------------------------------------------
    2) 스탠딩 행(row) = 이미지 + faces.N.label input 을 모두 포함한 div
       iconUrl / label 추출
  ------------------------------------------------------------------ */
  const standingSection =
    form.querySelectorAll<HTMLDivElement>(":scope > div")[1]
  const standingRows = [
    ...standingSection.querySelectorAll<HTMLDivElement>("div")
  ].filter(
    (div) =>
      div.querySelector("img") &&
      div.querySelector('input[name^="faces."][name$=".label"]')
  )
  const faces = standingRows.map((row) => {
    const iconUrl = row.querySelector<HTMLImageElement>("img")?.src ?? null
    const input = row.querySelector<HTMLInputElement>(
      'input[name^="faces."][name$=".label"]'
    )!
    const label = (input.value || input.placeholder || "").trim()
    return { iconUrl, label }
  })

  /* ------------------------------------------------------------------
    3) status 추출
  ------------------------------------------------------------------ */
  const statusSection = form.querySelectorAll<HTMLDivElement>(":scope > div")[2]
  // 한 줄(row)은 보통 "라벨/현재값/최대값" 세 input을 포함
  // 클래스는 배포마다 바뀔 수 있으므로 input name 패턴만 신뢰
  const statusRows = [
    ...statusSection.querySelectorAll<HTMLDivElement>(":scope > div")
  ].filter((div) => {
    const hasLabel = div.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".label"]'
    )
    const hasCur = div.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".value"]'
    )
    const hasMax = div.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".max"]'
    )
    // 라벨이 있고 현재/최대 중 하나 이상 존재하면 유효한 행으로 간주
    return !!(hasLabel && hasCur && hasMax)
  })

  const status = statusRows
    .map((row) => {
      const labelInput = row.querySelector<HTMLInputElement>(
        'input[name^="status."][name$=".label"]'
      )
      const curInput = row.querySelector<HTMLInputElement>(
        'input[name^="status."][name$=".value"]'
      )
      const maxInput = row.querySelector<HTMLInputElement>(
        'input[name^="status."][name$=".max"]'
      )

      const label = labelInput?.value?.trim() ?? ""
      const cur = toNum(curInput?.value)
      const max = toNum(maxInput?.value)

      return { label, cur, max } as {
        label: string
        cur: number
        max: number
      }
    })
    // 라벨이 비어 있으면(미입력/자리만) 제외
    .filter((s) => s.label.length > 0)

  /* ------------------------------------------------------------------
    3) params 추출
  ------------------------------------------------------------------ */

  const paramsSection = form.querySelectorAll<HTMLDivElement>(":scope > div")[3]

  const paramsRows = [
    ...paramsSection.querySelectorAll<HTMLDivElement>(":scope > div")
  ].filter((div) => {
    const hasLabel = div.querySelector<HTMLInputElement>(
      'input[name^="params."][name$=".label"]'
    )
    const hasVal = div.querySelector<HTMLInputElement>(
      'input[name^="params."][name$=".value"]'
    )
    // 라벨이 있고 현재/최대 중 하나 이상 존재하면 유효한 행으로 간주
    return !!(hasLabel && hasVal)
  })

  const params = paramsRows
    .map((row) => {
      const labelInput = row.querySelector<HTMLInputElement>(
        'input[name^="params."][name$=".label"]'
      )
      const valueInput = row.querySelector<HTMLInputElement>(
        'input[name^="params."][name$=".value"]'
      )

      const label = labelInput?.value?.trim() ?? ""
      const value = valueInput?.value

      return { label, value } as {
        label: string
        value: string
      }
    })
    // 라벨이 비어 있으면(미입력/자리만) 제외
    .filter((s) => s.label.length > 0)

  /* 6) 편집 창 닫기 -------------------------------------------------- */
  const closeBtn =
    dialog
      .querySelector('header svg[data-testid="CloseIcon"]') // 아이콘
      ?.closest<HTMLButtonElement>("button") || // → 버튼
    dialog.querySelector<HTMLButtonElement>("header button:first-of-type")

  if (doClose) {
    closeBtn?.click() // 버튼이 있으면 클릭
  }
  /* --------------------------------------------------------------- */

  const scanned: CharacterData = {
    name,
    initiative,
    iconUrl,
    faces,
    status,
    params
  }

  store.upsert({
    id: makeCharacterIdFromName(scanned.name),
    data: scanned,
    source: "scan",
    merge: false // 기존 수동값을 보존하고 싶을 때
  })

  const rec = store.getByName(name).data
  console.info(rec)

  return scanned
}

export type Patch = { label: string; value: string | number }
type PatchResult = {
  total: number
  applied: string[]
  skipped: { label: string; reason: string }[]
}

function setInputValue(input: HTMLInputElement, val: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set
  if (nativeSetter) {
    nativeSetter.call(input, val)
  } else {
    // fallback
    ;(input as any).value = val
  }
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

export function findSections(form: HTMLFormElement) {
  const topDivs = form.querySelectorAll<HTMLDivElement>(":scope > div")
  return {
    firstSection: topDivs[0] ?? null,
    standingSection: topDivs[1] ?? null,
    statusSection: topDivs[2] ?? null,
    paramsSection: topDivs[3] ?? null
  }
}

export function buildStatusMap(statusSection: HTMLDivElement | null) {
  const map = new Map<
    string,
    {
      labelInput: HTMLInputElement
      curInput: HTMLInputElement | null
      maxInput: HTMLInputElement | null
    }
  >()
  if (!statusSection) return map

  const rows = [
    ...statusSection.querySelectorAll<HTMLDivElement>(":scope > div")
  ].filter((div) => {
    const hasLabel = div.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".label"]'
    )
    const hasCur = div.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".value"]'
    )
    const hasMax = div.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".max"]'
    )
    return !!(hasLabel && hasCur && hasMax)
  })

  for (const row of rows) {
    const labelInput = row.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".label"]'
    )!
    const curInput = row.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".value"]'
    )
    const maxInput = row.querySelector<HTMLInputElement>(
      'input[name^="status."][name$=".max"]'
    )
    const key = (labelInput.value || "").trim()
    if (key) {
      map.set(key, {
        labelInput,
        curInput: curInput ?? null,
        maxInput: maxInput ?? null
      })
    }
  }
  return map
}

export function buildParamsMap(paramsSection: HTMLDivElement | null) {
  const map = new Map<string, HTMLInputElement>()
  if (!paramsSection) return map

  const rows = [
    ...paramsSection.querySelectorAll<HTMLDivElement>(":scope > div")
  ].filter((div) => {
    const hasLabel = div.querySelector<HTMLInputElement>(
      'input[name^="params."][name$=".label"]'
    )
    const hasVal = div.querySelector<HTMLInputElement>(
      'input[name^="params."][name$=".value"]'
    )
    return !!(hasLabel && hasVal)
  })

  for (const row of rows) {
    const labelInput = row.querySelector<HTMLInputElement>(
      'input[name^="params."][name$=".label"]'
    )!
    const valueInput = row.querySelector<HTMLInputElement>(
      'input[name^="params."][name$=".value"]'
    )!
    const key = (labelInput.value || "").trim()
    if (key) {
      map.set(key, valueInput)
    }
  }
  return map
}

function clickAddButton(section: HTMLDivElement | null | undefined) {
  // TODO: 추가 버튼 찾아주기

  // "추가" 버튼 탐색(아이콘/텍스트 어느 쪽이든 시도)
  const btn =
    section?.querySelector<HTMLButtonElement>(
      'button:has(svg[data-testid="AddIcon"])'
    ) ||
    [...(section?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
      (b) => /추가|add|\+/.test(b.textContent ?? "")
    )
  btn?.click()
  return !!btn
  // return null
}

export function applyCharacterPatches(
  dialog: HTMLDivElement,
  patches: Patch[],
  doClose: boolean
): PatchResult {
  const form = dialog.querySelector<HTMLFormElement>("form")
  if (!form)
    return {
      total: patches.length,
      applied: [],
      skipped: patches.map((p) => ({
        label: p.label,
        reason: "form not found"
      }))
    }

  const { firstSection, statusSection, paramsSection } = findSections(form)

  // initiative
  const initiativeInput =
    firstSection?.querySelector<HTMLInputElement>('input[name="initiative"]') ??
    form.querySelector<HTMLInputElement>('input[name="initiative"]')

  // maps for quick lookup by label text
  const statusMap = buildStatusMap(statusSection)
  const paramsMap = buildParamsMap(paramsSection)

  const applied: string[] = []
  const skipped: { label: string; reason: string }[] = []

  for (const { label: rawLabel, value } of patches) {
    if (!rawLabel || typeof rawLabel !== "string") {
      skipped.push({ label: String(rawLabel), reason: "invalid label" })
      continue
    }
    const label = rawLabel.trim()

    // 1) name / faces / iconUrl 은 패치하지 않음
    if (
      ["name", "icon", "iconUrl", "faces", "face", "avatar"].includes(
        label.toLowerCase()
      )
    ) {
      skipped.push({
        label,
        reason: "not patchable"
      })
      continue
    }

    // 2) initiative: “숫자만 들어갈 수 있는 params처럼” 취급하지만 고정 input을 직접 갱신
    if (label.toLowerCase() === "initiative") {
      if (!initiativeInput) {
        skipped.push({ label, reason: "initiative input not found" })
        continue
      }
      const v = String(Number(value)) // 강제 숫자화
      setInputValue(initiativeInput, v)
      applied.push(`${label}=${v}`)
      continue
    }

    // 3) status 라벨 접미사 파싱 (예: "HP.max", "Shield.cur", "HP.value")
    let baseLabel = label
    let field: "cur" | "max" | "value" | null = null
    const dotIdx = label.lastIndexOf(".")
    if (dotIdx > 0) {
      const suffix = label.slice(dotIdx + 1).toLowerCase()
      if (["max", "cur", "value"].includes(suffix)) {
        baseLabel = label.slice(0, dotIdx).trim()
        field = suffix as "cur" | "max" | "value"
      }
    }

    // 4) status 우선 매칭: 같은 라벨을 가진 status row가 있으면 status 수정
    const statusRow = statusMap.get(baseLabel)
    if (statusRow) {
      const target = field === "max" ? statusRow.maxInput : statusRow.curInput // 기본값: cur(value)
      if (!target) {
        skipped.push({
          label,
          reason: `status input (${field ?? "cur"}) not found`
        })
        continue
      }
      const v = String(value)
      setInputValue(target, v)
      applied.push(`status[${baseLabel}.${field ?? "cur"}]=${v}`)
      continue
    }

    // 5) params 매칭
    const paramsInput = paramsMap.get(label)
    if (paramsInput) {
      const v = String(value)
      setInputValue(paramsInput, v)
      applied.push(`params[${label}]=${v}`)
      continue
    }

    // 6) 휴리스틱: 숫자 여부로 params 추정 (요청사항: 숫자로 파싱 불가한 문자열이면 params임을 알 수 있음)
    //    - 다만 해당 라벨의 params 행이 실제로 없으면 DOM을 생성할 순 없으니 스킵
    const looksNumeric = Number.isFinite(Number(String(value).trim()))
    if (!looksNumeric) {
      // 문자열 -> params 의도일 가능성 높음이지만 행이 없으면 스킵
      skipped.push({
        label,
        reason: "no matching status/params row; cannot create new rows"
      })
      continue
    } else {
      // 숫자인 경우: status 라벨도 없고 params 라벨도 없으면 스킵
      skipped.push({
        label,
        reason: "no matching status/params row; cannot create new rows"
      })
      continue
    }
  }

  const closeBtn =
    dialog
      .querySelector('header svg[data-testid="CloseIcon"]') // 아이콘
      ?.closest<HTMLButtonElement>("button") || // → 버튼
    dialog.querySelector<HTMLButtonElement>("header button:first-of-type")

  if (doClose) {
    closeBtn?.click() // 버튼이 있으면 클릭
  }

  return { total: patches.length, applied, skipped }
}

/**
 * /stat 커맨드 파서 + 패치 적용기
 * 지원 패턴 (라벨은 한글/영문/공백/점 포함 가능, 값은 따옴표 가능):
 *  - 라벨=값        (절대 대입)
 *  - 라벨+숫자      (상대 증가)
 *  - 라벨-숫자      (상대 감소)
 *  - 라벨:값        (문자열 대입; 공백/콤마 포함시 따옴표로 감싸기)
 *  - 라벨에 .max/.cur/.value 접미사 허용 (status 대상 지정)
 *  - 스페이스/개행 자유, 쉼표(,)로 항목 구분 (따옴표 안 쉼표는 보존)
 */

/** 쉼표 분할 (따옴표 내부의 , 는 보존) */
function splitByCommaRespectQuotes(s: string): string[] {
  const out: string[] = []
  let cur = ""
  let quote: '"' | "'" | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'"
      cur += ch
      continue
    }
    if (ch === ",") {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  if (cur.length) out.push(cur)
  return out
}

/** 좌우 공백, 양끝 따옴표 제거 */
function strip(s: string): string {
  let t = s.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1)
  }
  return t.trim()
}

/** 숫자 판별 (정수/실수) */
function isNumericLike(s: string): boolean {
  if (s == null) return false
  const t = String(s).trim()
  if (t === "") return false
  const n = Number(t)
  return Number.isFinite(n)
}

/** 라벨에서 접미사(.max/.cur/.value) 분리 */
function splitField(label: string): {
  base: string
  field: "max" | "cur" | "value" | null
} {
  const idx = label.lastIndexOf(".")
  if (idx > 0) {
    const base = label.slice(0, idx).trim()
    const suf = label
      .slice(idx + 1)
      .trim()
      .toLowerCase()
    if (suf === "max" || suf === "cur" || suf === "value")
      return { base, field: suf }
  }
  return { base: label.trim(), field: null }
}

/** 현재 값을 DOM에서 읽기 (status 우선 → params → initiative) */
function readCurrentValue(
  dialog: HTMLDivElement,
  label: string
): {
  kind: "status" | "params" | "initiative" | "none"
  field: "cur" | "max"
  value: number | null
} {
  const form = dialog.querySelector<HTMLFormElement>("form")
  if (!form) return { kind: "none", field: "cur", value: null }

  const { firstSection, statusSection, paramsSection } = findSections(form)

  // 준비된 맵
  const statusMap = buildStatusMap(statusSection)
  const paramsMap = buildParamsMap(paramsSection)

  // initiative
  if (label.toLowerCase() === "initiative") {
    const input =
      firstSection?.querySelector<HTMLInputElement>(
        'input[name="initiative"]'
      ) ?? form.querySelector<HTMLInputElement>('input[name="initiative"]')
    const v = input?.value ?? null
    return {
      kind: "initiative",
      field: "cur",
      value: v === null ? null : Number(v)
    }
  }

  // status 우선
  const { base, field } = splitField(label)
  const st = statusMap.get(base)
  if (st) {
    const target = field === "max" ? st.maxInput : st.curInput // 기본은 cur(value)
    const curVal = target?.value ?? null
    return {
      kind: "status",
      field: field === "max" ? "max" : "cur",
      value: curVal === null ? null : Number(curVal)
    }
  }

  // params
  const p = paramsMap.get(label)
  if (p) {
    const raw = p.value
    return {
      kind: "params",
      field: "cur",
      value: isNumericLike(raw) ? Number(raw) : null
    }
  }

  return { kind: "none", field: "cur", value: null }
}

export function applyStatCommand(
  dialog: HTMLDivElement,
  rawCommand: string
): PatchResult {
  // 1) prefix 제거
  let cmd = rawCommand.trim()
  if (cmd.startsWith("/stat")) cmd = cmd.slice(5)
  // 개행/탭 정리
  cmd = cmd.replace(/\s*\n+\s*/g, " ").trim()

  // 2) 쉼표로 분해
  const parts = splitByCommaRespectQuotes(cmd)
    .map((s) => s.trim())
    .filter(Boolean)

  // 3) 파싱 → Patch[]
  const patches: Patch[] = []

  for (const part of parts) {
    if (!part) continue

    // a) 라벨:값  (문자열 대입 강제)
    let mColon = part.match(/^(.+?)\s*:\s*(.+)$/)
    if (mColon) {
      const label = strip(mColon[1])
      const valRaw = strip(mColon[2])
      if (label) patches.push({ label, value: valRaw })
      continue
    }

    // b) 라벨=값  (숫자/문자 모두 허용)
    let mEq = part.match(/^(.+?)\s*=\s*(.+)$/)
    if (mEq) {
      const label = strip(mEq[1])
      const valRaw = strip(mEq[2])
      if (!label) continue
      const value = isNumericLike(valRaw) ? Number(valRaw) : valRaw
      patches.push({ label, value })
      continue
    }

    // c) 라벨+숫자 / 라벨-숫자  (상대 연산 → 현재값 읽어서 계산)
    let mPM = part.match(/^(.+?)\s*([+\-])\s*(\d+(?:\.\d+)?)$/)
    if (mPM) {
      const label = strip(mPM[1])
      const op = mPM[2]
      const delta = Number(mPM[3])
      if (!label) continue

      const cur = readCurrentValue(dialog, label)
      if (cur.kind === "none") {
        // 현재값을 읽을 수 없으면 스킵 (새 row 생성은 여기서 하지 않음)
        // 필요 시: 자동 행 생성 로직 추가 가능
        continue
      }
      if (cur.value === null || Number.isNaN(cur.value)) continue

      const next = op === "+" ? cur.value + delta : cur.value - delta
      // status의 .max를 명시했다면 label 그대로 전달 (applyCharacterPatches가 처리)
      patches.push({ label, value: next })
      continue
    }

    // d) 인식 불가 토큰은 무시
    // 콘솔에 남겨두고 싶다면: console.warn('[stat] skipped:', part)
  }

  return applyCharacterPatches(dialog, patches, true)
}

// dialog 내부에서 1개 아이템의 표시 이름 추출
function getItemName(li: HTMLElement): string {
  return (
    li
      .querySelector<HTMLElement>(".MuiListItemText-primary")
      ?.textContent?.trim() ??
    li
      .querySelector<HTMLElement>(".MuiListItemText-root span")
      ?.textContent?.trim() ??
    ""
  )
}

function pickItemByName(
  listRoot: HTMLElement,
  search?: string
): HTMLElement | null {
  // ul 내 모든 li
  const items = Array.from(
    listRoot.querySelectorAll<HTMLElement>("li.MuiListItem-container")
  )
  if (items.length === 0) return null

  if (!search) return items[0] // 검색어 없으면 첫 항목 클릭(원하면 바꾸세요)

  const key = search

  // console.log(norm(key))

  // 1) 완전일치 우선
  let found = items.find((li) => getItemName(li) === key)
  if (found) return found

  // 2) 부분일치 폴백
  found = items.find((li) => getItemName(li).includes(key))
  return found ?? null
}

export async function openCharacterEditDialogRead(
  search?: string
): Promise<CharacterData> {
  const characterListBtn = getCharacterListButton()

  const { dialog, buttonUsed } = await openCharacterEditDialog(search)

  const characterData = extractCharacterData(dialog, true)
  if (buttonUsed) characterListBtn.click() // 다이얼로그 회수

  return characterData
}

export async function openCharacterEditDialogWrite(
  search: string,
  cmd: string
) {
  const characterListBtn = getCharacterListButton()

  const { dialog, buttonUsed } = await openCharacterEditDialog(search)

  applyStatCommandResult(dialog, cmd)

  if (buttonUsed) characterListBtn.click() // 다이얼로그 회수
}

export async function openCharacterEditDialog<
  T extends HTMLDivElement = HTMLDivElement
>(search?: string): Promise<DialogWaitResult<T>> {
  //Promise<HTMLDivElement>
  const characterListBtn = getCharacterListButton()

  const characterListResult = await waitForDialogByTitleWithButton(
    "내 캐릭터 목록",
    characterListBtn
  )
  const paper = characterListResult.dialog
  const buttonUsed = characterListResult.buttonUsed

  // const onClose = () => {}
  function onErrorClose(message: string) {
    showToast(message)
    if (buttonUsed) {
      characterListBtn.click() // 다이얼로그 회수
    }
  }

  if (!paper) {
    showToast("❗ '내 캐릭터 목록' 다이얼로그를 찾지 못했습니다.")
  }

  // ul 루트 찾기
  const ul =
    paper.querySelector<HTMLElement>("ul.MuiList-root") ??
    paper.querySelector("ul")
  if (!ul) {
    onErrorClose("❗ 캐릭터 목록 <ul>을 찾지 못했습니다.")
    return
  }

  // 이름으로 li 선택
  const li = pickItemByName(ul, search)
  if (!li) {
    onErrorClose(`"${search}"에 해당하는 캐릭터를 찾지 못했습니다.`)
    return
  }

  // li 안의 메인 버튼(div[role="button"]) 클릭 → 편집/상세 열림
  const mainBtn = li.querySelector<HTMLElement>('div[role="button"]')
  if (!mainBtn) {
    onErrorClose(`항목 내 role="button" 요소가 없습니다.`)
    return
  }

  // 실제 클릭 이벤트로 트리거
  mainBtn.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  )

  const dialog = await waitFor<HTMLDivElement>(
    'div.MuiDialog-paper[role="dialog"]', // ← 이 셀렉터로만 기다린다
    { timeout: 1000 } // (필요하면 시간 조정)
  )
  if (!dialog) {
    onErrorClose("❗ 캐릭터 편집 창을 찾지 못했습니다.")
  }

  return { dialog: dialog as T, buttonUsed }
}

export function applyStatCommandResult(dialog: HTMLDivElement, cmd: string) {
  const result = applyStatCommand(dialog, cmd)
  if (result.total == 0) {
    showToast("❗ 캐릭터 편집 사항이 없습니다.")
  } else if (result.applied.length == 0) {
    showToast("❗ 적용된 사항이 없습니다.")
  } else if (result.skipped.length > 0) {
    showToast(`⚠️ ${result.skipped.length} 개의 스킵된 사항이 있습니다.`)
  } else {
    showToast(`✅ 적용 완료!`)
  }
}

// export function getCharacterListButton(): HTMLButtonElement {
//   const CHARACTER_LIST_BTN_SEL =
//     "#root > div > header > div > button:nth-child(3)"
//   const characterListBtn = document.querySelector<HTMLButtonElement>(
//     CHARACTER_LIST_BTN_SEL
//   )
//   if (!characterListBtn) showToast("❗ 캐릭터 목록 버튼을 찾지 못했습니다.") //throw new Error("캐릭터 목록 버튼을 찾지 못했습니다.")
//   return characterListBtn
// }
