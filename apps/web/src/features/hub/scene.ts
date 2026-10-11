import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
export type Station = "garage" | "knowledge" | "games";
export function mountHub(
  host: HTMLElement,
  select: (station: Station) => void,
  hover: (station: Station | null) => void,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(9, 8.5, 15);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.3;
  controls.minAzimuthAngle = -0.65;
  controls.maxAzimuthAngle = 0.7;
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  const mat = (
    color: number,
    metalness = 0.1,
    roughness = 0.5,
    emissive = 0,
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive,
      emissiveIntensity: 0.9,
    });
    materials.add(m);
    return m;
  };
  const amber = mat(0xf5b64f, 0.55, 0.3),
    dark = mat(0x202124, 0.2, 0.55),
    black = mat(0x111215, 0.1, 0.8),
    silver = mat(0xadb1b8, 0.85, 0.25),
    glass = mat(0x263a46, 0.7, 0.18),
    light = mat(0xffdc95, 0, 0.2, 0xf5b64f),
    blue = mat(0x5e96bc, 0.4, 0.4);
  const boxGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.06);
  geometries.add(boxGeo);
  function mesh(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    geometries.add(geo);
    const object = new THREE.Mesh(geo, m);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const box = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => mesh(p, boxGeo, m, x, y, z, sx, sy, sz);
  const cylinder = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
  ) => mesh(p, new THREE.CylinderGeometry(r, r, h, 24), m, x, y, z);
  const stations = {} as Record<Station, THREE.Group>;
  for (const [index, name] of (
    ["garage", "knowledge", "games"] as Station[]
  ).entries()) {
    const group = new THREE.Group();
    group.position.set((index - 1) * 4.4, 0, index === 1 ? -0.5 : 0.3);
    scene.add(group);
    stations[name] = group;
    box(group, dark, 0, 0.06, 0, 3.5, 0.18, 3.6);
    box(group, amber, 0, 0.16, 1.65, 2.9, 0.025, 0.045);
    for (const x of [-1.55, 1.55])
      box(group, silver, x, 0.18, 0, 0.02, 0.01, 3.1);
  }
  const car = stations.garage;
  box(car, amber, 0, 0.68, 0, 2.7, 0.45, 1.38);
  box(car, amber, -0.3, 1.04, 0, 1.52, 0.53, 1.25);
  box(car, glass, -0.27, 1.2, 0, 1.32, 0.36, 1.27);
  box(car, amber, -0.3, 1.43, 0, 1.38, 0.08, 1.3);
  box(car, amber, -0.95, 1.15, 0, 0.11, 0.45, 1.34);
  box(car, amber, 0.1, 1.16, 0, 0.07, 0.46, 1.34);
  box(car, dark, 1.37, 0.68, 0, 0.08, 0.22, 1.18);
  box(car, silver, -1.36, 0.62, 0, 0.05, 0.14, 1.2);
  for (const z of [-0.5, 0.5]) {
    box(car, light, 1.38, 0.83, z, 0.03, 0.09, 0.25);
    box(car, mat(0xc85343, 0, 0.4, 0xa32c20), -1.38, 0.78, z, 0.03, 0.1, 0.24);
  }
  for (const x of [-0.82, 0.85])
    for (const z of [-0.73, 0.73]) {
      const wheel = cylinder(car, black, x, 0.53, z, 0.36, 0.18);
      wheel.rotation.x = Math.PI / 2;
      const rim = cylinder(car, silver, x, 0.53, z * 1.12, 0.23, 0.035);
      rim.rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const spoke = box(car, silver, x, 0.53, z * 1.15, 0.04, 0.38, 0.025);
        spoke.rotation.z = (i * Math.PI) / 5;
      }
    }
  for (const z of [-0.8, 0.8]) box(car, dark, 0.15, 1.1, z, 0.2, 0.1, 0.12);
  const engine = stations.knowledge;
  box(engine, dark, 0, 0.52, 0, 2.0, 0.66, 1.2);
  box(engine, silver, 0, 0.82, 0, 2.1, 0.13, 1.3);
  const pistons: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.46;
    cylinder(engine, silver, x, 1.18, 0, 0.2, 0.62);
    const piston = cylinder(engine, amber, x, 1.65, 0, 0.16, 0.18);
    pistons.push(piston);
    box(engine, silver, x, 1.8, 0, 0.07, 0.26, 0.08);
    box(engine, dark, x, 1.98, 0, 0.23, 0.09, 0.2);
  }
  const crank = cylinder(engine, silver, 0, 0.55, 0.72, 0.11, 2.2);
  crank.rotation.z = Math.PI / 2;
  for (const x of [-0.8, -0.27, 0.27, 0.8]) {
    const cog = cylinder(engine, amber, x, 0.55, 0.72, 0.25, 0.09);
    cog.rotation.z = Math.PI / 2;
  }
  const pipe = new THREE.TorusGeometry(0.32, 0.075, 8, 24, Math.PI);
  mesh(engine, pipe, silver, 0.5, 0.6, -0.76).rotation.z = Math.PI / 2;
  box(engine, blue, 0, 0.65, -0.72, 1.4, 0.3, 0.15);
  const arcade = stations.games;
  box(arcade, dark, 0, 1.12, 0, 1.22, 1.95, 0.98);
  box(arcade, amber, 0, 2.2, 0, 1.27, 0.22, 1.04);
  box(arcade, black, 0, 1.65, 0.51, 1.03, 0.93, 0.035);
  box(arcade, blue, 0, 1.65, 0.54, 0.84, 0.66, 0.02);
  box(arcade, dark, 0, 1.6, 0.56, 0.28, 0.57, 0.01);
  for (const y of [1.43, 1.65, 1.87])
    box(arcade, light, 0, y, 0.58, 0.02, 0.11, 0.01);
  box(arcade, amber, 0.15, 1.48, 0.59, 0.1, 0.19, 0.02);
  const panel = box(arcade, amber, 0, 1.04, 0.68, 1.2, 0.13, 0.6);
  panel.rotation.x = 0.2;
  cylinder(arcade, black, -0.28, 1.21, 0.72, 0.04, 0.2);
  mesh(
    arcade,
    new THREE.SphereGeometry(0.075, 12, 8),
    silver,
    -0.28,
    1.32,
    0.72,
  );
  for (const x of [0.2, 0.4])
    cylinder(arcade, light, x, 1.15, 0.8, 0.065, 0.035);
  box(arcade, black, 0, 0.48, 0.51, 0.65, 0.5, 0.02);
  const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.32 });
  materials.add(floorMaterial);
  const floor = mesh(
    scene,
    new THREE.PlaneGeometry(40, 40),
    floorMaterial,
    0,
    -0.06,
    0,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  scene.add(new THREE.HemisphereLight(0xd7e5f5, 0x25201c, 2.1));
  const key = new THREE.DirectionalLight(0xffead1, 4.2);
  key.position.set(3, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6c8dac, 2.6);
  rim.position.set(-6, 5, -5);
  scene.add(rim);
  for (const group of Object.values(stations))
    group.traverse((o) => {
      o.userData.station = (Object.keys(stations) as Station[]).find(
        (s) => stations[s] === group,
      );
    });
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let hovered: Station | null = null,
    start = { x: 0, y: 0 },
    frame = 0,
    disposed = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function pick(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(Object.values(stations), true)[0]?.object
      .userData.station as Station | undefined;
  }
  const move = (event: PointerEvent) => {
    const next = pick(event) ?? null;
    if (next !== hovered) {
      hovered = next;
      hover(next);
      renderer.domElement.style.cursor = next ? "pointer" : "grab";
    }
    if (reduced.matches) draw();
  };
  const down = (event: PointerEvent) => {
    start = { x: event.clientX, y: event.clientY };
  };
  const up = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) {
      const station = pick(event);
      if (station) select(station);
    }
  };
  function renderOnly() {
    renderer.render(scene, camera);
  }
  function draw() {
    controls.update();
    renderOnly();
  }
  function loop(time: number) {
    if (disposed || document.hidden) return;
    if (!reduced.matches) {
      pistons.forEach(
        (p, i) =>
          (p.position.y =
            1.65 + Math.sin(time * 0.0018 + (i * Math.PI) / 2) * 0.09),
      );
    }
    draw();
    if (!reduced.matches) frame = requestAnimationFrame(loop);
  }
  function restart() {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(loop);
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const distance = Math.max(12, 26 / camera.aspect);
    camera.position.set(distance * 0.5, distance * 0.56, distance);
    camera.fov = 34;
    camera.updateProjectionMatrix();
    draw();
    restart();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointerup", up);
  document.addEventListener("visibilitychange", restart);
  reduced.addEventListener("change", restart);
  controls.addEventListener("change", renderOnly);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", restart);
    reduced.removeEventListener("change", restart);
    controls.removeEventListener("change", renderOnly);
    controls.dispose();
    renderer.dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    renderer.domElement.remove();
  };
}
