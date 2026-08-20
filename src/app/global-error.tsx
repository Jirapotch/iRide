"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html><body><main className="grid min-h-screen place-items-center px-4 text-center"><div><h1 className="text-3xl font-bold">The engine coughed.</h1><p className="mt-3 text-muted-foreground">Something went wrong. Give it another try.</p><Button className="mt-6" onClick={reset}>Try again</Button></div></main></body></html>; }
