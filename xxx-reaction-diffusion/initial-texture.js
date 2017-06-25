const glsl = require('glslify')

module.exports = function createInitialTexture(regl, withFullScreenQuad) {
  const texture = regl.texture({
    type: 'float',
    data: (() => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const { width, height } = regl._gl.canvas
      const radius = Math.min(width, height) * 0.002
      canvas.width = width
      canvas.height = height
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(
        0,
        0,
        width,
        height
      )
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = '#00ff00'
        ctx.fillRect(
          Math.random() * width - radius,
          Math.random() * height - radius,
          radius * 2,
          radius * 2
        )
      }

      return canvas
    })()
  })

  const frameBuffer = regl.framebuffer({
    color: regl.texture({ wrap: 'clamp' }),
    colorType: 'float',
    depth: false
  })

  const copyTexture = regl({
    frag: glsl`
      precision mediump float;
      uniform sampler2D texture;
      varying vec2 vUv;

      void main () {
        gl_FragColor = texture2D(texture, vUv);
      }
    `,
    uniforms: {
      texture
    }
  })

  // Copy the texture to the frame buffer.
  frameBuffer.use(() => {
    withFullScreenQuad(() => {
      copyTexture()
    })
  })

  return { texture, frameBuffer }
}
