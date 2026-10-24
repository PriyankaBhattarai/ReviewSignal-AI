from app.metrics import calculate_metrics


def test_metric_calculation():
    expected = {"a": {"security"}, "b": {"quality"}, "c": set()}
    detected = {"a": {"security"}, "b": {"security"}, "c": {"quality"}}
    metrics = calculate_metrics(expected, detected, {"security", "quality", "correctness"})
    assert metrics["true_positives"] == 1
    assert metrics["false_positives"] == 2
    assert metrics["false_negatives"] == 1
    assert 0 <= metrics["precision"] <= 1
    assert 0 <= metrics["recall"] <= 1


def test_empty_findings_do_not_crash():
    expected = {"a": set()}
    detected = {"a": set()}
    metrics = calculate_metrics(expected, detected, {"security", "quality"})
    assert metrics["precision"] == 0.0
    assert metrics["recall"] == 0.0
