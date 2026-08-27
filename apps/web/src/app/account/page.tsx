import { buttonVariants } from "@iride/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getRequestLocale } from "@/lib/request-locale";

import { signOut } from "../auth/actions";
import { LanguageSwitcher } from "../language-switcher";

const copy = {
  th: {
    eyebrow: "บัญชีของคุณ",
    title: "เข้าสู่ระบบแล้ว",
    description: "Web session และ API identity ผ่านการตรวจสอบเรียบร้อย",
    userId: "รหัสผู้ใช้",
    apiOk: "API ยืนยันตัวตนสำเร็จ",
    apiError: "API ยังไม่สามารถยืนยันตัวตนได้",
    home: "กลับหน้าหลัก",
    signOut: "ออกจากระบบ",
  },
  en: {
    eyebrow: "Your account",
    title: "You are signed in",
    description: "Your web session and API identity have been verified.",
    userId: "User ID",
    apiOk: "API authentication succeeded",
    apiError: "API authentication is currently unavailable",
    home: "Back to home",
    signOut: "Sign out",
  },
} as const;

export default async function AccountPage() {
  const [locale, session] = await Promise.all([
    getRequestLocale(),
    getVerifiedWebSession(),
  ]);
  if (!session) {
    redirect("/login?next=/account");
  }

  const apiUserId = await getApiUserId(session.accessToken);
  const text = copy[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-5 py-12 sm:px-8">
      <section className="w-full space-y-7 rounded-3xl border bg-background p-6 shadow-xl shadow-primary/5 sm:p-10">
        <div className="space-y-3">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
          <p className="text-muted-foreground">{text.description}</p>
        </div>

        <dl className="space-y-3 rounded-2xl bg-muted p-5 text-sm">
          <div className="space-y-1">
            <dt className="text-muted-foreground">{text.userId}</dt>
            <dd className="break-all font-mono">{session.userId}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">API</dt>
            <dd>{apiUserId === session.userId ? text.apiOk : text.apiError}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/"
          >
            {text.home}
          </Link>
          <LanguageSwitcher locale={locale} returnTo="/account" />
          <form action={signOut} className="sm:ml-auto">
            <button
              className={buttonVariants({ variant: "default" })}
              type="submit"
            >
              {text.signOut}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

async function getApiUserId(accessToken: string): Promise<string | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://localhost:3001";

  try {
    const response = await fetch(new URL("/api/v1/auth/me", apiUrl), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "data" in body &&
      typeof body.data === "object" &&
      body.data !== null &&
      "userId" in body.data &&
      typeof body.data.userId === "string"
    ) {
      return body.data.userId;
    }
  } catch {
    return null;
  }

  return null;
}
