from __future__ import annotations

import ast
import math
import operator
from collections.abc import Callable


class UnsafeExpressionError(ValueError):
    """Raised when a formula contains unsupported or unsafe syntax."""


_BINARY_OPERATORS: dict[type[ast.operator], Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
}

_UNARY_OPERATORS: dict[type[ast.unaryop], Callable[[float], float]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

_FUNCTIONS: dict[str, Callable[..., float]] = {
    "abs": abs,
    "sqrt": math.sqrt,
    "log": math.log,
    "ln": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
}

_CONSTANTS = {"pi": math.pi, "e": math.e}


class _Evaluator(ast.NodeVisitor):
    def __init__(self, variables: dict[str, float]) -> None:
        self.variables = variables

    def visit_Expression(self, node: ast.Expression) -> float:  # noqa: N802
        return self.visit(node.body)

    def visit_Constant(self, node: ast.Constant) -> float:  # noqa: N802
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise UnsafeExpressionError("公式中只允许数值常量")
        return float(node.value)

    def visit_Name(self, node: ast.Name) -> float:  # noqa: N802
        if node.id in self.variables:
            return float(self.variables[node.id])
        if node.id in _CONSTANTS:
            return _CONSTANTS[node.id]
        raise UnsafeExpressionError(f"公式包含未提供的变量：{node.id}")

    def visit_BinOp(self, node: ast.BinOp) -> float:  # noqa: N802
        operation = _BINARY_OPERATORS.get(type(node.op))
        if operation is None:
            raise UnsafeExpressionError("公式包含不支持的二元运算")
        left = self.visit(node.left)
        right = self.visit(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 100:
            raise UnsafeExpressionError("指数绝对值不能超过 100")
        try:
            return float(operation(left, right))
        except (ArithmeticError, TypeError, ValueError) as exc:
            raise UnsafeExpressionError(f"公式无法计算：{exc}") from exc

    def visit_UnaryOp(self, node: ast.UnaryOp) -> float:  # noqa: N802
        operation = _UNARY_OPERATORS.get(type(node.op))
        if operation is None:
            raise UnsafeExpressionError("公式包含不支持的一元运算")
        return float(operation(self.visit(node.operand)))

    def visit_Call(self, node: ast.Call) -> float:  # noqa: N802
        if not isinstance(node.func, ast.Name) or node.func.id not in _FUNCTIONS:
            raise UnsafeExpressionError("公式调用了不支持的函数")
        if node.keywords:
            raise UnsafeExpressionError("函数不接受关键字参数")
        arguments = [self.visit(argument) for argument in node.args]
        try:
            return float(_FUNCTIONS[node.func.id](*arguments))
        except (ArithmeticError, OverflowError, TypeError, ValueError) as exc:
            raise UnsafeExpressionError(f"函数无法计算：{exc}") from exc

    def generic_visit(self, node: ast.AST) -> float:
        raise UnsafeExpressionError(f"公式包含不支持的语法：{type(node).__name__}")


def evaluate_formula(formula: str, variables: dict[str, float]) -> float:
    """Safely evaluate a small mathematical expression.

    Formulas may be supplied as ``R = U / I`` or just ``U / I``. Only numeric
    arithmetic, named variables and a small set of math functions are allowed.
    Python ``eval`` is intentionally not used.
    """

    if not formula or len(formula) > 500:
        raise UnsafeExpressionError("公式为空或过长")

    expression = formula.split("=", 1)[1] if "=" in formula else formula
    expression = (
        expression.strip()
        .replace("^", "**")
        .replace("×", "*")
        .replace("÷", "/")
        .replace("−", "-")
        .replace("π", "pi")
    )
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise UnsafeExpressionError("公式语法错误") from exc

    result = _Evaluator(variables).visit(tree)
    if not math.isfinite(result):
        raise UnsafeExpressionError("计算结果不是有限数值")
    if abs(result) > 1e300:
        raise UnsafeExpressionError("计算结果超出允许范围")
    return result


def relative_error_percent(observed: float, reference: float) -> float:
    denominator = abs(reference)
    # Small SI constants (charge, magnetic moment, h) are nonzero references.
    # An absolute epsilon would silently turn even a 100% error into a match.
    if denominator == 0:
        return 0.0 if observed == reference else float("inf")
    return abs(observed - reference) / denominator * 100.0
