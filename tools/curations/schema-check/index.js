// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Curation = require('../../../lib/curation')
const yaml = require('js-yaml')
const fs = require('fs')


function help() {
  console.log('\
schema-check <path> [--fix]\n\n\
Will verify all curations on the given directory.\n\
With the optional --fix argument, it will apply known fixes.\n\n')
}

function withSubFiles(path, condition, fn) {
  if (path[path.length - 1] === '/') path = path.substr(0, path.length - 1)
  fs.readdir(path, { withFileTypes: true }, (err, files) => {
    if (err) {
      throw err
    }
    const absPaths = files
      .map(relative => {
        return {
          isDirectory: relative.isDirectory(),
          isFile: relative.isFile(),
          path: [path, relative.name].join('/')
        }
      })
    absPaths
      .filter(a => a.isFile)
      .map(a => a.path)
      .filter(condition)
      .forEach(fn)
    absPaths
      .filter(a => a.isDirectory)
      .forEach(a => withSubFiles(a.path, condition, fn))
  })
}

const healers = [
  {
    name: 'getting the sourceLocation name from its GitHub URL',
    condition: (err, curation) => {
      const dataPathComponents = err.error.dataPath.split('/')
      dataPathComponents.shift()
      const checks = dataPathComponents.length > 0 &&
        dataPathComponents[dataPathComponents.length - 1] === 'sourceLocation' &&
        err.error.params.errors[0].params.missingProperty === 'name'
      if (checks) {
        const location = dataPathComponents.reduce((total, current) => total[current], curation.data)
        if (location.provider === 'github' && location.type === 'git') {
          const _rxGithubUrl = /^https:\/\/((github\.com)|(bitbucket\.org))\/([^/]+)\/(.+?)(\/commits?\/.*)?$/g
          const m = _rxGithubUrl.exec(location.url)
          if (m) {
            // console.log({
            //   namespace: m[4],
            //   name: m[5]
            // })
            return true
          }
          else {
            console.log({ cantParse: location.url })
          }
        } else {
          console.log({ cantUse: { provider: location.provider, type: location.type } })
        }
      }
      return false
    },
    apply: (err, curation) => {
      const dataPathComponents = err.error.dataPath.split('/')
      dataPathComponents.shift()
      const location = dataPathComponents.reduce((total, current) => total[current], curation.data)
      if (location.provider === 'github' && location.type === 'git') {
        const _rxGithubUrl = /^https:\/\/((github\.com)|(bitbucket\.org))\/([^/]+)\/(.+?)(\/commits?\/.*)?$/g
        const m = _rxGithubUrl.exec(location.url)
        if (m) {
          location.name = m[5]
          location.namespace = m[4]
        }
        else {
          throw Error('Unable to parse the location ')
        }
      } else {
        throw Error('this provider is not compatible with the solution')
      }
    }
  }
]

async function main() {
  if (process.argv.length < 3) {
    help()
    return -1
  }

  const doFix = process.argv.indexOf('--fix') > 0
  const path = process.argv[2]
  const ext = '.yaml'

  withSubFiles(path,
    f => f.length > ext.length && f.substr(f.length - ext.length) === ext,
    path => {
      fs.readFile(path, 'utf8', (err, data) => {
        if (err) throw err
        const curation = new Curation(data, path)
        if (!curation.isValid) {
          console.log(path)
          console.dir(curation.errors)
          curation.errors.forEach(err => {
            console.dir(err)
            const healer = healers.find(healer => healer.condition(err, curation))
            if (healer) {
              if (doFix) {
                healer.apply(err, curation)
                fs.writeFile(curation.path, yaml.safeDump(curation.data), err => { throw err })
              } else {
                console.log(`^^^ Can be resolved by ${healer.name}`)
              }
            } else {
              console.log('^^^ no automatic resolution known')
            }
          })
        }
      })
    })
}

main()
