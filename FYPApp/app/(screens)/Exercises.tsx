import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Pressable, 
  Image, 
  ScrollView, 
  Animated, 
  Easing, 
  Dimensions 
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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
  daily_workout_id: number;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Exercises: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyWorkoutId, setDailyWorkoutId] = useState<number | null>(null);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<number[]>([]);
  const [skippedExerciseIds, setSkippedExerciseIds] = useState<number[]>([]);
  const [isCurrentDay, setIsCurrentDay] = useState(false);
  const [focusAreaImages, setFocusAreaImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { user } = useUserAuth();
  const router = useRouter();
  const { day, source } = useLocalSearchParams<{ day?: string; source?: string }>();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const imageCache = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (user?.id && day) {
      fetchExercises();
    } else {
      console.log('Cannot fetch exercises: user.id or day is missing', { userId: user?.id, day });
      setLoading(false);
    }
  }, [user?.id, day]);

  const fetchExercises = async () => {
    try {
      if (!user?.id) throw new Error('No user logged in');

      const userId = user.id;

      const { data: planData, error: planError } = await supabase
        .from('WorkoutPlans')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (planError || !planData) throw new Error('No active workout plan found for user ' + userId);

      const { data: dailyData, error: dailyError } = await supabase
        .from('DailyWorkouts')
        .select('id, daily_workout_date, focus')
        .eq('workout_plan_id', planData.id)
        .eq('day_name', day)
        .single();

      if (dailyError || !dailyData) throw new Error(`No daily workout found for day ${day}`);

      setDailyWorkoutId(dailyData.id);

      if (dailyData.focus) {
        fetchFocusAreaImages(dailyData.focus);
      } else {
        setFocusAreaImages([]);
      }

      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      const workoutDate = dailyData.daily_workout_date.split('T')[0];
      setIsCurrentDay(today === workoutDate);

      const { data, error } = await supabase
        .from('Workouts')
        .select('*')
        .eq('daily_workout_id', dailyData.id);

      if (error) throw new Error('Error fetching exercises');

      if (data && data.length > 0) {
        const exercisesWithDailyWorkoutId = data.map((exercise) => ({
          ...exercise,
          daily_workout_id: dailyData.id,
        }));
        setExercises(exercisesWithDailyWorkoutId as Exercise[]);
      } else {
        setExercises([]);
      }

      const { data: completions, error: completionError } = await supabase
        .from('ExerciseCompletions')
        .select('workout_id, status')
        .eq('daily_workout_id', dailyData.id)
        .eq('user_id', userId)
        .gte('completion_date', new Date().toISOString().split('T')[0]);

      if (!completionError) {
        setCompletedExerciseIds(completions?.filter((c) => c.status === 'completed').map((c) => c.workout_id) || []);
        setSkippedExerciseIds(completions?.filter((c) => c.status === 'skipped').map((c) => c.workout_id) || []);
      }

      // Animate on successful load
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
    } catch (err: any) {
      console.error('Error in fetchExercises:', err.message || err);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFocusAreaImages = async (focus: string) => {
    try {
      console.log(`Fetching focus area images for focus: ${focus}`);
  
      // Check cache first
      if (imageCache.current.has(focus)) {
        console.log(`Using cached images for focus: ${focus}`);
        setFocusAreaImages(imageCache.current.get(focus)!);
        return;
      }
  
      let allFiles: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;
  
      while (hasMore) {
        const { data: files, error: listError } = await supabase.storage
          .from('focus-area-images')
          .list('', { limit, offset });
  
        if (listError) {
          console.error('Error listing files in focus-area-images bucket:', listError.message);
          throw new Error('Failed to list images from storage.');
        }
  
        if (!files || files.length === 0) {
          console.log(`No more files found at offset ${offset}.`);
          hasMore = false;
          break;
        }
  
        console.log(`Fetched batch at offset ${offset}:`, files.map(f => f.name));
        allFiles = [...allFiles, ...files];
        offset += limit;
  
        const matchingFiles = files.filter(file => {
          const fileNameWithoutExtension = file.name.replace(/\.png$/, '');
          return fileNameWithoutExtension === focus || fileNameWithoutExtension.startsWith(`${focus} `);
        });
  
        if (matchingFiles.length > 0) {
          console.log(`Found matching images in batch at offset ${offset - limit}, stopping fetch.`);
          hasMore = false;
        }
      }
  
      if (allFiles.length === 0) {
        console.log('No files found in focus-area-images bucket.');
        imageCache.current.set(focus, []);
        setFocusAreaImages([]);
        return;
      }
  
      console.log('Total files fetched:', allFiles.map(f => f.name));
  
      const matchingFiles = allFiles.filter(file => {
        const fileNameWithoutExtension = file.name.replace(/\.png$/, '');
        return fileNameWithoutExtension === focus || fileNameWithoutExtension.startsWith(`${focus} `);
      });
  
      if (matchingFiles.length === 0) {
        console.log(`No matching images found for focus: ${focus}`);
        imageCache.current.set(focus, []);
        setFocusAreaImages([]);
        return;
      }
  
      console.log(`Matching files for focus ${focus}:`, matchingFiles.map(f => f.name));
  
      const urls = matchingFiles.map(file => {
        const { data } = supabase.storage
          .from('focus-area-images')
          .getPublicUrl(file.name);
        return data.publicUrl;
      });
  
      console.log(`Generated public URLs for focus ${focus}:`, urls);
      imageCache.current.set(focus, urls);
      setFocusAreaImages(urls);
    } catch (err: any) {
      console.error('Error fetching focus area images:', err.message || err);
      imageCache.current.set(focus, []);
      setFocusAreaImages([]);
    }
  };

  const handleExercisePress = (exerciseId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(screens)/ExerciseDetail',
      params: { id: exerciseId.toString(), day: day || '', source: source || '' },
    });
  };

  const structureExerciseWithRestTimers = (exercise: Exercise) => {
    const sets = exercise.sets;
    const structuredSets = [];
    for (let i = 0; i < sets; i++) {
      structuredSets.push({
        set: i + 1,
        reps: exercise.reps,
        rest_time_sec: exercise.rest_time_sec,
      });
    }
    return {
      ...exercise,
      structuredSets,
    };
  };

  const handlePlayAll = () => {
    if (!dailyWorkoutId) return; // Already has this check
    const structuredExercises = exercises.map(structureExerciseWithRestTimers);
    router.push({
      pathname: '/(screens)/ExercisePlayback',
      params: {
        exercises: JSON.stringify(structuredExercises),
        day: day || '',
        daily_workout_id: dailyWorkoutId.toString(),
        startIndex: '0',
      },
    });
  };

  const handleResume = () => {
    if (!dailyWorkoutId) return;
    const startIndex = exercises.findIndex((ex) => !completedExerciseIds.includes(ex.id) && !skippedExerciseIds.includes(ex.id));
    const structuredExercises = exercises.map(structureExerciseWithRestTimers);
    router.push({
      pathname: '/(screens)/ExercisePlayback',
      params: {
        exercises: JSON.stringify(structuredExercises),
        day: day || '',
        daily_workout_id: dailyWorkoutId.toString(),
        startIndex: startIndex >= 0 ? startIndex.toString() : '0',
      },
    });
  };

  const handleRestart = async () => {
    if (!dailyWorkoutId || !user?.id) return;
    try {
      const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      
      const { data, error } = await supabase
        .rpc('delete_exercise_completions', {
          daily_workout_id_input: dailyWorkoutId,
          user_id_input: user.id,
          completion_date_input: today,
        });
  
      if (error) return;
  
      setCompletedExerciseIds([]);
      setSkippedExerciseIds([]);
      handlePlayAll();
    } catch (err) {
      console.error('Unexpected error in handleRestart:', err);
    }
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (source === 'Home') {
      router.push('/(tabs)/Home');
    } else {
      router.push('/(tabs)/Workouts');
    }
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
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FFC107';
      case 'advanced': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={[
        styles.exerciseCard,
        completedExerciseIds.includes(item.id) && styles.completedExercise,
        skippedExerciseIds.includes(item.id) && styles.skippedExercise,
      ]}
      onPress={() => handleExercisePress(item.id)}
      activeOpacity={0.8}
    >
      <Text style={styles.exerciseName}>{item.exercise_name}</Text>
      
      <View style={styles.exerciseDetailRow}>
        <MaterialCommunityIcons name="target" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
        <Text style={styles.exerciseDetailLabel}>Target: </Text>
        <Text style={styles.exerciseDetailValue}>{item.target_muscle}</Text>
      </View>
      
      <View style={styles.exerciseDetailRow}>
        <MaterialCommunityIcons name="notebook" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
        <Text style={styles.exerciseDetailLabel}>Type: </Text>
        <Text style={styles.exerciseDetailValue}>{item.type}</Text>
      </View>
      
      <View style={styles.exerciseDetailRow}>
        <MaterialCommunityIcons name="chart-bar" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
        <Text style={styles.exerciseDetailLabel}>Difficulty: </Text>
        <Text style={[styles.exerciseDetailValue, { color: getDifficultyColor(item.difficulty) }]}>
          {item.difficulty}
        </Text>
      </View>
      
      <View style={styles.exerciseDetailRow}>
        <MaterialCommunityIcons name="repeat" size={SCREEN_WIDTH * 0.04} color="#e45ea9" />
        <Text style={styles.exerciseDetailLabel}>Sets/Reps: </Text>
        <Text style={styles.exerciseDetailValue}>{item.sets} x {item.reps}</Text>
      </View>
      
      {completedExerciseIds.includes(item.id) && (
        <View style={styles.statusContainer}>
          <Ionicons name="checkmark-circle" size={SCREEN_WIDTH * 0.04} color="#4CAF50" />
          <Text style={styles.completedText}>Completed</Text>
        </View>
      )}
      {skippedExerciseIds.includes(item.id) && (
        <View style={styles.statusContainer}>
          <Ionicons name="close-circle" size={SCREEN_WIDTH * 0.04} color="#F44336" />
          <Text style={styles.skippedText}>Skipped</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const allExercisesDone = exercises.length > 0 && exercises.every((ex) => completedExerciseIds.includes(ex.id) || skippedExerciseIds.includes(ex.id));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { transform: [{ rotate: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg']
        }) }] }]}>
          <FontAwesome5 name="dumbbell" size={SCREEN_WIDTH * 0.1} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your workout...</Text>
      </View>
    );
  }

  if (exercises.length === 0 && !loading) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="fitness-center" size={SCREEN_WIDTH * 0.15} color="#e45ea9" />
        <Text style={styles.errorText}>No exercises found for this day</Text>
        <TouchableOpacity
          style={styles.backButton1}
          onPress={handleBackPress}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
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
        <Text style={styles.headerText}>{day || 'Workout Day'}</Text>
        <View style={{ width: SCREEN_WIDTH * 0.05 }} />
      </Animated.View>

      {/* Main Content */}
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          {/* Focus Area Images */}
          {focusAreaImages.length > 0 ? (
            <View style={styles.imageSection}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                style={[styles.imageScrollView, { height: SCREEN_HEIGHT * 0.25 }]}
              >
                {focusAreaImages.map((url, index) => (
                  <View key={index} style={[styles.imageContainer, { width: SCREEN_WIDTH }]}>
                    <Image
                      source={{ uri: url }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </ScrollView>
              
              {/* Image Pagination */}
              {focusAreaImages.length > 1 && (
                <View style={styles.pagination}>
                  {focusAreaImages.map((_, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.paginationDot,
                        index === activeImageIndex && styles.paginationDotActive
                      ]} 
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.noImageContainer, { height: SCREEN_HEIGHT * 0.2 }]}>
              <MaterialCommunityIcons 
                name="image-off" 
                size={SCREEN_WIDTH * 0.12} 
                color="#E0E0E0" 
              />
              <Text style={styles.noImageText}>No focus area images</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {completedExerciseIds.length > 0 || skippedExerciseIds.length > 0 ? (
              <>
                {!allExercisesDone && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.resumeButton]}
                    onPress={handleResume}
                    disabled={!dailyWorkoutId}
                  >
                    <MaterialCommunityIcons 
                      name="play-circle" 
                      size={SCREEN_WIDTH * 0.05} 
                      color="#fff" 
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.actionButtonText}>Resume</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.restartButton]}
                  onPress={handleRestart}
                  disabled={!dailyWorkoutId}
                >
                  <MaterialCommunityIcons 
                    name="reload" 
                    size={SCREEN_WIDTH * 0.05} 
                    color="#fff" 
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.actionButtonText}>Restart</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  styles.playButton,
                  (!dailyWorkoutId) && styles.disabledButton
                ]}
                onPress={handlePlayAll}
                disabled={!dailyWorkoutId}
              >
                <MaterialCommunityIcons 
                  name="play" 
                  size={SCREEN_WIDTH * 0.05} 
                  color={(!dailyWorkoutId) ? "#aaa" : "#fff"} 
                  style={styles.buttonIcon}
                />
                <Text style={[
                  styles.actionButtonText,
                  (!dailyWorkoutId) && { color: "#aaa" }
                ]}>
                  Play All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Exercises List */}
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Today's Exercises</Text>
            <FlatList
              data={exercises}
              renderItem={renderExercise}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          </View>
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
  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  loadingAnimation: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  loadingText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#666',
    fontWeight: '500',
  },
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.075,
    backgroundColor: '#F9F9F9',
  },
  errorText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: '#333',
    textAlign: 'center',
    marginVertical: SCREEN_HEIGHT * 0.02,
    lineHeight: SCREEN_WIDTH * 0.065,
  },
  backButton1: {
    backgroundColor: '#e45ea9',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.02,
    shadowColor: '#e45ea9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  backButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  // Content Styles
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
  },
  // Image Section
  imageSection: {
    marginTop: SCREEN_HEIGHT * 0.015,
    marginBottom: SCREEN_HEIGHT * 0.02,
    height: 250,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.01,
  },
  image: {
    width: '50%',
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
  // Button Container
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.06,
    borderRadius: 25,
    marginHorizontal: SCREEN_WIDTH * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  playButton: {
    backgroundColor: '#e45ea9',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  restartButton: {
    backgroundColor: '#FF7043',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  buttonIcon: {
    marginRight: SCREEN_WIDTH * 0.01,
  },
  // List Styles
  listContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  listTitle: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingLeft: SCREEN_WIDTH * 0.02,
  },
  listContent: {
    paddingBottom: SCREEN_HEIGHT * 0.02,
  },
  // Exercise Card
  exerciseCard: {
    backgroundColor: '#fff',
    padding: SCREEN_WIDTH * 0.04,
    borderRadius: 12,
    marginBottom: SCREEN_HEIGHT * 0.015,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  completedExercise: {
    backgroundColor: '#FCE7F3',
  },
  skippedExercise: {
    backgroundColor: '#FFE4E1',
  },
  exerciseName: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  exerciseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT * 0.008,
  },
  exerciseDetailLabel: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#666',
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  exerciseDetailValue: {
    fontSize: SCREEN_WIDTH * 0.038,
    color: '#333',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  completedText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.015,
  },
  skippedText: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#F44336',
    fontWeight: '600',
    marginLeft: SCREEN_WIDTH * 0.015,
  },
});

export default Exercises;