import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">404 / LOST IN THE GARAGE</p>
      <h1>ไม่พบหน้านี้</h1>
      <Link href="/">กลับหน้าหลัก →</Link>
    </main>
  );
}
