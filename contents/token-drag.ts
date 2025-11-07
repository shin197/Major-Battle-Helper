// src/contents/cocofolia-bulk-select-drag.v3.3.ts
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  all_frames: true,
  run_at: "document_idle"
}

const DEBUG = false
const USE_MOUSE_FALLBACK = true
const DRAG_THRESHOLD = 2

// --- 뷰 잠금 ---
const ENABLE_VIEW_LOCK = true
const FREEZE_WHEEL = true
const FREEZE_PAN = true
const FREEZE_KEY_ZOOM = true
const FREEZE_TOUCH_GESTURE = true
const BASE_ANIM_LOCK_MS = 50
const PER_FOLLOWER_ANIM_LOCK_MS = 50

const SIM_POINTER_ID = 1337

const TABLE_CONTAINER_SELECTOR =
  "#root > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div > div:nth-of-type(1)"
const PANEL_CONTAINER_SELECTOR =
  "#root > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div > div:nth-of-type(1) > div > div"
const MOVABLE_TOKEN = "movable"

const SELECTED_ATTR = "data-bulk-selected"
const DRAGGING_ATTR = "data-bulk-dragging"
const STYLE_ID = "plasmo-bulk-select-drag-style-v33"

const log = (...a: any[]) => DEBUG && console.log("[bulk-v3.3]", ...a)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** =========================
 *  DOM 유틸
 *  ========================= */
type SelectMode = "replace" | "add" | "subtract"

const selectPanel = (p: HTMLElement) => {
  selected.add(p)
  p.setAttribute(SELECTED_ATTR, "true")
  // 잠금 표시 갱신(있으면 빨간 점선)
  const locked = isPanelLocked(p)
  if (locked) p.setAttribute("data-bulk-locked", "")
  else p.removeAttribute("data-bulk-locked")
}

const deselectPanel = (p: HTMLElement) => {
  selected.delete(p)
  p.setAttribute(SELECTED_ATTR, "false")
  p.removeAttribute("data-bulk-locked")
}

const getContainer = (): HTMLElement | null =>
  document.querySelector(PANEL_CONTAINER_SELECTOR)

const getTable = (): HTMLElement | null =>
  document.querySelector(TABLE_CONTAINER_SELECTOR)

/** 이벤트가 지정 컨테이너 내부에서 발생했는가? */
const isEventInsideSelectionArea = (e: Event): boolean => {
  const c = getTable()
  if (!c) return false

  // 1) composedPath로 빠르게 확인(Shadow DOM 포함)
  const path = (e as any).composedPath?.() as EventTarget[] | undefined
  if (path && path.includes(c)) return true

  // 2) target → 부모 체인
  let n = e.target as Node | null
  while (n) {
    if (n === c) return true
    n = n.parentNode
  }

  // 3) 좌표로 컨테이너 사각형 히트 테스트 (fallback)
  const pe = e as PointerEvent
  if (typeof pe.clientX === "number") {
    const r = c.getBoundingClientRect()
    if (
      pe.clientX >= r.left &&
      pe.clientX <= r.right &&
      pe.clientY >= r.top &&
      pe.clientY <= r.bottom
    ) {
      return true
    }
  }
  return false
}

const isMovableClass = (el: Element | null) =>
  !!el &&
  el instanceof HTMLElement &&
  (el.className + "").includes(MOVABLE_TOKEN)

const getPanels = (): HTMLElement[] => {
  const c = getContainer()
  if (!c) return []
  return Array.from(c.children).filter(isMovableClass) as HTMLElement[]
}

const getPanelRoot = (t: EventTarget | null): HTMLElement | null => {
  const container = getContainer()
  if (!container) return null
  let el = t as Node | null
  while (el && el !== container && el !== document && el !== document.body) {
    if (
      el instanceof HTMLElement &&
      el.parentElement === container &&
      isMovableClass(el)
    ) {
      return el
    }
    el = el.parentNode
  }
  return null
}

const addGlobalStyle = () => {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
  [${SELECTED_ATTR}="true"]{ outline:2px dashed #4da3ff !important; outline-offset:2px; }
  .bulk-select-rect{ position:fixed; pointer-events:none; border:1px dashed #4da3ff; background:rgba(77,163,255,.12); z-index:2147483647; }
  .bulk-drag-layer{ position:fixed; inset:0; pointer-events:none; z-index:2147483647; }

  .bulk-select-rect.mod-subtract{ border-color:#ef4444; background:rgba(239,68,68,.12); }

  .bulk-drag-ghost{
    position: fixed;
    pointer-events:none;
    will-change: transform;
    box-shadow: 0 6px 16px rgba(0,0,0,0.18);
    border-radius: 6px;
    overflow: hidden;
    background: transparent;
    border: none;
  }
  .bulk-drag-ghost__img, .bulk-drag-ghost__bg {
    position:absolute; left:0; top:0; width:100%; height:100%;
    object-fit: cover; user-select:none; pointer-events:none;
    transform: translateZ(0);
  }
  .bulk-drag-ghost__img { image-rendering: auto; }

  .bulk-drag-ghost.is-fallback{
    border:1px dashed rgba(0,0,0,0.35);
    background: rgba(0,0,0,0.06);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  html[data-view-locked="true"], body[data-view-locked="true"]{
    overscroll-behavior: none !important;
    touch-action: none !important;
  }
  [${SELECTED_ATTR}="true"][data-bulk-locked]{
    outline: 2px dashed #ff6a6a !important;
    outline-offset: 2px;
  }
`

  document.head.appendChild(style)
}

const intersects = (a: DOMRect, b: DOMRect) =>
  !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )

/** =========================
 *  선택(휠 드래그)
 *  ========================= */
let selecting = false
let selectStart = { x: 0, y: 0 }
let selectRectEl: HTMLDivElement | null = null
let selectMode: SelectMode = "replace"

const selected = new Set<HTMLElement>()

const ensureSelectRect = () => {
  if (!selectRectEl) {
    selectRectEl = document.createElement("div")
    selectRectEl.className = "bulk-select-rect"
    document.body.appendChild(selectRectEl)
  }
  return selectRectEl
}
const showSelectRect = (x: number, y: number, w: number, h: number) => {
  const el = ensureSelectRect()
  el.style.display = "block"
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.width = `${w}px`
  el.style.height = `${h}px`
}
const hideSelectRect = () => {
  if (selectRectEl) selectRectEl.style.display = "none"
}

const updateSelectionByRect = (rect: DOMRect, mode: SelectMode = "replace") => {
  getPanels().forEach((p) => {
    const pr = p.getBoundingClientRect()
    const hit = intersects(rect, pr)

    // 잠금 마크 갱신(있으면 빨간 점선)
    const locked = isPanelLocked(p)
    if (locked) p.setAttribute("data-bulk-locked", "")
    else p.removeAttribute("data-bulk-locked")

    if (mode === "replace") {
      if (hit) {
        if (!selected.has(p)) selectPanel(p)
      } else {
        if (selected.has(p)) deselectPanel(p)
      }
    } else if (mode === "add") {
      if (hit && !selected.has(p)) selectPanel(p)
      // 히트 안 되면 아무 것도 안 함
    } else {
      // mode === "subtract"
      if (hit && selected.has(p)) deselectPanel(p)
      // 히트 안 되면 아무 것도 안 함
    }
  })
}

const clearSelection = () => {
  selected.forEach((el) => {
    el.setAttribute(SELECTED_ATTR, "false")
    el.removeAttribute("data-bulk-locked")
  })
  selected.clear()
}

const startRectSelection = (
  e: MouseEvent | PointerEvent,
  mode: SelectMode = "replace"
) => {
  selecting = true
  selectMode = mode
  selectStart = { x: e.clientX, y: e.clientY }

  const el = ensureSelectRect()
  // 모드별 색상 표시(옵션: CSS에 클래스 정의, 아래 5번 참고)
  el.classList.toggle("mod-add", mode === "add")
  el.classList.toggle("mod-subtract", mode === "subtract")

  showSelectRect(selectStart.x, selectStart.y, 0, 0)
}

const updateRectSelection = (e: MouseEvent | PointerEvent) => {
  const x1 = selectStart.x,
    y1 = selectStart.y
  const x2 = e.clientX,
    y2 = e.clientY
  const left = Math.min(x1, x2),
    top = Math.min(y1, y2)
  const width = Math.abs(x1 - x2),
    height = Math.abs(y1 - y2)
  showSelectRect(left, top, width, height)
  updateSelectionByRect(new DOMRect(left, top, width, height), selectMode)
}

const endRectSelection = () => {
  selecting = false
  hideSelectRect()
  selectMode = "replace" // 기본값 복귀
}

/** =========================
 *  그룹 드래그 + 뷰 잠금
 *  ========================= */
let groupDragging = false
let dragLeader: HTMLElement | null = null
let dragStart = { x: 0, y: 0 }
let dragDelta = { x: 0, y: 0 }
let leaderStartRect: DOMRect | null = null

let dragLayer: HTMLDivElement | null = null
const followerGhosts = new Map<HTMLElement, HTMLDivElement>()

let SIMULATING_FOLLOWERS = false
let dropTxnId = 0

type LockReason = "drag" | "sim" | "anim"
const activeLocks = new Set<LockReason>()
let viewLocked = false

let suppressNextClick = false

const setHtmlLockAttr = (on: boolean) => {
  const v = on ? "true" : "false"
  document.documentElement.setAttribute("data-view-locked", v)
  document.body?.setAttribute("data-view-locked", v)
}

const isBlockingPointerMove = () =>
  // ★ 드래그(리더) 중엔 막지 않고, 시뮬·애니메이션 중에만 막음
  activeLocks.has("sim") || activeLocks.has("anim")

const lockHandlers = {
  wheel(e: WheelEvent) {
    if (!viewLocked || !FREEZE_WHEEL) return
    e.stopImmediatePropagation()
    e.stopPropagation()
    e.preventDefault()
  },
  gesture(e: Event) {
    if (!viewLocked || !FREEZE_TOUCH_GESTURE) return
    e.stopImmediatePropagation()
    e.stopPropagation()
    e.preventDefault()
  },
  touchmove(e: TouchEvent) {
    if (!viewLocked || !FREEZE_TOUCH_GESTURE) return
    if (e.touches.length >= 2 || e.ctrlKey) {
      e.stopImmediatePropagation()
      e.stopPropagation()
      e.preventDefault()
    }
  },
  keydown(e: KeyboardEvent) {
    if (!viewLocked || !FREEZE_KEY_ZOOM) return
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "+" ||
        e.key === "-" ||
        e.key === "0" ||
        e.code === "Equal" ||
        e.code === "Minus" ||
        e.code === "Digit0" ||
        e.code === "NumpadAdd" ||
        e.code === "NumpadSubtract" ||
        e.code === "Numpad0")
    ) {
      e.stopImmediatePropagation()
      e.stopPropagation()
      e.preventDefault()
    }
  },
  pointerdown(e: PointerEvent) {
    if (!viewLocked || !FREEZE_PAN) return
    if (e.button === 1) {
      e.stopImmediatePropagation()
      e.stopPropagation()
      e.preventDefault()
    }
  },
  contextmenu(e: MouseEvent) {
    if (!viewLocked) return
    e.stopImmediatePropagation()
    e.stopPropagation()
    e.preventDefault()
  },
  // ★ 핵심: 시뮬/애니메이션 중의 실제 move 차단
  pointermove(e: PointerEvent) {
    if (!viewLocked) return
    if (isBlockingPointerMove() && e.isTrusted) {
      e.stopImmediatePropagation()
      e.stopPropagation()
      e.preventDefault()
    }
  },
  mousemove(e: MouseEvent) {
    if (!viewLocked) return
    if (isBlockingPointerMove() && e.isTrusted) {
      e.stopImmediatePropagation()
      e.stopPropagation()
      e.preventDefault()
    }
  }
}

const attachViewLockListeners = () => {
  window.addEventListener("wheel", lockHandlers.wheel, {
    capture: true,
    passive: false
  })
  window.addEventListener("gesturestart", lockHandlers.gesture as any, {
    capture: true,
    passive: false
  })
  window.addEventListener("gesturechange", lockHandlers.gesture as any, {
    capture: true,
    passive: false
  })
  window.addEventListener("gestureend", lockHandlers.gesture as any, {
    capture: true,
    passive: false
  })
  window.addEventListener("touchmove", lockHandlers.touchmove, {
    capture: true,
    passive: false
  })
  window.addEventListener("keydown", lockHandlers.keydown, { capture: true })
  window.addEventListener("pointerdown", lockHandlers.pointerdown, {
    capture: true
  })
  window.addEventListener("contextmenu", lockHandlers.contextmenu, {
    capture: true
  })
  // ★ move 차단 리스너
  window.addEventListener("pointermove", lockHandlers.pointermove, {
    capture: true,
    passive: false
  })
  window.addEventListener("mousemove", lockHandlers.mousemove, {
    capture: true,
    passive: false
  })
}
const detachViewLockListeners = () => {
  window.removeEventListener("wheel", lockHandlers.wheel, {
    capture: true
  } as any)
  window.removeEventListener(
    "gesturestart",
    lockHandlers.gesture as any,
    { capture: true } as any
  )
  window.removeEventListener(
    "gesturechange",
    lockHandlers.gesture as any,
    { capture: true } as any
  )
  window.removeEventListener(
    "gestureend",
    lockHandlers.gesture as any,
    { capture: true } as any
  )
  window.removeEventListener("touchmove", lockHandlers.touchmove, {
    capture: true
  } as any)
  window.removeEventListener("keydown", lockHandlers.keydown, {
    capture: true
  } as any)
  window.removeEventListener("pointerdown", lockHandlers.pointerdown, {
    capture: true
  } as any)
  window.removeEventListener("contextmenu", lockHandlers.contextmenu, {
    capture: true
  } as any)
  window.removeEventListener("pointermove", lockHandlers.pointermove, {
    capture: true
  } as any)
  window.removeEventListener("mousemove", lockHandlers.mousemove, {
    capture: true
  } as any)
}

const enableViewLock = (reason: LockReason) => {
  if (!ENABLE_VIEW_LOCK) return
  activeLocks.add(reason)
  if (!viewLocked) {
    viewLocked = true
    setHtmlLockAttr(true)
    attachViewLockListeners()
    log("view lock ON", Array.from(activeLocks))
  }
}
const disableViewLock = (reason: LockReason) => {
  if (!ENABLE_VIEW_LOCK) return
  activeLocks.delete(reason)
  if (activeLocks.size === 0 && viewLocked) {
    viewLocked = false
    setHtmlLockAttr(false)
    detachViewLockListeners()
    log("view lock OFF")
  } else {
    log("view lock still ON", Array.from(activeLocks))
  }
}
const computeAnimationLockMs = (followerCount: number) =>
  BASE_ANIM_LOCK_MS + PER_FOLLOWER_ANIM_LOCK_MS * followerCount

// ---- 유령 레이어 ----
const ensureDragLayer = () => {
  if (!dragLayer) {
    dragLayer = document.createElement("div")
    dragLayer.className = "bulk-drag-layer"
    document.body.appendChild(dragLayer)
  }
  return dragLayer
}
const createGhost = (panel: HTMLElement) => {
  const r = panel.getBoundingClientRect()
  const ghost = document.createElement("div")
  ghost.className = "bulk-drag-ghost"
  ghost.style.left = `${r.left}px`
  ghost.style.top = `${r.top}px`
  ghost.style.width = `${r.width}px`
  ghost.style.height = `${r.height}px`

  const preview = findPreviewSource(panel)
  if (preview) {
    if (preview.type === "img") {
      const img = document.createElement("img")
      img.className = "bulk-drag-ghost__img"
      img.src = preview.src
      img.alt = ""
      img.draggable = false
      ghost.appendChild(img)
    } else {
      const bg = document.createElement("div")
      bg.className = "bulk-drag-ghost__bg"
      bg.style.backgroundImage = `url("${preview.src}")`
      bg.style.backgroundSize = "cover"
      bg.style.backgroundPosition = "center center"
      ghost.appendChild(bg)
    }
  } else {
    // ⛑️ 프리뷰 소스가 없으면 기존 점선 박스로 폴백
    ghost.classList.add("is-fallback")
  }

  ensureDragLayer().appendChild(ghost)
  return ghost
}

const createFollowerGhosts = () => {
  followerGhosts.clear()
  // ✅ 잠금 패널은 유령 박스도 만들지 않음
  getFollowers().forEach((f) => followerGhosts.set(f, createGhost(f)))
}

const clearGhosts = () => {
  followerGhosts.forEach((g) => g.remove())
  followerGhosts.clear()
  if (dragLayer) {
    dragLayer.remove()
    dragLayer = null
  }
}
const updateGhostPositions = (dx: number, dy: number) => {
  followerGhosts.forEach((ghost) => {
    ghost.style.transform = `translate(${dx}px, ${dy}px)`
  })
}
const getFollowers = () => {
  if (!dragLeader) return []
  // 리더 제외 + 잠금 패널 제외
  return Array.from(selected).filter(
    (p) => p !== dragLeader && isFollowerEligible(p)
  )
}

const beginGroupDrag = (
  leader: HTMLElement,
  startX: number,
  startY: number
) => {
  if (!selected.has(leader) || selected.size <= 1) return
  // ✅ 리더가 잠금이면 시작 자체를 막음(원래 dnd도 안 될 가능성이 큼)
  if (isPanelLocked(leader)) return
  if (groupDragging) return
  groupDragging = true
  dragLeader = leader
  dragStart = { x: startX, y: startY }
  dragDelta = { x: 0, y: 0 }
  leaderStartRect = leader.getBoundingClientRect()
  createFollowerGhosts()
  document.body.setAttribute(DRAGGING_ATTR, "true")
  enableViewLock("drag")
  log("group drag begin, followers:", getFollowers().length)
}
const moveGroupDrag = (x: number, y: number) => {
  dragDelta = { x: x - dragStart.x, y: y - dragStart.y }
  updateGhostPositions(dragDelta.x, dragDelta.y)
}
const finishGroupDrag = async () => {
  const myTxn = ++dropTxnId
  groupDragging = false

  await sleep(2)

  // 리더 실제 Δ
  let dx = dragDelta.x,
    dy = dragDelta.y
  if (dragLeader && leaderStartRect) {
    const after = dragLeader.getBoundingClientRect()
    dx = Math.round(after.left - leaderStartRect.left)
    dy = Math.round(after.top - leaderStartRect.top)
    log("actual Δ", dx, dy, "pointer Δ", dragDelta.x, dragDelta.y)
  }

  const followers = getFollowers()
  clearGhosts()
  document.body.removeAttribute(DRAGGING_ATTR)

  // 시뮬 동안 화면/마우스 move 차단
  enableViewLock("sim")
  SIMULATING_FOLLOWERS = true
  try {
    for (const f of followers) {
      if (myTxn !== dropTxnId) break
      await simulateDndDrag(f, dx, dy)
      await sleep(2)
    }
  } finally {
    SIMULATING_FOLLOWERS = false
    disableViewLock("sim")
    dragLeader = null
    dragDelta = { x: 0, y: 0 }
    leaderStartRect = null

    // 애니메이션 시간 = 50 + 50*팔로워수
    enableViewLock("anim")
    await sleep(computeAnimationLockMs(followers.length))
    disableViewLock("anim")

    disableViewLock("drag")
  }
}

/** =========================
 *  DnD 시뮬레이터 (pointerId 분리)
 *  ========================= */
const elementPointIn = (root: Element, x: number, y: number): Element => {
  const hit = document.elementFromPoint(x, y)
  if (hit && (root === hit || root.contains(hit))) return hit
  return root
}
const findHandleCandidate = (panel: HTMLElement): HTMLElement => {
  const injected = (window as any).__ccfBulkDragHandleSelector as
    | string
    | undefined
  const selectors = injected
    ? [injected]
    : [
        "*[data-dnd]",
        "*[data-dnd-kit-handle]",
        "*[data-dnd-handle]",
        "*[data-drag-handle]",
        "[draggable='true']",
        "[role='button']",
        "*[class*='handle']"
      ]
  for (const sel of selectors) {
    const h = panel.querySelector(sel)
    if (h && h instanceof HTMLElement) return h
  }
  return panel
}
/** 패널에서 가장 "그럴듯한" 이미지 소스를 찾는다. (img 우선, 없으면 background-image) */
const findPreviewSource = (
  panel: HTMLElement
): { type: "img"; src: string } | { type: "bg"; src: string } | null => {
  // 1) 가장 큰 <img src> 찾기
  const imgs = Array.from(
    panel.querySelectorAll("img[src]")
  ) as HTMLImageElement[]
  if (imgs.length) {
    let best: HTMLImageElement | null = null
    let bestArea = -1
    for (const im of imgs) {
      const r = im.getBoundingClientRect()
      const area = Math.max(1, r.width) * Math.max(1, r.height)
      if (area > bestArea) {
        bestArea = area
        best = im
      }
    }
    if (best) return { type: "img", src: best.currentSrc || best.src }
  }

  // 2) background-image 탐색 (얕은 탐색)
  const MAX_SCAN = 30
  const queue: HTMLElement[] = [panel]
  let scanned = 0
  while (queue.length && scanned < MAX_SCAN) {
    const el = queue.shift()!
    scanned++
    const bg = getComputedStyle(el).backgroundImage
    // background-image: url("..."), 다중일 경우 첫 URL 사용
    const m =
      bg && bg.includes("url(") ? bg.match(/url\\(["']?(.*?)["']?\\)/) : null
    if (m && m[1]) return { type: "bg", src: m[1] }
    // 자식도 살펴보되 너무 깊이 안 들어감
    for (const c of Array.from(el.children))
      if (c instanceof HTMLElement) queue.push(c)
  }

  return null
}

/** 패널이 드래그 불가(잠금)인지 판별 */
const isPanelLocked = (panel: HTMLElement): boolean => {
  const handle = findHandleCandidate(panel)
  // 핸들 자체 또는 상위에 aria-disabled="true"가 있으면 드래그 금지로 간주
  if (handle.getAttribute("aria-disabled") === "true") return true
  const disabledAncestor = handle.closest('[aria-disabled="true"]')
  if (disabledAncestor) return true
  return false
}

/** 팔로워로 사용할 수 있는지 (= 잠금 아님) */
const isFollowerEligible = (panel: HTMLElement): boolean =>
  !isPanelLocked(panel)

// ★ pointerId를 SIM_POINTER_ID로 고정해서 실제 마우스(pointerId=1)와 분리
const dispatchPointerAll = (
  target: Element,
  type: string,
  x: number,
  y: number,
  opts: Partial<PointerEventInit> = {}
) => {
  const common: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerType: "mouse",
    isPrimary: true,
    pointerId: SIM_POINTER_ID,
    clientX: x,
    clientY: y,
    button: opts.button ?? 0,
    buttons: opts.buttons ?? (type === "pointerup" ? 0 : 1),
    pressure: type === "pointerup" ? 0 : 0.5,
    width: 1,
    height: 1
  }
  target.dispatchEvent(new PointerEvent(type, common))
  document.documentElement.dispatchEvent(new PointerEvent(type, common))
  window.dispatchEvent(new PointerEvent(type, common as any))
}

const dispatchMouseAll = (
  target: Element,
  type: string,
  x: number,
  y: number,
  opts: MouseEventInit = {}
) => {
  const common: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    button: opts.button ?? 0,
    buttons: opts.buttons ?? (type === "mouseup" ? 0 : 1)
  }
  target.dispatchEvent(new MouseEvent(type, common))
  document.documentElement.dispatchEvent(new MouseEvent(type, common))
  window.dispatchEvent(new MouseEvent(type, common))
}

const simulateDndDrag = async (panel: HTMLElement, dx: number, dy: number) => {
  const handle = findHandleCandidate(panel)
  const hr = handle.getBoundingClientRect()
  const startX = Math.round(hr.left + hr.width / 2)
  const startY = Math.round(hr.top + hr.height / 2)
  const endX = startX + Math.round(dx)
  const endY = startY + Math.round(dy)

  const t0 = elementPointIn(handle, startX, startY)

  // down
  dispatchPointerAll(t0, "pointerdown", startX, startY, { button: 0 })
  if (USE_MOUSE_FALLBACK)
    dispatchMouseAll(t0, "mousedown", startX, startY, { button: 0 })
  await sleep(12)

  // move
  const steps = Math.max(14, Math.ceil(Math.hypot(dx, dy) / 10))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const mx = Math.round(startX + (endX - startX) * t)
    const my = Math.round(startY + (endY - startY) * t)
    const mt = elementPointIn(handle, mx, my)
    dispatchPointerAll(mt, "pointermove", mx, my, { buttons: 1 })
    if (USE_MOUSE_FALLBACK) dispatchMouseAll(mt, "mousemove", mx, my)
    await sleep(5)
  }

  // up
  const t1 = elementPointIn(handle, endX, endY)
  dispatchPointerAll(t1, "pointerup", endX, endY, { button: 0 })
  if (USE_MOUSE_FALLBACK)
    dispatchMouseAll(t1, "mouseup", endX, endY, { button: 0 })
}

/** =========================
 *  핸들러 (synthetic 무시 + 가드)
 *  ========================= */
const onPointerDown = (e: PointerEvent) => {
  if (!e.isTrusted || SIMULATING_FOLLOWERS) return

  if (e.button === 1) {
    if (!isEventInsideSelectionArea(e)) return // 밖이면 아무 것도 하지 않음
    e.preventDefault()
    const mode: SelectMode = e.shiftKey
      ? "subtract"
      : e.ctrlKey
        ? "add"
        : "replace"
    startRectSelection(e, mode)
    return
  }

  if (e.button === 0 && e.ctrlKey) {
    if (!isEventInsideSelectionArea(e)) return // 밖이면 아무 것도 하지 않음
    const root = getPanelRoot(e.target)
    if (root) {
      e.preventDefault()
      e.stopImmediatePropagation()
      e.stopPropagation()
      // 드래그 중이면 토글 금지
      if (!groupDragging && !selecting) {
        if (selected.has(root)) deselectPanel(root)
        else selectPanel(root)
        suppressNextClick = true
      }
      return
    }
  }
  if (e.button === 0) {
    const root = getPanelRoot(e.target)
    if (root && selected.has(root) && selected.size > 1) {
      beginGroupDrag(root, e.clientX, e.clientY)
    } else if (!selecting) {
      if (!root) clearSelection()
    }
  }
}
const onPointerMove = (e: PointerEvent) => {
  if (!e.isTrusted || SIMULATING_FOLLOWERS) return
  if (selecting) {
    updateRectSelection(e)
    return
  }
  if (groupDragging) {
    const dx = e.clientX - dragStart.x,
      dy = e.clientY - dragStart.y
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
    moveGroupDrag(e.clientX, e.clientY)
  }
}
const onPointerUp = (e: PointerEvent) => {
  if (!e.isTrusted || SIMULATING_FOLLOWERS) return
  if (e.button === 1 && selecting) {
    endRectSelection()
    return
  }
  if (groupDragging && e.button === 0) {
    void finishGroupDrag()
  }
}
const onMouseDown = (e: MouseEvent) => {
  if (!e.isTrusted || SIMULATING_FOLLOWERS) return
  if (e.button === 1) {
    if (!isEventInsideSelectionArea(e)) return // 밖이면 아무 것도 하지 않음
    e.preventDefault()
  }
}
const onKeyDown = (e: KeyboardEvent) => {
  if (!e.isTrusted || SIMULATING_FOLLOWERS) return
  if (e.key === "Escape") {
    if (selecting) endRectSelection()
    if (groupDragging) {
      clearGhosts()
      groupDragging = false
      dragLeader = null
    }
    clearSelection()
  }
}

/** =========================
 *  초기화
 *  ========================= */
const onClickCapture = (e: MouseEvent) => {
  if (suppressNextClick) {
    e.preventDefault()
    e.stopImmediatePropagation()
    e.stopPropagation()
    suppressNextClick = false
  }
}

const attach = () => {
  addGlobalStyle()
  window.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("pointermove", onPointerMove, true)
  window.addEventListener("pointerup", onPointerUp, true)
  window.addEventListener("mousedown", onMouseDown, true)
  window.addEventListener("keydown", onKeyDown, true)
  window.addEventListener("click", onClickCapture, true)
  log("attached")
}
const waitContainerAndAttach = () => {
  const c = getContainer()
  if (c) return attach()
  const mo = new MutationObserver(() => {
    if (getContainer()) {
      attach()
      mo.disconnect()
    }
  })
  mo.observe(document.documentElement, { childList: true, subtree: true })
  setTimeout(() => {
    if (!getContainer()) attach()
  }, 8000)
}
waitContainerAndAttach()
export {}
