import { supabase } from '@/lib/supabase';

const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

export type UserData = {
  username: string;
  age: number;
  weight: number;
  height: number;
  diseases: string[];
  goal: string;
  areasOfFocus: string[];
  activityLevel: number;
  restDay: string;
  challengeDays: number;
  preferredRestDay: string;
  email: string;
  password: string;
  workoutPlan: any[];
  mealPlan?: any[];
  intensity?: string;
  lastPeriodDate: Date | null;
  cycleLength: number;
  bleedingDays: number;
  cyclePhases?: any[];
};

const defaultUserData: UserData = {
  username: '',
  age: 0,
  weight: 0,
  height: 0,
  diseases: [],
  goal: '',
  areasOfFocus: ['Full Body'], // Default to 'Full Body'
  activityLevel: 0,
  restDay: '',
  challengeDays: 0,
  preferredRestDay: '',
  email: '',
  password: '',
  workoutPlan: [],
  mealPlan: [],
  intensity: '',
  lastPeriodDate: null,
  cycleLength: 0,
  bleedingDays: 0,
  cyclePhases: [],
};

export let userData: UserData = { ...defaultUserData };

export const setUserData = (screenKey: keyof UserData, data: number | string | string[] | any[] | Date | null | boolean): void => {
  userData = { ...userData, [screenKey]: data };
};

export const getUserData = (): UserData => {
  return { ...userData };
};

export const resetUserData = (): void => {
  console.log('Resetting userData to default values');
  userData = { ...defaultUserData };
};

export const initializeSignup = (): void => {
  console.log('Initializing signup process, resetting userData');
  resetUserData();
};

export const addUserToSupabase = async (
  email: string,
  password: string,
  username: string,
  challengeDays: number
): Promise<number | null> => {
  let userId: number | null = null;

  try {
    console.log('Starting addUserToSupabase with inputs:', { email, password, username, challengeDays });

    setUserData('email', email.trim().toLowerCase());
    setUserData('password', password);
    setUserData('username', username.trim().toLowerCase());
    setUserData('challengeDays', challengeDays);

    console.log('userData after setting provided values:', userData);

    // Validate required fields
    if (userData.age === null || userData.age === 0) {
      throw new Error('Age is required for workout plan generation.');
    }
    if (userData.weight === null || userData.weight === 0 || userData.weight > 200) {
      throw new Error('Weight must be between 0 and 200 kg for workout plan generation.');
    }
    if (!userData.goal) {
      throw new Error('Goal is required for workout plan generation.');
    }
    if (userData.activityLevel === null || userData.activityLevel === 0) {
      throw new Error('Activity level is required for workout plan generation.');
    }
    if (!userData.restDay) {
      throw new Error('Rest day is required for workout plan generation.');
    }
    if (!userData.areasOfFocus || userData.areasOfFocus.length === 0) {
      throw new Error('At least one focus area is required for workout plan generation.');
    }

    // Map user-facing goals to backend values
    const goalMap: { [key: string]: string } = {
      'weight_loss': 'Lose weight',
      'gain_weight': 'Gain weight',
      'build_muscle': 'Muscle build',
      'stay_fit': 'Stay fit',
    };

    // Validate goal
    if (!(userData.goal in goalMap)) {
      throw new Error(`Invalid goal: ${userData.goal}. Must be one of: ${Object.keys(goalMap).join(', ')}`);
    }

    // Fetch cycle phases from the backend
    let cyclePhases: any[] = [];
    if (userData.lastPeriodDate && userData.cycleLength > 0 && userData.bleedingDays > 0) {
      const cyclePayload = {
        lastPeriodDate: userData.lastPeriodDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'), // Format as YYYY-MM-DD
        cycleLength: userData.cycleLength,
        bleedingDays: userData.bleedingDays,
        challengeDays: userData.challengeDays,
        age: userData.age,
        weight: userData.weight,
        height: userData.height,
      };

      console.log('Fetching cycle phases with payload:', cyclePayload);

      const cycleResponse = await fetch('http://192.168.1.9:5000/api/generate-cycle-phases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cyclePayload),
      });

      if (!cycleResponse.ok) {
        const text = await cycleResponse.text();
        console.error('Cycle phases response:', text);
        throw new Error(`Failed to fetch cycle phases: ${cycleResponse.status} ${cycleResponse.statusText} - ${text}`);
      }

      try {
        cyclePhases = await cycleResponse.json();
        console.log('Fetched cycle phases:', cyclePhases);
      } catch (jsonError) {
        const text = await cycleResponse.text();
        console.error('Cycle phases JSON parse error. Response:', text);
        throw new Error(`Failed to parse cycle phases response: ${jsonError.message}`);
      }
    } else {
      console.log('No valid menstrual cycle data provided, using empty cycle phases');
    }
    setUserData('cyclePhases', cyclePhases);

    // Prepare payload for plan generation with mapped goal
    const mappedGoal = goalMap[userData.goal];
    const planPayload = {
      userId: username, // Use username as userId for now
      age: userData.age,
      weight: userData.weight,
      height: userData.height,
      diseases: userData.diseases,
      goal: mappedGoal, // Use mapped goal for API call
      areasOfFocus: userData.areasOfFocus,
      activityLevel: userData.activityLevel,
      preferredRestDay: userData.restDay,
      challengeDays: userData.challengeDays,
      cyclePhases: userData.cyclePhases,
    };

    console.log('Plan payload:', planPayload);

    // Call the API to generate plans
    const response = await fetch('http://192.168.1.9:5000/api/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(planPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Workout plan response:', text);
      throw new Error(`Failed to generate plans: ${response.status} ${response.statusText} - ${text}`);
    }

    let planData;
    try {
      planData = await response.json();
      console.log('Fetched workout plan:', planData);
    } catch (jsonError) {
      const text = await response.text();
      console.error('Workout plan JSON parse error. Response:', text);
      throw new Error(`Failed to parse workout plan response: ${jsonError.message}`);
    }

    const { workout_plan, meal_plan, intensity } = planData;
    setUserData('workoutPlan', workout_plan);
    setUserData('mealPlan', meal_plan);
    setUserData('intensity', intensity);

    // Insert user and plans into Supabase with mapped goal
    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_user_and_workout_plan', {
      p_email: email,
      p_password: password,
      p_username: username,
      p_age: userData.age,
      p_weight: userData.weight,
      p_height: userData.height,
      p_diseases: userData.diseases,
      p_goal: mappedGoal,
      p_areas_of_focus: userData.areasOfFocus,
      p_activity_level: userData.activityLevel,
      p_preferred_rest_day: userData.restDay,
      p_start_date: today,
      p_challenge_days: userData.challengeDays,
      p_cycle_phases: userData.cyclePhases,
      p_last_period_date: userData.lastPeriodDate?.toISOString(),
      p_cycle_length: userData.cycleLength,
      p_bleeding_days: userData.bleedingDays,
      p_workout_plan: workout_plan,
      p_meal_plan: meal_plan,
      p_intensity: intensity,
    });

    if (rpcError) {
      console.error('Supabase error:', rpcError);
      throw new Error(`Failed to insert user data: ${rpcError.message}`);
    }

    // Properly extract the user_id from the RPC response
    if (rpcData && rpcData.length > 0) {
      userId = rpcData[0].user_id;
    } else {
      throw new Error('No user ID returned from database');
    }

    console.log('User inserted successfully with ID:', userId);
    return userId;

  } catch (error) {
    console.error('Error in addUserToSupabase:', error);
    throw error;
  }
};