module.exports = function outputRenderedImage (gl, width, height) {
  const Jimp = require('jimp')
  const imgcat = require('imgcat')
  const path = require('path')
  const sessionNumber = require('./session-number')()
  const imagePath = path.resolve(__dirname, `../${sessionNumber}`, `image.jpg`)
  const thumbPath = path.resolve(__dirname, `../${sessionNumber}`, `thumb.jpg`)

  const pixelCount = width * height * 4
  const pixels = new Uint8Array(pixelCount)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

  /* eslint-disable no-new */
  new Jimp(width, height, function (err, image) {
    if (err) {
      console.log('Unable to create image', err)
    }

    // Copy over the pixels, but flip them upside down
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const imageOffset = (i + j * width) * 4
        const pixelOffset = (i + (height - j - 1) * width) * 4
        image.bitmap.data[imageOffset] = pixels[pixelOffset]
        image.bitmap.data[imageOffset + 1] = pixels[pixelOffset + 1]
        image.bitmap.data[imageOffset + 2] = pixels[pixelOffset + 2]
        image.bitmap.data[imageOffset + 3] = pixels[pixelOffset + 3]
      }
    }
    console.log('Writing out image to: ' + imagePath)
    image
      .quality(60)
      .write(imagePath, err => {
        if (err) {
          throw new Error('Unable to save image', err)
        }
        console.log('Image saved.')
        console.log('Writing out thumbnail to: ' + thumbPath)

        image
          // .resize(256, 144)
          // Fit this nicely into GitHub's README.md display width.
          .resize(292, 164)
          .write(thumbPath, err => {
            if (err) {
              throw new Error('Unable to save thumbnail', err)
            }
            console.log('Thumbnail saved.')

            // Show the image on the screen
            imgcat(imagePath)
              .then(image => console.log(image))
              .catch(e => console.log(e.name))
              .then(() => process.exit())
          })
      })
  })
}
