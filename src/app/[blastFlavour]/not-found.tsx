import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold">Unknown BLAST flavour</h1>
      <p className="text-muted-foreground">
        That BLAST flavour does not exist. Pick one from the home page.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
