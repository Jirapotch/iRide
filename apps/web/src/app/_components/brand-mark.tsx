export function BrandMark({ className = "" }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/45 ${className}`}
    >
      <span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_var(--primary)]" />
      <span className="absolute inset-[5px] rounded-full border border-foreground/20" />
    </span>
  );
}
