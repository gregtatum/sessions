#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const template = require('lodash.template')

const url = 'https://github.com/gregtatum/sessions'

module.exports = function generateAllHtml (sessionNumbers) {
  sessionNumbers.forEach(generateHTML)
}

function generateHTML (sessionNumber) {
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
    previous: `<a href='${previous ? `../${previous}` : url}'>&lt;</a>`,
    next: `<a href='${next ? `../${next}` : url}'>&gt;</a>`,
    name: packageJson.name
  }))

  console.log('Updated HTML file at: ' + htmlDestination)
}

function getDirectories (directory) {
  return fs.readdirSync(directory).filter(function (file) {
    return fs.statSync(path.join(directory, file)).isDirectory()
  })
}
