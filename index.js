const _fetch = require('isomorphic-fetch')
const wait = require('./wait')

module.exports = async function fetchRetry(url, options) {
  // to facilitate testing, we allow stubbing fetch.
  let fetch = (options && options.fetch) || _fetch

  if (
    !options ||
    !options.retryOptions ||
    !options.retryOptions.maxRetries ||
    !options.retryOptions.retryTimeout
  ) {
    // this simply calls fetch if we're given no options
    return fetch(url, options)
  }

  let retries = 0
  while (true) {
    try {
      // do the fetch.
      response = await fetch(url, options)

      // now, check the status.
      const status = response.status
      if (
        options.retryOptions[`status_${status}`] ||
        options.retryOptions[`status_${('' + status).slice(0, 1)}xx`] ||
        status < 200 ||
        status >= 400
      ) {
        // if the status is an error status (>400), then we need to retry.
        retries++

        // we first check to see if we have retry options for that specific error:
        //  options.retryOptions.status_402, for example.
        // if not, check for error class options
        //  options.retryOptions.status_4xx will give options for all 400 class errors
        // if not, we use the defaults.
        const retryOptions =
          options.retryOptions[`status_${status}`] ||
          options.retryOptions[`status_${('' + status).slice(0, 1)}xx`] ||
          options.retryOptions

        if (retries > retryOptions.maxRetries) {
          // we've exceeded our maxRetries, so we fail.
          options.verbose &&
            console.log(
              `FATAL fetch failure, status ${status}, no more retries`
            )

          // we dont' throw.  we return the failed status code, for the outside code to handle.
          return response
        }

        options.verbose &&
          console.log(
            `Error in fetch (${(options && options.method) ||
              'get'} ${url}), status ${status}, retrying (${retries}) in ${
              retryOptions.retryTimeout
            }`
          )

        if (typeof retryOptions.retryTimeout === 'function') {
          // we've been given a function.  we'll wait until that function
          // resolves its promise, then retry.
          await retryOptions.retryTimeout(response)
        } else {
          // we've been given a numeric retryTimeout.  we wait that many milliseconds.
          await wait(retryOptions.retryTimeout)
        }
      } else return response
    } catch (err) {
      retries++
      const retryOptions = options.retryOptions
      if (retries > retryOptions.maxRetries) {
        options.verbose && console.log('FATAL failure, no more retries', err)
        throw err
      }
      options.verbose &&
        console.log(
          `Error (${(options && options.method) ||
            'get'} ${url}), retrying (${retries}) in ${
            retryOptions.retryTimeout
          }`,
          err
        )
      if (typeof retryOptions.retryTimeout === 'function')
        await retryOptions.retryTimeout(null, err)
      else await wait(retryOptions.retryTimeout)
    }
  }

  return response
}
