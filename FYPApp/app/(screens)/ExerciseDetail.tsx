import React, { useEffect, useState } from 'react';
import { StyleSheet, Image, View, Text, ScrollView, TouchableOpacity, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type WorkoutPlan = {
  id: number;
  user_id: number;
};

type DailyWorkout = {
  id: number;
  workout_plan_id: number;
  WorkoutPlans: WorkoutPlan;
};

type ExerciseDetailType = {
  id: number;
  exercise_name: string;
  description: string;
  reps: string;
  calories_burned: number;
  daily_workout_id: number;
  workout_date: string | null;
  duration_min: number;
  sets: number;
  rest_time_sec: number;
  target_muscle: string | null;
  type: string;
  difficulty: string;
  caution: string | null;
  DailyWorkouts: DailyWorkout;
};

export default function ExerciseDetail() {
  const { id: idString, day, source } = useLocalSearchParams<{ id: string; day?: string; source?: string }>();
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetailType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const router = useRouter();
  const { user } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  // Get screen dimensions
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  useEffect(() => {
    if (!user || !user.id) {
      setErrorMessage('No user logged in. Redirecting to Login...');
      setTimeout(() => router.push('/Login'), 2000);
      setIsLoading(false);
      return;
    }

    if (idString) {
      const exerciseId = parseInt(idString, 10);
      if (isNaN(exerciseId)) {
        setErrorMessage('Invalid exercise ID.');
        setIsLoading(false);
        return;
      }

      const fetchData = async () => {
        try {
          await fetchExerciseDetail(exerciseId);
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
          setErrorMessage(err.message || 'Failed to load exercise details.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    } else {
      setErrorMessage('No exercise selected.');
      setIsLoading(false);
    }
  }, [idString, user, router]);

  const fetchExerciseDetail = async (exerciseId: number) => {
    const { data, error } = await supabase
      .from('Workouts')
      .select(`
        id,
        exercise_name,
        description,
        reps,
        calories_burned,
        daily_workout_id,
        workout_date,
        duration_min,
        sets,
        rest_time_sec,
        target_muscle,
        type,
        difficulty,
        caution,
        DailyWorkouts (
          id,
          workout_plan_id,
          WorkoutPlans (
            id,
            user_id
          )
        )
      `)
      .eq('id', exerciseId)
      .single();

    if (error || !data) throw new Error('Error fetching exercise detail.');

    const dailyWorkout = data.DailyWorkouts as unknown as DailyWorkout;
    if (!dailyWorkout?.WorkoutPlans?.user_id || dailyWorkout.WorkoutPlans.user_id !== parseInt(user!.id)) {
      throw new Error('You do not have permission to view this exercise.');
    }

    setExerciseDetail({
      id: data.id,
      exercise_name: data.exercise_name,
      description: data.description || 'No description available',
      reps: data.reps,
      calories_burned: data.calories_burned,
      daily_workout_id: data.daily_workout_id,
      workout_date: data.workout_date,
      duration_min: data.duration_min,
      sets: data.sets,
      rest_time_sec: data.rest_time_sec,
      target_muscle: data.target_muscle,
      type: data.type,
      difficulty: data.difficulty,
      caution: data.caution,
      DailyWorkouts: dailyWorkout,
    });

    await fetchImages(data.exercise_name);
  };

  const fetchImages = async (exerciseName: string) => {
    try {
      let allFiles: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const { data: files, error: listError } = await supabase.storage
          .from('workout-images')
          .list('', { limit, offset });

        if (listError) throw new Error('Failed to list images from storage.');

        if (!files || files.length === 0) {
          hasMore = false;
          break;
        }

        allFiles = [...allFiles, ...files];
        offset += limit;

        const matchingFiles = files.filter(file => {
          const fileNameWithoutExtension = file.name.replace(/\.png$/, '');
          return fileNameWithoutExtension === exerciseName || fileNameWithoutExtension.startsWith(`${exerciseName} `);
        });

        if (matchingFiles.length > 0) {
          hasMore = false;
        }
      }

      if (allFiles.length === 0) {
        setImageUrls([]);
        return;
      }

      const matchingFiles = allFiles.filter(file => {
        const fileNameWithoutExtension = file.name.replace(/\.png$/, '');
        return fileNameWithoutExtension === exerciseName || fileNameWithoutExtension.startsWith(`${exerciseName} `);
      });

      if (matchingFiles.length === 0) {
        setImageUrls([]);
        return;
      }

      const urls = matchingFiles.map(file => {
        const { data } = supabase.storage
          .from('workout-images')
          .getPublicUrl(file.name);
        return data.publicUrl;
      });

      setImageUrls(urls);
    } catch (err) {
      setImageUrls([]);
    }
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
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

  const renderDetailRow = (icon: React.ReactNode, label: string, value: string | number) => (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailTextContainer}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FFC107';
      case 'advanced': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { transform: [{ rotate: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg']
        }) }] }]}>
          <FontAwesome5 name="dumbbell" size={40} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your exercise...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={50} color="#e45ea9" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push({
            pathname: '/(screens)/Exercises',
            params: { day: day || '', source: source || '' },
          })}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!exerciseDetail) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="fitness-center" size={50} color="#e45ea9" />
        <Text style={styles.errorText}>Exercise details not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push({
            pathname: '/(screens)/Exercises',
            params: { day: day || '', source: source || '' },
          })}
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
        <Text style={styles.headerText}>{exerciseDetail.exercise_name}</Text>
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
          {/* Date and Muscle Group */}
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="calendar" size={SCREEN_WIDTH * 0.04} color="#888" />
              <Text style={styles.metaText}>
                {exerciseDetail.workout_date ?? 'No date'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="arm-flex" size={SCREEN_WIDTH * 0.04} color="#888" />
              <Text style={styles.metaText}>
                {exerciseDetail.target_muscle ?? 'No muscle group'}
              </Text>
            </View>
          </View>

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
                    <Image
                      source={{ uri: url }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
              
              {/* Image Pagination */}
              {imageUrls.length > 1 && (
                <View style={styles.pagination}>
                  {imageUrls.map((_, index) => (
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
            <View style={[styles.noImageContainer, { height: SCREEN_HEIGHT * 0.25 }]}>
              <MaterialCommunityIcons 
                name="image-off" 
                size={SCREEN_WIDTH * 0.12} 
                color="#E0E0E0" 
              />
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}

          {/* Difficulty Badge */}
          <View style={[
            styles.difficultyBadge,
            { backgroundColor: getDifficultyColor(exerciseDetail.difficulty) }
          ]}>
            <Text style={styles.difficultyText}>
              {exerciseDetail.difficulty}
            </Text>
          </View>

          {/* Exercise Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {exerciseDetail.description}
            </Text>
          </View>

          {/* Exercise Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Details</Text>
            {renderDetailRow(
              <MaterialCommunityIcons name="repeat" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Reps',
              exerciseDetail.reps
            )}
            {renderDetailRow(
              <MaterialCommunityIcons name="format-list-numbered" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Sets',
              exerciseDetail.sets
            )}
            {renderDetailRow(
              <MaterialCommunityIcons name="timer-sand" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Rest Time',
              `${exerciseDetail.rest_time_sec} sec`
            )}
            {renderDetailRow(
              <MaterialCommunityIcons name="clock-outline" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Duration',
              `${exerciseDetail.duration_min} min`
            )}
            {renderDetailRow(
              <MaterialCommunityIcons name="fire" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Calories Burned',
              exerciseDetail.calories_burned
            )}
          </View>

          {/* Additional Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Info</Text>
            {renderDetailRow(
              <MaterialCommunityIcons name="weight-lifter" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Type',
              exerciseDetail.type
            )}
            {renderDetailRow(
              <MaterialCommunityIcons name="target" size={SCREEN_WIDTH * 0.05} color="#e45ea9" />,
              'Primary Muscle',
              exerciseDetail.target_muscle ?? 'No muscle group'
            )}
          </View>

          {/* Caution Section */}
          {exerciseDetail.caution && (
            <View style={styles.cautionContainer}>
              <View style={styles.cautionHeader}>
                <MaterialCommunityIcons 
                  name="alert-circle" 
                  size={SCREEN_WIDTH * 0.06} 
                  color="#D32F2F" 
                />
                <Text style={styles.cautionTitle}>Important Caution</Text>
              </View>
              <Text style={styles.cautionText}>
                {exerciseDetail.caution}
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

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
    paddingHorizontal: Dimensions.get('window').width * 0.04,
    paddingVertical: Dimensions.get('window').height * 0.02,
    paddingTop: Dimensions.get('window').height * 0.03,
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
    fontSize: Dimensions.get('window').width * 0.045,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  backButton: {
    padding: Dimensions.get('window').width * 0.02,
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
    marginBottom: 20,
  },
  loadingText: {
    fontSize: Dimensions.get('window').width * 0.045,
    color: '#666',
    fontWeight: '500',
  },
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Dimensions.get('window').width * 0.075,
    backgroundColor: '#F9F9F9',
  },
  errorText: {
    fontSize: Dimensions.get('window').width * 0.045,
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: Dimensions.get('window').width * 0.065,
  },
  backButtonText: {
    color: '#fff',
    fontSize: Dimensions.get('window').width * 0.04,
    fontWeight: '600',
  },
  // Content Styles
  contentContainer: {
    paddingBottom: Dimensions.get('window').height * 0.04,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Dimensions.get('window').height * 0.02,
    marginBottom: Dimensions.get('window').height * 0.015,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Dimensions.get('window').width * 0.03,
    paddingVertical: Dimensions.get('window').width * 0.015,
    paddingHorizontal: Dimensions.get('window').width * 0.03,
    backgroundColor: '#F0F0F0',
    borderRadius: 15,
  },
  metaText: {
    fontSize: Dimensions.get('window').width * 0.035,
    color: '#666',
    marginLeft: Dimensions.get('window').width * 0.015,
  },
  // Image Section
  imageSection: {
    marginTop: Dimensions.get('window').height * 0.015,
    marginBottom: Dimensions.get('window').height * 0.025,
  },
  imageScrollView: {
    // Height is set dynamically in the component
  },
  imageContainer: {
    height: Dimensions.get('window').height * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Dimensions.get('window').width * 0.05,
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
    marginTop: Dimensions.get('window').height * 0.015,
  },
  paginationDot: {
    width: Dimensions.get('window').width * 0.02,
    height: Dimensions.get('window').width * 0.02,
    borderRadius: Dimensions.get('window').width * 0.01,
    backgroundColor: '#D0D0D0',
    marginHorizontal: Dimensions.get('window').width * 0.01,
  },
  paginationDotActive: {
    width: Dimensions.get('window').width * 0.03,
    backgroundColor: '#e45ea9',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: Dimensions.get('window').width * 0.05,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  noImageText: {
    fontSize: Dimensions.get('window').width * 0.04,
    color: '#999',
    marginTop: Dimensions.get('window').height * 0.015,
  },
  // Difficulty Badge
  difficultyBadge: {
    alignSelf: 'center',
    paddingVertical: Dimensions.get('window').width * 0.015,
    paddingHorizontal: Dimensions.get('window').width * 0.04,
    borderRadius: 20,
    marginBottom: Dimensions.get('window').height * 0.025,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  difficultyText: {
    color: 'white',
    fontWeight: '600',
    fontSize: Dimensions.get('window').width * 0.035,
    textTransform: 'uppercase',
  },
  // Sections
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Dimensions.get('window').width * 0.05,
    marginHorizontal: Dimensions.get('window').width * 0.04,
    marginBottom: Dimensions.get('window').height * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: Dimensions.get('window').width * 0.05,
    fontWeight: '700',
    color: '#333',
    marginBottom: Dimensions.get('window').height * 0.02,
    borderLeftWidth: 4,
    borderLeftColor: '#e45ea9',
    paddingLeft: Dimensions.get('window').width * 0.03,
  },
  description: {
    fontSize: Dimensions.get('window').width * 0.04,
    lineHeight: Dimensions.get('window').width * 0.06,
    color: '#555',
  },
  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Dimensions.get('window').height * 0.0175,
  },
  detailIcon: {
    width: Dimensions.get('window').width * 0.09,
    height: Dimensions.get('window').width * 0.09,
    borderRadius: Dimensions.get('window').width * 0.045,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Dimensions.get('window').width * 0.03,
  },
  detailTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: Dimensions.get('window').height * 0.01,
  },
  detailLabel: {
    fontSize: Dimensions.get('window').width * 0.04,
    color: '#666',
  },
  detailValue: {
    fontSize: Dimensions.get('window').width * 0.04,
    fontWeight: '600',
    color: '#333',
  },
  // Caution Section
  cautionContainer: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: Dimensions.get('window').width * 0.04,
    marginHorizontal: Dimensions.get('window').width * 0.04,
    marginBottom: Dimensions.get('window').height * 0.04,
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  cautionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Dimensions.get('window').height * 0.01,
  },
  cautionTitle: {
    fontSize: Dimensions.get('window').width * 0.045,
    fontWeight: '600',
    color: '#D32F2F',
    marginLeft: Dimensions.get('window').width * 0.02,
  },
  cautionText: {
    fontSize: Dimensions.get('window').width * 0.0375,
    lineHeight: Dimensions.get('window').width * 0.055,
    color: '#666',
  },
});