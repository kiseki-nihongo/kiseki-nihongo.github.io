/**
 * API Handler
 * Handles communication with Google Apps Script
 */

const API_URL = "https://script.google.com/macros/s/AKfycbxiAQGwpoTZPnY4JpH3jChcjF8OFpspY56y0utigwZ6o3OZIdy8-L8ea4nBLDMq6bSA/exec";

const API = {
    // Generic Post Request
    async post(action, payload = {}) {
        API.showLoading(true);
        try {
            const body = JSON.stringify({ action, ...payload });
            
            // 使用 no-cors 模式會導致無法讀取回應，GAS 必須回傳正確的 CORS 標頭
            // 這裡假設 GAS 部署設定為 "Anyone" (匿名存取)，通常能處理 CORS
            const response = await fetch(API_URL, {
                method: "POST",
                body: body
                // 不設定 Content-Type 為 application/json 以避免 OPTIONS 預檢請求問題 (GAS 常見解法)
            });

            if (!response.ok) throw new Error("Network response was not ok");
            
            const json = await response.json();
            
            if (json.status === "error") {
                throw new Error(json.message);
            }
            
            return json.data;

        } catch (error) {
            console.error("API Error:", error);
            API.showToast("Error: " + error.message);
            throw error;
        } finally {
            API.showLoading(false);
        }
    },

    // 1. Login
    login(username, password) {
        return API.post("login", { username, password });
    },

    // 2. Get Grammar Detail
    getGrammar(grammarId) {
        return API.post("getGrammar", { grammarId });
    },

    // 3. Get Vocab Hint
    getVocabHint() {
        return API.post("getVocabHint");
    },

    // 4. Verify Sentence
    verifySentence(uid, grammarId, userSentence, questionType) {
        return API.post("verifySentence", { 
            uid, 
            grammarId, 
            userSentence, 
            questionType 
        });
    },

    // UI Helpers
    showLoading(isLoading) {
        const overlay = document.getElementById("loading-overlay");
        if (isLoading) overlay.classList.remove("hidden");
        else overlay.classList.add("hidden");
    },

    showToast(msg) {
        const toast = document.getElementById("toast");
        toast.textContent = msg;
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
    }
};
