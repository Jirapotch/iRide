import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { safeNextPath } from "@/lib/auth-redirect";
import { isLocale } from "@/lib/locale";

import { signInWithGoogle } from "../auth/actions";
import { AuthSubmitButton } from "../auth/submit-button";

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
    description: "Use your Google account to securely join the iRide community.",
    button: "Continue with Google",
    pending: "Opening Google…",
    providerError: "Google sign-in is unavailable. Please try again.",
    invalidRequest: "The sign-in request is invalid. Please start again.",
    signedOut: "You have signed out.",
    back: "Back to home",
  },
} as const;

export default async function LoginPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<{
    error?: string;
    next?: string;
    signed_out?: string;
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) {
    notFound();
  }

  const next = safeNextPath(query.next, locale);
  const session = await getVerifiedWebSession();
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

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-lg place-items-center px-5 py-12 sm:px-8">
      <section className="w-full space-y-7 rounded-3xl border bg-background p-6 shadow-xl shadow-primary/5 sm:p-9">
        <div className="space-y-3 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {text.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {text.description}
          </p>
        </div>

        {status ? (
          <p
            className="rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground"
            role="status"
          >
            {status}
          </p>
        ) : null}

        <form action={signInWithGoogle}>
          <input name="locale" type="hidden" value={locale} />
          <input name="next" type="hidden" value={next} />
          <AuthSubmitButton
            idleLabel={text.button}
            pendingLabel={text.pending}
          />
        </form>

        <Link
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          href={`/${locale}`}
        >
          {text.back}
        </Link>
      </section>
    </main>
  );
}
