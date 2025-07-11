from flask import Blueprint, request, jsonify
from app.models.workout_plan import generate_workout_plan
from app.models.meal_plan import generate_meal_plan
import numpy as np
import requests
import logging
import pytz
from datetime import datetime, timedelta
from supabase import create_client, Client

supabase: Client = create_client("https://oqrdyazxwbpmemnablfk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcmR5YXp4d2JwbWVtbmFibGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNjkyNTcsImV4cCI6MjA0OTk0NTI1N30.nXtUdxnIqQXUhY-W06h5TO2B6CXi0sBsD6Rj_f9ojnQ")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

workout_bp = Blueprint('workout', __name__)

# Add this mapping near the GOAL_MAPPING
DISEASE_MAPPING = {
    "Diabetes Type 2": "Diabetes",
    "Menopause": "Menopause",
    "Hypertension": "Hypertension",
}

# Reverse mapping for storing in database
REVERSE_DISEASE_MAPPING = {v: k for k, v in DISEASE_MAPPING.items()}

def normalize_diseases(diseases):
    """Convert frontend/database disease names to model-friendly names"""
    if not diseases:
        return []
    return [DISEASE_MAPPING.get(disease, disease) for disease in diseases]

def denormalize_diseases(diseases):
    """Convert model-friendly names back to original disease names for storage"""
    if not diseases:
        return []
    return [REVERSE_DISEASE_MAPPING.get(disease, disease) for disease in diseases]

GOAL_MAPPING = {
    "Lose weight": "weight_loss",
    "Gain weight": "gain_weight",
    "Muscle build": "build_muscle",
    "Stay fit": "stay_fit"
}

def clean_json_data(data):
    if isinstance(data, dict):
        return {k: clean_json_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_json_data(item) for item in data]
    elif isinstance(data, float) and np.isnan(data):
        return None
    return data

@workout_bp.route('/generate-plan', methods=['POST'])
def generate_plan():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        logger.info(f"DEBUG: Received payload for /generate-plan: {data}")

        # Type conversions and validation
        try:
            data['age'] = int(data['age'])
            data['weight'] = float(data['weight'])
            data['height'] = float(data['height'])
            data['activityLevel'] = int(data['activityLevel'])
            data['challengeDays'] = int(data['challengeDays'])
            if 'cycleLength' in data and data['cycleLength'] is not None:
                data['cycleLength'] = int(data['cycleLength'])
            if 'bleedingDays' in data and data['bleedingDays'] is not None:
                data['bleedingDays'] = int(data['bleedingDays'])
        except (ValueError, TypeError) as e:
            logger.error(f"DEBUG: Type conversion error: {str(e)}")
            return jsonify({"error": f"Invalid numeric value: {str(e)}"}), 400

        # Required fields
        required_fields = ['age', 'activityLevel', 'goal', 'weight', 'challengeDays', 'preferredRestDay', 'height']
        for field in required_fields:
            if field not in data or data[field] is None:
                return jsonify({"error": f"Missing or null required field: {field}"}), 400
            
        if 'diseases' in data and data['diseases'] is not None:
            data['diseases'] = normalize_diseases(data['diseases'])

        # Validate goal
        goal = data['goal']
        if goal in GOAL_MAPPING:
            data['goal'] = GOAL_MAPPING[goal]
            logger.info(f"DEBUG: Normalized goal from {goal} to {data['goal']} for generate-plan")
        elif goal not in ["weight_loss", "gain_weight", "build_muscle", "stay_fit"]:
            logger.error(f"DEBUG: Invalid goal received: {goal}")
            return jsonify({"error": f"Invalid goal: {goal}. Must be one of {list(GOAL_MAPPING.keys())} or {['weight_loss', 'gain_weight', 'build_muscle', 'stay_fit']}"}), 400

        # Validate areasOfFocus
        valid_focus_areas = ['Arms', 'Full Body', 'Hips', 'Legs', 'Stomach']
        areas_of_focus = data.get('areasOfFocus', 'Full Body')

        if isinstance(areas_of_focus, str):
            focus_list = [f.strip() for f in areas_of_focus.split(',') if f.strip()]
            if not focus_list:
                focus_list = ['Full Body']
            for focus in focus_list:
                if focus not in valid_focus_areas:
                    logger.error(f"DEBUG: Invalid focus area: {focus} not in {valid_focus_areas}")
                    return jsonify({"error": f"Invalid focus area: {focus}. Must be one of {valid_focus_areas} or a comma-separated combination"}), 400
            if 'Full Body' in focus_list:
                focus_list = ['Full Body']
            data['areasOfFocus'] = focus_list
        elif isinstance(areas_of_focus, list):
            focus_list = []
            for focus in areas_of_focus:
                if isinstance(focus, str):
                    focus = focus.strip()
                    if focus in valid_focus_areas:
                        focus_list.append(focus)
            if not focus_list:
                focus_list = ['Full Body']
            if 'Full Body' in focus_list:
                focus_list = ['Full Body']
            data['areasOfFocus'] = focus_list
        else:
            data['areasOfFocus'] = ['Full Body']

        # Validate preferredIntensity (optional)
        if 'preferredIntensity' in data and data['preferredIntensity'] is not None:
            valid_intensities = ['low', 'moderate', 'high']
            if data['preferredIntensity'].lower() not in valid_intensities:
                logger.error(f"DEBUG: Invalid preferredIntensity: {data['preferredIntensity']}")
                return jsonify({"error": f"Invalid preferredIntensity: {data['preferredIntensity']}. Must be one of {valid_intensities}"}), 400
            data['preferredIntensity'] = data['preferredIntensity'].lower()
        else:
            data['preferredIntensity'] = None

        # Validate and format date fields
        for date_field in ['planStartDate', 'lastPeriodDate']:
            if date_field in data and data[date_field] is not None:
                try:
                    parsed_date = datetime.strptime(data[date_field], '%Y-%m-%d')
                    data[date_field] = parsed_date.strftime('%d-%m-%Y')
                except ValueError:
                    logger.error(f"DEBUG: Invalid {date_field} format: {data[date_field]}. Expected YYYY-MM-DD")
                    return jsonify({"error": f"Invalid {date_field} format: {data[date_field]}. Expected YYYY-MM-DD"}), 400

        # Validate cycleLength and bleedingDays (only if provided)
        if 'cycleLength' in data and data['cycleLength'] is not None and (data['cycleLength'] < 21 or data['cycleLength'] > 35):
            logger.error(f"DEBUG: Invalid cycleLength: {data['cycleLength']}. Must be between 21 and 35")
            return jsonify({"error": "Cycle length must be between 21 and 35 days"}), 400
        if 'bleedingDays' in data and data['bleedingDays'] is not None and (data['bleedingDays'] < 2 or data['bleedingDays'] > 7):
            logger.error(f"DEBUG: Invalid bleedingDays: {data['bleedingDays']}. Must be between 2 and 7")
            return jsonify({"error": "Bleeding days must be between 2 and 7 days"}), 400

        # Handle menopausal users: ensure cycle fields are None if not provided
        if 'lastPeriodDate' not in data or data['lastPeriodDate'] is None:
            data['lastPeriodDate'] = None
            data['cycleLength'] = None
            data['bleedingDays'] = None
            data['cyclePhases'] = []

        # Log additional fields
        logger.info(f"DEBUG: Additional fields - preferredIntensity: {data.get('preferredIntensity')}, "
                   f"planStartDate: {data.get('planStartDate')}, lastPeriodDate: {data.get('lastPeriodDate')}, "
                   f"cycleLength: {data.get('cycleLength')}, bleedingDays: {data.get('bleedingDays')}")

        cycle_phases = data.get('cyclePhases', [])

        workout_plan, intensity = generate_workout_plan(data, cycle_phases)
        meal_plan = generate_meal_plan((workout_plan, intensity), data, cycle_phases)

        logger.info(f"DEBUG: Generated workout_plan length: {len(workout_plan)}, meal_plan length: {len(meal_plan)}")

        cleaned_workout_plan = clean_json_data(workout_plan)
        cleaned_meal_plan = clean_json_data(meal_plan)

        return jsonify({
            "workout_plan": cleaned_workout_plan,
            "meal_plan": cleaned_meal_plan,
            "intensity": intensity
        }), 200

    except Exception as e:
        logger.error(f"DEBUG: Error in generate-plan: {str(e)}")
        return jsonify({"error": str(e)}), 500

@workout_bp.route('/update-plan', methods=['POST'])
def update_plan():
    try:
        data = request.get_json()
        if not data:
            logger.error("DEBUG: No input data provided for /update-plan")
            return jsonify({"error": "No input data provided"}), 400

        logger.info(f"DEBUG: Received payload for /update-plan: {data}")

        # Required fields
        required_fields = ['age', 'activityLevel', 'goal', 'weight', 'challengeDays', 'remainingDays', 'preferredRestDay', 'height', 'currentDay', 'userId', 'workoutPlanId', 'startDate']
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.error(f"DEBUG: Missing or null required field: {field}")
                return jsonify({"error": f"Missing or null required field: {field}"}), 400

        # Type conversions and validation
        try:
            data['currentDay'] = int(data['currentDay'])
            data['challengeDays'] = int(data['challengeDays'])
            data['remainingDays'] = int(data['remainingDays'])
            data['age'] = int(data['age'])
            data['weight'] = float(data['weight'])
            data['height'] = float(data['height'])
            data['activityLevel'] = int(data['activityLevel'])
            if 'cycleLength' in data and data['cycleLength'] is not None:
                data['cycleLength'] = int(data['cycleLength'])
            if 'bleedingDays' in data and data['bleedingDays'] is not None:
                data['bleedingDays'] = int(data['bleedingDays'])
        except (ValueError, TypeError) as e:
            logger.error(f"DEBUG: Type conversion error: {str(e)}")
            return jsonify({"error": f"Invalid numeric value: {str(e)}"}), 400

        # Validate areasOfFocus
        valid_focus_areas = ['Arms', 'Full Body', 'Hips', 'Legs', 'Stomach']
        areas_of_focus = data.get('areasOfFocus', 'Full Body')

        if isinstance(areas_of_focus, str):
            focus_list = [f.strip() for f in areas_of_focus.split(',') if f.strip()]
            if not focus_list:
                focus_list = ['Full Body']
            for focus in focus_list:
                if focus not in valid_focus_areas:
                    logger.error(f"DEBUG: Invalid focus area: {focus} not in {valid_focus_areas}")
                    return jsonify({"error": f"Invalid focus area: {focus}. Must be one of {valid_focus_areas} or a comma-separated combination"}), 400
            if 'Full Body' in focus_list:
                focus_list = ['Full Body']
            data['areasOfFocus'] = focus_list
        elif isinstance(areas_of_focus, list):
            focus_list = []
            for focus in areas_of_focus:
                if isinstance(focus, str):
                    focus = focus.strip()
                    if focus in valid_focus_areas:
                        focus_list.append(focus)
            if not focus_list:
                focus_list = ['Full Body']
            if 'Full Body' in focus_list:
                focus_list = ['Full Body']
            data['areasOfFocus'] = focus_list
        else:
            data['areasOfFocus'] = ['Full Body']
            
        # Validate currentDay
        if data['currentDay'] <= 0:
            logger.error(f"DEBUG: Invalid currentDay: {data['currentDay']}. Must be positive")
            return jsonify({"error": f"Invalid current day: {data['currentDay']}. Must be positive"}), 400

        # Validate remainingDays
        if data['remainingDays'] <= 0:
            logger.error(f"DEBUG: Invalid remainingDays: {data['remainingDays']}. Must be positive")
            return jsonify({"error": f"Invalid remaining days: {data['remainingDays']}. Must be positive"}), 400
        if data['remainingDays'] > data['challengeDays']:
            logger.error(f"DEBUG: Invalid remainingDays: {data['remainingDays']} exceeds challengeDays: {data['challengeDays']}")
            return jsonify({"error": f"Remaining days ({data['remainingDays']}) cannot exceed challenge days ({data['challengeDays']})"}), 400

        # Add this after validating other fields
        if 'diseases' in data and data['diseases'] is not None:
            data['diseases'] = normalize_diseases(data['diseases'])

        # Validate goal
        goal = data['goal']
        if goal in GOAL_MAPPING:
            data['goal'] = GOAL_MAPPING[goal]
            logger.info(f"DEBUG: Normalized goal from {goal} to {data['goal']} for update-plan")
        elif goal not in ["weight_loss", "gain_weight", "build_muscle", "stay_fit"]:
            logger.error(f"DEBUG: Invalid goal received: {goal}")
            return jsonify({"error": f"Invalid goal: {goal}. Must be one of {list(GOAL_MAPPING.keys())} or {['weight_loss', 'gain_weight', 'build_muscle', 'stay_fit']}"}), 400

        # Validate intensity (optional)
        if 'intensity' in data and data['intensity'] is not None:
            valid_intensities = ['low', 'moderate', 'high']
            if data['intensity'].lower() not in valid_intensities:
                logger.error(f"DEBUG: Invalid intensity: {data['intensity']}")
                return jsonify({"error": f"Invalid intensity: {data['intensity']}. Must be one of {valid_intensities}"}), 400
            data['preferredIntensity'] = data['intensity'].lower()
        else:
            data['preferredIntensity'] = None

        # Validate and format lastPeriodDate for internal use (DD-MM-YYYY)
        if 'lastPeriodDate' in data and data['lastPeriodDate'] is not None:
            try:
                parsed_date = datetime.strptime(data['lastPeriodDate'], '%Y-%m-%d')
                data['lastPeriodDate'] = parsed_date.strftime('%d-%m-%Y')
                last_period_date_db = parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                logger.error(f"DEBUG: Invalid lastPeriodDate format: {data['lastPeriodDate']}. Expected YYYY-MM-DD")
                return jsonify({"error": f"Invalid lastPeriodDate format: {data['lastPeriodDate']}. Expected YYYY-MM-DD"}), 400
        else:
            last_period_date_db = None

        # Validate startDate and keep in YYYY-MM-DD for Supabase
        try:
            start_date_db = datetime.strptime(data['startDate'], '%Y-%m-%d').strftime('%Y-%m-%d')
        except ValueError:
            logger.error(f"DEBUG: Invalid startDate format: {data['startDate']}. Expected YYYY-MM-DD")
            return jsonify({"error": f"Invalid startDate format: {data['startDate']}. Expected YYYY-MM-DD"}), 400

        # Validate cycleLength and bleedingDays (only if provided)
        if 'cycleLength' in data and data['cycleLength'] is not None and (data['cycleLength'] < 21 or data['cycleLength'] > 35):
            logger.error(f"DEBUG: Invalid cycleLength: {data['cycleLength']}. Must be between 21 and 35")
            return jsonify({"error": "Cycle length must be between 21 and 35 days"}), 400
        if 'bleedingDays' in data and data['bleedingDays'] is not None and (data['bleedingDays'] < 2 or data['bleedingDays'] > 7):
            logger.error(f"DEBUG: Invalid bleedingDays: {data['bleedingDays']}. Must be between 2 and 7")
            return jsonify({"error": "Bleeding days must be between 2 and 7 days"}), 400

        # Handle menopausal users: ensure cycle fields are None if not provided
        if 'lastPeriodDate' not in data or data['lastPeriodDate'] is None:
            data['lastPeriodDate'] = None
            data['cycleLength'] = None
            data['bleedingDays'] = None
            data['cyclePhases'] = []

        # Log additional fields
        logger.info(f"DEBUG: Additional fields - preferredIntensity: {data.get('preferredIntensity')}, "
                   f"startDate: {start_date_db}, "
                   f"lastPeriodDate: {data.get('lastPeriodDate')}, cycleLength: {data.get('cycleLength')}, "
                   f"bleedingDays: {data.get('bleedingDays')}, currentDay: {data.get('currentDay')}, "
                   f"challengeDays: {data['challengeDays']}, remainingDays: {data['remainingDays']}")

        cycle_phases = data.get('cyclePhases', [])

        # Adjust cycle phases for remaining days
        start_date = datetime.strptime(start_date_db, '%Y-%m-%d')
        adjusted_cycle_phases = []
        for i in range(data['remainingDays']):
            cycle_day = data['currentDay'] + i
            phase_data = next((p for p in cycle_phases if int(p.get('cycle_day', 0)) == cycle_day), None)
            if phase_data:
                adjusted_phase = dict(phase_data)
                adjusted_phase['cycle_day'] = cycle_day
                adjusted_phase['date'] = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
                adjusted_cycle_phases.append(adjusted_phase)
            else:
                adjusted_cycle_phases.append({
                    'cycle_day': cycle_day,
                    'date': (start_date + timedelta(days=i)).strftime('%Y-%m-%d'),
                    'phase': 'follicular' if last_period_date_db else None
                })
        logger.info(f"DEBUG: Adjusted cycle phases length: {len(adjusted_cycle_phases)}, cycle_phases: {adjusted_cycle_phases}")

        # Prepare plan data
        plan_data = {
            'age': data['age'],
            'activityLevel': data['activityLevel'],
            'goal': data['goal'],
            'weight': data['weight'],
            'challengeDays': data['remainingDays'],
            'preferredRestDay': data['preferredRestDay'],
            'height': data['height'],
            'userId': data['userId'],
            'cyclePhases': adjusted_cycle_phases,
            'areasOfFocus': data.get('areasOfFocus', 'Full Body'),
            'diseases': data.get('diseases', []),
            'preferredIntensity': data['preferredIntensity'],
            'lastPeriodDate': data.get('lastPeriodDate'),
            'cycleLength': data['cycleLength'],
            'bleedingDays': data['bleedingDays']
        }
        logger.info(f"DEBUG: Plan data prepared for workout and meal plan generation: {plan_data}")

        workout_plan, intensity = generate_workout_plan(plan_data, adjusted_cycle_phases)
        if not workout_plan:
            logger.error(f"DEBUG: Workout plan generation failed for goal: {data['goal']}")
            return jsonify({"error": f"Failed to generate workout plan for goal: {data['goal']}"}), 400

        meal_plan = generate_meal_plan((workout_plan, intensity), plan_data, adjusted_cycle_phases)
        if not meal_plan:
            logger.error(f"DEBUG: Meal plan generation failed for goal: {data['goal']}")
            return jsonify({"error": f"Failed to generate meal plan for goal: {data['goal']}"}), 400

        logger.info(f"DEBUG: Generated workout_plan length: {len(workout_plan)}, meal_plan length: {len(meal_plan)}")

         # Then before calling supabase.rpc, denormalize the diseases
        supabase_diseases = denormalize_diseases(data['diseases']) if 'diseases' in data else []

        # Call the SQL function with remainingDays
        logger.info(f"DEBUG: Calling update_user_and_workout_plan with challengeDays: {data['challengeDays']}, remainingDays: {data['remainingDays']}, startDate: {start_date_db}")
        try:
            response = supabase.rpc('update_user_and_workout_plan', {
                'p_user_id': data['userId'],
                'p_weight': data['weight'],
                'p_activity_level': data['activityLevel'],
                'p_challenge_days': data['challengeDays'],
                'p_remaining_days': data['remainingDays'],
                'p_workout_plan': workout_plan,
                'p_meal_plan': meal_plan,
                'p_start_date': start_date_db,
                'p_intensity': data['preferredIntensity'],
                'p_last_period_date': last_period_date_db,
                'p_cycle_length': data['cycleLength'],
                'p_bleeding_days': data['bleedingDays'],
                'p_cycle_phases': adjusted_cycle_phases
            }).execute()

            # Access the response data
            response_data = response.data
            logger.info(f"DEBUG: RPC update_user_and_workout_plan succeeded: {response_data}")

            cleaned_workout_plan = clean_json_data(workout_plan)
            cleaned_meal_plan = clean_json_data(meal_plan)

            return jsonify({
                "workout_plan": cleaned_workout_plan,
                "meal_plan": cleaned_meal_plan,
                "intensity": intensity,
                "cyclePhases": adjusted_cycle_phases
            }), 200

        except Exception as e:
            logger.error(f"DEBUG: RPC update_user_and_workout_plan failed: {str(e)}")
            return jsonify({"error": f"Failed to update user and workout plan: {str(e)}"}), 500

    except ValueError as ve:
        logger.error(f"DEBUG: ValueError in update-plan: {str(ve)}")
        return jsonify({"error": f"Invalid data format: {str(ve)}"}), 400
    except Exception as e:
        logger.error(f"DEBUG: Unexpected error in update-plan: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500
    
@workout_bp.route('/update-plans-for-diseases', methods=['POST'])
def update_plans_for_diseases():
    try:
        data = request.get_json()
        if not data:
            logger.error("DEBUG: No input data provided for /update-plans-for-diseases")
            return jsonify({"error": "No input data provided"}), 400

        # Normalize diseases first
        if 'diseases' in data and data['diseases'] is not None:
            normalized_diseases = normalize_diseases(data['diseases'])
            is_menopausal = 'Menopause' in normalized_diseases  # Check normalized name
        else:
            normalized_diseases = []
            is_menopausal = False

        # Required fields
        required_fields = ['userId', 'diseases']
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.error(f"DEBUG: Missing or null required field: {field}")
                return jsonify({"error": f"Missing or null required field: {field}"}), 400

        user_id = data['userId']

        # Fetch user data
        logger.info(f"DEBUG: Fetching user data for user_id: {user_id}")
        try:
            user_response = supabase.from_('User').select('*').eq('id', user_id).single().execute()
            user = user_response.data
            logger.info(f"DEBUG: Fetched user data: {user}")
        except Exception as e:
            logger.error(f"DEBUG: Failed to fetch user data: {str(e)}")
            return jsonify({"error": f"Failed to fetch user data: {str(e)}"}), 500
        
        # Process areas_of_focus from database
        valid_focus_areas = ['Arms', 'Full Body', 'Hips', 'Legs', 'Stomach']
        areas_of_focus = user.get('areas_of_focus', 'Full Body')
        
        # Handle both string (comma-separated) and array formats from database
        if isinstance(areas_of_focus, str):
            focus_list = [f.strip() for f in areas_of_focus.split(',') if f.strip()]
            if not focus_list:
                focus_list = ['Full Body']
            # Validate each focus area
            for focus in focus_list:
                if focus not in valid_focus_areas:
                    logger.warning(f"DEBUG: Invalid focus area in database: {focus}, defaulting to Full Body")
                    focus_list = ['Full Body']
                    break
            # Special case: if Full Body is included with others, just use Full Body
            if 'Full Body' in focus_list:
                focus_list = ['Full Body']
        elif isinstance(areas_of_focus, list):
            focus_list = []
            for focus in areas_of_focus:
                if isinstance(focus, str):
                    focus = focus.strip()
                    if focus in valid_focus_areas:
                        focus_list.append(focus)
            if not focus_list:
                focus_list = ['Full Body']
            if 'Full Body' in focus_list:
                focus_list = ['Full Body']
        else:
            focus_list = ['Full Body']

        # Check if we need to generate cycle phases
        cycle_phases = []
        if not is_menopausal and user.get('last_period_date'):
            logger.info("DEBUG: Generating cycle phases for non-menopausal user")
            cycle_data = {
                'lastPeriodDate': user['last_period_date'],
                'cycleLength': user['cycle_length'],
                'bleedingDays': user['bleeding_days'],
                'challengeDays': user['challenge_days'],
                'age': user['age'],
                'weight': user['weight'],
                'height': user['height']
            }
            try:
                cycle_response = requests.post(
                    'http://localhost:5000/api/generate-cycle-phases',
                    json=cycle_data
                )
                cycle_response.raise_for_status()
                cycle_phases = cycle_response.json()
            except requests.exceptions.RequestException as e:
                logger.error(f"DEBUG: Failed to generate cycle phases: {str(e)}")
                return jsonify({"error": "Failed to generate cycle phases"}), 500

        # Normalize goal using GOAL_MAPPING
        goal = user['goal']
        if goal in GOAL_MAPPING:
            normalized_goal = GOAL_MAPPING[goal]
            logger.info(f"DEBUG: Normalized goal from {goal} to {normalized_goal} for update-plans-for-diseases")
        elif goal in ["weight_loss", "gain_weight", "build_muscle", "stay_fit"]:
            normalized_goal = goal
            logger.info(f"DEBUG: Goal {goal} already in normalized format for update-plans-for-diseases")
        else:
            logger.error(f"DEBUG: Invalid goal received: {goal}")
            return jsonify({"error": f"Invalid goal: {goal}. Must be one of {list(GOAL_MAPPING.keys())} or {['weight_loss', 'gain_weight', 'build_muscle', 'stay_fit']}"}), 400

        # Prepare payload for plan update
        payload = {
            'userId': user_id,
            'age': user['age'],
            'activityLevel': user['activity_level'],
            'goal': normalized_goal,  # Use normalized goal
            'weight': user['weight'],
            'challengeDays': user['challenge_days'],
            'remainingDays': user['challenge_days'],
            'preferredRestDay': user['preferred_rest_days'],
            'height': user['height'],
            'diseases': normalized_diseases,
            'cyclePhases': cycle_phases,
            'intensity': user['intensity'],
            'areasOfFocus': focus_list
        }

        # Add cycle-related fields only if not menopausal
        if not is_menopausal:
            payload.update({
                'lastPeriodDate': user['last_period_date'],
                'cycleLength': user['cycle_length'],
                'bleedingDays': user['bleeding_days']
            })

        logger.info(f"DEBUG: Payload for plan update: {payload}")

        # Generate workout and meal plans
        logger.info("DEBUG: Generating workout and meal plans")
        workout_plan, intensity = generate_workout_plan(payload, cycle_phases)
        if not workout_plan:
            logger.error("DEBUG: Workout plan generation failed")
            return jsonify({"error": "Failed to generate workout plan"}), 500

        meal_plan = generate_meal_plan((workout_plan, intensity), payload, cycle_phases)
        if not meal_plan:
            logger.error("DEBUG: Meal plan generation failed")
            return jsonify({"error": "Failed to generate meal plan"}), 500

        logger.info(f"DEBUG: Generated workout_plan length: {len(workout_plan)}, meal_plan length: {len(meal_plan)}")

        # Get timezone from user data or default to 'Asia/Karachi'
        timezone_str = user.get('timezone', 'Asia/Karachi')
        try:
            timezone = pytz.timezone(timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            logger.warning(f"DEBUG: Invalid timezone '{timezone_str}', defaulting to 'Asia/Karachi'")
            timezone = pytz.timezone('Asia/Karachi')

        supabase_diseases = denormalize_diseases(normalized_diseases)

        # Call the update function
        try:
            response = supabase.rpc('update_workout_and_meal_plan', {
                'p_user_id': user_id,
                'p_weight': user['weight'],
                'p_activity_level': user['activity_level'],
                'p_challenge_days': user['challenge_days'],
                'p_remaining_days': user['challenge_days'],
                'p_start_date': datetime.now(timezone).strftime('%Y-%m-%d'),
                'p_intensity': user['intensity'],
                'p_last_period_date': user['last_period_date'] if not is_menopausal else None,
                'p_cycle_length': user['cycle_length'] if not is_menopausal else None,
                'p_bleeding_days': user['bleeding_days'] if not is_menopausal else None,
                'p_diseases': supabase_diseases,
                'p_is_menopausal': is_menopausal,
                'p_workout_plan': workout_plan,
                'p_meal_plan': meal_plan
            }).execute()

            logger.info(f"DEBUG: RPC update_workout_and_meal_plan succeeded: {response.data}")
            return jsonify({
                "message": "Workout and meal plans updated successfully",
                "is_menopausal": is_menopausal
            }), 200
        except Exception as e:
            logger.error(f"DEBUG: RPC update_workout_and_meal_plan failed: {str(e)}")
            return jsonify({"error": f"Failed to update user and workout plan: {str(e)}"}), 500

    except Exception as e:
        logger.error(f"DEBUG: Error in update-plans-for-diseases: {str(e)}")
        return jsonify({"error": str(e)}), 500