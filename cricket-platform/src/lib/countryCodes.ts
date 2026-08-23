export interface CountryDialCode {
  code: string // ISO 3166-1 alpha-2
  name: string
  dialCode: string
}

/** Not exhaustive (no claim to cover all ~195 countries) — a broad, practical set covering
 *  major cricket-playing nations first (this is a cricket platform) plus other common
 *  countries, so the dropdown is useful without being unwieldy. */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { code: 'IN', name: 'India', dialCode: '+91' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94' },
  { code: 'AU', name: 'Australia', dialCode: '+61' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64' },
  { code: 'AF', name: 'Afghanistan', dialCode: '+93' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { code: 'US', name: 'United States', dialCode: '+1' },
  { code: 'CA', name: 'Canada', dialCode: '+1' },
  { code: 'IE', name: 'Ireland', dialCode: '+353' },
  { code: 'NP', name: 'Nepal', dialCode: '+977' },
  { code: 'SG', name: 'Singapore', dialCode: '+65' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60' },
  { code: 'KE', name: 'Kenya', dialCode: '+254' },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1876' },
  { code: 'TT', name: 'Trinidad and Tobago', dialCode: '+1868' },
  { code: 'DE', name: 'Germany', dialCode: '+49' },
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'ES', name: 'Spain', dialCode: '+34' },
  { code: 'IT', name: 'Italy', dialCode: '+39' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
  { code: 'QA', name: 'Qatar', dialCode: '+974' },
  { code: 'OM', name: 'Oman', dialCode: '+968' },
  { code: 'JP', name: 'Japan', dialCode: '+81' },
  { code: 'CN', name: 'China', dialCode: '+86' },
  { code: 'BR', name: 'Brazil', dialCode: '+55' },
]

export const DEFAULT_DIAL_CODE = '+91'

/** Splits a stored E.164-ish phone number back into a dial code + national number, for
 *  pre-filling the two-part editor. Longest matching dial code wins (so e.g. "+1876..."
 *  matches Jamaica's +1876 rather than the US's +1). Falls back to the default dial code
 *  with the raw value as the national part if nothing matches. */
export function splitPhoneNumber(value: string): { dialCode: string; national: string } {
  if (!value) return { dialCode: DEFAULT_DIAL_CODE, national: '' }
  const match = [...COUNTRY_DIAL_CODES]
    .filter((c) => value.startsWith(c.dialCode))
    .sort((a, b) => b.dialCode.length - a.dialCode.length)[0]
  if (!match) return { dialCode: DEFAULT_DIAL_CODE, national: value }
  return { dialCode: match.dialCode, national: value.slice(match.dialCode.length).trim() }
}
