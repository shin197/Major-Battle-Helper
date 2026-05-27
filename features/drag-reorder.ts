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

function getSectionRows(dlg: HTMLElement, sectionTitle: string): HTMLElement[] {
  for (const h of Array.from(dlg.querySelectorAll("h6"))) {
    if (h.textContent?.trim() !== sectionTitle) continue
    const toolbar = h.parentElement
    if (!toolbar) continue

    const rows: HTMLElement[] = []
    let sib = toolbar.nextElementSibling as HTMLElement | null
    while (sib) {
      if (sib.classList.contains("MuiToolbar-root")) break
      if (sib.tagName === "DIV") {
        const inputs = sib.querySelectorAll("input")
        const imgs = sib.querySelectorAll("img")
        if (inputs.length >= 2 || (inputs.length >= 1 && imgs.length >= 1)) {
          rows.push(sib)
        }
      }
      sib = sib.nextElementSibling as HTMLElement | null
    }
    return rows
  }
  return []
}

function readRow(row: HTMLElement) {
  const inputs = row.querySelectorAll("input")
  const imgs = row.querySelectorAll("img")
  const d: { label: string; value?: string; max?: string; imgSrc?: string } = {
    label: inputs[0]?.value || ""
  }
  if (inputs[1]) d.value = inputs[1].value || ""
  if (inputs[2]) d.max = inputs[2].value || ""
  if (imgs[0]) d.imgSrc = imgs[0].src || ""
  return d
}

function writeRow(row: HTMLElement, data: { label: string; value?: string; max?: string; imgSrc?: string }) {
  const inputs = row.querySelectorAll("input")
  const imgs = row.querySelectorAll("img")

  if (inputs[0]) setInputValue(inputs[0], data.label)
  if (inputs[1] && data.value !== undefined) setInputValue(inputs[1], data.value)
  if (inputs[2] && data.max !== undefined) setInputValue(inputs[2], data.max)

  if (imgs[0] && data.imgSrc !== undefined) {
    imgs[0].src = data.imgSrc
  }
}

function reorder(rows: HTMLElement[], fromIdx: number, toIdx: number) {
  const data = rows.map(readRow)
  const [item] = data.splice(fromIdx, 1)
  data.splice(toIdx, 0, item)

  for (let i = 0; i < rows.length; i++) {
    writeRow(rows[i], data[i])
  }

  rows[toIdx].style.background = "rgba(33,150,243,0.15)"
  setTimeout(() => {
    rows[toIdx].style.background = ""
  }, 400)
}

/* ── 이벤트 델리게이션 ──────────────────────────────────── */

let _dragRow: HTMLElement | null = null
let _dragSectionTitle: string = ""
let _lastOverRow: HTMLElement | null = null
let _lastIsAbove: boolean | null = null

function getSectionTitleOfRow(row: HTMLElement): string {
  let sib = row.previousElementSibling as HTMLElement | null
  while (sib) {
    if (sib.classList.contains("MuiToolbar-root")) {
      return sib.querySelector("h6")?.textContent?.trim() || ""
    }
    sib = sib.previousElementSibling as HTMLElement | null
  }
  return ""
}

function setupDragEvents(dlg: HTMLElement) {
  if (dlg.dataset.mbDragEvents === "true") return
  dlg.dataset.mbDragEvents = "true"

  dlg.addEventListener("dragstart", (e) => {
    const target = e.target as HTMLElement
    const handle = target.classList?.contains("mb-drag-handle") ? target : target.closest?.(".mb-drag-handle")
    const row = target.closest?.("[data-mb-row='true']") as HTMLElement

    if (row && !handle) {
      e.preventDefault()
      return
    }

    if (handle && row) {
      _dragRow = row
      _dragSectionTitle = getSectionTitleOfRow(row)

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setDragImage(row, 30, row.offsetHeight / 2)
      }
      requestAnimationFrame(() => {
        row.style.opacity = "0.4"
      })
    }
  })

  dlg.addEventListener("dragend", () => {
    cleanupDrag()
  })

  dlg.addEventListener("dragover", (e) => {
    if (!_dragRow) return
    const target = e.target as HTMLElement
    const row = target.closest?.("[data-mb-row='true']") as HTMLElement

    if (row) {
      const title = getSectionTitleOfRow(row)
      if (title !== _dragSectionTitle) return

      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"

      const rect = row.getBoundingClientRect()
      const isAbove = e.clientY < rect.top + rect.height / 2

      if (_lastOverRow !== row || _lastIsAbove !== isAbove) {
        if (_lastOverRow) {
          _lastOverRow.style.borderTop = ""
          _lastOverRow.style.borderBottom = ""
        }

        let showLine = true
        if (row === _dragRow) {
          showLine = false
        } else {
          const rows = getSectionRows(dlg, _dragSectionTitle)
          const fromIdx = rows.indexOf(_dragRow)
          const toIdx = rows.indexOf(row)

          if (fromIdx >= 0 && toIdx >= 0) {
            if (toIdx === fromIdx + 1 && isAbove) showLine = false
            if (toIdx === fromIdx - 1 && !isAbove) showLine = false
          }
        }

        if (showLine) {
          row.style.borderTop = isAbove ? "2px solid #2196F3" : ""
          row.style.borderBottom = isAbove ? "" : "2px solid #2196F3"
        } else {
          row.style.borderTop = ""
          row.style.borderBottom = ""
        }

        _lastOverRow = row
        _lastIsAbove = isAbove
      }
    }
  })

  dlg.addEventListener("drop", (e) => {
    if (!_dragRow) return
    e.preventDefault()

    const target = e.target as HTMLElement
    const dropRow = target.closest?.("[data-mb-row='true']") as HTMLElement

    if (dropRow && dropRow !== _dragRow) {
      const title = getSectionTitleOfRow(dropRow)
      if (title === _dragSectionTitle) {
        const rows = getSectionRows(dlg, _dragSectionTitle)
        const fromIdx = rows.indexOf(_dragRow)
        const toIdx = rows.indexOf(dropRow)

        if (fromIdx >= 0 && toIdx >= 0) {
          let insertIdx = toIdx
          if (_lastIsAbove === false) {
            insertIdx++
          }
          if (fromIdx < insertIdx) {
            insertIdx--
          }

          if (fromIdx !== insertIdx) {
            reorder(rows, fromIdx, insertIdx)
          }
        }
      }
    }

    cleanupDrag()
  })
}

function cleanupDrag() {
  if (_dragRow) {
    _dragRow.style.opacity = "1"
    _dragRow = null
  }
  if (_lastOverRow) {
    _lastOverRow.style.borderTop = ""
    _lastOverRow.style.borderBottom = ""
    _lastOverRow = null
  }
  _lastIsAbove = null
}

function addDragHandles(rows: HTMLElement[]) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    row.dataset.mbRow = "true"

    if (row.querySelector(".mb-drag-handle")) continue

    row.style.position = "relative"
    const handle = document.createElement("div")
    handle.className = "mb-drag-handle"
    handle.textContent = "⠿"
    handle.draggable = true

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

    row.draggable = true
    row.style.transition = "background .15s, transform .15s"

    row.insertBefore(handle, row.firstChild)
  }
}

export function injectDragReorder(dlg: HTMLElement) {
  setupDragEvents(dlg)

  const pairs = [
    ["스테이터스", "ステータス"],
    ["매개변수", "パラメータ"],
    ["스탠딩", "立ち絵"]
  ]
  for (const [ko, ja] of pairs) {
    let rows = getSectionRows(dlg, ko)
    if (!rows.length) rows = getSectionRows(dlg, ja)
    if (rows.length >= 2) {
      addDragHandles(rows)
    }
  }
}

export function observeDialogForReorder(dlg: HTMLElement) {
  injectDragReorder(dlg)

  let isInjecting = false
  const obs = new MutationObserver(() => {
    if (isInjecting) return
    isInjecting = true
    requestAnimationFrame(() => {
      injectDragReorder(dlg)
      isInjecting = false
    })
  })

  obs.observe(dlg, { childList: true, subtree: true })
}
