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
const auth = firebase.auth();

// --- Cookies ---
function setCookie(name,value,days){
  let expires = "";
  if(days){ const d=new Date(); d.setTime(d.getTime()+days*24*60*60*1000); expires="; expires="+d.toUTCString();}
  document.cookie = name+"="+(value||"")+expires+"; path=/";
}
function getCookie(name){ const m=document.cookie.match(new RegExp('(^| )'+name+'=([^;]+)')); return m?m[2]:null; }
function eraseCookie(name){ document.cookie = name+'=; Max-Age=-99999999; path=/'; }

// --- Gestion menu utilisateur ---
function initUserMenu() {
  const userContainer = document.getElementById("userContainer");
  if(!userContainer) return;

  auth.onAuthStateChanged(user => {
    if(user){
      setCookie("techledUser", user.email, 7);

      // Création menu utilisateur
      userContainer.innerHTML = `
        <button id="userBtn" class="user-icon">👤</button>
        <div id="userMenu" class="user-menu" style="display:none;flex-direction:column;position:absolute;z-index:1000;">
          <p style="margin-bottom:5px;">Bienvenue ${user.email}</p>
          <button id="resetPasswordBtn" class="btn-outline">Réinitialiser mot de passe</button>
          <button id="logoutBtn" class="btn-outline">Déconnexion</button>
          <button id="homeBtn" class="btn-outline">Accueil</button>
        </div>`;

      const userBtn = document.getElementById("userBtn");
      const userMenu = document.getElementById("userMenu");

      // Affichage du menu
      userBtn.onclick = (e) => {
        e.stopPropagation();
        const rect = userBtn.getBoundingClientRect();
        const menuHeight = userMenu.offsetHeight;
        const menuWidth = userMenu.offsetWidth;

        // Evite que le menu sorte de l’écran
        let top = rect.bottom + 5;
        let right = window.innerWidth - rect.right;

        if(top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;
        if(right + menuWidth > window.innerWidth) right = 10;

        userMenu.style.top = top + "px";
        userMenu.style.right = right + "px";

        userMenu.style.display = userMenu.style.display === "none" ? "flex" : "none";
      };

      window.addEventListener("click",()=>{ if(userMenu) userMenu.style.display="none"; });

      // Boutons menu
      document.getElementById("resetPasswordBtn").onclick = () => {
        const modal = document.getElementById("resetModal");
        if(modal) modal.classList.add("active");
      };
      document.getElementById("logoutBtn").onclick = () => {
        auth.signOut().then(()=>{
          eraseCookie("techledUser");
          window.location.href="index.html";
        });
      };
      document.getElementById("homeBtn").onclick = () => { window.location.href="index.html"; };

    } else {
      // Pas connecté : bouton Connexion/Inscription sur index
      const currentPage = window.location.pathname.split("/").pop();
      if(currentPage === "index.html"){
        const authBtn = document.getElementById("authBtn");
        if(authBtn) authBtn.style.display = "inline-block";
      } else {
        window.location.href="index.html";
      }
    }
  });
}

// --- Modal Reset Password ---
function initResetModal() {
  const resetModal = document.getElementById("resetModal");
  if(!resetModal) return;
  const resetForm = document.getElementById("resetForm");
  const closeBtn = resetModal.querySelector(".close-btn");

  closeBtn.onclick = () => resetModal.classList.remove("active");
  window.onclick = (e) => { if(e.target===resetModal) resetModal.classList.remove("active"); }

  resetForm.onsubmit = (e)=>{
    e.preventDefault();
    const email = document.getElementById("resetEmail").value;
    auth.sendPasswordResetEmail(email)
      .then(()=>{ 
        alert("Email de réinitialisation envoyé !");
        resetModal.classList.remove("active");
        resetForm.reset();
      })
      .catch(err=>alert("Erreur : "+err.message));
  };
}

// --- Initialisation ---
document.addEventListener("DOMContentLoaded", ()=>{
  initUserMenu();
  initResetModal();
});
