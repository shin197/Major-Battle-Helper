import type { PlasmoCSConfig } from "plasmo"

import { sleep } from "~utils/utils"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle"
}

// ====== 설정 ======
const QUERY_CONTAINER = "#root div.MuiDrawer-docked > div > ul"
const ITEM_SELECTOR = "div[data-index]"
const PAGE_STEP = 20

// ====== 유틸 ======
const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)))
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function getLogContainer(): HTMLElement | null {
  const s = document.querySelector<HTMLElement>(QUERY_CONTAINER)
  if (s) return s
  // fallback: data-index 포함 조상으로부터 실제 스크롤러 탐색
  const any = document.querySelector<HTMLElement>(ITEM_SELECTOR)
  let p: HTMLElement | null = any
  while (p && p !== document.body) {
    const st = getComputedStyle(p)
    if (
      (st.overflowY === "auto" || st.overflowY === "scroll") &&
      p.scrollHeight > p.clientHeight + 8
    ) {
      return p
    }
    p = p.parentElement
  }
  return null
}

function getItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
}

function getLoadedIndices(container: HTMLElement): number[] {
  return getItems(container)
    .map((el) => Number(el.getAttribute("data-index")))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
}

function relTop(el: HTMLElement, container: HTMLElement) {
  const er = el.getBoundingClientRect()
  const cr = container.getBoundingClientRect()
  return er.top - cr.top + container.scrollTop
}

function scrollToElement(container: HTMLElement, el: HTMLElement) {
  container.scrollTo({ top: relTop(el, container), behavior: "auto" })
}

function findItemByIndex(container: HTMLElement, i: number) {
  return container.querySelector<HTMLElement>(`div[data-index="${i}"]`)
}

async function bumpScrollTop(container: HTMLElement, times = 1) {
  for (let i = 0; i < times; i++) {
    container.scrollTo({ top: 0, behavior: "auto" })
    await raf()
    await sleep(200)
  }
}

async function preloadTop(container: HTMLElement, bumps: number) {
  await bumpScrollTop(container, clamp(bumps, 1, 10))
  await sleep(120)
}

function getFirstVisibleIndex(container: HTMLElement): number | null {
  const st = container.scrollTop
  const h = container.clientHeight
  let bestIdx: number | null = null
  let bestDelta = 1e12
  const items = container.querySelectorAll<HTMLElement>(ITEM_SELECTOR)
  for (const el of items) {
    const idx = Number(el.dataset.index)
    if (!Number.isFinite(idx)) continue
    const top = relTop(el, container)
    const bottom = top + el.offsetHeight
    if (bottom > st && top < st + h) {
      const d = Math.abs(top - st)
      if (d < bestDelta) {
        bestDelta = d
        bestIdx = idx
      }
    }
  }
  return bestIdx
}

// alt Mount

// 툴바가 있는 form 하단 #3번째 div 를 찾는다
function getToolbarMount(): HTMLElement | null {
  const strict = document.querySelector<HTMLElement>(
    "#root div.MuiDrawer-docked > div > div > form > div:nth-child(3)"
  )
  if (strict) return strict

  // 2) 위에서 지정한게 안되면 폼 안에서 "전송" 버튼이 포함된 컨테이너를 휴리스틱으로 찾기
  const forms = document.querySelectorAll<HTMLFormElement>(
    "#root .MuiDrawer-docked form"
  )
  for (const form of forms) {
    const divs = form.querySelectorAll<HTMLElement>("div")
    for (const d of divs) {
      const hasSend = !!Array.from(
        d.querySelectorAll('button[type="submit"]')
      ).find((b: HTMLElement) => {
        return true
      })
      if (hasSend) return d
    }
  }
  return null
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

function isSendButton(el: HTMLElement) {
  return el.tagName === "BUTTON" && (el as HTMLButtonElement).type === "submit"
}

function hideNonSendChildren(toolbar: HTMLElement) {
  const children = Array.from(toolbar.children) as HTMLElement[]
  for (const ch of children) {
    // 버튼/아이콘 래퍼 등 다양한 구조를 고려해, 내부에 전송 버튼이 있으면 보존
    const hasSendInside =
      !!ch.querySelector('button[type="submit"]') &&
      !!Array.from(
        ch.querySelectorAll<HTMLElement>('button[type="submit"]')
      ).find(isSendButton)

    const selfIsSend = (ch.matches('button[type="submit"]') &&
      isSendButton(ch)) as boolean

    if (selfIsSend || hasSendInside) {
      // keep
    } else {
      // 안전을 위해 DOM 제거 대신 숨김 권장(원 사이트 핸들러 영향 최소화)
      ch.style.display = "none"
      // ch.setAttribute("data-ccfolia-nav-hidden", "true")
    }
  }
}

function makeInlineControlUI() {
  const wrap = document.createElement("div")
  wrap.className = "ccf-nav-inline"
  Object.assign(wrap.style, {
    display: "inline-flex",
    gap: "8px",
    alignItems: "center",
    marginLeft: "8px" // 전송 버튼과 간격
  } as CSSStyleDeclaration)

  const mkBtn = (label: string) => {
    const b = document.createElement("button")
    b.type = "button"
    b.textContent = label
    Object.assign(b.style, {
      padding: "6px 10px",
      border: "1px solid rgba(0,0,0,.2)",
      borderRadius: "8px",
      background: "rgba(0,0,0,.04)",
      cursor: "pointer",
      color: "#fff"
      // font: "13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial"
    } as CSSStyleDeclaration)
    return b
  }

  const prevBtn = mkBtn("<")
  const nextBtn = mkBtn(">")
  const preloadBtn = mkBtn("<<")
  const bottomBtn = mkBtn(">>") // ← 추가

  const pageLabel = document.createElement("span")
  pageLabel.textContent = "1" // ← 초기 표기
  pageLabel.style.minWidth = "2ch"
  pageLabel.style.textAlign = "right"
  const pageText = document.createElement("span")
  pageText.textContent = "페이지"

  wrap.append(preloadBtn, prevBtn, pageLabel, pageText, nextBtn, bottomBtn)
  return { wrap, prevBtn, nextBtn, bottomBtn, preloadBtn, pageLabel }
}

function findSendElement(toolbar: HTMLElement): HTMLElement | null {
  // 실제 전송 버튼 또는 그 래퍼
  // const btn = toolbar.querySelectorAll<HTMLElement>('button,input[type="submit"]')
  const btn = Array.from(
    toolbar.querySelectorAll<HTMLElement>('button[type="submit"]')
  ).find((el) => {
    return true
  })
  if (!btn) return null
  // 보통 버튼이 또 다른 래퍼 안에 있으므로, 한 단계 래퍼를 우선 반환
  const wrapper = btn.closest<HTMLElement>(
    'button[type="submit"], .MuiButtonBase-root, div, span'
  )
  return wrapper ?? btn
}

function applyToolbarLayout(toolbar: HTMLElement, uiWrap: HTMLElement) {
  // 툴바를 플렉스로 전환(원래도 flex일 수 있는데, 덮어써도 안전하게 최소만 세팅)
  const tbStyle = toolbar.style
  if (getComputedStyle(toolbar).display !== "flex") {
    tbStyle.display = "flex"
  }
  tbStyle.alignItems = tbStyle.alignItems || "center"
  tbStyle.gap = tbStyle.gap || "8px"
  // 우리 UI: 가용 공간 100% 차지 + 중앙 정렬
  Object.assign(uiWrap.style, {
    flex: "1 1 auto",
    minWidth: "0",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginLeft: "0" // 예전 인라인 여백 제거
  } as CSSStyleDeclaration)

  // 전송 버튼(또는 래퍼)을 오른쪽 끝으로
  const sendWrap = findSendElement(toolbar)
  if (sendWrap) {
    // 보통은 sendWrap이 마지막 child여야 자연스럽게 오른쪽에 감.
    // 혹시 중간이면 margin-left:auto 로 오른쪽 끝으로 밀어낸다.
    sendWrap.style.marginLeft = "auto"
    // 줄 바꿈 방지(옵션)
    sendWrap.style.whiteSpace = "nowrap"
  }
}

function insertUiBeforeSend(toolbar: HTMLElement, uiWrap: HTMLElement) {
  // “전송” 버튼(또는 그 래퍼)을 찾아 그 앞에 UI 삽입
  // 1) 직접 버튼 탐색
  let sendEl = Array.from(
    toolbar.querySelectorAll<HTMLElement>('button,input[type="submit"]')
  ).find(isSendButton)
  // 2) 없으면 마지막 child 가 전송 래퍼일 가능성 → 텍스트 포함 확인
  if (!sendEl && toolbar.lastElementChild) {
    const last = toolbar.lastElementChild as HTMLElement
    const btn = last.querySelector<HTMLElement>('button,input[type="submit"]')
    if (btn && isSendButton(btn)) sendEl = last
  }

  toolbar.insertBefore(uiWrap, sendEl)
}

// ====== Pager (고정 20단위) ======
class Pager {
  container: HTMLElement
  pageEl: HTMLSpanElement
  anchorMin: number | null = null

  constructor(container: HTMLElement, pageEl: HTMLSpanElement) {
    this.container = container
    this.pageEl = pageEl
    this.bindScrollSync()
    this.observeMutations()
    this.updatePageNumber()
  }

  private basis() {
    const ids = getLoadedIndices(this.container)
    if (!ids.length) return { min: 0, max: 0 }
    const curMin = ids[0]
    if (this.anchorMin == null || curMin < this.anchorMin)
      this.anchorMin = curMin
    return { min: this.anchorMin ?? curMin, max: ids[ids.length - 1] }
  }

  currentIndex() {
    return getFirstVisibleIndex(this.container)
  }

  currentPage() {
    const cur = this.currentIndex()
    const { min } = this.basis()
    if (cur == null) return 1
    return Math.floor((cur - min) / PAGE_STEP) + 1
  }

  // totalPages() {
  //   const { min, max } = this.basis()
  //   return Math.max(1, Math.floor((max - min) / PAGE_STEP) + 1)
  // }

  targetIndexFor(direction: "prev" | "next"): number | null {
    const cur = this.currentIndex()
    if (cur == null) return null
    return direction === "prev" ? cur - PAGE_STEP : cur + PAGE_STEP
  }

  updatePageNumber() {
    const cur = this.currentPage()
    this.pageEl.textContent = `${cur}`
  }

  bindScrollSync() {
    let t: number | undefined
    const handler = () => {
      window.clearTimeout(t)
      // @ts-ignore
      t = window.setTimeout(() => this.updatePageNumber(), 80)
    }
    this.container.addEventListener("scroll", handler, { passive: true })
  }

  observeMutations() {
    const mo = new MutationObserver(() => this.updatePageNumber())
    mo.observe(this.container, { childList: true, subtree: true })
  }
}

// ====== UI ======

async function boot() {
  // 로그 컨테이너 찾기(스크롤 주체)
  let container: HTMLElement | null = null
  for (let i = 0; i < 60; i++) {
    container = getLogContainer()
    if (container) break
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!container) return

  // 툴바 마운트 찾기
  let toolbar: HTMLElement | null = null
  for (let i = 0; i < 40; i++) {
    toolbar = getToolbarMount()
    if (toolbar) break
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!toolbar) return

  // 전송 외 버튼 숨기기
  hideNonSendChildren(toolbar)

  // 우리 UI 만들고 전송 앞에 삽입
  const { wrap, prevBtn, nextBtn, bottomBtn, preloadBtn, pageLabel } =
    makeInlineControlUI()
  insertUiBeforeSend(toolbar, wrap)
  applyToolbarLayout(toolbar, wrap)

  // Pager 생성 (20단위 고정)
  const pager = new Pager(container, pageLabel)

  // 초기: 상단 10회 프리로드(≈ 200개)
  await preloadTop(container, 10)

  // 이벤트 바인딩
  prevBtn.addEventListener("click", async () => {
    const target = pager.targetIndexFor("prev")
    if (target == null) return
    if (!findItemByIndex(container!, target)) await preloadTop(container!, 1)
    const el = findItemByIndex(container!, target)
    if (el) scrollToElement(container!, el)
    pager.updatePageNumber()
  })

  nextBtn.addEventListener("click", () => {
    const target = pager.targetIndexFor("next")
    if (target == null) return
    const el = findItemByIndex(container!, target)
    if (el) {
      scrollToElement(container!, el)
    } else {
      const ids = getLoadedIndices(container!)
      if (ids.length) {
        const max = ids[ids.length - 1]
        const near = findItemByIndex(container!, max)
        if (near) scrollToElement(container!, near)
      }
    }
    pager.updatePageNumber()
  })

  preloadBtn.addEventListener("click", async () => {
    await preloadTop(container!, 10)
    pager.updatePageNumber()
  })

  async function goBottom(container: HTMLElement) {
    // 1) 컨테이너 바닥까지 한두 번 스크롤해서 레이아웃 안정
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => setTimeout(r, 60))

    // 2) 현재 로딩된 아이템 중 최대 인덱스로 이동
    const ids = getLoadedIndices(container)
    if (!ids.length) return
    const max = ids[ids.length - 1]
    const el = findItemByIndex(container, max)
    if (el) scrollToElement(container, el)
  }

  // 이벤트 바인딩
  bottomBtn.addEventListener("click", async () => {
    await goBottom(container!)
    pager.updatePageNumber()
  })
  goBottom(container!)
}

boot()
