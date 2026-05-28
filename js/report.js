// =============================================
//  js/report.js — 분석 리포트 로직
// =============================================
var supabase = window._sb;
window.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  const raw = sessionStorage.getItem('reportData');
  if (!raw) { location.href = 'dashboard.html'; return; }
  const data = JSON.parse(raw);
  renderReport(data);
});

function renderReport(data) {
  const { job, difficulty, avg, results, overall, duration } = data;

  const grade = avg >= 90 ? 'S등급 · 탁월함'
    : avg >= 80 ? 'A등급 · 우수함'
    : avg >= 70 ? 'B등급 · 양호함'
    : avg >= 60 ? 'C등급 · 보통'
    : 'D등급 · 분발 필요';

  const now = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const m = Math.floor((duration || 0) / 60);
  const s = (duration || 0) % 60;

  document.getElementById('rScore').textContent = avg;
  document.getElementById('rGrade').textContent = grade;
  document.getElementById('rJob').textContent = `${job} · ${difficulty}`;
  document.getElementById('rDate').textContent = `${now} · 소요시간 ${m}분 ${s}초`;
  document.getElementById('rTotal').textContent = results.length + '개';
  document.getElementById('rBest').textContent = Math.max(...results.map(r => r.score)) + '점';
  document.getElementById('rWorst').textContent = Math.min(...results.map(r => r.score)) + '점';
  document.getElementById('rOverall').textContent = overall || '분석 결과를 불러오지 못했습니다.';

  // 점수 차트
  const chart = document.getElementById('scoreChart');
  chart.innerHTML = results.map((r, i) => {
    const h = Math.round((r.score / 100) * 80);
    const color = r.score >= 80 ? '#4f46e5' : r.score >= 60 ? '#d97706' : '#dc2626';
    return `
      <div class="score-bar-item">
        <div class="score-bar-num">${r.score}</div>
        <div class="score-bar-fill" style="height:${h}px;background:${color}"></div>
        <div class="score-bar-label">Q${i+1}</div>
      </div>`;
  }).join('');

  // 질문별 상세 분석
  document.getElementById('qReportList').innerHTML = results.map((r, i) => `
    <div class="q-report-item">
      <div class="qr-header">
        <div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <span class="badge badge-primary">Q${i+1}</span>
            <span class="badge badge-gray">${r.category}</span>
          </div>
          <div class="qr-q">${r.q}</div>
        </div>
        <div style="text-align:right">
          <div class="qr-score">${r.score}</div>
          <div style="font-size:11px;color:#94a3b8">/ 100</div>
        </div>
      </div>
      <div class="qr-answer">💬 ${r.answer}</div>
      <div class="qr-fb">
        <div class="qr-fb-box qr-fb-good">
          <div class="qr-fb-title">✅ 잘한 점</div>${r.good}
        </div>
        <div class="qr-fb-box qr-fb-bad">
          <div class="qr-fb-title">🔧 개선할 점</div>${r.improve}
        </div>
      </div>
    </div>`).join('');
}
