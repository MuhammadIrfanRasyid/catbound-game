/**
 * ============================================================================
 * CATBOUND — MIDNIGHT CYBERPUNK CO-OP MULTIPLAYER BACKEND (server.js)
 * Stack      : Node.js + Express + Socket.IO (CommonJS / require)
 * Network    : Bind ke '0.0.0.0' pada PORT 3000 (Akses langsung via Wi-Fi HP)
 * ============================================================================
 */

"use strict";

const express = require("express");
const httpModule = require("http");
const { Server } = require("socket.io");
const path = require("path");
const os = require("os");

const app = express();
const http = httpModule.createServer(app);
const io = new Server(http, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000
});

// Konfigurasi jaringan & detak simulasi fisika 60 FPS
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

// Dimensi dasar dunia & parameter fisika karakter (sinkron dengan Canvas 800x450)
const BASE_VIEW_W = 800;
const WORLD_H = 450;
const GRAVITY = 1150;
const MOVE_SPEED = 208;
const JUMP_SPEED = 448;
const DEATH_DELAY_MS = 2000;

// Sajikan file statis dari folder 'public' tanpa cache agar browser HP selalu mutakhir
app.use(
  express.static(path.join(__dirname, "public"), {
    etag: false,
    lastModified: false,
    setHeaders: res => {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
    }
  })
);

// Palet warna resmi unit kucing Midnight Cyberpunk (sinkron dengan public/index.html)
const CYBER_COLORS = [
  "#22d3ee", // Cyan
  "#facc15", // Kuning
  "#ef4444", // Merah
  "#f8fafc", // Putih
  "#f472b6", // Pink
  "#84cc16", // Hijau Lime
  "#38bdf8", // Biru Muda
  "#cbd5e1"  // Silver
];

// ============================================================================
// BLUEPRINT 20 LEVEL MODULAR (TEMA 1 S/D TEMA 5 — SINKRON DENGAN FRONTEND)
// ============================================================================
const LEVELS = [
  // --------------------------------------------------------------------------
  // TEMA 1: CYBER INITIATION (Level 1-1 s/d 1-4)
  // --------------------------------------------------------------------------
  {
    code: "1-1",
    theme: "Tema 1: Cyber Initiation",
    title: "Stacking Protocol",
    width: 2150,
    spawn: { x: 48, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 300, h: 40 },
      { x: 380, y: 410, w: 380, h: 40 },
      { x: 480, y: 350, w: 140, h: 18 },
      { x: 845, y: 410, w: 560, h: 40 },
      { x: 1030, y: 306, w: 190, h: 20 },
      { x: 1296, y: 0, w: 28, h: 270 },
      { x: 1490, y: 410, w: 660, h: 40 },
      { x: 1690, y: 306, w: 195, h: 20 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2134, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [
      { id: "b1", x: 890, y: 372, w: 38, h: 38, minPushers: 1 },
      { id: "b2", x: 1540, y: 372, w: 38, h: 38, minPushers: 2 }
    ],
    switches: [
      { id: "sw1", x: 1105, y: 288, w: 44, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1298, y: 270, w: 24, h: 140 }],
    key: { x: 1775, y: 264, w: 22, h: 28 },
    goal: { x: 2035, y: 344, w: 58, h: 66 }
  },
  {
    code: "1-2",
    theme: "Tema 1: Cyber Initiation",
    title: "Pressure Plate Relay",
    width: 2200,
    spawn: { x: 48, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 430, h: 40 },
      { x: 346, y: 0, w: 28, h: 270 },
      { x: 515, y: 410, w: 650, h: 40 },
      { x: 786, y: 0, w: 28, h: 270 },
      { x: 1250, y: 410, w: 950, h: 40 },
      { x: 1350, y: 350, w: 140, h: 18 },
      { x: 1540, y: 292, w: 160, h: 18 },
      { x: 1816, y: 0, w: 28, h: 270 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2184, y: 0, w: 16, h: 450 }
    ],
    switches: [
      { id: "trap1", x: 230, y: 392, w: 40, h: 18, trap: true, targetGates: ["gt1"] },
      { id: "sw1", x: 640, y: 392, w: 44, h: 18, latch: false, targetGates: ["g1"] },
      { id: "sw2", x: 910, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1"] },
      { id: "sw3", x: 1598, y: 274, w: 46, h: 18, latch: true, targetGates: ["g2"] }
    ],
    gates: [
      { id: "gt1", x: 348, y: 270, w: 24, h: 140, invert: true },
      { id: "g1", x: 788, y: 270, w: 24, h: 140 },
      { id: "g2", x: 1818, y: 270, w: 24, h: 140 }
    ],
    key: { x: 1920, y: 365, w: 22, h: 28 },
    goal: { x: 2085, y: 344, w: 58, h: 66 }
  },
  {
    code: "1-3",
    theme: "Tema 1: Cyber Initiation",
    title: "Heavy Push Fortress",
    width: 2250,
    spawn: { x: 48, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 560, h: 40 },
      { x: 560, y: 306, w: 280, h: 144 },
      { x: 925, y: 410, w: 520, h: 40 },
      { x: 1445, y: 306, w: 250, h: 144 },
      { x: 1695, y: 410, w: 555, h: 40 },
      { x: 1886, y: 0, w: 28, h: 270 },
      { x: 1960, y: 306, w: 274, h: 144 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2234, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [
      { id: "b1", x: 240, y: 346, w: 58, h: 64, minPushers: 2 },
      { id: "b2", x: 1120, y: 346, w: 58, h: 64, minPushers: 2 },
      { id: "b3", x: 1735, y: 346, w: 58, h: 64, minPushers: 2 }
    ],
    switches: [
      { id: "sw1", x: 1545, y: 288, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1888, y: 270, w: 24, h: 140 }],
    key: { x: 685, y: 262, w: 22, h: 28 },
    goal: { x: 2130, y: 240, w: 58, h: 66 }
  },
  {
    // Level 1-4: Sakelar lorong (sw2 & sw4) mengunci gerbang terbuka permanen (Toggle Latch)
    code: "1-4",
    theme: "Tema 1: Cyber Initiation",
    title: "Sequential Gates",
    width: 2300,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 880, h: 40 },
      { x: 376, y: 0, w: 278, h: 270 },
      { x: 965, y: 370, w: 155, h: 80 },
      { x: 1205, y: 340, w: 155, h: 110 },
      { x: 1445, y: 410, w: 855, h: 40 },
      { x: 1616, y: 0, w: 278, h: 270 },
      { x: 1965, y: 350, w: 140, h: 18 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2284, y: 0, w: 16, h: 450 }
    ],
    switches: [
      { id: "sw1", x: 255, y: 392, w: 44, h: 18, latch: false, targetGates: ["g1"] },
      { id: "sw2", x: 495, y: 392, w: 48, h: 18, latch: true, targetGates: ["g1", "g2"] },
      { id: "sw3", x: 1505, y: 392, w: 44, h: 18, latch: false, targetGates: ["g3"] },
      { id: "sw4", x: 1735, y: 392, w: 48, h: 18, latch: true, targetGates: ["g3", "g4"] }
    ],
    gates: [
      { id: "g1", x: 380, y: 270, w: 24, h: 140 },
      { id: "g2", x: 626, y: 270, w: 24, h: 140 },
      { id: "g3", x: 1620, y: 270, w: 24, h: 140 },
      { id: "g4", x: 1866, y: 270, w: 24, h: 140 }
    ],
    key: { x: 2025, y: 306, w: 22, h: 28 },
    goal: { x: 2185, y: 344, w: 58, h: 66 }
  },

  // --------------------------------------------------------------------------
  // TEMA 2: LASER SHIELD (Level 2-1 s/d 2-4)
  // Ganjil = Tameng Horizontal (Atas Kepala), Genap = Tameng Vertikal (Depan Badan)
  // --------------------------------------------------------------------------
  {
    code: "2-1",
    theme: "Tema 2: Laser Shield",
    title: "Sky Laser Barrage",
    width: 2200,
    laserShieldMode: true,
    spawn: { x: 48, y: 350 },
    platforms: [
      { x: 0, y: 0, w: 2200, h: 24 },
      { x: 0, y: 410, w: 680, h: 40 },
      { x: 760, y: 375, w: 180, h: 75 },
      { x: 1020, y: 410, w: 560, h: 40 },
      { x: 1230, y: 306, w: 220, h: 20 },
      { x: 1665, y: 410, w: 535, h: 40 },
      { x: 1886, y: 24, w: 28, h: 246 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2184, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [{ id: "b1", x: 1060, y: 372, w: 38, h: 38, minPushers: 1 }],
    lasers: [
      { id: "l1", x: 310, y: 24, dir: "down", maxLen: 390 },
      { id: "l2", x: 375, y: 24, dir: "down", maxLen: 390 },
      { id: "l3", x: 440, y: 24, dir: "down", maxLen: 390 },
      { id: "l4", x: 505, y: 24, dir: "down", maxLen: 390 },
      { id: "l5", x: 850, y: 24, dir: "down", maxLen: 355 },
      { id: "l6", x: 1300, y: 24, dir: "down", maxLen: 285 },
      { id: "l7", x: 1385, y: 24, dir: "down", maxLen: 285 },
      { id: "l8", x: 1730, y: 24, dir: "down", maxLen: 390 },
      { id: "l9", x: 1795, y: 24, dir: "down", maxLen: 390 }
    ],
    laserTurrets: [
      { id: "t1", x: 605, y: 28, vx: 0, vy: 210, interval: 1.45, phase: 0 },
      { id: "t2", x: 1525, y: 28, vx: 0, vy: 215, interval: 1.4, phase: 0.5 }
    ],
    switches: [
      { id: "sw1", x: 1825, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1888, y: 270, w: 24, h: 140 }],
    key: { x: 1335, y: 262, w: 22, h: 28 },
    goal: { x: 2085, y: 344, w: 58, h: 66 }
  },
  {
    code: "2-2",
    theme: "Tema 2: Laser Shield",
    title: "Front Laser Phalanx",
    width: 2250,
    laserShieldMode: true,
    spawn: { x: 48, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 720, h: 40 },
      { x: 720, y: 352, w: 90, h: 98 },
      { x: 890, y: 410, w: 690, h: 40 },
      { x: 1580, y: 346, w: 90, h: 104 },
      { x: 1670, y: 410, w: 580, h: 40 },
      { x: 1936, y: 0, w: 28, h: 270 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2234, y: 0, w: 16, h: 450 }
    ],
    lasers: [
      { id: "fl1", x: 720, y: 392, dir: "left", maxLen: 560 },
      { id: "fl2", x: 1580, y: 392, dir: "left", maxLen: 660 },
      { id: "fl3", x: 1580, y: 362, dir: "left", maxLen: 660, minPlayers: 4 }
    ],
    laserTurrets: [
      { id: "ft1", x: 2180, y: 388, vx: -220, vy: 0, interval: 1.7, phase: 0.2 }
    ],
    switches: [
      { id: "sw1", x: 1845, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1938, y: 270, w: 24, h: 140 }],
    key: { x: 1614, y: 302, w: 22, h: 28 },
    goal: { x: 2130, y: 344, w: 58, h: 66 }
  },
  {
    code: "2-3",
    theme: "Tema 2: Laser Shield",
    title: "Crossfire Tank Formation",
    width: 2300,
    laserShieldMode: true,
    spawn: { x: 170, y: 350 },
    platforms: [
      { x: 0, y: 0, w: 2300, h: 24 },
      { x: 0, y: 24, w: 55, h: 426 },
      { x: 55, y: 410, w: 745, h: 40 },
      { x: 800, y: 352, w: 90, h: 98 },
      { x: 970, y: 385, w: 185, h: 65 },
      { x: 1235, y: 360, w: 185, h: 90 },
      { x: 1500, y: 410, w: 800, h: 40 },
      { x: 1966, y: 24, w: 28, h: 246 },
      { x: 2284, y: 0, w: 16, h: 450 }
    ],
    lasers: [
      { id: "cf_front", x: 800, y: 392, dir: "left", maxLen: 680 },
      { id: "cf_back", x: 55, y: 392, dir: "right", maxLen: 680, minPlayers: 4 },
      { id: "cf_sky1", x: 420, y: 24, dir: "down", maxLen: 386 },
      { id: "cf_sky2", x: 500, y: 24, dir: "down", maxLen: 386 },
      { id: "cf_sky3", x: 580, y: 24, dir: "down", maxLen: 386 },
      { id: "cv1", x: 1060, y: 24, dir: "down", maxLen: 365 },
      { id: "cv2", x: 1325, y: 24, dir: "down", maxLen: 340 },
      { id: "cv3", x: 1690, y: 24, dir: "down", maxLen: 386 },
      { id: "cf_end", x: 1966, y: 392, dir: "left", maxLen: 440 }
    ],
    laserTurrets: [
      { id: "ct1", x: 1195, y: 28, vx: 0, vy: 215, interval: 1.45, phase: 0.4 }
    ],
    switches: [
      { id: "sw1", x: 1885, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1968, y: 270, w: 24, h: 140 }],
    key: { x: 1316, y: 315, w: 22, h: 28 },
    goal: { x: 2180, y: 344, w: 58, h: 66 }
  },
  {
    // Level 2-4: Jalur lantai Push Block (x: 920 s/d 1820) bersih 100%, sakelar di balkon atas
    code: "2-4",
    theme: "Tema 2: Laser Shield",
    title: "Laser Fortress Labyrinth",
    width: 2400,
    laserShieldMode: true,
    spawn: { x: 48, y: 350 },
    platforms: [
      { x: 0, y: 0, w: 2400, h: 24 },
      { x: 0, y: 410, w: 840, h: 40 },
      { x: 215, y: 355, w: 95, h: 18 },
      { x: 340, y: 295, w: 380, h: 20 },
      { x: 840, y: 352, w: 80, h: 98 },
      { x: 920, y: 410, w: 900, h: 40 },
      { x: 1140, y: 300, w: 115, h: 18 },
      { x: 1380, y: 300, w: 120, h: 18 },
      { x: 1308, y: 24, w: 28, h: 246 },
      { x: 1558, y: 24, w: 28, h: 246 },
      { x: 1820, y: 306, w: 580, h: 144 },
      { x: 1900, y: 235, w: 115, h: 18 },
      { x: 2086, y: 24, w: 28, h: 142 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2384, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [
      { id: "b1", x: 980, y: 346, w: 58, h: 64, minPushers: 2 }
    ],
    lasers: [
      { id: "ll1", x: 165, y: 24, dir: "down", maxLen: 386 },
      { id: "ll2", x: 840, y: 392, dir: "left", maxLen: 490 },
      { id: "ll3", x: 1095, y: 24, dir: "down", maxLen: 386 },
      { id: "ll4", x: 1525, y: 24, dir: "down", maxLen: 386 },
      { id: "ll5", x: 1690, y: 24, dir: "down", maxLen: 386 },
      { id: "ll6", x: 2086, y: 288, dir: "left", maxLen: 260 }
    ],
    laserTurrets: [
      { id: "lt1", x: 710, y: 268, vx: -205, vy: 0, interval: 1.6, phase: 0 },
      { id: "lt2", x: 2190, y: 28, vx: 0, vy: 215, interval: 1.45, phase: 0.5 }
    ],
    switches: [
      { id: "sw1", x: 1175, y: 282, w: 44, h: 18, latch: false, targetGates: ["g1"] },
      { id: "sw2", x: 1416, y: 282, w: 48, h: 18, latch: true, targetGates: ["g1", "g2"] },
      { id: "sw3", x: 1934, y: 217, w: 46, h: 18, latch: true, targetGates: ["g3"] }
    ],
    gates: [
      { id: "g1", x: 1310, y: 270, w: 24, h: 140 },
      { id: "g2", x: 1560, y: 270, w: 24, h: 140 },
      { id: "g3", x: 2088, y: 166, w: 24, h: 140 }
    ],
    key: { x: 515, y: 252, w: 22, h: 28 },
    goal: { x: 2285, y: 240, w: 58, h: 66 }
  },

  // --------------------------------------------------------------------------
  // TEMA 3: OVERCLOCK TIME LIMIT & JEMBATAN RUNTUH PERMANEN (Level 3-1 s/d 3-4)
  // --------------------------------------------------------------------------
  {
    code: "3-1",
    theme: "Tema 3: Overclock Time Limit",
    title: "Pure Speed Marathon",
    width: 2250,
    timeLimit: 22,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 280, h: 40 },
      { x: 360, y: 370, w: 165, h: 80 },
      { x: 605, y: 330, w: 165, h: 120 },
      { x: 850, y: 380, w: 330, h: 70 },
      { x: 1056, y: 0, w: 28, h: 240 },
      { x: 1455, y: 360, w: 190, h: 90 },
      { x: 1725, y: 410, w: 525, h: 40 },
      { x: 1946, y: 0, w: 28, h: 270 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2234, y: 0, w: 16, h: 450 }
    ],
    movingPlatforms: [
      { id: "mp1", x: 1275, y: 365, w: 100, h: 18, dx: 70, dy: 0, speed: 2.5 }
    ],
    switches: [
      { id: "trap1", x: 925, y: 362, w: 40, h: 18, trap: true, targetGates: ["gt1"] },
      { id: "sw1", x: 1845, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [
      { id: "gt1", x: 1058, y: 240, w: 24, h: 140, invert: true },
      { id: "g1", x: 1948, y: 270, w: 24, h: 140 }
    ],
    timeItems: [
      { id: "t1", x: 440, y: 322, bonus: 5 },
      { id: "t2", x: 685, y: 282, bonus: 10 },
      { id: "t3", x: 1320, y: 315, bonus: 5 },
      { id: "t4", x: 1550, y: 312, bonus: 10 },
      { id: "t5", x: 1785, y: 362, bonus: 5 }
    ],
    key: { x: 2015, y: 365, w: 22, h: 28 },
    goal: { x: 2135, y: 344, w: 58, h: 66 }
  },
  {
    code: "3-2",
    theme: "Tema 3: Overclock Time Limit",
    title: "Time Sacrificial Relay",
    width: 2300,
    timeLimit: 24,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 880, h: 40 },
      { x: 386, y: 0, w: 268, h: 270 },
      { x: 965, y: 365, w: 185, h: 85 },
      { x: 1235, y: 410, w: 530, h: 40 },
      { x: 1765, y: 306, w: 535, h: 144 },
      { x: 1986, y: 0, w: 28, h: 166 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2284, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [
      { id: "b1", x: 1390, y: 346, w: 58, h: 64, minPushers: 2 }
    ],
    switches: [
      { id: "sw1", x: 270, y: 392, w: 44, h: 18, latch: false, targetGates: ["g1"] },
      { id: "sw2", x: 505, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1", "g2"] },
      { id: "sw3", x: 1865, y: 288, w: 46, h: 18, latch: true, targetGates: ["g3"] }
    ],
    gates: [
      { id: "g1", x: 390, y: 270, w: 24, h: 140 },
      { id: "g2", x: 626, y: 270, w: 24, h: 140 },
      { id: "g3", x: 1988, y: 166, w: 24, h: 140 }
    ],
    timeItems: [
      { id: "t1", x: 195, y: 350, bonus: 5 },
      { id: "t2", x: 565, y: 345, bonus: 10 },
      { id: "t3", x: 1055, y: 315, bonus: 5 },
      { id: "t4", x: 1600, y: 345, bonus: 10 },
      { id: "t5", x: 1925, y: 248, bonus: 5 }
    ],
    key: { x: 2065, y: 262, w: 22, h: 28 },
    goal: { x: 2185, y: 240, w: 58, h: 66 }
  },
  {
    code: "3-3",
    theme: "Tema 3: Overclock Time Limit",
    title: "Time Crunch Combo",
    width: 2300,
    timeLimit: 25,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 580, h: 40 },
      { x: 580, y: 306, w: 300, h: 144 },
      { x: 1190, y: 410, w: 560, h: 40 },
      { x: 1386, y: 0, w: 28, h: 270 },
      { x: 1750, y: 306, w: 550, h: 144 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2284, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [
      { id: "b1", x: 240, y: 346, w: 58, h: 64, minPushers: 2 },
      { id: "b2", x: 1485, y: 346, w: 58, h: 64, minPushers: 2 }
    ],
    crumblingPlatforms: [
      { id: "cp1", x: 905, y: 335, w: 78, h: 18, delay: 1.0 },
      { id: "cp2", x: 1000, y: 360, w: 78, h: 18, delay: 1.0 },
      { id: "cp3", x: 1095, y: 385, w: 78, h: 18, delay: 1.0 }
    ],
    switches: [
      { id: "sw1", x: 720, y: 288, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1388, y: 270, w: 24, h: 140 }],
    timeItems: [
      { id: "t1", x: 410, y: 350, bonus: 10 },
      { id: "t2", x: 810, y: 255, bonus: 5 },
      { id: "t3", x: 1040, y: 310, bonus: 10 },
      { id: "t4", x: 1650, y: 345, bonus: 5 },
      { id: "t5", x: 1860, y: 255, bonus: 10 }
    ],
    key: { x: 1995, y: 262, w: 22, h: 28 },
    goal: { x: 2185, y: 240, w: 58, h: 66 }
  },
  {
    // Level 3-4: Jembatan Runtuh Permanen (hancur tepat 1.0 detik setelah diinjak & tidak pernah respawn)
    code: "3-4",
    theme: "Tema 3: Overclock Time Limit",
    title: "Crumble Bridges",
    width: 2350,
    timeLimit: 26,
    spawn: { x: 42, y: 280 },
    platforms: [
      { x: 0, y: 340, w: 190, h: 110 },
      { x: 760, y: 340, w: 330, h: 110 },
      { x: 936, y: 0, w: 28, h: 200 },
      { x: 1640, y: 325, w: 195, h: 125 },
      { x: 2145, y: 340, w: 205, h: 110 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2334, y: 0, w: 16, h: 450 }
    ],
    crumblingPlatforms: [
      { id: "cp1", x: 210, y: 340, w: 76, h: 18, delay: 1.0 },
      { id: "cp2", x: 302, y: 340, w: 76, h: 18, delay: 1.0 },
      { id: "cp3", x: 394, y: 340, w: 76, h: 18, delay: 1.0 },
      { id: "cp4", x: 486, y: 340, w: 76, h: 18, delay: 1.0 },
      { id: "cp5", x: 578, y: 340, w: 76, h: 18, delay: 1.0 },
      { id: "cp6", x: 670, y: 340, w: 74, h: 18, delay: 1.0 },
      { id: "cp7", x: 1110, y: 338, w: 76, h: 18, delay: 1.0 },
      { id: "cp8", x: 1202, y: 335, w: 76, h: 18, delay: 1.0 },
      { id: "cp9", x: 1294, y: 332, w: 76, h: 18, delay: 1.0 },
      { id: "cp10", x: 1386, y: 329, w: 76, h: 18, delay: 1.0 },
      { id: "cp11", x: 1478, y: 327, w: 76, h: 18, delay: 1.0 },
      { id: "cp12", x: 1565, y: 325, w: 62, h: 18, delay: 1.0 },
      { id: "cp13", x: 1855, y: 328, w: 78, h: 18, delay: 1.0 },
      { id: "cp14", x: 1948, y: 333, w: 78, h: 18, delay: 1.0 },
      { id: "cp15", x: 2042, y: 338, w: 85, h: 18, delay: 1.0 }
    ],
    switches: [
      { id: "sw1", x: 830, y: 322, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 938, y: 200, w: 24, h: 140 }],
    timeItems: [
      { id: "t1", x: 430, y: 292, bonus: 5 },
      { id: "t2", x: 1020, y: 292, bonus: 10 },
      { id: "t3", x: 1330, y: 280, bonus: 10 },
      { id: "t4", x: 1985, y: 282, bonus: 5 }
    ],
    key: { x: 1725, y: 282, w: 22, h: 28 },
    goal: { x: 2235, y: 274, w: 58, h: 66 }
  },

  // --------------------------------------------------------------------------
  // TEMA 4: CYBER ANOMALIES (Level 4-1 s/d 4-4)
  // --------------------------------------------------------------------------
  {
    code: "4-1",
    theme: "Tema 4: Cyber Anomalies",
    title: "Blinking Phantom Bridges",
    width: 2200,
    blinkPlatforms: true,
    spawn: { x: 45, y: 340 },
    platforms: [
      { x: 0, y: 400, w: 200, h: 50 },
      { x: 265, y: 355, w: 120, h: 18, blink: true },
      { x: 450, y: 310, w: 120, h: 18, blink: true },
      { x: 635, y: 355, w: 120, h: 18, blink: true },
      { x: 820, y: 400, w: 450, h: 50 },
      { x: 930, y: 300, w: 115, h: 18 },
      { x: 1076, y: 0, w: 28, h: 260 },
      { x: 1335, y: 355, w: 125, h: 18, blink: true },
      { x: 1525, y: 305, w: 130, h: 18, blink: true },
      { x: 1720, y: 355, w: 125, h: 18, blink: true },
      { x: 1910, y: 400, w: 290, h: 50 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2184, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [{ id: "b1", x: 855, y: 356, w: 42, h: 44, minPushers: 1 }],
    switches: [
      { id: "sw1", x: 965, y: 282, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1078, y: 260, w: 24, h: 140 }],
    key: { x: 1580, y: 260, w: 22, h: 28 },
    goal: { x: 2085, y: 334, w: 58, h: 66 }
  },
  {
    // Level 4-2: Cukup minimal 1 pemain menatap ke arah Hantu untuk membekukan speed = 0
    code: "4-2",
    theme: "Tema 4: Cyber Anomalies",
    title: "Ghost Chase Ruins",
    width: 2250,
    ghostConfig: { x: 750, y: 185, speed: 86 },
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 620, h: 40 },
      { x: 280, y: 345, w: 180, h: 18 },
      { x: 705, y: 410, w: 760, h: 40 },
      { x: 890, y: 340, w: 210, h: 18 },
      { x: 1186, y: 0, w: 28, h: 270 },
      { x: 1550, y: 410, w: 700, h: 40 },
      { x: 1730, y: 340, w: 200, h: 18 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2234, y: 0, w: 16, h: 450 }
    ],
    switches: [
      { id: "sw1", x: 970, y: 322, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1188, y: 270, w: 24, h: 140 }],
    key: { x: 1820, y: 296, w: 22, h: 28 },
    goal: { x: 2135, y: 344, w: 58, h: 66 }
  },
  {
    code: "4-3",
    theme: "Tema 4: Cyber Anomalies",
    title: "Gravity Shift Reactor",
    width: 2250,
    gravityShift: true,
    spawn: { x: 50, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 2250, h: 40 },
      { x: 0, y: 0, w: 2250, h: 36 },
      { x: 380, y: 250, w: 38, h: 160 },
      { x: 730, y: 36, w: 38, h: 170 },
      { x: 1080, y: 250, w: 38, h: 160 },
      { x: 1320, y: 215, w: 240, h: 20 },
      { x: 1710, y: 36, w: 38, h: 234 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2234, y: 0, w: 16, h: 450 }
    ],
    switches: [
      { id: "sw1", x: 1415, y: 197, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1716, y: 270, w: 24, h: 140 }],
    key: { x: 1890, y: 180, w: 22, h: 28 },
    goal: { x: 2130, y: 344, w: 58, h: 66 }
  },
  {
    code: "4-4",
    theme: "Tema 4: Cyber Anomalies",
    title: "Dark Labyrinth",
    width: 2300,
    blackout: true,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 640, h: 40 },
      { x: 270, y: 345, w: 180, h: 18 },
      { x: 725, y: 410, w: 740, h: 40 },
      { x: 890, y: 340, w: 190, h: 18 },
      { x: 1140, y: 275, w: 210, h: 18 },
      { x: 1550, y: 410, w: 750, h: 40 },
      { x: 1866, y: 0, w: 28, h: 270 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2284, y: 0, w: 16, h: 450 }
    ],
    switches: [
      { id: "l1", x: 335, y: 392, w: 44, h: 18, isLightSwitch: true },
      { id: "l2", x: 960, y: 392, w: 44, h: 18, isLightSwitch: true },
      {
        id: "l3",
        x: 1720,
        y: 392,
        w: 48,
        h: 18,
        latch: true,
        isLightSwitch: true,
        targetGates: ["g1"]
      }
    ],
    gates: [{ id: "g1", x: 1868, y: 270, w: 24, h: 140 }],
    key: { x: 1235, y: 232, w: 22, h: 28 },
    goal: { x: 2185, y: 344, w: 58, h: 66 }
  },

  // --------------------------------------------------------------------------
  // TEMA 5: ALL FOR ONE — KONSENSUS 100% 1 KARAKTER TUNGGAL (Level 5-1 s/d 5-4)
  // --------------------------------------------------------------------------
  {
    code: "5-1",
    theme: "Tema 5: All for One",
    title: "Consensus Odyssey",
    width: 2150,
    allForOne: true,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 340, h: 40 },
      { x: 425, y: 365, w: 190, h: 85 },
      { x: 700, y: 320, w: 195, h: 130 },
      { x: 980, y: 410, w: 560, h: 40 },
      { x: 1316, y: 0, w: 28, h: 270 },
      { x: 1625, y: 365, w: 525, h: 85 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2134, y: 0, w: 16, h: 450 }
    ],
    switches: [
      { id: "trap1", x: 1080, y: 392, w: 40, h: 18, trap: true, targetGates: ["gt1"] },
      { id: "sw1", x: 1210, y: 392, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [
      { id: "gt1", x: 1420, y: 270, w: 22, h: 140, invert: true },
      { id: "g1", x: 1318, y: 270, w: 24, h: 140 }
    ],
    key: { x: 785, y: 276, w: 22, h: 28 },
    goal: { x: 2035, y: 299, w: 58, h: 66 }
  },
  {
    code: "5-2",
    theme: "Tema 5: All for One",
    title: "Vertical Chink Gauntlet",
    width: 2200,
    allForOne: true,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 960, h: 40 },
      { x: 1045, y: 365, w: 260, h: 85 },
      { x: 1390, y: 410, w: 810, h: 40 },
      { x: 1926, y: 0, w: 28, h: 270 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2184, y: 0, w: 16, h: 450 }
    ],
    movingPlatforms: [
      { id: "mp1", x: 330, y: 235, w: 36, h: 115, dx: 0, dy: 60, speed: 2.7 },
      { id: "mp2", x: 590, y: 235, w: 36, h: 115, dx: 0, dy: -60, speed: 3.0 },
      { id: "mp3", x: 830, y: 235, w: 36, h: 115, dx: 0, dy: 60, speed: 2.8 },
      { id: "mp4", x: 1520, y: 235, w: 36, h: 115, dx: 0, dy: -60, speed: 3.1 },
      { id: "mp5", x: 1730, y: 235, w: 36, h: 115, dx: 0, dy: 60, speed: 3.2 }
    ],
    switches: [
      { id: "sw1", x: 1155, y: 347, w: 46, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1928, y: 270, w: 24, h: 140 }],
    key: { x: 2005, y: 365, w: 22, h: 28 },
    goal: { x: 2085, y: 344, w: 58, h: 66 }
  },
  {
    code: "5-3",
    theme: "Tema 5: All for One",
    title: "Momentum Long Jump",
    width: 2300,
    allForOne: true,
    momentumBoost: true,
    spawn: { x: 42, y: 340 },
    platforms: [
      { x: 0, y: 400, w: 295, h: 50 },
      { x: 495, y: 400, w: 315, h: 50 },
      { x: 1010, y: 385, w: 315, h: 65 },
      { x: 1525, y: 385, w: 315, h: 65 },
      { x: 2035, y: 400, w: 265, h: 50 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2284, y: 0, w: 16, h: 450 }
    ],
    boostPads: [
      { x: 175, y: 395, w: 120, h: 6 },
      { x: 690, y: 395, w: 120, h: 6 },
      { x: 1205, y: 380, w: 120, h: 6 },
      { x: 1720, y: 380, w: 120, h: 6 }
    ],
    switches: [],
    gates: [],
    key: { x: 1670, y: 338, w: 22, h: 28 },
    goal: { x: 2180, y: 334, w: 58, h: 66 }
  },
  {
    code: "5-4",
    theme: "Tema 5: All for One",
    title: "Traffic Light Finale",
    width: 2350,
    allForOne: true,
    trafficLight: true,
    spawn: { x: 45, y: 350 },
    platforms: [
      { x: 0, y: 410, w: 620, h: 40 },
      { x: 290, y: 350, w: 165, h: 18 },
      { x: 705, y: 410, w: 780, h: 40 },
      { x: 1120, y: 306, w: 280, h: 144 },
      { x: 1570, y: 410, w: 780, h: 40 },
      { x: 1926, y: 0, w: 28, h: 270 },
      { x: 0, y: 0, w: 16, h: 450 },
      { x: 2334, y: 0, w: 16, h: 450 }
    ],
    pushBlocks: [
      { id: "b1", x: 840, y: 346, w: 58, h: 64, minPushers: 2 }
    ],
    switches: [
      { id: "sw1", x: 1795, y: 392, w: 48, h: 18, latch: true, targetGates: ["g1"] }
    ],
    gates: [{ id: "g1", x: 1928, y: 270, w: 24, h: 140 }],
    key: { x: 1250, y: 262, w: 22, h: 28 },
    goal: { x: 2235, y: 344, w: 58, h: 66 }
  }
];

// Penyimpanan seluruh sesi Room aktif di memori server
const rooms = new Map();

// ============================================================================
// FUNGSI SANITASI, GEOMETRI TABRAKAN, & PEMBAGIAN PERAN TAMENG ASIMETRIS
// ============================================================================
function sanitizeColor(rawColor, fallback = CYBER_COLORS[0]) {
  const norm = String(rawColor || "").trim().toLowerCase();
  if (CYBER_COLORS.includes(norm) || /^#[0-9a-f]{6}$/.test(norm)) {
    return norm;
  }
  return CYBER_COLORS.includes(fallback) ? fallback : CYBER_COLORS[0];
}

function sanitizeName(rawName) {
  return (
    String(rawName || "Kucing")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 14) || "Kucing"
  );
}

function sanitizeRoomId(rawRoomId) {
  return (
    String(rawRoomId || "KUCING")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 10) || "KUCING"
  );
}

function overlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function horizontalOverlapWidth(a, b) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
}

/**
 * Pembagian Peran Tameng Laser Asimetris (Tema 2):
 * - Slot Ganjil (Pemain 1, 3, 5, 7 -> urutan 0, 2, 4, 6) = "top" (Tameng Horizontal Atas Kepala)
 * - Slot Genap  (Pemain 2, 4, 6, 8 -> urutan 1, 3, 5, 7) = "front" (Tameng Vertikal Depan Badan)
 * Jika shuffle === true (saat level Tema 2 dimulai), susunan diacak secara adil namun
 * proporsi horizontal:vertikal tetap dijamin 50:50! Saat ada pemain disconnect, fungsi ini
 * dipanggil ulang agar distribusi tameng tim yang tersisa selalu seimbang.
 */
function distributeShieldRoles(room, shuffle = false) {
  const playerList = [...room.players.values()];
  if (playerList.length === 0) return;

  const order = playerList.map((_, idx) => idx);
  if (shuffle && order.length > 1) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = order[i];
      order[i] = order[j];
      order[j] = temp;
    }
  }

  order.forEach((playerIndex, roleOrder) => {
    playerList[playerIndex].shieldRole = roleOrder % 2 === 0 ? "top" : "front";
  });
}

function getPlayerShieldRects(player) {
  if (player.isDead || player.enteringDoor || player.exited) {
    return [];
  }

  if (player.shieldRole === "front") {
    const frontX = player.facing >= 0 ? player.x + player.w + 3 : player.x - 8;
    return [
      {
        x: frontX,
        y: player.y - 4,
        w: 5,
        h: player.h + 6,
        isShield: true,
        shieldType: "front",
        ownerId: player.id,
        color: player.color
      }
    ];
  }

  return [
    {
      x: player.x - 7,
      y: player.y - 8,
      w: player.w + 14,
      h: 5,
      isShield: true,
      shieldType: "top",
      ownerId: player.id,
      color: player.color
    }
  ];
}

// ============================================================================
// INISIALISASI ROOM, MANAJEMEN HOST, & RESET LEVEL OTOMATIS
// ============================================================================
function buildDynamicLevelState(levelIndex) {
  const def = LEVELS[levelIndex] || LEVELS[0];

  return {
    levelIndex,
    code: def.code,
    theme: def.theme,
    title: def.title,
    allForOne: Boolean(def.allForOne),
    elapsed: 0,

    // Status Kunci Emas Terbang & Pintu Keluar Berputar
    keyCollected: false,
    keyHolderId: null,
    doorOpenProgress: 0,

    // Status Kematian & Freeze 2 Detik
    isGameOver: false,
    dying: false,
    deathTimer: 0,
    deadPlayerId: null,

    // Status Pintu Keluar & Penyelesaian Level
    cleared: false,
    levelCleared: false,
    clearTimer: 0,

    // Statistik Persentase Input Real-Time untuk HUD Stik NES (Tema 5)
    inputStats: {
      left: 0,
      right: 0,
      jump: 0,
      total: 1,
      leftRatio: 0,
      rightRatio: 0,
      jumpRatio: 0,
      leftPercent: 0,
      rightPercent: 0,
      jumpPercent: 0
    },
    previousConsensusJump: false,
    consensusJumpBuffer: 0,

    // Hitung Mundur Global & Item Jam Penambah Waktu (Tema 3)
    countdown: typeof def.timeLimit === "number" ? def.timeLimit : null,
    bonusSeq: 0,
    lastTimeBonus: null,
    timeItems: (def.timeItems || []).map(ti => ({
      ...ti,
      collected: false
    })),

    // Sinar Laser & Proyektil Aktif (Tema 2)
    activeLasers: [],
    laserProjectiles: [],
    turretTimers: (def.laserTurrets || []).map(t => ({
      ...t,
      timer: t.phase || 0
    })),

    // Gimmick Tema 4 & Tema 5
    gravityDir: 1,
    gravityTimer: 5.0,
    blinkVisible: true,
    blinkWarning: false,
    lightOn: !def.blackout,
    trafficState: "GREEN",
    trafficTimer: 3.4,

    // Hantu Level 4-2 (speed = 0 saat minimal 1 pemain menatap ke arahnya)
    ghost: def.ghostConfig
      ? {
          x: def.ghostConfig.x,
          y: def.ghostConfig.y,
          w: 28,
          h: 32,
          baseSpeed: def.ghostConfig.speed,
          speed: def.ghostConfig.speed,
          petrified: false,
          facing: -1
        }
      : null,

    // Sakelar Mekanis & Toggle Latch Permanen (Level 1-4)
    switches: (def.switches || []).map(sw => ({
      ...sw,
      latch: Boolean(sw.latch),
      latched: false,
      trap: Boolean(sw.trap),
      pressed: false,
      pressRatio: 0,
      pressDepth: 5,
      soloHoldTimer: 0
    })),

    // Gerbang Vertikal
    gates: (def.gates || []).map(g => ({
      ...g,
      invert: Boolean(g.invert),
      trapTimer: 0,
      open: Boolean(g.invert),
      openProgress: g.invert ? 1 : 0
    })),

    // Blok Puzzle Dorong
    pushBlocks: (def.pushBlocks || []).map(b => ({
      ...b,
      vx: 0,
      vy: 0
    })),

    // Platform Bergerak
    movingPlatforms: (def.movingPlatforms || []).map(mp => ({
      ...mp,
      baseX: mp.x,
      baseY: mp.y,
      dxStep: 0,
      dyStep: 0
    })),

    // Jembatan Runtuh Permanen (hancur tepat 1.0s setelah diinjak, tanpa respawn!)
    crumblingPlatforms: (def.crumblingPlatforms || []).map(cp => ({
      ...cp,
      delay: 1.0,
      triggered: false,
      timer: 1.0,
      fallen: false
    }))
  };
}

function createRoom(id) {
  return {
    id,
    hostId: null,
    paused: false,
    deathResetTimeout: null,
    players: new Map(),
    colorIndex: 0,
    levelIndex: 0,
    level: buildDynamicLevelState(0)
  };
}

/**
 * Memastikan Room selalu memiliki Host yang valid (pemain pertama di Room)
 * dan menyinkronkan flag `isHost` pada setiap objek pemain.
 */
function syncRoomHostStatus(room) {
  if (!room.hostId || !room.players.has(room.hostId)) {
    const nextOwnerId = room.players.keys().next().value;
    room.hostId = nextOwnerId || null;
  }

  for (const p of room.players.values()) {
    p.isHost = p.id === room.hostId;
  }
}

function createPlayer(socket, data, room) {
  const fallbackColor = CYBER_COLORS[room.colorIndex % CYBER_COLORS.length];
  const color = sanitizeColor(data.color, fallbackColor);
  room.colorIndex++;

  const def = LEVELS[room.levelIndex] || LEVELS[0];
  const idx = room.players.size;

  const spawnX = def.allForOne
    ? def.spawn.x
    : def.spawn.x + (idx % 4) * 28;
  const spawnY = def.allForOne
    ? def.spawn.y
    : def.spawn.y - Math.floor(idx / 4) * 34;

  return {
    id: socket.id,
    name: sanitizeName(data.name),
    color,
    isHost: room.hostId === socket.id,
    shieldRole: idx % 2 === 0 ? "top" : "front",

    x: spawnX,
    y: spawnY,
    prevTickX: spawnX,
    prevTickY: spawnY,
    deltaX: 0,
    w: 24,
    h: 30,

    vx: 0,
    vy: 0,
    facing: 1,
    dir: 1,
    jumping: false,
    onGround: false,
    isGrounded: false,
    supportId: null,
    boostTimer: 0,

    // Status Masuk Pintu Keluar
    enteringDoor: false,
    exitProgress: 0,
    exited: false,
    isFinished: false,

    // Status Animasi Kematian
    isDead: false,
    deathVx: 0,
    deathVy: 0,
    deathAngle: 0,

    // Input Real-Time Pemain
    keysPressed: { left: false, right: false, jump: false },
    input: { left: false, right: false, jump: false },
    jumpQueued: false,
    previousJump: false,
    blinkSeed: Math.random() * 100
  };
}

function clearDeathTimeout(room) {
  if (room.deathResetTimeout) {
    clearTimeout(room.deathResetTimeout);
    room.deathResetTimeout = null;
  }
}

function loadLevelForRoom(room, targetLevelIndex) {
  clearDeathTimeout(room);

  const safeIdx =
    ((targetLevelIndex % LEVELS.length) + LEVELS.length) % LEVELS.length;
  const def = LEVELS[safeIdx];

  room.levelIndex = safeIdx;
  room.level = buildDynamicLevelState(safeIdx);

  // Acak secara adil & seimbang peran Tameng Laser saat level Tema 2 dimulai
  distributeShieldRoles(room, Boolean(def.laserShieldMode));
  syncRoomHostStatus(room);

  let idx = 0;
  for (const player of room.players.values()) {
    player.x = def.allForOne
      ? def.spawn.x
      : def.spawn.x + (idx % 4) * 28;
    player.y = def.allForOne
      ? def.spawn.y
      : def.spawn.y - Math.floor(idx / 4) * 34;
    player.prevTickX = player.x;
    player.prevTickY = player.y;
    player.deltaX = 0;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.dir = 1;
    player.jumping = false;
    player.onGround = false;
    player.isGrounded = false;
    player.supportId = null;
    player.boostTimer = 0;

    player.enteringDoor = false;
    player.exitProgress = 0;
    player.exited = false;
    player.isFinished = false;

    player.isDead = false;
    player.deathVx = 0;
    player.deathVy = 0;
    player.deathAngle = 0;

    player.jumpQueued = false;
    player.previousJump = false;
    idx++;
  }
}

/**
 * Fungsi Global `resetLevel(room)`:
 * Mengembalikan seluruh posisi koordinat pemain ke spawn point asal,
 * memulihkan jembatan runtuh permanen, dan menyiarkan ulang state bersih ke client.
 */
function resetLevel(room) {
  if (!room || !rooms.has(room.id)) return;
  loadLevelForRoom(room, room.levelIndex);
  io.to(room.id).emit("levelReset", {
    roomId: room.id,
    levelIndex: room.levelIndex
  });
  io.to(room.id).emit("state", snapshot(room));
}

/**
 * Sistem Jeda Kematian 2 Detik (Death Delay):
 * Mengubah status room menjadi `isGameOver = true`, membekukan seluruh pergerakan,
 * memutar animasi karakter mati terbalik, lalu memanggil `resetLevel(room)` otomatis
 * setelah `setTimeout` 2000ms selesai.
 */
function triggerDeathWithDelay(room, victimPlayer, cause) {
  const st = room.level;
  if (st.isGameOver || st.dying || st.cleared) return;

  st.isGameOver = true;
  st.dying = true;
  st.deathTimer = DEATH_DELAY_MS / 1000;
  st.deadPlayerId = victimPlayer ? victimPlayer.id : null;

  // Bekukan seluruh pergerakan karakter aktif di dalam room
  for (const p of room.players.values()) {
    p.vx = 0;
    p.vy = 0;
    p.jumping = false;
    p.jumpQueued = false;
  }

  if (victimPlayer) {
    victimPlayer.isDead = true;
    victimPlayer.enteringDoor = false;
    victimPlayer.onGround = false;
    victimPlayer.isGrounded = false;
    victimPlayer.supportId = null;

    if (cause === "pit" && victimPlayer.y > WORLD_H - 12) {
      victimPlayer.y = WORLD_H - 12;
    }

    victimPlayer.deathVx = (victimPlayer.facing || 1) * -36;
    victimPlayer.deathVy = -340;
    victimPlayer.deathAngle = 0;

    if (st.allForOne) {
      for (const p of room.players.values()) {
        p.isDead = true;
        p.x = victimPlayer.x;
        p.y = victimPlayer.y;
        p.deathVx = victimPlayer.deathVx;
        p.deathVy = victimPlayer.deathVy;
        p.deathAngle = 0;
      }
    }
  } else {
    // Jika waktu countdown habis (Tema 3), seluruh pemain yang belum keluar terkena efek mati
    for (const p of room.players.values()) {
      if (!p.exited) {
        p.isDead = true;
        p.deathVx = (p.facing || 1) * -28;
        p.deathVy = -310;
        p.deathAngle = 0;
      }
    }
  }

  io.to(room.id).emit("state", snapshot(room));

  clearDeathTimeout(room);
  room.deathResetTimeout = setTimeout(() => {
    room.deathResetTimeout = null;
    if (!rooms.has(room.id)) return;
    resetLevel(room);
  }, DEATH_DELAY_MS);
}

// ============================================================================
// LOGIKA KONSENSUS INPUT 100% "ALL FOR ONE" (TEMA 5: LEVEL 5-1 S/D 5-4)
// ============================================================================
function evaluateAllForOneConsensus(room, dt) {
  const st = room.level;
  const playerList = [...room.players.values()];
  const total = Math.max(1, playerList.length);

  let leftPressed = 0;
  let rightPressed = 0;
  let jumpPressed = 0;

  for (const p of playerList) {
    if (p.keysPressed.left) leftPressed++;
    if (p.keysPressed.right) rightPressed++;
    if (p.keysPressed.jump) jumpPressed++;
  }

  const leftRatio = leftPressed / total;
  const rightRatio = rightPressed / total;
  const jumpRatio = jumpPressed / total;

  // Simpan rasio (0.0..1.0) & persentase (0%..100%) untuk dikirim ke HUD Stik NES client
  st.inputStats = {
    left: leftPressed,
    right: rightPressed,
    jump: jumpPressed,
    total,
    leftRatio: Math.round(leftRatio * 1000) / 1000,
    rightRatio: Math.round(rightRatio * 1000) / 1000,
    jumpRatio: Math.round(jumpRatio * 1000) / 1000,
    leftPercent: Math.round(leftRatio * 100),
    rightPercent: Math.round(rightRatio * 100),
    jumpPercent: Math.round(jumpRatio * 100)
  };

  // Karakter tunggal HANYA bergerak jika konsensus mencapai 100% pemain di room
  const fullLeft = leftPressed === total;
  const fullRight = rightPressed === total;
  const fullJump = jumpPressed === total;

  if (fullJump && !st.previousConsensusJump) {
    st.consensusJumpBuffer = 0.22;
  } else if (!fullJump) {
    st.consensusJumpBuffer = 0;
  } else if (st.consensusJumpBuffer > 0) {
    st.consensusJumpBuffer = Math.max(0, st.consensusJumpBuffer - dt);
  }
  st.previousConsensusJump = fullJump;

  return {
    left: fullLeft,
    right: fullRight,
    shouldJump: fullJump && st.consensusJumpBuffer > 0
  };
}

// ============================================================================
// MESIN FISIKA SOLID, STACKING ANTAR-PEMAIN, PUSH BLOCK, & LASER
// ============================================================================
function getActiveSolids(room) {
  const def = LEVELS[room.levelIndex];
  const st = room.level;
  const solids = [];

  def.platforms.forEach((p, idx) => {
    if (p.blink && !st.blinkVisible) return;
    solids.push({ x: p.x, y: p.y, w: p.w, h: p.h, id: `plat-${idx}` });
  });

  st.movingPlatforms.forEach(mp => {
    solids.push({
      x: mp.x,
      y: mp.y,
      w: mp.w,
      h: mp.h,
      id: mp.id,
      movingRef: mp
    });
  });

  st.crumblingPlatforms.forEach(cp => {
    if (cp.fallen) return;
    solids.push({
      x: cp.x,
      y: cp.y,
      w: cp.w,
      h: cp.h,
      id: cp.id,
      crumblingRef: cp
    });
  });

  st.switches.forEach(sw => {
    const offset = sw.pressRatio * sw.pressDepth;
    solids.push({
      x: sw.x,
      y: sw.y + offset,
      w: sw.w,
      h: Math.max(6, sw.h - offset),
      id: `switch:${sw.id}`,
      switchRef: sw
    });
  });

  st.gates.forEach(g => {
    const currentH = g.h * (1 - g.openProgress);
    if (currentH > 5) {
      solids.push({
        x: g.x,
        y: g.y,
        w: g.w,
        h: currentH,
        id: `gate:${g.id}`
      });
    }
  });

  st.pushBlocks.forEach(b => {
    solids.push({
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      id: `block:${b.id}`,
      blockRef: b
    });
  });

  return solids;
}

function updatePushBlocks(room, dt, activePlayers, totalRoomPlayers) {
  const def = LEVELS[room.levelIndex];
  const st = room.level;
  if (st.pushBlocks.length === 0) return;

  const solids = getActiveSolids(room).filter(s => !s.blockRef && !s.switchRef);

  for (const b of st.pushBlocks) {
    const required = Math.min(
      b.minPushers || 2,
      Math.max(1, def.allForOne ? totalRoomPlayers : activePlayers.length)
    );

    const rightPushers = new Set();
    const leftPushers = new Set();

    // Deteksi pemain yang mendorong blok secara langsung
    for (const p of activePlayers) {
      const verticalAlign = p.y + p.h > b.y + 4 && p.y < b.y + b.h - 4;
      if (!verticalAlign) continue;

      if (p.vx > 0 && Math.abs(p.x + p.w - b.x) <= 6) {
        rightPushers.add(p.id);
      } else if (p.vx < 0 && Math.abs(p.x - (b.x + b.w)) <= 6) {
        leftPushers.add(p.id);
      }
    }

    // Propagasi dorongan berantai (rekan yang mendorong dari belakang pemain solid atau dari atas kepala)
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of activePlayers) {
        if (p.vx > 0 && !rightPushers.has(p.id)) {
          for (const frontId of rightPushers) {
            const frontMate = activePlayers.find(m => m.id === frontId);
            if (!frontMate) continue;
            const behindPush =
              p.y + p.h > frontMate.y + 4 &&
              p.y < frontMate.y + frontMate.h - 4 &&
              Math.abs(p.x + p.w - frontMate.x) <= 6;
            const stackedTop = p.supportId === `player:${frontMate.id}`;
            if (behindPush || stackedTop) {
              rightPushers.add(p.id);
              grew = true;
              break;
            }
          }
        }

        if (p.vx < 0 && !leftPushers.has(p.id)) {
          for (const frontId of leftPushers) {
            const frontMate = activePlayers.find(m => m.id === frontId);
            if (!frontMate) continue;
            const behindPush =
              p.y + p.h > frontMate.y + 4 &&
              p.y < frontMate.y + frontMate.h - 4 &&
              Math.abs(p.x - (frontMate.x + frontMate.w)) <= 6;
            const stackedTop = p.supportId === `player:${frontMate.id}`;
            if (behindPush || stackedTop) {
              leftPushers.add(p.id);
              grew = true;
              break;
            }
          }
        }
      }
    }

    const effectiveRight = def.allForOne
      ? rightPushers.size * totalRoomPlayers
      : rightPushers.size;
    const effectiveLeft = def.allForOne
      ? leftPushers.size * totalRoomPlayers
      : leftPushers.size;

    if (effectiveRight >= required) b.vx = 98;
    else if (effectiveLeft >= required) b.vx = -98;
    else b.vx = 0;

    b.x += b.vx * dt;

    for (const s of solids) {
      if (!overlap(b, s)) continue;
      if (b.vx > 0) b.x = s.x - b.w;
      else if (b.vx < 0) b.x = s.x + s.w;
      b.vx = 0;
    }

    b.x = Math.max(16, Math.min(def.width - 16 - b.w, b.x));

    const prevBottom = b.y + b.h;
    b.vy += GRAVITY * dt;
    b.y += b.vy * dt;

    for (const s of solids) {
      if (!overlap(b, s)) continue;
      if (b.vy >= 0 && prevBottom <= s.y + 5) {
        b.y = s.y - b.h;
        b.vy = 0;
      }
    }
  }
}

function moveAndCollidePlayer(player, room, dt, activePlayers) {
  const def = LEVELS[room.levelIndex];
  const st = room.level;
  const gDir = st.gravityDir || 1;
  const solids = getActiveSolids(room);
  const otherPlayers = def.allForOne
    ? []
    : activePlayers.filter(other => other.id !== player.id);

  const startX = player.x;
  const prevY = player.y;
  const prevBottom = prevY + player.h;
  const prevTop = prevY;

  // Bawa pemain yang berdiri di atas kepala temannya atau di atas platform bergerak
  let carryX = 0;
  let carryY = 0;
  if (player.onGround && player.supportId) {
    if (player.supportId.startsWith("player:")) {
      const carrierId = player.supportId.slice(7);
      const carrier = otherPlayers.find(o => o.id === carrierId);
      if (carrier) carryX = carrier.deltaX || 0;
    } else {
      const mp = st.movingPlatforms.find(m => m.id === player.supportId);
      if (mp) {
        carryX = mp.dxStep || 0;
        carryY = mp.dyStep || 0;
      }
    }
  }

  // 1. Gerakan Horizontal terhadap Platform & Gerbang
  player.x += carryX + player.vx * dt;

  for (const s of solids) {
    if (!overlap(player, s)) continue;

    if (gDir === 1 && player.vy >= 0 && prevBottom <= s.y + 3.5) continue;
    if (gDir === -1 && player.vy <= 0 && prevTop >= s.y + s.h - 3.5) continue;

    if (startX + player.w <= s.x + 4) {
      player.x = s.x - player.w;
    } else if (startX >= s.x + s.w - 4) {
      player.x = s.x + s.w;
    } else {
      const pCenter = player.x + player.w / 2;
      const sCenter = s.x + s.w / 2;
      player.x = pCenter < sCenter ? s.x - player.w : s.x + s.w;
    }
    player.vx = 0;
  }

  // 2. Tabrakan Horizontal Solid Antar-Pemain (Tidak bisa saling menembus tubuh)
  for (const other of otherPlayers) {
    if (!overlap(player, other)) continue;

    if (gDir === 1 && prevBottom <= other.y + 5.5) continue;
    if (gDir === 1 && prevTop >= other.y + other.h - 5.5) continue;
    if (gDir === -1 && prevTop >= other.y + other.h - 5.5) continue;
    if (gDir === -1 && prevBottom <= other.y + 5.5) continue;

    if (startX + player.w <= other.x + 5) {
      player.x = other.x - player.w;
    } else if (startX >= other.x + other.w - 5) {
      player.x = other.x + other.w;
    } else {
      const myCenter = player.x + player.w / 2;
      const otherCenter = other.x + other.w / 2;
      player.x = myCenter < otherCenter ? other.x - player.w : other.x + other.w;
    }
  }

  player.x = Math.max(16, Math.min(def.width - 16 - player.w, player.x));
  player.deltaX = player.x - startX;

  // 3. Gerakan Vertikal terhadap Platform Solid
  player.y += carryY + player.vy * dt;
  player.onGround = false;
  player.isGrounded = false;
  player.supportId = null;

  for (const s of solids) {
    if (!overlap(player, s)) continue;

    const overlapX = horizontalOverlapWidth(player, s);
    const minOverlap = s.switchRef ? 3 : 2;
    if (overlapX < minOverlap) continue;

    if (gDir === 1) {
      if (player.vy >= 0 && prevBottom <= s.y + 5 && player.y + player.h >= s.y) {
        player.y = s.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.isGrounded = true;
        player.supportId = s.id;

        if (s.crumblingRef && !s.crumblingRef.triggered) {
          s.crumblingRef.triggered = true;
        }
      } else if (player.vy < 0 && prevTop >= s.y + s.h - 4.5 && player.y <= s.y + s.h) {
        player.y = s.y + s.h;
        player.vy = 0;
      }
    } else {
      // Gravitasi terbalik (menempel di langit-langit)
      if (player.vy <= 0 && prevTop >= s.y + s.h - 5 && player.y <= s.y + s.h) {
        player.y = s.y + s.h;
        player.vy = 0;
        player.onGround = true;
        player.isGrounded = true;
        player.supportId = s.id;
      } else if (player.vy > 0 && prevBottom <= s.y + 5 && player.y + player.h >= s.y) {
        player.y = s.y - player.h;
        player.vy = 0;
      }
    }
  }

  // 4. Pijakan Solid di Atas Kepala Pemain Lain (Head Stacking)
  for (const other of otherPlayers) {
    if (!overlap(player, other)) continue;
    const overlapX = horizontalOverlapWidth(player, other);
    if (overlapX < 3) continue;

    if (gDir === 1) {
      if (player.vy >= 0 && prevBottom <= other.y + 6) {
        player.y = other.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.isGrounded = true;
        player.supportId = `player:${other.id}`;
      } else if (player.vy < 0 && prevTop >= other.y + other.h - 6) {
        player.y = other.y + other.h;
        player.vy = 0;
      }
    } else {
      if (player.vy <= 0 && prevTop >= other.y + other.h - 6) {
        player.y = other.y + other.h;
        player.vy = 0;
        player.onGround = true;
        player.isGrounded = true;
        player.supportId = `player:${other.id}`;
      } else if (player.vy > 0 && prevBottom <= other.y + 6) {
        player.y = other.y - player.h;
        player.vy = 0;
      }
    }
  }

  player.jumping = !player.onGround;
}

// Simulasi Sinar Laser & Proyektil terhadap Tameng Asimetris (Tema 2)
function updateLasersAndCheckHit(room, activePlayers, totalConnectedCount, dt) {
  const def = LEVELS[room.levelIndex];
  const st = room.level;
  if (!def.laserShieldMode) return null;

  const solids = getActiveSolids(room);
  const shields = [];
  for (const p of activePlayers) {
    shields.push(...getPlayerShieldRects(p));
  }

  const allBlockers = [...solids, ...shields];
  const computedBeams = [];

  for (const emitter of def.lasers || []) {
    if (emitter.minPlayers && totalConnectedCount < emitter.minPlayers) {
      continue;
    }

    const halfT = 4;
    let blockedByShield = false;
    let shieldColor = null;

    if (emitter.dir === "down") {
      let endY = emitter.y + (emitter.maxLen || 400);
      const beamLeft = emitter.x - halfT;
      const beamRight = emitter.x + halfT;

      for (const blk of allBlockers) {
        if (blk.x + blk.w <= beamLeft || blk.x >= beamRight) continue;
        if (blk.y >= emitter.y - 2 && blk.y < endY) {
          endY = blk.y;
          blockedByShield = Boolean(blk.isShield);
          shieldColor = blk.isShield ? blk.color : null;
        }
      }

      computedBeams.push({
        id: emitter.id,
        dir: "down",
        x1: emitter.x,
        y1: emitter.y,
        x2: emitter.x,
        y2: Math.round(endY),
        rect: {
          x: beamLeft,
          y: emitter.y,
          w: halfT * 2,
          h: Math.max(0, endY - emitter.y)
        },
        blockedByShield,
        shieldColor
      });
    } else if (emitter.dir === "left") {
      let endX = emitter.x - (emitter.maxLen || 600);
      const beamTop = emitter.y - halfT;
      const beamBottom = emitter.y + halfT;

      for (const blk of allBlockers) {
        if (blk.y + blk.h <= beamTop || blk.y >= beamBottom) continue;
        const rightEdge = blk.x + blk.w;
        if (rightEdge <= emitter.x + 2 && rightEdge > endX) {
          endX = rightEdge;
          blockedByShield = Boolean(blk.isShield);
          shieldColor = blk.isShield ? blk.color : null;
        }
      }

      computedBeams.push({
        id: emitter.id,
        dir: "left",
        x1: emitter.x,
        y1: emitter.y,
        x2: Math.round(endX),
        y2: emitter.y,
        rect: {
          x: endX,
          y: beamTop,
          w: Math.max(0, emitter.x - endX),
          h: halfT * 2
        },
        blockedByShield,
        shieldColor
      });
    } else if (emitter.dir === "right") {
      let endX = emitter.x + (emitter.maxLen || 600);
      const beamTop = emitter.y - halfT;
      const beamBottom = emitter.y + halfT;

      for (const blk of allBlockers) {
        if (blk.y + blk.h <= beamTop || blk.y >= beamBottom) continue;
        if (blk.x >= emitter.x - 2 && blk.x < endX) {
          endX = blk.x;
          blockedByShield = Boolean(blk.isShield);
          shieldColor = blk.isShield ? blk.color : null;
        }
      }

      computedBeams.push({
        id: emitter.id,
        dir: "right",
        x1: emitter.x,
        y1: emitter.y,
        x2: Math.round(endX),
        y2: emitter.y,
        rect: {
          x: emitter.x,
          y: beamTop,
          w: Math.max(0, endX - emitter.x),
          h: halfT * 2
        },
        blockedByShield,
        shieldColor
      });
    }
  }

  st.activeLasers = computedBeams;

  for (const t of st.turretTimers) {
    t.timer += dt;
    if (t.timer >= t.interval) {
      t.timer -= t.interval;
      st.laserProjectiles.push({
        x: t.x,
        y: t.y,
        vx: t.vx,
        vy: t.vy,
        w: t.vx !== 0 ? 14 : 7,
        h: t.vy !== 0 ? 14 : 7
      });
    }
  }

  for (let i = st.laserProjectiles.length - 1; i >= 0; i--) {
    const proj = st.laserProjectiles[i];
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    if (
      proj.x < 0 ||
      proj.x > def.width ||
      proj.y < 0 ||
      proj.y > WORLD_H
    ) {
      st.laserProjectiles.splice(i, 1);
      continue;
    }

    const stopped = allBlockers.some(blk => overlap(proj, blk));
    if (stopped) {
      st.laserProjectiles.splice(i, 1);
    }
  }

  for (const p of activePlayers) {
    const bodyHurtbox = {
      x: p.x + 4,
      y: p.y + 4,
      w: p.w - 8,
      h: p.h - 6
    };

    for (const beam of computedBeams) {
      if (beam.rect.w > 0 && beam.rect.h > 0 && overlap(bodyHurtbox, beam.rect)) {
        return p;
      }
    }

    for (const proj of st.laserProjectiles) {
      if (overlap(bodyHurtbox, proj)) {
        return p;
      }
    }
  }

  return null;
}

function collectTimeBonusItem(room, item) {
  if (!item || item.collected) return false;
  const st = room.level;
  item.collected = true;

  if (typeof st.countdown === "number") {
    st.countdown += item.bonus;
  }

  st.bonusSeq++;
  st.lastTimeBonus = {
    seq: st.bonusSeq,
    x: item.x,
    y: item.y,
    bonus: item.bonus
  };
  return true;
}

// ============================================================================
// SIMULASI LOOP PERMAINAN SERVER-AUTHORITATIVE (60 FPS)
// ============================================================================
function updateRoomSimulation(room, dt) {
  if (room.paused) return;

  const players = [...room.players.values()];
  if (players.length === 0) return;

  const def = LEVELS[room.levelIndex];
  const st = room.level;

  // 1. Jika sedang dalam Jeda Kematian 2 Detik: bekukan semua objek & animasikan karakter mati
  if (st.isGameOver || st.dying) {
    st.deathTimer = Math.max(0, st.deathTimer - dt);
    for (const p of players) {
      if (p.isDead) {
        p.deathAngle = Math.min(Math.PI, p.deathAngle + dt * Math.PI * 3.5);
        p.deathVy += 1080 * dt;
        p.x += p.deathVx * dt;
        p.y += p.deathVy * dt;
      }
    }
    return;
  }

  // 2. Transisi otomatis ke level berikutnya setelah `levelCleared`
  if (st.cleared) {
    st.clearTimer -= dt;
    if (st.clearTimer <= 0) {
      const nextIdx = (room.levelIndex + 1) % LEVELS.length;
      loadLevelForRoom(room, nextIdx);
      io.to(room.id).emit("levelReset", {
        roomId: room.id,
        levelIndex: room.levelIndex
      });
    }
    return;
  }

  st.elapsed += dt;

  // Tentukan daftar karakter yang disimulasikan:
  // - Tema 5 (All for One): hanya 1 karakter utama yang dikontrol bersama
  // - Tema 1 s/d 4: semua pemain di room
  const simulatedPlayers = def.allForOne
    ? players[0] && !players[0].exited
      ? [players[0]]
      : []
    : players;

  // Proses animasi mengecil saat karakter masuk ke Pintu Keluar
  for (const p of simulatedPlayers) {
    if (p.enteringDoor && !p.exited) {
      const doorCenterX = def.goal.x + def.goal.w / 2 - p.w / 2;
      const doorBottomY = def.goal.y + def.goal.h - p.h;
      p.x += (doorCenterX - p.x) * Math.min(1, dt * 11);
      p.y += (doorBottomY - p.y) * Math.min(1, dt * 11);
      p.exitProgress = Math.min(1, p.exitProgress + dt * 2.3);

      if (p.exitProgress >= 1) {
        p.exited = true;
        p.isFinished = true;
        p.enteringDoor = false;

        if (def.allForOne) {
          for (const mate of players) {
            mate.exited = true;
            mate.isFinished = true;
            mate.enteringDoor = false;
            mate.exitProgress = 1;
          }
        }
      }
    }
  }

  const activePlayers = simulatedPlayers.filter(
    p => !p.exited && !p.enteringDoor && !p.isDead
  );

  for (const p of activePlayers) {
    p.prevTickX = p.x;
    p.prevTickY = p.y;
  }

  // 3. Moving Platforms
  for (const mp of st.movingPlatforms) {
    const oldX = mp.x;
    const oldY = mp.y;
    const wave = Math.sin(st.elapsed * mp.speed);
    mp.x = mp.baseX + wave * (mp.dx || 0);
    mp.y = mp.baseY + wave * (mp.dy || 0);
    mp.dxStep = mp.x - oldX;
    mp.dyStep = mp.y - oldY;
  }

  // 4. Jembatan Runtuh Permanen (Level 3-3 & 3-4: roboh tepat 1.0s & tidak pernah respawn)
  for (const cp of st.crumblingPlatforms) {
    if (cp.triggered && !cp.fallen) {
      cp.timer -= dt;
      if (cp.timer <= 0) {
        cp.timer = 0;
        cp.fallen = true;
      }
    }
  }

  // 5. Platform Transparan Berkedip (Level 4-1: 5.0s nyala stabil / 1.5s meredup hilang)
  if (def.blinkPlatforms) {
    const cycle = st.elapsed % 6.5;
    st.blinkVisible = cycle < 5.0;
    st.blinkWarning = cycle >= 4.0 && cycle < 5.0;
  }

  // 6. Gravity Shift (Level 4-3: berbalik tiap 5 detik)
  if (def.gravityShift) {
    st.gravityTimer -= dt;
    if (st.gravityTimer <= 0) {
      st.gravityDir *= -1;
      st.gravityTimer = 5.0;
      for (const p of activePlayers) {
        p.onGround = false;
        p.isGrounded = false;
      }
    }
  }

  // 7. Traffic Light (Level 5-4)
  if (def.trafficLight) {
    st.trafficTimer -= dt;
    if (st.trafficTimer <= 0) {
      if (st.trafficState === "GREEN") {
        st.trafficState = "YELLOW";
        st.trafficTimer = 1.45;
      } else if (st.trafficState === "YELLOW") {
        st.trafficState = "RED";
        st.trafficTimer = 2.0;
      } else {
        st.trafficState = "GREEN";
        st.trafficTimer = 3.4;
      }
    }
  }

  // 8. Hitung Mundur Global Tema 3 (Time Limit)
  if (typeof st.countdown === "number") {
    st.countdown -= dt;
    if (st.countdown <= 0) {
      st.countdown = 0;
      triggerDeathWithDelay(room, null, "timeout");
      return;
    }
  }

  // 9. Pergerakan Karakter (Konsensus 100% di Tema 5 vs Individual di Tema 1-4)
  const boostPads = def.boostPads || [];

  if (def.allForOne) {
    const consensus = evaluateAllForOneConsensus(room, dt);
    const avatar = activePlayers[0];

    if (avatar) {
      const moveDir = Number(consensus.right) - Number(consensus.left);

      if (def.momentumBoost && boostPads.length > 0) {
        const onBoost = boostPads.some(
          bp =>
            avatar.x + avatar.w > bp.x &&
            avatar.x < bp.x + bp.w &&
            Math.abs(avatar.y + avatar.h - bp.y) <= 8
        );
        if (onBoost && moveDir !== 0) {
          avatar.boostTimer = 0.25;
        } else if (avatar.boostTimer > 0) {
          avatar.boostTimer -= dt;
        }
      }

      const speedMult = avatar.boostTimer > 0 ? 1.52 : 1.0;
      avatar.vx = moveDir * MOVE_SPEED * speedMult;

      if (moveDir !== 0) {
        avatar.facing = moveDir > 0 ? 1 : -1;
        avatar.dir = avatar.facing;
      }

      if (consensus.shouldJump && avatar.onGround) {
        const jumpMult = avatar.boostTimer > 0 ? 1.16 : 1.0;
        avatar.vy = -JUMP_SPEED * jumpMult * st.gravityDir;
        avatar.onGround = false;
        avatar.isGrounded = false;
        avatar.jumping = true;
        avatar.supportId = null;
        st.consensusJumpBuffer = 0;
      }

      avatar.vy += GRAVITY * st.gravityDir * dt;
      avatar.vy = Math.max(-760, Math.min(760, avatar.vy));
    }
  } else {
    for (const p of activePlayers) {
      const moveDir = Number(p.keysPressed.right) - Number(p.keysPressed.left);

      if (def.momentumBoost && boostPads.length > 0) {
        const onBoost = boostPads.some(
          bp =>
            p.x + p.w > bp.x &&
            p.x < bp.x + bp.w &&
            Math.abs(p.y + p.h - bp.y) <= 8
        );
        if (onBoost && moveDir !== 0) {
          p.boostTimer = 0.25;
        } else if (p.boostTimer > 0) {
          p.boostTimer -= dt;
        }
      }

      const speedMult = p.boostTimer > 0 ? 1.52 : 1.0;
      p.vx = moveDir * MOVE_SPEED * speedMult;

      if (moveDir !== 0) {
        p.facing = moveDir > 0 ? 1 : -1;
        p.dir = p.facing;
      }

      if (p.jumpQueued && p.onGround) {
        const jumpMult = p.boostTimer > 0 ? 1.16 : 1.0;
        p.vy = -JUMP_SPEED * jumpMult * st.gravityDir;
        p.onGround = false;
        p.isGrounded = false;
        p.jumping = true;
        p.supportId = null;
      }
      p.jumpQueued = false;

      p.vy += GRAVITY * st.gravityDir * dt;
      p.vy = Math.max(-760, Math.min(760, p.vy));
    }
  }

  for (const p of players) {
    if (p.enteringDoor || p.exited || def.allForOne) {
      p.jumpQueued = false;
    }
  }

  updatePushBlocks(room, dt, activePlayers, players.length);

  // Urutkan evaluasi dari pemain paling dekat lantai agar tumpukan kepala (stacking) kokoh
  const sortedActive = [...activePlayers].sort((a, b) =>
    st.gravityDir === -1 ? a.y - b.y : b.y - a.y
  );

  for (const p of sortedActive) {
    moveAndCollidePlayer(p, room, dt, activePlayers);

    if (p.y > WORLD_H + 45 || p.y < -85) {
      triggerDeathWithDelay(room, p, "pit");
      return;
    }
  }

  // Salin koordinat karakter tunggal ke seluruh anggota pada Mode All for One
  if (def.allForOne && players.length > 1) {
    const lead = players[0];
    for (let i = 1; i < players.length; i++) {
      const m = players[i];
      m.x = lead.x;
      m.y = lead.y;
      m.vx = lead.vx;
      m.vy = lead.vy;
      m.facing = lead.facing;
      m.dir = lead.dir;
      m.jumping = lead.jumping;
      m.onGround = lead.onGround;
      m.isGrounded = lead.isGrounded;
      m.enteringDoor = lead.enteringDoor;
      m.exitProgress = lead.exitProgress;
      m.exited = lead.exited;
      m.isFinished = lead.isFinished;
    }
  }

  // 10. Evaluasi Tabrakan Laser & Proyektil (Tema 2)
  if (def.laserShieldMode) {
    const zappedPlayer = updateLasersAndCheckHit(
      room,
      activePlayers,
      players.length,
      dt
    );
    if (zappedPlayer) {
      triggerDeathWithDelay(room, zappedPlayer, "laser");
      return;
    }
  }

  // 11. Evaluasi Lampu Merah (Level 5-4)
  if (def.trafficLight && st.trafficState === "RED") {
    const violator = activePlayers.find(
      p =>
        Math.abs(p.x - p.prevTickX) > 0.45 ||
        Math.abs(p.y - p.prevTickY) > 0.45
    );
    if (violator) {
      triggerDeathWithDelay(room, violator, "traffic");
      return;
    }
  }

  // 12. Pengambilan Item Jam Penambah Waktu (+5s / +10s)
  for (const ti of st.timeItems) {
    if (ti.collected) continue;
    const hitBox = { x: ti.x - 14, y: ti.y - 14, w: 28, h: 28 };
    for (const p of activePlayers) {
      if (overlap(p, hitBox)) {
        collectTimeBonusItem(room, ti);
        break;
      }
    }
  }

  // 13. Sakelar (termasuk Toggle Latch Permanen di Level 1-4) & Gerbang Vertikal
  for (const sw of st.switches) {
    const currentTop = sw.y + sw.pressRatio * sw.pressDepth;

    const steppedOn = activePlayers.some(p => {
      if (!p.onGround || p.supportId !== `switch:${sw.id}`) return false;
      const overlapX = horizontalOverlapWidth(p, sw);
      const feetY = p.y + p.h;
      return overlapX >= 3 && Math.abs(feetY - currentTop) <= 2.5;
    });

    if (steppedOn && sw.latch && !sw.latched) {
      sw.latched = true;
    }

    if (steppedOn && sw.trap && !sw.pressed) {
      for (const g of st.gates) {
        if (Array.isArray(sw.targetGates) && sw.targetGates.includes(g.id)) {
          g.trapTimer = 3.5;
        }
      }
    }

    if (players.length === 1 && !sw.latch && !sw.trap && !sw.isLightSwitch) {
      if (steppedOn) sw.soloHoldTimer = 3.5;
      else if (sw.soloHoldTimer > 0) sw.soloHoldTimer -= dt;
    } else {
      sw.soloHoldTimer = 0;
    }

    sw.pressed = sw.latched || steppedOn || sw.soloHoldTimer > 0;

    const targetRatio = sw.pressed ? 1 : 0;
    sw.pressRatio += (targetRatio - sw.pressRatio) * Math.min(1, dt * 16);

    const updatedTop = sw.y + sw.pressRatio * sw.pressDepth;
    for (const p of activePlayers) {
      if (p.onGround && p.supportId === `switch:${sw.id}`) {
        p.y = updatedTop - p.h;
      }
    }
  }

  if (def.blackout) {
    st.lightOn = st.switches.some(s => s.isLightSwitch && s.pressed);
  }

  for (const g of st.gates) {
    if (g.invert) {
      if (g.trapTimer > 0) {
        g.trapTimer -= dt;
        g.open = false;
      } else {
        g.open = true;
      }
    } else {
      g.open = st.switches.some(
        sw =>
          !sw.trap &&
          Array.isArray(sw.targetGates) &&
          sw.targetGates.includes(g.id) &&
          sw.pressed
      );
    }

    const targetOpen = g.open ? 1 : 0;
    g.openProgress += (targetOpen - g.openProgress) * Math.min(1, dt * 8.5);
  }

  // 14. Hantu Level 4-2: Cukup minimal 1 pemain menghadapkan pandangan ke Hantu -> speed = 0
  if (st.ghost) {
    const gh = st.ghost;

    const anyoneLooking = activePlayers.some(p => {
      const dxToGhost = gh.x + gh.w / 2 - (p.x + p.w / 2);
      const dirToGhost = dxToGhost >= 0 ? 1 : -1;
      return p.facing === dirToGhost;
    });

    gh.petrified = anyoneLooking;
    gh.speed = gh.petrified ? 0 : gh.baseSpeed;

    if (!gh.petrified && gh.speed > 0 && activePlayers.length > 0) {
      let nearest = activePlayers[0];
      let minDist = Infinity;
      for (const p of activePlayers) {
        const d = Math.hypot(p.x - gh.x, p.y - gh.y);
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }

      if (nearest) {
        const dx = nearest.x - gh.x;
        const dy = nearest.y - gh.y;
        const len = Math.hypot(dx, dy) || 1;
        gh.x += (dx / len) * gh.speed * dt;
        gh.y += (dy / len) * gh.speed * dt;
        gh.facing = dx >= 0 ? 1 : -1;
      }
    }

    for (const p of activePlayers) {
      if (overlap(p, gh)) {
        triggerDeathWithDelay(room, p, "ghost");
        return;
      }
    }
  }

  // 15. Kunci Terbang, Pintu Berputar, & Verifikasi Semua Pemain Masuk Pintu (`isFinished`)
  if (!st.keyCollected) {
    for (const p of activePlayers) {
      if (overlap(p, def.key)) {
        st.keyCollected = true;
        st.keyHolderId = p.id;
        break;
      }
    }
  } else {
    st.doorOpenProgress = Math.min(1, st.doorOpenProgress + dt * 1.85);

    if (st.doorOpenProgress > 0.65) {
      for (const p of activePlayers) {
        if (overlap(p, def.goal)) {
          p.enteringDoor = true;
          p.exitProgress = 0;
          p.vx = 0;
          p.vy = 0;
          p.jumping = false;
          p.onGround = false;
          p.isGrounded = false;
          p.supportId = null;
        }
      }
    }

    // Trigger `levelCleared` HANYA JIKA seluruh pemain aktif di room sudah `isFinished === true`
    if (
      !st.cleared &&
      players.length > 0 &&
      players.every(p => p.isFinished === true && p.exited === true)
    ) {
      st.cleared = true;
      st.levelCleared = true;
      st.clearTimer = 2.2;

      io.to(room.id).emit("levelCleared", {
        roomId: room.id,
        levelIndex: room.levelIndex,
        code: def.code
      });
    }
  }
}

// ============================================================================
// PEMBENTUKAN SNAPSHOT STATE REAL-TIME UNTUK SELURUH CLIENT DI ROOM
// ============================================================================
function snapshot(room) {
  const def = LEVELS[room.levelIndex];
  const st = room.level;

  return {
    roomId: room.id,
    hostId: room.hostId,
    paused: room.paused,
    levelIndex: room.levelIndex,
    totalLevels: LEVELS.length,
    inputStats: st.inputStats,

    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      shieldRole: p.shieldRole || "top",
      isHost: p.id === room.hostId,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      w: p.w,
      h: p.h,
      vx: Math.round(p.vx),
      vy: Math.round(p.vy),
      facing: p.facing,
      dir: p.dir,
      jumping: p.jumping,
      onGround: p.onGround,
      isGrounded: p.isGrounded,
      enteringDoor: p.enteringDoor,
      exitProgress: Math.round((p.exitProgress || 0) * 100) / 100,
      exited: p.exited,
      isFinished: p.isFinished,
      isDead: p.isDead,
      dead: p.isDead,
      deathAngle: Math.round((p.deathAngle || 0) * 100) / 100,
      blinkSeed: p.blinkSeed,
      input: {
        left: p.keysPressed.left,
        right: p.keysPressed.right,
        jump: p.keysPressed.jump
      }
    })),

    level: {
      code: st.code,
      theme: st.theme,
      title: st.title,
      allForOne: Boolean(def.allForOne),
      elapsed: Math.round(st.elapsed * 100) / 100,
      keyCollected: st.keyCollected,
      keyHolderId: st.keyHolderId,
      doorOpenProgress: Math.round(st.doorOpenProgress * 1000) / 1000,
      isGameOver: st.isGameOver,
      dying: st.dying,
      deathTimer: Math.round((st.deathTimer || 0) * 10) / 10,
      cleared: st.cleared,
      levelCleared: st.levelCleared,
      inputStats: st.inputStats,
      consensus: st.inputStats,
      countdown: st.countdown,
      lastTimeBonus: st.lastTimeBonus,
      timeItems: st.timeItems,
      activeLasers: st.activeLasers,
      laserProjectiles: st.laserProjectiles,
      gravityDir: st.gravityDir,
      gravityTimer: st.gravityTimer,
      blinkVisible: st.blinkVisible,
      blinkWarning: st.blinkWarning,
      lightOn: st.lightOn,
      trafficState: st.trafficState,
      ghost: st.ghost,
      switches: st.switches,
      gates: st.gates,
      pushBlocks: st.pushBlocks,
      movingPlatforms: st.movingPlatforms,
      crumblingPlatforms: st.crumblingPlatforms
    },

    geometry: {
      width: def.width || 2200,
      height: WORLD_H,
      viewWidth: BASE_VIEW_W,
      laserShieldMode: Boolean(def.laserShieldMode),
      laserTurrets: def.laserTurrets || [],
      blackout: Boolean(def.blackout),
      allForOne: Boolean(def.allForOne),
      momentumBoost: Boolean(def.momentumBoost),
      trafficLight: Boolean(def.trafficLight),
      gravityShift: Boolean(def.gravityShift),
      boostPads: def.boostPads || [],
      platforms: def.platforms,
      key: def.key,
      goal: def.goal
    }
  };
}

// ============================================================================
// PENANGANAN EVENT SOCKET.IO & VALIDASI HAK EKSKLUSIF HOST
// ============================================================================
io.on("connection", socket => {
  let currentRoom = null;

  // 1. Buat / Masuk Room & Deteksi Host Otomatis
  socket.on("joinGame", (data = {}, callback) => {
    const roomId = sanitizeRoomId(data.roomId);
    const name = sanitizeName(data.name);
    const existingRoom = rooms.get(roomId);
    const alreadyInRoom = existingRoom && existingRoom.players.has(socket.id);

    if (existingRoom && !alreadyInRoom && existingRoom.players.size >= 8) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Room penuh (maksimal 8 pemain)." });
      }
      return;
    }

    if (currentRoom && currentRoom.id !== roomId) {
      removePlayerFromRoom(socket, currentRoom);
    }

    const room = rooms.get(roomId) || createRoom(roomId);
    rooms.set(roomId, room);
    currentRoom = room;

    // Pemain pertama di dalam Room otomatis diangkat sebagai Host/Owner
    if (!room.hostId || !room.players.has(room.hostId)) {
      room.hostId = socket.id;
    }

    let player = room.players.get(socket.id);
    if (player) {
      player.name = name;
      player.color = sanitizeColor(data.color, player.color);
    } else {
      player = createPlayer(socket, { name, color: data.color }, room);
      room.players.set(socket.id, player);
    }

    syncRoomHostStatus(room);
    distributeShieldRoles(room, false);

    socket.join(roomId);

    if (typeof callback === "function") {
      callback({
        ok: true,
        roomId: room.id,
        playerId: socket.id,
        isHost: player.isHost,
        color: player.color,
        shieldRole: player.shieldRole,
        levels: LEVELS.map((l, idx) => ({
          index: idx,
          code: l.code,
          title: l.title,
          theme: l.theme
        }))
      });
    }

    io.to(roomId).emit("state", snapshot(room));
  });

  // 2. Ganti Warna Unit Kucing & Tameng Adaptif
  socket.on("selectColor", (data = {}, callback) => {
    const rawColor = typeof data === "string" ? data : data?.color;
    const validColor = sanitizeColor(rawColor);

    if (currentRoom && currentRoom.players.has(socket.id)) {
      const player = currentRoom.players.get(socket.id);
      player.color = validColor;
      io.to(currentRoom.id).emit("state", snapshot(currentRoom));
    }

    if (typeof callback === "function") {
      callback({ ok: true, color: validColor });
    }
  });

  // 3. Sinkronisasi Input Pergerakan Instan (Zero-Delay Broadcast)
  socket.on("input", input => {
    if (!currentRoom || currentRoom.paused || currentRoom.level.isGameOver) {
      return;
    }

    const player = currentRoom.players.get(socket.id);
    if (!player || !input || typeof input !== "object") return;

    const nextLeft = input.left === true;
    const nextRight = input.right === true;
    const nextJump = input.jump === true;

    const changed =
      player.keysPressed.left !== nextLeft ||
      player.keysPressed.right !== nextRight ||
      player.keysPressed.jump !== nextJump;

    player.keysPressed.left = nextLeft;
    player.keysPressed.right = nextRight;
    player.keysPressed.jump = nextJump;

    player.input.left = nextLeft;
    player.input.right = nextRight;
    player.input.jump = nextJump;

    if (nextJump && !player.previousJump) {
      player.jumpQueued = true;
    }
    player.previousJump = nextJump;

    if (!currentRoom.level.allForOne) {
      const moveDir = Number(nextRight) - Number(nextLeft);
      if (moveDir !== 0) {
        player.facing = moveDir > 0 ? 1 : -1;
        player.dir = player.facing;
      }
    }

    if (changed) {
      if (currentRoom.level.allForOne) {
        evaluateAllForOneConsensus(currentRoom, 0);
      }
      socket.broadcast.to(currentRoom.id).emit("state", snapshot(currentRoom));
    }
  });

  // Sinkronisasi tambahan jika client mengirimkan update arah/koordinat eksplisit
  socket.on("playerUpdate", payload => {
    if (!currentRoom || currentRoom.paused || currentRoom.level.isGameOver) {
      return;
    }
    const player = currentRoom.players.get(socket.id);
    if (!player || !payload || typeof payload !== "object") return;

    if (typeof payload.dir === "number" && payload.dir !== 0) {
      player.facing = payload.dir > 0 ? 1 : -1;
      player.dir = player.facing;
    }
    socket.broadcast.to(currentRoom.id).emit("state", snapshot(currentRoom));
  });

  // 4. Trigger Jembatan Runtuh Permanen dari Client (mengunci balok agar hancur permanen)
  socket.on("triggerCrumble", bridgeId => {
    if (!currentRoom || currentRoom.paused || currentRoom.level.isGameOver) {
      return;
    }
    const cp = currentRoom.level.crumblingPlatforms.find(
      b => b.id === String(bridgeId)
    );
    if (cp && !cp.triggered && !cp.fallen) {
      cp.triggered = true;
      io.to(currentRoom.id).emit("state", snapshot(currentRoom));
    }
  });

  // 5. Laporan Kematian Karakter dari Client (Laser / Hantu) -> Freeze 2000ms + Auto resetLevel()
  socket.on("playerDied", (cause = "hazard") => {
    if (!currentRoom || currentRoom.paused || currentRoom.level.isGameOver) {
      return;
    }
    const player = currentRoom.players.get(socket.id);
    if (player && !player.exited) {
      triggerDeathWithDelay(currentRoom, player, String(cause));
    }
  });

  // 6. Klik / Tap Item Jam Penambah Waktu (+5s / +10s) pada Tema 3
  socket.on("clickTimeItem", itemId => {
    if (!currentRoom || currentRoom.paused || currentRoom.level.isGameOver) {
      return;
    }
    const player = currentRoom.players.get(socket.id);
    if (!player || player.isDead) return;

    const targetItem = currentRoom.level.timeItems.find(
      ti => ti.id === String(itemId) && !ti.collected
    );
    if (targetItem) {
      collectTimeBonusItem(currentRoom, targetItem);
      io.to(currentRoom.id).emit("state", snapshot(currentRoom));
    }
  });

  // 7. HAK EKSKLUSIF HOST: Pause / Resume Permainan
  socket.on("setPaused", (pausedState, callback) => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Hanya Host yang berhak menjeda game." });
      }
      return;
    }

    currentRoom.paused = Boolean(pausedState);
    if (currentRoom.paused) {
      for (const p of currentRoom.players.values()) {
        p.keysPressed.left = false;
        p.keysPressed.right = false;
        p.keysPressed.jump = false;
        p.input.left = false;
        p.input.right = false;
        p.input.jump = false;
        p.jumpQueued = false;
      }
    }

    io.to(currentRoom.id).emit("state", snapshot(currentRoom));
    if (typeof callback === "function") {
      callback({ ok: true, paused: currentRoom.paused });
    }
  });

  // 8. HAK EKSKLUSIF HOST: Reset Level ke Spawn Point Asal
  socket.on("restartLevel", callback => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Hanya Host yang berhak mereset level." });
      }
      return;
    }

    currentRoom.paused = false;
    resetLevel(currentRoom);

    if (typeof callback === "function") {
      callback({ ok: true });
    }
  });

  // 9. HAK EKSKLUSIF HOST: Pilih Level (1-1 s/d 5-4)
  socket.on("selectLevel", (targetIndex, callback) => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "Hanya Host yang berhak mengganti level." });
      }
      return;
    }

    const idx = Number(targetIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= LEVELS.length) return;

    currentRoom.paused = false;
    loadLevelForRoom(currentRoom, idx);
    io.to(currentRoom.id).emit("levelReset", {
      roomId: currentRoom.id,
      levelIndex: idx
    });
    io.to(currentRoom.id).emit("state", snapshot(currentRoom));

    if (typeof callback === "function") {
      callback({ ok: true, levelIndex: idx });
    }
  });

  // 10. Penanganan Keluar Room & Disconnect (Estafet Host & Distribusi Ulang Tameng)
  socket.on("leaveGame", () => {
    if (!currentRoom) return;
    removePlayerFromRoom(socket, currentRoom);
    currentRoom = null;
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;
    removePlayerFromRoom(socket, currentRoom);
    currentRoom = null;
  });
});

function removePlayerFromRoom(socket, room) {
  room.players.delete(socket.id);
  socket.leave(room.id);

  if (room.players.size === 0) {
    clearDeathTimeout(room);
    rooms.delete(room.id);
    return;
  }

  // Jika Host keluar, angkat pemain berikutnya sebagai Host baru & buka kunci pause
  if (room.hostId === socket.id) {
    room.hostId = null;
    room.paused = false;
  }

  syncRoomHostStatus(room);

  // Hitung ulang pembagian peran tameng horizontal/vertikal agar tetap seimbang
  distributeShieldRoles(room, false);

  // Periksa kembali apakah seluruh pemain aktif yang tersisa sudah masuk pintu keluar
  const st = room.level;
  const remainingPlayers = [...room.players.values()];
  if (
    st.keyCollected &&
    !st.cleared &&
    remainingPlayers.length > 0 &&
    remainingPlayers.every(p => p.isFinished === true && p.exited === true)
  ) {
    st.cleared = true;
    st.levelCleared = true;
    st.clearTimer = 2.0;

    io.to(room.id).emit("levelCleared", {
      roomId: room.id,
      levelIndex: room.levelIndex,
      code: st.code
    });
  }

  io.to(room.id).emit("state", snapshot(room));
}

// ============================================================================
// GAME LOOP UTAMA 60 FPS & BINDING SERVER KE 0.0.0.0:3000
// ============================================================================
setInterval(() => {
  for (const room of rooms.values()) {
    updateRoomSimulation(room, DT);
    io.to(room.id).emit("state", snapshot(room));
  }
}, 1000 / TICK_RATE);

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        list.push(iface.address);
      }
    }
  }
  return list;
}

http.listen(PORT, HOST, () => {
  const ips = getLocalIPv4Addresses();
  console.log("=========================================================");
  console.log(`⚡ CATBOUND CYBERPUNK SERVER ONLINE (${HOST}:${PORT})`);
  console.log(`💻 Browser PC / Laptop : http://localhost:${PORT}`);
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(`📱 Browser HP (Wi-Fi)  : http://${ip}:${PORT}`);
    });
  } else {
    console.log(`📱 Browser HP (Wi-Fi)  : http://<IP-LOKAL-PC>:${PORT}`);
  }
  console.log("=========================================================");
});