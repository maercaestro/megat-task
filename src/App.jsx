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
  ArrowLeftIcon,
  PencilIcon // Import PencilIcon for Edit button
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
  const [completedAiTasks, setCompletedAiTasks] = useState(new Set());
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskConversations, setTaskConversations] = useState({});
  const [showMobileTasksModal, setShowMobileTasksModal] = useState(false);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [taskExecutionsByTask, setTaskExecutionsByTask] = useState({});
  const [editingDraftId, setEditingDraftId] = useState(null); // ID of the draft being edited
  const [editingDraftContent, setEditingDraftContent] = useState(''); // Content being edited

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

          // 2. Load executions for AI tasks
          const completedTaskIds = new Set();
          const loadedExecutions = {}; // Use an object to store executions by task ID

          for (const task of formattedTasks) {
            if (task.aiExecutable) {
              console.log(`Checking executions for task: ${task.id} - ${task.text}`);
              // Fetch executions ordered by timestamp (newest first)
              const executions = await getTaskExecutions(task.id);
              console.log(`Found ${executions?.length || 0} executions`);

              if (executions && executions.length > 0) {
                completedTaskIds.add(task.id);
                // Store all executions for this task
                loadedExecutions[task.id] = executions.map(exec => ({
                  executionId: exec.id, // Store execution ID
                  taskId: task.id,
                  timestamp: new Date(exec.timestamp).getTime(),
                  task: task.text, // Keep original task text for context if needed
                  response: exec.response,
                  searchResults: exec.search_results || []
                }));
              }
            }
          }

          // Update states
          setCompletedAiTasks(completedTaskIds);
          setTaskExecutionsByTask(loadedExecutions); // Update the new state

          // If AI tab is active, set the first task with executions as active
          if (activeTab === 'AI') {
              const firstExecutedTaskId = Object.keys(loadedExecutions)[0];
              if (firstExecutedTaskId) {
                  setActiveTaskId(firstExecutedTaskId);
                  // Load conversation for the first active task
                  const conversations = await getTaskConversation(firstExecutedTaskId);
                   if (conversations && conversations.length > 0) {
                      setChatMessages(conversations.map(msg => ({
                          role: msg.role,
                          content: msg.content
                      })));
                      setTaskConversations(prev => ({
                          ...prev,
                          [firstExecutedTaskId]: conversations.map(msg => ({
                              role: msg.role,
                              content: msg.content
                          }))
                      }));
                  }
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
  }, [isAuthenticated, activeTab]); // Keep activeTab dependency

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
    setChatMessages([]); // Clear chat when selecting a new task initially
  
    try {
      const user = await getCurrentUser();
  
      // 1. Load conversation history for the selected task
      const conversationHistory = await getTaskConversation(task.id);
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
  
      // 2. Check if executions are already loaded
      if (!taskExecutionsByTask[task.id]) {
        // If not loaded, fetch them now
        const executions = await getTaskExecutions(task.id);
        if (executions && executions.length > 0) {
          setTaskExecutionsByTask(prev => ({
            ...prev,
            [task.id]: executions.map(exec => ({
              executionId: exec.id,
              taskId: task.id,
              timestamp: new Date(exec.timestamp).getTime(),
              task: task.text,
              response: exec.response,
              searchResults: exec.search_results || []
            }))
          }));
          setCompletedAiTasks(prev => new Set([...prev, task.id]));
        } else if (task.aiExecutable) {
          // If no executions found and it's executable, run it
          console.log("No executions found, executing task:", task.id);
          executeAiTask(task); // This will add the first execution
        }
      } else {
          // Executions already loaded, ensure completed status is set
          if (!completedAiTasks.has(task.id) && taskExecutionsByTask[task.id]?.length > 0) {
               setCompletedAiTasks(prev => new Set([...prev, task.id]));
          }
      }
  
    } catch (error) {
      console.error('Error loading task data:', error);
      setError('Failed to load task details.');
    }
  };

  const executeAiTask = async (task) => {
    try {
      setIsExecuting(true);
      setActiveTaskId(task.id);
      console.log(`[executeAiTask] Started for task ${task.id}`);

      // Add a placeholder draft immediately if none exists
      setTaskExecutionsByTask(prev => {
        if (!prev[task.id] || prev[task.id].length === 0) {
          return {
            ...prev,
            [task.id]: [{
              executionId: `temp-${Date.now()}`, // Temporary ID
              taskId: task.id,
              timestamp: Date.now(),
              task: task.text,
              response: "Generating...", // Placeholder text
              searchResults: []
            }]
          };
        }
        return prev; // Return existing if drafts already present
      });


      const initialMessage = { role: 'user', content: task.text };
      setTaskConversations(prev => ({
        ...prev,
        [task.id]: [initialMessage]
      }));
      setChatMessages([initialMessage, { role: 'assistant', content: 'Generating...' }]); // Add placeholder to chat too

      // ... (save initial user message to DB) ...
      const user = await getCurrentUser();
       await saveConversationMessage({
          taskId: task.id,
          userId: user.id,
          role: 'user',
          content: task.text
        });


      console.log("Executing AI task:", { /* ... */ });

      const response = await fetch('http://localhost:3000/api/execute-task', {
        method: 'POST', // Ensure this is correctly specified
        headers: {
          'Content-Type': 'application/json',
          // Add any other headers if needed, e.g., Authorization
        },
        body: JSON.stringify({
          text: task.text,
          taskId: task.id,
          isFollowUp: false // Explicitly set for initial execution
          // context: null // Explicitly null if not needed
        })
      });

      console.log(`[executeAiTask] Fetch response status: ${response.status}`); // Log status

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[executeAiTask] Server error response: ${errorText}`);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let streamedResponse = '';
      let searchResults = [];
      let finalExecutionData = null; // To store the final data from the 'completion' event

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const events = chunk.split('\n\n').filter(Boolean);

        for (const eventText of events) {
          if (eventText.startsWith('data: ')) {
            try {
              const jsonData = eventText.slice(6);
              const data = JSON.parse(jsonData);

              if (data.type === 'content_chunk') {
                streamedResponse += data.content;

                // --- UPDATE DRAFT STATE DURING STREAM ---
                setTaskExecutionsByTask(prev => {
                  const currentTaskExecutions = prev[task.id] || [];
                  // Update the first (latest) draft's response
                  const updatedExecutions = currentTaskExecutions.map((exec, index) =>
                    index === 0 ? { ...exec, response: streamedResponse } : exec
                  );
                  return { ...prev, [task.id]: updatedExecutions };
                });
                // --- END DRAFT UPDATE ---

                // Update chat placeholder
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  const assistantIndex = newMessages.findIndex(msg => msg.role === 'assistant');
                  if (assistantIndex !== -1) {
                    newMessages[assistantIndex] = { role: 'assistant', content: streamedResponse };
                  }
                  return newMessages;
                });

              } else if (data.type === 'search_results') {
                searchResults = data.results || [];
                // Update the draft with search results if needed (optional during stream)
                setTaskExecutionsByTask(prev => {
                   const currentTaskExecutions = prev[task.id] || [];
                   const updatedExecutions = currentTaskExecutions.map((exec, index) =>
                      index === 0 ? { ...exec, searchResults: searchResults } : exec
                   );
                   return { ...prev, [task.id]: updatedExecutions };
                });

              } else if (data.type === 'completion') {
                // Store the final data from the completion event
                finalExecutionData = data;
                streamedResponse = data.response; // Ensure final response is captured
                searchResults = data.searchResults || [];
              } else if (data.type === 'error') {
                throw new Error(data.details || data.error || 'Unknown server error');
              }
            } catch (e) {
              console.error("Error parsing event data:", e, "Data:", eventText);
            }
          }
        }
      }

      // --- SAVE FINAL EXECUTION AFTER STREAM ---
      try {
        const userId = user.id || user.sub;

        // Use finalExecutionData if available, otherwise use streamedResponse
        const finalResponseToSave = finalExecutionData?.response ?? streamedResponse;
        const finalSearchResultsToSave = finalExecutionData?.searchResults ?? searchResults;


        // Save the final execution to the database
        const savedExecution = await saveTaskExecution({
          taskId: task.id,
          userId: userId,
          response: finalResponseToSave,
          searchResults: finalSearchResultsToSave
        });

        // Create the final execution object for the state
        const finalExecutionState = {
          executionId: savedExecution.id, // Use the real ID from DB
          taskId: task.id,
          timestamp: new Date(savedExecution.timestamp).getTime(),
          task: task.text,
          response: finalResponseToSave,
          searchResults: finalSearchResultsToSave
        };

        // Update the state: Replace the temporary draft with the final one
        setTaskExecutionsByTask(prev => {
          const currentTaskExecutions = prev[task.id] || [];
          // Replace the first draft (which might have a temp ID) with the final saved one
          const updatedExecutions = [finalExecutionState, ...currentTaskExecutions.slice(1)];
          return { ...prev, [task.id]: updatedExecutions };
        });

        // Save final assistant message to conversation history
         await saveConversationMessage({
            taskId: task.id,
            userId: userId,
            role: 'assistant',
            content: finalResponseToSave
         });

         // Update chat UI with final message (might be redundant if streaming worked perfectly)
         setChatMessages(prev => {
             const newMessages = [...prev];
             const assistantIndex = newMessages.findIndex(msg => msg.role === 'assistant');
             if (assistantIndex !== -1) {
                 newMessages[assistantIndex] = { role: 'assistant', content: finalResponseToSave };
             } else {
                 // Should not happen if placeholder was added, but as fallback:
                 newMessages.push({ role: 'assistant', content: finalResponseToSave });
             }
             return newMessages;
         });


        // Mark task as completed
        setCompletedAiTasks(prev => new Set([...prev, task.id]));

      } catch (dbError) {
        console.error("Error saving final execution:", dbError);
        setError("Failed to save final AI response.");
        // Optionally update UI to show save error
      }
      // --- END SAVE FINAL EXECUTION ---

    } catch (error) {
      console.error('[executeAiTask] Error:', error);
      setError(`AI Task Error: ${error.message}`);
      // ... error handling for UI ...
    } finally {
      setIsExecuting(false);
      console.log(`[executeAiTask] Finished for task ${task.id}`);
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

      // Make server request using the /api/followup endpoint
      const response = await fetch('http://localhost:3000/api/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: chatInput,
          originalText: taskExecutionsByTask[activeTaskId]?.[0]?.task, // Get original task text from latest execution
          previousResponse: taskExecutionsByTask[activeTaskId]?.[0]?.response || '', // Get previous response from latest execution
          taskId: activeTaskId
        })
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      // Update UI with assistant's response
      const assistantMessage = { role: 'assistant', content: result.response };
      setChatMessages(prev => [...prev, assistantMessage]);

      // Save the assistant's response to conversation history
      await saveConversationMessage({
          taskId: activeTaskId,
          userId: user.id, // Ensure user is defined in this scope
          role: 'assistant',
          content: result.response
      });

      // Save the new execution result to the database
      const savedExecution = await saveTaskExecution({
          taskId: activeTaskId,
          userId: user.id, // Ensure user is defined
          response: result.response,
          searchResults: [] // Assuming no new search results for follow-up
      });

      // Create the new execution object for the state
      const newExecution = {
          executionId: savedExecution.id,
          taskId: activeTaskId,
          timestamp: new Date(savedExecution.timestamp).getTime(),
          task: taskExecutionsByTask[activeTaskId]?.[0]?.task || '', // Reuse original task text
          response: result.response,
          searchResults: []
      };

      // Update the taskExecutionsByTask state correctly
      setTaskExecutionsByTask(prev => ({
          ...prev,
          [activeTaskId]: [newExecution, ...(prev[activeTaskId] || [])] // Add new execution to the beginning
      }));

      // Mark as completed if not already
      setCompletedAiTasks(prev => new Set([...prev, activeTaskId]));

    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Add helper functions for editing
  const handleEditClick = (draft) => {
    setEditingDraftId(draft.executionId);
    setEditingDraftContent(draft.response);
  };

  const handleCancelEdit = () => {
    setEditingDraftId(null);
    setEditingDraftContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingDraftId) return;

    // Update the state optimistically
    setTaskExecutionsByTask(prev => {
      const updatedExecutionsForTask = (prev[activeTaskId] || []).map(exec =>
        exec.executionId === editingDraftId
          ? { ...exec, response: editingDraftContent }
          : exec
      );
      return { ...prev, [activeTaskId]: updatedExecutionsForTask };
    });

    // TODO: Persist the change to the database
    // You'll need a function like `updateTaskExecutionResponse(editingDraftId, editingDraftContent)`
    // in supabaseClient.js and potentially call it here.
    // Example:
    // try {
    //   await updateTaskExecutionResponse(editingDraftId, editingDraftContent);
    // } catch (error) {
    //   console.error("Failed to save edit to DB:", error);
    //   setError("Failed to save your changes.");
    //   // Optionally revert optimistic update here
    // }

    // Clear editing state
    handleCancelEdit();
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
      const currentExecutions = taskExecutionsByTask[activeTaskId] || [];

      return (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Drafts display area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-0">
              {!activeTaskId ? (
                 <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    {/* ... (Empty state when no task is selected) ... */}
                     <h3 className="text-lg font-medium text-gray-700 mb-2">AI Assistant</h3>
                     <p className="text-gray-500 max-w-sm mx-auto mb-6">
                        Select an AI-executable task from the right panel to view or generate drafts.
                     </p>
                 </div>
              ) : currentExecutions.length === 0 && !isExecuting ? (
                 <div className="h-full flex flex-col items-center justify-center text-center p-8">
                     {/* ... (Empty state when task is selected but has no drafts yet) ... */}
                     <h3 className="text-lg font-medium text-gray-700 mb-2">No Drafts Yet</h3>
                     <p className="text-gray-500 max-w-sm mx-auto mb-6">
                        This task hasn't been executed by the AI yet. The first draft will appear here once generated.
                     </p>
                 </div>
              ) : (
                <div className="space-y-6 pb-4"> {/* Increased spacing between drafts */}
                  {currentExecutions.map((draft, index) => {
                    const isEditingThisDraft = editingDraftId === draft.executionId;
                    return (
                      <div key={draft.executionId} className={`bg-white rounded-lg shadow-md p-5 border ${isEditingThisDraft ? 'border-blue-300 ring-2 ring-blue-200' : 'border-gray-200'} relative group transition-all`}>
                        {/* Draft Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-xs text-gray-500">
                            Draft {currentExecutions.length - index} (Generated: {new Date(draft.timestamp).toLocaleString()})
                          </div>
                          {/* Action Buttons */}
                          <div className={`flex items-center gap-2 transition-opacity ${isEditingThisDraft ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {isEditingThisDraft ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  title="Save changes"
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                                >
                                  <CheckIcon className="h-3 w-3" />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  title="Cancel edit"
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                  <span>Cancel</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditClick(draft)}
                                  title="Edit response"
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => navigator.clipboard.writeText(draft.response)}
                                  title="Copy response"
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                >
                                  <ClipboardDocumentIcon className="h-3 w-3" />
                                  <span>Copy</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Draft Content - Conditional Rendering */}
                        {isEditingThisDraft ? (
                          <textarea
                            value={editingDraftContent}
                            onChange={(e) => setEditingDraftContent(e.target.value)}
                            className="w-full h-60 p-3 border border-gray-300 rounded-md focus:ring-blue-300 focus:border-blue-400 text-sm font-mono resize-y"
                            placeholder="Edit Markdown content..."
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none overflow-hidden break-words text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100 min-h-[100px]">
                            <ReactMarkdown>{draft.response || "No response content."}</ReactMarkdown>
                          </div>
                        )}

                        {/* Search Results (only show when not editing) */}
                        {!isEditingThisDraft && draft.searchResults && draft.searchResults.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="text-xs font-medium text-gray-600 mb-2">Sources used:</div>
                            <div className="flex flex-wrap gap-2">
                              {draft.searchResults.map((result, idx) => (
                                <a
                                  key={idx}
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 px-2 py-1 rounded truncate transition-colors max-w-[200px]"
                                  title={result.title || "Source link"}
                                >
                                  {result.title || new URL(result.url).hostname}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isExecuting && activeTaskId && (
                    <div className="text-center py-4 text-gray-500">Generating new draft...</div>
                  )}
                </div>
              )}
            </div>

            {/* Fixed Chat Interface */}
            {/* ... existing chat rendering ... */}
          </div>

          {/* Right Sidebar */}
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