let currentUser = null;
let currentGrammar = null;
let selectedWords = [];
let rephraseRemaining = 2;

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo(0, 0);
}

// 登入
async function handleLogin() {
  const btn = document.getElementById('btn-login');
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;

  await withLoading(btn, async () => {
    const res = await runGAS('login', [user, pass]);
    if (res && res.success) {
      currentUser = res;
      document.getElementById('display-username').innerText = "學習者：" + res.username;
      document.getElementById('user-info').style.display = 'flex';
      loadMenu();
    } else {
      alert(res ? res.msg : "登入失敗");
    }
  });
}

// 目錄 (隱藏 ID)
async function loadMenu() {
  const container = document.getElementById('grammar-list');
  container.innerHTML = '載入中...';
  
  const list = await runGAS('getMenu');
  container.innerHTML = '';
  
  if (!Array.isArray(list)) return;

  list.forEach((item, index) => {
    const isLocked = (currentUser.role !== 'Admin' && item.id > currentUser.progress);
    const btn = document.createElement('button');
    btn.className = `btn ${isLocked ? 'btn-outline' : 'btn-primary'}`;
    btn.style.width = "100%"; btn.style.marginBottom = "10px";
    btn.disabled = isLocked;
    
    // 這裡不顯示 item.id，只顯示標題
    let iconHtml = isLocked ? '<span class="material-symbols-outlined icon">lock</span> ' : '';
    btn.innerHTML = `${iconHtml} ${item.title}`;
    btn.onclick = () => startLearning(item.id);
    container.appendChild(btn);
  });
  showView('view-menu');
}

// 開始學習與練習邏輯 (這裡請將之前的 startLearning, initSorting, handleSubmit 等 function 貼入並套用 withLoading)
// 範例：
async function handleAIGuide() {
  const btn = event.currentTarget;
  await withLoading(btn, async () => {
    const q = await runGAS('getAIGuide', [currentGrammar.title]);
    const qDiv = document.getElementById('ai-question');
    qDiv.style.display = 'block';
    qDiv.innerText = "Sensei: " + q;
  });
}