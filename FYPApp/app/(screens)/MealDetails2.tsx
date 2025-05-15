import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Platform 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

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
    dailyWorkoutId, // Added to access dailyWorkoutId
  } = useLocalSearchParams<{
    mealName: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    servingQty: string;
    servingWeightGrams: string;
    type: 'ingredient' | 'dish';
    dailyWorkoutId?: string; // Added type for dailyWorkoutId
  }>();

  // Parse initial nutrient values
  const initialCalories = parseFloat(calories) || 0;
  const initialProtein = parseFloat(protein) || 0;
  const initialCarbs = parseFloat(carbs) || 0;
  const initialFat = parseFloat(fat) || 0;

  // State for serving adjustments
  const [selectedServingQty, setSelectedServingQty] = useState<number>(type === 'dish' ? parseInt(servingQty) || 0 : 0); // For dishes: quantity
  const [selectedServingGrams, setSelectedServingGrams] = useState<string>('100g'); // For ingredients: grams

  // Generate serving quantities for dishes (0 to 500)
  const servingQuantities = Array.from({ length: 501 }, (_, i) => i); // 0 to 500

  // Generate serving sizes for ingredients (5g to 1000g)
  const servingSizes = [];
  for (let i = 5; i <= 1000; i += 5) {
    servingSizes.push(`${i}g`);
  }

  // Calculate scaling factor based on type
  const defaultServingQty = type === 'dish' ? (parseInt(servingQty) || 1) : 100; // Default for dishes: servingQty, for ingredients: 100g
  const selectedValue = type === 'dish' 
    ? selectedServingQty 
    : parseInt(selectedServingGrams) || 100; // For dishes: quantity, for ingredients: grams

  const scalingFactor = selectedValue / defaultServingQty;

  // Scaled nutrient values
  const scaledCalories = initialCalories * scalingFactor;
  const scaledProtein = initialProtein * scalingFactor;
  const scaledCarbs = initialCarbs * scalingFactor;
  const scaledFat = initialFat * scalingFactor;

  const handleBackPress = () => {
    router.back();
  };

  const handleLogMeal = async () => {
    if (!dailyWorkoutId) {
      console.error('No dailyWorkoutId provided');
      return;
    }

    try {
      // Fetch the current intake values from DailyMealPlans
      const { data: mealData, error: fetchError } = await supabase
        .from('DailyMealPlans')
        .select('calories_intake, protein_intake, carbs_intake, fat_intake')
        .eq('daily_workout_id', dailyWorkoutId)
        .single();

      if (fetchError || !mealData) {
        console.error('Error fetching current intake values:', fetchError?.message || 'No data found');
        return;
      }

      // Calculate new totals by adding scaled values to existing ones (or 0 if null)
      const currentCalories = mealData.calories_intake || 0;
      const currentProtein = mealData.protein_intake || 0;
      const currentCarbs = mealData.carbs_intake || 0;
      const currentFat = mealData.fat_intake || 0;

      const updatedCalories = currentCalories + scaledCalories;
      const updatedProtein = currentProtein + scaledProtein;
      const updatedCarbs = currentCarbs + scaledCarbs;
      const updatedFat = currentFat + scaledFat;

      // Update the DailyMealPlans table with the new totals
      const { error: updateError } = await supabase
        .from('DailyMealPlans')
        .update({
          calories_intake: updatedCalories,
          protein_intake: updatedProtein,
          carbs_intake: updatedCarbs,
          fat_intake: updatedFat,
        })
        .eq('daily_workout_id', dailyWorkoutId);

      if (updateError) {
        console.error('Error updating intake values:', updateError.message);
        return;
      }

      console.log(`Meal logged: ${mealName}, Type: ${type}, Adjusted Serving: ${type === 'dish' ? selectedServingQty : selectedServingGrams}`);
      console.log(`Updated totals - Calories: ${updatedCalories.toFixed(1)} kcal, Protein: ${updatedProtein.toFixed(1)} g, Carbs: ${updatedCarbs.toFixed(1)} g, Fat: ${updatedFat.toFixed(1)} g`);

      // Optionally navigate back after logging
      router.back();
    } catch (error) {
      console.error('Error logging meal:', error);
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Food Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.contentContainer}>
        {/* Food Name */}
        <Text style={styles.mealName}>{mealName}</Text>

        {/* Default Serving Size */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Default Serving Size</Text>
          <View style={styles.dropdownContainer}>
            {type === 'dish' && servingQty !== 'N/A' && servingWeightGrams !== 'N/A' ? (
              <Text style={styles.servingText}>
                Serving: {servingQty} ({servingWeightGrams} grams)
              </Text>
            ) : (
              <Text style={styles.servingText}>
                Serving: 100 grams
              </Text>
            )}
          </View>
        </View>

        {/* Adjust Serving Size */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            Adjust Serving Size {type === 'dish' ? '(Quantity)' : '(Grams)'}
          </Text>
          <View style={styles.dropdownContainer}>
            {type === 'dish' ? (
              <Picker
                selectedValue={selectedServingQty}
                onValueChange={(itemValue: number) => setSelectedServingQty(itemValue)}
                style={styles.picker}
                dropdownIconColor="#FF69B4"
                mode="dropdown"
                prompt="Select serving quantity"
              >
                {servingQuantities.map((qty, index) => (
                  <Picker.Item key={index} label={`${qty}`} value={qty} style={styles.pickerItem} />
                ))}
              </Picker>
            ) : (
              <Picker
                selectedValue={selectedServingGrams}
                onValueChange={(itemValue: string) => setSelectedServingGrams(itemValue)}
                style={styles.picker}
                dropdownIconColor="#FF69B4"
                mode="dropdown"
                prompt="Select serving size"
              >
                {servingSizes.map((serving, index) => (
                  <Picker.Item key={index} label={serving} value={serving} style={styles.pickerItem} />
                ))}
              </Picker>
            )}
          </View>
        </View>

        {/* Nutrient Breakdown */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Nutrition Information</Text>
          <View style={styles.macroContainer}>
            <View style={[styles.macroRow, styles.macroRowFirst]}>
              <View style={styles.macroLabelContainer}>
                <Ionicons name="flame-outline" size={18} color="#FF69B4" />
                <Text style={styles.macroLabel}>Calories:</Text>
              </View>
              <Text style={styles.macroValue}>{scaledCalories.toFixed(1)} kcal</Text>
            </View>
            <View style={styles.macroRow}>
              <View style={styles.macroLabelContainer}>
                <Ionicons name="barbell-outline" size={18} color="#FF69B4" />
                <Text style={styles.macroLabel}>Protein:</Text>
              </View>
              <Text style={styles.macroValue}>{scaledProtein.toFixed(1)} g</Text>
            </View>
            <View style={styles.macroRow}>
              <View style={styles.macroLabelContainer}>
                <Ionicons name="nutrition-outline" size={18} color="#FF69B4" />
                <Text style={styles.macroLabel}>Carbs:</Text>
              </View>
              <Text style={styles.macroValue}>{scaledCarbs.toFixed(1)} g</Text>
            </View>
            <View style={[styles.macroRow, styles.macroRowLast]}>
              <View style={styles.macroLabelContainer}>
                <Ionicons name="water-outline" size={18} color="#FF69B4" />
                <Text style={styles.macroLabel}>Fat:</Text>
              </View>
              <Text style={styles.macroValue}>{scaledFat.toFixed(1)} g</Text>
            </View>
          </View>
        </View>

        {/* Log Meal Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={handleLogMeal} 
            style={styles.logButton}
            activeOpacity={0.8}
          >
            <Text style={styles.logButtonText}>Log Meal</Text>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#FF69B4',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  contentContainer: {
    padding: 20,
  },
  mealName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF1493',
    marginBottom: 15,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#FFB6C1',
    borderRadius: 12,
    backgroundColor: '#FFF0F5',
    overflow: 'hidden',
    marginBottom: 15,
  },
  picker: {
    width: '100%',
    height: 60,
    color: 'grey',
    backgroundColor: 'white',
    zIndex: 1,
  },
  pickerItem: {
    fontSize: 16,
    color: '#808080',
    backgroundColor: '#FFF',
  },
  servingText: {
    fontSize: 16,
    color: '#FF69B4',
    fontWeight: '500',
    padding: 15,
    textAlign: 'center',
  },
  macroContainer: {
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#FFB6C1',
    shadowColor: '#FFB6C1',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD1DC',
  },
  macroRowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  macroRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  macroLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 16,
    color: '#FF69B4',
    fontWeight: '500',
    marginLeft: 8,
  },
  macroValue: {
    fontSize: 16,
    color: 'black',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  logButton: {
    backgroundColor: '#FF69B4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FF69B4',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
    width: 'auto',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});