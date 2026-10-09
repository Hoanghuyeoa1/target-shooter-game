/**
 * TargetManager - 2.5D Target Simulation & Hit Detection
 * Controls circular ring targets (10-8-5-2), moving sliders, pop-up targets,
 * physical target sway on impact, and persistent decals (bullet holes & stuck knives).
 */

export class TargetManager {
  constructor(soundController, particleSystem) {
    this.sound = soundController;
    this.particles = particleSystem;

    this.targets = [];
    this.maxTargets = 6;
    this.spawnTimer = 0;
    this.spawnInterval = 2.0;
    this.gameTime = 0;
  }

  reset() {
    this.targets = [];
    this.spawnTimer = 0;
    this.gameTime = 0;
    this.initInitialTargets();
  }

  initInitialTargets() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1 Static target (Center-left)
    this.createTarget({
      x: w * 0.32,
      y: h * 0.44,
      radius: 46,
      type: 'static',
      depth: 0.9
    });

    // 1 Horizontal Slider (Center-right rail)
    this.createTarget({
      x: w * 0.68,
      y: h * 0.38,
      radius: 42,
      type: 'horizontal_slider',
      minX: w * 0.52,
      maxX: w * 0.84,
      speed: 95,
      depth: 0.85
    });

    // 1 Pop-up target (Far center)
    this.createTarget({
      x: w * 0.5,
      y: h * 0.48,
      radius: 38,
      type: 'popup',
      depth: 0.75
    });
  }

  createTarget(options) {
    const target = {
      id: Math.random().toString(36).substring(2, 9),
      x: options.x,
      y: options.y,
      baseY: options.y,
      radius: options.radius || 42,
      depth: options.depth || 1.0, // 2.5D depth scaling
      type: options.type || 'static', // static, horizontal_slider, vertical_slider, popup, golden
      minX: options.minX || options.x - 120,
      maxX: options.maxX || options.x + 120,
      minY: options.minY || options.y - 80,
      maxY: options.maxY || options.y + 80,
      speed: options.speed || 100,
      direction: Math.random() > 0.5 ? 1 : -1,

      // Pop-up properties
      popupState: options.type === 'popup' ? 'rising' : 'active', // 'rising', 'active', 'falling', 'hidden'
      popupTimer: 0,
      popupDuration: 2.2, // 2.2s active window
      scaleY: options.type === 'popup' ? 0.05 : 1.0,

      // Wobble & spring physics on hit
      wobbleX: 0,
      wobbleY: 0,
      wobbleAngle: 0,
      wobbleVelocity: 0,

      // Hit decals (bullet holes & stuck knives)
      decals: [],
      hitCount: 0,
      markedForRemoval: false
    };

    this.targets.push(target);
    return target;
  }

  update(dt, difficultyMultiplier = 1.0) {
    this.gameTime += dt;
    this.spawnTimer += dt;

    // Dynamically spawn targets to keep the range populated
    if (this.targets.length < this.maxTargets && this.spawnTimer >= this.spawnInterval) {
      this.spawnRandomTarget(difficultyMultiplier);
      this.spawnTimer = 0;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];

      // Update physical wobble spring back
      t.wobbleAngle += t.wobbleVelocity * dt;
      t.wobbleVelocity += (0 - t.wobbleAngle) * dt * 25;
      t.wobbleVelocity *= 0.88; // Damping

      // Behavior per target type
      if (t.type === 'horizontal_slider') {
        const speed = t.speed * difficultyMultiplier;
        t.x += t.direction * speed * dt;
        if (t.x >= t.maxX) {
          t.x = t.maxX;
          t.direction = -1;
        } else if (t.x <= t.minX) {
          t.x = t.minX;
          t.direction = 1;
        }
      } else if (t.type === 'vertical_slider') {
        const speed = t.speed * difficultyMultiplier;
        t.y += t.direction * speed * dt;
        if (t.y >= t.maxY) {
          t.y = t.maxY;
          t.direction = -1;
        } else if (t.y <= t.minY) {
          t.y = t.minY;
          t.direction = 1;
        }
      } else if (t.type === 'popup') {
        if (t.popupState === 'rising') {
          t.scaleY += dt * 6;
          if (t.scaleY >= 1.0) {
            t.scaleY = 1.0;
            t.popupState = 'active';
            t.popupTimer = 0;
          }
        } else if (t.popupState === 'active') {
          t.popupTimer += dt;
          if (t.popupTimer >= t.popupDuration) {
            t.popupState = 'falling';
          }
        } else if (t.popupState === 'falling') {
          t.scaleY -= dt * 6;
          if (t.scaleY <= 0.05) {
            t.scaleY = 0.05;
            t.markedForRemoval = true;
          }
        }
      }

      // If target received many hits (e.g. 8+ hits), replace it with a fresh target
      if (t.hitCount >= 10 || t.markedForRemoval) {
        this.targets.splice(i, 1);
      }
    }
  }

  spawnRandomTarget(diff = 1.0) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Pick random target types
    const rand = Math.random();
    let type = 'static';
    if (rand < 0.35) type = 'horizontal_slider';
    else if (rand < 0.65) type = 'popup';
    else if (rand < 0.85) type = 'vertical_slider';
    else type = 'static';

    // Depth layer (0.7 far to 1.1 close)
    const depth = 0.7 + Math.random() * 0.4;
    const radius = 38 * depth;

    const x = w * 0.2 + Math.random() * (w * 0.6);
    const y = h * 0.3 + Math.random() * (h * 0.28);

    const minX = Math.max(w * 0.15, x - 150 - Math.random() * 80);
    const maxX = Math.min(w * 0.85, x + 150 + Math.random() * 80);

    const speed = (80 + Math.random() * 70) * diff;

    this.createTarget({
      x,
      y,
      radius,
      depth,
      type,
      minX,
      maxX,
      speed
    });
  }

  // Hit testing against active targets
  checkHit(hitX, hitY, weapon, options = {}) {
    // Sort front to back (depth desc) so near targets take priority
    const sortedTargets = [...this.targets].sort((a, b) => b.depth - a.depth);

    for (const t of sortedTargets) {
      // Popups must be mostly visible to be hit
      if (t.type === 'popup' && t.scaleY < 0.4) continue;

      const effectiveRadius = t.radius;
      const dx = hitX - t.x;
      const dy = hitY - t.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= effectiveRadius) {
        // We have a hit!
        const normDist = dist / effectiveRadius;
        let score = 2; // Outer ring
        let isBullseye = false;

        if (normDist <= 0.22) {
          score = 10; // Bullseye!
          isBullseye = true;
        } else if (normDist <= 0.5) {
          score = 8;
        } else if (normDist <= 0.78) {
          score = 5;
        } else {
          score = 2;
        }

        // Apply hit wobble & impulse
        t.wobbleVelocity = (dx / effectiveRadius) * 4.5;
        t.hitCount++;

        // Add decal relative to target center
        if (options.isKnife) {
          t.decals.push({
            type: 'knife',
            localX: dx,
            localY: dy,
            rotation: options.rotation || 0,
            scale: 0.75 * t.depth
          });
          if (this.sound) this.sound.playKnifeHit();
        } else {
          t.decals.push({
            type: 'bullet',
            localX: dx,
            localY: dy,
            radius: Math.max(2.5, 4 * t.depth)
          });
          if (this.sound) this.sound.playHitTarget(score);
        }

        // Particles & Floating text
        this.particles.addImpactSparks(hitX, hitY, '#ffdd44', 12, isBullseye);
        this.particles.addHitmarker(isBullseye);

        const label = isBullseye ? `+${score} BULLSEYE!` : `+${score}`;
        const textColor = isBullseye ? '#ff3b30' : (score === 8 ? '#ff9500' : '#34c759');
        this.particles.addFloatingText(hitX, hitY - 10, label, textColor, isBullseye ? 30 : 24, isBullseye);

        return {
          hit: true,
          score,
          isBullseye,
          target: t
        };
      }
    }

    // Missed all targets
    this.particles.addImpactSparks(hitX, hitY, '#888888', 6, false);
    return { hit: false, score: 0, isBullseye: false };
  }

  render(ctx) {
    // Sort back to front so near targets render in front
    const renderList = [...this.targets].sort((a, b) => a.depth - b.depth);

    for (const t of renderList) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.wobbleAngle);
      ctx.scale(1.0, t.scaleY);

      this.drawTargetPostAndHanger(ctx, t);
      this.drawTargetFace(ctx, t);
      this.drawTargetDecals(ctx, t);

      ctx.restore();
    }
  }

  drawTargetPostAndHanger(ctx, t) {
    ctx.save();
    if (t.type === 'horizontal_slider') {
      // Ceiling hanger cables & overhead trolley
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-t.radius * 0.5, -t.radius);
      ctx.lineTo(-t.radius * 0.3, -t.radius - 80);
      ctx.moveTo(t.radius * 0.5, -t.radius);
      ctx.lineTo(t.radius * 0.3, -t.radius - 80);
      ctx.stroke();

      // Overhead trolley wheel on rail
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(-t.radius * 0.4, -t.radius - 88, t.radius * 0.8, 12);
      ctx.fillStyle = '#cbd5e0';
      ctx.beginPath();
      ctx.arc(-t.radius * 0.2, -t.radius - 82, 5, 0, Math.PI * 2);
      ctx.arc(t.radius * 0.2, -t.radius - 82, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Ground stand wooden post
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(-6, t.radius * 0.7, 12, 160);
      ctx.fillStyle = '#2b1f17';
      ctx.fillRect(-4, t.radius * 0.7, 3, 160); // Wood grain shadow

      // Tripod base brackets
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-6, t.radius * 0.7 + 90);
      ctx.lineTo(-30, t.radius * 0.7 + 150);
      ctx.moveTo(6, t.radius * 0.7 + 90);
      ctx.lineTo(30, t.radius * 0.7 + 150);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTargetFace(ctx, t) {
    const r = t.radius;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;

    // Outer edge border
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3748';
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Ring 4: Outer (2 Points) - Cream White
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#f7fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ring 3: Middle-Outer (5 Points) - Sky Tactical Blue
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = '#3182ce';
    ctx.fill();
    ctx.strokeStyle = '#2b6cb0';
    ctx.stroke();

    // Ring 2: Middle-Inner (8 Points) - Dark Charcoal
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1a202c';
    ctx.fill();
    ctx.strokeStyle = '#2d3748';
    ctx.stroke();

    // Ring 1: Bullseye Center (10 Points) - Bright Crimson Red
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#e53e3e';
    ctx.fill();
    ctx.strokeStyle = '#9b2c2c';
    ctx.stroke();

    // Subtle crosshair lines through target
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();

    // Bullseye center dot '+'
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Print Ring Score Numbers
    ctx.font = `bold ${Math.max(9, r * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Numbers on Ring 2 (8 pts)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('8', 0, -r * 0.36);
    ctx.fillText('8', 0, r * 0.36);

    // Numbers on Ring 3 (5 pts)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('5', 0, -r * 0.64);
    ctx.fillText('5', 0, r * 0.64);

    // Numbers on Ring 4 (2 pts)
    ctx.fillStyle = 'rgba(26, 32, 44, 0.7)';
    ctx.fillText('2', 0, -r * 0.89);
    ctx.fillText('2', 0, r * 0.89);
  }

  drawTargetDecals(ctx, t) {
    for (const d of t.decals) {
      ctx.save();
      ctx.translate(d.localX, d.localY);

      if (d.type === 'bullet') {
        // Bullet hole decal: charred rim + dark crater hole + slight highlight
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
        ctx.fill();

        // Charred ring
        ctx.strokeStyle = '#443322';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Paper tear ragged rim
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(1, 1, d.radius * 0.6, 0, Math.PI);
        ctx.stroke();
      } else if (d.type === 'knife') {
        // Knife stuck deep in target!
        ctx.rotate(d.rotation);
        ctx.scale(d.scale, d.scale);

        // Stuck slit shadow
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(-3, -2, 6, 4);

        // Knife handle sticking out towards viewer
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-4, -28, 8, 26);

        // Pommel
        ctx.fillStyle = '#cbd5e0';
        ctx.beginPath();
        ctx.arc(0, -29, 4, 0, Math.PI * 2);
        ctx.fill();

        // Crossguard
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(-8, -3, 16, 4);
      }

      ctx.restore();
    }
  }
}
