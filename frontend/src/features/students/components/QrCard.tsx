import { Copy, Download, ExternalLink } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface QrCardProps {
  portalUrl: string
  fileName: string
  size?: number
  showOpen?: boolean
}

export function QrCard({ portalUrl, fileName, size = 240, showOpen = false }: QrCardProps) {
  const wrapper = useRef<HTMLDivElement>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl)
      toast.success('Đã sao chép liên kết')
    } catch {
      toast.error('Không tự sao chép được. Chọn liên kết rồi sao chép thủ công.')
    }
  }

  const download = () => {
    const canvas = wrapper.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${fileName}.png`
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={wrapper} className="rounded-md border border-hairline bg-white p-2" style={{ width: size }}>
        <QRCodeCanvas value={portalUrl} size={512} marginSize={1} style={{ width: '100%', height: 'auto' }} />
      </div>
      <div className="flex w-full max-w-[420px] items-center gap-2">
        <input
          readOnly
          aria-label="Liên kết phụ huynh"
          value={portalUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 text-sm md:h-10"
        />
        <Button variant="outline" className="h-11 md:h-10" onClick={copy}>
          <Copy /> Sao chép
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" className="h-11 md:h-10" onClick={download}>
          <Download /> Tải mã QR
        </Button>
        {showOpen ? (
          <Button variant="outline" className="h-11 md:h-10" asChild>
            <a href={portalUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> Mở trang phụ huynh
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
