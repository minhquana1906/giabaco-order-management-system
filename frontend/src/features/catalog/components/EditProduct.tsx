import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/ErrorState";
import { LoadingRows } from "@/components/LoadingRows";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  if (!product)
    return (
      <ErrorState message="Sản phẩm này không tồn tại hoặc đã bị xóa. Quay lại danh mục." />
    );

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/catalog"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Sản phẩm
      </Link>
      <PageHeader title={product.name} />
      <Tabs value={tab} onValueChange={(next) => onTabChange(next as CatalogTab)}>
        <TabsList aria-label="Sản phẩm">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="info">
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
        </TabsContent>
        <TabsContent value="images">
          <ProductImagesTab product={product} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
