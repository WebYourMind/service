// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MongoClient = require('mongodb').MongoClient
const promiseRetry = require('promise-retry')
const EntityCoordinates = require('../../lib/entityCoordinates')
const logger = require('../logging/logger')
const sanitize = require('mongo-sanitize')

class MongoStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(
          this.options.connectionString,
          { useNewUrlParser: true }
        )
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection('definitions')
      } catch (error) {
        retry(error)
      }
    })
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates, expand = null) {
    // To protect this regex from DoS attacks use the sanitize function to strip out
    // any keys that start with '$' in the input, so you can pass it to MongoDB without
    // worrying about malicious users overwriting query selectors.
    try {
      const regex = new RegExp('^' + this._getId(coordinates))
      const safeQuery = sanitize(regex)
      const list = await this.collection.find(
        { _id: safeQuery },
        { projection: { _id: expand === 'definitions' ? 0 : 1 } }
      )
      const result = await list.toArray()
      if (expand === 'definitions') return result
      return result.map(entry => entry._id)
    } catch (error) {
      throw new Error('Error retrieving components from the Store')
    }
  }

  /**
   * Get and return the object at the given coordinates.
   *
   * @param {Coordinates} coordinates - The coordinates of the object to get
   * @returns The loaded object
   */
  get(coordinates) {
    return this.collection.findOne({ _id: this._getId(coordinates) }, { projection: { _id: 0 } })
  }

  async store(definition) {
    definition._id = this._getId(definition.coordinates)
    await this.collection.replaceOne({ _id: definition._id }, definition, { upsert: true })
    return null
  }

  async delete(coordinates) {
    await this.collection.deleteOne({ _id: this._getId(coordinates) })
    return null
  }

  _getId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }
}

module.exports = options => new MongoStore(options)
