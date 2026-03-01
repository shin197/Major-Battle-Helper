// 💡 features 폴더에서 알맹이를 가져옵니다.
import type { PlasmoCSConfig } from "plasmo"

import { initChatInputBox } from "~features/chat-input-box"
import { initCustomClipboard } from "~features/clipboard-paste"
import { initSlotShortcuts } from "~features/slot-shortcut"
import { bootstrapUiAnchors } from "~utils/anchors"
import {
  initSettingsBridge,
  loadFeatures,
  type FeatureDefinition
} from "~utils/feature-manager"
// 👈 추가
import { initMouseTracker } from "~utils/mouse-tracker"

import { initChatLogPager } from "../features/log-pager"
import { initToastObserver } from "../utils/isolated/toast"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  run_at: "document_idle",
  all_frames: true
}

const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

// 💡 켜고 끌 수 있는 기능들을 배열로 정리합니다.
const isolatedFeatures: FeatureDefinition[] = [
  {
    id: "ui-anchors",
    name: "UI 앵커",
    init: bootstrapUiAnchors,
    defaultEnabled: true
  },
  {
    id: "toast",
    name: "토스트 관찰자",
    init: initToastObserver,
    defaultEnabled: true
  },
  { id: "slot-shortcuts", name: "슬롯 단축키", init: initSlotShortcuts },
  { id: "chat-input", name: "채팅 입력창", init: initChatInputBox },
  { id: "log-pager", name: "채팅 로그 페이저", init: initChatLogPager },
  { id: "clipboard", name: "커스텀 클립보드", init: initCustomClipboard },
  { id: "mouse-tracker", name: "마우스 추적기", init: initMouseTracker }
]

// 실행!
loadFeatures(isolatedFeatures)

initSettingsBridge()
