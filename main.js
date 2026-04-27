import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js';

class EventEngine {
  constructor() {
    this.time = 0;
    this.activeEvents = [];
    this.listeners = new Map();
    this.state = {
      weather: 'clear',
      tremor: 0,
      chaos: 0,
      populationMood: 'calm',
    };
  }

  on(type, cb) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(cb);
  }

  emit(type, payload) {
    (this.listeners.get(type) ?? []).forEach((cb) => cb(payload));
  }

  trigger(type, duration = 5) {
    const event = {
      type,
      endAt: this.time + duration,
    };
    this.activeEvents.push(event);
    this.applyEventState(type, true);
    this.emit('event-start', event);
  }

  applyEventState(type, starting) {
    if (type === 'blizzard') {
      this.state.weather = starting ? 'blizzard' : 'clear';
      this.state.chaos += starting ? 0.4 : -0.4;
    } else if (type === 'earthquake') {
      this.state.tremor = starting ? 1 : 0;
      this.state.chaos += starting ? 0.5 : -0.5;
    }

    const tension = Math.max(0, this.state.chaos + this.state.tremor * 0.3);
    this.state.populationMood = tension > 0.55 ? 'panicked' : tension > 0.25 ? 'alert' : 'calm';
    this.emit('state-change', structuredClone(this.state));
  }

  update(dt) {
    this.time += dt;

    for (let i = this.activeEvents.length - 1; i >= 0; i -= 1) {
      const event = this.activeEvents[i];
      if (this.time >= event.endAt) {
        this.applyEventState(event.type, false);
        this.emit('event-end', event);
        this.activeEvents.splice(i, 1);
      }
    }

    this.state.chaos = THREE.MathUtils.lerp(this.state.chaos, 0, dt * 0.35);
  }
}

class Character {
  constructor(root, homePosition) {
    this.root = root;
    this.velocity = new THREE.Vector3();
    this.homePosition = homePosition.clone();
    this.wanderTarget = homePosition.clone();
    this.retargetCooldown = 0;
    this.behavior = 'wander';
  }

  setBehavior(mode) {
    this.behavior = mode;
  }

  update(dt, center, weather, tremor) {
    this.retargetCooldown -= dt;
    if (this.retargetCooldown <= 0 && this.behavior === 'wander') {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.4 + Math.random() * 2.3;
      this.wanderTarget.set(Math.cos(angle) * radius, 0.03, Math.sin(angle) * radius);
      this.retargetCooldown = 2 + Math.random() * 4;
    }

    const target = this.behavior === 'seek-shelter' ? this.homePosition : this.wanderTarget;
    const desired = new THREE.Vector3().subVectors(target, this.root.position);
    desired.y = 0;
    const distance = desired.length();

    if (distance > 0.01) {
      desired.normalize();
    }

    const speed = this.behavior === 'panic' ? 1.3 : this.behavior === 'seek-shelter' ? 0.9 : 0.55;
    const jitter = tremor > 0 ? (Math.random() - 0.5) * 0.4 : 0;

    this.velocity.lerp(desired.multiplyScalar(speed + jitter), dt * 2.2);
    this.root.position.addScaledVector(this.velocity, dt);

    const offset = new THREE.Vector3().subVectors(this.root.position, center);
    offset.y = 0;
    const maxR = 2.8;
    if (offset.length() > maxR) {
      offset.setLength(maxR);
      this.root.position.set(center.x + offset.x, this.root.position.y, center.z + offset.z);
    }

    if (weather === 'blizzard') {
      this.root.position.y = 0.03 + Math.sin(performance.now() * 0.01 + this.root.position.x * 3) * 0.01;
    } else {
      this.root.position.y = 0.03;
    }

    const heading = Math.atan2(this.velocity.x, this.velocity.z);
    if (!Number.isNaN(heading)) {
      this.root.rotation.y = heading;
    }
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb6d7ff, 0.095);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4.2, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.25, 0);
controls.minDistance = 4;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.47;

const hemi = new THREE.HemisphereLight(0xd9efff, 0x1c2034, 1.2);
const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(3, 8, 2);
scene.add(hemi, sun);

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const snowBase = new THREE.Mesh(
  new THREE.CylinderGeometry(4.2, 4.9, 1.2, 42),
  new THREE.MeshStandardMaterial({ color: 0x513624, roughness: 0.65, metalness: 0.15 })
);
snowBase.position.y = -2.95;
globeGroup.add(snowBase);

const glass = new THREE.Mesh(
  new THREE.SphereGeometry(3.4, 56, 56),
  new THREE.MeshPhysicalMaterial({
    color: 0xccf0ff,
    transmission: 1,
    opacity: 0.25,
    transparent: true,
    roughness: 0.06,
    metalness: 0,
    thickness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0,
  })
);
glass.position.y = 0.1;
globeGroup.add(glass);

const snowGround = new THREE.Mesh(
  new THREE.SphereGeometry(2.95, 48, 48, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.96 })
);
snowGround.rotation.x = Math.PI;
snowGround.position.y = -0.7;
globeGroup.add(snowGround);

const mountain = new THREE.Mesh(
  new THREE.ConeGeometry(1.4, 2.6, 8),
  new THREE.MeshStandardMaterial({ color: 0x8192a2, roughness: 0.92 })
);
mountain.position.set(0, 0.7, -0.8);
globeGroup.add(mountain);

const peak = new THREE.Mesh(
  new THREE.ConeGeometry(0.68, 1.2, 8),
  new THREE.MeshStandardMaterial({ color: 0xf5faff, roughness: 0.8 })
);
peak.position.set(0, 1.63, -0.8);
globeGroup.add(peak);

function makeBuilding(x, z, h, c = 0x795c4d) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, h, 0.52),
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
  );
  body.position.y = h / 2;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.32, 4),
    new THREE.MeshStandardMaterial({ color: 0x4d1f28, roughness: 0.9 })
  );
  roof.position.y = h + 0.14;
  roof.rotation.y = Math.PI / 4;
  group.add(body, roof);
  group.position.set(x, -0.02, z);
  globeGroup.add(group);
}

[
  [-1.2, -0.4, 0.78],
  [-0.5, 0.45, 0.65],
  [0.4, 0.25, 0.92],
  [1.1, -0.3, 0.72],
].forEach(([x, z, h], i) => makeBuilding(x, z, h, i % 2 ? 0x916b55 : 0x7f5f4a));

function makeTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x6c4831 })
  );
  trunk.position.y = 0.17;
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.27 * scale, 0.7 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x31543d })
  );
  canopy.position.y = 0.62 * scale;
  tree.add(trunk, canopy);
  tree.position.set(x, 0, z);
  globeGroup.add(tree);
}

for (let i = 0; i < 16; i += 1) {
  const theta = (i / 16) * Math.PI * 2;
  const r = 2.15 + Math.random() * 0.6;
  makeTree(Math.cos(theta) * r, Math.sin(theta) * r, 0.9 + Math.random() * 0.35);
}

const characterGroup = new THREE.Group();
globeGroup.add(characterGroup);
const characters = [];
for (let i = 0; i < 6; i += 1) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.08, 0.22, 4, 8),
    new THREE.MeshStandardMaterial({ color: [0xf39d79, 0x7cb0ff, 0xc18dff, 0xffd773][i % 4] })
  );
  body.position.y = 0.2;
  root.add(body);
  root.position.set((Math.random() - 0.5) * 2, 0.03, (Math.random() - 0.5) * 2);
  characterGroup.add(root);
  const home = new THREE.Vector3((i - 2.5) * 0.35, 0.03, 0.5 + (i % 2) * 0.25);
  characters.push(new Character(root, home));
}

const snowParticles = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0xe6f6ff, size: 0.05, transparent: true, opacity: 0.95 })
);
const snowCount = 950;
const positions = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i += 1) {
  const phi = Math.random() * Math.PI * 2;
  const rr = Math.random() * 3;
  positions[i * 3] = Math.cos(phi) * rr;
  positions[i * 3 + 1] = Math.random() * 5.2 - 1;
  positions[i * 3 + 2] = Math.sin(phi) * rr;
}
snowParticles.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
globeGroup.add(snowParticles);

const engine = new EventEngine();
const stateList = document.getElementById('state-list');

function renderState() {
  const lines = [
    `Weather: ${engine.state.weather}`,
    `Tremor: ${engine.state.tremor.toFixed(2)}`,
    `Chaos: ${Math.max(0, engine.state.chaos).toFixed(2)}`,
    `Mood: ${engine.state.populationMood}`,
    `Active Events: ${engine.activeEvents.length ? engine.activeEvents.map((e) => e.type).join(', ') : 'none'}`,
  ];
  stateList.innerHTML = lines.map((line) => `<li>${line}</li>`).join('');
}

engine.on('state-change', () => {
  const weather = engine.state.weather;
  const mood = engine.state.populationMood;
  const behavior = weather === 'blizzard' ? 'seek-shelter' : mood === 'panicked' ? 'panic' : 'wander';
  characters.forEach((character) => character.setBehavior(behavior));
  renderState();
});

engine.on('event-start', ({ type }) => {
  if (type === 'earthquake') {
    globeShakeStrength = 0.22;
  }
});

document.getElementById('shake-btn').addEventListener('click', () => {
  if (Math.random() > 0.45) {
    engine.trigger('blizzard', 8);
  } else {
    engine.trigger('earthquake', 4.5);
  }
});

window.addEventListener('keydown', (evt) => {
  if (evt.key.toLowerCase() === 'b') engine.trigger('blizzard', 8);
  if (evt.key.toLowerCase() === 'e') engine.trigger('earthquake', 4.5);
});

let globeShakeStrength = 0;
const clock = new THREE.Clock();
renderState();

function updateSnow(dt) {
  const arr = snowParticles.geometry.attributes.position.array;
  const isBlizzard = engine.state.weather === 'blizzard';
  const fallSpeed = isBlizzard ? 2.1 : 0.45;
  const drift = isBlizzard ? 0.85 : 0.12;

  for (let i = 0; i < snowCount; i += 1) {
    const idx = i * 3;
    arr[idx + 1] -= dt * (fallSpeed + Math.random() * 0.2);
    arr[idx] += (Math.random() - 0.5) * drift * dt;
    arr[idx + 2] += (Math.random() - 0.5) * drift * dt;

    if (arr[idx + 1] < -1.2) {
      arr[idx + 1] = 4;
    }

    const radius = Math.hypot(arr[idx], arr[idx + 2]);
    if (radius > 3.15) {
      arr[idx] *= 0.95;
      arr[idx + 2] *= 0.95;
    }
  }

  snowParticles.geometry.attributes.position.needsUpdate = true;
  snowParticles.material.opacity = isBlizzard ? 1 : 0.55;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  engine.update(dt);

  const tremor = engine.state.tremor;
  globeShakeStrength = THREE.MathUtils.lerp(globeShakeStrength, 0, dt * 1.5);

  globeGroup.rotation.y += dt * 0.18;
  globeGroup.position.x = Math.sin(performance.now() * 0.03) * globeShakeStrength;
  globeGroup.position.z = Math.cos(performance.now() * 0.027) * globeShakeStrength;
  globeGroup.rotation.z = (Math.random() - 0.5) * 0.04 * (tremor + globeShakeStrength);

  characters.forEach((character) => character.update(dt, new THREE.Vector3(0, 0, 0), engine.state.weather, tremor));
  updateSnow(dt);

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
