import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';

export default function RecipeDetail() {
  const { dailyWorkoutId, mealId, from } = useLocalSearchParams<{
    dailyWorkoutId?: string;
    mealId?: string;
    from?: string;
  }>();
  const router = useRouter();
  const [meal, setMeal] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMealDetails = async () => {
      if (!dailyWorkoutId || !mealId) {
        console.error('Missing dailyWorkoutId or mealId parameter');
        setError('Missing required parameters.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from('Meals')
          .select('*')
          .eq('id', mealId)
          .eq('daily_meal_plan_id', dailyWorkoutId)
          .single();

        if (fetchError || !data) {
          console.error('Error fetching meal details:', fetchError?.message || 'Meal not found');
          setError('Failed to load meal details.');
        } else {
          setMeal(data);
        }
      } catch (error) {
        console.error('Error fetching meal details:', error);
        setError('An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMealDetails();
  }, [dailyWorkoutId, mealId]);

  const handleBackPress = () => {
    if (from === 'suggestedMeals') {
      router.push('../(screens)/SuggestedMeals');
    } else {
      router.push('../(tabs)/Meals');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF69B4" />
      </View>
    );
  }

  if (error || !meal) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Meal not found.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={24} color="#FF69B4" />
        </TouchableOpacity>
        <Text style={styles.headerText}>{meal.name}</Text>
      </View>

      {meal.image && (
        <Image
          source={{ uri: meal.image }}
          style={styles.image}
          resizeMode="cover"
          onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
        />
      )}

      <View style={styles.detailsContainer}>
        <Text style={styles.mealType}>Meal Type: {meal.meal_type}</Text>
        <View style={styles.nutrientRow}>
          <Text style={styles.nutrientLabel}>Calories:</Text>
          <Text style={styles.nutrientValue}>{meal.calories} kcal</Text>
        </View>
        <View style={styles.nutrientRow}>
          <Text style={styles.nutrientLabel}>Protein:</Text>
          <Text style={styles.nutrientValue}>{meal.protein}g</Text>
        </View>
        <View style={styles.nutrientRow}>
          <Text style={styles.nutrientLabel}>Carbs:</Text>
          <Text style={styles.nutrientValue}>{meal.carbs}g</Text>
        </View>
        <View style={styles.nutrientRow}>
          <Text style={styles.nutrientLabel}>Fat:</Text>
          <Text style={styles.nutrientValue}>{meal.fat}g</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF69B4',
    textAlign: 'center',
  },
  image: {
    width: '90%',
    height: 200,
    borderRadius: 10,
    alignSelf: 'center',
    marginVertical: 10,
  },
  detailsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  mealType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nutrientLabel: {
    fontSize: 16,
    color: '#444',
    fontWeight: '500',
  },
  nutrientValue: {
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#FF69B4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});