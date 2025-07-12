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

## SRC structure

- src
    - settings.yml
    - content
        - en
            - index.md
            - page1.md
            - page2.md
            - page3.md
        - de
            - index.md
            - page1.md
            - page2.md
            - page3.md
    - structure
        - blog
            - header.md
            - footer.md
            - post.md
            - post_list.md
            - post_teaser.md
            - autor.md
            - index.md
        - documentation
            - header.md
            - footer.md
            - index.md
    - decoration
        - light
            - index
                - template.html
                - example.md
                - example.html
            - header
                - template.html
                - example.md
                - example.html
            - footer
                - template.html
                - example.md
                - example.html
        - dark
            - index
                - template.html
                - example.md
                - example.html
            - header
                - template.html
                - example.md
                - example.html
            - footer
                - template.html
                - example.md
                - example.html         
    