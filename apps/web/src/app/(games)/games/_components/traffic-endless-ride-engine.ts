import {
  stageAt,
  type RideId,
  type RunResult,
} from "@/lib/traffic-endless-ride";

import {
  randomTrafficColor,
  rides,
  trafficTypes,
  vehicleSvg,
  type TrafficDefinition,
} from "./traffic-endless-ride-vehicles";

const WIDTH = 420;
const HEIGHT = 760;
const SHOULDER = 20;
const ROAD_WIDTH = 380;
const LANE_COUNT = 4;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const PLAYER_Y = HEIGHT - 190;
const MIN_GAP = 16;
const dividerXs = Array.from(
  { length: LANE_COUNT - 1 },
  (_, index) => SHOULDER + LANE_WIDTH * (index + 1),
);

function laneX(index: number) {
  return SHOULDER + LANE_WIDTH * index + LANE_WIDTH / 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

interface MovingDecoration {
  readonly element: HTMLDivElement;
  readonly x: number;
  y: number;
}

interface TrafficVehicle {
  readonly definition: TrafficDefinition;
  readonly element: HTMLDivElement;
  readonly height: number;
  readonly narrow: boolean;
  readonly width: number;
  aggressive: boolean;
  baseSpeed: number;
  changing: number;
  hazardKind: "blind" | "chaser" | "parked" | null;
  lane: number;
  near: boolean;
  passed: boolean;
  speed: number;
  targetX: number;
  turnDelay: number;
  x: number;
  y: number;
}

export interface GameElements {
  readonly board: HTMLDivElement;
  readonly combo: HTMLDivElement;
  readonly jam: HTMLDivElement;
  readonly level: HTMLDivElement;
  readonly multiplier: HTMLDivElement;
  readonly road: HTMLDivElement;
  readonly scenery: HTMLDivElement;
  readonly score: HTMLDivElement;
  readonly speed: HTMLDivElement;
  readonly stage: HTMLDivElement;
  readonly stageBar: HTMLElement;
  readonly toast: HTMLDivElement;
  readonly world: HTMLDivElement;
}

export interface GameMessages {
  readonly blindSpot: string;
  readonly chaser: string;
  readonly clearRoad: string;
  readonly jamAhead: string;
  readonly jamPrompt: string;
  readonly nearMiss: string;
  readonly parked: string;
  readonly split: string;
  readonly stageNames: readonly string[];
  readonly unlock: Readonly<Record<string, string>>;
}

export function mountTrafficEndlessRide({
  elements,
  messages,
  onGameOver,
  rideId,
}: {
  readonly elements: GameElements;
  readonly messages: GameMessages;
  readonly onGameOver: (result: RunResult) => void;
  readonly rideId: RideId;
}): () => void {
  const ride = rides.find((candidate) => candidate.id === rideId) ?? rides[0]!;
  const controller = new AbortController();
  const { signal } = controller;
  const traffic: TrafficVehicle[] = [];
  const unlocked = new Set<string>();
  const dashes: MovingDecoration[] = [];
  const props: MovingDecoration[] = [];
  let active = true;
  let animationFrame = 0;
  let last = performance.now();
  let distance = 0;
  let score = 0;
  let survivedSeconds = 0;
  let speed = ride.maxSpeed * 0.35;
  let spawnTimer = 1;
  let misses = 0;
  let splits = 0;
  let playerX = laneX(1);
  let targetX = playerX;
  let keyLeft = false;
  let keyRight = false;
  let braking = false;
  let pointerX: number | null = null;
  let stageIndex = 0;
  let jamSeconds = 0;
  let nextJam = 34;
  let jamMix = 0;
  let splitTime = 0;
  let comboTime = 0;
  let toastTime = 0;
  let edgeHold = 0;
  let rightHold = 0;
  let dividerHold = 0;
  let parkedCooldown = 5;
  let chaserCooldown = 7;
  let blindCooldown = 6;
  const ownedTimeouts = new Set<number>();

  function addDecorations() {
    for (const dividerX of dividerXs) {
      for (let index = 0; index < 12; index += 1) {
        const element = document.createElement("div");
        element.className = "gameDash";
        elements.road.appendChild(element);
        dashes.push({ element, x: dividerX - 3, y: index * 88 - 120 });
      }
    }
    for (let index = 0; index < 16; index += 1) {
      const element = document.createElement("div");
      element.className = "gameProp";
      const right = index % 2 === 1;
      element.innerHTML = right
        ? '<svg width="22" height="46" viewBox="0 0 22 46" aria-hidden="true"><rect x="9" y="10" width="4" height="36" fill="#4a4f57"/><ellipse cx="11" cy="10" rx="10" ry="11" fill="#2f6b3d"/><ellipse cx="11" cy="7" rx="7" ry="7" fill="#3d8450"/></svg>'
        : '<svg width="18" height="44" viewBox="0 0 18 44" aria-hidden="true"><rect x="7" y="8" width="4" height="36" fill="#8b939c"/><rect width="18" height="12" rx="3" fill="#d9dee3"/><rect x="3" y="3" width="12" height="6" rx="2" fill="#3a4150"/></svg>';
      elements.scenery.appendChild(element);
      props.push({ element, x: right ? WIDTH - 24 : 2, y: index * 104 - 100 });
    }
  }

  function showToast(text: string) {
    elements.toast.textContent = text;
    toastTime = 1.2;
  }

  function chooseTrafficType(): TrafficDefinition {
    const pool = trafficTypes.filter((type) => distance >= type.unlockDistance);
    const total = pool.reduce((sum, type) => sum + type.weight, 0);
    let pick = Math.random() * total;
    for (const type of pool) {
      pick -= type.weight;
      if (pick <= 0) return type;
    }
    return pool[0]!;
  }

  function rectanglesOverlap(
    first: { x: number; y: number; width: number; height: number },
    second: { x: number; y: number; width: number; height: number },
    marginX = 0,
    marginY = 0,
  ) {
    return (
      first.x - marginX < second.x + second.width + marginX &&
      first.x + first.width + marginX > second.x - marginX &&
      first.y - marginY < second.y + second.height + marginY &&
      first.y + first.height + marginY > second.y - marginY
    );
  }

  function areaIsFree(candidate: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    return !traffic.some((vehicle) =>
      rectanglesOverlap(
        candidate,
        {
          x: vehicle.x,
          y: vehicle.y,
          width: vehicle.width,
          height: vehicle.height,
        },
        12,
        MIN_GAP + 70,
      ),
    );
  }

  function spawnVehicle(
    definition: TrafficDefinition,
    lane: number,
    y: number,
    cruiseSpeed: number,
    narrow = false,
  ): TrafficVehicle | null {
    const x = narrow
      ? dividerXs[Math.min(lane, dividerXs.length - 1)]! - definition.width / 2
      : laneX(lane) - definition.width / 2;
    if (
      !areaIsFree({ x, y, width: definition.width, height: definition.height })
    )
      return null;
    const element = document.createElement("div");
    element.className = "gameVehicle";
    element.innerHTML = vehicleSvg(definition, randomTrafficColor(definition));
    elements.world.appendChild(element);
    const vehicle: TrafficVehicle = {
      definition,
      element,
      width: definition.width,
      height: definition.height,
      lane,
      x,
      targetX: x,
      y,
      baseSpeed: cruiseSpeed,
      speed: cruiseSpeed,
      narrow,
      changing: 0,
      aggressive: Boolean(definition.aggressive),
      hazardKind: null,
      near: false,
      passed: false,
      turnDelay: 0,
    };
    traffic.push(vehicle);
    if (!unlocked.has(definition.id)) {
      unlocked.add(definition.id);
      const label = messages.unlock[definition.id];
      if (label && distance > 60) showToast(label);
    }
    return vehicle;
  }

  function addWarning(vehicle: TrafficVehicle, text: string, danger = false) {
    const badge = document.createElement("div");
    badge.className = `gameHazard${danger ? " isDanger" : ""}`;
    badge.textContent = text;
    vehicle.element.appendChild(badge);
  }

  function spawnParkedHazard(side: "left" | "right") {
    const definition = trafficTypes.find((type) => type.id === "sedan")!;
    const lane = side === "right" ? LANE_COUNT - 1 : 0;
    const vehicle = spawnVehicle(definition, lane, -definition.height - 50, 0);
    if (!vehicle) return false;
    vehicle.hazardKind = "parked";
    vehicle.baseSpeed = 0;
    vehicle.speed = 0;
    vehicle.x = vehicle.targetX =
      side === "right" ? WIDTH - SHOULDER - vehicle.width - 5 : SHOULDER + 5;
    addWarning(vehicle, messages.parked, true);
    return true;
  }

  function spawnFastChaser() {
    const definition = trafficTypes.find((type) => type.id === "sport")!;
    const vehicle = spawnVehicle(
      definition,
      LANE_COUNT - 1,
      HEIGHT + 105,
      speed + 250,
    );
    if (!vehicle) return false;
    vehicle.hazardKind = "chaser";
    vehicle.aggressive = true;
    addWarning(vehicle, messages.chaser, true);
    return true;
  }

  function triggerBlindSpotChange() {
    const divider = dividerXs.reduce((closest, value) =>
      Math.abs(value - playerX) < Math.abs(closest - playerX) ? value : closest,
    );
    const vehicle = traffic.find((candidate) => {
      if (
        candidate.narrow ||
        candidate.definition.noLaneChange ||
        candidate.hazardKind
      )
        return false;
      const ahead = PLAYER_Y - candidate.y;
      if (ahead < 95 || ahead > 285) return false;
      const candidateCenter = candidate.x + candidate.width / 2;
      const targetLane =
        candidateCenter < divider ? candidate.lane + 1 : candidate.lane - 1;
      return targetLane >= 0 && targetLane < LANE_COUNT;
    });
    if (!vehicle) return false;
    vehicle.hazardKind = "blind";
    vehicle.turnDelay = 0.72;
    addWarning(vehicle, messages.blindSpot);
    return true;
  }

  function spawnNormal() {
    const difficulty = stageAt(distance);
    const definition = chooseTrafficType();
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const spread = 50 + difficulty.progress * 60;
    const cruise =
      definition.baseSpeed *
        difficulty.botMultiplier *
        (definition.aggressive ? 1.1 : 1) +
      Math.random() * spread;
    spawnVehicle(
      definition,
      lane,
      -definition.height - 40 - Math.random() * 80,
      cruise,
      Boolean(definition.narrow && Math.random() < 0.5),
    );
  }

  function spawnJam() {
    const pool = trafficTypes.filter(
      (type) =>
        distance >= type.unlockDistance && !type.narrow && !type.aggressive,
    );
    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
    lanes.forEach((lane, index) => {
      const definition = pool[Math.floor(Math.random() * pool.length)]!;
      spawnVehicle(
        definition,
        lane,
        -definition.height - 30 - index * 70 - Math.random() * 50,
        44 + Math.random() * 40,
      );
    });
  }

  function updateTrafficAi(vehicle: TrafficVehicle, delta: number) {
    const difficulty = stageAt(distance);
    const desired = vehicle.baseSpeed * (1 - jamMix * 0.8);
    if (vehicle.hazardKind === "parked") {
      vehicle.speed = 0;
      return;
    }
    if (vehicle.hazardKind === "chaser") {
      vehicle.speed += (vehicle.baseSpeed - vehicle.speed) * delta * 2.4;
      vehicle.targetX = laneX(LANE_COUNT - 1) - vehicle.width / 2;
      return;
    }
    if (vehicle.turnDelay > 0) {
      vehicle.turnDelay -= delta;
      vehicle.speed += (desired * 0.82 - vehicle.speed) * delta * 1.8;
      if (vehicle.turnDelay <= 0) {
        const center = vehicle.x + vehicle.width / 2;
        vehicle.lane =
          center < playerX
            ? Math.min(LANE_COUNT - 1, vehicle.lane + 1)
            : Math.max(0, vehicle.lane - 1);
      }
      vehicle.targetX = laneX(vehicle.lane) - vehicle.width / 2;
      return;
    }
    if (vehicle.narrow) {
      vehicle.targetX =
        dividerXs[Math.min(vehicle.lane, dividerXs.length - 1)]! -
        vehicle.width / 2 +
        Math.sin(survivedSeconds * 2 + vehicle.lane) * 5;
      vehicle.speed += (desired * 1.2 + 25 - vehicle.speed) * delta * 1.4;
      return;
    }
    const playerGap = PLAYER_Y - (vehicle.y + vehicle.height);
    const inPlayerLane =
      Math.abs(playerX - (vehicle.x + vehicle.width / 2)) <
      (vehicle.width + ride.hitWidth) / 2 + 6;
    const safeGap = (vehicle.definition.heavy ? 78 : 64) + vehicle.speed * 0.34;
    if (inPlayerLane && playerGap >= -6 && playerGap < safeGap) {
      vehicle.speed +=
        (Math.max(0, Math.min(speed, desired) - 38) - vehicle.speed) *
        delta *
        (vehicle.definition.heavy ? 2.1 : 3);
      if (
        difficulty.laneChanges &&
        jamMix < 0.25 &&
        !vehicle.definition.noLaneChange &&
        vehicle.changing <= 0 &&
        Math.random() < delta * 0.9
      ) {
        const directions = Math.random() < 0.5 ? [-1, 1] : [1, -1];
        const nextLane = directions
          .map((direction) => vehicle.lane + direction)
          .find((lane) => lane >= 0 && lane < LANE_COUNT);
        if (nextLane !== undefined) {
          vehicle.lane = nextLane;
          vehicle.changing = vehicle.aggressive ? 0.5 : 0.8;
        }
      }
    } else {
      vehicle.speed += (desired - vehicle.speed) * delta * 0.95;
    }
    vehicle.changing = Math.max(0, vehicle.changing - delta);
    vehicle.targetX = laneX(vehicle.lane) - vehicle.width / 2;
  }

  function separateTraffic() {
    const sorted = [...traffic].sort((first, second) => first.y - second.y);
    for (
      let followingIndex = 1;
      followingIndex < sorted.length;
      followingIndex += 1
    ) {
      const following = sorted[followingIndex]!;
      let requiredY = Number.NEGATIVE_INFINITY;
      let leader: TrafficVehicle | null = null;
      for (
        let leadingIndex = 0;
        leadingIndex < followingIndex;
        leadingIndex += 1
      ) {
        const candidate = sorted[leadingIndex]!;
        const overlapsHorizontally =
          following.x < candidate.x + candidate.width + 2 &&
          following.x + following.width + 2 > candidate.x;
        if (!overlapsHorizontally) continue;
        const nextY = candidate.y + candidate.height + MIN_GAP;
        if (nextY > requiredY) {
          requiredY = nextY;
          leader = candidate;
        }
      }
      if (leader && following.y < requiredY) {
        following.y = requiredY;
        following.speed = Math.min(following.speed, leader.speed);
      }
    }
  }

  function endGame() {
    if (!active) return;
    active = false;
    onGameOver({
      distance: Math.floor(distance),
      misses,
      score: Math.floor(score),
      splits,
      stageIndex,
      survivedSeconds: Math.floor(survivedSeconds),
    });
  }

  function update(delta: number) {
    const difficulty = stageAt(distance);
    if (difficulty.index !== stageIndex) {
      stageIndex = difficulty.index;
      elements.level.textContent = `▲ ${messages.stageNames[stageIndex]}`;
      elements.level.classList.add("isVisible");
      const timeout = window.setTimeout(() => {
        ownedTimeouts.delete(timeout);
        elements.level.classList.remove("isVisible");
      }, 1_200);
      ownedTimeouts.add(timeout);
    }
    elements.stage.textContent = messages.stageNames[difficulty.index] ?? "";
    elements.stageBar.style.width = `${Math.round(difficulty.progress * 100)}%`;

    if (ride.jamReady && difficulty.jamGap < 90) {
      if (jamSeconds > 0) {
        jamSeconds -= delta;
        if (jamSeconds <= 0) {
          nextJam = difficulty.jamGap;
          showToast(messages.clearRoad);
        }
      } else {
        nextJam -= delta;
        if (nextJam <= 0) {
          jamSeconds = 10 + difficulty.progress * 6 + Math.random() * 4;
          showToast(messages.jamAhead);
        }
      }
    }
    jamMix += ((jamSeconds > 0 ? 1 : 0) - jamMix) * Math.min(delta * 1.1, 1);
    elements.jam.style.opacity = jamMix.toFixed(2);

    const speedCap =
      ride.maxSpeed * difficulty.speedMultiplier * (1 - jamMix * 0.55);
    speed = clamp(
      speed +
        (speed < speedCap ? ride.acceleration : -ride.acceleration * 2.4) *
          delta,
      ride.maxSpeed * 0.28,
      ride.maxSpeed,
    );
    if (braking)
      speed = Math.max(
        ride.maxSpeed * 0.25,
        speed - ride.acceleration * 7 * delta,
      );
    const gain = speed * delta * 0.085;
    distance += gain;
    score += gain * ride.multiplier;

    if (keyLeft || keyRight) {
      targetX +=
        ((keyRight ? 1 : 0) - (keyLeft ? 1 : 0)) * ride.lateralSpeed * delta;
    } else if (pointerX !== null) {
      targetX += (pointerX - targetX) * Math.min(delta * 12, 1);
    }
    targetX = clamp(
      targetX,
      SHOULDER + ride.width / 2 + 2,
      WIDTH - SHOULDER - ride.width / 2 - 2,
    );
    playerX += (targetX - playerX) * Math.min(delta * 15, 1);

    parkedCooldown = Math.max(0, parkedCooldown - delta);
    chaserCooldown = Math.max(0, chaserCooldown - delta);
    blindCooldown = Math.max(0, blindCooldown - delta);
    if (ride.narrow) {
      const atLeftEdge = playerX < SHOULDER + LANE_WIDTH * 0.27;
      const atRightEdge = playerX > WIDTH - SHOULDER - LANE_WIDTH * 0.27;
      edgeHold =
        atLeftEdge || atRightEdge
          ? edgeHold + delta
          : Math.max(0, edgeHold - delta * 0.8);
      rightHold = atRightEdge
        ? rightHold + delta
        : Math.max(0, rightHold - delta * 2.4);
      const nearDivider = dividerXs.some(
        (divider) => Math.abs(playerX - divider) < 18,
      );
      dividerHold = nearDivider
        ? dividerHold + delta
        : Math.max(0, dividerHold - delta * 1.8);
      if (
        edgeHold > 2.15 &&
        parkedCooldown <= 0 &&
        spawnParkedHazard(atLeftEdge ? "left" : "right")
      ) {
        parkedCooldown = 7 - Math.min(2.5, difficulty.index * 0.45);
        edgeHold = 0;
        showToast(messages.parked);
      }
      if (rightHold > 2.6 && chaserCooldown <= 0 && spawnFastChaser()) {
        chaserCooldown = 9 - Math.min(3, difficulty.index * 0.45);
        rightHold = 0;
        showToast(messages.chaser);
      }
      if (
        dividerHold > 0.85 &&
        blindCooldown <= 0 &&
        difficulty.laneChanges &&
        triggerBlindSpotChange()
      ) {
        blindCooldown = 6.8 - Math.min(0.8, difficulty.index * 0.35);
        dividerHold = 0;
        showToast(messages.blindSpot);
      }
    } else {
      edgeHold = 0;
      rightHold = 0;
      dividerHold = 0;
    }

    const decorationDelta = speed * delta;
    dashes.forEach((dash) => {
      dash.y += decorationDelta;
      if (dash.y > HEIGHT + 80) dash.y -= 12 * 88;
      dash.element.style.transform = `translate3d(${dash.x}px,${Math.floor(dash.y)}px,0)`;
    });
    props.forEach((prop) => {
      prop.y += decorationDelta * 0.9;
      if (prop.y > HEIGHT + 70) prop.y -= 16 * 104;
      prop.element.style.transform = `translate3d(${prop.x}px,${Math.floor(prop.y)}px,0)`;
    });

    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      if (jamMix > 0.4) {
        spawnJam();
        spawnTimer = 0.22;
      } else {
        spawnNormal();
        spawnTimer = difficulty.spawnInterval * (0.8 + Math.random() * 0.4);
      }
    }

    const playerBox = {
      x: playerX - ride.hitWidth / 2,
      y: PLAYER_Y + (ride.height - ride.hitHeight) / 2,
      width: ride.hitWidth,
      height: ride.hitHeight,
    };
    let trafficOnLeft = false;
    let trafficOnRight = false;
    for (let index = traffic.length - 1; index >= 0; index -= 1) {
      const vehicle = traffic[index]!;
      updateTrafficAi(vehicle, delta);
      vehicle.x +=
        (vehicle.targetX - vehicle.x) *
        Math.min(delta * (vehicle.narrow ? 9 : 4), 1);
      vehicle.y += (speed - vehicle.speed) * delta;
      vehicle.element.style.transform = `translate3d(${vehicle.x.toFixed(1)}px,${Math.floor(vehicle.y)}px,0)`;
      const vehicleBox = {
        x: vehicle.x,
        y: vehicle.y,
        width: vehicle.width,
        height: vehicle.height,
      };
      if (rectanglesOverlap(playerBox, vehicleBox, -3, -3)) {
        endGame();
        return;
      }
      const horizontalDistance =
        vehicle.x + vehicle.width / 2 - (playerBox.x + playerBox.width / 2);
      const verticallyClose =
        Math.abs(
          vehicle.y + vehicle.height / 2 - (playerBox.y + playerBox.height / 2),
        ) <
        Math.max(vehicle.height, playerBox.height) * 0.62;
      if (
        verticallyClose &&
        Math.abs(horizontalDistance) <
          (vehicle.width + playerBox.width) / 2 + 30
      ) {
        if (horizontalDistance < 0) trafficOnLeft = true;
        else trafficOnRight = true;
      }
      if (
        !vehicle.near &&
        Math.abs(horizontalDistance) <
          (vehicle.width + playerBox.width) / 2 + 16 &&
        Math.abs(vehicle.y - playerBox.y) < 110
      ) {
        vehicle.near = true;
      }
      if (
        vehicle.near &&
        !vehicle.passed &&
        vehicle.y > playerBox.y + playerBox.height
      ) {
        vehicle.passed = true;
        misses += 1;
        score += 25 * ride.multiplier;
        showToast(`+${Math.round(25 * ride.multiplier)} ${messages.nearMiss}`);
      }
      if (vehicle.y > HEIGHT + 240 || vehicle.y < -380) {
        vehicle.element.remove();
        traffic.splice(index, 1);
      }
    }
    separateTraffic();

    if (ride.narrow && trafficOnLeft && trafficOnRight) {
      splitTime += delta;
      score += 80 * ride.multiplier * delta;
      if (splitTime > 0.28) {
        comboTime = 0.5;
        elements.combo.textContent = `${messages.split} +${Math.round(splitTime * 80 * ride.multiplier)}`;
      }
    } else {
      if (splitTime > 0.35) splits += 1;
      splitTime = 0;
    }
    comboTime = Math.max(0, comboTime - delta);
    elements.combo.style.opacity =
      comboTime > 0 ? String(Math.min(1, comboTime * 3)) : "0";
    const tilt = clamp(
      (targetX - playerX) * (ride.narrow ? 0.75 : 0.55),
      -13,
      13,
    );
    playerElement.style.transform = `translate3d(${Math.floor(playerX - ride.width / 2)}px,${PLAYER_Y}px,0) rotate(${tilt.toFixed(1)}deg)`;
    elements.score.textContent = String(Math.floor(score));
    elements.speed.textContent = String(Math.round(speed * ride.kmhMultiplier));
    if (toastTime > 0) {
      toastTime -= delta;
      elements.toast.style.opacity = String(Math.min(1, toastTime * 3));
    } else {
      elements.toast.style.opacity = "0";
    }
  }

  function loop(time: number) {
    if (!active) return;
    const delta = Math.min((time - last) / 1_000, 0.05);
    last = time;
    survivedSeconds += delta;
    update(delta);
    if (active) animationFrame = requestAnimationFrame(loop);
  }

  function keyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") keyLeft = true;
    else if (key === "d" || key === "arrowright") keyRight = true;
    else if (key === "s" || key === "arrowdown") braking = true;
    else return;
    pointerX = null;
    event.preventDefault();
  }

  function keyUp(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === "a" || key === "arrowleft") keyLeft = false;
    else if (key === "d" || key === "arrowright") keyRight = false;
    else if (key === "s" || key === "arrowdown") braking = false;
    else return;
    event.preventDefault();
  }

  function point(event: PointerEvent) {
    const bounds = elements.board.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    event.preventDefault();
  }

  addDecorations();
  elements.stage.textContent = messages.stageNames[0] ?? "";
  elements.stageBar.style.width = "0%";
  elements.multiplier.textContent = `×${ride.multiplier.toFixed(1)}`;
  elements.jam.textContent = messages.jamPrompt;
  elements.score.textContent = "0";
  elements.speed.textContent = "0";
  const playerElement = document.createElement("div");
  playerElement.className = "gameVehicle gamePlayer";
  playerElement.innerHTML = vehicleSvg(ride);
  elements.world.appendChild(playerElement);

  window.addEventListener("keydown", keyDown, { signal });
  window.addEventListener("keyup", keyUp, { signal });
  elements.board.addEventListener("pointerdown", point, {
    passive: false,
    signal,
  });
  elements.board.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse" || event.buttons !== 0) point(event);
    },
    { passive: false, signal },
  );
  animationFrame = requestAnimationFrame(loop);

  return () => {
    active = false;
    controller.abort();
    cancelAnimationFrame(animationFrame);
    ownedTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    ownedTimeouts.clear();
    traffic.forEach((vehicle) => vehicle.element.remove());
    dashes.forEach((dash) => dash.element.remove());
    props.forEach((prop) => prop.element.remove());
    playerElement.remove();
  };
}
