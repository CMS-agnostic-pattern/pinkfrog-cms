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
    - content
        - en
            - page1.md
            - page2.md
            - page3.md
        - de
            - page1.md
            - page2.md
            - page3.md
    - sructure
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
            - header
                - template.html
                - example.md
                - example.html
            - footer
                - template.html
                - example.md
                - example.html
            - index
                - template.html
                - example.md
                - example.html
        - dark
            - header
                - template.html
                - example.md
                - example.html
            - footer
                - template.html
                - example.md
                - example.html
            - index
                - template.html
                - example.md
                - example.html            
    