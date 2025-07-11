import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Easing,
  Dimensions,
  Pressable,
  RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { 
  MaterialIcons, 
  Ionicons, 
  MaterialCommunityIcons,
  FontAwesome5 
} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Logo from '@/assets/images/Logo.png';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const Profile = () => {
  const router = useRouter();
  const { user, logout, loading: authLoading, isLoggedIn } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [bmi, setBmi] = useState<number | null>(null);
  const [bmiCategory, setBmiCategory] = useState<string>('');
  const [displayHeight, setDisplayHeight] = useState<any>();
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (user?.id) {
      setRefreshing(true);
      try {
        const { data, error } = await supabase
          .from('User')
          .select('height, weight')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setUserData(data);
          const heightInInches = parseHeightInput(data.height);
          const calculatedBmi = calculateBMI(heightInInches, data.weight);
          setBmi(calculatedBmi);
          setBmiCategory(getBmiCategory(calculatedBmi));
          
          // Store the parsed height for display
          setDisplayHeight({
            feet: Math.floor(heightInInches / 12),
            inches: heightInInches % 12
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setRefreshing(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
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
      ]).start(() => setLoading(false));
    }
  }, [authLoading]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace('/Login');
    }
  }, [authLoading, isLoggedIn, router]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  const onRefresh = useCallback(async () => {
    await fetchUserData();
  }, [fetchUserData]);

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await logout();
      await new Promise(resolve => setTimeout(resolve, 100)); // Slight delay
      router.replace('/Login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Function to calculate BMI
  const calculateBMI = (heightInInches: number, weightInKg: number): number => {
    if (!heightInInches || !weightInKg) return 0;
    // Convert inches to meters (1 inch = 0.0254 meters)
    const heightInMeters = heightInInches * 0.0254;
    // Calculate BMI (weight in kg / (height in m)^2)
    return parseFloat((weightInKg / (heightInMeters * heightInMeters)).toFixed(1));
  };

  // Parse height input in feet (e.g., 5.1 for 5 feet 1 inch) to total inches
  const parseHeightInput = (heightInput: string | number): number => {
    const heightNum = parseFloat(String(heightInput));
    if (isNaN(heightNum)) return 0;

    // Split into whole feet and decimal (representing inches)
    const feet = Math.floor(heightNum); // Whole feet
    const decimalInches = (heightNum - feet) * 10; // Convert decimal to inches (e.g., 0.1 feet = 1 inch)
    return (feet * 12) + decimalInches; // Total inches
  };

  // Helper function to format height for display
  const formatHeightDisplay = (totalInches: number): string => {
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}ft ${inches}in`;
  };

  // Function to get BMI category
  const getBmiCategory = (bmiValue: number): string => {
    if (bmiValue < 16.0) return "Severely Underweight";
    else if (bmiValue < 17.0) return "Moderately Underweight";
    else if (bmiValue < 18.5) return "Mildly Underweight";
    else if (bmiValue < 25.0) return "Normal";
    else if (bmiValue < 30.0) return "Overweight";
    else if (bmiValue < 35.0) return "Obese (Class I)";
    else if (bmiValue < 40.0) return "Obese (Class II)";
    else return "Obese (Class III)";
  };

  // Function to get gradient colors based on BMI
  const getBmiGradient = (bmiValue: number): string[] => {
    if (bmiValue < 18.5) return ['#4FC3F7', '#23566d'];
    else if (bmiValue < 25.0) return ['#66BB6A', '#235c26'];
    else if (bmiValue < 30.0) return ['#FFA726', '#714a12'];
    else return ['#EF5350', '#782726'];
  };

  // Add these helper functions
  const getBmiColor = (bmiValue: number): string => {
    if (bmiValue < 18.5) return '#4FC3F7';
    else if (bmiValue < 25.0) return '#66BB6A';
    else if (bmiValue < 30.0) return '#FFA726';
    else return '#EF5350';
  };

  const bmiProgressRotation = (bmi: number): string => {
    const clampedBmi = Math.min(Math.max(bmi, 16), 40);
    const rotation = ((clampedBmi - 16) / (40 - 16)) * 360;
    return `${rotation}deg`;
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/Home');
  };

  const profileOptions = [
    { 
      label: 'Account Information', 
      route: '/(screens)/AccountInformation', 
      icon: 'account-circle',
      color: '#ff1297',
      description: 'View and update your account details'
    },
    { 
      label: 'Personal Information', 
      route: '/(screens)/PersonalInformation', 
      icon: 'account-details',
      color: '#4CAF50',
      description: 'Update your personal details'
    },
    { 
      label: 'Health Information', 
      route: '/(screens)/DiseaseInformation', 
      icon: 'heart-pulse',
      color: '#F44336',
      description: 'Manage your health conditions'
    },
    { 
      label: 'Workout Preferences', 
      route: '/(screens)/IntensitySetting', 
      icon: 'dumbbell',
      color: '#FF9800',
      description: 'Customize workout intensity'
    },
    { 
      label: 'Notifications', 
      route: '/(screens)/Reminder', 
      icon: 'bell',
      color: '#9C27B0',
      description: 'Manage your reminders'
    },
  ] as const;

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingAnimation, { transform: [{ rotate: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg']
        }) }] }]}>
          <FontAwesome5 name="user-cog" size={SCREEN_WIDTH * 0.1} color="#e45ea9" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.headerContainer, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }]}>
          <Pressable 
            onPress={handleBackPress} 
            style={({ pressed }: { pressed: boolean }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 }
            ]}
          >
            <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
          </Pressable>
          <Text style={styles.headerText}>Profile</Text>
          <View style={{ width: SCREEN_WIDTH * 0.05 }} />
        </Animated.View>

        <View style={styles.errorContainer}>
          <MaterialCommunityIcons 
            name="account-alert" 
            size={SCREEN_WIDTH * 0.15} 
            color="#e45ea9" 
          />
          <Text style={styles.errorText}>Please log in to view your profile</Text>
          <TouchableOpacity
            style={styles.backButton1}
            onPress={() => router.replace('/Login')}
          >
            <Text style={styles.backButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
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
        <Image source={Logo} style={styles.logo} />
        <Text style={styles.headerText}>Profile</Text>
        <Text style={styles.usernameText}>{user?.username || "User"}</Text>
      </Animated.View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e45ea9"
            colors={['#e45ea9']}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.inlineCardsContainer}>
            <View style={styles.userInfoCard}>
              <FontAwesome5
                name="user-alt"
                size={SCREEN_WIDTH * 0.12}
                color="#e45ea9"
                style={styles.userIcon}
              />
              <View style={styles.userTextContainer}>
                <Text style={styles.userName}>{user?.username || "User"}</Text>
                <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">
                  {user?.email || "No email"}
                </Text>
              </View>
            </View>

            <View style={styles.bmiCard}>
              <View style={styles.bmiContainer}>
                {/* Background track (full circle) */}
                <View style={[
                  styles.bmiProgressTrack,
                  { borderColor: bmi ? `${getBmiColor(bmi)}20` : '#f0f0f0' } // 20 = 12.5% opacity
                ]} />
                
                {/* Colored progress ring */}
                {bmi && (
                  <Animated.View style={[
                    styles.bmiProgressFill,
                    {
                      borderTopColor: getBmiColor(bmi),
                      borderRightColor: bmi > 25 ? getBmiColor(bmi) : 'transparent',
                      borderBottomColor: bmi > 30 ? getBmiColor(bmi) : 'transparent',
                      borderLeftColor: bmi > 35 ? getBmiColor(bmi) : 'transparent',
                      transform: [
                        { rotate: bmiProgressRotation(bmi) }
                      ]
                    }
                  ]} />
                )}
                
                {/* Inner circle with gradient */}
                <LinearGradient
                  colors={bmi ? getBmiGradient(bmi) : ['#9E9E9E', '#757575']}
                  style={styles.bmiInnerCircle}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.bmiValue}>{bmi || '--'}</Text>
                  <Text style={styles.bmiLabel}>BMI</Text>
                </LinearGradient>
              </View>

              {/* BMI category and details */}
              <Text style={styles.bmiCategory}>{bmiCategory || 'Unknown'}</Text>
              {userData && (
                <Text style={styles.bmiDetails}>
                  {userData?.height ? formatHeightDisplay(parseHeightInput(userData.height)) : '--'} •{' '}
                  {userData?.weight ? `${userData.weight} kg` : '--'}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Settings</Text>
            {profileOptions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(item.route);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.optionIcon, { backgroundColor: item.color }]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={SCREEN_WIDTH * 0.06}
                    color="#fff"
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>{item.label}</Text>
                  <Text style={styles.optionDescription}>{item.description}</Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={SCREEN_WIDTH * 0.06}
                  color="#9E9E9E"
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="logout"
              size={SCREEN_WIDTH * 0.05}
              color="#fff"
              style={styles.logoutIcon}
            />
            <Text style={styles.logoutButtonText}>Log Out</Text>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.043,
    paddingVertical: SCREEN_HEIGHT * 0.015,
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
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  logo: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: SCREEN_WIDTH * 0.05,
    marginRight: SCREEN_WIDTH * 0.023,
  },
  usernameText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#fff',
    fontWeight: '600',
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
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
  contentContainer: {
    paddingBottom: SCREEN_HEIGHT * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.02,
    marginTop: SCREEN_HEIGHT * 0.02,
    marginBottom: SCREEN_HEIGHT * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: SCREEN_WIDTH * 0.04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: SCREEN_WIDTH * 0.2,
    height: SCREEN_WIDTH * 0.2,
    marginTop: SCREEN_HEIGHT * 0.02,
    marginLeft: SCREEN_WIDTH * 0.04,
  },
  profileInfo: {
    flex: 1,
    marginLeft: -(SCREEN_WIDTH * 0.04),
  },
  profileName: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  profileEmail: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
  },
  inlineCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SCREEN_HEIGHT * 0.02,
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  userInfoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginRight: SCREEN_WIDTH * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bmiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginLeft: SCREEN_WIDTH * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bmiContainer: {
    width: SCREEN_WIDTH * 0.32,  // Slightly larger to accommodate ring
    height: SCREEN_WIDTH * 0.32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bmiProgressTrack: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: SCREEN_WIDTH * 0.16,
    borderWidth: 10,  // Thicker border
    borderColor: '#f0f0f0',
  },
  bmiProgressFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: SCREEN_WIDTH * 0.16,
    borderWidth: 10,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transformOrigin: 'center center',
  },
  bmiInnerCircle: {
    width: SCREEN_WIDTH * 0.22,  // Adjusted to fit new ring size
    height: SCREEN_WIDTH * 0.22,
    borderRadius: SCREEN_WIDTH * 0.11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bmiVisualization: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_WIDTH * 0.3,
    marginBottom: 12,
  },
  bmiOuterCircle: {
    width: '100%',
    height: '100%',
    borderRadius: SCREEN_WIDTH * 0.15,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  bmiValue: {
    fontSize: SCREEN_WIDTH * 0.06,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bmiLabel: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#fff',
    marginTop: -4,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bmiCategory: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  bmiDetails: {
    fontSize: SCREEN_WIDTH * 0.032,
    color: '#666',
    textAlign: 'center',
  },
  bmiCircleContainer: {
    width: SCREEN_WIDTH * 0.25,
    height: SCREEN_WIDTH * 0.25,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  bmiProgressBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: SCREEN_WIDTH * 0.125,
    borderWidth: SCREEN_WIDTH * 0.01,
    borderColor: '#f0f0f0',
  },
  bmiProgress: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    left: '50%',
    top: 0,
    borderRadius: SCREEN_WIDTH * 0.125,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transformOrigin: 'left center',
  },
  bmiCircle: {
    width: SCREEN_WIDTH * 0.2,
    height: SCREEN_WIDTH * 0.2,
    borderRadius: SCREEN_WIDTH * 0.1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bmiScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SCREEN_HEIGHT * 0.01,
  },
  bmiScaleText: {
    fontSize: SCREEN_WIDTH * 0.025,
    fontWeight: '600',
  },
  userIcon: {
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  userTextContainer: {
    alignItems: 'center',
  },
  userName: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '700',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  userEmail: {
    fontSize: SCREEN_WIDTH * 0.03,
    color: '#666',
    maxWidth: '100%',
  },
  section: {
    marginBottom: SCREEN_HEIGHT * 0.02,
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.015,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  optionIcon: {
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.1,
    borderRadius: SCREEN_WIDTH * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SCREEN_WIDTH * 0.04,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
    color: '#333',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  optionDescription: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SCREEN_HEIGHT * 0.015,
    borderRadius: 25,
    marginTop: SCREEN_HEIGHT * 0.02,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  logoutIcon: {
    marginRight: SCREEN_WIDTH * 0.02,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
});

export default Profile;