from datetime import datetime, timedelta
import pandas as pd
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def predict_recalibrated_future_phase(last_period_date_str: str, cycle_length: int, bleeding_days: int, avg_sleep_hours: float, avg_water_liters: float) -> list:
    """
    Recalculates the remaining cycle days from today onwards, based on sleep and hydration.
    Args:
        last_period_date_str: Last period date in 'DD-MM-YYYY' format
        cycle_length: Length of the menstrual cycle in days
        bleeding_days: Number of bleeding days
        avg_sleep_hours: Average sleep hours over the past 5 days
        avg_water_liters: Average water intake in liters over the past 5 days
    Returns: List of dictionaries with updated cycle phases for the remaining days
    """
    last_period = datetime.strptime(last_period_date_str, "%d-%m-%Y")
    today = datetime.today()
    current_day_index = (today - last_period).days

    # Handle case where cycle has ended
    if current_day_index >= cycle_length:
        logger.debug("Cycle has ended. Awaiting new period log.")
        return []

    base_ovulation_day = last_period + timedelta(days=cycle_length - 14)

    # Apply adjustments based on user trends
    ovulation_shift = 0
    if avg_sleep_hours < 5.5:
        ovulation_shift += 1  # Delay likely
        logger.debug("Ovulation delayed by 1 day due to low sleep hours")
    if avg_water_liters < 1.5:
        ovulation_shift += 1  # Delay likely
        logger.debug("Ovulation delayed by 1 day due to low water intake")

    adjusted_ovulation_day = base_ovulation_day + timedelta(days=ovulation_shift)
    logger.debug(f"Adjusted ovulation day: {adjusted_ovulation_day.strftime('%Y-%m-%d')}")

    # Predict future phases only
    phases = []
    for day in range(current_day_index, cycle_length):
        current_date = last_period + timedelta(days=day)

        if day < bleeding_days:
            phase = "Menstruation"
        elif day < (adjusted_ovulation_day - last_period).days - 2:
            phase = "Follicular"
        elif (adjusted_ovulation_day - last_period).days - 2 <= day <= (adjusted_ovulation_day - last_period).days + 2:
            phase = "Ovulation"
        elif day == (adjusted_ovulation_day - last_period).days:
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