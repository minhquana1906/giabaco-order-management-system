import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/ErrorState";
import { Field } from "@/components/Field";
import { LoadingRows } from "@/components/LoadingRows";
import { NativeSelect } from "@/components/NativeSelect";
import { ProductImageOrPlaceholder } from "@/components/ProductImagePlaceholder";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import type { ImageGender, Product } from "../api";
import {
  useColourLookup,
  useDeleteProductImage,
  useProductImages,
  useSchools,
  useUploadProductImage,
} from "../hooks";

const GENDERS: { value: ImageGender; label: string }[] = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
];

interface CellProps {
  product: Product;
  schoolId: string;
  gender: ImageGender;
  colour: string;
  colourLabel: string;
}

function Cell({ product, schoolId, gender, colour, colourLabel }: CellProps) {
  const images = useProductImages(product.id, schoolId);
  const upload = useUploadProductImage(product.id);
  const remove = useDeleteProductImage(product.id);
  const input = useRef<HTMLInputElement>(null);
  const image =
    images.data?.find((i) => i.gender === gender && i.colour === colour) ??
    null;
  const label = `${gender === "MALE" ? "Nam" : "Nữ"} · ${colourLabel}`;

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      await upload.mutateAsync({ school_id: schoolId, gender, colour, file });
      toast.success("Đã lưu ảnh");
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? (error.fields?.file ?? error.message)
          : "Không tải được ảnh lên.",
      );
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-md border border-hairline bg-card p-3"
      aria-label={label}
    >
      <p className="text-sm font-semibold">{label}</p>
      <ProductImageOrPlaceholder
        image={image}
        alt={`${product.name}, ${label}`}
      />
      {image ? null : (
        <p className="text-sm text-muted-foreground">Chưa có ảnh</p>
      )}
      <div className="flex gap-2">
        <input
          ref={input}
          type="file"
          accept="image/webp,image/jpeg,image/png"
          className="sr-only"
          aria-label={`Chọn ảnh ${label}`}
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          <Upload /> {image ? "Thay ảnh" : "Tải ảnh lên"}
        </Button>
        {image ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            aria-label={`Xóa ảnh ${label}`}
            onClick={() =>
              remove.mutate(image.id, {
                onError: (error) =>
                  toast.error(
                    error instanceof ApiError
                      ? error.message
                      : "Không xóa được ảnh.",
                  ),
              })
            }
          >
            <Trash2 /> Xóa
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ProductImagesTab({ product }: { product: Product }) {
  const schools = useSchools();
  const colours = useColourLookup();
  const [chosen, setChosen] = useState("");
  const schoolId = chosen || schools.data?.[0]?.id;

  if (schools.isPending) return <LoadingRows rows={3} />;
  if (schools.isError)
    return (
      <ErrorState
        error={schools.error}
        onRetry={() => void schools.refetch()}
      />
    );
  if (!schoolId)
    return (
      <p className="text-muted-foreground">
        Chưa có trường nào. Thêm trường trước khi tải ảnh.
      </p>
    );

  return (
    <div className="flex flex-col gap-4">
      <Field id="images-school" label="Trường" className="max-w-sm">
        {(c) => (
          <NativeSelect
            {...c}
            value={schoolId}
            onChange={(e) => setChosen(e.target.value)}
          >
            {schools.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      {GENDERS.map((g) => (
        <section
          key={g.value}
          aria-label={g.label}
          className="flex flex-col gap-2"
        >
          <h3 className="text-base font-semibold">{g.label}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {product.colours.map((colour) => (
              <Cell
                key={colour}
                product={product}
                schoolId={schoolId}
                gender={g.value}
                colour={colour}
                colourLabel={colours.label(colour)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
