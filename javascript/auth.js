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
// 1. GESTION UTILISATEUR
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
    } else if (isDashboard) {
        window.location.href = "index.html";
    }
});

// -----------------------------------------------------
// 2. LOGIQUE WLED (HTTP UNIQUEMENT)
// -----------------------------------------------------

function sendWledHttp(params) {
    if (debugMode) {
        console.log("%c[DEBUG] HTTP Send -> " + params, "color: cyan; background: #222;");
        if (currentLampIp === "DEBUG_ACTIVE") return;
    }
    if (!currentLampIp) return;

    fetch(`http://${currentLampIp}/win&${params}`, { mode: "no-cors" })
        .catch(() => {
            if (debugMode) {
                console.log(`%c[DEBUG] ❌ Erreur envoi vers ${currentLampIp}`, "color: #e74c3c;");
            }
        });
}

function populateEffects() {
    const select = document.getElementById("wledEffects");
    if (!select) return;

    select.innerHTML = '<option value="">Choisir un effet...</option>';

    Object.entries(WLED_EFFECTS).forEach(([id, name]) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
    });

    select.onchange = () => {
        if (select.value !== "") {
            sendWledHttp("FX=" + select.value);
        }
    };
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

            if (debugMode) {
                console.log(`%c[DEBUG] Sélection : ${lamp.name} (${lamp.ip})`, "color: yellow;");
            }

            document.getElementById("currentLampName").innerText = lamp.name;
            document.getElementById("wledControls").style.display = "flex";
            document.getElementById("placeholderMsg").style.display = "none";

            document.querySelectorAll('.lamp-list li')
                .forEach(el => el.classList.remove('active'));

            li.classList.add('active');
        };

        ul.appendChild(li);
    });
}

// -----------------------------------------------------
// 3. COLOR PICKER
// -----------------------------------------------------
function hslToRgb(h, s, v) {
    s /= 100; v /= 100;
    let c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r=0, g=0, b=0;

    if(h<60){r=c;g=x}
    else if(h<120){r=x;g=c}
    else if(h<180){g=c;b=x}
    else if(h<240){g=x;b=c}
    else if(h<300){r=x;b=c}
    else{r=c;b=x}

    return {
        r:Math.round((r+m)*255),
        g:Math.round((g+m)*255),
        b:Math.round((b+m)*255)
    };
}

function updateWledColor() {
    const rgb = hslToRgb(hue, sat, val);
    const hex = [rgb.r, rgb.g, rgb.b]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");

    const hexInput = document.getElementById("hexInput");
    if(hexInput) hexInput.value = "#" + hex.toUpperCase();

    sendWledHttp("CL=h" + hex);
}

// -----------------------------------------------------
// 4. INITIALISATION
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    if (isDashboard) {

        populateEffects();
        renderLampList();

        const dbBtn = document.getElementById("debugBtn");

        if(dbBtn) {
            dbBtn.onclick = () => {
                debugMode = !debugMode;

                dbBtn.style.background = debugMode ? "#2ecc71" : "";

                console.log(
                    `%c[SYSTEM] Debug : ${debugMode ? "ON" : "OFF"}`,
                    "font-weight:bold;color:" + (debugMode ? "#2ecc71" : "#e74c3c")
                );

                if(debugMode) {
                    currentLampIp = "DEBUG_ACTIVE";
                    document.getElementById("wledControls").style.display = "flex";
                    document.getElementById("placeholderMsg").style.display = "none";
                } else {
                    currentLampIp = "";
                    document.getElementById("wledControls").style.display = "none";
                    document.getElementById("placeholderMsg").style.display = "block";
                }
            };
        }

        const applyHexBtn = document.getElementById("applyHexBtn");
        if(applyHexBtn) {
            applyHexBtn.onclick = () => {
                let hexValue = document.getElementById("hexInput").value.trim().replace("#", "");
                if (/^[0-9A-F]{6}$/i.test(hexValue)) {
                    sendWledHttp("CL=h" + hexValue);
                } else {
                    alert("Hex invalide");
                }
            };
        }
    }

    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.onclick = () => btn.closest(".modal").classList.remove("active");
    });
});