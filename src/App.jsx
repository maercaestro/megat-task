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

  // Update the executeAiTask function to handle streaming
  const executeAiTask = async (task) => {
    try {
      setIsExecuting(true)
      setActiveTaskId(task.id)
      
      // Initialize a draft for this task if it doesn't exist
      setTaskDrafts(prev => {
        // Check if a draft already exists for this task
        if (!prev.find(draft => draft.taskId === task.id)) {
          return [{
            taskId: task.id,
            timestamp: Date.now(),
            task: task.text,
            response: '', // Start with an empty response
            searchResults: []
          }, ...prev]
        }
        return prev
      })
      
      // Set initial conversation
      const initialMessage = { role: 'user', content: task.text }
      setTaskConversations(prev => ({
        ...prev,
        [task.id]: [initialMessage]
      }))
      
      setChatMessages([initialMessage])
      
      // Create fetch request with proper headers for streaming
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
      })
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      
      // Set up event source reader
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let streamedResponse = '' // Accumulate full response
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        // Decode the chunk into text
        const chunk = decoder.decode(value)
        
        // Process each event in the chunk (there might be multiple)
        const events = chunk.split('\n\n').filter(Boolean)
        
        for (const eventText of events) {
          if (eventText.startsWith('data: ')) {
            const jsonData = eventText.slice(6) // Remove 'data: ' prefix
            try {
              const data = JSON.parse(jsonData)
              
              // Handle different event types
              if (data.type === 'search_results') {
                // Update draft with search results
                setTaskDrafts(prev => prev.map(draft => 
                  draft.taskId === task.id 
                    ? { ...draft, searchResults: data.searchResults }
                    : draft
                ))
              } 
              else if (data.type === 'content_chunk') {
                // Append content chunk to the response
                streamedResponse += data.content
                
                // Update draft with the accumulated response
                setTaskDrafts(prev => prev.map(draft => 
                  draft.taskId === task.id 
                    ? { ...draft, response: streamedResponse }
                    : draft
                ))
                
                // Update conversation with streaming content
                const assistantMessage = { 
                  role: 'assistant', 
                  content: streamedResponse 
                }
                
                // Update the full conversation with latest content
                setTaskConversations(prev => {
                  const currentConversation = prev[task.id] || [initialMessage]
                  // Replace the assistant message if it exists, or add it
                  if (currentConversation.find(msg => msg.role === 'assistant')) {
                    return {
                      ...prev,
                      [task.id]: currentConversation.map(msg => 
                        msg.role === 'assistant' ? assistantMessage : msg
                      )
                    }
                  } else {
                    return {
                      ...prev,
                      [task.id]: [...currentConversation, assistantMessage]
                    }
                  }
                })
                
                // Update chat messages for active chat view
                setChatMessages(prev => {
                  if (prev.find(msg => msg.role === 'assistant')) {
                    return prev.map(msg => 
                      msg.role === 'assistant' ? assistantMessage : msg
                    )
                  } else {
                    return [...prev, assistantMessage]
                  }
                })
              }
              else if (data.type === 'completion') {
                // Mark task as completed
                setCompletedAiTasks(prev => new Set([...prev, task.id]))
                
                // Ensure we have the final response
                if (data.response && data.response !== streamedResponse) {
                  // Update chat and draft with the final complete response
                  setTaskDrafts(prev => prev.map(draft => 
                    draft.taskId === task.id 
                      ? { 
                          ...draft, 
                          response: data.response,
                          searchResults: data.searchResults || draft.searchResults
                        }
                      : draft
                  ))
                }
              }
              else if (data.type === 'error') {
                throw new Error(data.details || 'Server error')
              }
            } catch (e) {
              console.error('Error parsing event data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to execute task with AI')
      
      // Update conversation with error
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }
      setChatMessages(prev => [...prev, errorMessage])
      setTaskConversations(prev => ({
        ...prev,
        [task.id]: [...(prev[task.id] || []), errorMessage]
      }))
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

  // Update the handleChatSubmit function to use streaming
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

      // Create fetch request with proper headers for streaming
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

      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      
      // Set up event source reader
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let streamedResponse = '' // Accumulate full response
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }
        
        // Decode the chunk into text
        const chunk = decoder.decode(value)
        
        // Process each event in the chunk (there might be multiple)
        const events = chunk.split('\n\n').filter(Boolean)
        
        for (const eventText of events) {
          if (eventText.startsWith('data: ')) {
            const jsonData = eventText.slice(6) // Remove 'data: ' prefix
            try {
              const data = JSON.parse(jsonData)
              
              // Handle different event types
              if (data.type === 'search_results') {
                // Update draft with search results
                setTaskDrafts(prev => prev.map(draft => 
                  draft.taskId === activeTaskId 
                    ? { ...draft, searchResults: data.searchResults }
                    : draft
                ))
              } 
              else if (data.type === 'content_chunk') {
                // Append content chunk to the response
                streamedResponse += data.content
                
                // Update draft with the accumulated response
                setTaskDrafts(prev => prev.map(draft => 
                  draft.taskId === activeTaskId 
                    ? { ...draft, response: streamedResponse }
                    : draft
                ))
                
                // Update conversation with streaming content
                const assistantMessage = { 
                  role: 'assistant', 
                  content: streamedResponse 
                }
                
                // Update the full conversation with latest content
                setTaskConversations(prev => {
                  const currentConversation = prev[activeTaskId] || []
                  // Replace the assistant message if it exists, or add it
                  if (currentConversation.find(msg => msg.role === 'assistant' && msg !== newUserMessage)) {
                    return {
                      ...prev,
                      [activeTaskId]: currentConversation.map(msg => 
                        msg.role === 'assistant' && msg !== newUserMessage ? assistantMessage : msg
                      )
                    }
                  } else {
                    return {
                      ...prev,
                      [activeTaskId]: [...currentConversation, assistantMessage]
                    }
                  }
                })
                
                // Update chat messages for active chat view
                setChatMessages(prev => {
                  const assistantExists = prev.find(msg => msg.role === 'assistant' && msg !== newUserMessage)
                  if (assistantExists) {
                    return prev.map(msg => 
                      msg.role === 'assistant' && msg !== newUserMessage ? assistantMessage : msg
                    )
                  } else {
                    return [...prev, assistantMessage]
                  }
                })
              }
              else if (data.type === 'completion') {
                console.log('Chat completion received:', data)
                
                // Ensure we have the final response
                if (data.response && data.response !== streamedResponse) {
                  streamedResponse = data.response
                  
                  // Update draft with the final response
                  setTaskDrafts(prev => prev.map(draft => 
                    draft.taskId === activeTaskId 
                      ? { 
                          ...draft, 
                          response: data.response,
                          searchResults: [...(draft.searchResults || []), ...(data.searchResults || [])]
                        }
                      : draft
                  ))
                  
                  // Final update to conversations
                  const finalMessage = { role: 'assistant', content: data.response }
                  setTaskConversations(prev => {
                    const currentConversation = prev[activeTaskId] || []
                    // Replace the assistant message or add it
                    if (currentConversation.find(msg => msg.role === 'assistant' && msg !== newUserMessage)) {
                      return {
                        ...prev,
                        [activeTaskId]: currentConversation.map(msg => 
                          msg.role === 'assistant' && msg !== newUserMessage ? finalMessage : msg
                        )
                      }
                    } else {
                      return {
                        ...prev,
                        [activeTaskId]: [...currentConversation, finalMessage]
                      }
                    }
                  })
                  
                  setChatMessages(prev => {
                    const assistantExists = prev.find(msg => msg.role === 'assistant' && msg !== newUserMessage)
                    if (assistantExists) {
                      return prev.map(msg => 
                        msg.role === 'assistant' && msg !== newUserMessage ? finalMessage : msg
                      )
                    } else {
                      return [...prev, finalMessage]
                    }
                  })
                }
              }
              else if (data.type === 'error') {
                throw new Error(data.details || 'Server error')
              }
            } catch (e) {
              console.error('Error parsing event data:', e, eventText)
            }
          }
        }
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
          <div className="text-center bg-white/80 backdrop-blur-sm p-8 rounded-xl shadow-lg">
            <img 
              src={logo}
              alt="Megat-Task Logo" 
              className="h-24 w-24 mx-auto mb-6 rounded-lg object-cover"
            />
            <h3 className="text-xl font-medium text-gray-700 mb-2">Settings</h3>
            <p className="text-gray-500">Created by Abu Huzaifah Bidin</p>
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-gray-500 text-sm">Version 1.0.0</p>
            </div>
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
                
                {/* Responsive tags - show differently on mobile */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {/* On mobile: Show only priority and due date */}
                  <div className="md:hidden flex gap-1.5">
                    {/* Priority - always show on mobile */}
                    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-medium
                      ${todo.priority === 'High' 
                        ? 'bg-red-100 text-red-700'
                        : todo.priority === 'Medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                      {todo.priority}
                    </span>
                    
                    {/* Due date - always show if exists */}
                    {todo.dueDate && (
                      <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-gray-100 text-gray-700">
                        Due: {new Date(todo.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {/* On desktop: Show all tags */}
                  <div className="hidden md:flex flex-wrap gap-2">
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

  // Update the main container and layout structure
  return (
    <div className="fixed inset-0 flex flex-col md:flex-row overflow-hidden bg-gradient-to-br from-emerald-400 to-blue-500">
      {/* Sidebar - collapses to top on mobile */}
      <div className="w-full md:w-[300px] flex-none bg-white/90 backdrop-blur-sm shadow-lg 
        p-4 overflow-y-auto border-b md:border-b-0">
        {/* Logo and title - adjusts size on mobile */}
        <div className="flex items-center gap-3 px-2 md:px-4 mb-4 md:mb-8">
          <img 
            src={logo}
            alt="Task Manager Logo" 
            className="h-12 w-12 md:h-20 md:w-20 rounded-lg object-cover"
          />
          <h3 className="text-xl md:text-2xl font-bold text-blue-800 truncate">
            Megat-Task
          </h3>
        </div>

        {/* Navigation - transparent default, gray on hover */}
        <nav className="flex md:block overflow-x-auto md:overflow-visible pb-2 md:pb-0 
          scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-none md:w-full flex items-center gap-1.5 md:gap-2
                  px-3 md:px-4 py-1.5 md:py-2.5 mr-2 md:mr-0 md:mb-1.5
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
            )
          })}
        </nav>
      </div>

      {/* Main content - takes remaining space */}
      <div className="flex-1 flex flex-col min-h-0 bg-white/100 backdrop-blur-sm shadow-lg">
        {/* Header - stays at top */}
        <div className="bg-gray-100 shadow-sm flex-none">
          <div className="w-full px-4 md:px-8 py-3 md:py-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700 capitalize">
              {activeTab}
            </h2>
          </div>
        </div>

        {/* Show errors below the header if any */}
        {error && (
          <div className="bg-red-100 text-red-700 px-4 md:px-8 py-2 text-sm flex items-center">
            <span className="flex-1">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Dynamic content - scrollable area */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>

        {/* Input area - show only if in inbox or today tabs */}
        {(activeTab === 'inbox' || activeTab === 'today') && (
          <div className="border-t bg-gray-100 p-4 flex-none">
            <div className="px-4 md:px-0 mx-auto max-w-3xl">
              <div className="relative flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your task here..."
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  disabled={isLoading}
                />
                {isLoading && (
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </span>
                )}
                
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
                  className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-gray-700 text-sm rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center gap-1 
                    transition-colors duration-300"
                  disabled={!inputValue.trim()}
                >
                  <PlusIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Add Task</span>
                </button>

                {/* AI Analysis Button */}
                <button 
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !inputValue.trim()}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-gray-700 text-sm rounded-lg 
                    shadow-sm transition-colors duration-300 flex items-center gap-1 
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Prompt</span>
                </button>
              </div>
              {error && (
                <p className="mt-2 text-red-600 text-sm px-4">{error}</p>
              )}
            </div>
          </div>
        )}

        {/* Edit Panel */}
        {isEditPanelOpen && selectedTask && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-20">
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
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateTask(selectedTask.id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
      </div>
    </div>
  )
}

export default App