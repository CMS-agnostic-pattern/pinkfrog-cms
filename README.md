# PinkFrog CMS

## MCP server settings

```json
{
  "mcpServers": {
    "pinkfrog-cms": {
      "command": "node",
      "args": ["path_to_your_cms_folder/mcp.js"],
      "env": {
        "CMS_DIR": "path_to_your_cms_folder"
      }
    }
  }
}
```



## SRC structure

- src
    - settings.yml
    - content
        - default
            - index.md
            - privacy-policy.md
    - decoration
        - light
            - components
                - home-hero
                    - example.html
                    - example.md
                    - template.html
            - markdown
                - h1.html
                - h2.html
                - p.html
            - templates
                - index.html
        - dark
    - media
        - images
        - videos
        - documents
    
## MCP tools

The PinkFrog CMS provides several MCP (Model Context Protocol) tools to help with content management and static site generation. Below is a detailed documentation of each tool, including parameters and return JSON structure.

### list_pages

**Description**: List all available pages in a specified dataset.

**Parameters**:
- `dataSet` (optional): The subfolder where content files are stored (defaults to "default").

**Returns**:
```json
{
  "pages": ["page1.md", "page2.md", ...],
  "directory": "/path/to/content/directory",
  "directoryExists": true,
  "dataSet": "default"
}
```

### create_page

**Description**: Create a new page with frontmatter and content.

**Parameters**:
- `fileName` (required): The name of the file to create (e.g., "my-new-page.md").
- `title` (required): The title of the page (added to frontmatter).
- `copy` (required): The content of the page in Markdown format.
- `dataSet` (optional): The subfolder where to create the page (defaults to "default").

**Returns**:
```json
{
  "success": true,
  "message": "Page 'my-new-page.md' created successfully.",
  "filePath": "/path/to/file",
  "dataSet": "default",
  "directory": "/path/to/content/directory"
}
```

### get_markdown

**Description**: Get HTML templates for markdown conversion based on the current decoration setting.

**Parameters**: None

**Returns**:
```json
{
  "decoration": "light",
  "markdownDir": "/path/to/markdown/templates",
  "templates": {
    "h1.html": "<h1 class='title'>{{content}}</h1>",
    "h2.html": "<h2>{{content}}</h2>",
    "p.html": "<p>{{content}}</p>"
  }
}
```

### get_template

**Description**: Get a template from the decoration templates folder.

**Parameters**:
- `template` (optional): The name of the template file to retrieve (defaults to "index.html").

**Returns**:
```json
{
  "decoration": "light",
  "templatesDir": "/path/to/templates",
  "templateName": "index.html",
  "templateExists": true,
  "template": "<html>...</html>"
}
```

### get_component

**Description**: Get a component from the decoration components folder.

**Parameters**:
- `component` (required): The name of the component to retrieve.

**Returns**:
```json
{
  "decoration": "light",
  "componentsDir": "/path/to/components",
  "componentDir": "/path/to/component",
  "component": "home-hero",
  "componentExists": true,
  "template": "<div>...</div>",
  "exampleMd": "# Example markdown",
  "exampleHtml": "<div>Example HTML</div>"
}
```

### save_html

**Description**: Save an HTML file in the dist folder.

**Parameters**:
- `fileName` (required): The name of the HTML file to create.
- `content` (required): The content of the HTML file.

**Returns**:
```json
{
  "success": true,
  "message": "Static file 'index.html' generated successfully.",
  "filePath": "/path/to/dist/index.html",
  "distDir": "/path/to/dist"
}
```

### get_page

**Description**: Get the content of a specific page.

**Parameters**:
- `pageName` (required): The name of the page file with .md extension.
- `dataSet` (optional): The subfolder where content files are stored (defaults to "default").

**Returns**:
```json
{
  "success": true,
  "pageName": "index.md",
  "dataSet": "default",
  "filePath": "/path/to/file",
  "attributes": {
    "title": "Home Page"
  },
  "content": "# Welcome\n\nThis is the home page.",
  "rawContent": "---\ntitle: Home Page\n---\n\n# Welcome\n\nThis is the home page."
}
```

### copy_media

**Description**: Copy all files from src/media to dist/media.

**Parameters**: None

**Returns**:
```json
{
  "success": true,
  "message": "Media files copied successfully",
  "sourceDir": "/path/to/src/media",
  "destinationDir": "/path/to/dist/media"
}
```

### empty_dist

**Description**: Empty the dist folder.

**Parameters**: None

**Returns**:
```json
{
  "success": true,
  "message": "Dist folder emptied successfully",
  "distDir": "/path/to/dist"
}
```

### run_server

**Description**: Run a local web server with root in dist folder.

**Parameters**:
- `port` (optional): Port to run the server on (defaults to 8080).

**Returns**:
```json
{
  "success": true,
  "message": "Server running at http://localhost:8080/",
  "port": 8080,
  "rootDir": "/path/to/dist",
  "url": "http://localhost:8080/"
}
```
