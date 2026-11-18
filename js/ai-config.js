// =============================================================
//  음성 AI 비서 설정 (Firebase AI Logic + Gemini)
//  README.md의 "음성 AI 비서 연결" 단계를 따라
//  Fraud Defense(reCAPTCHA Enterprise) '키 ID(사이트 키)'를 아래에 넣으면 켜져요.
// =============================================================
export const RECAPTCHA_SITE_KEY = "6LeNCyYuAAAAAAmLLFGlPYwhBmAnsPbEvfIY75R4";

// 위에서부터 차례로 시도해요. 모델 이름이 바뀌면 여기만 고치면 돼요.
export const AI_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];
