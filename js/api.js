/**
 * API Handler (v3.1 - With Safety Timeout)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxiAQGwpoTZPnY4JpH3jChcjF8OFpspY56y0utigwZ6o3OZIdy8-L8ea4nBLDMq6bSA/exec";

const API = {
    // 儲存 Timeout ID 以便清除
    timeoutId: null,

    async post(action, payload = {}) {
        // 顯示遮罩
        API.showLoading(true);
        
        try {
            const body = JSON.stringify({ action, ...payload });
            
            // 設定 Fetch
            const response = await fetch(API_URL, { 
                method: "POST", 
                body: body 
                // GAS 不支援 AbortController 的 timeout，所以我們依賴前端的 UI Timeout
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Network Error (${response.status}): ${text}`);
            }
            
            const json = await response.json();
            
            if (json.status === "error") {
                throw new Error(json.message);
            }
            
            return json.data;

        } catch (error) {
            console.error("API Error:", error);
            // 顯示更友善的錯誤訊息
            let msg = error.message;
            if (msg.includes("Failed to fetch")) msg = "網路連線失敗，請檢查網路";
            if (msg.includes("JSON")) msg = "伺服器回應格式錯誤";
            
            API.showToast("錯誤: " + msg);
            throw error;
        } finally {
            // 無論成功失敗，務必關閉遮罩
            API.showLoading(false);
        }
    },

    login(email, username, password) {
        return API.post("login", { email, username, password });
    },

    getGrammarList() { return API.post("getGrammarList"); },

    getGrammar(grammarId, allowGeneration = false, forceRegen = false) {
        return API.post("getGrammar", { grammarId, allowGeneration, forceRegen });
    },

    getVocabHint() { return API.post("getVocabHint"); },

    verifySentence(uid, grammarId, userSentence, questionType) {
        return API.post("verifySentence", { uid, grammarId, userSentence, questionType });
    },

    showLoading(isLoading) {
        const overlay = document.getElementById("loading-overlay");
        if (!overlay) return;

        if (isLoading) {
            overlay.classList.remove("hidden");
            // 安全機制：10秒後強制關閉，避免卡死
            if (API.timeoutId) clearTimeout(API.timeoutId);
            API.timeoutId = setTimeout(() => {
                if (!overlay.classList.contains("hidden")) {
                    overlay.classList.add("hidden");
                    API.showToast("回應時間過長，已取消等待");
                }
            }, 10000); // 10秒
        } else {
            overlay.classList.add("hidden");
            if (API.timeoutId) clearTimeout(API.timeoutId);
        }
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
