import { Transport } from "@modelcontextprotocol/sdk/dist/esm/server/transport.js";

export class ExpressServerTransport extends Transport {
  constructor() {
    super();
  }

  async send(request) {
    return null;
  }

  async handleRequest(req, res) {
    try {
      const requestBody = req.body;
      const response = await this.requestHandler(requestBody);
      res.json(response);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      res.status(500).json({ error: error.message });
    }
  }

  setRequestHandler(handler) {
    this.requestHandler = handler;
  }
}