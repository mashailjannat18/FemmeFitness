from typing import Dict, List, Any, Tuple
import numpy as np
import logging
import os
from datetime import datetime, timedelta

# Set up logging
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

# Global user variables
USER_AGE = None
USER_AGE_GROUP = None
USER_ACTIVITY_LEVEL = None
USER_GOAL = None
USER_WEIGHT = None
USER_HEIGHT = None
USER_BMI = None
USER_HEALTH_CONDITIONS = None
USER_CYCLE_PHASES = None

def map_age_to_group(age: int) -> str:
    logger.info(f"Mapping age {age} to age group")
    if age < 40:
        return 'adult'
    elif 40 <= age < 60:
        return 'middle_aged'
    return 'older_adult'

def convert_activity_level(slider_value: int) -> str:
    logger.info(f"Converting activity level slider value {slider_value}")
    if slider_value < 35:
        return 'low'
    elif slider_value < 70:
        return 'moderate'
    return 'high'

def calculate_bmi(height_feet: float, weight_kg: float) -> float:
    height_meters = height_feet * 0.3048
    bmi = weight_kg / (height_meters ** 2)
    logger.debug(f"Calculated BMI: Height={height_feet} ft, Weight={weight_kg} kg, BMI={bmi}")
    return round(bmi, 2)

def load_user_profile(data: Dict[str, Any], cycle_phases: List[Dict]) -> None:
    global USER_AGE, USER_AGE_GROUP, USER_ACTIVITY_LEVEL, USER_GOAL, USER_WEIGHT, USER_HEIGHT, USER_BMI, USER_HEALTH_CONDITIONS, USER_CYCLE_PHASES
    try:
        logger.info("Loading user profile for meal plan")
        USER_AGE = data['age']
        USER_ACTIVITY_LEVEL = convert_activity_level(data['activityLevel'])
        USER_GOAL = data['goal']
        USER_WEIGHT = data['weight']
        USER_HEIGHT = data['height']
        USER_AGE_GROUP = map_age_to_group(USER_AGE)
        USER_BMI = calculate_bmi(USER_HEIGHT, USER_WEIGHT)

        # Derive health conditions from the diseases array
        diseases = data.get('diseases', [])
        USER_HEALTH_CONDITIONS = {
            "has_diabetes": "Diabetes" in diseases,
            "has_hypertension": "Hypertension" in diseases,
            "is_menopausal": "Menopause" in diseases,
        }

        USER_CYCLE_PHASES = cycle_phases
        logger.info(f"User profile loaded: Age={USER_AGE}, ActivityLevel={USER_ACTIVITY_LEVEL}, Goal={USER_GOAL}, BMI={USER_BMI}, HealthConditions={USER_HEALTH_CONDITIONS}")
    except KeyError as e:
        logger.error(f"Missing required field in user profile data: {e}")
        raise

def adjust_calories(age: int, bmi: float, activity_level: str) -> float:
    if age < 30:
        bmr = 15.3 * bmi * 1.2 + 679
    elif age < 50:
        bmr = 11.6 * bmi * 1.2 + 879
    else:
        bmr = 13.5 * bmi * 1.2 + 487

    activity_multipliers = {"low": 1.2, "moderate": 1.55, "high": 1.9}
    calories = bmr * activity_multipliers.get(activity_level.lower(), 1.2)
    logger.debug(f"Adjusted calories: Age={age}, BMI={bmi}, ActivityLevel={activity_level}, Calories={calories}")
    return calories

def adjust_meal_calories(base_calories: float, calories_burned: float, goal: str) -> float:
    if goal == "weight_loss":
        calories = max(1200, base_calories - 300 + calories_burned)
    elif goal == "muscle_gain":
        calories = base_calories + 250 + calories_burned
    elif goal == "maintenance":
        calories = base_calories + calories_burned
    else:
        calories = base_calories
    logger.debug(f"Adjusted meal calories: Base={base_calories}, Burned={calories_burned}, Goal={goal}, Final={calories}")
    return calories

def adjust_calories_by_cycle(base_calories: float, cycle_phase: str) -> float:
    adjustments = {
        "menstruation": -0.08,
        "follicular": 0.0,
        "ovulation": 0.05,
        "luteal": 0.1
    }
    adjusted_calories = round(base_calories * (1 + adjustments.get(cycle_phase.lower(), 0)), 1)
    logger.debug(f"Adjusted calories by cycle phase: Base={base_calories}, Phase={cycle_phase}, Adjusted={adjusted_calories}")
    return adjusted_calories

def get_macronutrient_distribution(workout_type: str, health_conditions: Dict) -> Dict[str, int]:
    base_macros = {
        "strength": {"carbs": 40, "protein": 40, "fat": 20},
        "hiit": {"carbs": 50, "protein": 30, "fat": 20},
        "cardio": {"carbs": 55, "protein": 25, "fat": 20},
        "rest": {"carbs": 45, "protein": 30, "fat": 25}
    }

    macros = base_macros.get(workout_type.lower(), base_macros["rest"]).copy()

    if health_conditions.get("has_diabetes"):
        macros.update({"carbs": 45, "protein": 25, "fat": 30})

    if health_conditions.get("is_menopausal"):
        macros["protein"] = max(macros["protein"], 40)
        macros["carbs"] = min(macros["carbs"], 35)

    logger.debug(f"Macronutrient distribution for workout type {workout_type}: {macros}")
    return macros

def adjust_macros_by_cycle(macros: Dict[str, int], cycle_phase: str) -> Dict[str, float]:
    m = macros.copy()
    if cycle_phase.lower() == "menstruation":
        m["carbs"] += 5
        m["protein"] -= 5
    elif cycle_phase.lower() == "follicular":
        m["protein"] += 5
        m["carbs"] -= 5
    elif cycle_phase.lower() == "ovulation":
        m["protein"] += 5
        m["fat"] -= 5
    elif cycle_phase.lower() == "luteal":
        m["carbs"] += 5
        m["fat"] += 5
    total = sum(m.values())
    adjusted_macros = {k: round(v / total * 100, 1) for k, v in m.items()}
    logger.debug(f"Adjusted macros by cycle phase: Phase={cycle_phase}, Adjusted={adjusted_macros}")
    return adjusted_macros

def convert_macros_to_grams(total_calories: float, macro_distribution: Dict[str, float]) -> Dict[str, float]:
    calories_per_gram = {"carbs": 4, "protein": 4, "fat": 9}
    macro_grams = {
        macro: round((percent / 100) * total_calories / calories_per_gram[macro], 1)
        for macro, percent in macro_distribution.items()
    }
    logger.debug(f"Converted macros to grams: TotalCalories={total_calories}, Macros={macro_grams}")
    return macro_grams

def generate_health_tags(macros: Dict[str, float], total_calories: float, health_conditions: Dict, cycle_phase: str) -> List[str]:
    tags = []

    # Macronutrient distribution percentages
    perc = {
        "carbs": macros["carbs"] * 4 / total_calories * 100,
        "protein": macros["protein"] * 4 / total_calories * 100,
        "fat": macros["fat"] * 9 / total_calories * 100,
    }

    # Cycle-phase specific tags
    if not health_conditions.get("is_menopausal"):
        if cycle_phase.lower() == "menstruation":
            tags.extend(["Iron-Rich Focus", "Anti-Inflammatory Meals"])
        elif cycle_phase.lower() == "follicular":
            tags.extend(["High-Energy Meals", "Muscle Repair Support"])
        elif cycle_phase.lower() == "ovulation":
            tags.extend(["Hormone-Balancing Nutrients", "Fertility-Optimized Foods"])
        elif cycle_phase.lower() == "luteal":
            tags.extend(["Mood-Stabilizing Snacks", "Craving-Control Strategies"])

    # Health condition-based tags
    if health_conditions.get("has_diabetes"):
        if perc["carbs"] <= 45:
            tags.append("Low GI")
        if perc["carbs"] < 35:
            tags.append("Low Carb")
        if perc["protein"] >= 30:
            tags.append("High Protein")
        tags.append("Low Sugar")

    if health_conditions.get("has_hypertension"):
        tags.append("Low Sodium")
        if perc["fat"] < 25:
            tags.append("Heart-Friendly Fats")

    if health_conditions.get("is_menopausal"):
        if perc["protein"] >= 35:
            tags.append("Hormone-Supporting Protein")
        tags.append("Bone Health")

    logger.debug(f"Generated health tags: Phase={cycle_phase}, Tags={tags}")
    return tags

def baseline_sleep(age: int) -> float:
    if age < 26:
        return 8.0
    elif age < 65:
        return 7.5
    else:
        return 7.0

def baseline_water(age: int, weight_kg: float) -> float:
    if age < 26:
        ml_per_kg = 40
    elif age < 65:
        ml_per_kg = 35
    else:
        ml_per_kg = 30
    return round((ml_per_kg * weight_kg) / 1000, 2)

def adjust_sleep_by_calories(base_sleep: float, calories_burned: float) -> float:
    if calories_burned >= 500:
        return base_sleep + 0.5
    elif calories_burned >= 300:
        return base_sleep + 0.25
    return base_sleep

def adjust_water_by_calories(base_water: float, calories_burned: float) -> float:
    if calories_burned >= 500:
        return round(base_water + 0.75, 2)
    elif calories_burned >= 300:
        return round(base_water + 0.5, 2)
    return base_water

def normalize_workout_type(workout_type: str) -> str:
    workout_type = workout_type.lower()
    return workout_type if workout_type in ["strength", "hiit", "cardio", "rest"] else "rest"

def get_cycle_phase_for_day(day_number: int, workout_plan: List[Dict]) -> str:
    for day_data in workout_plan:
        if int(day_data['Day'].split('(')[0].replace('Day ', '').strip()) == day_number:
            return day_data.get('Cycle Phase', 'follicular')
    logger.warning(f"No cycle phase found for day {day_number}, defaulting to 'follicular'")
    return "follicular"

def clean_meal_data(meal: Dict) -> Dict:
    logger.debug("Cleaning meal data")
    cleaned_meal = {}
    for key, value in meal.items():
        if isinstance(value, float) and np.isnan(value):
            cleaned_meal[key] = None
        else:
            cleaned_meal[key] = value
    return cleaned_meal

def generate_meal_plan(workout_plan_data: Tuple[List[Dict], str], data: Dict[str, Any], cycle_phases: List[Dict] = None) -> List[Dict]:
    try:
        logger.info("Starting meal plan generation")
        load_user_profile(data, cycle_phases if cycle_phases else [])
        
        meal_plan = []

        # Unpack the workout plan data
        workout_plan, _ = workout_plan_data

        for day_data in workout_plan:
            day = day_data['Day']
            date_str = day_data['Date']
            total_calories = day_data['Total Calories Burned']
            workouts = day_data.get('Workouts', [])

            # Extract day number for cycle phase mapping
            day_number = int(day.split('(')[0].replace('Day ', '').strip())
            cycle_phase = get_cycle_phase_for_day(day_number, workout_plan)

            # Determine dominant workout type
            if not workouts:
                dominant_type = "rest"
                logger.info(f"{day}: No workouts, using dominant type 'rest'")
            else:
                max_calories = -1
                dominant_type = ""
                for workout in workouts:
                    if workout['Calories Burned'] > max_calories:
                        max_calories = workout['Calories Burned']
                        dominant_type = workout['Type'].lower()
                dominant_type = normalize_workout_type(dominant_type)
                logger.info(f"{day}: Dominant workout type={dominant_type}, Max Calories={max_calories}")

            # Calculate calories and macros
            base_calories = adjust_calories(USER_AGE, USER_BMI, USER_ACTIVITY_LEVEL)
            daily_calories = adjust_meal_calories(base_calories, total_calories, USER_GOAL)
            adjusted_calories = adjust_calories_by_cycle(daily_calories, cycle_phase)

            macros = get_macronutrient_distribution(dominant_type, USER_HEALTH_CONDITIONS)
            adjusted_macros = adjust_macros_by_cycle(macros, cycle_phase)
            macro_grams = convert_macros_to_grams(adjusted_calories, adjusted_macros)

            # Generate health tags
            health_tags = generate_health_tags(macro_grams, adjusted_calories, USER_HEALTH_CONDITIONS, cycle_phase)

            # Calculate sleep and water recommendations
            base_sleep = baseline_sleep(USER_AGE)
            base_water = baseline_water(USER_AGE, USER_WEIGHT)
            sleep_hours = adjust_sleep_by_calories(base_sleep, total_calories)
            water_litres = adjust_water_by_calories(base_water, total_calories)

            meal = {
                'Day': day,
                'Date': date_str,
                'daily_calories': round(adjusted_calories, 2),
                'carbs_grams': macro_grams['carbs'],
                'protein_grams': macro_grams['protein'],
                'fat_grams': macro_grams['fat'],
                'sleep_hours': round(sleep_hours, 2),
                'water_litres': round(water_litres, 2),
                'health_tags': ", ".join(health_tags) if health_tags else None,
            }

            cleaned_meal = clean_meal_data(meal)
            meal_plan.append(cleaned_meal)
            logger.info(f"Generated meal for {day}: Calories={adjusted_calories}, Carbs={macro_grams['carbs']}g, Protein={macro_grams['protein']}g, Fat={macro_grams['fat']}g, Sleep={sleep_hours}h, Water={water_litres}L, Tags={health_tags}")

        logger.info("Meal plan generation completed")
        return meal_plan

    except Exception as e:
        logger.error(f"Error generating meal plan: {str(e)}")
        raise