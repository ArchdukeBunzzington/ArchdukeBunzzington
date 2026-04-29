import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js';

const NOC_STATES = Object.freeze({
  WORK: 'work',
  HOME: 'home',
  SOCIAL: 'social',
});

class NOC {
  constructor({ id, root, anchors }) {
    this.id = id;
    this.root = root;
    this.anchors = anchors;
    this.velocity = new THREE.Vector3();
    this.state = NOC_STATES.WORK;
    this.stateTimer = 3 + Math.random() * 4;
  }

  chooseNextState() {
    if (this.state === NOC_STATES.WORK) return NOC_STATES.SOCIAL;
    if (this.state === NOC_STATES.SOCIAL) return NOC_STATES.HOME;
    return NOC_STATES.WORK;
  }

  update(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = this.chooseNextState();
      this.stateTimer = 4 + Math.random() * 6;
    }

    const target = this.anchors[this.state];
    const desired = new THREE.Vector3().subVectors(target, this.root.position);
    desired.y = 0;
    const distance = desired.length();
    if (distance > 0.01) desired.normalize();

    this.velocity.lerp(desired.multiplyScalar(0.52), dt * 2.4);
    this.root.position.addScaledVector(this.velocity, dt);

    const heading = Math.atan2(this.velocity.x, this.velocity.z);
    if (!Number.isNaN(heading)) this.root.rotation.y = heading;
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb2cff1, 0.09);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4.8, 7.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.3, 0);
controls.minDistance = 4;
controls.maxDistance = 13;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xd8ebff, 0x181f35, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(4, 8, 2);
scene.add(sun);

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const base = new THREE.Mesh(
  new THREE.CylinderGeometry(4.2, 4.9, 1.2, 42),
  new THREE.MeshStandardMaterial({ color: 0x503523, roughness: 0.68, metalness: 0.1 })
);
base.position.y = -2.95;
globeGroup.add(base);

const domeMesh = new THREE.Mesh(
  new THREE.SphereGeometry(3.4, 56, 56),
  new THREE.MeshPhysicalMaterial({
    color: 0xcaebff,
    transmission: 1,
    opacity: 0.24,
    transparent: true,
    roughness: 0.05,
    thickness: 0.22,
    clearcoat: 1,
  })
);
domeMesh.position.y = 0.1;
globeGroup.add(domeMesh);

const ground = new THREE.Mesh(
  new THREE.SphereGeometry(2.95, 48, 48, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.96 })
);
ground.rotation.x = Math.PI;
ground.position.y = -0.7;
globeGroup.add(ground);

const townGroup = new THREE.Group();
globeGroup.add(townGroup);

function makeBuilding(x, z, h, color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, h, 0.52),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 })
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
  townGroup.add(group);
}

[
  [-1.2, -0.5, 0.78],
  [-0.4, 0.52, 0.69],
  [0.42, 0.3, 0.92],
  [1.08, -0.32, 0.72],
].forEach(([x, z, h], i) => makeBuilding(x, z, h, i % 2 ? 0x906a56 : 0x7e5c48));

function createRubberHoseNOC(color) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });

  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x1e2439 }));
  shorts.position.y = 0.12;
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), material);
  torso.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), material);
  head.position.y = 0.35;
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.16, 3, 8), material);
  leftLeg.position.set(-0.05, 0.03, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.05;
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.14, 3, 8), material);
  leftArm.position.set(-0.12, 0.21, 0);
  leftArm.rotation.z = 0.3;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.12;
  rightArm.rotation.z = -0.3;

  root.add(shorts, torso, head, leftLeg, rightLeg, leftArm, rightArm);
  return root;
}

const nocs = [];
const nocContainer = new THREE.Group();
globeGroup.add(nocContainer);

for (let i = 0; i < 8; i += 1) {
  const avatar = createRubberHoseNOC([0xf4a88f, 0x9fd0ff, 0xf8d671, 0xcfb1ff][i % 4]);
  avatar.position.set((Math.random() - 0.5) * 2, 0.02, (Math.random() - 0.5) * 2);
  nocContainer.add(avatar);

  const anchorShift = (i - 3.5) * 0.36;
  const anchors = {
    [NOC_STATES.WORK]: new THREE.Vector3(anchorShift, 0.02, -0.6),
    [NOC_STATES.HOME]: new THREE.Vector3(anchorShift * 0.6, 0.02, 0.85),
    [NOC_STATES.SOCIAL]: new THREE.Vector3(Math.cos(i) * 0.7, 0.02, Math.sin(i) * 0.7),
  };
  nocs.push(new NOC({ id: `noc_${String(i + 1).padStart(2, '0')}`, root: avatar, anchors }));
}

const hudList = document.getElementById('state-list');
const simState = {
  phase: 'base_simulation',
  prophetId: null,
  directInterventions: 0,
};

function renderHud() {
  const counts = {
    work: nocs.filter((n) => n.state === NOC_STATES.WORK).length,
    home: nocs.filter((n) => n.state === NOC_STATES.HOME).length,
    social: nocs.filter((n) => n.state === NOC_STATES.SOCIAL).length,
  };

  hudList.innerHTML = [
    `Phase: ${simState.phase}`,
    `N.O.C. count: ${nocs.length}`,
    `State split — Work ${counts.work} / Home ${counts.home} / Social ${counts.social}`,
    `Prophet: ${simState.prophetId ?? 'pending trigger'}`,
    `Direct interventions: ${simState.directInterventions}`,
  ].map((line) => `<li>${line}</li>`).join('');
}

let shakeEnergy = 0;
function observerIntervention() {
  simState.directInterventions += 1;
  shakeEnergy = 0.14;
  renderHud();
}

document.getElementById('shake-btn').addEventListener('click', observerIntervention);

window.addEventListener('keydown', (evt) => {
  if (evt.key.toLowerCase() === 'p' && !simState.prophetId) {
    simState.prophetId = nocs[0].id;
    simState.phase = 'prophet_activated';
    renderHud();
  }
});

renderHud();
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  nocs.forEach((noc) => noc.update(dt));
  shakeEnergy = THREE.MathUtils.lerp(shakeEnergy, 0, dt * 1.9);
  globeGroup.position.x = Math.sin(performance.now() * 0.03) * shakeEnergy;
  globeGroup.position.z = Math.cos(performance.now() * 0.026) * shakeEnergy;

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
