/**
 * GameEngine - Main Game Loop & 2.5D Range Environment
 * Coordinates physics, canvas rendering, target simulation, weapon cycling,
 * input processing, and scoring logic at a buttery smooth 60 FPS.
 */

import { SoundController } from '../audio/SoundController.js';
import { ParticleSystem } from './Particles.js';
import { WeaponManager, WEAPON_TYPES } from '../weapons/WeaponManager.js';
import { TargetManager } from '../targets/TargetManager.js';
import { UIManager } from '../ui/UIManager.js';

export class GameEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.crosshairCanvas = document.getElementById('crosshairCanvas');
    this.crosshairCtx = this.crosshairCanvas.getContext('2d');

    // Subsystems
    this.sound = new SoundController();
    this.particles = new ParticleSystem();
    this.weapons = new WeaponManager(this.sound, this.particles);
    this.targets = new TargetManager(this.sound, this.particles);
    this.ui = new UIManager();

    // Mouse & Crosshair state
    this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Screen Shake System (Recoil)
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9;
    this.weaponShakeProfiles = {
      1: 1,   // Phím 1: Dao phóng - giật nhẹ 1px
      2: 2,   // Phím 2: Pistol - giật nhẹ 2px
      3: 4,   // Phím 3: AR-47 Spear - giật liên thanh 4px
      4: 6,   // Phím 4: MK-14 DMR - giật vừa 6px
      5: 14   // Phím 5: AWM Sniper - giật cực mạnh 14px
    };

    // Game Session State
    this.mode = 'timed'; // 'timed' or 'practice'
    this.duration = 60.0; // 60 seconds challenge
    this.timeRemaining = 60.0;
    this.isPlaying = false;
    this.score = 0;
    this.combo = 1.0;
    this.maxCombo = 1.0;
    this.comboTimer = 0;
    this.comboMaxTime = 2.4; // 2.4s combo window

    this.totalShots = 0;
    this.totalHits = 0;
    this.bullseyes = 0;

    this.lastTime = 0;

    // Sniper optical breathing sway
    this.breathTime = 0;

    this.initCanvasSize();
    this.setupEventListeners();
  }

  // Kích hoạt cường độ rung nảy theo vũ khí
  triggerScreenShake(weaponId) {
    const recoilPower = this.weaponShakeProfiles[weaponId] || 2;
    this.shakeIntensity = Math.min(this.shakeIntensity + recoilPower, 20);
  }

  initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.crosshairCanvas.width = this.width * dpr;
    this.crosshairCanvas.height = this.height * dpr;
    this.crosshairCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // Mouse coordinates tracking
    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    // Disable default context menu for smooth RMB aiming
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse Controls (LMB / RMB)
    window.addEventListener('mousedown', (e) => {
      this.sound.resume();

      if (e.button === 0) {
        // Left click: Fire / throw
        this.weapons.isMouseDown = true;
        this.handlePlayerFire();
      } else if (e.button === 2) {
        // Right click: Aim / ADS / Scope
        this.weapons.setAiming(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.weapons.isMouseDown = false;
      } else if (e.button === 2) {
        this.weapons.setAiming(false);
      }
    });

    // Mouse Wheel weapon switching
    window.addEventListener('wheel', (e) => {
      if (e.deltaY > 0) {
        this.weapons.nextWeapon();
      } else if (e.deltaY < 0) {
        this.weapons.prevWeapon();
      }
    }, { passive: true });

    // Keyboard controls: 1-5, R
    window.addEventListener('keydown', (e) => {
      this.sound.resume();

      if (e.key >= '1' && e.key <= '5') {
        this.weapons.switchWeapon(parseInt(e.key));
      } else if (e.key === 'r' || e.key === 'R') {
        this.weapons.reload();
      }
    });

    // Hotbar click selection
    for (let id = 1; id <= 5; id++) {
      const slotEl = document.getElementById(`slot-${id}`);
      if (slotEl) {
        slotEl.addEventListener('click', () => {
          this.weapons.switchWeapon(id);
        });
      }
    }

    // Modal button actions
    document.getElementById('startChallengeBtn').addEventListener('click', () => {
      this.startSession('timed');
    });

    document.getElementById('startPracticeBtn').addEventListener('click', () => {
      this.startSession('practice');
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
      this.startSession(this.mode);
    });

    document.getElementById('practiceAgainBtn').addEventListener('click', () => {
      this.startSession('practice');
    });
  }

  startSession(mode = 'timed') {
    this.mode = mode;
    this.timeRemaining = this.duration;
    this.score = 0;
    this.combo = 1.0;
    this.maxCombo = 1.0;
    this.comboTimer = 0;
    this.totalShots = 0;
    this.totalHits = 0;
    this.bullseyes = 0;
    this.shakeIntensity = 0;

    // Reset weapons and targets
    this.targets.reset();
    for (const w of Object.values(this.weapons.weapons)) {
      w.ammo = w.maxAmmo;
      w.isReloading = false;
    }
    for (const s of Object.values(this.weapons.stats)) {
      s.shots = 0;
      s.hits = 0;
      s.bullseyes = 0;
      s.score = 0;
    }

    this.isPlaying = true;
    this.ui.hideStartModal();
    this.ui.hideSummary();
  }

  endSession() {
    this.isPlaying = false;
    this.sound.playGameOver();

    const accuracy = this.totalShots > 0 ? (this.totalHits / this.totalShots) * 100 : 0;
    const bullseyeRate = this.totalHits > 0 ? (this.bullseyes / this.totalHits) * 100 : 0;

    this.ui.showSummary({
      score: this.score,
      accuracy,
      bullseyes: this.bullseyes,
      bullseyeRate,
      shots: this.totalShots,
      maxCombo: this.maxCombo
    }, this.weapons.stats);
  }

  handlePlayerFire() {
    if (!this.isPlaying) return;

    // Target hit resolution callback
    const onTargetHit = (hitX, hitY, wep, options) => {
      const result = this.targets.checkHit(hitX, hitY, wep, options);

      if (result.hit) {
        this.totalHits++;
        if (result.isBullseye) {
          this.bullseyes++;
          this.combo = Math.min(4.0, this.combo + 0.4);
        } else {
          this.combo = Math.min(3.0, this.combo + 0.15);
        }

        if (this.combo > this.maxCombo) {
          this.maxCombo = this.combo;
        }
        this.comboTimer = this.comboMaxTime;

        // Score with combo multiplier
        const awardedPoints = Math.round(result.score * this.combo);
        this.score += awardedPoints;

        this.weapons.recordHit(wep.id, result.isBullseye, awardedPoints);
        this.sound.playComboSound(Math.floor(this.combo * 2));
        this.ui.triggerHitmarker(result.isBullseye);

      } else {
        // Missed shot resets combo streak!
        if (this.combo > 1.0) {
          this.combo = 1.0;
        }
      }
    };

    // Calculate effective mouse target coordinates (with scope breathing sway)
    let targetX = this.mousePos.x;
    let targetY = this.mousePos.y;

    if (this.weapons.isAiming && this.weapons.currentWeapon.id === WEAPON_TYPES.SNIPER) {
      // Sniper scope breathing sway
      const swayX = Math.sin(this.breathTime * 1.6) * 4;
      const swayY = Math.cos(this.breathTime * 2.8) * 3;
      targetX += swayX;
      targetY += swayY;
    }

    const fired = this.weapons.fire(targetX, targetY, onTargetHit);
    if (fired) {
      this.totalShots++;
      // Kích hoạt rung màn hình khi khai hỏa
      this.triggerScreenShake(this.weapons.currentWeapon.id);

      if (this.weapons.currentWeapon.id !== WEAPON_TYPES.KNIFE) {
        this.ui.triggerMuzzleFlash();
      }
    }
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    this.breathTime += dt;

    if (this.isPlaying) {
      // Update Timer
      if (this.mode === 'timed') {
        this.timeRemaining -= dt;
        if (this.timeRemaining <= 0) {
          this.timeRemaining = 0;
          this.endSession();
        }
      }

      // Update Combo Timer
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.comboTimer = 0;
          this.combo = 1.0;
        }
      }

      // Difficulty scaling based on elapsed time
      const elapsed = this.duration - this.timeRemaining;
      const difficulty = 1.0 + (elapsed / this.duration) * 0.75;

      // Update Targets
      this.targets.update(dt, difficulty);
    }

    // Update Weapons
    this.weapons.update(dt, this.mousePos, (hitX, hitY, wep, opt) => {
      // Kích hoạt rung liên tục khi xả đạn tự động (AR-47)
      this.triggerScreenShake(wep.id);

      // Auto-fire continuous callback
      const result = this.targets.checkHit(hitX, hitY, wep, opt);
      if (result.hit) {
        this.totalHits++;
        if (result.isBullseye) {
          this.bullseyes++;
          this.combo = Math.min(4.0, this.combo + 0.3);
        } else {
          this.combo = Math.min(3.0, this.combo + 0.1);
        }
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.comboTimer = this.comboMaxTime;

        const pts = Math.round(result.score * this.combo);
        this.score += pts;
        this.weapons.recordHit(wep.id, result.isBullseye, pts);
        this.ui.triggerHitmarker(result.isBullseye);
      } else {
        this.combo = 1.0;
      }
    });

    // Update Particles & Casings
    this.particles.update(dt, this.sound);

    // Update UI HUD
    this.ui.updateHUD({
      score: this.score,
      timeRemaining: this.timeRemaining,
      combo: this.combo,
      comboTimer: this.comboTimer,
      comboMaxTime: this.comboMaxTime,
      mode: this.mode
    }, this.weapons);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Xóa sạch khung hình
    ctx.clearRect(0, 0, w, h);

    // Bắt đầu áp dụng rung màn hình theo vũ khí
    ctx.save();
    const effectiveShake = Math.max(this.shakeIntensity, this.weapons.cameraShake || 0);
    if (effectiveShake > 0.1) {
      const shakeX = (Math.random() - 0.5) * 2 * effectiveShake;
      const shakeY = (Math.random() - 0.5) * 2 * effectiveShake;
      ctx.translate(shakeX, shakeY);
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }

    // 1. Draw 2.5D Shooting Range Backdrop
    this.drawShootingRangeBackground(ctx, w, h);

    // 2. Draw Target Rails and Ceiling Infrastructure
    this.drawCeilingTrolleyRails(ctx, w, h);

    // 3. Render Targets
    this.targets.render(ctx);

    // 4. Render Particles, Shell Casings & Flying Knives
    this.particles.render(ctx);

    // 5. Draw Foreground Shooting Stall & Gun elements
    this.drawForegroundBooth(ctx, w, h);

    // Kết thúc bối cảnh rung
    ctx.restore();

    // 6. Render Crosshair on dedicated top canvas (Tâm ngắm không bị rung lệch khỏi vị trí chuột)
    this.crosshairCtx.clearRect(0, 0, w, h);
    this.ui.renderCrosshair(this.crosshairCtx, this.mousePos, this.weapons);
  }

  drawShootingRangeBackground(ctx, w, h) {
    const horizonY = h * 0.62;

    // Deep Tactical Back Wall Gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    wallGrad.addColorStop(0, '#0a0e17');
    wallGrad.addColorStop(0.5, '#121824');
    wallGrad.addColorStop(1, '#1b2333');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Wall Acoustic Panels & Grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    const panelSize = 60;
    for (let x = 0; x < w; x += panelSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, horizonY);
      ctx.stroke();
    }
    for (let y = 0; y < horizonY; y += panelSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Distance Yardage Banners on Back Wall (15M, 25M, 50M)
    ctx.font = 'bold 24px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.textAlign = 'center';
    ctx.fillText('RANGE LANE 07 - [ 25 METERS ]', w * 0.5, horizonY * 0.35);

    // Hazard Safety Stripes line at Horizon
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(0, horizonY - 6, w, 6);
    ctx.fillStyle = '#111';
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, horizonY - 6);
      ctx.lineTo(x + 10, horizonY - 6);
      ctx.lineTo(x + 4, horizonY);
      ctx.lineTo(x - 6, horizonY);
      ctx.closePath();
      ctx.fill();
    }

    // Concrete Shooting Range Floor with Perspective Lines
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    floorGrad.addColorStop(0, '#10141d');
    floorGrad.addColorStop(0.5, '#161c28');
    floorGrad.addColorStop(1, '#0b0e14');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Floor perspective planks / lane lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 2;
    const vanishX = w * 0.5;
    const vanishY = horizonY;

    for (let i = -6; i <= 6; i++) {
      const bottomX = vanishX + i * (w * 0.16);
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }
  }

  drawCeilingTrolleyRails(ctx, w, h) {
    const railY = h * 0.18;

    // Overhead steel girder
    ctx.fillStyle = '#141a24';
    ctx.fillRect(0, railY - 14, w, 18);

    // Metal rail highlight
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, railY + 4, w, 4);

    // Overhead spotlights shining down
    const spots = [w * 0.3, w * 0.5, w * 0.7];
    for (const sx of spots) {
      // Lamp fixture
      ctx.fillStyle = '#3182ce';
      ctx.fillRect(sx - 16, railY - 10, 32, 10);

      // Light cone beam
      const coneGrad = ctx.createRadialGradient(sx, railY, 10, sx, h * 0.5, 300);
      coneGrad.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
      coneGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(sx - 16, railY);
      ctx.lineTo(sx + 140, h * 0.65);
      ctx.lineTo(sx - 140, h * 0.65);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawForegroundBooth(ctx, w, h) {
    // Shooting bench / barricade edge at bottom screen
    const boothY = h - 28;
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, boothY, w, 28);

    // Non-slip rubber padded mat on bench
    ctx.fillStyle = '#101726';
    ctx.fillRect(0, boothY, w, 6);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, boothY);
    ctx.lineTo(w, boothY);
    ctx.stroke();
  }
}