import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { colourLabel, type ProductColour } from '@/lib/productColour'
import { cn } from '@/lib/utils'
import type { PublicProduct, PublicStudent } from '../api'
import { productImageSrc } from '../productImages'

interface ProductImageProps {
  product: PublicProduct
  gender: PublicStudent['gender']
  colour: ProductColour
  scrollClassName?: string
}

export function ProductImage({ product, gender, colour, scrollClassName }: ProductImageProps) {
  const src = productImageSrc(product.code, gender, colour)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src) return null

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {failedSrc === src ? (
        <p role="alert" className="py-8 text-center text-destructive">
          Chưa tải được ảnh. Vui lòng thử lại sau.
        </p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label={`Ảnh ${product.name}, cuộn để xem thêm`}
          className={cn(
            'min-w-0 overflow-auto rounded-md border border-hairline bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring',
            scrollClassName,
          )}
        >
          <img
            key={src}
            src={src}
            alt={`${product.name} ${gender === 'MALE' ? 'nam' : 'nữ'}, màu ${colourLabel(colour)}: kiểu dáng, chất liệu và thông số`}
            className="h-auto w-[900px] max-w-none sm:w-full"
            onError={() => setFailedSrc(src)}
          />
        </div>
      )}
      <Button asChild variant="ghost" className="h-11 self-center">
        <a href={src} target="_blank" rel="noopener noreferrer">
          <ExternalLink /> Mở ảnh lớn
        </a>
      </Button>
    </div>
  )
}
