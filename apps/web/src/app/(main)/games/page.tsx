import { Button, Tag } from "antd";
import Image from "next/image";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata = { title: "Games" };
export default async function GamesPage() {
  const th = (await getRequestLocale()) === "th";
  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">03 / A LITTLE DETOUR</p>
          <h1>{th ? "พักสักนิด แล้วออกไปขับ" : "Less traffic. More play."}</h1>
          <p>
            {th
              ? "เลือกพาหนะ หลบการจราจร และไปให้ไกลที่สุด"
              : "Choose a ride, weave through traffic and see how far you can go."}
          </p>
        </div>
        <Tag color="gold">iRIDE ARCADE</Tag>
      </div>
      <section className="catalog-grid">
        <div className="feature-art">
          <Image
            src="/home/game-road.png"
            alt={
              th ? "ถนนในเกม Traffic Endless Ride" : "Traffic Endless Ride road"
            }
            fill
            priority
            sizes="(max-width:760px) 100vw, 60vw"
          />
        </div>
        <div className="feature-copy">
          <p className="eyebrow">ENDLESS RUNNER / READY TO PLAY</p>
          <h2>Traffic Endless Ride</h2>
          <p>
            {th
              ? "รถยนต์ รถสปอร์ต มอเตอร์ไซค์ หรือจักรยาน การจราจรที่ท้าทายขึ้นเรื่อย ๆ และถนนที่ไม่มีวันสิ้นสุด"
              : "Sedan, sport, motorcycle or bicycle. Ever busier traffic, and a road with no end."}
          </p>
          <div className="feature-tags">
            <span>4 RIDES</span>
            <span>KEYBOARD / TOUCH</span>
            <span>NO ACCOUNT NEEDED</span>
          </div>
          <Button
            type="primary"
            size="large"
            href="/games/traffic-endless-ride"
          >
            {th ? "เริ่มเล่น" : "Play now"} ↗
          </Button>
          <p className="section-note">
            {th
              ? "ไม่บันทึกคะแนนหรือข้อมูลการเล่น"
              : "No score or gameplay data is saved."}
          </p>
        </div>
      </section>
    </main>
  );
}
