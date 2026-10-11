import { Button, Tag } from "antd";
import Image from "next/image";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata = { title: "Knowledge" };
export default async function KnowledgePage() {
  const th = (await getRequestLocale()) === "th";
  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">02 / UNDER THE HOOD</p>
          <h1>
            {th ? "รู้จักสิ่งที่ขับเคลื่อนคุณ" : "Explore what drives you."}
          </h1>
          <p>
            {th
              ? "เรียนรู้กลไกผ่านภาพ เสียง และการทดลองด้วยตัวเอง"
              : "Learn the mechanics through sight, sound and hands-on experiments."}
          </p>
        </div>
        <Tag color="gold">KNOWLEDGE LAB</Tag>
      </div>
      <section className="catalog-grid">
        <div className="feature-art">
          <Image
            src="/home/engine-cutaway.svg"
            alt={th ? "ภาพตัดเครื่องยนต์" : "Engine cutaway"}
            fill
            priority
            sizes="(max-width:760px) 100vw, 60vw"
          />
        </div>
        <div className="feature-copy">
          <p className="eyebrow">INTERACTIVE / 3D EXPERIENCE</p>
          <h2>Engine Simulator</h2>
          <p>
            {th
              ? "สำรวจเครื่องยนต์ 35 แบบ มองเห็นจังหวะการจุดระเบิด บิดกุญแจ แล้วฟังเสียงเครื่องตามรอบที่คุณควบคุม"
              : "Explore 35 engines, see their firing cycles, turn the key and hear the RPM you control."}
          </p>
          <div className="feature-tags">
            <span>35 ENGINE PROFILES</span>
            <span>3D CUTAWAY</span>
            <span>LIVE AUDIO</span>
          </div>
          <Button
            type="primary"
            size="large"
            href="/knowledge/engine-simulator"
          >
            {th ? "เปิด Engine Simulator" : "Launch engine simulator"} ↗
          </Button>
        </div>
      </section>
    </main>
  );
}
