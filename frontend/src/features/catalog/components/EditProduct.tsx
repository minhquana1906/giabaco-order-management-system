import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/ErrorState";
import { LoadingRows } from "@/components/LoadingRows";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { useAdminProducts, useUpdateProduct } from "../hooks";
import { formFromProduct } from "../productFormLogic";
import { ProductForm } from "./ProductForm";
import { ProductImagesTab } from "./ProductImagesTab";

export type CatalogTab = "info" | "images";

const TABS: { value: CatalogTab; label: string }[] = [
  { value: "info", label: "Thông tin" },
  { value: "images", label: "Ảnh theo trường" },
];

interface EditProductProps {
  productId: string;
  tab: CatalogTab;
  onTabChange: (tab: CatalogTab) => void;
}

export function EditProduct({ productId, tab, onTabChange }: EditProductProps) {
  const products = useAdminProducts();
  const update = useUpdateProduct(productId);
  const product = products.data?.find((p) => p.id === productId);

  if (products.isPending) return <LoadingRows rows={6} />;
  if (products.isError)
    return (
      <ErrorState
        error={products.error}
        onRetry={() => void products.refetch()}
      />
    );
  if (!product) return <ErrorState message="Không tìm thấy sản phẩm." />;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/catalog"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Sản phẩm
      </Link>
      <PageHeader title={product.name} />
      <div
        role="tablist"
        aria-label="Sản phẩm"
        className="flex gap-1 border-b border-hairline"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={tab === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => onTabChange(t.value)}
            className={cn(
              "-mb-px min-h-10 border-b-2 px-4 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.value
                ? "border-navy text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "info" ? (
          <ProductForm
            key={product.id}
            mode="edit"
            initial={formFromProduct(product)}
            active={product.active}
            submitLabel="Lưu thay đổi"
            pending={update.isPending}
            onSubmit={async ({ body, active }) => {
              await update.mutateAsync({ ...body, active });
              toast.success("Đã lưu sản phẩm");
            }}
          />
        ) : (
          <ProductImagesTab product={product} />
        )}
      </div>
    </div>
  );
}
