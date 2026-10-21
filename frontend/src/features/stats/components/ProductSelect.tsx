import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProductSelectProps {
  products: { code: string; name: string }[]
  value: string
  onChange: (code: string) => void
}

export function ProductSelect({ products, value, onChange }: ProductSelectProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 max-sm:w-full">
      <Label htmlFor="dashboard-product">Sản phẩm</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="dashboard-product" className="w-full min-w-0 sm:w-[300px] max-sm:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {products.map((p) => (
            <SelectItem key={p.code} value={p.code}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
