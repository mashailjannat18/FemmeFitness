import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Animated,
  Easing,
  Dimensions,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, LinearGradient, Defs, Stop } from 'react-native-svg';

type StructuredSet = {
  set: number;
  reps: string;
  rest_time_sec: number;
};

type Exercise = {
  id: number;
  exercise_name: string;
  target_muscle: string;
  type: string;
  difficulty: string;
  caution: string | null;
  sets: number;
  reps: string;
  rest_time_sec: number;
  duration_min: number;
  calories_burned: number;
  description: string;
  workout_date: string;
  daily_workout_id?: number;
  structuredSets?: StructuredSet[];
  YT_links: string | null;
  time_segments: string | null;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ExercisePlayback: React.FC = () => {
  const router = useRouter();
  const { user } = useUserAuth();
  const { exercises: exercisesParam, day, daily_workout_id, startIndex } = useLocalSearchParams<{
    exercises?: string;
    day?: string;
    daily_workout_id?: string;
    startIndex?: string;
  }>();

  // Memoize exercises to prevent recomputation on every render
  const exercises: Exercise[] = useMemo(() => {
    return exercisesParam ? JSON.parse(exercisesParam) : [];
  }, [exercisesParam]);

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(startIndex ? parseInt(startIndex) : 0);
  const [currentSet, setCurrentSet] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [holdTimer, setHoldTimer] = useState<number | null>(null);
  const [stopwatch, setStopwatch] = useState(0);
  const [totalExerciseTime, setTotalExerciseTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [fetchedDailyWorkoutId, setFetchedDailyWorkoutId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Refs to store timer IDs and prevent re-render issues
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopwatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const imageCache = useRef<Map<string, string[]>>(new Map());
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  // Memoize currentExercise to prevent reference changes
  const currentExercise = useMemo(() => {
    return exercises[currentExerciseIndex];
  }, [exercises, currentExerciseIndex]);

  const isLastExercise = currentExerciseIndex === exercises.length - 1;
  const isLastSet = currentSet === currentExercise?.sets;
  const isNumericReps = currentExercise && !currentExercise.reps.includes('sec hold');
  const repsCount = isNumericReps ? parseInt(currentExercise?.reps, 10) : 0;
  const holdSeconds = !isNumericReps && currentExercise ? parseInt(currentExercise.reps.split(' ')[0], 10) : 0;

  // Helper function to parse YouTube links and segments
  const parseYouTubeLinks = (links: string | null, segments: string | null) => {
    if (!links || !segments) return [];

    try {
      const linkArray = links.split(',');
      const segmentArray = segments.split(',');

      return linkArray.map((link, index) => ({
        url: link.trim(),
        time: segmentArray[index]?.trim() || '0:00',
      }));
    } catch (error) {
      console.error('Error parsing YouTube links:', error);
      return [];
    }
  };

  // YouTube Links Component
  const YouTubeLinksSection = ({ links, segments }: { links: string | null; segments: string | null }) => {
    const youtubeData = parseYouTubeLinks(links, segments);

    if (youtubeData.length === 0) return null;

    const handlePress = async (url: string) => {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          console.error("Don't know how to open this URL:", url);
        }
      } catch (error) {
        console.error('Error opening URL:', error);
      }
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Tutorials</Text>
        {youtubeData.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.youtubeLink}
            onPress={() => handlePress(item.url)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="youtube" size={24} color="#FF0000" />
            <Text style={styles.youtubeLinkText}>Watch at {item.time}</Text>
            <MaterialIcons name="open-in-new" size={18} color="#888" />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Reset state when switching exercises and start countdown
  useEffect(() => {
    console.log('Switching to exercise:', currentExerciseIndex, currentExercise?.exercise_name);
    setTotalExerciseTime(0);
    setCurrentSet(1);
    setStopwatch(0);
    setIsPlaying(false);
    setIsResting(false);
    setIsHolding(false);
    setRestTimer(null);
    setHoldTimer(null);
    setCountdown(3);

    // Animate when exercise changes
    if (currentExercise) {
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
    }
  }, [currentExerciseIndex]);

  // Separate useEffect for image fetching with caching
  useEffect(() => {
    if (!currentExercise) return;

    const exerciseName = currentExercise.exercise_name;

    // Check cache first
    if (imageCache.current.has(exerciseName)) {
      console.log(`Using cached images for ${exerciseName}`);
      setImageUrls(imageCache.current.get(exerciseName)!);
      return;
    }

    fetchImages(exerciseName);
  }, [currentExercise]);

  // Fetch daily workout ID if not provided
  useEffect(() => {
    const fetchDailyWorkoutId = async () => {
      if (!user?.id || !day || daily_workout_id) {
        console.log('Skipping fetchDailyWorkoutId:', { userId: user?.id, day, daily_workout_id });
        return;
      }

      try {
        const userId = user.id;
        console.log('Fetching daily_workout_id for user:', userId, 'day:', day);

        const { data: planData, error: planError } = await supabase
          .from('WorkoutPlans')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();

        if (planError || !planData) {
          throw new Error('No active workout plan found');
        }

        const { data: dailyData, error: dailyError } = await supabase
          .from('DailyWorkouts')
          .select('id')
          .eq('workout_plan_id', planData.id)
          .eq('day_name', day)
          .single();

        if (dailyError || !dailyData) {
          throw new Error(`No daily workout found for day ${day}`);
        }

        console.log('Fetched daily_workout_id:', dailyData.id);
        setFetchedDailyWorkoutId(dailyData.id);
      } catch (err: any) {
        console.error('Error fetching daily_workout_id:', err.message || err);
        setError('Unable to load workout data. Progress tracking may be unavailable.');
      }
    };

    fetchDailyWorkoutId();
  }, [user?.id, day, daily_workout_id]);

  // Countdown timer logic using ref
  useEffect(() => {
    if (countdown === null) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          console.log('Countdown finished, starting exercise');
          setIsPlaying(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [countdown]);

  // Stopwatch logic using ref
  useEffect(() => {
    if (isPlaying && !isHolding) {
      console.log('Starting stopwatch');
      stopwatchTimerRef.current = setInterval(() => {
        setStopwatch((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (stopwatchTimerRef.current) {
        clearInterval(stopwatchTimerRef.current);
        stopwatchTimerRef.current = null;
      }
    };
  }, [isPlaying, isHolding]);

  // Hold timer logic for non-numeric reps (e.g., "10 sec hold")
  useEffect(() => {
    if (isPlaying && !isNumericReps && holdTimer === null) {
      setHoldTimer(holdSeconds);
      setIsHolding(true);
    }

    if (holdTimer === null) {
      if (holdTimerRef.current) {
        console.log('Clearing hold timer');
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      return;
    }

    holdTimerRef.current = setInterval(() => {
      setHoldTimer((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          console.log('Hold timer finished');
          setIsHolding(false);
          setIsPlaying(false);
          handleSetComplete();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [isPlaying, holdTimer, isNumericReps, holdSeconds]);

  // Rest timer logic using ref
  useEffect(() => {
    if (restTimer === null) {
      if (restTimerRef.current) {
        console.log('Clearing rest timer');
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      return;
    }

    restTimerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          console.log('Rest timer finished:', { currentSet, isLastSet, currentExerciseIndex, isLastExercise });
          setIsResting(false);
          if (isLastSet) {
            if (isLastExercise) {
              setIsFinished(true);
            } else {
              setCurrentExerciseIndex(currentExerciseIndex + 1);
            }
          } else {
            setCurrentSet(currentSet + 1);
            setCountdown(3);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [restTimer, currentSet, isLastSet, currentExerciseIndex, isLastExercise]);

  const fetchImages = async (exerciseName: string) => {
    try {
      console.log(`Fetching images for exercise: ${exerciseName}`);

      let allFiles: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const { data: files, error: listError } = await supabase.storage
          .from('workout-images')
          .list('', { limit, offset });

        if (listError) {
          console.error('Error listing files in workout-images bucket:', listError.message);
          throw new Error('Failed to list images from storage.');
        }

        if (!files || files.length === 0) {
          console.log(`No more files found at offset ${offset}.`);
          hasMore = false;
          break;
        }

        console.log(`Fetched batch at offset ${offset}:`, files.map((f) => f.name));
        allFiles = [...allFiles, ...files];
        offset += limit;

        const matchingFiles = files.filter((file) => {
          const fileNameWithoutExtension = file.name.replace(/\.png$/, '');
          return fileNameWithoutExtension === exerciseName || fileNameWithoutExtension.startsWith(`${exerciseName} `);
        });

        if (matchingFiles.length > 0) {
          console.log(`Found matching images in batch at offset ${offset - limit}, stopping fetch.`);
          hasMore = false;
        }
      }

      if (allFiles.length === 0) {
        console.log('No files found in workout-images bucket.');
        imageCache.current.set(exerciseName, []);
        setImageUrls([]);
        return;
      }

      console.log('Total files fetched:', allFiles.map((f) => f.name));

      const matchingFiles = allFiles.filter((file) => {
        const fileNameWithoutExtension = file.name.replace(/\.png$/, '');
        return fileNameWithoutExtension === exerciseName || fileNameWithoutExtension.startsWith(`${exerciseName} `);
      });

      if (matchingFiles.length === 0) {
        console.log(`No matching images found for exercise: ${exerciseName}`);
        imageCache.current.set(exerciseName, []);
        setImageUrls([]);
        return;
      }

      console.log(`Matching files for ${exerciseName}:`, matchingFiles.map((f) => f.name));

      const urls = matchingFiles.map((file) => {
        const { data } = supabase.storage.from('workout-images').getPublicUrl(file.name);
        return data.publicUrl;
      });

      console.log(`Generated public URLs for ${exerciseName}:`, urls);
      imageCache.current.set(exerciseName, urls);
      setImageUrls(urls);
    } catch (err: any) {
      console.error('Error fetching images:', err.message || err);
      imageCache.current.set(exerciseName, []);
      setImageUrls([]);
    }
  };

  const storeExerciseCompletion = async (exercise: Exercise, timeSpent: number, status: 'completed' | 'skipped') => {
    if (!user) {
      console.error('No user logged in');
      return;
    }

    const effectiveDailyWorkoutId = daily_workout_id ? parseInt(daily_workout_id) : fetchedDailyWorkoutId;
    console.log('Attempting to store completion:', {
      exerciseId: exercise.id,
      exerciseName: exercise.exercise_name,
      timeSpent,
      status,
      effectiveDailyWorkoutId,
      userId: user.id,
    });

    if (!effectiveDailyWorkoutId || isNaN(effectiveDailyWorkoutId)) {
      console.warn('Cannot store exercise completion: missing valid daily_workout_id', {
        daily_workout_id,
        fetchedDailyWorkoutId,
      });
      return;
    }

    const localTimestamp = new Date()
      .toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .replace(/\//g, '-');

    try {
      // Delete existing records with the same user_id, workout_id, and completion_date
      const { error: deleteError } = await supabase
        .from('ExerciseCompletions')
        .delete()
        .eq('user_id', user.id)
        .eq('workout_id', exercise.id)
        .eq('completion_date', localTimestamp);

      if (deleteError) {
        console.error('Error deleting existing exercise completion:', deleteError.message, deleteError.details);
        throw deleteError;
      }

      // Only prevent storing completion for hold exercises if status is 'completed' and hold is in progress or rest has started
      if (status === 'completed' && !isNumericReps && (isHolding || restTimer !== null)) {
        console.log('Skipping completion storage for hold exercise: hold in progress or rest started');
        return;
      }

      // Insert the new completion record
      const { error, data } = await supabase
        .from('ExerciseCompletions')
        .insert({
          user_id: user.id,
          workout_id: exercise.id,
          daily_workout_id: effectiveDailyWorkoutId,
          completion_date: localTimestamp,
          time_spent_seconds: Math.round(timeSpent),
          calories_burned: status === 'completed' ? exercise.calories_burned : 0,
          created_at: new Date().toISOString(),
          status,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error storing exercise completion:', error.message, error.details);
      } else {
        console.log(
          `Exercise ${exercise.exercise_name} stored with status ${status} and ID ${data.id}, ${timeSpent} seconds`,
        );
        if (status === 'completed') {
          setCompletedExercises((prev) => [...prev, exercise.id]);
        }
      }
    } catch (err) {
      console.error('Unexpected error storing exercise completion:', err);
    }
  };

  const handleDonePress = () => {
    if (!currentExercise) return;
    console.log('handleDonePress:', { currentSet, isLastSet, stopwatch, totalExerciseTime });
    setIsPlaying(false);
    const newTotalTime = totalExerciseTime + stopwatch;
    setTotalExerciseTime(newTotalTime);
    setStopwatch(0);
    if (isLastSet) {
      if (isNumericReps || (!isNumericReps && !isHolding && restTimer === null)) {
        storeExerciseCompletion(currentExercise, newTotalTime, 'completed');
      }
      if (isLastExercise) {
        setIsFinished(true);
      } else {
        setIsResting(true);
        setRestTimer(currentExercise.rest_time_sec || 0);
      }
    } else {
      if (isNumericReps || (!isNumericReps && !isHolding && restTimer === null)) {
        storeExerciseCompletion(currentExercise, newTotalTime, 'completed');
      }
      setIsResting(true);
      setRestTimer(currentExercise.rest_time_sec || 0);
    }
  };

  const handleSetComplete = () => {
    if (!currentExercise) return;
    console.log('handleSetComplete:', { currentSet, isLastSet, stopwatch, totalExerciseTime });
    const newTotalTime = totalExerciseTime + stopwatch;
    setTotalExerciseTime(newTotalTime);
    setStopwatch(0);
    if (isLastSet) {
      if (isNumericReps || (!isNumericReps && !isHolding && restTimer === null)) {
        storeExerciseCompletion(currentExercise, newTotalTime, 'completed');
      }
      if (isLastExercise) {
        setIsFinished(true);
      } else {
        setIsResting(true);
        setRestTimer(currentExercise.rest_time_sec || 0);
      }
    } else {
      if (isNumericReps || (!isNumericReps && !isHolding && restTimer === null)) {
        storeExerciseCompletion(currentExercise, newTotalTime, 'completed');
      }
      setIsResting(true);
      setRestTimer(currentExercise.rest_time_sec || 0);
    }
  };

  const handleSkipExercise = async () => {
    if (!currentExercise) return;

    // Reset timers
    setCountdown(null);
    setRestTimer(null);
    setHoldTimer(null);
    setIsPlaying(false);
    setIsResting(false);
    setIsHolding(false);
    setStopwatch(0);
    setTotalExerciseTime(0);

    // If we're in the rest timer after completing all sets, skip the NEXT exercise
    if (isResting && isLastSet && !isLastExercise) {
      console.log('Skipping NEXT exercise:', {
        currentExerciseIndex,
        currentExerciseName: currentExercise.exercise_name,
        nextExerciseIndex: currentExerciseIndex + 1,
        nextExerciseName: exercises[currentExerciseIndex + 1]?.exercise_name,
      });

      // Move to the next exercise
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      const nextExercise = exercises[currentExerciseIndex + 1];

      // Store the next exercise as skipped
      if (nextExercise) {
        await storeExerciseCompletion(nextExercise, 0, 'skipped');
      }

      // Check if the next exercise is the last one
      if (currentExerciseIndex + 1 === exercises.length - 1) {
        setIsFinished(true);
      } else {
        // Move to the exercise after the skipped one
        setCurrentExerciseIndex(currentExerciseIndex + 2);
      }
    } else {
      // Otherwise, skip the current exercise (e.g., during a set or countdown)
      console.log('Skipping CURRENT exercise:', {
        currentExerciseIndex,
        exerciseName: currentExercise.exercise_name,
      });

      // Store the current exercise as skipped
      await storeExerciseCompletion(currentExercise, 0, 'skipped');

      // Advance to the next exercise or finish
      if (isLastExercise) {
        setIsFinished(true);
      } else {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
      }
    }

    setCurrentSet(1);
  };

  const handleExitPlayback = async () => {
    console.log('Exiting playback:', { currentExerciseIndex, currentSet, completedExercises, isHolding, holdTimer });

    // Clear all timers to prevent them from continuing
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (stopwatchTimerRef.current) {
      clearInterval(stopwatchTimerRef.current);
      stopwatchTimerRef.current = null;
    }
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Reset timer states
    setCountdown(null);
    setRestTimer(null);
    setHoldTimer(null);
    setIsPlaying(false);
    setIsResting(false);
    setIsHolding(false);
    setStopwatch(0);

    // If the exercise was being held, do not mark it as completed
    if (isHolding && holdTimer !== null) {
      console.log('Exercise hold interrupted, not marking as completed:', {
        exerciseName: currentExercise?.exercise_name,
        remainingHoldTime: holdTimer,
      });
      setTotalExerciseTime(0); // Reset time since the hold wasn't completed
    } else if (isPlaying && !isResting && !isHolding) {
      // If in the middle of a numeric reps exercise, mark as incomplete
      console.log('Exercise interrupted during reps, not marking as completed:', {
        exerciseName: currentExercise?.exercise_name,
        stopwatch,
      });
    }

    router.push({
      pathname: '/(screens)/Exercises',
      params: { day: day || '', source: 'ExercisePlayback' },
    });
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/Exercises',
      params: { day: day || '', source: 'ExercisePlayback' },
    });
  };

  const handleImageScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const viewSize = event.nativeEvent.layoutMeasurement.width;
    const newIndex = Math.floor(contentOffset / viewSize);
    if (newIndex !== activeImageIndex) {
      setActiveImageIndex(newIndex);
      Haptics.selectionAsync();
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FFC107';
      case 'advanced':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  // Timer Circle Progress Component
  const TimerCircle = ({ timer, maxTime }: { timer: number | null; maxTime: number }) => {
    const size = SCREEN_WIDTH * 0.32;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = timer !== null && maxTime > 0 ? (timer / maxTime) * 100 : 0;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#e45ea9" />
            <Stop offset="100%" stopColor="#EC4899" />
          </LinearGradient>
        </Defs>
        <Circle
          stroke="#E5E7EB"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {timer !== null && (
          <Circle
            stroke="url(#timerGradient)"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
    );
  };

  if (exercises.length === 0 || !currentExercise) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </Pressable>
          <Text style={styles.headerText}>No Exercises Available</Text>
        </Animated.View>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitPlayback}>
          <Text style={styles.exitButtonText}>Return to Exercises</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isFinished) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </Pressable>
          <Text style={styles.headerText}>Workout Complete!</Text>
        </Animated.View>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitPlayback}>
          <Text style={styles.exitButtonText}>Return to Exercises</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </Pressable>
          <Text style={styles.headerText}>Error Loading Workout</Text>
        </Animated.View>
        <Text style={styles.subHeader}>{error}</Text>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitPlayback}>
          <Text style={styles.exitButtonText}>Return to Exercises</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Pressable
          onPress={handleBackPress}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>{currentExercise.exercise_name}</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Image Section */}
          {imageUrls.length > 0 ? (
            <View style={styles.imageSection}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                style={[styles.imageScrollView, { height: SCREEN_HEIGHT * 0.35 }]}
              >
                {imageUrls.map((url, index) => (
                  <View key={index} style={[styles.imageContainer, { width: SCREEN_WIDTH }]}>
                    <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>

              {/* Image Pagination */}
              {imageUrls.length > 1 && (
                <View style={styles.pagination}>
                  {imageUrls.map((_, index) => (
                    <View
                      key={index}
                      style={[styles.paginationDot, index === activeImageIndex && styles.paginationDotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.noImageContainer, { height: SCREEN_HEIGHT * 0.25 }]}>
              <MaterialCommunityIcons name="image-off" size={SCREEN_WIDTH * 0.12} color="#E0E0E0" />
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}

          {/* YouTube Links Section */}
          <YouTubeLinksSection links={currentExercise.YT_links} segments={currentExercise.time_segments} />

          {/* Set Info */}
          <View style={styles.setInfoContainer}>
            <Text style={styles.setInfoText}>
              Set {currentSet} of {currentExercise.sets}
            </Text>
            {isNumericReps && (
              <Text style={styles.setInfoText}>
                Total Reps: {repsCount}
              </Text>
            )}
          </View>

          {/* Player Controls Section */}
          <View style={styles.playerControlsContainer}>
            {/* Timer Display */}
            <View style={styles.timerDisplay}>
              {countdown !== null && (
                <>
                  <TimerCircle timer={countdown} maxTime={3} />
                  <Text style={styles.timerText}>Starting in {countdown}...</Text>
                </>
              )}
              {countdown === null && isResting && (
                <>
                  <TimerCircle timer={restTimer} maxTime={currentExercise.rest_time_sec || 0} />
                  <Text style={styles.timerText}>Rest: {restTimer}s</Text>
                </>
              )}
              {countdown === null && !isResting && isHolding && (
                <>
                  <TimerCircle timer={holdTimer} maxTime={holdSeconds} />
                  <Text style={styles.timerText}>Hold: {holdTimer}s</Text>
                </>
              )}
              {countdown === null && !isResting && !isHolding && isPlaying && (
                <View style={styles.stopwatchContainer}>
                  <Text style={styles.timerText}>
                    {Math.floor(stopwatch / 60)}:{(stopwatch % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.playerButtonsContainer}>
              {isNumericReps && isPlaying && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={handleDonePress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-circle" size={SCREEN_WIDTH * 0.1} color="#fff" />
                  <Text style={styles.buttonText}>Done</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipExercise}
                activeOpacity={0.7}
              >
                <Ionicons name="play-skip-forward-circle" size={SCREEN_WIDTH * 0.1} color="#fff" />
                <Text style={styles.buttonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Exercise Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Exercise Details</Text>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="target" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
              <Text style={styles.detailLabel}>Target: </Text>
              <Text style={styles.detailValue}>{currentExercise.target_muscle}</Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="notebook" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
              <Text style={styles.detailLabel}>Type: </Text>
              <Text style={styles.detailValue}>{currentExercise.type}</Text>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="chart-bar" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
              <Text style={styles.detailLabel}>Difficulty: </Text>
              <Text style={[styles.detailValue, { color: getDifficultyColor(currentExercise.difficulty) }]}>
                {currentExercise.difficulty}
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{currentExercise.description}</Text>
          </View>

          {/* Exit Button */}
          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExitPlayback}
            activeOpacity={0.8}
          >
            <Text style={styles.exitButtonText}>Exit Playback</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  // Header Styles
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
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  subHeader: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#F44336',
    textAlign: 'center',
    marginVertical: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  // Content Styles
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
  },
  // Image Section
  imageSection: {
    marginTop: SCREEN_HEIGHT * 0.015,
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  imageScrollView: {
    // Height is set dynamically in the component
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  paginationDot: {
    width: SCREEN_WIDTH * 0.02,
    height: SCREEN_WIDTH * 0.02,
    borderRadius: SCREEN_WIDTH * 0.01,
    backgroundColor: '#D0D0D0',
    marginHorizontal: SCREEN_WIDTH * 0.01,
  },
  paginationDotActive: {
    width: SCREEN_WIDTH * 0.03,
    backgroundColor: '#e45ea9',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: SCREEN_WIDTH * 0.05,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  noImageText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#999',
    marginTop: SCREEN_HEIGHT * 0.015,
  },
  // Set Info
  setInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  setInfoText: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  // Player Controls
  playerControlsContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: SCREEN_WIDTH * 0.06,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timerDisplay: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  stopwatchContainer: {
    width: SCREEN_WIDTH * 0.32,
    height: SCREEN_WIDTH * 0.32,
    borderRadius: (SCREEN_WIDTH * 0.4) / 2,
    backgroundColor: 'white',
    borderColor: '#e45ea9',
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    position: 'absolute',
    fontSize: SCREEN_WIDTH * 0.03,
    fontWeight: '700',
    color: '#e45ea9',
    textAlign: 'center',
  },
  playerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SCREEN_WIDTH * 0.06,
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 50,
    padding: SCREEN_WIDTH * 0.03,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  skipButton: {
    backgroundColor: '#F44336',
    borderRadius: 50,
    padding: SCREEN_WIDTH * 0.03,
    alignItems: 'center',
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    marginTop: SCREEN_HEIGHT * 0.005,
  },
  // Sections
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.02,
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: SCREEN_WIDTH * 0.03,
  },
  // YouTube Links
  youtubeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  youtubeLinkText: {
    flex: 1,
    marginLeft: 10,
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#333',
  },
  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  detailLabel: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#666',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  detailValue: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#333',
    fontWeight: '500',
  },
  // Description
  descriptionText: {
    fontSize: SCREEN_WIDTH * 0.04,
    lineHeight: SCREEN_WIDTH * 0.06,
    color: '#555',
  },
  // Exit Button
  exitButton: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.02,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  exitButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ExercisePlayback;