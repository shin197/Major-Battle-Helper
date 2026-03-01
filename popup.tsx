import { useEffect, useRef, useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

// ==========================================
// 1. 간단한 마크다운 렌더러 (별도 라이브러리 없이 구현)
// ==========================================
function MarkdownText({ text }: { text: string }) {
  const renderLine = (line: string) => {
    const html = line
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /`(.*?)`/g,
        '<code style="background:rgba(0,0,0,0.08);padding:2px 4px;border-radius:4px;font-family:monospace;font-size:0.9em">$1</code>'
      )
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  }

  // ✨ 수정된 부분: 정규식을 사용해 실제 줄바꿈(\n)과 문자열("\\n")을 모두 잡아냅니다.
  return (
    <div style={{ lineHeight: "1.5", fontSize: "12px", wordBreak: "keep-all" }}>
      {text.split(/\\n|\n/).map((line, i) => (
        <div key={i} style={{ minHeight: line ? "auto" : "0.5em" }}>
          {renderLine(line)}
        </div>
      ))}
    </div>
  )
}
// ==========================================
// 2. 호버 & 클릭(고정) 툴팁 아이콘 컴포넌트 (전체 창 기준 좌측 정렬)
// ==========================================
function InfoPopover({ text }: { text: string }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 고정 해제
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsPinned(false)
      }
    }
    if (isPinned) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isPinned])

  // 마우스를 올릴 때마다 현재 아이콘의 정확한 화면 좌표를 계산하여 저장합니다.
  const handleMouseEnter = (e: React.MouseEvent) => {
    setRect(e.currentTarget.getBoundingClientRect())
    setIsHovered(true)
  }

  const handleTogglePin = (e: React.MouseEvent) => {
    if (!isPinned) setRect(e.currentTarget.getBoundingClientRect())
    setIsPinned(!isPinned)
  }

  const show = isHovered || isPinned
  // 팝업창 상단 여유 공간이 150px 이하이면 말풍선이 아래로 열립니다.
  const isTop = rect ? rect.top >= 150 : true

  // ✨ 핵심 계산 로직
  // 팝업창의 기본 padding이 16px이므로, 말풍선이 화면 왼쪽 끝(16px 여백)에 딱 맞도록
  // 아이콘의 현재 위치(rect.left)만큼 반대로 당겨줍니다.
  const leftOffset = rect ? -(rect.left - 16) : 0

  // 말풍선 본체를 당긴 만큼, 꼬리는 다시 오른쪽으로 밀어서 아이콘 중앙(rect.width / 2)을 가리키게 합니다. (-4는 꼬리 크기의 절반)
  const tailLeft = rect ? rect.left - 16 + rect.width / 2 - 4 : 20

  return (
    <div
      ref={popoverRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center"
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}>
      <button
        onClick={handleTogglePin}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 4px",
          color: isPinned ? "#4A90E2" : "#999",
          fontSize: "14px",
          transition: "color 0.2s",
          display: "flex",
          alignItems: "center"
        }}
        title="설명 보기">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>

      {show && rect && (
        <div
          style={{
            position: "absolute",
            ...(isTop
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 8px)" }),
            // 계산된 오프셋을 적용하여 전체 창의 왼쪽 16px 여백에 딱 맞춥니다.
            left: `${leftOffset}px`,
            width: "308px", // 전체 너비(340px) - 양쪽 여백(32px)
            boxSizing: "border-box", // 패딩이 너비에 포함되도록 설정하여 삐져나가지 않게 함
            backgroundColor: "#2c3e50",
            color: "#ecf0f1",
            padding: "10px 12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
            cursor: "default"
          }}>
          {/* 말풍선 꼬리 */}
          <div
            style={{
              position: "absolute",
              ...(isTop ? { bottom: "-4px" } : { top: "-4px" }),
              // 꼬리는 정확히 원래의 아이콘(물음표) 중앙을 가리킵니다.
              left: `${tailLeft}px`,
              width: "8px",
              height: "8px",
              backgroundColor: "#2c3e50",
              transform: "rotate(45deg)"
            }}
          />
          <MarkdownText text={text} />
        </div>
      )}
    </div>
  )
}
// ==========================================
// 3. 개별 기능 토글 스위치 컴포넌트
// ==========================================
function FeatureToggle({
  id,
  label,
  description,
  onToggle
}: {
  id: string
  label: string
  description?: string
  onToggle: () => void
}) {
  const [enabled, setEnabled] = useStorage(`feature:${id}`, true)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnabled(e.target.checked)
    onToggle() // 변경 사항 발생 알림
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: "1px solid #f0f0f0",
        backgroundColor: enabled ? "#ffffff" : "#fafafa",
        transition: "background-color 0.2s"
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div
          style={{
            fontWeight: "600",
            fontSize: "14px",
            color: enabled ? "#2c3e50" : "#95a5a6",
            transition: "color 0.2s"
          }}>
          {label}
        </div>
        {description && <InfoPopover text={description} />}
      </div>

      {/* iOS 스타일 토글 스위치 */}
      <label
        style={{
          position: "relative",
          display: "inline-block",
          width: "44px",
          height: "24px",
          cursor: "pointer",
          flexShrink: 0
        }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleChange}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: enabled ? "#4A90E2" : "#cbd5e1",
            borderRadius: "24px",
            transition: "0.3s"
          }}>
          <div
            style={{
              position: "absolute",
              height: "20px",
              width: "20px",
              left: enabled ? "22px" : "2px",
              bottom: "2px",
              backgroundColor: "white",
              borderRadius: "50%",
              transition: "0.3s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
          />
        </div>
      </label>
    </div>
  )
}

// ==========================================
// 4. 메인 팝업 앱
// ==========================================
export default function IndexPopup() {
  const [hasChanged, setHasChanged] = useState(false)

  const handleSettingsChange = () => {
    setHasChanged(true)
  }

  return (
    <div
      style={{
        width: "340px",
        fontFamily:
          "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        backgroundColor: "#fff"
      }}>
      {/* 헤더 */}
      <div
        style={{
          padding: "16px",
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
        <span style={{ fontSize: "20px" }}>
          {process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true" ? "📡" : "❤️"}
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: "700",
            color: "#1e293b"
          }}>
          {process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true"
            ? "Major Battle Helper"
            : "CCFolia LOVER"}
        </h2>
      </div>

      {/* 설정 목록 */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {process.env.PLASMO_PUBLIC_MAJOR_BATTLE === "true" && (
          <FeatureToggle
            id="major-battle"
            label="메이저배틀 모드"
            description={
              "**메이저배틀** 룰에 맞춘 주사위 판정 봇 기능을 활성화합니다.\n\n`{S}`: 지난 주사위의 성공도\n`{S.#}`: 지난 주사위 판정의 성공한 개체수\n`/battle`: 전투 초기화 명령어\n`/dmg [*캐릭터*] **피해량** x**횟수** **타입**`: 데미지 주기\n(피해 타입 예시: 충격, 관통, 방사)\n`/u [**캐릭터**] **유닛 수**`: 유닛 수 설정\n(유닛 수 앞에 +/-가 붙으면 증감 모드)"
            }
            onToggle={handleSettingsChange}
          />
        )}
        <FeatureToggle
          id="bulk-drag"
          label="다중 토큰 제어"
          description={
            "휠 클릭 드래그로 토큰을 다중 선택합니다.\n현재 복사와 삭제는 스크린 패널과 마커 패널에만 적용됩니다.\n\n* `Ctrl+휠 드래그`: 선택 범위 추가\n* `Shift+휠 드래그`: 선택 범위 제외\n* `Ctrl+C`: 복사\n* `Delete`: 삭제"
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="alt-click"
          label="Alt+클릭 캐릭터 입력"
          description={
            "캐릭터 토큰을 `Alt + 좌클릭`하면 채팅창에 해당 캐릭터의 이름이 `[캐릭터]`로 입력됩니다."
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="clipboard"
          label="커스텀 클립보드"
          description={
            "**스크린 패널**, **마커 패널** 을 클립보드에서 직접 붙여넣을 수 있게 확장합니다."
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="slot-shortcuts"
          label="매크로 슬롯 단축키"
          description={
            "채팅창을 활성화 시킨 상태에서 활성화된 캐릭터를 빠르게 전환합니다.\n\n* `Ctrl + 숫자키(1~0)`: 해당 숫자 슬롯에 캐릭터 저장\n* `Alt + 숫자키(1~0)`: 저장된 슬롯의 캐릭터로 전환"
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="log-pager"
          label="채팅 로그 페이저"
          description={
            "채팅 로그 창 하단에 **페이지 넘기기(Pagination)** 버튼을 추가하여 과거 로그를 쉽게 탐색합니다."
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="chat-input"
          label="채팅창 기능 향상"
          description={
            "채팅창의 사용성을 대폭 올립니다.\n\n* `Ctrl+Enter`: 수식 자동 계산\n+: 덧셈, -:뺄셈, *:곱셈, /:나눗셈\n\\:나눗셈(올림), %: 나머지\n`{변수.max}`: 스테이터스의 최대값\n* `위/아래 방향키`: 입력 히스토리 탐색\n* 괄호 등 기호 자동 완성\n* `/stat` **[캐릭터]** **스테이터스**(=, +, -)**수치**, ...: 스탯 변경\n* `/cap`: 활성화된 캐릭터들의 스테이터스 상한제한\n(최대값이 0인건 처리하지 않음)"
          }
          onToggle={handleSettingsChange}
        />
      </div>

      {hasChanged && (
        <div
          style={{
            margin: "16px",
            padding: "12px",
            fontSize: "13px",
            color: "#047857",
            backgroundColor: "#d1fae5",
            border: "1px solid #10b981",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.3s ease-in-out"
          }}>
          <span>💡</span>
          <span style={{ lineHeight: "1.4" }}>
            설정이 변경되었습니다. <br />
            코코포리아 화면을 <b>새로고침(F5)</b> 하시면 적용됩니다.
          </span>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
