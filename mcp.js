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
const PAGES_DIR = './src';
const SERVER_NAME = 'eleventy-mcp';
const SERVER_VERSION = '1.0.0';

class EleventyMCPServer {
  constructor() {
    this.server = new Server(
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

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_pages',
            description: 'List all available pages',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_pages':
            return await this.listPages();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async listPages() {
    try {
      const files = await fs.readdir(PAGES_DIR);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      return {
        content: [
          {
            type: 'text',
            text: `Available pages:\n\n${mdFiles.join('\n')}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Error listing pages: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Eleventy MCP server running on stdio');
  }
}

const server = new EleventyMCPServer();
server.run().catch(console.error);