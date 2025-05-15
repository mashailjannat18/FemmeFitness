import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addUserToSupabase, UserData, getUserData, resetUserData, initializeSignup } from '@/datafiles/userData';
import { sendConfirmationEmail } from '@/lib/email';

type User = {
  id: string;
  username: string;
  email: string;
  lastPeriodDate: Date | null;
  cycleLength: number;
  bleedingDays: number;
};

type UserAuthContextType = {
  user: User | null;
  isLoggedIn: boolean;
  userData: UserData;
  setUserData: (key: keyof UserData, value: number | string | string[] | any[] | Date | null) => void;
  signUp: (email: string, password: string, username: string, challengeDays: number) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyResetCode: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  sendEmailVerificationCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  sendNewEmailVerificationCode: (email: string, newEmail: string) => Promise<void>;
  verifyNewEmailCode: (email: string, code: string, currentEmail: string) => Promise<void>;
};

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

export const UserAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [contextUserData, setContextUserData] = useState<UserData>(getUserData());

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await AsyncStorage.getItem('userSession');
        if (session) {
          const userData = JSON.parse(session);
          setUser({
            ...userData,
            lastPeriodDate: userData.lastPeriodDate ? new Date(userData.lastPeriodDate) : null,
          });
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };
    checkSession();
  }, []);

  const cleanupExpiredCodes = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_codes');
      if (error) {
        // Silently ignore errors, as cleanup is non-critical for user flow
      }
    } catch (error: any) {
      // Silently ignore errors
    }
  };

  const generateCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  };

  const setUserData = (key: keyof UserData, value: number | string | string[] | any[] | Date | null): void => {
    setContextUserData((prev) => ({ ...prev, [key]: value }));
  };

  const refreshUser = async () => {
    try {
      const session = await AsyncStorage.getItem('userSession');
      if (session) {
        const userData = JSON.parse(session);
        const { data, error } = await supabase
          .from('User')
          .select('"id", "username", "email", "last_period_date", "cycle_length", "bleeding_days"')
          .eq('"id"', userData.id)
          .single();

        if (error || !data) {
          throw new Error('Failed to fetch updated user data.');
        }

        const updatedUser = {
          id: data.id.toString(),
          username: data.username,
          email: data.email,
          lastPeriodDate: data.last_period_date ? new Date(data.last_period_date) : null,
          cycleLength: data.cycle_length,
          bleedingDays: data.bleeding_days,
        };
        setUser(updatedUser);
        setIsLoggedIn(true);
        await AsyncStorage.setItem('userSession', JSON.stringify({
          ...updatedUser,
          lastPeriodDate: updatedUser.lastPeriodDate?.toISOString().split('T')[0] || null,
        }));
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const signUp = async (email: string, password: string, username: string, challengeDays: number) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedUsername = username.trim().toLowerCase();

      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"email"', trimmedEmail)
        .single();

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        console.error('Email check error:', emailCheckError);
        throw new Error('This email has already been signed up with');
      }

      if (existingEmail) {
        throw new Error('This email has already been signed up with');
      }

      const { data: existingUser, error: usernameCheckError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"username"', trimmedUsername)
        .single();

      if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
        console.error('Username check error:', usernameCheckError);
        throw new Error('This username is taken');
      }

      if (existingUser) {
        throw new Error('This username is taken');
      }

      await cleanupExpiredCodes();

      const code = generateCode();
      console.log(`Signup confirmation code for ${trimmedEmail}: ${code}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);

      setUserData('email', trimmedEmail);
      setUserData('password', password);
      setUserData('username', trimmedUsername);
      setUserData('challengeDays', challengeDays);

      const { error: insertError, data } = await supabase
        .from('ConfirmationCodes')
        .insert({
          email: trimmedEmail,
          code,
          expires_at: expiresAt,
          user_data: { username: trimmedUsername, password, challengeDays },
          resend_count: 0,
          last_resend_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error storing confirmation code:', JSON.stringify(insertError, null, 2));
        throw new Error('Failed to initiate signup: ' + (insertError.message || 'Unknown error'));
      }

      await sendConfirmationEmail(trimmedEmail, code);
    } catch (error: any) {
      console.error('Signup error:', error);
      if (
        error.message === 'This email has already been signed up with' ||
        error.message === 'This username is taken'
      ) {
        throw error;
      }
      throw new Error('Failed to send confirmation code.');
    }
  };

  const resendCode = async (email: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      await cleanupExpiredCodes();

      const { data, error } = await supabase
        .from('ConfirmationCodes')
        .select('resend_count, user_data, last_resend_at')
        .eq('"email"', trimmedEmail)
        .single();

      if (error || !data) {
        throw new Error('No pending request found for this email.');
      }

      const resendCount = data.resend_count || 0;
      if (resendCount >= 3) {
        await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
        if (data.user_data.type !== 'password_reset' && data.user_data.type !== 'email_verification' && data.user_data.type !== 'new_email_verification') {
          initializeSignup();
        }
        throw new Error('Maximum resend attempts reached. Please restart the process.');
      }

      const lastResendAt = new Date(data.last_resend_at);
      const now = new Date();
      const timeSinceLastResend = (now.getTime() - lastResendAt.getTime()) / 1000;

      if (timeSinceLastResend < 60) {
        throw new Error(`Please wait ${Math.ceil(60 - timeSinceLastResend)} seconds before requesting a new code.`);
      }

      const newCode = generateCode();
      console.log(`${data.user_data.type === 'password_reset' ? 'Password reset' : data.user_data.type === 'email_verification' ? 'Email verification' : data.user_data.type === 'new_email_verification' ? 'New email verification' : 'Signup'} confirmation code for ${trimmedEmail}: ${newCode}`);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('ConfirmationCodes')
        .update({
          code: newCode,
          expires_at: expiresAt,
          resend_count: resendCount + 1,
          last_resend_at: new Date().toISOString(),
        })
        .eq('"email"', trimmedEmail);

      if (updateError) {
        console.error('Error updating confirmation code:', updateError.message);
        throw new Error('Failed to resend confirmation code.');
      }

      await sendConfirmationEmail(trimmedEmail, newCode);
    } catch (error: any) {
      console.error('Resend code error:', error.message);
      throw error;
    }
  };

  const verifyCode = async (email: string, code: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      await cleanupExpiredCodes();

      const { data, error } = await supabase
        .from('ConfirmationCodes')
        .select('code, expires_at, user_data')
        .eq('"email"', trimmedEmail)
        .eq('code', code)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired confirmation code.');
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
        throw new Error('Confirmation code has expired.');
      }

      const { username, password, challengeDays } = data.user_data;

      const userId = await addUserToSupabase(trimmedEmail, password, username, challengeDays);
      if (!userId) {
        throw new Error('Failed to complete signup.');
      }

      // Ensure userId is a number
      const numericUserId = Number(userId);
      if (isNaN(numericUserId)) {
        throw new Error('Invalid user ID format');
      }

      const userDataToStore = { 
        id: numericUserId.toString(), 
        username, 
        email: trimmedEmail,
        lastPeriodDate: contextUserData.lastPeriodDate ? new Date(contextUserData.lastPeriodDate) : null,
        cycleLength: contextUserData.cycleLength,
        bleedingDays: contextUserData.bleedingDays,
      };
      
      setUser(userDataToStore);
      setIsLoggedIn(true);
      await AsyncStorage.setItem('userSession', JSON.stringify({
        ...userDataToStore,
        lastPeriodDate: userDataToStore.lastPeriodDate?.toISOString().split('T')[0] || null,
      }));

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
    } catch (error: any) {
      console.error('Code verification error:', error.message);
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      const { data: user, error: userError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"email"', trimmedEmail)
        .single();

      if (userError || !user) {
        throw new Error('No account found with this email.');
      }

      await cleanupExpiredCodes();

      const code = generateCode();
      console.log(`Password reset confirmation code for ${trimmedEmail}: ${code}`);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);

      const { error: insertError } = await supabase
        .from('ConfirmationCodes')
        .insert({
          email: trimmedEmail,
          code,
          expires_at: expiresAt,
          user_data: { type: 'password_reset' },
          resend_count: 0,
          last_resend_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error storing reset code:', insertError.message);
        throw new Error('Failed to initiate password reset.');
      }

      await sendConfirmationEmail(trimmedEmail, code);
    } catch (error: any) {
      console.error('Forgot password error:', error.message);
      throw error;
    }
  };

  const verifyResetCode = async (email: string, code: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      await cleanupExpiredCodes();

      const { data, error } = await supabase
        .from('ConfirmationCodes')
        .select('code, expires_at, user_data')
        .eq('"email"', trimmedEmail)
        .eq('code', code)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired confirmation code.');
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
        throw new Error('Confirmation code has expired.');
      }

      if (data.user_data.type !== 'password_reset') {
        throw new Error('Invalid code type.');
      }
    } catch (error: any) {
      console.error('Reset code verification error:', error.message);
      throw error;
    }
  };

  const resetPassword = async (email: string, newPassword: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      const { data: user, error: userError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"email"', trimmedEmail)
        .single();

      if (userError || !user) {
        throw new Error('No account found with this email.');
      }

      const { error: updateError } = await supabase
        .from('User')
        .update({ password: newPassword })
        .eq('"id"', user.id);

      if (updateError) {
        throw new Error('Failed to update password: ' + updateError.message);
      }

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
    } catch (error: any) {
      console.error('Password reset error:', error.message);
      throw error;
    }
  };

  const sendEmailVerificationCode = async (email: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      const { data: user, error: userError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"email"', trimmedEmail)
        .single();

      if (userError || !user) {
        throw new Error('No account found with this email.');
      }

      await cleanupExpiredCodes();

      const code = generateCode();
      console.log(`Email verification code for ${trimmedEmail}: ${code}`);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);

      const { error: insertError } = await supabase
        .from('ConfirmationCodes')
        .insert({
          email: trimmedEmail,
          code,
          expires_at: expiresAt,
          user_data: { type: 'email_verification' },
          resend_count: 0,
          last_resend_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error storing email verification code:', insertError.message);
        throw new Error('Failed to initiate email verification.');
      }

      await sendConfirmationEmail(trimmedEmail, code);
    } catch (error: any) {
      console.error('Email verification error:', error.message);
      throw error;
    }
  };

  const verifyEmailCode = async (email: string, code: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();

      await cleanupExpiredCodes();

      const { data, error } = await supabase
        .from('ConfirmationCodes')
        .select('code, expires_at, user_data')
        .eq('"email"', trimmedEmail)
        .eq('code', code)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired confirmation code.');
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
        throw new Error('Confirmation code has expired.');
      }

      if (data.user_data.type !== 'email_verification') {
        throw new Error('Invalid code type.');
      }
    } catch (error: any) {
      console.error('Email code verification error:', error.message);
      throw error;
    }
  };

  const sendNewEmailVerificationCode = async (email: string, newEmail: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedNewEmail = newEmail.trim().toLowerCase();

      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"email"', trimmedNewEmail)
        .single();

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        console.error('New email check error:', emailCheckError);
        throw new Error('Error checking new email.');
      }

      if (existingEmail) {
        throw new Error('This email is already in use.');
      }

      if (trimmedEmail === trimmedNewEmail) {
        throw new Error('New email must be different from the current email.');
      }

      await cleanupExpiredCodes();

      const code = generateCode();
      console.log(`New email verification code for ${trimmedNewEmail}: ${code}`);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedNewEmail);

      const { error: insertError } = await supabase
        .from('ConfirmationCodes')
        .insert({
          email: trimmedNewEmail,
          code,
          expires_at: expiresAt,
          user_data: { type: 'new_email_verification', new_email: trimmedNewEmail },
          resend_count: 0,
          last_resend_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error storing new email verification code:', insertError.message);
        throw new Error('Failed to initiate new email verification.');
      }

      await sendConfirmationEmail(trimmedNewEmail, code);
    } catch (error: any) {
      console.error('New email verification error:', error.message);
      throw error;
    }
  };

  const verifyNewEmailCode = async (email: string, code: string, currentEmail: string) => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedCurrentEmail = currentEmail.trim().toLowerCase();

      await cleanupExpiredCodes();

      const { data, error } = await supabase
        .from('ConfirmationCodes')
        .select('code, expires_at, user_data')
        .eq('"email"', trimmedEmail)
        .eq('code', code)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired confirmation code.');
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
        throw new Error('Confirmation code has expired.');
      }

      if (data.user_data.type !== 'new_email_verification') {
        throw new Error('Invalid code type.');
      }

      const newEmail = data.user_data.new_email;
      if (!newEmail) {
        throw new Error('New email not found in verification data.');
      }

      const { data: user, error: userError } = await supabase
        .from('User')
        .select('"id"')
        .eq('"email"', trimmedCurrentEmail)
        .single();

      if (userError || !user) {
        console.error('User lookup failed:', { userError, currentEmail: trimmedCurrentEmail });
        throw new Error('No account found for the current email.');
      }

      const { error: updateError } = await supabase
        .from('User')
        .update({ email: newEmail })
        .eq('"id"', user.id);

      if (updateError) {
        throw new Error('Failed to update email: ' + updateError.message);
      }

      await supabase.from('ConfirmationCodes').delete().eq('"email"', trimmedEmail);
      await refreshUser();
    } catch (error: any) {
      console.error('New email code verification error:', error.message);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('User')
        .select('"id", "username", "email", "last_period_date", "cycle_length", "bleeding_days"')
        .eq('"email"', email.trim().toLowerCase())
        .eq('"password"', password)
        .single();

      if (error || !data) {
        return { success: false, error: 'Invalid email or password.' };
      }

      const userData = { 
        id: data.id.toString(), 
        username: data.username, 
        email: data.email,
        lastPeriodDate: data.last_period_date ? new Date(data.last_period_date) : null,
        cycleLength: data.cycle_length,
        bleedingDays: data.bleeding_days,
      };
      setUser(userData);
      setIsLoggedIn(true);
      await AsyncStorage.setItem('userSession', JSON.stringify({
        ...userData,
        lastPeriodDate: userData.lastPeriodDate?.toISOString().split('T')[0] || null,
      }));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'An error occurred during login.' };
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setIsLoggedIn(false);
      resetUserData();
      setUserData('lastPeriodDate', null);
      setUserData('cycleLength', 0);
      setUserData('bleedingDays', 0);
      await AsyncStorage.removeItem('userSession');
    } catch (error) {
      // Silently handle error
    }
  };

  return (
    <UserAuthContext.Provider
      value={{
        user,
        isLoggedIn,
        userData: contextUserData,
        setUserData,
        signUp,
        verifyCode,
        resendCode,
        login,
        logout,
        refreshUser,
        forgotPassword,
        verifyResetCode,
        resetPassword,
        sendEmailVerificationCode,
        verifyEmailCode,
        sendNewEmailVerificationCode,
        verifyNewEmailCode,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
};