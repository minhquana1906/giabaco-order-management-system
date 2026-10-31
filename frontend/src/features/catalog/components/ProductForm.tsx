import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/Field";
import { FormSection } from "@/components/FormSection";
import { NativeSelect } from "@/components/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/http";
import { requestErrorMessage } from "@/lib/requestError";
import type { GenderTarget, ProductBody, TailorMeasurement } from "../api";
import { useBaseProducts, useColours, useCreateMeasurementType, useMeasurementTypes, useRenameMeasurementType } from "../hooks";
import {
  emptySizeRow,
  moveRow,
  toBody,
  validateForm,
  type ProductForm as ProductFormState,
  type ProductFormErrors,
  type SizeRowForm,
} from "../productFormLogic";

const GENDER_TARGETS: { value: GenderTarget; label: string }[] = [
  { value: "UNISEX", label: "Cả nam và nữ" },
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
];

const OTHER = "__other__";

interface ProductFormProps {
  mode: "create" | "edit";
  initial: ProductFormState;
  active?: boolean;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: {
    body: ProductBody;
    code: string;
    active: boolean;
  }) => Promise<unknown>;
}

const CELL = "h-9 min-w-0 px-2 text-sm";

export function ProductForm({
  mode,
  initial,
  active = true,
  submitLabel,
  pending,
  onSubmit,
}: ProductFormProps) {
  const [form, setForm] = useState(initial);
  const [isActive, setIsActive] = useState(active);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const colours = useColours();
  const baseProducts = useBaseProducts();
  const measurementTypes = useMeasurementTypes();
  const createType = useCreateMeasurementType();
  const [creatingRow, setCreatingRow] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const renameType = useRenameMeasurementType();
  const [renamingRow, setRenamingRow] = useState<number | null>(null);
  const [renameLabel, setRenameLabel] = useState("");

  const patch = (next: Partial<ProductFormState>) =>
    setForm((f) => ({ ...f, ...next }));
  const patchRow = (i: number, next: Partial<SizeRowForm>) =>
    patch({
      sizes: form.sizes.map((row, j) => (j === i ? { ...row, ...next } : row)),
    });
  const toggleColour = (code: string) =>
    patch({
      colours: form.colours.includes(code)
        ? form.colours.filter((c) => c !== code)
        : [...form.colours, code],
    });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateForm(form, mode);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await onSubmit({ body: toBody(form), code: form.code, active: isActive });
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError(
          error instanceof ApiError
            ? error.message
            : requestErrorMessage(error, "Chưa lưu được sản phẩm. Vui lòng thử lại sau ít phút."),
        );
      }
    }
  }

  async function addType(row: number, confirmSimilar = false): Promise<void> {
    try {
      const created = await createType.mutateAsync({ label: newLabel, confirm_similar: confirmSimilar })
      patch({
        tailorMeasurements: form.tailorMeasurements.map((m, j) => (j === row ? { ...m, key: created.key, label: created.label } : m)),
      })
      setCreatingRow(null)
      setErrors((e) => ({ ...e, [`measurement-${row}`]: "" }))
    } catch (error) {
      if (error instanceof ApiError && error.code === "similar_measurement" && window.confirm(error.message)) {
        await addType(row, true)
        return
      }
      const message = requestErrorMessage(error, "Chưa tạo được loại số đo. Vui lòng thử lại sau ít phút.")
      setErrors((e) => ({ ...e, [`measurement-${row}`]: error instanceof ApiError ? error.message : message }))
    }
  }

  async function saveRename(row: number): Promise<void> {
    const key = form.tailorMeasurements[row]?.key
    if (!key) return
    try {
      const renamed = await renameType.mutateAsync({ key, label: renameLabel })
      patch({
        tailorMeasurements: form.tailorMeasurements.map((m) => (m.key === key ? { ...m, label: renamed.label } : m)),
      })
      setRenamingRow(null)
      setErrors((e) => ({ ...e, [`measurement-${row}`]: "" }))
    } catch (error) {
      const message = requestErrorMessage(error, "Chưa đổi được tên loại số đo. Vui lòng thử lại sau ít phút.")
      setErrors((e) => ({ ...e, [`measurement-${row}`]: error instanceof ApiError ? error.message : message }))
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormSection title="Thông tin sản phẩm">
        <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Field id="product-name" label="Tên sản phẩm" error={errors.name}>
            {(c) => (
              <Input
                {...c}
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            )}
          </Field>
          <Field id="product-code" label="Mã sản phẩm" error={errors.code}>
            {(c) => (
              <Input
                {...c}
                value={form.code}
                disabled={mode === "edit"}
                placeholder="quan_sooc_kaki_nam"
                onChange={(e) => patch({ code: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field
          id="product-description"
          label="Mô tả"
          error={errors.description}
        >
          {(c) => (
            <textarea
              {...c}
              rows={3}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
          )}
        </Field>
        <Field
          id="product-master"
          label="Mã sản phẩm gốc"
          error={
            errors.master_product_id ??
            (baseProducts.isError
              ? "Chưa tải được danh sách sản phẩm gốc. Bấm Thử lại hoặc quay lại sau ít phút."
              : undefined)
          }
        >
          {(c) => (
            <NativeSelect
              {...c}
              value={form.masterProductId}
              disabled={baseProducts.isPending || baseProducts.isError}
              onChange={(e) => patch({ masterProductId: e.target.value })}
            >
              <option value="">Chưa liên kết</option>
              {(baseProducts.data ?? []).map((record) => (
                <option key={record.id} value={record.id}>
                  {record.data["Mã SP nền"]} · {record.data["Tên sản phẩm"] ?? ""}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Field
            id="product-gender"
            label="Giới tính gợi ý"
            error={errors.gender_target}
          >
            {(c) => (
              <NativeSelect
                {...c}
                value={form.genderTarget}
                onChange={(e) =>
                  patch({ genderTarget: e.target.value as GenderTarget })
                }
              >
                {GENDER_TARGETS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {mode === "edit" ? (
            <label className="flex min-h-10 items-center gap-2 self-end text-base">
              <input
                type="checkbox"
                checked={!isActive}
                onChange={(e) => setIsActive(!e.target.checked)}
                className="size-4"
              />
              Ẩn sản phẩm (không dùng cho đợt mới)
            </label>
          ) : null}
        </div>
        <fieldset
          aria-describedby={
            errors.colours ? "product-colours-error" : undefined
          }
        >
          <legend className="mb-2 text-base font-medium">Màu</legend>
          <div className="flex flex-wrap gap-2">
            {(colours.data ?? []).map((colour) => (
              <label
                key={colour.code}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring sm:min-h-10"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.colours.includes(colour.code)}
                  onChange={() => toggleColour(colour.code)}
                />
                {form.colours.includes(colour.code) ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : null}
                {colour.label}
              </label>
            ))}
          </div>
          {errors.colours ? (
            <p
              id="product-colours-error"
              role="alert"
              className="mt-2 text-[15px] font-medium text-destructive"
            >
              {errors.colours}
            </p>
          ) : null}
        </fieldset>
      </FormSection>

      <FormSection title="Cỡ và bảng cỡ tạm">
        <p className="max-w-[65ch] text-sm text-muted-foreground">Kéo để đổi thứ tự. Để trống ô &quot;đến&quot; nếu không giới hạn, trống cả hàng nếu cỡ chưa có bảng cỡ.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-8" />
                <th className="px-1 font-medium">Cỡ</th>
                <th className="px-1 font-medium">Cao từ (cm)</th>
                <th className="px-1 font-medium">Cao đến (cm)</th>
                <th className="px-1 font-medium">Nặng từ (kg)</th>
                <th className="px-1 font-medium">Nặng đến (kg)</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {form.sizes.map((row, i) => (
                <tr
                  key={i}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null)
                      patch({ sizes: moveRow(form.sizes, dragFrom, i) });
                    setDragFrom(null);
                  }}
                  aria-label={`Cỡ ${row.label || i + 1}`}
                >
                  <td
                    className="cursor-grab text-muted-foreground"
                    aria-hidden="true"
                  >
                    <GripVertical className="size-4" />
                  </td>
                  {(
                    [
                      ["label", "Cỡ"],
                      ["heightMin", "Chiều cao từ"],
                      ["heightMax", "Chiều cao đến"],
                      ["weightMin", "Cân nặng từ"],
                      ["weightMax", "Cân nặng đến"],
                    ] as const
                  ).map(([key, label]) => (
                    <td key={key} className="px-1">
                      <Input
                        aria-label={`${label}, hàng ${i + 1}`}
                        aria-invalid={errors[`size-${i}`] ? true : undefined}
                        inputMode={key === "label" ? "text" : "decimal"}
                        value={row[key]}
                        onChange={(e) => patchRow(i, { [key]: e.target.value })}
                        className={CELL}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Đưa cỡ ${row.label} lên`}
                      disabled={i === 0}
                      onClick={() =>
                        patch({ sizes: moveRow(form.sizes, i, i - 1) })
                      }
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Đưa cỡ ${row.label} xuống`}
                      disabled={i === form.sizes.length - 1}
                      onClick={() =>
                        patch({ sizes: moveRow(form.sizes, i, i + 1) })
                      }
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xóa cỡ ${row.label}`}
                      onClick={() =>
                        patch({ sizes: form.sizes.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {form.sizes.map((_, i) =>
          errors[`size-${i}`] ? (
            <p
              key={i}
              role="alert"
              className="text-[15px] font-medium text-destructive"
            >
              Hàng {i + 1}: {errors[`size-${i}`]}
            </p>
          ) : null,
        )}
        {errors.sizes ? (
          <p role="alert" className="text-[15px] font-medium text-destructive">
            {errors.sizes}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => patch({ sizes: [...form.sizes, emptySizeRow()] })}
          >
            <Plus /> Thêm cỡ
          </Button>
        </div>
      </FormSection>

      <FormSection title="Số đo may riêng">
        <p className="max-w-[65ch] text-sm text-muted-foreground">Sản phẩm có số đo sẽ tự động cho phép đặt may riêng trong mọi đợt đăng ký.</p>
        {form.tailorMeasurements.map((measurement, i) => {
          const update = (next: Partial<TailorMeasurement>) =>
            patch({ tailorMeasurements: form.tailorMeasurements.map((row, j) => (j === i ? { ...row, ...next } : row)) })
          const taken = new Set(form.tailorMeasurements.filter((_, j) => j !== i).map((row) => row.key))
          return (
            <div key={i} className="grid gap-3 border-t border-hairline pt-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              <Field id={`measurement-type-${i}`} label="Loại số đo">
                {(c) => (
                  <NativeSelect
                    {...c}
                    value={creatingRow === i ? OTHER : measurement.key}
                    onChange={(e) => {
                      if (e.target.value === OTHER) {
                        setCreatingRow(i)
                        setNewLabel("")
                        return
                      }
                      setCreatingRow(null)
                      const chosen = (measurementTypes.data ?? []).find((t) => t.key === e.target.value)
                      update({ key: chosen?.key ?? "", label: chosen?.label ?? "" })
                    }}
                  >
                    <option value="">Chọn loại số đo</option>
                    {(measurementTypes.data ?? []).map((t) => (
                      <option key={t.key} value={t.key} disabled={taken.has(t.key)}>{t.label}</option>
                    ))}
                    <option value={OTHER}>Khác (tạo loại số đo mới)</option>
                  </NativeSelect>
                )}
              </Field>
              {creatingRow === i ? (
                <div className="flex flex-wrap items-end gap-3">
                  <Field id={`measurement-new-${i}`} label="Tên loại số đo mới" className="min-w-0 flex-1">
                    {(c) => <Input {...c} autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />}
                  </Field>
                  <Button type="button" disabled={!newLabel.trim() || createType.isPending} onClick={() => void addType(i)}>
                    Tạo loại số đo
                  </Button>
                </div>
              ) : null}
              {renamingRow === i ? (
                <div className="flex flex-wrap items-end gap-3 md:col-span-2">
                  <Field id={`measurement-rename-${i}`} label="Tên mới cho loại số đo này" className="min-w-0 flex-1">
                    {(c) => <Input {...c} value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} />}
                  </Field>
                  <Button type="button" disabled={!renameLabel.trim() || renameType.isPending} onClick={() => void saveRename(i)}>
                    Lưu tên
                  </Button>
                </div>
              ) : null}
              <Field id={`measurement-instruction-${i}`} label="Nội dung hướng dẫn đo" className="md:col-span-2">
                {(c) => <Input {...c} value={measurement.instruction} onChange={(e) => update({ instruction: e.target.value })} />}
              </Field>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={measurement.required} onChange={(e) => update({ required: e.target.checked })} />
                  Bắt buộc
                </label>
                <Button type="button" variant="outline" onClick={() => patch({ tailorMeasurements: form.tailorMeasurements.filter((_, j) => j !== i) })}>Xóa</Button>
                {measurement.key && creatingRow !== i ? (
                  <Button type="button" variant="outline" onClick={() => { setRenamingRow(i); setRenameLabel(measurement.label) }}>
                    Đổi tên loại
                  </Button>
                ) : null}
              </div>
              {errors[`measurement-${i}`] ? <p role="alert" className="text-destructive">{errors[`measurement-${i}`]}</p> : null}
            </div>
          )
        })}
        <div><Button type="button" variant="outline" disabled={form.tailorMeasurements.length >= 30} onClick={() => patch({ tailorMeasurements: [...form.tailorMeasurements, { key: "", label: "", instruction: "", required: true }] })}><Plus /> Thêm số đo</Button></div>
      </FormSection>

      {formError ? (
        <p role="alert" className="font-medium text-destructive">
          {formError}
        </p>
      ) : null}
      <div>
        <Button type="submit" className="h-11 md:h-10" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
