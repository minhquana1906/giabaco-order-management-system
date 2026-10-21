import { useMutation } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { Fragment } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/lib/http'
import { EXPORT_GROUPS, exportsApi } from '../api'

export function ExportMenu({ schoolId }: { schoolId?: string }) {
  const download = useMutation({
    mutationFn: exportsApi.download,
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Không tải được tệp xuất. Thử lại sau.'),
  })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9" disabled={download.isPending}>
          {download.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Xuất dữ liệu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {EXPORT_GROUPS.map((group, i) => (
          <Fragment key={group.title}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{group.title}</DropdownMenuLabel>
            {group.items.map((item) => (
              <DropdownMenuItem key={item.path} className="min-h-10" onSelect={() => download.mutate({ item, schoolId })}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
