# 코코포리아 매니저 (Major-Battle-Helper)

본 프로젝트는 TRPG 플랫폼인 **코코포리아(CCfolia)**의 사용성을 극대화하기 위해 개발된 Chrome 확장 프로그램입니다.
코코포리아의 내부 상태(Redux)와 Webpack 모듈을 탈취(Hijacking)하여 동작하는 강력한 범용 API를 기반으로, 토큰 그룹 이동, 표정 일괄 복사 등의 **편의성(QoL) 기능**과 특정 룰을 위한 **전용 전투 시스템(Major Battle)**을 제공합니다.

## 🏗️ 아키텍처 핵심 (World Isolation)

크롬 확장 프로그램의 보안 한계를 극복하기 위해 두 가지 실행 환경(World)을 브릿지로 연결하여 동작합니다.

1. **MAIN World (`/contents/inject/`)**:
   - 코코포리아 원본 JavaScript와 동일한 메모리 공간에서 실행됩니다.
   - `hijack.ts`를 통해 React Fiber 트리와 Redux Store, Firebase DB 인스턴스를 강제로 탈취합니다.
   - 탈취한 권한으로 토큰 생성/조작, 캐릭터 수정 등을 수행하는 내부 API(`ccfoliaAPI`)를 구축합니다.
2. **ISOLATED World (`/contents/`, `/core/`)**:
   - 확장 프로그램의 독립된 메모리 공간에서 실행되며, 안전하게 DOM 요소에 접근하여 UI를 추가합니다 (MutationObserver 등).
   - `ccfolia-api.ts` (`ccf` 객체)를 통해 `postMessage` 기반의 비동기 RPC 통신으로 MAIN World의 기능을 원격 호출합니다.

## 🚀 주요 기능 (Features)

### 1. 범용 편의성 기능 (General QoL)

_해당 기능들은 룰에 상관없이 모든 코코포리아 룸에서 유용하게 사용될 수 있습니다._

- **다중 토큰 그룹 드래그 (`token-drag.ts`)**: 마우스 드래그 박스로 여러 토큰을 한 번에 선택하고, Redux API를 직접 호출하여 픽셀(캐릭터)과 그리드(스크린 패널 등)의 단위를 자동으로 보정하며 즉각적인 단체 이동을 지원합니다.
- **표정 일괄 복사 (`inject-copy-faces.ts`)**: 캐릭터 컨텍스트 메뉴에 "표정 복사" 항목을 주입하여, 번거로운 클릭업 없이 클립보드에 표정 JSON 데이터를 한 번에 추출합니다.
- **수식 자동 계산 (`enter-eval.ts`)**: 채팅 입력 시 텍스트 내에 포함된 수식을 파싱하여 자동으로 계산 결과를 반영합니다.
- **채팅 인터셉트 (`chat-input-box.ts`)**: 채팅 전송(Enter) 이벤트를 가로채어 특정 매크로나 명령어를 감지하고 변환합니다.

### 2. 특정 룰 전용 기능 (Major Battle System)

_디렉토리: `/major-battle`_

- **전투 초기화 (`battle-init.ts`)**: 전투 시작 시 필요한 맵 세팅, 캐릭터 배치, 상태 이상 초기화 등을 자동화합니다.
- **다이스 매크로 및 변수 확장 (`dice-roll.ts`, `dice-var-exp.ts`)**: 해당 룰에 특화된 다이스 굴림(Dice Roll) 명령어를 파싱하고, 캐릭터 파라미터를 참조하여 동적으로 수치를 보정합니다.
- **결과 처리 (`dice-result.ts`)**: 채팅창에 출력된 주사위 결과를 감지하여, 대미지 계산 및 상태 이상 적용을 자동화합니다.
  > 💡 **분리 가능 설계 (Pluggable)**:
  > 차후 범용 확장 프로그램 릴리스 시, 이 디렉토리 내의 기능은 환경변수나 플러그인 해제 방식으로 프로젝트에서 완벽하게 제외(Exclude)될 수 있도록 결합도를 낮추어 설계되었습니다.

## 🧰 주요 유틸리티 (Utilities)

_디렉토리: `/utils`_

- **`token.ts`**: DOM 엘리먼트에서 시작하여 부모 컴포넌트로 거슬러 올라가며 `__reactFiber$` 속성을 탐색, 실제 토큰의 고유 ID를 100% 확률로 추출해 내는 핵심 유틸리티입니다.
- **`elements.ts` / `wait-for.ts`**: 비동기적으로 렌더링되는 React DOM 요소를 안전하게 찾고 기다리는 유틸리티입니다.
