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
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { setUserData } from '../../datafiles/userData';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question2: React.FC = () => {
  const [selectedWeight, setSelectedWeight] = useState<string>('');
  const [selectedHeight, setSelectedHeight] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const heightOptions = Array.from({ length: 36 }, (_, i) => (3 + i * 0.1).toFixed(1));

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
    if (!selectedWeight || !selectedHeight) {
      Alert.alert('Incomplete Fields', 'Please enter both weight and height');
      return;
    }
    
    const weight = parseFloat(selectedWeight);
    if (isNaN(weight) || weight < 25 || weight > 200) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 25-200 kg');
      return;
    }
    
    setUserData('weight', weight);
    setUserData('height', parseFloat(selectedHeight));
    router.push('/(screens)/Question3');
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable 
          onPress={() => router.push('/(screens)/Question1')} 
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
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter weight (25-200 kg)"
            keyboardType="decimal-pad"
            value={selectedWeight}
            onChangeText={handleWeightChange}
          />
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Height (ft)</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedHeight}
              onValueChange={(itemValue: string) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedHeight(itemValue);
              }}
              style={styles.picker}
            >
              <Picker.Item label="Select height" value="" />
              {heightOptions.map((height) => (
                <Picker.Item key={height} label={`${height} ft`} value={height} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button, 
              (!selectedWeight || !selectedHeight || errorMessage) && styles.disabledButton
            ]}
            onPress={handleNext}
            disabled={!selectedWeight || !selectedHeight || !!errorMessage}
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
  inputContainer: {
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  label: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  input: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.09,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    fontSize: SCREEN_WIDTH * 0.045,
    borderWidth: 1,
    borderColor: '#e45ea9',
  },
  pickerContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.09,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e45ea9',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: '#ff4444',
    fontSize: SCREEN_WIDTH * 0.035,
    marginTop: SCREEN_HEIGHT * 0.005,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SCREEN_HEIGHT * 0.02,
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

export default Question2;