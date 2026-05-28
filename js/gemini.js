// =============================================
//  js/gemini.js — Gemini API 호출
// =============================================

async function callGemini(prompt) {
  const res = await fetch(`${CONFIG.GEMINI_ENDPOINT}?key=${CONFIG.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });
  if (!res.ok) throw new Error(`Gemini API 오류: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// 면접 질문 생성
async function generateQuestions(job, difficulty, count) {
  const prompt = `당신은 채용 전문가입니다. ${job} 직무의 ${difficulty} 난이도 면접 질문 ${count}개를 생성하세요.
반드시 순수 JSON 배열만 반환하고 코드블록 없이:
[{"q":"질문 내용","category":"카테고리","hint":"답변 힌트 1~2문장"}]`;
  const raw = await callGemini(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// 답변 피드백 분석
async function analyzeFeedback(job, question, answer, difficulty) {
  const prompt = `당신은 ${difficulty} 수준의 면접관입니다.
직무: ${job}
질문: ${question}
지원자 답변: ${answer}

아래 형식의 순수 JSON만 반환하세요 (코드블록 없이):
{"score":85,"good":"잘한 점 2~3문장","improve":"개선할 점 2~3문장","overall":"종합 피드백 2~3문장","keyword":["핵심키워드1","핵심키워드2","핵심키워드3"]}`;
  const raw = await callGemini(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// 종합 리포트 생성
async function generateOverallReport(job, results) {
  const summary = results.map((r, i) => `Q${i+1}: ${r.q} / 점수: ${r.score}`).join('\n');
  const prompt = `직무: ${job}\n면접 결과:\n${summary}\n\n위 면접 결과를 종합 분석하여 지원자의 강점, 약점, 향후 준비 방향을 200자 내외로 작성하세요. 순수 텍스트만 반환하세요.`;
  return await callGemini(prompt);
}