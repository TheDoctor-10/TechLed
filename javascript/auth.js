// -----------------------------------------------------
// 0. CONFIG FIREBASE
// -----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCCvoXrrQLiH7rK-YH4Wa3K5xO7jg4UB5M",
  authDomain: "techled-1c800.firebaseapp.com",
  projectId: "techled-1c800",
  storageBucket: "techled-1c800.firebasestorage.app",
  messagingSenderId: "1016231820720",
  appId: "1:1016231820720:web:7453b90d3afa7ee811ea75",
  measurementId: "G-78P5BS8GPN"
};

// Initialisation défensive : si le SDK Firebase n'est pas chargé (hors-ligne,
// ou page ouverte en file://), on ne fait PAS planter le reste du script.
// L'interface (popup, onglets) doit rester utilisable dans tous les cas.
let auth = null;
try {
    if (typeof firebase !== "undefined" && firebase.initializeApp) {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
    } else {
        console.error("[TechLED] SDK Firebase non chargé : l'authentification est indisponible.");
    }
} catch (e) {
    console.error("[TechLED] Échec de l'initialisation Firebase :", e);
}

// --- Accès localStorage sécurisés ---
// En file:// (origine opaque) ou en navigation privée stricte, l'accès à
// localStorage peut LEVER une exception. On ne doit jamais laisser ça casser
// le script (sinon plus aucun bouton ne fonctionne).
function safeLocalGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignoré */ }
}

// --- VARIABLES GLOBALES ---
let currentLampIp = "";
let savedLamps = [];
try { savedLamps = JSON.parse(safeLocalGet("techled_lamps")) || []; } catch (e) { savedLamps = []; }
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
// Ouvre la modale de connexion/inscription
function openAuthModal() {
    const m = document.getElementById("authModal");
    if (m) m.classList.add("active");
}

// Affiche le bouton "Connexion / Inscription" et (re)lie son handler.
// Indispensable : après une déconnexion, le bouton est recréé et doit être
// relié à nouveau (sinon il ne réagit plus au clic).
function renderLoggedOut(container) {
    container.innerHTML = "";
    const btn = document.createElement("button");
    btn.id = "authBtn";
    btn.className = "btn-outline";
    btn.textContent = "Connexion / Inscription";
    btn.onclick = openAuthModal;
    container.appendChild(btn);
}

function renderLoggedIn(container, user) {
    // Construction en DOM (pas d'innerHTML avec données utilisateur) → anti-XSS
    container.innerHTML = "";

    const icon = document.createElement("button");
    icon.className = "user-icon";
    icon.id = "userIcon";
    icon.textContent = "👤";

    const menu = document.createElement("div");
    menu.className = "user-menu";
    menu.id = "userMenu";
    menu.style.display = "none";
    menu.style.flexDirection = "column";

    const emailP = document.createElement("p");
    emailP.style.cssText = "color:black; font-size:12px; margin:5px 0;";
    emailP.textContent = user.email;                       // textContent → pas d'injection HTML

    const navBtn = document.createElement("button");
    navBtn.textContent = isDashboard ? "Accueil" : "Dashboard";
    navBtn.onclick = () => window.location.href = isDashboard ? "index.html" : "dashboard.html";

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Paramètres / Reset";
    resetBtn.onclick = () => {
        const m = document.getElementById("resetModal");
        if (!m) return;
        // Repart d'un état propre à chaque ouverture
        const sel = document.getElementById("resetType");
        if (sel) sel.value = "password";
        toggleResetFields();
        const st = document.getElementById("resetStatus");
        if (st) { st.textContent = ""; st.style.display = "none"; }
        if (menu) menu.style.display = "none";   // ferme le menu utilisateur
        m.classList.add("active");
    };

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Déconnexion";
    logoutBtn.style.cssText = "background:#e74c3c; color:white;";
    logoutBtn.onclick = () => auth.signOut();

    menu.append(emailP, navBtn, resetBtn, logoutBtn);
    icon.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === "none" ? "flex" : "none";
    };

    container.append(icon, menu);
}

if (auth) {
    auth.onAuthStateChanged((user) => {
        const container = document.getElementById("userContainer");
        if (!container) return;

        if (user) {
            renderLoggedIn(container, user);
        } else if (isDashboard) {
            // Page protégée : pas de session → retour à l'accueil
            window.location.href = "index.html";
        } else {
            renderLoggedOut(container);
        }
    });
}

// -----------------------------------------------------
// 2. LOGIQUE WLED (HTTP UNIQUEMENT)
// -----------------------------------------------------

// Envoi vers une IP précise (utilisé aussi par le planificateur).
function sendWledHttpTo(ip, params) {
    if (debugMode) {
        console.log(`%c[DEBUG] HTTP Send (${ip}) -> ${params}`, "color: cyan; background: #222;");
        if (ip === "DEBUG_ACTIVE") return;
    }
    if (!ip) return;

    fetch(`http://${ip}/win&${params}`, { mode: "no-cors" })
        .catch(() => {
            if (debugMode) {
                console.log(`%c[DEBUG] ❌ Erreur envoi vers ${ip}`, "color: #e74c3c;");
            }
        });
}

// Envoi vers la lampe actuellement sélectionnée.
function sendWledHttp(params) {
    sendWledHttpTo(currentLampIp, params);
}

// Limite la fréquence d'appel d'une fonction (sliders/pickers) : exécution
// immédiate puis au plus une fois par "delay" ms, avec garantie du dernier état.
function makeThrottle(fn, delay) {
    let last = 0, timer = null;
    return (...args) => {
        clearTimeout(timer);
        const elapsed = Date.now() - last;
        if (elapsed >= delay) {
            last = Date.now();
            fn(...args);
        } else {
            timer = setTimeout(() => { last = Date.now(); fn(...args); }, delay - elapsed);
        }
    };
}

// Slider de luminosité : affichage en %, remplissage visuel, envoi throttlé.
function initBrightness() {
    const slider = document.getElementById("brightnessSlider");
    if (!slider) return;
    const valSpan = document.getElementById("brightnessVal");
    const sendBri = makeThrottle((v) => sendWledHttp("A=" + v), 80);

    const refresh = () => {
        const v = parseInt(slider.value, 10);
        const pct = Math.round(v / 255 * 100);
        if (valSpan) valSpan.textContent = pct + "%";
        // Remplissage vert jusqu'au curseur (Webkit) ; Firefox gère via ::-moz-range-progress
        slider.style.background = `linear-gradient(to right, #2ecc71 ${pct}%, #e3e8e5 ${pct}%)`;
    };

    slider.oninput = () => { refresh(); sendBri(slider.value); };
    refresh();
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
        safeLocalSet("techled_lamps", JSON.stringify(savedLamps));
        renderLampList();
    }
}

function renderLampList() {
    const ul = document.getElementById("lampUl");
    if (!ul) return;

    ul.innerHTML = "";

    savedLamps.forEach(lamp => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.textContent = lamp.name;                  // textContent → anti-XSS
        const ipSmall = document.createElement("small");
        ipSmall.textContent = lamp.ip;
        li.append(nameSpan, " ", ipSmall);

        li.onclick = () => {
            currentLampIp = lamp.ip;

            if (debugMode) {
                console.log(`%c[DEBUG] Sélection : ${lamp.name} (${lamp.ip})`, "color: yellow;");
            }

            document.getElementById("currentLampName").innerText = lamp.name;
            document.getElementById("wledControls").style.display = "flex";
            document.getElementById("placeholderMsg").style.display = "none";
            const sc = document.getElementById("scheduleCard");
            if (sc) sc.style.display = "block";

            document.querySelectorAll('.lamp-list li')
                .forEach(el => el.classList.remove('active'));

            li.classList.add('active');
        };

        ul.appendChild(li);
    });
}

// Ajout manuel d'une lampe via son IP (appelé en inline depuis dashboard.html)
function validateAndAddIp() {
    const input = document.getElementById("manualIp");
    const status = document.getElementById("addLampStatus");
    if (!input) return;

    const showStatus = (msg, ok) => {
        if (!status) return;
        status.style.color = ok ? "#2ecc71" : "#e74c3c";
        status.innerText = msg;
    };

    const ip = input.value.trim();
    const ipRegex = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

    if (!ipRegex.test(ip)) {
        showStatus("Adresse IP invalide.", false);
        return;
    }

    addLampToList(ip, ip);
    showStatus("Lampe ajoutée : " + ip, true);
    input.value = "";

    if (debugMode) {
        console.log(`%c[DEBUG] Lampe ajoutée manuellement : ${ip}`, "color: #2ecc71;");
    }
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

// Conversion inverse (pour synchroniser le picker depuis un code Hex saisi)
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return {
        h: Math.round(h),
        s: Math.round((max === 0 ? 0 : d / max) * 100),
        v: Math.round(max * 100)
    };
}

// Hex courant (sans #) d'après hue/sat/val
function currentHex() {
    const rgb = hslToRgb(hue, sat, val);
    return [rgb.r, rgb.g, rgb.b].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Envoi de couleur throttlé : pendant un glissement, on évite de noyer la lampe
// sous des centaines de requêtes/seconde (un envoi ~toutes les 80 ms, plus le
// dernier état garanti).
let _lastColorSend = 0;
let _pendingColorTimer = null;
function sendColorThrottled(hex) {
    clearTimeout(_pendingColorTimer);
    const elapsed = Date.now() - _lastColorSend;
    if (elapsed >= 80) {
        _lastColorSend = Date.now();
        sendWledHttp("CL=h" + hex);
    } else {
        _pendingColorTimer = setTimeout(() => {
            _lastColorSend = Date.now();
            sendWledHttp("CL=h" + hex);
        }, 80 - elapsed);
    }
}

function updateWledColor() {
    const hex = currentHex();
    const hexInput = document.getElementById("hexInput");
    if (hexInput) hexInput.value = "#" + hex.toUpperCase();
    const preview = document.getElementById("colorPreview");
    if (preview) preview.style.background = "#" + hex;
    sendColorThrottled(hex);
}

function initColorPicker() {
    const hueCanvas = document.getElementById("hueCanvas");
    const svCanvas = document.getElementById("svCanvas");
    const hueCursor = document.getElementById("hueCursor");
    const svCursor = document.getElementById("svCursor");
    if (!hueCanvas || !svCanvas) return;

    const hueCtx = hueCanvas.getContext("2d");
    const svCtx = svCanvas.getContext("2d");

    function drawHue() {
        const grad = hueCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
        for (let i = 0; i <= 360; i += 60) {
            grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        hueCtx.fillStyle = grad;
        hueCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
    }

    function drawSV() {
        svCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);

        const white = svCtx.createLinearGradient(0, 0, svCanvas.width, 0);
        white.addColorStop(0, "rgba(255,255,255,1)");
        white.addColorStop(1, "rgba(255,255,255,0)");
        svCtx.fillStyle = white;
        svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);

        const black = svCtx.createLinearGradient(0, 0, 0, svCanvas.height);
        black.addColorStop(0, "rgba(0,0,0,0)");
        black.addColorStop(1, "rgba(0,0,0,1)");
        svCtx.fillStyle = black;
        svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);
    }

    // Positionnement basé sur la taille RENDUE (clientWidth/Height) → reste exact
    // même si le CSS redimensionne le canvas. Curseurs centrés via translate (CSS).
    // Confine le curseur dans [half, taille-half] → il ne dépasse jamais du canvas
    function updateHueCursor() {
        if (!hueCursor) return;
        const w = hueCanvas.clientWidth || hueCanvas.width;
        const half = (hueCursor.offsetWidth || 8) / 2;
        const x = Math.max(half, Math.min(w - half, hue / 360 * w));
        hueCursor.style.left = x + "px";
        hueCursor.style.top = ((hueCanvas.clientHeight || hueCanvas.height) / 2) + "px";
    }

    function updateSvCursor() {
        if (!svCursor) return;
        svCursor.style.display = "block";
        const w = svCanvas.clientWidth || svCanvas.width;
        const h = svCanvas.clientHeight || svCanvas.height;
        const half = (svCursor.offsetWidth || 18) / 2;
        const x = Math.max(half, Math.min(w - half, sat / 100 * w));
        const y = Math.max(half, Math.min(h - half, (1 - val / 100) * h));
        svCursor.style.left = x + "px";
        svCursor.style.top = y + "px";
    }

    const clamp01 = (n) => Math.max(0, Math.min(1, n));

    function pickHue(e) {
        const rect = hueCanvas.getBoundingClientRect();
        const ratio = rect.width ? clamp01((e.clientX - rect.left) / rect.width) : 0;
        hue = Math.round(ratio * 360);
        drawSV();
        updateHueCursor();
        updateWledColor();
    }

    function pickSV(e) {
        const rect = svCanvas.getBoundingClientRect();
        const rx = rect.width ? clamp01((e.clientX - rect.left) / rect.width) : 0;
        const ry = rect.height ? clamp01((e.clientY - rect.top) / rect.height) : 0;
        sat = Math.round(rx * 100);
        val = Math.round((1 - ry) * 100);
        updateSvCursor();
        updateWledColor();
    }

    // Applique un code Hex saisi : met à jour le picker (hue/sat/val + curseurs)
    // puis la lampe. Renvoie false si le format est invalide.
    function setFromHex(hexValue) {
        const hex = (hexValue || "").trim().replace(/^#/, "");
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return false;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        // hue/sat/val pour positionner les curseurs (arrondis tolérés)
        const hsv = rgbToHsv(r, g, b);
        hue = hsv.h; sat = hsv.s; val = hsv.v;
        drawSV();
        updateHueCursor();
        updateSvCursor();
        // On envoie/affiche la couleur EXACTE saisie (pas la valeur ré-arrondie)
        const exact = hex.toLowerCase();
        const hexInput = document.getElementById("hexInput");
        if (hexInput) hexInput.value = "#" + exact.toUpperCase();
        const preview = document.getElementById("colorPreview");
        if (preview) preview.style.background = "#" + exact;
        sendColorThrottled(exact);
        return true;
    }

    // Glissement souris ET tactile (pointer events) sur un canvas.
    function enableDrag(canvas, handler) {
        let dragging = false;
        canvas.style.touchAction = "none";   // empêche le scroll pendant le drag tactile
        canvas.addEventListener("pointerdown", (e) => {
            dragging = true;
            canvas.setPointerCapture(e.pointerId);
            handler(e);
        });
        canvas.addEventListener("pointermove", (e) => { if (dragging) handler(e); });
        canvas.addEventListener("pointerup", () => { dragging = false; });
        canvas.addEventListener("pointercancel", () => { dragging = false; });
    }

    enableDrag(hueCanvas, pickHue);
    enableDrag(svCanvas, pickSV);

    // Bouton "Appliquer" du champ Hex (synchronise désormais tout le picker)
    const applyHexBtn = document.getElementById("applyHexBtn");
    if (applyHexBtn) {
        applyHexBtn.onclick = () => {
            const input = document.getElementById("hexInput");
            if (!setFromHex(input ? input.value : "")) {
                alert("Code Hex invalide (ex: #FF5733).");
            }
        };
    }

    drawHue();
    drawSV();
    updateHueCursor();
    updateSvCursor();

    // Pré-remplit le champ Hex et l'aperçu SANS envoyer de commande au chargement
    const initHex = currentHex();
    const hexInput = document.getElementById("hexInput");
    if (hexInput) hexInput.value = "#" + initHex.toUpperCase();
    const preview = document.getElementById("colorPreview");
    if (preview) preview.style.background = "#" + initHex;
}

// -----------------------------------------------------
// 3bis. AUTHENTIFICATION UI + PARAMÈTRES / RESET
// -----------------------------------------------------

// Bascule les champs de la modale Paramètres (appelée en inline depuis le HTML)
function toggleResetFields() {
    const typeSelect = document.getElementById("resetType");
    if (!typeSelect) return;
    const type = typeSelect.value;
    const pwFields = document.getElementById("passwordFields");
    const emailFields = document.getElementById("emailFields");
    if (pwFields) pwFields.style.display = type === "password" ? "block" : "none";
    if (emailFields) emailFields.style.display = type === "email" ? "block" : "none";
}

// Traduit les codes d'erreur Firebase en messages clairs (sans divulguer
// si un compte existe ou non → bonne pratique sécurité).
function firebaseErrorFr(err) {
    const map = {
        "auth/invalid-email": "Adresse e-mail invalide.",
        "auth/missing-password": "Veuillez saisir un mot de passe.",
        "auth/weak-password": "Mot de passe trop faible (6 caractères minimum).",
        "auth/email-already-in-use": "Un compte existe déjà avec cette adresse.",
        "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
        "auth/invalid-login-credentials": "E-mail ou mot de passe incorrect.",
        "auth/wrong-password": "E-mail ou mot de passe incorrect.",
        "auth/user-not-found": "E-mail ou mot de passe incorrect.",
        "auth/too-many-requests": "Trop de tentatives. Réessayez plus tard.",
        "auth/network-request-failed": "Erreur réseau. Vérifiez votre connexion.",
        "auth/requires-recent-login": "Reconnectez-vous pour effectuer cette action.",
        "auth/unauthorized-domain": "Domaine non autorisé. Lancez le site via un serveur local (http://localhost)."
    };
    return map[err && err.code] || "Une erreur est survenue. Réessayez.";
}

function initAuthUI() {
    const authModal = document.getElementById("authModal");

    // Sécurise le bouton statique présent dès le chargement (avant que
    // onAuthStateChanged ne (re)rende la zone utilisateur).
    const initialAuthBtn = document.getElementById("authBtn");
    if (initialAuthBtn) initialAuthBtn.onclick = openAuthModal;

    const loginTab = document.getElementById("loginTab");
    const signupTab = document.getElementById("signupTab");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const authStatus = document.getElementById("authStatus");

    const showStatus = (msg, ok) => {
        if (!authStatus) return;
        authStatus.style.display = "block";
        authStatus.style.color = ok ? "#2ecc71" : "#e74c3c";
        authStatus.textContent = msg;
    };
    const clearStatus = () => { if (authStatus) authStatus.textContent = ""; };

    if (loginTab && signupTab && loginForm && signupForm) {
        loginTab.onclick = () => {
            clearStatus();
            loginTab.classList.add("active");
            signupTab.classList.remove("active");
            loginForm.style.display = "block";
            signupForm.style.display = "none";
        };
        signupTab.onclick = () => {
            clearStatus();
            signupTab.classList.add("active");
            loginTab.classList.remove("active");
            signupForm.style.display = "block";
            loginForm.style.display = "none";
        };

        loginForm.onsubmit = (e) => {
            e.preventDefault();
            if (!auth) return showStatus("Service indisponible. Lancez le site via un serveur local (http://localhost).", false);
            const email = document.getElementById("loginEmail").value.trim();
            const pw = document.getElementById("loginPassword").value;
            if (!email || !pw) return showStatus("Veuillez remplir tous les champs.", false);

            auth.signInWithEmailAndPassword(email, pw)
                .then(() => { authModal.classList.remove("active"); clearStatus(); })
                .catch(err => showStatus(firebaseErrorFr(err), false));
        };

        signupForm.onsubmit = (e) => {
            e.preventDefault();
            if (!auth) return showStatus("Service indisponible. Lancez le site via un serveur local (http://localhost).", false);
            const email = document.getElementById("signupEmail").value.trim();
            const pw = document.getElementById("signupPassword").value;
            if (!email) return showStatus("Veuillez saisir une adresse e-mail.", false);
            if (pw.length < 6) return showStatus("Mot de passe : 6 caractères minimum.", false);

            auth.createUserWithEmailAndPassword(email, pw)
                .then((cred) => {
                    // RGPD / sécurité : confirmer la propriété de l'adresse e-mail
                    if (cred.user && !cred.user.emailVerified) {
                        cred.user.sendEmailVerification().catch(() => {});
                    }
                    showStatus("Compte créé ! Un e-mail de vérification vous a été envoyé.", true);
                })
                .catch(err => showStatus(firebaseErrorFr(err), false));
        };
    }

    ["heroConnectBtn", "ctaConnectBtn"].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.onclick = () => {
            if (auth && auth.currentUser) {
                window.location.href = "dashboard.html";
            } else {
                openAuthModal();
            }
        };
    });
}

function initResetForm() {
    const resetForm = document.getElementById("resetForm");
    if (!resetForm) return;

    // État initial cohérent des champs
    toggleResetFields();

    const status = document.getElementById("resetStatus");
    const showStatus = (msg, ok) => {
        if (!status) return;
        status.style.display = "block";
        status.style.color = ok ? "#2ecc71" : "#e74c3c";
        status.textContent = msg;
    };

    resetForm.onsubmit = (e) => {
        e.preventDefault();
        if (!auth) return showStatus("Service indisponible. Lancez le site via un serveur local (http://localhost).", false);
        const type = document.getElementById("resetType").value;

        if (type === "password") {
            const email = document.getElementById("resetEmailInput").value.trim();
            if (!email) return showStatus("Veuillez entrer une adresse e-mail.", false);
            auth.sendPasswordResetEmail(email)
                // Message neutre : ne révèle pas si le compte existe (anti-énumération)
                .then(() => showStatus("Si un compte existe, un e-mail a été envoyé.", true))
                .catch(err => showStatus(firebaseErrorFr(err), false));
        } else {
            const oldEmail = document.getElementById("oldEmailInput").value.trim();
            const newEmail = document.getElementById("newEmailInput").value.trim();
            const pw = document.getElementById("passwordInput").value;
            const user = auth.currentUser;
            if (!user) return showStatus("Vous devez être connecté.", false);
            if (!newEmail) return showStatus("Veuillez saisir la nouvelle adresse.", false);

            const cred = firebase.auth.EmailAuthProvider.credential(oldEmail, pw);
            user.reauthenticateWithCredential(cred)
                .then(() => user.updateEmail(newEmail))
                .then(() => user.sendEmailVerification().catch(() => {}))
                .then(() => showStatus("Adresse mise à jour ! Vérifiez votre nouvel e-mail.", true))
                .catch(err => showStatus(firebaseErrorFr(err), false));
        }
    };
}

// Bannière de consentement RGPD (affichée tant qu'elle n'est pas acceptée)
function initConsentBanner() {
    const banner = document.getElementById("consentBanner");
    if (!banner) return;
    if (safeLocalGet("techled_consent") === "1") return;

    banner.style.display = "flex";
    const accept = document.getElementById("consentAccept");
    if (accept) {
        accept.onclick = () => {
            safeLocalSet("techled_consent", "1");
            banner.style.display = "none";
        };
    }
}

// -----------------------------------------------------
// 3ter. PLANIFICATION DE TÂCHES
// -----------------------------------------------------
// Planificateur côté client : tant que le dashboard est ouvert, il vérifie
// l'heure et déclenche les actions programmées sur la lampe ciblée.
// (Une planification persiste dans le navigateur, mais ne s'exécute que
//  lorsque la page est ouverte.)

let schedules = [];
try { schedules = JSON.parse(safeLocalGet("techled_schedules")) || []; } catch (e) { schedules = []; }
let schedulerInterval = null;

const SCHED_ACTION_LABELS = {
    on: "Allumer",
    off: "Éteindre",
    color: "Couleur",
    brightness: "Luminosité"
};

// getDay() : 0 = Dimanche … 6 = Samedi
const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Description lisible des jours d'une planification
function describeDays(days) {
    if (!days || days.length === 0) return "une fois";
    if (days.length === 7) return "tous les jours";
    return [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(", ");
}

function saveSchedules() {
    safeLocalSet("techled_schedules", JSON.stringify(schedules));
}

// Construit la commande WLED correspondant à une action planifiée
function scheduleToParams(s) {
    switch (s.action) {
        case "on": return "T=1";
        case "off": return "T=0";
        case "color": return "CL=h" + String(s.value || "").replace(/^#/, "");
        case "brightness": return "A=" + s.value;
        default: return null;
    }
}

function fireSchedule(s) {
    const params = scheduleToParams(s);
    if (!params) return;
    sendWledHttpTo(s.lampIp, params);
    if (debugMode) {
        console.log(`%c[DEBUG] ⏰ Planif déclenchée : ${s.time} ${s.action} → ${s.lampName} (${s.lampIp})`, "color:#9b59b6; font-weight:bold;");
    }
}

function schedulerTick() {
    const now = new Date();
    const cur = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    // Clé unique par minute pour ne déclencher qu'une fois
    const minuteKey = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate() + " " + cur;

    const dow = now.getDay();   // jour de la semaine actuel
    let changed = false;
    schedules.forEach(s => {
        if (!s.enabled || s.time !== cur || s.lastFired === minuteKey) return;
        // Si des jours sont définis, ne se déclenche que ces jours-là
        if (s.days && s.days.length > 0 && !s.days.includes(dow)) return;
        fireSchedule(s);
        s.lastFired = minuteKey;
        if (!s.days || s.days.length === 0) s.enabled = false;   // "une fois" → désactivée après usage
        changed = true;
    });

    if (changed) { saveSchedules(); renderSchedules(); }
}

function renderSchedules() {
    const ul = document.getElementById("schedUl");
    if (!ul) return;
    ul.innerHTML = "";

    if (schedules.length === 0) {
        const empty = document.createElement("li");
        empty.className = "sched-empty";
        empty.textContent = "Aucune tâche planifiée.";
        ul.appendChild(empty);
        return;
    }

    schedules.forEach(s => {
        const li = document.createElement("li");
        li.className = "sched-item" + (s.enabled ? "" : " disabled");

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = s.enabled;
        toggle.title = "Activer / désactiver";
        toggle.onchange = () => {
            s.enabled = toggle.checked;
            if (s.enabled) s.lastFired = null;   // ré-armer
            saveSchedules();
            renderSchedules();
        };

        let label = SCHED_ACTION_LABELS[s.action] || s.action;
        if (s.action === "color") label += " " + s.value;
        if (s.action === "brightness") label += " " + s.value;

        const text = document.createElement("span");
        text.className = "sched-text";
        text.textContent = `${s.time} · ${label} · ${describeDays(s.days)} · ${s.lampName}`;

        const del = document.createElement("button");
        del.className = "sched-del";
        del.textContent = "🗑";
        del.title = "Supprimer";
        del.onclick = () => {
            schedules = schedules.filter(x => x.id !== s.id);
            saveSchedules();
            renderSchedules();
        };

        li.append(toggle, text, del);
        ul.appendChild(li);
    });
}

function addScheduleFromForm() {
    const status = document.getElementById("schedStatus");
    const showStatus = (msg, ok) => {
        if (!status) return;
        status.style.color = ok ? "#2ecc71" : "#e74c3c";
        status.textContent = msg;
    };

    if (!currentLampIp) {
        return showStatus("Sélectionnez d'abord une lampe.", false);
    }

    const time = document.getElementById("schedTime").value;
    const action = document.getElementById("schedAction").value;
    const days = Array.from(document.querySelectorAll("#schedDays .day-btn.selected"))
        .map(b => parseInt(b.getAttribute("data-day"), 10));
    let value = "";

    if (!time) return showStatus("Choisissez une heure.", false);

    if (action === "color") {
        value = document.getElementById("schedValue").value.trim();
        if (!/^#?[0-9A-Fa-f]{6}$/.test(value)) return showStatus("Couleur Hex invalide (ex: #FF5733).", false);
        value = "#" + value.replace(/^#/, "").toUpperCase();
    } else if (action === "brightness") {
        value = document.getElementById("schedValue").value.trim();
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0 || n > 255) return showStatus("Luminosité entre 0 et 255.", false);
        value = String(n);
    }

    const lampName = currentLampIp === "DEBUG_ACTIVE"
        ? "Lampe (DEBUG)"
        : (savedLamps.find(l => l.ip === currentLampIp) || {}).name || currentLampIp;

    schedules.push({
        id: Date.now().toString(36) + Math.floor(hue + sat + val).toString(36),
        time, action, value, days,
        lampIp: currentLampIp,
        lampName,
        enabled: true,
        lastFired: null
    });
    saveSchedules();
    renderSchedules();
    showStatus("Tâche planifiée ajoutée ✅", true);
}

function initScheduler() {
    const addBtn = document.getElementById("addSchedBtn");
    if (!addBtn) return;   // pas sur cette page

    // Affiche le champ "valeur" selon l'action choisie
    const actionSel = document.getElementById("schedAction");
    const valueGroup = document.getElementById("schedValueGroup");
    const valueLabel = document.getElementById("schedValueLabel");
    const valueInput = document.getElementById("schedValue");

    const syncValueField = () => {
        const a = actionSel.value;
        if (a === "color") {
            valueGroup.style.display = "block";
            valueLabel.textContent = "Couleur (Hex)";
            valueInput.placeholder = "#FF5733";
        } else if (a === "brightness") {
            valueGroup.style.display = "block";
            valueLabel.textContent = "Luminosité (0-255)";
            valueInput.placeholder = "128";
        } else {
            valueGroup.style.display = "none";
        }
    };
    actionSel.onchange = syncValueField;
    syncValueField();

    // Sélecteur de jours : chaque bouton se bascule au clic
    const dayBtns = document.querySelectorAll("#schedDays .day-btn");
    dayBtns.forEach(btn => {
        btn.onclick = () => btn.classList.toggle("selected");
    });
    const daysAll = document.getElementById("daysAll");
    if (daysAll) daysAll.onclick = () => dayBtns.forEach(b => b.classList.add("selected"));
    const daysNone = document.getElementById("daysNone");
    if (daysNone) daysNone.onclick = () => dayBtns.forEach(b => b.classList.remove("selected"));

    addBtn.onclick = addScheduleFromForm;

    renderSchedules();

    // Vérifie toutes les 15 s + tout de suite
    schedulerTick();
    schedulerInterval = setInterval(schedulerTick, 15000);
}

// -----------------------------------------------------
// 4. INITIALISATION
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    // Commun aux deux pages
    initAuthUI();
    initResetForm();
    initConsentBanner();

    if (isDashboard) {

        populateEffects();
        renderLampList();
        initColorPicker();
        initBrightness();

        const dbBtn = document.getElementById("debugBtn");

        if(dbBtn) {
            dbBtn.onclick = () => {
                debugMode = !debugMode;

                dbBtn.style.background = debugMode ? "#2ecc71" : "";

                console.log(
                    `%c[SYSTEM] Debug : ${debugMode ? "ON" : "OFF"}`,
                    "font-weight:bold;color:" + (debugMode ? "#2ecc71" : "#e74c3c")
                );

                const scheduleCard = document.getElementById("scheduleCard");
                if(debugMode) {
                    currentLampIp = "DEBUG_ACTIVE";
                    document.getElementById("wledControls").style.display = "flex";
                    document.getElementById("placeholderMsg").style.display = "none";
                    if (scheduleCard) scheduleCard.style.display = "block";
                } else {
                    currentLampIp = "";
                    document.getElementById("wledControls").style.display = "none";
                    document.getElementById("placeholderMsg").style.display = "block";
                    if (scheduleCard) scheduleCard.style.display = "none";
                }
            };
        }

        initScheduler();
    }

    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.onclick = () => btn.closest(".modal").classList.remove("active");
    });
});