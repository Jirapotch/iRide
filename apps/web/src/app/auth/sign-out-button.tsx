import { signOut } from "./actions";

export function SignOutButton({ label }: Readonly<{ label: string }>) {
  return (
    <form action={signOut}>
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground/75 transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}
