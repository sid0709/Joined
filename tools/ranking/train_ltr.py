"""Train the learned job ranker (LightGBM LambdaMART) from exported impressions.

    bun run ranking:export                      # or: rankctl export -out training
    python3 -m venv .venv && .venv/bin/pip install -r tools/ranking/requirements.txt
    .venv/bin/python tools/ranking/train_ltr.py --data training --out model.txt

Input (written by `rankctl export`):
    train.tsv     one row per shown job: label, then the feature vector
    train.query   one line per result page: how many rows it has (LightGBM groups)
    features.txt  feature names, one per line, in vector order

Labels: 0 shown, 1 clicked, 2 saved, 3 applied. Pages are split into train and
validation by group so one page never lands on both sides. The model is saved
in LightGBM's text format, which the Go server loads with RANKING_MODEL_PATH.
"""

import argparse
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np

# Depth of the metric the server cares about: the first page.
EVAL_AT = [5, 10]
# Share of pages held out for early stopping and the reported score.
VALIDATION_SHARE = 0.2
# Training stops when validation NDCG has not improved for this many rounds.
EARLY_STOPPING_ROUNDS = 50
MAX_ROUNDS = 1000
SEED = 7

PARAMS = {
    "objective": "lambdarank",
    "metric": "ndcg",
    "eval_at": EVAL_AT,
    "learning_rate": 0.05,
    "num_leaves": 31,
    "min_data_in_leaf": 20,
    "feature_fraction": 0.9,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "lambdarank_truncation_level": 20,
    "label_gain": [0, 1, 3, 7],
    "seed": SEED,
    "verbose": -1,
}


def load(data_dir: Path):
    rows = np.loadtxt(data_dir / "train.tsv", delimiter="\t", ndmin=2)
    groups = np.loadtxt(data_dir / "train.query", dtype=np.int64, ndmin=1)
    names = (data_dir / "features.txt").read_text().split()
    if rows.shape[0] != groups.sum():
        sys.exit(f"train.tsv has {rows.shape[0]} rows but train.query sums to {groups.sum()}")
    if rows.shape[1] - 1 != len(names):
        sys.exit(f"rows have {rows.shape[1] - 1} features but features.txt names {len(names)}")
    return rows[:, 0].astype(np.int64), rows[:, 1:], groups, names


def split(labels, features, groups):
    """Split whole pages: the last VALIDATION_SHARE of a shuffled page order."""
    rng = np.random.default_rng(SEED)
    starts = np.concatenate([[0], np.cumsum(groups)[:-1]])
    order = rng.permutation(len(groups))
    cut = max(1, int(len(groups) * (1 - VALIDATION_SHARE)))
    parts = []
    for picked in (order[:cut], order[cut:]):
        picked = np.sort(picked)
        index = np.concatenate([np.arange(starts[g], starts[g] + groups[g]) for g in picked])
        parts.append((labels[index], features[index], groups[picked]))
    return parts


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=Path("training"), help="directory from rankctl export")
    parser.add_argument("--out", type=Path, default=Path("model.txt"), help="where to write the model")
    args = parser.parse_args()

    labels, features, groups, names = load(args.data)
    if len(groups) < 10:
        sys.exit(f"only {len(groups)} pages with an interaction; collect more before training")
    (train_y, train_x, train_g), (valid_y, valid_x, valid_g) = split(labels, features, groups)
    train = lgb.Dataset(train_x, train_y, group=train_g, feature_name=names)
    valid = lgb.Dataset(valid_x, valid_y, group=valid_g, feature_name=names, reference=train)
    model = lgb.train(
        PARAMS,
        train,
        num_boost_round=MAX_ROUNDS,
        valid_sets=[valid],
        valid_names=["validation"],
        callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False), lgb.log_evaluation(0)],
    )
    best = model.best_score["validation"]
    print(f"pages: {len(train_g)} train, {len(valid_g)} validation; rounds: {model.best_iteration}")
    for k in EVAL_AT:
        print(f"validation ndcg@{k}: {best[f'ndcg@{k}']:.4f}")
    importance = sorted(zip(names, model.feature_importance("gain")), key=lambda item: -item[1])
    print("top features by gain:", ", ".join(f"{name} {gain:.0f}" for name, gain in importance[:8]))
    model.save_model(str(args.out), num_iteration=model.best_iteration)
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
