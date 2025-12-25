const GAS_URL = "https://script.google.com/macros/s/AKfycbxiAQGwpoTZPnY4JpH3jChcjF8OFpspY56y0utigwZ6o3OZIdy8-L8ea4nBLDMq6bSA/exec"; 

async function runGAS(functionName, args = []) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ functionName, args })
    });
    return await response.json();
  } catch (e) {
    console.error("API Error:", e);
    throw e;
  }
}

// 防止重複點擊的裝飾器
async function withLoading(btn, asyncFunc) {
  if (btn.disabled) return;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-outlined icon rotating">sync</span> 處理中...`;
  try {
    await asyncFunc();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}