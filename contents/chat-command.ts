// src/contents/chat-command.ts
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

/*───────────────────────────────────────────────────────────
  상수
───────────────────────────────────────────────────────────*/
const CHAT_BAR_SELECTOR = "form > div:nth-of-type(2)"

const SUBMIT_BUTTON_SELECTOR = "button[type='submit']"
const BUTTON_ID = "mbh-command-button"      // 중복 주입 방지용 id
const PALETTE_ID = "mbh-command-palette"    // 팔레트 컨테이너 id

/*───────────────────────────────────────────────────────────
  Observer – 채팅 바 탐지
───────────────────────────────────────────────────────────*/
const rootObserver = new MutationObserver(() => {
  const chatBar = document.querySelector<HTMLElement>(CHAT_BAR_SELECTOR)
  if (!chatBar) return
  injectCommandButton(chatBar)
})

rootObserver.observe(document.body, { childList: true, subtree: true })

/*───────────────────────────────────────────────────────────
  1) 버튼 삽입
───────────────────────────────────────────────────────────*/
function injectCommandButton(chatBar: HTMLElement) {
  if (chatBar.querySelector(`#${BUTTON_ID}`)) return // 이미 있음

  const submitBtn = chatBar.querySelector<HTMLButtonElement>(
    SUBMIT_BUTTON_SELECTOR
  )

  if (!submitBtn) return

  /* MUI 버튼을 _흉내_ 내기 위해 submit 버튼 clone → label / id만 교체 */
  const cmdBtn = submitBtn.cloneNode(true) as HTMLButtonElement
  cmdBtn.id = BUTTON_ID
  cmdBtn.type = "button"
  cmdBtn.setAttribute("aria-label", "Command Palette")
  cmdBtn.querySelector("span.MuiTouchRipple-root")?.remove() // ripple 제거
  cmdBtn.textContent = "커맨드"
  cmdBtn.onclick = togglePalette

  /* submit 바로 왼쪽(space div 앞)에 삽입 */
  submitBtn.before(cmdBtn)
}

/*───────────────────────────────────────────────────────────
  2) 팔레트 오버레이 (아주 가벼운 예시)
───────────────────────────────────────────────────────────*/
function togglePalette() {
  const existing = document.getElementById(PALETTE_ID)
  if (existing) {
    existing.remove()
    return
  }
  openCommandPalette()
}

function openCommandPalette() {
  const host = document.createElement("div")
  host.id = PALETTE_ID
  Object.assign(host.style, {
    position: "fixed",
    right: "24px",
    bottom: "80px",
    zIndex: "1400",
    background: "rgba(32,32,32,.9)",
    color: "white",
    borderRadius: "8px",
    padding: "12px 16px",
    maxWidth: "240px",
    fontSize: "14px",
    boxShadow: "0 2px 6px rgba(0,0,0,.4)"
  })

  host.innerHTML = `
    <strong style="display:block;margin-bottom:8px;">Command Palette</strong>
    <ul style="margin:0;padding-left:18px;line-height:1.6;">
      <li>/roll 1d100</li>
      <li>/roll 3d6</li>
      <li>/me (액션)</li>
      <li style="opacity:.6;">… Add your own …</li>
    </ul>
  `
  host.onclick = (e) => e.stopPropagation() // 클릭 버블링 방지
  document.body.appendChild(host)

  /* ESC 로 닫기 */
  const esc = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      host.remove()
      document.removeEventListener("keydown", esc)
    }
  }
  document.addEventListener("keydown", esc)
}

/*───────────────────────────────────────────────────────────
  TODO – 원하는 기능에 맞춰 확장하기
───────────────────────────────────────────────────────────*/
// 1. 명령을 클릭하면 입력창에 삽입하거나 바로 전송
// 2. 사용자 커스텀 명령 CRUD 저장(localStorage 등)
// 3. 키보드 쇼트컷(예: Ctrl+P) 팔레트 열기
// 4. 스타일을 MUI Theme 또는 Tailwind로 리팩터링
