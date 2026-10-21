import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingRows } from "@/components/LoadingRows";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAdminProducts, useColourLookup } from "../hooks";

const GENDER_LABEL = { MALE: "Nam", FEMALE: "Nữ", UNISEX: "Cả hai" } as const;

export function CatalogPage() {
  const products = useAdminProducts();
  const colours = useColourLookup();

  const body = () => {
    if (products.isPending) return <LoadingRows rows={4} />;
    if (products.isError)
      return (
        <ErrorState
          error={products.error}
          onRetry={() => void products.refetch()}
        />
      );
    if (products.data.length === 0) {
      return (
        <EmptyState
          title="Chưa có sản phẩm nào"
          action={
            <Button asChild>
              <Link to="/catalog/new">Thêm sản phẩm đầu tiên</Link>
            </Button>
          }
        />
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Mã</TableHead>
            <TableHead>Giới tính</TableHead>
            <TableHead>Màu</TableHead>
            <TableHead>Cỡ</TableHead>
            <TableHead className="text-right">Ảnh theo trường</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.data.map((p) => (
            <TableRow
              key={p.id}
              className={cn(
                "relative hover:bg-accent/50",
                !p.active && "text-muted-foreground",
              )}
            >
              <TableCell className="font-semibold">
                <Link
                  to="/catalog/$productId"
                  params={{ productId: p.id }}
                  className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.code}</TableCell>
              <TableCell>{GENDER_LABEL[p.gender_target]}</TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {p.colours.map((code) => (
                    <span key={code} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-3 rounded-full border border-hairline"
                        style={{ backgroundColor: colours.swatch(code) }}
                      />
                      {colours.label(code)}
                    </span>
                  ))}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">
                {p.sizes.join(", ")}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Object.values(p.school_image_counts).reduce(
                  (a, b) => a + b,
                  0,
                )}{" "}
                ảnh / {Object.keys(p.school_image_counts).length} trường
              </TableCell>
              <TableCell>
                {p.active ? (
                  <Badge variant="secondary">Đang dùng</Badge>
                ) : (
                  <Badge variant="outline">Đã ẩn</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sản phẩm"
        actions={
          <Button className="h-11 md:h-9" asChild>
            <Link to="/catalog/new">
              <Plus /> Thêm sản phẩm
            </Link>
          </Button>
        }
      />
      {body()}
    </div>
  );
}
