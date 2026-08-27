export function BrandMark({ className = "" }: { readonly className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-baseline text-xl font-black italic tracking-[-0.08em] ${className}`}>
      <span className="mr-0.5 text-primary">i</span>RIDE
    </span>
  );
}
