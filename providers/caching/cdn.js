// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const waterMark = 30
const defaultIntervalMs = 60000 * 5

function isValidTag(tag) {
  return typeof tag === 'string' &&
    tag.length > 0 &&
    tag.indexOf(' ') === -1
}

class Cdn {
  constructor(options) {
    this.options = options
    this._queue = {}
    if (options.flushByTagUrl && typeof options.flushByTagUrl === 'string' && options.flushByTagUrl.length > 0) {
      this.doRequest = requestPromise
    }
    else {
      this.doRequest = () => {}
    }
    this.intervalMs = options.intervalMs || defaultIntervalMs
  }

  initialize() {
    this._timeout = setInterval(this.flushPending, this.intervalMs)
  }

  uninitialize() {
    this.flushPending()
    clearInterval(this._timeout)
  }

  flushPending() {
    if (this._queue) {
      for (let keys = Object.keys(this._queue); keys.length > 0; keys = keys.slice(waterMark)) {
        let keyBlock = keys.slice(0, waterMark)
        this.doRequest({
          url: this.options.flushByTagUrl,
          method: 'POST',
          body: JSON.stringify({ tags: keyBlock }),
          headers: {
            'X-Auth-Email': this.options.apiEmail,
            'X-Auth-Key': this.options.apiKey
          },
          json: true
        })
      }
      this._queue = {}
      this._timeout.refresh()
    }
  }

  queue(tag) {
    tag = tag.toString()
    if (isValidTag(tag)) {
      this._queue[tag] = true
      if (Object.keys(this._queue).length >= waterMark) {
        this.flushPending()
      }
    }
  }
}

module.exports = options => new Cdn(options)
