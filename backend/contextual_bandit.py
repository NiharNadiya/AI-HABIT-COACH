import os
import json
import math
import time
from typing import Dict, Any, List, Optional

ARMS = [
    {
        "id": "neck_stretch",
        "title": "Gentle Cervical & Neck Stretch",
        "description": "Tilt your head toward your right shoulder for 10s, then left. Relieves tech-neck muscle load.",
        "target_category": "posture",
    },
    {
        "id": "hydration_sip",
        "title": "Hydration Focus Sip",
        "description": "Drink a glass of water (250ml) to maintain intervertebral disc elasticity and mental alertness.",
        "target_category": "water",
    },
    {
        "id": "standing_walk",
        "title": "2-Minute Micro-Walk Reset",
        "description": "Stand up, stretch your hip flexors, and walk for 2 minutes to restore blood circulation.",
        "target_category": "break",
    },
    {
        "id": "eye_rest_20",
        "title": "20-20-20 Digital Eye Relaxation",
        "description": "Look 20 feet away for 20 seconds to relax ciliary eye focus and reduce screen fatigue.",
        "target_category": "activity",
    },
    {
        "id": "shoulder_retraction",
        "title": "Scapular Shoulder Roll & Reset",
        "description": "Roll your shoulders up, back, and down. Squeeze your shoulder blades together for 5 seconds.",
        "target_category": "posture",
    },
]

class ContextualBanditEngine:
    """
    Multi-Armed Contextual Bandit using Upper Confidence Bound (UCB1)
    and context-affinity weighting (Weeks 11–12).
    Learns personal user compliance over time through reinforcement signals.
    """
    def __init__(self, state_path: Optional[str] = None):
        self.state_path = state_path or os.path.join(os.path.dirname(__file__), "models", "bandit_state.json")
        self.c = 1.414  # Exploration-exploitation trade-off constant
        self.arms: Dict[str, Dict[str, Any]] = {}
        self.total_pulls = 0
        self._init_or_load()

    def _init_or_load(self):
        if os.path.exists(self.state_path):
            try:
                with open(self.state_path, "r") as f:
                    data = json.load(f)
                    self.total_pulls = data.get("total_pulls", 0)
                    self.arms = data.get("arms", {})
                    # Ensure all default arms exist
                    for arm in ARMS:
                        if arm["id"] not in self.arms:
                            self.arms[arm["id"]] = {
                                **arm,
                                "pulls": 0,
                                "total_reward": 0.0,
                                "avg_reward": 0.0,
                            }
                    return
            except Exception as e:
                print(f"Warning loading bandit state: {e}")

        # Initialize fresh state
        self.total_pulls = 0
        self.arms = {}
        for arm in ARMS:
            self.arms[arm["id"]] = {
                **arm,
                "pulls": 0,
                "total_reward": 0.0,
                "avg_reward": 0.0,
            }

    def save(self):
        os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
        with open(self.state_path, "w") as f:
            json.dump({
                "total_pulls": self.total_pulls,
                "updated_at": time.time(),
                "arms": self.arms
            }, f, indent=2)

    def select_arm(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Selects the best recommendation arm using UCB1 + Context Affinity.
        Context keys: posture_avg, sitting_minutes, hydration_pct, break_pct
        """
        posture = context.get("posture_avg", 75.0)
        sitting = context.get("sitting_minutes", 0)
        hydration = context.get("hydration_pct", 50.0)

        # Context affinity boosts: prioritizing needs based on physiological signals
        affinity = {
            "posture": 1.4 if posture < 65 else 1.0,
            "break": 1.5 if sitting >= 45 else 1.0,
            "water": 1.4 if hydration < 40 else 1.0,
            "activity": 1.1 if sitting >= 30 else 1.0,
        }

        best_arm_id = None
        best_ucb = -float("inf")

        for arm_id, stats in self.arms.items():
            pulls = stats["pulls"]
            cat = stats.get("target_category", "posture")
            aff_weight = affinity.get(cat, 1.0)

            # If arm has never been pulled, assign high priority for initial exploration
            if pulls == 0:
                ucb_val = 10.0 * aff_weight
            else:
                exploitation = stats["avg_reward"]
                exploration = self.c * math.sqrt(math.log(max(1, self.total_pulls)) / pulls)
                ucb_val = (exploitation + exploration) * aff_weight

            if ucb_val > best_ucb:
                best_ucb = ucb_val
                best_arm_id = arm_id

        chosen = self.arms.get(best_arm_id or "neck_stretch")
        return chosen

    def record_feedback(self, arm_id: str, reward: float = 1.0):
        """
        Reinforcement learning feedback loop:
        Reward is +1.0 when user complies with recommendation (logs water, takes break, etc.)
        """
        if arm_id in self.arms:
            arm = self.arms[arm_id]
            arm["pulls"] += 1
            arm["total_reward"] += reward
            arm["avg_reward"] = round(arm["total_reward"] / arm["pulls"], 3)
            self.total_pulls += 1
            self.save()
            return arm
        return None

    def get_status(self) -> Dict[str, Any]:
        sorted_arms = sorted(
            self.arms.values(),
            key=lambda x: (x["avg_reward"], x["pulls"]),
            reverse=True
        )
        return {
            "model_type": "ContextualBandit (UCB1)",
            "total_pulls": self.total_pulls,
            "arms": sorted_arms,
            "top_arm": sorted_arms[0]["title"] if sorted_arms else None,
        }
