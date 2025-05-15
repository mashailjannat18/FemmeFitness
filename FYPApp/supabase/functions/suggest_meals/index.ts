import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

// Define interfaces for type safety
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

interface Meal {
  Name: string;
  Calories: number;
  'Protein (g)': number;
  'Carbs (g)': number;
  'Fat (g)': number;
  Note?: string;
}

// Load GI table at module level (synchronous read for Edge Functions)
let giTable: { [key: string]: number } = {};
try {
  const csvText = fs.readFileSync(path.join(__dirname, 'gi_table.csv'), 'utf-8');
  const csvData = parse(csvText, { columns: true, skip_empty_lines: true });
  csvData.forEach((row: { 'Food Name': string; GI: string }) => {
    giTable[row['Food Name']] = parseInt(row['GI']);
  });
} catch (error) {
  console.error('Error loading GI table:', error);
}

// Supabase Edge Function handler
export const handler = async (req: Request): Promise<Response> => {
  try {
    const { diet, calories, macros, health_conditions, cycle_phase, user_id } = await req.json();

    if (!diet || !calories || !macros || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
      process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
    );

    // Fetch user data to ensure consistency
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('dietary_preference, calories, macros, health_conditions, cycle_phase')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mealCalories = [calories * 0.3, calories * 0.4, calories * 0.3];
    const meals: Meal[] = [];

    for (let i = 0; i < 3; i++) {
      const targetMacros: Macros = {
        calories: mealCalories[i],
        protein_g: macros.protein_g * mealCalories[i] / calories,
        carbs_g: macros.carbs_g * mealCalories[i] / calories,
        fat_g: macros.fat_g * mealCalories[i] / calories,
      };

      const response = await axios.get('https://trackapi.nutritionix.com/v2/search/instant', {
        headers: {
          'x-app-id': process.env.NUTRITIONIX_APP_ID || '',
          'x-app-key': process.env.NUTRITIONIX_API_KEY || '',
        },
        params: {
          query: `${diet} dish`,
          detailed: true,
          common: false,
          nutrient_filters: {
            nf_calories: { min: targetMacros.calories - 50, max: targetMacros.calories + 50 },
            nf_protein: { min: targetMacros.protein_g - 5, max: targetMacros.protein_g + 5 },
            nf_total_carbohydrate: { min: targetMacros.carbs_g - 10, max: targetMacros.carbs_g + 10 },
            nf_total_fat: { min: targetMacros.fat_g - 5, max: targetMacros.fat_g + 5 },
            ...(health_conditions.has_diabetes && { nf_total_carbohydrate: { max: 50 } }),
            ...(cycle_phase === 'menstruation' && { nf_iron: { min: 2 } }),
            ...(cycle_phase === 'luteal' && { nf_total_carbohydrate: { max: 60 } }),
          },
        },
      });

      let dishes = response.data.branded || [];

      if (health_conditions.has_diabetes || cycle_phase === 'luteal') {
        dishes = dishes.filter((dish: { food_name: string }) => {
          const dishName = dish.food_name.toLowerCase();
          const giValue = giTable[dishName] || 55; // Default to 55 if not found
          return giValue < 55;
        });
      }

      const scoreDish = (dish: { nf_calories: number; nf_protein: number; nf_total_carbohydrate: number; nf_total_fat: number }) => {
        return Math.sqrt(
          (dish.nf_calories - targetMacros.calories) ** 2 +
          (dish.nf_protein - targetMacros.protein_g) ** 2 +
          (dish.nf_total_carbohydrate - targetMacros.carbs_g) ** 2 +
          (dish.nf_total_fat - targetMacros.fat_g) ** 2
        );
      };

      if (dishes.length > 0) {
        const bestDish = dishes.reduce((best: any, dish: any) => scoreDish(dish) < scoreDish(best) ? dish : best, dishes[0]);
        meals.push({
          Name: bestDish.food_name,
          Calories: bestDish.nf_calories,
          'Protein (g)': bestDish.nf_protein,
          'Carbs (g)': bestDish.nf_total_carbohydrate,
          'Fat (g)': bestDish.nf_total_fat,
        });
      } else {
        meals.push({ Name: `Meal ${i + 1}`, Note: 'No matching dish found' });
      }
    }

    return new Response(JSON.stringify({ meals }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to suggest meals' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};