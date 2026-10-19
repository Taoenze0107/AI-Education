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
import zlib
from collections import defaultdict
from typing import Any
from xml.etree import ElementTree


MAX_IMPORT_BYTES = 2 * 1024 * 1024
# These imports are short laboratory tables, not general-purpose spreadsheets.
# Limits apply before XML trees or sparse cell ranges can expand in memory.
MAX_IMPORT_ROWS = 501  # One header plus at most 500 measurements.
MAX_IMPORT_COLUMNS = 64
MAX_IMPORT_CELLS = 16_000
MAX_CELL_CHARACTERS = 4_096
MAX_XLSX_ENTRIES = 128
MAX_XLSX_MEMBER_BYTES = 2 * 1024 * 1024
MAX_XLSX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024
MAX_XLSX_COMPRESSION_RATIO = 200
XLSX_RATIO_ALLOWANCE_BYTES = 64 * 1024
MAX_XLSX_XML_NODES = 64_000
_XLSX_NAMESPACE = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
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


def _cell_location(reference: str) -> tuple[int, int]:
    # Validate the complete coordinate, including its row, before using it to
    # construct a list. Excel's full XFD/1,048,576 grid is unnecessary here.
    match = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]{0,6})", reference)
    if not match:
        raise ValueError("Excel 单元格坐标无效。")
    result = 0
    for char in match.group(1):
        result = result * 26 + ord(char) - 64
    row = int(match.group(2))
    if result > MAX_IMPORT_COLUMNS or row > MAX_IMPORT_ROWS:
        raise ValueError("Excel 数据范围过大：最多 500 行读数、64 列。")
    return result - 1, row


def _cell_coordinate(reference: str) -> int:
    return _cell_location(reference)[0]


class _BoundedWorkbookTree(ElementTree.TreeBuilder):
    """Reject entity expansion and excessive structure while building XML."""

    def __init__(self) -> None:
        super().__init__()
        self.nodes = self.rows = self.cells = self.strings = 0

    def doctype(self, name: str, pubid: str | None, system: str | None) -> None:
        raise ValueError("Excel XML 不支持 DTD 或实体声明。")

    def start(self, tag: str, attrs: dict[str, str]):
        self.nodes += 1
        if self.nodes > MAX_XLSX_XML_NODES:
            raise ValueError("Excel XML 结构过于复杂。")
        if tag == f"{_XLSX_NAMESPACE}row":
            self.rows += 1
            row_number = attrs.get("r")
            if self.rows > MAX_IMPORT_ROWS or (
                row_number is not None
                and (not re.fullmatch(r"[1-9][0-9]{0,6}", row_number)
                     or int(row_number) > MAX_IMPORT_ROWS)
            ):
                raise ValueError("Excel 数据范围过大：最多 500 行读数、64 列。")
        elif tag == f"{_XLSX_NAMESPACE}c":
            self.cells += 1
            if self.cells > MAX_IMPORT_CELLS:
                raise ValueError("Excel 单元格数量过多。")
            if "r" in attrs:
                _cell_location(attrs["r"])
        elif tag == f"{_XLSX_NAMESPACE}si":
            self.strings += 1
            if self.strings > MAX_IMPORT_CELLS:
                raise ValueError("Excel 共享文本数量过多。")
        return super().start(tag, attrs)


def _read_xlsx_member(workbook, member: zipfile.ZipInfo, remaining: int) -> bytes:
    """Bound actual decompressor output as well as the untrusted ZIP headers."""

    ratio_limit = max(
        XLSX_RATIO_ALLOWANCE_BYTES,
        member.compress_size * MAX_XLSX_COMPRESSION_RATIO,
    )
    limit = min(MAX_XLSX_MEMBER_BYTES, remaining, ratio_limit)
    chunks: list[bytes] = []
    size = 0
    with workbook.open(member) as stream:
        while True:
            chunk = stream.read(min(64 * 1024, limit - size + 1))
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                raise ValueError("Excel 解压后的内容过大或压缩比例异常。")
            chunks.append(chunk)
    return b"".join(chunks)


def _xlsx_xml(content: bytes):
    parser = ElementTree.XMLParser(target=_BoundedWorkbookTree())
    return ElementTree.fromstring(content, parser=parser)


def _checked_text(value: str) -> str:
    if len(value) > MAX_CELL_CHARACTERS:
        raise ValueError("单个单元格的内容过长。")
    return value


def _xlsx_rows(content: bytes) -> list[list[str]]:
    namespace = _XLSX_NAMESPACE
    try:
        return _read_xlsx_rows(content, namespace)
    except (
        zipfile.BadZipFile, zipfile.LargeZipFile, ElementTree.ParseError,
        RuntimeError, NotImplementedError, OSError, EOFError, UnicodeError, LookupError,
        zlib.error,
    ) as exc:
        raise ValueError("该文件不是受支持且完整的 XLSX 工作簿。") from exc


def _read_xlsx_rows(content: bytes, namespace: str) -> list[list[str]]:
    with zipfile.ZipFile(io.BytesIO(content)) as workbook:
        entries = workbook.infolist()
        if len(entries) > MAX_XLSX_ENTRIES:
            raise ValueError("Excel 工作簿包含过多文件。")
        names = [entry.filename for entry in entries]
        if len(set(names)) != len(names):
            raise ValueError("Excel 工作簿包含重复文件。")
        if sum(entry.file_size for entry in entries) > MAX_XLSX_UNCOMPRESSED_BYTES:
            raise ValueError("Excel 解压后的总大小不能超过 8 MB。")
        for entry in entries:
            if entry.flag_bits & 1 or entry.compress_type not in {
                zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED,
            }:
                raise ValueError("Excel 不支持加密或此类 ZIP 压缩方式。")
            if entry.file_size > MAX_XLSX_MEMBER_BYTES:
                raise ValueError("Excel 解压后的单个文件不能超过 2 MB。")
            if entry.file_size > max(
                XLSX_RATIO_ALLOWANCE_BYTES,
                entry.compress_size * MAX_XLSX_COMPRESSION_RATIO,
            ):
                raise ValueError("Excel 压缩比例异常，请将读数另存为 CSV 后导入。")
        total_read = 0

        def read_xml(name: str):
            nonlocal total_read
            data = _read_xlsx_member(
                workbook, workbook.getinfo(name),
                MAX_XLSX_UNCOMPRESSED_BYTES - total_read,
            )
            total_read += len(data)
            return _xlsx_xml(data)

        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            tree = read_xml("xl/sharedStrings.xml")
            shared = [_checked_text("".join(node.itertext())) for node in tree.findall(f"{namespace}si")]
        sheets = sorted(name for name in names if re.fullmatch(r"xl/worksheets/[^/]+\.xml", name))
        if not sheets:
            raise ValueError("Excel 文件中没有可读取的工作表。")
        tree = read_xml(sheets[0])
        result: list[list[str]] = []
        for row in tree.findall(f"{namespace}sheetData/{namespace}row"):
            cells: dict[int, str] = {}
            for implicit_index, cell in enumerate(row.findall(f"{namespace}c")):
                index = _cell_coordinate(cell.attrib["r"]) if "r" in cell.attrib else implicit_index
                if index >= MAX_IMPORT_COLUMNS:
                    raise ValueError("Excel 数据范围过大：最多 500 行读数、64 列。")
                if index in cells:
                    raise ValueError("Excel 工作表包含重复单元格坐标。")
                value = cell.findtext(f"{namespace}v", default="")
                if cell.attrib.get("t") == "s":
                    if not re.fullmatch(r"[0-9]{1,6}", value) or int(value) >= len(shared):
                        raise ValueError("Excel 单元格引用了不存在的共享文本。")
                    value = shared[int(value)]
                elif cell.attrib.get("t") == "inlineStr":
                    inline = cell.find(f"{namespace}is")
                    value = "".join(inline.itertext()) if inline is not None else ""
                cells[index] = _checked_text(value)
            if cells:
                result.append([cells.get(index, "") for index in range(max(cells) + 1)])
        return result


def _csv_rows(content: bytes) -> list[list[str]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("CSV 请保存为 UTF-8 编码后再导入。") from exc
    result: list[list[str]] = []
    cells = 0
    try:
        for row in csv.reader(io.StringIO(text)):
            cells += len(row)
            if len(result) >= MAX_IMPORT_ROWS or len(row) > MAX_IMPORT_COLUMNS or cells > MAX_IMPORT_CELLS:
                raise ValueError("表格过大：最多 500 行读数、64 列、16000 个单元格。")
            result.append([_checked_text(value) for value in row])
    except csv.Error as exc:
        raise ValueError("CSV 内容无效或单个单元格过长。") from exc
    return result


def parse_tabular_upload(filename: str, content_base64: str) -> list[dict[str, Any]]:
    """Return grouped voltage/current series from a CSV or XLSX upload."""

    if len(content_base64) > ((MAX_IMPORT_BYTES + 2) // 3) * 4:
        raise ValueError("上传文件不能为空，且不能超过 2 MB。")
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
