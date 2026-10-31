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
      { label: 'Học sinh (CSV)', path: '/export/students.csv', fileName: 'hoc-sinh.csv', schoolScoped: true },
      { label: 'Học sinh (XLSX)', path: '/export/students.xlsx', fileName: 'hoc-sinh.xlsx', schoolScoped: true },
    ],
  },
  {
    title: 'Lần thử',
    items: [
      { label: 'Lần thử (CSV)', path: '/export/trials.csv', fileName: 'lan-thu.csv' },
      { label: 'Lần thử (XLSX)', path: '/export/trials.xlsx', fileName: 'lan-thu.xlsx' },
    ],
  },
  {
    title: 'Khảo sát phụ huynh',
    items: [
      { label: 'Khảo sát (CSV)', path: '/export/surveys.csv', fileName: 'khao-sat.csv' },
      { label: 'Khảo sát (XLSX)', path: '/export/surveys.xlsx', fileName: 'khao-sat.xlsx' },
    ],
  },
  {
    title: 'Tất cả',
    items: [{ label: 'Tất cả (XLSX)', path: '/export/all.xlsx', fileName: 'tat-ca.xlsx' }],
  },
]

export const exportsApi = {
  download: ({ item, schoolId }: { item: ExportItem; schoolId?: string }) =>
    downloadFile(item.path, item.schoolScoped && schoolId ? { school_id: schoolId } : undefined, item.fileName),
}
