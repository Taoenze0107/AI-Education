# app/ms_gates.py
# MS3 数据验收适配核心算法（独立、可单测）
#
# 解决两个 AD 统计实现坑点（小狗 2026-09-17 派发，scipy 逐条复核）：
#   坑点1：完美直线导致 Grubbs 浮点假阳性
#     - 先走物理闸门：当所有 |残差| < MPE（= 精度等级% × 电压量程，1.0级×6V=0.06V）
#       时直接判 normal，不跑 Grubbs；
#     - Grubbs 仅在 sd 显著大于 0（sd > MPE/2）时才计算。
#   坑点2：drift 必须基于“测量原始顺序”
#     - 残差按提交/测量顺序保留，绝不在按电流排序后再算；
#     - runs test、前后半残差均值差、残差对序号 Spearman ρ / 趋势斜率都基于原始顺序。
#
# 另按验收口径：
#   - Grubbs 临界值一律用单侧精确值（t 分布公式），从 standards json 的
#     grubbs_critical_one_sided 读取：n=8 -> 2.127(warn)/2.274(reject)、
#     n=10 -> 2.290/2.482；勿引用旧 GB/T 4883 表 2.03/2.41。
#   - 判离群还须残差超过仪表 MPE 物理闸门（standards json decision 字段）。
#   - unit_error 用 |log10(R_student/R_ref)| 数量级判定，即使 R² 高也要查
#     （check_even_if_r2_high=true），decade 阈值 0.85/1.85/2.85。
#
# 兼容：numpy/scipy 均可用（项目 venv 已装 scikit-learn 自带）；无 scipy 时
# runs 精确 p 用组合计数实现，Spearman 退化为 Pearson-on-rank。
from __future__ import annotations

import math
from typing import Optional

import numpy as np

try:
    from scipy import stats as _sp_stats
    HAS_SCIPY = True
except Exception:  # pragma: no cover
    HAS_SCIPY = False


# ---------------------------------------------------------------------------
# 标准读取（轻量点分路径，独立于 app.standards.standard_get，避免循环依赖）
# ---------------------------------------------------------------------------
def _sget(standard: dict, dotted: str, default=None):
    node = standard
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node


def _grubbs_crit(standard: dict, n: int) -> tuple[float, float]:
    """从 standards json 读取单侧 Grubbs 临界值 (warn, reject)。

    优先读 grubbs_critical_one_sided.{alpha_0.05_warn, alpha_0.01_reject} 表，
    n 不在表内时按最近 n 取；表缺失时回退 t 分布公式计算。
    """
    table = _sget(standard, "grubbs_critical_one_sided", {}) or {}
    ns = table.get("n") or []
    warn_list = table.get("alpha_0.05_warn") or []
    rej_list = table.get("alpha_0.01_reject") or []
    if ns and warn_list and rej_list:
        idx = min(range(len(ns)), key=lambda i: abs(ns[i] - n))
        return float(warn_list[idx]), float(rej_list[idx])
    # 回退：经典单侧 Grubbs 精确公式（t 分布）
    #   G = (n-1)/sqrt(n) * sqrt(t^2 / (n-2+t^2)),  t = t_{1-alpha/(2n), n-2}
    def _g(alpha: float) -> float:
        if n <= 2:
            return math.inf
        t = _sp_stats.t.ppf(1 - alpha / (2 * n), n - 2)
        return (n - 1) / math.sqrt(n) * math.sqrt(t * t / (n - 2 + t * t))
    return float(_g(0.05)), float(_g(0.01))


def _exact_runs_p(n_pos: int, n_neg: int, runs: int) -> float:
    """runs test 精确双侧 p（组合计数，无 scipy 依赖）。

    参考经典非参数统计：给定 n1 个 +、n2 个 -，runs 数为 r 的概率
      r 偶数：2*C(n1-1,r/2-1)*C(n2-1,r/2-1)/C(n1+n2,n1)
      r 奇数：C(n1-1,(r-1)/2)*C(n2-1,(r-3)/2) + C(n1-1,(r-3)/2)*C(n2-1,(r-1)/2) / C(n1+n2,n1)
    双侧 p = P(r<=r_obs) + P(r>=n1+n2+1-r_obs)（对称小端+大端累积）。
    """
    total = n_pos + n_neg
    if n_pos == 0 or n_neg == 0:
        return 0.0  # 单一符号序列无漂移判别意义
    denom = math.comb(total, n_pos)

    def _comb(n: int, k: int) -> int:
        if k < 0 or k > n:
            return 0
        return math.comb(n, k)

    def prob(r: int) -> float:
        if r < 1 or r > total:
            return 0.0
        if r % 2 == 0:
            k = r // 2
            num = 2 * _comb(n_pos - 1, k - 1) * _comb(n_neg - 1, k - 1)
        else:
            k = (r + 1) // 2
            num = (_comb(n_pos - 1, k - 1) * _comb(n_neg - 1, k - 2)
                   + _comb(n_pos - 1, k - 2) * _comb(n_neg - 1, k - 1))
        return num / denom

    p_low = sum(prob(r) for r in range(1, runs + 1))
    p_high = sum(prob(r) for r in range(runs, total + 1))
    # 经典 runs 双侧：p = 2 * min(P(R<=r_obs), P(R>=r_obs))；runs=2,n1=n2=5 -> 2*0.00794=0.0159
    return min(1.0, 2.0 * min(p_low, p_high))


def _spearman(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Spearman 秩相关 (rho, p)；无 scipy 时退化为秩的 Pearson。"""
    if len(x) < 3 or len(y) < 3:
        return 0.0, 1.0
    if HAS_SCIPY:
        rho, p = _sp_stats.spearmanr(x, y)
        if isinstance(rho, (np.floating, float)) and not np.isnan(rho):
            return float(rho), float(p)
        return 0.0, 1.0
    # 退化：Pearson-on-rank
    def _rank(v: np.ndarray) -> np.ndarray:
        order = v.argsort()
        ranks = np.empty_like(v, dtype=float)
        ranks[order] = np.arange(1, len(v) + 1)
        return ranks
    rx, ry = _rank(x), _rank(y)
    if np.std(rx) == 0 or np.std(ry) == 0:
        return 0.0, 1.0
    rho = float(np.corrcoef(rx, ry)[0, 1])
    n = len(x)
    t = rho * math.sqrt((n - 2) / max(1e-12, (1 - rho * rho)))
    p = 2 * (1 - _sp_stats.t.cdf(abs(t), n - 2)) if HAS_SCIPY else 0.0
    return rho, p


def _ols_ohms(voltage_V: list, current_A: list):
    """伏安法 OLS：U = a + b*I，R = b(ohm)。返回 (a, b, r2, s_residual, residuals_by_index)。"""
    V = np.asarray(voltage_V, dtype=float)
    I = np.asarray(current_A, dtype=float)
    n = len(V)
    if n < 3:
        raise ValueError("有效点数不足")
    # 最小二乘：b = Sxy/Sxx, a = mean(V) - b*mean(I)
    I_mean, V_mean = I.mean(), V.mean()
    Sxx = float(((I - I_mean) ** 2).sum())
    Sxy = float(((I - I_mean) * (V - V_mean)).sum())
    b = Sxy / Sxx if Sxx > 1e-15 else 0.0
    a = float(V_mean - b * I_mean)
    residuals = V - (a + b * I)
    ss_res = float((residuals ** 2).sum())
    ss_tot = float(((V - V_mean) ** 2).sum())
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-15 else 1.0
    s_residual = math.sqrt(ss_res / (n - 1)) if n > 1 else 0.0
    # 注：Grubbs G = max|r| / s 中的 s 用 n-1 样本标准差（与 scipy 复核口径一致，
    #     0.072/0.0325≈2.21 案例4；若用 n-2 会低估 G 造成漏报）
    return a, b, r2, s_residual, residuals


def detect_ms_gates(
    voltage_V: list,
    current_mA: list,
    standard: Optional[dict] = None,
    reference_resistance_ohm: Optional[float] = None,
) -> dict:
    """MS3 数据验收核心判定。

    参数
    ----
    voltage_V : 电压读数（V），**原始测量顺序**，缺失值用 None 占位
    current_mA : 电流读数（mA），**原始测量顺序**，缺失值用 None 占位
    standard : 实验标准 dict（standards/<id>.json 加载结果；None 时用缺省）
    reference_resistance_ohm : MS1 参考电阻（Ω）；缺省从 standard.reference 读取

    返回
    ----
    dict：{anomalous, issue_type, label, flags, fit, grubbs, noise, drift, unit_error}
    """
    standard = standard or {}
    fullscale_V = float(_sget(standard, "meter.fullscale_voltage_V", 6.0))
    accuracy_class = float(_sget(standard, "meter.accuracy_class", 1.0))
    mpe_V = (accuracy_class / 100.0) * fullscale_V  # 仪表最大允许误差（V）

    min_points = int(_sget(standard, "missing.min_valid_points", 5))
    noise_warn = float(_sget(standard, "noise.warn", 0.05))
    noise_reject = float(_sget(standard, "noise.reject", 0.08))
    half_diff_th = float(_sget(standard, "drift.half_residual_mean_diff_to_fullscale", 0.03))
    runs_alpha = float(_sget(standard, "drift.runs_test_alpha", 0.05))
    decade_x10 = float(_sget(standard, "unit_error.decade_x10", 0.85))
    decade_x100 = float(_sget(standard, "unit_error.decade_x100", 1.85))
    decade_x1000 = float(_sget(standard, "unit_error.decade_x1000", 2.85))
    ref_R = reference_resistance_ohm
    if ref_R is None:
        ref_R = _sget(standard, "reference.reference_resistance_ohm", None)
    if ref_R is None:
        # 未给参考电阻：无法做数量级判定，unit_error 置 False 并标记 unverified
        ref_R = None

    flags = {"missing": False, "outlier": False, "noise": False, "drift": False, "unit_error": False}

    # ---------------- 1. 缺失检查（含 None 占位与空串） ----------------
    clean_V, clean_I = [], []
    missing_idx = []
    for i, (v, c) in enumerate(zip(voltage_V, current_mA)):
        if v is None or c is None or (isinstance(v, str) and not v.strip()) or (isinstance(c, str) and not c.strip()):
            missing_idx.append(i)
            flags["missing"] = True
        else:
            try:
                clean_V.append(float(v))
                clean_I.append(float(c))
            except (TypeError, ValueError):
                missing_idx.append(i)
                flags["missing"] = True
    n_valid = len(clean_V)

    if n_valid < 3:
        return {
            "anomalous": True, "issue_type": "insufficient_evidence", "label": "missing",
            "flags": flags, "fit": None, "grubbs": None, "noise": None, "drift": None,
            "unit_error": None, "missing_idx": missing_idx,
            "note": f"有效点数 {n_valid} < 3，无法拟合",
        }
    if n_valid < min_points:
        return {
            "anomalous": True, "issue_type": "insufficient_evidence", "label": "missing",
            "flags": flags, "fit": None, "grubbs": None, "noise": None, "drift": None,
            "unit_error": None, "missing_idx": missing_idx,
            "note": f"有效点数 {n_valid} < min_points={min_points}，数据不足",
        }

    # ---------------- 2. OLS 拟合（电流 mA -> A） ----------------
    current_A = [c * 1e-3 for c in clean_I]
    a, b, r2, s_residual, residuals = _ols_ohms(clean_V, current_A)
    fit = {"a": a, "R_ohm": b, "r2": r2, "s_residual": s_residual,
           "s_over_fs": s_residual / fullscale_V}
    # 残差映射回原始顺序（缺失位为 None），用于 drift 原始顺序分析
    res_full = [None] * len(voltage_V)
    it = 0
    for i in range(len(voltage_V)):
        if i not in set(missing_idx):
            res_full[i] = float(residuals[it])
            it += 1

    grubbs = {"G": None, "G_warn": None, "G_reject": None,
              "status": "none", "mpe_gate_passed": True, "max_abs_residual": float(np.max(np.abs(residuals)))}
    noise_res = {"s_over_fs": fit["s_over_fs"], "warn": noise_warn, "reject": noise_reject, "status": "normal"}
    drift_res = {"runs": None, "runs_p": None, "half_diff_over_fs": None,
                 "spearman_rho": None, "spearman_p": None, "status": "normal"}
    unit_res = {"log10_ratio": None, "decade_x10": decade_x10,
                "decade_x100": decade_x100, "decade_x1000": decade_x1000,
                "status": "normal", "check_even_if_r2_high": True}

    # ---------------- 3. 物理闸门（坑点1 第一层） ----------------
    max_abs_res = grubbs["max_abs_residual"]
    grubbs["mpe_gate_passed"] = bool(max_abs_res < mpe_V)

    # ---------------- 4. noise 判定（原始顺序残差） ----------------
    if fit["s_over_fs"] >= noise_reject:
        flags["noise"] = True
        noise_res["status"] = "reject"
    elif fit["s_over_fs"] >= noise_warn:
        noise_res["status"] = "warn"

    # ---------------- 5. Grubbs 单侧离群判定（坑点1 第二层） ----------------
    n = n_valid
    G_warn, G_rej = _grubbs_crit(standard, n)
    grubbs["G_warn"], grubbs["G_reject"] = G_warn, G_rej
    if not grubbs["mpe_gate_passed"] and s_residual > mpe_V / 2.0:
        G = float(np.max(np.abs(residuals)) / s_residual)
        grubbs["G"] = G
        if G > G_rej:
            flags["outlier"] = True
            grubbs["status"] = "reject"
        elif G > G_warn:
            # 歧离值：只 warn 不 reject（案例4）
            flags["outlier"] = True
            grubbs["status"] = "warn"
        else:
            grubbs["status"] = "normal"
    # 注：物理闸门通过（残差都在 MPE 内）-> 直接不判离群；sd 过小也跳过避免浮点假阳性

    # ---------------- 6. drift 判定（坑点2：必须原始顺序） ----------------
    res_valid = [r for r in res_full if r is not None]
    if len(res_valid) >= 6:
        signs = [1 if r >= 0 else -1 for r in res_valid]
        runs = 1 + sum(1 for i in range(1, len(signs)) if signs[i] != signs[i - 1])
        n_pos = signs.count(1)
        n_neg = signs.count(-1)
        runs_p = _exact_runs_p(n_pos, n_neg, runs)
        # 前后半残差均值差（原始顺序）
        half = len(res_valid) // 2
        first_mean = float(np.mean(res_valid[:half])) if half > 0 else 0.0
        second_mean = float(np.mean(res_valid[half:])) if len(res_valid) - half > 0 else 0.0
        half_diff_over_fs = abs(first_mean - second_mean) / fullscale_V
        # 残差对序号 Spearman（原始顺序）
        rho, rho_p = _spearman(np.arange(len(res_valid)), np.asarray(res_valid, dtype=float))
        drift_res.update({"runs": runs, "runs_p": runs_p,
                          "half_diff_over_fs": half_diff_over_fs,
                          "spearman_rho": rho, "spearman_p": rho_p})
        drift_hit = (runs_p < runs_alpha) and (half_diff_over_fs > half_diff_th)
        if drift_hit:
            flags["drift"] = True
            drift_res["status"] = "reject"

    # ---------------- 7. unit_error 数量级判定（高 R² 也要查） ----------------
    if ref_R is not None and ref_R > 0 and abs(b) > 1e-12:
        log10_ratio = abs(math.log10(abs(b) / abs(float(ref_R))))
        unit_res["log10_ratio"] = log10_ratio
        if log10_ratio >= decade_x1000:
            unit_res["status"] = "x1000"
            flags["unit_error"] = True
        elif log10_ratio >= decade_x100:
            unit_res["status"] = "x100"
            flags["unit_error"] = True
        elif log10_ratio >= decade_x10:
            unit_res["status"] = "x10"
            flags["unit_error"] = True
    else:
        unit_res["status"] = "unverified"

    # ---------------- 8. 综合 label / issue_type ----------------
    if flags["missing"]:
        # 有缺失（空值/不足点）即 missing：标出缺失位置、禁止静默插值、要求补测
        label, issue_type = "missing", "insufficient_evidence"
    elif flags["outlier"] and flags["unit_error"]:
        label, issue_type = "mixed", "mixed"
    elif flags["outlier"]:
        label, issue_type = "outlier", "data_error"
    elif flags["noise"]:
        label, issue_type = "noise", "data_error"
    elif flags["drift"]:
        label, issue_type = "drift", "data_error"
    elif flags["unit_error"]:
        label, issue_type = "unit_error", "calculation_error"
    else:
        label, issue_type = "normal", "no_error"

    anomalous = label != "normal"
    return {
        "anomalous": anomalous,
        "issue_type": issue_type,
        "label": label,
        "flags": flags,
        "fit": fit,
        "grubbs": grubbs,
        "noise": noise_res,
        "drift": drift_res,
        "unit_error": unit_res,
        "missing_idx": missing_idx,
        "mpe_V": mpe_V,
    }
