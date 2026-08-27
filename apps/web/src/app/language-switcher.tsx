import { buttonVariants } from "@iride/ui/button";

import type { Locale } from "@/lib/locale";

import { setLocale } from "./locale-actions";

export function LanguageSwitcher({
  locale,
  returnTo,
}: {
  readonly locale: Locale;
  readonly returnTo: string;
}) {
  const alternateLocale = locale === "th" ? "en" : "th";

  return (
    <form action={setLocale}>
      <input name="locale" type="hidden" value={alternateLocale} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <button
        className={buttonVariants({
          variant: "outline",
          className: "h-10 px-4 text-xs tracking-[0.08em]",
        })}
        type="submit"
      >
        {locale === "th" ? "English" : "ภาษาไทย"}
      </button>
    </form>
  );
}
