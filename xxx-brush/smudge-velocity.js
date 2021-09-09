const glsl = require('glslify')
const framebufferFrom = require('./framebuffer-from')

exports.createVelocityFBO = (regl) => {
  const width = regl._gl.drawingBufferWidth
  const height = regl._gl.drawingBufferHeight
  return regl.framebuffer({
    width,
    height,
    colorType: 'float',
    depthStencil: false,
    color: (() => {
      const count = width * height
      const data = new Float32Array(count * 4)
      // Initialize the values
      for (let i = 0; i < count; i++) {
        data[i * 4 + 0] = 0 // x
        data[i * 4 + 1] = 0 // y
        data[i * 4 + 2] = 0 // unused
        data[i * 4 + 3] = 0 // unused
      }
      return regl.texture({
        data,
        width,
        height,
        type: 'float'
      })
    })(),
  })
}

exports.createUpdateVelocityBuffer = (regl, state) => {
  return regl({
    frag: glsl`
      precision highp float;

      uniform float
        brushSize,
        mouseSpeed,
        time,
        damping;
      uniform vec2 resolution, mouse, mouseDirection;
      uniform sampler2D colorBuffer, velocityBuffer;
      varying vec2 vUv;

      #pragma glslify: blur5 = require('glsl-fast-gaussian-blur/5')
      #pragma glslify: blur9 = require('glsl-fast-gaussian-blur/9')
      #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      #pragma glslify: getDistanceFromBrush = require(./smudge-glsl/distance-from-brush)

      vec4 texture2DWrapped(sampler2D texture, vec2 uv) {
        return texture2D(texture, mod(uv + vec2(10.0), vec2(1.0)));
      }

      void main() {
        vec2 step = (1.0 / resolution);
        vec2 velocity = texture2DWrapped(velocityBuffer, vUv).xy;

        // Apply the velocity to the UV.
        vec2 uv = vUv - velocity * step;

        vec2 nextVelocity = texture2DWrapped(velocityBuffer, uv).xy;

        float distance = getDistanceFromBrush(mouse, uv, brushSize, resolution) / brushSize;

        nextVelocity += 2.0 * mouseDirection * mouseSpeed * distance / resolution.y;
        gl_FragColor = vec4(nextVelocity * damping, vec2(0.0));
        // gl_FragColor = vec4(distance, 0.0, 0.0, 1.0);
        // gl_FragColor = vec4(-1.0, 0.0, 0.0, 1.0);
      }
    `,
    depth: { enable: false },
    uniforms: {
      velocityBuffer: ({tick}) => state.velocityBuffers[(tick + 1) % 2],
      resolution: ({viewportWidth, viewportHeight}) => [
        viewportWidth, viewportHeight
      ],
      time: ({time}) => time,
      mouse: () => state.mouse,
      mouseDirection: () => state.mouseDirection,
      mouseSpeed: () => state.mouseSpeed,
      brushSize: () => state.brushSize,
      damping: () => state.damping,
    },
    framebuffer: ({tick}) => state.velocityBuffers[tick % 2],
  })
}
