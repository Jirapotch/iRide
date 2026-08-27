import Link from "next/link";
import { redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { safeNextPath } from "@/lib/auth-redirect";
import { getRequestLocale } from "@/lib/request-locale";

import { StandaloneShell } from "../_components/standalone-shell";
import { signInWithGoogle } from "../auth/actions";
import { AuthSubmitButton } from "../auth/submit-button";
import { LanguageSwitcher } from "../language-switcher";

const copy = {
  th: {
    eyebrow: "บัญชี iRide",
    title: "เข้าสู่ระบบ",
    description: "ใช้บัญชี Google เพื่อเข้าสู่ชุมชน iRide อย่างปลอดภัย",
    button: "ดำเนินการต่อด้วย Google",
    pending: "กำลังเปิด Google…",
    providerError: "ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่อีกครั้ง",
    invalidRequest: "คำขอเข้าสู่ระบบไม่ถูกต้อง กรุณาเริ่มใหม่",
    signedOut: "ออกจากระบบเรียบร้อยแล้ว",
    back: "กลับหน้าหลัก",
  },
  en: {
    eyebrow: "iRide account",
    title: "Sign in",
    description:
      "Use your Google account to securely join the iRide community.",
    button: "Continue with Google",
    pending: "Opening Google…",
    providerError: "Google sign-in is unavailable. Please try again.",
    invalidRequest: "The sign-in request is invalid. Please start again.",
    signedOut: "You have signed out.",
    back: "Back to home",
  },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    error?: string;
    next?: string;
    signed_out?: string;
  }>;
}) {
  const [locale, query, session] = await Promise.all([
    getRequestLocale(),
    searchParams,
    getVerifiedWebSession(),
  ]);
  const next = safeNextPath(query.next);
  if (session) {
    redirect(next);
  }

  const text = copy[locale];
  const status =
    query.signed_out === "1"
      ? text.signedOut
      : query.error === "provider"
        ? text.providerError
        : query.error
          ? text.invalidRequest
          : null;
  const returnToParams = new URLSearchParams();
  if (query.next) returnToParams.set("next", next);
  if (query.error) returnToParams.set("error", query.error);
  if (query.signed_out) returnToParams.set("signed_out", query.signed_out);
  const returnTo = returnToParams.size
    ? `/login?${returnToParams.toString()}`
    : "/login";

  return (
    <StandaloneShell locale={locale}>
      <div className="space-y-7">
        <div className="space-y-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="text-4xl font-black tracking-[-0.05em]">
            {text.title}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {text.description}
          </p>
        </div>

        {status ? (
          <p
            className="rounded-2xl border border-border bg-muted px-4 py-3 text-center text-sm text-muted-foreground"
            role="status"
          >
            {status}
          </p>
        ) : null}

        <form action={signInWithGoogle}>
          <input name="next" type="hidden" value={next} />
          <AuthSubmitButton
            idleLabel={text.button}
            pendingLabel={text.pending}
          />
        </form>

        <div className="flex flex-col items-center gap-4">
          <LanguageSwitcher locale={locale} returnTo={returnTo} />
          <Link
            className="rounded-full px-3 py-2 text-center text-sm text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            {text.back}
          </Link>
        </div>
      </div>
    </StandaloneShell>
  );
}
