import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { unifiedFoodSearch } from '@/services/unifiedFoodSearch';
import debounce from 'lodash/debounce';
import { fetchRecipesByNutrients } from '@/lib/spoonacular';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Nutrient {
  name: string;
  value: number;
  color: string;
  icon: string;
  dailyValue: number;
}

interface DonutChartProps {
  value: number;
  color: string;
  name: string;
  icon: string;
  dailyValue: number;
}

interface Section {
  type: string;
  data?: any;
}

export default function MealDetail() {
  const { meal, dailyWorkoutId, from } = useLocalSearchParams<{
    meal?: string;
    dailyWorkoutId?: string;
    from?: string;
  }>();
  const { user } = useUserAuth();
  const router = useRouter();
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [waterIntake, setWaterIntake] = useState<number | null>(null);
  const [dailyCalories, setDailyCalories] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSuggestedMeals, setHasSuggestedMeals] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchMealDetails = async () => {
      if (!user || !dailyWorkoutId) return;

      try {
        const { data: mealData, error: mealError } = await supabase
          .from('DailyMealPlans')
          .select('id, daily_calories, carbs_grams, protein_grams, fat_grams, water_litres, calories_intake')
          .eq('daily_workout_id', dailyWorkoutId)
          .single();

        if (mealError || !mealData) {
          console.error('Error fetching meal details:', mealError?.message || 'No meal data found');
          return;
        }

        setNutrients([
          { 
            name: 'Protein', 
            value: mealData.protein_grams, 
            color: '#4CAF50', 
            icon: 'food-drumstick',
            dailyValue: 150
          },
          { 
            name: 'Carbs', 
            value: mealData.carbs_grams, 
            color: '#2196F3', 
            icon: 'food-croissant',
            dailyValue: 300
          },
          { 
            name: 'Fat', 
            value: mealData.fat_grams, 
            color: '#FF9800', 
            icon: 'food-steak',
            dailyValue: 70
          },
        ]);

        setWaterIntake(mealData.water_litres || 0);
        setDailyCalories(mealData.daily_calories || 0);

        const { data: existingMeals, error: mealsError } = await supabase
          .from('Meals')
          .select('*')
          .eq('daily_meal_plan_id', mealData.id);

        if (mealsError) {
          console.error('Error checking for existing meals:', mealsError);
          return;
        }

        setHasSuggestedMeals(!!existingMeals?.length);
        
        console.log('Fetched meal details from DB:', {
          daily_calories: mealData.daily_calories,
          protein_grams: mealData.protein_grams,
          carbs_grams: mealData.carbs_grams,
          fat_grams: mealData.fat_grams,
          water_litres: mealData.water_litres
        });
      } catch (error) {
        console.error('Error fetching meal details:', error);
      }
    };

    fetchMealDetails();
  }, [user, dailyWorkoutId]);

  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.trim() === '') {
        setSuggestions([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await unifiedFoodSearch(query);
        setSuggestions(results);
      } catch (err) {
        setError('Failed to fetch suggestions. Please try again.');
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    fetchSuggestions(searchQuery);
    return () => {
      fetchSuggestions.cancel();
    };
  }, [searchQuery, fetchSuggestions]);

  const generateMealSuggestions = async () => {
    if (!dailyCalories || !nutrients.length || !dailyWorkoutId) {
      console.error('Missing required data for meal generation');
      setError('Missing required nutrition data');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('DailyMealPlans')
        .select('id')
        .eq('daily_workout_id', dailyWorkoutId)
        .single();

      if (mealPlanError || !mealPlan) {
        console.error('DailyMealPlan not found:', mealPlanError);
        setError('Could not find your meal plan. Please try again.');
        return;
      }

      const dailyMealPlanId = mealPlan.id;

      const mealTypes = [
        { type: 'breakfast', ratio: 0.3 },
        { type: 'lunch', ratio: 0.4 },
        { type: 'dinner', ratio: 0.3 },
      ];

      const dailyProtein = nutrients.find((n) => n.name === 'Protein')?.value || 0;
      const dailyCarbs = nutrients.find((n) => n.name === 'Carbs')?.value || 0;
      const dailyFat = nutrients.find((n) => n.name === 'Fat')?.value || 0;

      const { error: deleteError } = await supabase
        .from('Meals')
        .delete()
        .eq('daily_meal_plan_id', dailyMealPlanId);

      if (deleteError) {
        console.error('Error clearing existing meals:', deleteError);
        throw deleteError;
      }

      console.log('Daily Nutrition Totals:', {
        dailyCalories,
        dailyProtein,
        dailyCarbs,
        dailyFat
      });

      for (const { type, ratio } of mealTypes) {
        const targetCalories = Math.round(dailyCalories * ratio);
        const targetProtein = Math.round(dailyProtein * ratio);
        const targetCarbs = Math.round(dailyCarbs * ratio);
        const targetFat = Math.round(dailyFat * ratio);

        console.log(`Generating ${type} meals with ratio ${ratio}:`, {
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          queryParams: {
            minCalories: Math.round(targetCalories * 0.8),
            maxCalories: Math.round(targetCalories * 1.2),
            minProtein: Math.round(targetProtein * 0.8),
            maxProtein: Math.round(targetProtein * 1.2),
            minCarbs: Math.round(targetCarbs * 0.8),
            maxCarbs: Math.round(targetCarbs * 1.2),
            minFat: Math.round(targetFat * 0.8),
            maxFat: Math.round(targetFat * 1.2)
          }
        });

        try {
          const recipes = await fetchRecipesByNutrients({
            minCalories: Math.round(targetCalories * 0.8),
            maxCalories: Math.round(targetCalories * 1.2),
            minProtein: Math.round(targetProtein * 0.8),
            maxProtein: Math.round(targetProtein * 1.2),
            minCarbs: Math.round(targetCarbs * 0.8),
            maxCarbs: Math.round(targetCarbs * 1.2),
            minFat: Math.round(targetFat * 0.8),
            maxFat: Math.round(targetFat * 1.2),
            number: 3,
          });

          const insertPromises = recipes.map((recipe) =>
            supabase.from('Meals').insert({
              daily_meal_plan_id: dailyMealPlanId,
              name: recipe.title,
              calories: recipe.calories,
              protein: parseFloat(recipe.protein),
              carbs: parseFloat(recipe.carbs),
              fat: parseFloat(recipe.fat),
              meal_type: type,
              image: recipe.image,
              spoonacular_id: recipe.id,
            })
          );

          const results = await Promise.all(insertPromises);
          results.forEach(({ error }, index) => {
            if (error) {
              console.error(`Error saving ${type} meal ${recipes[index].title}:`, error);
            }
          });
        } catch (error) {
          console.error(`Error generating ${type} meals:`, error);
          setError('Failed to generate some meals. Others may still be available.');
        }
      }

      setHasSuggestedMeals(true);
      router.push({
        pathname: '/(screens)/SuggestedMeals',
        params: { dailyWorkoutId },
      });
    } catch (error) {
      console.error('Full meal generation failed:', error);
      setError('Failed to generate meal suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (from === 'home') {
      router.push('/(tabs)/Home');
    } else if (from === 'meals') {
      router.push('/(tabs)/Meals');
    } else {
      router.back();
    }
  };

  const handleViewSuggestedMeals = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hasSuggestedMeals) {
      router.push({
        pathname: '/(screens)/SuggestedMeals',
        params: { dailyWorkoutId },
      });
    } else {
      const { data: mealPlan, error } = await supabase
        .from('DailyMealPlans')
        .select('id')
        .eq('daily_workout_id', dailyWorkoutId)
        .single();

      if (!error && mealPlan) {
        const { data: existingMeals, error: mealsError } = await supabase
          .from('Meals')
          .select('*')
          .eq('daily_meal_plan_id', mealPlan.id);

        if (!mealsError && !existingMeals?.length) {
          await generateMealSuggestions();
        }
      }
    }
  };

  const handleViewLoggedFood = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/LoggedFood',
      params: { dailyWorkoutId, from: 'mealDetail' },
    });
  };

  const DonutChart: React.FC<DonutChartProps> = ({ value, color, name, icon, dailyValue }) => {
    const dynamicSize = SCREEN_WIDTH * 0.25;
    const strokeWidth = dynamicSize * 0.1;
    const radius = (dynamicSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(value / dailyValue, 1);
    const strokeDashoffset = circumference * (1 - percentage);
    const progressText = `${Math.round(percentage * 100)}%`;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
          <Text style={[styles.categoryText, { color }]}>{name}</Text>
        </View>
        <Svg width={dynamicSize} height={dynamicSize} style={styles.chartSvg}>
          <Circle
            cx={dynamicSize / 2}
            cy={dynamicSize / 2}
            r={radius}
            stroke="#F5F5F5"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={dynamicSize / 2}
            cy={dynamicSize / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            rotation={-90}
            originX={dynamicSize / 2}
            originY={dynamicSize / 2}
            strokeLinecap="round"
          />
          <SvgText
            x={dynamicSize / 2}
            y={dynamicSize / 2 - 10}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={dynamicSize * 0.12}
            fontWeight="bold"
            fill={color}
          >
            {progressText}
          </SvgText>
          <SvgText
            x={dynamicSize / 2}
            y={dynamicSize / 2 + 15}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={dynamicSize * 0.06}
            fill="#666"
          >
            {`${value}g`}
          </SvgText>
        </Svg>
        <View style={styles.nutrientInfo}>
          <Text style={styles.nutrientTarget}>{`of ${dailyValue}g daily`}</Text>
        </View>
      </View>
    );
  };

  const NutrientCard = ({ nutrient }: { nutrient: Nutrient }) => {
    return (
      <View style={[styles.nutrientCard, { borderLeftColor: nutrient.color }]}>
        <View style={styles.nutrientHeader}>
          <MaterialCommunityIcons 
            name={nutrient.icon} 
            size={24} 
            color={nutrient.color} 
            style={styles.nutrientIcon}
          />
          <Text style={[styles.nutrientName, { color: nutrient.color }]}>{nutrient.name}</Text>
        </View>
        <View style={styles.nutrientDetails}>
          <Text style={styles.nutrientAmount}>{nutrient.value.toFixed(1)}g</Text>
          <Text style={styles.nutrientDaily}>Daily: {nutrient.dailyValue}g</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: `${nutrient.color}20` }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${Math.min((nutrient.value / nutrient.dailyValue) * 100, 100)}%`,
                  backgroundColor: nutrient.color
                }
              ]}
            />
          </View>
          <Text style={styles.progressPercentage}>
            {Math.round((nutrient.value / nutrient.dailyValue) * 100)}%
          </Text>
        </View>
      </View>
    );
  };

  const sections: Section[] = [
    { type: 'header' },
    { type: 'dayBar' },
    { type: 'image' },
    { type: 'search' },
    { type: 'suggestions', data: suggestions },
    { type: 'caloriesTitle' },
    { type: 'calories' },
    { type: 'nutrientsTitle' },
    { type: 'nutrients', data: nutrients },
    { type: 'water' },
    { type: 'suggestedMealsButton' },
    { type: 'viewLoggedFoodButton' },
  ];

  const renderItem = ({ item }: { item: Section }) => {
    switch (item.type) {
      // case 'header':
      //   return (
      //     <Animated.View
      //       style={[
      //         styles.headerContainer,
      //         {
      //           opacity: fadeAnim,
      //           transform: [{ translateY: slideAnim }],
      //         },
      //       ]}
      //     >
      //       <TouchableOpacity 
      //         onPress={handleBackPress} 
      //         style={styles.backButton}
      //       >
      //         <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
      //       </TouchableOpacity>
      //       <Text style={styles.headerText}>Meal Details</Text>
      //     </Animated.View>
      //   );

      case 'dayBar':
        return (
          <View style={styles.dayBar}>
            <MaterialCommunityIcons name="food" size={SCREEN_WIDTH * 0.06} color="#fff" />
            <Text style={styles.dayText}>{meal || 'Meal Plan'}</Text>
          </View>
        );

      // case 'image':
      //   return (
      //     <View style={styles.imageContainer}>
      //       {meal ? (
      //         <Image
      //           source={{
      //             uri:
      //               meal.toLowerCase().includes('breakfast')
      //                 ? 'https://www.eatingwell.com/thmb/6qV3L2rMH3x0fmhC5v7q7b1qNhQ=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/healthy-breakfast-meal-prep-ideas-8410938-2000-1c9bded7aead4b41944dcff66e0c5c73.jpg'
      //                 : meal.toLowerCase().includes('lunch')
      //                 ? 'https://www.eatingwell.com/thmb/2mI0bU5gVTLTdQhQQs3M3rZfHrc=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/chicken-fajita-bowls-9c6bd6e9fd184bfdb1d133c4f6a9f1d0.jpg'
      //                 : meal.toLowerCase().includes('dinner')
      //                 ? 'https://www.eatingwell.com/thmb/JqLZTzvo0oXU-Rtw9kN8fO7bOQk=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/healthy-dinner-recipes-for-weight-loss-8410228-2000-1c9bded7aead4b41944dcff66e0c5c73.jpg'
      //                 : 'https://hips.hearstapps.com/hmg-prod/images/healthy-food-clean-eating-selection-royalty-free-image-1473909894.jpg',
      //           }}
      //           style={styles.image}
      //           resizeMode="cover"
      //           onError={(e) => console.log('Image failed to load:', e.nativeEvent.error)}
      //         />
      //       ) : (
      //         <View style={[styles.image, styles.imagePlaceholder]}>
      //           <MaterialCommunityIcons name="food" size={SCREEN_WIDTH * 0.1} color="#ccc" />
      //         </View>
      //       )}
      //     </View>
      //   );

      case 'search':
        return (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <MaterialCommunityIcons name="magnify" size={SCREEN_WIDTH * 0.05} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search foods (e.g., apple)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          </View>
        );

      case 'suggestions':
        return (
          <View style={styles.suggestionsContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#e45ea9" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            {error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={SCREEN_WIDTH * 0.05} color="#ff4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!isLoading && !error && item.data.length > 0 && (
              <FlatList
                data={item.data}
                renderItem={({ item: suggestion }: { item: any }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      try {
                        await supabase.from('LoggedFood').insert({
                          daily_meal_plan_id: dailyWorkoutId,
                          name: suggestion.name,
                          calories: suggestion.calories,
                          protein: suggestion.protein,
                          carbs: suggestion.carbs,
                          fat: suggestion.fat,
                          created_at: new Date().toISOString(),
                        });
                      } catch (err) {
                        console.error('Error logging food:', err);
                      }

                      router.push({
                        pathname: '/(screens)/MealDetails2',
                        params: {
                          mealName: suggestion.name,
                          calories: suggestion.calories.toString(),
                          protein: suggestion.protein.toString(),
                          carbs: suggestion.carbs.toString(),
                          fat: suggestion.fat.toString(),
                          servingQty: suggestion.servingQty?.toString() ?? 'N/A',
                          servingWeightGrams: suggestion.servingWeightGrams?.toString() ?? 'N/A',
                          type: suggestion.type,
                          dailyWorkoutId: dailyWorkoutId,
                          image: suggestion.image || '',
                        },
                      });
                      setSearchQuery(suggestion.name);
                      setSuggestions([]);
                    }}
                  >
                    <MaterialCommunityIcons name="food-apple" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
                    <Text style={styles.suggestionText}>
                      {suggestion.name} ({suggestion.type})
                    </Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                style={styles.suggestionsList}
              />
            )}
          </View>
        );

      case 'caloriesTitle':
        return <Text style={styles.sectionTitle}>Daily Calorie Goal</Text>;

      case 'calories':
        return (
          <View style={styles.caloriesContainer}>
            <MaterialCommunityIcons name="fire" size={SCREEN_WIDTH * 0.06} color="#FF7043" />
            <View style={styles.caloriesTextContainer}>
              <Text style={styles.caloriesTitleText}>Calories to Gain</Text>
              <Text style={styles.caloriesAmount}>
                {dailyCalories !== null ? `${dailyCalories.toFixed(0)} kcal` : 'Not available'}
              </Text>
            </View>
          </View>
        );

      case 'nutrientsTitle':
        return <Text style={styles.sectionTitle}>Nutrient Breakdown</Text>;

      case 'nutrients':
        if (item.data.length === 0) return null;
        return (
          <View style={styles.nutrientsSection}>
            <Text style={styles.nutrientsTitle}>Macronutrients Breakdown</Text>
            <Text style={styles.nutrientsSubtitle}>Your daily macronutrient targets</Text>
            
            <View style={styles.nutrientsGrid}>
              {item.data.map((nutrient: Nutrient) => (
                <NutrientCard key={nutrient.name} nutrient={nutrient} />
              ))}
            </View>
          </View>
        );

      case 'water':
        return (
          <View style={styles.waterContainer}>
            <MaterialCommunityIcons name="cup-water" size={SCREEN_WIDTH * 0.06} color="#5bc6ff" />
            <View style={styles.waterTextContainer}>
              <Text style={styles.waterTitle}>Recommended Water Intake</Text>
              <Text style={styles.waterAmount}>
                {waterIntake !== null ? `${waterIntake.toFixed(2)} Litres` : 'Not available'}
              </Text>
            </View>
          </View>
        );

      case 'suggestedMealsButton':
        return (
          <TouchableOpacity
            style={[styles.suggestedMealsButton, isLoading && styles.disabledButton]}
            onPress={handleViewSuggestedMeals}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.suggestedMealsButtonText}>
                {hasSuggestedMeals ? 'View Suggested Meals' : 'Generate Suggested Meals'}
              </Text>
            )}
          </TouchableOpacity>
        );

      case 'viewLoggedFoodButton':
        return (
          <TouchableOpacity
            style={styles.viewLoggedFoodButton}
            onPress={handleViewLoggedFood}
          >
            <Text style={styles.viewLoggedFoodButtonText}>View Logged Food</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  // In the return statement of MealDetail.tsx
  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Meal Details</Text>
      </Animated.View>

      {/* Scrollable Content */}
      <FlatList
        data={sections.filter(section => section.type !== 'header')} // Remove header from sections
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        contentContainerStyle={[styles.scrollContainer, { paddingTop: SCREEN_HEIGHT * 0.12 }]} // Add padding for header
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_WIDTH * 0.043,
    paddingVertical: SCREEN_HEIGHT * 0.02,
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
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dayBar: {
    backgroundColor: '#e45ea9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.02,    
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    marginVertical: SCREEN_HEIGHT * 0.015,
    marginTop: -60,
  },
  dayText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  imageContainer: {
    width: '100%',
    height: SCREEN_WIDTH * 0.5,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: SCREEN_HEIGHT * 0.015,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    width: '100%',
    marginVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: SCREEN_WIDTH * 0.03,
  },
  searchInput: {
    flex: 1,
    height: SCREEN_HEIGHT * 0.06,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    paddingHorizontal: SCREEN_WIDTH * 0.03,
  },
  suggestionsContainer: {
    width: '100%',
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: SCREEN_HEIGHT * 0.3,
    borderRadius: 10,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    backgroundColor: '#fff',
    marginTop: SCREEN_HEIGHT * 0.005,
    marginBottom: SCREEN_HEIGHT * 0.01,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.03,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginTop: SCREEN_HEIGHT * 0.005,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  loadingText: {
    marginLeft: SCREEN_WIDTH * 0.02,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.03,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    marginTop: SCREEN_HEIGHT * 0.005,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  errorText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#ff4444',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: SCREEN_WIDTH * 0.03,
    marginVertical: SCREEN_HEIGHT * 0.015,    
    marginHorizontal: SCREEN_WIDTH * 0.04,
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginVertical: SCREEN_HEIGHT * 0.015,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  caloriesTextContainer: {
    flex: 1,
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  caloriesTitleText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#FF7043',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  caloriesAmount: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
  },
  nutrientsSection: {
    marginVertical: SCREEN_HEIGHT * 0.02,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SCREEN_WIDTH * 0.04,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  nutrientsTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  nutrientsSubtitle: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  nutrientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutrientCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  nutrientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nutrientIcon: {
    marginRight: 8,
  },
  nutrientName: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
  },
  nutrientDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nutrientAmount: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: 'bold',
    color: '#333',
  },
  nutrientDaily: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    color: '#333',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: SCREEN_HEIGHT * 0.01,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartSvg: {
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  categoryText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginLeft: 5,
  },
  nutrientInfo: {
    marginTop: 8,
  },
  nutrientTarget: {
    fontSize: SCREEN_WIDTH * 0.03,
    color: '#888',
    textAlign: 'center',
  },
  waterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginVertical: SCREEN_HEIGHT * 0.015,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  waterTextContainer: {
    flex: 1,
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  waterTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#5bc6ff',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  waterAmount: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
  },
  suggestedMealsButton: {
    backgroundColor: 'orange',
    paddingVertical: SCREEN_HEIGHT * 0.02,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: SCREEN_HEIGHT * 0.01,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'brown',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  suggestedMealsButtonText: {
    color: 'black',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  viewLoggedFoodButton: {
    backgroundColor: '#c8a2c8',
    paddingVertical: SCREEN_HEIGHT * 0.02,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: SCREEN_HEIGHT * 0.01,
    borderWidth: 2,
    borderColor: 'purple',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  viewLoggedFoodButtonText: {
    color: 'black',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});