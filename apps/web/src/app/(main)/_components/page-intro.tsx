export function PageIntro({
  description,
  eyebrow,
  title,
}: Readonly<{
  description: string;
  eyebrow: string;
  title: string;
}>) {
  return (
    <header className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-4xl font-black tracking-[-0.055em] sm:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
        {description}
      </p>
    </header>
  );
}
