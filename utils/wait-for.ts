/**
 * DOM에 특정 요소가 나타날 때까지 대기
 * @param selector   CSS 선택자
 * @param options
 *   - root            관찰 시작 루트 (default: document)
 *   - timeout         ms, 0이면 무한 대기 (default: 10_000)
 *   - rejectOnTimeout true → reject, false → resolve(null) (default: true)
 */

type WaitOpts = { timeout?: number; interval?: number }
type TitleMatch =
  | string
  | RegExp
  | ((title: string, root: HTMLElement) => boolean)

export interface DialogWaitResult<T extends HTMLElement = HTMLElement> {
  dialog: T | null
  buttonUsed: boolean
}

export function waitFor<T extends HTMLElement = HTMLElement>(
  selector: string,
  {
    root = document,
    timeout = 10_000,
    rejectOnTimeout = false
  }: {
    root?: ParentNode
    timeout?: number
    rejectOnTimeout?: boolean
  } = {}
): Promise<T | null> {
  const start = (root as ParentNode).querySelector<T>(selector)
  if (start) return Promise.resolve(start)

  return new Promise((resolve, reject) => {
    const done = (value: T | null, isTimeout = false) => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      isTimeout && rejectOnTimeout
        ? reject(new Error(`waitFor: ${selector} timed out`))
        : resolve(value)
    }

    const observer = new MutationObserver(() => {
      const found = (root as ParentNode).querySelector<T>(selector)
      if (found) done(found)
    })

    observer.observe(root as Node, { childList: true, subtree: true })

    const timeoutId =
      timeout > 0 ? setTimeout(() => done(null, true), timeout) : 0
  })
}

/**
 * selector에 해당하는 요소를 먼저 즉시 찾아보고,
 * 없으면 주어진 버튼을 클릭한 뒤 waitFor로 해당 요소를 기다립니다.
 */
export async function clickButtonAndWaitFor<
  T extends HTMLElement = HTMLElement
>(
  selector: string,
  button: HTMLButtonElement,
  {
    root = document,
    timeout = 10_000,
    rejectOnTimeout = false
  }: {
    root?: ParentNode
    timeout?: number
    rejectOnTimeout?: boolean
  } = {}
): Promise<T | null> {
  // 1) 먼저 바로 시도
  const initial = root.querySelector<T>(selector)
  if (initial) {
    return initial
  }

  // 2) 없다면 버튼 클릭으로 팝업/다이얼로그 트리거
  try {
    button.click()
  } catch (e) {
    console.warn("[clickButtonAndWaitFor] 버튼 클릭 실패:", e)
  }

  // 3) 팝업이 뜨길 기대하고 waitFor
  const el = await waitFor<T>(selector, { root, timeout, rejectOnTimeout })
  return el
}

/** 공백/개행/연속공백 정리 */
function norm(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

/** el이 화면에 실질적으로 보이는지 */
function isShown(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const style = getComputedStyle(el)
  return (
    r.width > 0 &&
    r.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  )
}

/** Paper 후보들 수집: MUI Dialog에 흔히 보이는 패턴들 */
function queryDialogPapers(): HTMLElement[] {
  const papers = new Set<HTMLElement>()

  // 혹시 role이 누락된 경우도 대비(보수적으로)
  document
    .querySelectorAll<HTMLElement>(".MuiPaper-root")
    .forEach((n) => papers.add(n))

  return Array.from(papers)
}

/** 제목 추출 */
function getDialogTitle(paper: HTMLElement): string | null {
  const titleEl =
    paper.querySelector<HTMLElement>(
      ".MuiDialogTitle-root, header h1, header h2, header h6, h1, h2, h6"
    ) ?? null
  return titleEl?.textContent ? norm(titleEl.textContent) : null
}

/** 타이틀 매치 */
function matchTitle(title: string | null, m: TitleMatch, root: HTMLElement) {
  if (title == null) return false
  if (typeof m === "string") return norm(title) === norm(m)
  if (m instanceof RegExp) return m.test(title)
  return m(title, root)
}

/** 가장 위에 떠 있는(가장 큰 z-index) 후보 고르기 */
function pickTopMost(els: HTMLElement[]): HTMLElement | null {
  if (els.length === 0) return null
  const withZ = els
    .map((el) => ({
      el,
      z: parseInt(getComputedStyle(el).zIndex || "0", 10) || 0
    }))
    .sort((a, b) => b.z - a.z)
  return withZ[0].el
}

/** 제목으로 Dialog Paper 기다리기 */
export async function waitForDialogByTitle(
  titleMatch: TitleMatch,
  { timeout = 8000, interval = 120 }: WaitOpts = {}
): Promise<HTMLElement | null> {
  const t0 = performance.now()

  // 즉시 한 번 검사 + 폴링
  while (performance.now() - t0 < timeout) {
    const candidates = queryDialogPapers().filter(isShown)

    const matched = candidates.filter((paper) =>
      matchTitle(getDialogTitle(paper), titleMatch, paper)
    )

    if (matched.length > 0) {
      // 여러 개면 최상단 선택
      return pickTopMost(matched)
    }

    // MutationObserver로 가속 (있으면 더 빨리 잡힘)
    const found = await new Promise<HTMLElement | null>((res) => {
      let settled = false
      const obs = new MutationObserver(() => {
        if (settled) return
        const cands = queryDialogPapers().filter(isShown)
        const m = cands.filter((paper) =>
          matchTitle(getDialogTitle(paper), titleMatch, paper)
        )
        if (m.length > 0) {
          settled = true
          obs.disconnect()
          res(pickTopMost(m))
        }
      })
      obs.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => {
        if (!settled) {
          obs.disconnect()
          res(null)
        }
      }, interval)
    })

    if (found) return found
  }
  return null
}

/**
 * 1. 이미 떠 있는 "내 캐릭터 목록" 다이얼로그를 먼저 찾아보고
 * 2. 없으면 버튼을 클릭해서 다이얼로그를 띄운 뒤
 * 3. 다시 waitForDialogByTitle로 해당 제목의 다이얼로그를 기다립니다.
 */
export async function waitForDialogByTitleWithButton(
  titleMatch: TitleMatch,
  button: HTMLButtonElement,
  opts: WaitOpts = {}
): Promise<DialogWaitResult> {
  const { timeout = 8000, interval = 120 } = opts

  // 1) 즉시 찾기를 위한 짧은 스캔
  const quickTimeout = Math.min(150, timeout)
  const existing = await waitForDialogByTitle(titleMatch, {
    timeout: quickTimeout,
    interval
  })

  if (existing) {
    return {
      dialog: existing,
      buttonUsed: false
    }
  }

  // 2) 즉시 못 찾은 경우 → 버튼 클릭
  try {
    button.click()
  } catch (e) {
    console.warn("[waitForDialogByTitleWithButton] 버튼 클릭 실패:", e)
  }

  // 3) 남은 시간 동안 기다림
  const remainingTimeout = Math.max(0, timeout - quickTimeout)
  const afterClick = await waitForDialogByTitle(titleMatch, {
    timeout: remainingTimeout || timeout,
    interval
  })

  if (afterClick) {
    return {
      dialog: afterClick,
      buttonUsed: true
    }
  }

  // 실패한 경우
  return {
    dialog: null,
    buttonUsed: false
  }
}
