type FetchOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
  body?: BodyInit
}

export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { json, body, headers, ...rest } = options

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : body ? { body } : {}),
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Request failed')
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error
  ) {
    const err = payload.error as { message?: string }
    throw new Error(err.message ?? 'Request failed')
  }

  if (!response.ok) {
    throw new Error('Request failed')
  }

  return (payload as { data: T }).data
}
