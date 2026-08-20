import Link from "next/link";
import { CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() { return <main className="grid min-h-screen place-items-center px-4 text-center"><div><CarFront className="mx-auto mb-5 size-12 text-primary" /><p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p><h1 className="mt-2 text-3xl font-bold">This road ends here.</h1><p className="mt-3 text-muted-foreground">The page you are looking for has moved or never existed.</p><Button asChild className="mt-6"><Link href="/th">Back to iRide</Link></Button></div></main>; }
