"""
Configuration: reads environment variables with sensible defaults.
"""
import os
from pathlib import Path

# Database
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/volunteer_coordination",
)

# Paths
BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)

# Datasets (workspace root is one level above ai-service/)
DATA_DIR = BASE_DIR.parent
REPORTS_CSV    = DATA_DIR / "reports_dataset_large.csv"
VOLUNTEERS_CSV = DATA_DIR / "volunteers_dataset_large.csv"
TASKS_CSV      = DATA_DIR / "tasks_dataset_large.csv"

# In Docker, datasets are mounted at /data
if Path("/data/reports_dataset_large.csv").exists():
    REPORTS_CSV    = Path("/data/reports_dataset_large.csv")
    VOLUNTEERS_CSV = Path("/data/volunteers_dataset_large.csv")
    TASKS_CSV      = Path("/data/tasks_dataset_large.csv")

# NLP
NLP_MODEL_NAME: str = os.getenv("NLP_MODEL_NAME", "distilbert-base-uncased")
NLP_CONFIDENCE_THRESHOLD: float = float(os.getenv("NLP_CONFIDENCE_THRESHOLD", "0.6"))
NLP_MAX_LENGTH: int = int(os.getenv("NLP_MAX_LENGTH", "128"))

# Matching
MAX_DISTANCE_KM: float = float(os.getenv("MAX_DISTANCE_KM", "50"))

# Geo
AVG_SPEED_KMH: float = float(os.getenv("AVG_SPEED_KMH", "30"))
