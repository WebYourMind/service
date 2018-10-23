// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const Curation = require('../lib/curation')

// Get a proposed patch for a specific revision of a component
router.get(
  '/:type/:provider/:namespace/:name/:revision/pr/:pr',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    return curationService.get(coordinates, request.params.pr).then(result => {
      if (result) return response.status(200).send(result)
      response.sendStatus(404)
    })
  })
)

// Get data needed by review UI
router.get(
  '/pr/:pr',
  asyncMiddleware(async (request, response) => {
    const url = curationService.getCurationUrl(request.params.pr)
    const changes = await curationService.getChangedDefinitions(request.params.pr)
    if (changes && changes.length > 0) return response.status(200).send({ url, changes })
    return response.sendStatus(404)
  })
)

// Get an existing patch for a specific revision of a component
router.get(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    return curationService.get(coordinates).then(result => {
      if (result) return response.status(200).send(result)
      response.sendStatus(404)
    })
  })
)

// Search for any patches related to the given path, as much as is given
router.get(
  '/:type?/:provider?/:namespace?/:name?',
  asyncMiddleware(async (request, response) => {
      const coordinates = utils.toEntityCoordinatesFromRequest(request)
      curationService.list(coordinates).then(function(result){
         let text_file_name = parseMockFile(request, "./test/fixtures/dummy_data_curations_");
         const json_data = readTextFile(text_file_name);
         console.log("data=", json_data);
         result = json_data;
         response.status(200).send(result);
      })
    })
  )


router.patch(
  '',
  asyncMiddleware(async (request, response) => {
    const serviceGithub = request.app.locals.service.github.client
    const userGithub = request.app.locals.user.github.client
    const info = request.app.locals.user.github.info
    let curationErrors = []
    request.body.patches.forEach(entry => {
      const curation = new Curation(entry)
      if (curation.errors.length > 0) {
        curationErrors = [...curationErrors, curation.errors]
      }
    })
    if (curationErrors.length > 0) response.status(400).send({ errors: curationErrors })
    else
      return curationService.addOrUpdate(userGithub, serviceGithub, info, request.body).then(result =>
        response.status(200).send({
          prNumber: result.data.number,
          url: curationService.getCurationUrl(result.data.number)
        })
      )
  })
)


//synchronous version
function readTextFile(file) {
    const fs=require('fs');
    let json;
    try{
      const data=fs.readFileSync(file, 'utf8');
      json=JSON.parse(data);
    } catch(e) {
      console.log('Error', e.stack);
    }
    return json;
}

function parseMockFile(request, baseFileName) {

  // access the request url and method
  const { method, url } = request;
  console.log('method', method);
  console.log('url', url);

  //trim and split the request url for processing
  let trimmed = url.trim();
  let myStringArray = trimmed.split("/");
  let text_file_name = baseFileName;

  // iterate through the 'url array' and create a filename string from it
  const arrayLength = myStringArray.length;
  for (var i = 0; i < arrayLength; i++) {
        // ignore the spaces and dashes
        if((myStringArray[i] !== "-") && (myStringArray[i] !== "")) {
          if(i < arrayLength) {
            // append underscore separator
            text_file_name = text_file_name + myStringArray[i] + "_";
          }
          else{
            // end of file - no separator
            text_file_name = text_file_name + myStringArray[i];
          }
        }
  }

  //replace the last occurence of the underscore
  text_file_name = text_file_name.replace(/_([^_]*)$/,'$1'); //a_bc
  text_file_name = text_file_name + ".json";

  return text_file_name;
}


let curationService

function setup(service) {
  curationService = service
  return router
}

module.exports = setup
