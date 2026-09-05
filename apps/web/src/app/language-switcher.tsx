import { Button } from "antd";

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
      <Button htmlType="submit" size="large">
        {locale === "th" ? "English" : "ภาษาไทย"}
      </Button>
    </form>
  );
}
