/* player.js — состояние стикмена, выбор анимации и отрисовка спрайтом.
   Хитбокс (x,y,w,h) полностью отделён от изображения. */
'use strict';
class Player {
  constructor() {
    this.anim = new AnimationController();
    this.reset(0, 0);
  }
  /** fx, fy — точка «под ногами» (центр хитбокса по X, низ по Y) */
  reset(fx, fy) {
    const C = PLAYER_CONFIG;
    this.w = C.w; this.h = C.h; this.x = fx - C.w / 2; this.y = fy - C.h;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.onGround = false; this.ground = null; this.wasGround = false; this.wallDir = 0; this.wallSliding = false;
    this.crouching = false; this.sliding = false; this.climbing = false; this.pushing = false;
    this.coyote = 0; this.jumpBuf = 0; this.wallCoyote = 0; this.wallCoyoteDir = 0; this.lockT = 0; this.dropT = 0; this.ropeCD = 0; this.landT = 0;
    this.noCut = false; this.squish = 0; this.squash = 0; this.ropeMoving = false; this.wallJumpT = 0;
    this.dead = false; this.deathT = 0; this.victory = false; this.victoryT = 0; this.spawnT = 0.55; this.stepTime = 0;
    this.anim.play('respawn', true);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  setCrouch(on) {
    const C = PLAYER_CONFIG;
    if (on && !this.crouching) { this.y += this.h - C.crouchH; this.h = C.crouchH; this.crouching = true; }
    else if (!on && this.crouching) { this.y -= C.h - this.h; this.h = C.h; this.crouching = false; this.sliding = false; }
  }
  canStand(world) {
    if (!this.crouching) return true;
    const C = PLAYER_CONFIG, r = { x: this.x, y: this.y - (C.h - this.h), w: this.w, h: C.h };
    for (const b of world.solids) if (b.solid && !b.oneway && Util.overlap(r, b)) return false;
    return true;
  }
  /** выбор анимации по состоянию */
  updateAnim(dt, input) {
    const a = this.anim, sp = Math.abs(this.vx);
    a.speed = 1;
    if (this.dead) a.play('death');
    else if (this.victory) a.play('victory');
    else if (this.spawnT > 0.2 && this.onGround) a.play('respawn');
    else if (this.climbing) { a.play(this.ropeMoving ? 'climb' : 'hang'); }
    else if (this.sliding) a.play('slide');
    else if (!this.onGround) {
      if (this.wallSliding) a.play('wallSlide');
      else if (this.wallJumpT > 0) a.play('wallJump');
      else if (this.vy < -40) a.play('jump');
      else a.play('fall');
    } else if (this.crouching) a.play('crouch');
    else if (this.landT > 0) a.play('land');
    else if (this.pushing) a.play('push');
    else if (sp > 190) { a.play('run'); a.speed = Math.max(0.7, sp / PLAYER_CONFIG.maxSpeed); }
    else if (sp > 25) { a.play('walk'); a.speed = Math.max(0.7, sp / 130); }
    else a.play('idle');
    a.update(dt);
    this.squash = Util.approach(this.squash, 0, dt * 1.6);
    if (this.wallJumpT > 0) this.wallJumpT -= dt;
  }
  draw(ctx, sheet, ha, time) {
    if (!sheet.ready) return;
    const C = PLAYER_CONFIG, d = this.anim.def, sc = C.spriteScale * (d.scale || 1);
    const fx = this.cx + (d.ox || 0) * (this.facing < 0 ? -1 : 1), fy = this.y + this.h + (d.oy || 0);
    // респавн: проявление из чернильного круга
    let alpha = 1;
    if (this.spawnT > 0 && !this.dead) {
      alpha = 1 - Util.clamp(this.spawnT / 0.55, 0, 1) * 0.85;
      ctx.save(); ctx.strokeStyle = INK.black; ctx.lineWidth = 2.5; ctx.globalAlpha = Util.clamp(this.spawnT / 0.55, 0, 1);
      ctx.beginPath(); ctx.ellipse(this.cx, this.y + this.h - 2, 12 + (0.55 - this.spawnT) * 90, 4 + (0.55 - this.spawnT) * 14, 0, 0, 6.3); ctx.stroke(); ctx.restore();
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(fx, fy);
    ctx.scale(1 + this.squash, 1 - this.squash);
    sheet.draw(ctx, this.anim.frame, 0, 0, sc, this.facing < 0 && !this.climbing, alpha);
    ctx.restore();
  }
}
