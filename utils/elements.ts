const CUR_CHAR_NAME_INPUT_SEL =
  '#root > div > div.MuiDrawer-root.MuiDrawer-docked> div > div > form > div:nth-child(2) > div > div > input'
const CHAT_PALETTE_BTN_SEL =
  '#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > div:nth-child(2) > div:nth-child(3) > button'
const MESSAGE_BOX_SEL = 'textarea[id^="downshift"]'

const TAB_LIST_SEL =
  "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > \
  header div.MuiTabs-scroller.MuiTabs-hideScrollbar.MuiTabs-scrollableX"

const TAB_SCROLLER_SEL = "#root div.MuiDrawer-docked form header div.MuiTabs-scroller"
const TAB_BTN_SEL      = `${TAB_SCROLLER_SEL} > div > button[role='tab']`
const CHAT_LOG_SEL     = "#root div.MuiDrawer-docked > div > ul > div > div"
const TAB_BAR_SEL      = "div.MuiTabs-scroller.MuiTabs-hideScrollbar"

const SIDE_CHAR_LIST_SELECTOR =
  '#root > div > div.sc-liAOXi.jHiGQZ > div.sc-gDyKqB.fXPYIC' // TODO: 이거 안정적으로 실행 가능하게 하기
const TABLE_SELECTOR =
  '#root > div > div.sc-liAOXi.jHiGQZ > div.sc-bRuaPG.dkLqjp'

function getCurrentCharacterName(): string | null {
  for (const sel of CUR_CHAR_NAME_INPUT_SEL) {
    const el = document.querySelector<HTMLInputElement>(sel)
    if (el?.value?.trim()) return el.value.trim()
  }
  return null
}