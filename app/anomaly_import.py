"""CSV/XLSX experimental-data importer for the AD module.

The parser deliberately accepts only tabular values and returns the common AD
structure.  It uses the standard library so the local demo does not require a
large spreadsheet dependency merely to accept an uploaded workbook.
"""

from __future__ import annotations

import base64
import binascii
import csv
import io
import re
import zipfile
from collections import defaultdict
from typing import Any
from xml.etree import ElementTree


MAX_IMPORT_BYTES = 2 * 1024 * 1024
_COLUMN_ALIASES = {
    "voltage_V": {"voltage_v", "voltage", "u_v", "电压_v", "电压"},
    "current_mA": {"current_ma", "current", "i_ma", "电流_ma", "电流"},
    "current_A": {"current_a", "i_a", "电流_a"},
    "run_id": {"run_id", "run", "实验组", "组号"},
    "point_index": {"point_index", "point", "测量点", "序号"},
    "expected_resistance_ohm": {"expected_resistance_ohm", "resistance_ohm", "参考电阻", "参考电阻_ohm"},
}


def _column_name(value: object) -> str | None:
    raw = str(value).strip().lower()
    for canonical, aliases in _COLUMN_ALIASES.items():
        if raw in aliases:
            return canonical
    return None


def _cell_coordinate(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        return 0
    result = 0
    for char in letters.group(0):
        result = result * 26 + ord(char) - 64
    return result - 1


def _xlsx_rows(content: bytes) -> list[list[str]]:
    namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with zipfile.ZipFile(io.BytesIO(content)) as workbook:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            tree = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared = ["".join(node.itertext()) for node in tree.findall(f"{namespace}si")]
        sheets = sorted(name for name in workbook.namelist() if name.startswith("xl/worksheets/") and name.endswith(".xml"))
        if not sheets:
            raise ValueError("Excel 文件中没有可读取的工作表。")
        tree = ElementTree.fromstring(workbook.read(sheets[0]))
        result: list[list[str]] = []
        for row in tree.findall(f".//{namespace}sheetData/{namespace}row"):
            cells: dict[int, str] = {}
            for cell in row.findall(f"{namespace}c"):
                index = _cell_coordinate(cell.attrib.get("r", "A1"))
                value = cell.findtext(f"{namespace}v", default="")
                if cell.attrib.get("t") == "s" and value:
                    value = shared[int(value)]
                elif cell.attrib.get("t") == "inlineStr":
                    value = "".join(cell.itertext())
                cells[index] = value
            if cells:
                result.append([cells.get(index, "") for index in range(max(cells) + 1)])
        return result


def _csv_rows(content: bytes) -> list[list[str]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("CSV 请保存为 UTF-8 编码后再导入。") from exc
    return list(csv.reader(io.StringIO(text)))


def parse_tabular_upload(filename: str, content_base64: str) -> list[dict[str, Any]]:
    """Return grouped voltage/current series from a CSV or XLSX upload."""

    try:
        content = base64.b64decode(content_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("上传文件内容无法读取。") from exc
    if not content or len(content) > MAX_IMPORT_BYTES:
        raise ValueError("上传文件不能为空，且不能超过 2 MB。")
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "csv":
        rows = _csv_rows(content)
    elif suffix == "xlsx":
        try:
            rows = _xlsx_rows(content)
        except zipfile.BadZipFile as exc:
            raise ValueError("该文件不是有效的 XLSX 工作簿。") from exc
    else:
        raise ValueError("仅支持 CSV 或 XLSX 文件。")
    if len(rows) < 2:
        raise ValueError("文件至少应包含一行表头和一行数据。")
    headers = [_column_name(value) for value in rows[0]]
    if "voltage_V" not in headers or ("current_mA" not in headers and "current_A" not in headers):
        raise ValueError("表头必须包含 voltage_V 和 current_mA（或 current_A，也可使用中文电压/电流列名）。")
    index = {name: headers.index(name) for name in set(headers) if name}
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for source_row in rows[1:]:
        def value(name: str) -> str:
            column = index.get(name)
            return source_row[column].strip() if column is not None and column < len(source_row) else ""
        voltage = value("voltage_V")
        current_mA = value("current_mA")
        current_A = value("current_A")
        current = current_mA or current_A
        if not voltage and not current:
            continue
        if not voltage:
            raise ValueError("每一行都必须填写电压。")
        groups[value("run_id") or "导入实验组 1"].append(
            {
                "voltage": voltage,
                "current": current,
                "current_unit": "mA" if current_mA else "A",
                "resistance": value("expected_resistance_ohm"),
                "point": value("point_index"),
            }
        )
    if not groups:
        raise ValueError("文件中没有可用的电压、电流数据。")
    response: list[dict[str, Any]] = []
    for run_id, values in groups.items():
        def point_order(item: dict[str, str]) -> float:
            try:
                return float(item["point"]) if item["point"] else float("inf")
            except ValueError:
                return float("inf")

        values.sort(key=point_order)
        try:
            voltage = [float(item["voltage"]) for item in values]
            current = [
                (float(item["current"]) * 1000 if item["current_unit"] == "A" else float(item["current"]))
                if item["current"]
                else None
                for item in values
            ]
        except ValueError as exc:
            raise ValueError(f"实验组“{run_id}”含有非数值电压或电流。") from exc
        metadata: dict[str, float] = {}
        resistance = next((item["resistance"] for item in values if item["resistance"]), "")
        if resistance:
            try:
                metadata["expected_resistance_ohm"] = float(resistance)
            except ValueError as exc:
                raise ValueError("参考电阻必须是数值。") from exc
        response.append({"run_id": run_id, "voltage_V": voltage, "current_mA": current, "metadata": metadata})
    return response
