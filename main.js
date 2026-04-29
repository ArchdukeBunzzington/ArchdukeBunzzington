import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x89a0c7, 0.11);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 4.5, 8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.1, 0);
controls.minDistance = 3.8;
controls.maxDistance = 13;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xfff6e1, 0x151c31, 1.06));
const keyLight = new THREE.DirectionalLight(0xfff2db, 1.05);
keyLight.position.set(3.2, 6.4, 3.3);
scene.add(keyLight);

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const clayMaterial = (color) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.95,
  metalness: 0.02,
  flatShading: true,
});

const base = new THREE.Mesh(
  new THREE.CylinderGeometry(4.3, 4.8, 1.35, 36, 1, true),
  clayMaterial(0x584337)
);
base.position.y = -2.9;
globeGroup.add(base);

const dome = new THREE.Mesh(
  new THREE.SphereGeometry(3.35, 52, 52),
  new THREE.MeshPhysicalMaterial({
    color: 0xd4e8ff,
    transmission: 1,
    opacity: 0.22,
    transparent: true,
    roughness: 0.08,
    thickness: 0.22,
    clearcoat: 1,
  })
);
dome.position.y = 0.05;
globeGroup.add(dome);

const world = new THREE.Group();
globeGroup.add(world);

const globeSurface = new THREE.Mesh(
  new THREE.SphereGeometry(2.65, 36, 36),
  clayMaterial(0xbdd5f6)
);
world.add(globeSurface);

const townLayer = new THREE.Group();
townLayer.visible = false;
world.add(townLayer);

const fingerprintLines = [];
for (let i = 0; i < 30; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.66 + Math.random() * 0.025, 0.004, 3, 22),
    new THREE.MeshBasicMaterial({ color: 0x8ca5cf, transparent: true, opacity: 0.16 })
  );
  ring.rotation.x = Math.random() * Math.PI;
  ring.rotation.y = Math.random() * Math.PI;
  ring.rotation.z = Math.random() * Math.PI;
  globeSurface.add(ring);
  fingerprintLines.push(ring);
}

function makeRegion(lat, lon, scale, color, id, label) {
  const region = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), clayMaterial(color));
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = 2.72;
  region.position.set(
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
  region.lookAt(0, 0, 0);
  region.userData = { id, label };
  world.add(region);
  return region;
}

const regions = [
  makeRegion(20, -30, 0.36, 0xe46d5f, 'market', 'Candle Market'),
  makeRegion(42, 55, 0.34, 0x6fa6df, 'park', 'Whispering Park'),
  makeRegion(-8, 100, 0.32, 0xe9c87f, 'toy_shop', 'Hollow Toy Shop'),
];

function buildTownArea() {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 26), clayMaterial(0xe9f4ff));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.55;
  townLayer.add(floor);

  const spots = [
    [-0.9, -0.5, 0xd8875c],
    [0.2, -0.2, 0xefb56f],
    [0.95, 0.55, 0xa16ac8],
  ];

  spots.forEach(([x, z, c], idx) => {
    const shop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), clayMaterial(c));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.53, 0.32, 4), clayMaterial(0x70373f));
    shop.position.set(x, -0.25, z);
    roof.position.set(x, 0.19, z);
    roof.rotation.y = Math.PI / 4;
    townLayer.add(shop, roof);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 18), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.15, transparent: true }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x + 0.08 * (idx + 1), -0.53, z - 0.05);
    townLayer.add(shadow);
  });
}
buildTownArea();

const snowGeo = new THREE.BufferGeometry();
const snowCount = 700;
const snowPos = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i += 1) {
  snowPos[i * 3] = (Math.random() - 0.5) * 8;
  snowPos[i * 3 + 1] = Math.random() * 6 - 0.4;
  snowPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(
  snowGeo,
  new THREE.PointsMaterial({ color: 0xf2f8ff, size: 0.05, transparent: true, opacity: 0.85 })
);
scene.add(snow);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const uiText = document.getElementById('state-list');

const flow = {
  scene: 'globe',
  targetRegion: 'none',
  mood: 'lull',
};

const zoomBlock = {
  active: false,
  progress: 0,
  startPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  endPos: new THREE.Vector3(),
  endTarget: new THREE.Vector3(),
};

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function setHud() {
  uiText.innerHTML = [
    `Scene: ${flow.scene}`,
    `Target area: ${flow.targetRegion}`,
    `Audio mood: ${flow.mood}`,
    'Logic blocks: [camera_scale] -> [scene_transition]',
  ].map((line) => `<li>${line}</li>`).join('');
}
setHud();

// subtle eerie music using oscillator + filtered noise
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const master = audioCtx.createGain();
master.gain.value = 0.045;
master.connect(audioCtx.destination);

const tone = audioCtx.createOscillator();
tone.type = 'triangle';
tone.frequency.value = 178;
const toneGain = audioCtx.createGain();
toneGain.gain.value = 0.25;
tone.connect(toneGain).connect(master);
tone.start();

let nextMoodShift = 0;
function updateMood(time) {
  if (time > nextMoodShift) {
    const creepyLull = Math.random() < 0.6;
    flow.mood = creepyLull ? 'lull' : 'distant_chime';
    const targetFreq = creepyLull ? 165 + Math.random() * 14 : 340 + Math.random() * 60;
    tone.frequency.cancelScheduledValues(audioCtx.currentTime);
    tone.frequency.linearRampToValueAtTime(targetFreq, audioCtx.currentTime + 1.4);
    toneGain.gain.linearRampToValueAtTime(creepyLull ? 0.2 : 0.13, audioCtx.currentTime + 1.4);
    nextMoodShift = time + 4 + Math.random() * 5;
    setHud();
  }
}

function startZoom(region) {
  flow.targetRegion = region.userData.label;
  flow.scene = 'transitioning';
  zoomBlock.active = true;
  zoomBlock.progress = 0;
  zoomBlock.startPos.copy(camera.position);
  zoomBlock.startTarget.copy(controls.target);

  const regionDirection = region.position.clone().normalize();
  zoomBlock.endPos.copy(regionDirection.clone().multiplyScalar(3.9));
  zoomBlock.endPos.y += 0.8;
  zoomBlock.endTarget.set(0, -0.15, 0);
  setHud();
}

function onPointer(evt) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (flow.scene !== 'globe') return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(regions, false);
  if (hits.length) {
    // logic block 1: camera_scale
    startZoom(hits[0].object);
  }
}

window.addEventListener('pointerdown', onPointer, { passive: true });

document.getElementById('shake-btn').addEventListener('click', () => {
  for (let i = 0; i < snowPos.length; i += 3) {
    snowPos[i] += (Math.random() - 0.5) * 0.45;
    snowPos[i + 1] += Math.random() * 0.35;
    snowPos[i + 2] += (Math.random() - 0.5) * 0.45;
  }
  snowGeo.attributes.position.needsUpdate = true;
});

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  world.rotation.y += dt * 0.12;
  fingerprintLines.forEach((r, i) => {
    r.material.opacity = 0.1 + Math.sin(elapsed * 0.9 + i * 0.8) * 0.04;
  });

  const positions = snowGeo.attributes.position.array;
  for (let i = 0; i < snowCount; i += 1) {
    const y = i * 3 + 1;
    positions[y] -= dt * (0.45 + (i % 5) * 0.03);
    if (positions[y] < -2.8) positions[y] = 3.2;
  }
  snowGeo.attributes.position.needsUpdate = true;

  if (zoomBlock.active) {
    zoomBlock.progress = Math.min(1, zoomBlock.progress + dt / 1.6);
    const eased = easeInOut(zoomBlock.progress);

    camera.position.lerpVectors(zoomBlock.startPos, zoomBlock.endPos, eased);
    controls.target.lerpVectors(zoomBlock.startTarget, zoomBlock.endTarget, eased);

    if (zoomBlock.progress >= 1) {
      zoomBlock.active = false;
      // logic block 2: scene_transition
      flow.scene = 'town';
      townLayer.visible = true;
      globeSurface.visible = false;
      regions.forEach((r) => (r.visible = false));
      controls.maxDistance = 8;
      setHud();
    }
  }

  updateMood(elapsed);
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
