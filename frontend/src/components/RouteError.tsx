import { useEffect } from 'react'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorState } from '@/components/ErrorState'
import { ApiError } from '@/lib/http'

const ROUTE_ERROR_MESSAGE = 'Trang này gặp sự cố. Bấm Thử lại hoặc tải lại trang.'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  useEffect(() => {
    // Developer detail for the browser console; the user sees only the plain message below.
    console.error('route_error', { route: router.state.location.pathname, error })
  }, [error, router])
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <ErrorState
        error={error}
        message={error instanceof ApiError ? undefined : ROUTE_ERROR_MESSAGE}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
