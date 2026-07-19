"""Single source of truth shared by ZivaDzidzo R&D notebooks and export scripts."""
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = BACKEND_ROOT / "raw"
MODELS_DIR = BACKEND_ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)
RANDOM_STATE = 42
TEST_SIZE = 0.2

INDUSTRY4_FILE = RAW_DIR / "industry4_vocational_skill_mapping_dataset.csv"
READINESS_TARGET = "Skill_Readiness_Level"
GAP_TARGET = "Skill_Gap_Score"
INDUSTRY4_FEATURES = [
    "Program", "Semester", "Learning_Mode", "Theory_Score", "Assignment_Score",
    "Internal_Exam_Score", "Attendance_Percentage", "LMS_Login_Count",
    "LMS_Time_Spent_Hours", "Video_Completion_Percentage", "Lab_Task_Completion_Percentage",
    "Lab_Accuracy_Score", "Practical_Exam_Score", "Simulation_Score",
    "Troubleshooting_Score", "AI_Skill_Score", "IoT_Skill_Score", "Robotics_Skill_Score",
    "Data_Analytics_Score", "Automation_Skill_Score", "Problem_Solving_Score",
    "Teamwork_Score", "Communication_Score"
]

# Explicit deployment boundary: `StudentPerformanceFactors.csv` is useful for research
# benchmarking only. No student-level source rows or model predictions are deployed.
EXAM_BENCHMARK_FILE = RAW_DIR / "StudentPerformanceFactors.csv"
EXAM_TARGET = "Exam_Score"
