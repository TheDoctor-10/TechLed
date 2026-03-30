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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// --- VARIABLES GLOBALES ---
let currentLampIp = "";
let savedLamps = JSON.parse(localStorage.getItem("techled_lamps")) || [];
let favoriteColors = JSON.parse(localStorage.getItem("techled_favorites")) || [];
let debugMode = false;
let selectedColor = "#ffffff";
let hue = 0, sat = 100, val = 100;

const path = window.location.pathname;
const isDashboard = path.includes("dashboard.html");

// -----------------------------------------------------
// 1. GESTION UTILISATEUR (RECONSTRUCTION UI)
// -----------------------------------------------------
auth.onAuthStateChanged((user) => {
    const container = document.getElementById("userContainer");
    if (!container) return;

    if (user) {
        // --- CONNECTÉ ---
        container.innerHTML = `
            <button class="user-icon" id="userIcon">👤</button>
            <div class="user-menu" id="userMenu" style="display:none; flex-direction:column;">
                <p style="color:black; font-size:12px; margin:5px 0;">${user.email}</p>
                ${!isDashboard ? `<button id="goDashboard">Dashboard</button>` : `<button onclick="window.location.href='index.html'">Accueil</button>`}
                <button id="openResetBtn">Paramètres / Reset</button>
                <button id="logoutBtn" style="background:#e74c3c; color:white;">Déconnexion</button>
            </div>
        `;

        // Events du menu
        document.getElementById("userIcon").onclick = (e) => {
            e.stopPropagation();
            const m = document.getElementById("userMenu");
            m.style.display = m.style.display === "none" ? "flex" : "none";
        };

        const goDash = document.getElementById("goDashboard");
        if (goDash) goDash.onclick = () => window.location.href = "dashboard.html";

        document.getElementById("logoutBtn").onclick = () => auth.signOut();
        
        document.getElementById("openResetBtn").onclick = () => {
            document.getElementById("resetModal").classList.add("active");
        };

    } else {
        // --- DÉCONNECTÉ ---
        if (isDashboard) {
            window.location.href = "index.html";
        } else {
            container.innerHTML = `<button id="authBtn" class="btn-outline">Connexion / Inscription</button>`;
            const authBtn = document.getElementById("authBtn");
            if (authBtn) {
                authBtn.onclick = () => document.getElementById("authModal").classList.add("active");
            }
        }
    }
});

// -----------------------------------------------------
// 2. FORMULAIRES (AUTH & RESET)
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Tabs Connexion / Inscription
    const lTab = document.getElementById("loginTab"), sTab = document.getElementById("signupTab");
    const lForm = document.getElementById("loginForm"), sForm = document.getElementById("signupForm");

    if (lTab && sTab) {
        lTab.onclick = () => {
            lTab.classList.add("active"); sTab.classList.remove("active");
            lForm.style.display = "block"; sForm.style.display = "none";
        };
        sTab.onclick = () => {
            sTab.classList.add("active"); lTab.classList.remove("active");
            sForm.style.display = "block"; lForm.style.display = "none";
        };
    }

    // Submit Connexion
    if (lForm) {
        lForm.onsubmit = (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value)
                .then(() => window.location.href = "dashboard.html")
                .catch(err => alert(err.message));
        };
    }

    // Submit Inscription
    if (sForm) {
        sForm.onsubmit = (e) => {
            e.preventDefault();
            auth.createUserWithEmailAndPassword(document.getElementById("signupEmail").value, document.getElementById("signupPassword").value)
                .then(() => window.location.href = "dashboard.html")
                .catch(err => alert(err.message));
        };
    }

    // Formulaire Reset Password (Popup)
    const resetForm = document.getElementById("resetForm");
    if (resetForm) {
        resetForm.onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById("resetEmailInput")?.value || document.getElementById("resetEmail")?.value;
            auth.sendPasswordResetEmail(email)
                .then(() => alert("Email de réinitialisation envoyé !"))
                .catch(err => alert(err.message));
        };
    }

    // Fermeture modales
    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.onclick = () => {
            btn.closest(".modal").classList.remove("active");
        };
    });

    // Initialisation Color Picker si sur Dashboard
    if (isDashboard) {
        drawHueBar();
        drawSVBox();
        initPickers();
    }
});

// -----------------------------------------------------
// 3. LOGIQUE WLED (COLOR PICKER & DEBUG)
// -----------------------------------------------------
function sendWledHttp(params) {
    if (debugMode) {
        console.log("%c[DEBUG] -> " + params, "color:cyan"); return;
    }
    if (!currentLampIp) return;
    fetch(`http://${currentLampIp}/win&${params}`, { mode: "no-cors" })
        .catch(() => console.log("WLED Offline"));
}

function hslToRgb(h, s, v) {
    s /= 100; v /= 100;
    let c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r=0, g=0, b=0;
    if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
    return { r:Math.round((r+m)*255), g:Math.round((g+m)*255), b:Math.round((b+m)*255) };
}

function updateWledColor() {
    const rgb = hslToRgb(hue, sat, val);
    const hex = "#" + [rgb.r, rgb.g, rgb.b].map(x => x.toString(16).padStart(2, "0")).join("");
    selectedColor = hex;
    
    const hexInput = document.getElementById("hexInput");
    if (hexInput) hexInput.value = hex.toUpperCase();

    sendWledHttp("CL=h" + hex.substring(1));
}

function drawHueBar() {
    const c = document.getElementById("hueCanvas"); if(!c) return;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0,0,c.width,0);
    for(let i=0; i<=360; i+=60) g.addColorStop(i/360, `hsl(${i},100%,50%)`);
    ctx.fillStyle = g; ctx.fillRect(0,0,c.width,c.height);
}

function drawSVBox() {
    const c = document.getElementById("svCanvas"); if(!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`; ctx.fillRect(0,0,c.width,c.height);
    const w = ctx.createLinearGradient(0,0,c.width,0); w.addColorStop(0,"white"); w.addColorStop(1,"transparent");
    ctx.fillStyle = w; ctx.fillRect(0,0,c.width,c.height);
    const b = ctx.createLinearGradient(0,0,0,c.height); b.addColorStop(0,"transparent"); b.addColorStop(1,"black");
    ctx.fillStyle = b; ctx.fillRect(0,0,c.width,c.height);
}

function initPickers() {
    const hC = document.getElementById("hueCanvas"), svC = document.getElementById("svCanvas");
    if(!hC || !svC) return;
    let dH = false, dSV = false;
    const upH = (e) => {
        let x = Math.max(0, Math.min(hC.width, e.clientX - hC.getBoundingClientRect().left));
        hue = Math.round((x/hC.width)*360);
        document.getElementById("hueCursor").style.left = (x-7)+"px";
        drawSVBox(); updateWledColor();
    };
    const upSV = (e) => {
        let rect = svC.getBoundingClientRect();
        let x = Math.max(0, Math.min(svC.width, e.clientX - rect.left));
        let y = Math.max(0, Math.min(svC.height, e.clientY - rect.top));
        sat = Math.round((x/svC.width)*100); val = Math.round(100 - (y/svC.height)*100);
        const cur = document.getElementById("svCursor");
        cur.style.left = (x-7)+"px"; cur.style.top = (y-7)+"px"; cur.style.display="block";
        updateWledColor();
    };
    hC.onmousedown = (e) => { dH=true; upH(e) };
    svC.onmousedown = (e) => { dSV=true; upSV(e) };
    window.onmousemove = (e) => { if(dH) upH(e); if(dSV) upSV(e); };
    window.onmouseup = () => { dH=false; dSV=false; };
}

// -----------------------------------------------------
// 4. BOUTONS SPECIFIQUES DASHBOARD
// -----------------------------------------------------
if (isDashboard) {
    const dbBtn = document.getElementById("debugBtn");
    if(dbBtn) dbBtn.onclick = () => {
        debugMode = !debugMode;
        dbBtn.style.background = debugMode ? "#2ecc71" : "";
        if(debugMode) {
            currentLampIp = "DEBUG";
            document.getElementById("wledControls").style.display = "flex";
            document.getElementById("placeholderMsg").style.display = "none";

        // Gestion du bouton Appliquer Hex
    const applyHexBtn = document.getElementById("applyHexBtn");
    if (applyHexBtn) {
        applyHexBtn.onclick = () => {
            let hexValue = document.getElementById("hexInput").value.trim();
            
            // Nettoyage du format (enlève le # si présent)
            if (hexValue.startsWith("#")) hexValue = hexValue.substring(1);
            
            // Validation simple (6 caractères hexadécimaux)
            const isValidHex = /^[0-9A-F]{6}$/i.test(hexValue);
            
            if (isValidHex) {
                selectedColor = "#" + hexValue;
                // Envoi via l'API HTTP WLED (paramètre CL=h pour Hex)
                sendWledHttp("CL=h" + hexValue);
                
                // Optionnel : Mettre à jour les curseurs du picker pour correspondre à la couleur saisie
                // (Nécessite une fonction Hex vers HSL complexe, on peut s'en passer pour l'instant)
            } else {
                alert("Veuillez entrer un code hexadécimal valide (ex: FF5733)");
            }
        };
    }
        }
    };
}