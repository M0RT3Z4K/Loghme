const baseURL = () => process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * خواندن SSE stream از بک‌اند
 * onDataLine: (payload: string) => void
 * onDone: () => void  — بعد از [DONE] صدا زده میشه
 */
export async function readChatSSE(path, { token, body, onDataLine, onDone, signal }) {
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
    let detail = '';
    try { detail = await res.text(); } catch { detail = ''; }
    throw new Error(`Stream failed: ${res.status}${detail ? ` - ${detail}` : ''}`);
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
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();

        if (payload === '[DONE]') {
          // اول onDone صدا بزن، بعد return کن
          onDone?.();
          return;
        }
        onDataLine(payload);
      }
    }
  }
  onDone?.();
}