"use client";

import React, {
  useCallback,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Called when all digits are filled (e.g. auto-submit). */
  onComplete?: (code: string) => void;
};

export function OtpInput({
  value,
  onChange,
  disabled,
  className,
  onComplete,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(OTP_LENGTH, " ").slice(0, OTP_LENGTH).split("");

  const updateValue = useCallback(
    (next: string) => {
      const cleaned = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
      onChange(cleaned);
      if (cleaned.length === OTP_LENGTH) {
        onComplete?.(cleaned);
      }
    },
    [onChange, onComplete]
  );

  const focusIndex = (index: number) => {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  };

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    const arr = digits.map((d) => (d === " " ? "" : d));
    arr[index] = digit;
    updateValue(arr.join(""));

    if (index < OTP_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    const current = digits[index] === " " ? "" : digits[index];

    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = digits.map((d) => (d === " " ? "" : d));
      if (current) {
        arr[index] = "";
        updateValue(arr.join(""));
      } else if (index > 0) {
        arr[index - 1] = "";
        updateValue(arr.join(""));
        focusIndex(index - 1);
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (pasted) {
      updateValue(pasted);
      focusIndex(Math.min(pasted.length, OTP_LENGTH - 1));
    }
  };

  return (
    <div
      className={cn("flex justify-center gap-2", className)}
      role="group"
      aria-label="Verification code"
    >
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digits[index] === " " ? "" : digits[index]}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          className={cn(
            "h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 touch-target sm:h-11 sm:w-11"
          )}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

export { OTP_LENGTH };
