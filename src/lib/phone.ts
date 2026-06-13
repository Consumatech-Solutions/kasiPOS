/** Strip non-digits from a phone input for API payloads. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

export {
  PHONE_COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  getPhoneCountry,
  digitsOnly,
  normalizeLocalNumber,
  formatE164,
  validateLocalNumber,
  isSouthAfrica,
  type PhoneCountry,
  type ValidateLocalNumberResult,
} from "./phone-countries";
