import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Pressable, PressableStateCallbackType } from "react-native";
import { useRouter } from "expo-router"; 
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { setUserData } from "@/datafiles/userData";
import { Dimensions, Image } from 'react-native';
import Biceps from '../../assets/images/5.png';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question6: React.FC = () => {
  const areas = ["Arms", "Stomach", "Hips", "Legs", "Full Body"];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [scaleValue] = useState(new Animated.Value(1)); 
  const router = useRouter(); 

  const toggleArea = (area: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (area === "Full Body") {
      if (!selectedAreas.includes("Full Body")) {
        setSelectedAreas(["Full Body"]);
      } else {
        setSelectedAreas((prevAreas) => prevAreas.filter((a) => a !== "Full Body"));
      }
    } else {
      if (selectedAreas.includes("Full Body")) {
        return;
      }
      if (selectedAreas.includes(area)) {
        setSelectedAreas((prevAreas) => prevAreas.filter((a) => a !== area));
      } else {
        setSelectedAreas((prevAreas) => [...prevAreas, area]);
      }
    }
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
    if (selectedAreas.length === 0) {
      Alert.alert("Selection Required", "Please select at least one area to focus on.");
      return;
    }
    setUserData('areasOfFocus', selectedAreas);  
    router.push("/(screens)/Question7");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable 
          onPress={() => router.push("/(screens)/Question5")} 
          style={({ pressed }: PressableStateCallbackType) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <MaterialIcons name="chevron-left" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Focus Areas</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Image
            source={Biceps}
            style={styles.biceps}
          />
        </View>

        <Text style={styles.subHeader}>Which areas do you want to focus on?</Text>
        
        <View style={styles.optionsContainer}>
          {areas.map((area) => (
            <TouchableOpacity
              key={area}
              style={[
                styles.option,
                selectedAreas.includes(area) && styles.selectedOption,
                { transform: [{ scale: selectedAreas.includes(area) ? scaleValue : 1 }] },
              ]}
              onPress={() => toggleArea(area)}
            >
              <MaterialIcons
                name={
                  area === "Arms" ? "fitness-center" : 
                  area === "Stomach" ? "spa" : 
                  area === "Hips" ? "directions-run" : 
                  area === "Legs" ? "accessibility" : 
                  "person"
                }
                size={SCREEN_WIDTH * 0.06}
                color={selectedAreas.includes(area) ? "#fff" : "#e45ea9"}
                style={styles.icon}
              />
              <Text style={[styles.optionText, selectedAreas.includes(area) && styles.selectedText]}>
                {area}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, selectedAreas.length > 0 ? styles.nextButton : styles.disabledButton]}
            onPress={handleNext}
            disabled={selectedAreas.length === 0} 
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
  iconContainer: {
    marginBottom: SCREEN_HEIGHT * 0.03,
    justifyContent: 'center',
    alignItems: 'center',
  },
  biceps: {
    width: SCREEN_WIDTH * 0.15,
    height: SCREEN_WIDTH * 0.15,
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  subHeader: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#666',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.04,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: SCREEN_HEIGHT * 0.02,
  },
  option: {
    width: SCREEN_WIDTH * 0.25,
    height: SCREEN_WIDTH * 0.25,
    margin: SCREEN_WIDTH * 0.02,
    backgroundColor: "#fff",
    borderRadius: SCREEN_WIDTH * 0.125,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedOption: {
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
  optionText: {
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: "500",
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

export default Question6;