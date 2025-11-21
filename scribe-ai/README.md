# ScribeAI - Architecture Decisions

## Streaming vs Upload Approach
| Aspect | Streaming | Upload |
|--------|-----------|--------|
| Latency | Low (real-time) | High (post-processing) |
| Reliability | Medium (network dependent) | High |
| Memory Usage | Low (chunked) | High (full file) |
| User Experience | Live feedback | Delayed results |

## Scalability for Long Sessions
- **Chunked Processing**: Audio split into 30s chunks prevents memory overload
- **WebSocket Streaming**: Enables real-time updates without polling
- **Client-side Buffering**: Handles network interruptions gracefully
- **Stateless Processing**: Each chunk processed independently

## run
npm run dev