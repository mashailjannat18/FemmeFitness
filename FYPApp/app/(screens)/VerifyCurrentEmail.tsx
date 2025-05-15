import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUserAuth } from '@/context/UserAuthContext';
import { Ionicons } from '@expo/vector-icons';

const VerifyCurrentEmail: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { sendEmailVerificationCode, verifyEmailCode, resendCode } = useUserAuth();

  useEffect(() => {
    if (email) {
      sendEmailVerificationCode(email).catch((err) => {
        Alert.alert('Error', err.message || 'Failed to send verification code.');
      });
    }
  }, [email]);

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert('Error', 'Email is missing.');
      return;
    }
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await verifyEmailCode(email, code);
      router.push({ pathname: '/EnterNewEmail', params: { currentEmail: email } });
    } catch (err: any) {
      setError(err.message || 'Failed to verify code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      Alert.alert('Error', 'Email is missing.');
      return;
    }
    try {
      setResendLoading(true);
      setError('');
      await resendCode(email);
      Alert.alert('Success', 'A new code has been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleBack = () => {
    router.replace('/AccountInformation');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d63384" />
        <Text style={styles.loadingText}>Verifying your code...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Verify Current Email</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.header}>Enter Verification Code</Text>
        <Text style={styles.subHeader}>
          A 6-digit code has been sent to {email}.
        </Text>

        <TextInput
          style={[styles.input, error && styles.invalidInput]}
          placeholder="Enter 6-digit code"
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setError('');
          }}
          keyboardType="numeric"
          maxLength={6}
          autoCapitalize="none"
        />
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, code.length === 6 ? styles.activeButton : styles.disabledButton]}
            onPress={handleSubmit}
            disabled={code.length !== 6}
          >
            <Text style={styles.buttonText}>Verify Code</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resendLoading}
        >
          <Text style={styles.resendText}>
            {resendLoading ? 'Resending...' : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#d63384',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  header: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '80%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  invalidInput: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: 15,
    width: '80%',
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  activeButton: {
    backgroundColor: '#d63384',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    marginTop: 20,
  },
  resendText: {
    color: '#d63384',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
});

export default VerifyCurrentEmail;