import type { PlasmoCSConfig } from "plasmo"

import { initTokenAltClick } from "~features/alt-click"
import { initBulkDrag } from "~features/bulk-drag"
import { waitForCoreEngine } from "~major-battle/main/dicebot"
import {
  loadMainFeatures,
  type FeatureDefinition
} from "~utils/feature-manager"

import { initCoreEngine } from "../core/main/bridge"

export const config: PlasmoCSConfig = {
  matches: ["https://ccfolia.com/rooms/*"],
  world: "MAIN",
  run_at: "document_idle"
}

const IS_MAJOR_BATTLE = process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"

const mainFeatures: FeatureDefinition[] = [
  {
    id: "core-engine",
    name: "코어 엔진",
    init: initCoreEngine,
    defaultEnabled: true
  },
  { id: "bulk-drag", name: "다중 드래그", init: initBulkDrag },
  { id: "alt-click", name: "알트 클릭", init: initTokenAltClick },
  {
    id: "major-battle",
    name: "Major Battle 기능",
    init: waitForCoreEngine
  }
]

// ✨ ISOLATED에 설정값을 요청하며 기능 실행!
loadMainFeatures(mainFeatures)
