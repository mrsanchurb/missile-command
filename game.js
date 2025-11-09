// Game Configuration
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Responsive canvas sizing
let GROUND_Y;
let CITY_WIDTH;
let CITY_HEIGHT;
let BASE_WIDTH;
let BASE_HEIGHT;
let EXPLOSION_MAX_RADIUS;

// Constants that don't change
const INITIAL_AMMO = 10;
const EXPLOSION_GROWTH_RATE = 2;
const EXPLOSION_DURATION = 80;

// Game State
let gameState = {
  running: false,
  score: 0,
  level: 1,
  highScore: localStorage.getItem("missileCommandHighScore") || 0,
  levelUpMessage: null,
  levelUpTimer: 0,
  levelTransitioning: false, // Prevent multiple level completions
  waveActive: false, // Track if a wave is in progress
  gameStarted: false, // Track if game has been started at least once
  timeOfDay: "morning", // Current time of day
  dayTransitionProgress: 0, // 0-1 progress through current time period
  screenShake: 0, // Screen shake effect intensity
  screenShakeDecay: 0.9, // How quickly screen shake fades
};

// Game Objects
let cities = [];
let bases = [];
let playerMissiles = [];
let enemyMissiles = [];
let explosions = [];
let particles = [];

// Function to resize canvas and recalculate dimensions
function resizeCanvas() {
  const container = document.querySelector(".container");
  const maxWidth = window.innerWidth - 40;
  const maxHeight = window.innerHeight - 300; // Leave space for UI

  // Set canvas size based on available space, maintaining aspect ratio
  const aspectRatio = 4 / 3;
  let width = Math.min(maxWidth, 1200);
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  canvas.width = width;
  canvas.height = height;

  // Recalculate proportional dimensions
  GROUND_Y = canvas.height - canvas.height * 0.083; // ~50px at 600px height
  CITY_WIDTH = canvas.width * 0.05; // ~40px at 800px width
  CITY_HEIGHT = canvas.height * 0.05; // ~30px at 600px height
  BASE_WIDTH = canvas.width * 0.0625; // ~50px at 800px width
  BASE_HEIGHT = canvas.height * 0.033; // ~20px at 600px height
  EXPLOSION_MAX_RADIUS = canvas.height * 0.1; // ~60px at 600px height

  // Reinitialize defenses with new dimensions
  if (cities.length > 0 || bases.length > 0) {
    const wasRunning = gameState.running;
    const oldCities = cities.map((c) => ({ ...c }));
    const oldBases = bases.map((b) => ({ ...b }));

    initializeDefenses();

    // Preserve state if game was running
    if (wasRunning) {
      cities.forEach((city, i) => {
        if (oldCities[i]) city.alive = oldCities[i].alive;
      });
      bases.forEach((base, i) => {
        if (oldBases[i]) {
          base.alive = oldBases[i].alive;
          base.ammo = oldBases[i].ammo;
        }
      });
    }
  }
}

// Day/Night Cycle System - Removed for simplified gameplay
// Keeping a fixed daytime background for consistent visual experience

// Day/Night Cycle System
function updateTimeOfDay() {
  // Cycle through times of day based on level
  const level = gameState.level;
  const cycleLength = 5; // Levels per complete cycle
  const levelInCycle = (level - 1) % cycleLength;

  if (levelInCycle === 0) {
    gameState.timeOfDay = "morning";
  } else if (levelInCycle === 1) {
    gameState.timeOfDay = "noon";
  } else if (levelInCycle === 2) {
    gameState.timeOfDay = "afternoon";
  } else if (levelInCycle === 3) {
    gameState.timeOfDay = "evening";
  } else if (levelInCycle === 4) {
    gameState.timeOfDay = "night";
  }

  // Smooth transition progress (0-1)
  gameState.dayTransitionProgress = 0;
}

function getBackgroundGradient() {
  const progress = gameState.dayTransitionProgress;
  let topColor, bottomColor;

  switch (gameState.timeOfDay) {
    case "morning":
      // Light blue to soft blue
      topColor = interpolateColor("#87CEEB", "#4169E1", progress);
      bottomColor = interpolateColor("#FFF8DC", "#1e3a8a", progress);
      break;
    case "noon":
      // Bright blue to deep blue
      topColor = interpolateColor("#00BFFF", "#000080", progress);
      bottomColor = interpolateColor("#F0F8FF", "#000033", progress);
      break;
    case "afternoon":
      // Warm orange to deep blue
      topColor = interpolateColor("#FF8C00", "#191970", progress);
      bottomColor = interpolateColor("#FFE4B5", "#000033", progress);
      break;
    case "evening":
      // Orange-red to purple
      topColor = interpolateColor("#FF4500", "#4B0082", progress);
      bottomColor = interpolateColor("#FFDAB9", "#2F1B14", progress);
      break;
    case "night":
      // Dark purple to black
      topColor = interpolateColor("#2F1B69", "#000000", progress);
      bottomColor = interpolateColor("#1a1a2e", "#000000", progress);
      break;
    default:
      topColor = "#000033";
      bottomColor = "#000011";
  }

  return { topColor, bottomColor };
}

function interpolateColor(color1, color2, factor) {
  // Convert hex to RGB
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Initial canvas setup
resizeCanvas(); // City and Base Positions
function initializeDefenses() {
  const citySpacing = canvas.width / 8;
  const baseSpacing = canvas.width / 3;

  cities = [
    {
      x: citySpacing * 1 - CITY_WIDTH / 2,
      y: GROUND_Y,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    },
    {
      x: citySpacing * 2 - CITY_WIDTH / 2,
      y: GROUND_Y,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    },
    {
      x: citySpacing * 3 - CITY_WIDTH / 2,
      y: GROUND_Y,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    },
    {
      x: citySpacing * 5 - CITY_WIDTH / 2,
      y: GROUND_Y,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    },
    {
      x: citySpacing * 6 - CITY_WIDTH / 2,
      y: GROUND_Y,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    },
    {
      x: citySpacing * 7 - CITY_WIDTH / 2,
      y: GROUND_Y,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    },
  ];

  bases = [
    {
      x: baseSpacing * 0.5 - BASE_WIDTH / 2,
      y: GROUND_Y,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      ammo: INITIAL_AMMO,
      alive: true,
    },
    {
      x: baseSpacing * 1.5 - BASE_WIDTH / 2,
      y: GROUND_Y,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      ammo: INITIAL_AMMO,
      alive: true,
    },
    {
      x: baseSpacing * 2.5 - BASE_WIDTH / 2,
      y: GROUND_Y,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      ammo: INITIAL_AMMO,
      alive: true,
    },
  ];
}

// Player Missile Class
class PlayerMissile {
  constructor(startX, startY, targetX, targetY) {
    this.x = startX;
    this.y = startY;
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.speed = canvas.height * 0.0083; // ~5px at 600px height
    this.trail = [];
    this.trailParticles = [];

    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / distance) * this.speed;
    this.vy = (dy / distance) * this.speed;
    this.reached = false;
  }

  update() {
    if (this.reached) return;

    // Add current position to trail
    this.trail.push({ x: this.x, y: this.y, life: 30 });
    if (this.trail.length > 20) this.trail.shift();

    // Update trail particles
    this.trailParticles = this.trailParticles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      return particle.life > 0;
    });

    // Occasionally add trail particles
    if (Math.random() < 0.3) {
      this.trailParticles.push({
        x: this.x + (Math.random() - 0.5) * 4,
        y: this.y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 15 + Math.random() * 10,
      });
    }

    this.x += this.vx;
    this.y += this.vy;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.speed) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.reached = true;
      explosions.push(new Explosion(this.x, this.y, true));
    }
  }

  draw() {
    // Draw trail particles
    this.trailParticles.forEach((particle) => {
      const alpha = particle.life / 30;
      ctx.fillStyle = `rgba(100, 255, 100, ${alpha * 0.6})`;
      ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2);
    });

    // Draw enhanced trail
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const point = this.trail[i];
      const alpha = point.life / 30;
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineTo(point.x, point.y);
      }
      point.life--; // Age the trail point
    }
    ctx.stroke();

    // Draw missile with glow
    if (!this.reached) {
      // Glow effect
      ctx.shadowColor = "#00ff00";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(this.x - 3, this.y - 3, 6, 6);
      ctx.shadowBlur = 0; // Reset shadow
    }
  }
}

// Enemy Missile Class
class EnemyMissile {
  constructor(level) {
    this.x = Math.random() * canvas.width;
    this.y = 0;
    this.targetX = Math.random() * canvas.width;
    this.targetY = GROUND_Y;

    // Progressive speed increase - starts very slow, gradually gets faster
    // Level 1: 0.3, Level 5: 0.5, Level 10: 0.75, Level 20: 1.25
    this.speed = 0.3 + (level - 1) * 0.05;
    this.trail = [];
    this.trailParticles = [];

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / distance) * this.speed;
    this.vy = (dy / distance) * this.speed;
  }

  update() {
    // Add current position to trail
    this.trail.push({ x: this.x, y: this.y, life: 25 });
    if (this.trail.length > 25) this.trail.shift();

    // Update trail particles
    this.trailParticles = this.trailParticles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      return particle.life > 0;
    });

    // Occasionally add trail particles
    if (Math.random() < 0.2) {
      this.trailParticles.push({
        x: this.x + (Math.random() - 0.5) * 3,
        y: this.y + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 20 + Math.random() * 15,
      });
    }

    this.x += this.vx;
    this.y += this.vy;

    return this.y >= this.targetY;
  }

  draw() {
    // Draw trail particles
    this.trailParticles.forEach((particle) => {
      const alpha = particle.life / 35;
      ctx.fillStyle = `rgba(255, 100, 100, ${alpha * 0.5})`;
      ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2);
    });

    // Draw enhanced trail
    ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const point = this.trail[i];
      const alpha = point.life / 25;
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.strokeStyle = `rgba(255, 0, 0, ${alpha * 0.6})`;
        ctx.lineTo(point.x, point.y);
      }
      point.life--; // Age the trail point
    }
    ctx.stroke();

    // Draw missile with glow
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    ctx.shadowBlur = 0; // Reset shadow
  }
}

// Explosion Class
class Explosion {
  constructor(x, y, isPlayer = false) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = isPlayer ? EXPLOSION_MAX_RADIUS : 40;
    this.growing = true;
    this.life = EXPLOSION_DURATION;
    this.isPlayer = isPlayer;
    this.particlesGenerated = false;
    this.shockwaveRadius = 0;
    this.shockwaveMaxRadius = isPlayer ? EXPLOSION_MAX_RADIUS * 1.5 : 60;
  }

  update() {
    if (this.growing) {
      this.radius += EXPLOSION_GROWTH_RATE;
      this.shockwaveRadius += EXPLOSION_GROWTH_RATE * 0.7;
      if (this.radius >= this.maxRadius) {
        this.growing = false;
        // Generate particles when explosion reaches max size
        this.generateParticles();
      }
    } else {
      this.life--;
      // Continue shockwave expansion
      if (this.shockwaveRadius < this.shockwaveMaxRadius) {
        this.shockwaveRadius += EXPLOSION_GROWTH_RATE * 0.3;
      }
    }
    return this.life > 0;
  }

  generateParticles() {
    if (this.particlesGenerated) return;
    this.particlesGenerated = true;

    const particleCount = this.isPlayer ? 20 : 12; // More particles for player explosions

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 3 + Math.random() * 4;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - Math.random() * 3; // Some upward bias

      let color;
      if (this.isPlayer) {
        // More varied colors for player explosions
        const colors = [
          "rgb(255, 255, 0)",
          "rgb(255, 200, 0)",
          "rgb(255, 100, 0)",
          "rgb(255, 255, 100)",
        ];
        color = colors[Math.floor(Math.random() * colors.length)];
      } else {
        // Red/orange tones for enemy explosions
        const colors = [
          "rgb(255, 100, 100)",
          "rgb(255, 50, 50)",
          "rgb(200, 50, 50)",
          "rgb(255, 150, 50)",
        ];
        color = colors[Math.floor(Math.random() * colors.length)];
      }

      const life = 70 + Math.random() * 50; // 1.2-2 seconds at 60fps
      const size = 1.5 + Math.random() * 2.5;

      particles.push(new Particle(this.x, this.y, vx, vy, color, life, size));
    }
  }

  draw() {
    const alpha = this.life / EXPLOSION_DURATION;

    // Draw shockwave ring
    if (this.shockwaveRadius > 0) {
      const shockwaveAlpha =
        Math.max(
          0,
          (this.shockwaveMaxRadius - this.shockwaveRadius) /
            this.shockwaveMaxRadius
        ) * 0.4;
      ctx.strokeStyle = this.isPlayer
        ? `rgba(255, 255, 255, ${shockwaveAlpha})`
        : `rgba(255, 100, 100, ${shockwaveAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw main explosion with multiple gradients
    if (this.radius > 0) {
      // Outer glow
      const outerGradient = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.radius * 1.2
      );
      if (this.isPlayer) {
        outerGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`);
        outerGradient.addColorStop(0.7, `rgba(255, 200, 0, ${alpha * 0.2})`);
        outerGradient.addColorStop(1, `rgba(255, 100, 0, ${alpha * 0.1})`);
      } else {
        outerGradient.addColorStop(0, `rgba(255, 150, 150, ${alpha * 0.3})`);
        outerGradient.addColorStop(0.7, `rgba(255, 50, 50, ${alpha * 0.2})`);
        outerGradient.addColorStop(1, `rgba(200, 0, 0, ${alpha * 0.1})`);
      }
      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Main explosion
      const gradient = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.radius
      );

      if (this.isPlayer) {
        gradient.addColorStop(0, `rgba(255, 255, 100, ${alpha})`);
        gradient.addColorStop(0.3, `rgba(255, 200, 0, ${alpha * 0.9})`);
        gradient.addColorStop(0.7, `rgba(255, 100, 0, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 50, 0, ${alpha * 0.2})`);
      } else {
        gradient.addColorStop(0, `rgba(255, 150, 150, ${alpha})`);
        gradient.addColorStop(0.3, `rgba(255, 100, 100, ${alpha * 0.9})`);
        gradient.addColorStop(0.7, `rgba(255, 50, 50, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(200, 0, 0, ${alpha * 0.2})`);
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      const coreGradient = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.radius * 0.3
      );
      if (this.isPlayer) {
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
        coreGradient.addColorStop(1, `rgba(255, 255, 0, ${alpha * 0.4})`);
      } else {
        coreGradient.addColorStop(0, `rgba(255, 200, 200, ${alpha * 0.8})`);
        coreGradient.addColorStop(1, `rgba(255, 100, 100, ${alpha * 0.4})`);
      }
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  checkCollision(missile) {
    const dx = missile.x - this.x;
    const dy = missile.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius;
  }
}

// Particle Class for enhanced visual effects
class Particle {
  constructor(x, y, vx, vy, color, life, size = 2) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.gravity = 0.1; // Gravity effect for debris
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity; // Apply gravity
    this.life--;
    return this.life > 0;
  }

  draw() {
    const alpha = this.life / this.maxLife;
    ctx.fillStyle = this.color
      .replace("rgb", "rgba")
      .replace(")", `, ${alpha})`);
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );
  }
}

// Drawing Functions
function drawGround() {
  ctx.fillStyle = "#2a4a2a";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

  ctx.strokeStyle = "#3a5a3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();
}

function drawCities() {
  cities.forEach((city) => {
    if (city.alive) {
      ctx.fillStyle = "#00aaff";
      ctx.fillRect(city.x, city.y - city.height, city.width, city.height);

      // Building details
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillRect(
            city.x + 5 + i * 12,
            city.y - city.height + 5 + j * 6,
            6,
            4
          );
        }
      }
    }
  });
}

function drawBases() {
  bases.forEach((base) => {
    if (base.alive) {
      // Base structure
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(base.x, base.y - base.height, base.width, base.height);

      // Turret
      ctx.fillStyle = "#ff8800";
      ctx.beginPath();
      ctx.arc(base.x + base.width / 2, base.y - base.height, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawAmmoDisplay() {
  bases.forEach((base, index) => {
    const ammoElement = document.getElementById(
      ["leftAmmo", "centerAmmo", "rightAmmo"][index]
    );
    ammoElement.innerHTML = "";
    if (base.alive) {
      // Show infinity symbol for infinite ammo
      const infinitySymbol = document.createElement("div");
      infinitySymbol.textContent = "∞";
      infinitySymbol.style.fontSize = "16px";
      infinitySymbol.style.color = "#00ff00";
      infinitySymbol.style.textShadow = "0 0 5px #00ff00";
      infinitySymbol.style.fontWeight = "bold";
      ammoElement.appendChild(infinitySymbol);
    }
  });
}

// Game Logic
function findNearestBase(x) {
  let nearestBase = null;
  let minDistance = Infinity;

  bases.forEach((base) => {
    if (base.alive) {
      // Only check if base is alive (infinite ammo)
      const distance = Math.abs(x - (base.x + base.width / 2));
      if (distance < minDistance) {
        minDistance = distance;
        nearestBase = base;
      }
    }
  });

  return nearestBase;
}

function fireMissile(targetX, targetY) {
  const base = findNearestBase(targetX);
  if (base && base.alive) {
    // Only check if base is alive, not ammo
    const startX = base.x + base.width / 2;
    const startY = base.y - base.height;
    playerMissiles.push(new PlayerMissile(startX, startY, targetX, targetY));
    // Removed ammo consumption for infinite missiles
    // base.ammo--;
    drawAmmoDisplay();
  }
}

function spawnEnemyMissiles() {
  // Progressive missile count increase - starts with 10 missiles for beginners
  // Level 1: 10 missiles, Level 2: 11, Level 3: 12, etc.
  // Formula: Start with 10, add 1 every level
  const missilesPerWave = 10 + (gameState.level - 1);

  // Progressive spawn delay - decreases slowly with level
  // Level 1: 1200ms, Level 10: 900ms, Level 20: 700ms
  const spawnDelay = Math.max(600, 1200 - (gameState.level - 1) * 25);

  // Spawn first missile immediately
  enemyMissiles.push(new EnemyMissile(gameState.level));

  // Spawn remaining missiles with delay
  for (let i = 1; i < missilesPerWave; i++) {
    setTimeout(() => {
      if (gameState.running && gameState.waveActive) {
        enemyMissiles.push(new EnemyMissile(gameState.level));
      }
    }, i * spawnDelay);
  }

  // Mark wave as active AFTER spawning first missile
  gameState.waveActive = true;
  gameState.levelTransitioning = false;
}
function checkCollisions() {
  // Check enemy missiles hit by explosions
  for (let i = enemyMissiles.length - 1; i >= 0; i--) {
    let destroyed = false;
    for (const explosion of explosions) {
      if (explosion.checkCollision(enemyMissiles[i])) {
        enemyMissiles.splice(i, 1);
        gameState.score += 25;
        destroyed = true;
        break;
      }
    }
  }

  // Check if enemy missiles hit cities or bases
  for (let i = enemyMissiles.length - 1; i >= 0; i--) {
    const missile = enemyMissiles[i];

    // Check cities
    cities.forEach((city) => {
      if (city.alive) {
        if (
          missile.x >= city.x &&
          missile.x <= city.x + city.width &&
          missile.y >= city.y - city.height &&
          missile.y <= city.y
        ) {
          city.alive = false;
          // Trigger screen shake when city is destroyed
          gameState.screenShake = Math.max(gameState.screenShake, 12);
          explosions.push(
            new Explosion(
              city.x + city.width / 2,
              city.y - city.height / 2,
              false
            )
          );
          enemyMissiles.splice(i, 1);
        }
      }
    });

    // Check bases
    if (i >= 0 && enemyMissiles[i]) {
      bases.forEach((base) => {
        if (base.alive) {
          if (
            missile.x >= base.x &&
            missile.x <= base.x + base.width &&
            missile.y >= base.y - base.height &&
            missile.y <= base.y
          ) {
            base.alive = false;
            explosions.push(
              new Explosion(
                base.x + base.width / 2,
                base.y - base.height / 2,
                false
              )
            );
            enemyMissiles.splice(i, 1);
          }
        }
      });
    }
  }
}

function checkGameOver() {
  const allCitiesDestroyed = cities.every((city) => !city.alive);
  const allBasesDestroyed = bases.every((base) => !base.alive);

  if (allCitiesDestroyed || allBasesDestroyed) {
    endGame();
  }
}

function checkLevelComplete() {
  // Only check if wave is active, all missiles are gone, and not already transitioning
  if (
    enemyMissiles.length === 0 &&
    gameState.waveActive &&
    !gameState.levelTransitioning &&
    gameState.running
  ) {
    // Mark as transitioning to prevent multiple triggers
    gameState.levelTransitioning = true;
    gameState.waveActive = false;

    // Bonus for surviving cities - increases with level
    const survivingCities = cities.filter((c) => c.alive).length;
    const cityBonus = survivingCities * (50 + gameState.level * 10);
    gameState.score += cityBonus;

    // Removed ammo bonus since we now have infinite missiles
    // const remainingAmmo = bases.reduce((sum, base) => sum + base.ammo, 0);
    // gameState.score += remainingAmmo * (5 + gameState.level);

    // Level completion bonus
    gameState.score += gameState.level * 25;

    // Start next level
    const previousLevel = gameState.level;
    gameState.level++;

    // Update time of day for new level
    updateTimeOfDay();

    // Show level up message
    gameState.levelUpMessage = `LEVEL ${previousLevel} COMPLETE! Level ${
      gameState.level
    } - ${
      gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1)
    }`;
    gameState.levelUpTimer = 120; // Show for 2 seconds (120 frames at 60fps)

    updateUI();

    // Replenish ammo for surviving bases
    bases.forEach((base) => {
      if (base.alive) {
        base.ammo = INITIAL_AMMO;
      }
    });
    drawAmmoDisplay();

    // Wait 2 seconds before spawning next wave
    setTimeout(() => {
      if (gameState.running) {
        spawnEnemyMissiles();
      }
    }, 2000);
  }
}

function updateUI() {
  document.getElementById("score").textContent = gameState.score;
  document.getElementById("level").textContent = gameState.level;
  document.getElementById("highScore").textContent = gameState.highScore;
}

function endGame() {
  gameState.running = false;

  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score;
    localStorage.setItem("missileCommandHighScore", gameState.highScore);
  }

  document.getElementById("finalScore").textContent = gameState.score;
  document.getElementById("gameOverScreen").classList.remove("hidden");

  // Make sure instructions stay hidden during game over
  document.getElementById("instructions").classList.add("hidden");
}

function startGame() {
  gameState.running = true;
  gameState.score = 0;
  gameState.level = 1;
  gameState.levelTransitioning = false;
  gameState.waveActive = false;
  gameState.gameStarted = true; // Mark that game has started
  gameState.levelUpMessage = null; // Clear any previous level up message
  gameState.levelUpTimer = 0; // Reset level up timer

  // Initialize time of day
  updateTimeOfDay();

  playerMissiles = [];
  enemyMissiles = [];
  explosions = [];

  initializeDefenses();
  updateUI();
  drawAmmoDisplay();

  // Always hide both modals when starting game
  document.getElementById("gameOverScreen").classList.add("hidden");
  document.getElementById("instructions").classList.add("hidden");

  spawnEnemyMissiles();
}

// Game Loop
function gameLoop() {
  // Update day transition progress
  if (gameState.dayTransitionProgress < 1) {
    gameState.dayTransitionProgress += 0.005; // Smooth transition over ~200 frames
  }

  // Update screen shake
  gameState.screenShake *= gameState.screenShakeDecay;
  if (gameState.screenShake < 0.1) gameState.screenShake = 0;

  // Apply screen shake
  const shakeX = (Math.random() - 0.5) * gameState.screenShake;
  const shakeY = (Math.random() - 0.5) * gameState.screenShake;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Draw background gradient
  const { topColor, bottomColor } = getBackgroundGradient();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw stars (more visible at night)
  let starOpacity = 0.3; // Default for day
  if (gameState.timeOfDay === "night" || gameState.timeOfDay === "evening") {
    starOpacity = gameState.timeOfDay === "night" ? 0.8 : 0.5;
  }

  ctx.fillStyle = `rgba(255, 255, 255, ${starOpacity})`;
  const starCount = Math.floor(canvas.width / 16);
  for (let i = 0; i < starCount; i++) {
    const x = (i * 137) % canvas.width;
    const y = (i * 97) % (GROUND_Y - canvas.height * 0.083);
    ctx.fillRect(x, y, 1, 1);
  }

  // Add some twinkling stars at night
  if (gameState.timeOfDay === "night") {
    ctx.fillStyle = `rgba(255, 255, 255, ${
      0.6 + Math.sin(Date.now() * 0.001) * 0.2
    })`;
    for (let i = 0; i < 20; i++) {
      const x = (i * 47) % canvas.width;
      const y = (i * 73) % (GROUND_Y - canvas.height * 0.083);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  drawGround();
  drawCities();
  drawBases();

  // Draw level info on canvas
  if (gameState.running) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10, 10, 200, 80);

    ctx.fillStyle = "#00ff00";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`Level ${gameState.level}`, 20, 30);
    ctx.fillText(
      `${
        gameState.timeOfDay.charAt(0).toUpperCase() +
        gameState.timeOfDay.slice(1)
      }`,
      20,
      50
    );

    const missilesPerWave = 10 + (gameState.level - 1);
    ctx.fillStyle = "#ffaa00";
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillText(`Missiles: ${missilesPerWave}`, 20, 70);
    ctx.fillText(
      `Speed: ${(0.3 + (gameState.level - 1) * 0.05).toFixed(2)}x`,
      20,
      85
    );
  }

  // Update and draw player missiles
  playerMissiles = playerMissiles.filter((missile) => {
    missile.update();
    missile.draw();
    return !missile.reached;
  });

  // Update and draw enemy missiles
  if (gameState.running) {
    for (let i = enemyMissiles.length - 1; i >= 0; i--) {
      const missile = enemyMissiles[i];
      if (missile.update()) {
        // Trigger screen shake when missile hits ground
        gameState.screenShake = Math.max(gameState.screenShake, 8);
        explosions.push(new Explosion(missile.targetX, missile.targetY, false));
        enemyMissiles.splice(i, 1);
      } else {
        missile.draw();
      }
    }
  }

  // Update and draw explosions
  explosions = explosions.filter((explosion) => {
    const alive = explosion.update();
    explosion.draw();
    return alive;
  });

  // Update and draw particles
  particles = particles.filter((particle) => {
    const alive = particle.update();
    particle.draw();
    return alive;
  });

  // Check collisions
  if (gameState.running) {
    checkCollisions();
    checkGameOver();
    checkLevelComplete();
  }

  // Draw level up message
  if (gameState.levelUpTimer > 0) {
    gameState.levelUpTimer--;
    const alpha = Math.min(1, gameState.levelUpTimer / 30);

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
    ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);

    ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
    ctx.font = "bold 48px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      gameState.levelUpMessage,
      canvas.width / 2,
      canvas.height / 2 - 10
    );

    ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
    ctx.font = "20px 'Courier New', monospace";
    const missilesPerWave = 10 + (gameState.level - 1);
    ctx.fillText(
      `${missilesPerWave} Missiles - Speed ${(
        0.3 +
        (gameState.level - 1) * 0.05
      ).toFixed(2)}x`,
      canvas.width / 2,
      canvas.height / 2 + 30
    );

    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  updateUI();
  updateBodyBackground(); // Keep body background in sync

  ctx.restore(); // Restore context after screen shake

  requestAnimationFrame(gameLoop);
}

// Event Listeners
canvas.addEventListener("click", (e) => {
  if (!gameState.running) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  fireMissile(x, y);
});

document.getElementById("restartBtn").addEventListener("click", startGame);

// Instructions modal click handler - start game when clicked
document.getElementById("instructions").addEventListener("click", () => {
  if (!gameState.running && !gameState.gameStarted) {
    startGame();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !gameState.running) {
    e.preventDefault();
    startGame();
  }
});

// Window resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    resizeCanvas();
    drawAmmoDisplay();
  }, 250);
});

function updateBodyBackground() {
  const { topColor, bottomColor } = getBackgroundGradient();
  document.body.style.background = `linear-gradient(to bottom, ${topColor}, ${bottomColor})`;
}

// Initialize
initializeDefenses();
updateUI();
drawAmmoDisplay();
updateBodyBackground(); // Set initial body background
gameLoop();
