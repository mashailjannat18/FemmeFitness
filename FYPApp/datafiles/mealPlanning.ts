import { supabase } from '@/lib/supabase';
import axios from 'axios';

const NUTRITIONIX_APP_ID = 'af25b1a8';
const NUTRITIONIX_API_KEY = '1902c21626133aa332a2856f0d10eeab';

// Interface definitions based on userData.ts, workout_routes.py, cycle_routes.py, and existing logic
interface UserData {
  username: string;
  email: string;
  password: string;
  age: number;
  weight: number;
  height: number;
  diseases: string[];
  goal: string;
  areasOfFocus: string[];
  activityLevel: number;
  preferredRestDay: string;
  challengeDays: number;
  lastPeriodDate: Date | null;
  cycleLength: number;
  bleedingDays: number;
}

interface WorkoutPlanEntry {
  Day: string;
  Focus: string;
  Date: string;
  Workouts: Array<{
    Name: string;
    'Target Muscle': string;
    Type: string;
    'MET Value': number;
    Difficulty: string;
    Sets: number;
    Reps: string;
    'Rest Time (sec)': number;
    'Duration (min)': number;
    'Calories Burned': number;
    Description?: string;
  }>;
  'Total Duration (min)': number;
  'Total Calories Burned': number;
}

interface MealPlanEntry {
  Day: string;
  Date: string;
  daily_calories: number;
  carbs_grams: number;
  protein_grams: number;
  fat_grams: number;
  sleep_hours: number;
  water_litres: number;
  health_tags: string | null;
}

interface CyclePhase {
  date: string;
  cycle_day: number;
  phase: string;
}

interface SuggestedMeal {
  Name: string;
  MealType: string;
  Calories: number;
  'Protein (g)': number;
  'Carbs (g)': number;
  'Fat (g)': number;
  Note?: string;
}

// GI Table data (embedded from gi_table.csv)
const giTable: { [key: string]: number } = {
  'Apple (raw with skin)': 39,
  'Banana (ripe)': 51,
  'Lentils (boiled)': 29,
  'White Bread': 75,
  'Quinoa (cooked)': 53,
  'Sweet Potato (baked)': 94,
  'Broccoli (steamed)': 10,
  'Pasta (al dente whole wheat)': 42,
  'Chocolate (70% cocoa)': 25,
  'Kimchi (fermented cabbage)': 15,
  'Chapatti (whole wheat)': 52,
  'Sushi (salmon rice)': 48,
  'Potato Chips': 56,
  'Greek Yogurt (full-fat plain)': 12,
  'Mango (raw)': 51,
  'Biryani (chicken basmati rice)': 58,
  'Oatmeal (steel-cut cooked)': 42,
  'Pizza (cheese thin crust)': 60,
  'Carrot (raw)': 39,
  'Ice Cream (vanilla)': 38,
};

// Main function to adjust meal plan and suggest meals
export const processMealPlanning = async (
  userData: UserData,
  workoutPlan: WorkoutPlanEntry[],
  initialMealPlan: MealPlanEntry[],
  cyclePhases: CyclePhase[],
  intensity: string
): Promise<{
  adjustedMealPlan: MealPlanEntry[];
  suggestedMeals: { [day: string]: SuggestedMeal[] };
}> => {
  // Step 1: Adjust the meal plan calories (logic from generate_meal_plan.ts)
  const adjustedMealPlan: MealPlanEntry[] = [];
  const suggestedMeals: { [day: string]: SuggestedMeal[] } = {};

  // Derive health conditions from userData.diseases
  const healthConditions = {
    has_diabetes: userData.diseases.includes('Diabetes Type 2'),
    has_hypertension: userData.diseases.includes('Hypertension'),
    is_menopausal: userData.diseases.includes('Menopause'),
  };

  // Map cycle phases to days
  const cyclePhaseMap: { [key: number]: string } = {};
  cyclePhases.forEach((phase) => {
    cyclePhaseMap[phase.cycle_day] = phase.phase.toLowerCase();
  });

  for (let i = 0; i < workoutPlan.length; i++) {
    const workoutEntry = workoutPlan[i];
    const initialMealEntry = initialMealPlan[i];
    const dayMatch = workoutEntry.Day.match(/Day (\d+)/);
    if (!dayMatch) continue;
    const dayNumber = parseInt(dayMatch[1]);
    const cyclePhase = cyclePhaseMap[dayNumber] || 'follicular';

    // Determine dominant workout type
    let dominantType = 'rest';
    let maxCalories = -1;
    if (workoutEntry.Workouts && workoutEntry.Workouts.length > 0) {
      workoutEntry.Workouts.forEach((workout) => {
        if (workout['Calories Burned'] > maxCalories) {
          maxCalories = workout['Calories Burned'];
          dominantType = workout.Type.toLowerCase();
        }
      });
    }
    dominantType = normalizeWorkoutType(dominantType);

    // Calculate BMI
    const heightMeters = userData.height * 0.3048;
    const bmi = userData.weight / (heightMeters ** 2);

    // Adjust calories
    let baseCalories: number;
    if (userData.age < 30) {
      baseCalories = 15.3 * bmi * 1.2 + 679;
    } else if (userData.age < 50) {
      baseCalories = 11.6 * bmi * 1.2 + 879;
    } else {
      baseCalories = 13.5 * bmi * 1.2 + 487;
    }

    const activityMultipliers: { [key: string]: number } = { low: 1.2, moderate: 1.55, high: 1.9 };
    const activityLevel = convertActivityLevel(userData.activityLevel);
    baseCalories *= activityMultipliers[activityLevel] || 1.2;

    let dailyCalories: number;
    if (userData.goal === 'weight_loss') {
      dailyCalories = Math.max(1200, baseCalories - 300 + workoutEntry['Total Calories Burned']);
    } else if (userData.goal === 'muscle_gain') {
      dailyCalories = baseCalories + 250 + workoutEntry['Total Calories Burned'];
    } else {
      dailyCalories = baseCalories + workoutEntry['Total Calories Burned'];
    }

    const cycleAdjustments: { [key: string]: number } = {
      menstruation: -0.08,
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
    let macros = { ...baseMacros[dominantType] };

    if (healthConditions.has_diabetes) {
      macros = { carbs: 45, protein: 25, fat: 30 };
    }
    if (healthConditions.is_menopausal) {
      macros.protein = Math.max(macros.protein, 40);
      macros.carbs = Math.min(macros.carbs, 35);
    }

    let adjustedMacros = { ...macros };
    if (cyclePhase === 'menstruation') {
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

    const macroGrams = {
      carbs: Math.round((adjustedMacros.carbs / 100) * adjustedCalories / 4 * 10) / 10,
      protein: Math.round((adjustedMacros.protein / 100) * adjustedCalories / 4 * 10) / 10,
      fat: Math.round((adjustedMacros.fat / 100) * adjustedCalories / 9 * 10) / 10,
    };

    // Generate health tags
    const perc = {
      carbs: (macroGrams.carbs * 4 / adjustedCalories) * 100,
      protein: (macroGrams.protein * 4 / adjustedCalories) * 100,
      fat: (macroGrams.fat * 9 / adjustedCalories) * 100,
    };
    const tags: string[] = [];
    if (!healthConditions.is_menopausal) {
      if (cyclePhase === 'menstruation') {
        tags.push('Iron-Rich Focus', 'Anti-Inflammatory Meals');
      } else if (cyclePhase === 'follicular') {
        tags.push('High-Energy Meals', 'Muscle Repair Support');
      } else if (cyclePhase === 'ovulation') {
        tags.push('Hormone-Balancing Nutrients', 'Fertility-Optimized Foods');
      } else if (cyclePhase === 'luteal') {
        tags.push('Mood-Stabilizing Snacks', 'Craving-Control Strategies');
      }
    }
    if (healthConditions.has_diabetes) {
      if (perc.carbs <= 45) tags.push('Low GI');
      if (perc.carbs < 35) tags.push('Low Carb');
      if (perc.protein >= 30) tags.push('High Protein');
      tags.push('Low Sugar');
    }
    if (healthConditions.has_hypertension) {
      tags.push('Low Sodium');
      if (perc.fat < 25) tags.push('Heart-Friendly Fats');
    }
    if (healthConditions.is_menopausal) {
      if (perc.protein >= 35) tags.push('Hormone-Supporting Protein');
      tags.push('Bone Health');
    }

    // Calculate sleep and water
    let baseSleep: number;
    if (userData.age < 26) {
      baseSleep = 8.0;
    } else if (userData.age < 65) {
      baseSleep = 7.5;
    } else {
      baseSleep = 7.0;
    }
    const sleep = workoutEntry['Total Calories Burned'] >= 500
      ? baseSleep + 0.5
      : workoutEntry['Total Calories Burned'] >= 300
      ? baseSleep + 0.25
      : baseSleep;

    const mlPerKg = userData.age < 26 ? 40 : userData.age < 65 ? 35 : 30;
    let baseWater = Math.round((mlPerKg * userData.weight) / 1000 * 100) / 100;
    const water = workoutEntry['Total Calories Burned'] >= 500
      ? Math.round((baseWater + 0.75) * 100) / 100
      : workoutEntry['Total Calories Burned'] >= 300
      ? Math.round((baseWater + 0.5) * 100) / 100
      : baseWater;

    // Update the meal plan entry with adjusted values
    const adjustedEntry: MealPlanEntry = {
      ...initialMealEntry,
      daily_calories: adjustedCalories,
      carbs_grams: macroGrams.carbs,
      protein_grams: macroGrams.protein,
      fat_grams: macroGrams.fat,
      sleep_hours: sleep,
      water_litres: water,
      health_tags: tags.length > 0 ? tags.join(', ') : null,
    };
    adjustedMealPlan.push(adjustedEntry);

    // Step 2: Suggest meals (logic from suggest_meals.ts)
    const mealCalories = [adjustedCalories * 0.3, adjustedCalories * 0.4, adjustedCalories * 0.3];
    const meals: SuggestedMeal[] = [];

    for (let j = 0; j < 3; j++) {
      const targetMacros = {
        calories: mealCalories[j],
        protein_g: macroGrams.protein * mealCalories[j] / adjustedCalories,
        carbs_g: macroGrams.carbs * mealCalories[j] / adjustedCalories,
        fat_g: macroGrams.fat * mealCalories[j] / adjustedCalories,
      };

      const diet = userData.goal === 'weight_loss' ? 'healthy' : userData.goal === 'muscle_gain' ? 'high protein' : 'balanced';
      const mealType = j === 0 ? 'breakfast' : j === 1 ? 'lunch' : 'dinner';

      try {
        const response = await axios.post(
          'https://trackapi.nutritionix.com/v2/natural/nutrients',
          {
            query: `${diet} ${mealType} dish`,
            use_branded_foods: false,
            use_raw_foods: true,
            nutrient_filters: {
              nf_calories: { min: targetMacros.calories - 50, max: targetMacros.calories + 50 },
              nf_protein: { min: targetMacros.protein_g - 5, max: targetMacros.protein_g + 5 },
              nf_total_carbohydrate: { min: targetMacros.carbs_g - 10, max: targetMacros.carbs_g + 10 },
              nf_total_fat: { min: targetMacros.fat_g - 5, max: targetMacros.fat_g + 5 },
              ...(healthConditions.has_diabetes && { nf_total_carbohydrate: { max: 50 } }),
              ...(cyclePhase === 'menstruation' && { nf_iron: { min: 2 } }),
              ...(cyclePhase === 'luteal' && { nf_total_carbohydrate: { max: 60 } }),
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-app-id': NUTRITIONIX_APP_ID,
              'x-app-key': NUTRITIONIX_API_KEY,
            },
          }
        );

        const foods = response.data.foods || [];
        if (foods.length > 0) {
          const bestFood = foods[0]; // Take the first food as the best match (simplified selection)
          meals.push({
            Name: bestFood.food_name,
            Calories: bestFood.nf_calories,
            'Protein (g)': bestFood.nf_protein,
            'Carbs (g)': bestFood.nf_total_carbohydrate,
            'Fat (g)': bestFood.nf_total_fat,
            MealType: mealType,
          });
        } else {
          meals.push({
            Name: `Default ${mealType}`,
            Note: 'No matching dish found',
            MealType: mealType,
            Calories: targetMacros.calories,
            'Protein (g)': targetMacros.protein_g,
            'Carbs (g)': targetMacros.carbs_g,
            'Fat (g)': targetMacros.fat_g,
          });
        }
      } catch (error: any) {
        // console.error(`Error suggesting meal for Day ${dayNumber}, Meal ${j + 1}:`, error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
          console.error('Response headers:', error.response.headers);
        }
        meals.push({
          Name: `Default ${mealType}`,
          Note: 'Error fetching dish',
          MealType: mealType,
          Calories: targetMacros.calories,
          'Protein (g)': targetMacros.protein_g,
          'Carbs (g)': targetMacros.carbs_g,
          'Fat (g)': targetMacros.fat_g,
        });
      }
    }

    if (healthConditions.has_diabetes || cyclePhase === 'luteal') {
      meals.forEach((meal) => {
        const gi = giTable[meal.Name] || 55;
        if (gi >= 55) {
          meal.Note = (meal.Note ? `${meal.Note}, ` : '') + 'High GI, consider substitution';
        }
      });
    }

    suggestedMeals[workoutEntry.Day] = meals;
  }

  return { adjustedMealPlan, suggestedMeals };
};

// Helper function to normalize workout type
const normalizeWorkoutType = (workoutType: string): string => {
  workoutType = workoutType.toLowerCase();
  return workoutType in ['strength', 'hiit', 'cardio', 'rest'] ? workoutType : 'rest';
};

// Helper function to convert activity level
const convertActivityLevel = (sliderValue: number): string => {
  if (sliderValue < 35) return 'low';
  if (sliderValue < 70) return 'moderate';
  return 'high';
};

// Function to call processMealPlanning and insert data into Supabase
export const handleSignupMealPlanning = async (
  userData: UserData,
  workoutPlan: WorkoutPlanEntry[],
  initialMealPlan: MealPlanEntry[],
  cyclePhases: CyclePhase[],
  intensity: string
): Promise<{ user_id: number; workout_plan_id: number }> => {
  try {
    // Process the meal plan and suggest meals
    const { adjustedMealPlan, suggestedMeals } = await processMealPlanning(
      userData,
      workoutPlan,
      initialMealPlan,
      cyclePhases,
      intensity
    );

    // Prepare data for insert_user_and_workout_plan function
    const startDate = new Date();
    const params = {
      p_username: userData.username,
      p_email: userData.email,
      p_password: userData.password,
      p_age: userData.age,
      p_weight: userData.weight,
      p_height: userData.height,
      p_diseases: userData.diseases.join(','),
      p_goal: userData.goal,
      p_areas_of_focus: userData.areasOfFocus.join(','),
      p_activity_level: userData.activityLevel,
      p_preferred_rest_day: userData.preferredRestDay,
      p_challenge_days: userData.challengeDays,
      p_workout_plan: JSON.stringify(workoutPlan),
      p_meal_plan: JSON.stringify(adjustedMealPlan),
      p_start_date: startDate.toISOString().split('T')[0],
      p_intensity: intensity,
      p_last_period_date: userData.lastPeriodDate ? userData.lastPeriodDate.toISOString().split('T')[0] : null,
      p_cycle_length: userData.cycleLength,
      p_bleeding_days: userData.bleedingDays,
      p_cycle_phases: JSON.stringify(cyclePhases),
      p_suggested_meals: JSON.stringify(suggestedMeals),
    };

    // Call the insert_user_and_workout_plan function via Supabase
    const { data, error } = await supabase.rpc('insert_user_and_workout_plan', params);

    if (error) {
      console.error('Error calling insert_user_and_workout_plan:', error);
      throw new Error(`Failed to insert user and plans: ${error.message}`);
    }

    return {
      user_id: data[0].user_id,
      workout_plan_id: data[0].workout_plan_id,
    };
  } catch (error) {
    console.error('Error in handleSignupMealPlanning:', error);
    throw error;
  }
};