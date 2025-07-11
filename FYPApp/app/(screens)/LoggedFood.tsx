import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LoggedFood {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  food_type: 'ingredient' | 'dish';
  serving_qty: number | null;
  serving_grams: number | null;
  original_serving_qty: number | null;
  original_serving_grams: number | null;
}

export default function LoggedFood() {
  const { dailyWorkoutId } = useLocalSearchParams<{ dailyWorkoutId?: string }>();
  const { user } = useUserAuth();
  const router = useRouter();
  const [foods, setFoods] = useState<LoggedFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  useEffect(() => {
    const fetchLoggedFood = async () => {
      if (!user || !dailyWorkoutId) {
        setError('User or daily workout ID missing');
        setLoading(false);
        return;
      }

      try {
        // Fetch daily_meal_plan_id from DailyMealPlans
        const { data: mealPlan, error: mealPlanError } = await supabase
          .from('DailyMealPlans')
          .select('id')
          .eq('daily_workout_id', dailyWorkoutId)
          .single();

        if (mealPlanError || !mealPlan) {
          throw new Error('Meal plan not found: ' + (mealPlanError?.message || 'No data'));
        }

        // Fetch all logged foods for the meal plan
        const { data, error } = await supabase
          .from('LoggedFood')
          .select('*')
          .eq('daily_meal_plan_id', mealPlan.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setFoods(data || []);
        
        // Calculate totals
        if (data && data.length > 0) {
          const calculatedTotals = data.reduce((acc, food) => ({
            calories: acc.calories + food.calories,
            protein: acc.protein + food.protein,
            carbs: acc.carbs + food.carbs,
            fat: acc.fat + food.fat
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
          
          setTotals(calculatedTotals);
        }
      } catch (err) {
        console.error('Error fetching logged food:', err);
        setError('Failed to load logged food. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchLoggedFood();
  }, [user, dailyWorkoutId]);

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCountable = (food: LoggedFood) => {
    if (food.food_type === 'dish') return false;
    const countableIngredients = ['apple', 'mango', 'banana', 'egg', 'orange', 'potato', 'carrot'];
    return countableIngredients.some(item => food.name.toLowerCase().includes(item));
  };

  const renderFoodCard = ({ item }: { item: LoggedFood }) => (
    <View style={styles.foodCard}>
      <View style={styles.foodHeader}>
        <View style={[
          styles.foodTypeIndicator,
          { 
            backgroundColor: item.food_type === 'dish' ? '#e45ea9' : '#4CAF50',
            borderColor: item.food_type === 'dish' ? '#c13584' : '#388E3C'
          }
        ]}>
          <Text style={[
            styles.foodTypeText,
            { color: item.food_type === 'dish' ? '#fff' : '#fff' }
          ]}>
            {item.food_type === 'dish' ? 'Dish' : 'Ingredient'}
          </Text>
        </View>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodTime}>{formatTime(item.created_at)}</Text>
      </View>
      
      {/* Simplified Serving Information */}
      <View style={styles.servingInfo}>
        {isCountable(item) ? (
          <Text style={styles.servingText}>
            {item.serving_qty} {item.serving_qty === 1 ? 'unit' : 'units'}
          </Text>
        ) : (
          <Text style={styles.servingText}>
            {item.serving_grams}g
            {item.food_type === 'dish' && item.original_serving_qty && (
              <Text style={styles.servingDetail}>
                {' '}({item.original_serving_qty} portion{item.original_serving_qty > 1 ? 's' : ''})
              </Text>
            )}
          </Text>
        )}
      </View>
      
      {/* Macros */}
      <View style={styles.macrosContainer}>
        <View style={styles.macroItem}>
          <MaterialCommunityIcons name="fire" size={16} color="#e45ea9" />
          <Text style={styles.macroValue}>{item.calories.toFixed(0)}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={styles.macroItem}>
          <MaterialCommunityIcons name="food-drumstick" size={16} color="#4CAF50" />
          <Text style={styles.macroValue}>{item.protein.toFixed(1)}</Text>
          <Text style={styles.macroLabel}>P</Text>
        </View>
        <View style={styles.macroItem}>
          <MaterialCommunityIcons name="food-croissant" size={16} color="#2196F3" />
          <Text style={styles.macroValue}>{item.carbs.toFixed(1)}</Text>
          <Text style={styles.macroLabel}>C</Text>
        </View>
        <View style={styles.macroItem}>
          <MaterialCommunityIcons name="food-steak" size={16} color="#FF9800" />
          <Text style={styles.macroValue}>{item.fat.toFixed(1)}</Text>
          <Text style={styles.macroLabel}>F</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Today's Food Log</Text>
      </View>

      {/* Totals Card */}
      {foods.length > 0 && (
        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Daily Totals</Text>
          <View style={styles.totalsRow}>
            <View style={styles.macroCircle}>
              <Text style={styles.macroValue}>{totals.calories.toFixed(0)}</Text>
              <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroCircle}>
              <Text style={styles.macroValue}>{totals.protein.toFixed(1)}</Text>
              <Text style={styles.macroLabel}>protein</Text>
            </View>
            <View style={styles.macroCircle}>
              <Text style={styles.macroValue}>{totals.carbs.toFixed(1)}</Text>
              <Text style={styles.macroLabel}>carbs</Text>
            </View>
            <View style={styles.macroCircle}>
              <Text style={styles.macroValue}>{totals.fat.toFixed(1)}</Text>
              <Text style={styles.macroLabel}>fat</Text>
            </View>
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e45ea9" />
          <Text style={styles.loadingText}>Loading your food log...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : foods.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="food-off" size={50} color="#ccc" />
          <Text style={styles.emptyText}>No food logged yet today</Text>
        </View>
      ) : (
        <FlatList
          data={foods}
          renderItem={renderFoodCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
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
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  addButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  title: {
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
  totalsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  totalsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: (SCREEN_WIDTH - 96) / 4,
    height: (SCREEN_WIDTH - 96) / 4,
    borderRadius: (SCREEN_WIDTH - 96) / 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    padding: 20,
  },
  addFoodButton: {
    marginTop: 24,
    backgroundColor: '#e45ea9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  addFoodButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  foodCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodTypeIndicator: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  foodTypeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  foodTime: {
    fontSize: 12,
    color: '#999',
  },
  servingInfo: {
    marginBottom: 12,
  },
  servingText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  servingDetail: {
    fontSize: 12,
    color: '#888',
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    marginRight: 2,
  },
  macroLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});