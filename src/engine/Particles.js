/**
 * Particles & Visual Effects Engine
 * Handles bullet sparks, wood splinters, flying brass shell casings, floating damage text,
 * and ballistic knife projectiles.
 */

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.shellCasings = [];
    this.floatingTexts = [];
    this.knifeProjectiles = [];
    this.hitmarkers = [];
  }

  // Add impact sparks and splinters
  addImpactSparks(x, y, color = '#ffcc44', count = 12, isBullseye = false) {
    const finalCount = isBullseye ? count * 2 : count;
    for (let i = 0; i < finalCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        gravity: 0.15,
        radius: 1.5 + Math.random() * 2.5,
        color: isBullseye ? (Math.random() > 0.4 ? '#ffdd00' : '#ff4444') : (Math.random() > 0.5 ? color : '#e0a96d'),
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  }

  // Eject brass shell casing from gun
  addShellCasing(originX, originY, type = 'pistol') {
    const isSniper = type === 'sniper';
    const isRifle = type === 'rifle' || type === 'dmr';
    
    this.shellCasings.push({
      x: originX,
      y: originY,
      vx: 3 + Math.random() * 4,
      vy: -5 - Math.random() * 4,
      gravity: 0.45,
      angle: Math.random() * Math.PI,
      rotSpeed: 0.15 + Math.random() * 0.3,
      width: isSniper ? 18 : (isRifle ? 14 : 9),
      height: isSniper ? 6 : (isRifle ? 5 : 4),
      alpha: 1.0,
      bounces: 0,
      maxBounces: 2,
      groundY: window.innerHeight - 30 + (Math.random() * 20),
      stopped: false
    });
  }

  // Floating combat text (+10 BULLSEYE!, +8, COMBO x2)
  addFloatingText(x, y, text, color = '#ffdf00', size = 26, isBullseye = false) {
    this.floatingTexts.push({
      x,
      y,
      vy: -1.8,
      text,
      color,
      size,
      alpha: 1.0,
      scale: 1.5,
      isBullseye,
      life: 0
    });
  }

  // Hitmarker visual indicator
  addHitmarker(isBullseye = false) {
    this.hitmarkers.push({
      alpha: 1.0,
      scale: isBullseye ? 1.4 : 1.0,
      color: isBullseye ? '#ff3344' : '#ffffff',
      life: 0
    });
  }

  // Launch a throwing knife
  launchKnife(startX, startY, targetX, targetY, onHitCallback) {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const flightTime = 0.28; // ~280ms travel time

    this.knifeProjectiles.push({
      x: startX,
      y: startY,
      targetX,
      targetY,
      startX,
      startY,
      t: 0,
      duration: flightTime,
      rotation: -Math.PI / 4,
      spinSpeed: 24, // fast spin
      scale: 1.2,
      onHit: onHitCallback,
      active: true
    });
  }

  update(dt, soundController) {
    // 1. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;
      p.rotation += p.rotSpeed;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 2. Update Shell Casings
    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const c = this.shellCasings[i];
      if (!c.stopped) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += c.gravity;
        c.angle += c.rotSpeed;

        // Ground bounce
        if (c.y >= c.groundY) {
          c.y = c.groundY;
          c.bounces++;
          c.vy = -c.vy * 0.45;
          c.vx *= 0.6;
          c.rotSpeed *= 0.5;

          if (soundController && c.bounces === 1) {
            soundController.playShellDrop();
          }

          if (c.bounces >= c.maxBounces || Math.abs(c.vy) < 0.8) {
            c.stopped = true;
          }
        }
      } else {
        c.alpha -= 0.008;
        if (c.alpha <= 0) {
          this.shellCasings.splice(i, 1);
        }
      }
    }

    // 3. Update Floating Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life += dt;
      if (ft.scale > 1.0) {
        ft.scale = Math.max(1.0, ft.scale - dt * 3);
      }
      if (ft.life > 0.4) {
        ft.alpha -= dt * 1.8;
      }
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 4. Update Hitmarkers
    for (let i = this.hitmarkers.length - 1; i >= 0; i--) {
      const hm = this.hitmarkers[i];
      hm.life += dt;
      hm.alpha -= dt * 5.0;
      if (hm.alpha <= 0) {
        this.hitmarkers.splice(i, 1);
      }
    }

    // 5. Update Knife Projectiles
    for (let i = this.knifeProjectiles.length - 1; i >= 0; i--) {
      const k = this.knifeProjectiles[i];
      k.t += dt;
      const progress = Math.min(1.0, k.t / k.duration);

      // Arc interpolation with simulated ballistic gravity curve
      const easeProgress = progress;
      k.x = k.startX + (k.targetX - k.startX) * easeProgress;
      const linearY = k.startY + (k.targetY - k.startY) * easeProgress;
      // Parabolic arc (dips up slightly then falls down)
      const arc = Math.sin(progress * Math.PI) * -50; 
      k.y = linearY + arc;

      // Scale down as it flies away into depth
      k.scale = 1.2 - progress * 0.6;
      k.rotation += k.spinSpeed * dt;

      if (progress >= 1.0) {
        if (k.active && k.onHit) {
          k.onHit(k.targetX, k.targetY, k.rotation);
        }
        this.knifeProjectiles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    // Render Shell Casings
    ctx.save();
    for (const c of this.shellCasings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = Math.max(0, c.alpha);

      // Brass gradient
      const grad = ctx.createLinearGradient(-c.width / 2, 0, c.width / 2, 0);
      grad.addColorStop(0, '#ffe57f');
      grad.addColorStop(0.5, '#ffd54f');
      grad.addColorStop(1, '#b28900');
      ctx.fillStyle = grad;
      ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);

      // Primer cap rim
      ctx.fillStyle = '#8c6b00';
      ctx.fillRect(-c.width / 2, -c.height / 2, 2, c.height);

      ctx.restore();
    }
    ctx.restore();

    // Render Particles (sparks/splinters)
    ctx.save();
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
      ctx.restore();
    }
    ctx.restore();

    // Render Flying Knife Projectiles
    ctx.save();
    for (const k of this.knifeProjectiles) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.rotation);
      ctx.scale(k.scale, k.scale);
      this.drawKnifeSprite(ctx);
      ctx.restore();
    }
    ctx.restore();

    // Render Floating Texts
    ctx.save();
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `900 ${ft.size}px "Outfit", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(ft.text, 0, 0);

      // Fill & Glow
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = ft.isBullseye ? 12 : 5;
      ctx.fillText(ft.text, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  // Draw standalone knife graphic
  drawKnifeSprite(ctx) {
    // Knife Blade
    ctx.fillStyle = '#e0e6ed';
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(8, -8);
    ctx.lineTo(6, 4);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();

    // Blade bevel highlight
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(0, 4);
    ctx.stroke();

    // Guard
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(-10, 4, 20, 4);

    // Handle
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-5, 8, 10, 22);

    // Grip wrapping ribs
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 1.5;
    for (let y = 12; y <= 26; y += 4) {
      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(5, y);
      ctx.stroke();
    }

    // Pommel
    ctx.fillStyle = '#cbd5e0';
    ctx.beginPath();
    ctx.arc(0, 31, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
