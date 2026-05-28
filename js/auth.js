// =============================================
//  js/auth.js — Supabase 인증
// =============================================

const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// 로그인 필요 페이지 보호
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = 'index.html'; return null; }
  return session.user;
}

// 로그인
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPw').value;
  const errEl = document.getElementById('loginErr');
  const btn = document.getElementById('loginBtn');
  errEl.classList.remove('show');
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력하세요.'; errEl.classList.add('show'); return; }
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="margin:0 auto"></div>';
  const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) {
    errEl.textContent = error.message.includes('Invalid') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message;
    errEl.classList.add('show');
    btn.disabled = false;
    btn.innerHTML = '<span>로그인</span>';
  } else {
    location.href = 'dashboard.html';
  }
}

// 회원가입
async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pw = document.getElementById('regPw').value;
  const job = document.getElementById('regJob').value;
  const errEl = document.getElementById('regErr');
  const btn = document.getElementById('regBtn');
  errEl.classList.remove('show');
  if (!name || !email || !pw) { errEl.textContent = '모든 필드를 입력하세요.'; errEl.classList.add('show'); return; }
  if (pw.length < 6) { errEl.textContent = '비밀번호는 6자 이상이어야 합니다.'; errEl.classList.add('show'); return; }
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="margin:0 auto"></div>';
  const { data, error } = await supabase.auth.signUp({
    email, password: pw,
    options: { data: { name, job } }
  });
  if (error) {
    errEl.textContent = error.message;
    errEl.classList.add('show');
    btn.disabled = false;
    btn.innerHTML = '<span>회원가입</span>';
  } else if (data.user) {
    await supabase.from('profiles').upsert({ id: data.user.id, name, job, email });
    location.href = 'dashboard.html';
  }
}

// 구글 로그인
async function doGoogleLogin() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + '/dashboard.html' }
  });
}

// 로그아웃
async function doLogout() {
  await supabase.auth.signOut();
  location.href = 'index.html';
}

// 탭 전환 (index.html)
function switchTab(tab) {
  document.getElementById('formLogin').classList.toggle('hidden', tab !== 'login');
  document.getElementById('formRegister').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
}

// 토스트 알림
function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// 이미 로그인된 경우 index.html에서 대시보드로 이동
if (location.pathname.endsWith('index.html') || location.pathname === '/') {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) location.href = 'dashboard.html';
  });
}
