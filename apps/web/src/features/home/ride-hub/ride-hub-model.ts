import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RideFeature } from "./ride-hub-domain";

export const stationPositions: Record<RideFeature, [number, number, number]> = {
  community: [-4.1, 0.4, -1.65],
  activities: [0, 0.4, -1.65],
  trips: [0, 0.4, 1.65],
  routes: [4.1, 0.4, -1.65],
  knowledge: [-4.1, 0.4, 1.65],
  games: [4.1, 0.4, 1.65],
};

export function createRideModel() {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const makeMaterial = (color: number, roughness = 0.7, metalness = 0.08) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
    });
    materials.add(material);
    return material;
  };
  const m = {
    white: makeMaterial(0xf5f3ec),
    mint: makeMaterial(0x8fa891),
    green: makeMaterial(0x4f6f52),
    slate: makeMaterial(0x3d444a, 0.48, 0.3),
    tire: makeMaterial(0x252b2c),
    silver: makeMaterial(0xb6c0be, 0.4, 0.6),
    line: makeMaterial(0xbfd8c2),
    screen: makeMaterial(0x1d3029),
    sand: makeMaterial(0xd9dfc7),
    cream: makeMaterial(0xece7db),
  };
  const unitBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.075);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
  const unitSphere = new THREE.SphereGeometry(1, 16, 10);
  geometries.add(unitBox);
  geometries.add(unitCylinder);
  geometries.add(unitSphere);
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    pos: [number, number, number],
    scale: [number, number, number],
  ) {
    const obj = new THREE.Mesh(geometry, material);
    obj.position.set(...pos);
    obj.scale.set(...scale);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  const box = (
    p: THREE.Object3D,
    mat: THREE.Material,
    pos: [number, number, number],
    scale: [number, number, number],
  ) => mesh(p, unitBox, mat, pos, scale);
  const cylinder = (
    p: THREE.Object3D,
    mat: THREE.Material,
    pos: [number, number, number],
    scale: [number, number, number],
  ) => mesh(p, unitCylinder, mat, pos, scale);
  function tube(
    parent: THREE.Object3D,
    points: THREE.Vector3[],
    material: THREE.Material,
    radius = 0.055,
  ) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 48, radius, 6, false);
    geometries.add(geometry);
    return mesh(parent, geometry, material, [0, 0, 0], [1, 1, 1]);
  }
  const root = new THREE.Group();
  box(root, m.slate, [0, 0.1, 0], [13.8, 0.3, 8]);
  box(root, m.silver, [0, -0.07, 0], [13.55, 0.08, 7.8]);
  for (const x of [-6.5, 6.5])
    for (const z of [-3.65, 3.65])
      cylinder(root, m.silver, [x, 0.27, z], [0.07, 0.025, 0.07]);
  const stations = {} as Record<RideFeature, THREE.Group>;
  const accents = {} as Record<RideFeature, THREE.Mesh>;
  for (const [feature, position] of Object.entries(stationPositions) as [
    RideFeature,
    [number, number, number],
  ][]) {
    const station = new THREE.Group();
    station.position.set(...position);
    station.userData.feature = feature;
    root.add(station);
    stations[feature] = station;
    box(station, m.tire, [0, 0.05, 0], [2.65, 0.16, 2.05]);
    accents[feature] = box(station, m.line, [0, 0.15, 0], [2.6, 0.04, 2.0]);
    box(station, m.cream, [0, 0.11, 0], [2.62, 0.025, 2.02]);
    box(station, m.white, [0, 0.29, 0], [2.5, 0.25, 1.95]);
  }
  const connections: THREE.Vector3[] = [
    new THREE.Vector3(-4.1, 0.32, -1.65),
    new THREE.Vector3(-2, 0.32, -1.65),
    new THREE.Vector3(0, 0.32, -1.65),
    new THREE.Vector3(2, 0.32, -1.65),
    new THREE.Vector3(4.1, 0.32, -1.65),
    new THREE.Vector3(5.8, 0.32, 0),
    new THREE.Vector3(4.1, 0.32, 1.65),
    new THREE.Vector3(2, 0.32, 1.65),
    new THREE.Vector3(0, 0.32, 1.65),
    new THREE.Vector3(-2, 0.32, 1.65),
    new THREE.Vector3(-4.1, 0.32, 1.65),
    new THREE.Vector3(-5.8, 0.32, 0),
    new THREE.Vector3(-4.1, 0.32, -1.65),
  ];
  const routeCurve = new THREE.CatmullRomCurve3(
    connections,
    true,
    "centripetal",
  );
  tube(root, connections, m.line, 0.075);
  const movingMarker = mesh(
    root,
    unitSphere,
    m.green,
    [0, 0.36, 0],
    [0.12, 0.12, 0.12],
  );

  // Community: two chairs, a small table and conversation boards.
  const community = stations.community;
  for (const x of [-0.7, 0.7]) {
    box(community, m.white, [x, 0.72, 0.1], [0.6, 0.5, 0.65]);
    box(community, m.green, [x, 0.98, 0.2], [0.53, 0.12, 0.5]);
    box(community, m.mint, [x, 1.2, -0.1], [0.6, 0.55, 0.15]);
    for (const z of [-0.08, 0.4])
      cylinder(community, m.slate, [x, 0.48, z], [0.035, 0.22, 0.035]);
  }
  cylinder(community, m.silver, [0, 0.7, 0.15], [0.035, 0.6, 0.035]);
  cylinder(community, m.white, [0, 1.01, 0.15], [0.37, 0.09, 0.37]);
  box(community, m.mint, [0, 1.65, -0.5], [1.15, 1.05, 0.15]);
  box(community, m.white, [0, 1.78, -0.385], [0.86, 0.46, 0.06]);
  box(
    community,
    m.white,
    [-0.23, 1.52, -0.385],
    [0.13, 0.15, 0.06],
  ).rotation.z = -0.25;
  for (const x of [-0.28, 0, 0.28])
    mesh(
      community,
      unitSphere,
      m.green,
      [x, 1.75, -0.38],
      [0.085, 0.085, 0.045],
    );
  // Activities: check-in podium, tickets and a flag.
  const activities = stations.activities;
  box(activities, m.white, [0, 0.85, 0], [1.3, 0.9, 0.9]);
  box(activities, m.slate, [0, 1.36, 0], [1.4, 0.15, 1]);
  box(activities, m.mint, [0.12, 1.78, -0.1], [0.65, 0.75, 0.1]);
  tube(
    activities,
    [
      new THREE.Vector3(-0.07, 1.78, -0.025),
      new THREE.Vector3(0.06, 1.66, -0.025),
      new THREE.Vector3(0.31, 1.94, -0.025),
    ],
    m.white,
    0.035,
  );
  box(activities, m.white, [-0.5, 1.56, 0.15], [0.38, 0.24, 0.45]);
  cylinder(activities, m.silver, [-0.75, 1.9, -0.35], [0.035, 2.8, 0.035]);
  box(activities, m.green, [-0.42, 3.1, -0.35], [0.65, 0.34, 0.045]);
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 2; y++) {
      if ((x + y) % 2 === 0)
        box(
          activities,
          m.white,
          [-0.66 + x * 0.16, 3.01 + y * 0.16, -0.317],
          [0.16, 0.16, 0.014],
        );
    }
  // Trips: a recognizable procedural adventure motorcycle, oriented diagonally.
  const motorcycle = new THREE.Group();
  stations.trips.add(motorcycle);
  motorcycle.position.y = 0.5;
  motorcycle.rotation.y = Math.PI - 0.32;
  const tireGeometry = new THREE.TorusGeometry(0.42, 0.12, 10, 28);
  geometries.add(tireGeometry);
  for (const z of [-0.78, 0.78]) {
    const tire = mesh(
      motorcycle,
      tireGeometry,
      m.tire,
      [0, 0.43, z],
      [1, 1, 1],
    );
    tire.rotation.y = Math.PI / 2;
    const rim = cylinder(
      motorcycle,
      m.silver,
      [0, 0.43, z],
      [0.29, 0.09, 0.29],
    );
    rim.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const spoke = box(
        motorcycle,
        m.slate,
        [0.055, 0.43, z],
        [0.035, 0.53, 0.035],
      );
      spoke.rotation.x = (i * Math.PI) / 3;
    }
  }
  box(motorcycle, m.slate, [0, 0.82, -0.06], [0.42, 0.49, 0.75]);
  box(motorcycle, m.silver, [0, 0.75, 0.13], [0.5, 0.28, 0.45]);
  box(motorcycle, m.mint, [0, 1.19, 0.08], [0.53, 0.46, 0.68]).rotation.x =
    -0.15;
  box(motorcycle, m.tire, [0, 1.19, -0.52], [0.46, 0.13, 0.6]);
  box(motorcycle, m.white, [0, 1.32, 0.52], [0.5, 0.3, 0.35]).rotation.x = 0.35;
  for (const x of [-0.17, 0.17]) {
    cylinder(
      motorcycle,
      m.silver,
      [x, 0.84, 0.69],
      [0.035, 0.88, 0.035],
    ).rotation.x = -0.15;
    box(motorcycle, m.slate, [x, 0.5, -0.43], [0.06, 0.1, 0.73]).rotation.x =
      -0.1;
    box(motorcycle, m.white, [x * 2.5, 1.12, -0.6], [0.35, 0.47, 0.43]);
    cylinder(
      motorcycle,
      m.silver,
      [x * 1.4, 1.55, 0.3],
      [0.018, 0.35, 0.018],
    ).rotation.z = x < 0 ? 0.3 : -0.3;
    box(motorcycle, m.slate, [x * 1.9, 1.71, 0.3], [0.18, 0.12, 0.045]);
  }
  box(motorcycle, m.slate, [0, 1.45, 0.42], [0.81, 0.06, 0.09]);
  box(motorcycle, m.silver, [0, 1.55, 0.65], [0.37, 0.46, 0.045]).rotation.x =
    0.25;
  box(motorcycle, m.white, [0, 1.07, 0.9], [0.3, 0.08, 0.3]);
  box(motorcycle, m.slate, [0, 1.39, -0.91], [0.65, 0.42, 0.38]);
  box(motorcycle, m.silver, [0.3, 0.6, -0.5], [0.13, 0.13, 0.55]);
  // Routes: upright miniature map and three location pins, with no terrain.
  const routes = stations.routes;
  box(routes, m.cream, [0, 1.15, -0.2], [1.8, 1.5, 0.15]);
  const mapLine = [
    [-0.65, 0.7],
    [-0.25, 0.85],
    [-0.3, 1.2],
    [0.28, 1.38],
    [0.55, 1.68],
  ].map(([x, y]) => new THREE.Vector3(x, y, -0.08));
  tube(routes, mapLine, m.green, 0.035);
  for (const [x, y] of [
    [-0.65, 0.7],
    [-0.3, 1.2],
    [0.55, 1.68],
  ]) {
    const pin = mesh(
      routes,
      unitSphere,
      m.green,
      [x!, y! + 0.15, -0.02],
      [0.13, 0.17, 0.07],
    );
    pin.rotation.z = 0.1;
    mesh(
      routes,
      unitSphere,
      m.white,
      [x!, y! + 0.18, 0.055],
      [0.045, 0.05, 0.02],
    );
    box(routes, m.green, [x!, y! + 0.04, -0.01], [0.04, 0.15, 0.06]);
  }
  // Knowledge: open book, layered pages and a small desk lamp.
  const knowledge = stations.knowledge;
  const book = new THREE.Group();
  knowledge.add(book);
  book.position.set(0, 0.65, 0.1);
  book.rotation.y = -0.12;
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    book.add(leaf);
    leaf.position.x = side * 0.43;
    leaf.rotation.z = side * 0.13;
    box(leaf, m.green, [0, 0, 0], [0.9, 0.12, 1.25]);
    box(leaf, m.cream, [0, 0.1, 0], [0.82, 0.13, 1.15]);
    box(leaf, m.white, [0, 0.18, 0], [0.8, 0.035, 1.12]);
    for (let line = 0; line < 4; line++)
      box(leaf, m.mint, [0, 0.205, -0.28 + line * 0.17], [0.5, 0.015, 0.025]);
  }
  box(book, m.mint, [0.28, 0.22, 0.3], [0.11, 0.025, 0.75]);
  cylinder(knowledge, m.slate, [0.72, 0.47, -0.62], [0.22, 0.06, 0.22]);
  tube(
    knowledge,
    [
      new THREE.Vector3(0.72, 0.5, -0.62),
      new THREE.Vector3(0.72, 1.6, -0.62),
      new THREE.Vector3(0.32, 1.9, -0.42),
    ],
    m.silver,
    0.035,
  );
  box(knowledge, m.mint, [0.28, 1.87, -0.4], [0.58, 0.18, 0.4]);
  box(knowledge, m.white, [0.28, 1.77, -0.4], [0.48, 0.035, 0.32]);
  // Games: controller and a small display, assembled from shared primitives.
  const games = stations.games;
  box(games, m.slate, [0, 1.45, -0.5], [1.55, 1.08, 0.14]);
  box(games, m.screen, [0, 1.45, -0.405], [1.32, 0.85, 0.035]);
  for (const [x, y] of [
    [-0.25, 1.65],
    [0.25, 1.65],
    [-0.37, 1.52],
    [-0.12, 1.52],
    [0.12, 1.52],
    [0.37, 1.52],
    [-0.25, 1.37],
    [0.25, 1.37],
  ])
    box(games, m.line, [x!, y!, -0.375], [0.12, 0.12, 0.025]);
  cylinder(games, m.slate, [0, 0.77, -0.5], [0.04, 0.75, 0.04]);
  box(games, m.white, [0, 0.68, 0.35], [1.25, 0.25, 0.55]).rotation.x = 0.28;
  for (const x of [-0.5, 0.5])
    mesh(games, unitSphere, m.white, [x, 0.54, 0.52], [0.23, 0.34, 0.22]);
  box(games, m.slate, [-0.36, 0.86, 0.38], [0.28, 0.055, 0.08]);
  box(games, m.slate, [-0.36, 0.86, 0.38], [0.08, 0.055, 0.28]);
  for (const [x, z] of [
    [0.36, 0.26],
    [0.48, 0.38],
    [0.36, 0.5],
    [0.24, 0.38],
  ])
    cylinder(games, m.green, [x!, 0.85, z!], [0.045, 0.045, 0.045]);
  return {
    root,
    stations,
    accents,
    motorcycle,
    movingMarker,
    routeCurve,
    materials,
    geometries,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((mat) => mat.dispose());
    },
  };
}
