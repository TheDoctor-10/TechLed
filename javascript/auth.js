// -----------------------------------------------------
// 0. CONFIG FIREBASE
// -----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCCvoXrrQLiH7rK-YH4Wa3K5xO7jg4UB5M",
  authDomain: "techled-1c800.firebaseapp.com",
  projectId: "techled-1c800",
  storageBucket: "techled-1c800.appspot.com",
  messagingSenderId: "1016231820720",
  appId: "1:1016231820720:web:7453b90d3afa7ee811ea75"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let currentLampIp = "";
let savedLamps = JSON.parse(localStorage.getItem("techled_lamps")) || [];
let favoriteColors = JSON.parse(localStorage.getItem("techled_favorites")) || [];
let debugMode = false;
let selectedColor = "#ffffff";

// -----------------------------------------------------
// 1. AUTHENTIFICATION & UI UTILISATEUR
// -----------------------------------------------------
function initAuthLogic() {
  auth.onAuthStateChanged(user => {
    const container = document.getElementById("userContainer");
    const isDashboard = window.location.pathname.includes("dashboard.html");

    if (user) {
      const btnLabel = isDashboard ? "Accueil" : "Dashboard";
      const btnLink = isDashboard ? "index.html" : "dashboard.html";

      container.innerHTML = `
        <button id="userBtn" class="user-icon">👤</button>
        <div id="userMenu" class="user-menu" style="display:none; flex-direction:column;">
          <p style="color:black;font-weight:bold;margin-bottom:0;">Bienvenue</p>
          <p style="color:black;font-size:0.8rem;margin-bottom:10px;">${user.email}</p>
          <button onclick="window.location.href='${btnLink}'">${btnLabel}</button>
          <button id="openResetBtn">Reset mot de passe / E-mail</button>
          <button id="logoutBtn" style="background:#e74c3c;">Déconnexion</button>
        </div>`;

      const userBtn = document.getElementById("userBtn");
      const userMenu = document.getElementById("userMenu");
      userBtn.onclick = e => {
        e.stopPropagation();
        userMenu.style.display = userMenu.style.display === "none" ? "flex" : "none";
      };

      document.getElementById("logoutBtn").onclick = () => {
        auth.signOut().then(() => window.location.href = "index.html");
      };

      const openResetBtn = document.getElementById("openResetBtn");
      if (openResetBtn) {
        openResetBtn.onclick = () => {
          const resetModal = document.getElementById("resetModal");
          if (resetModal) resetModal.classList.add("active");
        };
      }
    } else {
      if (isDashboard) window.location.href = "index.html";
    }
  });

  // Connexion (page index.html)
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.onsubmit = e => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const pass = document.getElementById("loginPassword").value;
      auth.signInWithEmailAndPassword(email, pass)
        .then(() => window.location.href = "dashboard.html")
        .catch(err => alert("Erreur: " + err.message));
    };
  }

  // Inscription (page index.html)
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.onsubmit = e => {
      e.preventDefault();
      const email = document.getElementById("signupEmail").value;
      const pass = document.getElementById("signupPassword").value;
      auth.createUserWithEmailAndPassword(email, pass)
        .then(() => window.location.href = "dashboard.html")
        .catch(err => alert("Erreur: " + err.message));
    };
  }
}

function toggleResetFields() {
    const type = document.getElementById("resetType").value;

    document.getElementById("passwordFields").style.display =
        type === "password" ? "block" : "none";

    document.getElementById("emailFields").style.display =
        type === "email" ? "block" : "none";

    document.getElementById("resetStatus").style.display = "none";
}

const resetForm = document.getElementById("resetForm");

if (resetForm) {
    resetForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const type = document.getElementById("resetType").value;
        const statusDiv = document.getElementById("resetStatus");

        const showStatus = (msg, isError = false) => {
            statusDiv.innerText = msg;
            statusDiv.style.color = isError ? "#e74c3c" : "#2ecc71";
            statusDiv.style.display = "block";
        };

        try {
            /* -----------------------------
               RÉINITIALISATION MOT DE PASSE
            ------------------------------*/
            if (type === "password") {
                const email = document.getElementById("resetEmailInput").value.trim();
                if (!email) return showStatus("Veuillez entrer un email.", true);

                await auth.sendPasswordResetEmail(email);
                showStatus("E-mail de réinitialisation envoyé ! (Vérifiez vos spams)");
            }

            /* -----------------------------
               CHANGEMENT D'EMAIL (2 CHAMPS)
            ------------------------------*/
            else if (type === "email") {
                const user = auth.currentUser;
                const oldEmail = document.getElementById("oldEmailInput").value.trim();
                const newEmail = document.getElementById("newEmailInput").value.trim();
                const password = document.getElementById("passwordInput").value.trim();

                if (!user) return showStatus("Erreur : vous n'êtes pas connecté.", true);
                if (!oldEmail) return showStatus("Veuillez entrer l'ancienne adresse.", true);
                if (!newEmail) return showStatus("Veuillez entrer la nouvelle adresse.", true);
                if (!password) return showStatus("Veuillez entrer votre mot de passe.", true);

                // Vérification visuelle
                if (oldEmail !== user.email) {
                    return showStatus("L'ancienne adresse ne correspond pas à votre compte.", true);
                }

                // Ré-authentification Firebase obligatoire
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                await user.reauthenticateWithCredential(credential);

                // Envoi du mail de confirmation Firebase
                await user.verifyBeforeUpdateEmail(newEmail);
                showStatus("Lien de confirmation envoyé au nouvel e-mail !");
            }

        } catch (error) {
            console.error(error);

            if (error.code === "auth/requires-recent-login") {
                showStatus("Sécurité : veuillez vous reconnecter avant cette action.", true);
            } else {
                showStatus("Erreur : " + error.message, true);
            }
        }
    };
}
// -----------------------------------------------------
// 2. WLED : SCAN / LISTE / SÉLECTION
// -----------------------------------------------------
async function isWledDevice(ip) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`http://${ip}/json/info`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (e) {
    return false;
  }
}

function addLamp(ip) {
  if (!savedLamps.includes(ip)) {
    savedLamps.push(ip);
    localStorage.setItem("techled_lamps", JSON.stringify(savedLamps));
  }
  renderLamps();
}

function renderLamps() {
  const ul = document.getElementById("lampUl");
  if (!ul) return;
  ul.innerHTML = "";
  savedLamps.forEach(ip => {
    const li = document.createElement("li");
    li.innerHTML = `<span>💡 ${ip}</span> <button onclick="removeLamp('${ip}')" class="delete-lamp">✕</button>`;
    li.onclick = e => {
      if (e.target.tagName !== "BUTTON") setSelectedLamp(ip);
    };
    ul.appendChild(li);
  });
}

function removeLamp(ip) {
  savedLamps = savedLamps.filter(l => l !== ip);
  localStorage.setItem("techled_lamps", JSON.stringify(savedLamps));
  if (currentLampIp === ip) {
    const controls = document.getElementById("wledControls");
    const name = document.getElementById("currentLampName");
    const placeholder = document.getElementById("placeholderMsg");
    if (controls) controls.style.display = "none";
    if (name) name.innerText = "Sélectionnez une lampe";
    if (placeholder) placeholder.style.display = "block";
    currentLampIp = "";
  }
  renderLamps();
}

function setSelectedLamp(ip) {
  currentLampIp = ip;
  const name = document.getElementById("currentLampName");
  const controls = document.getElementById("wledControls");
  const placeholder = document.getElementById("placeholderMsg");
  if (name) name.innerText = "Connecté : " + ip;
  if (controls) controls.style.display = "flex";
  if (placeholder) placeholder.style.display = "none";
}

async function validateAndAddIp() {
  const ipField = document.getElementById("manualIp");
  const ip = ipField.value.trim();
  if (!ip) return;

  const status = document.getElementById("scanStatus");
  if (status) {
    status.style.display = "block";
    status.innerText = "Vérification de l'appareil...";
  }

  const isValid = await isWledDevice(ip);
  if (isValid) {
    addLamp(ip);
    if (status) status.innerText = "Lampe WLED ajoutée !";
    ipField.value = "";
  } else {
    alert("Aucune lampe WLED détectée à l'adresse : " + ip);
    if (status) status.style.display = "none";
  }
}

// -----------------------------------------------------
// 3. MODE DEBUG (SIMULATION LAMPE)
// -----------------------------------------------------
function simulateLampConnected() {
  console.log("[DEBUG] Lampe simulée connectée.");
  currentLampIp = "DEBUG-MODE";

  const controls = document.getElementById("wledControls");
  const placeholder = document.getElementById("placeholderMsg");
  const lampName = document.getElementById("currentLampName");

  if (controls) controls.style.display = "flex";
  if (placeholder) placeholder.style.display = "none";
  if (lampName) lampName.innerText = "Connecté : Lampe DEBUG";
}

function simulateLampDisconnected() {
  console.log("[DEBUG] Simulation désactivée.");
  currentLampIp = "";

  const controls = document.getElementById("wledControls");
  const placeholder = document.getElementById("placeholderMsg");
  const lampName = document.getElementById("currentLampName");

  if (controls) controls.style.display = "none";
  if (placeholder) placeholder.style.display = "block";
  if (lampName) lampName.innerText = "Sélectionnez une lampe";
}

// -----------------------------------------------------
// 4. ENVOI COMMANDES WLED
// -----------------------------------------------------
function sendWledHttp(params) {
  if (debugMode) {
    console.log("[DEBUG] Commande simulée :", params);
    return;
  }

  if (!currentLampIp) {
    console.warn("Aucune lampe sélectionnée.");
    return;
  }

  fetch(`http://${currentLampIp}/win&${params}`, { mode: "no-cors" })
    .catch(() => console.warn("Erreur d’envoi WLED."));
}
// -----------------------------------------------------
// 5. COLOR PICKER PRO (HUE + SV) + FAVORIS
// -----------------------------------------------------

let hue = 0;      // 0–360
let sat = 100;    // 0–100
let val = 100;    // 0–100

// Convertit HSL → RGB
function hslToRgb(h, s, v) {
    s /= 100;
    v /= 100;
    let c = v * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = v - c;
    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

// Convertit RGB → HEX
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Envoie la couleur finale à WLED
function updateWledColor() {
    const rgb = hslToRgb(hue, sat, val);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    selectedColor = hex;

    console.log("Couleur finale :", hex);
    sendWledHttp("CL=h" + hex.substring(1));
}

// -----------------------------------------------------
// HUE BAR
// -----------------------------------------------------
function drawHueBar() {
    const canvas = document.getElementById("hueCanvas");
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    for (let i = 0; i <= 360; i += 60) {
        gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function initHuePicker() {
    const canvas = document.getElementById("hueCanvas");
    const cursor = document.getElementById("hueCursor");

    let dragging = false;

    function updateHue(e) {
        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(canvas.width, x));

        hue = Math.round((x / canvas.width) * 360);
        cursor.style.left = (x - 7) + "px";

        drawSVBox();
        updateWledColor();
    }

    canvas.addEventListener("mousedown", e => { dragging = true; updateHue(e); });
    canvas.addEventListener("mousemove", e => { if (dragging) updateHue(e); });
    window.addEventListener("mouseup", () => dragging = false);
}

// -----------------------------------------------------
// SV BOX (Saturation + Luminosité)
// -----------------------------------------------------
function drawSVBox() {
    const canvas = document.getElementById("svCanvas");
    const ctx = canvas.getContext("2d");

    // Base color (hue)
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // White gradient (left)
    const whiteGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    whiteGrad.addColorStop(0, "white");
    whiteGrad.addColorStop(1, "transparent");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Black gradient (bottom)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    blackGrad.addColorStop(0, "transparent");
    blackGrad.addColorStop(1, "black");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function initSVPicker() {
    const canvas = document.getElementById("svCanvas");
    const cursor = document.getElementById("svCursor");

    let dragging = false;

    function updateSV(e) {
        const rect = canvas.getBoundingClientRect();
        let x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
        let y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

        sat = Math.round((x / canvas.width) * 100);
        val = Math.round(100 - (y / canvas.height) * 100);

        cursor.style.left = (x - 7) + "px";
        cursor.style.top = (y - 7) + "px";
        cursor.style.display = "block";

        updateWledColor();
    }

    canvas.addEventListener("mousedown", e => { dragging = true; updateSV(e); });
    canvas.addEventListener("mousemove", e => { if (dragging) updateSV(e); });
    window.addEventListener("mouseup", () => dragging = false);
}

// -----------------------------------------------------
// FAVORIS COULEURS
// -----------------------------------------------------
function renderFavoriteColors() {
    const container = document.getElementById("favoriteColors");
    if (!container) return;
    container.innerHTML = "";

    favoriteColors.forEach(color => {
        const div = document.createElement("div");
        div.style.width = "30px";
        div.style.height = "30px";
        div.style.borderRadius = "5px";
        div.style.background = color;
        div.style.cursor = "pointer";

        div.onclick = () => {
            console.log("Couleur favorite utilisée :", color);
            sendWledHttp("CL=h" + color.substring(1));
        };

        container.appendChild(div);
    });
}

// -----------------------------------------------------
// 6. INITIALISATION GLOBALE
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    // Auth + Lampes
    initAuthLogic();
    renderLamps();

    // DEBUG
    const debugBtn = document.getElementById("debugBtn");
    if (debugBtn) {
        debugBtn.onclick = () => {
            debugMode = !debugMode;
            console.log("DEBUG MODE :", debugMode ? "ON" : "OFF");
            debugBtn.style.opacity = debugMode ? "1" : "0.5";
            if (debugMode) simulateLampConnected();
            else simulateLampDisconnected();
        };
    }

    // COLOR PICKER PRO
    drawHueBar();
    initHuePicker();

    drawSVBox();
    initSVPicker();

    // FAVORIS
    const saveBtn = document.getElementById("saveColorBtn");
    if (saveBtn) {
        saveBtn.onclick = () => {
            if (!favoriteColors.includes(selectedColor)) {
                favoriteColors.push(selectedColor);
                localStorage.setItem("techled_favorites", JSON.stringify(favoriteColors));
                renderFavoriteColors();
            }
        };
    }

    renderFavoriteColors();

    // Scan auto
    const scanBtn = document.getElementById("scanBtn");
    if (scanBtn) {
        scanBtn.onclick = async () => {
            const status = document.getElementById("scanStatus");
            if (status) status.style.display = "block";
            const subnets = ["192.168.1.", "192.168.0."];
            for (const sub of subnets) {
                for (let i = 1; i < 30; i++) {
                    const ip = sub + i;
                    if (status) status.innerText = "Recherche sur " + ip + "...";
                    if (await isWledDevice(ip)) addLamp(ip);
                }
            }
            if (status) {
                status.innerText = "Scan terminé.";
                setTimeout(() => status.style.display = "none", 3000);
            }
        };
    }

    // Fermeture modales
    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.onclick = () => {
            document.getElementById("authModal")?.classList.remove("active");
            document.getElementById("resetModal")?.classList.remove("active");
        };
    });
});

// Fermer menu user au clic extérieur
window.addEventListener("click", e => {
  const menu = document.getElementById("userMenu");
  if (menu && !e.target.closest("#userContainer")) {
    menu.style.display = "none";
  }
});
