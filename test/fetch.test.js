const expect = require('chai').expect
const sinon = require('sinon')
const wait = require('../wait')
const fetch = require('isomorphic-fetch')
const fetchRetry = require('../index')

describe('Retry', function() {
  before(function() {
    sandbox = sinon.createSandbox()
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('should not retry on success', async () => {
    sandbox.stub(testFns, 'fetch').resolves({ status: 200 })
    const result = await fetchRetry('https://google.ca', {
      method: 'get',
      fetch: testFns.fetch,
    })
    expect(testFns.fetch.calledOnce).to.be.true
    expect(result).to.be.an('object')
    expect(result.status).to.equal(200)
  })

  it('should retry on success if we REALLY insist on it', async () => {
    sandbox.stub(testFns, 'fetch').resolves({ status: 200 })
    const result = await fetchRetry('https://google.ca', {
      method: 'get',
      retryOptions: {
        retryTimeout: 1,
        maxRetries: 3,
        status_200: {
          maxRetries: 3,
          retryTimeout: 1,
        },
      },
      fetch: testFns.fetch,
    })

    expect(testFns.fetch.callCount).to.equal(4)
    expect(result).to.be.an('object')
    expect(result.status).to.equal(200)
  })

  it('should use default retry options if no class or specific retry options are provided', async () => {
    sandbox.stub(testFns, 'fetch').resolves({ status: 502 })
    const result = await fetchRetry('https://google.ca', {
      method: 'get',
      retryOptions: {
        retryTimeout: 1,
        maxRetries: 3,
        status_400: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_4xx: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_503: {
          maxRetries: 5,
          retryTimeout: 1,
        },
      },
      fetch: testFns.fetch,
    })

    expect(testFns.fetch.callCount).to.equal(4)
    expect(result).to.be.an('object')
    expect(result.status).to.equal(502)
  })

  it('should use class retry options if provided and no specific retry options are provided', async () => {
    sandbox.stub(testFns, 'fetch').resolves({ status: 502 })
    const result = await fetchRetry('https://google.ca', {
      method: 'get',
      retryOptions: {
        retryTimeout: 1,
        maxRetries: 5,
        status_400: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_4xx: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_5xx: {
          maxRetries: 3,
          retryTimeout: 1,
        },
        status_503: {
          maxRetries: 5,
          retryTimeout: 1,
        },
      },
      fetch: testFns.fetch,
    })

    expect(testFns.fetch.callCount).to.equal(4)
    expect(result).to.be.an('object')
    expect(result.status).to.equal(502)
  })

  it('should use specific retry options if provided', async () => {
    sandbox.stub(testFns, 'fetch').resolves({ status: 502 })
    const result = await fetchRetry('https://google.ca', {
      method: 'get',
      retryOptions: {
        retryTimeout: 1,
        maxRetries: 5,
        status_400: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_4xx: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_5xx: {
          maxRetries: 5,
          retryTimeout: 1,
        },
        status_502: {
          maxRetries: 3,
          retryTimeout: 1,
        },
      },
      fetch: testFns.fetch,
    })

    expect(testFns.fetch.callCount).to.equal(4)
    expect(result).to.be.an('object')
    expect(result.status).to.equal(502)
  })

  it('should use default retries if exception is thrown', async () => {
    sandbox.stub(testFns, 'fetch').rejects()
    let result
    let exceptionCaught = false
    try {
      result = await fetchRetry('https://google.ca', {
        method: 'get',
        retryOptions: {
          retryTimeout: 1,
          maxRetries: 3,
          status_400: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_4xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_5xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_502: {
            maxRetries: 5,
            retryTimeout: 1,
          },
        },
        fetch: testFns.fetch,
      })
    } catch (e) {
      exceptionCaught = true
    }

    expect(testFns.fetch.callCount).to.equal(4)
    expect(result).to.be.undefined
    expect(exceptionCaught).to.be.true
  })

  it('should call retryTimeout function if provided', async () => {
    sandbox.stub(testFns, 'fetch').resolves({ status: 429 })
    sandbox.spy(testFns, 'retryTimeout')
    let result
    let exceptionCaught = false
    try {
      result = await fetchRetry('https://google.ca', {
        method: 'get',
        retryOptions: {
          retryTimeout: testFns.retryTimeout,
          maxRetries: 5,
          status_400: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_4xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_429: {
            maxRetries: 3,
            retryTimeout: testFns.retryTimeout,
          },
          status_5xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
        },
        fetch: testFns.fetch,
      })
    } catch (e) {
      exceptionCaught = true
    }

    expect(testFns.fetch.callCount).to.equal(4)
    expect(testFns.retryTimeout.callCount).to.equal(3)
    expect(result).to.be.an('object')
    expect(result.status).to.equal(429)
  })

  it('should  call retryTimeout function if exception is thrown', async () => {
    sandbox.stub(testFns, 'fetch').rejects()
    sandbox.spy(testFns, 'retryTimeout')
    let result
    let exceptionCaught = false
    try {
      result = await fetchRetry('https://google.ca', {
        method: 'get',
        retryOptions: {
          retryTimeout: testFns.retryTimeout,
          maxRetries: 3,
          status_400: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_4xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_5xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_502: {
            maxRetries: 5,
            retryTimeout: 1,
          },
        },
        fetch: testFns.fetch,
      })
    } catch (e) {
      exceptionCaught = true
    }

    expect(testFns.fetch.callCount).to.equal(4)
    expect(testFns.retryTimeout.callCount).to.equal(3)
    expect(result).to.be.undefined
    expect(exceptionCaught).to.be.true
  })

  it('should call fetch once, with no retries, if no default options are provided', async () => {
    sandbox.stub(testFns, 'fetch').rejects()
    sandbox.spy(testFns, 'retryTimeout')
    let result
    let exceptionCaught = false
    try {
      result = await fetchRetry('https://google.ca', {
        method: 'get',
        retryOptions: {
          status_400: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_4xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_5xx: {
            maxRetries: 5,
            retryTimeout: 1,
          },
          status_502: {
            maxRetries: 5,
            retryTimeout: 1,
          },
        },
        fetch: testFns.fetch,
      })
    } catch (e) {
      exceptionCaught = true
    }

    expect(testFns.fetch.callCount).to.equal(1)
    expect(testFns.retryTimeout.callCount).to.equal(0)
    expect(result).to.be.undefined
    expect(exceptionCaught).to.be.true
  })
})

const testFns = {
  fetch: async () => {
    await wait(1)
    return { status: 200 }
  },
  retryTimeout: async retryContext => {
    await wait(1)
  },
}
