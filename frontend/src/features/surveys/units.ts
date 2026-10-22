import units from './vnUnits.json'

export interface Province {
  name: string
  wards: string[]
}

export const PROVINCES: Province[] = units
