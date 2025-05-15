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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ConfirmResetCode: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState(60); // 1 minute
  const router = useRouter();
  const { email, fromAccountInformation } = useLocalSearchParams<{ email: string; fromAccountInformation: string }>();
  const { verifyResetCode, resendCode } = useUserAuth();
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

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const cooldownTimer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(cooldownTimer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    if (timeLeft <= 0) {
      setError('Confirmation code has expired.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!email) {
        throw new Error('Email is missing.');
      }

      await verifyResetCode(email, code);

      router.push({
        pathname: '/ResetPassword',
        params: { email: email.trim(), fromAccountInformation },
      });
    } catch (err: any) {
      console.error('Verification error:', err.message);
      setError(err.message || 'Invalid or expired confirmation code.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(screens)/ForgotPassword');
  };

  const handleResend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setResendLoading(true);
      setError(null);
      setTimeLeft(600);
      setResendCooldown(60);

      if (!email) {
        throw new Error('Email is missing.');
      }

      await resendCode(email);
    } catch (err: any) {
      console.error('Resend error:', err.message);
      if (err.message === 'Maximum resend attempts reached. Please restart the process.') {
        router.push({
          pathname: '/ForgotPassword',
          params: { fromAccountInformation },
        });
      }
      setError(err.message || 'Failed to resend confirmation code.');
    } finally {
      setResendLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e45ea9" />
        <Text style={styles.loadingText}>Verifying your code...</Text>
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
        <Text style={styles.headerText}>Verify Reset Code</Text>
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
            name="lock-check"
            size={SCREEN_WIDTH * 0.15}
            color="#e45ea9"
          />
        </View>

        <Text style={styles.title}>Enter Confirmation Code</Text>
        <Text style={styles.subTitle}>
          We sent a 6-digit code to {email}. It expires in{' '}
          {Math.floor(timeLeft / 60)}:
          {(timeLeft % 60).toString().padStart(2, '0')}
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={SCREEN_WIDTH * 0.05} color="#fff" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.codeInputContainer}>
          <TextInput
            style={[styles.codeInput, error && styles.invalidInput]}
            placeholder="Enter 6-digit code"
            keyboardType="numeric"
            maxLength={6}
            value={code}
            onChangeText={(text) => {
              setCode(text.trim());
              setError(null);
            }}
            textAlign="center"
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              code.length === 6 && timeLeft > 0 ? null : styles.disabledButton,
            ]}
            onPress={handleVerify}
            disabled={code.length !== 6 || timeLeft <= 0 || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Verify</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resendContainer}
          onPress={handleResend}
          disabled={resendLoading || resendCooldown > 0}
        >
          {resendLoading ? (
            <ActivityIndicator size="small" color="#e45ea9" />
          ) : (
            <Text
              style={[
                styles.resendText,
                resendCooldown > 0
                  ? styles.resendTextDisabled
                  : styles.resendTextActive,
              ]}
            >
              {resendCooldown > 0
                ? `Resend Code (${resendCooldown}s)`
                : 'Resend Code'}
            </Text>
          )}
        </TouchableOpacity>
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
  codeInputContainer: {
    marginBottom: SCREEN_HEIGHT * 0.03,
  },
  codeInput: {
    height: SCREEN_HEIGHT * 0.07,
    fontSize: SCREEN_WIDTH * 0.05,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
  },
  invalidInput: {
    borderColor: '#F44336',
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
  resendContainer: {
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.02,
  },
  resendText: {
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '500',
  },
  resendTextActive: {
    color: '#e45ea9',
  },
  resendTextDisabled: {
    color: '#a9a9a9',
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

export default ConfirmResetCode;