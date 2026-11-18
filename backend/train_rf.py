import os
import random
import json
from random_forest import RandomForestRegressor

FEATURE_NAMES = [
    "posture_avg",
    "hydration_pct",
    "break_pct",
    "activity_pct",
    "sitting_minutes",
]

def generate_ergonomic_dataset(n_samples: int = 1200, seed: int = 42):
    """
    Generates a realistic clinical workplace dataset representing 1,200 desk sessions.
    Simulates non-linear physiological interactions:
      - Continuous sitting fatigue curves
      - Slouch + long sitting disc compression compounding penalties
      - Break habit recovery compensation
    """
    random.seed(seed)
    X = []
    y = []

    for _ in range(n_samples):
        # Realistic desk worker distributions
        posture_avg = random.triangular(30.0, 100.0, 75.0)
        hydration_pct = random.triangular(10.0, 100.0, 60.0)
        break_pct = random.triangular(0.0, 100.0, 50.0)
        activity_pct = random.triangular(20.0, 95.0, 70.0)
        sitting_minutes = max(0.0, random.gauss(65.0, 35.0))

        # Base ergonomic weighted score
        score = (
            0.35 * posture_avg
            + 0.20 * hydration_pct
            + 0.25 * break_pct
            + 0.20 * activity_pct
        )

        # Non-linear clinical penalties:
        # 1. Prolonged continuous sitting fatigue (ISO 11226)
        if sitting_minutes > 60:
            score -= (sitting_minutes - 60) * 0.15
        if sitting_minutes > 90:
            score -= (sitting_minutes - 90) * 0.25

        # 2. Compounding slouch x duration spinal disc compression
        if posture_avg < 65 and sitting_minutes > 45:
            slouch_factor = (65 - posture_avg) / 10.0
            time_factor = (sitting_minutes - 45) / 30.0
            score -= slouch_factor * time_factor * 3.5

        # 3. Micro-break recovery bonus
        if break_pct >= 70:
            score += 5.0

        # Add natural biological variance noise
        noise = random.gauss(0.0, 1.5)
        final_score = round(max(5.0, min(100.0, score + noise)), 1)

        X.append([
            round(posture_avg, 1),
            round(hydration_pct, 1),
            round(break_pct, 1),
            round(activity_pct, 1),
            round(sitting_minutes, 1),
        ])
        y.append(final_score)

    return X, y

def train_and_save_model():
    print("=" * 60)
    print("🧠 AI Habit Coach — Random Forest Health Score Training (Weeks 9–10)")
    print("=" * 60)

    print("Generating 1,200 clinical workplace ergonomic sessions...")
    X, y = generate_ergonomic_dataset(n_samples=1200, seed=42)

    # 80% Train, 20% Test split
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print(f"Training Random Forest Regressor on {len(X_train)} sessions (60 Trees, max_depth=7)...")
    rf = RandomForestRegressor(
        n_estimators=60,
        max_depth=7,
        min_samples_split=4,
        random_state=42
    )
    rf.fit(X_train, y_train, feature_names=FEATURE_NAMES)

    print(f"Evaluating model on {len(X_test)} unseen test sessions...")
    metrics = rf.evaluate(X_test, y_test)

    print("\n📈 Model Evaluation Results:")
    print(f"   • R² Score (Coefficient of Determination) : {metrics['r2_score']:.4f} (Goal: >0.90)")
    print(f"   • Mean Absolute Error (MAE)               : {metrics['mae']:.2f} points")
    print(f"   • Root Mean Squared Error (RMSE)          : {metrics['rmse']:.2f} points")

    print("\n🌲 Learned Feature Importances (Weight in Decision Trees):")
    sorted_importances = sorted(rf.feature_importances_.items(), key=lambda x: x[1], reverse=True)
    for feat, imp in sorted_importances:
        bar = "█" * int(imp * 30)
        print(f"   • {feat:<24} : {imp*100:>5.1f}% | {bar}")

    # Ensure models directory exists
    model_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "health_score_rf.json")

    rf.save(model_path)
    print(f"\n✓ Saved trained model to: {model_path}")
    print("=" * 60)
    return rf, metrics

if __name__ == "__main__":
    train_and_save_model()
