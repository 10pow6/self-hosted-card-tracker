from card_tracker.config import settings
from card_tracker.db.engine import init_db


def main() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    print(f"Initialized database at {settings.db_path}")


if __name__ == "__main__":
    main()
