from datetime import datetime, timedelta
import pandas as pd
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def calculate_bmi(height_feet: float, weight_kg: float) -> float:
    height_meters = height_feet * 0.3048
    bmi = weight_kg / (height_meters ** 2)
    return round(bmi, 2)

def predict_cycle_phases(last_period_date_str: str, cycle_length: int, bleeding_days: int, age: int, weight_kg: float, height_feet: float) -> list:
    """
    Rule-based cycle phase prediction with adjustments for age and BMI.
    Args:
        last_period_date_str: Last period date in 'DD-MM-YYYY' format
        cycle_length: Length of the menstrual cycle in days
        bleeding_days: Number of bleeding days
        age: User's age in years
        weight_kg: User's weight in kilograms
        height_feet: User's height in feet
    Returns: List of dictionaries with phase predictions for one cycle
    """
    # BMI calculation
    bmi = calculate_bmi(height_feet, weight_kg)
    logger.debug(f"BMI calculated: {bmi}")

    # Adjust ovulation timing
    ovulation_shift = 0
    if age > 40:
        ovulation_shift -= 2
    elif age > 35:
        ovulation_shift -= 1
    if bmi < 18.5:
        ovulation_shift += 2
    elif 25 <= bmi < 30:
        ovulation_shift += 1
    elif bmi >= 30:
        ovulation_shift += 2
    logger.debug(f"Ovulation shift: {ovulation_shift}")

    # Calculate key dates
    last_period = datetime.strptime(last_period_date_str, "%d-%m-%Y")
    next_period = last_period + timedelta(days=cycle_length)
    ovulation_day = next_period - timedelta(days=14 - ovulation_shift)
    logger.debug(f"Ovulation day calculated: {ovulation_day.strftime('%Y-%m-%d')}")

    phases = []

    for day in range(cycle_length):
        current_date = last_period + timedelta(days=day)
        days_from_start = (current_date - last_period).days

        if day < bleeding_days:
            phase = "Menstruation"
        elif days_from_start < (ovulation_day - last_period).days - 2:
            phase = "Follicular"
        elif (ovulation_day - last_period).days - 2 <= day <= (ovulation_day - last_period).days + 2:
            phase = "Ovulation"
        else:
            phase = "Luteal"

        phases.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "cycle_day": day + 1,
            "phase": phase
        })
        logger.debug(f"Day {day + 1}, Date: {current_date.strftime('%Y-%m-%d')}, Phase: {phase}")

    return phases