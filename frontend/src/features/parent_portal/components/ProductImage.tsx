import { useState, type PointerEvent } from 'react'
import { X, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { colourLabel, type ProductColour } from '@/lib/productColour'
import { cn } from '@/lib/utils'
import type { PublicProduct, PublicStudent } from '../api'
import {
  LENS_WIDTH,
  lensAt,
  PRODUCT_IMAGE_ASPECT,
  productImage,
  type Lens,
  type ProductImageSources,
} from '../productImages'

interface ProductImageProps {
  product: PublicProduct
  gender: PublicStudent['gender']
  colour: ProductColour
  sizes: string
  magnifier?: boolean
  className?: string
}

const HOVER_DEVICE = 'hidden [@media(hover:hover)_and_(pointer:fine)]:md:block'
const PANE_GAP = 16

function describe(product: PublicProduct, gender: PublicStudent['gender'], colour: ProductColour) {
  return `${product.name} ${gender === 'MALE' ? 'nam' : 'nữ'}, màu ${colourLabel(colour)}`
}

function Lightbox({ image, label, title }: { image: ProductImageSources; label: string; title: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className="w-[min(92vw,calc(90dvh*1600/1473),1600px)] max-w-none gap-0 overflow-hidden bg-white p-0 shadow-none sm:max-w-none"
    >
      <DialogTitle className="sr-only">{title}</DialogTitle>
      {failed ? (
        <p role="alert" className={cn('grid place-items-center p-8 text-center text-destructive', PRODUCT_IMAGE_ASPECT)}>
          Chưa tải được ảnh. Vui lòng thử lại sau.
        </p>
      ) : (
        <img
          src={image.src}
          alt={`${label}: kiểu dáng, chất liệu và thông số`}
          width={1600}
          height={1473}
          className="block h-auto w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
      <DialogClose asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-2 top-2 size-11 bg-white dark:bg-white dark:hover:bg-accent"
          aria-label="Đóng"
        >
          <X />
        </Button>
      </DialogClose>
    </DialogContent>
  )
}

export function ProductImage({ product, gender, colour, sizes, magnifier = false, className }: ProductImageProps) {
  const image = productImage(product.code, gender, colour)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [lens, setLens] = useState<Lens | null>(null)
  if (!image) return null

  const label = describe(product, gender, colour)
  if (failedSrc === image.thumb) {
    return (
      <p role="alert" className={cn('py-6 text-center text-destructive', className)}>
        Chưa tải được ảnh.
      </p>
    )
  }

  const track = (event: PointerEvent<HTMLButtonElement>) => {
    if (!magnifier || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    const section = event.currentTarget.closest('section')
    const columnEnd = section
      ? section.getBoundingClientRect().right - parseFloat(getComputedStyle(section).paddingRight)
      : 0
    const paneWidth = Math.max(columnEnd - rect.right - PANE_GAP, rect.width * 1.25)
    setLens(lensAt(event.clientX, event.clientY, rect, paneWidth))
  }

  return (
    <Dialog>
      <div className={cn('relative', className)}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Phóng to ảnh ${label}`}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-md border border-hairline bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onPointerEnter={track}
            onPointerMove={track}
            onPointerLeave={() => setLens(null)}
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
            {lens ? (
              <span
                aria-hidden="true"
                data-slot="product-lens"
                className={cn('pointer-events-none absolute border border-navy/60 bg-white/40', HOVER_DEVICE)}
                style={{
                  left: `${lens.x * (1 - LENS_WIDTH) * 100}%`,
                  top: `${lens.y * (1 - lens.height) * 100}%`,
                  width: `${LENS_WIDTH * 100}%`,
                  height: `${lens.height * 100}%`,
                }}
              />
            ) : null}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-navy text-white opacity-0 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 lg:bottom-2 lg:right-2 lg:size-10"
            >
              <ZoomIn className="size-4 lg:size-5" />
            </span>
          </button>
        </DialogTrigger>
        {lens ? (
          <div
            aria-hidden="true"
            data-slot="product-zoom"
            className={cn(
              'pointer-events-none absolute left-[calc(100%+1rem)] top-0 z-30 h-full rounded-md border border-hairline bg-white bg-no-repeat',
              HOVER_DEVICE,
            )}
            style={{
              width: lens.paneWidth,
              backgroundImage: `url(${image.src})`,
              backgroundSize: `${100 / LENS_WIDTH}% auto`,
              backgroundPosition: `${lens.x * 100}% ${lens.y * 100}%`,
            }}
          />
        ) : null}
      </div>
      <Lightbox image={image} label={label} title={`${product.name} · ${colourLabel(colour)}`} />
    </Dialog>
  )
}
