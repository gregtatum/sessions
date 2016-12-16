#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const template = require('lodash.template')
const sessionNumber = require('../common/session-number')()

generateHTML()

function generateHTML () {
  const htmlTemplatePath = path.resolve(__dirname, '../templates/index.html')
  const htmlDestination = path.resolve(__dirname, '../', sessionNumber, 'index.html')
  const packageDestination = path.resolve(__dirname, '../', sessionNumber, 'package.json')
  const htmlTemplate = template(fs.readFileSync(htmlTemplatePath, 'utf8'))
  const projectDirectories = (
    getDirectories(path.resolve(__dirname, '..')).filter(s => /^\d\d\d$/.exec(s))
  )
  const projectIndex = projectDirectories.indexOf(sessionNumber)
  const previous = projectDirectories[projectIndex - 1]
  const next = projectDirectories[projectIndex + 1]
  const packageJson = require(packageDestination)

  fs.writeFileSync(htmlDestination, htmlTemplate({
    sessionNumber: sessionNumber,
    previous: previous ? `<a href='../${previous}'>%lt;</a>` : '',
    next: next ? `<a href='../${next}'>%lt;</a>` : '',
    name: packageJson.name
  }))

  console.log('Updated HTML file at: ' + htmlDestination)
}

function getDirectories(directory) {
  return fs.readdirSync(directory).filter(function(file) {
    return fs.statSync(path.join(directory, file)).isDirectory()
  })
}
