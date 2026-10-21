// Уровень: Зона A (кабинет) → коридор → Зона B (лаборатория) → дверь → лифт.
// Всё из примитивов + процедурные текстуры. Позже заменить на glTF с запечённым светом.
import * as THREE from 'three';

function concrete(r, g, b, spread) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 128, 128);
  const img = x.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * spread;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
    x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, 8 + Math.random() * 24, 0, 6.28); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function tileUV(geo, w, h, d, s = 2) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    let su, sv;
    if (face < 2) { su = d / s; sv = h / s; }
    else if (face < 4) { su = w / s; sv = d / s; }
    else { su = w / s; sv = h / s; }
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
}

export function buildLevel(scene) {
  const L = { colliders: [], surfaces: [], hideZones: [], rooms: [], items: [], waypoints: [], lights: [], time: 0 };

  const wallMat = new THREE.MeshLambertMaterial({ map: concrete(100, 104, 106, 40) });
  const floorTex = concrete(70, 72, 72, 30); floorTex.repeat.set(20, 20);
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x2a2c2e });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x4a3524 });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x3b4044 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x15171a });

  const addBox = (x1, y1, z1, x2, y2, z2, mat, opt = {}) => {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1;
    const g = new THREE.BoxGeometry(w, h, d); tileUV(g, w, h, d);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    scene.add(m);
    let col = null;
    if (opt.collide) {
      col = { x1, z1, x2, z2, y2, name: opt.name || '' };
      L.colliders.push(col);
      if (opt.surface) L.surfaces.push(col);
    }
    return { mesh: m, col };
  };
  const wall = (x1, z1, x2, z2) => {
    const t = 0.1;
    if (z1 === z2) addBox(Math.min(x1, x2) - t, 0, z1 - t, Math.max(x1, x2) + t, 3, z1 + t, wallMat, { collide: true });
    else addBox(x1 - t, 0, Math.min(z1, z2) - t, x1 + t, 3, Math.max(z1, z2) + t, wallMat, { collide: true });
  };
  const light = (x, y, z, color, intensity, dist, fixture = true) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.8);
    l.position.set(x, y, z); scene.add(l);
    L.lights.push({ light: l, base: intensity, flicker: false });
    if (fixture) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.15), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, 2.95, z); scene.add(m);
    }
    return L.lights[L.lights.length - 1];
  };

  // --- пол и потолок ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 60).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(0, 0, -8); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 60).rotateX(Math.PI / 2), ceilMat);
  ceil.position.set(0, 3, -8); scene.add(ceil);
  scene.add(new THREE.HemisphereLight(0x334466, 0x080808, 0.6));

  // --- комнаты (для проверки точки телепорта) ---
  L.rooms = [
    { x1: -4, x2: 4, z1: 0, z2: 8 },       // A
    { x1: -1, x2: 1, z1: -6, z2: 0 },      // коридор
    { x1: -8, x2: 8, z1: -16, z2: -6 },    // B лаборатория
    { x1: -3, x2: 3, z1: -24, z2: -16 }    // лифт
  ];
  L.inRooms = (x, z) => L.rooms.some(r => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);

  // --- Зона A ---
  wall(-4, 8, 4, 8); wall(-4, 0, -4, 8); wall(4, 0, 4, 8);
  wall(-4, 0, -1, 0); wall(1, 0, 4, 0);
  // коридор
  wall(-1, -6, -1, 0); wall(1, -6, 1, 0);
  // --- Зона B ---
  wall(-8, -6, -1, -6); wall(1, -6, 8, -6);
  wall(-8, -16, -8, -6); wall(8, -16, 8, -6);
  wall(-8, -16, -1, -16); wall(1, -16, 8, -16);
  // --- лифт ---
  wall(-3, -24, -3, -16); wall(3, -24, 3, -16); wall(-3, -24, 3, -24);

  // стол в Зоне A
  addBox(-3.6, 0.85, 0.8, -1.8, 0.9, 1.6, woodMat);
  [[-3.55, 0.85], [-1.85, 0.85]].forEach(([x]) => [0.85, 1.55].forEach(z => addBox(x - 0.03, 0, z - 0.03, x + 0.03, 0.85, z + 0.03, woodMat)));
  const desk = { x1: -3.6, z1: 0.8, x2: -1.8, z2: 1.6, y2: 0.9, name: 'desk' };
  L.colliders.push(desk); L.surfaces.push(desk);
  // шкаф-стеллаж в углу A
  addBox(2.8, 0, 6.8, 3.9, 2.0, 7.9, metalMat, { collide: true });

  // стеллажи лаборатории (укрытия)
  const shelf = (x1, z1, x2, z2) => addBox(x1, 0, z1, x2, 2.0, z2, metalMat, { collide: true });
  shelf(-6, -9.3, -3, -8.7); shelf(3, -9.3, 6, -8.7);
  shelf(-6, -13.3, -3, -12.7); shelf(3, -13.3, 6, -12.7);
  const table = addBox(-1, 0, -11.5, 1, 0.9, -10.5, woodMat, { collide: true, surface: true });

  // ящик с предохранителем
  addBox(6.1, 0, -15.0, 6.9, 0.6, -14.2, woodMat, { collide: true, surface: true });

  // зоны укрытия (присел + внутри = шум ×0.4)
  L.hideZones = [
    { x1: -6, x2: -3, z1: -8.7, z2: -7.7 },
    { x1: 3, x2: 6, z1: -12.6, z2: -11.6 },
    { x1: -6, x2: -3, z1: -14.2, z2: -13.4 },
    { x1: -3.6, x2: -1.8, z1: 1.6, z2: 2.4 }
  ];

  // --- свет ---
  light(0, 2.9, 4, 0xffcc88, 18, 14);
  const corr = light(0, 2.9, -3, 0xddeeff, 6, 8); corr.flicker = true;
  light(-6, 2.9, -10, 0xff2200, 10, 12);
  light(6, 2.9, -10, 0xff2200, 10, 12);
  light(0, 2.9, -14, 0xff2200, 10, 12);
  light(0, 2.9, -20, 0x44ff88, 6, 9);

  // --- лифт (декор) ---
  addBox(-1.5, 0, -23.9, 1.5, 2.6, -23.6, metalMat);
  addBox(-0.05, 0.1, -23.59, 0.05, 2.5, -23.55, darkMat);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0x44ff88 }));
  lamp.position.set(0, 2.7, -23.58); scene.add(lamp);
  L.endZone = { x1: -2, x2: 2, z1: -23.5, z2: -20 };

  // --- дверь в лифт (закрыта, пока не вставлен предохранитель) ---
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2.9, 0.2), metalMat);
  doorMesh.position.set(0, 1.45, -16); scene.add(doorMesh);
  const doorCol = { x1: -1, z1: -16.1, x2: 1, z2: -15.9, y2: 3, name: 'door2' };
  L.colliders.push(doorCol);
  L.door = { mesh: doorMesh, col: doorCol, opening: false, t: 0 };
  L.openDoor = (audio) => {
    if (L.door.opening) return;
    L.door.opening = true; doorCol.disabled = true;
    audio?.creak({ x: 0, y: 1.5, z: -16 });
  };

  // --- щиток для предохранителя ---
  const fb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), metalMat);
  fb.position.set(-4, 1.4, -15.9); scene.add(fb);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0xaa2200 }));
  slot.position.set(-4, 1.4, -15.83); scene.add(slot);
  L.fusebox = { pos: new THREE.Vector3(-4, 1.4, -15.75), slot };

  // --- магнитофон ---
  const tapeG = new THREE.Group(); tapeG.position.set(-2.3, 0.92, 1.2);
  tapeG.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.2), darkMat));
  const reelMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const reels = [-0.07, 0.07].map(x => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), reelMat);
    r.position.set(x, 0.05, 0); tapeG.add(r); return r;
  });
  scene.add(tapeG);
  L.tape = { pos: new THREE.Vector3(-2.3, 0.95, 1.2), reels, playing: false, used: false };

  // --- предметы ---
  const vec = () => new THREE.Vector3();
  const addItem = (props) => { L.items.push({ vel: vec(), sleep: true, held: null, lastImpact: 0, inserted: false, ...props }); return L.items[L.items.length - 1]; };

  const canMat = new THREE.MeshLambertMaterial({ color: 0x7a4a2a });
  const can = (x, y, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), canMat);
    m.position.set(x, y, z); scene.add(m);
    addItem({ type: 'can', mesh: m, halfH: 0.06, radius: 0.05, loud: 1.0 });
  };
  can(2, 0.06, 6); can(3, 0.06, 3); can(-2, 0.06, 5);
  can(-7, 0.06, -7); can(7, 0.06, -7); can(0, 0.96, -11);

  // фонарик
  const fg = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 10).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 10).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x888866 }));
  lens.position.z = -0.095;
  fg.add(body, lens);
  const spot = new THREE.SpotLight(0xfff2cc, 0, 16, 0.45, 0.5, 1.5);
  spot.position.set(0, 0, -0.1); spot.target.position.set(0, 0, -3);
  fg.add(spot, spot.target);
  fg.position.set(-2.9, 0.935, 1.2); fg.rotation.y = 0.4; scene.add(fg);
  L.flash = addItem({ type: 'flashlight', mesh: fg, halfH: 0.04, radius: 0.06, loud: 0.5, spot, on: false });

  // предохранитель
  const fuseM = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: 0x331500 }));
  fuseM.position.set(6.5, 0.625, -14.6); scene.add(fuseM);
  L.fuse = addItem({ type: 'fuse', mesh: fuseM, halfH: 0.03, radius: 0.07, loud: 0.4 });

  // --- патрульные точки существа (только свободные места) ---
  L.waypoints = [
    { x: -6.5, z: -7.2 }, { x: 0, z: -7.2 }, { x: 6.5, z: -7.2 },
    { x: 6.5, z: -10.8 }, { x: 0, z: -14.5 }, { x: -6.5, z: -14.5 }, { x: -6.5, z: -10.8 }
  ];

  // --- обновление: мигание, дверь, катушки ---
  L.update = (dt) => {
    L.time += dt;
    for (const l of L.lights) {
      if (l.flicker) l.light.intensity = l.base * (Math.random() > 0.96 ? 0.15 : 0.85 + 0.15 * Math.sin(L.time * 9));
    }
    if (L.door.opening && L.door.t < 1) {
      L.door.t = Math.min(1, L.door.t + dt / 3);
      L.door.mesh.position.y = 1.45 + L.door.t * 3.0;
    }
    if (L.tape.playing) L.tape.reels.forEach(r => (r.rotation.y += dt * 6));
  };

  return L;
}
