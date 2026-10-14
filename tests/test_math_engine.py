import math

import pytest

from app.math_engine import UnsafeExpressionError, evaluate_formula, relative_error_percent


def test_formula_with_assignment_and_units_conversion_variables() -> None:
    result = evaluate_formula("R = U / I", {"U": 5.0, "I": 0.02})
    assert result == pytest.approx(250.0)


def test_formula_supports_scientific_functions() -> None:
    result = evaluate_formula("g = 4 * π^2 * L / T^2", {"L": 1.0, "T": 2.0})
    assert result == pytest.approx(math.pi**2)


@pytest.mark.parametrize(
    "formula",
    [
        "__import__('os').system('whoami')",
        "(1).__class__",
        "[x for x in [1, 2]]",
        "open('/etc/passwd')",
    ],
)
def test_formula_rejects_unsafe_syntax(formula: str) -> None:
    with pytest.raises(UnsafeExpressionError):
        evaluate_formula(formula, {})


@pytest.mark.parametrize("formula", ["(-1) ** 0.5", "1 / 0", "sqrt(-1)", "exp(1000)"])
def test_non_real_or_undefined_calculation_is_reported(formula: str) -> None:
    with pytest.raises(UnsafeExpressionError):
        evaluate_formula(formula, {})

@pytest.mark.parametrize('reference',[1.0,1.602176634e-19,6.62607015e-34])
def test_relative_error_is_invariant_to_physical_scale(reference):
    assert relative_error_percent(reference*.95,reference)==pytest.approx(5)
    assert relative_error_percent(reference*2,reference)==pytest.approx(100)
    assert relative_error_percent(0,reference)==100

def test_actual_zero_is_distinct_from_small_nonzero_values():
    assert relative_error_percent(0,0)==0
    assert math.isinf(relative_error_percent(1e-34,0))
