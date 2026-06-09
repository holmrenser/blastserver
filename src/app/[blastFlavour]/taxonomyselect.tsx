"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Check, ChevronsUpDown, X } from "lucide-react";

import type { BlastParameters } from "./parameters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TaxonomyEntry = { id: string; name: string };
type Option = { value: string; label: string };

async function fetchTaxonomy(query: string): Promise<Option[]> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const url = `${basePath}/api/taxonomy?` + new URLSearchParams({ query });
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  const entries: TaxonomyEntry[] = data.taxonomyEntries ?? [];
  return entries.map(({ id, name }) => ({
    value: id,
    label: `${name} (taxid: ${id})`,
  }));
}

function TaxonomyCombobox({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  // Remember labels for selected ids so badges stay readable across searches.
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!search) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const opts = await fetchTaxonomy(search);
      setOptions(opts);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  function toggle(opt: Option) {
    if (value.includes(opt.value)) {
      onChange(value.filter((v) => v !== opt.value));
    } else {
      setLabels((prev) => ({ ...prev, [opt.value]: opt.label }));
      onChange([...value, opt.value]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full max-w-[320px] justify-between font-normal"
          >
            <span className="truncate">
              {value.length > 0
                ? `${value.length} selected`
                : "Enter taxonomic name or taxid"}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search taxonomy..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading && (
                <div className="py-3 text-center text-sm text-muted-foreground">
                  Searching…
                </div>
              )}
              {!loading && !search && (
                <div className="py-3 text-center text-sm text-muted-foreground">
                  Start typing to see suggestions
                </div>
              )}
              {!loading && search && options.length === 0 && (
                <CommandEmpty>No results found</CommandEmpty>
              )}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => toggle(opt)}
                    >
                      <Check
                        className={cn(
                          value.includes(opt.value)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              <span className="max-w-[240px] truncate">{labels[v] ?? v}</span>
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${labels[v] ?? v}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaxonomySelect({
  control,
}: {
  control: Control<BlastParameters, any, unknown>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={control}
        name="taxids"
        render={({ field: { value, onChange } }) => (
          <TaxonomyCombobox
            value={(value as string[]) ?? []}
            onChange={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="excludeTaxids"
        render={({ field: { value, onChange, ref } }) => (
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              ref={ref}
              checked={Boolean(value)}
              onCheckedChange={onChange}
            />
            Exclude taxids
          </Label>
        )}
      />
    </div>
  );
}
