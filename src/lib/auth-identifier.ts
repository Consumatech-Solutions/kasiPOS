import * as z from "zod";
import { normalizePhone } from "@/lib/phone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_INPUT_REGEX = /^[\d\s\-+()]+$/;

export type IdentifierType = "email" | "phone";

export function detectIdentifierType(value: string): IdentifierType | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@") || EMAIL_REGEX.test(trimmed)) return "email";
  if (PHONE_INPUT_REGEX.test(trimmed)) return "phone";
  return null;
}

export function refineIdentifierField(
  identifier: string,
  ctx: z.RefinementCtx,
  path: string[] = ["identifier"]
) {
  const trimmed = identifier.trim();
  const type = detectIdentifierType(trimmed);

  if (!type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid email address or mobile number.",
      path,
    });
    return null;
  }

  if (type === "email" && !z.string().email().safeParse(trimmed).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter a valid email address.",
      path,
    });
    return null;
  }

  if (type === "phone" && normalizePhone(trimmed).length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter a valid mobile number (at least 10 digits).",
      path,
    });
    return null;
  }

  return type;
}

export function parseAuthIdentifier(identifier: string): {
  type: IdentifierType;
  email?: string;
  phone?: string;
} {
  const trimmed = identifier.trim();
  const type = detectIdentifierType(trimmed);

  if (type === "email") {
    return { type, email: trimmed };
  }

  if (type === "phone") {
    return { type, phone: normalizePhone(trimmed) };
  }

  throw new Error("Invalid identifier");
}

export const authIdentifierSchema = z
  .object({
    identifier: z
      .string()
      .min(1, { message: "Enter your email or mobile number." }),
  })
  .superRefine((data, ctx) => {
    refineIdentifierField(data.identifier, ctx);
  });
