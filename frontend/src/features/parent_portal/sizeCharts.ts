export interface SizeChart {
  columns: { label: string; values: number[] }[]
  notes: string
}

export const SIZE_CHARTS: Record<string, SizeChart> = {
  blazer: {
    columns: [
      { label: 'Dài áo', values: [43.5, 45.5, 47.5, 49.5, 51.5, 53.5, 55.5] },
      { label: '1/2 vòng ngực', values: [38.4, 40.4, 42.4, 44.4, 46.4, 48.4, 50.4] },
      { label: 'Rộng vai', values: [8.8, 9.8, 10.8, 11.8, 12.8, 13.8, 14.8] },
      { label: 'Dài tay', values: [41, 42, 43, 44, 45, 46, 47] },
    ],
    notes: '1/2 vòng ngực tính từ chân nẹp. Rộng vai đo mỗi bên.',
  },
  gile: {
    columns: [
      { label: 'Dài áo', values: [42, 44, 46, 48, 50, 52, 54] },
      { label: 'Rộng ngực', values: [34, 36, 38, 40, 42, 44, 46] },
      { label: 'Rộng vai', values: [6, 7, 8, 9, 10, 11, 12] },
    ],
    notes: 'Rộng vai đo mỗi bên.',
  },
}
