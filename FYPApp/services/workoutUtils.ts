import { supabase } from '@/lib/supabase';

export const checkWorkoutCompletion = async (userId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user has an active workout plan
    const { data: planData, error: planError } = await supabase
      .from('WorkoutPlans')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (planError || !planData) return false;

    // Get today's daily workout
    const { data: dailyData, error: dailyError } = await supabase
      .from('DailyWorkouts')
      .select('id')
      .eq('workout_plan_id', planData.id)
      .gte('daily_workout_date', `${today}T00:00:00`)
      .lte('daily_workout_date', `${today}T23:59:59`)
      .single();

    if (dailyError || !dailyData) return false;

    // Get all exercises for today
    const { data: exercises, error: exercisesError } = await supabase
      .from('Workouts')
      .select('id')
      .eq('daily_workout_id', dailyData.id);

    if (exercisesError || !exercises || exercises.length === 0) return false;

    // Get completed exercises
    const { data: completions, error: completionError } = await supabase
      .from('ExerciseCompletions')
      .select('workout_id, status')
      .eq('daily_workout_id', dailyData.id)
      .eq('user_id', userId)
      .gte('completion_date', today);

    if (completionError) return false;

    const completedCount = completions?.filter(c => c.status === 'completed').length || 0;
    return completedCount >= exercises.length;
  } catch (error) {
    console.error('Error checking workout completion:', error);
    return false;
  }
};