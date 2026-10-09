/**
 * UIManager - HUD & UI State Controller
 * Manages dynamic crosshairs, weapon hotbar, ammo counters, combo bar,
 * scope overlays, muzzle flash effect, and the match summary modal.
 */

import { WEAPON_TYPES } from '../weapons/WeaponManager.js';

export class UIManager {
  constructor() {
    // Cache DOM Elements
    this.appContainer = document.getElementById('app-container');
    this.muzzleFlash = document.getElementById('muzzleFlash');
    this.sniperScopeOverlay = document.getElementById('sniperScopeOverlay');
    this.dmrVignette = document.getElementById('dmrVignette');
    this.crosshairCanvas = document.getElementById('crosshairCanvas');
    this.hitmarkerUI = document.getElementById('hitmarkerUI');

    // HUD Text Elements
    this.scoreVal = document.getElementById('scoreVal');
    this.timerVal = document.getElementById('timerVal');
    this.comboVal = document.getElementById('comboVal');
    this.comboBarFill = document.getElementById('comboBarFill');

    this.ammoCurrent = document.getElementById('ammoCurrent');
    this.ammoMax = document.getElementById('ammoMax');
    this.reloadStatus = document.getElementById('reloadStatus');
    this.reloadProgressBar = document.getElementById('reloadProgressBar');
    this.reloadBarFill = document.getElementById('reloadBarFill');

    // Hotbar slots
    this.slots = {
      [WEAPON_TYPES.KNIFE]: document.getElementById('slot-1'),
      [WEAPON_TYPES.PISTOL]: document.getElementById('slot-2'),
      [WEAPON_TYPES.AR]: document.getElementById('slot-3'),
      [WEAPON_TYPES.DMR]: document.getElementById('slot-4'),
      [WEAPON_TYPES.SNIPER]: document.getElementById('slot-5')
    };

    // Modals
    this.startModal = document.getElementById('startModal');
    this.summaryModal = document.getElementById('summaryModal');

    // Summary Elements
    this.summaryScore = document.getElementById('summaryScore');
    this.summaryAccuracy = document.getElementById('summaryAccuracy');
    this.summaryBullseyes = document.getElementById('summaryBullseyes');
    this.summaryShots = document.getElementById('summaryShots');
    this.summaryMaxCombo = document.getElementById('summaryMaxCombo');
    this.summaryRank = document.getElementById('summaryRank');
    this.summaryMvp = document.getElementById('summaryMvp');

    this.hitmarkerTimer = null;
  }

  updateHUD(gameState, weaponManager) {
    const wep = weaponManager.currentWeapon;

    // 1. Score & Timer
    this.scoreVal.textContent = gameState.score.toLocaleString();

    if (gameState.mode === 'timed') {
      const remaining = Math.max(0, Math.ceil(gameState.timeRemaining));
      this.timerVal.textContent = `00:${remaining < 10 ? '0' + remaining : remaining}`;
      if (remaining <= 10) {
        this.timerVal.classList.add('danger');
      } else {
        this.timerVal.classList.remove('danger');
      }
    } else {
      this.timerVal.textContent = 'PRACTICE';
      this.timerVal.classList.remove('danger');
    }

    // 2. Combo & Streak
    if (gameState.combo > 1) {
      this.comboVal.textContent = `x${gameState.combo.toFixed(1)} STREAK!`;
      const comboPct = Math.max(0, Math.min(100, (gameState.comboTimer / gameState.comboMaxTime) * 100));
      this.comboBarFill.style.width = `${comboPct}%`;
    } else {
      this.comboVal.textContent = `x1.0`;
      this.comboBarFill.style.width = `0%`;
    }

    // 3. Ammo & Reload
    if (wep.ammo === Infinity) {
      this.ammoCurrent.textContent = '∞';
      this.ammoCurrent.classList.remove('low');
      this.ammoMax.textContent = 'INF';
    } else {
      this.ammoCurrent.textContent = wep.ammo;
      this.ammoMax.textContent = wep.maxAmmo;
      if (wep.ammo <= 2) {
        this.ammoCurrent.classList.add('low');
      } else {
        this.ammoCurrent.classList.remove('low');
      }
    }

    // Reload status
    if (wep.isReloading) {
      this.reloadStatus.textContent = 'NẠP ĐẠN... [R]';
      this.reloadProgressBar.classList.add('active');
      this.reloadBarFill.style.width = `${(wep.reloadProgress || 0) * 100}%`;
    } else if (weaponManager.isCyclingBolt) {
      this.reloadStatus.textContent = 'LÊN ĐẠN BOLT...';
      this.reloadProgressBar.classList.remove('active');
    } else {
      this.reloadStatus.textContent = wep.name;
      this.reloadProgressBar.classList.remove('active');
    }

    // 4. Update Hotbar Active Weapon & Ammo counts
    for (const [id, slotEl] of Object.entries(this.slots)) {
      const numId = parseInt(id);
      const slotWep = weaponManager.weapons[numId];
      if (numId === weaponManager.currentId) {
        slotEl.classList.add('active');
      } else {
        slotEl.classList.remove('active');
      }

      const ammoEl = slotEl.querySelector('.slot-ammo');
      if (ammoEl) {
        ammoEl.textContent = slotWep.ammo === Infinity ? '∞' : `${slotWep.ammo}/${slotWep.maxAmmo}`;
      }
    }

    // 5. Scopes & Vignette
    if (weaponManager.isAiming && wep.id === WEAPON_TYPES.SNIPER) {
      this.sniperScopeOverlay.classList.add('active');

      // Cho toàn bộ cụm kính ngắm di chuyển bám sát theo tọa độ chuột
      const mouse = weaponManager.mousePos || this.lastMousePos; 
      if (mouse) {
        this.sniperScopeOverlay.style.transform = `translate(${mouse.x - window.innerWidth / 2}px, ${mouse.y - window.innerHeight / 2}px)`;
      }
    } else {
      this.sniperScopeOverlay.classList.remove('active');
      this.sniperScopeOverlay.style.transform = 'none';
    }
  }

  // Trigger brief screen shake and muzzle flash
  triggerMuzzleFlash() {
    this.muzzleFlash.style.opacity = '1';
    setTimeout(() => {
      this.muzzleFlash.style.opacity = '0';
    }, 45);

    this.appContainer.classList.remove('screen-shake');
    void this.appContainer.offsetWidth; // force reflow
    this.appContainer.classList.add('screen-shake');
  }

  // Trigger Hitmarker on HUD crosshair
  triggerHitmarker(isBullseye) {
    if (this.hitmarkerTimer) clearTimeout(this.hitmarkerTimer);

    this.hitmarkerUI.className = '';
    if (isBullseye) {
      this.hitmarkerUI.classList.add('bullseye');
    } else {
      this.hitmarkerUI.classList.add('active');
    }

    this.hitmarkerTimer = setTimeout(() => {
      this.hitmarkerUI.className = '';
    }, 120);
  }

  // Render Custom Crosshair on dedicated Crosshair Canvas
  renderCrosshair(ctx, mousePos, weaponManager) {
    const wep = weaponManager.currentWeapon;
    const isAiming = weaponManager.isAiming;
    const recoil = weaponManager.recoilOffset || { x: 0, y: 0 };

    const cx = mousePos.x + recoil.x;
    const cy = mousePos.y + recoil.y;

    // Position the hitmarker UI exactly over crosshair center
    if (this.hitmarkerUI) {
      this.hitmarkerUI.style.left = `${cx}px`;
      this.hitmarkerUI.style.top = `${cy}px`;
    }

    // 1. Quản lý hiển thị và tọa độ kính ngắm Sniper Scope
    if (this.sniperScopeOverlay) {
      if (wep.id === WEAPON_TYPES.SNIPER && isAiming) {
        this.sniperScopeOverlay.classList.add('active');

        // Cập nhật vị trí tâm ngắm và viền kính bám theo chuột (kèm độ nảy recoil)
        const reticle = this.sniperScopeOverlay.querySelector('.scope-reticle');
        const mask = this.sniperScopeOverlay.querySelector('.scope-mask');
        if (reticle) {
          reticle.style.left = `${cx}px`;
          reticle.style.top = `${cy}px`;
        }
        if (mask) {
          mask.style.left = `${cx}px`;
          mask.style.top = `${cy}px`;
        }
      } else {
        this.sniperScopeOverlay.classList.remove('active');
      }
    }

    // 2. Quản lý viền tối Vignette của DMR
    if (this.dmrVignette) {
      if (wep.id === WEAPON_TYPES.DMR && isAiming) {
        this.dmrVignette.classList.add('active');
      } else {
        this.dmrVignette.classList.remove('active');
      }
    }

    // 3. Nếu Sniper đang bật kính ngắm quang học, lớp DOM overlay đã hiển thị nên dừng vẽ Canvas
    if (wep.id === WEAPON_TYPES.SNIPER && isAiming) {
      return;
    }

    ctx.save();
    ctx.translate(cx, cy);

    if (wep.id === WEAPON_TYPES.KNIFE) {
      // Throwing Knife Reticle: Arc brackets + center pip
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;

      // Outer brackets
      ctx.beginPath();
      ctx.arc(0, 0, 18, Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 18, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Downward trajectory indicator
      ctx.strokeStyle = 'rgba(255, 183, 3, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, 16);
      ctx.stroke();

    } else if (wep.id === WEAPON_TYPES.PISTOL) {
      // Pistol: Clean tactical red/cyan dot + 4 precise ticks
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      const spread = wep.currentSpread * 2 + 8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, -spread); ctx.lineTo(0, -spread - 5);
      ctx.moveTo(0, spread); ctx.lineTo(0, spread + 5);
      ctx.moveTo(-spread, 0); ctx.lineTo(-spread - 5, 0);
      ctx.moveTo(spread, 0); ctx.lineTo(spread + 5, 0);
      ctx.stroke();

    } else if (wep.id === WEAPON_TYPES.AR) {
      // Assault Rifle: Dynamic blooming 4-crosshair
      const spread = Math.max(8, wep.currentSpread * 1.8 + 6);

      ctx.strokeStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2.0;

      // Center pip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.5, -1.5, 3, 3);

      // 4 Blooming Ticks
      ctx.beginPath();
      ctx.moveTo(0, -spread); ctx.lineTo(0, -spread - 7);
      ctx.moveTo(0, spread); ctx.lineTo(0, spread + 7);
      ctx.moveTo(-spread, 0); ctx.lineTo(-spread - 7, 0);
      ctx.moveTo(spread, 0); ctx.lineTo(spread + 7, 0);
      ctx.stroke();

    } else if (wep.id === WEAPON_TYPES.DMR) {
      // DMR: Precision Marksman reticle with chevrons
      const spread = isAiming ? 6 : wep.currentSpread + 10;
      ctx.strokeStyle = isAiming ? '#ff3b30' : '#00f0ff';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;

      // Center small circle
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.stroke();

      // Chevrons / Elevation marks
      ctx.beginPath();
      ctx.moveTo(-spread - 8, 0); ctx.lineTo(-spread, 0);
      ctx.moveTo(spread, 0); ctx.lineTo(spread + 8, 0);
      ctx.moveTo(0, -spread - 8); ctx.lineTo(0, -spread);
      ctx.moveTo(0, spread); ctx.lineTo(0, spread + 14);
      ctx.stroke();

    } else if (wep.id === WEAPON_TYPES.SNIPER) {
      // Sniper (Unscoped): Wide brackets showing heavy inaccurate spread
      const spread = 35;
      ctx.strokeStyle = 'rgba(255, 42, 95, 0.7)';
      ctx.lineWidth = 2;

      // 4 corner corner brackets
      ctx.beginPath();
      ctx.moveTo(-spread, -spread + 10); ctx.lineTo(-spread, -spread); ctx.lineTo(-spread + 10, -spread);
      ctx.moveTo(spread, -spread + 10); ctx.lineTo(spread, -spread); ctx.lineTo(spread - 10, -spread);
      ctx.moveTo(-spread, spread - 10); ctx.lineTo(-spread, spread); ctx.lineTo(-spread + 10, spread);
      ctx.moveTo(spread, spread - 10); ctx.lineTo(spread, spread); ctx.lineTo(spread - 10, spread);
      ctx.stroke();

      // Center red warning dot
      ctx.fillStyle = '#ff2a5f';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  showSummary(stats, weaponStats) {
    this.summaryModal.classList.remove('hidden');

    this.summaryScore.textContent = stats.score.toLocaleString();
    this.summaryAccuracy.textContent = `${stats.accuracy.toFixed(1)}%`;
    this.summaryBullseyes.textContent = `${stats.bullseyes} (${stats.bullseyeRate.toFixed(1)}%)`;
    this.summaryShots.textContent = stats.shots;
    this.summaryMaxCombo.textContent = `x${stats.maxCombo.toFixed(1)}`;

    // Calculate Rank
    let rank = 'C';
    if (stats.score >= 1200 && stats.accuracy >= 75) rank = 'S+';
    else if (stats.score >= 800 && stats.accuracy >= 60) rank = 'S';
    else if (stats.score >= 500 && stats.accuracy >= 45) rank = 'A';
    else if (stats.score >= 250) rank = 'B';
    this.summaryRank.textContent = rank;

    // Determine MVP Weapon
    let bestWepId = WEAPON_TYPES.PISTOL;
    let maxScore = -1;
    for (const [wId, wStat] of Object.entries(weaponStats)) {
      if (wStat.score > maxScore) {
        maxScore = wStat.score;
        bestWepId = parseInt(wId);
      }
    }
    const wepNames = {
      [WEAPON_TYPES.KNIFE]: 'Dao Phóng',
      [WEAPON_TYPES.PISTOL]: 'Súng Lục Tactical',
      [WEAPON_TYPES.AR]: 'AR-47 Spear',
      [WEAPON_TYPES.DMR]: 'MK-14 DMR',
      [WEAPON_TYPES.SNIPER]: 'AWM Sniper'
    };
    this.summaryMvp.textContent = `Vũ khí xuất sắc nhất: ${wepNames[bestWepId] || 'Pistol'}`;
  }

  hideSummary() {
    this.summaryModal.classList.add('hidden');
  }

  hideStartModal() {
    this.startModal.classList.add('hidden');
  }
}
