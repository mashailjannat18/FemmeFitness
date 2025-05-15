import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Pressable,
  Dimensions,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [showPasswordError, setShowPasswordError] = useState<boolean>(false);
  const [showConfirmError, setShowConfirmError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const { email, fromAccountInformation } = useLocalSearchParams<{
    email: string;
    fromAccountInformation: string;
  }>();
  const { resetPassword, refreshUser } = useUserAuth();
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  // Fade-in and slide-up animations
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

  const handlePasswordChange = (text: string) => {
    const trimmedText = text.trim();
    setNewPassword(trimmedText);
    setShowPasswordError(trimmedText.length > 0 && trimmedText.length < 6);
    setShowConfirmError(confirmPassword && trimmedText !== confirmPassword);
  };

  const handleConfirmChange = (text: string) => {
    const trimmedText = text.trim();
    setConfirmPassword(trimmedText);
    setShowConfirmError(trimmedText !== newPassword);
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setLoading(true);
      setShowPasswordError(false);
      setShowConfirmError(false);

      if (!newPassword || newPassword.length < 6) {
        setShowPasswordError(true);
        throw new Error('Password must be at least 6 characters long.');
      }

      if (newPassword !== confirmPassword) {
        setShowConfirmError(true);
        throw new Error('Passwords do not match.');
      }

      if (!email) {
        throw new Error('Email is missing.');
      }

      await resetPassword(email, newPassword);
      await refreshUser();

      const redirectPath = fromAccountInformation === 'true' ? '/AccountInformation' : '/Login';
      Alert.alert('Success', 'Password updated successfully.', [
        {
          text: 'OK',
          onPress: () => router.replace(redirectPath),
        },
      ]);
    } catch (err: any) {
      console.error('Password reset error:', err.message);
      Alert.alert('Error', err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e45ea9" />
        <Text style={styles.loadingText}>Updating your password...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
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
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </Pressable>
        <Text style={styles.headerText}>Reset Password</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="lock-reset"
            size={SCREEN_WIDTH * 0.15}
            color="#e45ea9"
          />
        </View>

        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subTitle}>
          Enter and confirm your new password.
        </Text>

        {(showPasswordError || showConfirmError) && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={SCREEN_WIDTH * 0.05} color="#fff" />
            <Text style={styles.errorBannerText}>
              {showPasswordError
                ? 'Password must be at least 6 characters long.'
                : 'Passwords do not match.'}
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, showPasswordError && styles.invalidInput]}
            placeholder="New Password"
            secureTextEntry={!showNewPassword}
            value={newPassword}
            onChangeText={handlePasswordChange}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowNewPassword((prev) => !prev);
            }}
          >
            <Ionicons
              name={showNewPassword ? 'eye-off' : 'eye'}
              size={SCREEN_WIDTH * 0.05}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, showConfirmError && styles.invalidInput]}
            placeholder="Confirm New Password"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={handleConfirmChange}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowConfirmPassword((prev) => !prev);
            }}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off' : 'eye'}
              size={SCREEN_WIDTH * 0.05}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              newPassword && confirmPassword && !showPasswordError && !showConfirmError
                ? null
                : styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={
              !newPassword || !confirmPassword || showPasswordError || showConfirmError
            }
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Update Password</Text>
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
  title: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.01,
  },
  subTitle: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.04,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  errorBanner: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.03,
    borderRadius: 8,
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.035,
    marginLeft: SCREEN_WIDTH * 0.02,
  },
  inputContainer: {
    marginBottom: SCREEN_HEIGHT * 0.02,
    width: '100%',
    position: 'relative',
  },
  input: {
    height: SCREEN_HEIGHT * 0.07,
    fontSize: SCREEN_WIDTH * 0.04,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingRight: SCREEN_WIDTH * 0.12,
  },
  invalidInput: {
    borderColor: '#F44336',
  },
  eyeIcon: {
    position: 'absolute',
    right: SCREEN_WIDTH * 0.04,
    top: '83%',
    transform: [{ translateY: -SCREEN_HEIGHT * 0.035 }],
  },
  buttonContainer: {
    marginBottom: SCREEN_HEIGHT * 0.02,
  },
  button: {
    backgroundColor: '#e45ea9',
    padding: SCREEN_HEIGHT * 0.02,
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
    shadowColor: '#000',
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  loadingText: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#666',
    marginTop: SCREEN_HEIGHT * 0.02,
  },
});

export default ResetPassword;