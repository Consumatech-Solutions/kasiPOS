"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PHONE_COUNTRY,
  getPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from "@/lib/phone-countries";

export type PhoneNumberFieldValue = {
  countryIso: string;
  localNumber: string;
};

type PhoneNumberFieldProps = {
  value: PhoneNumberFieldValue;
  onChange: (value: PhoneNumberFieldValue) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function PhoneNumberField({
  value,
  onChange,
  disabled,
  id,
  className,
}: PhoneNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = getPhoneCountry(value.countryIso) ?? DEFAULT_PHONE_COUNTRY;

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [search]);

  const selectCountry = (country: PhoneCountry) => {
    onChange({ ...value, countryIso: country.iso });
    setOpen(false);
    setSearch("");
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="min-h-[44px] shrink-0 gap-1 px-2 touch-target"
            aria-label={`Country code, currently ${selected.name}`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {selected.flag}
            </span>
            <span className="text-sm font-medium">+{selected.dialCode}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-9"
            autoFocus
          />
          <ul className="max-h-60 overflow-y-auto" role="listbox">
            {filteredCountries.map((country) => (
              <li key={country.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={country.iso === selected.iso}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent",
                    country.iso === selected.iso && "bg-accent"
                  )}
                  onClick={() => selectCountry(country)}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {country.flag}
                  </span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="text-muted-foreground">
                    +{country.dialCode}
                  </span>
                </button>
              </li>
            ))}
            {filteredCountries.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No countries found
              </p>
            )}
          </ul>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={selected.placeholder ?? "Mobile number"}
        disabled={disabled}
        value={value.localNumber}
        onChange={(e) => onChange({ ...value, localNumber: e.target.value })}
        className="min-h-[44px] flex-1 touch-target"
      />
    </div>
  );
}
