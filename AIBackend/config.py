import os

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    WORKOUTS_CSV_PATH = os.path.join(BASE_DIR, 'data', 'workouts.csv')
