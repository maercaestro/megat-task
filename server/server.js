import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { OpenAI } from 'openai'
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { ExpressServerTransport } from './mcp.js'

dotenv.config()

// Express setup
const app = express()
app.use(cors())
app.use(express.json())

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Initialize Server
const server = new Server(
  {
    name: "MegatTask",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

// Define tool schemas
const WEB_SEARCH_TOOL = {
  name: "search",
  description: "Performs a web search using Brave Search API",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      }
    },
    required: ["query"]
  }
}

// Set up MCP request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [WEB_SEARCH_TOOL]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params

    if (name === "search" && args?.query) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search')
      url.searchParams.set('q', args.query)
      url.searchParams.set('count', '10')

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
      const results = (data.web?.results || []).map(result => ({
        title: result.title || '',
        description: result.description || '',
        url: result.url || ''
      }))

      const formattedResults = results.map(r =>
        `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`
      ).join('\n\n')

      return {
        content: [{ type: "text", text: formattedResults }],
        isError: false
      }
    }

    return {
      content: [{ type: "text", text: "Unknown tool or invalid arguments" }],
      isError: true
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    }
  }
})

// Server initialization
const expressTransport = new ExpressServerTransport()
let mcpConnection

async function initializeMcpServer() {
  try {
    expressTransport.setRequestHandler((reqPayload) => 
      server.handleRequest(reqPayload)
    )
    mcpConnection = await server.connect(expressTransport)
    console.log('MCP Server connected successfully')
  } catch (error) {
    console.error('Failed to initialize MCP server:', error)
    process.exit(1)
  }
}

// Add MCP endpoint
app.post('/mcp', (req, res) => expressTransport.handleRequest(req, res))

// Update the execute-task endpoint to use the MCP endpoint
app.post('/api/execute-task', async (req, res) => {
  try {
    const { text } = req.body
    
    // ...existing analysis code...

    if (needsSearch) {
      console.log('Performing search for:', text)
      
      const response = await fetch('http://localhost:3000/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "call_tool",
          params: {
            name: "search",
            arguments: { query: text }
          }
        })
      })

      if (!response.ok) {
        throw new Error('Search request failed')
      }

      const searchData = await response.json()
      if (!searchData.isError && searchData.content?.[0]) {
        searchResults = searchData.content[0].text.split('\n\n')
          .map(result => {
            const lines = result.split('\n')
            return {
              title: lines[0].replace('Title: ', ''),
              description: lines[1].replace('Description: ', ''),
              url: lines[2].replace('URL: ', '')
            }
          })
      }
    }

    // ...rest of your execute-task endpoint code...
  } catch (error) {
    console.error('Detailed Error:', error)
    res.status(500).json({ 
      error: 'Failed to execute task with AI',
      details: error.message 
    })
  }
})

// Start server
async function startServer() {
  await initializeMcpServer()
  
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`)
    console.log('MCP Server ready for tool requests')
  })
}

startServer().catch(error => {
  console.error('Server startup failed:', error)
  process.exit(1)
})

export default app