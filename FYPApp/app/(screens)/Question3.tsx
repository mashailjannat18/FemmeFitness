import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { setUserData } from '../../datafiles/userData';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type MaterialCommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question3: React.FC = () => {
  const diseases = [
    { name: "Hypertension", icon: "heart-pulse" as MaterialCommunityIconName },
    { name: "Diabetes Type 2", icon: "needle" as MaterialCommunityIconName },
    { name: "Menopause", icon: "gender-female" as MaterialCommunityIconName }
  ];

  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [noneSelected, setNoneSelected] = useState(false);
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const toggleDisease = (disease: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (noneSelected) {
      setNoneSelected(false);
    }
    
    setSelectedDiseases(prev => 
      prev.includes(disease) 
        ? prev.filter(d => d !== disease)
        : [...prev, disease]
    );
  };

  const toggleNone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (!noneSelected) {
      setSelectedDiseases([]);
    }
    setNoneSelected(!noneSelected);
  };

  const handleNext = () => {
    if (selectedDiseases.length === 0 && !noneSelected) {
      Alert.alert('Selection Required', 'Please select at least one option or choose "None of these"');
      return;
    }

    setUserData('diseases', noneSelected ? '' : selectedDiseases.join(','));
    router.push(selectedDiseases.includes("Menopause")
      ? '/(screens)/Question5'
      : '/(screens)/Question4');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable
          onPress={() => router.push('/(screens)/Question2')}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Health Conditions</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Main Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Text style={styles.subtitle}>Select all conditions that apply to you:</Text>

        <View style={styles.optionsContainer}>
          {diseases.map((disease) => (
            <TouchableOpacity
              key={disease.name}
              style={[
                styles.option,
                selectedDiseases.includes(disease.name) && styles.selectedOption,
                noneSelected && styles.disabledOption
              ]}
              onPress={() => !noneSelected && toggleDisease(disease.name)}
              activeOpacity={0.8}
              disabled={noneSelected}
            >
              <MaterialCommunityIcons
                name={disease.icon}
                size={SCREEN_WIDTH * 0.06}
                color={
                  noneSelected ? '#ccc' :
                  selectedDiseases.includes(disease.name) ? '#fff' : '#e45ea9'
                }
              />
              <Text style={[
                styles.optionText,
                selectedDiseases.includes(disease.name) && styles.selectedText,
                noneSelected && styles.disabledText
              ]}>
                {disease.name}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.option,
              noneSelected && styles.selectedOption
            ]}
            onPress={toggleNone}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={SCREEN_WIDTH * 0.06}
              color={noneSelected ? '#fff' : '#e45ea9'}
            />
            <Text style={[
              styles.optionText,
              noneSelected && styles.selectedText
            ]}>
              None of these
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              (selectedDiseases.length === 0 && !noneSelected) && styles.disabledButton
            ]}
            onPress={handleNext}
            disabled={selectedDiseases.length === 0 && !noneSelected}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

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
    padding: SCREEN_WIDTH * 0.05,
    justifyContent: 'center',
    paddingTop: -15,
  },
  subtitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    marginBottom: SCREEN_HEIGHT * 0.03,
    textAlign: 'center',
  },
  optionsContainer: {
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.015,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedOption: {
    backgroundColor: '#e45ea9',
    borderColor: '#e45ea9',
  },
  disabledOption: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    marginLeft: SCREEN_WIDTH * 0.03,
    fontWeight: '500',
  },
  selectedText: {
    color: '#fff',
  },
  disabledText: {
    color: '#ccc',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default Question3;