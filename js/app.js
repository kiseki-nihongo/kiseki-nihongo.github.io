/**
 * Main Application Logic
 */

const App = {
    state: {
        user: null,
        currentGrammar: null,
        currentStep: 0, 
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
        document.querySelector(".btn-next-step").addEventListener("click", () => this.startExercise("free"));
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

    async handleLogin() {
        const userIn = document.getElementById("username");
        const passIn = document.getElementById("password");
        
        if (!userIn.value || !passIn.value) {
            API.showToast("請輸入帳號與密碼");
            return;
        }

        try {
            const userData = await API.login(userIn.value, passIn.value);
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
        document.getElementById("username").value = "";
        document.getElementById("password").value = "";
    },

    showView(viewName) {
        document.querySelectorAll(".view").forEach(el => el.classList.remove("active", "hidden"));
        document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
        document.getElementById(`view-${viewName}`).classList.remove("hidden");
        document.getElementById(`view-${viewName}`).classList.add("active");
    },

    // --- Dashboard ---

    async loadDashboard() {
        this.showView("dashboard");
        const listContainer = document.getElementById("grammar-list");
        listContainer.innerHTML = '<p style="text-align:center; width:100%;">載入課程中...</p>';

        try {
            // 從 API 取得真實文法列表
            const grammarList = await API.getGrammarList();
            listContainer.innerHTML = "";

            if (!grammarList || grammarList.length === 0) {
                listContainer.innerHTML = '<p>目前沒有課程。</p>';
                return;
            }

            const userProgress = parseInt(this.state.user.currentProgressId) || 1;
            const isAdmin = this.state.user.role === 'Admin';

            grammarList.forEach(item => {
                const itemId = parseInt(item.id);
                // 邏輯：如果是 Admin 則全開，否則只能開小於等於目前進度的課程
                const isLocked = !isAdmin && (itemId > userProgress);
                
                const el = document.createElement("div");
                el.className = `grammar-item ${isLocked ? 'locked' : ''}`;
                el.innerHTML = `
                    <span class="material-icons">${isLocked ? 'lock' : 'lock_open'}</span>
                    <h4>Lesson ${item.id}</h4>
                    <p>${item.title}</p>
                `;
                
                if (!isLocked) {
                    el.style.cursor = "pointer";
                    el.onclick = () => this.loadGrammar(item.id);
                }
                
                listContainer.appendChild(el);
            });

        } catch (e) {
            listContainer.innerHTML = '<p>載入失敗，請重新整理。</p>';
            console.error(e);
        }
    },

    // --- Grammar Learning Flow ---

    async loadGrammar(id) {
        try {
            const data = await API.getGrammar(id);
            this.state.currentGrammar = data;
            
            document.getElementById("learning-title").textContent = data.title;
            
            // 處理 AI 生成失敗時的回傳字串，確保 split 不會報錯
            const explRaw = data.explanationCache || "暫無解說";
            const explHTML = explRaw.split("||").map(p => `<p>${p}</p>`).join("");
            document.getElementById("content-explanation").innerHTML = explHTML;

            const exRaw = data.examplesCache || "暫無例句||";
            const exHTML = exRaw.split(";").map(ex => {
                const parts = ex.split("||");
                return `<div style="margin-bottom:8px;"><strong>${parts[0] || ''}</strong><br><small>${parts[1] || ''}</small></div>`;
            }).join("");
            document.getElementById("content-examples").innerHTML = exHTML;

            this.showView("learning");
            this.setStep("explanation");

            const quizRaw = data.aiQuizzes || "請造句";
            this.state.currentQA = quizRaw.split("||");
            
        } catch (e) {
            console.error(e);
            API.showToast("課程載入失敗");
        }
    },

    setStep(stepName) {
        document.querySelectorAll(".stepper .step").forEach(el => el.classList.remove("active"));
        document.querySelector(`.stepper .step[data-step="${stepName}"]`).classList.add("active");

        document.querySelectorAll(".step-content").forEach(el => el.classList.add("hidden"));
        
        if (stepName === "explanation") {
            document.getElementById("step-explanation").classList.remove("hidden");
        } else {
            document.getElementById("step-exercise").classList.remove("hidden");
            this.setupExerciseUI(stepName);
        }
    },

    setupExerciseUI(type) {
        const titleMap = {
            'free': '自由造句',
            'vocab': '指定單字造句',
            'qa': '情境問答'
        };
        const instrMap = {
            'free': '請使用本課文法，自由造出一個句子。',
            'vocab': '請使用下方提示的單字，並結合本課文法造句。',
            'qa': '請根據以下問題，使用本課文法回答。'
        };

        document.getElementById("ex-type-title").textContent = titleMap[type];
        document.getElementById("ex-instruction").textContent = instrMap[type];
        document.getElementById("user-input").value = "";
        document.getElementById("user-input").disabled = false;
        
        document.getElementById("feedback-area").classList.add("hidden");
        document.getElementById("btn-verify").classList.remove("hidden");
        document.getElementById("btn-continue").classList.add("hidden");

        const hintArea = document.getElementById("ex-hint-area");
        const qArea = document.getElementById("ex-question-area");
        const hintDisplay = document.getElementById("hint-display");

        hintArea.classList.add("hidden");
        qArea.classList.add("hidden");
        hintDisplay.classList.add("hidden");
        hintDisplay.innerHTML = "";

        if (type === 'vocab') {
            hintArea.classList.remove("hidden");
            this.state.currentVocabHint = null; 
        } else if (type === 'qa') {
            qArea.classList.remove("hidden");
            const questions = this.state.currentQA;
            const q = questions[Math.floor(Math.random() * questions.length)];
            qArea.textContent = q;
        }

        this.state.currentStepType = type;
    },

    startExercise(type) {
        this.setStep(type);
    },

    async fetchHint() {
        try {
            const vocab = await API.getVocabHint();
            this.state.currentVocabHint = vocab;
            
            const display = document.getElementById("hint-display");
            display.innerHTML = `
                <strong>${vocab.word}</strong> (${vocab.furigana})<br>
                ${vocab.meaning}
            `;
            display.classList.remove("hidden");
        } catch (e) {
            console.error(e);
        }
    },

    async handleVerify() {
        const sentence = document.getElementById("user-input").value.trim();
        if (!sentence) {
            API.showToast("請輸入句子");
            return;
        }

        const type = this.state.currentStepType;
        const grammarId = this.state.currentGrammar.id;
        const uid = this.state.user.uid;

        try {
            const result = await API.verifySentence(uid, grammarId, sentence, type);
            this.renderFeedback(result);
        } catch (e) {
            console.error(e);
        }
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

        icon.innerHTML = result.isCorrect 
            ? '<span class="material-icons">check_circle</span>' 
            : '<span class="material-icons">error</span>';
        
        text.innerHTML = `
            <strong>${result.isCorrect ? "正確！" : "建議修改"}</strong><br>
            ${result.feedback}<br>
            ${result.refinedSentence ? '<small>修正：' + result.refinedSentence + '</small>' : ''}
        `;

        // 如果是正確的，允許繼續；如果 AI 說錯誤，使用者可以重試
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
        const flow = ['free', 'vocab', 'qa'];
        const currentIdx = flow.indexOf(this.state.currentStepType);
        
        if (currentIdx < flow.length - 1) {
            this.startExercise(flow[currentIdx + 1]);
        } else {
            API.showToast("恭喜完成本單元！");
            this.loadDashboard();
        }
    }
};

window.addEventListener("DOMContentLoaded", () => {
    App.init();
});
