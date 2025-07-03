import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

class MCPClient {
    constructor(cmsDir) {
        this.client = new Client({
            name: 'pinkfrog-cms-client',
            version: '1.0.0',
        });
        this.cmsDir = cmsDir;
        this.transport = null;
    }

    async connect() {
        try {
            console.log('Connecting to MCP server...');
            console.log('MCP script path:', path.resolve(this.cmsDir, 'mcp.js'));
            console.log('CMS_DIR:', this.cmsDir);
            
            this.transport = new StdioClientTransport({
                command: 'node',
                args: [path.resolve(this.cmsDir, 'mcp.js')],
                options: {
                    env: { ...process.env, CMS_DIR: this.cmsDir },
                    stdio: ['pipe', 'pipe', 'inherit'] // Explicitly set stdio
                }
            });
            
            await this.client.connect(this.transport);
            console.log('MCP client connected successfully');
        } catch (error) {
            console.error('Failed to connect MCP client:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.transport) {
            await this.transport.close();
        }
    }

    async listTools() {
        try {
            const result = await this.client.listTools();
            return result;
        } catch (error) {
            console.error('Error listing tools:', error);
            throw error;
        }
    }

    async callTool(name, args) {
        try {
            console.log(`Calling tool: ${name} with args:`, JSON.stringify(args));
            console.log('MCP client status:', this.client ? 'connected' : 'not connected');
            
            // Ensure args is a proper object
            const toolArgs = args || {};
            
            console.log('About to call client.callTool...');
            const result = await this.client.callTool({ name, arguments: toolArgs });
            console.log('Tool call completed successfully');
            console.log('Tool call result:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error(`Error calling tool ${name}:`, error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    async listPages() {
        const result = await this.callTool('list_pages', {});
        if (result.content && result.content[0].type === 'text') {
            const data = JSON.parse(result.content[0].text);
            return data.pages;
        }
        return [];
    }
}

class CMSServer {
    constructor(mcpClient) {
        this.app = express();
        this.port = 3001;
        this.genAI = this.initializeGoogleGenerativeAI();
        this.mcpClient = mcpClient;
        this.setupMiddleware();
        this.setupRoutes();
    }

    initializeGoogleGenerativeAI() {
        if (!process.env.GEMINI_KEY) {
            console.error("GEMINI_KEY is not set in the .env file.");
            process.exit(1);
        }
        return new GoogleGenerativeAI(process.env.GEMINI_KEY);
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        this.app.post('/gemini', async (req, res) => {
            try {
                const { prompt } = req.body;
                console.log(`Received prompt: "${prompt}"`);

                console.log('Listing tools from MCP server...');
                const tools = await this.mcpClient.listTools();
                console.log('Received tools:', JSON.stringify(tools, null, 2));

                const functionDeclarations = tools.tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                }));

                console.log('Initializing Gemini model with tools...');
                const model = this.genAI.getGenerativeModel({
                    model: 'gemini-1.5-flash',
                    tools: {
                        functionDeclarations,
                    },
                });

                const chat = model.startChat();
                console.log('Sending prompt to Gemini...');
                const result = await chat.sendMessage(prompt);
                console.log('Received response from Gemini.');

                const call = result.response.functionCalls()?.[0];

                if (call) {
                    console.log(`Gemini requested to call tool: "${call.name}" with args:`, call.args);
                    
                    // Use the mcpClient's callTool method instead of direct client access
                    const apiResult = await this.mcpClient.callTool(call.name, call.args);
                    console.log('Received tool result from MCP server:', JSON.stringify(apiResult, null, 2));

                    console.log('Sending tool result back to Gemini...');
                    const result2 = await chat.sendMessage([{ 
                        functionResponse: { 
                            name: call.name, 
                            response: apiResult 
                        } 
                    }]);
                    console.log('Received final response from Gemini.');
                    const text = result2.response.text();
                    res.json({ text });
                } else {
                    console.log('No tool call requested by Gemini.');
                    const text = result.response.text();
                    res.json({ text });
                }
            } catch (error) {
                console.error('Detailed error from Gemini API:', error);
                res.status(500).json({ error: 'Failed to get response from Gemini. Check server logs for details.' });
            }
        });

        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        this.app.get('/pages', async (req, res) => {
            try {
                const pages = await this.mcpClient.listPages();
                res.json({ pages });
            } catch (error) {
                console.error('Error listing pages:', error);
                res.status(500).json({ error: 'Failed to list pages.' });
            }
        });
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log(`CMS server listening at http://localhost:${this.port}`);
        });
    }

    async shutdown() {
        await this.mcpClient.disconnect();
    }
}

async function main() {
    const cmsDir = process.env.CMS_DIR || path.dirname(fileURLToPath(import.meta.url));
    const mcpClient = new MCPClient(cmsDir);
    
    try {
        await mcpClient.connect();
        const cmsServer = new CMSServer(mcpClient);
        cmsServer.listen();

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            await cmsServer.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('Shutting down...');
            await cmsServer.shutdown();
            process.exit(0);
        });
    } catch (error) {
        console.error('Failed to start CMS server:', error);
        process.exit(1);
    }
}

main().catch(console.error);
