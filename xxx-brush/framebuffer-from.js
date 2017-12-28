exports.canvas2d = function (regl, initializeCanvas) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth * window.devicePixelRatio
  canvas.height = window.innerHeight * window.devicePixelRatio
  initializeCanvas(canvas, ctx)
  const framebuffer = regl.framebuffer({
    color: regl.texture({
      data: canvas,
      mag: 'linear',
      min: 'linear',
      // wrap: 'repeat',
    }),
  })
  return framebuffer
}

exports.draw = function (regl, draw) {
  const framebuffer = regl.framebuffer({
    colorType: 'float',
    color: regl.texture({
      width: regl._gl.drawingBufferWidth,
      height: regl._gl.drawingBufferHeight,
      mag: 'linear',
      min: 'linear',
      // wrap: 'repeat',
    })
  })
  const withFramebuffer = regl({ framebuffer })
  const withFullScreenQuad = require('./full-screen-quad')(regl)
  withFullScreenQuad(() => {
    withFramebuffer(() => {
      draw()
    })
  })
  return framebuffer
}
