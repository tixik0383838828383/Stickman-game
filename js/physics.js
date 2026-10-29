/* physics.js — PhysicsEngine: шаг игрока с фиксированным dt, коллизии AABB по осям,
   coyote time, jump buffer, переменная высота прыжка, стены, верёвки, скольжение. */
'use strict';
const NO_INPUT = { left: false, right: false, jump: false, down: false, jumpPressed: false, downPressed: false };
const MAX_SUBSTEP = 6;   // максимальное смещение за подшаг — защита от туннелирования

class PhysicsEngine {
  /* ---------- перемещение с коллизиями ---------- */
  static moveX(p, dx, world) {
    if (dx === 0) return;
    const n = Math.ceil(Math.abs(dx) / MAX_SUBSTEP), step = dx / n;
    for (let i = 0; i < n; i++) {
      p.x += step;
      for (const b of world.solids) {
        if (!b.solid || b.oneway || !Util.overlap(p, b)) continue;
        if (b.isCrate) {                                   // толкание ящика
          const moved = b.pushX(step, world);
          if (moved !== 0 && !Util.overlap(p, b)) { p.pushing = true; continue; }
        }
        if (step > 0) { p.x = b.x - p.w; p.touchR = true; } else { p.x = b.x + b.w; p.touchL = true; }
        if ((step > 0) === (p.vx > 0)) p.vx = 0;
        if (b.isCrate) p.pushing = true;
      }
    }
  }
  /** возвращает тело, на которое приземлились (или null) */
  static moveY(p, dy, world) {
    if (dy === 0) return null;
    const n = Math.ceil(Math.abs(dy) / MAX_SUBSTEP), step = dy / n; let landed = null;
    for (let i = 0; i < n; i++) {
      const prevBottom = p.y + p.h;
      p.y += step;
      for (const b of world.solids) {
        if (!b.solid || !Util.overlap(p, b)) continue;
        if (b.oneway) {
          if (step > 0 && p.dropT <= 0 && prevBottom <= b.y + 2) { p.y = b.y - p.h; p.vy = 0; landed = b; }
          continue;
        }
        if (step > 0) { p.y = b.y - p.h; p.vy = 0; landed = b; }
        else { p.y = b.y + b.h; if (p.vy < 0) p.vy = 0; }
      }
    }
    return landed;
  }
  /** выталкивание из пересечений (движущиеся платформы, ворота). Давление с двух сторон -> раздавлен. */
  static resolve(p, world, dt) {
    let pushed = false;
    for (const b of world.solids) {
      if (!b.solid || b.oneway || !Util.overlap(p, b)) continue;
      const L = p.x + p.w - b.x, R = b.x + b.w - p.x, U = p.y + p.h - b.y, D = b.y + b.h - p.y;
      const m = Math.min(L, R, U, D);
      if (m === U) { p.y = b.y - p.h; if (p.vy > 0) p.vy = 0; }
      else if (m === D) { p.y = b.y + b.h; if (p.vy < 0) p.vy = 0; }
      else if (m === L) p.x = b.x - p.w; else p.x = b.x + b.w;
      pushed = true;
    }
    if (pushed) {
      let still = false;
      for (const b of world.solids) if (b.solid && !b.oneway && Util.overlap(p, b)) { still = true; break; }
      if (still) { p.squish += dt; if (p.squish > 0.06) world.killPlayer('crush'); } else p.squish = 0;
    } else p.squish = 0;
  }
  static probeWall(p, world, dir) {
    const r = dir < 0 ? { x: p.x - 1.5, y: p.y + 6, w: 1.5, h: p.h - 14 } : { x: p.x + p.w, y: p.y + 6, w: 1.5, h: p.h - 14 };
    for (const b of world.solids) if (b.solid && !b.oneway && b.wall !== false && Util.overlap(r, b)) return true;
    return false;
  }

  /* ---------- шаг игрока ---------- */
  static step(world, input, dt) {
    const p = world.player, C = PLAYER_CONFIG;
    if (p.dead) return;
    const inp = p.victory ? NO_INPUT : input;
    p.stepTime += dt;
    p.spawnT = Math.max(0, p.spawnT - dt); p.landT = Math.max(0, p.landT - dt); p.lockT = Math.max(0, p.lockT - dt);
    p.dropT = Math.max(0, p.dropT - dt); p.ropeCD = Math.max(0, p.ropeCD - dt);
    const wasGround = p.onGround;
    p.coyote = wasGround ? C.coyote : Math.max(0, p.coyote - dt);
    p.jumpBuf = inp.jumpPressed ? C.jumpBuffer : Math.max(0, p.jumpBuf - dt);
    if (p.wallDir !== 0 && !wasGround) { p.wallCoyote = C.wallCoyote; p.wallCoyoteDir = p.wallDir; } else p.wallCoyote = Math.max(0, p.wallCoyote - dt);

    // --- перенос движущейся опорой ---
    p.touchL = p.touchR = false; p.pushing = false;
    const g = p.ground;
    if (g && g.solid) {
      if (g.dx) PhysicsEngine.moveX(p, g.dx, world);
      if (g.dy) p.y += g.dy;
      if (g.belt) PhysicsEngine.moveX(p, g.belt * dt, world);
    }

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

    // --- верёвка ---
    const rope = world.ropeAt(p);
    if (!p.climbing && rope && p.ropeCD <= 0 && (inp.jump || (inp.down && !p.onGround)) && !p.sliding) {
      p.climbing = true; p.vx = 0; p.vy = 0; if (p.crouching && p.canStand(world)) p.setCrouch(false);
    }
    if (p.climbing) {
      if (!rope) { p.climbing = false; p.ropeCD = 0.2; }
      else {
        p.sliding = false; p.wallSliding = false; p.wallDir = 0;
        const cx = rope.x - p.w / 2; p.x = Util.approach(p.x, cx, 420 * dt);
        if (inp.jumpPressed && dir !== 0) { p.climbing = false; p.vx = dir * 240; p.vy = -520; p.ropeCD = 0.25; p.facing = dir; p.noCut = false; world.emit('jump', p); }
        else {
          p.vy = inp.jump ? -C.climbSpeed : inp.down ? C.climbSpeed : 0; p.vx = 0;
          p.ropeMoving = p.vy !== 0;
          const landed = PhysicsEngine.moveY(p, p.vy * dt, world);
          if (landed && p.vy >= 0) { p.climbing = false; p.onGround = true; p.ground = landed; }
          if (p.y + p.h * 0.3 < rope.y) { p.climbing = false; p.vy = -430; p.vx = p.facing * 150; p.ropeCD = 0.3; }
          if (p.climbing) { p.onGround = false; p.ground = null; PhysicsEngine.finish(p, world, dt, wasGround, 0); return; }
        }
      }
    }

    // --- спрыгнуть с односторонней платформы ---
    if (p.onGround && p.ground && p.ground.oneway && inp.downPressed) { p.dropT = 0.25; p.onGround = false; p.ground = null; p.y += 1; }

    // --- приседание / слайд ---
    const onSolidGround = p.onGround && !(p.ground && p.ground.oneway);
    if (onSolidGround && !p.sliding && inp.downPressed && Math.abs(p.vx) > 200 && !p.climbing) {
      p.sliding = true; p.setCrouch(true); p.vx = Util.sign(p.vx) * Math.max(Math.abs(p.vx), C.slideSpeed); world.emit('slide', p);
    }
    if (p.sliding) {
      const fr = C.slideFriction * (p.ground && p.ground.ice ? 0.2 : 1);
      p.vx = Util.approach(p.vx, 0, fr * dt);
      if (Math.abs(p.vx) < C.slideMinSpeed || !p.onGround || (!inp.down && p.canStand(world))) p.sliding = false;
    }
    const wantCrouch = inp.down && onSolidGround;
    if (wantCrouch || p.sliding) p.setCrouch(true);
    else if (p.crouching && p.canStand(world)) p.setCrouch(false);

    // --- горизонтальная скорость ---
    p.wallSliding = !p.onGround && p.wallDir !== 0 && p.vy > 0 && dir === p.wallDir && !p.climbing;
    if (!p.sliding && p.lockT <= 0) {
      const ice = p.onGround && p.ground && p.ground.ice;
      let maxS = C.maxSpeed; if (p.crouching && p.onGround) maxS = C.crouchSpeed;
      let acc = p.onGround ? (ice ? C.iceAccel : C.accel) : C.airAccel;
      const dec = p.onGround ? (ice ? C.iceDecel : C.decel) : C.airDecel;
      if (dir !== 0) {
        if (p.vx !== 0 && Util.sign(p.vx) !== dir) acc += dec;           // быстрый разворот
        if (Math.abs(p.vx) > maxS && Util.sign(p.vx) === dir) acc = dec; // после слайда/трамплина — плавное торможение до макс.
        p.vx = Util.approach(p.vx, dir * maxS, acc * dt); p.facing = dir;
      } else p.vx = Util.approach(p.vx, 0, dec * dt);
    }
    if (p.pushing && Math.abs(p.vx) > C.pushSpeed) p.vx = Util.sign(p.vx) * C.pushSpeed;

    // --- прыжок ---
    if (p.jumpBuf > 0) {
      if (p.coyote > 0) {
        if (!p.crouching || p.canStand(world)) {
          if (p.crouching) p.setCrouch(false);
          p.sliding = false; p.vy = C.jumpVel; p.coyote = 0; p.jumpBuf = 0; p.onGround = false; p.ground = null; p.noCut = false; p.squash = -0.12;
          world.emit('jump', p);
        }
      } else if (p.wallCoyote > 0 && !p.onGround) {
        p.vy = C.wallJumpVy; p.vx = -p.wallCoyoteDir * C.wallJumpVx; p.facing = -p.wallCoyoteDir; p.lockT = C.wallJumpLock; p.wallJumpT = 0.3;
        p.wallCoyote = 0; p.jumpBuf = 0; p.noCut = false; p.squash = -0.1; p.wallSliding = false; p.wallDir = 0;
        world.emit('walljump', p);
      }
    }

    // --- гравитация ---
    let gm = 1;
    if (p.vy < 0 && !inp.jump && !p.noCut) gm = C.jumpCutMult;
    else if (inp.jump && Math.abs(p.vy) < 110) gm = C.apexHang;
    p.vy = Math.min(C.maxFall, p.vy + C.gravity * gm * dt);
    if (p.vy >= 0) p.noCut = false;
    if (p.wallSliding && p.vy > C.wallSlideSpeed) p.vy = C.wallSlideSpeed;

    PhysicsEngine.finish(p, world, dt, wasGround, 1);
  }

  /** общая часть: перемещение, приземление, стены, границы */
  static finish(p, world, dt, wasGround, doMove) {
    const C = PLAYER_CONFIG;
    if (doMove) {
      PhysicsEngine.moveX(p, p.vx * dt, world);
      const preVy = p.vy, landed = PhysicsEngine.moveY(p, p.vy * dt, world);
      if (landed) {
        p.onGround = true; p.ground = landed;
        if (!wasGround && preVy > 260) { p.landT = 0.14; p.squash = Math.min(0.22, preVy / 4500); world.emit('land', p); }
        if (landed.kind === 'spring' && preVy > 0) {
          p.vy = C.springVel; p.onGround = false; p.ground = null; p.noCut = true; p.squash = -0.18; landed.compress = 1; world.emit('spring', p);
        } else if (landed.onStand) landed.onStand(world);
      } else { p.onGround = false; p.ground = null; }
    }
    PhysicsEngine.resolve(p, world, dt);
    // стены (для скольжения и прыжка от стены)
    p.wallDir = 0;
    if (!p.onGround && !p.climbing) {
      if (PhysicsEngine.probeWall(p, world, -1)) p.wallDir = -1; else if (PhysicsEngine.probeWall(p, world, 1)) p.wallDir = 1;
    }
    // границы мира
    if (p.x < 0) { p.x = 0; if (p.vx < 0) p.vx = 0; }
    if (p.x + p.w > world.w) { p.x = world.w - p.w; if (p.vx > 0) p.vx = 0; }
    if (p.y < -800) { p.y = -800; p.vy = 0; }
  }
}
if (typeof module !== 'undefined') module.exports = { PhysicsEngine, NO_INPUT };
