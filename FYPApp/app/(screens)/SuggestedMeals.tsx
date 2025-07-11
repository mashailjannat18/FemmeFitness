import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Meal {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  image: string;
  spoonacular_id?: number;
}

export default function SuggestedMeals() {
  const { dailyWorkoutId } = useLocalSearchParams<{ dailyWorkoutId?: string }>();
  const { user } = useUserAuth();
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedMeals, setGroupedMeals] = useState<Record<string, Meal[]>>({});
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

  const fetchDailyMeals = async () => {
    if (!user || !dailyWorkoutId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('DailyMealPlans')
        .select('id')
        .eq('daily_workout_id', dailyWorkoutId)
        .single();

      if (mealPlanError || !mealPlan) {
        throw new Error('Could not find meal plan for this workout');
      }

      const { data, error } = await supabase
        .from('Meals')
        .select('*')
        .eq('daily_meal_plan_id', mealPlan.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMeals(data || []);

      const grouped = (data || []).reduce((acc: Record<string, Meal[]>, meal) => {
        const type = meal.meal_type.toLowerCase();
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(meal);
        return acc;
      }, {} as Record<string, Meal[]>);

      setGroupedMeals(grouped);
    } catch (err) {
      console.error('Error fetching meals:', err);
      setError(err.message || 'Failed to load meals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyMeals();
  }, [user, dailyWorkoutId]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDailyMeals();
  };

  const handleMealPress = (meal: Meal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(screens)/MealDetails2',
      params: {
        mealName: meal.name,
        calories: meal.calories.toString(),
        protein: meal.protein.toString(),
        carbs: meal.carbs.toString(),
        fat: meal.fat.toString(),
        dailyWorkoutId: dailyWorkoutId,
        image: meal.image || '',
        from: 'suggested',
        spoonacularId: meal.spoonacular_id?.toString() || '',
      },
    });
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const renderMealItem = ({ item }: { item: Meal }) => (
    <TouchableOpacity
      style={styles.mealCard}
      onPress={() => handleMealPress(item)}
      activeOpacity={0.8}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.mealImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.mealImage, styles.mealImagePlaceholder]}>
          <MaterialCommunityIcons name="food" size={SCREEN_WIDTH * 0.1} color="#ccc" />
        </View>
      )}
      <View style={styles.mealInfo}>
        <Text style={styles.mealName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.macroContainer}>
          <View style={styles.macroRow}>
            <MaterialCommunityIcons name="fire" size={SCREEN_WIDTH * 0.04} color="#FF7043" />
            <Text style={styles.macroText}>{item.calories.toFixed(0)} kcal</Text>
          </View>
          <View style={styles.macroRow}>
            <MaterialCommunityIcons name="dumbbell" size={SCREEN_WIDTH * 0.04} color="#2196F3" />
            <Text style={styles.macroText}>{item.protein.toFixed(1)}g</Text>
          </View>
          <View style={styles.macroRow}>
            <MaterialCommunityIcons name="bread-slice" size={SCREEN_WIDTH * 0.04} color="#8BC34A" />
            <Text style={styles.macroText}>{item.carbs.toFixed(1)}g</Text>
          </View>
          <View style={styles.macroRow}>
            <MaterialCommunityIcons name="food-steak" size={SCREEN_WIDTH * 0.04} color="#795548" />
            <Text style={styles.macroText}>{item.fat.toFixed(1)}g</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMealGroup = (mealType: string, meals: Meal[]) => {
    return (
      <Animated.View
        key={mealType}
        style={[
          styles.mealGroup,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.mealTypeHeader}>
          <MaterialCommunityIcons
            name={
              mealType === 'breakfast'
                ? 'food-croissant'
                : mealType === 'lunch'
                ? 'food-turkey'
                : mealType === 'dinner'
                ? 'food-variant'
                : 'food'
            }
            size={SCREEN_WIDTH * 0.06}
            color="#e45ea9"
          />
          <Text style={styles.mealTypeTitle}>
            {mealType.charAt(0).toUpperCase() + mealType.slice(1)} ({meals.length})
          </Text>
        </View>
        <FlatList
          data={meals}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={renderMealItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.mealList}
        />
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Suggested Meals</Text>
          <View style={{ width: SCREEN_WIDTH * 0.06 }} />
        </Animated.View>
        <Animated.View
          style={[
            styles.stateContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ActivityIndicator size="large" color="#e45ea9" />
          <Text style={styles.stateText}>Loading your meals...</Text>
        </Animated.View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Suggested Meals</Text>
          <View style={{ width: SCREEN_WIDTH * 0.06 }} />
        </Animated.View>
        <Animated.View
          style={[
            styles.stateContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={SCREEN_WIDTH * 0.12} color="#ff4444" />
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
            <MaterialCommunityIcons
              name="refresh"
              size={SCREEN_WIDTH * 0.05}
              color="#fff"
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (meals.length === 0) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Suggested Meals</Text>
          <View style={{ width: SCREEN_WIDTH * 0.06 }} />
        </Animated.View>
        <Animated.View
          style={[
            styles.stateContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <MaterialCommunityIcons name="food-off" size={SCREEN_WIDTH * 0.12} color="#ccc" />
          <Text style={styles.stateText}>No suggested meals found</Text>
          <Text style={styles.stateSubtext}>
            Generate meals from the meal details page
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Suggested Meals</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      <FlatList
        data={Object.entries(groupedMeals)}
        renderItem={({ item: [mealType, meals] }) => renderMealGroup(mealType, meals)}
        keyExtractor={([mealType]) => mealType}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={<View style={styles.listFooter} />}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_WIDTH * 0.04,
    paddingTop: SCREEN_WIDTH * 0.06,
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
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  listContent: {
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  listHeader: {
    height: SCREEN_WIDTH * 0.04,
  },
  listFooter: {
    height: SCREEN_WIDTH * 0.04,
  },
  mealGroup: {
    marginBottom: SCREEN_WIDTH * 0.06,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  mealTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH * 0.03,
  },
  mealTypeTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    marginLeft: SCREEN_WIDTH * 0.03,
  },
  mealList: {
    paddingHorizontal: SCREEN_WIDTH * 0.01,
  },
  mealCard: {
    width: SCREEN_WIDTH * 0.5,
    marginHorizontal: SCREEN_WIDTH * 0.02,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  mealImage: {
    width: '100%',
    height: SCREEN_WIDTH * 0.3,
  },
  mealImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    padding: SCREEN_WIDTH * 0.03,
  },
  mealName: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_WIDTH * 0.02,
    height: SCREEN_WIDTH * 0.1,
  },
  macroContainer: {
    marginTop: SCREEN_WIDTH * 0.01,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH * 0.015,
  },
  macroText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#555',
    fontWeight: '500',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.04,
  },
  stateText: {
    marginTop: SCREEN_WIDTH * 0.04,
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#555',
    textAlign: 'center',
  },
  stateSubtext: {
    marginTop: SCREEN_WIDTH * 0.02,
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SCREEN_WIDTH * 0.04,
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_WIDTH * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.06,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginRight: SCREEN_WIDTH * 0.02,
  },
});