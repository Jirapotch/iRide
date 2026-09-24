import * as THREE from "three";

import type { EnginePreset } from "./engine-catalog";
import { crankLayout, pistonTravel } from "./engine-geometry";

const CRANK_RADIUS = 0.38;
const ROD_LENGTH = 1.16;

interface JournalMeshes {
  phase: number;
  pin: THREE.Mesh;
  arms: THREE.Mesh[];
  weights: THREE.Mesh[];
}

interface CylinderMeshes {
  axis: THREE.Vector3;
  z: number;
  phase: number;
  index: number;
  piston: THREE.Group;
  wrist: THREE.Mesh;
  rod: THREE.Mesh;
  bigEnd: THREE.Mesh;
  head: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  flash: number;
}

export class EngineViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private readonly materials = {
    steel: new THREE.MeshPhysicalMaterial({
      color: 0xcbd6ce,
      metalness: 0.88,
      roughness: 0.25,
      clearcoat: 0.25,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x34443d,
      metalness: 0.76,
      roughness: 0.43,
    }),
    rod: new THREE.MeshPhysicalMaterial({
      color: 0xb6c2b9,
      metalness: 0.91,
      roughness: 0.27,
    }),
    bronze: new THREE.MeshStandardMaterial({
      color: 0xdcae76,
      metalness: 0.73,
      roughness: 0.3,
    }),
    piston: new THREE.MeshPhysicalMaterial({
      color: 0xe7c7a1,
      metalness: 0.71,
      roughness: 0.31,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa9c9b1,
      metalness: 0.2,
      roughness: 0.12,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };
  private root: THREE.Group | null = null;
  private journals: JournalMeshes[] = [];
  private cylinders: CylinderMeshes[] = [];
  private readonly observer: ResizeObserver;
  private theta = 0.75;
  private phi = 0.26;
  private distance = 8;
  private dragging = false;
  private pointerX = 0;
  private pointerY = 0;

  constructor(
    private readonly container: HTMLElement,
    private engine: EnginePreset,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.55;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D engine cutaway",
    );
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x101b16);
    this.scene.fog = new THREE.Fog(0x101b16, 14, 35);
    this.scene.add(new THREE.HemisphereLight(0xf0fff2, 0x4d5148, 2.1));
    const key = new THREE.DirectionalLight(0xffe4c0, 3.7);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8cc7b3, 2.5);
    rim.position.set(-6, 4, -5);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 1.2);
    fill.position.set(0, -2, 7);
    this.scene.add(fill);

    this.build(engine);
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private onPointerDown = (event: PointerEvent) => {
    this.dragging = true;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging) return;
    this.theta -= (event.clientX - this.pointerX) * 0.008;
    this.phi += (event.clientY - this.pointerY) * 0.006;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
  };

  private onPointerUp = (event: PointerEvent) => {
    this.dragging = false;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.distance *= 1 + Math.sign(event.deltaY) * 0.08;
  };

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private disposeModel(): void {
    if (!this.root) return;
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    for (const cylinder of this.cylinders) cylinder.head.material.dispose();
    this.root = null;
    this.journals = [];
    this.cylinders = [];
  }

  setEngine(engine: EnginePreset): void {
    this.engine = engine;
    this.build(engine);
  }

  private build(engine: EnginePreset): void {
    this.disposeModel();
    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);
    const layout = crankLayout(engine);
    const { pairs, spacing, z0 } = layout;
    const M = this.materials;

    // Main journals remain between crank throws, exposing the real offset of each pin.
    for (let index = 0; index <= pairs; index++) {
      const z = z0 + (index - 0.5) * spacing;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.37, 24),
        M.dark,
      );
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = z;
      root.add(shaft);
      const bearing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.18, 24),
        M.steel,
      );
      bearing.rotation.x = Math.PI / 2;
      bearing.position.z = z;
      root.add(bearing);
    }
    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.64, 0.17, 48),
      M.dark,
    );
    flywheel.rotation.x = Math.PI / 2;
    flywheel.position.z = z0 + (pairs - 0.5) * spacing + 0.45;
    root.add(flywheel);
    for (const radius of [0.31, 0.47]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.018, 8, 56),
        M.bronze,
      );
      ring.position.z = flywheel.position.z + 0.09;
      root.add(ring);
    }

    this.journals = layout.journals.map((journal) => {
      const left = journal.zMin - 0.23;
      const right = journal.zMax + 0.23;
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.115, right - left, 20),
        M.bronze,
      );
      pin.rotation.x = Math.PI / 2;
      pin.position.z = (left + right) / 2;
      root.add(pin);
      const arms: THREE.Mesh[] = [];
      const weights: THREE.Mesh[] = [];
      for (const z of [left, right]) {
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, CRANK_RADIUS + 0.25, 0.18),
          M.steel,
        );
        arm.position.z = z;
        root.add(arm);
        arms.push(arm);
        const weight = new THREE.Mesh(
          new THREE.CylinderGeometry(0.27, 0.27, 0.18, 24),
          M.dark,
        );
        weight.rotation.x = Math.PI / 2;
        weight.position.z = z;
        root.add(weight);
        weights.push(weight);
      }
      return { phase: journal.phase, pin, arms, weights };
    });

    this.cylinders = layout.cylinders.map((cylinder, index) => {
      const angle =
        ((engine.lay === "I"
          ? 0
          : engine.bank[index]! & 1
            ? -engine.va / 2
            : engine.va / 2) *
          Math.PI) /
        180;
      const axis = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0);
      const orientation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        axis,
      );
      const collarOrientation = orientation
        .clone()
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            Math.PI / 2,
          ),
        );
      const bore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.338, 0.338, 1.48, 32, 1, true),
        M.glass,
      );
      bore.quaternion.copy(orientation);
      bore.position.copy(axis.clone().multiplyScalar(1.3)).setZ(cylinder.z);
      root.add(bore);
      for (const distance of [0.64, 1.96]) {
        const collar = new THREE.Mesh(
          new THREE.TorusGeometry(0.336, 0.028, 9, 32),
          M.steel,
        );
        collar.quaternion.copy(collarOrientation);
        collar.position
          .copy(axis.clone().multiplyScalar(distance))
          .setZ(cylinder.z);
        root.add(collar);
      }
      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0x899c91,
        metalness: 0.76,
        roughness: 0.34,
        emissive: 0xf28a48,
        emissiveIntensity: 0,
      });
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.32, 32),
        headMaterial,
      );
      head.quaternion.copy(orientation);
      head.position.copy(axis.clone().multiplyScalar(2.03)).setZ(cylinder.z);
      root.add(head);
      const piston = new THREE.Group();
      piston.quaternion.copy(orientation);
      piston.add(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.305, 0.305, 0.39, 32),
          M.piston,
        ),
      );
      for (const y of [0.09, 0.14]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.302, 0.012, 8, 32),
          M.dark,
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        piston.add(ring);
      }
      root.add(piston);
      const wrist = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.51, 16),
        M.bronze,
      );
      wrist.rotation.x = Math.PI / 2;
      root.add(wrist);
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.17), M.rod);
      root.add(rod);
      const bigEnd = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.17, 20),
        M.rod,
      );
      bigEnd.rotation.x = Math.PI / 2;
      root.add(bigEnd);
      return {
        axis,
        z: cylinder.z,
        phase: cylinder.phase,
        index,
        piston,
        wrist,
        rod,
        bigEnd,
        head,
        flash: 0,
      };
    });
    this.distance = Math.max(5.5, 2.9 + pairs * 0.9);
    this.theta = 0.75;
    this.phi = 0.26;
    this.render(0, 0, 0, false, false);
  }

  render(
    previousAngle: number,
    angle: number,
    throttle: number,
    firing: boolean,
    cutting: boolean,
  ): void {
    if (!this.root) return;
    const turn = angle % 360;
    for (const journal of this.journals) {
      const phase = ((journal.phase - turn) * Math.PI) / 180;
      const x = CRANK_RADIUS * Math.cos(phase);
      const y = CRANK_RADIUS * Math.sin(phase);
      journal.pin.position.x = x;
      journal.pin.position.y = y;
      for (const arm of journal.arms) {
        arm.position.x = x * 0.5;
        arm.position.y = y * 0.5;
        arm.rotation.z = phase - Math.PI / 2;
      }
      for (const weight of journal.weights) {
        weight.position.x = -x * 0.64;
        weight.position.y = -y * 0.64;
      }
    }
    for (const cylinder of this.cylinders) {
      const phase = ((cylinder.phase - turn) * Math.PI) / 180;
      const px = CRANK_RADIUS * Math.cos(phase);
      const py = CRANK_RADIUS * Math.sin(phase);
      const travel = pistonTravel(
        cylinder.axis.x,
        cylinder.axis.y,
        px,
        py,
        ROD_LENGTH,
      );
      const pistonPoint = cylinder.axis
        .clone()
        .multiplyScalar(travel)
        .setZ(cylinder.z);
      const crankPoint = new THREE.Vector3(px, py, cylinder.z);
      cylinder.piston.position.copy(pistonPoint);
      cylinder.wrist.position.copy(pistonPoint);
      const direction = pistonPoint.clone().sub(crankPoint);
      cylinder.rod.position.copy(
        crankPoint.clone().add(pistonPoint).multiplyScalar(0.5),
      );
      cylinder.rod.scale.set(1, direction.length(), 1);
      cylinder.rod.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      );
      cylinder.bigEnd.position.copy(crankPoint);
      const next = (angle - previousAngle + 720) % 720;
      const firingAngle =
        (this.engine.fire[cylinder.index]! - previousAngle + 720) % 720;
      if (firing && !cutting && next > 0 && next < 180 && firingAngle < next)
        cylinder.flash = 1;
      cylinder.flash *= 0.82;
      cylinder.head.material.emissiveIntensity =
        cylinder.flash * (0.5 + throttle * 1.7);
    }
    this.phi = THREE.MathUtils.clamp(this.phi, -0.5, 1.2);
    this.distance = THREE.MathUtils.clamp(this.distance, 3.5, 26);
    this.camera.position.set(
      this.distance * Math.cos(this.phi) * Math.sin(this.theta),
      this.distance * Math.sin(this.phi) + 0.55,
      this.distance * Math.cos(this.phi) * Math.cos(this.theta),
    );
    this.camera.lookAt(0, 0.85, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);
    this.disposeModel();
    Object.values(this.materials).forEach((material) => material.dispose());
    this.renderer.dispose();
    canvas.remove();
  }
}
