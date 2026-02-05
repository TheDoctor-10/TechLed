const firebaseConfig = {
  apiKey: "AIzaSyCCvoXrrQLiH7rK-YH4Wa3K5xO7jg4UB5M",
  authDomain: "techled-1c800.firebaseapp.com",
  projectId: "techled-1c800",
  storageBucket: "techled-1c800.appspot.com",
  messagingSenderId: "1016231820720",
  appId: "1:1016231820720:web:7453b90d3afa7ee811ea75"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let currentLampIp = "";
let savedLamps = JSON.parse(localStorage.getItem('techled_lamps')) || [];

// --- 1. GESTION AUTHENTIFICATION & INTERFACE UTILISATEUR ---

function initAuthLogic() {
  auth.onAuthStateChanged(user => {
    const container = document.getElementById("userContainer");
    const isDashboard = window.location.pathname.includes("dashboard.html");

    if (user) {
      const btnLabel = isDashboard ? "Accueil" : "Dashboard";
      const btnLink = isDashboard ? "index.html" : "dashboard.html";
      
      if (container) {
        container.innerHTML = `
          <button id="userBtn" class="user-icon">👤</button>
          <div id="userMenu" class="user-menu" style="display:none; flex-direction:column;">
            <p style="color: black !important; font-weight: bold; margin-bottom:0;">Bienvenue</p>
            <p style="color: black !important; font-size: 0.8rem; margin-bottom: 10px;">${user.email}</p>
            <button onclick="window.location.href='${btnLink}'">${btnLabel}</button>
            <button id="openResetBtn">Paramètres</button>
            <button id="logoutBtn" style="background:#e74c3c;">Déconnexion</button>
          </div>`;

        // Menu déroulant
        const userBtn = document.getElementById("userBtn");
        const userMenu = document.getElementById("userMenu");
        userBtn.onclick = (e) => {
          e.stopPropagation();
          userMenu.style.display = userMenu.style.display === "none" ? "flex" : "none";
        };

        // Déconnexion
        document.getElementById("logoutBtn").onclick = () => {
          auth.signOut().then(() => { window.location.href = "index.html"; });
        };

        // Ouverture Modal Reset
        document.getElementById("openResetBtn").onclick = () => {
          document.getElementById("resetModal").classList.add("active");
        };
      }
    } else {
      // Redirection si accès au dashboard sans être connecté
      if (isDashboard) window.location.href = "index.html";
    }
  });

  // Connexion
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const pass = document.getElementById("loginPassword").value;
      auth.signInWithEmailAndPassword(email, pass)
        .then(() => { window.location.href = "dashboard.html"; })
        .catch(err => alert("Erreur: " + err.message));
    };
  }

  // Inscription
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById("signupEmail").value;
      const pass = document.getElementById("signupPassword").value;
      auth.createUserWithEmailAndPassword(email, pass)
        .then(() => { window.location.href = "dashboard.html"; })
        .catch(err => alert("Erreur: " + err.message));
    };
  }

  // Réinitialisation mot de passe
  const resetForm = document.getElementById("resetForm");
  if (resetForm) {
    resetForm.onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById("resetEmail").value;
      auth.sendPasswordResetEmail(email)
        .then(() => { 
            alert("Email de réinitialisation envoyé !");
            document.getElementById("resetModal").classList.remove("active");
        })
        .catch(err => alert(err.message));
    };
  }
}

// --- 2. LOGIQUE WLED (SCAN & CONTRÔLE) ---

async function isWledDevice(ip) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200); // Timeout court pour le scan
  try {
    const res = await fetch(`http://${ip}/json/info`, { signal: controller.signal });
    return res.ok;
  } catch (e) { return false; }
}

async function validateAndAddIp() {
  const ipField = document.getElementById("manualIp");
  const ip = ipField.value.trim();
  if (!ip) return;

  const status = document.getElementById("scanStatus");
  status.style.display = "block";
  status.innerText = "Vérification de l'appareil...";

  const isValid = await isWledDevice(ip);
  if (isValid) {
    addLamp(ip);
    status.innerText = "Lampe WLED ajoutée !";
    ipField.value = "";
  } else {
    alert("Aucune lampe WLED détectée à l'adresse : " + ip);
    status.style.display = "none";
  }
}

function addLamp(ip) {
  if (!savedLamps.includes(ip)) {
    savedLamps.push(ip);
    localStorage.setItem('techled_lamps', JSON.stringify(savedLamps));
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
    li.onclick = (e) => { if(e.target.tagName !== 'BUTTON') setSelectedLamp(ip); };
    ul.appendChild(li);
  });
}

function removeLamp(ip) {
  savedLamps = savedLamps.filter(l => l !== ip);
  localStorage.setItem('techled_lamps', JSON.stringify(savedLamps));
  if(currentLampIp === ip) {
      document.getElementById("wledControls").style.display = "none";
      document.getElementById("currentLampName").innerText = "Sélectionnez une lampe";
  }
  renderLamps();
}

function setSelectedLamp(ip) {
  currentLampIp = ip;
  document.getElementById("currentLampName").innerText = "Connecté : " + ip;
  document.getElementById("wledControls").style.display = "flex";
  document.getElementById("placeholderMsg").style.display = "none";
}

function sendWledHttp(params) {
  if (!currentLampIp) return;
  // Utilisation de l'API HTTP WLED (Documentation : /win&...)
  fetch(`http://${currentLampIp}/win&${params}`, { mode: 'no-cors' });
}

// --- 3. INITIALISATION AU CHARGEMENT ---

document.addEventListener("DOMContentLoaded", () => {
  initAuthLogic();
  renderLamps();
  
  // Éléments pour les modales
  const authModal = document.getElementById("authModal");
  const authBtn = document.getElementById("authBtn");
  const heroBtn = document.getElementById("heroConnectBtn");

  // Ouverture modale login/signup
  const openAuth = () => { if(authModal) authModal.classList.add("active"); };
  if(authBtn) authBtn.onclick = openAuth;
  if(heroBtn) heroBtn.onclick = openAuth;

  // Fermeture générale des modales (Croix)
  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.onclick = () => {
        document.getElementById("authModal")?.classList.remove("active");
        document.getElementById("resetModal")?.classList.remove("active");
    };
  });

  // Switch onglets Login / Signup
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  if(loginTab && signupTab) {
      loginTab.onclick = () => {
          document.getElementById("loginForm").style.display = "block";
          document.getElementById("signupForm").style.display = "none";
          loginTab.classList.add("active");
          signupTab.classList.remove("active");
      };
      signupTab.onclick = () => {
          document.getElementById("loginForm").style.display = "none";
          document.getElementById("signupForm").style.display = "block";
          signupTab.classList.add("active");
          loginTab.classList.remove("active");
      };
  }

  // Scan Automatique
  const scanBtn = document.getElementById("scanBtn");
  if(scanBtn) {
    scanBtn.onclick = async () => {
      const status = document.getElementById("scanStatus");
      status.style.display = "block";
      const subnets = ["192.168.1.", "192.168.0."]; // Plages communes
      
      for (const sub of subnets) {
        for (let i = 1; i < 30; i++) { // Scan des 30 premières IPs
          const ip = sub + i;
          status.innerText = "Recherche sur " + ip + "...";
          if (await isWledDevice(ip)) {
            addLamp(ip);
          }
        }
      }
      status.innerText = "Scan terminé.";
      setTimeout(() => status.style.display = "none", 3000);
    };
  }
});

// Fermer le menu ou les modales au clic extérieur
window.onclick = (e) => {
  const menu = document.getElementById("userMenu");
  const authModal = document.getElementById("authModal");
  if (menu && !e.target.closest('#userContainer')) menu.style.display = "none";
  if (e.target === authModal) authModal.classList.remove("active");
};