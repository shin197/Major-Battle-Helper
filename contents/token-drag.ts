import type { PlasmoCSConfig } from "plasmo"

import { findItemIdFromDom, findReactProps } from "~utils/token"
import { sleep } from "~utils/utils"

import { ccf } from "./ccfolia-api"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  all_frames: true,
  run_at: "document_idle",
  world: "MAIN" // 👈 💡 이 한 줄을 추가해서 MAIN world에서 실행되도록 만듭니다!
}

const DRAG_THRESHOLD = 2
const GRID_SIZE = 24 // 코코포리아의 1 그리드 유닛 = 24px

const TABLE_CONTAINER_SELECTOR =
  "#root > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div > div:nth-of-type(1)"
const PANEL_CONTAINER_SELECTOR =
  "#root > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div > div:nth-of-type(1) > div > div"
const MOVABLE_TOKEN = "movable"

const SELECTED_ATTR = "data-bulk-selected"
const DRAGGING_ATTR = "data-bulk-dragging"
const STYLE_ID = "plasmo-bulk-select-drag-style-v33"

/** =========================
 * 🚨 [핵심 개선] 강력한 ID 추출 래퍼 함수
 * ========================= */
const getPanelId = (target: HTMLElement | null): string | null => {
  if (!target) return null

  // 1. 기존 utils/token.ts의 React Fiber 탐색 (인스펙터 검증 완료)
  const fiberId = findItemIdFromDom(target)
  if (fiberId) return fiberId

  // 2. DOM Dataset 속성 강제 탐색 (inject-copy-faces.ts 에서 발견한 완벽한 힌트!)
  let curr: HTMLElement | null = target
  while (curr && curr !== document.body) {
    const id =
      curr.dataset.characterId ||
      curr.dataset.itemId ||
      curr.dataset.markerId ||
      curr.dataset.diceId ||
      curr.dataset.deckId ||
      curr.dataset.id ||
      curr.getAttribute("data-id") ||
      curr.getAttribute("data-character-id")

    if (id && typeof id === "string" && id.trim() !== "") {
      return id
    }
    curr = curr.parentElement
  }

  return null
}

const extractIdRobustly = (
  target: HTMLElement,
  root: HTMLElement
): string | null => {
  // 1. 기존 방식: 클릭한 요소에서 위로(Up) 탐색
  let id = findItemIdFromDom(target)
  if (id) return id

  // 2. 새로운 방식: 실패 시, 패널(root) 내부의 모든 자식(Down)을 샅샅이 탐색
  const children = root.querySelectorAll("*")
  for (const child of Array.from(children)) {
    const fiber = findReactProps(child as HTMLElement)
    if (fiber) {
      let node = fiber
      let depth = 0
      while (node && depth < 10) {
        // 적당한 상위 컴포넌트까지 탐색
        const props = node.memoizedProps
        if (props) {
          const foundId =
            props.itemId ||
            props.characterId ||
            props.diceId ||
            props.deckId ||
            props.markerId ||
            (typeof props.draggableId === "string" ? props.draggableId : null)
          if (foundId) return foundId
        }
        node = node.return
        depth++
      }
    }
  }
  return null
}

/** =========================
 * 강력한 ID 교차 검증 유틸
 * ========================= */
const fetchTokenData = async (domId: string) => {
  const allTokens = await ccf.tokens.getAll()
  return allTokens.find((t: any) => {
    const tid = t.id || t._id
    if (!tid) return false
    return domId.includes(tid) || tid.includes(domId)
  })
}

/** =========================
 * DOM 유틸
 * ========================= */
type SelectMode = "replace" | "add" | "subtract"

const selectPanel = (p: HTMLElement) => {
  selected.add(p)
  p.setAttribute(SELECTED_ATTR, "true")
  if (isPanelLocked(p)) p.setAttribute("data-bulk-locked", "")
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

const isEventInsideSelectionArea = (e: Event): boolean => {
  const c = getTable()
  if (!c) return false
  const path = (e as any).composedPath?.() as EventTarget[] | undefined
  if (path && path.includes(c)) return true
  let n = e.target as Node | null
  while (n) {
    if (n === c) return true
    n = n.parentNode
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
    position: fixed; pointer-events:none; will-change: transform;
    box-shadow: 0 6px 16px rgba(0,0,0,0.18); border-radius: 6px; overflow: hidden;
  }
  .bulk-drag-ghost__img, .bulk-drag-ghost__bg {
    position:absolute; left:0; top:0; width:100%; height:100%;
    object-fit: cover; user-select:none; pointer-events:none; transform: translateZ(0);
  }
  .bulk-drag-ghost.is-fallback{
    border:1px dashed rgba(0,0,0,0.35); background: rgba(0,0,0,0.06); box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  [${SELECTED_ATTR}="true"][data-bulk-locked]{ outline: 2px dashed #ff6a6a !important; outline-offset: 2px; }
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
 * 선택(휠 드래그)
 * ========================= */
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
    const hit = intersects(rect, p.getBoundingClientRect())
    if (isPanelLocked(p)) p.setAttribute("data-bulk-locked", "")
    else p.removeAttribute("data-bulk-locked")

    if (mode === "replace") {
      if (hit) {
        if (!selected.has(p)) selectPanel(p)
      } else {
        if (selected.has(p)) deselectPanel(p)
      }
    } else if (mode === "add") {
      if (hit && !selected.has(p)) selectPanel(p)
    } else {
      if (hit && selected.has(p)) deselectPanel(p)
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
  el.classList.toggle("mod-add", mode === "add")
  el.classList.toggle("mod-subtract", mode === "subtract")
  showSelectRect(selectStart.x, selectStart.y, 0, 0)
}

const updateRectSelection = (e: MouseEvent | PointerEvent) => {
  const left = Math.min(selectStart.x, e.clientX)
  const top = Math.min(selectStart.y, e.clientY)
  const width = Math.abs(selectStart.x - e.clientX)
  const height = Math.abs(selectStart.y - e.clientY)
  showSelectRect(left, top, width, height)
  updateSelectionByRect(new DOMRect(left, top, width, height), selectMode)
}

const endRectSelection = () => {
  selecting = false
  hideSelectRect()
  selectMode = "replace"
}

/** =========================
 * 그룹 드래그 (API 방식)
 * ========================= */
let groupDragging = false
let dragLeader: HTMLElement | null = null
let dragStart = { x: 0, y: 0 }
let dragLayer: HTMLDivElement | null = null
const followerGhosts = new Map<HTMLElement, HTMLDivElement>()

let leaderStartDataPromise: Promise<any> | null = null
let currentLeaderId: string | null = null
let activeFollowerIds: string[] = []

let suppressNextClick = false

const ensureDragLayer = () => {
  if (!dragLayer) {
    dragLayer = document.createElement("div")
    dragLayer.className = "bulk-drag-layer"
    document.body.appendChild(dragLayer)
  }
  return dragLayer
}

const findPreviewSource = (
  panel: HTMLElement
): { type: "img"; src: string } | null => {
  const imgs = Array.from(
    panel.querySelectorAll("img[src]")
  ) as HTMLImageElement[]
  if (imgs.length)
    return { type: "img", src: imgs[0].currentSrc || imgs[0].src }
  return null
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
    const img = document.createElement("img")
    img.className = "bulk-drag-ghost__img"
    img.src = preview.src
    ghost.appendChild(img)
  } else {
    ghost.classList.add("is-fallback")
  }

  ensureDragLayer().appendChild(ghost)
  return ghost
}

const createFollowerGhosts = () => {
  followerGhosts.clear()
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

const isPanelLocked = (panel: HTMLElement): boolean => {
  return !!panel.querySelector('[aria-disabled="true"]')
}

const getFollowers = () => {
  if (!dragLeader) return []
  return Array.from(selected).filter(
    (p) => p !== dragLeader && !isPanelLocked(p)
  )
}

const beginGroupDrag = (
  leader: HTMLElement,
  leaderId: string,
  startX: number,
  startY: number
) => {
  if (!selected.has(leader) || selected.size <= 1) return
  if (isPanelLocked(leader)) return
  if (groupDragging) return

  // console.log(`[API Drag] 🚀 그룹 드래그 시작! 리더 DOM ID: ${leaderId}`)

  groupDragging = true
  dragLeader = leader
  dragStart = { x: startX, y: startY }
  currentLeaderId = leaderId

  activeFollowerIds = getFollowers()
    .map((f) => getPanelId(f))
    .filter(Boolean) as string[]

  createFollowerGhosts()
  document.body.setAttribute(DRAGGING_ATTR, "true")

  leaderStartDataPromise = fetchTokenData(leaderId)
}

const moveGroupDrag = (x: number, y: number) => {
  updateGhostPositions(x - dragStart.x, y - dragStart.y)
}

const finishGroupDrag = async () => {
  // console.log("[API Drag] 🛑 마우스 뗌 감지, API 처리 시작")
  groupDragging = false
  clearGhosts()
  document.body.removeAttribute(DRAGGING_ATTR)

  if (!currentLeaderId || !leaderStartDataPromise) {
    // console.warn("[API Drag] 리더 정보가 누락되어 중단합니다.")
    return
  }

  try {
    const leaderStartData = await leaderStartDataPromise
    if (!leaderStartData) {
      // console.warn(
      //   `[API Drag] 리더(${currentLeaderId})의 초기 데이터를 가져오지 못했습니다.`
      // )
      return
    }

    let leaderEndData = await fetchTokenData(currentLeaderId)
    let dx = (leaderEndData?.x || 0) - leaderStartData.x
    let dy = (leaderEndData?.y || 0) - leaderStartData.y

    let attempts = 0
    while (dx === 0 && dy === 0 && attempts < 20) {
      await sleep(50)
      leaderEndData = await fetchTokenData(currentLeaderId)
      if (!leaderEndData) break
      dx = leaderEndData.x - leaderStartData.x
      dy = leaderEndData.y - leaderStartData.y
      attempts++
    }

    if (dx === 0 && dy === 0) {
      // console.log("[API Drag] 토큰이 이동하지 않아 단체 이동을 취소합니다.")
      return
    }

    const isPixelUnit = (type: string) => type === "roomCharacter"
    const leaderType = leaderStartData._type

    let pixelDx = 0,
      pixelDy = 0
    if (isPixelUnit(leaderType)) {
      pixelDx = dx
      pixelDy = dy
    } else {
      pixelDx = dx * GRID_SIZE
      pixelDy = dy * GRID_SIZE
    }

    // console.log(
    //   `[API Drag] 📍 리더 실제 이동량 - Grid 변위: ${dx},${dy} / Pixel 변위: ${pixelDx},${pixelDy}`
    // )

    const patchPromises = activeFollowerIds.map(async (fid) => {
      const fData = await fetchTokenData(fid)
      if (!fData) return

      const fType = fData._type
      let applyDx = pixelDx
      let applyDy = pixelDy

      if (!isPixelUnit(fType)) {
        applyDx = Math.round(pixelDx / GRID_SIZE)
        applyDy = Math.round(pixelDy / GRID_SIZE)
      }

      const targetId = fData.id || fData._id
      return ccf.tokens.patch(targetId, {
        x: fData.x + applyDx,
        y: fData.y + applyDy
      })
    })

    await Promise.all(patchPromises)
    // console.log(
    //   `[API Drag] ✅ ${activeFollowerIds.length}개 토큰 단체 이동 완료!`
    // )
  } catch (error) {
    // console.error("[API Drag] 단체 드래그 API 적용 중 오류:", error)
  } finally {
    dragLeader = null
    currentLeaderId = null
    activeFollowerIds = []
    leaderStartDataPromise = null
  }
}

/** =========================
 * 핸들러
 * ========================= */

const onPointerDown = (e: PointerEvent) => {
  if (!e.isTrusted) return

  if (e.button === 1) {
    if (!isEventInsideSelectionArea(e)) return
    e.preventDefault()
    startRectSelection(
      e,
      e.shiftKey ? "subtract" : e.ctrlKey ? "add" : "replace"
    )
    return
  }

  if (e.button === 0 && e.ctrlKey) {
    if (!isEventInsideSelectionArea(e)) return
    const root = getPanelRoot(e.target)
    if (root) {
      e.preventDefault()
      e.stopImmediatePropagation()
      e.stopPropagation()
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
      // 💡 여기서 새로운 양방향 탐색 함수를 사용합니다!
      const leaderId = extractIdRobustly(e.target as HTMLElement, root)

      if (leaderId) {
        beginGroupDrag(root, leaderId, e.clientX, e.clientY)
      } else {
        // 이제 여기로 떨어질 확률은 0%에 가깝습니다.
        // console.warn(
        //   "[API Drag] ❌ 클릭한 패널에서 ID를 완전히 찾지 못했습니다.",
        //   root
        // )
      }
    } else if (!selecting) {
      if (!root) clearSelection()
    }
  }
}

const onPointerMove = (e: PointerEvent) => {
  if (!e.isTrusted) return
  if (selecting) {
    updateRectSelection(e)
    return
  }
  if (groupDragging) {
    if (
      Math.abs(e.clientX - dragStart.x) < DRAG_THRESHOLD &&
      Math.abs(e.clientY - dragStart.y) < DRAG_THRESHOLD
    )
      return
    moveGroupDrag(e.clientX, e.clientY)
  }
}

const onPointerUp = (e: PointerEvent) => {
  if (!e.isTrusted) return
  if (e.button === 1 && selecting) {
    endRectSelection()
    return
  }
  if (groupDragging && e.button === 0) void finishGroupDrag()
}

const onMouseDown = (e: MouseEvent) => {
  if (!e.isTrusted) return
  if (e.button === 1) {
    if (!isEventInsideSelectionArea(e)) return
    e.preventDefault()
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  if (!e.isTrusted) return
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
  // console.log("[API Drag] 스크립트 연결 완료")
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
