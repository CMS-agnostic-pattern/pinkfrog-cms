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

## Eleventy start

```bash
npx eleventy --config=.eleventy.cjs --serve
```
