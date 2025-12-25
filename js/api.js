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
            
            const response = await fetch(API_URL, {
                method: "POST",
                body: body
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

    // New: Get Grammar List
    getGrammarList() {
        return API.post("getGrammarList");
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
        if (overlay) {
            if (isLoading) overlay.classList.remove("hidden");
            else overlay.classList.add("hidden");
        }
    },

    showToast(msg) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.textContent = msg;
            toast.classList.remove("hidden");
            setTimeout(() => toast.classList.add("hidden"), 3000);
        }
    }
};
