"""生成一份仿真「伏安法测电阻原始记录单」(Excel)。

Sheet1 原始记录单：仿真学生手填，1 组正确 + 5 组典型错误，不标注对错。
Sheet2 批阅标注（答案）：每组判定、异常位置、正确值/说明。

所有数据均已用 AnomalyDetector 实跑验证（标称电阻 50Ω）。
关键：漂移组采用「测量时序里电流来回调节(非单调)」，把测量次序与电流
大小解耦——单调电流下漂移残差被 OLS 正交性吸收，无法检出。
"""
from __future__ import annotations

import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.anomaly import AnomalyDetector  # noqa: E402

OUT_PATH = Path(__file__).resolve().parent / "simulated_record_sheet.xlsx"

# (编号, 名称, 电压V, 电流mA(None=漏测空着), 答案判定, 答案位置, 答案说明)
RECORDS = [
    ("①", "正常记录",
     [1.0, 2.0, 3.0, 4.0, 5.0],
     [20.1, 39.8, 60.2, 79.9, 100.1],
     "normal", "—", "数据线性良好，R≈50Ω，无异常"),

    ("②", "粗差（单点录错）",
     [1.0, 2.0, 3.0, 4.0, 5.0],
     [20.0, 40.0, 210.0, 80.0, 100.0],
     "outlier", "第3点", "第3点电流应约60mA，误录为210mA"),

    ("③", "数据缺失（漏测）",
     [1.0, 2.0, 3.0, 4.0, 5.0],
     [20.0, 40.0, None, 80.0, 100.0],
     "missing", "第4点(空)", "第4个点漏测留空，禁止用插值代替，应补测"),

    ("④", "单位错误（整列×10）",
     [1.0, 2.0, 3.0, 4.0, 5.0],
     [200.0, 400.0, 600.0, 800.0, 1000.0],
     "unit_error", "整列电流", "A档读数被当成mA抄录，整体放大10倍，R被算成约500Ω"),

    ("⑤", "随机噪声大（整体抖动）",
     [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0],
     [11.8, 18.2, 39.0, 41.5, 42.5, 65.1, 88.3, 93.3, 80.1, 82.3],
     "noise", "整体", "电流读数整体抖动(接触不良/手不稳)，无单点坏值，s/FS≈0.09判超标"),

    ("⑥", "漂移（随测量顺序）",
     [4.20, 1.20, 2.70, 1.95, 2.20, 0.55, 3.55, 1.05, 3.05, 2.05],
     [80.0, 20.0, 50.0, 35.0, 40.0, 15.0, 75.0, 25.0, 65.0, 45.0],
     "drift", "整体趋势", "电流在时序里来回调节(非单调)；前5次电压系统偏高约0.2V、后5次偏低，"
                          "残差单次翻转runs=2(p≈0.016)，判为仪器/温升漂移"),
]

# ---------- 样式 ----------
thin = Side(style="thin", color="888888")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
TITLE_FONT = Font(name="微软雅黑", size=14, bold=True)
HEAD_FONT = Font(name="微软雅黑", size=10, bold=True, color="FFFFFF")
LABEL_FONT = Font(name="微软雅黑", size=10, bold=True)
NORMAL_FONT = Font(name="微软雅黑", size=10)
HEAD_FILL = PatternFill("solid", fgColor="4472C4")
INFO_FILL = PatternFill("solid", fgColor="D9E1F2")
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")


def box(ws, cell_range: str, font=None, fill=None, align=None) -> None:
    for row in ws[cell_range]:
        for cell in row:
            if font:
                cell.font = font
            if fill:
                cell.fill = fill
            if align:
                cell.alignment = align
            cell.border = BORDER


def build_workbook() -> Workbook:
    wb = Workbook()

    # ===== Sheet1 原始记录单 =====
    ws = wb.active
    ws.title = "原始记录单"
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 14

    ws.merge_cells("A1:C1")
    ws["A1"] = "伏安法测电阻  原始数据记录表"
    ws["A1"].font = TITLE_FONT
    ws["A1"].alignment = CENTER
    ws.row_dimensions[1].height = 26

    info = [
        ("实验名称", "伏安法测电阻（测定线性电阻 R）"),
        ("记录日期", "2026-09-25"),
        ("记录人", "_______________"),
        ("电表精度 / 量程", "1.0 级 / 电压表 6V"),
        ("标称电阻(选填)", "约 50Ω"),
    ]
    r = 2
    for label, value in info:
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        ws.cell(r, 1, label)
        ws.cell(r, 2, value)
        box(ws, f"A{r}:C{r}", font=NORMAL_FONT, align=LEFT)
        ws.cell(r, 1).font = LABEL_FONT
        ws.cell(r, 1).fill = INFO_FILL
        r += 1

    r += 1
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    ws.cell(r, 1, "说明：以下为 6 次独立测量记录，逐组填写电压 U、电流 I（mA），漏测留空。")
    ws.cell(r, 1).font = Font(name="微软雅黑", size=9, italic=True, color="666666")
    r += 2

    for code, name, voltages, currents, *_ in RECORDS:
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
        ws.cell(r, 1, f"记录 {code}")
        box(ws, f"A{r}:C{r}", font=LABEL_FONT, fill=INFO_FILL, align=LEFT)
        r += 1
        for c, h in enumerate(["序号", "电压 U (V)", "电流 I (mA)"], start=1):
            cell = ws.cell(r, c, h)
            cell.font = HEAD_FONT
            cell.fill = HEAD_FILL
            cell.alignment = CENTER
            cell.border = BORDER
        r += 1
        for idx, (u, i) in enumerate(zip(voltages, currents), start=1):
            ws.cell(r, 1, idx)
            ws.cell(r, 2, u)
            ws.cell(r, 3, "" if i is None else i)
            box(ws, f"A{r}:C{r}", font=NORMAL_FONT, align=CENTER)
            r += 1
        r += 1

    # ===== Sheet2 批阅标注（答案） =====
    ws2 = wb.create_sheet("批阅标注(答案)")
    for c, w in enumerate([8, 20, 12, 14, 50], start=1):
        ws2.column_dimensions[get_column_letter(c)].width = w
    ws2.merge_cells("A1:E1")
    ws2["A1"] = "批阅标注（教师答案，学生不可见）"
    ws2["A1"].font = TITLE_FONT
    ws2["A1"].alignment = CENTER
    ws2.row_dimensions[1].height = 24

    for c, h in enumerate(["记录", "类型", "系统判定", "异常位置", "正确值 / 说明"], start=1):
        cell = ws2.cell(2, c, h)
        cell.font = HEAD_FONT
        cell.fill = HEAD_FILL
        cell.alignment = CENTER
        cell.border = BORDER

    rr = 3
    zh = {"normal": "正常", "outlier": "粗差", "missing": "缺失",
          "unit_error": "单位错误", "noise": "噪声", "drift": "漂移"}
    for code, name, _v, _i, verdict, location, note in RECORDS:
        for c, val in enumerate([f"记录{code}", name, zh[verdict], location, note], start=1):
            cell = ws2.cell(rr, c, val)
            cell.font = NORMAL_FONT
            cell.border = BORDER
            cell.alignment = LEFT if c == 5 else CENTER
        rr += 1

    wb.save(OUT_PATH)
    return wb


def verify() -> bool:
    detector = AnomalyDetector()
    print(f"{'记录':6}{'系统判定':12}{'状态':11}与答案")
    all_ok = True
    for code, _name, voltages, currents, expected, *_ in RECORDS:
        result = detector.analyze(
            "ohms_law",
            {"voltage_V": voltages, "current_mA": currents},
            {"expected_resistance_ohm": 50.0},
        )
        got = result.details.anomaly_type
        ok = got == expected
        all_ok &= ok
        print(f"{code:6}{got:12}{result.anomaly.status:11}{'OK' if ok else 'FAIL(期望'+expected+')'}")
    return all_ok


def main() -> None:
    build_workbook()
    print(f"已生成: {OUT_PATH}\n")
    ok = verify()
    print("\n6 组判定全部与答案一致。" if ok else "\n有判定与预期不符。")
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
