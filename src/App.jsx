import { useState, useEffect } from 'react';
import logo from './assets/logo2.png';
import { 
  PlusIcon, 
  TrashIcon, 
  CheckIcon, 
  ChatBubbleBottomCenterIcon,
  InboxIcon,
  CalendarIcon,
  SparklesIcon,
  XMarkIcon,
  Cog6ToothIcon,
  ClipboardDocumentIcon,
  ArrowRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import LandingPage from './components/LandingPage';
import { useAuth } from './components/Auth/useAuth';
import LoginButton from './components/Auth/LoginButton';
import UserProfile from './components/Auth/UserProfile';
import { 
  getTasks, 
  addTask, 
  updateTask, 
  deleteTask, 
  getCurrentUser,
  saveTaskExecution,
  getTaskExecutions,
  saveConversationMessage,
  getTaskConversation,
  deleteTaskConversation
} from './utils/supabaseClient';

function App() {
  const { isLoading, isAuthenticated, user } = useAuth();

  // Move ALL state declarations to the top, BEFORE any useEffects
  const [todos, setTodos] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [showLandingPage, setShowLandingPage] = useState(() => !isAuthenticated);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('inbox'); // This needs to be above any useEffect that uses it
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [isResultPanelOpen, setIsResultPanelOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [taskDrafts, setTaskDrafts] = useState([]);
  const [completedAiTasks, setCompletedAiTasks] = useState(new Set());
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskConversations, setTaskConversations] = useState({});
  const [showMobileTasksModal, setShowMobileTasksModal] = useState(false);
  const [isPromptLoading, setIsPromptLoading] = useState(false);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setIsLoadingTasks(true);
        const user = await getCurrentUser();
        
        if (user) {
          // 1. Load tasks
          const taskData = await getTasks(user.id);
          const formattedTasks = taskData.map(task => ({
            id: task.id,
            text: task.text,
            completed: task.completed,
            section: task.section,
            priority: task.priority,
            aiExecutable: task.ai_executable,
            dueDate: task.due_date,
            analysis: task.analysis
          }));
          setTodos(formattedTasks);
          
          // 2. Load which tasks have been executed
          const completedTaskIds = new Set();
          const loadedTaskDrafts = [];
          
          // For each AI-executable task, check if it has executions
          for (const task of formattedTasks) {
            if (task.aiExecutable) {
              console.log(`Checking executions for task: ${task.id} - ${task.text}`);
              const executions = await getTaskExecutions(task.id);
              console.log(`Found ${executions?.length || 0} executions`);
              
              if (executions && executions.length > 0) {
                // Mark as completed
                completedTaskIds.add(task.id);
                
                // Log the execution data
                const latestExecution = executions[0];
                console.log("Latest execution:", {
                  taskId: task.id,
                  response: latestExecution.response?.substring(0, 50) + "...",
                  hasSearchResults: !!latestExecution.search_results,
                  searchResultsType: typeof latestExecution.search_results
                });
                
                // Load the task draft for display
                loadedTaskDrafts.push({
                  taskId: task.id,
                  timestamp: new Date(latestExecution.timestamp).getTime(),
                  task: task.text,
                  response: latestExecution.response,
                  searchResults: latestExecution.search_results || []
                });
              }
            }
          }
          
          // Update states
          setCompletedAiTasks(completedTaskIds);
          setTaskDrafts(loadedTaskDrafts);
          
          // If we have an "AI" tab active and there are completed tasks, set the first one as active
          if (activeTab === 'AI' && loadedTaskDrafts.length > 0) {
            setActiveTaskId(loadedTaskDrafts[0].taskId);
            
            // Also load the chat messages for this task
            const conversations = await getTaskConversation(loadedTaskDrafts[0].taskId);
            if (conversations && conversations.length > 0) {
              setChatMessages(conversations.map(msg => ({
                role: msg.role,
                content: msg.content
              })));
              
              setTaskConversations(prev => ({
                ...prev,
                [loadedTaskDrafts[0].taskId]: conversations.map(msg => ({
                  role: msg.role,
                  content: msg.content
                }))
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError('Failed to load your tasks. Please refresh the page.');
      } finally {
        setIsLoadingTasks(false);
      }
    }
    
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Store Auth0 user ID in sessionStorage for Supabase integration
      sessionStorage.setItem('auth0UserId', user.sub || user.id);
      sessionStorage.setItem('auth0UserEmail', user.email);
      console.log('Auth0 user ID stored for Supabase:', user.sub || user.id);
      
      // Other existing code...
      setShowLandingPage(false);
    }
  }, [isAuthenticated, user]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setShowLandingPage(false);
    }
  };

  const getFilteredTasks = () => {
    switch (activeTab) {
      case 'inbox':
        return todos;
      case 'today':
        const today = new Date().toDateString();
        return todos.filter(todo => {
          const dueDate = todo.dueDate ? new Date(todo.dueDate).toDateString() : null;
          return dueDate === today;
        });
      case 'AI':
        return todos.filter(todo => todo.aiExecutable);
      default:
        return [];
    }
  };

  const analyzeTask = async (text) => {
    try {
      const response = await fetch('http://localhost:3000/api/analyze-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze task');
      }

      const data = await response.json();
      return {
        text: data.taskName,
        section: data.section,
        priority: data.priority,
        aiExecutable: data.aiExecutable,
        dueDate: data.dueDate,
        analysis: data.analysis
      };
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  };

  const handleTaskSelect = async (task) => {
    setActiveTaskId(task.id);
    
    try {
      // 1. Load user
      const user = await getCurrentUser();
      
      // 2. Load conversation history
      const conversationHistory = await getTaskConversation(task.id);
      
      // 3. Load task executions
      const taskExecutions = await getTaskExecutions(task.id);
      
      // 4. Update chat messages UI
      if (conversationHistory && conversationHistory.length > 0) {
        setChatMessages(conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })));
        
        setTaskConversations(prev => ({
          ...prev,
          [task.id]: conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }));
      }
      
      // 5. If we have executions, reconstruct the task draft for ReactMarkdown display
      if (taskExecutions && taskExecutions.length > 0) {
        const latestExecution = taskExecutions[0]; // Most recent execution
        
        // Set as completed task
        setCompletedAiTasks(prev => new Set([...prev, task.id]));
        
        // Reconstruct task draft for display in ReactMarkdown component
        setTaskDrafts(prev => {
          // Remove any existing draft for this task
          const filtered = prev.filter(draft => draft.taskId !== task.id);
          
          // Add the reconstructed draft
          return [{
            taskId: task.id,
            timestamp: new Date(latestExecution.timestamp).getTime(),
            task: task.text,
            response: latestExecution.response,
            searchResults: latestExecution.search_results || []
          }, ...filtered];
        });
        
        console.log("Loaded task execution with response:", latestExecution.response);
      } else if (!completedAiTasks.has(task.id) && task.aiExecutable) {
        // If no history found AND the task is AI-executable AND not already executed, then execute it
        console.log("No task execution history found, executing task:", task.id);
        executeAiTask(task);
      }
    } catch (error) {
      console.error('Error loading task data:', error);
    }
  };

  const executeAiTask = async (task) => {
    try {
      setIsExecuting(true);
      setActiveTaskId(task.id);
      
      setTaskDrafts(prev => {
        if (!prev.find(draft => draft.taskId === task.id)) {
          return [{
            taskId: task.id,
            timestamp: Date.now(),
            task: task.text,
            response: '',
            searchResults: []
          }, ...prev];
        }
        return prev;
      });
      
      const initialMessage = { role: 'user', content: task.text };
      setTaskConversations(prev => ({
        ...prev,
        [task.id]: [initialMessage]
      }));
      
      setChatMessages([initialMessage]);

      // Save the initial user query to conversation history
      const user = await getCurrentUser();
      await saveConversationMessage({
        taskId: task.id,
        userId: user.id,
        role: 'user',
        content: task.text
      });
      
      console.log("Executing AI task:", {
        id: task.id,
        text: task.text,
        analysis: task.analysis?.substring(0, 50) + '...'
      });

      const response = await fetch('http://localhost:3000/api/execute-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: task.text,
          context: task.analysis,
          taskId: task.id
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let streamedResponse = '';
      let searchResults = [];
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value);
        const events = chunk.split('\n\n').filter(Boolean);
        
        for (const eventText of events) {
          if (eventText.startsWith('data: ')) {
            const jsonData = eventText.slice(6);
            console.log("Received data chunk:", jsonData.substring(0, 50) + '...');
            try {
              const data = JSON.parse(jsonData);
              
              if (data.type === 'content_chunk') {
                console.log("Content chunk received, length:", data.content.length);
                streamedResponse += data.content;
                
                setTaskDrafts(prev => prev.map(draft => 
                  draft.taskId === task.id 
                    ? { ...draft, response: streamedResponse }
                    : draft
                ));
                
                const assistantMessage = { 
                  role: 'assistant', 
                  content: streamedResponse 
                };
                
                setTaskConversations(prev => {
                  const currentConversation = prev[task.id] || [initialMessage];
                  if (currentConversation.find(msg => msg.role === 'assistant')) {
                    return {
                      ...prev,
                      [task.id]: currentConversation.map(msg => 
                        msg.role === 'assistant' ? assistantMessage : msg
                      )
                    };
                  } else {
                    return {
                      ...prev,
                      [task.id]: [...currentConversation, assistantMessage]
                    };
                  }
                });
                
                setChatMessages(prev => {
                  if (prev.find(msg => msg.role === 'assistant')) {
                    return prev.map(msg => 
                      msg.role === 'assistant' ? assistantMessage : msg
                    );
                  } else {
                    return [...prev, assistantMessage];
                  }
                });
              }
              else if (data.type === 'search_results') {
                searchResults = data.searchResults;
                setTaskDrafts(prev => prev.map(draft => 
                  draft.taskId === task.id 
                    ? { ...draft, searchResults: data.searchResults }
                    : draft
                ));
              } 
              else if (data.type === 'completion') {
                setCompletedAiTasks(prev => new Set([...prev, task.id]));
                
                if (data.response && data.response !== streamedResponse) {
                  setTaskDrafts(prev => prev.map(draft => 
                    draft.taskId === task.id 
                      ? { 
                          ...draft, 
                          response: data.response,
                          searchResults: searchResults || [] // If you have search results
                        }
                      : draft
                  ));
                }

                // After receiving the AI response
                await saveConversationMessage({
                  taskId: task.id,
                  userId: user.id,
                  role: 'assistant',
                  content: streamedResponse // or finalResponse
                });

                // Save execution results with search data
                await saveTaskExecution({
                  taskId: task.id,
                  userId: user.id,
                  response: streamedResponse,
                  searchResults: searchResults || [] // If you have search results
                });
              }
              else if (data.type === 'error') {
                throw new Error(data.details || 'Server error');
              }
            } catch (e) {
              console.error('Error parsing event data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to execute task with AI');
      
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      };
      setChatMessages(prev => [...prev, errorMessage]);
      setTaskConversations(prev => ({
        ...prev,
        [task.id]: [...(prev[task.id] || []), errorMessage]
      }));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setError(null);
    setIsPromptLoading(true); // Start loading

    try {
      const aiMetadata = await analyzeTask(inputValue);
      if (!isAuthenticated) {
        throw new Error('You must be logged in to add tasks');
      }
      
      const userId = user.sub || sessionStorage.getItem('auth0UserId') || 'auth0|default';
      
      const newTask = await addTask({
        user_id: userId,
        text: aiMetadata.text,
        completed: false,
        section: aiMetadata.section,
        priority: aiMetadata.priority,
        aiExecutable: aiMetadata.aiExecutable,
        dueDate: aiMetadata.dueDate
      });
      
      // Store analysis in React state but not in DB
      setTodos([{
        id: newTask.id,
        text: newTask.text,
        completed: newTask.completed,
        section: newTask.section,
        priority: newTask.priority,
        aiExecutable: newTask.ai_executable,
        dueDate: newTask.due_date,
        analysis: aiMetadata.analysis // Only kept in React state
      }, ...todos]);
      
      setInputValue('');
    } catch (error) {
      setError('Failed to add task. Please try again.');
      console.error('Add task error:', error);
    } finally {
      setIsPromptLoading(false); // End loading regardless of outcome
    }
  };

  const addSimpleTask = async () => {
    if (!inputValue.trim()) return;

    try {
      // Use Auth0 user ID directly
      if (!isAuthenticated) {
        throw new Error('You must be logged in to add tasks');
      }
      
      const userId = user.sub || sessionStorage.getItem('auth0UserId') || 'auth0|default';
      
      const newTask = await addTask({
        user_id: userId,
        text: inputValue,
        completed: false,
        section: 'Personal',
        priority: 'Low',
        aiExecutable: false
      });
      
      // Convert to camelCase for React state
      setTodos([{
        id: newTask.id,
        text: newTask.text,
        completed: newTask.completed,
        section: newTask.section,
        priority: newTask.priority,
        aiExecutable: newTask.ai_executable,
        dueDate: newTask.due_date
      }, ...todos]);
      
      setInputValue('');
    } catch (error) {
      setError('Failed to add task. Please try again.');
      console.error('Add simple task error:', error);
    }
  };

  const toggleTodo = async (id) => {
    try {
      // Find the task to toggle
      const todoToUpdate = todos.find(todo => todo.id === id);
      
      // Update in the database
      await updateTask(id, { 
        completed: !todoToUpdate.completed 
      });
      
      // Update local state
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ));
    } catch (error) {
      console.error('Error toggling task:', error);
      setError('Failed to update task status.');
    }
  };

  const deleteTodo = async (id) => {
    try {
      await deleteTask(id);
      setTodos(todos.filter(todo => todo.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Failed to delete task.');
    }
  };

  const updateTaskDetails = async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
      
      setTodos(todos.map(todo => {
        if (todo.id === taskId) {
          const updatedTodo = { ...todo, ...updates };
          if (selectedTask && selectedTask.id === taskId) {
            setSelectedTask(updatedTodo);
          }
          return updatedTodo;
        }
        return todo;
      }));
    } catch (error) {
      console.error('Error updating task:', error);
      setError('Failed to update task details.');
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeTaskId) return;

    try {
      setIsExecuting(true);
      
      // Get current user
      const user = await getCurrentUser();
      const newUserMessage = { role: 'user', content: chatInput };
      
      // Find the current active task draft to include its response
      const currentTaskDraft = taskDrafts.find(draft => draft.taskId === activeTaskId);
      console.log("Current task draft:", currentTaskDraft); // Debug log
      const currentResponse = currentTaskDraft?.response || '';
      
      // Save user message to database
      await saveConversationMessage({
        taskId: activeTaskId,
        userId: user.id,
        role: 'user',
        content: chatInput
      });
      
      // Update UI immediately with user message
      setChatMessages(prev => [...prev, newUserMessage]);
      setChatInput('');
      
      // Make server request with CONTEXT from previous response
      console.log("Sending follow-up with context length:", currentResponse.length); // Debug log
      const response = await fetch('http://localhost:3000/api/execute-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: chatInput,
          context: currentResponse, // Include current response as context
          taskId: activeTaskId,
          isFollowUp: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let streamedResponse = '';
      
      // Add a placeholder for the assistant's response
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Thinking...' }]);
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Process chunk
        const chunk = decoder.decode(value);
        const events = chunk.split('\n\n').filter(Boolean);
        
        for (const eventText of events) {
          if (eventText.startsWith('data: ')) {
            try {
              const data = JSON.parse(eventText.slice(6));
              
              if (data.type === 'content_chunk') {
                streamedResponse += data.content;
                
                // Update UI with streaming response
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
                    newMessages[lastIndex] = { role: 'assistant', content: streamedResponse };
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing event data:', e);
            }
          }
        }
      }
      
      // Save the AI response to database
      await saveConversationMessage({
        taskId: activeTaskId,
        userId: user.id,
        role: 'assistant',
        content: streamedResponse
      });
      
      // Update the task draft with the new response
      setTaskDrafts(prev => {
        return prev.map(draft => 
          draft.taskId === activeTaskId
            ? { ...draft, response: streamedResponse }
            : draft
        );
      });
      
      // Mark as completed if not already
      setCompletedAiTasks(prev => new Set([...prev, activeTaskId]));
      
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const navItems = [
    { id: 'inbox', icon: InboxIcon, label: 'Inbox' },
    { id: 'today', icon: CalendarIcon, label: 'Today' },
    { id: 'AI', icon: SparklesIcon, label: 'AI Tasks' },
    { id: 'settings', icon: Cog6ToothIcon, label: 'Settings' },
  ];

  const renderContent = () => {
    if (isLoadingTasks) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <svg className="mx-auto animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-3 text-gray-600">Loading your tasks...</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'settings') {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-lg text-center">
            <div className="mb-6">
              <div className= " w-24 h-24 mx-auto rounded-xl shadow-inner flex items-center justify-center">
                <img 
                  src={logo}
                  alt="Megat-Task Logo" 
                  className="bg-gray-100 h-20 w-20 rounded-lg object-cover transform hover:rotate-3 transition-transform"
                />
              </div>
              <h3 className="text-2xl font-bold mt-4 bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                Megat-Task
              </h3>
              <p className="text-gray-500 mt-1">Your AI-powered task assistant</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Dark Mode</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Coming Soon</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">AI Provider</span>
                <span className="text-xs font-medium text-gray-500">OpenAI, Model: GPT-4o</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Export Data</span>
                <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
                  Export
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-gray-500 text-sm">Created by Abu Huzaifah Bidin</p>
              <p className="text-gray-400 text-xs mt-1">Version 1.0.0</p>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'AI') {
      return (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
          {/* Main Chat Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Task response area - adjust height to leave space for chat */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-0">
              {taskDrafts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-blue-50 p-4 rounded-full mb-4">
                    <SparklesIcon className="h-10 w-10 text-blue-500 opacity-70" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">AI Assistant</h3>
                  <p className="text-gray-500 max-w-sm mx-auto mb-6">
                    Select an AI-executable task from the right panel to start working with your AI assistant.
                  </p>
                </div>
              ) : activeTaskId ? (
                // Show only the active task if there's an active task ID
                <div className="space-y-4 pb-4">
                  {taskDrafts
                    .filter(draft => draft.taskId === activeTaskId)
                    .map((draft, index) => (
                      <div key={draft.taskId} className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
                        {/* Task display... */}
                        <div className="prose prose-sm w-full max-w-none overflow-hidden break-words text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                          <div className="overflow-x-auto">
                            <ReactMarkdown>{draft.response || "No response available"}</ReactMarkdown>
                          </div>
                        </div>
                        {/* Rest of your rendering code... */}
                      </div>
                    ))}
                </div>
              ) : (
                // If no active task ID but we have drafts, show all drafts
                <div className="space-y-4 pb-4">
                  {taskDrafts.map((draft, index) => (
                    <div key={draft.taskId} className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
                      {/* Task display... */}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fixed Chat Interface - Always visible at bottom */}
            <div className="flex-none border-t border-gray-200 bg-white p-4">
              <div className="mb-4 h-32 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-lg">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-2">
                    Conversation will appear here
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div 
                      key={index} 
                      className={`mb-2 p-2.5 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-blue-100 ml-12 text-blue-800' 
                          : 'bg-gray-100 mr-12 text-gray-800'
                      }`}
                    >
                      <div className="text-sm break-words">
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <form 
                onSubmit={handleChatSubmit}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question or give a task..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all duration-200"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg 
                    hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Right Sidebar with Task Buttons */}
          <div className="hidden md:block w-72 flex-none border-l border-gray-200 overflow-y-auto">
            <div className="p-4 bg-gradient-to-b from-blue-50 to-emerald-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">AI Tasks</h3>
              
              {getFilteredTasks().filter(todo => todo.aiExecutable).length === 0 ? (
                <div className="w-full text-center py-4 text-gray-500 text-sm">
                  No AI-executable tasks available. Add a task that can be executed with AI assistance.
                </div>
              ) : (
                <div className="space-y-2">
                  {getFilteredTasks().filter(todo => todo.aiExecutable).map(todo => (
                    <button
                      key={todo.id}
                      onClick={() => handleTaskSelect(todo)}
                      disabled={isExecuting && activeTaskId === todo.id}
                      className={`w-full px-4 py-2.5 rounded-lg shadow-sm hover:shadow-md 
                        transition-all duration-200 flex items-center gap-2
                        ${activeTaskId === todo.id 
                          ? 'bg-blue-500 text-gray-700 ring-2 ring-blue-300' 
                          : 'bg-white text-gray-700'}
                        ${completedAiTasks.has(todo.id) ? 'border-l-4 border-emerald-500' : ''}
                        ${isExecuting && activeTaskId === todo.id ? 'animate-pulse' : ''}`}
                    >
                      <span className="text-sm whitespace-nowrap truncate flex-1 text-left">{todo.text}</span>
                      {isExecuting && activeTaskId === todo.id ? (
                        <svg className="animate-spin h-4 w-4 flex-none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : completedAiTasks.has(todo.id) ? (
                        <CheckIcon className="h-4 w-4 text-emerald-500 flex-none" />
                      ) : (
                        <ChatBubbleBottomCenterIcon className="h-4 w-4 flex-none" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile floating button for AI tasks */}
          <div className="md:hidden fixed bottom-20 right-4 z-10">
            <button
              onClick={() => setShowMobileTasksModal(true)}
              className="bg-gradient-to-r from-blue-500 to-emerald-500 p-3 rounded-full shadow-lg flex items-center justify-center"
            >
              <ChatBubbleBottomCenterIcon className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'inbox' || activeTab === 'today') {
      return (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
          <div className="space-y-4 max-w-4xl mx-auto">
            {getFilteredTasks().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-blue-50 rounded-full p-5 mb-4">
                  <ClipboardDocumentIcon className="h-10 w-10 text-blue-500 opacity-70" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No tasks yet</h3>
                <p className="text-gray-500 max-w-xs">
                  {activeTab === 'inbox' 
                    ? "Add your first task using the input below."
                    : "You don't have any tasks due today."
                  }
                </p>
              </div>
            ) : (
              getFilteredTasks().map(todo => (
                <div 
                  key={todo.id}
                  onClick={() => {
                    if (!isResultPanelOpen) {
                      setSelectedTask(todo);
                      setIsEditPanelOpen(true);
                    }
                  }}
                  className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex items-center gap-4 transform transition duration-300 
                    hover:shadow-md hover:translate-y-[-2px] cursor-pointer relative overflow-hidden"
                >
                  {/* Priority indicator line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    todo.priority === 'High' 
                      ? 'bg-red-500' 
                      : todo.priority === 'Medium'
                        ? 'bg-yellow-500'
                        : 'bg-blue-400'
                  }`}></div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTodo(todo.id);
                    }}
                    className={`h-5 w-5 rounded-full border transition-colors duration-300 ${
                      todo.completed 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300'
                    } flex items-center justify-center`}
                  >
                    {todo.completed && <CheckIcon className="h-3 w-3 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className={`text-base transition-colors duration-300 ${
                      todo.completed ? 'line-through text-gray-400' : 'text-gray-700'
                    }`}>
                      {todo.text}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <div className="md:hidden flex gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-medium
                          ${todo.priority === 'High' 
                            ? 'bg-red-100 text-red-700'
                            : todo.priority === 'Medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                          {todo.priority}
                        </span>
                        
                        {todo.dueDate && (
                          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-gray-100 text-gray-700">
                            Due: {new Date(todo.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      
                      <div className="hidden md:flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${todo.section === 'Work' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {todo.section}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${todo.priority === 'High' 
                            ? 'bg-red-100 text-red-700'
                            : todo.priority === 'Medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                          {todo.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${todo.aiExecutable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                          {todo.aiExecutable ? '✅ AI Ready' : '❌ Manual Task'}
                        </span>
                        {todo.dueDate && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Due: {new Date(todo.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {todo.aiExecutable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executeAiTask(todo);
                      }}
                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                    >
                      {isExecuting && activeTaskId === todo.id ? (
                        <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <ChatBubbleBottomCenterIcon className="h-5 w-5" />
                      )}
                    </button>
                  )}

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTodo(todo.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-400 to-blue-500">
        <div className="bg-white p-6 rounded-xl shadow-lg flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-700 font-medium">Loading Megat-Task...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {showLandingPage ? (
        <LandingPage onGetStarted={() => isAuthenticated ? setShowLandingPage(false) : null} />
      ) : (
        <div className="fixed inset-0 flex flex-col md:flex-row overflow-hidden bg-gradient-to-br from-emerald-400 to-blue-500">
          {/* Enhanced Sidebar - Now Collapsible */}
          <div className="w-full md:w-[220px] flex-none bg-white/90 backdrop-blur-sm shadow-lg 
            flex flex-col h-auto md:h-full p-4 overflow-y-auto border-b md:border-b-0 md:border-r border-white/20">
            <div className="flex items-center justify-between px-2 md:px-4 mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <img 
                  src={logo}
                  alt="Megat-Task Logo" 
                  className="h-8 w-8 md:h-12 md:w-12 rounded-lg object-cover"
                />
                <p3 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-500 
                  bg-clip-text text-transparent">
                  Task
                </p3>
              </div>
              
              {/* Mobile User Profile - Only visible on small screens */}
              <div className="block md:hidden">
                <UserProfile compact={true} rightAlignedDropdown={false} />
              </div>
            </div>
            
            <nav className="flex md:block overflow-x-auto md:overflow-visible pb-2 md:pb-0 
              scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex-none md:w-full flex items-center justify-start gap-1.5 md:gap-2
                      px-3 md:px-4 py-1.5 md:py-2.5 mr-2 md:mr-0 md:mb-2
                      text-xs md:text-sm font-medium rounded-md md:rounded-lg
                      transition-all duration-300 hover:translate-x-0.5
                      ${activeTab === item.id 
                        ? 'text-blue-600 bg-blue-50/80 shadow-sm translate-x-0 md:translate-x-1' 
                        : 'text-gray-600 bg-transparent hover:bg-gray-100/50'
                      }`}
                  >
                    <Icon className={`h-4 w-4 ${
                      activeTab === item.id ? 'text-blue-600' : 'text-gray-500'
                    }`} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Stats Section - Hidden when collapsed */}
            <div className="hidden md:block mt-6 px-4 py-4 bg-blue-50/50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Overview</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Total Tasks</span>
                  <span className="text-xs font-medium text-gray-800">{todos.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Completed</span>
                  <span className="text-xs font-medium text-gray-800">
                    {todos.filter(todo => todo.completed).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">AI Tasks</span>
                  <span className="text-xs font-medium text-gray-800">
                    {todos.filter(todo => todo.aiExecutable).length}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium text-gray-700">
                      {Math.round((todos.filter(todo => todo.completed).length / (todos.length || 1)) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" 
                      style={{ width: `${(todos.filter(todo => todo.completed).length / (todos.length || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content can grow to fill space */}
            <div className="flex-grow"></div>
            
            {/* User Profile Section - Hidden on mobile, visible on desktop */}
            <div className="mt-auto pt-4 border-t border-gray-200 w-full hidden md:block">
              <div className="w-full py-2 px-0">
                <UserProfile fullWidth={true} rightAlignedDropdown={true} />
              </div>
            </div>
          </div>

          {/* Main Content Area - Enhanced */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-50/90 backdrop-blur-sm">
            {/* Enhanced Header */}
            <div className="bg-white shadow-sm flex-none border-b border-gray-100">
              <div className="w-full px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
                <h2 className="text-md md:text-lg font-semibold text-gray-800 capitalize flex items-center gap-2">
                  {activeTab === 'inbox' && <InboxIcon className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />}
                  {activeTab === 'today' && <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />}
                  {activeTab === 'AI' && <SparklesIcon className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />}
                  {activeTab === 'settings' && <Cog6ToothIcon className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />}
                  {activeTab}
                </h2>
                
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="hidden md:block px-2.5 py-1 bg-blue-100/50 text-blue-700 rounded-full text-xs">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message - Enhanced */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 md:px-8 py-3 text-sm flex items-center shadow-sm">
                <span className="flex-1">{error}</span>
                <button 
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {renderContent()}
            </div>

            {/* Input Area - Enhanced */}
            {(activeTab === 'inbox' || activeTab === 'today') && (
              <div className="border-t border-gray-200 bg-white p-4 flex-none">
                <div className="px-4 md:px-0 mx-auto max-w-3xl">
                  <div className="relative flex gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type your task here..."
                      className="flex-1 px-4 py-3 bg-white border border-gray-300 focus:border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm transition-shadow duration-200"
                      disabled={isLoading}
                    />
                    {isLoading && (
                      <span className="absolute right-24 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </span>
                    )}
                    
                    <button 
                      type="button"
                      onClick={addSimpleTask}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-gray-700 text-sm rounded-lg 
                        focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center gap-1 
                        transition-colors duration-300 shadow-sm"
                      disabled={!inputValue.trim()}
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span className="hidden md:inline">Add Task</span>
                    </button>

                    <button 
                      type="button"
                      onClick={handleSubmit}
                      disabled={isPromptLoading || !inputValue.trim()}
                      className="px-3 py-2 bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-700 hover:to-blue-600
                      text-white text-sm rounded-lg shadow-sm transition-all duration-300 flex items-center gap-1 
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPromptLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="hidden md:inline">Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="h-4 w-4" />
                          <span className="hidden md:inline">Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="mt-2 text-red-600 text-sm px-4">{error}</p>
                  )}
                </div>
              </div>
            )}

            {/* Edit Panel - Enhanced */}
            {isEditPanelOpen && selectedTask && (
              <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-20 overflow-y-auto">
                <div className="h-full flex flex-col">
                  <div className="bg-gradient-to-r from-blue-600 to-emerald-500 p-6 text-white">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Task Details</h3>
                      <button
                        onClick={() => {
                          setIsEditPanelOpen(false);
                          setSelectedTask(null);
                        }}
                        className="text-gray-700 hover:text-blue-700 transition-colors"
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                    <p className="text-blue-100 mt-1 text-sm">Edit your task details below</p>
                  </div>

                  <div className="p-6 space-y-5 flex-1">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Task Name
                      </label>
                      <input
                        type="text"
                        value={selectedTask.text}
                        onChange={(e) => updateTaskDetails(selectedTask.id, { text: e.target.value })}
                        className="block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateTaskDetails(selectedTask.id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={selectedTask.priority}
                        onChange={(e) => updateTaskDetails(selectedTask.id, { priority: e.target.value })}
                        className="block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section
                      </label>
                      <select
                        value={selectedTask.section}
                        onChange={(e) => updateTaskDetails(selectedTask.id, { section: e.target.value })}
                        className="block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      >
                        <option value="Work">Work</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Status
                      </label>
                      <div className="flex items-center gap-2">
                        {selectedTask.aiExecutable ? (
                          <>
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-sm font-medium text-emerald-700">AI Ready</span>
                          </>
                        ) : (
                          <>
                            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                            <span className="text-sm font-medium text-gray-700">Manual Task</span>
                          </>
                        )}
                      </div>
                      {selectedTask.aiExecutable && (
                        <button
                          onClick={() => executeAiTask(selectedTask)}
                          className="w-full mt-3 px-4 py-2 bg-emerald-600 text-blue-600 rounded-md hover:bg-emerald-700 
                            transition-colors flex items-center justify-center gap-1.5"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          Execute with AI
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button
                      onClick={() => toggleTodo(selectedTask.id)}
                      className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                        selectedTask.completed 
                          ? 'bg-gray-200 text-blue hover:bg-gray-300' 
                          : 'bg-blue-500 text-gray-700 hover:bg-blue-600'
                      }`}
                    >
                      <CheckIcon className="h-4 w-4" />
                      {selectedTask.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
                    </button>
                    
                    <button
                      onClick={() => {
                        deleteTodo(selectedTask.id);
                        setIsEditPanelOpen(false);
                        setSelectedTask(null);
                      }}
                      className="w-full py-2 px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 
                        transition-colors flex items-center justify-center gap-1.5"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete Task
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;