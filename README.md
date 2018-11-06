# Fetch-Retryable

Fetch-Retryable is a simple utility module which wraps [fetch](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch) (both in the browser and in node) in order to specify custom retry behaviours depending upon response statusCode and/or type of exception thrown.

Often, when working with third-party APIs, one needs the ability to retry a failed request *in different ways, depending on the response to that request*.  For example, a `503-Service Unavailable` error is (typically) infinitely retryable.  On the other hand, `400-Bad Request` is typically because of a client error, and so a retry would not be helpful.  Similarly, many implementations of API rate-limiting will explicitly tell the client how long to wait before rate-limiting.  Other APIs may request that clients implement exponential-backoff in their retry behaviour.

It's a complicated world.

Enter fetch-retryable.  This simple module wraps [fetch](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch) both in-browser and at the server, and gives the caller the ability to configure custom retry behaviour.

## Quickstart

Fetch-Retryable depends upon [isomorphic-fetch](https://www.npmjs.com/package/isomorphic-fetch), which itself depends upon [fetch](https://github.com/github/fetch) or [node-fetch](https://github.com/bitinn/node-fetch) to enable fetch on both client or server.  Take a look at their documentation for details on making fetch requests.

Fetch-retryable (`fetchRetryable(url, options)`) is a drop-in replacement for fetch.  In addition to the options specified in your fetch call, there is one more option it enables: `retryOptions`.

`retryOptions` gives you the ability to set maxRetries and retryTimeout for all responses, per statusCode class, or per statusCode.  Here's a simple example:

```javascript
import fetchRetryable from 'fetch-retryable';
const response = await fetchRetryable('https://google.ca', {
  method: 'get',
  retryOptions: {
    retryTimeout: 100,
    maxRetries: 3,
    status_503: {
      retryTimeout: 5000,
      maxRetries: 10
    }
  }
})
```

In the above example, we're setting both the default retry (max:3, timeout: 100), and we're setting a specific retry handler for 503 statusCodes (max: 10, timeout: 5000).

## What else can I do?

I'm glad you asked.

### Status code, status code class, and default retry behaviours
In the `retryOptions` field, there are three classes of retry options you can provide:
```javascript
const response = await fetchRetryable('https://google.ca', {
  method: 'get',
  retryOptions: {
    retryTimeout: 100,            // Default behaviour
    maxRetries: 3,
    status_503: {                 // Retry behaviour for 503 errors only
      retryTimeout: 5000,
      maxRetries: 10
    },
    status_5xx: {                 // Behaviour for all 5xx class errors
      retryTimeout: 100,
      maxRetries: 2
    }
  }
})
```

As you can see above, you can provide behaviour that catches specific status codes, status code classes (eg `status_5xx`), and default.  `fetchRetryable` tests in order of specificity, meaning `status_503` beats `status_5xx` which beats the default retry options.

### Custom retry timeout function
As we pointed out earlier, it's a complicated world, so to make things easier, `fetchRetryable` allows you to provide a custom retry timeout function.

That function should match the following signature: `retryTimeout(retryContext)`

`retryContext` is an object containing information about the current retry.  It will always include a field `retry: 1` indicating which retry (zero-based) is coming up.  Additionally, it may contain a `response` object (the response object returned from the fetch call, from which you can get `response.statusCode`) or an `error` object (if an exception was thrown)

*Important*: It's probably not a terrific idea to, for example, `await response.json()` in your retryTimeout handler.  You can only retrieve the body of a response once.

Example (retry-after):
```javascript
const response = await fetchRetryable('https://google.ca', {
  method: 'get',
  retryOptions: {
    retryTimeout: 100,            // Default behaviour
    maxRetries: 3,
    status_429: {                 // Retry behaviour for 429 errors only
      retryTimeout: async (retryContext) => {
        const retryAfter = retryContext.response.headers.get('retry-after')
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve()
          }, retryAfter * 1000)
        })
      },
      maxRetries: 10
    }
  }
})
```

In the example above, the `429-Too Many Requests` statusCode response includes the header 'retry-after', which specifies how long the server expects the client to wait.  When that statusCode is received, the retryTimeout function is called, the header is inspected, and the client waits before retrying.

Example (exponential backoff):
```javascript
const response = await fetchRetryable('https://google.ca', {
  method: 'get',
  retryOptions: {
    retryTimeout: 100,            // Default behaviour
    maxRetries: 3,
    status_429: {                 // Retry behaviour for 429 errors only
      retryTimeout: async (retryContext) => {
        const initialRetryTimeout = 100;  // the timeout of the first retry.
        const timeout = (Math.pow(2, retryContext.retry)) * 100;
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve()
          }, timeout)
        })
      },
      maxRetries: 10
    }
  }
})
```

In this example, our retry handler does not look at the retry-after field.  Instead, it implements exponential backoff starting at 100ms.  That means: retry 1 will wait 100ms.  Retry 2 will wait 200ms.  Retry 3 will wait 400ms.  Retry 4 waits 800ms, and so on.
