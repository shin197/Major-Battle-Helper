import { initAnchorsAsync, type AnchorSpec } from "~utils/elements"

const ANCHORS: AnchorSpec[] = [
  {
    key: "side-char-list",
    selector: "#root > div > div:nth-of-type(2) > div:nth-of-type(8)"
  },
  {
    key: "chat-log-container",
    selector: "#root > div > div:nth-of-type(3) > div > ul > div > div"
  }
]
export async function bootstrapUiAnchors() {
  // console.log("[anchors] init start")

  const found = await initAnchorsAsync(ANCHORS, { timeout: 15_000 })

  console.info("[anchors] init done", Array.from(found.keys()))
  // console.log("[anchors] count", found.size)
}

;(async () => {
  await bootstrapUiAnchors()
})()
