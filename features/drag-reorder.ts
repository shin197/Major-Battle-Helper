/**
 * drag-reorder.ts — 캐릭터 편집 다이얼로그에서
 * 스테이터스 / 매개변수 행을 드래그 앤 드롭으로 순서 변경
 * 
 * React controlled input이므로 DOM 노드를 이동하지 않고,
 * 드롭 시 input 값만 재배치한 뒤 native setter → input/change 이벤트로
 * React 상태를 갱신한다.
 */

/* ── React input value 브릿지 ────────────────────────── */
const _nativeSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype, "value"
)?.set

function setInputValue(input: HTMLInputElement, val: string) {
  if (_nativeSetter) {
    _nativeSetter.call(input, val)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

/* ── DOM 헬퍼 ─────────────────────────────────────────── */

/** 편집 다이얼로그 내 "스테이터스" / "매개변수" 섹션의 행 목록 반환 */
function getSectionRows(dlg: HTMLElement, sectionTitle: string): HTMLElement[] {
  for (const h of Array.from(dlg.querySelectorAll("h6"))) {
    if (h.textContent?.trim() !== sectionTitle) continue
    const toolbar = h.parentElement
    if (!toolbar) continue

    const rows: HTMLElement[] = []
    let sib = toolbar.nextElementSibling as HTMLElement | null
    while (sib) {
      // 다음 섹션 헤더(Toolbar)에 도달하면 중단
      if (sib.classList.contains("MuiToolbar-root")) break
      // 입력창 행만 수집
      if (sib.tagName === "DIV" && sib.querySelectorAll("input").length >= 2) {
        rows.push(sib)
      }
      sib = sib.nextElementSibling as HTMLElement | null
    }
    return rows
  }
  return []
}

/** 행에서 input 값 읽기 */
function readRow(row: HTMLElement) {
  const inputs = row.querySelectorAll("input")
  const d: { label: string; value?: string; max?: string } = {
    label: inputs[0]?.value || ""
  }
  if (inputs[1]) d.value = inputs[1].value || ""
  if (inputs[2]) d.max = inputs[2].value || ""
  return d
}

/** 행에 값 쓰기 (React bridge) */
function writeRow(row: HTMLElement, data: { label: string; value?: string; max?: string }) {
  const inputs = row.querySelectorAll("input")
  if (inputs[0]) setInputValue(inputs[0], data.label)
  if (inputs[1] && data.value !== undefined) setInputValue(inputs[1], data.value)
  if (inputs[2] && data.max !== undefined) setInputValue(inputs[2], data.max)
}

/* ── 드래그 앤 드롭 ──────────────────────────────────── */

let _dragIdx = -1
let _rows: HTMLElement[] = []

function addDragHandles(rows: HTMLElement[]) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.querySelector(".bwbr-drag-handle")) continue

    // row를 relative로
    row.style.position = "relative"

    const handle = document.createElement("div")
    handle.className = "bwbr-drag-handle"
    handle.textContent = "⠿"
    handle.draggable = true
    handle.dataset.idx = i.toString()

    Object.assign(handle.style, {
      position: "absolute",
      left: "-24px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "20px",
      height: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "grab",
      color: "rgba(255,255,255,0.4)",
      fontSize: "14px",
      userSelect: "none",
      zIndex: "5",
      borderRadius: "3px",
      transition: "color .15s, background .15s, opacity .3s",
      opacity: "0"
    })

    // 페이드인
    requestAnimationFrame(() => {
      handle.style.opacity = "1"
    })

    handle.addEventListener("mouseenter", () => {
      handle.style.color = "rgba(255,255,255,0.8)"
      handle.style.background = "rgba(255,255,255,0.08)"
    })
    handle.addEventListener("mouseleave", () => {
      handle.style.color = "rgba(255,255,255,0.4)"
      handle.style.background = "transparent"
    })

    // 행 전체를 드래그 가능하게
    row.draggable = true
    row.style.transition = "background .15s, transform .15s"

    // 드래그 시작 이벤트
    handle.addEventListener("dragstart", (e) => {
      _dragIdx = parseInt(handle.dataset.idx || "-1", 10)
      _rows = rows
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setDragImage(row, 30, row.offsetHeight / 2)
      }
      requestAnimationFrame(() => {
        row.style.opacity = "0.4"
      })
    })

    // 행에서도 dragstart (핸들이 아닌 곳에서 시작하면 취소)
    row.addEventListener("dragstart", (e) => {
      if (
        !(e.target as HTMLElement).classList.contains("bwbr-drag-handle") &&
        !(e.target as HTMLElement).closest(".bwbr-drag-handle")
      ) {
        e.preventDefault()
      }
    })

    row.addEventListener("dragend", () => {
      row.style.opacity = "1"
      clearHighlights(rows)
    })

    row.addEventListener("dragover", (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
      clearHighlights(rows)

      const rect = row.getBoundingClientRect()
      const isAbove = e.clientY < rect.top + rect.height / 2
      row.style.borderTop = isAbove ? "2px solid #2196F3" : ""
      row.style.borderBottom = isAbove ? "" : "2px solid #2196F3"
    })

    row.addEventListener("dragleave", () => {
      row.style.borderTop = ""
      row.style.borderBottom = ""
    })

    row.addEventListener("drop", (e) => {
      e.preventDefault()
      const dropIdx = parseInt(handle.dataset.idx || "-1", 10)
      if (_dragIdx >= 0 && _dragIdx !== dropIdx && _rows === rows) {
        reorder(rows, _dragIdx, dropIdx)
      }
      _dragIdx = -1
      clearHighlights(rows)
    })

    row.insertBefore(handle, row.firstChild)
  }
}

function clearHighlights(rows: HTMLElement[]) {
  for (const r of rows) {
    r.style.borderTop = ""
    r.style.borderBottom = ""
    r.style.background = ""
  }
}

/** 행 배열에서 fromIdx → toIdx로 이동, 모든 input 값 재배치 */
function reorder(rows: HTMLElement[], fromIdx: number, toIdx: number) {
  // 1) 모든 행의 현재 값 읽기
  const data = rows.map(readRow)

  // 2) 배열 내 이동
  const [item] = data.splice(fromIdx, 1)
  data.splice(toIdx, 0, item)

  // 3) 모든 행에 새 값 쓰기
  for (let i = 0; i < rows.length; i++) {
    writeRow(rows[i], data[i])
  }

  // 4) 시각 피드백
  rows[toIdx].style.background = "rgba(33,150,243,0.15)"
  setTimeout(() => {
    rows[toIdx].style.background = ""
  }, 400)
}

export function injectDragReorder(dlg: HTMLElement) {
  const pairs = [
    ["스테이터스", "ステータス"],
    ["매개변수", "パラメータ"],
    ["스탠딩", "standing"]
  ]
  for (const [ko, ja] of pairs) {
    let rows = getSectionRows(dlg, ko)
    if (!rows.length) rows = getSectionRows(dlg, ja)
    if (rows.length >= 2) {
      addDragHandles(rows)
    }
  }
}
