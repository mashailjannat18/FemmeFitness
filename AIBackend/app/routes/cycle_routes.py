from flask import Blueprint, request, jsonify
from app.models.menstruation_cycle import predict_cycle_phases
from app.models.ovulation_recalibration import predict_recalibrated_future_phase
import numpy as np
from datetime import datetime, timedelta
import requests
import os

cycle_bp = Blueprint('cycle', __name__)

# Supabase configuration (replace with your actual Supabase URL and API key)
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://<your-supabase-project-id>.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '<your-supabase-service-role-key>')
SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
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

# @cycle_bp.route('/generate-cycle-phases', methods=['POST'])
# def generate_cycle_phases():
#     try:
#         data = request.get_json()
#         if not data:
#             return jsonify({"error": "No input data provided"}), 400

#         required_fields = ['lastPeriodDate', 'cycleLength', 'bleedingDays', 'challengeDays']
#         for field in required_fields:
#             if field not in data:
#                 return jsonify({"error": f"Missing required field: {field}"}), 400

#         last_period_date_str = data['lastPeriodDate']  # Expected in YYYY-MM-DD format
#         cycle_length = int(data['cycleLength'])
#         bleeding_days = int(data['bleedingDays'])
#         challenge_days = int(data['challengeDays'])

#         # Optional fields for predict_cycle_phases
#         age = int(data.get('age', 30))  # Default to 30 if not provided
#         weight_kg = float(data.get('weight', 60.0))  # Default to 60 kg if not provided
#         height_feet = float(data.get('height', 5.5))  # Default to 5.5 feet if not provided

#         # Validate input
#         if cycle_length < 21 or cycle_length > 35:
#             return jsonify({"error": "Cycle length must be between 21 and 35 days"}), 400
#         if bleeding_days < 2 or bleeding_days > 7:
#             return jsonify({"error": "Bleeding days must be between 2 and 7 days"}), 400
#         if challenge_days <= 0:
#             return jsonify({"error": "Challenge days must be greater than 0"}), 400

#         try:
#             last_period = datetime.strptime(last_period_date_str, '%Y-%m-%d')  # Parse as YYYY-MM-DD
#             last_period_date_formatted = last_period.strftime('%d-%m-%Y')  # Convert to DD-MM-YYYY for predict_cycle_phases
#         except ValueError as e:
#             return jsonify({"error": f"Invalid lastPeriodDate format: {str(e)}"}), 400

#         # Use predict_cycle_phases to get phases for one cycle
#         cycle_phases = predict_cycle_phases(
#             last_period_date_str=last_period_date_formatted,
#             cycle_length=cycle_length,
#             bleeding_days=bleeding_days,
#             age=age,
#             weight_kg=weight_kg,
#             height_feet=height_feet
#         )

#         # Adjust phases for challenge_days
#         phases = []
#         start_date = datetime.now().date()
#         days_since_last_period = (start_date - last_period.date()).days
#         current_cycle_day = (days_since_last_period % cycle_length) + 1

#         for day in range(1, challenge_days + 1):
#             normalized_cycle_day = current_cycle_day if current_cycle_day <= cycle_length else current_cycle_day - cycle_length
#             actual_date = start_date + timedelta(days=day - 1)
#             date_str = actual_date.strftime('%Y-%m-%d')

#             # Find the phase for the normalized cycle day
#             phase_entry = next((p for p in cycle_phases if p['cycle_day'] == normalized_cycle_day), None)
#             phase = phase_entry['phase'].lower() if phase_entry else 'follicular'  # Ensure lowercase and default to follicular

#             phases.append({
#                 'cycle_day': day,
#                 'date': date_str,
#                 'phase': phase
#             })

#             current_cycle_day = (current_cycle_day % cycle_length) + 1

#         return jsonify(phases), 200

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

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
            f'{SUPABASE_URL}/rest/v1/rpc/get_user_data',
            headers=SUPABASE_HEADERS,
            json={"p_user_id": user_id}
        )
        if user_response.status_code != 200:
            print(f"Supabase error response: {user_response.text}, Status Code: {user_response.status_code}")
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
            f'{SUPABASE_URL}/rest/v1/rpc/get_avg_sleep',
            headers=SUPABASE_HEADERS,
            json={
                "p_user_id": user_id,
                "p_start_date": five_days_ago,
                "p_end_date": today
            }
        )
        if sleep_response.status_code != 200:
            print(f"Supabase sleep error response: {sleep_response.text}, Status Code: {sleep_response.status_code}")
            return jsonify({"error": "Failed to fetch sleep data from Supabase"}), 500

        sleep_data = sleep_response.json()
        avg_sleep_hours = sleep_data[0]['avg_sleep_hours'] if sleep_data and sleep_data[0]['avg_sleep_hours'] is not None else 0.0

        # Fetch average water intake for the past 5 days
        water_response = requests.post(
            f'{SUPABASE_URL}/rest/v1/rpc/get_avg_water_intake',
            headers=SUPABASE_HEADERS,
            json={
                "p_user_id": user_id,
                "p_start_date": five_days_ago,
                "p_end_date": today
            }
        )
        if water_response.status_code != 200:
            print(f"Supabase water intake error response: {water_response.text}, Status Code: {water_response.status_code}")
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
        print(f"Error in recalibrate_cycle: {str(e)}")
        return jsonify({"error": str(e)}), 500