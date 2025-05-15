import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Image,
  Animated,
  Dimensions,
  Pressable,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { setUserData } from '../../datafiles/userData';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question1: React.FC = () => {
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const ageRange = Array.from({ length: 70 - 14 + 1 }, (_, i) => i + 14);

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

  const handleAgeSelect = (age: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAge(age);
  };

  const handleNext = () => {
    if (selectedAge === null) {
      Alert.alert('Field Required', 'Please select your age before proceeding.');
      return;
    }
    
    setUserData('age', selectedAge);
    router.push('/(screens)/Question2');
  };

  const renderAgeItem = ({ item }: { item: number }) => (
    <TouchableOpacity
      style={[
        styles.ageItem,
        item === selectedAge && styles.selectedAge,
      ]}
      onPress={() => handleAgeSelect(item)}
      activeOpacity={0.8}
    >
      <Text style={[
        styles.ageText,
        item === selectedAge && styles.selectedAgeText,
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable 
          onPress={() => router.push('/(screens)/EntryScreen')} 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Your Age</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Main Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Image
          source={require('../../assets/images/age.jpeg')}
          style={styles.headerImage}
          resizeMode="contain"
        />

        <View style={styles.ageListContainer}>
          <FlatList
            data={ageRange}
            renderItem={renderAgeItem}
            keyExtractor={(item) => item.toString()}
            contentContainerStyle={styles.ageList}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, selectedAge === null && styles.disabledButton]}
            onPress={handleNext}
            disabled={selectedAge === null}
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
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.05,
  },
  headerImage: {
    width: '85%',
    height: SCREEN_HEIGHT * 0.25,
    marginBottom: SCREEN_HEIGHT * 0.04,
    borderRadius: 12,
  },
  ageListContainer: {
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_HEIGHT * 0.35,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ffb6c1',
    padding: 10,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  ageList: {
    alignItems: 'center',
  },
  ageItem: {
    height: SCREEN_WIDTH * 0.12,
    width: SCREEN_WIDTH * 0.12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SCREEN_HEIGHT * 0.01,
    borderRadius: SCREEN_WIDTH * 0.06,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedAge: {
    borderColor: '#ff69b4',
    borderWidth: 2,
    backgroundColor: '#ffe4e1',
    transform: [{ scale: 1.1 }],
  },
  ageText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#555',
  },
  selectedAgeText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#ff69b4',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '80%',
    marginTop: SCREEN_HEIGHT * 0.03,
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

export default Question1;