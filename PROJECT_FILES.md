# Major Battle Helper — 파일별 기능 요약

## 폴더: utils
- elements.ts  
  DOM 요소 선택자 및 엘리먼트 관련 헬퍼(공통 CSS 셀렉터, 엘리먼트 생성·조회 등).
- utils.ts  
  범용 유틸리티 함수들(형변환, 안전 검사, 작은 도우미 함수들).
- wait-for.ts  
  특정 DOM 요소/상태가 준비될 때까지 대기하는 유틸(비동기 대기, MutationObserver 래퍼).

## 폴더: major-battle
- battle-init.ts  
  전투 관련 초기화 로직(전투 진입 시 설정·준비 작업).
- dice-result.ts  
  주사위 결과 파싱·해석 및 결과 포맷팅 처리.
- dice-roll13.0.ts  
  주사위 롤(버전 13.0)과 호환되는 처리 로직/포맷 구현.
- dice-var-exp.ts  
  주사위 변수 및 식(expression) 처리 관련 유틸(변수 치환·평가).
- enter-eval.ts  
  입력(엔터) 기반 식 평가/처리 흐름(채팅 입력 등에서 엔터로 계산 실행).
- index.ts  
  major-battle 모듈의 진입점 및 모듈 초기화 조합 코드.
- init-battle.ts  
  전투 초기화의 세부 절차(세팅 적용·상태 초기화 등), battle-init과 보완 관계.
- some-script.ts  
  보조 스크립트 모음(작업 보조 유틸·임시 스크립트).
- stub.ts  
  테스트용/플레이스홀더 함수나 인터페이스의 더미 구현.

## 폴더: contents
- anchors.ts  
  페이지 내 앵커 관리 및 위치 참조 관련 헬퍼.
- character-data.ts  
  캐릭터(유닛) 데이터 추출·정규화·포맷팅 기능(스탯·상태 등).
- character-store.ts  
  캐릭터 데이터 저장·복원 로직(세션/로컬 저장소 연동 가능).
- chat-list.ts  
  채팅/로그 리스트 관련 렌더링 및 항목 관리.
- debug-probe.ts  
  디버깅용 검사·프로브 함수(개발 편의용 로그·상태 검사).
- dev-wrapper.ts  
  개발용 래퍼(전역 노출, 디버깅 훅 등).
- inject-copy-faces.ts  
  얼굴 이미지(아바타) 복사/삽입 관련 주입 스크립트.
- inject.ts  
  페이지에 스크립트를 주입하는 진입 스크립트(초기 인젝션 처리).
- major-battle.ts  
  프로젝트의 핵심 기능 통합 모듈(여러 컴포넌트 조합하여 전투 보조 기능 제공).
- slot-shortcut.ts  
  슬롯 및 단축키 처리(키 바인딩으로 슬롯 동작 트리거).
- toast.ts  
  사용자 토스트 알림 표시 유틸(간단한 피드백 출력).
- token-drag.ts  
  토큰 드래그/드롭 관련 인터랙션 처리(마우스 이벤트, 위치 업데이트).

---

파일별 설명은 코드와 주석을 확인해 작성한 요약입니다. 특정 파일의 내부 함수·API 설명을 원하시면 해당 파일을 열어 주시면 상세한 내용을 추가로 정리해 드리겠습니다.