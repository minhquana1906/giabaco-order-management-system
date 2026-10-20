import { Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { ProductColour } from '@/lib/productColour'
import { cn } from '@/lib/utils'
import type { PublicProduct, PublicStudent } from '../api'
import { productImageSrc } from '../productImages'
import { ProductImage } from './ProductImage'

interface ProductImageButtonProps {
  product: PublicProduct
  gender: PublicStudent['gender']
  colour: ProductColour
  className?: string
}

export function ProductImageButton({ product, gender, colour, className }: ProductImageButtonProps) {
  if (!productImageSrc(product.code, gender, colour)) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn('h-11 self-start', className)}>
          <Image /> Xem ảnh sản phẩm
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-h-[90dvh] min-w-0 gap-3 p-4 sm:max-w-3xl sm:p-6">
        <DialogTitle className="px-8 text-center text-lg text-navy">{product.name}</DialogTitle>
        <ProductImage product={product} gender={gender} colour={colour} scrollClassName="max-h-[60dvh]" />
      </DialogContent>
    </Dialog>
  )
}
