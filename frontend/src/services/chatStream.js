const baseURL = () => process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * خواندن استریم SSE از بک‌اند (خطوط data: ...)
 * @param {string} path - مثال: /api/chat/stream-demo
 * @param {{ token?: string, body?: any, onDataLine: (payload: string) => void, signal?: AbortSignal }} options
 */
export async function readChatSSE(path, { token, body, onDataLine, signal }) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseURL()}${path}`, {
    method: body != null ? 'POST' : 'GET',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    throw new Error(`Stream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          onDataLine(payload);
        }
      }
    }
  }
}
