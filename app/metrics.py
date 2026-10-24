from collections.abc import Iterable


def calculate_metrics(expected_by_sample: dict[str, set[str]],
                      detected_by_sample: dict[str, set[str]],
                      category_vocabulary: set[str]) -> dict:
    """Calculate micro metrics over a fixed category vocabulary.

    A category counts at most once per sample. Unreported categories are treated
    as negative labels only within the supplied, documented vocabulary.
    """
    tp = fp = fn = tn = 0
    for sample_id, expected in expected_by_sample.items():
        detected = detected_by_sample.get(sample_id, set())
        expected = set(expected) & category_vocabulary
        detected = set(detected) & category_vocabulary
        tp += len(expected & detected)
        fp += len(detected - expected)
        fn += len(expected - detected)
        tn += len(category_vocabulary - (expected | detected))

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
    fpr = fp / (fp + tn) if fp + tn else 0.0
    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
    }
