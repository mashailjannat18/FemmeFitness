import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Pressable, Dimensions, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { setUserData } from '@/datafiles/userData';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ChallengeOption = {
  display: '15 Days' | '30 Days' | '45 Days' | '90 Days' | 'Continue Without Challenge';
  value: number;
};

const challengeOptions: ChallengeOption[] = [
  { display: '15 Days', value: 15 },
  { display: '30 Days', value: 30 },
  { display: '45 Days', value: 45 },
  { display: '90 Days', value: 90 },
  { display: 'Continue Without Challenge', value: 15 },
];

const Question9: React.FC = () => {
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeOption | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  const handleNext = () => {
    if (!selectedChallenge) {
      Alert.alert('Error', 'Please select a challenge option or continue without a challenge');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserData('challengeDays', selectedChallenge.value);
    router.push('/(screens)/Question8');
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/Question7');
  };

  const toggleDropdown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable 
          onPress={handleBack} 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Select Your Challenge</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.iconContainer}>
          <AntDesign 
            name="star" 
            size={SCREEN_WIDTH * 0.125} 
            color="#e45ea9"
          />
        </View>

        <Text style={styles.subHeader}>Join a fitness challenge to stay motivated</Text>

        <TouchableOpacity 
          style={styles.dropdownContainer} 
          onPress={toggleDropdown}
          activeOpacity={0.8}
        >
          <Text style={styles.dropdownText}>
            {selectedChallenge ? selectedChallenge.display : 'Select a challenge'}
          </Text>
          <Ionicons 
            name={isDropdownOpen ? 'chevron-up' : 'chevron-down'} 
            size={SCREEN_WIDTH * 0.06} 
            color="#fff" 
          />
        </TouchableOpacity>

        {isDropdownOpen && (
          <View style={styles.optionsContainer}>
            {challengeOptions.map((option) => (
              <TouchableOpacity
                key={option.display}
                style={[
                  styles.option,
                  selectedChallenge?.display === option.display ? styles.selectedOption : null,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedChallenge(option);
                  setIsDropdownOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.optionText}>{option.display}</Text>
                {selectedChallenge?.display === option.display && (
                  <Ionicons name="checkmark" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, !selectedChallenge ? styles.disabledButton : null]}
            onPress={handleNext}
            disabled={!selectedChallenge}
            activeOpacity={0.8}
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
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  subHeader: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  dropdownContainer: {
    width: '100%',
    padding: SCREEN_HEIGHT * 0.02,
    backgroundColor: '#e45ea9',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dropdownText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '500',
  },
  optionsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  option: {
    padding: SCREEN_HEIGHT * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#FCE7F3',
  },
  optionText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SCREEN_HEIGHT * 0.04,
  },
  button: {
    backgroundColor: '#e45ea9',
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
  disabledButton: {
    backgroundColor: '#a9a9a9',
    shadowColor: '#000',
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default Question9;