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
  ClipboardDocumentIcon // Add this import
} from '@heroicons/react/24/solid'
import ReactMarkdown from 'react-markdown' // Add to existing imports at top

function App() {
  const [todos, setTodos] = useState(() => {
    const savedTodos = localStorage.getItem('todos')
    return savedTodos ? JSON.parse(savedTodos) : []
  })

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  const [inputValue, setInputValue] = useState('')
  const [activeTab, setActiveTab] = useState('inbox')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState(null)
  const [isResultPanelOpen, setIsResultPanelOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [taskDrafts, setTaskDrafts] = useState([])
  const [completedAiTasks, setCompletedAiTasks] = useState(new Set())
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [taskConversations, setTaskConversations] = useState({})

  // Filter tasks based on active tab
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
      case 'aI':
        return todos.filter(todo => todo.aiExecutable);
      default:
        return [];
    }
  }

  // Update the analyzeTask function (task parsing)
  const analyzeTask = async (text) => {
    try {
      const response = await fetch('http://localhost:3000/api/analyze-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      })
      
      if (!response.ok) {
        throw new Error('Failed to analyze task')
      }

      const data = await response.json()
      return {
        text: data.taskName, // Use the cleaned up task name
        section: data.section,
        priority: data.priority,
        aiExecutable: data.aiExecutable,
        dueDate: data.dueDate,
        analysis: data.analysis
      }
    } catch (error) {
      console.error('Error:', error)
      throw error
    }
  }

  // Add new function to handle task selection
  const handleTaskSelect = (task) => {
    setActiveTaskId(task.id)
    // Find existing draft for this task
    const taskDraft = taskDrafts.find(draft => draft.taskId === task.id)
    if (taskDraft) {
      // Show existing conversation if any
      setChatMessages(taskConversations[task.id] || [])
    } else if (!completedAiTasks.has(task.id)) {
      // Execute task if not completed
      executeAiTask(task)
    }
  }

  // Update executeAiTask function
  const executeAiTask = async (task) => {
    try {
      setIsExecuting(true)
      setActiveTaskId(task.id)
      
      const response = await fetch('http://localhost:3000/api/execute-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: task.text,
          context: task.analysis
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to execute task')
      }

      const result = await response.json()
      
      // Save initial conversation
      const initialConversation = [
        { role: 'user', content: task.text },
        { role: 'assistant', content: result.response }
      ]
      
      setTaskConversations(prev => ({
        ...prev,
        [task.id]: initialConversation
      }))
      
      // Save to task drafts with taskId
      setTaskDrafts(prev => [{
        taskId: task.id,
        timestamp: Date.now(),
        task: task.text,
        response: result.response,
        searchResults: result.searchResults
      }, ...prev])

      // Set chat messages for this task
      setChatMessages(initialConversation)
      
      // Mark task as completed
      setCompletedAiTasks(prev => new Set([...prev, task.id]))

    } catch (error) {
      console.error('Error:', error)
      setError('Failed to execute task with AI')
    } finally {
      setIsExecuting(false)
    }
  }

  // Update handleSubmit to show more detailed errors
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const aiMetadata = await analyzeTask(inputValue)
      
      setTodos([...todos, {
        id: Date.now(),
        text: aiMetadata.text, // Use cleaned up task name
        completed: false,
        section: aiMetadata.section,
        priority: aiMetadata.priority,
        aiExecutable: aiMetadata.aiExecutable,
        dueDate: aiMetadata.dueDate,
        analysis: aiMetadata.analysis // Store analysis for future use
      }])
      setInputValue('')
    } catch (error) {
      setError('Failed to analyze task. Please try again.')
      console.error('Analysis error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  // Update the updateTask function
  const updateTask = (taskId, updates) => {
    setTodos(todos.map(todo => {
      if (todo.id === taskId) {
        const updatedTodo = { ...todo, ...updates }
        // Update selectedTask if this is the task being edited
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(updatedTodo)
        }
        return updatedTodo
      }
      return todo
    }))
  }

  const handleChatSubmit = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || !activeTaskId) return

    try {
      // Add user message to conversation
      const newUserMessage = { role: 'user', content: chatInput }
      setChatMessages(prev => [...prev, newUserMessage])
      
      // Update task conversations
      const updatedMessages = [...(taskConversations[activeTaskId] || []), newUserMessage]
      setTaskConversations(prev => ({
        ...prev,
        [activeTaskId]: updatedMessages
      }))

      // Clear input right away
      setChatInput('')

      // Make API call
      const response = await fetch('http://localhost:3000/api/execute-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: chatInput,
          context: updatedMessages,
          taskId: activeTaskId
        })
      })

      if (!response.ok) throw new Error('Failed to get response')
      
      const result = await response.json()
      
      // Add AI response to conversation
      const aiMessage = { role: 'assistant', content: result.response }
      const finalMessages = [...updatedMessages, aiMessage]
      
      // Update conversations and current chat
      setTaskConversations(prev => ({
        ...prev,
        [activeTaskId]: finalMessages
      }))
      setChatMessages(finalMessages)

      // Update task draft if there are search results
      if (result.searchResults?.length > 0) {
        setTaskDrafts(prev => prev.map(draft => 
          draft.taskId === activeTaskId 
            ? {
                ...draft,
                response: result.response,
                searchResults: [...(draft.searchResults || []), ...result.searchResults]
              }
            : draft
        ))
      }

    } catch (error) {
      console.error('Chat error:', error)
      // Show error in chat
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }
      setChatMessages(prev => [...prev, errorMessage])
      setTaskConversations(prev => ({
        ...prev,
        [activeTaskId]: [...(prev[activeTaskId] || []), errorMessage]
      }))
    }
  }

  const navItems = [
    { id: 'inbox', icon: InboxIcon, label: 'Inbox' },
    { id: 'today', icon: CalendarIcon, label: 'Today' },
    { id: 'aI', icon: SparklesIcon, label: 'AI Tasks' },
    { id: 'settings', icon: Cog6ToothIcon, label: 'Settings' },
  ]

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === 'settings') {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-xl font-medium text-gray-700 mb-2">Settings</h3>
            <p className="text-gray-500">Created by Abu Huzaifah</p>
          </div>
        </div>
      )
    }

    if (activeTab === 'aI') {
      return (
        <div className="flex-1 flex flex-col">
          {/* Scrollable Task Bar */}
          <div className="flex-none p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {getFilteredTasks().filter(todo => todo.aiExecutable).map(todo => (
                <button
                  key={todo.id}
                  onClick={() => handleTaskSelect(todo)}
                  disabled={isExecuting && activeTaskId === todo.id}
                  className={`flex-none px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md 
                    transition-all duration-200 flex items-center gap-2
                    ${activeTaskId === todo.id ? 'ring-2 ring-blue-500' : ''}
                    ${completedAiTasks.has(todo.id) ? 'opacity-75' : ''}`}
                >
                  <span className="text-sm text-gray-700 whitespace-nowrap">{todo.text}</span>
                  {isExecuting && activeTaskId === todo.id ? (
                    <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : completedAiTasks.has(todo.id) ? (
                    <CheckIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <ChatBubbleBottomCenterIcon className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Task Drafts */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {taskDrafts
                .filter(draft => !activeTaskId || draft.taskId === activeTaskId)
                .map((draft, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium text-gray-900">{draft.task}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(draft.response);
                            const btn = document.getElementById(`copy-btn-${index}`);
                            btn.innerHTML = "Copied!";
                            setTimeout(() => {
                              btn.innerHTML = "Copy";
                            }, 2000);
                          }}
                          id={`copy-btn-${index}`}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          <ClipboardDocumentIcon className="h-3 w-3" />
                          <span>Copy</span>
                        </button>
                        <div className="text-xs text-gray-500">
                          {new Date(draft.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-sm text-gray-600">
                      <ReactMarkdown>{draft.response}</ReactMarkdown>
                    </div>
                    {draft.searchResults?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-xs font-medium text-gray-700 mb-1">Sources:</div>
                        <div className="space-y-1">
                          {draft.searchResults.map((result, idx) => (
                            <a
                              key={idx}
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-500 hover:underline truncate"
                            >
                              {result.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Chat Interface */}
            <div className="flex-none border-t border-gray-200 bg-white p-4">
              <div className="mb-4 max-h-32 overflow-y-auto">
                {chatMessages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`mb-2 p-2 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-blue-100 ml-12' 
                        : 'bg-gray-100 mr-12'
                    }`}
                  >
                    <div className="text-sm">
                      {message.content}
                    </div>
                  </div>
                ))}
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-gray-700 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )
    }

    // Regular task list view for other tabs
    return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="space-y-4">
          {getFilteredTasks().map(todo => (
            <div 
              key={todo.id}
              onClick={() => {
                if (!isResultPanelOpen) { // Only open edit panel if result panel is closed
                  setSelectedTask(todo)
                  setIsEditPanelOpen(true)
                }
              }}
              className="bg-white rounded-lg shadow p-4 flex items-center gap-4 transform transition duration-300 hover:scale-105 cursor-pointer"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation() // Stop event from bubbling up
                  toggleTodo(todo.id)
                }}
                className={`h-5 w-5 rounded border transition-colors duration-300 ${
                  todo.completed 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'border-gray-300'
                } flex items-center justify-center`}
              >
                {todo.completed && <CheckIcon className="h-4 w-4 text-gray-700" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className={`text-lg transition-colors duration-300 ${
                  todo.completed ? 'line-through text-gray-400' : 'text-gray-700'
                }`}>
                  {todo.text}
                </div>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium
                    ${todo.section === 'Work' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {todo.section}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium
                    ${todo.priority === 'High' 
                      ? 'bg-red-100 text-red-700'
                      : todo.priority === 'Medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                    {todo.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium
                    ${todo.aiExecutable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                    {todo.aiExecutable ? '✅ AI Ready' : '❌ Manual Task'}
                  </span>
                  {todo.dueDate && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      Due: {new Date(todo.dueDate).toDateString()}
                    </span>
                  )}
                </div>
              </div>

              {todo.aiExecutable && (
                <button
                  className="p-2 text-gray-400 hover:text-blue-500 transition-transform duration-300"
                  onClick={(e) => {
                    e.stopPropagation() // Stop event from bubbling up
                    executeAiTask(todo)
                  }}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                  e.stopPropagation() // Stop event from bubbling up
                  deleteTodo(todo.id)
                }}
                className="p-2 text-gray-400 hover:text-red-500 transition-transform duration-300"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gradient-to-br from-emerald-400 to-blue-500">
      {/* Left sidebar */}
      <div className="w-1/5 flex-none bg-white/90 backdrop-blur-sm shadow-lg p-4 overflow-y-auto">
        {/* Logo and title */}
        <div className="flex items-center gap-3 px-4 mb-8">
          <img 
            src={logo}
            alt="Task Manager Logo" 
            className="h-20 w-20 rounded-lg object-cover"
          />
          <p3 className="font-bold text-blue-800 truncate">
            Megat-Task
          </p3>
        </div>
        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-4 text-base font-medium rounded-xl
                  transition-all duration-300 hover:translate-x-1
                  ${activeTab === item.id 
                    ? 'text-blue-600 bg-blue-50/50 shadow-sm translate-x-2' 
                    : 'text-gray-700 hover:bg-white-50/50'
                  }`}
              >
                <Icon className={`h-5 w-5 ${
                  activeTab === item.id 
                    ? 'text-blue-600' 
                    : 'text-gray-600'
                }`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="w-4/5 flex bg-white/100 backdrop-blur-sm shadow-lg flex-col overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-100 shadow-sm flex-none"> 
          <div className="w-full px-8 py-4">
            <h2 className="text-xl font-semibold text-gray-700 capitalize">
              {activeTab}
            </h2>
          </div>
        </div>

        {/* Dynamic content */}
        {renderContent()}

        {/* Input area - show only if not in settings */}
        {activeTab !== 'settings' && activeTab !== 'aI' && (
          <div className="border-t bg-gray-100 p-4 flex-none">
            <form onSubmit={handleSubmit} className="px-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your task here..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                />
                
                {/* Manual Add Button */}
                <button 
                  type="button"
                  onClick={() => {
                    if (!inputValue.trim()) return;
                    setTodos([...todos, {
                      id: Date.now(),
                      text: inputValue,
                      completed: false,
                      section: 'Personal',  // Default values
                      priority: 'Low',      // Simplified to basic priority
                      aiExecutable: false,  // Mark as manual task
                      dueDate: null        // No default due date
                    }]);
                    setInputValue('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-500 text-gray-700 text-sm rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center gap-2 
                    transition-colors duration-300"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Task
                </button>

                {/* AI Analysis Button */}
                <button 
                  type="submit"
                  disabled={isLoading}
                  className={`px-4 py-2 ${
                    isLoading 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-gray-700 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 transition-colors duration-300`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      Prompt
                    </>
                  )}
                </button>
              </div>
            </form>
            {error && (
              <p className="mt-2 text-red-600 text-sm">{error}</p>
            )}
          </div>
        )}

        {/* Edit Panel */}
        {isEditPanelOpen && selectedTask && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col p-6">
              {/* Panel Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Edit Task</h3>
                <button
                  onClick={() => {
                    setIsEditPanelOpen(false)
                    setSelectedTask(null) // Clear selected task when closing
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Edit Form */}
              <div className="space-y-6">
                {/* Task Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Task Name
                  </label>
                  <input
                    type="text"
                    value={selectedTask.text}
                    onChange={(e) => updateTask(selectedTask.id, { text: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={new Date(selectedTask.dueDate).toISOString().split('T')[0]}
                    onChange={(e) => updateTask(selectedTask.id, { dueDate: new Date(e.target.value).toISOString() })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Priority
                  </label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => updateTask(selectedTask.id, { priority: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Section
                  </label>
                  <select
                    value={selectedTask.section}
                    onChange={(e) => updateTask(selectedTask.id, { section: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                {/* AI Status (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    AI Status
                  </label>
                  <div className="mt-1 text-sm text-gray-500">
                    {selectedTask.aiExecutable ? '✅ AI Ready' : '❌ Manual Task'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result Panel */}
        {isResultPanelOpen && executionResult && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">AI Task Result</h3>
                <button
                  onClick={() => {
                    setIsResultPanelOpen(false)
                    setExecutionResult(null)
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Task
                  </label>
                  <p className="text-gray-600">{executionResult.originalTask}</p>
                </div>

                {executionResult.searchResults?.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Results
                    </label>
                    <div className="space-y-2">
                      {executionResult.searchResults.map((result, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">{result.title}</p>
                          <a href={result.url} className="text-xs text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                            {result.url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Response
                  </label>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-600 whitespace-pre-wrap">{executionResult.response}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App