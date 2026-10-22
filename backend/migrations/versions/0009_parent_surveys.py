"""Parent measurement surveys: one shared public form, school typed by the parent."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

UUID_PK = dict(server_default=sa.text("gen_random_uuid()"), nullable=False)
NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "survey_responses",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, **UUID_PK),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("form_version", sa.String(20), nullable=False),
        sa.Column("school_name", sa.Text, nullable=False),
        sa.Column("province", sa.Text, nullable=False),
        sa.Column("ward", sa.Text, nullable=False),
        # Derived server-side from the ward type: Phường -> URBAN, Xã / Đặc khu -> RURAL.
        sa.Column("school_area", sa.String(10), nullable=False),
        sa.Column("class_name", sa.Text, nullable=False),
        sa.Column("child_full_name", sa.Text, nullable=False),
        sa.Column("dob", sa.Date, nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("parent_phone", sa.Text, nullable=False),
        sa.Column("measured_on", sa.Date, nullable=False),
        sa.Column("measure_method", sa.String(20), nullable=False),
        sa.Column("height_cm", sa.Numeric(5, 1), nullable=False),
        sa.Column("weight_kg", sa.Numeric(4, 1), nullable=False),
        sa.Column("chest_cm", sa.Numeric(5, 1)),
        sa.Column("waist_cm", sa.Numeric(5, 1)),
        sa.Column("hip_cm", sa.Numeric(5, 1)),
        sa.Column("body_traits", pg.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("fit_preference", sa.String(10)),
        sa.Column("past_issues", pg.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("supply_option", sa.String(10), nullable=False),
        sa.CheckConstraint("school_area IN ('URBAN', 'RURAL')", name="ck_survey_school_area"),
        sa.CheckConstraint("gender IN ('MALE', 'FEMALE')", name="ck_survey_gender"),
        sa.CheckConstraint(
            "measure_method IN ('TAPE_TODAY', 'RECENT_RECORD', 'ESTIMATE')",
            name="ck_survey_measure_method",
        ),
        sa.CheckConstraint("height_cm BETWEEN 90 AND 190", name="ck_survey_height"),
        sa.CheckConstraint("weight_kg BETWEEN 10 AND 90", name="ck_survey_weight"),
        sa.CheckConstraint("chest_cm BETWEEN 40 AND 140", name="ck_survey_chest"),
        sa.CheckConstraint("waist_cm BETWEEN 35 AND 140", name="ck_survey_waist"),
        sa.CheckConstraint("hip_cm BETWEEN 40 AND 150", name="ck_survey_hip"),
        sa.CheckConstraint(
            "fit_preference IS NULL OR fit_preference IN ('SLIM', 'REGULAR', 'LOOSE')",
            name="ck_survey_fit_preference",
        ),
        sa.CheckConstraint(
            "supply_option IN ('STANDARD', 'TAILOR')", name="ck_survey_supply_option"
        ),
    )
    op.create_index("ix_survey_responses_created", "survey_responses", ["created_at"])
    # DELETE stays allowed: spam purge and parents' data-erasure requests.
    op.execute(
        """
        CREATE FUNCTION survey_responses_immutable() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'survey_responses rows are immutable';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER survey_responses_no_update
        BEFORE UPDATE ON survey_responses
        FOR EACH ROW EXECUTE FUNCTION survey_responses_immutable()
        """
    )


def downgrade() -> None:
    op.drop_table("survey_responses")
    op.execute("DROP FUNCTION IF EXISTS survey_responses_immutable()")
