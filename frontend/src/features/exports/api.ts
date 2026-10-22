import { downloadFile } from '@/lib/http'

export interface ExportItem {
  label: string
  path: string
  fileName: string
  schoolScoped?: boolean
}

export const EXPORT_GROUPS: { title: string; items: ExportItem[] }[] = [
  {
    title: 'Học sinh',
    items: [
      { label: 'Học sinh (CSV)', path: '/export/students.csv', fileName: 'students.csv', schoolScoped: true },
      { label: 'Học sinh (Excel)', path: '/export/students.xlsx', fileName: 'students.xlsx', schoolScoped: true },
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
    title: 'Khảo sát phụ huynh',
    items: [
      { label: 'Khảo sát (CSV)', path: '/export/surveys.csv', fileName: 'surveys.csv' },
      { label: 'Khảo sát (Excel)', path: '/export/surveys.xlsx', fileName: 'surveys.xlsx' },
    ],
  },
  {
    title: 'Tất cả',
    items: [{ label: 'Tất cả (Excel)', path: '/export/all.xlsx', fileName: 'all.xlsx' }],
  },
]

export const exportsApi = {
  download: ({ item, schoolId }: { item: ExportItem; schoolId?: string }) =>
    downloadFile(item.path, item.schoolScoped && schoolId ? { school_id: schoolId } : undefined, item.fileName),
}
