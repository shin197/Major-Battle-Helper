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
  onToggle,
  onSettingsClick
}: {
  id: string
  label: string
  description?: string
  onToggle: () => void
  onSettingsClick?: () => void
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

      {/* 설정 버튼 및 토글 스위치 영역 */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            title="세부 설정"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              borderRadius: "4px",
              transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        )}

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
    </div>
  )
}

// ==========================================
// 4. AI 세부 설정 컴포넌트
// ==========================================
const DEFAULT_SYSTEM_PROMPT = `당신은 TTRPG 세션에서 NPC를 연기합니다.
당신은 GM이 아닙니다. 당신은 오직 지정된 캐릭터의 대사, 태도, 감정, 행동 선언만 작성합니다.

[권한]
할 수 있는 것:
- 지정된 캐릭터의 대사 작성
- 지정된 캐릭터의 짧은 행동 묘사
- 지정된 캐릭터의 의도와 행동 선언
- 룰이나 정보가 불확실할 때 GM에게 질문

하면 안 되는 것:
- 다른 PC/NPC의 행동, 감정, 결과를 확정하기
- 판정 결과를 확정하기
- 지정된 캐릭터가 아닌 캐릭터 또는 한 번에 두 명 이상의 캐릭터를 롤플레잉 하기
- 숨겨진 정보를 아는 것처럼 말하기
- 세계관에 없는 설정, 조직, 비밀을 임의로 추가하기
- 장면을 멋대로 전환하거나 종료하기
- 플레이어의 의도를 대신 결정하기

[출력 형식]
- 캐릭터의 반응만 작성한다.
- 응답의 맨 앞에 절대 캐릭터의 이름을 쓰지 않는다. (예: "[캐릭터]: " 와 같은 화자 표시 금지)
- 대사는 5문장 이내로 제한한다. 큰 따옴표로 감싼다. 연속되는 대사는 따옴표를 닫지 않고 이어서 작성한다.
- 필요하다면, 내면의 생각 묘사는 소괄호와 작은 따옴표로 감싼다. ('내면의 생각 묘사')
- 필요하다면, 행동 묘사는 대사나 내면의 생각 묘사 뒤에 짧게 작성하며, 따옴표로 감싸지 않는다.
- 대사, 생각 묘사, 행동 묘사를 전환할 때는 개행 (\n)을 붙인다.
- 판정이나 룰 확인이 필요하면 대사, 행동 묘사, 생각 묘사를 일절 하지 않고 바로 [GM 확인: ...]을 붙인다.`;

const AI_MODELS = [
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "openai" },
  { id: "gpt-5.5", name: "GPT-5.5", provider: "openai" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "gemini" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "claude" },
  { id: "grok-1.5", name: "Grok 1.5", provider: "grok" },
]

function AiSettingsView({ onBack }: { onBack: () => void }) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [model, setModel] = useState("gpt-4.1-mini")
  const [historyCount, setHistoryCount] = useState(30)

  const [backup, setBackup] = useState<any>(null)

  useEffect(() => {
    chrome.storage.local.get("ai_settings_global", (res) => {
      const data = res["ai_settings_global"]
      if (data) {
        const keys = data.apiKeys || {}
        if (data.apiKey && !keys["openai"]) {
          keys["openai"] = data.apiKey
        }
        const prompt = data.systemPrompt || DEFAULT_SYSTEM_PROMPT
        const m = data.model || "gpt-4.1-mini"
        const hc = data.historyCount ?? 30

        setApiKeys(keys)
        setSystemPrompt(prompt)
        setModel(m)
        setHistoryCount(hc)

        setBackup({ apiKeys: keys, systemPrompt: prompt, model: m, historyCount: hc })
      } else {
        setBackup({ apiKeys: {}, systemPrompt: DEFAULT_SYSTEM_PROMPT, model: "gpt-4.1-mini", historyCount: 30 })
      }
    })
  }, [])

  useEffect(() => {
    if (backup !== null) {
      chrome.storage.local.set({
        "ai_settings_global": { apiKeys, systemPrompt, model, historyCount, apiKey: apiKeys["openai"] || "" }
      })
    }
  }, [apiKeys, systemPrompt, model, historyCount, backup])

  const handleCancel = () => {
    if (backup) {
      setApiKeys(backup.apiKeys)
      setSystemPrompt(backup.systemPrompt)
      setModel(backup.model)
      setHistoryCount(backup.historyCount)
    }
  }

  const handleResetToDefault = () => {
    if (!confirm("시스템 프롬프트와 옵션을 기본값으로 초기화하시겠습니까?")) return
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    setHistoryCount(30)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === "string") {
        setSystemPrompt(text)
      }
    }
    reader.readAsText(file)
  }

  const currentProvider = AI_MODELS.find(m => m.id === model)?.provider || "openai"
  const currentProviderName = currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)

  const handleApiKeyChange = (val: string) => {
    setApiKeys(prev => ({ ...prev, [currentProvider]: val }))
  }

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 뒤로가기 헤더 */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "16px", color: "#64748b", padding: "0 8px 0 0"
          }}
        >
          ← 뒤로
        </button>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1e293b" }}>
          AI NPC 설정
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600" }}>
              {currentProviderName} API 키 (전역 설정)
            </label>
            <button
              onClick={() => {
                if (confirm("모든 제공자의 API 키를 삭제하시겠습니까?")) setApiKeys({})
              }}
              style={{ background: "none", border: "none", fontSize: "12px", color: "#ef4444", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              키 전체 삭제
            </button>
          </div>
          <input
            type="password"
            value={apiKeys[currentProvider] || ""}
            onChange={e => handleApiKeyChange(e.target.value)}
            placeholder={`${currentProviderName} API Key...`}
            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
              모델 선택
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
            >
              {AI_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div style={{ width: "100px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
              메시지 수
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={historyCount}
              onChange={e => setHistoryCount(Number(e.target.value))}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600" }}>
              시스템 프롬프트 (System Prompt)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", color: "#64748b" }} title="프롬프트 파일 업로드">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <input type="file" accept=".txt,.md" style={{ display: "none" }} onChange={handleFileUpload} />
              </label>
            </div>
          </div>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="AI에게 부여할 역할이나 세계관, NPC의 성격 등을 적어주세요."
            style={{ width: "100%", height: "160px", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box", resize: "none" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
          <button
            onClick={handleResetToDefault}
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ef4444", color: "#ef4444", background: "none", cursor: "pointer", fontSize: "13px" }}
          >
            초기화
          </button>
          <button
            onClick={handleCancel}
            style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", color: "#64748b", background: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600", transition: "background 0.2s" }}
          >
            취소 (되돌리기)
          </button>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 5. 메인 팝업 앱
// ==========================================
export default function IndexPopup() {
  const [hasChanged, setHasChanged] = useState(false)
  const [showAiSettings, setShowAiSettings] = useState(false)

  const handleSettingsChange = () => {
    setHasChanged(true)
  }

  if (showAiSettings) {
    return (
      <div style={{ width: "340px", fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif", backgroundColor: "#fff", minHeight: "450px" }}>
        <AiSettingsView onBack={() => setShowAiSettings(false)} />
      </div>
    )
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
          label="향상된 마우스 액션"
          description={
            "`Ctrl + 좌클릭`: 핑\n`Alt + 좌클릭`: 캐릭터 토큰 클릭시 채팅창에 해당 캐릭터의 이름이 `[캐릭터]`로 입력됩니다.\n`E (토큰 위에서)`: 이미지가 확대됩니다."
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
            "채팅창의 사용성을 대폭 올립니다.\n\n* `Ctrl+Enter`: 수식 자동 계산\n+: 덧셈, -:뺄셈, *:곱셈, /:나눗셈\n\\:나눗셈(올림), %: 나머지\n`{변수.max}`: 스테이터스의 최대값\n* `위/아래 방향키`: 입력 히스토리 탐색\n* 괄호 등 기호 자동 완성\n* `/g` 또는 `/ㅎ` **[내용]**: 코코포리아 시스템 메시지 전송\n* 채팅 메시지 위에 마우스를 올려 **삭제 버튼** 표시\n* `/stat` **[캐릭터]** **스테이터스**(=, +, -)**수치**, ...: 스탯 변경\n* `/cap`: 활성화된 캐릭터들의 스테이터스 상한제한\n(최대값이 0인건 처리하지 않음)"
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="more-menu"
          label="향상된 메뉴"
          description={
            "편집창에서, 토큰을 우클릭 했을 때 더 많은 옵션을 지원합니다."
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="face-button"
          label="표정 변경 버튼"
          description={
            "캐릭터의 표정을 바꾸는 버튼을 추가합니다."
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="home-history"
          label="홈 방문 기록"
          description={
            "코코포리아 홈(/home)에 최근 방문했던 방 목록을 표시합니다."
          }
          onToggle={handleSettingsChange}
        />
        <FeatureToggle
          id="ai-chat"
          label="AI NPC 보조"
          description={
            "우측 설정 버튼을 눌러 API 키와 시스템 프롬프트를 등록하면, 채팅 입력창에서 AI가 작성한 NPC 대사를 제안받을 수 있습니다."
          }
          onToggle={handleSettingsChange}
          onSettingsClick={() => setShowAiSettings(true)}
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
