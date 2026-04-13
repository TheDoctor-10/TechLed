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
let debugMode = false;
let hue = 0, sat = 100, val = 100;

const path = window.location.pathname;
const isDashboard = path.includes("dashboard.html");

const WLED_EFFECTS = {
    0: "Solid", 1: "Blink", 2: "Breathe", 3: "Wipe", 4: "Wipe Random", 5: "Random Colors",
    6: "Sweep", 7: "Dynamic", 8: "Colorloop", 9: "Rainbow", 10: "Scan", 11: "Dual Scan",
    12: "Fade", 13: "Theater", 14: "Theater Rainbow", 15: "Running", 16: "Saw",
    17: "Twinkle", 18: "Dissolve", 19: "Dissolve Rnd", 20: "Sparkle", 21: "Dark Sparkle",
    22: "Sparkle+", 23: "Strobe", 24: "Strobe Rainbow", 25: "Strobe Mega", 26: "Strobe Blink",
    27: "Android", 28: "Chase", 29: "Chase Random", 30: "Chase Rainbow", 31: "Chase Flash",
    32: "Chase Flash Rnd", 33: "Rainbow Runner", 34: "Colorful", 35: "Dynamic Smooth",
    36: "Loading", 37: "Police", 38: "Police All", 39: "Two Dots", 40: "Two Areas",
    41: "Running Dual", 42: "Fireworks", 43: "Rain", 44: "Merry Christmas", 45: "Fire Flicker",
    46: "Gradient", 47: "Loading", 48: "In Out", 49: "In In", 50: "Out Out", 51: "Out In",
    52: "Circus", 53: "Halloween", 54: "Tri Chase", 55: "Tri Wipe", 56: "Tri Fade",
    57: "Lightning", 58: "ICU", 59: "Multi Comet", 60: "Scanner Dual", 61: "Stream",
    62: "Oscillate", 63: "Pride 2015", 64: "Juggle", 65: "Palette", 66: "Fire 2012",
    67: "Colorwaves", 68: "Bpm", 69: "Fill Noise", 70: "Noise 1", 71: "Noise 2",
    72: "Noise 3", 73: "Noise 4", 74: "Colortwinkles", 75: "Lake", 76: "Meteor",
    77: "Meteor Smooth", 78: "Railway", 79: "Ripple", 80: "Twinklefox", 81: "Twinklecat",
    82: "Halloween Eyes", 83: "Solid Pattern", 84: "Solid Pattern Tri", 85: "Spots",
    86: "Spots Fade", 87: "Glitter", 88: "Candle", 89: "Fireworks Star", 90: "Fireworks 1D",
    91: "Bouncing Balls", 92: "Sinelon", 93: "Sinelon Dual", 94: "Sinelon Rainbow",
    95: "Popcorn", 96: "Drip", 97: "Plasma", 98: "Percent", 99: "Ripple Rainbow",
    100: "Heartbeat", 101: "Pacifica", 102: "Candle Multi", 103: "Solid Glitter",
    104: "Sunrise", 105: "Phased", 106: "Phased Noise", 107: "Twinkleup", 108: "Noise Pal",
    109: "Sine", 110: "Phased Rainbow", 111: "Flow", 112: "Chamelon", 113: "Blends",
    114: "Tv Simulator", 115: "Spaceships"
};

// -----------------------------------------------------
// 1. GESTION UTILISATEUR & AUTHENTIFICATION
// -----------------------------------------------------
auth.onAuthStateChanged((user) => {
    const container = document.getElementById("userContainer");
    if (!container) return;

    if (user) {
        container.innerHTML = `
            <button class="user-icon" id="userIcon">👤</button>
            <div class="user-menu" id="userMenu" style="display:none; flex-direction:column;">
                <p style="color:black; font-size:12px; margin:5px 0;">${user.email}</p>
                ${!isDashboard ? `<button onclick="window.location.href='dashboard.html'">Dashboard</button>` : `<button onclick="window.location.href='index.html'">Accueil</button>`}
                <button id="openResetBtn">Paramètres / Reset</button>
                <button id="logoutBtn" style="background:#e74c3c; color:white;">Déconnexion</button>
            </div>
        `;

        document.getElementById("userIcon").onclick = (e) => {
            e.stopPropagation();
            const m = document.getElementById("userMenu");
            m.style.display = m.style.display === "none" ? "flex" : "none";
        };

        document.getElementById("openResetBtn").onclick = () => {
            document.getElementById("resetModal").classList.add("active");
        };

        document.getElementById("logoutBtn").onclick = () => auth.signOut();
    } else {
        if (isDashboard) {
            window.location.href = "index.html";
        } else {
            container.innerHTML = `<button id="authBtn" class="btn-outline">Connexion / Inscription</button>`;
            if (document.getElementById("authBtn")) {
                document.getElementById("authBtn").onclick = () => document.getElementById("authModal").classList.add("active");
            }
        }
    }
});

// -----------------------------------------------------
// 2. LOGIQUE WLED (SCAN, MANUEL, EFFETS)
// -----------------------------------------------------
function populateEffects() {
    const select = document.querySelector("select[onchange*='FX=']");
    if (!select) return;
    select.innerHTML = "";
    Object.entries(WLED_EFFECTS).forEach(([id, name]) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
    });
}

async function validateAndAddIp() {
    const ip = document.getElementById("manualIp").value.trim();
    if (!ip) return alert("Veuillez entrer une IP.");
    const status = document.getElementById("scanStatus");
    status.style.display = "block";
    status.innerText = "Vérification de l'adresse...";
    
    const isValid = await validateWled(ip);
    if (isValid) {
        status.innerText = "Lampe ajoutée !";
        document.getElementById("manualIp").value = "";
    } else {
        alert("WLED introuvable à cette adresse.");
        status.style.display = "none";
    }
}

async function startNetworkScan() {
    const status = document.getElementById("scanStatus");
    status.style.display = "block";
    status.innerText = "Scan du réseau WiFi...";
    
    // Scan élargi
    const subnets = ["192.168.1", "192.168.0", "10.0.0", "192.168.4"];
    let promises = [];
    subnets.forEach(s => {
        for(let i=1; i<60; i++) promises.push(validateWled(`${s}.${i}`));
    });

    const results = await Promise.all(promises);
    const count = results.filter(r => r === true).length;
    status.innerText = count > 0 ? `${count} WLED détectée(s)` : "Aucune WLED trouvée.";
    setTimeout(() => status.style.display = "none", 5000);
}

async function validateWled(ip) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 1500);
    try {
        const res = await fetch(`http://${ip}/json/info`, { signal: ctrl.signal });
        const data = await res.json();
        if (data.brand === "WLED" || (data.name && data.name.toUpperCase().includes("WLED"))) {
            addLampToList(data.name || "WLED", ip);
            return true;
        }
        return false;
    } catch(e) { return false; } finally { clearTimeout(tid); }
}

function addLampToList(name, ip) {
    if (!savedLamps.find(l => l.ip === ip)) {
        savedLamps.push({ name, ip });
        localStorage.setItem("techled_lamps", JSON.stringify(savedLamps));
        renderLampList();
    }
}

function renderLampList() {
    const ul = document.getElementById("lampUl");
    if (!ul) return;
    ul.innerHTML = "";
    savedLamps.forEach(lamp => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${lamp.name}</span> <small>${lamp.ip}</small>`;
        li.onclick = () => {
            currentLampIp = lamp.ip;
            document.getElementById("currentLampName").innerText = lamp.name;
            document.getElementById("wledControls").style.display = "flex";
            document.getElementById("placeholderMsg").style.display = "none";
            document.querySelectorAll('.lamp-list li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        };
        ul.appendChild(li);
    });
}

function sendWledHttp(params) {
    if (debugMode) return console.log("[DEBUG] -> " + params);
    if (!currentLampIp) return;
    fetch(`http://${currentLampIp}/win&${params}`, { mode: "no-cors" }).catch(() => {});
}

// -----------------------------------------------------
// 3. COLOR PICKER
// -----------------------------------------------------
function hslToRgb(h, s, v) {
    s /= 100; v /= 100;
    let c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r=0, g=0, b=0;
    if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
    return { r:Math.round((r+m)*255), g:Math.round((g+m)*255), b:Math.round((b+m)*255) };
}

function updateWledColor() {
    const rgb = hslToRgb(hue, sat, val);
    const hex = [rgb.r, rgb.g, rgb.b].map(x => x.toString(16).padStart(2, "0")).join("");
    if(document.getElementById("hexInput")) document.getElementById("hexInput").value = "#" + hex.toUpperCase();
    sendWledHttp("CL=h" + hex);
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
        let rect = hC.getBoundingClientRect();
        let x = Math.max(0, Math.min(hC.width, e.clientX - rect.left));
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
// 4. INITIALISATION GENERALE & FORMULAIRES
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Tabs Auth
    const lTab = document.getElementById("loginTab"), sTab = document.getElementById("signupTab");
    const lForm = document.getElementById("loginForm"), sForm = document.getElementById("signupForm");
    if (lTab) {
        lTab.onclick = () => { lTab.classList.add("active"); sTab.classList.remove("active"); lForm.style.display="block"; sForm.style.display="none"; };
        sTab.onclick = () => { sTab.classList.add("active"); lTab.classList.remove("active"); sForm.style.display="block"; lForm.style.display="none"; };
        
        lForm.onsubmit = (e) => { 
            e.preventDefault(); 
            auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value)
                .then(()=>window.location.href="dashboard.html").catch(a=>alert(a.message)); 
        };
        sForm.onsubmit = (e) => { 
            e.preventDefault(); 
            auth.createUserWithEmailAndPassword(document.getElementById("signupEmail").value, document.getElementById("signupPassword").value)
                .then(()=>window.location.href="dashboard.html").catch(a=>alert(a.message)); 
        };
    }

    // Submit Reset Password
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

    // Init Dashboard
    if (isDashboard) {
        populateEffects();
        renderLampList();
        drawHueBar();
        drawSVBox();
        initPickers();
        if(document.getElementById("scanBtn")) document.getElementById("scanBtn").onclick = startNetworkScan;
        
        const applyHexBtn = document.getElementById("applyHexBtn");
        if(applyHexBtn) {
            applyHexBtn.onclick = () => {
                let hex = document.getElementById("hexInput").value.trim().replace("#", "");
                if (/^[0-9A-F]{6}$/i.test(hex)) sendWledHttp("CL=h" + hex);
                else alert("Code hex invalide.");
            };
        }
    }

    // Fermeture modales
    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.onclick = () => btn.closest(".modal").classList.remove("active");
    });
});