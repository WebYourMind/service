// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, intersection } = require('lodash')
/**
 * Middleware that checks for permissions for this request based on team membership.
 *
 * Usage: `app.get('/some/route', permissionCheck('harvesters'), (req, res) => ...)`
 */
function permissionCheck(permission) {
  // eslint-disable-next-line no-unused-vars
  return (request, response, next) => {
    const requiredTeams = get(request, `app.locals.config.auth.github.permissions[${permission}]`) // whew!
    if (!requiredTeams || requiredTeams.length === 0) return next()
    const userTeams = get(request, 'app.locals.user.github.teams')
    if (intersection(requiredTeams, userTeams).length > 0) return next()
    const err = new Error(`No permission to '${permission}' (needs team membership)`)
    err.status = 401
    next(err)
  }
}

module.exports = {
  permissionCheck
}
