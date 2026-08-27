export const locales = ["th", "en"] as const;
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE_NAME = "iride-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  return isLocale(cookieValue ?? "")
    ? (cookieValue as Locale)
    : localeFromAcceptLanguage(acceptLanguage);
}

export function localeFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const preferences = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [language = "", ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;

      return {
        index,
        language: language.toLowerCase(),
        quality:
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
      };
    })
    .filter(({ quality }) => quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const { language } of preferences) {
    const baseLanguage = language.split("-")[0] ?? "";
    if (isLocale(baseLanguage)) return baseLanguage;
  }

  return DEFAULT_LOCALE;
}
