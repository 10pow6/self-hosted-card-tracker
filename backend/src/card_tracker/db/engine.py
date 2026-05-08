import sqlite3
from contextlib import contextmanager
from pathlib import Path

from card_tracker.config import settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or settings.db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: Path | None = None) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA_PATH.read_text())
        _migrate_columns(conn)


_REQUIRED_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "core_card": [
        ("metadata_confidence", "REAL"),
        ("metadata_source", "TEXT"),
    ],
}


def _migrate_columns(conn: sqlite3.Connection) -> None:
    """Idempotently add columns that newer code expects but old DBs lack.
    SQLite has no `ADD COLUMN IF NOT EXISTS`, so we read pragma_table_info first.
    """
    for table, cols in _REQUIRED_COLUMNS.items():
        existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        for col_name, col_type in cols:
            if col_name not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
        conn.commit()


@contextmanager
def transaction(db_path: Path | None = None):
    conn = connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
