/**
 * cURL -> Postman collection converter.
 *
 * Works in two environments:
 *   - Node CLI:   node exportAsCollection.js <input.txt> <output.json>
 *   - Browser:    window.CurlToPostman.buildPostmanCollection(rawCurlText, name)
 *
 * The core parsing/building logic has no Node dependencies so it can be reused
 * inside the extension popup to generate a collection and trigger a download.
 */
(function (global) {
    // Helper to extract header key-value pairs
    function parseHeaders(curlString) {
        const headers = [];
        const headerRegex = /-H\s+'([^:]+):\s*([^']+)'/g;
        let match;

        // Whitelist critical headers, skip dynamic tracking headers that expire
        const allowedHeaders = ['referer', 'accept', 'content-type', 'x-csrf-token', 'x-requested-with', 'authorization'];

        while ((match = headerRegex.exec(curlString)) !== null) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (allowedHeaders.includes(key.toLowerCase())) {
                headers.push({ key, value });
            }
        }
        return headers;
    }

    // Helper to extract the raw data payload
    function parseData(curlString) {
        const dataRegex = /--(?:data-raw|data|d)\s+'([\s\S]*?)'/;
        const match = curlString.match(dataRegex);
        if (!match) return null;

        try {
            // Clean up potential copy-paste artifacts like non-breaking spaces
            const cleanJson = match[1].replace(/\xA0/g, ' ');
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse JSON payload from curl command.");
            return null;
        }
    }

    // Helper to extract URL and split it for Postman's format
    function parseUrl(curlString) {
        const urlRegex = /curl\s+[-X\s\w]*'([^']+)'/;
        const match = curlString.match(urlRegex);
        if (!match) return { raw: "", protocol: "", host: [], path: [] };

        const rawUrl = match[1];
        const urlObj = new URL(rawUrl);

        return {
            raw: rawUrl,
            protocol: urlObj.protocol.replace(':', ''),
            host: urlObj.hostname.split('.'),
            path: urlObj.pathname.split('/').filter(p => p)
        };
    }

    // Build a Postman v2.1 collection object from raw cURL text (one or more commands)
    function buildPostmanCollection(rawInput, collectionName) {
        // Split by individual curl commands
        const curlCommands = rawInput.split(/curl\s+-X/).filter(c => c.trim()).map(c => 'curl -X' + c);

        const collection = {
            info: {
                _postman_id: `generated-collection-${Date.now()}`,
                name: collectionName || "Generated GraphQL Collection",
                schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item: []
        };

        // Builds a Postman request item that Postman detects as a GraphQL request
        function buildGraphqlItem(name, method, headers, urlInfo, gqlPayload) {
            return {
                name: name,
                request: {
                    method: method,
                    header: headers,
                    body: {
                        mode: "graphql",
                        graphql: {
                            query: gqlPayload.query || "",
                            variables: JSON.stringify(gqlPayload.variables || {}, null, 2)
                        }
                    },
                    url: urlInfo
                }
            };
        }

        curlCommands.forEach((curl, index) => {
            const urlInfo = parseUrl(curl);
            const headers = parseHeaders(curl);
            const payload = parseData(curl);

            // Method is captured from the "curl -X <METHOD>" prefix, default POST
            const methodMatch = curl.match(/curl\s+-X\s+(\w+)/);
            const method = methodMatch ? methodMatch[1].toUpperCase() : "POST";

            if (Array.isArray(payload)) {
                // Batched request: split each operation into its own GraphQL item
                // so Postman detects them as GraphQL rather than a raw JSON blob.
                payload.forEach((op, opIndex) => {
                    const opName = (op && op.operationName) || `Request ${index + 1}.${opIndex + 1}`;
                    collection.item.push(buildGraphqlItem(opName, method, headers, urlInfo, op || {}));
                });
                return;
            }

            if (payload && (payload.query || payload.operationName)) {
                // Single GraphQL request
                const name = payload.operationName || `Request ${index + 1}`;
                collection.item.push(buildGraphqlItem(name, method, headers, urlInfo, payload));
                return;
            }

            // Non-GraphQL / no parseable payload
            collection.item.push({
                name: `Request ${index + 1}`,
                request: {
                    method: method,
                    header: headers,
                    body: {},
                    url: urlInfo
                }
            });
        });

        return collection;
    }

    const api = { parseHeaders, parseData, parseUrl, buildPostmanCollection };

    // Browser export
    if (typeof window !== 'undefined') {
        window.CurlToPostman = api;
    }

    // Node export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    // Node CLI execution
    if (typeof module !== 'undefined' && require.main === module) {
        const fs = require('fs');

        function convertCurlsToPostman(inputFilePath, outputFilePath) {
            if (!fs.existsSync(inputFilePath)) {
                console.error(`Error: Input file ${inputFilePath} not found.`);
                return;
            }

            const rawInput = fs.readFileSync(inputFilePath, 'utf8');
            const collection = buildPostmanCollection(rawInput);

            fs.writeFileSync(outputFilePath, JSON.stringify(collection, null, 2), 'utf8');
            console.log(`Success! Postman collection generated at: ${outputFilePath}`);
        }

        const inputFile = process.argv[2] || 'curls.txt';
        const outputFile = process.argv[3] || 'postman_collection.json';
        convertCurlsToPostman(inputFile, outputFile);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
