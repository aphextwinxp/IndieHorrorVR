// Сюжетная логика Акта I (вертикальный срез): фонарик → магнитофон → предохранитель → лифт.
import { CFG } from './config.js';
import { segmentBlocked } from './physics.js';

export class Game {
  constructor() {
    this.running = false; this.busy = false; this.ended = false;
    this.timers = []; this.muted = false; this.caughtCount = 0;
    this.flags = {};
  }

  init(ctx) { Object.assign(this, ctx); }

  after(sec, fn) { this.timers.push({ t: sec, fn }); }

  start() {
    if (this.running) return;
    this.running = true;
    this.player.setPosition(CFG.start.x, CFG.start.z, CFG.start.yaw);
    this.ui.setObjective('Найти фонарик на столе (хват — взять)');
    this.after(2.5, () => this.say('Марта: Алекс, ты спустился? Связь плохая. На столе слева должен быть фонарик.', 7));
  }

  toggleMute() {
    this.muted = !this.muted;
    this.ui.setLine(this.muted ? 'Рация приглушена (шум от неё не создаётся)' : 'Рация включена', 3);
  }

  // Голос Марты. Он тоже шум — его можно приглушить (кнопка X / в настройках).
  say(text, secs = 6) {
    this.ui.setLine(text, secs);
    if (!this.muted) {
      this.audio.radioBlip();
      this.noise.emit(this.player.headPos, 0.12, 'radio');
    }
  }

  onFlashlightGrabbed() {
    if (this.flags.flash) return;
    this.flags.flash = true;
    this.ui.setObjective('Включить магнитофон на столе (курок рядом с ним)');
    this.after(1.5, () => this.say('Марта: Хорошо. Теперь запусти магнитофон — нам нужна запись с «чёрного ящика». Курок рядом с ним.', 8));
  }

  playTape() {
    const t = this.level.tape;
    if (t.used) return;
    t.used = true; t.playing = true;
    this.audio.tape(8);
    this.ui.setObjective('Слушать запись…');
    this.after(1, () => this.ui.setLine('ЗАПИСЬ: «…запись четырнадцать. Оно реагирует на звук.»', 3));
    this.after(4.2, () => this.ui.setLine('ЗАПИСЬ: «Не шумите. Оно слышит… даже…»', 3));
    this.after(8, () => {
      t.playing = false;
      this.monster.reset(); // существо просыпается в лаборатории
      this.audio.scare();
      this.ui.setObjective('Найти предохранитель в лаборатории (дальше по коридору)');
      this.after(1.5, () => this.say('Марта: Алекс… оно проснулось. Не двигайся резко. Предохранитель в лаборатории — иди тихо. Бросай предметы, чтобы отвлечь.', 9));
    });
  }

  onFuseInserted() {
    if (this.flags.fuse) return;
    this.flags.fuse = true;
    this.level.openDoor(this.audio);
    this.noise.emit(this.level.fusebox.pos, 0.5, 'door'); // дверь скрипит громко
    this.ui.setObjective('Добраться до лифта');
    this.after(1, () => this.say('Марта: Получилось! Дверь открылась. Лифт прямо за ней — только тихо!', 6));
  }

  onChase() {
    if (this.flags.chase) return;
    this.flags.chase = true;
    this.after(0.5, () => this.say('Марта: Он тебя слышит! Присядь за стеллажом и замри!', 5));
  }

  caught() {
    if (this.busy || this.ended) return;
    this.busy = true; this.caughtCount++;
    this.audio.scare();
    this.ui.fadeTo(1, 0.4);
    this.ui.centerText('Слушатель нашёл тебя');
    this.after(3.5, () => {
      this.player.setPosition(CFG.checkpoint.x, CFG.checkpoint.z, CFG.checkpoint.yaw);
      this.monster.reset();
      this.ui.centerText('');
      this.ui.fadeTo(0, 1.2);
      this.busy = false;
    });
  }

  finish() {
    if (this.ended) return;
    this.ended = true; this.busy = true;
    this.ui.fadeTo(1, 3);
    const ending = this.caughtCount === 0 ? 'Концовка: «Тишина»' : 'Концовка: «Эхо»';
    this.after(3, () => this.ui.centerText(`${ending}. Конец вертикального среза`));
  }

  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i]; t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    if (!this.running || this.ended) return;
    const p = this.player.headPos, e = this.level.endZone;
    if (!this.busy && p.x >= e.x1 && p.x <= e.x2 && p.z >= e.z1 && p.z <= e.z2) this.finish();

    // первый раз увидел существо
    const m = this.monster;
    if (m.active && !this.flags.seen) {
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
      const f = this.player.forward;
      const dot = (f.x * dx + f.z * dz) / (Math.hypot(f.x, f.z) * d + 1e-6);
      if (d < 10 && dot > 0.75 && !segmentBlocked(p.x, p.z, m.x, m.z, this.level.colliders)) {
        this.flags.seen = true;
        this.say('Марта: Это оно… Слепое. Оно ищет звук. Не дыши громко.', 5);
      }
    }
  }
}
