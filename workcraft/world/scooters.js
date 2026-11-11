// The garage is a showroom: four AIMA scooters built from boxes, one per model
// line. Everything is authored in local metres with the front wheel pointing at
// +X, then dropped into the room with `B.at(x, 0, z, ry)`.
import * as THREE from 'three';
import { canvasTexture } from '@engine/world/textures.js';

// Paint finishes reuse the engine's flat `paint` tile with a tint, so the
// scooters take the room's baked light exactly like the rest of the furniture.
const shellOf = tint => ({ tex: 'paint', tint });
const glowOf = (tint, emissive = 1.4) => ({ tex: 'paint', tint, emissive });
const steel = { tex: 'steel' };
const chrome = { tex: 'stainless', metal: true };
const rubber = { tex: 'paint', tint: 0x191a1c };

const MODELS = [
  {
    id: 'space-l',
    cn: '元宇宙 Space L',
    en: 'SPACE L',
    series: 'Q 系列 · 电轻摩',
    shell: 0xf1e7d3, accent: 0xe07a34, seat: 0x8b7c66,
    basket: true, roundLamp: true,
  },
  {
    id: 'a7-plus',
    cn: '爱玛 A7 Plus',
    en: 'A7 PLUS',
    series: 'A 系列 · 电摩',
    shell: 0x3c4147, accent: 0xb9f23c, seat: 0x24272b,
    barLamp: true, backrest: true,
  },
  {
    id: 's1-max',
    cn: '爱玛马赫 S1 MAX',
    en: 'S1 MAX',
    series: '商用系列 · 电摩',
    shell: 0xe8ecef, accent: 0x2f6fd0, seat: 0x2b2f36,
    cargo: true, long: true,
  },
  {
    id: 'luna',
    cn: '爱玛露娜',
    en: 'AIMA LUNA',
    series: 'S 系列 · 电轻摩',
    shell: 0xe7e0f1, accent: 0x8f6fc4, seat: 0x4a4056,
    long: true, roundLamp: true, backrest: true,
  },
];

// A wheel is a ring of small boxes: sixteen segments read as a circle once the
// light hits them, and it stays in the same voxel language as the house.
function wheel(B, cx, r, width) {
  const seg = 16, thickness = 0.095;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    B.box(cx + Math.cos(a) * r, r + Math.sin(a) * r - thickness / 2, 0,
      thickness * 1.15, thickness, width, rubber, { rz: a + Math.PI / 2 });
  }
  // Hub and two spokes.
  B.box(cx - 0.05, r - 0.05, -0.03, 0.10, 0.10, 0.06, chrome);
  B.box(cx - r * 0.7, r - 0.03, -0.02, r * 1.4, 0.05, 0.04, chrome);
  B.box(cx - 0.025, r - r * 0.7, -0.02, 0.05, r * 1.4, 0.04, chrome);
}

// Step-through scooter: the three production models share this body and differ
// in front face, rear box and wheel size.
function scooter(B, m) {
  const shell = shellOf(m.shell), trim = shellOf(m.accent), seat = shellOf(m.seat);
  const r = m.long ? 0.25 : 0.26, front = 0.62, rear = -0.60;
  wheel(B, front, r, 0.13);
  wheel(B, rear, r, 0.15);

  // Deck and the body under the seat.
  B.box(-0.02, 0.27, 0, m.long ? 0.98 : 0.86, 0.07, 0.38, shell);
  B.box(-0.30, 0.30, 0, 0.78, 0.32, 0.34, shell);
  B.box(-0.34, 0.60, 0, 0.72, 0.11, 0.32, seat);
  // A small step-up behind the seat, the way a scooter's tail rises.
  B.box(-0.66, 0.52, 0, 0.16, 0.14, 0.30, shell);

  // Front apron, raked back a little.
  B.box(0.60, 0.30, 0, 0.30, 0.68, 0.36, shell, { rz: -0.08 });
  B.box(0.62, 0.42, 0, 0.42, 0.06, 0.17, shell);
  B.box(0.62, 0.44, 0, 0.34, 0.06, 0.17, shell);
  B.box(-0.62, 0.44, 0, 0.34, 0.06, 0.17, shell);

  // Handlebar and mirrors.
  B.box(0.62, 0.92, 0, 0.07, 0.16, 0.10, steel);
  B.box(0.62, 1.05, 0, 0.08, 0.05, 0.56, steel);
  for (const s of [-1, 1]) {
    B.box(0.60, 1.10, s * 0.26, 0.04, 0.12, 0.04, steel);
    B.box(0.58, 1.20, s * 0.30, 0.05, 0.09, 0.11, trim);
  }

  // Tail light.
  B.box(-0.73, 0.56, 0, 0.04, 0.10, 0.22, glowOf(0xd23a2e, 1.2));

  if (m.roundLamp) {
    // A round headlamp: a ring of small boxes around a glowing core.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      B.box(0.76 + Math.cos(a) * 0.11, 0.86 + Math.sin(a) * 0.11 - 0.03, 0, 0.05, 0.06, 0.10, chrome);
    }
    B.box(0.76, 0.82, 0, 0.05, 0.10, 0.14, glowOf(m.accent, 1.5));
    // Front basket.
    B.box(0.66, 0.74, 0, 0.30, 0.03, 0.34, steel);
    for (const s of [-1, 1]) {
      B.box(0.66, 0.74, s * 0.15, 0.28, 0.22, 0.03, steel);
    }
    B.box(0.52, 0.74, 0, 0.03, 0.22, 0.30, steel);
  }

  if (m.barLamp) {
    // Full-width light bar and two amber strips on the apron.
    B.box(0.75, 0.80, 0, 0.05, 0.08, 0.46, glowOf(0xe8f6ff, 1.6));
    B.box(0.72, 0.66, 0, 0.06, 0.05, 0.30, glowOf(m.accent, 1.2));
    B.box(0.24, 0.30, 0, 0.05, 0.16, 0.30, trim);
  }

  if (m.backrest) {
    B.box(-0.62, 0.66, 0, 0.10, 0.26, 0.28, seat);
  }

  if (m.cargo) {
    // 32 L delivery box on a rack.
    B.box(-0.52, 0.66, 0, 0.36, 0.03, 0.34, steel);
    B.box(-0.60, 0.68, 0, 0.44, 0.42, 0.40, shell);
    B.box(-0.60, 0.68, 0, 0.45, 0.06, 0.41, trim);
    B.box(-0.81, 0.86, 0, 0.02, 0.10, 0.16, glowOf(0xd23a2e, 1.2));
  }
}

// Naked street bike: no step-through deck, a tank between the knees, twin
// fork legs and bigger wheels.
function bike(B, m) {
  const shell = shellOf(m.shell), trim = shellOf(m.accent), seat = shellOf(m.seat);
  const r = 0.30, front = 0.68, rear = -0.66;
  wheel(B, front, r, 0.12);
  wheel(B, rear, r, 0.16);

  B.box(-0.02, 0.28, 0, 1.00, 0.09, 0.13, steel);
  // Tank, seat, tail.
  B.box(0.10, 0.56, 0, 0.52, 0.24, 0.30, shell);
  B.box(0.10, 0.78, 0, 0.44, 0.05, 0.28, trim);
  B.box(-0.34, 0.62, 0, 0.52, 0.12, 0.30, seat);
  B.box(-0.64, 0.68, 0, 0.26, 0.07, 0.26, shell);
  B.box(-0.78, 0.66, 0, 0.03, 0.08, 0.18, glowOf(0xd23a2e, 1.3));

  // Twin forks and the headlight nacelle.
  for (const s of [-1, 1]) {
    B.box(0.62, 0.34, s * 0.11, 0.09, 0.62, 0.07, chrome, { rz: -0.20 });
  }
  B.box(0.62, 0.68, 0, 0.26, 0.26, 0.28, shell);
  B.box(0.70, 0.76, 0, 0.05, 0.13, 0.20, glowOf(0xf6f1e2, 1.5));
  B.box(0.56, 0.94, 0, 0.07, 0.05, 0.58, steel);
  for (const s of [-1, 1]) B.box(0.54, 1.00, s * 0.27, 0.05, 0.08, 0.10, trim);

  // Exhaust and engine block.
  B.box(-0.30, 0.22, 0.17, 0.72, 0.09, 0.09, chrome);
  B.box(-0.06, 0.24, 0, 0.34, 0.22, 0.26, steel);
  B.box(-0.02, 0.30, 0.20, 0.40, 0.05, 0.04, trim);
}

// The plate is read from two or three metres away in the aisle, so it carries
// only the model name in large type and a line telling you it can be tapped —
// the numbers live in the detail sheet the page shows when you click it.
function plateTexture(model) {
  return canvasTexture(640, 205, (ctx, w, h) => {
    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8492f';
    ctx.fillRect(0, 0, 14, h);

    ctx.textBaseline = 'alphabetic';
    const family = '"Noto Sans SC", "PingFang SC", system-ui, sans-serif';
    let size = 76;
    ctx.font = `700 ${size}px ${family}`;
    while (ctx.measureText(model.cn).width > w - 100 && size > 34) {
      size -= 4;
      ctx.font = `700 ${size}px ${family}`;
    }
    ctx.fillStyle = '#1d211f';
    ctx.fillText(model.cn, 46, 100);

    ctx.fillStyle = '#6b7a70';
    ctx.font = '500 30px ui-monospace, Menlo, monospace';
    ctx.fillText(model.en, 46, 150);

    ctx.fillStyle = '#c0442a';
    ctx.font = `600 32px ${family}`;
    ctx.textAlign = 'right';
    ctx.fillText('点击看参数', w - 46, 150);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#d8d1c2';
    ctx.fillRect(46, 168, w - 92, 2);
  }, { pixelated: false });
}

// Showroom layout inside GARAGE (11..20 × -12..3): four bays down the room,
// nose to the door, each with a floor line, a plate and its own wash light.
export function buildScooters({ B, planes, obstacles, pickables, lighting, garage }) {
  const bayZ = [-9.2, -6.2, -3.2, -0.2];
  // 车和牌一起向里退：原来贴着玻璃门，进门就被车堵住；现在停在车库纵深
  // 三分之二处（离门约 6 米），门口留出一截走道。
  const x = 17.2, plateX = 15.3;

  MODELS.forEach((m, i) => {
    const z = bayZ[i];
    // Nose towards the door (-X): the room is walked from the west glazing.
    B.at(x, 0, z, Math.PI, () => (m.bike ? bike(B, m) : scooter(B, m)));

    // Painted bay outline on the floor.
    B.box(x, 0.005, z - 0.95, 2.5, 0.012, 0.05, shellOf(0xdfd8c8));
    B.box(x, 0.005, z + 0.95, 2.5, 0.012, 0.05, shellOf(0xdfd8c8));
    B.box(x - 1.25, 0.005, z, 0.05, 0.012, 1.9, shellOf(0xdfd8c8));

    // 牌不能和背后的挡板共面：两者深度太近时会出现斑驳的黑块。牌子往前错开
    // 5 厘米，挡板退到后面当背板，四周留出一圈边框。
    B.box(plateX + 0.075, 0.66, z, 0.05, 0.40, 1.20, steel);
    const tex = plateTexture(m);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.36),
      new THREE.MeshBasicMaterial({
        map: tex,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    plate.position.set(plateX, 0.66, z);
    plate.rotation.set(-0.08, -Math.PI / 2, 0, 'YXZ');
    planes.push(plate);
    // 立柱从地面顶到牌的下边。
    B.box(plateX + 0.05, 0, z, 0.06, 0.48, 0.06, steel);
    // 牌面做得矮，远看认不出细节，所以整块牌子都可点，点开看详情。
    pickables.push({
      id: m.id,
      box: new THREE.Box3(
        new THREE.Vector3(plateX - 0.26, 0.40, z - 0.64),
        new THREE.Vector3(plateX + 0.26, 0.92, z + 0.64),
      ),
    });

    lighting.push({ id: `showroom-${m.id}`, position: [x, 2.5, z], power: 1.15, radius: 4.6, direction: [0, -1, 0.1] });
    obstacles.push({ x0: x - 1.15, x1: x + 1.15, z0: z - 0.5, z1: z + 0.5, level: 0 });
  });

  // A rail light runs the length of the showroom ceiling.
  for (const z of bayZ) lighting.push({ id: 'showroom-rail', position: [13.2, 2.9, z], power: 0.45, radius: 3.3, direction: [-1, -1, 0] });
}
