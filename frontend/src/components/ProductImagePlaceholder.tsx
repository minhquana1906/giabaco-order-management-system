import { ImageOff } from 'lucide-react'
import type { ProductImageRef } from '@/features/catalog/api'
import { cn } from '@/lib/utils'

const DEFAULT_ASPECT = 1600 / 1473

export const PLACEHOLDER_TEXT = 'Chưa có thông tin ảnh sản phẩm'

interface FrameProps {
  aspect?: number
  className?: string
}

export function ProductImagePlaceholder({ aspect = DEFAULT_ASPECT, className }: FrameProps) {
  return (
    <div
      role="img"
      aria-label={PLACEHOLDER_TEXT}
      style={{ aspectRatio: aspect }}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-muted/40 p-3 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      <ImageOff className="size-6" aria-hidden="true" />
      <span>{PLACEHOLDER_TEXT}</span>
    </div>
  )
}

interface ImageProps extends FrameProps {
  image: ProductImageRef | null
  alt: string
  /** Above-the-fold (LCP) image: loaded eagerly with high priority instead of lazily. */
  eager?: boolean
}

export function ProductImageOrPlaceholder({ image, alt, aspect = DEFAULT_ASPECT, className, eager = false }: ImageProps) {
  if (!image) return <ProductImagePlaceholder aspect={aspect} className={className} />
  return (
    <img
      src={image.url}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      style={{ aspectRatio: aspect }}
      className={cn('w-full rounded-md border border-hairline bg-white object-contain', className)}
    />
  )
}
