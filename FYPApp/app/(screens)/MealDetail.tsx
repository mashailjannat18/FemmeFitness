import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { unifiedFoodSearch } from '@/services/unifiedFoodSearch';
import debounce from 'lodash/debounce';

const { width } = Dimensions.get('window');

interface Nutrient {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  value: number;
  color: string;
  name: string;
}

export default function MealDetail() {
  const { meal, dailyWorkoutId, from } = useLocalSearchParams<{ meal?: string; dailyWorkoutId?: string; from?: string }>();
  const { user } = useUserAuth();
  const router = useRouter();
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [waterIntake, setWaterIntake] = useState<number | null>(null);
  const [dailyCalories, setDailyCalories] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMealDetails = async () => {
      if (!user || !dailyWorkoutId) {
        console.error('No user logged in or dailyWorkoutId parameter missing');
        return;
      }

      try {
        const { data: mealData, error: mealError } = await supabase
          .from('DailyMealPlans')
          .select('daily_calories, carbs_grams, protein_grams, fat_grams, water_litres, calories_intake')
          .eq('daily_workout_id', dailyWorkoutId)
          .single();

        if (mealError || !mealData) {
          console.error('Error fetching meal details:', mealError?.message || 'No meal data found for this daily workout');
          return;
        }

        setNutrients([
          { name: 'Protein', value: mealData.protein_grams, color: '#8e44ad' },
          { name: 'Carbs', value: mealData.carbs_grams, color: '#e67e22' },
          { name: 'Fat', value: mealData.fat_grams, color: '#16a085' },
        ]);

        setWaterIntake(mealData.water_litres || 0);
        setDailyCalories(mealData.daily_calories || 0);
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

  const handleBackPress = () => {
    if (from === 'home') {
      router.push('../(tabs)/Home');
    } else if (from === 'meals') {
      router.push('../(tabs)/Meals');
    }
  };

  const DonutChart: React.FC<DonutChartProps> = ({ value, color, name }) => {
    const radius = 60;
    const strokeWidth = 12;
    const circumference = 2 * Math.PI * radius;
    const percentage = value / (value + 100);
    const strokeDashoffset = circumference * (1 - percentage);
    const svgSize = 140;

    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.categoryText, { color }]}>{name}</Text>
        <Svg width={svgSize} height={svgSize} style={styles.chartSvg}>
          <Circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke="#e0e0e0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            rotation={-90}
            originX={svgSize / 2}
            originY={svgSize / 2}
          />
          <SvgText
            x={svgSize / 2}
            y={svgSize / 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="18"
            fill="#333"
          >
            {`${value.toFixed(1)}g`}
          </SvgText>
        </Svg>
      </View>
    );
  };

  const sections = [
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
  ];

  const renderItem = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleBackPress}>
              <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
            </TouchableOpacity>
            <Text style={styles.headerText}>Meal Details</Text>
          </View>
        );

      case 'dayBar':
        return (
          <View style={styles.dayBar}>
            <Text style={styles.dayText}>{meal}</Text>
          </View>
        );

      case 'image':
        return (
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri: 'https://hips.hearstapps.com/hmg-prod/images/home-workout-lead-1584370797.jpg?crop=1xw:0.9997037914691943xh;center,top',
              }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        );

      case 'search':
        return (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods (e.g., apple)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        );

      case 'suggestions':
        return (
          <View style={styles.suggestionsContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#999" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!isLoading && !error && item.data.length > 0 && (
              <FlatList
                data={item.data}
                renderItem={({ item: suggestion }: { item: any }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => {
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
                        },
                      });
                      setSearchQuery(suggestion.name);
                      setSuggestions([]);
                    }}
                  >
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
        return (
          <Text style={styles.caloriesTitle}>Daily Calorie Goal</Text>
        );

      case 'calories':
        return (
          <View style={styles.caloriesContainer}>
            <View style={styles.caloriesIconWrapper}>
              <MaterialIcons name="local-fire-department" size={30} color="#FF4500" />
            </View>
            <View style={styles.caloriesTextContainer}>
              <Text style={styles.caloriesTitleText}>Calories to Gain</Text>
              <Text style={styles.caloriesAmount}>
                {dailyCalories !== null ? `${dailyCalories.toFixed(0)} kcal` : 'Not available'}
              </Text>
            </View>
          </View>
        );

      case 'nutrientsTitle':
        return (
          <Text style={styles.nutrientsTitle}>Nutrient Breakdown</Text>
        );

      case 'nutrients':
        if (item.data.length === 0) return null;
        return (
          <View style={styles.chartRow}>
            {item.data.map((nutrient: Nutrient) => (
              <DonutChart
                key={nutrient.name}
                value={nutrient.value}
                color={nutrient.color}
                name={nutrient.name}
              />
            ))}
          </View>
        );

      case 'water':
        return (
          <View style={styles.waterContainer}>
            <View style={styles.waterIconWrapper}>
              <MaterialIcons name="local-drink" size={30} color="#1e90ff" />
            </View>
            <View style={styles.waterTextContainer}>
              <Text style={styles.waterTitle}>Recommended Water Intake</Text>
              <Text style={styles.waterAmount}>
                {waterIntake !== null ? `${waterIntake.toFixed(2)} Litres` : 'Not available'}
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <FlatList
      data={sections}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.type}-${index}`}
      contentContainerStyle={styles.scrollContainer}
    />
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingBottom: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    position: 'fixed',
  },
  headerText: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF69B4',
    textAlign: 'center',
  },
  dayBar: {
    backgroundColor: '#f06292',
    width: width,
    paddingVertical: 20,
    alignItems: 'center',
  },
  dayText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  imageContainer: {
    marginVertical: 10,
    width: width * 0.9,
    height: width * 0.6,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  searchContainer: {
    width: width * 0.9,
    marginVertical: 10,
    alignSelf: 'center',
  },
  searchInput: {
    height: 60,
    borderColor: '#ddd',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  suggestionsContainer: {
    width: width * 0.9,
    alignSelf: 'center',
    zIndex: 1000, 
  },
  suggestionsList: {
    maxHeight: 495,
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
    backgroundColor: '#fff',
    marginTop: 0,
    zIndex: 1000, 
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 48,
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
    marginTop: 0,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#999',
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
    marginTop: 0,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
  },
  caloriesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#444',
    alignSelf: 'flex-start',
    marginLeft: width * 0.05,
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5ee',
    borderRadius: 10,
    padding: 15,
    marginVertical: 15,
    width: width * 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  caloriesIconWrapper: {
    marginRight: 15,
  },
  caloriesTextContainer: {
    flex: 1,
  },
  caloriesTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF4500',
    marginBottom: 5,
  },
  caloriesAmount: {
    fontSize: 16,
    color: '#333',
  },
  nutrientsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#444',
    alignSelf: 'flex-start',
    marginLeft: width * 0.05,
  },
  chartRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: width * 0.9,
    marginTop: 10,
    alignSelf: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    margin: 10,
  },
  chartSvg: {
    marginTop: 10,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  waterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 10,
    padding: 15,
    marginVertical: 15,
    width: width * 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
  },
  waterIconWrapper: {
    marginRight: 15,
  },
  waterTextContainer: {
    flex: 1,
  },
  waterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e90ff',
    marginBottom: 5,
  },
  waterAmount: {
    fontSize: 16,
    color: '#333',
  },
});