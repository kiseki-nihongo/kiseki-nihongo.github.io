const GAS_URL = "https://script.google.com/macros/s/AKfycbxiAQGwpoTZPnY4JpH3jChcjF8OFpspY56y0utigwZ6o3OZIdy8-L8ea4nBLDMq6bSA/exec"; 

async function runGAS(functionName, args = []) {
  toggleLoading(true);
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ functionName, args })
    });
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("API Error:", e);
    alert("網路連線失敗，請檢查連線");
  } finally {
    toggleLoading(false);
  }
}

function toggleLoading(show) {
  document.getElementById('loading-screen').style.display = show ? 'flex' : 'none';
}