
export const durationOptions = [
  { value: '1h', label: '1 hour', hours: 1 },
  { value: '6h', label: '6 hours', hours: 6 },
  { value: '12h', label: '12 hours', hours: 12 },
  { value: '1d', label: '1 day', hours: 24 },
  { value: '3d', label: '3 days', hours: 72 },
  { value: '1wk', label: '1 week', hours: 168 },
  { value: '2wk', label: '2 weeks', hours: 336 },
  { value: '1mo', label: '1 month', hours: 720 },
  { value: '2mo', label: '2 months', hours: 1440 },
  { value: '3mo', label: '3 months', hours: 2160 },
  { value: '6mo', label: '6 months', hours: 4320 },
  { value: '1yr', label: '1 year', hours: 8760 }
] as const

export type DurationValue = typeof durationOptions[number]['value']

const durationMap: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '1d': 24,
  '3d': 72,
  '1wk': 168,
  '2wk': 336,
  '1mo': 720,
  '2mo': 1440,
  '3mo': 2160,
  '6mo': 4320,
  '1yr': 8760
}

export function getDurationHours(duration: string): number {
  return durationMap[duration] || 24
}

export function parseDuration(duration: string | undefined, customHours: string | undefined): number {
  if (customHours && customHours.trim() !== '') {
    const parsed = parseInt(customHours)
    return isNaN(parsed) ? 24 : parsed
  }
  return getDurationHours(duration || '1mo')
}
