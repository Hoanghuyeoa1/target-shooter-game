/**
 * WeaponManager - Comprehensive Arsenal Controller
 * Manages 5 distinct weapon behaviors: Knife, Pistol, Assault Rifle, DMR, and Sniper Rifle.
 */

export const WEAPON_TYPES = {
  KNIFE: 1,
  PISTOL: 2,
  AR: 3,
  DMR: 4,
  SNIPER: 5
};

export class WeaponManager {
  constructor(soundController, particleSystem) {
    this.sound = soundController;
    this.particles = particleSystem;

    this.currentId = WEAPON_TYPES.PISTOL;
    this.isMouseDown = false;
    this.isAiming = false; // Right-click ADS / Scope

    // Recoil and camera kick
    this.recoilOffset = { x: 0, y: 0 };
    this.cameraShake = 0;

    // Bolt action state for Sniper
    this.isCyclingBolt = false;
    this.boltTimer = 0;

    // Weapons Configuration
    this.weapons = {
      [WEAPON_TYPES.KNIFE]: {
        id: WEAPON_TYPES.KNIFE,
        name: 'Dao Phóng',
        code: 'KNIFE-X',
        type: 'projectile',
        isFullAuto: false,
        ammo: Infinity,
        maxAmmo: Infinity,
        fireDelay: 0.8, // 0.8s cooldown
        reloadTime: 0,
        isReloading: false,
        recoilKick: 3,
        baseSpread: 0,
        currentSpread: 0,
        maxSpread: 0,
        zoomFactor: 1.0,
        canScope: false,
        icon: '🗡️',
        description: 'Đạn đạo vật lý, bay có độ trễ & trọng lực, sát thương cực cao khi trúng hồng tâm.'
      },
      [WEAPON_TYPES.PISTOL]: {
        id: WEAPON_TYPES.PISTOL,
        name: 'Súng Lục Tactical',
        code: 'P9-TACTICAL',
        type: 'hitscan',
        isFullAuto: false,
        ammo: 12,
        maxAmmo: 12,
        fireDelay: 0.18,
        reloadTime: 1.2,
        isReloading: false,
        reloadProgress: 0,
        recoilKick: 7,
        baseSpread: 2,
        currentSpread: 2,
        maxSpread: 12,
        spreadRecovery: 25,
        zoomFactor: 1.0,
        canScope: false,
        icon: '🔫',
        description: 'Bán tự động, hitscan tức thời, độ giật thấp, băng 12 viên.'
      },
      [WEAPON_TYPES.AR]: {
        id: WEAPON_TYPES.AR,
        name: 'Súng Trường Tấn Công',
        code: 'AR-47 SPEAR',
        type: 'hitscan',
        isFullAuto: true,
        rpm: 600, // 600 RPM = 0.1s per shot
        fireDelay: 0.10,
        ammo: 30,
        maxAmmo: 30,
        reloadTime: 2.0,
        isReloading: false,
        reloadProgress: 0,
        recoilKick: 10,
        baseSpread: 4,
        currentSpread: 4,
        maxSpread: 28,
        spreadRecovery: 35,
        zoomFactor: 1.05,
        canScope: false,
        icon: '⚡',
        description: 'Full-auto 600 RPM đè chuột, tản đạn & giật tăng khi bắn liên thanh, băng 30 viên.'
      },
      [WEAPON_TYPES.DMR]: {
        id: WEAPON_TYPES.DMR,
        name: 'Súng DMR Marksman',
        code: 'MK-14 DMR',
        type: 'hitscan',
        isFullAuto: false,
        fireDelay: 0.35,
        ammo: 10,
        maxAmmo: 10,
        reloadTime: 1.8,
        isReloading: false,
        reloadProgress: 0,
        recoilKick: 16,
        baseSpread: 1.5,
        currentSpread: 1.5,
        maxSpread: 15,
        spreadRecovery: 22,
        zoomFactor: 1.5, // 1.5x zoom ADS
        canScope: true,
        scopeType: 'dmr',
        icon: '🎯',
        description: 'Bán tự động uy lực mạnh, độ giật lớn, chuột phải zoom quang học 1.5x.'
      },
      [WEAPON_TYPES.SNIPER]: {
        id: WEAPON_TYPES.SNIPER,
        name: 'Súng Ngắm Tỉa Sniper',
        code: 'AWM-50 CAL',
        type: 'hitscan',
        isFullAuto: false,
        fireDelay: 1.5, // 1.5s bolt action delay
        ammo: 5,
        maxAmmo: 5,
        reloadTime: 2.4,
        isReloading: false,
        reloadProgress: 0,
        recoilKick: 28,
        baseSpread: 0.5,
        currentSpread: 0.5,
        maxSpread: 45, // No-scope spread is huge!
        spreadRecovery: 20,
        zoomFactor: 3.5, // 3.5x optical scope
        canScope: true,
        scopeType: 'sniper',
        icon: '🔭',
        description: 'Bolt-action nạp từng viên 1.5s, chuột phải bật kính ngắm quang học chuyên dụng.'
      }
    };

    // Tracking stats per weapon
    this.stats = {
      [WEAPON_TYPES.KNIFE]: { shots: 0, hits: 0, bullseyes: 0, score: 0 },
      [WEAPON_TYPES.PISTOL]: { shots: 0, hits: 0, bullseyes: 0, score: 0 },
      [WEAPON_TYPES.AR]: { shots: 0, hits: 0, bullseyes: 0, score: 0 },
      [WEAPON_TYPES.DMR]: { shots: 0, hits: 0, bullseyes: 0, score: 0 },
      [WEAPON_TYPES.SNIPER]: { shots: 0, hits: 0, bullseyes: 0, score: 0 }
    };

    this.lastFireTimer = 0;
  }

  get currentWeapon() {
    return this.weapons[this.currentId];
  }

  switchWeapon(id) {
    if (id < 1 || id > 5 || id === this.currentId) return;
    // Cancel any ongoing reload or bolt cycle
    const oldWep = this.currentWeapon;
    if (oldWep.isReloading) {
      oldWep.isReloading = false;
      oldWep.reloadProgress = 0;
    }
    this.isCyclingBolt = false;
    this.currentId = id;
    this.lastFireTimer = 0.1; // Brief equip buffer

    // Play weapon equip click
    if (this.sound) {
      this.sound.playMechanicalClick(1100, 0.04, 0.4);
    }
  }

  nextWeapon() {
    let nextId = this.currentId + 1;
    if (nextId > 5) nextId = 1;
    this.switchWeapon(nextId);
  }

  prevWeapon() {
    let prevId = this.currentId - 1;
    if (prevId < 1) prevId = 5;
    this.switchWeapon(prevId);
  }

  reload() {
    const wep = this.currentWeapon;
    if (wep.ammo === Infinity || wep.ammo === wep.maxAmmo || wep.isReloading || this.isCyclingBolt) {
      return;
    }
    wep.isReloading = true;
    wep.reloadProgress = 0;
    if (this.sound) {
      this.sound.playReload();
    }
  }

  setAiming(isAiming) {
    const wep = this.currentWeapon;
    if (wep.canScope) {
      this.isAiming = isAiming;
    } else {
      this.isAiming = false;
    }
  }

  // Attempt to fire weapon
  fire(targetX, targetY, targetHitCallback) {
    const wep = this.currentWeapon;

    // Can we fire?
    if (this.lastFireTimer > 0) return false;
    if (wep.isReloading) return false;
    if (this.isCyclingBolt) return false;

    // Check ammo
    if (wep.ammo !== Infinity && wep.ammo <= 0) {
      if (this.sound) this.sound.playDryFire();
      this.reload();
      this.lastFireTimer = 0.25;
      return false;
    }

    // Deduct ammo
    if (wep.ammo !== Infinity) {
      wep.ammo--;
    }
    this.lastFireTimer = wep.fireDelay;
    this.stats[wep.id].shots++;

    // Screen Center / Origin for shells and muzzle flash
    const originX = window.innerWidth * 0.7;
    const originY = window.innerHeight - 80;

    // Recoil application
    let kick = wep.recoilKick;
    if (this.isAiming) kick *= 0.6; // Reduced recoil in ADS
    this.recoilOffset.y -= kick;
    this.recoilOffset.x += (Math.random() - 0.5) * kick * 0.6;
    this.cameraShake = kick * 0.4;

    // Calculate spread
    let currentSpread = wep.currentSpread;
    if (wep.id === WEAPON_TYPES.SNIPER && !this.isAiming) {
      // Sniper no-scope has massive spread penalty
      currentSpread = wep.maxSpread;
    } else if (this.isAiming) {
      currentSpread = Math.max(0.5, wep.baseSpread * 0.4);
    }

    // Add spread bloom for AR/Pistol/DMR
    if (wep.id === WEAPON_TYPES.AR) {
      wep.currentSpread = Math.min(wep.maxSpread, wep.currentSpread + 3.8);
    } else if (wep.id === WEAPON_TYPES.PISTOL) {
      wep.currentSpread = Math.min(wep.maxSpread, wep.currentSpread + 2.5);
    } else if (wep.id === WEAPON_TYPES.DMR) {
      wep.currentSpread = Math.min(wep.maxSpread, wep.currentSpread + 5.0);
    }

    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadDist = Math.random() * currentSpread;
    const actualHitX = targetX + Math.cos(spreadAngle) * spreadDist;
    const actualHitY = targetY + Math.sin(spreadAngle) * spreadDist;

    // Specific Weapon Firing Behaviors
    if (wep.id === WEAPON_TYPES.KNIFE) {
      // 1. Throwing Knife projectile
      if (this.sound) this.sound.playKnifeThrow();
      
      const startX = window.innerWidth * 0.5;
      const startY = window.innerHeight + 10;

      this.particles.launchKnife(startX, startY, actualHitX, actualHitY, (finalX, finalY, rot) => {
        // Knife hit callback
        targetHitCallback(finalX, finalY, wep, { isKnife: true, rotation: rot });
      });

    } else {
      // Hitscan Weapons (Pistol, AR, DMR, Sniper)
      let shellType = 'pistol';
      if (wep.id === WEAPON_TYPES.PISTOL) {
        if (this.sound) this.sound.playPistol();
        shellType = 'pistol';
      } else if (wep.id === WEAPON_TYPES.AR) {
        if (this.sound) this.sound.playRifle();
        shellType = 'rifle';
      } else if (wep.id === WEAPON_TYPES.DMR) {
        if (this.sound) this.sound.playDMR();
        shellType = 'dmr';
      } else if (wep.id === WEAPON_TYPES.SNIPER) {
        if (this.sound) {
          this.sound.playSniper();
          this.sound.playBoltAction();
        }
        shellType = 'sniper';
        this.isCyclingBolt = true;
        this.boltTimer = 1.4;
      }

      // Eject casing
      if (wep.id !== WEAPON_TYPES.SNIPER) {
        this.particles.addShellCasing(originX, originY, shellType);
      } else {
        // Sniper ejects during bolt cycle
        setTimeout(() => {
          this.particles.addShellCasing(originX, originY, 'sniper');
        }, 450);
      }

      // Hitscan test immediately
      targetHitCallback(actualHitX, actualHitY, wep, { isKnife: false });

      // Auto reload when magazine empty
      if (wep.ammo === 0) {
        setTimeout(() => this.reload(), 200);
      }
    }

    return true;
  }

  update(dt, mousePos, targetHitCallback) {
    const wep = this.currentWeapon;

    // Decrement fire timer
    if (this.lastFireTimer > 0) {
      this.lastFireTimer -= dt;
      if (this.lastFireTimer < 0) this.lastFireTimer = 0;
    }

    // Bolt action timer
    if (this.isCyclingBolt) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.isCyclingBolt = false;
        this.boltTimer = 0;
      }
    }

    // Full-auto continuous firing for Assault Rifle
    if (this.isMouseDown && wep.isFullAuto && !wep.isReloading) {
      if (this.lastFireTimer <= 0) {
        this.fire(mousePos.x, mousePos.y, targetHitCallback);
      }
    }

    // Reloading progress
    if (wep.isReloading) {
      wep.reloadProgress += dt / wep.reloadTime;
      if (wep.reloadProgress >= 1.0) {
        wep.ammo = wep.maxAmmo;
        wep.isReloading = false;
        wep.reloadProgress = 0;
      }
    }

    // Recoil recovery (smooth spring back to 0)
    this.recoilOffset.x += (0 - this.recoilOffset.x) * dt * 14;
    this.recoilOffset.y += (0 - this.recoilOffset.y) * dt * 14;

    // Camera shake decay
    if (this.cameraShake > 0) {
      this.cameraShake -= dt * 35;
      if (this.cameraShake < 0) this.cameraShake = 0;
    }

    // Spread recovery
    if (wep.spreadRecovery) {
      if (wep.currentSpread > wep.baseSpread) {
        wep.currentSpread -= wep.spreadRecovery * dt;
        if (wep.currentSpread < wep.baseSpread) wep.currentSpread = wep.baseSpread;
      }
    }
  }

  recordHit(wepId, isBullseye, score) {
    const s = this.stats[wepId];
    if (!s) return;
    s.hits++;
    if (isBullseye) s.bullseyes++;
    s.score += score;
  }
}
