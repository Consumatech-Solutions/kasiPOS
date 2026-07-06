export type PhoneCountry = {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
  /** Expected local digit count after stripping leading 0 (optional override). */
  localLength?: number;
  placeholder?: string;
};

/** Curated African countries; South Africa first (default). */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  {
    iso: "ZA",
    name: "South Africa",
    dialCode: "27",
    flag: "🇿🇦",
    localLength: 9,
    placeholder: "812345678",
  },
  {
    iso: "CD",
    name: "DR Congo",
    dialCode: "243",
    flag: "🇨🇩",
    localLength: 9,
    placeholder: "812345678",
  },
  {
    iso: "BW",
    name: "Botswana",
    dialCode: "267",
    flag: "🇧🇼",
    placeholder: "71234567",
  },
  {
    iso: "ZW",
    name: "Zimbabwe",
    dialCode: "263",
    flag: "🇿🇼",
    placeholder: "771234567",
  },
  {
    iso: "MZ",
    name: "Mozambique",
    dialCode: "258",
    flag: "🇲🇿",
    placeholder: "841234567",
  },
  {
    iso: "NA",
    name: "Namibia",
    dialCode: "264",
    flag: "🇳🇦",
    placeholder: "811234567",
  },
  {
    iso: "ZM",
    name: "Zambia",
    dialCode: "260",
    flag: "🇿🇲",
    placeholder: "971234567",
  },
  {
    iso: "MW",
    name: "Malawi",
    dialCode: "265",
    flag: "🇲🇼",
    placeholder: "991234567",
  },
  {
    iso: "AO",
    name: "Angola",
    dialCode: "244",
    flag: "🇦🇴",
    placeholder: "923456789",
  },
  {
    iso: "LS",
    name: "Lesotho",
    dialCode: "266",
    flag: "🇱🇸",
    placeholder: "50123456",
  },
  {
    iso: "SZ",
    name: "Eswatini",
    dialCode: "268",
    flag: "🇸🇿",
    placeholder: "76123456",
  },
  {
    iso: "KE",
    name: "Kenya",
    dialCode: "254",
    flag: "🇰🇪",
    placeholder: "712345678",
  },
  {
    iso: "NG",
    name: "Nigeria",
    dialCode: "234",
    flag: "🇳🇬",
    placeholder: "8012345678",
  },
  {
    iso: "GH",
    name: "Ghana",
    dialCode: "233",
    flag: "🇬🇭",
    placeholder: "241234567",
  },
  {
    iso: "UG",
    name: "Uganda",
    dialCode: "256",
    flag: "🇺🇬",
    placeholder: "712345678",
  },
  {
    iso: "TZ",
    name: "Tanzania",
    dialCode: "255",
    flag: "🇹🇿",
    placeholder: "712345678",
  },
  {
    iso: "RW",
    name: "Rwanda",
    dialCode: "250",
    flag: "🇷🇼",
    placeholder: "781234567",
  },
  {
    iso: "ET",
    name: "Ethiopia",
    dialCode: "251",
    flag: "🇪🇹",
    placeholder: "911234567",
  },
  {
    iso: "CM",
    name: "Cameroon",
    dialCode: "237",
    flag: "🇨🇲",
    placeholder: "671234567",
  },
  {
    iso: "CI",
    name: "Côte d'Ivoire",
    dialCode: "225",
    flag: "🇨🇮",
    placeholder: "0712345678",
  },
  {
    iso: "SN",
    name: "Senegal",
    dialCode: "221",
    flag: "🇸🇳",
    placeholder: "771234567",
  },
  {
    iso: "EG",
    name: "Egypt",
    dialCode: "20",
    flag: "🇪🇬",
    placeholder: "1012345678",
  },
  {
    iso: "MA",
    name: "Morocco",
    dialCode: "212",
    flag: "🇲🇦",
    placeholder: "612345678",
  },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function getPhoneCountry(iso: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.iso === iso);
}

/** Strip non-digits from a phone input. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** Normalize local number: strip leading 0 for countries that use trunk prefix. */
export function normalizeLocalNumber(iso: string, localNumber: string): string {
  let digits = digitsOnly(localNumber);
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/** Build E.164 digits-only international number (no + prefix). */
export function formatE164(
  dialCode: string,
  localNumber: string,
  iso?: string
): string {
  const local = iso
    ? normalizeLocalNumber(iso, localNumber)
    : digitsOnly(localNumber);
  return `${digitsOnly(dialCode)}${local}`;
}

export type ValidateLocalNumberResult =
  | { valid: true; normalized: string }
  | { valid: false; message: string };

export function validateLocalNumber(
  iso: string,
  localNumber: string
): ValidateLocalNumberResult {
  const country = getPhoneCountry(iso);
  const normalized = normalizeLocalNumber(iso, localNumber);

  if (!normalized) {
    return { valid: false, message: "Mobile number is required." };
  }

  const minLen = country?.localLength ?? 7;
  const maxLen = country?.localLength ?? 12;

  if (normalized.length < minLen) {
    return {
      valid: false,
      message: `Please enter at least ${minLen} digits.`,
    };
  }

  if (normalized.length > maxLen) {
    return {
      valid: false,
      message: `Please enter at most ${maxLen} digits.`,
    };
  }

  return { valid: true, normalized };
}

export function isSouthAfrica(iso: string): boolean {
  return iso.toUpperCase() === "ZA";
}
