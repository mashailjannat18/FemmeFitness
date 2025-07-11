import pandas as pd
import numpy as np
import json
from typing import Dict, List, Any, Tuple
import os
import logging
from datetime import datetime, timedelta
from collections import Counter
import joblib
import ast
import random

log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'logs')
os.makedirs(log_dir, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'models.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKOUTS_CSV_PATH = os.path.join(BASE_DIR, '..', 'data', 'workouts.csv')
WORKOUTS_MODEL = os.path.join(BASE_DIR, 'models', 'workout_model')
TEMPLATES_CSV_PATH = os.path.join(BASE_DIR, 'models', 'Templates.csv')
MODEL_FILE = os.path.join(WORKOUTS_MODEL, 'fitness_recommendation_model.pkl')
SCALER_FILE = os.path.join(WORKOUTS_MODEL, 'scaler.pkl')
LE_GOAL_FILE = os.path.join(WORKOUTS_MODEL, 'le_goal.pkl')
LE_HEALTH_FILE = os.path.join(WORKOUTS_MODEL, 'le_health.pkl')
LE_FOCUS_FILE = os.path.join(WORKOUTS_MODEL, 'le_focus.pkl')
LE_REST_DAY_FILE = os.path.join(WORKOUTS_MODEL, 'le_rest_day.pkl')

USER_AGE = None
USER_AGE_GROUP = None
USER_ACTIVITY_LEVEL = None
USER_REST_DAY = None
USER_PROGRAM_DURATION = None
USER_GOAL = None
USER_WEIGHT = None
USER_HEIGHT = None
USER_HEALTH_CONDITIONS = []
USER_FOCUS_AREA = []
USER_CYCLE_PHASES = None
USER_CYCLE_LENGTH = None
USER_PREFERRED_INTENSITY = None
USER_PLAN_START_DATE = None

DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
MET_RANGES = {
    'low': (1.5, 3.9),
    'moderate': (4.0, 6.9),
    'high': (7.0, 12.3)
}
GOAL_PRIORITIES = {
    'stay_fit': ['Light Endurance', 'Mobility', 'Core + Abs', 'Lower Body Strength', 'Upper Body Strength'],
    'weight_loss': ['Cardio', 'Full Body HIIT', 'Abs + Upper Body', 'Core + Lower Body'],
    'gain_weight': ['Full Body Strength', 'Core + Chest', 'Upper Body Strength', 'Chest + Arms', 'Lower Body Strength'],
    'build_muscle': ['Upper Body Strength', 'Lower Body Strength', 'Chest + Arms']
}
HIGH_MET_FOCI = ['HIIT Intervals', 'Endurance Sprint', 'Full Body HIIT', 'Upper HIIT', 'Circuit Training']
FOCUS_AREA_MAPPING = {
    'Full Body': ['Full Body Strength', 'Full Body HIIT'],
    'Legs': ['Lower Body Strength', 'Glutes & Hamstrings', 'Core + Lower Body'],
    'Hips': ['Lower Body Strength', 'Legs + Core'],
    'Arms': ['Upper Body Strength', 'Abs + Upper Body'],
    'Stomach': ['Core + Abs',  'Abs + Upper Body', 'Core + Chest']
}
FOCUS_AREA_DEFINITIONS = {
    'Upper Body Strength': {'target_muscles': ['Forearms', 'Shoulders', 'Biceps', 'Triceps', 'Chest'], 'Type': ['Strength']},
    'Lower Body Strength': {'target_muscles': ['Hamstrings', 'Glutes', 'Quadriceps', 'Calves', 'Abductors', 'Adductors'], 'Type': ['Strength']},
    'Core + Abs': {'target_muscles': ['Abdominals'], 'Type': ['Strength', 'Core']},
    'Core + Chest': {'target_muscles': ['Abdominals', 'Chest'], 'Type': ['Strength', 'Core']},
    'Light Endurance': {'target_muscles': ['Quadriceps', 'Calves', 'Glutes', 'Hamstrings'], 'Type': ['Cardio', 'Mobility']},
    'Full Body Strength': {'target_muscles': ['Full Body', 'Biceps', 'Triceps', 'Shoulders', 'Glutes', 'Hamstrings'], 'Type': ['Strength']},
    'Full Body HIIT': {'target_muscles': [], 'Type': [], 'Caution': ['HIIT', 'Plyometric HIIT', 'Isometric HIIT']},
    'Core + Lower Body': {'target_muscles': ['Abdominals', 'Hamstrings', 'Glutes', 'Quadriceps', 'Calves', 'Abductors', 'Adductors'], 'Type': ['Strength', 'Core']},
    'Abs + Upper Body': {'target_muscles': ['Abdominals', 'Shoulders', 'Biceps', 'Triceps', 'Middle Back', 'Lower Back'], 'Type': ['Strength']},
    'Cardio': {'target_muscles': [], 'Type': ['Cardio']},
    'Active Rest Day': {'target_muscles': [], 'Type': ['Mobility', 'Stretching']},
    'Pain Relief Stretches': {'target_muscles': ['Quadriceps', 'Calves', 'Hamstrings', 'Abdominals'], 'Type': ['Mobility', 'Stretching']}
}
USER_FOCUS_TO_MUSCLES = {
    'Arms': ['Biceps', 'Triceps', 'Forearms', 'Shoulders'],
    'Hips': ['Glutes', 'Abductors', 'Adductors'],
    'Legs': ['Quadriceps', 'Hamstrings', 'Calves'],
    'Stomach': ['Abdominals'],
    'Full Body': ['Full Body']
}
WORKOUT_CONFIG = {
    'adult': {
        'low': {
            'weight_loss': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 4},
            'stay_fit': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 4},
            'build_muscle': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 5},
            'gain_weight': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 5}
        },
        'moderate': {
            'weight_loss': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 5},
            'stay_fit': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 5},
            'build_muscle': {'exercises': 7, 'sets': 4, 'duration_per_exercise': 6},
            'gain_weight': {'exercises': 7, 'sets': 4, 'duration_per_exercise': 6}
        },
        'high': {
            'weight_loss': {'exercises': 7, 'sets': 3, 'duration_per_exercise': 6},
            'stay_fit': {'exercises': 7, 'sets': 3, 'duration_per_exercise': 6},
            'build_muscle': {'exercises': 8, 'sets': 4, 'duration_per_exercise': 7},
            'gain_weight': {'exercises': 8, 'sets': 4, 'duration_per_exercise': 7}
        }
    },
    'middle_aged': {
        'low': {
            'weight_loss': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 4},
            'stay_fit': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 4},
            'build_muscle': {'exercises': 5, 'sets': 3, 'duration_per_exercise': 5},
            'gain_weight': {'exercises': 5, 'sets': 3, 'duration_per_exercise': 5}
        },
        'moderate': {
            'weight_loss': {'exercises': 6, 'sets': 2, 'duration_per_exercise': 5},
            'stay_fit': {'exercises': 6, 'sets': 2, 'duration_per_exercise': 5},
            'build_muscle': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 6},
            'gain_weight': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 6}
        },
        'high': {
            'weight_loss': {'exercises': 7, 'sets': 3, 'duration_per_exercise': 5},
            'stay_fit': {'exercises': 7, 'sets': 3, 'duration_per_exercise': 5},
            'build_muscle': {'exercises': 7, 'sets': 3, 'duration_per_exercise': 6},
            'gain_weight': {'exercises': 7, 'sets': 3, 'duration_per_exercise': 6}
        }
    },
    'older_adult': {
        'low': {
            'weight_loss': {'exercises': 4, 'sets': 2, 'duration_per_exercise': 3},
            'stay_fit': {'exercises': 4, 'sets': 2, 'duration_per_exercise': 3},
            'build_muscle': {'exercises': 4, 'sets': 2, 'duration_per_exercise': 4},
            'gain_weight': {'exercises': 4, 'sets': 2, 'duration_per_exercise': 4}
        },
        'moderate': {
            'weight_loss': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 4},
            'stay_fit': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 4},
            'build_muscle': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 5},
            'gain_weight': {'exercises': 5, 'sets': 2, 'duration_per_exercise': 5}
        },
        'high': {
            'weight_loss': {'exercises': 6, 'sets': 2, 'duration_per_exercise': 4},
            'stay_fit': {'exercises': 6, 'sets': 2, 'duration_per_exercise': 4},
            'build_muscle': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 5},
            'gain_weight': {'exercises': 6, 'sets': 3, 'duration_per_exercise': 5}
        }
    }
}
GOAL_CONFIG = {
    'weight_loss': 15,
    'stay_fit': 15,
    'build_muscle': 10,
    'gain_weight': 8
}
REP_TIME_CONFIG = {
    'adult': {'low': 4, 'moderate': 4, 'high': 3},
    'middle_aged': {'low': 5, 'moderate': 5, 'high': 4},
    'older_adult': {'low': 6, 'moderate': 6, 'high': 5}
}
REST_TIME_CONFIG = {
    'adult': {'low': 45, 'moderate': 30, 'high': 20},
    'middle_aged': {'low': 60, 'moderate': 45, 'high': 30},
    'older_adult': {'low': 75, 'moderate': 60, 'high': 45}
}

def prioritize_focus_area(focus_areas: List[str], user_goal: str) -> str:
    """
    Prioritize a single focus area from a list of focus areas.
    - Prioritize 'Full Body' if present.
    - Otherwise, use goal-based prioritization.
    
    Args:
        focus_areas: List of focus areas (e.g., ['Arms', 'Legs']) or comma-separated string.
        user_goal: User's goal (e.g., 'weight_loss', 'build_muscle').
    
    Returns:
        str: Selected focus area (e.g., 'Arms').
    """
    if isinstance(focus_areas, str):
        focus_areas = [f.strip().capitalize() for f in focus_areas.split(',')]
    
    valid_focus_areas = ['Arms', 'Legs', 'Hips', 'Stomach', 'Full Body']
    focus_areas = [f for f in focus_areas if f in valid_focus_areas]
    
    if not focus_areas:
        return 'Full Body'
        
    if 'Full Body' in focus_areas:
        return 'Full Body'
    
    goal_priority = {
        'weight_loss': ['Stomach', 'Hips', 'Legs', 'Arms', 'Full Body'],
        'build_muscle': ['Full Body', 'Arms', 'Legs', 'Hips', 'Stomach'],
        'gain_weight': ['Full Body', 'Legs', 'Arms', 'Hips', 'Stomach'],
        'stay_fit': ['Full Body', 'Arms', 'Legs', 'Stomach', 'Hips']
    }
    
    for focus in goal_priority.get(user_goal, ['Full Body', 'Arms', 'Legs', 'Stomach', 'Hips']):
        if focus in focus_areas:
            return focus
    
    return focus_areas[0]

def preprocess_health_condition(conditions: List[str]) -> str:
    """
    Preprocess health_condition to handle multiple conditions by mapping to a single condition.
    """
    if not conditions or (isinstance(conditions, list) and not conditions):
        return ""
    condition_str = ",".join(conditions) if isinstance(conditions, list) else conditions
    condition_list = condition_str.split(",") if isinstance(condition_str, str) else [condition_str]
    if len(condition_list) == 1:
        return condition_list[0]
    condition_map = {
        frozenset(["Menopause", "Diabetes Type 2"]): "Menopause",
        frozenset(["Menopause", "Hypertension"]): "Menopause",
        frozenset(["Diabetes Type 2", "Hypertension"]): "Diabetes Type 2",
        frozenset(["Menopause", "Diabetes Type 2", "Hypertension"]): "Menopause"
    }
    condition_set = frozenset(condition_list)
    return condition_map.get(condition_set, condition_list[0])

def map_age_to_group(age: int) -> str:
    logger.info(f"Mapping age {age} to age group")
    if age < 40:
        return 'adult'
    elif 40 <= age < 60:
        return 'middle_aged'
    return 'older_adult'

def convert_activity_level(slider_value: int) -> str:
    logger.info(f"Converting activity level slider value {slider_value}")
    try:
        value = int(slider_value)
        if value < 35:
            return 'low'
        elif value < 70:
            return 'moderate'
        return 'high'
    except (ValueError, TypeError) as e:
        logger.error(f"Error converting activity level: {str(e)}")
        return 'moderate'

def load_user_profile(data: Dict, cycle_phases: List[Dict] = None) -> None:
    global USER_AGE, USER_AGE_GROUP, USER_ACTIVITY_LEVEL, USER_REST_DAY, USER_PROGRAM_DURATION, USER_GOAL, USER_WEIGHT, USER_HEIGHT, USER_HEALTH_CONDITIONS, USER_FOCUS_AREA, USER_CYCLE_PHASES, USER_PREFERRED_INTENSITY, USER_PLAN_START_DATE, USER_CYCLE_LENGTH
    try:
        logger.info("Loading user profile")
        USER_AGE = int(data['age'])
        USER_ACTIVITY_LEVEL = convert_activity_level(int(data['activityLevel']))
        USER_REST_DAY = data['preferredRestDay']
        USER_PROGRAM_DURATION = int(data['challengeDays'])
        USER_GOAL = data['goal']
        USER_WEIGHT = float(data['weight'])
        USER_HEIGHT = float(data['height'])
        USER_HEALTH_CONDITIONS = data.get('diseases', [])
        
        # Handle areasOfFocus as string or list
        focus_areas = data.get('areasOfFocus', 'Full Body')
        if isinstance(focus_areas, str):
            USER_FOCUS_AREA = [f.strip().capitalize() for f in focus_areas.split(',')]
        elif isinstance(focus_areas, list):
            USER_FOCUS_AREA = [str(f).strip().capitalize() for f in focus_areas]
        else:
            logger.warning(f"Invalid areasOfFocus type: {type(focus_areas)}, defaulting to ['Full Body']")
            USER_FOCUS_AREA = ['Full Body']
        
        USER_AGE_GROUP = map_age_to_group(USER_AGE)
        USER_CYCLE_PHASES = cycle_phases if isinstance(cycle_phases, list) else []
        USER_PLAN_START_DATE = data.get('planStartDate')
        
        valid_intensities = ["low", "moderate", "high"]
        preferred_intensity = data.get('preferredIntensity')
        if preferred_intensity and preferred_intensity.lower() in valid_intensities:
            USER_PREFERRED_INTENSITY = preferred_intensity.lower()
            logger.info(f"Set user preferred intensity: {USER_PREFERRED_INTENSITY}")
        else:
            USER_PREFERRED_INTENSITY = None
            if preferred_intensity:
                logger.info(f"Invalid preferred intensity '{preferred_intensity}', using rules-based MET recommendation")
        
        USER_CYCLE_LENGTH = data.get('cycleLength')
        if USER_CYCLE_LENGTH is not None:
            try:
                USER_CYCLE_LENGTH = int(USER_CYCLE_LENGTH)
                if USER_CYCLE_LENGTH < 21 or USER_CYCLE_LENGTH > 35:
                    logger.warning(f"Cycle length {USER_CYCLE_LENGTH} is outside typical range (21-35 days), using default 28")
                    USER_CYCLE_LENGTH = 28
                logger.info(f"Set user cycle length: {USER_CYCLE_LENGTH} days")
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid cycle length '{USER_CYCLE_LENGTH}': {e}, using default 28")
                USER_CYCLE_LENGTH = 28
        else:
            logger.info("No cycle length provided, defaulting to None")
            
        logger.info(f"User profile loaded: Age={USER_AGE}, ActivityLevel={USER_ACTIVITY_LEVEL}, Goal={USER_GOAL}, FocusArea={USER_FOCUS_AREA}, HealthConditions={USER_HEALTH_CONDITIONS}, CyclePhases={len(USER_CYCLE_PHASES)}, CycleLength={USER_CYCLE_LENGTH}")
    except (KeyError, ValueError) as e:
        logger.error(f"Error in user profile data: {e}")
        raise

def get_recommended_met(age: int, activity: str) -> List[str]:
    logger.info(f"Getting recommended MET for age {age} and activity {activity}")
    activity = activity.lower()
    if 15 <= age <= 34:
        if activity == 'low':
            return ['low']
        elif activity == 'moderate':
            return ['low', 'moderate']
        elif activity == 'high':
            return ['low', 'moderate', 'high']
    elif 35 <= age <= 49:
        if activity != 'high':
            return ['low']
        else:
            return ['low', 'moderate']
    else:
        if activity != 'high':
            return ['low']
        else:
            return ['low', 'moderate']
    return []

def recommend_met() -> str:
    if USER_PREFERRED_INTENSITY:
        logger.info(f"Using user-preferred intensity: {USER_PREFERRED_INTENSITY}")
        return USER_PREFERRED_INTENSITY
    met_levels = get_recommended_met(USER_AGE, USER_ACTIVITY_LEVEL)
    if 'high' in met_levels:
        return 'high'
    elif 'moderate' in met_levels:
        return 'moderate'
    return 'low'

def get_recommended_difficulty(age: int, activity: str) -> List[str]:
    logger.info(f"Getting recommended difficulty for age {age} and activity {activity}")
    activity = activity.lower()
    if 15 <= age <= 34:
        return ['Beginner', 'Intermediate']
    elif 35 <= age <= 49:
        if activity in ['moderate', 'high']:
            return ['Beginner', 'Intermediate']
        else:
            return ['Beginner']
    else:
        return ['Beginner']
    return []

def map_health_conditions_to_workout_filters(conditions: List[str]) -> Tuple[List[str], List[str]]:
    logger.info(f"Mapping health conditions to workout filters: {conditions}")
    recommended_mets = set(['low', 'moderate', 'high'])
    recommended_difficulty = set(['Beginner', 'Intermediate', 'Advanced'])
    if 'Diabetes' in conditions:
        recommended_mets &= {'low', 'moderate'}
        recommended_difficulty &= {'Beginner', 'Intermediate'}
    if 'Hypertension' in conditions:
        recommended_mets &= {'low', 'moderate'}
        recommended_difficulty &= {'Beginner'}
    if 'Menopause' in conditions:
        recommended_mets &= {'low', 'moderate'}
        recommended_difficulty &= {'Beginner', 'Intermediate'}
    return list(recommended_mets), list(recommended_difficulty)

def filter_workouts(df: pd.DataFrame, met_recs: List[str], diff_recs: List[str]) -> pd.DataFrame:
    logger.info("Filtering workouts based on MET and difficulty recommendations")
    met_mask = pd.Series([False] * len(df))
    for met_level in met_recs:
        if met_level in MET_RANGES:
            min_val, max_val = MET_RANGES[met_level]
            met_mask |= df['MET Value'].between(min_val, max_val)
    diff_recs = [d.capitalize() for d in diff_recs]
    filtered_df = df[met_mask & df['Difficulty'].isin(diff_recs)]
    logger.info(f"Filtered workouts: {len(filtered_df)} entries")
    return filtered_df

def filter_by_health_conditions(df: pd.DataFrame, health_conditions: List[str]) -> pd.DataFrame:
    logger.info(f"Applying health condition filters: {health_conditions}")
    if not health_conditions:
        return df
        
    if 'Diabetes' in health_conditions:
        df = df[df['MET Value'] <= 6]
    if 'Hypertension' in health_conditions:
        df = df[df.get('Caution') != 'Isometric Hold']
        df = df[df['MET Value'] <= 5.5]
    if 'Menopause' in health_conditions:
        df = df[df.get('Caution') != 'Plyometric HIIT']
        df = df[df['MET Value'] <= 6]
    return df

def load_templates(templates_file: str) -> pd.DataFrame:
    logger.info(f"Loading templates from {templates_file}")
    try:
        templates_df = pd.read_csv(templates_file)
        if not all(col in templates_df.columns for col in ['goal', 'template_id', 'focus_days']):
            raise ValueError("Templates CSV missing required columns: goal, template_id, focus_days")
        templates_df['focus_days'] = templates_df['focus_days'].apply(ast.literal_eval)
        logger.info(f"Loaded {len(templates_df)} templates")
        return templates_df
    except Exception as e:
        logger.error(f"Error loading templates: {str(e)}")
        raise

def load_model_and_preprocessors() -> Tuple[object, object, object, object, object, object]:
    logger.info("Loading model and preprocessors")
    try:
        model = joblib.load(MODEL_FILE)
        scaler = joblib.load(SCALER_FILE)
        le_goal = joblib.load(LE_GOAL_FILE)
        le_health = joblib.load(LE_HEALTH_FILE)
        le_focus = joblib.load(LE_FOCUS_FILE)
        le_rest_day = joblib.load(LE_REST_DAY_FILE)
        return model, scaler, le_goal, le_health, le_focus, le_rest_day
    except Exception as e:
        logger.error(f"Error loading model or preprocessors: {str(e)}")
        raise

def score_template(user: Dict, template_id: str, templates_df: pd.DataFrame) -> Tuple[str, float, float]:
    logger.debug(f"Scoring template {template_id} for user")
    try:
        template = templates_df[templates_df['template_id'] == template_id].iloc[0]
        focus_days = template['focus_days']
        goal = user.get('fitness_goal', 'stay_fit')
        bmi = user.get('weight', 70.0) / ((user.get('height', 170.0) / 100) ** 2) if user.get('height', 0) > 0 else 0
        goal_alignment_score = 0
        focus_alignment_score = 0
        penalty_score = 0
        bonus_score = 0
        priorities = GOAL_PRIORITIES.get(goal, [])

        for focus in focus_days:
            if focus in priorities:
                goal_alignment_score += 8
            else:
                penalty_score -= 8

        for i, focus in enumerate(focus_days[:3]):
            if focus in priorities[:2]:
                bonus_score += 5 - i

        user_focus_areas = user.get('preferred_focus_area', ['Full Body'])
        for user_focus in user_focus_areas:
            if any(focus in FOCUS_AREA_MAPPING.get(user_focus, []) for focus in focus_days):
                focus_alignment_score += 30 / len(user_focus_areas)
            else:
                penalty_score -= 15 / len(user_focus_areas)

        focus_counts = Counter(focus_days)
        for focus, count in focus_counts.items():
            if count > 2:
                penalty_score -= 5 * (count - 2)

        high_met_count = sum(focus in HIGH_MET_FOCI for focus in focus_days)
        health_conditions = user.get('original_health_conditions', [])
        if any(cond in ['Hypertension', 'Diabetes'] for cond in health_conditions):
            penalty_score -= 10 * high_met_count

        if user.get('weight', 0) > 80 and goal == 'weight_loss':
            cardio_foci = ['Cardio', 'Full Body HIIT']
            if sum(focus in cardio_foci for focus in focus_days) >= 3:
                bonus_score += 15
            else:
                penalty_score -= 8

        if user.get('activity_level', 0) >= 70:
            bonus_score += 10
        elif user.get('activity_level', 0) < 30:
            penalty_score -= 8

        if bmi > 30 and goal in ['weight_loss', 'stay_fit']:
            if any(focus in ['Cardio', 'Full Body HIIT'] for focus in focus_days):
                bonus_score += 10
            else:
                penalty_score -= 8

        if user.get('age', 30) > 50:
            if any(focus in ['Light Endurance'] for focus in focus_days):
                bonus_score += 10
            else:
                penalty_score -= 8

        total_score = goal_alignment_score + focus_alignment_score + bonus_score + penalty_score
        max_possible_score = 40 + 30 + 15 + 25
        min_possible_score = -25 - 15 - 15 - 32
        normalized_score = ((total_score - min_possible_score) / (max_possible_score - min_possible_score)) * 100 if max_possible_score != min_possible_score else 0

        threshold = 62
        if user.get('activity_level', 50) < 50:
            threshold += 6
        if goal in ['build_muscle', 'gain_weight']:
            threshold += 4
        if any(cond in ['Hypertension', 'Diabetes'] for cond in health_conditions):
            threshold += 3

        label = 'successful' if normalized_score >= threshold else 'fail'
        return label, normalized_score, bmi
    except Exception as e:
        logger.error(f"Error in score_template for {template_id}: {str(e)}")
        raise
    
def predict_template(
    user: Dict,
    template_id: str,
    model: object,
    scaler: object,
    le_goal: object,
    le_health: object,
    le_focus: object,
    le_rest_day: object,
    templates_df: pd.DataFrame,
    prob_threshold: float = 0.65
) -> Tuple[str, float, float, str]:
    logger.debug(f"Predicting template {template_id} suitability")
    try:
        rule_label, score, bmi = score_template(user, template_id, templates_df)
        features = {
            'activity_level': user.get('activity_level', 50),
            'weight': user.get('weight', 70.0),
            'height': user.get('height', 170.0),
            'age': user.get('age', 30),
            'bmi': bmi,
            'goal': le_goal.transform([user.get('fitness_goal', 'stay_fit')])[0],
            'health_condition': le_health.transform([user.get('health_condition', '')])[0],
            'preferred_focus_area': le_focus.transform([user.get('preferred_focus_area', 'Full Body')])[0],
            'preferred_rest_day': le_rest_day.transform([user.get('preferred_rest_day', 'Sunday')])[0],
            'activity_bmi_interaction': user.get('activity_level', 50) * bmi,
            'age_health_interaction': user.get('age', 30) * le_health.transform([user.get('health_condition', '')])[0]
        }
        X = pd.DataFrame([features])
        X[['activity_level', 'weight', 'height', 'age', 'bmi', 'activity_bmi_interaction']] = scaler.transform(
            X[['activity_level', 'weight', 'height', 'age', 'bmi', 'activity_bmi_interaction']]
        )
        prob = model.predict_proba(X)[0, 1]
        pred = 'successful' if prob >= prob_threshold else 'fail'
        with open(os.path.join(log_dir, 'manual_highest_score_log.csv'), 'a') as f:
            f.write(f"{user['user_id']},{template_id},{pred},{prob:.3f},{score:.3f},{rule_label},{templates_df[templates_df['template_id'] == template_id]['goal'].iloc[0]},{datetime.now()}\n")
        return pred, prob, score, rule_label
    except Exception as e:
        logger.error(f"Error predicting for template {template_id}: {str(e)}")
        with open(os.path.join(log_dir, 'manual_highest_score_log.csv'), 'a') as f:
            f.write(f"{user['user_id']},{template_id},error,0.000,0.000,none,{templates_df[templates_df['template_id'] == template_id]['goal'].iloc[0] if template_id in templates_df['template_id'].values else 'unknown'},{datetime.now()},{str(e)}\n")
        raise

def select_best_template(
    user: Dict,
    templates_df: pd.DataFrame,
    model: object,
    scaler: object,
    le_goal: object,
    le_health: object,
    le_focus: object,
    le_rest_day: object
) -> str:
    logger.info(f"Selecting best template for user with goal {user['fitness_goal']}")
    goal = user.get('fitness_goal', 'stay_fit')
    aligned_templates = templates_df[templates_df['goal'] == goal]['template_id'].tolist()
    if not aligned_templates:
        logger.error(f"No templates found for goal {goal}")
        raise ValueError(f"No templates found for goal {goal}")

    predictions = []
    for template_id in aligned_templates:
        try:
            pred, prob, score, rule_label = predict_template(
                user, template_id, model, scaler, le_goal, le_health, le_focus, le_rest_day, templates_df
            )
            predictions.append({
                'template_id': template_id,
                'prediction': pred,
                'probability': prob,
                'score': score,
                'rule_label': rule_label,
                'template_goal': templates_df[templates_df['template_id'] == template_id]['goal'].iloc[0]
            })
        except Exception as e:
            logger.error(f"Error predicting for template {template_id}: {str(e)}")

    rule_successful = [p for p in predictions if p['rule_label'] == 'successful']
    if rule_successful:
        max_score = max(p['score'] for p in rule_successful)
        top_templates = [p for p in rule_successful if p['score'] >= max_score * 0.95]
        best_template = random.choice(top_templates)
        logger.info(f"Selected template (rule-based): {best_template['template_id']} (Score: {best_template['score']:.3f})")
        return best_template['template_id']

    successful_predictions = [p for p in predictions if p['prediction'] == 'successful']
    if successful_predictions:
        max_score = max(p['score'] for p in successful_predictions)
        top_templates = [p for p in successful_predictions if p['score'] >= max_score * 0.95]
        best_template = random.choice(top_templates)
        logger.info(f"Selected template (model): {best_template['template_id']} (Score: {best_template['score']:.3f})")
        return best_template['template_id']

    if predictions:
        max_score = max(p['score'] for p in predictions)
        top_templates = [p for p in predictions if p['score'] >= max_score * 0.95]
        best_template = random.choice(top_templates)
        logger.info(f"Selected template (highest score fallback): {best_template['template_id']} (Score: {best_template['score']:.3f})")
        return best_template['template_id']

    logger.error("No valid templates found for the user")
    raise ValueError("No valid templates found for the user")

def get_actual_date(day_index: int) -> Tuple[str, str]:
    if USER_PLAN_START_DATE:
        try:
            start_date = datetime.strptime(USER_PLAN_START_DATE, '%d-%m-%Y').date()
        except (ValueError, TypeError) as e:
            start_date = datetime.now().date()
            logger.warning(f"Invalid plan start date '{USER_PLAN_START_DATE}': {e}, using current date: {start_date.strftime('%d-%m-%Y')}")
    else:
        start_date = datetime.now().date()
        logger.info(f"No plan start date provided, using current date: {start_date.strftime('%d-%m-%Y')}")
    actual_date = start_date + timedelta(days=day_index)
    weekday = actual_date.strftime('%A')
    date_str = actual_date.strftime('%B %d, %Y')
    return weekday, date_str

def generate_plan(
    user: Dict,
    program_duration: int,
    templates_df: pd.DataFrame,
    model: object,
    scaler: object,
    le_goal: object,
    le_health: object,
    le_focus: object,
    le_rest_day: object
) -> List[Dict]:
    logger.info(f"Generating workout plan blueprint for user with goal {user['fitness_goal']}")
    try:
        template_id = select_best_template(
            user, templates_df, model, scaler, le_goal, le_health, le_focus, le_rest_day
        )
        template = templates_df[templates_df['template_id'] == template_id]
        if template.empty:
            logger.error(f"Template {template_id} not found")
            raise ValueError(f"Template {template_id} not found")

        focus_days = template['focus_days'].iloc[0]
        plan = []
        focus_day_counter = 0
        workout_streak = 0

        for i in range(program_duration):
            weekday, date_str = get_actual_date(i)
            preferred_rest_day = user.get('preferred_rest_day', 'Sunday')
            focus = None
            if weekday == preferred_rest_day:
                focus = 'Complete Rest Day'
                workout_streak = 0
                logger.info(f"Day {i+1} ({weekday}, {date_str}): Set as Complete Rest Day")
            elif workout_streak >= 3:
                focus = 'Active Rest Day'
                workout_streak = 0
                logger.info(f"Day {i+1} ({weekday}, {date_str}): Set as Active Rest Day")
            else:
                focus = focus_days[focus_day_counter % len(focus_days)]
                focus_day_counter += 1
                workout_streak += 1
                logger.info(f"Day {i+1} ({weekday}, {date_str}): Assigned focus {focus}")
            plan.append({
                'Day': f'Day {i+1} ({weekday}, {date_str})',
                'Focus': focus,
                'Date': date_str
            })
        return plan
    except Exception as e:
        logger.error(f"Error generating plan blueprint: {str(e)}")
        raise

def calculate_calories_burned(met: float, duration_minutes: float, weight_kg: float) -> float:
    calories = (met * 3.5 * weight_kg / 200) * duration_minutes
    logger.debug(f"Calculating calories: MET={met}, Duration={duration_minutes} min, Weight={weight_kg} kg, Calories={calories}")
    return calories

def clean_workout_data(workout: Dict) -> Dict:
    logger.debug("Cleaning workout data")
    cleaned_workout = {}
    for key, value in workout.items():
        if isinstance(value, float) and np.isnan(value):
            cleaned_workout[key] = None
        elif isinstance(value, str) and value.lower() in ['nan', '']:
            cleaned_workout[key] = None
        else:
            cleaned_workout[key] = value
    cleaned_workout['Youtube Links'] = str(cleaned_workout.get('Youtube Links', '')) or None
    cleaned_workout['Time Segment'] = str(cleaned_workout.get('Time Segment', '')) or None
    return cleaned_workout

def smart_get_workouts_for_focus(workouts_df: pd.DataFrame, focus_area: str, user_focus_areas: List[str], prefer_lowest_met: bool = False) -> List[Dict]:
    logger.info(f"Getting workouts for focus area {focus_area}")
    met_level = recommend_met()
    fallback_focus_map = {
        'Core + Lower Body': ['Lower Body Strength', 'Core + Abs', 'Lower Body Strength'],
        'Full Body HIIT': ['Light Endurance', 'Cardio'],
        'Core + Chest': ['Core + Abs', 'Upper Body Strength'],
        'Abs + Upper Body': ['Core + Abs', 'Upper Body Strength']
    }
    default_light_fallback = workouts_df[
        (workouts_df['Type'].isin(['Mobility', 'Stretching'])) &
        (workouts_df['Difficulty'] == 'Beginner')
    ]

    def filter_workouts(focus: str, prioritize_user_focus: bool = False) -> pd.DataFrame:
        filters = FOCUS_AREA_DEFINITIONS.get(focus, {})
        if not filters:
            logger.warning(f"No filters defined for focus area {focus}")
            return pd.DataFrame()

        muscle_filter = workouts_df['Target Muscle'].isin(filters.get('target_muscles', [])) if filters.get('target_muscles') else True
        type_filter = workouts_df['Type'].isin(filters.get('Type', [])) if filters.get('Type') else True
        caution_filter = workouts_df['Caution'].isin(filters.get('Caution', [])) if filters.get('Caution') else True

        if isinstance(muscle_filter, bool):
            filtered = workouts_df[type_filter & caution_filter]
        elif isinstance(type_filter, bool):
            filtered = workouts_df[muscle_filter & caution_filter]
        elif isinstance(caution_filter, bool):
            filtered = workouts_df[muscle_filter & type_filter]
        else:
            filtered = workouts_df[muscle_filter & type_filter & caution_filter]

        if focus == 'Light Endurance':
            filtered = filtered[
                (filtered['Difficulty'].isin(['Beginner', 'Intermediate'])) &
                (filtered['MET Value'] <= 6)
            ]
        min_met, max_met = MET_RANGES[met_level]
        filtered = filtered[
            (filtered['MET Value'] >= min_met) & (filtered['MET Value'] <= max_met)
        ]

        if prioritize_user_focus and user_focus_areas:
            user_target_muscles = set()
            valid_focus_areas = [f for f in user_focus_areas if f in USER_FOCUS_TO_MUSCLES]
            if 'Full Body' in valid_focus_areas:
                for focus in USER_FOCUS_TO_MUSCLES:
                    user_target_muscles.update(USER_FOCUS_TO_MUSCLES[focus])
            else:
                for focus in valid_focus_areas:
                    user_target_muscles.update(USER_FOCUS_TO_MUSCLES[focus])
            if user_target_muscles:
                filtered = filtered.sort_values(
                    by='MET Value',
                    key=lambda x: filtered['Target Muscle'].apply(lambda m: 0 if m in user_target_muscles else 1),
                    ascending=True
                )

        logger.debug(f"Filtered workouts for focus {focus}: {len(filtered)} entries")
        return filtered

    primary_workouts = filter_workouts(focus_area, prioritize_user_focus=True)
    if not primary_workouts.empty:
        primary_workouts['MET Value'] = pd.to_numeric(primary_workouts['MET Value'], errors='coerce')
        primary_workouts = primary_workouts.dropna(subset=['MET Value'])
        if not primary_workouts.empty:
            sorted_workouts = primary_workouts.sort_values(by='MET Value')
            logger.info(f"Found {len(sorted_workouts)} primary workouts for focus {focus_area}")
            return sorted_workouts.to_dict('records') if not prefer_lowest_met else sorted_workouts.head(10).to_dict('records')
        logger.warning(f"No valid numeric MET values for focus {focus_area}")

    fallback_focuses = fallback_focus_map.get(focus_area, [])
    for alt_focus in fallback_focuses:
        fallback_workouts = filter_workouts(alt_focus)
        if not fallback_workouts.empty:
            fallback_workouts['MET Value'] = pd.to_numeric(fallback_workouts['MET Value'], errors='coerce')
            fallback_workouts = fallback_workouts.dropna(subset=['MET Value'])
            if not fallback_workouts.empty:
                logger.info(f"Found {len(fallback_workouts)} fallback workouts for focus {alt_focus}")
                return fallback_workouts.sort_values(by='MET Value').to_dict('records')

    if met_level == 'low':
        relaxed = workouts_df[
            (workouts_df['Difficulty'].isin(['Beginner', 'Intermediate'])) &
            (workouts_df['MET Value'] <= 6)
        ]
        if not relaxed.empty:
            relaxed['MET Value'] = pd.to_numeric(relaxed['MET Value'], errors='coerce')
            relaxed = relaxed.dropna(subset=['MET Value'])
            if not relaxed.empty:
                logger.info(f"Found {len(relaxed)} relaxed workouts for low activity level")
                return relaxed.sort_values(by='MET Value').to_dict('records')

    if not default_light_fallback.empty:
        default_light_fallback['MET Value'] = pd.to_numeric(default_light_fallback['MET Value'], errors='coerce')
        default_light_fallback = default_light_fallback.dropna()
        if not default_light_fallback.empty:
            logger.info(f"Using {len(default_light_fallback)} default light fallback workouts")
            return default_light_fallback.sort_values(by='MET Value').to_dict('records')

    logger.warning(f"No workouts found for focus {focus_area} and MET level {met_level}")
    return []

def generate_workout_plan(data: Dict[str, Any], cycle_phases: List[Dict] = None) -> Tuple[List[Dict], str]:
    global USER_AGE_GROUP, USER_ACTIVITY_LEVEL, USER_GOAL, USER_WEIGHT, USER_CYCLE_PHASES, USER_HEALTH_CONDITIONS, USER_FOCUS_AREA
    try:
        logger.info("Starting workout plan generation")
        load_user_profile(data, cycle_phases)

        processed_health_condition = preprocess_health_condition(USER_HEALTH_CONDITIONS)
        processed_focus_area = prioritize_focus_area(USER_FOCUS_AREA, USER_GOAL)
        
        logger.info(f"Loading workouts CSV from {WORKOUTS_CSV_PATH}")
        workouts_df = pd.read_csv(WORKOUTS_CSV_PATH)
        workouts_df = workouts_df.replace({np.nan: None})
        workouts_df['MET Value'] = pd.to_numeric(workouts_df['MET Value'], errors='coerce')
        workouts_df = workouts_df.dropna(subset=['MET Value'])
        workouts_df['Difficulty'] = workouts_df['Difficulty'].str.strip().str.capitalize()
        workouts_df['Youtube Links'] = workouts_df['Youtube Links'].astype(str).replace('nan', None)
        workouts_df['Time Segment'] = workouts_df['Time Segment'].astype(str).replace('nan', None)
        logger.info(f"Loaded {len(workouts_df)} workout entries after cleaning")

        met_recs = [recommend_met()]
        diff_recs = get_recommended_difficulty(USER_AGE, USER_ACTIVITY_LEVEL)
        if USER_HEALTH_CONDITIONS:
            health_mets, health_difficulties = map_health_conditions_to_workout_filters(USER_HEALTH_CONDITIONS)
            met_recs = list(set(met_recs) & set(health_mets))
            diff_recs = list(set(diff_recs) & set(health_difficulties))
        filtered_df = filter_workouts(workouts_df, met_recs, diff_recs)
        filtered_df = filter_by_health_conditions(filtered_df, USER_HEALTH_CONDITIONS)

        templates_df = load_templates(TEMPLATES_CSV_PATH)
        model, scaler, le_goal, le_health, le_focus, le_rest_day = load_model_and_preprocessors()

        if USER_GOAL not in le_goal.classes_:
            logger.error(f"Invalid fitness_goal: {USER_GOAL} not in {le_goal.classes_}")
            raise ValueError(f"Invalid fitness_goal: {USER_GOAL}")
        if processed_health_condition not in le_health.classes_:
            logger.error(f"Invalid health_condition: {processed_health_condition} not in {le_health.classes_}")
            raise ValueError(f"Invalid health_condition: {processed_health_condition}")
        if processed_focus_area not in le_focus.classes_:
            logger.error(f"Invalid preferred_focus_area: {processed_focus_area} not in {le_focus.classes_}")
            raise ValueError(f"Invalid preferred_focus_area: {processed_focus_area}. Must be one of {le_focus.classes_}")
        if USER_REST_DAY not in le_rest_day.classes_:
            logger.error(f"Invalid preferred_rest_day: {USER_REST_DAY} not in {le_rest_day.classes_}")
            raise ValueError(f"Invalid preferred_rest_day: {USER_REST_DAY}")

        user = {
            'user_id': data.get('userId', 'user_001'),
            'fitness_goal': USER_GOAL,
            'activity_level': 70 if USER_ACTIVITY_LEVEL == 'high' else 50 if USER_ACTIVITY_LEVEL == 'moderate' else 30,
            'preferred_focus_area': processed_focus_area,
            'weight': USER_WEIGHT,
            'height': USER_HEIGHT * 30.48,
            'age': USER_AGE,
            'health_condition': processed_health_condition,
            'original_health_conditions': USER_HEALTH_CONDITIONS,
            'preferred_rest_day': USER_REST_DAY
        }

        plan = generate_plan(
            user, USER_PROGRAM_DURATION, templates_df, model, scaler, le_goal, le_health, le_focus, le_rest_day
        )
        plan_df = pd.DataFrame(plan)
        logger.info(f"Generated plan blueprint with {len(plan)} days")

        config = WORKOUT_CONFIG[USER_AGE_GROUP][USER_ACTIVITY_LEVEL][USER_GOAL]
        num_exercises = config['exercises']
        sets = config['sets']
        reps = GOAL_CONFIG[USER_GOAL]
        rep_time = REP_TIME_CONFIG[USER_AGE_GROUP][USER_ACTIVITY_LEVEL]
        rest_time = REST_TIME_CONFIG[USER_AGE_GROUP][USER_ACTIVITY_LEVEL]
        intensity = USER_PREFERRED_INTENSITY if USER_PREFERRED_INTENSITY else USER_ACTIVITY_LEVEL
        logger.info(f"Workout parameters: Exercises={num_exercises}, Sets={sets}, Reps={reps}, RepTime={rep_time}, RestTime={rest_time}")

        final_plan = []
        focus_index_tracker = {}

        for idx, row in plan_df.iterrows():
            day_data = dict(row)
            focus = row['Focus']
            day_data['Workouts'] = []
            total_duration = 0
            total_calories = 0

            if USER_CYCLE_PHASES and idx < len(USER_CYCLE_PHASES):
                cycle_phase = USER_CYCLE_PHASES[idx]
                phase = cycle_phase.get('phase', 'neutral') or 'neutral'
                cycle_day = cycle_phase.get('cycle_day', None)
                override_lowest_intensity = False
                if isinstance(phase, str) and phase.lower() == 'menstruation' and cycle_day in [1, 2]:
                    focus = 'Pain Relief Stretches'
                    logger.info(f"Day {idx+1}: Set focus to Pain Relief Stretches due to menstruation phase")
                elif isinstance(phase, str) and phase.lower() == 'luteal' and cycle_day and cycle_day >= (USER_CYCLE_LENGTH - 2 if USER_CYCLE_LENGTH else 28):
                    override_lowest_intensity = True
                    logger.info(f"Day {idx+1}: Set override_lowest_intensity due to luteal phase")
            else:
                phase = 'neutral'
                cycle_day = None
                override_lowest_intensity = False
                if 'Menopause' in USER_HEALTH_CONDITIONS:
                    logger.info(f"Menopause detected: Using neutral phase for day {idx+1}")

            day_data['Cycle Phase'] = phase
            day_data['Cycle Day'] = cycle_day
            day_data['Focus'] = focus

            if 'Rest' in focus:
                if focus == 'Active Rest Day':
                    rest_exercises = filtered_df[
                        filtered_df['Type'].isin(['Mobility', 'Stretching'])
                    ].sample(n=7, replace=True).to_dict('records')
                    for w in rest_exercises:
                        w = clean_workout_data(w)
                        met = w.get('MET Value', 2.5) or 2.5
                        duration_min = 1.5
                        calories = calculate_calories_burned(met, duration_min, USER_WEIGHT)
                        w['Sets'] = 1
                        w['Reps'] = '90 sec hold'
                        w['Rest Time (sec)'] = rest_time
                        w['Duration (min)'] = duration_min
                        w['Calories Burned'] = round(calories, 2)
                        w['Youtube Links'] = w.get('Youtube Links')
                        w['Time Segment'] = w.get('Time Segment')
                        total_duration += duration_min
                        total_calories += calories
                        day_data['Workouts'].append(w)
                    day_data['Total Duration (min)'] = round(total_duration, 2)
                    day_data['Total Calories Burned'] = round(total_calories, 2)
                else:
                    day_data['Total Duration (min)'] = 0
                    day_data['Total Calories Burned'] = 0
            else:
                pool = smart_get_workouts_for_focus(filtered_df, focus, USER_FOCUS_AREA, override_lowest_intensity)
                start = focus_index_tracker.get(focus, 0)
                end = start + num_exercises
                selected = pool[start:end]
                if len(selected) < num_exercises and pool:
                    selected += pool[:num_exercises - len(selected)]
                focus_index_tracker[focus] = end % len(pool) if pool else 0

                adjusted_sets = sets
                adjusted_rest_time = rest_time
                if 'Hypertension' in USER_HEALTH_CONDITIONS:
                    adjusted_sets = min(adjusted_sets, 3)
                    adjusted_rest_time = int(adjusted_rest_time * 1.2)
                if 'Diabetes' in USER_HEALTH_CONDITIONS:
                    adjusted_rest_time += 10

                for w in selected:
                    w = clean_workout_data(w)
                    met = w.get('MET Value', 3) or 3
                    if focus == 'Pain Relief Stretches':
                        duration_min = 1.5
                        exercise_sets = 1
                        exercise_reps = '90 sec hold'
                        exercise_rest_time = rest_time
                    elif w.get('Caution') == 'Isometric Hold':
                        duration_min = 0.5
                        exercise_sets = 1
                        exercise_reps = '30 sec hold'
                        exercise_rest_time = rest_time
                    else:
                        total_seconds = (adjusted_sets * reps * rep_time) + ((adjusted_sets - 1) * adjusted_rest_time)
                        duration_min = total_seconds / 60
                        exercise_sets = adjusted_sets
                        exercise_reps = reps
                        exercise_rest_time = adjusted_rest_time
                    calories = calculate_calories_burned(met, duration_min, USER_WEIGHT)
                    w['Sets'] = exercise_sets
                    w['Reps'] = str(exercise_reps)
                    w['Rest Time (sec)'] = exercise_rest_time
                    w['Duration (min)'] = round(duration_min, 2)
                    w['Calories Burned'] = round(calories, 2)
                    w['Youtube Links'] = w.get('Youtube Links')
                    w['Time Segment'] = w.get('Time Segment')
                    total_duration += duration_min
                    total_calories += calories
                    day_data['Workouts'].append(w)
                day_data['Total Duration (min)'] = round(total_duration, 2)
                day_data['Total Calories Burned'] = round(total_calories, 2)

            final_plan.append(day_data)

        logger.info("Workout plan generation completed")
        return final_plan, intensity

    except Exception as e:
        logger.error(f"Error generating workout plan: {str(e)}")
        raise