#!/usr/bin/env node
const path = require('path')
const fs = require('fs')
const template = require('lodash.template')
const sessionNumber = require('../common/session-number')()
const browserify = require('browserify')
const UglifyJS = require('uglify-js')
global.headlessRegl = require('../common/headless-regl')

browserifyBundle(() => {
  updateReadme()
  generateThumbnail()
})

function updateReadme () {
  const readmeTemplatePath = path.resolve(__dirname, '../templates/README.md')
  const readmeDestination = path.resolve(__dirname, '../README.md')
  const readmeTemplate = template(fs.readFileSync(readmeTemplatePath, 'utf8'))
  const projectDirectories = (
    getDirectories(path.resolve(__dirname, '..')).filter(s => /^\d+$/.exec(s))
  )

  fs.writeFileSync(readmeDestination, readmeTemplate({
    thumbs: projectDirectories.map(dir => (
      `[![Session ${dir}](./${dir}/thumb.jpg)](https://gregtatum.github.io/sessions/${dir})`
    )).join('\n')
  }))

  console.log('Updated README at: ' + readmeDestination)
}

function browserifyBundle (callback) {
  const scriptPath = path.resolve(__dirname, '../', sessionNumber, 'index.js')
  const bundlePath = path.resolve(__dirname, '../', sessionNumber, 'bundle.js')

  const b = browserify()
  b.add(scriptPath)
  b.transform('glslify')
  b.transform(require('babelify').configure({ presets: 'es2015' }))
  b.plugin(require('bundle-collapser/plugin'))

  console.log('Starting to bundle', scriptPath)
  b.bundle(function (err, src) {
    if (err) {
      throw err
    }
    console.log('Compressing bundle', bundlePath)
    const result = UglifyJS.minify(src.toString(), { fromString: true })

    console.log('Writing bundle', bundlePath)
    fs.writeFileSync(bundlePath, result.code)

    callback()
  })
}

function generateThumbnail () {
  // Through magic and wizardy, render this out to disc using headless-gl.
  require(`../${sessionNumber}`)
}

function getDirectories (directory) {
  return fs.readdirSync(directory).filter(function (file) {
    return fs.statSync(path.join(directory, file)).isDirectory()
  })
}
