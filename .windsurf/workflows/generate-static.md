---
description: Generate static site
---

# Steps to generate static from markdown content


Use pinkfrog-cms MCP for the manipulations.

1. Get list of pages with 'list_pages'

2. For each page you can use 'get_page' tool to get contnet and attributes.

3. You can use alias as the name of the destination static page and template as the template with that you should render the file in HTML.

4. For each page use 'get_template' (attribute template) and compile it to static HTML with 'get_markdown' and 'get_component'. Save file to take into account alias parameter if it's not set use sourse pageName with .html extension instead .md one.

3. Save the result with save_html tool. 