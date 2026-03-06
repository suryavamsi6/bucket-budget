## 2025-03-03 - SSRF in AI Routes `base_url` parameter
**Vulnerability:** A Server-Side Request Forgery (SSRF) vulnerability existed in `api/src/routes/ai.js`. The `base_url` parameter was provided by the user and directly concatenated into `fetch()` calls without any URL validation.
**Learning:** By allowing user-provided base URLs to be passed directly to fetch requests originating from the backend server, attackers could query internal systems, databases, or cloud metadata endpoints.
**Prevention:**
1. Always parse user-supplied URLs using the built-in `URL` class and enforce allowed schemes (`http:`, `https:`).
2. Implement a blocklist against known dangerous addresses like cloud metadata (`169.254.169.254`, `metadata.google.internal`) and local escape endpoints (`0.0.0.0`).
3. Block common internal service ports (e.g. `6379`, `3306`) to prevent internal port scanning.
4. **Crucially**, disable redirects in `fetch` (`{ redirect: 'error' }`) to prevent attackers from bypassing hostname blocklists via an external HTTP 302 redirect back into the internal network.
## 2026-03-04 - Fix Server-Side Request Forgery (SSRF) in AI routes
**Vulnerability:** The `/api/ai/models` and `/api/ai/chat` routes allowed users to specify an arbitrary `base_url` which was then passed directly to a backend `fetch` call without validation. This allowed an authenticated user to perform Server-Side Request Forgery (SSRF) and probe internal networks or cloud metadata APIs.
**Learning:** The application proxies requests to locally or remotely hosted LLM models, making it necessary to expose a configurable base URL. Because the backend trusted user input directly in its `fetch()` calls, it became an open proxy.
**Prevention:** Implemented a lightweight validation function (`isValidBaseUrl`) that restricts URL protocols to `http:` and `https:` and statically checks the hostname against known cloud metadata IPs (e.g. `169.254.169.254`). While this exact string match is a good first-layer defense, it can be circumvented via IP encoding or DNS spoofing. Future iterations should add DNS resolution validation against private IP ranges.
## 2025-02-19 - Path Traversal in File Uploads
**Vulnerability:** Found a Path Traversal vulnerability in the `api/src/routes/transactions.js` file upload endpoint for attachments. An attacker could potentially supply a filename with directory traversal characters (e.g., `../../../etc/passwd`) to escape the upload directory and write/read arbitrary files on the server.
**Learning:** `path.join` combined with `part.filename` directly from the user can result in path traversal, even if the filename is prepended with a random UUID (e.g., `1234-../../../etc/passwd` resolves to `/etc/passwd`).
**Prevention:** Always sanitize user-supplied filenames before using them in file system operations. `path.basename(filename)` is a simple way to extract just the file name and discard any directory components.
