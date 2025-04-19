import { createClient } from '@supabase/supabase-js';

// In Vite, use import.meta.env instead of process.env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Error handling for missing environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions to work with tasks in Supabase
export const getTasks = async (userId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const addTask = async (task) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      user_id: task.user_id,
      text: task.text,
      completed: task.completed || false,
      section: task.section || 'Personal',
      priority: task.priority || 'Low',
      ai_executable: task.aiExecutable || false,
      due_date: task.dueDate || null
      // Don't include id - let Supabase generate it
    }])
    .select();
  
  if (error) throw error;
  return data && data[0];
};

export const updateTask = async (taskId, updates) => {
  // Convert camelCase to snake_case for database
  const dbUpdates = {};
  if (updates.hasOwnProperty('text')) dbUpdates.text = updates.text;
  if (updates.hasOwnProperty('completed')) dbUpdates.completed = updates.completed;
  if (updates.hasOwnProperty('section')) dbUpdates.section = updates.section;
  if (updates.hasOwnProperty('priority')) dbUpdates.priority = updates.priority;
  if (updates.hasOwnProperty('aiExecutable')) dbUpdates.ai_executable = updates.aiExecutable;
  if (updates.hasOwnProperty('dueDate')) dbUpdates.due_date = updates.dueDate;
  if (updates.hasOwnProperty('analysis')) dbUpdates.analysis = updates.analysis;

  const { data, error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select();
  
  if (error) throw error;
  return data && data[0];
};

export const deleteTask = async (taskId) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
  
  if (error) throw error;
  return true;
};

// AI task execution history
export const saveTaskExecution = async (execution) => {
  const { data, error } = await supabase
    .from('task_executions')
    .insert([{
      task_id: execution.taskId,
      user_id: execution.userId,
      task_text: execution.taskText,
      response: execution.response,
      timestamp: new Date(),
      search_results: execution.searchResults || []
    }])
    .select();
  
  if (error) throw error;
  return data && data[0];
};

export const getTaskExecutions = async (taskId) => {
  const { data, error } = await supabase
    .from('task_executions')
    .select('*')
    .eq('task_id', taskId)
    .order('timestamp', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

// Task conversations (chat messages)
export const saveConversationMessage = async (message) => {
  const { data, error } = await supabase
    .from('task_conversations')
    .insert([{
      task_id: message.taskId,
      user_id: message.userId,
      role: message.role, // 'user' or 'assistant'
      content: message.content
      // timestamp will be added automatically by Supabase
    }])
    .select();
  
  if (error) throw error;
  return data && data[0];
};

export const getTaskConversation = async (taskId) => {
  const { data, error } = await supabase
    .from('task_conversations')
    .select('*')
    .eq('task_id', taskId)
    .order('timestamp', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const deleteTaskConversation = async (taskId) => {
  const { error } = await supabase
    .from('task_conversations')
    .delete()
    .eq('task_id', taskId);
  
  if (error) throw error;
  return true;
};

// Authentication helpers
export const getCurrentUser = async () => {
  try {
    // For Supabase auth (not using right now)
    //const { data: { user } } = await supabase.auth.getUser();
    
    // For Auth0 integration - use Auth0 user ID from session
    // This is a temporary solution until we properly link Auth0 with Supabase
    return {
      id: sessionStorage.getItem('auth0UserId') || 'auth0|default',
      email: sessionStorage.getItem('auth0UserEmail') || 'user@example.com'
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
};
