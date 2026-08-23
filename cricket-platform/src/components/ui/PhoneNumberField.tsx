import { useState } from 'react'
import { Select, Input } from './primitives'
import { COUNTRY_DIAL_CODES, splitPhoneNumber, DEFAULT_DIAL_CODE } from '@/lib/countryCodes'

/**
 * A country dial-code dropdown + national-number input that together produce/consume a
 * single E.164-ish phone string (e.g. "+919876543210") — same external contract as a plain
 * text input, so it drops in wherever `value`/`onChange` phone state already exists.
 */
export function PhoneNumberField({
  value,
  onChange,
}: {
  value: string
  onChange: (phone: string) => void
}) {
  const initial = splitPhoneNumber(value)
  // Selected by country code (ISO alpha-2), not dial code — several countries share a dial
  // code (US and Canada both +1), so using the dial code as the <option> value would make
  // picking Canada silently redisplay as "United States" (whichever shares that value comes
  // first in the list).
  const [countryCode, setCountryCode] = useState(
    () => COUNTRY_DIAL_CODES.find((c) => c.dialCode === initial.dialCode)?.code ?? 'IN',
  )
  const [national, setNational] = useState(() => initial.national)

  function update(nextCountryCode: string, nextNational: string) {
    setCountryCode(nextCountryCode)
    setNational(nextNational)
    const dialCode =
      COUNTRY_DIAL_CODES.find((c) => c.code === nextCountryCode)?.dialCode ?? DEFAULT_DIAL_CODE
    const digits = nextNational.replace(/\D/g, '')
    onChange(digits ? `${dialCode}${digits}` : '')
  }

  return (
    <div className="flex gap-2">
      <Select
        value={countryCode}
        onChange={(e) => update(e.target.value, national)}
        className="w-24 shrink-0"
        aria-label="Country code"
      >
        {COUNTRY_DIAL_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.dialCode}
          </option>
        ))}
      </Select>
      <Input
        value={national}
        onChange={(e) => update(countryCode, e.target.value)}
        placeholder="9876543210"
        type="tel"
        className="min-w-0 flex-1"
      />
    </div>
  )
}
