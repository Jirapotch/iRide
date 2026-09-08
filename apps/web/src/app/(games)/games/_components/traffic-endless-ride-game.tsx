"use client";

import { ArrowLeft, Gauge, RoadHorizon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PendingLink } from "@/features/navigation/components/pending-link";
import {
  finishRun,
  initialSession,
  startRun,
  type GameSession,
  type RideId,
  type RunResult,
} from "@/lib/traffic-endless-ride";
import type { Locale } from "@/lib/locale";

import {
  mountTrafficEndlessRide,
  type GameElements,
} from "./traffic-endless-ride-engine";
import { rides, vehicleSvg } from "./traffic-endless-ride-vehicles";
import styles from "./traffic-endless-ride.module.css";

const copy = {
  th: {
    back: "กลับไปรายการเกมส์",
    title: "Traffic Ride",
    kicker: "Endless Runner",
    start: "เริ่มเกม",
    again: "เล่นอีกครั้ง",
    changeRide: "เปลี่ยนพาหนะ",
    selected: "เลือกแล้ว",
    controls:
      "A / D หรือ ← → เพื่อเลี้ยว • S / ↓ เพื่อเบรก • ลากซ้ายขวาบนหน้าจอสัมผัส",
    strategy:
      "ยิ่งพาหนะช้า ยิ่งได้ตัวคูณคะแนนสูง — มอเตอร์ไซค์และจักรยานมุดระหว่างรถได้",
    score: "คะแนน",
    speed: "กม./ชม.",
    gameOver: "Game Over",
    best: "ดีที่สุดรอบนี้",
    distance: "ระยะทาง",
    misses: "เฉียดฉิว",
    splits: "มุดสำเร็จ",
    time: "เวลารอด",
    stage: "ระดับ",
    rides: {
      sedan: { name: "Sedan", perk: "ขับง่าย เหมาะกับมือใหม่" },
      sport: { name: "Sport", perk: "เร็วที่สุด เลี้ยวไว" },
      moto: { name: "Moto", perk: "ตัวเล็ก มุดรถติดได้" },
      cycle: { name: "จักรยาน", perk: "ช้ามาก แต่คล่องตัว" },
    },
    messages: {
      blindSpot: "⚠️ รถข้างหน้าเปลี่ยนเลน",
      chaser: "💡 รถเร็วไล่มาด้านหลัง",
      stageNames: [
        "อุ่นเครื่อง",
        "จราจรเบาบาง",
        "เริ่มหนาแน่น",
        "ชั่วโมงเร่งด่วน",
        "ทางด่วนแน่น",
        "ตำนานนักมุด",
      ],
      jamPrompt: "🚦 รถติด — มุดระหว่างรถ!",
      jamAhead: "🚦 รถติดข้างหน้า! มุดเลย",
      clearRoad: "🏁 ทางโล่งแล้ว!",
      nearMiss: "เฉียด!",
      parked: "⚠️ รถจอดริมทาง",
      split: "มุด!",
      unlock: {
        suv: "ปลดล็อก 🚙 SUV",
        tuktuk: "ปลดล็อก 🛺 ตุ๊กตุ๊ก",
        moto: "ปลดล็อก 🏍️ มอเตอร์ไซค์",
        pickup: "ปลดล็อก 🛻 กระบะ",
        van: "ปลดล็อก 🚐 รถตู้",
        truck: "ปลดล็อก 🚚 รถบรรทุก",
        bus: "ปลดล็อก 🚌 รถเมล์",
        mixer: "ปลดล็อก 🚧 รถโม่ปูน",
        semi: "ปลดล็อก 🚛 รถพ่วง 18 ล้อ",
        police: "ปลดล็อก 🚓 ตำรวจ",
      },
    },
  },
  en: {
    back: "Back to games",
    title: "Traffic Ride",
    kicker: "Endless Runner",
    start: "Start game",
    again: "Play again",
    changeRide: "Change ride",
    selected: "Selected",
    controls:
      "Steer with A / D or ← → • Brake with S / ↓ • Drag left and right on touch screens",
    strategy:
      "Slower rides earn a higher score multiplier — motorcycles and bicycles can split traffic.",
    score: "Score",
    speed: "KM/H",
    gameOver: "Game Over",
    best: "Session best",
    distance: "Distance",
    misses: "Near misses",
    splits: "Splits",
    time: "Survived",
    stage: "Stage",
    rides: {
      sedan: { name: "Sedan", perk: "Easy handling for new riders" },
      sport: { name: "Sport", perk: "Fastest with sharp steering" },
      moto: { name: "Moto", perk: "Small enough to split traffic" },
      cycle: { name: "Bicycle", perk: "Very slow, highly agile" },
    },
    messages: {
      blindSpot: "⚠️ Vehicle changing lanes",
      chaser: "💡 Fast car approaching",
      stageNames: [
        "Warm-up",
        "Light traffic",
        "Building traffic",
        "Rush hour",
        "Packed expressway",
        "Lane-split legend",
      ],
      jamPrompt: "🚦 Traffic jam — split the lanes!",
      jamAhead: "🚦 Jam ahead! Find the gap",
      clearRoad: "🏁 The road is clear!",
      nearMiss: "near miss!",
      parked: "⚠️ Parked vehicle",
      split: "Split!",
      unlock: {
        suv: "Unlocked 🚙 SUV",
        tuktuk: "Unlocked 🛺 Tuk-tuk",
        moto: "Unlocked 🏍️ Motorcycle",
        pickup: "Unlocked 🛻 Pickup",
        van: "Unlocked 🚐 Van",
        truck: "Unlocked 🚚 Truck",
        bus: "Unlocked 🚌 Bus",
        mixer: "Unlocked 🚧 Cement mixer",
        semi: "Unlocked 🚛 Semi truck",
        police: "Unlocked 🚓 Police",
      },
    },
  },
} as const;

export function TrafficEndlessRideGame({
  locale,
}: {
  readonly locale: Locale;
}) {
  const text = copy[locale];
  const [session, setSession] = useState<GameSession>(initialSession);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const sceneryRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const multiplierRef = useRef<HTMLDivElement>(null);
  const stageNameRef = useRef<HTMLDivElement>(null);
  const stageBarRef = useRef<HTMLElement>(null);
  const jamRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const board = boardRef.current;
    if (!stage || !board) return;
    const fit = () => {
      const scale = Math.min(stage.clientWidth / 420, stage.clientHeight / 760);
      board.style.setProperty("--game-scale", String(scale));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    fit();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (session.mode === "playing") return;
    const handleSpace = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      setSession((current) => startRun(current, current.rideId));
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, [session.mode]);

  const handleGameOver = useCallback((result: RunResult) => {
    setSession((current) => finishRun(current, result));
  }, []);

  useEffect(() => {
    if (session.mode !== "playing") return;
    const values = {
      board: boardRef.current,
      combo: comboRef.current,
      jam: jamRef.current,
      level: levelRef.current,
      multiplier: multiplierRef.current,
      road: roadRef.current,
      scenery: sceneryRef.current,
      score: scoreRef.current,
      speed: speedRef.current,
      stage: stageNameRef.current,
      stageBar: stageBarRef.current,
      toast: toastRef.current,
      world: worldRef.current,
    };
    if (Object.values(values).some((value) => value === null)) return;
    return mountTrafficEndlessRide({
      elements: values as GameElements,
      messages: text.messages,
      onGameOver: handleGameOver,
      rideId: session.rideId,
    });
  }, [handleGameOver, session.mode, session.rideId, text.messages]);

  function selectRide(rideId: RideId) {
    setSession((current) => ({ ...current, rideId }));
  }

  function begin(rideId = session.rideId) {
    setSession((current) => startRun(current, rideId));
  }

  function showRideMenu() {
    setSession((current) => ({ ...current, mode: "select", result: null }));
  }

  const result = session.result;

  return (
    <main className={styles.page} data-game-mode={session.mode}>
      <PendingLink className={styles.backLink} href="/games">
        <ArrowLeft aria-hidden size={18} />
        {text.back}
      </PendingLink>
      <div className={styles.stage} ref={stageRef}>
        <div className={styles.board} data-ui="game-board" ref={boardRef}>
          <div className={styles.roadBackground} />
          <div className={styles.road} ref={roadRef} />
          <div className={styles.scenery} ref={sceneryRef} />
          <div className={styles.world} ref={worldRef} />

          <div
            className={`${styles.hud} ${session.mode === "playing" ? "" : styles.hidden}`}
          >
            <div className={styles.score} data-ui="game-score" ref={scoreRef}>
              0
            </div>
            <div className={styles.scoreLabel}>{text.score}</div>
            <div className={styles.stageName} ref={stageNameRef} />
            <div className={styles.stageBar}>
              <i ref={stageBarRef} />
            </div>
            <div className={styles.speedBlock}>
              <div className={styles.speed} ref={speedRef}>
                0
              </div>
              <div className={styles.speedLabel}>{text.speed}</div>
            </div>
            <div className={styles.multiplier} ref={multiplierRef}>
              ×1.0
            </div>
            <div className={styles.jam} ref={jamRef} />
            <div className={styles.toast} ref={toastRef} />
            <div className={styles.combo} ref={comboRef} />
            <div className={styles.level} ref={levelRef} />
          </div>

          {session.mode === "select" ? (
            <section className={styles.screen} aria-labelledby="game-title">
              <span className={styles.kicker}>{text.kicker}</span>
              <h1 id="game-title" ref={headingRef} tabIndex={-1}>
                TRAFFIC
                <br />
                RIDE
              </h1>
              <div
                className={styles.rideGrid}
                role="radiogroup"
                aria-label={locale === "th" ? "เลือกพาหนะ" : "Choose a ride"}
              >
                {rides.map((ride) => {
                  const rideText = text.rides[ride.id];
                  const selected = session.rideId === ride.id;
                  return (
                    <button
                      aria-checked={selected}
                      aria-label={`${rideText.name} — ${rideText.perk}`}
                      className={`${styles.rideCard} ${selected ? styles.selectedRide : ""}`}
                      key={ride.id}
                      onClick={() => selectRide(ride.id)}
                      role="radio"
                      type="button"
                    >
                      <span
                        className={styles.rideIcon}
                        dangerouslySetInnerHTML={{ __html: vehicleSvg(ride) }}
                      />
                      <strong>{rideText.name}</strong>
                      <span className={styles.stat}>
                        <i
                          style={{
                            width: `${Math.max(12, (ride.maxSpeed - 320) / 4)}%`,
                          }}
                        />
                      </span>
                      <span className={`${styles.stat} ${styles.handling}`}>
                        <i
                          style={{
                            width: `${Math.max(12, (ride.lateralSpeed - 340) / 2.8)}%`,
                          }}
                        />
                      </span>
                      <b>×{ride.multiplier.toFixed(1)}</b>
                      <small>{rideText.perk}</small>
                      {selected ? <em>{text.selected}</em> : null}
                    </button>
                  );
                })}
              </div>
              <button
                className={styles.primaryButton}
                onClick={() => begin()}
                type="button"
              >
                <RoadHorizon aria-hidden size={20} weight="fill" />
                {text.start}
              </button>
              <div className={styles.instructions}>
                <p>{text.controls}</p>
                <p>{text.strategy}</p>
              </div>
            </section>
          ) : null}

          {session.mode === "over" && result ? (
            <section
              className={styles.screen}
              aria-labelledby="game-over-title"
            >
              <span className={styles.kicker}>{text.gameOver}</span>
              <h2 className={styles.finalScore} id="game-over-title">
                {result.score}
              </h2>
              <p className={styles.resultStage}>
                {text.stage} {result.stageIndex + 1} —{" "}
                {text.messages.stageNames[result.stageIndex]} ·{" "}
                {text.rides[session.rideId].name}
              </p>
              <div className={styles.results}>
                <Result label={text.best} value={session.bestScore} />
                <Result label={text.distance} value={result.distance} />
                <Result label={text.misses} value={result.misses} />
                <Result label={text.splits} value={result.splits} />
                <Result
                  label={text.time}
                  value={`${result.survivedSeconds}s`}
                />
              </div>
              <button
                className={styles.primaryButton}
                onClick={() => begin()}
                type="button"
              >
                <Gauge aria-hidden size={20} weight="fill" />
                {text.again}
              </button>
              <button
                className={styles.secondaryButton}
                onClick={showRideMenu}
                type="button"
              >
                {text.changeRide}
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Result({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
