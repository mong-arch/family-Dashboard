// Gemini(Firebase AI Logic) 연결 — 함수 호출로 대시보드를 조작해요.
import { FB_BASE, getFirebaseApp } from "./store.js";
import { RECAPTCHA_SITE_KEY, AI_MODELS } from "./ai-config.js";

export const aiConfigured = () => Boolean(RECAPTCHA_SITE_KEY);

let sdk = null;
let ai = null;
let workingModel = null;

async function ensureAI() {
  if (ai) return ai;
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase에 연결된 뒤에 쓸 수 있어요");
  const [aiMod, acMod] = await Promise.all([
    import(`${FB_BASE}/firebase-ai.js`),
    import(`${FB_BASE}/firebase-app-check.js`)
  ]);
  try {
    acMod.initializeAppCheck(app, { provider: new acMod.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  } catch (e) {
    if (!/already/i.test(String(e?.message))) console.warn("App Check", e);
  }
  sdk = aiMod;
  ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
  return ai;
}

function toSchema(params) {
  const { Schema } = sdk;
  const props = {};
  const optional = [];
  for (const [k, v] of Object.entries(params || {})) {
    let sch;
    if (v.type === "array") sch = Schema.array({ items: Schema.string(), description: v.description });
    else if (v.type === "number") sch = Schema.number({ description: v.description });
    else if (v.enum) sch = Schema.enumString({ enum: v.enum, description: v.description });
    else sch = Schema.string({ description: v.description });
    props[k] = sch;
    if (v.optional) optional.push(k);
  }
  return Schema.object({ properties: props, optionalProperties: optional });
}

// tools: [{ name, description, params: {key: {type, description, enum, optional}}, run: async (args) => result }]
export async function askAssistant({ text, system, tools, history = [] }) {
  await ensureAI();
  const decls = tools.map((t) => ({ name: t.name, description: t.description, parameters: toSchema(t.params) }));
  const models = workingModel ? [workingModel, ...AI_MODELS.filter((m) => m !== workingModel)] : AI_MODELS;
  let lastErr = null;
  for (const name of models) {
    try {
      const model = sdk.getGenerativeModel(ai, {
        model: name,
        systemInstruction: system,
        tools: decls.length ? [{ functionDeclarations: decls }] : undefined,
        generationConfig: { temperature: 0.6, maxOutputTokens: 400 }
      });
      const chat = model.startChat({ history });
      let res = await chat.sendMessage(text);
      const done = [];
      for (let round = 0; round < 4; round++) {
        const calls = res.response.functionCalls?.() || [];
        if (!calls.length) break;
        const parts = [];
        for (const c of calls) {
          const tool = tools.find((t) => t.name === c.name);
          let out;
          try { out = tool ? await tool.run(c.args || {}) : { error: "없는 기능" }; } catch (e) { out = { error: String(e?.message || e) }; }
          done.push({ name: c.name, args: c.args, out });
          parts.push({ functionResponse: { name: c.name, response: { result: out } } });
        }
        res = await chat.sendMessage(parts);
      }
      workingModel = name;
      let reply = "";
      try { reply = res.response.text(); } catch { reply = ""; }
      return { reply: reply.trim(), actions: done, history: await chat.getHistory() };
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      // 모델 이름 문제면 다음 모델로, 아니면 바로 알려줘요.
      if (!/not found|404|not supported|unsupported|model/i.test(msg)) break;
    }
  }
  throw lastErr || new Error("AI에 연결하지 못했어요");
}
