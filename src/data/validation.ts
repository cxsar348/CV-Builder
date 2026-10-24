export function emailValidationError(value: string) {
  const email = value.trim()
  if (!email) return ''
  const parts = email.split('@')
  if (parts.length !== 2 || email.length > 254) return 'Enter an email address in the format name@example.com.'
  const [local, domain] = parts
  const labels = domain?.split('.') ?? []
  const validLocal = Boolean(local && local.length <= 64 && /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~.-]+$/u.test(local) && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..'))
  const validDomain = labels.length >= 2 && (labels.at(-1)?.length ?? 0) >= 2 && labels.every((label) => label.length > 0 && label.length <= 63 && /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label))
  return validLocal && validDomain ? '' : 'Enter an email address in the format name@example.com.'
}

export function phoneValidationError(value: string) {
  const phone = value.trim()
  if (!phone) return ''
  if (!/^\+?[\d\t ().-]+$/u.test(phone) || (phone.includes('+') && !phone.startsWith('+'))) return 'Use digits, an optional leading +, spaces, hyphens, or parentheses.'
  const openParentheses = [...phone].filter((character) => character === '(').length
  const closeParentheses = [...phone].filter((character) => character === ')').length
  if (openParentheses !== closeParentheses || openParentheses > 1 || /\(\s*\)/u.test(phone) || (openParentheses && !/\([\d -]+\)/u.test(phone))) return 'Check that the phone number parentheses are paired.'
  const digits = phone.replace(/\D/gu, '')
  return digits.length >= 7 && digits.length <= 15 ? '' : 'Enter 7–15 digits, including the international dialing code when needed.'
}

export function normalizeHttpUrl(value: string) {
  const input = value.trim()
  if (!input) return ''
  const hasHttpScheme = /^https?:\/\//iu.test(input)
  const looksLikeHostAndPort = /^(?:localhost|(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+|\[[\da-f:.]+\]):\d+(?:[/?#]|$)/iu.test(input)
  if (/^[a-z][a-z\d+.-]*:/iu.test(input) && !hasHttpScheme && !looksLikeHostAndPort) return ''
  try {
    const url = new URL(hasHttpScheme ? input : `https://${input}`)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hostname.includes('..') || url.hostname.startsWith('.') || url.hostname.endsWith('.')) return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function urlValidationError(value: string) {
  if (!value.trim()) return ''
  return normalizeHttpUrl(value) ? '' : 'Enter a valid HTTP or HTTPS URL.'
}

export function normalizePhone(value: string) {
  return value.trim().replace(/\s+/gu, ' ')
}
