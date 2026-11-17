// 음성 입력(Web Speech API)과 읽어주기(TTS)
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = () => Boolean(Recognition);
export const ttsSupported = () => "speechSynthesis" in window;

export function listen({ onResult, onEnd, lang = "ko-KR" }) {
  if (!Recognition) { onEnd?.("unsupported"); return () => {}; }
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let error = null;
  let finished = false;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) final = true;
    }
    onResult?.(text.trim(), final);
  };
  rec.onerror = (e) => { error = e.error || "error"; };
  rec.onend = () => {
    if (finished) return;
    finished = true;
    onEnd?.(error === "no-speech" || error === "aborted" ? null : error);
  };
  try { rec.start(); } catch (err) { onEnd?.("error"); }
  return () => { try { rec.stop(); } catch { /* 이미 멈춤 */ } };
}

let koVoice = null;
function pickVoice() {
  if (!ttsSupported()) return null;
  const voices = speechSynthesis.getVoices();
  koVoice = voices.find((v) => v.lang === "ko-KR" && /female|여|yuna|sunhi|heami/i.test(v.name))
    || voices.find((v) => v.lang?.startsWith("ko")) || null;
  return koVoice;
}
if (ttsSupported()) {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

export function speak(text) {
  if (!ttsSupported() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = 0.95;
  u.pitch = 1.1;
  const v = koVoice || pickVoice();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}
