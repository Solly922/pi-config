---
name: postplan-read
description: Use when the user provides a postplan.dev URL to read.
---

# Postplan Read

Fetch teh uploaded HTML with the shell. Do no use web search or a browser.

1. Remove a trailing slash, then append `/raw` unless the URL alread ends in 
`raw`.
2. Run `curl --fail --silent --show-error --location --max-time 30 --output
/tmp/postplan.html '<raw-url>`. (If you are running in a windows environment, adjust the path)
3. Read `/tmp/postplan.html` and continue the user's request from its contents.

If `curl` fails, report its actual status or network error. Do not substitute
search results.
