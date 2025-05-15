import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Pressable, PressableStateCallbackType } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from '@expo/vector-icons'; 
import { setUserData } from '../../datafiles/userData';
import { Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const goalMapping = {
  "Lose weight": "weight_loss",
  "Gain weight": "gain_weight",
  "Muscle build": "build_muscle",
  "Stay fit": "stay_fit",
};

const goals = Object.keys(goalMapping);

const Question5: React.FC = () => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null); 
  const [scaleValue] = useState(new Animated.Value(1)); 
  const router = useRouter();

  const toggleGoal = (goal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updatedGoal = selectedGoal === goal ? null : goal;
    setSelectedGoal(updatedGoal);
    animateSelection();
  };

  const animateSelection = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    if (!selectedGoal) {
      Alert.alert("Selection Required", "Please select a goal before proceeding.");
      return;
    }

    const backendFriendlyGoal = goalMapping[selectedGoal as keyof typeof goalMapping];
    setUserData("goal", backendFriendlyGoal); 
    router.push("/(screens)/Question6");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable 
          onPress={() => router.push("/(screens)/Question4")} 
          style={({ pressed }: PressableStateCallbackType) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <MaterialIcons name="chevron-left" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Select Your Goal</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.subHeader}>What's your primary fitness objective?</Text>
        
        <View style={styles.cardsContainer}>
          {goals.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[
                styles.card,
                selectedGoal === goal && styles.selectedCard,
                { transform: [{ scale: selectedGoal === goal ? scaleValue : 1 }] },
              ]}
              onPress={() => toggleGoal(goal)}
            >
              <MaterialIcons
                name={
                  goal === "Muscle build" ? "fitness-center" : 
                  goal === "Lose weight" ? "monitor-weight" : 
                  goal === "Gain weight" ? "fastfood" : 
                  "directions-run"
                }
                size={SCREEN_WIDTH * 0.08}
                color={selectedGoal === goal ? "#fff" : "#e45ea9"}
                style={styles.icon}
              />
              <Text style={[styles.cardText, selectedGoal === goal && styles.selectedText]}>
                {goal}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, selectedGoal ? styles.nextButton : styles.disabledButton]}
            onPress={handleNext}
            disabled={!selectedGoal}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_HEIGHT * 0.02,
    paddingTop: SCREEN_HEIGHT * 0.03,
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
    flex: 1,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
    padding: SCREEN_WIDTH * 0.04,
    justifyContent: 'center',
  },
  subHeader: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#666',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.04,
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: SCREEN_HEIGHT * 0.02,
  },
  card: {
    width: "45%",
    padding: SCREEN_WIDTH * 0.05,
    margin: SCREEN_WIDTH * 0.02,
    backgroundColor: "#fff",
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCard: {
    backgroundColor: "#e45ea9",
    borderColor: "#e45ea9",
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  icon: {
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  cardText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: "bold",
    color: "#333",
    textAlign: 'center',
  },
  selectedText: {
    color: "#fff",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.04,
  },
  button: {
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: SCREEN_WIDTH * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButton: {
    backgroundColor: "#e45ea9",
  },
  disabledButton: {
    backgroundColor: "#a9a9a9",
  },
  buttonText: {
    color: "#fff",
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: "600",
  },
});

export default Question5;