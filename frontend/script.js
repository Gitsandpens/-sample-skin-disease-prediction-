// ---------------------------------------------------------------- state --
let currentUser = JSON.parse(localStorage.getItem("skinfl_user") || "null");
let authMode = "login"; // or "register"

// ---------------------------------------------------------------- utils --
function $(id) { return document.getElementById(id); }

function riskClass(risk) {
  if (risk === "critical") return "risk-critical";
  if (risk === "high") return "risk-high";
  return "risk-low";
}

function renderUserBar() {
  if (currentUser) {
    $("userGreeting").textContent = `Signed in as ${currentUser.name}`;
    $("userGreeting").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("loginBtn").classList.add("hidden");
    $("registerBtn").classList.add("hidden");
  } else {
    $("userGreeting").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    $("loginBtn").classList.remove("hidden");
    $("registerBtn").classList.remove("hidden");
  }
}
renderUserBar();

// ------------------------------------------------------------- auth UI --
function openAuthModal(mode) {
  authMode = mode;
  $("authTitle").textContent = mode === "login" ? "Log in" : "Create account";
  $("nameField").classList.toggle("hidden", mode !== "register");
  $("authError").classList.add("hidden");
  $("authModal").classList.remove("hidden");
}
$("loginBtn").addEventListener("click", () => openAuthModal("login"));
$("registerBtn").addEventListener("click", () => openAuthModal("register"));
$("closeModalBtn").addEventListener("click", () => $("authModal").classList.add("hidden"));
$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem("skinfl_user");
  renderUserBar();
  $("historyList").innerHTML = "";
});

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const name = $("nameInput").value.trim();
  const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
  const body = authMode === "login" ? { email, password } : { name, email, password };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");

    currentUser = data.user;
    localStorage.setItem("skinfl_user", JSON.stringify(currentUser));
    renderUserBar();
    $("authModal").classList.add("hidden");
    $("authForm").reset();
  } catch (err) {
    $("authError").textContent = err.message;
    $("authError").classList.remove("hidden");
  }
});

// ------------------------------------------------------------- preview --
$("imageInput").addEventListener("change", () => {
  const file = $("imageInput").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    $("previewImg").src = e.target.result;
    $("preview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

// ------------------------------------------------------------- predict --
$("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("imageInput").files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);
  if (currentUser) formData.append("user_id", currentUser.id);

  const resultEl = $("predictResult");
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = "<p>Analyzing…</p>";

  try {
    const res = await fetch(`${API_BASE_URL}/predict`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Prediction failed");

    const p = data.prediction;
    let html = `
      <div class="pred-headline">
        <span class="cls-name">${p.info.full_name}</span>
        <span class="conf">${(p.confidence * 100).toFixed(1)}% confidence</span>
        <span class="risk-tag ${riskClass(p.info.risk)}">${p.info.risk} risk</span>
      </div>
      <p>${p.info.advice}</p>
    `;
    data.all_probabilities.forEach((item) => {
      html += `
        <div class="prob-bar-row">
          <span class="label">${item.class}</span>
          <div class="prob-bar-track"><div class="prob-bar-fill" style="width:${item.probability * 100}%"></div></div>
          <span>${(item.probability * 100).toFixed(1)}%</span>
        </div>`;
    });
    html += `<p class="disclaimer">${data.disclaimer}</p>`;
    resultEl.innerHTML = html;
  } catch (err) {
    resultEl.innerHTML = `<p class="error">${err.message}</p>`;
  }
});

// ---------------------------------------------------------------- diet --
$("dietForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const height_cm = parseFloat($("heightInput").value);
  const weight_kg = parseFloat($("weightInput").value);

  const resultEl = $("dietResult");
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = "<p>Calculating…</p>";

  try {
    const res = await fetch(`${API_BASE_URL}/diet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ height_cm, weight_kg, user_id: currentUser ? currentUser.id : null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not compute diet plan");

    let html = `
      <div class="diet-summary"><span class="bmi-tag">BMI ${data.bmi}</span>${data.category}</div>
      <p>${data.summary}</p>
      <ul class="diet-tips">${data.tips.map((t) => `<li>${t}</li>`).join("")}</ul>
    `;
    resultEl.innerHTML = html;
  } catch (err) {
    resultEl.innerHTML = `<p class="error">${err.message}</p>`;
  }
});

// ------------------------------------------------------------- history --
$("loadHistoryBtn").addEventListener("click", async () => {
  const listEl = $("historyList");
  if (!currentUser) {
    listEl.innerHTML = `<p class="empty-note">Log in to see your prediction history.</p>`;
    return;
  }
  listEl.innerHTML = "<p>Loading…</p>";
  try {
    const res = await fetch(`${API_BASE_URL}/history/${currentUser.id}`);
    const data = await res.json();
    if (!data.history.length) {
      listEl.innerHTML = `<p class="empty-note">No predictions yet — upload an image above to get started.</p>`;
      return;
    }
    listEl.innerHTML = data.history
      .map(
        (h) => `
        <div class="history-item">
          <span class="h-class">${h.predicted_class} — ${(h.confidence * 100).toFixed(1)}%</span>
          <span class="h-date">${new Date(h.created_at).toLocaleString()}</span>
        </div>`
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<p class="error">Could not load history.</p>`;
  }
});
