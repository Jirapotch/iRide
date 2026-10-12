import Link from "next/link";
import type { Locale } from "@/lib/locale";

export function SiteNotice({
  kind,
  locale,
}: {
  kind: "privacy" | "terms";
  locale: Locale;
}) {
  const th = locale === "th";
  const privacy = kind === "privacy";
  const sections = privacy
    ? [
        [
          th ? "ข้อมูลที่เก็บ" : "Data stored",
          th
            ? "iRide เก็บข้อมูลรถ เลขไมล์ ประวัติ service ค่าใช้จ่าย และ metadata รูปใน Supabase ไฟล์รูปที่อัปโหลดเก็บใน Google Drive ของเจ้าของเว็บ"
            : "iRide stores vehicle details, mileage, service history, costs and photo metadata in Supabase. Uploaded photo files are stored in the site owner's Google Drive.",
        ],
        [
          th ? "การเข้าถึงข้อมูล" : "Who can access data",
          th
            ? "เว็บไม่มี login ทุกคนที่เข้าถึงเว็บสามารถดู เพิ่ม แก้ไข และลบข้อมูล Garage รวมถึงดูและลบรูปได้ สิทธิ์แชร์ไฟล์และโฟลเดอร์บน Drive ยังคงเป็นส่วนตัว เว็บแสดงรูปผ่าน backend ที่ตรวจความสัมพันธ์กับรถ"
            : "There is no login. Anyone with access to this website can view, add, edit and delete Garage records, and view or delete photos. Drive files and folders retain private sharing permissions; the backend serves photos after checking their relationship to a vehicle.",
        ],
        [
          th ? "การเชื่อม Google Drive" : "Google Drive access",
          th
            ? "เจ้าของเชื่อม Google เพียงครั้งแรกผ่านเครื่องมือตั้งค่า local ด้วยสิทธิ์ drive.file และเลือกโฟลเดอร์ iRide image แอปใช้สิทธิ์นี้เพื่อเก็บ อ่าน และย้ายรูปที่แอปสร้างไปถังขยะ โดยใช้ subfolder ตาม UUID ของรถ ไม่ล้างไฟล์เดิมหรือเปลี่ยนสิทธิ์แชร์ของโฟลเดอร์ ผู้ใช้เว็บไม่ต้องเชื่อมบัญชี Google"
            : "The owner connects Google through a local setup tool using drive.file and selects the iRide image folder. The app stores, reads and trashes its own photos in vehicle UUID subfolders. It does not clear pre-existing files or change folder sharing. Website visitors do not connect their own Google accounts.",
        ],
        [
          th ? "การใช้และเก็บรักษาข้อมูล" : "Use and retention",
          th
            ? "ข้อมูลใช้สำหรับแสดงและจัดการ Garage เท่านั้น แอปไม่มีการขายข้อมูล Google หรือใช้ข้อมูล Google เพื่อโฆษณาหรือฝึกโมเดล AI Credentials อยู่ฝั่งเซิร์ฟเวอร์ ข้อมูลคงอยู่จนถูกลบ รูปถูกย้ายไปถังขยะ Drive ก่อนลบ metadata และอาจยังอยู่ในถังขยะหรือสำเนาสำรองตามการตั้งค่าของเจ้าของและผู้ให้บริการ"
            : "Data is used to display and manage the Garage. The app does not sell Google data or use it for advertising or AI training. Credentials remain on the server. Records remain until deleted. Photos are trashed in Drive before metadata is removed, and may remain in Trash or backups according to the owner's and providers' settings.",
        ],
        [
          th ? "การลบและเพิกถอนสิทธิ์" : "Deletion and revocation",
          th
            ? "ลบรถ service และรูปผ่านหน้า Garage ได้ เจ้าของสามารถเพิกถอนสิทธิ์ iRide ผ่านการตั้งค่าบัญชี Google ซึ่งจะหยุดการเข้าถึง Drive ในอนาคตแต่ไม่ลบข้อมูลที่เก็บไว้แล้ว แอปใช้ข้อมูลจาก Google ตาม Google API Services User Data Policy รวมถึง Limited Use"
            : "Vehicles, services and photos can be deleted in Garage. The owner can revoke iRide access in Google Account settings; this stops future Drive access without deleting previously stored data. Google data is used in accordance with the Google API Services User Data Policy, including Limited Use.",
        ],
      ]
    : [
        [
          th ? "วัตถุประสงค์" : "Purpose",
          th
            ? "iRide เป็นพื้นที่บันทึกการดูแลรถส่วนตัว พร้อม Engine Simulator และ Traffic Endless Ride เพื่อการเรียนรู้และความบันเทิง"
            : "iRide is a personal vehicle maintenance journal with Engine Simulator and Traffic Endless Ride for learning and entertainment.",
        ],
        [
          th ? "การใช้งาน Garage ร่วมกัน" : "Shared Garage access",
          th
            ? "Garage ไม่มีบัญชีผู้ใช้หรือการแยกข้อมูลตามเจ้าของ ทุกคนที่เข้าถึงเว็บสามารถเปลี่ยนหรือลบข้อมูลได้ เพิ่มเฉพาะข้อมูลและรูปที่คุณมีสิทธิ์ใช้และต้องการให้ผู้ที่เข้าถึงเว็บเห็น"
            : "Garage has no user accounts or per-owner data isolation. Anyone who can access the website can change or delete records. Add only information and photos you are entitled to use and intend to make visible to people accessing the website.",
        ],
        [
          th ? "การจัดการรูป" : "Photo management",
          th
            ? "อัปโหลด JPEG, PNG หรือ WebP ขนาดไม่เกิน 4 MB ต่อไฟล์ รูปต้องเชื่อมกับรถใน Garage การลบรูปหรือรถจะจัดการไฟล์ที่แอปสร้างบน Drive ก่อนลบข้อมูลที่เกี่ยวข้อง"
            : "Upload JPEG, PNG or WebP files up to 4 MB each. Photos belong to a Garage vehicle. Deleting a photo or vehicle handles the app-created Drive files before removing the associated records.",
        ],
      ];
  return (
    <main className="page-wrap" style={{ maxWidth: 880 }}>
      <p className="eyebrow">iRIDE / {privacy ? "PRIVACY" : "USAGE"}</p>
      <h1>
        {privacy
          ? th
            ? "ข้อมูลส่วนบุคคลและ Google Drive"
            : "Privacy and Google Drive"
          : th
            ? "เงื่อนไขการใช้งาน"
            : "Terms of use"}
      </h1>
      {sections.map(([title, body]) => (
        <section key={title} style={{ marginBlock: 28 }}>
          <h2 style={{ fontSize: 20 }}>{title}</h2>
          <p style={{ lineHeight: 1.8, color: "#b5b5bc" }}>{body}</p>
        </section>
      ))}
      <p>
        {th ? "ติดต่อเจ้าของเว็บ:" : "Contact the site owner:"}{" "}
        <a href="https://github.com/Jirapotch/iRide">iRide on GitHub</a>
      </p>
      <p>
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
      </p>
      <Link href={privacy ? "/terms" : "/privacy"}>
        {privacy
          ? th
            ? "เงื่อนไขการใช้งาน"
            : "Terms of use"
          : th
            ? "ข้อมูลส่วนบุคคล"
            : "Privacy"}
      </Link>
    </main>
  );
}
