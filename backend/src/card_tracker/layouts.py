"""Binder layout parser. Layouts look like "RxC" (e.g. "3x3", "2x2", "4x3")."""
from __future__ import annotations

import re
from dataclasses import dataclass

_LAYOUT_RE = re.compile(r"^(\d+)x(\d+)$")
MIN_DIM = 1
MAX_DIM = 6  # 36 cards per page; anything bigger is unusual and stresses detection


class InvalidLayout(ValueError):
    pass


@dataclass(frozen=True)
class Layout:
    rows: int
    cols: int

    @property
    def total(self) -> int:
        return self.rows * self.cols

    def canonical(self) -> str:
        return f"{self.rows}x{self.cols}"


def parse(s: str) -> Layout:
    m = _LAYOUT_RE.match(s.strip().lower())
    if not m:
        raise InvalidLayout(
            f"Layout must look like 'RxC' (e.g. '3x3'); got '{s}'."
        )
    rows, cols = int(m.group(1)), int(m.group(2))
    if not (MIN_DIM <= rows <= MAX_DIM and MIN_DIM <= cols <= MAX_DIM):
        raise InvalidLayout(
            f"Layout dimensions must be between {MIN_DIM} and {MAX_DIM}; got {rows}x{cols}."
        )
    return Layout(rows=rows, cols=cols)
