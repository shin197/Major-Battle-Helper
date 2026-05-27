import { ccf } from "~core/isolated/ccfolia-api"

const TAG = "[CE 표정일괄]"
const SVGNS = "http://www.w3.org/2000/svg"
const CHECK_D = "M6.57109 11.5L3.24609 8.175L4.07734 7.34375L6.57109 9.8375L11.9232 4.48541L12.7544 5.31666L6.57109 11.5Z"

let _active = false
let _selected = new Map<string, { label: string; iconUrl: string }>()
let _pickerObs: MutationObserver | null = null
let _isFaceAddPickerOpen = false

/** DOM Helpers */
function getPickerDialog() {
  return document.querySelector('.MuiDialog-paperWidthMd[role="dialog"]')
}

function getCharEditDialog() {
  for (const d of document.querySelectorAll('[role="dialog"]')) {
    if (d.classList.contains("MuiDialog-paperWidthMd")) continue
    for (const h of d.querySelectorAll("h6")) {
      const t = h.textContent?.trim()
      if (t === "スタンド" || t === "스탠딩") return d
    }
  }
  return null
}

function getPickerImages(picker: Element) {
  const out: HTMLImageElement[] = []
  for (const img of picker.querySelectorAll("img")) {
    // 1. 외부 링크(실제 업로드된 이미지)만 허용
    if (!img.src || !img.src.startsWith("https://")) continue
    
    // 2. UI 컨트롤용 아이콘 무시 (app.ts와 동일한 기준 적용)
    if (
      img.closest("button:not(.MuiButtonBase-root)") || 
      img.closest("header") || 
      img.closest('[role="tab"]')
    ) continue
    
    // 3. (삭제됨) 기존의 naturalWidth < 40 필터링 제거. 
    // TRPG 픽셀 아트(32x32, 16x16) 등의 작은 토큰이 무시되는 버그를 방지합니다.
    
    out.push(img as HTMLImageElement)
  }
  return out
}

function getDialogActions(picker: Element) {
  return picker.querySelector(".MuiDialogActions-root")
}

function isNativeDeleteMode(picker: Element) {
  const toolbar = picker.querySelector(".MuiToolbar-root")
  if (!toolbar) return false
  for (const btn of toolbar.querySelectorAll("button")) {
    const t = btn.textContent?.trim()
    if (t === "취소" || t === "キャンセル" || t === "Cancel") return true
  }
  return false
}

/** SVG 렌더링 */
function createCheckSVG() {
  const svg = document.createElementNS(SVGNS, "svg")
  svg.setAttribute("width", "16")
  svg.setAttribute("height", "16")
  svg.setAttribute("viewBox", "0 0 16 16")
  svg.setAttribute("fill", "none")
  svg.classList.add("mb-check")
  Object.assign(svg.style, {
    position: "absolute",
    top: "4px",
    left: "4px",
    width: "16px",
    height: "16px",
    zIndex: "15",
    pointerEvents: "none",
    transition: "opacity .12s"
  })

  const circle = document.createElementNS(SVGNS, "circle")
  circle.setAttribute("cx", "8")
  circle.setAttribute("cy", "8")
  circle.setAttribute("r", "7.5")
  circle.setAttribute("fill", "rgba(0,0,0,0.3)")
  circle.setAttribute("stroke", "rgba(255,255,255,0.8)")
  svg.appendChild(circle)

  return svg
}

function paintCheck(svg: SVGElement, selected: boolean) {
  const circle = svg.querySelector("circle")
  if (!circle) return

  if (selected) {
    circle.setAttribute("fill", "#2196F3")
    circle.setAttribute("stroke", "white")
    if (!svg.querySelector("path")) {
      const p = document.createElementNS(SVGNS, "path")
      p.setAttribute("d", CHECK_D)
      p.setAttribute("fill", "white")
      svg.appendChild(p)
    }
  } else {
    circle.setAttribute("fill", "rgba(0,0,0,0.3)")
    circle.setAttribute("stroke", "rgba(255,255,255,0.8)")
    const p = svg.querySelector("path")
    if (p) p.remove()
  }
}

/** 다중 추가 버튼 주입 */
function injectAddButton(picker: Element) {
  const actions = getDialogActions(picker)
  if (!actions || actions.querySelector(".mb-face-add-btn")) return

  const closeBtn = actions.querySelector("button")
  const addBtn = closeBtn ? (closeBtn.cloneNode(false) as HTMLButtonElement) : document.createElement("button")

  if (closeBtn) {
    addBtn.className = closeBtn.className + " mb-face-add-btn"
  } else {
    addBtn.className = "mb-face-add-btn"
  }

  addBtn.textContent = "추가 (0)"
  addBtn.disabled = true
  addBtn.style.opacity = "0.5"

  addBtn.addEventListener("click", onConfirm)

  if (closeBtn) actions.insertBefore(addBtn, closeBtn)
  else actions.appendChild(addBtn)

  refreshAddButton()
}

function refreshAddButton() {
  const n = _selected.size
  const btn = document.querySelector(".mb-face-add-btn") as HTMLButtonElement
  if (!btn) return
  btn.disabled = n === 0
  btn.style.opacity = n > 0 ? "1" : "0.5"
  btn.textContent = `추가 (${n})`
}

/** 다중 선택 모드 제어 */
function enableMultiSelect(picker: Element) {
  _active = true
  _selected.clear()
  applyMarkers(picker)
  injectAddButton(picker)

  let rafId: number | null = null
  _pickerObs = new MutationObserver(() => {
    if (_active) {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        applyMarkers(picker)
        syncDeleteModeVisibility(picker)
        rafId = null
      })
    }
  })
  _pickerObs.observe(picker, { childList: true, subtree: true })
}

function disableMultiSelect() {
  _active = false
  _selected.clear()
  if (_pickerObs) {
    _pickerObs.disconnect()
    _pickerObs = null
  }
  document.querySelectorAll(".mb-img-overlay, .mb-face-add-btn").forEach((el) => el.remove())
}

function syncDeleteModeVisibility(picker: Element) {
  const deleteMode = isNativeDeleteMode(picker)
  picker.querySelectorAll(".mb-img-overlay").forEach((ov) => {
    ; (ov as HTMLElement).style.pointerEvents = deleteMode ? "none" : "auto"
  })
  picker.querySelectorAll(".mb-check, .mb-img-label").forEach((el) => {
    ; (el as HTMLElement).style.display = deleteMode ? "none" : ""
  })
  const addBtn = document.querySelector(".mb-face-add-btn") as HTMLElement
  if (addBtn) addBtn.style.display = deleteMode ? "none" : ""
  const bulkBtn = picker.querySelector(".mb-bulk-add-btn") as HTMLElement
  if (bulkBtn) bulkBtn.style.display = deleteMode ? "none" : ""
}

function applyMarkers(picker: Element) {
  const imagesToProcess = getPickerImages(picker)
  const tasks: Array<{ wrapper: HTMLElement, img: HTMLImageElement, isStatic: boolean }> = []

  // Phase 1: Batch DOM Reads (레이아웃 스래싱 방지)
  for (const img of imagesToProcess) {
    const wrapper = img.parentElement
    if (!wrapper || wrapper.querySelector(".mb-img-overlay")) continue
    
    tasks.push({
      wrapper,
      img,
      isStatic: getComputedStyle(wrapper).position === "static"
    })
  }

  // Phase 2: Batch DOM Writes
  for (const { wrapper, img, isStatic } of tasks) {
    if (isStatic) {
      wrapper.style.position = "relative"
    }

    const overlay = document.createElement("div")
    overlay.className = "mb-img-overlay"
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      zIndex: "10",
      cursor: "pointer",
      background: "transparent",
      borderRadius: "4px"
    })

    const svg = createCheckSVG()
    overlay.appendChild(svg)

    const rawName = (img.alt || "").replace(/\.[^.]+$/, "").trim()
    if (rawName) {
      const label = document.createElement("div")
      label.className = "mb-img-label"
      label.textContent = rawName
      Object.assign(label.style, {
        position: "absolute",
        bottom: "0",
        left: "0",
        right: "0",
        background: "rgba(0,0,0,0.65)",
        color: "#eee",
        fontSize: "10px",
        padding: "2px 4px",
        textAlign: "center",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        pointerEvents: "none",
        borderRadius: "0 0 4px 4px"
      })
      overlay.appendChild(label)
    }

    if (_selected.has(img.src)) {
      paintCheck(svg, true)
      overlay.style.background = "rgba(33,150,243,0.25)"
    }

    overlay.addEventListener("click", (e) => {
      e.stopPropagation()
      e.stopImmediatePropagation()
      e.preventDefault()

      const src = img.src
      if (_selected.has(src)) {
        _selected.delete(src)
        paintCheck(svg, false)
        overlay.style.background = "transparent"
      } else {
        const rawLabel = (img.alt || "").replace(/\.[^.]+$/, "").trim() || "face"
        _selected.set(src, { label: "@" + rawLabel, iconUrl: src })
        paintCheck(svg, true)
        overlay.style.background = "rgba(33,150,243,0.25)"
      }
      refreshAddButton()
    }, true)

    wrapper.appendChild(overlay)
  }

  syncDeleteModeVisibility(picker)
}

// Programmatic Picker State
let _isProgrammaticMultiPicker = false
let _programmaticResolve: ((items: Array<{ label: string; iconUrl: string }>) => void) | null = null

/** 툴바에 선택 추가 버튼 주입 (Passive 모드 전용) */
function injectBulkAddButton(picker: Element) {
  const toolbar = picker.querySelector(".MuiToolbar-root")
  if (!toolbar) {
    setTimeout(() => { if (getPickerDialog()) injectBulkAddButton(picker) }, 300)
    return
  }
  if (toolbar.querySelector(".mb-bulk-add-btn")) return

  let refBtn: HTMLElement | null = null
  for (const b of toolbar.querySelectorAll("button")) {
    const t = b.textContent?.trim()
    if (t?.includes("삭제") || t?.includes("削除")) {
      refBtn = b as HTMLElement
      break
    }
  }

  const btn = document.createElement("button")
  btn.className = "mb-bulk-add-btn"
  if (refBtn) {
    for (const cls of refBtn.classList) {
      if (!cls.startsWith("mb")) btn.classList.add(cls)
    }
  }
  btn.textContent = "선택 추가"

  btn.addEventListener("click", (e) => {
    e.stopPropagation()
    if (isNativeDeleteMode(picker)) return

    if (_active) {
      disableMultiSelect()
      btn.textContent = "선택 추가"
    } else {
      enableMultiSelect(picker)
      btn.textContent = "선택 완료"
    }
  })

  if (refBtn && refBtn.parentElement) {
    refBtn.parentElement.insertBefore(btn, refBtn)
  } else {
    toolbar.appendChild(btn)
  }
}

/** 저장 처리 */
async function onConfirm() {
  const faces = Array.from(_selected.values())
  if (faces.length === 0) return

  const btn = document.querySelector(".mb-face-add-btn") as HTMLButtonElement
  if (btn) {
    btn.disabled = true
    btn.textContent = "처리 중..."
  }

  if (_isProgrammaticMultiPicker && _programmaticResolve) {
    // Programmatic 모드: 결과 반환 및 창 닫기
    _programmaticResolve(faces)
    _programmaticResolve = null
    _isProgrammaticMultiPicker = false
    ccf.app.stateMutate({ openRoomImageSelect: false })
    disableMultiSelect()
    return
  }

  // Passive 모드 (캐릭터 표정 추가)
  try {
    const menuInfo = await ccf.menus.getOpenMenuInfo()
    if (!menuInfo || menuInfo.type !== "character-detail") {
      throw new Error("캐릭터 편집창을 찾을 수 없습니다.")
    }

    const charId = menuInfo.id
    const charData = await ccf.characters.getById(charId)
    if (!charData) throw new Error("캐릭터 데이터를 불러올 수 없습니다.")

    // 기존 표정에 추가
    const existingFaces = charData.faces || []
    const newFaces = [...existingFaces, ...faces]

    await ccf.characters.update(charId, { faces: newFaces })
    console.log(`${TAG} ${faces.length}장 추가 완료`)

    // 이미지 피커 닫기 + 편집 다이얼로그 닫기
    ccf.app.stateMutate({
      openRoomImageSelect: false,
      openRoomCharacter: false
    })

    // 350ms 후 편집 다이얼로그 재오픈하여 최신 데이터 렌더링 강제 유도
    setTimeout(() => {
      ccf.app.stateMutate({
        openRoomCharacter: true,
        openRoomCharacterId: charId
      })
    }, 350)
  } catch (err: any) {
    console.error(TAG, "추가 실패:", err.message)
    window.alert("표정 추가 실패: " + err.message)
  }

  disableMultiSelect()
}

function fullCleanup() {
  _active = false
  _selected.clear()
  if (_pickerObs) {
    _pickerObs.disconnect()
    _pickerObs = null
  }
  document.querySelectorAll(".mb-img-overlay, .mb-face-add-btn, .mb-bulk-add-btn").forEach((el) => el.remove())
  
  // Programmatic 모드에서 닫히면 빈 배열 반환
  if (_isProgrammaticMultiPicker && _programmaticResolve) {
    _programmaticResolve([])
    _programmaticResolve = null
    _isProgrammaticMultiPicker = false
  }
}

/** 
 * 다중 선택 이미지 피커를 프로그래매틱하게 호출합니다.
 * @returns 선택된 이미지 객체 배열
 */
export async function openMultiImagePicker(): Promise<Array<{ label: string; iconUrl: string }>> {
  return new Promise((resolve) => {
    _isProgrammaticMultiPicker = true
    _programmaticResolve = resolve
    
    // 코코포리아 네이티브 피커 호출
    ccf.app.stateMutate({
      openRoomImageSelect: true,
      openRoomImageSelectDir: "item",
      openRoomImageSelectTarget: "mb/ext/multi"
    })
  })
}

/** 메인 진입점 */
export function initFaceBulkAdd() {
  // 1. 클릭 캡처로 "어느 버튼이 피커를 열었는지" 판단
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement
    const btn = target.closest("button")
    if (!btn) return

    // 아바타 아이콘 변경인지, 스탠딩 표정 추가인지 파악
    const ariaLabel = btn.getAttribute("aria-label")
    if (ariaLabel === "추가" || btn.querySelector('[data-testid="AddIcon"]')) {
      const sectionHeader = btn.closest(".MuiToolbar-root")
      if (sectionHeader && (sectionHeader.textContent?.includes("스탠딩") || sectionHeader.textContent?.includes("立ち絵"))) {
        _isFaceAddPickerOpen = true
        return
      }
    }

    // 다른 이미지 선택창일 경우 초기화
    if (!target.closest('.MuiDialog-paperWidthMd')) {
      _isFaceAddPickerOpen = false
    }
  }, true)

  // 2. 다이얼로그 옵저버
  let lastPickerState = false
  const mainObs = new MutationObserver(() => {
    const picker = getPickerDialog()
    const nowOpen = !!picker

    if (!nowOpen) {
      if (lastPickerState) fullCleanup()
      lastPickerState = false
      return
    }

    if (lastPickerState) return // 이미 처리됨
    lastPickerState = true

    // Programmatic 모드일 경우 즉시 활성화
    if (_isProgrammaticMultiPicker) {
      enableMultiSelect(picker)
      return
    }

    // Passive 모드 (캐릭터 편집창)
    if (!getCharEditDialog()) return
    if (!_isFaceAddPickerOpen) return

    injectBulkAddButton(picker)
  })

  mainObs.observe(document.body, { childList: true, subtree: true })
}
