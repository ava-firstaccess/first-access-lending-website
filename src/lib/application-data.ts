const SENSITIVE_APPLICATION_FIELDS = new Set([
  'Borrower - SSN',
  'Borrower - Date of Birth',
  'Co-Borrower - SSN',
  'Co-Borrower - Date of Birth',
]);

export function sanitizeApplicationFormData(input: unknown) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {};

  for (const field of SENSITIVE_APPLICATION_FIELDS) {
    delete source[field];
  }

  return source;
}

export function mergeSanitizedApplicationFormData(...parts: unknown[]) {
  return parts.reduce<Record<string, unknown>>((acc, part) => {
    return { ...acc, ...sanitizeApplicationFormData(part) };
  }, {});
}
