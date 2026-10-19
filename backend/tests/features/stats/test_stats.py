import uuid
from typing import Any

from app.features.parent_portal.models import ParentSizeChoice
from app.features.students.models import DataSource


def school_id(school_class: dict[str, Any]) -> str:
    return str(school_class["school_id"])


async def test_stats_require_session(anon_client: Any) -> None:
    sid = uuid.uuid4()
    for url in (
        "/api/stats/overview",
        "/api/stats/size-distribution?product=blazer",
        f"/api/stats/class-matrix?product=blazer&school_id={sid}",
        "/api/stats/orders",
    ):
        response = await anon_client.get(url)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthorized"


async def test_overview_counts_and_accuracy(client: Any, make_student: Any) -> None:
    await make_student("A", [("blazer", "3", "FITS", "3")])
    await make_student("B", [("blazer", "2", "FITS", "3"), ("blazer", "4", "FITS", "3")])
    await make_student("C", [("blazer", "5", "FITS", "2")], note="rộng vai")
    await make_student("D", [("blazer", "4", "FITS", None)])
    await make_student("E", [("blazer", "3", "TOO_TIGHT", "3")])
    await make_student("F", [], deleted=False)
    await make_student("Gone", [("blazer", "3", "FITS", "3")], deleted=True)
    await make_student(
        "H", [("gile", "2", "FITS", "2")], deleted_trials=[("blazer", "6", "FITS", "6")]
    )

    body = (await client.get("/api/stats/overview")).json()

    assert body["total_students"] == 7
    assert body["students_with_trials"] == 6
    assert body["total_trials"] == 7
    assert body["students_with_notes"] == 1
    by_product = {p["product_code"]: p for p in body["by_product"]}
    assert by_product["blazer"]["students_tried"] == 5
    assert by_product["blazer"]["trials"] == 6
    assert by_product["gile"]["students_tried"] == 1
    accuracy = {a["product_code"]: a for a in body["size_guide_accuracy"]}
    blazer = accuracy["blazer"]
    assert (blazer["evaluated"], blazer["exact"]) == (3, 1)
    assert (blazer["off_by_one"], blazer["off_by_two_plus"]) == (1, 1)
    assert blazer["exact_rate"] == 1 / 3
    assert accuracy["gile"]["evaluated"] == 1
    assert accuracy["gile"]["exact_rate"] == 1.0


async def test_accuracy_null_rate_without_data(client: Any, make_student: Any) -> None:
    await make_student("A", [("blazer", "3", "FITS", None)])

    accuracy = (await client.get("/api/stats/overview")).json()["size_guide_accuracy"]

    assert all(a["evaluated"] == 0 and a["exact_rate"] is None for a in accuracy)


async def test_overview_school_filter(
    client: Any,
    make_student: Any,
    make_school: Any,
    make_class: Any,
    school_class: dict[str, Any],
) -> None:
    other = await make_school("Trường khác", "OTHER")
    await make_student("A", [("blazer", "3", "FITS", "3")])
    other_class = await make_class(1, "X1", school_id=other.id)
    await make_student(
        "B", [("blazer", "3", "FITS", "3")], school_id=other.id, class_id=other_class.id
    )

    body = (
        await client.get("/api/stats/overview", params={"school_id": school_id(school_class)})
    ).json()

    assert body["total_students"] == 1


async def test_size_distribution_percent_and_unknown(client: Any, make_student: Any) -> None:
    await make_student("A", [("blazer", "3", "FITS", "3")])
    await make_student("B", [("blazer", "3", "FITS", "3"), ("blazer", "2", "FITS", "3")])
    await make_student("C", [("blazer", "4", "TOO_LOOSE", "3")])
    await make_student("Gone", [("blazer", "5", "FITS", "3")], deleted=True)

    body = (await client.get("/api/stats/size-distribution", params={"product": "blazer"})).json()

    assert body["product_code"] == "blazer"
    assert body["total"] == 3
    sizes = body["sizes"]
    assert [s["size_label"] for s in sizes] == ["1", "2", "3", "4", "5", "6", "7", None]
    by_label = {s["size_label"]: s for s in sizes}
    assert (by_label["3"]["count"], by_label["3"]["percent"]) == (2, 66.7)
    assert (by_label[None]["count"], by_label[None]["percent"]) == (1, 33.3)
    assert by_label["5"]["count"] == 0
    assert sum(s["count"] for s in sizes) == body["total"]


async def test_size_distribution_empty_and_unknown_product(client: Any) -> None:
    body = (await client.get("/api/stats/size-distribution", params={"product": "blazer"})).json()
    assert body["total"] == 0
    assert all(s["percent"] == 0.0 for s in body["sizes"])

    response = await client.get("/api/stats/size-distribution", params={"product": "nope"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_class_matrix_matches_student_list(
    client: Any, make_student: Any, make_class: Any, school_class: dict[str, Any]
) -> None:
    first = str(school_class["class_id"])
    second = await make_class(1, "1A9")
    empty = await make_class(5, "5Z")
    await make_student("A", [("blazer", "3", "FITS", "3")])
    await make_student("B", [("blazer", "3", "FITS", "3")])
    await make_student("C", [("blazer", "4", "TOO_TIGHT", "3")])
    await make_student("D", [("blazer", "6", "FITS", "6")], class_id=second.id)
    await make_student("Gone", [("blazer", "3", "FITS", "3")], deleted=True)
    params = {"product": "blazer", "school_id": school_id(school_class)}

    body = (await client.get("/api/stats/class-matrix", params=params)).json()

    assert body["sizes"] == ["1", "2", "3", "4", "5", "6", "7"]
    rows = body["rows"]
    assert str(empty.id) in {r["class_id"] for r in rows}
    keys = [(r["grade"], r["class_name"]) for r in rows]
    assert keys == sorted(keys)
    assert next(r for r in rows if r["class_id"] == str(empty.id))["total"] == 0
    for row in rows:
        assert sum(row["counts"].values()) + row["unknown"] == row["total"]
        listed = await client.get(
            "/api/students", params={"school_id": params["school_id"], "class_id": row["class_id"]}
        )
        assert listed.json()["total"] == row["total"]
        for size, count in row["counts"].items():
            filtered = await client.get(
                "/api/students",
                params={"class_id": row["class_id"], "product": "blazer", "size": size},
            )
            assert filtered.json()["total"] == count
        unknown = await client.get(
            "/api/students",
            params={"class_id": row["class_id"], "product": "blazer", "size": "none"},
        )
        assert unknown.json()["total"] == row["unknown"]
    first_row = next(r for r in rows if r["class_id"] == first)
    assert first_row["counts"]["3"] == 2 and first_row["unknown"] == 1
    totals = body["totals"]
    assert totals["total"] == 4 == sum(r["total"] for r in rows)
    assert totals["unknown"] == 1
    assert totals["counts"]["3"] == 2 and totals["counts"]["6"] == 1


async def test_class_matrix_validation(client: Any) -> None:
    missing = await client.get("/api/stats/class-matrix", params={"product": "blazer"})
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "validation_error"

    unknown = await client.get(
        "/api/stats/class-matrix", params={"product": "blazer", "school_id": str(uuid.uuid4())}
    )
    assert unknown.status_code == 404


async def measured_snapshot(client: Any, school: str) -> list[Any]:
    urls = [
        "/api/stats/overview",
        "/api/stats/size-distribution?product=blazer",
        f"/api/stats/class-matrix?product=blazer&school_id={school}",
    ]
    return [(await client.get(url)).json() for url in urls]


async def test_parent_declared_students_do_not_move_measurement_stats(
    client: Any, make_student: Any, school_class: dict[str, Any], session: Any, products: Any
) -> None:
    await make_student("A", [("blazer", "3", "FITS", "3")])
    before = await measured_snapshot(client, school_id(school_class))
    declared = await make_student("Khai", data_source=DataSource.PARENT_DECLARED)
    sneaky = await make_student(
        "Khai Co Thu", [("blazer", "2", "FITS", "3")], data_source=DataSource.PARENT_DECLARED
    )
    for student in (declared, sneaky):
        session.add(
            ParentSizeChoice(
                student_id=student.id, product_id=products["blazer"].id, size_label="5"
            )
        )
    await session.commit()

    assert await measured_snapshot(client, school_id(school_class)) == before


async def test_orders_count_every_data_source_but_not_deleted_students(
    client: Any, make_student: Any, session: Any, products: Any
) -> None:
    measured = await make_student("A", [("blazer", "3", "FITS", "3")])
    declared = await make_student("Khai", data_source=DataSource.PARENT_DECLARED)
    another = await make_student("B")
    gone = await make_student("Gone", deleted=True)
    for student, code, size in [
        (measured, "blazer", "3"),
        (declared, "blazer", "3"),
        (declared, "gile", "2"),
        (another, "blazer", "4"),
        (gone, "blazer", "3"),
    ]:
        session.add(
            ParentSizeChoice(student_id=student.id, product_id=products[code].id, size_label=size)
        )
    await session.commit()

    body = (await client.get("/api/stats/orders")).json()

    by_code = {p["product_code"]: p for p in body["products"]}
    assert set(by_code) == {"blazer", "gile"}
    blazer = by_code["blazer"]
    assert blazer["product_name"] == "Áo Blazer (Vest)" and blazer["total"] == 3
    assert [s["size_label"] for s in blazer["sizes"]] == ["1", "2", "3", "4", "5", "6", "7"]
    assert {s["size_label"]: s["count"] for s in blazer["sizes"] if s["count"]} == {"3": 2, "4": 1}
    assert by_code["gile"]["total"] == 1
    assert {s["size_label"]: s["count"] for s in by_code["gile"]["sizes"] if s["count"]} == {"2": 1}


async def test_orders_school_filter(
    client: Any,
    make_student: Any,
    make_school: Any,
    make_class: Any,
    school_class: dict[str, Any],
    session: Any,
    products: Any,
) -> None:
    other = await make_school("Trường khác", "OTHER")
    other_class = await make_class(1, "X1", school_id=other.id)
    mine = await make_student("A")
    theirs = await make_student("B", school_id=other.id, class_id=other_class.id)
    for student in (mine, theirs):
        session.add(
            ParentSizeChoice(
                student_id=student.id, product_id=products["blazer"].id, size_label="3"
            )
        )
    await session.commit()

    scoped = (
        await client.get("/api/stats/orders", params={"school_id": school_id(school_class)})
    ).json()
    everything = (await client.get("/api/stats/orders")).json()

    assert next(p for p in scoped["products"] if p["product_code"] == "blazer")["total"] == 1
    assert next(p for p in everything["products"] if p["product_code"] == "blazer")["total"] == 2


async def test_orders_empty_has_zero_filled_sizes(client: Any) -> None:
    body = (await client.get("/api/stats/orders")).json()

    assert [p["total"] for p in body["products"]] == [0, 0]
    assert all(s["count"] == 0 for p in body["products"] for s in p["sizes"])


async def test_declared_child_with_a_choice_only_shows_up_in_orders(
    client: Any, make_student: Any, make_parent: Any, school_class: dict[str, Any]
) -> None:
    await make_student("A", [("blazer", "3", "FITS", "3")])
    before = await measured_snapshot(client, school_id(school_class))
    parent = await make_parent()
    child = (
        await parent.post(
            "/api/parent/children",
            json={
                "school_id": school_class["school_id"],
                "class_id": school_class["class_id"],
                "full_name": "Lê Minh Anh",
                "dob": "2017-09-01",
                "gender": "FEMALE",
                "height_cm": 128.5,
                "weight_kg": 25,
                "parent_phone": "0912345678",
            },
        )
    ).json()

    await parent.put(
        f"/api/parent/children/{child['student_id']}/size-choices/blazer", json={"size_label": "4"}
    )

    assert await measured_snapshot(client, school_id(school_class)) == before
    orders = (await client.get("/api/stats/orders")).json()
    blazer = next(p for p in orders["products"] if p["product_code"] == "blazer")
    assert blazer["total"] == 1
    assert [s["count"] for s in blazer["sizes"] if s["size_label"] == "4"] == [1]
