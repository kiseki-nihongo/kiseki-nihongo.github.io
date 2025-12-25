/**
 * API Handler (v2.0)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxiAQGwpoTZPnY4JpH3jChcjF8OFpspY56y0utigwZ6o3OZIdy8-L8ea4nBLDMq6bSA/exec";

const API = {
    async post(action, payload = {}) {
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

    // 更新：加入 Email
    login(email, username, password) {
        return API.post("login", { email, username, password });
    },

    getGrammarList() { return API.post("getGrammarList"); },

    // 更新：加入 forceRegen
    getGrammar(grammarId, forceRegen = false) {
        return API.post("getGrammar", { grammarId, forceRegen });
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
