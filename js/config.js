/* =========================================================================
   config.js — все настраиваемые константы игры в одном месте
   ========================================================================= */
'use strict';

/** Фиксированный шаг физики. Отрисовка идёт отдельно (requestAnimationFrame). */
const PHYS = { dt: 1 / 120, maxFrame: 0.25 };

/** Параметры игрока (px, секунды). Хитбокс НЕ зависит от рисунка спрайта. */
const PLAYER_CONFIG = {
  w: 26, h: 68,               // стоя
  crouchH: 38,                // присед / слайд
  maxSpeed: 260,              // горизонтальная скорость
  accel: 1800,                // ускорение на земле
  decel: 2200,                // торможение на земле
  airAccel: 1500,             // управление в воздухе
  airDecel: 700,
  iceAccel: 420, iceDecel: 150,
  gravity: 1800,
  jumpVel: -650,              // начальная скорость прыжка (вверх < 0)
  maxFall: 900,
  jumpCutMult: 2.6,           // множитель гравитации, если кнопку прыжка отпустили (переменная высота)
  apexHang: 0.62,             // «зависание» у вершины прыжка при удержании кнопки
  coyote: 0.10,               // coyote time
  jumpBuffer: 0.12,           // jump buffer
  crouchSpeed: 105,
  slideSpeed: 430, slideFriction: 560, slideMinSpeed: 150,
  wallSlideSpeed: 95, wallJumpVx: 310, wallJumpVy: -610, wallJumpLock: 0.17, wallCoyote: 0.12,
  climbSpeed: 150,
  springVel: -980,
  pushSpeed: 115,
  conveyorSpeed: 150,
  spriteScale: 2,             // масштаб спрайта (целый — края остаются чёткими)
};

/** Название игры, ключи сохранений */
const GAME = { title: 'Stickman Paper Parkour', saveKey: 'spp_save_v1', animKey: 'spp_anims_v1' };

/** Цвета «чернил» */
const INK = { black: '#1b1b21', pencil: '#6d6d78', red: '#d4352c', blue: '#2b4fb8', green: '#2f8f4e',
  yellow: '#f2b82a', paper: '#f6f1e3', paperDark: '#e8e0cb' };

/* =========================================================================
   ANIMATIONS — назначение кадров спрайт-листа.
   Номера кадров = индексы в assets/sprites.json (читаются слева направо,
   сверху вниз). Определены вручную по контактному листу (см. Sprite Inspector).
   Для отсутствующих в листе действий (respawn, push, wallSlide) использованы
   ближайшие по позе кадры + процедурные эффекты (помечено в поле note).
   ========================================================================= */
const DEFAULT_ANIMATIONS = {
  idle:      { frames: [368, 369, 370, 371, 372, 373, 374, 375, 376, 375, 374, 373, 372, 371, 370, 369], fps: 8, loop: true,  ox: 0, oy: 0, scale: 1, note: 'стойка, пинг-понг' },
  walk:      { frames: [71, 69, 65, 69],                         fps: 7,  loop: true,  ox: 0, oy: 0, scale: 1, note: 'медленный шаг (кадры бега, меньше fps)' },
  run:       { frames: [56, 59, 62, 65, 69, 71],                 fps: 14, loop: true,  ox: 0, oy: 0, scale: 1, note: 'бег (fps зависит от скорости)' },
  jump:      { frames: [397, 398],                               fps: 8,  loop: false, ox: 0, oy: 0, scale: 1, note: 'движение вверх' },
  fall:      { frames: [48, 49],                                 fps: 8,  loop: true,  ox: 0, oy: 0, scale: 1, note: 'падение: руки вверх' },
  land:      { frames: [42, 43, 44, 45],                         fps: 24, loop: false, ox: 0, oy: 0, scale: 1, note: 'касание поверхности' },
  crouch:    { frames: [26, 27, 28, 29],                         fps: 14, loop: false, ox: 0, oy: 0, scale: 1, note: 'приседание' },
  slide:     { frames: [455, 456, 457, 458],                     fps: 14, loop: true,  ox: 0, oy: 0, scale: 1, note: 'скольжение' },
  climb:     { frames: [491, 492, 493, 494],                     fps: 9,  loop: true,  ox: 0, oy: 0, scale: 1, note: 'карабканье по верёвке' },
  hang:      { frames: [272, 273],                               fps: 3,  loop: true,  ox: 0, oy: 0, scale: 1, note: 'висение на верёвке' },
  wallSlide: { frames: [295, 296],                               fps: 4,  loop: true,  ox: 0, oy: 0, scale: 1, note: 'скольжение по стене (ближайшие кадры)' },
  wallJump:  { frames: [397, 398],                               fps: 10, loop: false, ox: 0, oy: 0, scale: 1, note: 'прыжок от стены' },
  death:     { frames: [379, 380, 381, 382],                     fps: 9,  loop: false, ox: 0, oy: 0, scale: 1, note: 'проигрыш' },
  respawn:   { frames: [239, 368],                               fps: 6,  loop: false, ox: 0, oy: 0, scale: 1, note: 'возрождение + процедурное «проявление»' },
  victory:   { frames: [103, 104, 105, 106, 107, 108, 107, 106, 105, 104], fps: 9, loop: true, ox: 0, oy: 0, scale: 1, note: 'победа' },
  push:      { frames: [252, 253, 247, 253],                     fps: 6,  loop: true,  ox: 0, oy: 0, scale: 1, note: 'толкание ящика (ближайшие кадры)' },
};
let ANIMATIONS = JSON.parse(JSON.stringify(DEFAULT_ANIMATIONS));

/** Настройки по умолчанию */
const DEFAULT_SETTINGS = {
  volume: 0.7, sound: true, handFx: 1, uiScale: 1, touchSize: 1, touchOpacity: 0.55,
  particles: 'high', lowFx: false, zoom: 1, showTouch: 'auto',
};

/** Частоты перерисовки «ожившего рисунка» (кадров/сек) */
const HAND_FPS = { platform: 3.5, deco: 3, spike: 5, saw: 8, coin: 5, flag: 4, hazard: 5, rope: 3, finish: 4, crate: 3 };

/* Совместимость с Node (для автотестов физики) */
if (typeof module !== 'undefined') module.exports = { PHYS, PLAYER_CONFIG, INK, DEFAULT_ANIMATIONS };
