export const locales = ["th", "en"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export function defaultPathForLocale(locale: Locale): string {
  return `/${locale}/account`;
}
