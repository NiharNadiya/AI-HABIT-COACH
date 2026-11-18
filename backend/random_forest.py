import json
import math
import random
from typing import List, Dict, Any, Optional, Tuple

class DecisionNode:
    """A single node in a regression decision tree."""
    def __init__(
        self,
        feature_idx: Optional[int] = None,
        threshold: Optional[float] = None,
        left: Optional['DecisionNode'] = None,
        right: Optional['DecisionNode'] = None,
        value: Optional[float] = None,
        gain: float = 0.0,
    ):
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value  # Leaf prediction value
        self.gain = gain    # Variance reduction achieved by this split

    def is_leaf(self) -> bool:
        return self.value is not None

    def to_dict(self) -> Dict[str, Any]:
        if self.is_leaf():
            return {"value": round(self.value, 3)}
        return {
            "feature_idx": self.feature_idx,
            "threshold": round(self.threshold, 3),
            "gain": round(self.gain, 4),
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DecisionNode':
        if "value" in data and data["value"] is not None:
            return cls(value=data["value"])
        return cls(
            feature_idx=data.get("feature_idx"),
            threshold=data.get("threshold"),
            gain=data.get("gain", 0.0),
            left=cls.from_dict(data["left"]) if data.get("left") else None,
            right=cls.from_dict(data["right"]) if data.get("right") else None,
        )


class DecisionTreeRegressor:
    """Decision Tree Regressor implementing MSE variance reduction."""
    def __init__(self, max_depth: int = 6, min_samples_split: int = 5, max_features: Optional[int] = None):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.root: Optional[DecisionNode] = None

    def fit(self, X: List[List[float]], y: List[float], feature_importances: Optional[List[float]] = None) -> 'DecisionTreeRegressor':
        self.root = self._build_tree(X, y, depth=0, feature_importances=feature_importances)
        return self

    def _variance(self, y: List[float]) -> float:
        n = len(y)
        if n <= 1:
            return 0.0
        mean = sum(y) / n
        return sum((val - mean) ** 2 for val in y) / n

    def _build_tree(
        self,
        X: List[List[float]],
        y: List[float],
        depth: int,
        feature_importances: Optional[List[float]] = None
    ) -> DecisionNode:
        n_samples = len(y)
        if n_samples == 0:
            return DecisionNode(value=0.0)

        mean_val = sum(y) / n_samples

        # Stopping conditions: max depth, small sample count, or zero variance
        if depth >= self.max_depth or n_samples < self.min_samples_split:
            return DecisionNode(value=mean_val)

        parent_var = self._variance(y)
        if parent_var < 1e-6:
            return DecisionNode(value=mean_val)

        n_features = len(X[0])
        feature_indices = list(range(n_features))
        if self.max_features and self.max_features < n_features:
            feature_indices = random.sample(feature_indices, self.max_features)

        best_gain = 0.0
        best_feat = None
        best_thresh = None
        best_left_mask = None

        for feat in feature_indices:
            values = [row[feat] for row in X]
            unique_vals = sorted(set(values))
            if len(unique_vals) <= 1:
                continue

            # Candidate split thresholds (midpoints)
            step = max(1, len(unique_vals) // 10)
            thresholds = [
                (unique_vals[i] + unique_vals[i + 1]) / 2.0
                for i in range(0, len(unique_vals) - 1, step)
            ]

            for thresh in thresholds:
                left_y = [y[i] for i in range(n_samples) if X[i][feat] <= thresh]
                right_y = [y[i] for i in range(n_samples) if X[i][feat] > thresh]

                if not left_y or not right_y:
                    continue

                w_left = len(left_y) / n_samples
                w_right = len(right_y) / n_samples
                child_var = w_left * self._variance(left_y) + w_right * self._variance(right_y)
                gain = parent_var - child_var

                if gain > best_gain:
                    best_gain = gain
                    best_feat = feat
                    best_thresh = thresh
                    best_left_mask = [X[i][feat] <= thresh for i in range(n_samples)]

        if best_gain <= 1e-5 or best_feat is None:
            return DecisionNode(value=mean_val)

        # Record feature importance gain
        if feature_importances is not None and best_feat is not None:
            feature_importances[best_feat] += best_gain * n_samples

        left_X = [X[i] for i in range(n_samples) if best_left_mask[i]]
        left_y = [y[i] for i in range(n_samples) if best_left_mask[i]]
        right_X = [X[i] for i in range(n_samples) if not best_left_mask[i]]
        right_y = [y[i] for i in range(n_samples) if not best_left_mask[i]]

        left_child = self._build_tree(left_X, left_y, depth + 1, feature_importances)
        right_child = self._build_tree(right_X, right_y, depth + 1, feature_importances)

        return DecisionNode(
            feature_idx=best_feat,
            threshold=best_thresh,
            left=left_child,
            right=right_child,
            gain=best_gain
        )

    def predict_one(self, x: List[float]) -> float:
        node = self.root
        while node and not node.is_leaf():
            if x[node.feature_idx] <= node.threshold:
                node = node.left
            else:
                node = node.right
        return node.value if node else 0.0

    def predict(self, X: List[List[float]]) -> List[float]:
        return [self.predict_one(x) for x in X]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "max_depth": self.max_depth,
            "min_samples_split": self.min_samples_split,
            "root": self.root.to_dict() if self.root else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DecisionTreeRegressor':
        tree = cls(
            max_depth=data.get("max_depth", 6),
            min_samples_split=data.get("min_samples_split", 5)
        )
        if data.get("root"):
            tree.root = DecisionNode.from_dict(data["root"])
        return tree


class RandomForestRegressor:
    """
    Random Forest Regressor ensemble.
    Trains an ensemble of B trees with bootstrap sampling and feature bagging.
    Computes R2, MAE, and Normalized Feature Importances.
    """
    def __init__(
        self,
        n_estimators: int = 50,
        max_depth: int = 6,
        min_samples_split: int = 5,
        max_features: Optional[int] = None,
        random_state: int = 42
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.random_state = random_state
        self.trees: List[DecisionTreeRegressor] = []
        self.feature_names: List[str] = []
        self.feature_importances_: Dict[str, float] = {}
        self.metrics_: Dict[str, float] = {}

    def fit(self, X: List[List[float]], y: List[float], feature_names: Optional[List[str]] = None) -> 'RandomForestRegressor':
        random.seed(self.random_state)
        n_samples = len(X)
        n_features = len(X[0])
        self.feature_names = feature_names or [f"f{i}" for i in range(n_features)]

        max_feat = self.max_features or max(1, int(math.sqrt(n_features)) + 1)
        self.trees = []
        raw_importances = [0.0] * n_features

        for _ in range(self.n_estimators):
            # Bootstrap sample (sampling with replacement)
            indices = [random.randint(0, n_samples - 1) for _ in range(n_samples)]
            boot_X = [X[i] for i in indices]
            boot_y = [y[i] for i in indices]

            tree = DecisionTreeRegressor(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                max_features=max_feat
            )
            tree.fit(boot_X, boot_y, feature_importances=raw_importances)
            self.trees.append(tree)

        # Normalize feature importances to sum to 1.0 (percentage)
        total_imp = sum(raw_importances) or 1.0
        self.feature_importances_ = {
            self.feature_names[i]: round(raw_importances[i] / total_imp, 4)
            for i in range(n_features)
        }
        return self

    def predict_one(self, x: List[float]) -> float:
        if not self.trees:
            return 50.0
        preds = [t.predict_one(x) for t in self.trees]
        return round(sum(preds) / len(preds), 2)

    def predict(self, X: List[List[float]]) -> List[float]:
        return [self.predict_one(x) for x in X]

    def evaluate(self, X_test: List[List[float]], y_test: List[float]) -> Dict[str, float]:
        preds = self.predict(X_test)
        n = len(y_test)
        if n == 0:
            return {}

        mae = sum(abs(p - actual) for p, actual in zip(preds, y_test)) / n
        mse = sum((p - actual) ** 2 for p, actual in zip(preds, y_test)) / n
        rmse = math.sqrt(mse)

        mean_y = sum(y_test) / n
        ss_tot = sum((actual - mean_y) ** 2 for actual in y_test) or 1e-6
        ss_res = sum((actual - p) ** 2 for actual, p in zip(y_test, preds))
        r2 = max(0.0, 1.0 - (ss_res / ss_tot))

        self.metrics_ = {
            "r2_score": round(r2, 4),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "test_samples": n
        }
        return self.metrics_

    def save(self, filepath: str) -> None:
        data = {
            "model_type": "RandomForestRegressor",
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "feature_names": self.feature_names,
            "feature_importances": self.feature_importances_,
            "metrics": self.metrics_,
            "trees": [t.to_dict() for t in self.trees]
        }
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, filepath: str) -> 'RandomForestRegressor':
        with open(filepath, "r") as f:
            data = json.load(f)

        rf = cls(
            n_estimators=data.get("n_estimators", 50),
            max_depth=data.get("max_depth", 6)
        )
        rf.feature_names = data.get("feature_names", [])
        rf.feature_importances_ = data.get("feature_importances", {})
        rf.metrics_ = data.get("metrics", {})
        rf.trees = [DecisionTreeRegressor.from_dict(t) for t in data.get("trees", [])]
        return rf
