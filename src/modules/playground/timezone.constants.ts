/**
 * Shared timezone constants for exam scheduling.
 *
 * All exam times are stored as `timestamptz` (true UTC instants) in the DB — this
 * offset is ONLY used to interpret/display admin-entered "local" datetime-local
 * strings and to render dates back to admins/students in the exam's own timezone,
 * regardless of the browser's local timezone.
 */

/** Default timezone for every exam/assignment unless explicitly overridden: UTC-5 (Ecuador). */
export const DEFAULT_TIMEZONE_OFFSET_MINUTES = -300;

export interface TimezoneOption {
  /** Offset in minutes from UTC (e.g. -300 for UTC-5). Matches JS convention direction (UTC - local = offset). */
  offsetMinutes: number;
  label: string;
}

/** Curated list of common offsets for the admin exam-scheduling UI. */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { offsetMinutes: -300, label: 'UTC-5 (Ecuador, Perú, Colombia)' },
  { offsetMinutes: -360, label: 'UTC-6 (México, Centroamérica)' },
  { offsetMinutes: -240, label: 'UTC-4 (Bolivia, Venezuela)' },
  { offsetMinutes: -180, label: 'UTC-3 (Argentina, Chile, Uruguay, Brasil-E)' },
  { offsetMinutes: 0, label: 'UTC+0' },
];
