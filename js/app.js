/**
 * KISEKI 日本語 - 前端核心邏輯
 * 包含：視窗管理、狀態管理、防重複提交機制
 */

// 全域狀態
let currentUser = null;
let currentGrammar = null;
let selectedWords = [];
let rephraseRemaining = 2;

// ------------------------------------------
// 1. 工具函式
// ------------------------------------------

function showView(viewId) {
  // 隱藏所有視窗
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // 顯示目標視窗
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/**
 * 設定按鈕讀取狀態 (防止重複送出)
 * @param {string} btnId 按鈕 ID
 * @param {boolean} isLoading 是否正在讀取
 */
function setBtnLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML; // 暫存原始文字
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spinner" style="width:20px;height:20px;border-width:2px;font-size:16px;">sync</span> 處理中...';
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
    }
  }
}

// ------------------------------------------
// 2. 登入流程
// ------------------------------------------

async function handleLogin() {
  const userInput = document.getElementById('login-user');
  const passInput = document.getElementById('login-pass');
  const user = userInput.value.trim();
  const pass = passInput.value.trim();

  if (!user || !pass) return alert("請輸入完整的帳號與密碼");

  // 鎖定按鈕，防止重複點擊
  setBtnLoading('btn-login', true);

  try {
    // 呼叫 GAS API (runGAS 內建會觸發全螢幕遮罩 toggleLoading)
    const res = await runGAS('login', [user, pass]);

    if (res && res.success) {
      currentUser = res;
      updateUserInfoUI(res);
      await loadMenu(); // 載入目錄
    } else {
      alert(res ? res.msg : "登入失敗，請檢查帳號密碼");
    }
  } catch (e) {
    console.error(e);
    alert("系統連線錯誤");
  } finally {
    // 解除鎖定
    setBtnLoading('btn-login', false);
  }
}

function updateUserInfoUI(user) {
  document.getElementById('display-username').innerHTML = 
    `<span class="material-symbols-outlined" style="vertical-align:middle;font-size:18px;">face</span> ${user.username}`;
  document.getElementById('user-info').style.display = 'flex';
}

// ------------------------------------------
// 3. 目錄載入
// ------------------------------------------

async function loadMenu() {
  const container = document.getElementById('grammar-list');
  container.innerHTML = '<div style="text-align:center;color:#888;">載入課程列表中...</div>';

  try {
    const list = await runGAS('getMenu');
    
    if (!Array.isArray(list)) throw new Error("資料格式錯誤");

    container.innerHTML = '';
    list.forEach(item => {
      // 判斷是否鎖定 (非 Admin 且 ID > 進度)
      const isLocked = (currentUser.role !== 'Admin' && parseInt(item.id) > parseInt(currentUser.progress));
      
      const btn = document.createElement('button');
      btn.className = `btn ${isLocked ? 'btn-outline' : 'btn-primary'}`;
      btn.style.width = "100%"; 
      btn.style.marginBottom = "12px";
      btn.style.justifyContent = "flex-start"; // 讓文字靠左對齊較美觀
      btn.disabled = isLocked;
      
      const icon = isLocked ? 'lock' : 'menu_book';
      btn.innerHTML = `<span class="material-symbols-outlined">${icon}</span> 第 ${item.id} 課：${item.title}`;
      
      if (!isLocked) {
        btn.onclick = () => startLearning(item.id);
      }
      container.appendChild(btn);
    });
    
    showView('view-menu');
  } catch (e) {
    container.innerHTML = '<div style="color:var(--warning)">載入失敗，請重試</div>';
  }
}

// ------------------------------------------
// 4. 學習功能
// ------------------------------------------

async function startLearning(id) {
  rephraseRemaining = 2;
  document.getElementById('rephrase-count').innerText = rephraseRemaining;
  
  const data = await runGAS('getGrammarStep', [id]);
  if (!data) return;

  currentGrammar = data;
  renderLearningUI(data);
  
  showView('view-learning');
  // 重置練習狀態
  document.getElementById('card-sorting').style.display = 'block';
  document.getElementById('card-construction').style.display = 'none';
  resetSentenceForm();
}

function renderLearningUI(data) {
  document.getElementById('learn-title').innerText = data.title;
  document.getElementById('learn-explanation').innerText = data.explanation;
  
  const exDiv = document.getElementById('learn-examples');
  exDiv.innerHTML = '';
  data.examples.forEach(ex => {
    exDiv.innerHTML += `
      <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #eee;">
        <div style="font-weight:bold; color:var(--primary);">${ex.jp}</div>
        <div style="font-size:0.9em; color:#666;">${ex.tw}</div>
      </div>`;
  });

  initSorting(data.sorting);
}

// ------------------------------------------
// 5. 互動練習 (排序 & 造句)
// ------------------------------------------

// 初始化排序題
function initSorting(words) {
  const pool = document.getElementById('sorting-pool');
  const answer = document.getElementById('sorting-answer');
  pool.innerHTML = ''; answer.innerHTML = '';
  selectedWords = [];

  // 打亂順序顯示
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  shuffled.forEach(word => {
    const chip = document.createElement('div');
    chip.className = 'chip'; 
    chip.innerText = word;
    chip.onclick = function() {
      if (!selectedWords.includes(word)) {
        selectedWords.push(word);
        this.style.opacity = '0.3'; // 視覺上標示已選
        this.style.pointerEvents = 'none';
        renderAnswerZone(words);
      }
    };
    pool.appendChild(chip);
  });
}

// 渲染答案區
function renderAnswerZone(originalWords) {
  const answer = document.getElementById('sorting-answer');
  answer.innerHTML = '';
  selectedWords.forEach((word, idx) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerText = word;
    chip.style.background = 'var(--primary)';
    chip.style.color = 'white';
    chip.onclick = () => {
      // 取消選擇：從答案區移除，並恢復下方選項
      selectedWords.splice(idx, 1);
      renderAnswerZone(originalWords);
      // 恢復 pool 中的該選項
      Array.from(document.getElementById('sorting-pool').children).forEach(c => {
        if (c.innerText === word) {
          c.style.opacity = '1';
          c.style.pointerEvents = 'auto';
        }
      });
    };
    answer.appendChild(chip);
  });
}

function checkSorting() {
  if (selectedWords.length === 0) return alert("請點擊單字進行排序");
  // 簡單驗證：這裡僅檢查是否所有詞都選了，可依需求增強邏輯
  document.getElementById('card-sorting').style.display = 'none';
  document.getElementById('card-construction').style.display = 'block';
  // 自動滑動到上方
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSubmitSentence() {
  const input = document.getElementById('user-sentence');
  const text = input.value.trim();
  if (!text) return alert("請輸入造句內容");
  
  setBtnLoading('btn-submit', true);
  
  try {
    const res = await runGAS('verifySentence', [currentUser.uid, currentGrammar.id, currentGrammar.title, text]);
    
    const fb = document.getElementById('sentence-feedback');
    fb.style.display = 'flex';
    fb.className = 'feedback ' + (res.status === 'PASS' ? 'feedback-pass' : 'feedback-fail');
    
    const icon = res.status === 'PASS' ? 'check_circle' : 'error';
    fb.innerHTML = `<span class="material-symbols-outlined">${icon}</span> <span>${res.feedback}</span>`;
    
    if (res.status === 'PASS') {
      currentUser.progress = Math.max(parseInt(currentUser.progress), parseInt(currentGrammar.id) + 1);
    }
  } catch(e) {
    alert("驗證失敗，請稍後再試");
  } finally {
    setBtnLoading('btn-submit', false);
  }
}

// ------------------------------------------
// 6. 輔助功能 (AI 提示等)
// ------------------------------------------

function resetSentenceForm() {
  document.getElementById('vocab-hints').innerHTML = '';
  document.getElementById('ai-question').style.display = 'none';
  document.getElementById('sentence-feedback').style.display = 'none';
  document.getElementById('user-sentence').value = '';
}

async function handleVocabHint() {
  const btn = event.currentTarget; // 獲取點擊的按鈕
  btn.disabled = true; // 短暫防止連點
  
  const v = await runGAS('getRandomVocabWithAI');
  if (v) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.borderColor = 'var(--accent)';
    chip.style.fontSize = '0.9rem';
    chip.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;vertical-align:text-bottom;">label</span> ${v.word} <small>(${v.meaning})</small>`;
    document.getElementById('vocab-hints').appendChild(chip);
  }
  btn.disabled = false;
}

async function handleAIGuide() {
  const qDiv = document.getElementById('ai-question');
  qDiv.style.display = 'block';
  qDiv.innerHTML = '<span class="material-symbols-outlined spinner" style="font-size:16px;">sync</span> Sensei 正在思考...';
  
  const q = await runGAS('getAIGuide', [currentGrammar.title]);
  qDiv.innerHTML = `<strong>Sensei 提問：</strong> ${q}`;
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
