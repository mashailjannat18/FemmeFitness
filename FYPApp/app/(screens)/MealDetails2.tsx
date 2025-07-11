import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SpoonacularRecipe {
  id: number;
  servings: number;
  extendedIngredients: Array<{
    measures: {
      metric: { amount: number; unitShort: string };
      us: { amount: number; unitShort: string };
    };
    name: string;
    original: string;
  }>;
  nutrition: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

export default function MealDetails2() {
  const router = useRouter();
  const {
    mealName,
    calories,
    protein,
    carbs,
    fat,
    servingQty,
    servingWeightGrams,
    type,
    dailyWorkoutId,
    image,
    spoonacularId,
  } = useLocalSearchParams<{
    mealName: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    servingQty: string;
    servingWeightGrams: string;
    type: 'ingredient' | 'dish';
    dailyWorkoutId?: string;
    image?: string;
    spoonacularId?: string;
  }>();

  // Parse initial nutrient values from params
  const initialCalories = parseFloat(calories) || 0;
  const initialProtein = parseFloat(protein) || 0;
  const initialCarbs = parseFloat(carbs) || 0;
  const initialFat = parseFloat(fat) || 0;

  // Log initial nutrient values from params
  console.log('Initial nutrient values from useLocalSearchParams:', {
    source: 'useLocalSearchParams',
    mealName,
    calories: initialCalories,
    protein: initialProtein,
    carbs: initialCarbs,
    fat: initialFat,
    servingQty,
    servingWeightGrams,
    type,
    spoonacularId
  });

  // State for serving adjustments and Spoonacular data
  const [recipeDetails, setRecipeDetails] = useState<SpoonacularRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [defaultServingGrams, setDefaultServingGrams] = useState<number>(100);
  const [defaultServingQty, setDefaultServingQty] = useState<number>(1);
  const [isCountable, setIsCountable] = useState<boolean>(false);

  // List of countable ingredients (simplified)
  const countableIngredients = ['apple', 'mango', 'banana', 'egg', 'orange', 'potato', 'carrot'];

  // Determine if the item is countable
  useEffect(() => {
    if (type === 'dish') {
      setIsCountable(false); // Dishes are always uncountable
    } else if (type === 'ingredient') {
      // Check if mealName suggests a countable item
      const isCountableItem = countableIngredients.some(item => 
        mealName.toLowerCase().includes(item)
      );
      setIsCountable(isCountableItem);
    }
  }, [mealName, type]);

  const [selectedServing, setSelectedServing] = useState<string>(
    isCountable ? '1' : '100g' // Default to 1 for countable, 100g for uncountable
  );

  // Fetch recipe details if spoonacularId is provided
  useEffect(() => {
    const fetchRecipeDetails = async () => {
      if (spoonacularId) {
        setIsLoading(true);
        try {
          const response = await fetch(
            `https://api.spoonacular.com/recipes/${spoonacularId}/information?apiKey=6c1ed1cc0ba24fce90b39fb74c3a7455&includeNutrition=true`
          );
          if (!response.ok) throw new Error('Failed to fetch recipe details');
          const data: SpoonacularRecipe = await response.json();
          setRecipeDetails(data);
          
          // For dishes, calculate total grams from ingredients
          if (type === 'dish' && data.extendedIngredients) {
            const totalGrams = data.extendedIngredients.reduce((sum: number, ingredient: any) => {
              return sum + (ingredient.measures.metric.unitShort === 'g' ? ingredient.measures.metric.amount : 0);
            }, 0);
            const calculatedGrams = Math.round(totalGrams / (data.servings || 1)) || 100;
            setDefaultServingGrams(calculatedGrams);
            setSelectedServing(`${calculatedGrams}g`);
          }
        } catch (error) {
          console.error('Error fetching recipe details:', error);
          // Fallback to default 100g for uncountable items
          if (!isCountable) {
            setDefaultServingGrams(100);
            setSelectedServing('100g');
          }
        } finally {
          setIsLoading(false);
        }
      } else if (!isCountable) {
        // For uncountable ingredients without spoonacularId, default to 100g
        setDefaultServingGrams(100);
        setSelectedServing('100g');
      }
    };
    fetchRecipeDetails();
  }, [spoonacularId, servingWeightGrams, servingQty, type, isCountable, mealName]);

  // Generate serving sizes
  const servingSizes = isCountable 
    ? Array.from({ length: 20 }, (_, i) => `${i + 1}`) // 1 to 20 units
    : Array.from({ length: 400 }, (_, i) => `${(i + 1) * 5}g`); 

  // Use API nutrient values if available, otherwise use params
  const nutrientSource = recipeDetails?.nutrition?.nutrients ? 'Spoonacular API' : 'useLocalSearchParams';
  const finalCalories = recipeDetails?.nutrition?.nutrients
    ? (recipeDetails.nutrition.nutrients.find(n => n.name === 'Calories')?.amount || initialCalories)
    : initialCalories;
  const finalProtein = recipeDetails?.nutrition?.nutrients
    ? (recipeDetails.nutrition.nutrients.find(n => n.name === 'Protein')?.amount || initialProtein)
    : initialProtein;
  const finalCarbs = recipeDetails?.nutrition?.nutrients
    ? (recipeDetails.nutrition.nutrients.find(n => n.name === 'Carbohydrates')?.amount || initialCarbs)
    : initialCarbs;
  const finalFat = recipeDetails?.nutrition?.nutrients
    ? (recipeDetails.nutrition.nutrients.find(n => n.name === 'Fat')?.amount || initialFat)
    : initialFat;

  console.log('Final nutrient values for calculations:', {
    source: nutrientSource,
    calories: finalCalories,
    protein: finalProtein,
    carbs: finalCarbs,
    fat: finalFat
  });

  // Calculate scaling factor
  const scalingFactor = isCountable
    ? (parseFloat(selectedServing) || 1) / defaultServingQty
    : (parseFloat(selectedServing) || 100) / defaultServingGrams;

  // Scaled nutrient values
  const scaledCalories = finalCalories * scalingFactor;
  const scaledProtein = finalProtein * scalingFactor;
  const scaledCarbs = finalCarbs * scalingFactor;
  const scaledFat = finalFat * scalingFactor;

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleLogMeal = async () => {
    if (!dailyWorkoutId) {
      console.error('No dailyWorkoutId provided');
      return;
    }

    try {
      // Fetch daily_meal_plan_id from DailyMealPlans
      const { data: mealPlan, error: fetchError } = await supabase
        .from('DailyMealPlans')
        .select('id')
        .eq('daily_workout_id', dailyWorkoutId)
        .single();

      if (fetchError || !mealPlan) {
        console.error('Error fetching meal plan:', fetchError?.message || 'No meal plan found');
        return;
      }

      // Prepare serving data
      const servingData = isCountable
        ? {
            serving_qty: parseFloat(selectedServing) || 1,
            original_serving_qty: defaultServingQty,
            serving_grams: null,
            original_serving_grams: null,
          }
        : {
            serving_qty: null,
            original_serving_qty: recipeDetails?.servings || null,
            serving_grams: parseFloat(selectedServing) || 100,
            original_serving_grams: defaultServingGrams,
          };

      console.log('Logging meal with:', {
        mealName,
        calories: scaledCalories,
        protein: scaledProtein,
        carbs: scaledCarbs,
        fat: scaledFat,
        serving: isCountable ? `${selectedServing} units` : `${selectedServing}g`,
        nutrientSource,
        servingSource: isCountable 
          ? (recipeDetails?.servings ? 'Spoonacular API (servings)' : servingQty && servingQty !== 'N/A' ? 'useLocalSearchParams (servingQty)' : 'fallback (1 unit)')
          : (recipeDetails?.extendedIngredients ? 'Spoonacular API (extendedIngredients)' : servingWeightGrams && servingWeightGrams !== 'N/A' ? 'useLocalSearchParams (servingWeightGrams)' : 'fallback (100g)')
      });

      // Insert meal into LoggedFood table
      const { error: insertError } = await supabase
      .from('LoggedFood')
      .insert({
        daily_meal_plan_id: mealPlan.id,
        name: mealName,
        calories: scaledCalories,
        protein: scaledProtein,
        carbs: scaledCarbs,
        fat: scaledFat,
        created_at: new Date().toISOString(),
        food_type: spoonacularId ? 'dish' : type, // Mark Spoonacular items as dishes
        ...servingData,
        spoonacular_id: spoonacularId ? parseInt(spoonacularId) : null,
      });

      if (insertError) {
        console.error('Error logging meal:', insertError.message);
        return;
      }

      router.back();
    } catch (error) {
      console.error('Error logging meal:', error);
    }
  };

  // Get default serving display text
  const getDefaultServingText = () => {
    if (isCountable) {
      return `Serving: ${defaultServingQty} ${defaultServingQty === 1 ? 'unit' : 'units'}`;
    }
    // For dishes (from Spoonacular)
    if (type === 'dish' && recipeDetails?.servings) {
      return `Serving: ${defaultServingGrams}g (${recipeDetails.servings} portion${recipeDetails.servings > 1 ? 's' : ''})`;
    }
    // For all other uncountable items
    return `Serving: 100g`;
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Food Details</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Food Name */}
        <Text style={styles.mealName}>{mealName}</Text>

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e45ea9" />
            <Text style={styles.loadingText}>Loading recipe details...</Text>
          </View>
        )}

        {/* Default Serving Size */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Default Serving Size</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{getDefaultServingText()}</Text>
          </View>
        </View>

        {/* Adjust Serving Size */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            Adjust Serving Size ({isCountable ? 'Units' : 'Grams'})
          </Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedServing}
              onValueChange={(itemValue: string) => setSelectedServing(itemValue)}
              style={styles.picker}
              dropdownIconColor="#e45ea9"
              mode="dropdown"
              prompt="Select serving size"
            >
              {servingSizes.map((serving, index) => (
                <Picker.Item key={index} label={serving} value={serving} style={styles.pickerItem} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Ingredients List (for dishes) */}
        {type === 'dish' && recipeDetails?.extendedIngredients && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <View style={styles.infoBox}>
              {recipeDetails.extendedIngredients.map((ingredient, index) => (
                <Text key={index} style={styles.infoText}>
                  - {ingredient.original}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Nutrient Breakdown */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Nutrition Information</Text>
          <View style={styles.nutrientCard}>
            <View style={[styles.nutrientRow, styles.nutrientRowFirst]}>
              <View style={styles.nutrientLabelContainer}>
                <MaterialCommunityIcons name="fire" size={18} color="#e45ea9" />
                <Text style={styles.nutrientLabel}>Calories:</Text>
              </View>
              <Text style={styles.nutrientValue}>{scaledCalories.toFixed(1)} kcal</Text>
            </View>
            <View style={styles.nutrientRow}>
              <View style={styles.nutrientLabelContainer}>
                <MaterialCommunityIcons name="food-drumstick" size={18} color="#4CAF50" />
                <Text style={styles.nutrientLabel}>Protein:</Text>
              </View>
              <Text style={styles.nutrientValue}>{scaledProtein.toFixed(1)} g</Text>
            </View>
            <View style={styles.nutrientRow}>
              <View style={styles.nutrientLabelContainer}>
                <MaterialCommunityIcons name="food-croissant" size={18} color="#2196F3" />
                <Text style={styles.nutrientLabel}>Carbs:</Text>
              </View>
              <Text style={styles.nutrientValue}>{scaledCarbs.toFixed(1)} g</Text>
            </View>
            <View style={[styles.nutrientRow, styles.nutrientRowLast]}>
              <View style={styles.nutrientLabelContainer}>
                <MaterialCommunityIcons name="food-steak" size={18} color="#FF9800" />
                <Text style={styles.nutrientLabel}>Fat:</Text>
              </View>
              <Text style={styles.nutrientValue}>{scaledFat.toFixed(1)} g</Text>
            </View>
          </View>
        </View>

        {/* Log Meal Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={handleLogMeal} 
            style={[styles.logButton, isLoading && styles.disabledButton]}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <Text style={styles.logButtonText}>Log Meal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollView: {
    flex: 1,
    marginTop: 80, // Space for fixed header
  },
  scrollContent: {
    padding: 20,
    paddingTop: 20, // Additional padding at top of content
    paddingBottom: 40,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Extra padding for iOS status bar
    backgroundColor: '#e45ea9',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
    textAlign: 'center',
    marginRight: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mealName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: 12,
    marginBottom: 15,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
    marginBottom: 5,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  picker: {
    width: '100%',
    height: 55,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
  },
  nutrientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  nutrientRowFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  nutrientRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  nutrientLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutrientLabel: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
    marginLeft: 8,
  },
  nutrientValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  logButton: {
    backgroundColor: '#e45ea9',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#e45ea9',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
});