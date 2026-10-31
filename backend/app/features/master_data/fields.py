"""Master record fields and the rules that flag incomplete records."""

FIELDS = {
    "facilities": (
        "Mã cơ sở",
        "Tên cơ sở/đối tác",
        "Đầu mối",
        "Mô hình",
        "Nhóm sản phẩm",
        "Công đoạn chính",
        "Phạm vi trách nhiệm",
        "Tiêu chí QC trọng tâm",
        "Trạng thái hợp tác",
        "Tên pháp lý",
        "MST/CCCD",
        "Địa chỉ",
        "SĐT",
        "Email",
        "Hồ sơ pháp lý",
    ),
    "materials": (
        "Mã NPL",
        "Nhóm NPL",
        "Tên NPL",
        "Mã/Nhãn NCC",
        "NCC",
        "Dự án/Phân khúc",
        "Sản phẩm áp dụng",
        "Thành phần",
        "Khổ/Bản",
        "Định lượng",
        "Màu",
        "Xuất xứ",
        "ĐVT",
        "MOQ",
        "Lead time",
        "Hồ sơ hiện có",
        "Hồ sơ còn thiếu",
        "Tiêu chí kiểm soát",
        "Trạng thái phê duyệt",
        "Ghi chú",
    ),
    "suppliers": (
        "Mã NCC",
        "Tên NCC/Đối tác",
        "Đầu mối",
        "Nhóm cung cấp",
        "NPL/Dịch vụ chính",
        "Xuất xứ/Khu vực",
        "Dự án/Phân khúc áp dụng",
        "MOQ",
        "Lead time",
        "Hồ sơ hiện có",
        "Hồ sơ còn thiếu",
        "Tiêu chí đánh giá chính",
        "Trạng thái phê duyệt",
        "Ngày đánh giá gần nhất",
        "Ngày đánh giá lại",
        "Ghi chú",
    ),
    "products": (
        "Mã SP nền",
        "Mã phân khúc",
        "Phân khúc",
        "Nhóm SP",
        "Tên sản phẩm",
        "Giới tính",
        "Dải cỡ chuẩn",
        "Mô hình SX",
        "Tiêu chí QC chính",
        "Cơ sở xây dựng danh mục",
        "Vai trò trong Master",
        "Trạng thái áp dụng",
    ),
}
REQUIRED = {
    "facilities": (
        "Mã cơ sở",
        "Tên cơ sở/đối tác",
        "Đầu mối",
        "Mô hình",
        "Nhóm sản phẩm",
        "Công đoạn chính",
        "Phạm vi trách nhiệm",
        "Tiêu chí QC trọng tâm",
        "Trạng thái hợp tác",
        "SĐT",
    ),
    "materials": (
        "Mã NPL",
        "Nhóm NPL",
        "Tên NPL",
        "Dự án/Phân khúc",
        "Sản phẩm áp dụng",
        "Màu",
        "ĐVT",
        "Lead time",
        "Hồ sơ hiện có",
        "Tiêu chí kiểm soát",
        "Trạng thái phê duyệt",
    ),
    "suppliers": (
        "Mã NCC",
        "Tên NCC/Đối tác",
        "Đầu mối",
        "Nhóm cung cấp",
        "NPL/Dịch vụ chính",
        "Xuất xứ/Khu vực",
        "Dự án/Phân khúc áp dụng",
        "Lead time",
        "Hồ sơ hiện có",
        "Tiêu chí đánh giá chính",
        "Trạng thái phê duyệt",
    ),
    "products": ("Mã SP nền", "Tên sản phẩm"),
}

CONDITIONAL_REQUIRED = {
    # "Có trước phê duyệt" in the workbook: a facility already in use must have them.
    "facilities": (
        {"field": "Địa chỉ", "when": "Trạng thái hợp tác", "equals": "Đang sử dụng"},
        {"field": "Hồ sơ pháp lý", "when": "Trạng thái hợp tác", "equals": "Đang sử dụng"},
    ),
    "materials": (
        {"field": "Thành phần", "when": "Nhóm NPL", "starts_with": "Vải"},
        {"field": "NCC", "when": "Trạng thái phê duyệt", "equals": "Đã phê duyệt"},
        {"field": "Xuất xứ", "when": "Trạng thái phê duyệt", "equals": "Đã phê duyệt"},
    ),
    "suppliers": (),
    "products": (),
}


def missing_fields(kind: str, data: dict[str, str | None]) -> list[str]:
    """Required and conditionally required fields that are empty, in field order."""
    required = set(REQUIRED[kind])
    for rule in CONDITIONAL_REQUIRED[kind]:
        value = data.get(rule["when"]) or ""
        matches = (
            value.startswith(rule["starts_with"])
            if "starts_with" in rule
            else value == rule["equals"]
        )
        if matches:
            required.add(rule["field"])
    return [
        field for field in FIELDS[kind] if field in required and not (data.get(field) or "").strip()
    ]
