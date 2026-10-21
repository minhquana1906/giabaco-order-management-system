import type { School } from './api'

export const defaultSchool = <T extends Pick<School, 'has_open_campaign'>>(schools: readonly T[]): T | undefined =>
  schools.find((s) => s.has_open_campaign) ?? schools[0]
