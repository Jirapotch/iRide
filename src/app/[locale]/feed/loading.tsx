import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() { return <><AppHeader locale="th" /><main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">{[1,2].map((item) => <Card key={item}><CardContent className="space-y-4 p-5"><div className="flex gap-3"><Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div></div><Skeleton className="h-16 w-full" /><Skeleton className="aspect-[4/3] w-full" /></CardContent></Card>)}</main></>; }
