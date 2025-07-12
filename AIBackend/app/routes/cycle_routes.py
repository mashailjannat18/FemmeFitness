from flask import Blueprint, request, jsonify, current_app
from app.models.menstruation_cycle import predict_cycle_phases
from app.models.ovulation_recalibration import predict_recalibrated_future_phase
from app.models.workout_plan import generate_workout_plan
from app.models.meal_plan import generate_meal_plan
import numpy as np
from datetime import datetime, timedelta
import requests
import logging
from supabase import create_client, Client

cycle_bp = Blueprint('cycle', __name__)

# Initialize Supabase client when the blueprint is first accessed
@cycle_bp.before_app_first_request
def init_supabase():
    cycle_bp.supabase = create_client(
        current_app.config['SUPABASE_URL'],
        current_app.config['SUPABASE_KEY']
    )
    cycle_bp.SUPABASE_HEADERS = {
        'apikey': current_app.config['SUPABASE_KEY'],
        'Authorization': f'Bearer {current_app.config['SUPABASE_KEY']}',
        'Content-Type': 'application/json'
    }

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GOAL_MAPPING = {
    "Lose weight": "weight_loss",
    "Gain weight": "gain_weight",
    "Muscle build": "build_muscle",
    "Stay fit": "stay_fit"
}

def clean_json_data(data):
    """Recursively clean NaN values from a dictionary or list, converting them to None."""
    if isinstance(data, dict):
        return {k: clean_json_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_json_data(item) for item in data]
    elif isinstance(data, float) and np.isnan(data):
        return None
    return data

@cycle_bp.route('/generate-cycle-phases', methods=['POST'])
def generate_cycle_phases():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        required_fields = ['lastPeriodDate', 'cycleLength', 'bleedingDays', 'challengeDays']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        last_period_date_str = data['lastPeriodDate']
        cycle_length = int(data['cycleLength'])
        bleeding_days = int(data['bleedingDays'])
        challenge_days = int(data['challengeDays'])

        # Optional fields
        age = int(data.get('age', 30))
        weight_kg = float(data.get('weight', 60.0))
        height_feet = float(data.get('height', 5.5))

        # Validate input
        if cycle_length < 21 or cycle_length > 35:
            return jsonify({"error": "Cycle length must be between 21 and 35 days"}), 400
        if bleeding_days < 2 or bleeding_days > 7:
            return jsonify({"error": "Bleeding days must be between 2 and 7 days"}), 400
        if challenge_days <= 0:
            return jsonify({"error": "Challenge days must be greater than 0"}), 400

        try:
            last_period = datetime.strptime(last_period_date_str, '%Y-%m-%d')
            last_period_date_formatted = last_period.strftime('%d-%m-%Y')
        except ValueError as e:
            return jsonify({"error": f"Invalid lastPeriodDate format: {str(e)}"}), 400

        # Generate phases for FULL CYCLE LENGTH
        cycle_phases = predict_cycle_phases(
            last_period_date_str=last_period_date_formatted,
            cycle_length=cycle_length,
            bleeding_days=bleeding_days,
            age=age,
            weight_kg=weight_kg,
            height_feet=height_feet
        )

        # Return all phases (not just challenge days)
        return jsonify(cycle_phases), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cycle_bp.route('/predict-cycle', methods=['POST'])
def predict_cycle():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        required_fields = ['lastPeriodDate', 'cycleLength', 'bleedingDays', 'age', 'weight', 'height']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Extract fields
        last_period_date_str = data['lastPeriodDate']  # Expected in YYYY-MM-DD format
        cycle_length = int(data['cycleLength'])
        bleeding_days = int(data['bleedingDays'])
        age = int(data['age'])
        weight_kg = float(data['weight'])
        height_feet = float(data['height'])

        # Validate fields
        if cycle_length < 21 or cycle_length > 35:
            return jsonify({"error": "Cycle length must be between 21 and 35 days"}), 400
        if bleeding_days < 2 or bleeding_days > 7:
            return jsonify({"error": "Bleeding days must be between 2 and 7 days"}), 400

        # Convert lastPeriodDate to DD-MM-YYYY format for predict_cycle_phases
        try:
            last_period = datetime.strptime(last_period_date_str, '%Y-%m-%d')  # Parse as YYYY-MM-DD
            last_period_date_formatted = last_period.strftime('%d-%m-%Y')  # Convert to DD-MM-YYYY
        except ValueError as e:
            return jsonify({"error": f"Invalid lastPeriodDate format: {str(e)}"}), 400

        # Predict cycle phases using the model
        cycle_phases = predict_cycle_phases(
            last_period_date_str=last_period_date_formatted,
            cycle_length=cycle_length,
            bleeding_days=bleeding_days,
            age=age,
            weight_kg=weight_kg,
            height_feet=height_feet
        )

        # Clean the phases to ensure no NaN values
        cleaned_cycle_phases = clean_json_data(cycle_phases)

        # Return the array directly to match userData.ts expectation
        return jsonify(cleaned_cycle_phases), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cycle_bp.route('/recalibrate-cycle', methods=['POST'])
def recalibrate_cycle():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        required_fields = ['user_id']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        user_id = data['user_id']

        # Fetch user data from Supabase
        user_response = requests.post(
            f"{current_app.config['SUPABASE_URL']}/rest/v1/rpc/get_user_data",
            headers=current_app.SUPABASE_HEADERS,
            json={"p_user_id": user_id}
        )
        if user_response.status_code != 200:
            logger.error(f"Supabase error response: {user_response.text}, Status Code: {user_response.status_code}")
            return jsonify({"error": "Failed to fetch user data from Supabase"}), 500

        user_data = user_response.json()
        if not user_data or len(user_data) == 0:
            return jsonify({"error": "User not found"}), 404

        user = user_data[0]
        last_period_date = user.get('last_period_date')
        cycle_length = user.get('cycle_length')
        bleeding_days = user.get('bleeding_days')

        if not last_period_date or not cycle_length or not bleeding_days:
            return jsonify({"error": "Missing required user data for cycle recalibration"}), 400

        # Fetch average sleep hours for the past 5 days
        today = datetime.today().strftime('%Y-%m-%d')
        five_days_ago = (datetime.today() - timedelta(days=5)).strftime('%Y-%m-%d')
        sleep_response = requests.post(
            f"{current_app.config['SUPABASE_URL']}/rest/v1/rpc/get_avg_sleep",
            headers=current_app.SUPABASE_HEADERS,
            json={
                "p_user_id": user_id,
                "p_start_date": five_days_ago,
                "p_end_date": today
            }
        )
        if sleep_response.status_code != 200:
            logger.error(f"Supabase sleep error response: {sleep_response.text}, Status Code: {sleep_response.status_code}")
            return jsonify({"error": "Failed to fetch sleep data from Supabase"}), 500

        sleep_data = sleep_response.json()
        avg_sleep_hours = sleep_data[0]['avg_sleep_hours'] if sleep_data and sleep_data[0]['avg_sleep_hours'] is not None else 0.0

        # Fetch average water intake for the past 5 days
        water_response = requests.post(
            f"{current_app.config['SUPABASE_URL']}/rest/v1/rpc/get_avg_water_intake",
            headers=current_app.SUPABASE_HEADERS,
            json={
                "p_user_id": user_id,
                "p_start_date": five_days_ago,
                "p_end_date": today
            }
        )
        if water_response.status_code != 200:
            logger.error(f"Supabase water intake error response: {water_response.text}, Status Code: {water_response.status_code}")
            return jsonify({"error": "Failed to fetch water intake data from Supabase"}), 500

        water_data = water_response.json()
        avg_water_liters = water_data[0]['avg_water_liters'] if water_data and water_data[0]['avg_water_liters'] is not None else 0.0

        # Convert last_period_date to the required format (DD-MM-YYYY)
        last_period_date = datetime.strptime(last_period_date, '%Y-%m-%d').strftime('%d-%m-%Y')

        # Call the recalibration model
        recalibrated_phases = predict_recalibrated_future_phase(
            last_period_date_str=last_period_date,
            cycle_length=cycle_length,
            bleeding_days=bleeding_days,
            avg_sleep_hours=avg_sleep_hours,
            avg_water_liters=avg_water_liters
        )

        # Clean the phases to ensure no NaN values
        cleaned_phases = clean_json_data(recalibrated_phases)

        return jsonify({
            "recalibrated_phases": cleaned_phases
        }), 200

    except Exception as e:
        logger.error(f"Error in recalibrate_cycle: {str(e)}")
        return jsonify({"error": str(e)}), 500

@cycle_bp.route('/update-cycle-and-plans', methods=['POST'])
def update_cycle_and_plans():
    try:
        data = request.get_json()
        if not data:
            logger.error("DEBUG: No input data provided for /update-cycle-and-plans")
            return jsonify({"error": "No input data provided"}), 400

        logger.info(f"DEBUG: Received payload for /update-cycle-and-plans: {data}")

        # Required fields
        required_fields = ['user_id', 'weight', 'activity_level', 'challenge_days', 'remaining_days', 'start_date', 'last_period_date', 'cycle_phases', 'age', 'goal', 'preferred_rest_days', 'height']
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.error(f"DEBUG: Missing or null required field: {field}")
                return jsonify({"error": f"Missing or null required field: {field}"}), 400

        # Type conversions and validation
        try:
            user_id = int(data['user_id'])
            weight = float(data['weight'])
            activity_level = int(data['activity_level'])
            challenge_days = int(data['challenge_days'])
            remaining_days = int(data['remaining_days'])
            age = int(data['age'])
            height = float(data['height'])
            cycle_length = int(data['cycle_length']) if data.get('cycle_length') else None
            bleeding_days = int(data['bleeding_days']) if data.get('bleeding_days') else None
        except (ValueError, TypeError) as e:
            logger.error(f"DEBUG: Type conversion error: {str(e)}")
            return jsonify({"error": f"Invalid numeric value: {str(e)}"}), 400

        start_date_str = data['start_date']
        last_period_date_str = data['last_period_date']
        cycle_phases = data['cycle_phases']
        goal = data['goal']
        preferred_rest_days = data['preferred_rest_days']

        # Validate goal
        if goal in GOAL_MAPPING:
            goal = GOAL_MAPPING[goal]
            logger.info(f"DEBUG: Normalized goal from {data['goal']} to {goal} for update-cycle-and-plans")
        elif goal not in ["weight_loss", "gain_weight", "build_muscle", "stay_fit"]:
            logger.error(f"DEBUG: Invalid goal received: {goal}")
            return jsonify({"error": f"Invalid goal: {goal}. Must be one of {list(GOAL_MAPPING.keys())} or {['weight_loss', 'gain_weight', 'build_muscle', 'stay_fit']}"}), 400

        # Validate dates
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            last_period_date = datetime.strptime(last_period_date_str, '%Y-%m-%d').date()
            start_date_internal = start_date.strftime('%d-%m-%Y')  # For generate_workout_plan
            last_period_date_internal = last_period_date.strftime('%d-%m-%Y') if last_period_date else None
        except ValueError as e:
            logger.error(f"DEBUG: Invalid date format: {str(e)}")
            return jsonify({"error": f"Invalid date format: {str(e)}"}), 400

        # Validate cycleLength and bleedingDays (only if provided)
        if cycle_length is not None and (cycle_length < 21 or cycle_length > 35):
            logger.error(f"DEBUG: Invalid cycle_length: {cycle_length}. Must be between 21 and 35")
            return jsonify({"error": "Cycle length must be between 21 and 35 days"}), 400
        if bleeding_days is not None and (bleeding_days < 2 or bleeding_days > 7):
            logger.error(f"DEBUG: Invalid bleeding_days: {bleeding_days}. Must be between 2 and 7")
            return jsonify({"error": "Bleeding days must be between 2 and 7 days"}), 400

        # Handle menopausal users
        if 'diseases' in data and 'Menopause' in data['diseases']:
            cycle_length = None
            bleeding_days = None
            cycle_phases = []
            last_period_date_internal = None
            logger.info("DEBUG: Menopause detected, setting cycle fields to None")

        # Prepare data dictionary for generate_workout_plan
        plan_data = {
            'userId': user_id,
            'age': age,
            'activityLevel': activity_level,
            'goal': goal,
            'weight': weight,
            'challengeDays': remaining_days,  # Use remaining_days for plan duration
            'preferredRestDay': preferred_rest_days,
            'height': height,
            'cyclePhases': cycle_phases,
            'areasOfFocus': data.get('areasOfFocus', ['Full Body']),
            'diseases': data.get('diseases', []),
            'preferredIntensity': data.get('preferredIntensity'),
            'lastPeriodDate': last_period_date_internal,
            'cycleLength': cycle_length,
            'bleedingDays': bleeding_days,
            'planStartDate': start_date_internal
        }
        logger.info(f"DEBUG: Plan data prepared for workout and meal plan generation: {plan_data}")

        # Generate workout and meal plans
        workout_plan, intensity = generate_workout_plan(plan_data, cycle_phases)
        if not workout_plan:
            logger.error(f"DEBUG: Workout plan generation failed for goal: {goal}")
            return jsonify({"error": f"Failed to generate workout plan for goal: {goal}"}), 400

        meal_plan = generate_meal_plan((workout_plan, intensity), plan_data, cycle_phases)
        if not meal_plan:
            logger.error(f"DEBUG: Meal plan generation failed for goal: {goal}")
            return jsonify({"error": f"Failed to generate meal plan for goal: {goal}"}), 400

        logger.info(f"DEBUG: Generated workout_plan length: {len(workout_plan)}, meal_plan length: {len(meal_plan)}")

        # Call Supabase function
        try:
            response = current_app.supabase.rpc('update_cycle_and_plans', {
                'p_user_id': user_id,
                'p_weight': weight,
                'p_activity_level': activity_level,
                'p_challenge_days': challenge_days,
                'p_remaining_days': remaining_days,
                'p_workout_plan': workout_plan,
                'p_meal_plan': meal_plan,
                'p_start_date': start_date.strftime('%Y-%m-%d'),
                'p_last_period_date': last_period_date.strftime('%Y-%m-%d') if last_period_date else None,
                'p_cycle_length': cycle_length,
                'p_bleeding_days': bleeding_days,
                'p_cycle_phases': cycle_phases
            }).execute()

            if response.data:
                logger.debug(f"DEBUG: Successfully updated cycle and plans for user_id: {user_id}")
                cleaned_workout_plan = clean_json_data(workout_plan)
                cleaned_meal_plan = clean_json_data(meal_plan)
                return jsonify({
                    "message": "Cycle and plans updated successfully",
                    "workout_plan": cleaned_workout_plan,
                    "meal_plan": cleaned_meal_plan,
                    "intensity": intensity,
                    "cyclePhases": cycle_phases
                }), 200
            else:
                logger.error(f"DEBUG: Failed to update cycle and plans for user_id: {user_id}")
                return jsonify({"error": "Failed to update cycle and plans"}), 500

        except Exception as e:
            logger.error(f"DEBUG: RPC update_cycle_and_plans failed: {str(e)}")
            return jsonify({"error": f"Failed to update cycle and plans: {str(e)}"}), 500

    except Exception as e:
        logger.error(f"DEBUG: Error in update_cycle_and_plans: {str(e)}")
        return jsonify({"error": str(e)}), 500