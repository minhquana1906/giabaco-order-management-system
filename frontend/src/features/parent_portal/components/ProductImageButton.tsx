import { useState } from 'react'
import { ExternalLink, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PublicProduct, PublicStudent } from '../api'
import { PRODUCT_COLOURS, productImageSrc, type ProductColour } from '../productImages'

interface ProductImageButtonProps {
  product: PublicProduct
  gender: PublicStudent['gender']
  className?: string
}

export function ProductImageButton({ product, gender, className }: ProductImageButtonProps) {
  const [colour, setColour] = useState<ProductColour>('navy')
  const [failed, setFailed] = useState(false)
  const src = productImageSrc(product.code, gender, colour)
  if (!src) return null

  return (
    <Dialog onOpenChange={(open) => open && setFailed(false)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn('h-11 self-start', className)}>
          <Image /> Xem ảnh sản phẩm
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] min-w-0 gap-3 p-4 sm:max-w-3xl sm:p-6">
        <DialogTitle className="px-8 text-center text-lg text-navy">{product.name}</DialogTitle>
        <DialogDescription className="text-center">
          Ảnh tham khảo. Chọn cỡ ở bước này không bao gồm màu sắc.
        </DialogDescription>
        <div role="radiogroup" aria-label="Màu sắc trong ảnh" className="mx-auto grid w-full max-w-[240px] grid-cols-2 rounded-md border border-input p-0.5">
          {PRODUCT_COLOURS.map((c) => (
            <label
              key={c.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-[5px] px-3 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                colour === c.value ? 'bg-navy font-semibold text-white' : 'hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={`colour-${product.code}`}
                value={c.value}
                checked={colour === c.value}
                onChange={() => {
                  setColour(c.value)
                  setFailed(false)
                }}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
        {failed ? (
          <p role="alert" className="py-8 text-center text-destructive">
            Chưa tải được ảnh. Vui lòng thử lại sau.
          </p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label={`Ảnh ${product.name}, cuộn để xem thêm`}
            className="max-h-[60dvh] min-w-0 overflow-auto rounded-md border border-hairline outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              key={src}
              src={src}
              loading="lazy"
              alt={`${product.name} ${gender === 'MALE' ? 'nam' : 'nữ'}, màu ${colour === 'navy' ? 'Navy' : 'Ghi'}: kiểu dáng, chất liệu và thông số`}
              className="h-auto w-[900px] max-w-none sm:w-full"
              onError={() => setFailed(true)}
            />
          </div>
        )}
        <Button asChild variant="ghost" className="h-11 self-center">
          <a href={src} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Mở ảnh lớn
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
