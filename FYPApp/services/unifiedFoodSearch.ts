import mealData from '@/datafiles/USDA Ingredients.json';
import { searchDishes } from './nutritionixService';

const dishCache: Map<string, any[]> = new Map();

interface UnifiedFoodResult {
  type: 'ingredient' | 'dish';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingQty: number | null;
  servingWeightGrams: number | null;
  sourceData: any;
  id: string;
}

const capitalizeWords = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const levenshteinDistance = (a: string, b: string): number => {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
};

const getSimilarityScore = (str1: string, str2: string): number => {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  let score = 1 - distance / maxLength;

  const queryLower = str1.toLowerCase();
  const targetLower = str2.toLowerCase();
  if (targetLower.startsWith(queryLower)) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
};

export const unifiedFoodSearch = async (query: string): Promise<UnifiedFoodResult[]> => {
  if (!query.trim() || query.length < 2) return [];

  const nameQuery = query.toLowerCase().trim();

  // Deduplicate ingredients by friendly_name
  const uniqueIngredientsMap = new Map<string, any>();
  mealData.forEach((item: any) => {
    if (!uniqueIngredientsMap.has(item.friendly_name)) {
      uniqueIngredientsMap.set(item.friendly_name, item);
    }
  });
  const uniqueIngredients = Array.from(uniqueIngredientsMap.values());

  // Search CSV data (ingredients)
  const rankedIngredients = uniqueIngredients
    .map((item: any) => ({
      item,
      score: getSimilarityScore(nameQuery, item.friendly_name || ''),
    }))
    .filter(result => result.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const formattedIngredients = rankedIngredients.map((result, index) => ({
    type: 'ingredient' as const,
    name: result.item.friendly_name,
    calories: result.item.calories ?? 0,
    protein: result.item.protein ?? 0,
    carbs: result.item.carbs ?? 0,
    fat: result.item.fat ?? 0,
    servingQty: null,          // Not available in CSV
    servingWeightGrams: null,  // Not available in CSV
    sourceData: result.item,
    id: `ingredient-${result.item.friendly_name}-${index}`,
  }));

  // Check cache for API results
  let dishMatches: any[];
  if (dishCache.has(nameQuery)) {
    dishMatches = dishCache.get(nameQuery)!;
  } else {
    dishMatches = await searchDishes(query);
    dishCache.set(nameQuery, dishMatches);
    if (dishCache.size > 100) {
      const oldestKey = dishCache.keys().next().value;
      dishCache.delete(oldestKey);
    }
  }

  // Process API results with fuzzy logic
  const rankedDishes = dishMatches
    .map((dish: any) => ({
      dish,
      score: getSimilarityScore(nameQuery, dish.food_name || ''),
    }))
    .filter(result => result.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const formattedDishes = rankedDishes.map((result, index) => {
    const nutrients = result.dish.full_nutrients || [];
    const calories = nutrients.find((n: any) => n.attr_id === 208)?.value ?? 0; // 208 = Calories (kcal)
    const protein = nutrients.find((n: any) => n.attr_id === 203)?.value ?? 0; // 203 = Protein (g)
    const carbs = nutrients.find((n: any) => n.attr_id === 205)?.value ?? 0;   // 205 = Carbs (g)
    const fat = nutrients.find((n: any) => n.attr_id === 204)?.value ?? 0;     // 204 = Fat (g)

    return {
      type: 'dish' as const,
      name: capitalizeWords(result.dish.food_name),
      calories,
      protein,
      carbs,
      fat,
      servingQty: result.dish.serving_qty ?? null,              // Extract serving quantity
      servingWeightGrams: result.dish.serving_weight_grams ?? null, // Extract weight in grams
      sourceData: result.dish,
      id: `dish-${result.dish.food_name}-${index}`,
    };
  });

  const allResults = [...formattedIngredients, ...formattedDishes]
    .sort((a, b) => {
      const scoreA = getSimilarityScore(nameQuery, a.name);
      const scoreB = getSimilarityScore(nameQuery, b.name);
      return scoreB - scoreA;
    })
    .slice(0, 6);

  return allResults;
};