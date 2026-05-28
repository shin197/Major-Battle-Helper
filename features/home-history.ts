

const STORAGE_KEY = "mb_room_history"

interface RoomHistoryEntry {
  name: string
  lastVisitTime: number
}

// ==========================================
// 1. 방 정보 수집 (Room Save)
// ==========================================
const targetSelector = 'h6[class*="MuiTypography-subtitle2"]'

function saveRoomInfo(url: string, name: string) {
  try {
    chrome.storage.local.get({ [STORAGE_KEY]: {} }, (data) => {
      const map = data[STORAGE_KEY] || {}
      map[url] = {
        name,
        lastVisitTime: Date.now()
      }
      chrome.storage.local.set({ [STORAGE_KEY]: map })
    })
  } catch (err) {
    // Context invalidated
  }
}

function checkAndSaveRoom() {
  if (!window.location.pathname.startsWith("/rooms/")) return false

  const found = document.querySelector(targetSelector)
  if (found) {
    const textNode = Array.from(found.childNodes).find(
      (c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim() !== ""
    )
    if (textNode && textNode.textContent) {
      saveRoomInfo(window.location.href, textNode.textContent.trim())
      return true
    }
  }
  return false
}

// ==========================================
// 2. 홈 렌더링 (Home Display)
// ==========================================
function isHomePage() {
  const path = window.location.pathname
  return path === "/home" || path.startsWith("/home")
}

let styleInjected = false
function injectStyles() {
  if (styleInjected) return
  styleInjected = true
  const styles = `
    #mb-visit-history-container {
      margin-top: 24px;
      padding-bottom: 12px;
    }
    #mb-visit-history-container h6 {
      color: rgba(255, 255, 255, 0.7);
      margin: 24px 16px 12px;
      font-size: 0.875rem;
      font-weight: 500;
      font-family: inherit;
    }
    #mb-visit-history-container ul {
      list-style: none;
      margin: 0 16px;
      padding: 0;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    #mb-visit-history-container li {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
    }
    #mb-visit-history-container li:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    #mb-visit-history-container li:last-child {
      border-bottom: none;
    }
    #mb-visit-history-container a {
      color: #fff;
      text-decoration: none;
      font-weight: 500;
      font-size: 1rem;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #mb-visit-history-container a:hover {
      text-decoration: underline;
    }
    #mb-visit-history-container .mb-visit-time {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.75rem;
      margin: 0 16px;
      white-space: nowrap;
    }
    #mb-visit-history-container .mb-del-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      font-size: 1.1rem;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    #mb-visit-history-container .mb-del-btn:hover {
      color: #ff6a6a;
      background: rgba(255, 106, 106, 0.1);
    }
  `
  const styleSheet = document.createElement("style")
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "방금 전"
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  const months = Math.floor(days / 30)
  return `${months}개월 전`
}

async function renderVisitHistory() {
  try {
    if (!isHomePage()) {
      const existing = document.getElementById("mb-visit-history-container")
      if (existing) existing.remove()
      return
    }

    injectStyles()

    const existing = document.getElementById("mb-visit-history-container")
    if (existing) existing.remove()

    chrome.storage.local.get({ [STORAGE_KEY]: {} }, (data) => {
      const map = data[STORAGE_KEY]
      let rooms = Object.keys(map)
        .map((url) => ({
          url,
          name: map[url].name,
          time: map[url].lastVisitTime
        }))
        .sort((a, b) => b.time - a.time)

      if (rooms.length === 0) return

      const container = document.createElement("div")
      container.id = "mb-visit-history-container"

      const title = document.createElement("h6")
      title.textContent = "최근 방문 기록"
      container.appendChild(title)

      const listEl = document.createElement("ul")
      container.appendChild(listEl)

      function renderList() {
        listEl.innerHTML = ""
        rooms.slice(0, 5).forEach(({ url, name, time }) => {
          const li = document.createElement("li")

          const a = document.createElement("a")
          a.href = url
          a.textContent = name || "이름 없는 방"

          const timeSpan = document.createElement("span")
          timeSpan.className = "mb-visit-time"
          timeSpan.textContent = formatRelativeTime(time)

          const delBtn = document.createElement("button")
          delBtn.className = "mb-del-btn"
          delBtn.innerHTML = "✕"
          delBtn.title = "기록에서 삭제"
          delBtn.addEventListener("click", () => {
            if (confirm(`'${name || url}' 방문 기록을 삭제하시겠습니까?`)) {
              chrome.storage.local.get({ [STORAGE_KEY]: {} }, (data) => {
                const allData = data[STORAGE_KEY]
                delete allData[url]
                chrome.storage.local.set({ [STORAGE_KEY]: allData }, () => {
                  rooms = rooms.filter((r) => r.url !== url)
                  if (rooms.length === 0) {
                    container.remove()
                  } else {
                    renderList()
                  }
                })
              })
            }
          })

          li.appendChild(a)
          li.appendChild(timeSpan)
          li.appendChild(delBtn)
          listEl.appendChild(li)
        })
      }

      renderList()

      // Material UI App Bar 아래에 주입
      const header =
        document.querySelector("header") ||
        document.querySelector('[class*="MuiAppBar"]') ||
        document.querySelector("nav")
      if (header && header.nextSibling) {
        header.parentElement?.insertBefore(container, header.nextSibling)
      } else {
        document.body.insertBefore(container, document.body.firstChild)
      }
    })
  } catch (e) {
    console.warn("[MB Helper] renderVisitHistory 오류:", e)
  }
}

// ==========================================
// 3. SPA 내비게이션 감지
// ==========================================
let lastUrl = location.href
let _renderPending = false

function onUrlChange() {
  const currentUrl = location.href

  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl
  }

  if (!_renderPending) {
    _renderPending = true
    requestAnimationFrame(() => {
      _renderPending = false
      if (isHomePage()) {
        renderVisitHistory()
      } else if (currentUrl.includes("/rooms/")) {
        // 방에 들어갔다면 방 이름을 수집
        let attempts = 0
        const interval = setInterval(() => {
          if (checkAndSaveRoom() || attempts > 20) {
            clearInterval(interval)
          }
          attempts++
        }, 1000)
      }
    })
  }
}

export function initHomeHistory() {
  // <title> 변화 감지
  try {
    const titleEl = document.querySelector("title")
    if (titleEl) {
      new MutationObserver(onUrlChange).observe(titleEl, {
        childList: true,
        characterData: true,
        subtree: true
      })
    }
  } catch (e) { }

  window.addEventListener("popstate", onUrlChange)
  window.addEventListener("hashchange", onUrlChange)

  // SPA fallback
  setInterval(() => {
    if (location.href !== lastUrl) onUrlChange()
  }, 2000)

  // 다른 탭에서의 스토리지 변경 동기화
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY] && isHomePage()) {
      renderVisitHistory()
    }
  })

  // 초기 실행
  onUrlChange()
}
