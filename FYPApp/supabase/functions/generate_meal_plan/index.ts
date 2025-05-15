import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

// Define interfaces for type safety
interface Workout {
  Day: string;
  Focus: string;
  'Workout Type': string;
  'Total Calories Burned': number;
}

interface CyclePhase {
  Date: string;
  Phase: string;
}

interface Macros {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface HealthConditions {
  has_diabetes: boolean;
  has_hypertension: boolean;
  is_menopausal: boolean;
}

// Supabase Edge Function handler
export const handler = async (req: Request): Promise<Response> => {
  try {
    const { user_id, workout_csv, cycle_csv, age, bmi, activity_level, goal, weight_kg, health_conditions } = await req.json();

    if (!user_id || !workout_csv || !cycle_csv || !age || !bmi || !activity_level || !goal || !weight_kg || !health_conditions) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
      process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
    );

    // Update User table with provided data
    const { error: userError } = await supabase
      .from('User')
      .update({
        age,
        bmi,
        activity_level,
        goal,
        weight_kg,
        health_conditions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (userError) {
      return new Response(JSON.stringify({ error: 'Failed to update user data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse workout CSV
    const workoutData: Workout[] = parse(workout_csv, { columns: true, skip_empty_lines: true });
    const dailyWorkouts: { [key: string]: [string, number] } = {};
    workoutData.forEach((row: Workout) => {
      dailyWorkouts[row.Day] = [row['Workout Type'].toLowerCase(), parseFloat(String(row['Total Calories Burned']))];
    });

    // Parse cycle CSV
    const cycleData: CyclePhase[] = parse(cycle_csv, { columns: true, skip_empty_lines: true });
    const today = new Date();
    const cyclePhases = cycleData.map((row: CyclePhase) => ({
      Date: new Date(row.Date),
      Phase: row.Phase.toLowerCase(),
    }));
    const futureOrToday = cyclePhases.filter((phase: { Date: Date; Phase: string }) => phase.Date >= today);
    const startIndex = futureOrToday.length > 0 ? cyclePhases.findIndex((phase: { Date: Date; Phase: string }) => phase.Date.getTime() === futureOrToday[0].Date.getTime()) : 0;
    const programDays = Object.keys(dailyWorkouts).length;
    const shiftedCyclePhases = cyclePhases.slice(startIndex).concat(cyclePhases.slice(0, startIndex));
    const cyclePhaseMap: { [key: number]: string } = {};
    for (let day = 1; day <= programDays; day++) {
      cyclePhaseMap[day] = shiftedCyclePhases[(day - 1) % shiftedCyclePhases.length].Phase;
    }

    // Meal plan generation logic
    const mealPlan = [];

    for (const [dayStr, [workoutType, caloriesBurned]] of Object.entries(dailyWorkouts)) {
      const dayMatch = dayStr.match(/Day (\d+)/);
      if (!dayMatch) continue;
      const day = parseInt(dayMatch[1]);
      const cyclePhase = cyclePhaseMap[day] || 'follicular';

      // Adjust calories
      let baseCalories: number;
      if (age < 30) {
        baseCalories = 15.3 * bmi * 1.2 + 679;
      } else if (age < 50) {
        baseCalories = 11.6 * bmi * 1.2 + 879;
      } else {
        baseCalories = 13.5 * bmi * 1.2 + 487;
      }

      const activityMultipliers: { [key: string]: number } = { low: 1.2, moderate: 1.55, high: 1.9 };
      baseCalories *= activityMultipliers[activity_level.toLowerCase()] || 1.2;

      let dailyCalories: number;
      if (goal === 'weight_loss') {
        dailyCalories = Math.max(1200, baseCalories - 300 + caloriesBurned);
      } else if (goal === 'muscle_gain') {
        dailyCalories = baseCalories + 250 + caloriesBurned;
      } else {
        dailyCalories = baseCalories + caloriesBurned;
      }

      const cycleAdjustments: { [key: string]: number } = {
        menstrual: -0.08,
        follicular: 0.0,
        ovulation: 0.05,
        luteal: 0.1,
      };
      const adjustedCalories = Math.round(dailyCalories * (1 + (cycleAdjustments[cyclePhase] || 0)) * 10) / 10;

      // Adjust macros
      const baseMacros: { [key: string]: { carbs: number; protein: number; fat: number } } = {
        strength: { carbs: 40, protein: 40, fat: 20 },
        hiit: { carbs: 50, protein: 30, fat: 20 },
        cardio: { carbs: 55, protein: 25, fat: 20 },
        rest: { carbs: 45, protein: 30, fat: 25 },
      };
      let macros = { ...baseMacros[workoutType] || baseMacros.rest };

      if (health_conditions.has_diabetes) {
        macros = { carbs: 45, protein: 25, fat: 30 };
      }
      if (health_conditions.is_menopausal) {
        macros.protein = Math.max(macros.protein, 40);
        macros.carbs = Math.min(macros.carbs, 35);
      }

      let adjustedMacros = { ...macros };
      if (cyclePhase === 'menstrual') {
        adjustedMacros.carbs += 5;
        adjustedMacros.protein -= 5;
      } else if (cyclePhase === 'follicular') {
        adjustedMacros.protein += 5;
        adjustedMacros.carbs -= 5;
      } else if (cyclePhase === 'ovulation') {
        adjustedMacros.protein += 5;
        adjustedMacros.fat -= 5;
      } else if (cyclePhase === 'luteal') {
        adjustedMacros.carbs += 5;
        adjustedMacros.fat += 5;
      }
      const total = adjustedMacros.carbs + adjustedMacros.protein + adjustedMacros.fat;
      adjustedMacros = {
        carbs: Math.round((adjustedMacros.carbs / total * 100) * 10) / 10,
        protein: Math.round((adjustedMacros.protein / total * 100) * 10) / 10,
        fat: Math.round((adjustedMacros.fat / total * 100) * 10) / 10,
      };

      const macroGrams: Macros = {
        carbs_g: Math.round((adjustedMacros.carbs / 100) * adjustedCalories / 4 * 10) / 10,
        protein_g: Math.round((adjustedMacros.protein / 100) * adjustedCalories / 4 * 10) / 10,
        fat_g: Math.round((adjustedMacros.fat / 100) * adjustedCalories / 9 * 10) / 10,
      };

      // Generate tags
      const perc = {
        carbs: (macroGrams.carbs_g * 4 / adjustedCalories) * 100,
        protein: (macroGrams.protein_g * 4 / adjustedCalories) * 100,
        fat: (macroGrams.fat_g * 9 / adjustedCalories) * 100,
      };
      const tags: string[] = [];
      if (cyclePhase === 'menstrual') {
        tags.push('Iron-Rich Focus', 'Anti-Inflammatory Meals');
      } else if (cyclePhase === 'follicular') {
        tags.push('High-Energy Meals', 'Muscle Repair Support');
      } else if (cyclePhase === 'ovulation') {
        tags.push('Hormone-Balancing Nutrients', 'Fertility-Optimized Foods');
      } else if (cyclePhase === 'luteal') {
        tags.push('Mood-Stabilizing Snacks', 'Craving-Control Strategies');
      }
      if (health_conditions.has_diabetes) {
        if (perc.carbs <= 45) tags.push('Low GI');
        if (perc.carbs < 35) tags.push('Low Carb');
        if (perc.protein >= 30) tags.push('High Protein');
        tags.push('Low Sugar');
      }
      if (health_conditions.has_hypertension) {
        tags.push('Low Sodium');
        if (perc.fat < 25) tags.push('Heart-Friendly Fats');
      }
      if (health_conditions.is_menopausal) {
        if (perc.protein >= 35) tags.push('Hormone-Supporting Protein');
        tags.push('Bone Health');
      }

      // Calculate sleep and water
      let baseSleep: number;
      if (age < 26) {
        baseSleep = 8.0;
      } else if (age < 65) {
        baseSleep = 7.5;
      } else {
        baseSleep = 7.0;
      }
      const sleep = caloriesBurned >= 500 ? baseSleep + 0.5 : caloriesBurned >= 300 ? baseSleep + 0.25 : baseSleep;

      const mlPerKg = age < 26 ? 40 : age < 65 ? 35 : 30;
      let baseWater = Math.round((mlPerKg * weight_kg) / 1000 * 100) / 100;
      const water = caloriesBurned >= 500 ? Math.round((baseWater + 0.75) * 100) / 100 : caloriesBurned >= 300 ? Math.round((baseWater + 0.5) * 100) / 100 : baseWater;

      // Store in DailyMealPlans
      const { error } = await supabase.from('DailyMealPlans').upsert({
        daily_workout_id: `day_${day}_${user_id}`,
        daily_calories: adjustedCalories,
        carbs_grams: macroGrams.carbs_g,
        protein_grams: macroGrams.protein_g,
        fat_grams: macroGrams.fat_g,
        water_litres: water,
        health_tags: tags,
        cycle_phase: cyclePhase,
        sleep_hours: sleep,
      });

      if (error) {
        console.error('Error saving meal plan:', error);
        continue;
      }

      mealPlan.push({
        Day: dayStr,
        'Daily Calories': adjustedCalories,
        'Carbs (g)': macroGrams.carbs_g,
        'Protein (g)': macroGrams.protein_g,
        'Fat (g)': macroGrams.fat_g,
        'Recommended Sleep (hrs)': sleep,
        'Recommended Water (L)': water,
        'Health Tags': tags,
        'Cycle Phase': cyclePhase.charAt(0).toUpperCase() + cyclePhase.slice(1),
      });
    }

    return new Response(JSON.stringify({ meal_plan: mealPlan }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to generate meal plan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};