import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { setUserData } from '../../datafiles/userData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CM_TO_INCH = 0.393701;
const INCHES_PER_FOOT = 12;
const MIN_HEIGHT_CM = 91.44; // 3 feet in cm
const MAX_HEIGHT_CM = 243.84; // 8 feet in cm
const PIXELS_PER_CM = 12;
const HEIGHT_RANGE_CM = MAX_HEIGHT_CM - MIN_HEIGHT_CM;
const SCALE_HEIGHT = HEIGHT_RANGE_CM * PIXELS_PER_CM;
const POINTER_OFFSET_PX = 192;
const SNAP_INTERVAL_CM = 2.54; // 1 inch in cm

const HeightMeasurementScreen = () => {
  const [unit, setUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCm, setHeightCm] = useState(170);
  const scalePosition = useRef(new Animated.Value(0)).current;
  const currentPosition = useRef(0);
  const isDragging = useRef(false);
  const router = useRouter();

  // Convert cm to feet in x.y format (e.g., 5.9 for 5'9", 5.11 for 5'11")
  const convertToFtDecimal = (cm: number) => {
    const totalInches = cm * CM_TO_INCH;
    const ft = Math.floor(totalInches / INCHES_PER_FOOT);
    const inches = Math.round(totalInches % INCHES_PER_FOOT);
    return parseFloat(`${ft}.${inches}`);
  };

  // Format height for display
  const getDisplayedHeight = () => {
    if (unit === 'cm') {
      return Math.round(heightCm);
    } else {
      const ftDecimal = convertToFtDecimal(heightCm);
      const ft = Math.floor(ftDecimal);
      const inches = Math.round((ftDecimal - ft) * 10); // Multiply by 10 instead of 100
      return `${ft}'${inches}"`;
    }
  };

  // Get the height in feet as a decimal (e.g., 5.9 for 5'9", 5.11 for 5'11")
  const getHeightInFeetDecimal = () => {
    return convertToFtDecimal(heightCm);
  };

  // Snap to nearest inch
  const snapToNearestInch = (cm: number) => {
    const inches = cm * CM_TO_INCH;
    const snappedInches = Math.round(inches);
    return snappedInches / CM_TO_INCH;
  };

  useEffect(() => {
    const initialY = -1 * (heightCm - MIN_HEIGHT_CM) * PIXELS_PER_CM + POINTER_OFFSET_PX;
    scalePosition.setValue(initialY);
    currentPosition.current = initialY;

    const listener = scalePosition.addListener(({ value }) => {
      if (!isDragging.current) return;
      
      const raw = (-value + POINTER_OFFSET_PX) / PIXELS_PER_CM;
      const calculatedHeight = MIN_HEIGHT_CM + raw;
      const clamped = Math.max(MIN_HEIGHT_CM, Math.min(MAX_HEIGHT_CM, calculatedHeight));
      const snappedHeight = snapToNearestInch(clamped);

      if (Math.round(snappedHeight) !== Math.round(heightCm)) {
        setHeightCm(snappedHeight);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });

    return () => scalePosition.removeListener(listener);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (_, gesture) => {
        const newY = currentPosition.current + gesture.dy;
        scalePosition.setValue(newY);
      },
      onPanResponderRelease: (_, gesture) => {
        isDragging.current = false;
        const velocity = gesture.vy * 100;
        const targetY = currentPosition.current + gesture.dy + velocity;

        const minY = -HEIGHT_RANGE_CM * PIXELS_PER_CM + POINTER_OFFSET_PX;
        const maxY = POINTER_OFFSET_PX;
        const clampedY = Math.max(minY, Math.min(maxY, targetY));

        // Calculate the snapped position
        const raw = (-clampedY + POINTER_OFFSET_PX) / PIXELS_PER_CM;
        const calculatedHeight = MIN_HEIGHT_CM + raw;
        const snappedHeight = snapToNearestInch(calculatedHeight);
        const snappedY = -1 * (snappedHeight - MIN_HEIGHT_CM) * PIXELS_PER_CM + POINTER_OFFSET_PX;

        Animated.spring(scalePosition, {
          toValue: snappedY,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start(() => {
          currentPosition.current = snappedY;
          setHeightCm(snappedHeight);
        });
      },
    })
  ).current;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const heightInFeet = getHeightInFeetDecimal(); // This now returns value like 5.9 for 5'9"
    setUserData('height', heightInFeet);
    router.push('/(screens)/Question3');
  };

  const renderScaleMarks = () => {
    const marks = [];
    // Create marks every inch (2.54cm)
    for (let cm = MIN_HEIGHT_CM; cm <= MAX_HEIGHT_CM; cm += SNAP_INTERVAL_CM) {
      const top = (cm - MIN_HEIGHT_CM) * PIXELS_PER_CM;
      const isMajor = cm % 25.4 === 0; // Every 10 inches
      const isMid = cm % 12.7 === 0; // Every 5 inches
      
      let value;
      if (unit === 'cm') {
        value = Math.round(cm);
      } else {
        const totalInches = cm * CM_TO_INCH;
        const ft = Math.floor(totalInches / INCHES_PER_FOOT);
        const inches = Math.round(totalInches % INCHES_PER_FOOT);
        value = `${ft}'${inches}"`;
      }

      marks.push(
        <View
          key={cm}
          style={[styles.scaleMark, {
            top,
            width: isMajor ? 48 : isMid ? 32 : 20,
            height: isMajor ? 4 : isMid ? 3 : 2,
            backgroundColor: isMajor ? '#e45ea9' : '#ccc',
            opacity: isMajor ? 1 : isMid ? 0.7 : 0.4,
          }]}
        >
          {isMajor && (
            <Text style={[styles.scaleText, { top: -8 }]}>{value}</Text>
          )}
        </View>
      );
    }
    return marks;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Your Measurements</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <TouchableOpacity
          onPress={() => setUnit(unit === 'cm' ? 'ft' : 'cm')}
          style={styles.unitToggleBtn}
        >
          <Text style={styles.unitToggleText}>Switch to {unit === 'cm' ? 'ft' : 'cm'}</Text>
        </TouchableOpacity>

        <View style={styles.pointer}>
          <View style={styles.pointerLine} />
          <View style={styles.pointerCircle} />
        </View>

        <View style={styles.scaleWrapper}>
          <Animated.View
            style={[styles.scaleContainer, { transform: [{ translateY: scalePosition }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.marksContainer}>
              {renderScaleMarks()}
            </View>
          </Animated.View>
        </View>

        <View style={styles.heightDisplay}>
          <Text style={styles.heightValue}>{getDisplayedHeight()}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleNext}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfdfd' },
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
  unitToggleBtn: {
    alignSelf: 'center',
    marginVertical: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e45ea9',
  },
  unitToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  pointer: {
    position: 'absolute',
    top: '50%',
    left: SCREEN_WIDTH * 0.25,
    zIndex: 10,
    transform: [{ translateY: -12 }],
  },
  pointerLine: {
    width: SCREEN_WIDTH * 0.6,
    height: 2,
    backgroundColor: '#e45ea9',
  },
  pointerCircle: {
    position: 'absolute',
    left: -12,
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e45ea9',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scaleWrapper: {
    height: SCREEN_HEIGHT * 0.6,
    overflow: 'hidden',
    alignItems: 'flex-start',
    paddingLeft: SCREEN_WIDTH * 0.15,
    marginTop: SCREEN_HEIGHT * 0.1,
  },
  scaleContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.3,
  },
  marksContainer: {
    width: '100%',
    height: SCALE_HEIGHT + SCREEN_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
  },
  scaleMark: {
    position: 'absolute',
    left: 0,
  },
  scaleText: {
    position: 'absolute',
    left: 52,
    fontSize: 14,
    color: '#e45ea9',
    fontWeight: '600',
  },
  heightDisplay: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  heightValue: {
    fontSize: 72,
    color: '#e45ea9',
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default HeightMeasurementScreen;