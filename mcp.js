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
                            properties: {
                                dataSet: {
                                    type: 'string',
                                    description: 'The subfolder where there are files with the content. It equal "default" if it\'s not set.',
                                },
                            },
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
                    {
                        name: 'get_markdown',
                        description: 'Get HTML templates for markdown conversion based on decoration setting',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                    {
                        name: 'get_template',
                        description: 'Get a template from the decoration templates folder',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                template: {
                                    type: 'string',
                                    description: 'The name of the template file to retrieve (default: index.html)',
                                },
                            },
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
                        debugLog('Processing list_pages request', args);
                        
                        const dataSet = args.dataSet || 'default';
                        const contentDir = path.join(PAGES_DIR, 'content', dataSet);
                        debugLog('Content directory:', contentDir);
                        
                        let mdFiles = [];
                        let directoryExists = false;
                        
                        try {
                            // Check if directory exists
                            try {
                                await fs.access(contentDir);
                                directoryExists = true;
                                debugLog('Pages directory exists');
                            } catch (accessError) {
                                debugLog('Pages directory does not exist:', accessError.message);
                                // Create the directory if it doesn't exist
                                await fs.mkdir(contentDir, { recursive: true });
                                directoryExists = true;
                                debugLog(`Created directory: ${contentDir}`);
                                // No files yet in the newly created directory
                                mdFiles = [];
                                return {
                                    content: [
                                        {
                                            type: 'text',
                                            text: JSON.stringify({
                                                pages: mdFiles,
                                                directory: contentDir,
                                                directoryExists,
                                                dataSet,
                                                directoryCreated: true
                                            })
                                        },
                                    ],
                                };
                            }
                            
                            // Read directory contents
                            const files = await fs.readdir(contentDir);
                            debugLog('Found files:', files);
                            
                            // Filter for markdown files
                            mdFiles = files.filter(file => file.endsWith('.md'));
                            debugLog('Markdown files:', mdFiles);
                            
                            // If no markdown files found, log this information
                            if (mdFiles.length === 0) {
                                debugLog('No markdown files found in directory');
                            }
                        } catch (dirError) {
                            debugLog('Pages directory error:', dirError.message);
                        }

                        const response = {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        pages: mdFiles,
                                        directory: contentDir,
                                        directoryExists,
                                        dataSet,
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

                        const pageDataSet = args.dataSet || 'default';
                        const pageContentDir = path.join(PAGES_DIR, 'content', pageDataSet);
                        
                        // Ensure the directory exists
                        try {
                            await fs.access(pageContentDir);
                        } catch (error) {
                            // Directory doesn't exist, create it
                            await fs.mkdir(pageContentDir, { recursive: true });
                            debugLog(`Created directory: ${pageContentDir}`);
                        }
                        
                        const filePath = path.join(pageContentDir, fileName);
                        const content = `---
title: ${title}
---

${copy}`;

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
                                        dataSet: pageDataSet,
                                        directory: pageContentDir
                                    }),
                                },
                            ],
                        };

                    case 'get_markdown':
                        debugLog('Processing get_markdown request');
                        
                        // Read settings.yml to get decoration value
                        const settingsPath = path.join(PAGES_DIR, 'settings.yml');
                        let decoration = 'light'; // Default value
                        
                        try {
                            const settingsContent = await fs.readFile(settingsPath, 'utf8');
                            const settingsLines = settingsContent.split('\n');
                            
                            for (const line of settingsLines) {
                                if (line.startsWith('decoration:')) {
                                    decoration = line.split(':')[1].trim();
                                    break;
                                }
                            }
                            debugLog(`Found decoration setting: ${decoration}`);
                        } catch (error) {
                            debugLog('Error reading settings.yml:', error.message);
                        }
                        
                        // Get markdown HTML templates from the decoration folder
                        const markdownDir = path.join(PAGES_DIR, 'decoration', decoration, 'markdown');
                        let markdownFiles = {};
                        
                        try {
                            // Check if directory exists
                            await fs.access(markdownDir);
                            
                            // Read directory contents
                            const files = await fs.readdir(markdownDir);
                            debugLog('Found markdown template files:', files);
                            
                            // Read each file's content
                            for (const file of files) {
                                if (file.endsWith('.html')) {
                                    const filePath = path.join(markdownDir, file);
                                    const content = await fs.readFile(filePath, 'utf8');
                                    markdownFiles[file] = content;
                                }
                            }
                        } catch (error) {
                            debugLog('Error reading markdown templates:', error.message);
                        }
                        
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        decoration,
                                        markdownDir,
                                        templates: markdownFiles
                                    })
                                },
                            ],
                        };

                    case 'get_template':
                        debugLog('Processing get_template request', args);
                        
                        // Get template name from args or use default
                        const templateName = args.template || 'index.html';
                        debugLog(`Template requested: ${templateName}`);
                        
                        // Read settings.yml to get decoration value
                        const templateSettingsPath = path.join(PAGES_DIR, 'settings.yml');
                        let templateDecoration = 'light'; // Default value
                        
                        try {
                            const templateSettingsContent = await fs.readFile(templateSettingsPath, 'utf8');
                            const templateSettingsLines = templateSettingsContent.split('\n');
                            
                            for (const line of templateSettingsLines) {
                                if (line.startsWith('decoration:')) {
                                    templateDecoration = line.split(':')[1].trim();
                                    break;
                                }
                            }
                            debugLog(`Found decoration setting for template: ${templateDecoration}`);
                        } catch (error) {
                            debugLog('Error reading settings.yml for template:', error.message);
                        }
                        
                        // Get template from the decoration folder
                        const templatesDir = path.join(PAGES_DIR, 'decoration', templateDecoration, 'templates');
                        const templatePath = path.join(templatesDir, templateName);
                        let templateContent = null;
                        let templateExists = false;
                        
                        try {
                            // Check if file exists
                            await fs.access(templatePath);
                            templateExists = true;
                            
                            // Read template content
                            templateContent = await fs.readFile(templatePath, 'utf8');
                            debugLog(`Template ${templateName} found and read successfully`);
                        } catch (error) {
                            debugLog(`Error reading template ${templateName}:`, error.message);
                        }
                        
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        decoration: templateDecoration,
                                        templatesDir,
                                        templateName,
                                        templateExists,
                                        template: templateContent
                                    })
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
