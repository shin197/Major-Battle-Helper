
const TAB_SCROLLER = "#root div.MuiDrawer-docked form header div.MuiTabs-scroller"
const TAB_BTN_SEL      = `${TAB_SCROLLER} > div > button[role='tab']`
const CHAT_LOG_SEL     = "#root div.MuiDrawer-docked > div > ul > div > div"
const TAB_BAR      = "div.MuiTabs-scroller.MuiTabs-hideScrollbar";
const MAIN_TAB_ID  = "main";           // 첫 번째 탭의 id(또는 data-value)가 ‘main’

let logObs: MutationObserver | null = null

const DICE_LINE_REGEX =
  /\(\d+\s*TY\s*\d+\)\s*[＞>]\s*[\d,\s]+?\s*[＞>]\s*(?:\[\d+\]×\d+(?:,\s*)?)+\s*$/u

function handleLine(el: HTMLElement, currentBox: HTMLElement) {
  if (!isMainTabActive()) return;
  if (!currentBox.contains(el)) return          // 다른 탭으로 옮겨진 줄 skip
  if (el.dataset.helper === "dice-marked") return

  const diceNode = el.querySelector("p > span.MuiTypography-root.MuiTypography-body2")

  if(!diceNode) return

  const text = getOwnText(el.querySelector("p > span.MuiTypography-root.MuiTypography-body2")) 

  // console.log(text)

  // ③ 주사위 판정인지 검사
  if (!DICE_LINE_REGEX.test(text)) return

  // const text2 = el.textContent ?? ""
  const text2 = getOwnText(el.querySelector("p"))+text
  // console.log(text2)
  // if (!DICE_LINE_REGEX.test(text)) return

  const { S, isCritical } = calcSuccess(text2)   // S 계산 + 대성공 여부 반환하도록 수정
  const color =
    S === 0             ? "#888" :
    isCritical          ? "#29b6f6" : // 파랑
                          "#fff"      // 흰색
                          
  const badge = document.createElement("span")
  badge.dataset.helper = "dice-result"
  badge.style.cssText = `margin-left:.5em;font-weight:${isCritical ? 700 : 400};
                       color:${color}`
  badge.textContent = `\u{1F3B2}S=${S}`; // \u{1F3B2} == 🎲

  const diceSpan = el.querySelector<HTMLSpanElement>("p > span")
  diceSpan?.insertAdjacentElement("afterend", badge)
  el.dataset.helper = "dice-marked"
}

;(async () => {
  /* ------------- 여기부터 async/await 마음껏 사용 -------------- */

  const TAB_LIST_SEL =
    "#root > div > div.MuiDrawer-root.MuiDrawer-docked > div > div > form > \
     header div.MuiTabs-scroller.MuiTabs-hideScrollbar.MuiTabs-scrollableX"

  // ❶ 탭 리스트 div가 화면에 나타날 때까지 기다림
  const tabList = await waitForElem(TAB_LIST_SEL)

  // ❷ 현재 선택된 탭 버튼 얻기
  let activeBtn = await getActiveBtn(tabList)

  // ❸ 처음에 연결: 채팅 로그 박스 찾고 옵저버 달기
  attachLogObserver(activeBtn)

  // ❹ 이후 탭 전환 감시
  new MutationObserver(() => {
    const btn = tabList.querySelector<HTMLButtonElement>(
      "button[aria-selected='true']"
    )
    if (btn && btn !== activeBtn) {
      activeBtn = btn
      attachLogObserver(activeBtn)
    }
  }).observe(tabList, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected"]
  })

  /* -------------------- 함수 정의 -------------------- */

  async function getActiveBtn(root: HTMLElement) {
    // 이미 선택된 것이 있으면 바로 반환
    const now = root.querySelector<HTMLButtonElement>(
      "button[aria-selected='true']"
    )
    if (now) return now

    // 없으면 selected 속성이 붙을 때까지 대기
    return new Promise<HTMLButtonElement>((res) => {
      const obs = new MutationObserver(() => {
        const btn = root.querySelector<HTMLButtonElement>(
          "button[aria-selected='true']"
        )
        if (btn) {
          obs.disconnect()
          res(btn)
        }
      })
      obs.observe(root, {
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-selected"]
      })
    })
  }

  function attachLogObserver(tabBtn: HTMLButtonElement) {
    // console.log("[chat] 현재 탭:", tabBtn.textContent?.trim())
    const logBox = document.querySelector<HTMLElement>(CHAT_LOG_SEL)

    if (!logBox) return console.warn("logBox not found")

    logObs?.disconnect()

    /* 3) 화면에 이미 있는 <li>/<div> 들 먼저 처리 */
    logBox.querySelectorAll(":scope > *").forEach((n) =>
      handleLine(n as HTMLElement, logBox)
    )

    /* 4) 이후 들어올 노드 감시 */
    logObs = new MutationObserver((records) => {
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 1) handleLine(n as HTMLElement, logBox)
        })
      )
    })
    logObs.observe(logBox, { childList: true })
  }

})()

function waitForElem(
  sel: string,
  timeout = 10_000
): Promise<HTMLElement> {
  return new Promise((res, rej) => {
    const found = document.querySelector<HTMLElement>(sel)
    if (found) return res(found)

    const obs = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) {
        obs.disconnect()
        clearTimeout(tId)
        res(el)
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })

    const tId = setTimeout(() => {
      obs.disconnect()
      rej(Error(`timeout: selector ${sel}`))
    }, timeout)
  })
}

function calcSuccess(rawLine: string): { S: number | null; isCritical: boolean } {
  try {
    const HEAD_REGEX = /(?<cnt>[0-9+\-*/()\s]+)\s*TY\s*(?<size>\d+)[^(【]*(?:\((?<opts>[^)]*)\))?/u;

    const head = HEAD_REGEX.exec(rawLine)
    if (!head?.groups) return { S: null, isCritical: false };

    const tySize = Number(head.groups.size);

    const rawOpts = head.groups.opts ?? "";       // 없으면 빈 문자열

    const tokens = rawOpts                    // 「+2, !, neg, 특수」 등
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(t => t.trim());

    const plus   = Number(tokens.find(t => /^\+?\d+$/.test(t))?.replace("+", "") ?? 0);
    const flags  = tokens.filter(t => !/^\+?\d+$/.test(t));

    const dicePart = rawLine.match(/[＞>]\s*([\d,\s]+?)\s*[＞>]/u)?.[1]
    
    if (!dicePart) return { S: null, isCritical: false }
    const dice = dicePart.split(",").map((d) => Number(d.trim()))

    const hasBang = flags.some((f) => f === "!");
    const groupified = flags.some((f) => f.startsWith("#"));
    // const hasNeg = flags.some((f) => f === "neg")

    // console.log({ dice, tySize, plus, flags });
    // console.log(dice, plus)

    /* ③ S 계산 */
    let S = 0
    const tier = tySize <= 4 ? 1
                : tySize <= 6 ? 2
                : tySize <= 8 ? 3
                : tySize <= 10 ? 4
                : tySize <= 12 ? 5
                : 6
    
    const isMax    = (v: number) => v === tySize
    const maxCount = dice.filter(isMax).length
    const ones     = dice.filter((d) => d === 1).length
    let maxS = Infinity
    const count = Number((flags.find(f => /^#\d+$/.test(f)) ?? "1").slice(1));
    const diceCount = Math.floor(dice.length / count)

    for (const v of dice) {
      // 기본 성공치
      let add =
        v >= 20
          ? 6
          : v >= 12
          ? 5
          : v >= 10
          ? 4
          : v >= 8
          ? 3
          : v >= 6
          ? 2
          : v >= 4
          ? 1
          : 0

      /* (+1) : 3의 보너스 */
      if (plus >= 1 && v === 3) add = 1

      /* (+2) : 5의 보너스 & ‘1’ 무시 조건① */
      if (plus >= 2 && v === 5) add = 2

      S += add
    }

    const onePenalty =
      ones -
      (plus >= 2 && maxCount === 1 ? 1 : 0) -
      (plus >= 3 && !dice.includes(2) ? 1 : 0)

    if(groupified){
      // 그룹화 룰
      maxS = Math.max(tier * (count - ones) * diceCount, 0)
      S = Math.min(maxS, S)
      // console.log(tier, count, diceCount)
      // console.log("maxS: ",maxS)
    }else{
      /* 1 이 하나라도 && 무시되지 않았다면 S=0 */
      if (onePenalty > 0 && !hasBang) S = 0

      /* 대성공 배수 */
      if (maxCount >= 2 && S > 0) S *= maxCount
    }

    return { S, isCritical: maxCount >= 2 && S > 0 }
  } catch {
    return { S: null, isCritical: false }
  }
}
function isMainTabActive(): boolean {
  const activeBtn = document.querySelector(
    `${TAB_BAR} button[aria-selected="true"]`
  ) as HTMLElement | null;

  return !!activeBtn && (
    activeBtn.id === MAIN_TAB_ID ||
    activeBtn.dataset.value === MAIN_TAB_ID
  );
}

waitForElem(TAB_BAR).then((tabBar) => {

  const update = () => {
    const show = isMainTabActive();
    document.querySelectorAll<HTMLElement>(".dice-result")
      .forEach((b) => b.style.display = show ? "inline" : "none");
  };

  // 처음 한 번
  update();

  // aria-selected 변화를 감시
  new MutationObserver(update).observe(tabBar, {
    attributes: true,
    subtree: true,
    attributeFilter: ["aria-selected"]
  });
});

function getOwnText(p: HTMLElement): string {
  return Array.from(p.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)   // <span> 제외
    .map((n) => n.textContent ?? "")
    .join("")
    .trim()
}