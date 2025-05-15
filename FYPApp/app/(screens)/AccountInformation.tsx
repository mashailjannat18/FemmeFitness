import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { useUserAuth } from '@/context/UserAuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter, Link } from 'expo-router';
import Logo from '@/assets/images/Logo.png';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AccountInformation = () => {
  const { user, refreshUser } = useUserAuth();
  const router = useRouter();
  const [editField, setEditField] = useState<string | null>(null);
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempValue, setTempValue] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleEdit = (field: string, currentValue: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (field === 'email') {
      router.push({ pathname: '/VerifyCurrentEmail', params: { email: user?.email || '' } });
      return;
    }
    setEditField(field);
    setTempValue(field === 'password' ? '' : currentValue);
    if (field === 'password') {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditField(null);
    setTempValue('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSave = async (field: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user?.id) {
      Alert.alert('Error', 'No user logged in.');
      return;
    }

    try {
      let updateData: { [key: string]: string } = {};
      let trimmedValue = tempValue.trim();

      if (field === 'username') {
        if (!trimmedValue) {
          Alert.alert('Error', 'Username cannot be empty.');
          return;
        }
        const { data: existingUser } = await supabase
          .from('User')
          .select('id')
          .eq('username', trimmedValue.toLowerCase())
          .neq('id', user.id)
          .single();
        if (existingUser) {
          Alert.alert('Error', 'This username is already taken.');
          return;
        }
        updateData.username = trimmedValue.toLowerCase();
      } else if (field === 'password') {
        const { data: userData, error: fetchError } = await supabase
          .from('User')
          .select('password')
          .eq('id', user.id)
          .single();
        if (fetchError || !userData) {
          throw new Error('Failed to fetch user data.');
        }
        if (userData.password !== oldPassword) {
          Alert.alert('Error', 'Old password is incorrect.');
          return;
        }
        if (!newPassword || newPassword.length < 6) {
          Alert.alert('Error', 'New password must be at least 6 characters long.');
          return;
        }
        if (newPassword !== confirmPassword) {
          Alert.alert('Error', 'New password and confirm password do not match.');
          return;
        }
        updateData.password = newPassword;
      }

      const { error } = await supabase
        .from('User')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        throw new Error('Failed to update user information: ' + error.message);
      }

      await refreshUser();

      if (field === 'username') setUsername(trimmedValue);
      setEditField(null);
      setTempValue('');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert('Success', 'Information updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update information.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={SCREEN_WIDTH * 0.06} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Account Settings</Text>
        <View style={{ width: SCREEN_WIDTH * 0.06 }} />
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Username Card */}
          <View style={styles.card1}>
            <View style={styles.cardHeader}>
              <FontAwesome
                name="user-circle"
                size={SCREEN_WIDTH * 0.06}
                color="#e45ea9"
              />
              <Text style={styles.cardTitle}>Username</Text>
              {editField !== 'username' && (
                <TouchableOpacity
                  onPress={() => handleEdit('username', username)}
                  style={styles.editButton}
                >
                  <MaterialIcons
                    name="edit"
                    size={SCREEN_WIDTH * 0.05}
                    color="#e45ea9"
                  />
                </TouchableOpacity>
              )}
            </View>

            {editField === 'username' ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.input}
                  value={tempValue}
                  onChangeText={setTempValue}
                  autoCapitalize="none"
                  placeholder="Enter new username"
                />
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancel}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={() => handleSave('username')}
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.cardValue}>{username}</Text>
            )}
          </View>

          {/* Password Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons
                name="lock"
                size={SCREEN_WIDTH * 0.06}
                color="#e45ea9"
              />
              <Text style={styles.cardTitle}>Password</Text>
              {editField !== 'password' && (
                <TouchableOpacity
                  onPress={() => handleEdit('password', '')}
                  style={styles.editButton}
                >
                  <MaterialIcons
                    name="edit"
                    size={SCREEN_WIDTH * 0.05}
                    color="#e45ea9"
                  />
                </TouchableOpacity>
              )}
            </View>

            {editField === 'password' ? (
              <View style={styles.editContainer}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry={!showOldPassword}
                    placeholder="Current Password"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowOldPassword(!showOldPassword);
                    }}
                  >
                    <Ionicons
                      name={showOldPassword ? 'eye-off' : 'eye'}
                      size={SCREEN_WIDTH * 0.05}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    placeholder="New Password"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowNewPassword(!showNewPassword);
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
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Confirm New Password"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowConfirmPassword(!showConfirmPassword);
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
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancel}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton]}
                    onPress={() => handleSave('password')}
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.cardValue}>••••••••••</Text>
            )}

            <Link
              href={{
                pathname: '/ForgotPassword',
                params: { fromAccountInformation: 'true' },
              }}
              asChild
            >
              <TouchableOpacity style={styles.forgotPasswordLink}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Email Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons
                name="email"
                size={SCREEN_WIDTH * 0.06}
                color="#e45ea9"
              />
              <Text style={styles.cardTitle}>Email Address</Text>
              <TouchableOpacity
                onPress={() => handleEdit('email', email)}
                style={styles.editButton}
              >
                <MaterialIcons
                  name="edit"
                  size={SCREEN_WIDTH * 0.05}
                  color="#e45ea9"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardValue}>{email}</Text>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_WIDTH * 0.04,
    paddingTop: SCREEN_WIDTH * 0.06,
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
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  logo: {
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.1,
    borderRadius: SCREEN_WIDTH * 0.05,
    marginRight: SCREEN_WIDTH * 0.02,
  },
  backButton: {
    padding: SCREEN_WIDTH * 0.02,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrollContainer: {
    paddingBottom: SCREEN_WIDTH * 0.1,
  },
  card1: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_WIDTH * 0.04,
    marginTop: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.05,
    marginHorizontal: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_WIDTH * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH * 0.03,
  },
  cardTitle: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '600',
    color: '#333',
    marginLeft: SCREEN_WIDTH * 0.03,
    flex: 1,
  },
  cardValue: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#555',
    marginTop: SCREEN_WIDTH * 0.01,
  },
  editButton: {
    padding: SCREEN_WIDTH * 0.02,
  },
  editContainer: {
    marginTop: SCREEN_WIDTH * 0.02,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: SCREEN_WIDTH * 0.04,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: SCREEN_WIDTH * 0.04,
    fontSize: SCREEN_WIDTH * 0.04,
    color: '#333',
    paddingRight: SCREEN_WIDTH * 0.1,
  },
  eyeIcon: {
    position: 'absolute',
    right: SCREEN_WIDTH * 0.03,
    top: '50%',
    transform: [{ translateY: -SCREEN_WIDTH * 0.025 }],
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SCREEN_WIDTH * 0.04,
  },
  actionButton: {
    paddingVertical: SCREEN_WIDTH * 0.03,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#e45ea9',
  },
  buttonText: {
    color: '#fff',
    fontSize: SCREEN_WIDTH * 0.04,
    fontWeight: '600',
  },
  forgotPasswordLink: {
    marginTop: SCREEN_WIDTH * 0.03,
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: '#e45ea9',
    fontSize: SCREEN_WIDTH * 0.035,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default AccountInformation;