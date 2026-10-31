import type { CampaignStatus } from '../api'

export function LockedNotice({ status }: { status: CampaignStatus }) {
  if (status === 'DRAFT') return null
  return (
    <p role="note" className="rounded-md border border-hairline bg-muted px-3 py-2 text-sm">
      {status === 'LOCKED'
        ? 'Đợt đã khóa, không thể sửa sản phẩm, giá và bộ. Mở lại đợt ở mục “Thông tin” để sửa.'
        : 'Đợt đang mở: chỉ được thêm sản phẩm hoặc đổi giá. Đơn đã đặt giữ giá lúc đặt. Sản phẩm và bộ đã có đơn không xóa được.'}
    </p>
  )
}
