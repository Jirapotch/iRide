"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Segmented } from "antd";
import { ArrowUpRight, Car, Cube, GameController } from "@phosphor-icons/react";
import type { Locale } from "@/lib/locale";
import type { Station } from "./scene";
import styles from "./hub.module.css";
export function GarageHub({ locale }: { locale: Locale }) {
  const host = useRef<HTMLDivElement>(null),
    router = useRouter();
  const [active, setActive] = useState<Station | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let dispose: (() => void) | undefined,
      cancelled = false;
    import("./scene")
      .then(({ mountHub }) => {
        if (cancelled || !host.current) return;
        try {
          dispose = mountHub(
            host.current,
            (s) => router.push("/" + s),
            setActive,
          );
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [router]);
  const th = locale === "th";
  const stations = [
    {
      id: "garage" as const,
      index: "01",
      title: "Garage",
      body: th
        ? "รถของคุณ และทุกครั้งที่ดูแล"
        : "Your rides. Every service, remembered.",
      icon: <Car size={24} />,
    },
    {
      id: "knowledge" as const,
      index: "02",
      title: "Knowledge",
      body: th
        ? "เปิดเครื่อง แล้วเรียนรู้ข้างใน"
        : "Get under the hood. Explore the engine.",
      icon: <Cube size={24} />,
    },
    {
      id: "games" as const,
      index: "03",
      title: "Games",
      body: th
        ? "พักสักนิด แล้วออกไปขับ"
        : "Take a break. Hit the endless road.",
      icon: <GameController size={24} />,
    },
  ];
  return (
    <main className={styles.hub}>
      <header className={styles.header}>
        <Link href="/" className="brand">
          <span className="brand-dot" />i<span>RIDE</span>
        </Link>
        <span className={styles.headerLabel}>A SPACE FOR YOUR RIDES</span>
        <Segmented
          size="small"
          value={locale}
          options={["th", "en"]}
          onChange={(value) => {
            document.cookie =
              "iride-locale=" +
              value +
              "; Path=/; Max-Age=31536000; SameSite=Lax";
            router.refresh();
          }}
        />
      </header>
      <div
        ref={host}
        className={styles.scene}
        aria-label={
          th
            ? "ฉากโรงรถ 3D เลือกโมเดลเพื่อเปิดหมวด"
            : "Interactive 3D garage. Select a model to open a section."
        }
      />
      <div className={styles.intro}>
        <p className="eyebrow">YOUR GARAGE. YOUR WORLD.</p>
        <h1>
          {th ? (
            <>
              พื้นที่ของคุณ
              <br />
              <span>ทุกเรื่องของรถ.</span>
            </>
          ) : (
            <>
              Your ride.
              <br />
              <span>Your world.</span>
            </>
          )}
        </h1>
        <p className={styles.description}>
          {th
            ? "ดูแลรถ เรียนรู้เครื่องยนต์ และสนุกกับการขับ"
            : "Care for your ride. Explore what drives it. Enjoy the journey."}
        </p>
      </div>
      <div className={styles.sceneHint}>
        <span className={styles.liveDot} />
        {failed
          ? th
            ? "เลือกหมวดด้านล่างเพื่อเริ่มต้น"
            : "Choose a section below"
          : th
            ? "คลิกโมเดลเพื่อสำรวจ · ลากเพื่อหมุน"
            : "SELECT A MODEL · DRAG TO EXPLORE"}
      </div>
      <nav
        className={styles.stations}
        aria-label={th ? "เลือกหมวด" : "Choose a section"}
      >
        {stations.map((s) => (
          <Button
            href={"/" + s.id}
            key={s.id}
            className={styles.station ?? ""}
            style={{
              display: "block",
              height: "auto",
              textAlign: "left",
              whiteSpace: "normal",
              padding: "var(--station-padding)",
            }}
            data-active={active === s.id}
            onMouseEnter={() => setActive(s.id)}
            onMouseLeave={() => setActive(null)}
          >
            <div className={styles.stationTop}>
              <span>{s.index} /</span>
              {s.icon}
              <ArrowUpRight size={19} />
            </div>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
            <span className={styles.stationLine} />
          </Button>
        ))}
      </nav>
      <footer className={styles.footer}>
        <nav
          className={styles.policyLinks}
          aria-label={th ? "ข้อมูลการใช้งาน" : "Data practices"}
        >
          <Link href="/privacy">{th ? "ข้อมูลส่วนบุคคล" : "Privacy"}</Link>
          <Link href="/terms">{th ? "เงื่อนไข" : "Terms"}</Link>
        </nav>
        <Button type="text" size="small" href="/garage">
          {th ? "เปิด Garage" : "Open garage"} <ArrowUpRight size={14} />
        </Button>
        <span>BUILT FOR THE LOVE OF RIDING</span>
      </footer>
    </main>
  );
}
