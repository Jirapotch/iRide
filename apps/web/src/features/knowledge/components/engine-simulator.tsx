"use client";

import {
  ArrowLeft,
  ArrowsClockwise,
  Power,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { EngineAudio } from "../engine-audio";
import {
  engineDisplayName,
  engineGroups,
  enginePresets,
  getFiringIntervals,
  type EnginePreset,
} from "../engine-catalog";
import {
  createEngineState,
  startEngine,
  stepEngine,
  stopEngine,
  type EnginePhase,
} from "../engine-simulation";
import type { EngineViewer } from "../engine-viewer";
import { PendingLink } from "@/features/navigation/components/pending-link";
import type { Locale } from "@/lib/locale";

import styles from "./knowledge.module.css";
import { Tachometer } from "./tachometer";

const defaultEngine =
  enginePresets.find(({ id }) => id === "m2c") ?? enginePresets[0]!;
type ViewMode = "live" | "slow" | "pause";

const copy = {
  th: {
    back: "กลับสู่สื่อความรู้",
    kicker: "INTERACTIVE ENGINE LAB",
    title: "Engine Simulator 3D",
    intro:
      "เปิดดูชิ้นส่วน ฟังเสียง และทดลองรอบเครื่องยนต์จริงในแบบจำลองเชิงกลไก",
    category: "ประเภท",
    engine: "เครื่องยนต์",
    cylinders: "สูบ",
    redline: "รอบตัด",
    start: "บิดกุญแจสตาร์ท",
    stop: "ดับเครื่อง",
    starting: "กำลังสตาร์ท",
    throttle: "คันเร่ง",
    throttleHint: "เลื่อนค้างเพื่อเร่ง · ปล่อยเพื่อคืนคันเร่ง",
    exhaust: "เสียงท่อ",
    exhausts: ["ท่อเดิม", "สปอร์ต", "ปลายสั้น", "ปลายยาว", "ท่อตรง", "สนาม"],
    force: "อัดอากาศ",
    turbo: "เทอร์โบ",
    supercharger: "ซูเปอร์ชาร์จ",
    volume: "ระดับเสียง",
    mute: "ปิดเสียง",
    unmute: "เปิดเสียง",
    slow: "ภาพช้า",
    pause: "หยุดภาพ",
    live: "ภาพตามรอบจริง",
    crank: "องศาข้อเหวี่ยง",
    angleHint: "ลากแถบเพื่อหมุนกลไกเอง",
    firing: "จังหวะจุดระเบิด",
    equal: "เท่ากัน",
    rpm: "รอบ/นาที",
    viewLoading: "กำลังเตรียมภาพ 3D",
    viewError: "อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ คุณยังใช้ข้อมูลและเสียงได้",
    audioError: "เปิดเสียงไม่ได้ในเบราว์เซอร์นี้ ภาพ 3D ยังทำงานได้",
    audioReady: "เสียงเครื่องยนต์พร้อมแล้ว",
    guide:
      "ลากเพื่อหมุนมุมมอง · เลื่อนล้อเมาส์เพื่อซูม · Space สตาร์ท/ดับ · ↑ เร่ง",
    noApi: "ข้อมูล ภาพ และเสียงทำงานในเบราว์เซอร์โดยไม่เรียก API",
  },
  en: {
    back: "Back to knowledge",
    kicker: "INTERACTIVE ENGINE LAB",
    title: "Engine Simulator 3D",
    intro:
      "See the moving parts, hear the firing order, and explore an engine's changing RPM.",
    category: "Category",
    engine: "Engine",
    cylinders: "cylinders",
    redline: "Redline",
    start: "Start engine",
    stop: "Stop engine",
    starting: "Starting",
    throttle: "Throttle",
    throttleHint: "Hold to rev · release to return to idle",
    exhaust: "Exhaust sound",
    exhausts: ["Stock", "Sport", "Short", "Long", "Straight", "Track"],
    force: "Forced induction",
    turbo: "Turbo",
    supercharger: "Supercharger",
    volume: "Volume",
    mute: "Mute",
    unmute: "Unmute",
    slow: "Slow motion",
    pause: "Pause view",
    live: "Live view",
    crank: "Crank angle",
    angleHint: "Drag the slider to turn the mechanism",
    firing: "Firing intervals",
    equal: "even",
    rpm: "RPM",
    viewLoading: "Preparing 3D view",
    viewError:
      "3D is unavailable on this device. Engine data and audio remain available.",
    audioError:
      "Audio could not start in this browser. The 3D view remains available.",
    audioReady: "Engine audio is ready",
    guide: "Drag to orbit · wheel to zoom · Space to start or stop · ↑ to rev",
    noApi: "Data, visuals and sound run in your browser without API calls",
  },
} as const;

export function EngineSimulator({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  const [category, setCategory] =
    useState<(typeof engineGroups)[number]["id"]>("motorcycle");
  const [engineId, setEngineId] = useState(defaultEngine.id);
  const [exhaust, setExhaust] = useState(1);
  const [forced, setForced] = useState(true);
  const [volume, setVolume] = useState(0.6);
  const [previousVolume, setPreviousVolume] = useState(0.6);
  const [throttle, setThrottle] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [viewAngle, setViewAngle] = useState(0);
  const [display, setDisplay] = useState<{
    rpm: number;
    phase: EnginePhase;
    boost: number;
  }>({ rpm: 0, phase: "off", boost: 0 });
  const [viewStatus, setViewStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [audioStatus, setAudioStatus] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<EngineViewer | null>(null);
  const audioRef = useRef<EngineAudio | null>(null);
  const simulationRef = useRef(createEngineState());
  const engineRef = useRef(defaultEngine);
  const exhaustRef = useRef(exhaust);
  const volumeRef = useRef(volume);
  const viewModeRef = useRef<ViewMode>("live");
  const viewAngleRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const mountedRef = useRef(true);
  const engine =
    enginePresets.find((item) => item.id === engineId) ?? defaultEngine;
  const group =
    engineGroups.find((item) => item.id === category) ?? engineGroups[0];
  const options = enginePresets.filter(group.filter);
  const intervals = getFiringIntervals(engine);
  const evenFire = new Set(intervals).size === 1;

  useEffect(() => {
    mountedRef.current = true;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
      if (motionQuery.matches && viewModeRef.current === "live") {
        viewModeRef.current = "pause";
        setViewMode("pause");
      }
    };
    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);
    let active = true;
    let frame = 0;
    let previousTime = performance.now();
    let previousDisplay = 0;
    const tick = (now: number) => {
      if (!active) return;
      const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;
      if (!document.hidden) {
        const state = simulationRef.current;
        const before = viewAngleRef.current;
        const sound = stepEngine(state, engineRef.current, dt);
        audioRef.current?.update(sound);
        if (viewModeRef.current === "live")
          viewAngleRef.current = state.crankAngle;
        else if (viewModeRef.current === "slow")
          viewAngleRef.current = (before + dt * 40) % 720;
        viewerRef.current?.render(
          before,
          viewAngleRef.current,
          state.throttle,
          state.phase === "run" || viewModeRef.current !== "live",
          state.cutTime > 0,
        );
        if (now - previousDisplay > 90) {
          setDisplay({
            rpm: Math.round(state.rpm),
            phase: state.phase,
            boost: state.boost,
          });
          setViewAngle(Math.round(viewAngleRef.current));
          previousDisplay = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    void import("../engine-viewer")
      .then(({ EngineViewer: Viewer }) => {
        if (!active || !stageRef.current) return;
        try {
          viewerRef.current = new Viewer(stageRef.current, engineRef.current);
          setViewStatus("ready");
        } catch (error) {
          console.warn("Engine 3D view unavailable", error);
          setViewStatus("error");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          console.warn("Engine 3D module unavailable", error);
          setViewStatus("error");
        }
      });
    const visibility = () => {
      previousTime = performance.now();
      if (document.hidden) void audioRef.current?.suspend();
      else void audioRef.current?.resume();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      mountedRef.current = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      motionQuery.removeEventListener("change", syncMotionPreference);
      viewerRef.current?.dispose();
      viewerRef.current = null;
      void audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        tag === "TEXTAREA"
      )
        return;
      if (event.code === "ArrowUp") {
        event.preventDefault();
        simulationRef.current.throttleCommand = 1;
        setThrottle(100);
      }
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        document.getElementById("engine-power")?.click();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowUp") releaseThrottle();
    };
    const blur = () => releaseThrottle();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, []);

  function releaseThrottle() {
    simulationRef.current.throttleCommand = 0;
    setThrottle(0);
  }

  function selectEngine(next: EnginePreset) {
    const previous = simulationRef.current;
    engineRef.current = next;
    simulationRef.current = createEngineState();
    simulationRef.current.forcedInduction = previous.forcedInduction;
    simulationRef.current.exhaust = exhaustRef.current;
    viewerRef.current?.setEngine(next);
    audioRef.current?.update({
      rpm: 0,
      thr: 0,
      load: 0,
      on: 0,
      starter: 0,
      cut: 0,
      pop: 0,
      boost: 0,
      master: 0,
      bov: 0,
    });
    audioRef.current?.configure(
      next,
      exhaustRef.current,
      simulationRef.current.forcedInduction,
      volumeRef.current,
    );
    viewModeRef.current = reducedMotionRef.current ? "pause" : "live";
    viewAngleRef.current = 0;
    setViewMode(viewModeRef.current);
    setViewAngle(0);
    setThrottle(0);
    setDisplay({ rpm: 0, phase: "off", boost: 0 });
    setAudioReady(false);
    setAudioStatus("");
    setEngineId(next.id);
  }

  async function togglePower() {
    const state = simulationRef.current;
    if (state.phase !== "off") {
      stopEngine(state);
      releaseThrottle();
      setAudioReady(false);
      setAudioStatus("");
      setDisplay((current) => ({ ...current, phase: "off" }));
      return;
    }
    viewModeRef.current = reducedMotionRef.current ? "pause" : "live";
    viewAngleRef.current = state.crankAngle;
    setViewMode(viewModeRef.current);
    startEngine(state);
    setDisplay((current) => ({ ...current, phase: "key" }));
    setAudioStatus("");
    setAudioReady(false);
    const audio = audioRef.current ?? new EngineAudio();
    audioRef.current = audio;
    try {
      await audio.start();
      if (!mountedRef.current || state.phase === "off") return;
      audio.configure(
        engineRef.current,
        exhaustRef.current,
        state.forcedInduction,
        volumeRef.current,
      );
      audio.keyTurn();
      setAudioReady(true);
      setAudioStatus(text.audioReady);
    } catch (error) {
      console.warn("Engine audio unavailable", error);
      if (mountedRef.current) {
        setAudioReady(false);
        setAudioStatus(text.audioError);
      }
    }
  }

  function changeExhaust(next: number) {
    exhaustRef.current = next;
    simulationRef.current.exhaust = next;
    setExhaust(next);
    audioRef.current?.configure(
      engineRef.current,
      next,
      simulationRef.current.forcedInduction,
      volumeRef.current,
    );
  }

  function changeForce(next: boolean) {
    simulationRef.current.forcedInduction = next;
    setForced(next);
    audioRef.current?.configure(
      engineRef.current,
      exhaustRef.current,
      next,
      volumeRef.current,
    );
  }

  function changeVolume(next: number) {
    volumeRef.current = next;
    setVolume(next);
    if (next > 0) setPreviousVolume(next);
    audioRef.current?.configure(
      engineRef.current,
      exhaustRef.current,
      simulationRef.current.forcedInduction,
      next,
    );
  }

  function cycleView() {
    const next: ViewMode =
      viewModeRef.current === "live"
        ? "slow"
        : viewModeRef.current === "slow"
          ? "pause"
          : "live";
    viewModeRef.current = next;
    setViewMode(next);
  }

  const powerText =
    display.phase === "off"
      ? text.start
      : display.phase === "run"
        ? text.stop
        : text.starting;
  const forceName = engine.turbo
    ? text.turbo
    : engine.sc
      ? text.supercharger
      : "—";

  return (
    <div
      className={styles.simPage}
      data-ui="engine-simulator"
      data-audio-ready={audioReady ? "true" : "false"}
    >
      <div className={styles.simIntro}>
        <PendingLink className={styles.backLink} href="/knowledge">
          <ArrowLeft aria-hidden size={17} /> {text.back}
        </PendingLink>
        <p className={styles.eyebrow}>{text.kicker}</p>
        <h1 data-route-heading tabIndex={-1}>
          {text.title}
        </h1>
        <p>{text.intro}</p>
      </div>
      <div className={styles.simGrid}>
        <div className={styles.stageColumn}>
          <section
            aria-label={text.title}
            className={styles.stageCard}
            data-ui="engine-cutaway"
          >
            <div className={styles.stageTop}>
              <span className={styles.liveDot} /> ENGINE CUTAWAY{" "}
              <span>{engineDisplayName(engine, locale)}</span>
            </div>
            <div
              className={styles.engineStage}
              ref={stageRef}
              data-view-status={viewStatus}
            >
              {viewStatus !== "ready" && (
                <p role="status">
                  {viewStatus === "loading" ? text.viewLoading : text.viewError}
                </p>
              )}
            </div>
            <div className={styles.stageBottom}>
              <button
                aria-pressed={viewMode !== "live"}
                onClick={cycleView}
                type="button"
              >
                <ArrowsClockwise aria-hidden size={17} />{" "}
                {viewMode === "live"
                  ? text.slow
                  : viewMode === "slow"
                    ? text.pause
                    : text.live}
              </button>
              <span>
                {viewMode === "live"
                  ? text.live
                  : viewMode === "slow"
                    ? text.slow
                    : text.pause}
              </span>
            </div>
          </section>
          <section
            className={styles.knowledgePanel}
            data-ui="four-stroke-cycle"
          >
            <div>
              <p className={styles.eyebrow}>FOUR-STROKE CYCLE</p>
              <h2>
                {text.crank}: {viewAngle}°
              </h2>
              <p>{text.angleHint}</p>
            </div>
            <div className={styles.angleTrack}>
              <div
                aria-hidden="true"
                className={styles.angleDots}
                data-ui="angle-dots"
              >
                {Array.from({ length: 25 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
              <div aria-hidden="true" className={styles.firingMarks}>
                {engine.fire.map((angle, index) => (
                  <span
                    key={`${angle}-${index}`}
                    style={{ left: `${(angle / 720) * 100}%` }}
                  />
                ))}
              </div>
              <input
                aria-label={text.crank}
                aria-valuetext={`${viewAngle}°`}
                min="0"
                max="720"
                type="range"
                value={viewAngle}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  viewModeRef.current = "pause";
                  viewAngleRef.current = next;
                  setViewMode("pause");
                  setViewAngle(next);
                  viewerRef.current?.render(
                    next,
                    next,
                    simulationRef.current.throttle,
                    true,
                    false,
                  );
                }}
              />
              <div className={styles.angleEnds}>
                <span>0°</span>
                <span>720°</span>
              </div>
            </div>
            <p>
              {text.firing}:{" "}
              {evenFire
                ? `${intervals[0]}° ${text.equal}`
                : `${intervals.join("–")}°`}
            </p>
          </section>
        </div>
        <aside className={styles.controlColumn}>
          <section className={styles.panel}>
            <div className={styles.selectGrid}>
              <label>
                {text.category}
                <select
                  aria-label={text.category}
                  value={category}
                  onChange={(event) => {
                    const next =
                      engineGroups.find(
                        (item) => item.id === event.target.value,
                      ) ?? engineGroups[0];
                    setCategory(next.id);
                    selectEngine(
                      enginePresets.find(next.filter) ?? defaultEngine,
                    );
                  }}
                >
                  {engineGroups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text.engine}
                <select
                  aria-label={text.engine}
                  value={engineId}
                  onChange={(event) => {
                    const next = enginePresets.find(
                      (item) => item.id === event.target.value,
                    );
                    if (next) selectEngine(next);
                  }}
                >
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {engineDisplayName(item, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.engineIdentity}>
              <p>
                {engine.n} {text.cylinders} ·{" "}
                {engine.lay === "I"
                  ? "Inline"
                  : engine.lay === "B"
                    ? "Boxer 180°"
                    : `V ${engine.va}°`}
              </p>
              <h2>{engineDisplayName(engine, locale)}</h2>
              <p>
                {text.redline} {engine.red.toLocaleString(locale)} {text.rpm}
              </p>
            </div>
            <div className={styles.dialRow}>
              <Tachometer
                label={text.rpm}
                locale={locale}
                redline={engine.red}
                rpm={display.rpm}
              />
              <div className={styles.powerColumn}>
                <span>
                  {display.phase === "run"
                    ? "ENGINE RUNNING"
                    : display.phase === "off"
                      ? "ENGINE OFF"
                      : "IGNITION"}
                </span>
                <button
                  className={styles.powerButton}
                  data-phase={display.phase}
                  id="engine-power"
                  onClick={() => {
                    void togglePower();
                  }}
                  type="button"
                >
                  <Power aria-hidden size={20} weight="bold" /> {powerText}
                </button>
                <p aria-live="polite" className={styles.audioStatus}>
                  {audioStatus}
                </p>
              </div>
            </div>
            <label className={styles.rangeLabel} htmlFor="engine-throttle">
              <span>
                {text.throttle}
                <small>{text.throttleHint}</small>
              </span>
              <strong>{throttle}%</strong>
            </label>
            <input
              className={styles.throttleRange}
              id="engine-throttle"
              type="range"
              min="0"
              max="100"
              value={throttle}
              onChange={(event) => {
                const next = Number(event.target.value);
                setThrottle(next);
                simulationRef.current.throttleCommand = next / 100;
              }}
              onPointerUp={releaseThrottle}
              onPointerCancel={releaseThrottle}
              onBlur={releaseThrottle}
            />
          </section>
          <section className={styles.panel}>
            <h2>{text.exhaust}</h2>
            <div className={styles.exhaustGrid}>
              {text.exhausts.map((label, index) => (
                <button
                  aria-pressed={exhaust === index}
                  key={label}
                  onClick={() => changeExhaust(index)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.optionRow}>
              <span>{text.force}</span>
              <button
                aria-pressed={forced}
                disabled={!engine.turbo && !engine.sc}
                onClick={() => changeForce(!forced)}
                type="button"
              >
                {forceName}
              </button>
            </div>
            <div className={styles.optionRow}>
              <label htmlFor="engine-volume">{text.volume}</label>
              <button
                aria-label={volume === 0 ? text.unmute : text.mute}
                onClick={() => changeVolume(volume === 0 ? previousVolume : 0)}
                type="button"
              >
                {volume === 0 ? (
                  <SpeakerSlash aria-hidden size={20} />
                ) : (
                  <SpeakerHigh aria-hidden size={20} />
                )}
              </button>
              <input
                id="engine-volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                onChange={(event) =>
                  changeVolume(Number(event.target.value) / 100)
                }
              />
              <strong>{Math.round(volume * 100)}%</strong>
            </div>
          </section>
        </aside>
      </div>
      <p className={styles.simFooter}>
        {text.guide}
        <br />
        {text.noApi}
      </p>
    </div>
  );
}
