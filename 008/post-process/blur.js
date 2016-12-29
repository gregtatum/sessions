const FILTER_RADIUS = 2
const glsl = require('glslify')
const vec2 = require('gl-vec2')
const createDrawPass = require('./draw-pass')
const defaultProps = {
  scratchFBO: null,
  divisor: 2
}

module.exports = function(regl, drawPass, {scratchFBO, divisor} = defaultProps) {
  const blurHorizontalFBO = scratchFBO || regl.framebuffer({
    color: regl.texture({
      wrap: 'clamp'
    }),
    depth: true
  })
  const blurFBO = regl.framebuffer({
    color: regl.texture({
      wrap: 'clamp'
    }),
    depth: true
  })

  const drawBlur = regl({
    frag: glsl`
      precision mediump float;
      #pragma glslify: blur5 = require('glsl-fast-gaussian-blur/5')
      #pragma glslify: blur9 = require('glsl-fast-gaussian-blur/9')
      #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')

      varying vec2 vUv;
      uniform sampler2D sourceFBO;
      uniform vec2 resolution;
      uniform vec2 direction;

      float blurSize = 2.0;

      void main() {
        gl_FragColor = blur13(sourceFBO, vUv, resolution, direction);
      }
    `,
    uniforms: {
      sourceFBO: regl.prop('sourceFBO'),
      resolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
      direction: (_, {direction, blurSize}) => {
        return vec2.scale([], direction, window.devicePixelRatio * blurSize / divisor)
      },
    },
    context: {
      updateBlurFBOs: ({viewportWidth, viewportHeight}) => {
        blurHorizontalFBO.resize(viewportWidth / divisor, viewportHeight / divisor)
        blurFBO.resize(viewportWidth / divisor, viewportHeight / divisor)
      }
    },
    framebuffer: regl.prop('targetFrame'),
    depth: { enable: false },
    count: 3
  })

  const useBlurBuffer = regl({
    context: {
      blurFBO: regl.prop('blurFBO')
    }
  })

  const horizontal = [1, 0]
  const vertical = [0, 1]

  return (props, callback) => {
    drawPass(props, ({sourceFBO}) => {
      const blurSize = 4
      drawBlur({
        direction: horizontal,
        blurSize,
        sourceFBO,
        targetFrame: blurHorizontalFBO,
      })
      drawBlur({
        direction: vertical,
        blurSize,
        sourceFBO: blurHorizontalFBO,
        targetFrame: blurFBO,
      })
    })
    return useBlurBuffer({blurFBO}, callback)
  }
}
