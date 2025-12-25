// 全域變數
let currentUser = null;
let currentGrammar = null;
let selectedWords = [];
let rephraseRemaining = 2; // 確保變數在此宣告

// 1. 視窗切換 (使用 active class 配合動畫)
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo(0, 0);
}

// 2. 登入邏輯
async function handleLogin() {
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  if (!user || !pass) return alert("請輸入帳號與密碼");

  const res = await runGAS('login', [user, pass]);
  if (res && res.success) {
    currentUser = res;
    document.getElementById('display-username').innerText = "學習者：" + res.username;
    document.getElementById('user-info').style.display = 'flex';
    loadMenu();
  } else {
    alert(res ? res.msg : "登入失敗");
  }
}

// 3. 目錄加載 (隱藏 ID，使用 Material Icons)
async function loadMenu() {
  const container = document.getElementById('grammar-list');
  container.innerHTML = '<div class="card">載入中...</div>';
  
  const list = await runGAS('getMenu');
  if (!Array.isArray(list)) return;

  container.innerHTML = '';
  list.forEach(item => {
    const isLocked = (currentUser.role !== 'Admin' && item.id > currentUser.progress);
    const btn = document.createElement('button');
    btn.className = `btn ${isLocked ? 'btn-outline' : 'btn-primary'}`;
    btn.style.width = "100%"; 
    btn.style.marginBottom = "12px";
    btn.disabled = isLocked;
    
    // 使用 Material Icon 替代 Emoji
    let iconHtml = isLocked ? '<span class="material-symbols-outlined icon">lock</span> ' : '';
    btn.innerHTML = `${iconHtml} ${item.title}`;
    btn.onclick = () => startLearning(item.id);
    container.appendChild(btn);
  });
  showView('view-menu');
}

// 4. 開始練習 (核心邏輯)
async function startLearning(id) {
  rephraseRemaining = 2;
  document.getElementById('rephrase-count').innerText = rephraseRemaining;
  
  const data = await runGAS('getGrammarStep', [id]);
  if (!data) return;

  currentGrammar = data;
  document.getElementById('learn-title').innerText = data.title;
  document.getElementById('learn-explanation').innerText = data.explanation;
  
  // 渲染例句
  const exDiv = document.getElementById('learn-examples');
  exDiv.innerHTML = '';
  data.examples.forEach(ex => {
    exDiv.innerHTML += `
      <div class="example-sentence">
        <b>${ex.jp}</b><br>
        <small style="color:#666">${ex.tw}</small>
      </div>`;
  });

  initSorting(data.sorting);
  
  // 初始化 UI
  showView('view-learning');
  document.getElementById('card-sorting').style.display = 'block';
  document.getElementById('card-construction').style.display = 'none';
  document.getElementById('vocab-hints').innerHTML = '';
  document.getElementById('ai-question').style.display = 'none';
  document.getElementById('sentence-feedback').style.display = 'none';
  document.getElementById('user-sentence').value = '';
}

// 5. 排序題邏輯
function initSorting(words) {
  const pool = document.getElementById('sorting-pool');
  const answer = document.getElementById('sorting-answer');
  pool.innerHTML = ''; answer.innerHTML = '';
  selectedWords = [];
  words.forEach(word => {
    const chip = document.createElement('div');
    chip.className = 'chip'; chip.innerText = word;
    chip.onclick = () => {
      if(!selectedWords.includes(word)) {
        selectedWords.push(word);
        renderSorting();
      }
    };
    pool.appendChild(chip);
  });
}

function renderSorting() {
  const answer = document.getElementById('sorting-answer');
  answer.innerHTML = '';
  selectedWords.forEach((word, idx) => {
    const chip = document.createElement('div');
    chip.className = 'chip'; chip.innerText = word;
    chip.style.background = 'var(--primary)'; chip.style.color = 'white';
    chip.onclick = () => { selectedWords.splice(idx, 1); renderSorting(); };
    answer.appendChild(chip);
  });
}

function checkSorting() {
  if (selectedWords.length === 0) return alert("請先完成排序");
  document.getElementById('card-sorting').style.display = 'none';
  document.getElementById('card-construction').style.display = 'block';
}

// 6. AI 互動與審核
async function handleVocabHint() {
  const v = await runGAS('getRandomVocabWithAI');
  if (v) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.borderColor = 'var(--accent)';
    chip.innerHTML = `<span class="material-symbols-outlined icon" style="font-size:16px;">label</span> ${v.word} (${v.meaning})`;
    document.getElementById('vocab-hints').appendChild(chip);
  }
}

async function handleAIGuide() {
  const qDiv = document.getElementById('ai-question');
  qDiv.style.display = 'block';
  qDiv.innerText = "正在請教 Sensei...";
  const q = await runGAS('getAIGuide', [currentGrammar.title]);
  qDiv.innerText = "Sensei: " + q;
}

async function handleRephrase() {
  if (rephraseRemaining <= 0) return alert("已達更換上限");
  const newExp = await runGAS('getRephrasedExplanation', [currentGrammar.id]);
  if (newExp) {
    document.getElementById('learn-explanation').innerText = newExp;
    rephraseRemaining--;
    document.getElementById('rephrase-count').innerText = rephraseRemaining;
  }
}

async function handleSubmitSentence() {
  const text = document.getElementById('user-sentence').value;
  if (!text) return alert("請輸入造句內容");
  
  const res = await runGAS('verifySentence', [currentUser.uid, currentGrammar.id, currentGrammar.title, text]);
  const fb = document.getElementById('sentence-feedback');
  fb.style.display = 'flex';
  fb.className = 'feedback ' + (res.status === 'PASS' ? 'feedback-pass' : 'feedback-fail');
  
  let iconName = res.status === 'PASS' ? 'check_circle' : 'error';
  fb.innerHTML = `<span class="material-symbols-outlined icon">${iconName}</span> <span>${res.feedback}</span>`;
  
  if (res.status === 'PASS') {
    currentUser.progress = Math.max(currentUser.progress, currentGrammar.id + 1);
  }
}