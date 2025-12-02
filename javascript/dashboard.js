let ledMode = null; // "wled", "bluetooth", "emulated"
let ledIp = null;
let bleDevice = null;

// =======================
// Popup connexion LED
// =======================
document.getElementById("connectLedBtn").addEventListener("click", () => {
  document.getElementById("ledModal").classList.add("active");
});

document.querySelector("#ledModal .close-btn").addEventListener("click", () => {
  document.getElementById("ledModal").classList.remove("active");
});

// =======================
// Gestion des onglets
// =======================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// =======================
// Connexion WLED (IP)
// =======================
document.getElementById("ledForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ip = document.getElementById("ledIp").value.trim();
  if (!ip) return;

  try {
    const res = await fetch(`http://${ip}/json/info`);
    const info = await res.json();

    if (info && info.ver) {
      ledMode = "wled";
      ledIp = ip;
      console.log("Connexion WLED réussie :", info);
      confirmConnection(`Connecté à WLED (${info.ver}) sur ${ip}`);
      loadOptions();
    } else {
      alert("Cette adresse n'est pas une LED WLED valide !");
    }
  } catch (err) {
    alert("Impossible de se connecter à cette IP : " + err);
  }
});

// =======================
// Connexion Bluetooth
// =======================
async function connectBluetooth() {
  try {
    bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access']
    });
    ledMode = "bluetooth";
    console.log("Appareil Bluetooth choisi :", bleDevice.name);
    confirmConnection(`Connecté en Bluetooth à ${bleDevice.name}`);
  } catch (err) {
    console.error("Erreur Bluetooth :", err);
    alert("Impossible de se connecter en Bluetooth : " + err);
  }
}

// =======================
// Connexion Émulation
// =======================
function connectEmulated() {
  ledMode = "emulated";
  console.log("Connexion simulée à une LED (émulation)");
  confirmConnection("Mode émulation activé");
}

// =======================
// Détection locale (LAN + Bluetooth)
// =======================
async function scanDevices() {
  const list = document.getElementById("detectedList");
  const msg = document.getElementById("noDevicesMsg");
  list.innerHTML = "";
  msg.style.display = "none";

  let devices = [];

  // 1. Scan LAN via backend (Node.js sur ton PC)
  try {
    const res = await fetch("http://localhost:3000/scan"); // backend local
    const lanDevices = await res.json();
    devices = devices.concat(lanDevices);
  } catch (err) {
    console.warn("Backend LAN non disponible :", err);
  }

  // 2. Scan Bluetooth via Web Bluetooth API
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access']
    });
    devices.push({ type: "bluetooth", name: device.name, device });
  } catch (err) {
    console.log("Pas de périphérique Bluetooth choisi :", err);
  }

  if (devices.length === 0) {
    msg.style.display = "block";
  } else {
    devices.forEach(dev => {
      const li = document.createElement("li");
      li.classList.add("device-item");

      if (dev.type === "wled") {
        li.textContent = `${dev.name} (${dev.ip})`;
        li.addEventListener("click", () => connectWLED(dev.ip));
      } else if (dev.type === "bluetooth") {
        li.textContent = dev.name || "Appareil Bluetooth";
        li.addEventListener("click", () => connectBluetoothDevice(dev.device));
      }

      list.appendChild(li);
    });
  }
}

// =======================
// Connexion Bluetooth Device
// =======================
async function connectBluetoothDevice(device) {
  try {
    const server = await device.gatt.connect();
    console.log("Connecté à :", device.name);
    confirmConnection(`Connecté en Bluetooth à ${device.name}`);
  } catch (err) {
    console.error("Erreur connexion BLE :", err);
  }
}

// =======================
// Confirmation connexion
// =======================
function confirmConnection(message) {
  alert(message);
  document.getElementById("ledModal").classList.remove("active");
  document.getElementById("ledControls").style.display = "block";
  document.getElementById("connectCard").style.display = "none";
}

// =======================
// Déconnexion
// =======================
document.getElementById("disconnectBtn").addEventListener("click", () => {
  ledIp = null;
  bleDevice = null;
  ledMode = null;
  alert("LED déconnectée !");
  document.getElementById("ledControls").style.display = "none";
  document.getElementById("connectCard").style.display = "block";
});

// =======================
// Envoi de commande
// =======================
function sendCommand(url, description = "") {
  if (!ledMode) return alert("Pas de LED connectée !");

  if (ledMode === "wled") {
    fetch(`http://${ledIp}${url}`).catch(err => alert("Erreur: " + err));
  } else if (ledMode === "bluetooth") {
    console.log("[BLE] Action envoyée :", description || url);
    // Ici tu devras écrire sur une caractéristique BLE spécifique
  } else if (ledMode === "emulated") {
    console.log("[ÉMULATION] Commande :", description || url);
  }
}

// =======================
// Boutons & contrôles
// =======================
document.getElementById("toggleOnBtn").addEventListener("click", () => {
  sendCommand("/win&A=255", "Allumer la LED");
});
document.getElementById("toggleOffBtn").addEventListener("click", () => {
  sendCommand("/win&A=0", "Éteindre la LED");
});
document.getElementById("brightness").addEventListener("input", (e) => {
  sendCommand(`/win&T=${e.target.value}`, `Luminosité réglée à ${e.target.value}`);
});
document.getElementById("colorPicker").addEventListener("input", (e) => {
  const hex = e.target.value.replace("#", "h");
  sendCommand(`/win&CL=${hex}`, `Couleur changée en ${e.target.value}`);
});

// Effets et palettes (WLED uniquement)
async function loadOptions() {
  if (ledMode !== "wled") return;
  try {
    const res = await fetch(`http://${ledIp}/json/effects`);
    const effects = await res.json();
    const effectSelect = document.getElementById("effectSelect");
    effects.forEach((fx, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = fx;
      effectSelect.appendChild(opt);
    });

    const res2 = await fetch(`http://${ledIp}/json/palettes`);
    const palettes = await res2.json();
    const paletteSelect = document.getElementById("paletteSelect");
    palettes.forEach((p, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = p;
      paletteSelect.appendChild(opt);
    });

    effectSelect.addEventListener("change", (e) => {
      sendCommand(`/win&FX=${e.target.value}`, `Effet #${e.target.value}`);
    });
    paletteSelect.addEventListener("change", (e) => {
      sendCommand(`/win&FP=${e.target.value}`, `Palette #${e.target.value}`);
    });
  } catch (err) {
    console.log("Erreur chargement options WLED :", err);
  }
}

// =======================
// Connexion directe depuis liste détectée
// =======================
async function connectWLED(ip) {
  try {
    const res = await fetch(`http://${ip}/json/info`);
    const info = await res.json();
    if (info && info.ver) {
      ledMode = "wled";
      ledIp = ip;
      console.log("Connexion WLED réussie :", info);
      confirmConnection(`Connecté à WLED (${info.ver}) sur ${ip}`);
      loadOptions();
    }
  } catch (err) {
    alert("Impossible de se connecter à cette IP : " + err);
  }
}
