const glsl = require('glslify')

module.exports = function createInitialTexture(regl, withFullScreenQuad) {
  const texture = regl.texture({
    type: 'float',
    data: (() => {
      const fill = regl({
        frag: glsl`
          precision highp float;
          varying vec2 vUv;

          void main () {
            gl_FragColor = vec4(vUv, 1.0, 1.0);
          }
        `,
      })

      withFullScreenQuad(() => {
        fill()
      })()

      return regl._gl.canvas
    })()
  })

  const frameBuffer = regl.framebuffer({
    color: regl.texture({ wrap: 'clamp' }),
    colorType: 'float',
    depth: false
  })

  const copyTexture = regl({
    frag: glsl`
      precision highp float;
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
