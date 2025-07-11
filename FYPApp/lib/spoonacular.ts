// lib/spoonacular.ts
import NodeCache from 'node-cache';
import { supabase } from './supabase';

const API_KEY = '6c1ed1cc0ba24fce90b39fb74c3a7455';
const BASE_URL = 'https://api.spoonacular.com';
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

interface Recipe {
  id: number;
  title: string;
  image: string;
  calories: number;
  protein: string;
  fat: string;
  carbs: string;
}

interface NutrientParams {
  minCarbs?: number;
  maxCarbs?: number;
  minProtein?: number;
  maxProtein?: number;
  minFat?: number;
  maxFat?: number;
  minCalories?: number;
  maxCalories?: number;
  number?: number;
  mealType?: 'breakfast' | 'lunch' | 'dinner';
}

interface ScoredRecipe extends Recipe {
  score: number;
  nutrientDetails: Record<string, number>;
}

async function getUserHealthConditions(userId: string) {
  try {
    const { data, error } = await supabase
      .from('User')
      .select('health_conditions, cycle_phase')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching user health conditions:', error?.message);
      return { healthCondition: null, menstrualPhase: null };
    }

    // Extract primary health condition (simplified - you might want more complex logic)
    let healthCondition = null;
    if (data.health_conditions) {
      const conditions = data.health_conditions;
      if (conditions.diabetes) healthCondition = 'Diabetes';
      else if (conditions.hypertension) healthCondition = 'Hypertension';
      else if (conditions.menopause) healthCondition = 'Menopause';
    }

    // Map cycle phase
    let menstrualPhase = null;
    if (data.cycle_phase) {
      const phaseMap: Record<string, string> = {
        'follicular': 'follicular',
        'ovulation': 'ovulatory',
        'luteal': 'luteal',
        'menstruation': 'menstrual'
      };
      menstrualPhase = phaseMap[data.cycle_phase.toLowerCase()] || null;
    }

    return { healthCondition, menstrualPhase };
  } catch (error) {
    console.error('Error in getUserHealthConditions:', error);
    return { healthCondition: null, menstrualPhase: null };
  }
}

function calculateRecipeScore(
  nutrition: any,
  healthCondition: string | null,
  menstrualPhase: string | null
): { score: number; nutrientDetails: Record<string, number> } {
  const getNutrient = (name: string) => nutrition.nutrients?.find((n: any) => n.name === name)?.amount || 0;
  const gi = nutrition.properties?.find((p: any) => p.title === 'Glycemic Index')?.amount || null;

  const normalize = (value: number, min: number, max: number, reverse = false) => {
    if (value < min) return reverse ? 100 : 0;
    if (value > max) return reverse ? 0 : 100;
    return reverse ? 100 * (max - value) / (max - min) : 100 * (value - min) / (max - min);
  };

  let score = 0;
  const nutrientDetails: Record<string, number> = {};

  // Health condition scoring
  if (healthCondition === 'Hypertension') {
    const sodiumScore = normalize(getNutrient('Sodium'), 0, 500, true);
    const potassiumScore = normalize(getNutrient('Potassium'), 500, 1000);
    score += 0.6 * sodiumScore + 0.4 * potassiumScore;
    nutrientDetails.sodium = getNutrient('Sodium');
    nutrientDetails.potassium = getNutrient('Potassium');
  } else if (healthCondition === 'Menopause') {
    const calciumScore = normalize(getNutrient('Calcium'), 200, 400);
    const magnesiumScore = normalize(getNutrient('Magnesium'), 80, 160);
    const sugarScore = normalize(getNutrient('Sugar'), 0, 25, true);
    score += 0.33 * calciumScore + 0.33 * magnesiumScore + 0.33 * sugarScore;
    nutrientDetails.calcium = getNutrient('Calcium');
    nutrientDetails.magnesium = getNutrient('Magnesium');
    nutrientDetails.sugar = getNutrient('Sugar');
  } else if (healthCondition === 'Diabetes') {
    const giScore = gi ? normalize(gi, 0, 55, true) : normalize(getNutrient('Carbohydrates'), 0, 50, true);
    const fiberScore = normalize(getNutrient('Fiber'), 5, 10);
    const sugarScore = normalize(getNutrient('Sugar'), 0, 10, true);
    score += 0.5 * giScore + 0.3 * fiberScore + 0.2 * sugarScore;
    nutrientDetails.glycemicIndex = gi || 0;
    nutrientDetails.carbohydrates = getNutrient('Carbohydrates');
    nutrientDetails.fiber = getNutrient('Fiber');
    nutrientDetails.sugar = getNutrient('Sugar');
  }

  // Menstrual phase scoring
  if (menstrualPhase === 'follicular') {
    const ironScore = normalize(getNutrient('Iron'), 5, 10);
    const vitaminB6Score = normalize(getNutrient('Vitamin B6'), 0.5, 1);
    score += 0.5 * ironScore + 0.3 * vitaminB6Score;
    nutrientDetails.iron = getNutrient('Iron');
    nutrientDetails.vitaminB6 = getNutrient('Vitamin B6');
  } else if (menstrualPhase === 'ovulatory') {
    const zincScore = normalize(getNutrient('Zinc'), 3, 6);
    const vitaminEScore = normalize(getNutrient('Vitamin E'), 4, 8);
    score += 0.5 * zincScore + 0.3 * vitaminEScore;
    nutrientDetails.zinc = getNutrient('Zinc');
    nutrientDetails.vitaminE = getNutrient('Vitamin E');
  } else if (menstrualPhase === 'luteal') {
    const magnesiumScore = normalize(getNutrient('Magnesium'), 80, 160);
    const calciumScore = normalize(getNutrient('Calcium'), 200, 400);
    score += 0.5 * magnesiumScore + 0.3 * calciumScore;
    nutrientDetails.magnesium = getNutrient('Magnesium');
    nutrientDetails.calcium = getNutrient('Calcium');
  } else if (menstrualPhase === 'menstrual') {
    const ironScore = normalize(getNutrient('Iron'), 5, 10);
    const vitaminCScore = normalize(getNutrient('Vitamin C'), 20, 40);
    score += 0.5 * ironScore + 0.3 * vitaminCScore;
    nutrientDetails.iron = getNutrient('Iron');
    nutrientDetails.vitaminC = getNutrient('Vitamin C');
  }

  // Normalize total score
  const normalizationFactor = (healthCondition && menstrualPhase) ? 1.8 : (healthCondition || menstrualPhase) ? 1 : 0;
  score = normalizationFactor ? score / normalizationFactor : 0;

  return { score, nutrientDetails };
}

async function fetchRecipeDetails(recipeId: number): Promise<any | null> {
  const cacheKey = `recipe_${recipeId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`Using cached data for recipe ${recipeId}`);
    return cached;
  }

  try {
    const response = await fetch(`${BASE_URL}/recipes/${recipeId}/information?apiKey=${API_KEY}&includeNutrition=true`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    cache.set(cacheKey, data);
    console.log(`Fetched and cached details for recipe ${recipeId}`);
    return data;
  } catch (error) {
    console.error(`Error fetching details for recipe ${recipeId}:`, error);
    return null;
  }
}

export const fetchRecipesByNutrients = async (params: NutrientParams & { userId?: string }): Promise<Recipe[]> => {
  const {
    minCarbs,
    maxCarbs,
    minProtein,
    maxProtein,
    minFat,
    maxFat,
    minCalories,
    maxCalories,
    number = 3,
    mealType,
    userId
  } = params;

  // Get user health conditions if userId is provided
  let healthCondition = null;
  let menstrualPhase = null;
  if (userId) {
    const healthData = await getUserHealthConditions(userId);
    healthCondition = healthData.healthCondition;
    menstrualPhase = healthData.menstrualPhase;
  }

  const queryParams = new URLSearchParams();
  queryParams.append('apiKey', API_KEY);
  
  // Add all provided parameters
  Object.entries({
    minCarbs,
    maxCarbs,
    minProtein,
    maxProtein,
    minFat,
    maxFat,
    minCalories,
    maxCalories,
    number: 10 // Fetch more recipes for scoring
  }).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.append(key, value.toString());
    }
  });

  if (mealType) queryParams.append('type', mealType);

  // Add diet filters for health condition
  let diet = '';
  if (healthCondition === 'Hypertension') diet = 'low-sodium';
  else if (healthCondition === 'Menopause') diet = 'high-protein';
  else if (healthCondition === 'Diabetes') diet = 'low-carb,high-fiber';
  if (diet) queryParams.append('diet', diet);

  console.log('Fetching recipes with params:', { 
    ...params, 
    healthCondition, 
    menstrualPhase,
    diet 
  });

  try {
    const response = await fetch(`${BASE_URL}/recipes/complexSearch?${queryParams}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Number of recipes received:', data.results?.length || 0);

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Score recipes if we have health conditions or menstrual phase
    if (healthCondition || menstrualPhase) {
      const scoredRecipes: ScoredRecipe[] = [];
      
      for (const recipe of data.results) {
        const details = await fetchRecipeDetails(recipe.id);
        if (details?.nutrition) {
          const { score, nutrientDetails } = calculateRecipeScore(
            details.nutrition,
            healthCondition,
            menstrualPhase
          );

          scoredRecipes.push({
            id: recipe.id,
            title: recipe.title,
            image: recipe.image,
            calories: details.nutrition.nutrients.find((n: any) => n.name === 'Calories')?.amount || 0,
            protein: `${details.nutrition.nutrients.find((n: any) => n.name === 'Protein')?.amount || 0}g`,
            fat: `${details.nutrition.nutrients.find((n: any) => n.name === 'Fat')?.amount || 0}g`,
            carbs: `${details.nutrition.nutrients.find((n: any) => n.name === 'Carbohydrates')?.amount || 0}g`,
            score,
            nutrientDetails
          });
        }
      }

      // Sort by score and return top N recipes
      scoredRecipes.sort((a, b) => b.score - a.score);
      const topRecipes = scoredRecipes.slice(0, number).map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        calories: recipe.calories,
        protein: recipe.protein,
        fat: recipe.fat,
        carbs: recipe.carbs
      }));

      console.log('Top scored recipes:', topRecipes);
      return topRecipes;
    }

    // If no health conditions, return basic recipe info
    const recipes = data.results.slice(0, number).map((recipe: any) => ({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      calories: 0, // Will be filled in by details if needed
      protein: '0g',
      fat: '0g',
      carbs: '0g'
    }));

    // If we need detailed nutrition info (for non-scored recipes)
    if (recipes.length > 0 && recipes[0].calories === 0) {
      for (const recipe of recipes) {
        const details = await fetchRecipeDetails(recipe.id);
        if (details?.nutrition) {
          recipe.calories = details.nutrition.nutrients.find((n: any) => n.name === 'Calories')?.amount || 0;
          recipe.protein = `${details.nutrition.nutrients.find((n: any) => n.name === 'Protein')?.amount || 0}g`;
          recipe.fat = `${details.nutrition.nutrients.find((n: any) => n.name === 'Fat')?.amount || 0}g`;
          recipe.carbs = `${details.nutrition.nutrients.find((n: any) => n.name === 'Carbohydrates')?.amount || 0}g`;
        }
      }
    }

    return recipes;
  } catch (error) {
    console.error('API Call Failed:', error);
    throw error;
  }
};