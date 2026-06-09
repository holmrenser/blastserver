"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useThemeStore } from "@/lib/stores/theme";
import { QueueStatus } from "./queuestatus";
import { ALLOWED_FLAVOURS } from "./[blastFlavour]/parameters";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Nav() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  // Avoid a hydration mismatch on the theme control: the persisted theme is
  // only known on the client. Page colors are already correct pre-paint via the
  // anti-FOUC script in the root layout.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <nav
        className="mx-auto flex h-14 max-w-(--breakpoint-2xl) flex-wrap items-center gap-2 px-4"
        aria-label="main navigation"
      >
        <Button asChild variant="ghost" className="text-base font-bold">
          <Link href="/">BLAST</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">Flavours</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {ALLOWED_FLAVOURS.map((flavour) => (
                <DropdownMenuItem key={flavour} asChild>
                  <Link href={`/${flavour}`} prefetch>
                    {flavour}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {isDark ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            <Switch
              id="theme-switch"
              checked={isDark}
              onCheckedChange={toggleTheme}
              aria-label="Toggle theme"
            />
            <Label htmlFor="theme-switch" className="cursor-pointer">
              {isDark ? "Dark" : "Light"}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Queue</span>
            <QueueStatus />
          </div>
        </div>
      </nav>
    </header>
  );
}
