import { ccf } from "../core/isolated/ccfolia-api"
import { findItemIdFromDom } from "../utils/main/token"
import { sleep } from "../utils/utils"

const DRAG_THRESHOLD = 2
const GRID_SIZE = 24

const SELECTED_ATTR = "data-bulk-selected"
const DRAGGING_ATTR = "data-bulk-dragging"
const STYLE_ID = "plasmo-bulk-select-drag-style-v33"

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
 * DOM 유틸 (roledescription 기반)
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

const getPanels = (): HTMLElement[] => {
  return Array.from(
    document.querySelectorAll('[aria-roledescription="draggable"]')
  ) as HTMLElement[]
}

const getPanelRoot = (t: EventTarget | null): HTMLElement | null => {
  if (!(t instanceof Element)) return null
  return t.closest('[aria-roledescription="draggable"]') as HTMLElement | null
}

const isEventInsideSelectionArea = (e: Event): boolean => {
  if (!(e.target instanceof Element)) return false
  const isUI = e.target.closest(
    ".MuiDialog-root, .MuiPopover-root, .MuiMenu-root, .MuiDrawer-root, input, textarea, button"
  )
  if (isUI) return false
  return true
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
 * 선택(휠 드래그) 박스
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
 * 그룹 드래그 (Batch API 방식)
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
  return (
    panel.getAttribute("aria-disabled") === "true" ||
    !!panel.querySelector('[aria-disabled="true"]')
  )
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

  console.log(`[API Drag] 🚀 그룹 드래그 시작! 리더 DOM ID: ${leaderId}`)

  groupDragging = true
  dragLeader = leader
  dragStart = { x: startX, y: startY }
  currentLeaderId = leaderId

  activeFollowerIds = getFollowers()
    .map((f) => findItemIdFromDom(f))
    .filter(Boolean) as string[]

  createFollowerGhosts()
  document.body.setAttribute(DRAGGING_ATTR, "true")

  leaderStartDataPromise = fetchTokenData(leaderId)
}

const moveGroupDrag = (x: number, y: number) => {
  updateGhostPositions(x - dragStart.x, y - dragStart.y)
}

const finishGroupDrag = async () => {
  console.log("[API Drag] 🛑 마우스 뗌 감지, API 처리 시작")
  groupDragging = false
  clearGhosts()
  document.body.removeAttribute(DRAGGING_ATTR)

  if (!currentLeaderId || !leaderStartDataPromise) {
    console.warn("[API Drag] 리더 정보가 누락되어 중단합니다.")
    return
  }

  try {
    const leaderStartData = await leaderStartDataPromise
    if (!leaderStartData) {
      console.warn(
        `[API Drag] 리더(${currentLeaderId})의 초기 데이터를 가져오지 못했습니다.`
      )
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
      console.log("[API Drag] 토큰이 이동하지 않아 단체 이동을 취소합니다.")
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

    console.log(
      `[API Drag] 📍 리더 실제 이동량 - Grid 변위: ${dx},${dy} / Pixel 변위: ${pixelDx},${pixelDy}`
    )

    const bulkUpdates: Array<{
      id: string
      _type: string
      data: Record<string, any>
    }> = []

    for (const fid of activeFollowerIds) {
      const fData = await fetchTokenData(fid)
      if (!fData) continue

      const fType = fData._type
      let applyDx = pixelDx
      let applyDy = pixelDy

      if (!isPixelUnit(fType)) {
        applyDx = Math.round(pixelDx / GRID_SIZE)
        applyDy = Math.round(pixelDy / GRID_SIZE)
      }

      const targetId = fData.id || fData._id
      bulkUpdates.push({
        id: targetId,
        _type: fType,
        data: { x: fData.x + applyDx, y: fData.y + applyDy }
      })
    }

    if (bulkUpdates.length > 0) {
      await ccf.tokens.patchBulk(bulkUpdates)
      console.log(
        `[API Drag] ✅ ${bulkUpdates.length}개 토큰 단체 이동(Batch) 완료!`
      )
    }
  } catch (error) {
    console.error("[API Drag] 단체 드래그 API 적용 중 오류:", error)
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
      const leaderId =
        findItemIdFromDom(e.target as HTMLElement) || findItemIdFromDom(root)
      if (leaderId) {
        beginGroupDrag(root, leaderId, e.clientX, e.clientY)
      } else {
        console.warn(
          "[API Drag] ❌ 클릭한 요소에서 ID를 찾지 못했습니다.",
          e.target
        )
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

// 💡 contents/ 껍데기에서 이 함수를 호출하여 기능을 켭니다!
export function initBulkDrag() {
  addGlobalStyle()
  window.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("pointermove", onPointerMove, true)
  window.addEventListener("pointerup", onPointerUp, true)
  window.addEventListener("mousedown", onMouseDown, true)
  window.addEventListener("keydown", onKeyDown, true)
  window.addEventListener("click", onClickCapture, true)
  console.log("[API Drag] 스크립트 연결 완료 (aria-roledescription 모드)")
}
