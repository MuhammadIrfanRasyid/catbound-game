"use strict";

// ============================================================
// CATBOUND — Client game engine
// ============================================================

const socket = io();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menuOverlay");
const joinButton = document.getElementById("joinButton");
const menuError = document.getElementById("menuError");
const playerNameInput = document.getElementById("playerName");
const roomNameInput = document.getElementById("roomName");
const hud = document.getElementById("hud");
const roomLabel = document.getElementById("roomLabel");
const playerCount = document.getElementById("playerCount");
const keyStatus = document.getElementById("keyStatus");
const toast = document.getElementById("toast");
const restartButton = document.getElementById("restartButton");
const touchControls = document.getElementById("touchControls");

const ALLOWED_COLORS = [
  "#ff6b8a",
  "#59c3ff",
  "#ffd166",
  "#9b8cff",
  "#64dfb0",
  "#ff9f5a",
  "#f28bd8",
  "#b7e36b"
];

let gameState = null;
let myId = null;
let joined = false;

// Inisialisasi warna menu dari tombol yang sedang terpilih di DOM
const initialSelectedBtn = document.querySelector(".color-option.selected");
let selectedColor = sanitizePlayerColor(
  initialSelectedBtn ? initialSelectedBtn.dataset.color : "#ff6b8a"
);

// Profil sesi lokal untuk menjaga konsistensi warna & identitas saat reconnect
const sessionProfile = {
  name: "Pemain",
  roomId: "KUCING",
  color: selectedColor
};

let lastToast = "";
let lastToastAt = 0;
let previousFrame = performance.now();
let lastRenderTime = performance.now();
let accumulator = 0;
let lastInputSent = 0;

const keys = {
  left: false,
  right: false,
  jump: false
};

const camera = { x: 0, y: 0 };
const DPR_LIMIT = 2;

// Cache objek pemain agar posisi remote dapat diinterpolasi
const renderPlayers = new Map();

// State visual sakelar & gerbang yang mengikuti konfirmasi server
const switchVisual = {
  press: 0,
  squash: 0,
  squashVelocity: 0,
  glow: 0,
  lastTransitionSeq: null,
  particles: []
};

const gateVisual = {
  openProgress: 0
};

function sanitizePlayerColor(rawColor, fallback = "#ff6b8a") {
  const normalized = String(rawColor || "").trim().toLowerCase();
  if (ALLOWED_COLORS.includes(normalized)) {
    return normalized;
  }
  return ALLOWED_COLORS.includes(fallback) ? fallback : "#ff6b8a";
}

function syncColorPickerUI(color) {
  const normalized = sanitizePlayerColor(color);
  document.querySelectorAll(".color-option").forEach(btn => {
    const btnColor = String(btn.dataset.color || "").trim().toLowerCase();
    btn.classList.toggle("selected", btnColor === normalized);
  });
}

// ============================================================
// Canvas responsive
// ============================================================

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);

  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ============================================================
// Menu dan pilihan warna
// ============================================================

document.querySelectorAll(".color-option").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();

    const chosenColor = sanitizePlayerColor(button.dataset.color);
    selectedColor = chosenColor;
    sessionProfile.color = chosenColor;
    syncColorPickerUI(chosenColor);

    // Kirim pilihan warna ke server agar tersimpan pada state pemain
    if (socket.connected) {
      socket.emit("selectColor", { color: chosenColor }, response => {
        if (response && response.ok && response.color) {
          selectedColor = sanitizePlayerColor(response.color);
          sessionProfile.color = selectedColor;
          syncColorPickerUI(selectedColor);
        }
      });
    }
  });
});

function showToast(message) {
  if (!message) return;

  const now = performance.now();

  if (message === lastToast && now - lastToastAt < 1800) return;

  lastToast = message;
  lastToastAt = now;
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

function performJoin(profile, isReconnect = false) {
  socket.emit(
    "joinGame",
    {
      name: profile.name,
      roomId: profile.roomId,
      color: profile.color
    },
    result => {
      joinButton.disabled = false;

      if (!result || !result.ok) {
        if (!isReconnect) {
          menuError.textContent = result?.error || "Gagal bergabung.";
        }
        return;
      }

      myId = result.playerId;
      joined = true;
      selectedColor = sanitizePlayerColor(result.color, profile.color);
      sessionProfile.color = selectedColor;
      sessionProfile.roomId = result.roomId;
      syncColorPickerUI(selectedColor);

      menu.classList.add("hidden");
      hud.classList.remove("hidden");
      restartButton.classList.remove("hidden");

      if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
        touchControls.classList.remove("hidden");
      }

      showToast(
        isReconnect
          ? "Terhubung kembali ke room " + result.roomId
          : "Berhasil bergabung ke room " + result.roomId
      );
    }
  );
}

joinButton.addEventListener("click", () => {
  if (!socket.connected) {
    menuError.textContent = "Menghubungkan ke server...";
    return;
  }

  const activeButton = document.querySelector(".color-option.selected");
  if (activeButton && activeButton.dataset.color) {
    selectedColor = sanitizePlayerColor(activeButton.dataset.color);
  }

  sessionProfile.name = playerNameInput.value.trim() || "Pemain";
  sessionProfile.roomId = roomNameInput.value.trim() || "KUCING";
  sessionProfile.color = selectedColor;

  joinButton.disabled = true;
  menuError.textContent = "";

  performJoin(sessionProfile, false);
});

socket.on("connect", () => {
  if (!joined) {
    menuError.textContent = "";
  } else {
    // Jika sebelumnya sudah berada di dalam game lalu reconnect,
    // kirim ulang identitas dan warna pilihan pemain ke server.
    performJoin(sessionProfile, true);
  }
});

socket.on("disconnect", () => {
  if (joined) {
    showToast("Koneksi terputus. Mencoba menghubungkan kembali...");
  }
});

socket.on("connect_error", () => {
  menuError.textContent = "Server tidak dapat dihubungi.";
});

function spawnSwitchParticles(sw, activated) {
  if (!sw) return;

  const count = activated ? 10 : 5;
  const baseY = sw.y + (activated ? sw.pressDepth || 6 : 2);

  for (let i = 0; i < count; i++) {
    const ratio = count > 1 ? i / (count - 1) : 0.5;
    const angle = -Math.PI * (0.15 + ratio * 0.7);
    const speed = activated ? 38 + (i % 3) * 18 : 22 + (i % 2) * 12;

    switchVisual.particles.push({
      x: sw.x + 6 + ratio * (sw.w - 12),
      y: baseY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (activated ? 12 : 4),
      radius: activated ? 2.4 + (i % 2) * 0.8 : 1.8,
      alpha: 1,
      color: activated
        ? i % 2 === 0
          ? "#63f5d2"
          : "#ffe0eb"
        : "#ff8da3"
    });
  }

  if (switchVisual.particles.length > 24) {
    switchVisual.particles.splice(0, switchVisual.particles.length - 24);
  }
}

socket.on("state", state => {
  const prevRoomId = gameState?.roomId;
  gameState = state;

  roomLabel.textContent = state.roomId;
  playerCount.textContent = state.players.length;
  keyStatus.textContent = state.level.keyCollected
    ? "Kunci didapat"
    : "Kunci belum didapat";

  showToast(state.level.message);

  // Trigger feedback visual sakelar HANYA saat server mengonfirmasi transisi state
  const seq =
    typeof state.level.switchTransitionSeq === "number"
      ? state.level.switchTransitionSeq
      : 0;

  if (
    switchVisual.lastTransitionSeq === null ||
    prevRoomId !== state.roomId
  ) {
    switchVisual.lastTransitionSeq = seq;
    switchVisual.press =
      typeof state.level.switchPress === "number"
        ? state.level.switchPress
        : state.level.switchPressed
        ? 1
        : 0;
    switchVisual.glow = switchVisual.press;
    gateVisual.openProgress =
      typeof state.level.gateProgress === "number"
        ? state.level.gateProgress
        : state.level.gateOpen
        ? 1
        : 0;
  } else if (seq !== switchVisual.lastTransitionSeq) {
    switchVisual.lastTransitionSeq = seq;
    switchVisual.squashVelocity = state.level.switchPressed ? 7.5 : -5.0;
    spawnSwitchParticles(state.geometry?.switch, state.level.switchPressed);
  }

  const activeIds = new Set();

  for (const p of state.players) {
    activeIds.add(p.id);
    const validatedColor = sanitizePlayerColor(p.color);

    if (!renderPlayers.has(p.id)) {
      renderPlayers.set(p.id, {
        x: p.x,
        y: p.y,
        targetX: p.x,
        targetY: p.y,
        color: validatedColor,
        data: { ...p, color: validatedColor }
      });
    } else {
      const r = renderPlayers.get(p.id);
      r.targetX = p.x;
      r.targetY = p.y;
      r.color = validatedColor;
      r.data = { ...p, color: validatedColor };
    }
  }

  for (const id of renderPlayers.keys()) {
    if (!activeIds.has(id)) renderPlayers.delete(id);
  }

  if (state.level.cleared) {
    showToast("🏆 Level selesai! Kerja sama yang hebat!");
  }
});

restartButton.addEventListener("click", () => {
  socket.emit("restartLevel");
});

// ============================================================
// Input keyboard & sentuh
// ============================================================

function setKey(code, down) {
  if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
  if (code === "ArrowRight" || code === "KeyD") keys.right = down;
  if (code === "ArrowUp" || code === "Space" || code === "KeyW") {
    keys.jump = down;
  }
}

window.addEventListener("keydown", event => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.repeat && event.code === "Space") return;
  setKey(event.code, true);
});

window.addEventListener("keyup", event => {
  setKey(event.code, false);
});

window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
  keys.jump = false;
});

document.querySelectorAll("[data-action]").forEach(button => {
  const action = button.dataset.action;

  const press = event => {
    event.preventDefault();
    keys[action] = true;
    try {
      button.setPointerCapture(event.pointerId);
    } catch (_) {}
  };

  const release = event => {
    event.preventDefault();
    keys[action] = false;
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => {
    keys[action] = false;
  });
});

function sendInput(now) {
  if (!joined || !socket.connected || now - lastInputSent < 1000 / 30) {
    return;
  }

  lastInputSent = now;
  socket.emit("input", {
    left: keys.left,
    right: keys.right,
    jump: keys.jump
  });
}

// ============================================================
// Utilitas gambar
// ============================================================

function roundedRect(x, y, w, h, r) {
  const safeW = Math.max(0.1, w);
  const safeH = Math.max(0.1, h);
  const radius = Math.min(r, safeW / 2, safeH / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + safeW, y, x + safeW, y + safeH, radius);
  ctx.arcTo(x + safeW, y + safeH, x, y + safeH, radius);
  ctx.arcTo(x, y + safeH, x, y, radius);
  ctx.arcTo(x, y, x + safeW, y, radius);
  ctx.closePath();
}

function updateVisualEffects(dt) {
  if (!gameState) return;

  const serverPress =
    typeof gameState.level.switchPress === "number"
      ? gameState.level.switchPress
      : gameState.level.switchPressed
      ? 1
      : 0;

  const serverGate =
    typeof gameState.level.gateProgress === "number"
      ? gameState.level.gateProgress
      : gameState.level.gateOpen
      ? 1
      : 0;

  // Interpolasi mengikuti nilai otoritatif server
  const smoothFactor = Math.min(1, dt * 22);
  switchVisual.press += (serverPress - switchVisual.press) * smoothFactor;
  switchVisual.glow +=
    ((gameState.level.switchPressed ? 1 : 0) - switchVisual.glow) *
    Math.min(1, dt * 14);
  gateVisual.openProgress +=
    (serverGate - gateVisual.openProgress) * Math.min(1, dt * 18);

  // Simulasi pegas kecil untuk efek pantulan mekanis saat sakelar ditekan/dilepas
  const springStiffness = 180;
  const springDamping = 14;
  switchVisual.squashVelocity +=
    (-springStiffness * switchVisual.squash -
      springDamping * switchVisual.squashVelocity) *
    dt;
  switchVisual.squash += switchVisual.squashVelocity * dt;
  switchVisual.squash = Math.max(-0.35, Math.min(0.45, switchVisual.squash));

  // Update partikel sakelar
  for (let i = switchVisual.particles.length - 1; i >= 0; i--) {
    const pt = switchVisual.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 90 * dt;
    pt.alpha -= dt * 2.4;

    if (pt.alpha <= 0) {
      switchVisual.particles.splice(i, 1);
    }
  }
}

function drawBackground(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1c2040");
  gradient.addColorStop(1, "#303455");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = (((i * 137.5 - camera.x * 0.12) % width) + width) % width;
    const y = (i * 83.7) % Math.max(height, 1);

    ctx.globalAlpha = 0.2 + (i % 5) * 0.12;
    ctx.fillStyle = i % 4 === 0 ? "#c4bcff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 1.8 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(13, 16, 37, 0.25)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.72);

  for (let x = 0; x <= width + 30; x += 30) {
    const y =
      height * 0.68 +
      Math.sin(x * 0.014) * 24 +
      Math.sin(x * 0.035) * 11;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

function drawPlatform(p) {
  ctx.fillStyle = "rgba(4, 6, 18, 0.32)";
  roundedRect(p.x + 4, p.y + 7, p.w, p.h, 8);
  ctx.fill();

  const gradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  gradient.addColorStop(0, "#7376a8");
  gradient.addColorStop(0.16, "#4b4f7c");
  gradient.addColorStop(1, "#2b2f52");

  ctx.fillStyle = gradient;
  roundedRect(p.x, p.y, p.w, p.h, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(209, 213, 255, 0.36)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x + 8, p.y + 1);
  ctx.lineTo(p.x + p.w - 8, p.y + 1);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.045)";
  for (let x = p.x + 14; x < p.x + p.w - 8; x += 25) {
    ctx.fillRect(x, p.y + 8, 3, Math.max(2, p.h - 14));
  }
}

function drawSwitch(sw, levelState, time) {
  const pressed = Boolean(levelState.switchPressed);
  const pressDepth = sw.pressDepth || 6;
  const pressRatio = Math.max(0, Math.min(1, switchVisual.press));
  const glowRatio = Math.max(0, Math.min(1, switchVisual.glow));

  // Kompresi permukaan tombol sesuai konfirmasi fisika server + sedikit efek pegas
  const pressOffset = pressRatio * pressDepth;
  const bounceSquash = switchVisual.squash * 2.2;
  const capW = sw.w + bounceSquash * 1.4;
  const capX = sw.x - (capW - sw.w) / 2;
  const baseHeight = 10;
  const baseY = sw.y + sw.h - baseHeight;
  const capY = Math.min(baseY - 6, sw.y + pressOffset + bounceSquash * 0.45);
  const capH = Math.max(8, baseY - capY + 2);

  // Bayangan bawah sakelar
  ctx.fillStyle = "rgba(4, 6, 18, 0.32)";
  roundedRect(sw.x - 6, sw.y + 5, sw.w + 12, sw.h, 8);
  ctx.fill();

  // Pendaran cahaya lembut ketika sakelar aktif
  if (glowRatio > 0.02) {
    ctx.save();
    ctx.globalAlpha = glowRatio * 0.42;
    const aura = ctx.createRadialGradient(
      sw.x + sw.w / 2,
      capY + 6,
      4,
      sw.x + sw.w / 2,
      capY + 6,
      42
    );
    aura.addColorStop(0, "rgba(99, 245, 210, 0.85)");
    aura.addColorStop(1, "rgba(99, 245, 210, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(sw.x + sw.w / 2, capY + 6, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Badan tombol mekanis (plunger) yang bergerak turun saat diinjak
  ctx.save();
  if (pressed) {
    ctx.shadowColor = "rgba(99, 245, 210, 0.55)";
    ctx.shadowBlur = 12;
  }

  const capGrad = ctx.createLinearGradient(capX, capY, capX, capY + capH);
  if (pressed) {
    capGrad.addColorStop(0, "#6ef2cf");
    capGrad.addColorStop(0.55, "#34c7a0");
    capGrad.addColorStop(1, "#1e7e6c");
  } else {
    capGrad.addColorStop(0, "#ff637b");
    capGrad.addColorStop(0.6, "#e03559");
    capGrad.addColorStop(1, "#a6193b");
  }

  ctx.fillStyle = capGrad;
  roundedRect(capX, capY, capW, capH, 7);
  ctx.fill();
  ctx.restore();

  // Strip highlight permukaan injak di bagian atas tombol
  ctx.fillStyle = pressed ? "#dcfff5" : "#ffc2cd";
  roundedRect(capX + 6, capY + 3, capW - 12, 4.5, 2.5);
  ctx.fill();

  // Alas mekanis tetap (base housing) di lantai
  const baseGrad = ctx.createLinearGradient(
    sw.x - 5,
    baseY,
    sw.x - 5,
    baseY + baseHeight
  );
  baseGrad.addColorStop(0, "#3b4068");
  baseGrad.addColorStop(1, "#1e223d");

  ctx.fillStyle = baseGrad;
  roundedRect(sw.x - 5, baseY, sw.w + 10, baseHeight, 5);
  ctx.fill();

  // Lampu indikator status pada alas sakelar
  ctx.fillStyle = pressed ? "#63f5d2" : "#ff536b";
  roundedRect(sw.x + sw.w / 2 - 10, baseY + 3.5, 20, 3, 1.5);
  ctx.fill();

  // Indikator ikon di atas sakelar
  const floatOffset = pressed ? 0 : Math.sin(time * 0.005) * 2;
  ctx.fillStyle = pressed ? "#9fffe6" : "#ffe6eb";
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    pressed ? "ON" : "!",
    sw.x + sw.w / 2,
    capY - 8 + floatOffset
  );

  // Partikel efek injak/lepas
  for (const pt of switchVisual.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.alpha);
    ctx.fillStyle = pt.color;
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGate(gate, levelState) {
  const openProgress = Math.max(0, Math.min(1, gateVisual.openProgress));

  // Kerangka slot energi gerbang agar pemain selalu memahami posisi gerbang
  ctx.save();
  ctx.strokeStyle =
    openProgress > 0.5
      ? "rgba(111, 240, 209, 0.55)"
      : "rgba(241, 123, 145, 0.32)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 8]);
  if (openProgress > 0.5) {
    ctx.shadowColor = "#5ce7d0";
    ctx.shadowBlur = 14;
  }
  ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
  ctx.restore();

  // Daun gerbang bergerak naik secara halus saat terbuka
  const closedRatio = 1 - openProgress;
  if (closedRatio <= 0.02) {
    return;
  }

  const currentH = Math.max(8, gate.h * closedRatio);
  const grad = ctx.createLinearGradient(gate.x, 0, gate.x + gate.w, 0);
  grad.addColorStop(0, "#f17b91");
  grad.addColorStop(0.5, "#a83b66");
  grad.addColorStop(1, "#682d5c");

  ctx.save();
  ctx.shadowColor = "rgba(255, 72, 126, 0.3)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = grad;
  roundedRect(gate.x, gate.y, gate.w, currentH, 6);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,225,236,0.48)";
  ctx.lineWidth = 2;

  for (let y = gate.y + 12; y < gate.y + currentH - 6; y += 24) {
    ctx.beginPath();
    ctx.moveTo(gate.x + 6, y);
    ctx.lineTo(gate.x + gate.w - 6, y);
    ctx.stroke();
  }
}

function drawKey(key, time) {
  ctx.save();
  ctx.translate(key.x + key.w / 2, key.y + key.h / 2);
  ctx.rotate(Math.sin(time * 0.002) * 0.12);
  ctx.translate(-key.w / 2, -key.h / 2);

  ctx.shadowColor = "#ffdc67";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#ffda66";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(key.w / 2, 10, 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(key.w / 2 + 7, 15);
  ctx.lineTo(key.w / 2 + 7, 29);
  ctx.lineTo(key.w / 2 + 1, 29);
  ctx.moveTo(key.w / 2 + 7, 23);
  ctx.lineTo(key.w / 2 + 13, 23);
  ctx.stroke();

  ctx.restore();
}

function drawGoal(goal, open, time) {
  ctx.save();

  const pulse = 0.5 + Math.sin(time * 0.004) * 0.12;
  ctx.globalAlpha = open ? 0.75 + pulse * 0.25 : 0.6;

  ctx.fillStyle = open ? "#63e7c1" : "#777caa";
  ctx.shadowColor = open ? "#63e7c1" : "#777caa";
  ctx.shadowBlur = open ? 24 : 10;
  roundedRect(goal.x, goal.y, goal.w, goal.h, 12);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  roundedRect(goal.x + 7, goal.y + 7, goal.w - 14, goal.h - 14, 8);
  ctx.stroke();

  ctx.fillStyle = "#19203c";
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    open ? "EXIT" : "LOCKED",
    goal.x + goal.w / 2,
    goal.y + goal.h / 2 + 4
  );

  ctx.restore();
}

// ============================================================
// Karakter kucing
// ============================================================

function drawPlayer(p, time) {
  const local = p.id === myId;

  // Warna setiap karakter wajib dibaca dari properti individual p.color
  // yang berasal dari snapshot server, bukan dari variabel lokal selectedColor.
  const color = sanitizePlayerColor(p.color);
  const x = p.x;
  const y = p.y;
  const w = p.w;
  const h = p.h;

  ctx.save();
  ctx.globalAlpha = p.onGround ? 0.3 : 0.16;
  ctx.fillStyle = "#080a1b";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 3, w * 0.55, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const moving = Math.abs(p.vx || 0) > 5;
  const bob = p.onGround && moving ? Math.sin(time * 0.02) * 1.4 : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + bob);
  ctx.scale(1, p.onGround ? 1 : 1.035);
  ctx.translate(-w / 2, -h / 2);

  // Ekor kucing
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w / 2, h - 9);
  ctx.quadraticCurveTo(
    w / 2 - (p.facing || 1) * 12,
    h - 14,
    w / 2 - (p.facing || 1) * 9,
    h - 20
  );
  ctx.stroke();

  // Badan dengan gradasi warna individual pemain
  const bodyGradient = ctx.createLinearGradient(0, 0, w, h);
  bodyGradient.addColorStop(0, lightenColor(color, 30));
  bodyGradient.addColorStop(1, color);

  ctx.fillStyle = bodyGradient;
  ctx.shadowColor = color;
  ctx.shadowBlur = local ? 13 : 6;
  roundedRect(1, 8, w - 2, h - 8, 11);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Telinga luar
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(2, 15);
  ctx.lineTo(4, 1);
  ctx.lineTo(14, 11);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w - 2, 15);
  ctx.lineTo(w - 4, 1);
  ctx.lineTo(w - 14, 11);
  ctx.closePath();
  ctx.fill();

  // Telinga dalam
  ctx.fillStyle = "rgba(255, 213, 226, 0.85)";
  ctx.beginPath();
  ctx.moveTo(5, 10);
  ctx.lineTo(6, 5);
  ctx.lineTo(11, 11);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w - 5, 10);
  ctx.lineTo(w - 6, 5);
  ctx.lineTo(w - 11, 11);
  ctx.closePath();
  ctx.fill();

  // Mata
  const face = p.facing || 1;
  const eyeY = 22;
  const eyeX1 = face > 0 ? 11 : 9;
  const eyeX2 = face > 0 ? 21 : 19;
  const blinkPhase = (time / 1000 + (p.blinkSeed || 0)) % 4.2;
  const blinking = blinkPhase > 4.0;

  ctx.fillStyle = "#202039";

  if (blinking) {
    ctx.strokeStyle = "#202039";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(eyeX1 - 2, eyeY);
    ctx.lineTo(eyeX1 + 3, eyeY);
    ctx.moveTo(eyeX2 - 2, eyeY);
    ctx.lineTo(eyeX2 + 3, eyeY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(eyeX1, eyeY, 2.3, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeX2, eyeY, 2.3, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hidung dan mulut
  ctx.fillStyle = "#ff8ca5";
  ctx.beginPath();
  ctx.arc(w / 2, 27, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#402b4b";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(w / 2, 28);
  ctx.quadraticCurveTo(w / 2 - 3, 32, w / 2 - 5, 29);
  ctx.moveTo(w / 2, 28);
  ctx.quadraticCurveTo(w / 2 + 3, 32, w / 2 + 5, 29);
  ctx.stroke();

  ctx.restore();

  // Label nama pemain
  ctx.save();
  ctx.font = "600 11px system-ui";
  ctx.textAlign = "center";

  const label = p.name + (local ? " (Kamu)" : "");
  const labelWidth = ctx.measureText(label).width + 16;
  const labelX = x + w / 2 - labelWidth / 2;
  const labelY = y - 24;

  ctx.fillStyle = "rgba(16, 18, 39, 0.82)";
  roundedRect(labelX, labelY, labelWidth, 19, 7);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + w / 2, labelY + 13);
  ctx.restore();
}

function lightenColor(hex, amount) {
  const safeHex = sanitizePlayerColor(hex).replace("#", "");
  const num = parseInt(safeHex, 16);
  const r = Math.min(255, ((num >> 16) & 255) + amount);
  const g = Math.min(255, ((num >> 8) & 255) + amount);
  const b = Math.min(255, (num & 255) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================
// Kamera dan render scene
// ============================================================

function updateCamera(localPlayer, viewWidth, viewHeight, world) {
  if (!localPlayer) return;

  const maxX = Math.max(0, world.width - viewWidth);
  const maxY = Math.max(0, world.height - viewHeight);

  const targetX = localPlayer.x + localPlayer.w / 2 - viewWidth / 2;
  const targetY = localPlayer.y + localPlayer.h / 2 - viewHeight / 2;

  camera.x += (Math.max(0, Math.min(maxX, targetX)) - camera.x) * 0.1;
  camera.y += (Math.max(0, Math.min(maxY, targetY)) - camera.y) * 0.1;
}

function render(time) {
  const dt = Math.min(Math.max((time - lastRenderTime) / 1000, 0.001), 0.05);
  lastRenderTime = time;

  const rect = canvas.getBoundingClientRect();
  const viewWidth = rect.width;
  const viewHeight = rect.height;

  ctx.clearRect(0, 0, viewWidth, viewHeight);

  const world = gameState?.geometry;
  drawBackground(
    viewWidth,
    viewHeight,
    world?.width || 1400,
    world?.height || 760
  );

  if (!gameState || !world) {
    requestAnimationFrame(render);
    return;
  }

  updateVisualEffects(dt);

  const localPlayer = gameState.players.find(p => p.id === myId);
  updateCamera(localPlayer, viewWidth, viewHeight, world);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  for (const p of world.platforms) {
    drawPlatform(p);
  }

  drawSwitch(world.switch, gameState.level, time);
  drawGate(world.gate, gameState.level);
  drawGoal(world.goal, gameState.level.keyCollected, time);

  if (!gameState.level.keyCollected) {
    drawKey(world.key, time);
  }

  for (const p of gameState.players) {
    const r = renderPlayers.get(p.id);
    if (!r) continue;

    if (p.id !== myId) {
      r.x += (r.targetX - r.x) * 0.35;
      r.y += (r.targetY - r.y) * 0.35;
    } else {
      r.x = p.x;
      r.y = p.y;
    }

    drawPlayer(
      {
        ...p,
        color: r.color,
        x: r.x,
        y: r.y
      },
      time
    );
  }

  ctx.restore();

  if (gameState.level.cleared) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 15, 31, 0.55)";
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px system-ui";
    ctx.fillText("LEVEL CLEARED!", viewWidth / 2, viewHeight / 2 - 8);

    ctx.fillStyle = "#c6c9e6";
    ctx.font = "14px system-ui";
    ctx.fillText(
      "Semua kucing berhasil bekerja sama.",
      viewWidth / 2,
      viewHeight / 2 + 23
    );
    ctx.restore();
  }

  requestAnimationFrame(render);
}

// ============================================================
// Main loop: input dan rendering
// ============================================================

function frame(now) {
  const delta = Math.min((now - previousFrame) / 1000, 0.05);
  previousFrame = now;
  accumulator += delta;

  sendInput(now);

  requestAnimationFrame(frame);
}

requestAnimationFrame(render);
requestAnimationFrame(frame);