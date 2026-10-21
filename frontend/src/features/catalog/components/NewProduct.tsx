import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useCreateProduct } from "../hooks";
import { emptyForm } from "../productFormLogic";
import { ProductForm } from "./ProductForm";

export function NewProduct() {
  const create = useCreateProduct();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/catalog"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Sản phẩm
      </Link>
      <PageHeader title="Thêm sản phẩm" />
      <ProductForm
        mode="create"
        initial={emptyForm()}
        submitLabel="Tạo sản phẩm"
        pending={create.isPending}
        onSubmit={async ({ body, code }) => {
          const product = await create.mutateAsync({ ...body, code });
          toast.success("Đã tạo sản phẩm");
          await navigate({
            to: "/catalog/$productId",
            params: { productId: product.id },
          });
        }}
      />
    </div>
  );
}
