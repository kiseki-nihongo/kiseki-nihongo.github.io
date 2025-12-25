/**
 * Main Application Logic
 */

const App = {
    state: {
        user: null,
        currentGrammar: null,
        currentStep: 0, // 0: Expl, 1: Free, 2: Vocab, 3: QA
        currentVocabHint: null,
        currentQA: null
    },

    init() {
        this.bindEvents();
        this.checkSession();
    },

    bindEvents() {
        // Login
        document.getElementById("btn-login").addEventListener("click", () => this.handleLogin());
        
        // Logout
        document.getElementById("btn-logout").addEventListener("click", () => this.handleLogout());

        // Navigation
        document.getElementById("btn-back-dashboard").addEventListener("click", () => this.showView("dashboard"));

        // Steps
        document.querySelector(".btn-next-step").addEventListener("click", () => this.startExercise("free"));

        // Hints
        document.getElementById("btn-get-hint").addEventListener("click", () => this.fetchHint());

        // Verification
        document.getElementById("btn-verify").addEventListener("click", () => this.handleVerify());

        // Continue
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

    loadDashboard() {
        this.showView("dashboard");
        const listContainer = document.getElementById("grammar-list");
        listContainer.innerHTML = "";

        // Since we don't have a specific API to get ALL grammar list titles yet,
        // We will simulate a list based on User Progress or a fixed number.
        // Assuming 10 lessons for now or infinite based on ID.
        // In a real app, we should fetch "Grammar List" from DB.
        
        const totalLessons = 10; 
        const userProgress = parseInt(this.state.user.currentProgressId) || 1;
        const isAdmin = this.state.user.role === 'Admin';

        for (let i = 1; i <= totalLessons; i++) {
            const isLocked = !isAdmin && (i > userProgress);
            const el = document.createElement("div");
            el.className = `grammar-item ${isLocked ? 'locked' : ''}`;
            el.innerHTML = `
                <span class="material-icons">${isLocked ? 'lock' : 'lock_open'}</span>
                <h4>文法 Lesson ${i}</h4>
            `;
            
            if (!isLocked) {
                el.style.cursor = "pointer";
                el.onclick = () => this.loadGrammar(i);
            }
            
            listContainer.appendChild(el);
        }
    },

    // --- Grammar Learning Flow ---

    async loadGrammar(id) {
        try {
            const data = await API.getGrammar(id);
            this.state.currentGrammar = data;
            
            // Render Explanation
            document.getElementById("learning-title").textContent = data.title;
            
            // Parse Cache (Separated by ||)
            const explHTML = data.explanationCache.split("||").map(p => `<p>${p}</p>`).join("");
            document.getElementById("content-explanation").innerHTML = explHTML;

            const exHTML = data.examplesCache.split(";").map(ex => {
                const parts = ex.split("||");
                return `<div style="margin-bottom:8px;"><strong>${parts[0]}</strong><br><small>${parts[1] || ''}</small></div>`;
            }).join("");
            document.getElementById("content-examples").innerHTML = exHTML;

            // Reset UI
            this.showView("learning");
            this.setStep("explanation");

            // Prepare QA Quizzes for later
            this.state.currentQA = data.aiQuizzes ? data.aiQuizzes.split("||") : ["請嘗試造句"];
            
        } catch (e) {
            console.error(e);
        }
    },

    setStep(stepName) {
        // Update Stepper UI
        document.querySelectorAll(".stepper .step").forEach(el => el.classList.remove("active"));
        document.querySelector(`.stepper .step[data-step="${stepName}"]`).classList.add("active");

        // Show Content
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
        
        // Reset Feedback
        document.getElementById("feedback-area").classList.add("hidden");
        document.getElementById("btn-verify").classList.remove("hidden");
        document.getElementById("btn-continue").classList.add("hidden");

        // Specific Elements
        const hintArea = document.getElementById("ex-hint-area");
        const qArea = document.getElementById("ex-question-area");
        const hintDisplay = document.getElementById("hint-display");

        hintArea.classList.add("hidden");
        qArea.classList.add("hidden");
        hintDisplay.classList.add("hidden");
        hintDisplay.innerHTML = "";

        if (type === 'vocab') {
            hintArea.classList.remove("hidden");
            this.state.currentVocabHint = null; // reset
        } else if (type === 'qa') {
            qArea.classList.remove("hidden");
            // Pick a random question or sequential? Let's pick random from the cache
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
            <strong>${result.isCorrect ? "正確！" : "加油！"}</strong><br>
            ${result.feedback}<br>
            ${result.refinedSentence ? '<small>建議：' + result.refinedSentence + '</small>' : ''}
        `;

        if (result.isCorrect) {
            input.disabled = true;
            btnVerify.classList.add("hidden");
            btnContinue.classList.remove("hidden");
            
            // If it was the last step (QA), update local user progress to match server
            if (this.state.currentStepType === 'qa') {
                // Optimistically update progress
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
            // Finished all steps
            API.showToast("恭喜完成本單元！");
            this.loadDashboard();
        }
    }
};

// Start App
window.addEventListener("DOMContentLoaded", () => {
    App.init();
});
