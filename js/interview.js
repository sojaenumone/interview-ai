// =============================================
//  js/interview.js — 면접 세션 로직
// =============================================

let questions = [], currentIdx = 0, results = [], difficulty = '일반';
let camStream = null, isMirrored = true, isListening = false, recognition = null;
let timerInterval = null, seconds = 0;
let currentUser = null, currentJob = '';

window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  // URL 파라미터로 직무 미리 입력
  const params = new URLSearchParams(location.search);
  const job = params.get('job');
  if (job) document.getElementById('jobInput').value = decodeURIComponent(job);
});

// 난이도 선택
function setDiff(btn, val) {
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  difficulty = val;
}

// 면접 시작
async function startInterview() {
  const job = document.getElementById('jobInput').value.trim();
  if (!job) { showToast('직무를 입력하세요.', 'error'); return; }
  const count = parseInt(document.getElementById('qCountInput').value);
  currentJob = job;
  currentIdx = 0;
  results = [];

  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  document.getElementById('startBtnText').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  document.getElementById('navJobName').textContent = job;

  try {
    questions = await generateQuestions(job, difficulty, count);
    renderQList();
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('inputArea').style.display = 'block';
    document.getElementById('skipBtn').style.display = '';
    document.getElementById('endBtn').style.display = '';
    document.getElementById('statusBadge').className = 'badge badge-primary';
    document.getElementById('statusBadge').textContent = '진행 중';
    startTimer();
    showQuestion(0);
  } catch(e) {
    showToast('질문 생성 실패. API 키를 확인하세요.', 'error');
    btn.disabled = false;
    document.getElementById('startBtnText').textContent = '면접 시작 →';
  }
}

// 질문 표시
function showQuestion(idx) {
  currentIdx = idx;
  updateProgress();
  renderQList();
  const q = questions[idx];
  const body = document.getElementById('interviewBody');
  body.innerHTML = `
    <div class="q-card">
      <div class="q-card-meta">
        <span class="badge badge-primary">Q${idx+1} / ${questions.length}</span>
        <span class="badge badge-gray">${q.category}</span>
        <span class="badge badge-gray">${difficulty}</span>
      </div>
      <div class="q-card-text">${q.q}</div>
      <div class="q-hint">💡 <strong>힌트:</strong> ${q.hint}</div>
    </div>
    <div id="fbArea"></div>`;
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').focus();
  document.getElementById('submitBtn').disabled = false;
}

// 답변 제출
async function submitAnswer() {
  const ans = document.getElementById('answerInput').value.trim();
  if (!ans) return;
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '분석 중...';

  const q = questions[currentIdx];
  const fbArea = document.getElementById('fbArea');
  fbArea.innerHTML = `
    <div style="text-align:center;padding:32px">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <div style="font-size:13px;color:#94a3b8;margin-top:12px">AI가 답변을 분석하고 있어요...</div>
    </div>`;

  try {
    const fb = await analyzeFeedback(currentJob, q.q, ans, difficulty);
    results.push({ q: q.q, category: q.category, answer: ans, ...fb });

    const barColor = fb.score >= 80 ? '#16a34a' : fb.score >= 60 ? '#d97706' : '#dc2626';
    fbArea.innerHTML = `
      <div class="fb-card">
        <div class="fb-top">
          <div>
            <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:6px">📊 AI 피드백</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${(fb.keyword||[]).map(k => `<span class="badge badge-primary">${k}</span>`).join('')}
            </div>
          </div>
          <div style="text-align:right">
            <div class="fb-score-big">${fb.score}</div>
            <div class="fb-score-label">/ 100점</div>
          </div>
        </div>
        <div class="progress-bar" style="margin-bottom:16px">
          <div class="progress-fill" id="fbBar" style="width:0%;background:${barColor}"></div>
        </div>
        <div class="fb-grid">
          <div class="fb-box fb-good">
            <div class="fb-box-title">✅ 잘한 점</div>${fb.good}
          </div>
          <div class="fb-box fb-improve">
            <div class="fb-box-title">🔧 개선할 점</div>${fb.improve}
          </div>
        </div>
        <div class="fb-overall">${fb.overall}</div>
        ${currentIdx < questions.length - 1
          ? `<button class="btn btn-primary btn-full" onclick="showQuestion(${currentIdx+1})">다음 질문 →</button>`
          : `<button class="btn btn-primary btn-full" onclick="endInterview()">🏁 결과 보기</button>`}
      </div>`;

    setTimeout(() => {
      const b = document.getElementById('fbBar');
      if (b) b.style.width = fb.score + '%';
    }, 100);

    updateProgress();
    renderQList();
  } catch(e) {
    fbArea.innerHTML = `<div style="color:#dc2626;text-align:center;padding:20px">피드백 생성 실패. 다시 시도해주세요.</div>`;
    btn.disabled = false;
    btn.textContent = '제출';
  }
}

// 질문 건너뛰기
function skipQuestion() {
  if (currentIdx < questions.length - 1) showQuestion(currentIdx + 1);
  else endInterview();
}

// 면접 종료 및 리포트 이동
async function endInterview() {
  if (results.length === 0) { location.href = 'dashboard.html'; return; }
  stopTimer();
  const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);

  let overall = '';
  try { overall = await generateOverallReport(currentJob, results); }
  catch(e) { overall = '분석을 불러오지 못했습니다.'; }

  // Supabase 저장
  if (currentUser) {
    try {
      await supabase.from('rehearsals').insert({
        user_id: currentUser.id,
        job: currentJob,
        difficulty,
        avg_score: avg,
        results: JSON.stringify(results),
        overall,
        duration: seconds,
        created_at: new Date().toISOString()
      });
    } catch(e) { console.error('저장 실패', e); }
  }

  sessionStorage.setItem('reportData', JSON.stringify({
    job: currentJob, difficulty, avg, results, overall, duration: seconds
  }));
  location.href = 'report.html';
}

// 질문 목록 렌더링
function renderQList() {
  const el = document.getElementById('qList');
  if (questions.length === 0) return;
  el.innerHTML = questions.map((q, i) => {
    const isDone = results[i] !== undefined;
    const isCur = i === currentIdx && !isDone;
    const cls = isDone ? 'done' : isCur ? 'current' : 'pending';
    const num = isDone ? '✓' : i + 1;
    return `
      <div class="q-list-item ${cls}">
        <div class="q-num">${num}</div>
        <div style="font-size:12px;line-height:1.4;flex:1">
          ${q.category}
          ${isDone ? `<br><span style="font-weight:700">${results[i].score}점</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

// 진행률 업데이트
function updateProgress() {
  const done = results.length;
  const total = questions.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `${done} / ${total} 완료 (${pct}%)`;
}

// 타이머
function startTimer() {
  seconds = 0;
  timerInterval = setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    const el = document.getElementById('timerDisplay');
    el.textContent = `${m}:${s}`;
    el.className = 'timer-display' + (seconds > 1800 ? ' danger' : seconds > 900 ? ' warn' : '');
  }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }

// 카메라
async function toggleCam() {
  const btn = document.getElementById('camBtn');
  const video = document.getElementById('camVideo');
  const placeholder = document.getElementById('camPlaceholder');
  const mirrorBtn = document.getElementById('mirrorBtn');

  if (!camStream) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      video.srcObject = camStream;
      video.style.display = 'block';
      video.style.transform = `scaleX(${isMirrored ? -1 : 1})`;
      placeholder.style.display = 'none';
      btn.textContent = '📷 끄기';
      btn.classList.add('on');
      mirrorBtn.style.display = '';
    } catch(e) {
      showToast('카메라 접근 권한이 필요합니다.', 'error');
    }
  } else {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
    video.srcObject = null;
    video.style.display = 'none';
    placeholder.style.display = 'flex';
    btn.textContent = '📷 켜기';
    btn.classList.remove('on');
    mirrorBtn.style.display = 'none';
  }
}

function toggleMirror() {
  isMirrored = !isMirrored;
  const video = document.getElementById('camVideo');
  video.style.transform = `scaleX(${isMirrored ? -1 : 1})`;
}

// 음성 인식
function toggleVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Chrome 브라우저에서만 음성 인식을 지원합니다.', 'error');
    return;
  }
  const btn = document.getElementById('voiceBtn');
  if (isListening) {
    recognition.stop();
    isListening = false;
    btn.textContent = '🎤';
    btn.classList.remove('recording');
  } else {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = e => {
      let txt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      const el = document.getElementById('answerInput');
      el.value = txt;
      autoResize(el);
    };
    recognition.onerror = () => {
      isListening = false;
      btn.textContent = '🎤';
      btn.classList.remove('recording');
    };
    recognition.onend = () => { if (isListening) recognition.start(); };
    recognition.start();
    isListening = true;
    btn.textContent = '⏹';
    btn.classList.add('recording');
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitAnswer();
  }
}