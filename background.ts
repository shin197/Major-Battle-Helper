// background.ts
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "SET_BADGE") {
    chrome.action.setBadgeBackgroundColor({ color: msg.bg || "#4caf50" })
    chrome.action.setBadgeText({
      text: msg.text ?? "",
      tabId: sender.tab?.id   // 탭별 배지 → 전체라면 tabId 생략
    })
  }

  if (msg.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "", tabId: sender.tab?.id })
  }
})


// background.ts
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "LOG_CHARS") {
    chrome.tabs.sendMessage(sender.tab!.id!, { type: "GET_CHARACTERS" }, (chars) => {
      console.table(chars)
    })
  }
})
