from pydantic import BaseModel


class ProductUsage(BaseModel):
    product_code: str
    product_name: str
    students_tried: int
    trials: int


class SizeGuideAccuracy(BaseModel):
    product_code: str
    product_name: str
    evaluated: int
    exact: int
    off_by_one: int
    off_by_two_plus: int
    exact_rate: float | None


class Overview(BaseModel):
    total_students: int
    students_with_trials: int
    total_trials: int
    students_with_notes: int
    by_product: list[ProductUsage]
    size_guide_accuracy: list[SizeGuideAccuracy]


class SizeCount(BaseModel):
    size_label: str | None
    count: int
    percent: float


class SizeDistribution(BaseModel):
    product_code: str
    total: int
    sizes: list[SizeCount]


class MatrixRow(BaseModel):
    class_id: str
    class_name: str
    grade: int
    counts: dict[str, int]
    unknown: int
    total: int


class MatrixTotals(BaseModel):
    counts: dict[str, int]
    unknown: int
    total: int


class ClassMatrix(BaseModel):
    product_code: str
    sizes: list[str]
    rows: list[MatrixRow]
    totals: MatrixTotals


class SurveySchoolRow(BaseModel):
    school_name: str
    province: str
    school_area: str
    responses: int


class SurveyOverview(BaseModel):
    total_responses: int
    unique_children: int
    with_all_girths: int
    by_area: dict[str, int]
    by_gender: dict[str, int]
    by_measure_method: dict[str, int]
    by_supply_option: dict[str, int]
    schools: list[SurveySchoolRow]
