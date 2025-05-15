import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions,
  TouchableOpacity,
  Pressable,
  Easing // Import Easing from react-native
} from 'react-native';
import { useRouter } from 'expo-router';
import { setUserData } from '@/datafiles/userData';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Question7: React.FC = () => {
  const [activityLevel, setActivityLevel] = useState<number | null>(null);
  const sliderWidth = useRef(0);
  const sliderPosition = useRef(new Animated.Value(0)).current;
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
        easing: Easing.out(Easing.quad), // Use imported Easing
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const touchX = gestureState.moveX;
        const newSliderValue = Math.max(0, Math.min(touchX, sliderWidth.current - 30));
        sliderPosition.setValue(newSliderValue);
        setActivityLevel(newSliderValue / (sliderWidth.current - 30));
      },
    })
  ).current;

  const onSliderLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    sliderWidth.current = width;
  };

  const handleNextPress = () => {
    if (activityLevel === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserData("activityLevel", (activityLevel * 100).toFixed(0));
    router.push("/(screens)/Question9");
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(screens)/Question6");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.headerContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <Pressable 
          onPress={handleBackPress} 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Activity Level</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[styles.contentContainer, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }]}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name="run-fast" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
        </View>

        <Text style={styles.questionText}>How active are you?</Text>
        
        <View style={styles.labelsContainer}>
          <Text style={[styles.label, styles.labelLeft]}>Not Active</Text>
          <Text style={[styles.label, styles.labelCenter]}>Moderately Active</Text>
          <Text style={[styles.label, styles.labelRight]}>Very Active</Text>
        </View>

        <View
          style={styles.sliderContainer}
          onLayout={onSliderLayout}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.slider,
              {
                transform: [{ translateX: sliderPosition }],
              },
            ]}
          />
        </View>

        <Text style={styles.sliderValue}>
          {activityLevel === null 
            ? "Slide to select" 
            : `${Math.round((activityLevel || 0) * 100)}% Active`}
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.nextButton, !activityLevel && styles.disabledButton]}
            onPress={handleNextPress}
            disabled={!activityLevel}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  iconContainer: {
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  questionText: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.04,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'relative',
  },
  label: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
  },
  labelLeft: {
    position: 'absolute',
    left: 0,
  },
  labelCenter: {
    position: 'absolute',
    left: '48%',
    transform: [{ translateX: -SCREEN_WIDTH * 0.15 }], // Adjust for approximate text width
  },
  labelRight: {
    position: 'absolute',
    right: 0,
  },
  sliderContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    justifyContent: 'center',
    position: 'relative',
    marginTop: SCREEN_HEIGHT * 0.05,
  },
  slider: {
    width: SCREEN_WIDTH * 0.08,
    height: SCREEN_WIDTH * 0.08,
    backgroundColor: '#e45ea9',
    borderRadius: SCREEN_WIDTH * 0.04,
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.025,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sliderValue: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    marginTop: SCREEN_HEIGHT * 0.03,
    textAlign: 'center',
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

export default Question7;