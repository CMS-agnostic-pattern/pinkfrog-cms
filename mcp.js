#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const CMS_DIR = process.env.CMS_DIR || process.cwd();
const PAGES_DIR = path.join(CMS_DIR, 'src');
const SERVER_NAME = 'pinkfrog-cms';
const SERVER_VERSION = '1.0.0';

// Helper function to log to stderr (won't interfere with stdio protocol)
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.error(`[${timestamp}] MCP: ${message}`, data);
    } else {
        console.error(`[${timestamp}] MCP: ${message}`);
    }
}

async function main() {
    try {
        debugLog('Starting MCP server...');
        debugLog('CMS_DIR:', CMS_DIR);
        debugLog('PAGES_DIR:', PAGES_DIR);

        const server = new Server(
            {
                name: SERVER_NAME,
                version: SERVER_VERSION,
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // List tools handler
        server.setRequestHandler(ListToolsRequestSchema, async (request) => {
            debugLog('Received ListTools request');
            const response = {
                tools: [
                    {
                        name: 'list_pages',
                        description: 'List all available pages',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                    {
                        name: 'create_page',
                        description: 'Create a new page',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                fileName: {
                                    type: 'string',
                                    description: 'The name of the file to create (e.g., "my-new-page.md")',
                                },
                                title: {
                                    type: 'string',
                                    description: 'The title of the page',
                                },
                                copy: {
                                    type: 'string',
                                    description: 'The content of the page in Markdown format',
                                },
                            },
                            required: ['fileName', 'title', 'copy'],
                        },
                    },
                ],
            };
            debugLog('Sending ListTools response:', response);
            return response;
        });

        // Call tool handler
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                debugLog('Received CallTool request:', request.params);
                const { name, arguments: args } = request.params;

                switch (name) {
                    case 'list_pages':
                        debugLog('Processing list_pages request');
                        
                        let mdFiles = [];
                        let directoryExists = false;
                        
                        try {
                            await fs.access(PAGES_DIR);
                            directoryExists = true;
                            debugLog('Pages directory exists');
                            
                            const files = await fs.readdir(PAGES_DIR);
                            debugLog('Found files:', files);
                            
                            mdFiles = files.filter(file => file.endsWith('.md'));
                            debugLog('Markdown files:', mdFiles);
                        } catch (dirError) {
                            debugLog('Pages directory error:', dirError.message);
                        }

                        const response = {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        pages: mdFiles,
                                        directory: PAGES_DIR,
                                        directoryExists,
                                    })
                                },
                            ],
                        };
                        
                        debugLog('Sending list_pages response:', response);
                        return response;

                    case 'create_page':
                        debugLog('Processing create_page request', args);
                        const { fileName, title, copy } = args;

                        if (!fileName || !title || !copy) {
                            throw new Error('Missing required arguments: fileName, title, and copy are required.');
                        }

                        const filePath = path.join(PAGES_DIR, fileName);
                        const content = `---\ntitle: ${title}\n---\n\n${copy}`;

                        await fs.writeFile(filePath, content);
                        debugLog(`Created new page at ${filePath}`);

                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        message: `Page "${fileName}" created successfully.`,
                                        filePath,
                                    }),
                                },
                            ],
                        };

                    default:
                        debugLog('Unknown tool requested:', name);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Unknown tool: ${name}`,
                                },
                            ],
                        };
                }
            } catch (error) {
                debugLog('Error in CallTool handler:', error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error processing request: ${error.message}`,
                        },
                    ],
                };
            }
        });

        // Start the server
        debugLog('Creating StdioServerTransport...');
        const transport = new StdioServerTransport();
        
        debugLog('Connecting server to transport...');
        await server.connect(transport);
        
        debugLog('MCP server connected and ready');

        // Handle process termination
        process.on('SIGTERM', () => {
            debugLog('Received SIGTERM, shutting down...');
            process.exit(0);
        });

        process.on('SIGINT', () => {
            debugLog('Received SIGINT, shutting down...');
            process.exit(0);
        });

    } catch (error) {
        debugLog('Fatal error starting MCP server:', error);
        process.exit(1);
    }
}

main().catch(error => {
    debugLog('Unhandled error in main:', error);
    process.exit(1);
});
