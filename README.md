# fetch-retryable

`fetchRetry(url, options)` is a simple http retry utility with the ability to specify different behaviours depending on status code results.  This is useful in many cases.  Often, a 503 (for example) is an error that you can continue retrying for a long time - eventually (hopefully) the server will come back, and your work will succeed.  400-bad request, on the other hand, is arguably not retryable, as 400 indicates that it is the *request* that is incorrect and must be fixed.

`url` is the url to request.
`options` is an object that includes any fetch related options necessary [https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch]().  It **also** includes an (optional) field: `retryOptions`.

`retryOptions` is defined as follows:
```
fetch('https://google.ca', {
  method: 'get',
  retryOptions: {
    maxRetries: 3,                  // DEFAULT maxRetries applied to all requests that do not match a specific status code
    retryTimeout: 100,              // DEFAULT retryTimeout applied to all requests that do not match a specific status code
    status_5xx: {                   // options for 5xx class errors only.
      maxRetries: 3,
      retryTimeout: 10000,
    },
    status_503: {                   // options for 503 errors
      maxRetries: 3,
      retryTimeout: 10000
    }
  }
})
```

When an exception is thrown, the default options described above will be used (3 retries, retryTimeout:100).

If a statusCode is returned, fetchRetry will first look for a specific code in retryOptions (eg 503).  If it does not find one, it falls back to looking for class options (eg, 5xx).  If it does not find class options, it uses the default retry options.

If a `retryOptions` field is not defined when fetchRetry is called, it uses the default:

```
options.retryOptions = {
  maxRetries: 3,
  retryTimeout: 100,
}
```

Just a quick note: maxRetries means "do the thing once, then RETRY IT maxRetries times".  So maxRetries 3 will result in your url being called 4 times total (on failure).

#### Function-based timeout

For cases in which you don't want a fixed retry timeout, you can provide retryOptions a function in place of a millisecond timeout.  Instead of fetchRetry waiting for options.retryOptions.retryTimeout ms, it will `await options.retryOptions.retryTimeout(response, error)`

As you see, the response from the request is provided as an argument to your function. If the retry is due to an exception, the response argument will be null, and the error argument will be pass as the second argument.

This allows you to implement functions that have variable timeouts based on the response from the server.  For example, spotify rate-limits with statusCode 429, and provides a 'retry-after' header.  For this, you would do something like (pseudo-code, please do not use, make sure to handle error cases / etc):

```
options.retryOptions = {
  maxRetries: 3,
  retryTimeout: 100,
  status_429: {
    maxRetries: 5,
    retryTimeout: async function(response) {
      // get the retry-after header, a value in seconds.
      const retryAfter = response.headers['retry-after']
      // wait retry-after * 1000 milliseconds.
      await wait(retryAfter * 1000)

      // done.  retry can happen.
    }
  }
}
```

You can also implement custom exponential backoff retry strategies.  Instead of having a fixed timeout, you can start with 100ms and have it back-off by doubling the retry each time: 100ms, 200ms, 400ms, 800ms, etc.
