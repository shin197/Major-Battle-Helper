import { ccf } from "~core/isolated/ccfolia-api"
import { showToast } from "~utils/isolated/toast"

/**
 * drag-reorder.ts — 캐릭터 편집 다이얼로그에서
 * 스테이터스 / 매개변수 행을 드래그 앤 드롭으로 순서 변경
 * 
 * React controlled input이므로 DOM 노드를 이동하지 않고,
 * 드롭 시 input 값만 재배치한 뒤 native setter → input/change 이벤트로
 * React 상태를 갱신한다.
 */

/* ── 표정(스탠딩) 순서 변경 (Drag & Drop) ────────────────────────── */

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
        if (inputs.length >= 1 && imgs.length >= 1) {
          rows.push(sib)
        }
      }
      sib = sib.nextElementSibling as HTMLElement | null
    }
    return rows
  }
  return []
}

let _dragRow: HTMLElement | null = null
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

function setupDragEvents(dlg: HTMLElement, charId: string) {
  if (dlg.dataset.mbExprDragEvents === "true") return
  dlg.dataset.mbExprDragEvents = "true"

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
      if (title !== "스탠딩" && title !== "立ち絵") return

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
          const rows = getSectionRows(dlg, title)
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

  dlg.addEventListener("drop", async (e) => {
    if (!_dragRow) return
    e.preventDefault()

    const target = e.target as HTMLElement
    const dropRow = target.closest?.("[data-mb-row='true']") as HTMLElement

    if (dropRow && dropRow !== _dragRow) {
      const title = getSectionTitleOfRow(dropRow)
      if (title === "스탠딩" || title === "立ち絵") {
        const rows = getSectionRows(dlg, title)
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
            // await 도중 dragend가 발생해 _dragRow가 null이 되는 것을 방지하기 위해 캡처
            const draggedRow = _dragRow;

            try {
              const charData = await ccf.characters.getById(charId)
              if (charData && charData.faces) {
                const newFaces = [...charData.faces]
                const [movedFace] = newFaces.splice(fromIdx, 1)
                newFaces.splice(insertIdx, 0, movedFace)

                await ccf.characters.update(charId, { faces: newFaces })
                console.log(`[BattleHelper] 표정 순서 변경 완료: ${fromIdx} -> ${insertIdx}`)

                // 시각적 피드백: 임시로 DOM을 조작하여 바뀐 것처럼 보여줌 (React 상태는 안 바뀜)
                const parent = draggedRow.parentNode;
                const referenceNode = fromIdx < insertIdx ? dropRow.nextSibling : dropRow;
                if (parent && referenceNode !== draggedRow) {
                  parent.insertBefore(draggedRow, referenceNode);
                }

                showToast("✅ 표정 순서가 저장되었습니다. (창을 닫았다가 다시 열면 완벽히 적용됩니다)");

              }
            } catch (err) {
              console.error("[BattleHelper] 표정 순서 변경 실패:", err)
            }
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

function injectExpressionDragReorder(dlg: HTMLElement, charId: string) {
  setupDragEvents(dlg, charId)

  const pairs = ["스탠딩", "立ち絵"]
  for (const title of pairs) {
    const rows = getSectionRows(dlg, title)
    if (rows.length >= 2) {
      addDragHandles(rows)
    }
  }
}

export async function injectOwnerTransferUI(dlg: HTMLElement, charId: string) {
  if (dlg.querySelector(".mb-owner-transfer")) return

  const charData = await ccf.characters.getById(charId)
  if (!charData) return

  const options = await ccf.members.getByRole("player")
  const currentOwner = options.find(p => p._id === (charData.owner || "null")) || options[0]

  const content = dlg.classList.contains("MuiDialogContent-root") ? dlg : dlg.querySelector(".MuiDialogContent-root") || dlg

  let standingToolbar: Element | null = null
  for (const h of content.querySelectorAll("h6")) {
    const t = h.textContent?.trim()
    if (t === "스탠딩" || t === "立ち絵") {
      standingToolbar = h.closest(".MuiToolbar-root")
      break
    }
  }

  // 스탠딩 섹션이 없다면 메인 캐릭터 편집창이 아닐 확률이 높으므로(이미지 선택창 등) 주입을 취소합니다.
  if (!standingToolbar) return

  const standingBlock = standingToolbar?.parentElement
  const sectionClass = standingBlock?.className || ""

  // 새 단락 블록 (Section Block)
  const newSectionBlock = document.createElement("div")
  newSectionBlock.className = sectionClass

  // 1. Toolbar (Header)
  const toolbar = document.createElement("div")
  toolbar.className = standingToolbar ? standingToolbar.className : "MuiToolbar-root MuiToolbar-dense"
  const h6 = document.createElement("h6")
  h6.className = "MuiTypography-root MuiTypography-subtitle2"
  const standingH6 = standingToolbar?.querySelector("h6")
  if (standingH6) h6.className = standingH6.className
  h6.textContent = "소유권"
  toolbar.appendChild(h6)

  // 2. Caption (Description)
  const caption = document.createElement("span")
  caption.className = "MuiTypography-root MuiTypography-caption"
  const standingCaption = standingBlock?.querySelector("span.MuiTypography-caption")
  if (standingCaption) caption.className = standingCaption.className
  caption.style.marginBottom = "16px"
  caption.style.display = "block"
  caption.textContent = "이 캐릭터를 조작할 수 있는 소유자를 지정합니다."

  // 3. Content Area
  const innerBlock = document.createElement("div")
  const innerClass = standingBlock?.querySelector("div:not(.MuiToolbar-root)")?.className || ""
  innerBlock.className = innerClass

  const container = document.createElement("div")
  container.className = "mb-owner-transfer MuiFormControl-root MuiFormControl-marginDense MuiFormControl-fullWidth"
  container.style.width = "100%"

  const selectWrap = document.createElement("div")
  selectWrap.style.position = "relative"
  selectWrap.style.width = "100%"

  const displayBtn = document.createElement("div")
  displayBtn.className = "MuiInputBase-root MuiInput-root MuiInput-underline MuiInputBase-colorPrimary MuiInputBase-fullWidth MuiInputBase-formControl"
  displayBtn.style.cursor = "pointer"
  displayBtn.style.padding = "4px 0"

  function renderMemberItem(name: string, photoUrl: string | null) {
    const defaultPhoto = "https://ccfolia.com/images/logo.png"
    return `
      <div style="display: flex; align-items: center; gap: 12px; padding: 4px 8px; box-sizing: border-box; width: 100%;">
        <div class="MuiAvatar-root MuiAvatar-circular" style="width: 40px; height: 40px; overflow: hidden; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="${photoUrl || defaultPhoto}" class="MuiAvatar-img" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
        </div>
        <p class="MuiTypography-root MuiTypography-body1" style="margin: 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</p>
      </div>
    `
  }

  displayBtn.innerHTML = renderMemberItem(currentOwner.displayName, currentOwner.photoUrl)

  const dropdownMenu = document.createElement("div")
  dropdownMenu.className = "MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation8"
  Object.assign(dropdownMenu.style, {
    position: "absolute",
    top: "100%",
    left: "0",
    right: "0",
    zIndex: "9999",
    maxHeight: "250px",
    overflowY: "auto",
    overflowX: "hidden",
    display: "none",
    borderRadius: "4px",
    marginTop: "4px",
    backgroundColor: "var(--background-paper, #303030)"
  })

  for (const p of options) {
    const optDiv = document.createElement("div")
    optDiv.innerHTML = renderMemberItem(p.displayName, p.photoUrl)
    optDiv.style.cursor = "pointer"
    optDiv.addEventListener("mouseenter", () => optDiv.style.background = "rgba(255,255,255,0.08)")
    optDiv.addEventListener("mouseleave", () => optDiv.style.background = "transparent")

    optDiv.addEventListener("click", async (e) => {
      e.stopPropagation()
      dropdownMenu.style.display = "none"
      displayBtn.innerHTML = renderMemberItem(p.displayName, p.photoUrl)

      const newOwner = p._id === "null" ? null : p._id
      try {
        await ccf.characters.update(charId, { owner: newOwner })
        console.log(`[BattleHelper] 캐릭터 ${charId} 소유권 변경 -> ${newOwner}`)
      } catch (err) {
        console.error(err)
      }
    })

    dropdownMenu.appendChild(optDiv)
  }

  displayBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    const isBlock = dropdownMenu.style.display === "block"
    dropdownMenu.style.display = isBlock ? "none" : "block"
  })

  document.addEventListener("click", (e) => {
    if (!newSectionBlock.contains(e.target as Node)) {
      dropdownMenu.style.display = "none"
    }
  })

  selectWrap.appendChild(displayBtn)
  selectWrap.appendChild(dropdownMenu)

  container.appendChild(selectWrap)
  innerBlock.appendChild(container)

  newSectionBlock.appendChild(toolbar)
  newSectionBlock.appendChild(caption)
  newSectionBlock.appendChild(innerBlock)

  if (standingBlock && standingBlock.parentElement) {
    standingBlock.parentElement.insertBefore(newSectionBlock, standingBlock)
  } else {
    content.insertBefore(newSectionBlock, content.firstChild)
  }
}

/* ── 통합 진입점 ────────────────────────────────────────── */

export function injectCharacterEditFeatures(dlg: HTMLElement, charId: string) {
  // 표정 순서 변경 주입
  injectExpressionDragReorder(dlg, charId)

  let isInjecting = false
  const obs = new MutationObserver(() => {
    if (isInjecting) return
    isInjecting = true
    requestAnimationFrame(() => {
      injectExpressionDragReorder(dlg, charId)
      isInjecting = false
    })
  })
  obs.observe(dlg, { childList: true, subtree: true })

  // 소유권 변경 (비동기로 안전하게 주입)
  injectOwnerTransferUI(dlg, charId).catch(console.error)
}
