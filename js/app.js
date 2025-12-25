/**
 * Main Application Logic (v2.0)
 */
const App = {
    state: {
        user: null,
        currentGrammar: null,
        currentStep: "explanation",
        currentVocabHint: null,
        currentQA: null
    },

    init() {
        this.bindEvents();
        this.checkSession();
    },

    bindEvents() {
        document.getElementById("btn-login").addEventListener("click", () => this.handleLogin());
        document.getElementById("btn-logout").addEventListener("click", () => this.handleLogout());
        document.getElementById("btn-back-dashboard").addEventListener("click", () => this.showView("dashboard"));
        
        document.querySelector(".btn-next-step").addEventListener("click", () => this.startExercise("ex-free"));
        
        // 換個說法按鈕
        document.getElementById("btn-regen-expl").addEventListener("click", () => this.handleRegenExplanation());

        document.getElementById("btn-get-hint").addEventListener("click", () => this.fetchHint());
        document.getElementById("btn-verify").addEventListener("click", () => this.handleVerify());
        document.getElementById("btn-continue").addEventListener("click", () => this.nextExerciseStep());
    },

    checkSession() {
        const storedUser = localStorage.getItem("kiseki_user");
        if (storedUser) {
            this.state.user = JSON.parse(storedUser);
            this.loadDashboard();
        } else {
            this.showView("login");
        }
    },

    // 登入驗證
    async handleLogin() {
        const email = document.getElementById("email").value.trim();
        const userIn = document.getElementById("username").value.trim();
        const passIn = document.getElementById("password").value.trim();
        
        if (!userIn || !passIn || !email) {
            API.showToast("請完整填寫 Email、暱稱與密碼");
            return;
        }
        if (passIn.length !== 4 || isNaN(passIn)) {
            API.showToast("密碼必須為 4 位數字");
            return;
        }

        try {
            const userData = await API.login(email, userIn, passIn);
            this.state.user = userData;
            localStorage.setItem("kiseki_user", JSON.stringify(userData));
            this.loadDashboard();
        } catch (e) {
             // Error handled in API
        }
    },

    handleLogout() {
        localStorage.removeItem("kiseki_user");
        this.state.user = null;
        this.showView("login");
        document.getElementById("password").value = "";
    },

    showView(viewName) {
        document.querySelectorAll(".view").forEach(el => el.classList.remove("active", "hidden"));
        document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
        document.getElementById(`view-${viewName}`).classList.remove("hidden");
        document.getElementById(`view-${viewName}`).classList.add("active");
    },

    async loadDashboard() {
        this.showView("dashboard");
        const listContainer = document.getElementById("grammar-list");
        listContainer.innerHTML = '<p style="text-align:center;">載入課程中...</p>';
        try {
            const grammarList = await API.getGrammarList();
            listContainer.innerHTML = "";
            if (!grammarList || grammarList.length === 0) {
                listContainer.innerHTML = '<p>目前沒有課程。</p>'; return;
            }
            const userProgress = parseInt(this.state.user.currentProgressId) || 1;
            const isAdmin = this.state.user.role === 'Admin';
            
            grammarList.forEach(item => {
                const itemId = parseInt(item.id);
                const isLocked = !isAdmin && (itemId > userProgress);
                const el = document.createElement("div");
                el.className = `grammar-item ${isLocked ? 'locked' : ''}`;
                el.innerHTML = `
                    <span class="material-icons">${isLocked ? 'lock' : 'lock_open'}</span>
                    <h4>Lesson ${item.id}</h4><p>${item.title}</p>
                `;
                if (!isLocked) {
                    el.style.cursor = "pointer";
                    el.onclick = () => this.loadGrammar(item.id);
                }
                listContainer.appendChild(el);
            });
        } catch (e) {
            listContainer.innerHTML = '<p>載入失敗。</p>';
        }
    },

    async loadGrammar(id, forceRegen = false) {
        try {
            const data = await API.getGrammar(id, forceRegen);
            this.state.currentGrammar = data;
            
            document.getElementById("learning-title").textContent = data.title;
            
            const explRaw = data.explanation;
            const explHTML = explRaw.split("||").map(p => `<p>${p}</p>`).join("");
            document.getElementById("content-explanation").innerHTML = explHTML;

            const exRaw = data.examples;
            const exHTML = exRaw.split(";").map(ex => {
                const parts = ex.split("||");
                return `<div style="margin-bottom:8px;"><strong>${parts[0] || ''}</strong><br><small>${parts[1] || ''}</small></div>`;
            }).join("");
            document.getElementById("content-examples").innerHTML = exHTML;

            // 設置問答題
            this.state.currentQA = data.aiQuizzes ? data.aiQuizzes.split("||") : ["請造句"];

            this.showView("learning");
            this.setStep("explanation");
            
        } catch (e) { console.error(e); }
    },

    // 強制重新生成解說
    async handleRegenExplanation() {
        if (!confirm("確定要請 AI 換個說法嗎？這將覆蓋現有的解說。")) return;
        const id = this.state.currentGrammar.id;
        // 呼叫 API 並帶入 forceRegen = true
        await this.loadGrammar(id, true);
        API.showToast("已更新解說！");
    },

    setStep(stepName) {
        this.state.currentStep = stepName;
        document.querySelectorAll(".stepper .step").forEach(el => el.classList.remove("active"));
        const stepTab = document.querySelector(`.stepper .step[data-step="${stepName}"]`);
        if (stepTab) stepTab.classList.add("active");

        document.querySelectorAll(".step-content").forEach(el => el.classList.add("hidden"));
        
        // 控制底部按鈕區的顯示
        document.getElementById("btn-area-explanation").classList.add("hidden");
        document.getElementById("btn-area-exercise").classList.add("hidden");

        if (stepName === "explanation") {
            document.getElementById("step-explanation").classList.remove("hidden");
            document.getElementById("btn-area-explanation").classList.remove("hidden");
        } else {
            document.getElementById("step-exercise").classList.remove("hidden");
            document.getElementById("btn-area-exercise").classList.remove("hidden");
            this.setupExerciseUI(stepName);
        }
    },

    setupExerciseUI(type) {
        const map = {
            'ex-free': { title: '自由造句', instr: '請使用本課文法，自由造出一個句子。', key: 'free' },
            'ex-vocab': { title: '指定單字造句', instr: '請點擊下方按鈕取得單字。必須使用其中一個指定單字並結合本課文法造句。', key: 'vocab' },
            'ex-qa': { title: '情境問答', instr: '請閱讀以下日文提問，並使用本課文法回答 (全日文)。', key: 'qa' }
        };

        const config = map[type];
        if (!config) return;

        document.getElementById("ex-type-title").textContent = config.title;
        document.getElementById("ex-instruction").textContent = config.instr;
        document.getElementById("user-input").value = "";
        document.getElementById("user-input").disabled = false;
        
        document.getElementById("feedback-area").classList.add("hidden");
        document.getElementById("btn-verify").classList.remove("hidden");
        document.getElementById("btn-continue").classList.add("hidden");

        const hintArea = document.getElementById("ex-hint-area");
        const qArea = document.getElementById("ex-question-area");
        
        hintArea.classList.add("hidden");
        qArea.classList.add("hidden");
        document.getElementById("hint-display").innerHTML = "";

        if (type === 'ex-vocab') {
            hintArea.classList.remove("hidden");
            this.state.currentVocabHint = null; 
        } else if (type === 'ex-qa') {
            qArea.classList.remove("hidden");
            const questions = this.state.currentQA;
            const q = questions[Math.floor(Math.random() * questions.length)];
            qArea.textContent = q;
        }

        this.state.currentStepType = config.key; 
    },

    startExercise(type) { this.setStep(type); },

    async fetchHint() {
        try {
            const vocabList = await API.getVocabHint();
            this.state.currentVocabHint = vocabList;
            const display = document.getElementById("hint-display");
            let html = '<ul style="list-style: none; padding: 0;">';
            const list = Array.isArray(vocabList) ? vocabList : [vocabList];
            list.forEach(vocab => {
                html += `
                <li style="margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
                    <div style="font-size: 1.1rem; color: #3f51b5;">
                        <strong>${vocab.word}</strong> <span style="font-size: 0.9rem; color: #666;">(${vocab.furigana})</span>
                    </div>
                    <div style="font-size: 0.9rem;">${vocab.meaning}</div>
                </li>`;
            });
            html += '</ul>';
            display.innerHTML = html;
            display.classList.remove("hidden");
        } catch (e) { console.error(e); }
    },

    async handleVerify() {
        const sentence = document.getElementById("user-input").value.trim();
        if (!sentence) { API.showToast("請輸入句子"); return; }
        const type = this.state.currentStepType; 
        const grammarId = this.state.currentGrammar.id;
        const uid = this.state.user.uid;
        try {
            const result = await API.verifySentence(uid, grammarId, sentence, type);
            this.renderFeedback(result);
        } catch (e) { console.error(e); }
    },

    renderFeedback(result) {
        const area = document.getElementById("feedback-area");
        const icon = document.getElementById("feedback-icon");
        const text = document.getElementById("feedback-text");
        const input = document.getElementById("user-input");
        const btnVerify = document.getElementById("btn-verify");
        const btnContinue = document.getElementById("btn-continue");

        area.classList.remove("hidden", "correct", "incorrect");
        area.classList.add(result.isCorrect ? "correct" : "incorrect");
        icon.innerHTML = result.isCorrect ? '<span class="material-icons">check_circle</span>' : '<span class="material-icons">error</span>';
        text.innerHTML = `
            <strong>${result.isCorrect ? "正確！" : "注意！"}</strong><br>
            ${result.feedback}<br>
            ${result.refinedSentence ? '<small>修正：' + result.refinedSentence + '</small>' : ''}
        `;
        if (result.isCorrect) {
            input.disabled = true;
            btnVerify.classList.add("hidden");
            btnContinue.classList.remove("hidden");
            if (this.state.currentStepType === 'qa') {
                 if (parseInt(this.state.currentGrammar.id) === parseInt(this.state.user.currentProgressId)) {
                     this.state.user.currentProgressId = parseInt(this.state.user.currentProgressId) + 1;
                     localStorage.setItem("kiseki_user", JSON.stringify(this.state.user));
                 }
            }
        }
    },

    nextExerciseStep() {
        const flow = ['ex-free', 'ex-vocab', 'ex-qa'];
        const currentIdx = flow.indexOf(this.state.currentStep);
        if (currentIdx < flow.length - 1) {
            this.startExercise(flow[currentIdx + 1]);
        } else {
            API.showToast("恭喜完成本單元！");
            this.loadDashboard();
        }
    }
};
window.addEventListener("DOMContentLoaded", () => { App.init(); });
