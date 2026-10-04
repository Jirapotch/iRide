import * as THREE from "three";
import { createRideModel, stationPositions } from "./ride-hub-model";
import {
  gestureIntent,
  renderPolicy,
  visibleFeature,
  type RideFeature,
  type RideMode,
  type RideView,
} from "./ride-hub-domain";

type LabelPosition = {
  feature: RideFeature;
  x: number;
  y: number;
  visible: boolean;
};
interface SceneOptions {
  embed: boolean;
  onSelect: (feature: RideFeature) => void;
  onProject: (positions: LabelPosition[]) => void;
  onError: () => void;
  onReady: () => void;
}

export class RideHubScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(
    -10,
    10,
    7,
    -7,
    0.1,
    100,
  );
  private readonly model = createRideModel();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly focus = new THREE.Vector3(0, 0.7, 0);
  private readonly desiredFocus = new THREE.Vector3(0, 0.7, 0);
  private readonly point = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly orbit = new THREE.Spherical(23, 1, 0.6);
  private readonly wantedOrbit = new THREE.Spherical(23, 1, 0.6);
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly motion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private readonly travelingBike = this.model.motorcycle.clone(true);
  private selected: RideFeature = "trips";
  private hovered: RideFeature | null = null;
  private mode: RideMode = "explore";
  private view: RideView = "overview";
  private inView = true;
  private destroyed = false;
  private firstFrame = true;
  private frame: number | null = null;
  private lastFrame = 0;
  private journey = 0;
  private zoom = 1;
  private width = 1;
  private height = 1;
  private mobile = false;
  private drag: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    rotated: boolean;
    scrolling: boolean;
    touch: boolean;
  } | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private readonly labelPositions: LabelPosition[] = Object.keys(
    stationPositions,
  ).map((feature) => ({
    feature: feature as RideFeature,
    x: 0,
    y: 0,
    visible: true,
  }));

  constructor(
    private readonly host: HTMLElement,
    private readonly options: SceneOptions,
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch (error) {
      this.model.dispose();
      throw error;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.touchAction = options.embed ? "pan-y" : "none";
    host.append(canvas);
    this.scene.add(this.model.root);
    this.model.root.add(this.travelingBike);
    this.travelingBike.visible = false;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc7cabf, 2.5));
    const sunlight = new THREE.DirectionalLight(0xfff7e8, 3.5);
    sunlight.position.set(-4, 12, 6);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -11;
    sunlight.shadow.camera.right = 11;
    sunlight.shadow.camera.top = 9;
    sunlight.shadow.camera.bottom = -9;
    sunlight.shadow.bias = -0.0007;
    this.scene.add(sunlight);
    const groundGeometry = new THREE.PlaneGeometry(70, 70);
    this.model.geometries.add(groundGeometry);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.13 });
    this.model.materials.add(groundMaterial);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.inView = entry?.isIntersecting ?? false;
        this.wake();
      },
      { rootMargin: "80px" },
    );
    this.intersectionObserver.observe(host);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerCancel);
    canvas.addEventListener("pointerleave", this.pointerLeave);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    canvas.addEventListener("webglcontextlost", this.contextLost);
    document.addEventListener("visibilitychange", this.visibilityChange);
    this.motion.addEventListener("change", this.motionChange);
    this.resize();
    this.wake();
  }

  select(feature: RideFeature, focus = true) {
    this.selected = feature;
    if (focus) this.setView("focus");
    else this.wake();
  }
  setMode(mode: RideMode) {
    this.mode = mode;
    this.journey = 0;
    this.travelingBike.visible = mode === "ride";
    this.model.motorcycle.visible = mode !== "ride";
    if (mode === "routes") this.setView("map");
    else if (mode === "ride") this.setView("ride");
    else this.setView("overview");
    this.wake();
  }
  setView(view: RideView) {
    this.view = view;
    this.wantedOrbit.phi =
      view === "map" ? 0.07 : view === "ride" ? 1.17 : this.mobile ? 0.72 : 1;
    this.wantedOrbit.theta = view === "ride" ? 0.45 : this.mobile ? 1.18 : 0.6;
    this.desiredFocus.set(0, 0.7, 0);
    if (view === "focus")
      this.desiredFocus.set(...stationPositions[this.selected]);
    this.zoom = view === "focus" ? 1.45 : view === "ride" ? 1.12 : 1;
    this.resize();
    this.wake();
  }
  changeZoom(delta: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + delta, 0.75, 1.75);
    this.resize();
    this.wake();
  }
  reset() {
    this.setMode("explore");
    this.wantedOrbit.theta = this.mobile ? 1.18 : 0.6;
    this.hovered = null;
    this.wake();
  }

  private resize() {
    if (this.destroyed) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    const mobile = this.width < 768;
    if (mobile !== this.mobile) {
      this.mobile = mobile;
      if (this.view !== "map" && this.view !== "ride") {
        this.wantedOrbit.phi = mobile ? 0.72 : 1;
        this.wantedOrbit.theta = mobile ? 1.18 : 0.6;
        if (this.firstFrame) this.orbit.copy(this.wantedOrbit);
      }
    }
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.75),
    );
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / this.height;
    const horizontal = mobile ? 6.4 : 8.3;
    const vertical = Math.max(mobile ? 5 : 4.6, horizontal / aspect);
    this.camera.left = (-vertical * aspect) / this.zoom;
    this.camera.right = (vertical * aspect) / this.zoom;
    this.camera.top = vertical / this.zoom;
    this.camera.bottom = -vertical / this.zoom;
    this.camera.updateProjectionMatrix();
    this.wake();
  }
  private wake() {
    if (this.destroyed) return;
    if (
      renderPolicy({
        visible: !document.hidden,
        inView: this.inView,
        reducedMotion: this.motion.matches,
      }) === "pause"
    ) {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      this.lastFrame = 0;
      return;
    }
    if (this.frame === null) this.frame = requestAnimationFrame(this.draw);
  }
  private draw = (now: number) => {
    this.frame = null;
    if (this.destroyed || document.hidden || !this.inView) return;
    const dt = this.lastFrame
      ? Math.min((now - this.lastFrame) / 1000, 0.05)
      : 1 / 60;
    this.lastFrame = now;
    const reduced = this.motion.matches;
    if (this.view === "tour" && !reduced) this.wantedOrbit.theta += dt * 0.08;
    const damping = reduced ? 1 : 1 - Math.exp(-dt * 9);
    this.orbit.phi = THREE.MathUtils.lerp(
      this.orbit.phi,
      this.wantedOrbit.phi,
      damping,
    );
    this.orbit.theta = THREE.MathUtils.lerp(
      this.orbit.theta,
      this.wantedOrbit.theta,
      damping,
    );
    this.focus.lerp(this.desiredFocus, damping);
    let moving = false;
    for (const [feature, station] of Object.entries(this.model.stations) as [
      RideFeature,
      THREE.Group,
    ][]) {
      const selected = feature === this.selected || feature === this.hovered;
      const targetY = 0.4 + (selected ? 0.08 : 0);
      station.position.y = THREE.MathUtils.lerp(
        station.position.y,
        targetY,
        damping,
      );
      this.model.accents[feature].scale.x = selected ? 2.67 : 2.6;
      const targetScale = this.mode === "places" ? (selected ? 1.04 : 1) : 1;
      station.scale.lerp(this.point.setScalar(targetScale), damping);
      moving ||= Math.abs(station.position.y - targetY) > 0.002;
      moving ||= Math.abs(station.scale.x - targetScale) > 0.0005;
    }
    this.model.movingMarker.visible =
      this.mode === "routes" || this.mode === "ride";
    if ((this.mode === "routes" || this.mode === "ride") && !reduced) {
      this.journey = (this.journey + dt / 28) % 1;
      this.model.routeCurve.getPointAt(this.journey, this.point);
      this.model.movingMarker.position.copy(this.point).y = 0.4;
      if (this.mode === "ride") {
        this.travelingBike.position.copy(this.point).y = 0.36;
        this.travelingBike.scale.setScalar(0.8);
        this.model.routeCurve.getTangentAt(this.journey, this.tangent);
        this.travelingBike.rotation.y = Math.atan2(
          this.tangent.x,
          this.tangent.z,
        );
      }
    }
    if (this.mode === "ride" && reduced) {
      this.model.routeCurve.getPointAt(0, this.point);
      this.travelingBike.position.copy(this.point).y = 0.36;
    }
    this.camera.position.setFromSpherical(this.orbit).add(this.focus);
    this.camera.lookAt(this.focus);
    this.renderer.render(this.scene, this.camera);
    if (this.firstFrame) {
      this.firstFrame = false;
      this.options.onReady();
    }
    for (const label of this.labelPositions) {
      const station = this.model.stations[label.feature];
      if (label.feature === "activities") this.point.set(0.9, 0.2, 0.6);
      else this.point.set(0, 0.1, 1.14);
      station.localToWorld(this.point);
      this.point.project(this.camera);
      label.x = (this.point.x * 0.5 + 0.5) * this.width;
      label.y = (-this.point.y * 0.5 + 0.5) * this.height;
      label.visible =
        this.point.z > -1 &&
        this.point.z < 1 &&
        Math.abs(this.point.x) < 0.96 &&
        Math.abs(this.point.y) < 0.93;
    }
    this.options.onProject(this.labelPositions);
    moving ||=
      Math.abs(this.orbit.phi - this.wantedOrbit.phi) > 0.0005 ||
      Math.abs(this.orbit.theta - this.wantedOrbit.theta) > 0.0005 ||
      this.focus.distanceToSquared(this.desiredFocus) > 0.0001;
    if (
      moving ||
      (!reduced &&
        (this.mode === "ride" ||
          this.mode === "routes" ||
          this.view === "tour"))
    )
      this.wake();
  };

  private hit(event: PointerEvent) {
    const box = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      (-(event.clientY - box.top) / box.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects(
      Object.values(this.model.stations),
      true,
    )) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        const feature = visibleFeature(object.userData.feature);
        if (feature) return feature;
        object = object.parent;
      }
    }
    return null;
  }
  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touches.size > 1 && this.options.embed) {
      this.drag = null;
      return;
    }
    if (this.touches.size === 2 && !this.options.embed) {
      const [a, b] = [...this.touches.values()];
      this.pinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      return;
    }
    this.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      rotated: false,
      scrolling: false,
      touch: event.pointerType === "touch",
    };
    if (event.pointerType !== "touch")
      this.renderer.domElement.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.touches.has(event.pointerId))
      this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touches.size > 1 && this.options.embed) return;
    if (this.touches.size === 2 && !this.options.embed) {
      const [a, b] = [...this.touches.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (this.pinchDistance)
        this.changeZoom((distance - this.pinchDistance) / 250);
      this.pinchDistance = distance;
      if (this.drag) this.drag.rotated = true;
      return;
    }
    const drag = this.drag;
    if (drag?.id === event.pointerId) {
      const intent = gestureIntent(
        event.clientX - drag.x,
        event.clientY - drag.y,
        this.options.embed && drag.touch,
      );
      if (intent === "scroll" && !drag.rotated) {
        drag.scrolling = true;
        return;
      }
      if (drag.scrolling) return;
      if (intent === "rotate" || drag.rotated) {
        drag.rotated = true;
        this.wantedOrbit.theta -= (event.clientX - drag.lastX) * 0.006;
        if (!drag.touch || !this.options.embed)
          this.wantedOrbit.phi = THREE.MathUtils.clamp(
            this.wantedOrbit.phi - (event.clientY - drag.lastY) * 0.004,
            0.12,
            1.25,
          );
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        if (this.view !== "overview") {
          this.view = "overview";
        }
        this.wake();
      }
      return;
    }
    if (event.pointerType === "mouse") {
      const feature = this.hit(event);
      if (feature !== this.hovered) {
        this.hovered = feature;
        this.renderer.domElement.style.cursor = feature ? "pointer" : "grab";
        this.wake();
      }
    }
  };
  private pointerUp = (event: PointerEvent) => {
    this.touches.delete(event.pointerId);
    this.pinchDistance = 0;
    if (this.drag?.id !== event.pointerId) return;
    const drag = this.drag;
    this.drag = null;
    if (
      !drag.rotated &&
      !drag.scrolling &&
      gestureIntent(
        event.clientX - drag.x,
        event.clientY - drag.y,
        this.options.embed && drag.touch,
      ) === "tap"
    ) {
      const feature = this.hit(event);
      if (feature) this.options.onSelect(feature);
    }
    if (this.renderer.domElement.hasPointerCapture(event.pointerId))
      this.renderer.domElement.releasePointerCapture(event.pointerId);
  };
  private pointerCancel = (event: PointerEvent) => {
    this.touches.delete(event.pointerId);
    this.drag = null;
    this.pinchDistance = 0;
  };
  private pointerLeave = () => {
    this.hovered = null;
    this.wake();
  };
  private wheel = (event: WheelEvent) => {
    if (this.options.embed) return;
    event.preventDefault();
    this.changeZoom(-event.deltaY * 0.001);
  };
  private visibilityChange = () => this.wake();
  private motionChange = () => {
    this.lastFrame = 0;
    this.wake();
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.options.onError();
  };

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.visibilityChange);
    this.motion.removeEventListener("change", this.motionChange);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.pointerDown);
    canvas.removeEventListener("pointermove", this.pointerMove);
    canvas.removeEventListener("pointerup", this.pointerUp);
    canvas.removeEventListener("pointercancel", this.pointerCancel);
    canvas.removeEventListener("pointerleave", this.pointerLeave);
    canvas.removeEventListener("wheel", this.wheel);
    canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.model.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    this.scene.clear();
    this.touches.clear();
  }
}
