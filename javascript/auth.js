// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyCCvoXrrQLiH7rK-YH4Wa3K5xO7jg4UB5M",
  authDomain: "techled-1c800.firebaseapp.com",
  projectId: "techled-1c800",
  storageBucket: "techled-1c800.appspot.com",
  messagingSenderId: "1016231820720",
  appId: "1:1016231820720:web:7453b90d3afa7ee811ea75"
};
firebase.initializeApp(firebaseConfig);

// Détection de la page actuelle
const path = window.location.pathname;
const isDashboard = path.endsWith("dashboard.html");
const isIndex = path.endsWith("index.html") || path === "/";

// Gestion de l'état utilisateur
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    if (isIndex) renderLoggedInUI(user);
    if (isDashboard) renderLoggedInUI(user);
  } else {
    if (isDashboard) {
      window.location.href = "index.html";
    } else {
      renderLoggedOutUI();
    }
  }
});

// =======================
// Fonctions UI
// =======================

function renderLoggedInUI(user) {
  const container = document.getElementById("userContainer");
  if (!container) return;

  container.innerHTML = `
    <button class="user-icon" id="userIcon">👤</button>
    <div class="user-menu" id="userMenu">
      ${isIndex ? `<button id="goDashboard">Aller au tableau de bord</button>` : ""}
      <button id="resetPasswordBtn">Réinitialiser mot de passe</button>
      <button id="logoutBtn">Se déconnecter</button>
    </div>
  `;

  // Aller au dashboard
  const goDashboardBtn = document.getElementById("goDashboard");
  if (goDashboardBtn) {
    goDashboardBtn.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
  }

  // Réinitialiser mot de passe avec confirmation
  const resetPasswordBtn = document.getElementById("resetPasswordBtn");
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener("click", () => {
      if (user.email) {
        const confirmReset = confirm(
          "Voulez-vous vraiment envoyer un email de réinitialisation à " + user.email + " ?"
        );
        if (confirmReset) {
          firebase.auth().sendPasswordResetEmail(user.email)
            .then(() => {
              alert("Email de réinitialisation envoyé à " + user.email);
            })
            .catch((error) => {
              alert("Erreur : " + error.message);
            });
        }
      } else {
        alert("Impossible de récupérer l'email de l'utilisateur.");
      }
    });
  }

  // Déconnexion
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      firebase.auth().signOut();
    });
  }

  // Menu utilisateur toggle
  const userIcon = document.getElementById("userIcon");
  const userMenu = document.getElementById("userMenu");
  if (userIcon && userMenu) {
    userIcon.addEventListener("click", () => {
      userMenu.style.display = userMenu.style.display === "flex" ? "none" : "flex";
    });
  }
}

function renderLoggedOutUI() {
  const container = document.getElementById("userContainer");
  if (!container) return;

  container.innerHTML = `
    <button id="authBtn" class="btn-outline">Connexion / Inscription</button>
  `;

  const authBtn = document.getElementById("authBtn");
  if (authBtn) {
    authBtn.addEventListener("click", () => {
      const modal = document.getElementById("authModal");
      if (modal) modal.classList.add("active");
    });
  }
}

// =======================
// Fermeture des popups
// =======================
document.querySelectorAll(".close-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = btn.closest(".modal");
    if (modal) modal.classList.remove("active");
  });
});

// =======================
// Gestion du reset password (formulaire popup)
// =======================
const resetForm = document.getElementById("resetForm");
if (resetForm) {
  resetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("resetEmail").value;
    firebase.auth().sendPasswordResetEmail(email)
      .then(() => {
        alert("Email de réinitialisation envoyé !");
      })
      .catch((error) => {
        alert("Erreur : " + error.message);
      });
  });
}

// =======================
// Onglets Connexion / Inscription
// =======================
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

if (loginTab && signupTab && loginForm && signupForm) {
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginForm.style.display = "block";
    signupForm.style.display = "none";
  });

  signupTab.addEventListener("click", () => {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupForm.style.display = "block";
    loginForm.style.display = "none";
  });
}

// =======================
// Connexion
// =======================
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(() => {
        window.location.href = "dashboard.html";
      })
      .catch((error) => {
        alert("Erreur de connexion : " + error.message);
      });
  });
}

// =======================
// Inscription
// =======================
if (signupForm) {
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then(() => {
        window.location.href = "dashboard.html";
      })
      .catch((error) => {
        alert("Erreur d'inscription : " + error.message);
      });
  });
}
