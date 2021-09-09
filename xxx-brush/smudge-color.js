const glsl = require('glslify')
const framebufferFrom = require('./framebuffer-from')

exports.colorColorFBO = (regl, state) => {
  return framebufferFrom.draw(regl, regl({
    frag: glsl`
      precision highp float;
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)

      uniform float baseHue;
      uniform vec2 ratio;
      varying vec2 vUv;

      float hueRange = 0.5;

      void main() {
        // Hijack the hue to add some randomness.
        float randomNumber = baseHue * 20.0;
        float noise = min(1.0, max(0.0, (
          abs(1.5 * snoise2(vec2(randomNumber) + vUv * 0.5 * ratio)) +
          abs(2.5 * snoise2(vec2(randomNumber) + vUv * 1.0 * ratio)) +
          abs(0.8 * snoise2(vec2(randomNumber) + vUv * 5.0 * ratio)) +
          abs(0.5 * snoise2(vec2(randomNumber) + vUv * 20.0 * ratio)) +
          abs(0.6 * snoise2(vec2(randomNumber) + vUv * 35.0 * ratio)) +
          abs(0.1 * snoise2(vec2(randomNumber) + vUv * 50.0 * ratio))
        ) * 0.2));
        noise = mix(0.5, noise, 0.8);
        gl_FragColor = vec4(
          hsl2rgb(
            mod(baseHue + vUv.y * hueRange + mix(0.9, 0.5, noise), 1.0),
            0.3,
            noise * 0.9 + 0.1
          ),
        1.0);
      }
    `,
    uniforms: {
      baseHue: () => state.baseHue,
      ratio: ({viewportWidth, viewportHeight}) => [viewportWidth / viewportHeight, 1]
    }
  }))
}

exports.createUpdateColorBuffer = (regl, state) => {
  return regl({
    frag: glsl`
      precision highp float;

      uniform float blurDistance, brushSize, mouseSpeed, time, colorMix, pixelsMovedOverToMix;
      uniform vec2 resolution, mouse, mouseDirection;
      uniform sampler2D colorBuffer, velocityBuffer;
      varying vec2 vUv;

      #pragma glslify: blur13 = require(glsl-fast-gaussian-blur/13)
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

        // vec4 colorFromBuffer = blendPointInBuffer(uv, step);
        vec4 colorFromBuffer = texture2DWrapped(colorBuffer, uv);

        // Don't bother using the blended value here.
        vec4 blurHorizontal = blur13(colorBuffer, uv, resolution, mouseDirection * blurDistance);
        float distanceFromBrush = getDistanceFromBrush(mouse, uv, brushSize, resolution);

        // Blur at the mouse.
        gl_FragColor = mix(
          colorFromBuffer,
          mix(
            blurHorizontal,
            vec4(hsl2rgb(mod(time * 0.1, 1.0), 0.5, 0.5), 1.0),
            colorMix
          ),
          distanceFromBrush *
            min(1.0, max(0.0, (mouseSpeed / resolution.y) * pixelsMovedOverToMix))
        );
      }
    `,
    depth: { enable: false },
    uniforms: {
      colorBuffer: ({tick}) => state.colorBuffers[tick % 2],
      velocityBuffer: ({tick}) => state.velocityBuffers[tick % 2],
      resolution: ({viewportWidth, viewportHeight}) => [
        viewportWidth, viewportHeight
      ],
      time: ({time}) => time,
      mouse: () => state.mouse,
      mouseDirection: () => state.mouseDirection,
      mouseSpeed: () => state.mouseSpeed,
      brushSize: () => state.brushSize,
      blurDistance: 5,
      colorMix: 0.05,
      pixelsMovedOverToMix: 1000,
    },
    framebuffer: ({tick}) => state.colorBuffers[(tick + 1) % 2],
  })
}
