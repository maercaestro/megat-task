import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { OpenAI } from 'openai'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Brave Search function
async function performBraveSearch(query) {
  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search')
    url.searchParams.set('q', query)
    url.searchParams.set('count', '5')

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_API_KEY
      }
    })

    if (!response.ok) {
      throw new Error(`Brave API error: ${response.status}`)
    }

    const data = await response.json()
    return (data.web?.results || []).map(result => ({
      title: result.title || '',
      description: result.description || '',
      url: result.url || ''
    }))
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

// Task execution endpoint
app.post('/api/execute-task', async (req, res) => {
  try {
    const { text } = req.body
    
    // First, analyze if search is needed
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a task analyzer. Determine if this task requires web search for current information. Return only 'yes' or 'no'."
        },
        {
          role: "user",
          content: text
        }
      ]
    })

    const needsSearch = analysisResponse.choices[0].message.content.toLowerCase() === 'yes'
    let searchResults = []

    if (needsSearch) {
      console.log('Performing search for:', text)
      searchResults = await performBraveSearch(text)
    }

    // Execute task with context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI task executor that helps complete tasks efficiently. 
                   If search results are provided, use them as context for the task.
                   Provide structured, detailed responses.`
        },
        ...(searchResults.length > 0 ? [{
          role: "assistant",
          content: `Here's what I found from searching:\n${JSON.stringify(searchResults, null, 2)}`
        }] : []),
        {
          role: "user",
          content: `Execute this task: ${text}`
        }
      ]
    })

    res.json({
      taskId: Date.now(),
      originalTask: text,
      response: completion.choices[0].message.content,
      searchResults
    })
  } catch (error) {
    console.error('Detailed Error:', error)
    res.status(500).json({ 
      error: 'Failed to execute task with AI',
      details: error.message 
    })
  }
})

// Add task parsing endpoint
app.post('/api/analyze-task', async (req, res) => {
  try {
    const { text } = req.body
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a task analyzer that helps categorize and enhance tasks. Today's date is ${currentDate}.
            For each task:
            1) Extract and clean up the task name into a clear, concise action item
            2) Determine if it's Work or Personal
            3) Set priority level (High/Medium/Low)
            4) Determine if it can be automated with AI (tasks like writing, research, analysis can be done with AI)
            5) Suggest due date based on urgency relative to today:
               - Use "today" for urgent tasks
               - Use "tomorrow" for soon tasks
               - Use "+3 days" to "+7 days" for medium-term tasks
               - Use "+14 days" or "+30 days" for long-term tasks
            6) Provide brief analysis of why these choices were made`
        },
        {
          role: "user",
          content: text
        }
      ],
      functions: [
        {
          name: "analyze_task",
          description: "Analyze a task and return metadata about it",
          parameters: {
            type: "object",
            properties: {
              taskName: {
                type: "string",
                description: "A clean, concise version of the task"
              },
              section: {
                type: "string",
                enum: ["Work", "Personal"]
              },
              priority: {
                type: "string",
                enum: ["High", "Medium", "Low"]
              },
              aiExecutable: {
                type: "boolean",
                description: "Whether this task can be automated or assisted by AI"
              },
              dueDate: {
                type: "string",
                description: "Suggested due date for the task"
              },
              analysis: {
                type: "string",
                description: "Brief analysis of why these choices were made"
              }
            },
            required: ["taskName", "section", "priority", "aiExecutable", "dueDate", "analysis"]
          }
        }
      ],
      function_call: { name: "analyze_task" }
    })

    const result = JSON.parse(response.choices[0].message.function_call.arguments)

    // Convert relative dates to actual dates
    if (result.dueDate) {
      const today = new Date()
      if (result.dueDate === 'today') {
        result.dueDate = today.toISOString()
      } else if (result.dueDate === 'tomorrow') {
        today.setDate(today.getDate() + 1)
        result.dueDate = today.toISOString()
      } else if (result.dueDate.startsWith('+')) {
        const days = parseInt(result.dueDate.match(/\d+/)[0])
        today.setDate(today.getDate() + days)
        result.dueDate = today.toISOString()
      }
    }

    res.json(result)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ 
      error: 'Failed to analyze task',
      details: error.message 
    })
  }
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app