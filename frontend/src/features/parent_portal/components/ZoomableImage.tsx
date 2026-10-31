import { ProductImageOrPlaceholder } from '@/components/ProductImagePlaceholder'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Img } from '../api'

interface ZoomableImageProps {
  image: Img | null
  alt: string
  className?: string
  eager?: boolean
}

export function ZoomableImage({ image, alt, className, eager }: ZoomableImageProps) {
  const thumb = (
    <ProductImageOrPlaceholder
      image={image}
      alt={alt}
      aspect={image ? image.width / image.height : undefined}
      className={cn('p-1 text-xs', className)}
      eager={eager}
    />
  )
  if (!image) return <div className="self-start">{thumb}</div>
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Phóng to ảnh ${alt}`}
          className="block cursor-zoom-in self-start rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {thumb}
        </button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-[min(96vw,1100px)] gap-2 p-2 pt-12 sm:max-w-[min(96vw,1100px)] sm:p-3 sm:pt-12">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img
          src={image.url}
          alt={alt}
          width={image.width}
          height={image.height}
          decoding="async"
          className="max-h-[85vh] w-full rounded-md bg-white object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
