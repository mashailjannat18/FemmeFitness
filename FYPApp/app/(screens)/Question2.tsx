import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { setUserData } from '../../datafiles/userData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question2: React.FC = () => {
  const [selectedWeight, setSelectedWeight] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const scaleAnim = useState(new Animated.Value(0.95))[0];
  const borderAnim = useState(new Animated.Value(0))[0];
  
  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#e0e0e0', '#e45ea9']
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.elastic(0.9)),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleWeightChange = (text: string) => {
    if (/^\d*\.?\d*$/.test(text)) {
      setSelectedWeight(text);
      const weight = parseFloat(text);
      if (text !== '' && !isNaN(weight)) {
        if (weight < 25) {
          setErrorMessage('Weight must be 25 kg or above');
        } else if (weight > 200) {
          setErrorMessage('Weight must not exceed 200 kg');
        } else {
          setErrorMessage('');
        }
      }
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (!selectedWeight) {
      Alert.alert('Incomplete Fields', 'Please enter your weight');
      return;
    }

    const weight = parseFloat(selectedWeight);
    if (isNaN(weight)) {
      Alert.alert('Invalid Input', 'Please enter a valid number');
      return;
    }
    
    if (weight < 25 || weight > 200) {
      Alert.alert('Invalid Weight', 'Please enter a weight between 25–200 kg');
      return;
    }

    setUserData('weight', weight);
    router.push('/(screens)/Question2.1');
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/(screens)/Question1');
          }}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Your Measurements</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Main Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
      }]}>
        <View style={styles.card}>
          <Text style={styles.title}>What's your weight?</Text>
          <Text style={styles.subtitle}>We use this to personalize your experience</Text>
          
          <Animated.View style={[styles.inputWrapper, {
            borderColor: borderColor,
            shadowColor: isFocused ? '#e45ea9' : '#000',
            shadowOpacity: isFocused ? 0.15 : 0.05,
          }]}>
            <TextInput
              style={styles.input}
              placeholder="Enter weight (25-200 kg)"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
              value={selectedWeight}
              onChangeText={handleWeightChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </Animated.View>
          
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color="#ff4757" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              (!selectedWeight || errorMessage) && styles.disabledButton
            ]}
            onPress={handleNext}
            disabled={!selectedWeight || !!errorMessage}
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
  // Header - Matches Original Exactly
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: SCREEN_WIDTH * 0.07,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: SCREEN_WIDTH * 0.06,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  subtitle: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#777',
    marginBottom: SCREEN_HEIGHT * 0.05,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: SCREEN_HEIGHT * 0.09,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    borderWidth: 1.5,
    marginBottom: SCREEN_HEIGHT * 0.01,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  errorText: {
    color: '#ff4757',
    fontSize: SCREEN_WIDTH * 0.035,
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  buttonContainer: {
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  // Button - Matches Original Size Exactly
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
    height: SCREEN_HEIGHT * 0.06,
    minWidth: SCREEN_WIDTH * 0.3,
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
    shadowColor: '#a9a9a9',
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default Question2;