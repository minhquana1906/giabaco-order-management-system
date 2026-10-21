import { Link } from '@tanstack/react-router'

export function EmptyProfile() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-hairline p-4">
      <p className="font-semibold">Trường chưa có danh mục sản phẩm</p>
      <Link to="/campaigns" className="text-sm font-medium text-primary underline underline-offset-4">
        Tạo đợt đăng ký
      </Link>
    </div>
  )
}
