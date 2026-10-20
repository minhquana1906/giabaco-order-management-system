import { useState } from 'react'
import { X, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { colourLabel, type ProductColour } from '@/lib/productColour'
import { cn } from '@/lib/utils'
import type { PublicProduct, PublicStudent } from '../api'
import { PRODUCT_IMAGE_ASPECT, productImage, type ProductImageSources } from '../productImages'

interface ProductImageProps {
  product: PublicProduct
  gender: PublicStudent['gender']
  colour: ProductColour
  sizes: string
  className?: string
}

function describe(product: PublicProduct, gender: PublicStudent['gender'], colour: ProductColour) {
  return `${product.name} ${gender === 'MALE' ? 'nam' : 'nữ'}, màu ${colourLabel(colour)}`
}

function Lightbox({ image, label, title }: { image: ProductImageSources; label: string; title: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className="flex h-[min(92dvh,1100px)] w-[min(96vw,1400px)] max-w-none flex-col gap-0 overflow-hidden p-0 shadow-none sm:max-w-none"
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline py-1.5 pl-4 pr-2">
        <DialogTitle className="truncate text-base text-navy">{title}</DialogTitle>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-[15px]"
            aria-pressed={zoomed}
            onClick={() => setZoomed((v) => !v)}
          >
            <ZoomIn /> <span className="max-sm:sr-only">Phóng to</span>
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Đóng">
              <X />
            </Button>
          </DialogClose>
        </div>
      </div>
      {failed ? (
        <p role="alert" className="p-8 text-center text-destructive">
          Chưa tải được ảnh. Vui lòng thử lại sau.
        </p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label={`Ảnh lớn ${title}`}
          className="min-h-0 flex-1 overflow-auto bg-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <img
            src={image.src}
            alt={`${label}: kiểu dáng, chất liệu và thông số`}
            className={cn(
              zoomed
                ? 'h-auto w-[1600px] max-w-none cursor-zoom-out'
                : 'mx-auto h-full w-full cursor-zoom-in object-contain',
            )}
            onClick={() => setZoomed((v) => !v)}
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </DialogContent>
  )
}

export function ProductImage({ product, gender, colour, sizes, className }: ProductImageProps) {
  const image = productImage(product.code, gender, colour)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!image) return null

  const label = describe(product, gender, colour)
  if (failedSrc === image.thumb) {
    return (
      <p role="alert" className={cn('py-6 text-center text-destructive', className)}>
        Chưa tải được ảnh.
      </p>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Phóng to ảnh ${label}`}
          className={cn(
            'group relative block cursor-zoom-in overflow-hidden rounded-md border border-hairline bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            className,
          )}
        >
          <img
            key={image.thumb}
            src={image.thumb}
            srcSet={image.srcSet}
            sizes={sizes}
            alt=""
            width={900}
            height={828}
            className={cn('block h-auto w-full object-contain', PRODUCT_IMAGE_ASPECT)}
            onError={() => setFailedSrc(image.thumb)}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-navy/0 transition-colors group-hover:bg-navy/10 group-focus-visible:bg-navy/10"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-navy text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 lg:bottom-2 lg:right-2 lg:size-10"
          >
            <ZoomIn className="size-4 lg:size-5" />
          </span>
        </button>
      </DialogTrigger>
      <Lightbox image={image} label={label} title={`${product.name} · ${colourLabel(colour)}`} />
    </Dialog>
  )
}
