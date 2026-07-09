import { ccf } from "~core/isolated/ccfolia-api"

const ICON_EDIT = `<svg focusable="false" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`
const ICON_DELETE = `<svg focusable="false" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
let currentHoveredItem: HTMLElement | null = null
let actionContainer: HTMLElement | null = null
const deletedMsgIds = new Set<string>()

// 필요한 CSS 동적 주입
let styleInjected = false
function injectStyles() {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement("style")
  style.textContent = `
    /* 독립 CE 컨테이너 — right:16px = 네이티브 위치 정밀 매칭 */
    .mb-msg-actions {
      position: absolute;
      top: 12px;
      right: 16px;
      display: flex;
      gap: 2px;
      z-index: 100;
      pointer-events: auto;
      opacity: 0.8;
    }
    .mb-msg-action-btn {
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      box-sizing: border-box;
      color: rgb(255, 255, 255);
      background: transparent;
      transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .mb-msg-action-btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    /* 텍스트 메시지에서 네이티브 편집 버튼 왼쪽으로 밀기 (나란히 정렬) */
    .mb-has-actions[data-msg-type="text"] > div:not([class*="MuiListItem"]):not(.mb-msg-actions) {
      right: 48px !important;
    }
    /* 삭제된 메시지 숨기기 처리용 CSS */
    .MuiListItem-root:has(.MuiListItemText-secondary:empty){display:none!important}
    .MuiListItem-root:has(.MuiListItemText-secondary:empty)+hr{display:none!important}
    .MuiListItem-root:has(.MuiListItemText-secondary:empty)+.MuiDivider-root{display:none!important}

    /* ── 메시지 수정 다이얼로그 (네이티브 MUI Dialog 정밀 매칭) ──────── */
    .mb-msg-edit-overlay { position: fixed; inset: 0; z-index: 100001; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.225s cubic-bezier(0.4, 0, 0.2, 1); }
    .mb-msg-edit-overlay.mb-dialog-open { opacity: 1; }
    .mb-msg-edit-backdrop { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); z-index: -1; -webkit-tap-highlight-color: transparent; }
    .mb-msg-edit-box { background-color: rgba(44, 44, 44, 0.87); color: rgb(255, 255, 255); border-radius: 4px; max-width: 444px; width: calc(100% - 64px); box-shadow: rgba(0, 0, 0, 0.2) 0px 11px 15px -7px, rgba(0, 0, 0, 0.14) 0px 24px 38px 3px, rgba(0, 0, 0, 0.12) 0px 9px 46px 8px; overflow-y: auto; margin: 32px; position: relative; display: flex; flex-direction: column; max-height: calc(100% - 64px); }
    .mb-msg-edit-content { padding: 0; overflow: auto; flex: 1 1 auto; }
    .mb-msg-edit-field { position: relative; width: 100%; display: inline-flex; flex-direction: column; }
    .mb-msg-edit-label { position: absolute; top: 0; left: 0; z-index: 1; transform: translate(12px, 7px) scale(0.75); transform-origin: 0px 0px; color: rgba(255, 255, 255, 0.7); font-size: 16px; font-family: Roboto, Helvetica, Arial, sans-serif; font-weight: 400; line-height: 23px; letter-spacing: 0.15008px; pointer-events: auto; padding: 0; }
    .mb-msg-edit-input-root { position: relative; background-color: rgba(255, 255, 255, 0.09); border-radius: 4px 4px 0px 0px; cursor: text; width: 100%; display: flex; flex-direction: row; padding: 25px 12px 8px; border: 0; box-sizing: border-box; transition: background-color 0.2s cubic-bezier(0, 0, 0.2, 1); }
    .mb-msg-edit-input-root:hover { background-color: rgba(255, 255, 255, 0.13); }
    .mb-msg-edit-input-root:hover:not(.mb-input-focused)::before { border-bottom-color: rgba(255, 255, 255, 1); }
    .mb-msg-edit-input-root.mb-input-focused { background-color: rgba(255, 255, 255, 0.09); }
    .mb-msg-edit-input-root::before { content: ' '; position: absolute; left: 0px; right: 0px; bottom: 0px; border-bottom: 1px solid rgba(255, 255, 255, 0.7); transition: border-bottom-color 0.2s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; }
    .mb-msg-edit-input-root::after { content: ''; position: absolute; left: 0px; right: 0px; bottom: 0px; border-bottom: 2px solid rgb(33, 150, 243); transform: scaleX(0); transition: transform 0.2s cubic-bezier(0, 0, 0.2, 1); pointer-events: none; }
    .mb-msg-edit-input-root.mb-input-focused::after { transform: scaleX(1); }
    .mb-msg-edit-textarea { width: 100%; color: rgb(255, 255, 255); font-size: 16px; font-family: Roboto, Helvetica, Arial, sans-serif; font-weight: 400; line-height: 23px; letter-spacing: 0.15008px; padding: 0; background: transparent; border: 0; resize: none; outline: none; box-sizing: content-box; caret-color: rgb(255, 255, 255); height: 92px; overflow: auto; }
    .mb-msg-edit-btns { display: flex; align-items: center; justify-content: flex-end; padding: 8px; flex: 0 0 auto; }
    .mb-msg-edit-btn { border: 0; border-radius: 4px; cursor: pointer; font-family: Roboto, Helvetica, Arial, sans-serif; font-weight: 700; font-size: 14px; line-height: 24.5px; letter-spacing: 0.39998px; text-transform: uppercase; min-width: 64px; width: 100%; padding: 6px 8px; position: relative; overflow: hidden; transition: background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
    .mb-msg-edit-btn--confirm { background: transparent; color: rgb(33, 150, 243); }
    .mb-msg-edit-btn--confirm:hover { background: rgba(33, 150, 243, 0.08); }
    
    /* JS 기반 리플 (네이티브 MuiTouchRipple 재현) */
    .mb-msg-ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: mb-ripple-enter 550ms cubic-bezier(0.4, 0, 0.2, 1) forwards; pointer-events: none; opacity: 0.3; transition: opacity 550ms cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes mb-ripple-enter { 0% { transform: scale(0); } 100% { transform: scale(1); } }
  `
  document.head.appendChild(style)
}

function createActionBtn(iconStr: string, title: string, extraClass: string) {
  const btn = document.createElement("button")
  btn.className = `mb-msg-action-btn ${extraClass}`
  btn.title = title
  btn.setAttribute("type", "button")
  btn.setAttribute("tabindex", "0")
  btn.innerHTML = iconStr
  return btn
}

function closeDialog(overlay: HTMLElement) {
  overlay.classList.remove("mb-dialog-open")
  setTimeout(() => overlay.remove(), 230)
}

function addRipple(btn: HTMLElement, color: string) {
  btn.addEventListener("mousedown", (e) => {
    const rect = btn.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const dx = Math.max(x, rect.width - x)
    const dy = Math.max(y, rect.height - y)
    const radius = Math.sqrt(dx * dx + dy * dy)

    const ripple = document.createElement("span")
    ripple.className = "mb-msg-ripple"
    ripple.style.width = ripple.style.height = `${radius * 2}px`
    ripple.style.left = `${x - radius}px`
    ripple.style.top = `${y - radius}px`
    ripple.style.backgroundColor = color
    btn.appendChild(ripple)

    const fadeOut = () => {
      ripple.style.opacity = "0"
      setTimeout(() => {
        if (ripple.parentNode) ripple.remove()
      }, 550)
    }
    btn.addEventListener("mouseup", fadeOut, { once: true })
    btn.addEventListener("mouseleave", fadeOut, { once: true })
  })
}

function showEditDialog(
  msgId: string,
  currentText: string,
  onConfirm: (newText: string) => void
) {
  const existing = document.getElementById("mb-msg-edit-dialog")
  if (existing) existing.remove()

  const overlay = document.createElement("div")
  overlay.id = "mb-msg-edit-dialog"
  overlay.className = "mb-msg-edit-overlay"
  overlay.setAttribute("role", "presentation")

  const backdrop = document.createElement("div")
  backdrop.className = "mb-msg-edit-backdrop"

  const dialog = document.createElement("div")
  dialog.className = "mb-msg-edit-box"
  dialog.setAttribute("role", "dialog")

  const content = document.createElement("div")
  content.className = "mb-msg-edit-content"

  const form = document.createElement("form")
  form.setAttribute("autocomplete", "off")
  form.addEventListener("submit", (e) => {
    e.preventDefault()
    confirmBtn.click()
  })

  const field = document.createElement("div")
  field.className = "mb-msg-edit-field"

  const label = document.createElement("label")
  label.className = "mb-msg-edit-label"
  label.textContent = "메시지 편집"

  const inputRoot = document.createElement("div")
  inputRoot.className = "mb-msg-edit-input-root"

  const textarea = document.createElement("textarea")
  textarea.className = "mb-msg-edit-textarea"
  textarea.value = currentText

  textarea.addEventListener("focus", () => {
    inputRoot.classList.add("mb-input-focused")
  })
  textarea.addEventListener("blur", () => {
    inputRoot.classList.remove("mb-input-focused")
  })

  inputRoot.appendChild(textarea)
  field.appendChild(label)
  field.appendChild(inputRoot)
  form.appendChild(field)
  content.appendChild(form)

  const btnRow = document.createElement("div")
  btnRow.className = "mb-msg-edit-btns"

  const confirmBtn = document.createElement("button")
  confirmBtn.className = "mb-msg-edit-btn mb-msg-edit-btn--confirm"
  confirmBtn.textContent = "저장"
  confirmBtn.setAttribute("type", "button")
  confirmBtn.onclick = () => {
    const newText = textarea.value
    if (newText === currentText) {
      closeDialog(overlay)
      return
    }
    closeDialog(overlay)
    onConfirm(newText)
  }

  btnRow.appendChild(confirmBtn)
  addRipple(confirmBtn, "rgba(33, 150, 243, 0.3)")

  dialog.appendChild(content)
  dialog.appendChild(btnRow)
  overlay.appendChild(backdrop)
  overlay.appendChild(dialog)
  document.body.appendChild(overlay)

  backdrop.addEventListener("click", () => closeDialog(overlay))

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add("mb-dialog-open")
    })
  })

  setTimeout(() => {
    textarea.focus()
    textarea.select()
  }, 100)

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onKey)
      closeDialog(overlay)
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      document.removeEventListener("keydown", onKey)
      confirmBtn.click()
    }
  }
  document.addEventListener("keydown", onKey)
}

function removeActions() {
  if (currentHoveredItem) {
    currentHoveredItem.classList.remove("mb-has-actions")
  }
  if (actionContainer) {
    actionContainer.remove()
    actionContainer = null
  }
  currentHoveredItem = null
}

function doDelete(listItem: HTMLElement, msgId: string) {
  deletedMsgIds.add(msgId)

  // 즉각적인 숨김 처리를 위해 CSS 처리 (React DOM 충돌 방지용)
  listItem.style.display = "none"

  removeActions()

  // 1. API를 통해 빈 텍스트로 수정 (다른 클라이언트 즉시 동기화 및 숨김)
  ccf.messages.clearForDelete(msgId).then(() => {
    // 2. 그 다음 실제 삭제 수행
    ccf.messages.delete(msgId).catch(() => {
      deletedMsgIds.delete(msgId)
      listItem.style.display = ""
    })
  }).catch(() => {
    deletedMsgIds.delete(msgId)
    listItem.style.display = ""
  })
}

function injectActions(listItem: HTMLElement) {
  if (currentHoveredItem === listItem) return
  removeActions()
  injectStyles()

  const msgId = listItem.getAttribute("data-msg-id")
  if (!msgId || deletedMsgIds.has(msgId)) return

  const msgFrom = listItem.getAttribute("data-msg-from")
  const msgType = listItem.getAttribute("data-msg-type")
  const myUid = document.documentElement.getAttribute("data-mb-my-uid")
  const isOwn = myUid && msgFrom === myUid

  currentHoveredItem = listItem
  listItem.classList.add("mb-has-actions")

  actionContainer = document.createElement("div")
  actionContainer.className = "mb-msg-actions"

  // 시스템 메시지: 본인이 보낸 거면 [편집][삭제]
  if (isOwn && msgType === "system") {
    const editBtn = createActionBtn(ICON_EDIT, "수정", "mb-msg-action-edit")
    editBtn.onclick = (e) => {
      e.stopPropagation()
      const textEl = listItem.querySelector(".MuiListItemText-secondary")
      const currentText = textEl ? textEl.textContent || "" : ""
      showEditDialog(msgId, currentText, (newText) => {
        ccf.messages.edit(msgId, newText).then(() => {
          if (textEl) {
            textEl.textContent = newText
          }
        })
      })
    }
    actionContainer.appendChild(editBtn)
  }

  const delBtn = createActionBtn(
    ICON_DELETE,
    "메시지 삭제",
    "mb-msg-action-delete"
  )
  delBtn.onclick = (e) => {
    e.stopPropagation()
    doDelete(listItem, msgId)
  }

  actionContainer.appendChild(delBtn)
  listItem.style.position = "relative"
  listItem.appendChild(actionContainer)
}

export function initMessageActions() {
  document.addEventListener(
    "mouseover",
    (e) => {
      const target = e.target as HTMLElement
      const item = target.closest(".MuiListItem-root") as HTMLElement
      if (!item) return
      // 메시지 리스트 안의 아이템만 대상
      if (!item.closest("ul.MuiList-root")) return
      if (item === currentHoveredItem) return

      // 만약 data-msg-id가 없다면(아직 태깅 안 됨), 한 번 강제 태깅 호출 시도
      if (!item.getAttribute("data-msg-id")) {
        document.dispatchEvent(new CustomEvent("mb-retag-messages"))
        setTimeout(() => injectActions(item), 200)
        return
      }

      injectActions(item)
    },
    true
  )

  document.addEventListener(
    "mouseout",
    (e) => {
      if (!currentHoveredItem) return
      const related = e.relatedTarget as HTMLElement
      if (
        related &&
        related.closest &&
        related.closest(".MuiListItem-root") === currentHoveredItem
      )
        return

      const fromItem = (e.target as HTMLElement).closest(".MuiListItem-root")
      if (fromItem === currentHoveredItem) {
        removeActions()
      }
    },
    true
  )
}
