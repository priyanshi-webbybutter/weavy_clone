# Hybrid MCP + SDK Approach

## Overview

This project uses a hybrid approach for Replicate API interactions:

- **SDK (Replicate npm package)**: Used for all user-facing operations
- **MCP (Model Context Protocol)**: Used for assistant operations, testing, and debugging

## Architecture

### SDK Usage (Backend Routes)

**Purpose**: User-facing operations that come from the frontend UI

**Routes:**
- `POST /api/generate-image` - Image generation from UI
- `POST /api/generate-video` - Video generation from UI
- `POST /api/describe-image` - Image description from UI

**Why SDK:**
- ✅ API key security (stored in backend `.env`)
- ✅ CORS handling
- ✅ Error handling and validation
- ✅ Consistent response format
- ✅ Works with frontend fetch calls

**Location**: `backend/routes/*.js`

### MCP Usage (Assistant Operations)

**Purpose**: When the AI assistant needs to interact with Replicate directly

**Use Cases:**
- Testing model parameters
- Validating model configurations
- Getting model information
- Debugging API issues
- Quick validation of prompts/parameters

**Available MCP Tools:**
- `mcp_replicate_create_predictions` - Create predictions
- `mcp_replicate_get_predictions` - Get prediction status
- `mcp_replicate_list_predictions` - List all predictions
- `mcp_replicate_get_models` - Get model information
- `mcp_replicate_list_models` - List available models
- `mcp_replicate_get_account` - Get account information
- And 29 more tools...

**Why MCP:**
- ✅ Direct access for assistant
- ✅ No need to go through backend
- ✅ Faster for testing/debugging
- ✅ Can validate parameters before updating code

## Decision Matrix

| Operation | Use SDK | Use MCP |
|-----------|---------|---------|
| User clicks "Run Model" in UI | ✅ | ❌ |
| Assistant testing parameters | ❌ | ✅ |
| Assistant debugging issues | ❌ | ✅ |
| Assistant validating models | ❌ | ✅ |
| Production user workflows | ✅ | ❌ |

## Configuration

### SDK Configuration
- **File**: `backend/.env`
- **Key**: `REPLICATE_API_TOKEN`
- **Package**: `replicate` (npm)

### MCP Configuration
- **File**: `C:\Users\hello\.cursor\mcp.json`
- **Server**: `replicate` MCP server
- **Status**: ✅ Enabled (35 tools available)

## Example Usage

### SDK (User Operation)
```javascript
// backend/routes/generate-video.js
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const output = await replicate.run(modelId, {
  input: inputParams,
});
```

### MCP (Assistant Operation)
```javascript
// When assistant needs to test
await mcp_replicate_create_predictions({
  version: "pixverse/pixverse-v4.5:...",
  input: {
    prompt: "test prompt",
    aspect_ratio: "16:9"
  }
});
```

## Benefits

1. **Security**: API keys stay in backend for user operations
2. **Flexibility**: Assistant can test/debug without backend changes
3. **Performance**: MCP is faster for assistant operations
4. **Maintainability**: Clear separation of concerns

## Notes

- Both approaches use the same Replicate API
- MCP tools are only available when Cursor MCP server is enabled
- SDK approach is always available (as long as backend is running)

