#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

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
                        name: 'xml_sitemap',
                        description: 'Generate sitemap.xml file in dist folder based on existing pages',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                baseUrl: {
                                    type: 'string',
                                    description: 'Base URL for the website (e.g., https://example.com)',
                                },
                                dataSet: {
                                    type: 'string',
                                    description: 'The subfolder where there are files with the content. It equals "default" if it\'s not set.',
                                },
                            },
                            required: ['baseUrl'],
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
                    {
                        name: 'get_component',
                        description: 'Get a component from the decoration components folder',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                component: {
                                    type: 'string',
                                    description: 'The name of the component to retrieve',
                                },
                            },
                            required: ['component'],
                        },
                    },
                    {
                        name: 'save_html',
                        description: 'Save an HTML file in the dist folder',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                fileName: {
                                    type: 'string',
                                    description: 'The name of the HTML file to create',
                                },
                                content: {
                                    type: 'string',
                                    description: 'The content of the HTML file',
                                },
                            },
                            required: ['fileName', 'content'],
                        },
                    },
                    {
                        name: 'get_page',
                        description: 'Get the content of a specific page',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                pageName: {
                                    type: 'string',
                                    description: 'The name of the page file with .md extension',
                                },
                                dataSet: {
                                    type: 'string',
                                    description: 'The subfolder where there are files with the content. It equals "default" if it\'s not set.',
                                },
                            },
                            required: ['pageName'],
                        },
                    },
                    {
                        name: 'copy_media',
                        description: 'Copy all files from src/media to dist/media',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: 'empty_dist',
                        description: 'Empty the dist folder',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: 'run_server',
                        description: 'Run a local web server with root in dist folder',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                port: {
                                    type: 'number',
                                    description: 'Port to run the server on (default: 8080)',
                                },
                            },
                            required: [],
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

                    case 'get_component':
                        debugLog('Processing get_component request', args);
                        
                        // Get component name from args
                        const { component } = args;
                        
                        if (!component) {
                            throw new Error('Missing required argument: component');
                        }
                        
                        debugLog(`Component requested: ${component}`);
                        
                        // Read settings.yml to get decoration value
                        const componentSettingsPath = path.join(PAGES_DIR, 'settings.yml');
                        let componentDecoration = 'light'; // Default value
                        
                        try {
                            const componentSettingsContent = await fs.readFile(componentSettingsPath, 'utf8');
                            const componentSettingsLines = componentSettingsContent.split('\n');
                            
                            for (const line of componentSettingsLines) {
                                if (line.startsWith('decoration:')) {
                                    componentDecoration = line.split(':')[1].trim();
                                    break;
                                }
                            }
                            debugLog(`Found decoration setting for component: ${componentDecoration}`);
                        } catch (error) {
                            debugLog('Error reading settings.yml for component:', error.message);
                        }
                        
                        // Get component files from the decoration folder
                        const componentsDir = path.join(PAGES_DIR, 'decoration', componentDecoration, 'components');
                        const componentDir = path.join(componentsDir, component);
                        
                        // Files to retrieve
                        const componentTemplatePath = path.join(componentDir, 'template.html');
                        const exampleMdPath = path.join(componentDir, 'example.md');
                        const exampleHtmlPath = path.join(componentDir, 'example.html');
                        
                        let componentTemplateContent = null;
                        let exampleMdContent = null;
                        let exampleHtmlContent = null;
                        let componentExists = false;
                        
                        try {
                            // Check if component directory exists
                            await fs.access(componentDir);
                            componentExists = true;
                            
                            // Read template.html
                            try {
                                componentTemplateContent = await fs.readFile(componentTemplatePath, 'utf8');
                                debugLog(`Component ${component} template.html read successfully`);
                            } catch (error) {
                                debugLog(`Error reading ${component} template.html:`, error.message);
                            }
                            
                            // Read example.md
                            try {
                                exampleMdContent = await fs.readFile(exampleMdPath, 'utf8');
                                debugLog(`Component ${component} example.md read successfully`);
                            } catch (error) {
                                debugLog(`Error reading ${component} example.md:`, error.message);
                            }
                            
                            // Read example.html
                            try {
                                exampleHtmlContent = await fs.readFile(exampleHtmlPath, 'utf8');
                                debugLog(`Component ${component} example.html read successfully`);
                            } catch (error) {
                                debugLog(`Error reading ${component} example.html:`, error.message);
                            }
                            
                        } catch (error) {
                            debugLog(`Component ${component} directory not found:`, error.message);
                        }
                        
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        decoration: componentDecoration,
                                        componentsDir,
                                        componentDir,
                                        component,
                                        componentExists,
                                        template: componentTemplateContent,
                                        exampleMd: exampleMdContent,
                                        exampleHtml: exampleHtmlContent
                                    })
                                },
                            ],
                        };

                    case 'save_html':
                        debugLog('Processing save_html request', args);
                        
                        // Get parameters from args
                        const { fileName: staticFileName, content: staticContent } = args;
                        
                        // Validate required parameters
                        if (!staticFileName) {
                            throw new Error('Missing required argument: fileName');
                        }
                        if (!staticContent) {
                            throw new Error('Missing required argument: content');
                        }
                        
                        debugLog(`Generating static file: ${staticFileName}`);
                        
                        // Ensure the dist directory exists
                        const distDir = path.join(CMS_DIR, 'dist');
                        let staticFilePath = '';
                        
                        try {
                            // Check if dist directory exists
                            try {
                                await fs.access(distDir);
                                debugLog('dist directory exists');
                            } catch (error) {
                                // Create dist directory if it doesn't exist
                                await fs.mkdir(distDir, { recursive: true });
                                debugLog(`Created dist directory: ${distDir}`);
                            }
                            
                            // Determine the file path
                            staticFilePath = path.join(distDir, staticFileName);
                            
                            // Create any necessary subdirectories
                            const fileDir = path.dirname(staticFilePath);
                            if (fileDir !== distDir) {
                                try {
                                    await fs.access(fileDir);
                                    debugLog(`Subdirectory ${fileDir} exists`);
                                } catch (error) {
                                    await fs.mkdir(fileDir, { recursive: true });
                                    debugLog(`Created subdirectory: ${fileDir}`);
                                }
                            }
                            
                            // Write the file
                            await fs.writeFile(staticFilePath, staticContent);
                            debugLog(`Static file ${staticFileName} generated successfully at ${staticFilePath}`);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            message: `Static file ${staticFileName} generated successfully.`,
                                            filePath: staticFilePath,
                                            distDir
                                        })
                                    },
                                ],
                            };
                            
                        } catch (error) {
                            debugLog(`Error generating static file ${staticFileName}:`, error.message);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: `Error generating static file ${staticFileName}: ${error.message}`,
                                            filePath: staticFilePath,
                                            distDir
                                        })
                                    },
                                ],
                            };
                        }
                        
                    case 'get_page':
                        debugLog('Processing get_page request', args);
                        
                        // Get parameters from args
                        const { pageName, dataSet: getPageDataSet = 'default' } = args;
                        
                        // Validate required parameters
                        if (!pageName) {
                            throw new Error('Missing required argument: pageName');
                        }
                        
                        debugLog(`Getting page: ${pageName} from dataset: ${getPageDataSet}`);
                        
                        // Determine the file path
                        const getPageContentDir = path.join(PAGES_DIR, 'content', getPageDataSet);
                        const pageFilePath = path.join(getPageContentDir, pageName);
                        
                        try {
                            // Check if file exists
                            await fs.access(pageFilePath);
                            
                            // Read the file content
                            const pageContent = await fs.readFile(pageFilePath, 'utf8');
                            debugLog(`Page ${pageName} read successfully`);
                            
                            // Parse frontmatter and content
                            let attributes = {};
                            let content = pageContent;
                            
                            // Simple frontmatter parsing
                            const frontmatterMatch = pageContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                            if (frontmatterMatch) {
                                const frontmatterStr = frontmatterMatch[1];
                                content = frontmatterMatch[2].trim();
                                
                                // Parse frontmatter key-value pairs
                                const frontmatterLines = frontmatterStr.split('\n');
                                for (const line of frontmatterLines) {
                                    if (line.includes(':')) {
                                        const [key, ...valueParts] = line.split(':');
                                        const value = valueParts.join(':').trim();
                                        attributes[key.trim()] = value.replace(/^"(.*)"$/, '$1'); // Remove quotes if present
                                    }
                                }
                            }
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            pageName,
                                            dataSet: getPageDataSet,
                                            filePath: pageFilePath,
                                            attributes,
                                            content,
                                            rawContent: pageContent
                                        })
                                    },
                                ],
                            };
                            
                        } catch (error) {
                            debugLog(`Error reading page ${pageName}:`, error.message);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: `Error reading page ${pageName}: ${error.message}`,
                                            pageName,
                                            dataSet: getPageDataSet,
                                            filePath: pageFilePath
                                        })
                                    },
                                ],
                            };
                        }

                    case 'copy_media':
                        debugLog('Processing copy_media request');
                        
                        // Define source and destination directories
                        const mediaSourceDir = path.join(PAGES_DIR, 'media');
                        const mediaDestDir = path.join(CMS_DIR, 'dist', 'media');
                        
                        try {
                            // Check if source directory exists
                            await fs.access(mediaSourceDir).catch(() => {
                                throw new Error(`Source directory ${mediaSourceDir} does not exist`);
                            });
                            
                            // Create destination directory if it doesn't exist
                            await fs.mkdir(mediaDestDir, { recursive: true }).catch(err => {
                                if (err.code !== 'EEXIST') {
                                    throw err;
                                }
                            });
                            
                            // Function to recursively copy files and directories
                            async function copyRecursive(src, dest) {
                                const stats = await fs.stat(src);
                                
                                if (stats.isDirectory()) {
                                    // Create destination directory
                                    await fs.mkdir(dest, { recursive: true }).catch(err => {
                                        if (err.code !== 'EEXIST') {
                                            throw err;
                                        }
                                    });
                                    
                                    // Read source directory
                                    const entries = await fs.readdir(src);
                                    
                                    // Copy each entry recursively
                                    for (const entry of entries) {
                                        await copyRecursive(
                                            path.join(src, entry),
                                            path.join(dest, entry)
                                        );
                                    }
                                } else if (stats.isFile()) {
                                    // Copy file
                                    await fs.copyFile(src, dest);
                                    debugLog(`Copied file: ${src} -> ${dest}`);
                                }
                            }
                            
                            // Start recursive copy
                            await copyRecursive(mediaSourceDir, mediaDestDir);
                            
                            debugLog('Media files copied successfully');
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            message: 'Media files copied successfully',
                                            sourceDir: mediaSourceDir,
                                            destinationDir: mediaDestDir
                                        })
                                    },
                                ],
                            };
                            
                        } catch (error) {
                            debugLog(`Error copying media files: ${error.message}`);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: `Error copying media files: ${error.message}`,
                                            sourceDir: mediaSourceDir,
                                            destinationDir: mediaDestDir
                                        })
                                    },
                                ],
                            };
                        }

                    case 'empty_dist':
                        debugLog('Processing empty_dist request');
                        
                        // Define the dist directory
                        const emptyDistDir = path.join(CMS_DIR, 'dist');
                        
                        try {
                            // Check if dist directory exists
                            await fs.access(emptyDistDir).catch(() => {
                                // If it doesn't exist, create it and return success
                                return fs.mkdir(emptyDistDir, { recursive: true });
                            });
                            
                            // Function to recursively remove files and directories
                            async function removeRecursive(dirPath) {
                                try {
                                    // Read directory contents
                                    const entries = await fs.readdir(dirPath);
                                    
                                    // Process each entry
                                    for (const entry of entries) {
                                        const entryPath = path.join(dirPath, entry);
                                        const stats = await fs.stat(entryPath);
                                        
                                        if (stats.isDirectory()) {
                                            // Recursively remove directory contents
                                            await removeRecursive(entryPath);
                                            // Then remove the directory itself
                                            await fs.rmdir(entryPath);
                                            debugLog(`Removed directory: ${entryPath}`);
                                        } else {
                                            // Remove file
                                            await fs.unlink(entryPath);
                                            debugLog(`Removed file: ${entryPath}`);
                                        }
                                    }
                                } catch (err) {
                                    // If directory doesn't exist or can't be read, just log and continue
                                    debugLog(`Error processing directory ${dirPath}: ${err.message}`);
                                }
                            }
                            
                            // Start recursive removal
                            await removeRecursive(emptyDistDir);
                            
                            // Recreate the dist directory
                            await fs.mkdir(emptyDistDir, { recursive: true });
                            
                            debugLog('Dist folder emptied successfully');
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            message: 'Dist folder emptied successfully',
                                            distDir: emptyDistDir
                                        })
                                    },
                                ],
                            };
                            
                        } catch (error) {
                            debugLog(`Error emptying dist folder: ${error.message}`);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: `Error emptying dist folder: ${error.message}`,
                                            distDir: emptyDistDir
                                        })
                                    },
                                ],
                            };
                        }
                        
                    case 'xml_sitemap':
                        debugLog('Processing xml_sitemap request', args);
                        
                        // Get parameters from args
                        const { baseUrl, dataSet: sitemapDataSet = 'default' } = args;
                        
                        // Validate required parameters
                        if (!baseUrl) {
                            throw new Error('Missing required argument: baseUrl');
                        }
                        
                        debugLog(`Generating sitemap.xml with baseUrl: ${baseUrl} for dataset: ${sitemapDataSet}`);
                        
                        try {
                            // Get the list of pages
                            const contentDir = path.join(PAGES_DIR, 'content', sitemapDataSet);
                            let mdFiles = [];
                            
                            try {
                                // Check if directory exists
                                await fs.access(contentDir);
                                
                                // Read directory contents
                                const files = await fs.readdir(contentDir);
                                
                                // Filter for markdown files
                                mdFiles = files.filter(file => file.endsWith('.md'));
                                debugLog('Found markdown files for sitemap:', mdFiles);
                            } catch (error) {
                                debugLog(`Error reading pages directory for sitemap: ${error.message}`);
                                throw new Error(`Error reading pages directory: ${error.message}`);
                            }
                            
                            // Process each page to get its URL
                            const urls = [];
                            const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                            
                            for (const mdFile of mdFiles) {
                                try {
                                    // Read the file to get its metadata
                                    const filePath = path.join(contentDir, mdFile);
                                    const content = await fs.readFile(filePath, 'utf8');
                                    
                                    // Parse frontmatter
                                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                                    let url = '';
                                    
                                    if (frontmatterMatch) {
                                        const frontmatterStr = frontmatterMatch[1];
                                        const frontmatterLines = frontmatterStr.split('\n');
                                        
                                        // Check for alias in frontmatter
                                        let alias = null;
                                        for (const line of frontmatterLines) {
                                            if (line.startsWith('alias:')) {
                                                alias = line.split(':')[1].trim().replace(/^"(.*)"$/, '$1');
                                                break;
                                            }
                                        }
                                        
                                        // Use alias if available, otherwise use the filename without extension
                                        if (alias) {
                                            url = alias;
                                        } else {
                                            url = mdFile.replace(/\.md$/, '.html');
                                        }
                                    } else {
                                        // No frontmatter, use the filename without extension
                                        url = mdFile.replace(/\.md$/, '.html');
                                    }
                                    
                                    // Add the URL to the list
                                    urls.push({
                                        loc: new URL(url, baseUrl).href,
                                        lastmod: currentDate,
                                        changefreq: 'weekly',
                                        priority: url === 'index.html' ? '1.0' : '0.8'
                                    });
                                    
                                } catch (error) {
                                    debugLog(`Error processing page ${mdFile} for sitemap: ${error.message}`);
                                    // Continue with other pages
                                }
                            }
                            
                            // Generate sitemap XML content
                            let sitemapContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
                            sitemapContent += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
                            
                            for (const url of urls) {
                                sitemapContent += '  <url>\n';
                                sitemapContent += `    <loc>${url.loc}</loc>\n`;
                                sitemapContent += `    <lastmod>${url.lastmod}</lastmod>\n`;
                                sitemapContent += `    <changefreq>${url.changefreq}</changefreq>\n`;
                                sitemapContent += `    <priority>${url.priority}</priority>\n`;
                                sitemapContent += '  </url>\n';
                            }
                            
                            sitemapContent += '</urlset>';
                            
                            // Ensure the dist directory exists
                            const distDir = path.join(CMS_DIR, 'dist');
                            try {
                                await fs.access(distDir);
                            } catch (error) {
                                // Create dist directory if it doesn't exist
                                await fs.mkdir(distDir, { recursive: true });
                                debugLog(`Created dist directory: ${distDir}`);
                            }
                            
                            // Write the sitemap.xml file
                            const sitemapPath = path.join(distDir, 'sitemap.xml');
                            await fs.writeFile(sitemapPath, sitemapContent);
                            
                            debugLog(`Sitemap.xml generated successfully at ${sitemapPath}`);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            message: 'Sitemap.xml generated successfully',
                                            sitemapPath,
                                            baseUrl,
                                            dataSet: sitemapDataSet,
                                            urlCount: urls.length,
                                            urls
                                        })
                                    },
                                ],
                            };
                            
                        } catch (error) {
                            debugLog(`Error generating sitemap.xml: ${error.message}`);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: `Error generating sitemap.xml: ${error.message}`,
                                            baseUrl,
                                            dataSet: sitemapDataSet
                                        })
                                    },
                                ],
                            };
                        }

                    case 'run_server':
                        debugLog('Processing run_server request', args);
                        
                        // Get port from args or use default
                        const port = args.port || 8080;
                        debugLog(`Starting server on port ${port}`);
                        
                        // Define the dist directory
                        const serverDistDir = path.join(CMS_DIR, 'dist');
                        
                        try {
                            // Check if dist directory exists
                            await fs.access(serverDistDir).catch(() => {
                                throw new Error(`Dist directory ${serverDistDir} does not exist`);
                            });
                            
                            // Create and start the server
                            const server = http.createServer(async (req, res) => {
                                try {
                                    // Get the requested file path
                                    let filePath = path.join(serverDistDir, req.url === '/' ? 'index.html' : req.url);
                                    
                                    // If the path doesn't have an extension, try adding .html
                                    if (!path.extname(filePath)) {
                                        filePath += '.html';
                                    }
                                    
                                    // Check if the file exists
                                    try {
                                        await fs.access(filePath);
                                    } catch (error) {
                                        // File not found
                                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                                        res.end('404 Not Found');
                                        return;
                                    }
                                    
                                    // Get the file's content type
                                    const extname = path.extname(filePath);
                                    let contentType = 'text/html';
                                    
                                    switch (extname) {
                                        case '.js':
                                            contentType = 'text/javascript';
                                            break;
                                        case '.css':
                                            contentType = 'text/css';
                                            break;
                                        case '.json':
                                            contentType = 'application/json';
                                            break;
                                        case '.png':
                                            contentType = 'image/png';
                                            break;
                                        case '.jpg':
                                        case '.jpeg':
                                            contentType = 'image/jpeg';
                                            break;
                                        case '.gif':
                                            contentType = 'image/gif';
                                            break;
                                        case '.svg':
                                            contentType = 'image/svg+xml';
                                            break;
                                        case '.xml':
                                            contentType = 'application/xml';
                                            break;
                                    }
                                    
                                    // Stream the file to the response
                                    res.writeHead(200, { 'Content-Type': contentType });
                                    const fileStream = createReadStream(filePath);
                                    fileStream.pipe(res);
                                    
                                } catch (error) {
                                    // Server error
                                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                                    res.end(`Server Error: ${error.message}`);
                                }
                            });
                            
                            // Start listening on the specified port
                            server.listen(port);
                            
                            debugLog(`Server running at http://localhost:${port}/`);
                            
                            // Keep the server running until the process is terminated
                            const serverInfo = {
                                server,
                                port,
                                url: `http://localhost:${port}/`,
                                distDir: serverDistDir
                            };
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            message: `Server running at http://localhost:${port}/`,
                                            ...serverInfo
                                        })
                                    },
                                ],
                            };
                            
                        } catch (error) {
                            debugLog(`Error starting server: ${error.message}`);
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            message: `Error starting server: ${error.message}`,
                                            port,
                                            distDir: serverDistDir
                                        })
                                    },
                                ],
                            };
                        }
                        
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
