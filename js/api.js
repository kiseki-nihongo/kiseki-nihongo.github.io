/**
 * API Handler (v3.0 - Lazy Load Support)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxiAQGwpoTZPnY4JpH3jChcjF8OFpspY56y0utigwZ6o3OZIdy8-L8ea4nBLDMq6bSA/exec";

const API = {
    async post(action, payload = {}) {
        // 若是 background 請求 (allowGeneration=true 且不是 forceRegen)，可以不顯示全螢幕遮罩? 
        // 這裡維持簡單邏輯：只要呼叫就顯示遮罩，但我們在 app.js 控制是否呼叫
        // 為了優化體驗，如果是 'getGrammar' 且 allowGeneration=false (快速讀取)，我們顯示遮罩
        // 如果是背景生成，我們可能不希望全螢幕遮罩，但 GAS 是同步的，所以還是會 block。
        // 不過因為 allowGen=false 很快，遮罩只會閃一下。
        
        API.showLoading(true);
        try {
            const body = JSON.stringify({ action, ...payload });
            const response = await fetch(API_URL, { method: "POST", body: body });
            if (!response.ok) throw new Error("Network response was not ok");
            const json = await response.json();
            if (json.status === "error") throw new Error(json.message);
            return json.data;
        } catch (error) {
            console.error("API Error:", error);
            API.showToast("Error: " + error.message);
            throw error;
        } finally {
            API.showLoading(false);
        }
    },

    login(email, username, password) {
        return API.post("login", { email, username, password });
    },

    getGrammarList() { return API.post("getGrammarList"); },

    // 更新：加入 allowGeneration (預設 false) 與 forceRegen
    getGrammar(grammarId, allowGeneration = false, forceRegen = false) {
        return API.post("getGrammar", { grammarId, allowGeneration, forceRegen });
    },

    getVocabHint() { return API.post("getVocabHint"); },

    verifySentence(uid, grammarId, userSentence, questionType) {
        return API.post("verifySentence", { uid, grammarId, userSentence, questionType });
    },

    showLoading(isLoading) {
        const overlay = document.getElementById("loading-overlay");
        if (overlay) isLoading ? overlay.classList.remove("hidden") : overlay.classList.add("hidden");
    },

    showToast(msg) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.textContent = msg;
            toast.classList.remove("hidden");
            setTimeout(() => toast.classList.add("hidden"), 4000);
        }
    }
};
