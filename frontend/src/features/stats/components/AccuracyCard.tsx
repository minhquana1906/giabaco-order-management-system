import { ButtonMeter } from '@/components/ButtonMeter'
import { Card } from '@/components/ui/card'
import { formatNumber, formatRate } from '@/lib/format'
import type { SizeGuideAccuracy } from '../api'

export function AccuracyCard({ productName, accuracy }: { productName: string; accuracy: SizeGuideAccuracy | undefined }) {
  const evaluated = accuracy?.evaluated ?? 0

  return (
    <Card className="gap-0 px-5">
      <h2 className="text-[15px] font-semibold">Độ chính xác bảng size tạm</h2>
      <p className="text-xs text-muted-foreground">{productName} · cỡ gợi ý so với cỡ vừa suy ra</p>
      {accuracy && evaluated > 0 && accuracy.exact_rate !== null ? (
        <>
          <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 tabular-nums">
            <span className="text-[40px] font-semibold leading-none">{formatRate(accuracy.exact_rate)}</span>
            <span className="text-xs text-muted-foreground">
              trùng cỡ vừa suy ra · {formatNumber(accuracy.exact)}/{formatNumber(evaluated)} HS đủ dữ liệu
            </span>
          </div>
          <ButtonMeter
            className="my-3"
            filled={Math.round(accuracy.exact_rate * 10)}
            label={`${formatRate(accuracy.exact_rate)} trùng cỡ vừa suy ra`}
          />
          <div className="flex gap-6 text-[13px] tabular-nums">
            <div>
              <b className="block text-lg font-semibold">{formatNumber(accuracy.off_by_one)}</b>lệch 1 cỡ
            </div>
            <div>
              <b className="block text-lg font-semibold">{formatNumber(accuracy.off_by_two_plus)}</b>lệch ≥2 cỡ
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Chưa đủ dữ liệu để so sánh</p>
      )}
    </Card>
  )
}
