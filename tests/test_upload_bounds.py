"""Small, local regression fixtures for untrusted laboratory table uploads."""

import base64
import io
import struct
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import anomaly_import as importer
from app.config import Settings
from app.main import create_app


NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
SHEET = "xl/worksheets/sheet1.xml"
STRINGS = "xl/sharedStrings.xml"


def sheet(rows):
    return f'<worksheet xmlns="{NS}"><sheetData>{rows}</sheetData></worksheet>'


def normal_sheet(*, missing_current=False):
    middle = "" if missing_current else '<c r="B3"><v>8</v></c>'
    return sheet(
        '<row r="1"><c r="A1" t="inlineStr"><is><t>电压</t></is></c>'
        '<c r="B1" t="inlineStr"><is><t>电流</t></is></c></row>'
        '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>4</v></c></row>'
        f'<row r="3"><c r="A3"><v>2</v></c>{middle}</row>'
        '<row r="4"><c r="A4"><v>3</v></c><c r="B4"><v>12</v></c></row>'
    )


def workbook(xml=None, *, extra=(), compression=zipfile.ZIP_DEFLATED):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=compression) as archive:
        archive.writestr(SHEET, normal_sheet() if xml is None else xml)
        for name, content in extra:
            archive.writestr(name, content)
    return output.getvalue()


def encoded(content):
    return base64.b64encode(content).decode("ascii")


def parse(content, filename="readings.xlsx"):
    return importer.parse_tabular_upload(filename, encoded(content))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    settings = Settings(
        database_path=tmp_path_factory.mktemp("upload-bounds") / "local.db",
        knowledge_base_path=Path(__file__).parents[1] / "app/data/knowledge_base.json",
        openai_api_key=None, enable_llm=False, enable_tutor=False,
    )
    with TestClient(create_app(settings)) as local_client:
        yield local_client


def test_normal_inline_xlsx_and_chinese_headers_preserve_missing_current():
    result = parse(workbook(normal_sheet(missing_current=True)))[0]
    assert result["voltage_V"] == [1, 2, 3]
    assert result["current_mA"] == [4, None, 12]


def test_normal_shared_strings_rich_text_and_ampere_conversion():
    strings = (
        f'<sst xmlns="{NS}"><si><r><t>voltage</t></r><r><t>_V</t></r></si>'
        '<si><t>current_A</t></si><si><t>run_id</t></si><si><t>小组甲</t></si></sst>'
    )
    xml = sheet(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>'
        '<c r="C1" t="s"><v>2</v></c></row>'
        '<row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>0.004</v></c>'
        '<c r="C2" t="s"><v>3</v></c></row>'
    )
    result = parse(workbook(xml, extra=[(STRINGS, strings)]))[0]
    assert result["run_id"] == "小组甲"
    assert result["voltage_V"] == [1]
    assert result["current_mA"] == [4]


@pytest.mark.parametrize("endpoint", ["/api/v1/anomaly/import", "/api/v1/materials/analyze"])
def test_normal_xlsx_is_still_accepted_by_both_public_endpoints(client, endpoint):
    response = client.post(endpoint, json={
        "filename": "readings.xlsx", "content_base64": encoded(workbook()),
    })
    assert response.status_code == 200, response.text


@pytest.mark.parametrize("case", ["ohms_law-basic", "hookes_law-standard", "spring_oscillation-basic"])
def test_catalog_download_csv_roundtrip_is_unchanged(client, case):
    download = client.get(f"/api/v1/practice/{case}/data.csv")
    assert download.status_code == 200
    eid = case.rsplit("-", 1)[0]
    response = client.post(f"/api/v1/experiments/{eid}/import", json={
        "filename": "readings.csv", "content_base64": encoded(download.content),
    })
    assert response.status_code == 200, response.text
    assert response.json()["origin"] == "imported-example"


def test_five_kilobyte_zip_bomb_is_rejected_without_decompressing(monkeypatch):
    # Approximately 5 KB on the wire, 5 MB after expansion. Keep the fixture
    # small enough for CI and prove rejection precedes any member read.
    content = workbook(b"X" * (5 * 1024 * 1024))
    assert len(content) < 6_000
    monkeypatch.setattr(importer, "_read_xlsx_member", lambda *_: pytest.fail("decompressed rejected ZIP"))
    with pytest.raises(ValueError, match="单个文件"):
        parse(content)


def test_archive_entry_count_limit():
    extra = [(f"metadata/{index}.xml", "") for index in range(importer.MAX_XLSX_ENTRIES)]
    with pytest.raises(ValueError, match="过多文件"):
        parse(workbook(extra=extra))


def test_member_size_limit_at_boundary_and_one_byte_over(monkeypatch):
    xml = normal_sheet().encode()
    monkeypatch.setattr(importer, "MAX_XLSX_MEMBER_BYTES", len(xml))
    assert parse(workbook(xml))
    with pytest.raises(ValueError, match="单个文件"):
        parse(workbook(xml + b" "))


def test_archive_total_limit_at_boundary_and_one_byte_over(monkeypatch):
    xml = normal_sheet().encode()
    monkeypatch.setattr(importer, "MAX_XLSX_UNCOMPRESSED_BYTES", len(xml) + 20)
    assert parse(workbook(xml, extra=[("metadata.txt", b"x" * 20)]))
    with pytest.raises(ValueError, match="总大小"):
        parse(workbook(xml, extra=[("metadata.txt", b"x" * 21)]))


def test_high_compression_ratio_is_limited_above_small_member_allowance():
    # Normal small XML is exempt from a brittle ratio check; a highly
    # compressible member one byte beyond that allowance is rejected.
    assert parse(workbook(extra=[("notes.txt", b"x" * importer.XLSX_RATIO_ALLOWANCE_BYTES)]))
    with pytest.raises(ValueError, match="压缩比例异常"):
        parse(workbook(extra=[("notes.txt", b"x" * (importer.XLSX_RATIO_ALLOWANCE_BYTES + 1))]))


@pytest.mark.parametrize("budget", [24, 12])
def test_actual_decompressor_output_is_bounded_even_with_understated_metadata(monkeypatch, budget):
    monkeypatch.setattr(importer, "MAX_XLSX_MEMBER_BYTES", 24)
    stream = io.BytesIO(b"x" * 100)
    requested = []

    class TrackedStream:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def read(self, size):
            requested.append(size)
            return stream.read(size)

    archive = SimpleNamespace(open=lambda _: TrackedStream())
    info = SimpleNamespace(file_size=1, compress_size=1)
    with pytest.raises(ValueError, match="解压后的内容"):
        importer._read_xlsx_member(archive, info, budget)
    assert requested == [budget + 1]
    assert stream.tell() == budget + 1


@pytest.mark.parametrize("reference", ["BM2", "A502", "ZZZ2", "1", "A0", "A-2", "A" + "9" * 1000])
def test_sparse_out_of_range_coordinates_are_rejected_before_range_allocation(reference):
    xml = normal_sheet().replace('r="B2"', f'r="{reference}"')
    with pytest.raises(ValueError, match="坐标无效|范围过大"):
        parse(workbook(xml))


def test_maximum_supported_sparse_column_is_bounded_and_valid():
    xml = normal_sheet().replace('</row>', '<c r="BL1"/></row>', 1)
    assert parse(workbook(xml))[0]["voltage_V"] == [1, 2, 3]


def test_500_data_rows_supported_and_one_extra_row_rejected():
    headers = '<row><c t="inlineStr"><is><t>voltage_V</t></is></c><c t="inlineStr"><is><t>current_mA</t></is></c></row>'
    data = '<row><c><v>1</v></c><c><v>4</v></c></row>'
    assert len(parse(workbook(sheet(headers + data * 500)))[0]["voltage_V"]) == 500
    with pytest.raises(ValueError, match="范围过大"):
        parse(workbook(sheet(headers + data * 501)))


def test_implicit_cells_cannot_bypass_column_limit():
    row = "<row>" + "<c/>" * (importer.MAX_IMPORT_COLUMNS + 1) + "</row>"
    with pytest.raises(ValueError, match="范围过大"):
        parse(workbook(sheet(row)))


def test_cell_count_limit_is_checked_while_building_xml(monkeypatch):
    monkeypatch.setattr(importer, "MAX_IMPORT_CELLS", 8)
    assert parse(workbook())
    xml = normal_sheet().replace('</row>', '<c r="C1"/></row>', 1)
    with pytest.raises(ValueError, match="单元格数量过多"):
        parse(workbook(xml))


def test_shared_string_count_is_bounded(monkeypatch):
    monkeypatch.setattr(importer, "MAX_IMPORT_CELLS", 8)
    strings = f'<sst xmlns="{NS}">' + '<si><t>x</t></si>' * 9 + '</sst>'
    with pytest.raises(ValueError, match="共享文本数量过多"):
        parse(workbook(extra=[(STRINGS, strings)]))


def test_xml_node_count_is_bounded_during_parse(monkeypatch):
    monkeypatch.setattr(importer, "MAX_XLSX_XML_NODES", 20)
    with pytest.raises(ValueError, match="结构过于复杂"):
        parse(workbook(sheet("<metadata/>" * 21)))


@pytest.mark.parametrize("encoding", ["utf-8", "utf-16"])
def test_dtd_entities_are_rejected_before_entity_expansion(encoding):
    xml = f'<?xml version="1.0" encoding="{encoding}"?><!DOCTYPE worksheet [<!ENTITY x "expanded">]>' + normal_sheet()
    with pytest.raises(ValueError, match="DTD"):
        parse(workbook(xml.encode(encoding)))


@pytest.mark.parametrize("value", ["-1", "1", "abc", "", "0" * 1000])
def test_missing_negative_and_out_of_range_shared_strings_are_readable_errors(value):
    xml = normal_sheet().replace('<c r="A2"><v>1</v></c>', f'<c r="A2" t="s"><v>{value}</v></c>')
    strings = f'<sst xmlns="{NS}"><si><t>1</t></si></sst>'
    with pytest.raises(ValueError, match="共享文本"):
        parse(workbook(xml, extra=[(STRINGS, strings)]))


def test_missing_shared_string_table_is_readable_error():
    xml = normal_sheet().replace('<c r="A2"><v>1</v></c>', '<c r="A2" t="s"><v>0</v></c>')
    with pytest.raises(ValueError, match="共享文本"):
        parse(workbook(xml))


@pytest.mark.parametrize("extension", ["xlsx", "csv"])
def test_single_cell_text_length_limit(extension):
    value = "x" * importer.MAX_CELL_CHARACTERS
    if extension == "xlsx":
        def content(text):
            return workbook(normal_sheet().replace('</row>', f'<c r="C1" t="inlineStr"><is><t>{text}</t></is></c></row>', 1))
    else:
        def content(text):
            return f"voltage_V,current_mA,{text}\n1,4,\n".encode()
    assert parse(content(value), "readings." + extension)
    with pytest.raises(ValueError, match="内容过长"):
        parse(content(value + "x"), "readings." + extension)


@pytest.mark.parametrize("invalid", ["not-zip", "malformed-xml", "unsupported-encoding", "unsupported-compression", "encrypted", "missing-shared"])
@pytest.mark.parametrize("endpoint", ["/api/v1/anomaly/import", "/api/v1/materials/analyze"])
def test_invalid_workbooks_return_422_instead_of_server_error(client, invalid, endpoint):
    if invalid == "not-zip":
        content = b"not a workbook"
    elif invalid == "malformed-xml":
        content = workbook("<worksheet>")
    elif invalid == "unsupported-encoding":
        content = workbook('<?xml version="1.0" encoding="INVALID-CODEC"?>' + normal_sheet())
    elif invalid == "unsupported-compression":
        content = workbook(compression=zipfile.ZIP_BZIP2)
    elif invalid == "encrypted":
        raw = bytearray(workbook())
        # Both local and central headers advertise an encrypted member.
        struct.pack_into("<H", raw, raw.index(b"PK\x03\x04") + 6, 1)
        struct.pack_into("<H", raw, raw.index(b"PK\x01\x02") + 8, 1)
        content = bytes(raw)
    else:
        content = workbook(normal_sheet().replace('<c r="A2"><v>1</v></c>', '<c r="A2" t="s"><v>0</v></c>'))
    response = client.post(endpoint, json={"filename": "invalid.xlsx", "content_base64": encoded(content)})
    assert response.status_code == 422, response.text
    assert isinstance(response.json()["detail"], str)


def test_csv_limits_and_normal_missing_current_still_work(monkeypatch):
    assert parse("电压,电流\n1,4\n2,\n".encode(), "readings.csv")[0]["current_mA"] == [4, None]
    monkeypatch.setattr(importer, "MAX_IMPORT_ROWS", 3)
    assert parse(b"voltage_V,current_mA\n1,4\n2,8\n", "readings.csv")
    with pytest.raises(ValueError, match="表格过大"):
        parse(b"voltage_V,current_mA\n1,4\n2,8\n3,12\n", "readings.csv")
    with pytest.raises(ValueError, match="表格过大"):
        parse(("x," * 64 + "x\n").encode(), "readings.csv")


def test_oversized_base64_is_rejected_before_decoding(monkeypatch):
    monkeypatch.setattr(importer, "MAX_IMPORT_BYTES", 8)
    with pytest.raises(ValueError, match="不能超过"):
        importer.parse_tabular_upload("readings.xlsx", "A" * 13)
