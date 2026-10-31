export type Kind = 'facilities' | 'materials' | 'suppliers' | 'products'
export type Data = Record<string, string | null>

export const KINDS: Kind[] = ['facilities', 'materials', 'suppliers', 'products']

export const KIND_LABEL: Record<Kind, string> = {
  facilities: 'Cơ sở sản xuất',
  materials: 'Nguyên phụ liệu',
  suppliers: 'Nhà cung cấp',
  products: 'Sản phẩm gốc',
}

/** Stored keys are the workbook headers; this maps them to full Vietnamese labels. */
const LABEL: Record<string, string> = {
  'Mã NPL': 'Mã nguyên phụ liệu',
  'Nhóm NPL': 'Nhóm nguyên phụ liệu',
  'Tên NPL': 'Tên nguyên phụ liệu',
  'Mã/Nhãn NCC': 'Mã hoặc nhãn của nhà cung cấp',
  NCC: 'Nhà cung cấp',
  'Dự án/Phân khúc': 'Dự án hoặc phân khúc',
  'Khổ/Bản': 'Khổ hoặc bản',
  ĐVT: 'Đơn vị tính',
  MOQ: 'Số lượng đặt tối thiểu',
  'Lead time': 'Thời gian giao hàng',
  'Mã NCC': 'Mã nhà cung cấp',
  'Tên NCC/Đối tác': 'Tên nhà cung cấp hoặc đối tác',
  'NPL/Dịch vụ chính': 'Nguyên phụ liệu hoặc dịch vụ chính',
  'Xuất xứ/Khu vực': 'Xuất xứ hoặc khu vực',
  'Dự án/Phân khúc áp dụng': 'Dự án hoặc phân khúc áp dụng',
  'Mã SP nền': 'Mã sản phẩm gốc',
  'Nhóm SP': 'Nhóm sản phẩm',
  'Dải cỡ chuẩn': 'Dải cỡ chuẩn',
  'Mô hình SX': 'Mô hình sản xuất',
  'Tiêu chí QC chính': 'Tiêu chí kiểm tra chất lượng chính',
  'Vai trò trong Master': 'Vai trò trong danh mục gốc',
  'Tên cơ sở/đối tác': 'Tên cơ sở hoặc đối tác',
  'Tiêu chí QC trọng tâm': 'Tiêu chí kiểm tra chất lượng trọng tâm',
  'MST/CCCD': 'Mã số thuế hoặc CCCD',
  SĐT: 'Số điện thoại',
}

export const labelOf = (field: string) => LABEL[field] ?? field

/** Columns shown in the list; `code` is always the first field of the kind. */
export const KEY_FIELDS: Record<Kind, { code: string; name: string; group: string; stage?: string; status: string }> = {
  facilities: { code: 'Mã cơ sở', name: 'Tên cơ sở/đối tác', group: 'Nhóm sản phẩm', stage: 'Công đoạn chính', status: 'Trạng thái hợp tác' },
  materials: { code: 'Mã NPL', name: 'Tên NPL', group: 'Nhóm NPL', status: 'Trạng thái phê duyệt' },
  suppliers: { code: 'Mã NCC', name: 'Tên NCC/Đối tác', group: 'Nhóm cung cấp', status: 'Trạng thái phê duyệt' },
  products: { code: 'Mã SP nền', name: 'Tên sản phẩm', group: 'Nhóm SP', status: 'Trạng thái áp dụng' },
}

export const SECTIONS: Record<Kind, { title: string; fields: string[] }[]> = {
  facilities: [
    { title: 'Nhận diện', fields: ['Mã cơ sở', 'Tên cơ sở/đối tác', 'Đầu mối', 'Mô hình'] },
    {
      title: 'Năng lực và hợp tác',
      fields: ['Nhóm sản phẩm', 'Công đoạn chính', 'Phạm vi trách nhiệm', 'Tiêu chí QC trọng tâm', 'Trạng thái hợp tác'],
    },
    {
      title: 'Pháp lý và liên hệ',
      fields: ['Tên pháp lý', 'MST/CCCD', 'Địa chỉ', 'SĐT', 'Email', 'Hồ sơ pháp lý'],
    },
  ],
  materials: [
    {
      title: 'Nhận diện',
      fields: ['Mã NPL', 'Nhóm NPL', 'Tên NPL', 'Mã/Nhãn NCC', 'NCC', 'Dự án/Phân khúc', 'Sản phẩm áp dụng'],
    },
    {
      title: 'Thông số',
      fields: ['Thành phần', 'Khổ/Bản', 'Định lượng', 'Màu', 'Xuất xứ', 'ĐVT', 'MOQ', 'Lead time'],
    },
    {
      title: 'Hồ sơ và phê duyệt',
      fields: ['Hồ sơ hiện có', 'Hồ sơ còn thiếu', 'Tiêu chí kiểm soát', 'Trạng thái phê duyệt'],
    },
    { title: 'Ghi chú', fields: ['Ghi chú'] },
  ],
  suppliers: [
    {
      title: 'Nhận diện',
      fields: [
        'Mã NCC',
        'Tên NCC/Đối tác',
        'Đầu mối',
        'Nhóm cung cấp',
        'NPL/Dịch vụ chính',
        'Xuất xứ/Khu vực',
        'Dự án/Phân khúc áp dụng',
      ],
    },
    { title: 'Thông số', fields: ['MOQ', 'Lead time'] },
    {
      title: 'Hồ sơ và phê duyệt',
      fields: [
        'Hồ sơ hiện có',
        'Hồ sơ còn thiếu',
        'Tiêu chí đánh giá chính',
        'Trạng thái phê duyệt',
        'Ngày đánh giá gần nhất',
        'Ngày đánh giá lại',
      ],
    },
    { title: 'Ghi chú', fields: ['Ghi chú'] },
  ],
  products: [
    {
      title: 'Nhận diện',
      fields: ['Mã SP nền', 'Mã phân khúc', 'Phân khúc', 'Nhóm SP', 'Tên sản phẩm', 'Giới tính'],
    },
    { title: 'Thông số', fields: ['Dải cỡ chuẩn', 'Mô hình SX'] },
    {
      title: 'Hồ sơ và phê duyệt',
      fields: ['Tiêu chí QC chính', 'Cơ sở xây dựng danh mục', 'Vai trò trong Master', 'Trạng thái áp dụng'],
    },
  ],
}

/** Long free-text fields: a textarea spanning both form columns. */
export const WIDE_FIELDS: Record<string, true> = {
  'Sản phẩm áp dụng': true,
  'NPL/Dịch vụ chính': true,
  'Dự án/Phân khúc áp dụng': true,
  'Hồ sơ hiện có': true,
  'Hồ sơ còn thiếu': true,
  'Tiêu chí kiểm soát': true,
  'Tiêu chí đánh giá chính': true,
  'Tiêu chí QC chính': true,
  'Cơ sở xây dựng danh mục': true,
  'Ghi chú': true,
  'Phạm vi trách nhiệm': true,
  'Tiêu chí QC trọng tâm': true,
}

/** Fixed choices from the workbook data dictionary; cooperation status gates facility sign-in. */
export const CHOICES: Record<string, string[]> = {
  'Trạng thái hợp tác': ['Đang sử dụng', 'Đang đánh giá', 'Tạm dừng', 'Ngưng'],
}

export type Definition = {
  fields: string[]
  required: string[]
  conditional_required: { field: string; when: string; starts_with?: string; equals?: string }[]
}

/** Required fields for a draft, including conditional rules; mirrors the server's `missing_fields`. */
export function requiredFor(definition: Definition, data: Data): Set<string> {
  const required = new Set(definition.required)
  for (const rule of definition.conditional_required) {
    const value = data[rule.when] ?? ''
    if (rule.starts_with !== undefined ? value.startsWith(rule.starts_with) : value === rule.equals) {
      required.add(rule.field)
    }
  }
  return required
}

export const isBlank = (value: string | null | undefined) => !value?.trim()

/** Case- and diacritic-insensitive text for search. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
