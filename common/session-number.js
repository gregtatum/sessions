module.exports = function () {
  const fs = require('fs')
  const path = require('path')
  const sessionNumber = process.argv[2]
  const dir = path.resolve(__dirname, `../${sessionNumber}`)

  if (!sessionNumber || !sessionNumber.match(/^\d\d\d$/)) {
    throw new Error(
      'The session number was not in the form of 000. Please pass the session ' +
      'number as the first parameter when launching this script from node.'
    )
  }

  if (!fs.existsSync(dir)) {
    throw new Error(`The session folder "${sessionNumber}" did not exist.`)
  }

  return sessionNumber
}
