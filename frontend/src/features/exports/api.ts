import { downloadFile } from '@/lib/http'

export interface ExportItem {
  label: string
  path: string
  fileName: string
}

export const EXPORT_GROUPS: { title: string; items: ExportItem[] }[] = [
  {
    title: 'Học sinh',
    items: [
      { label: 'Học sinh (CSV)', path: '/export/students.csv', fileName: 'students.csv' },
      { label: 'Học sinh (Excel)', path: '/export/students.xlsx', fileName: 'students.xlsx' },
    ],
  },
  {
    title: 'Lần thử',
    items: [
      { label: 'Lần thử (CSV)', path: '/export/trials.csv', fileName: 'trials.csv' },
      { label: 'Lần thử (Excel)', path: '/export/trials.xlsx', fileName: 'trials.xlsx' },
    ],
  },
  {
    title: 'Tất cả',
    items: [{ label: 'Tất cả (Excel)', path: '/export/all.xlsx', fileName: 'all.xlsx' }],
  },
]

export const exportsApi = {
  download: (item: ExportItem) => downloadFile(item.path, undefined, item.fileName),
}
