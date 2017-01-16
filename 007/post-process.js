const glsl = require('glslify')

module.exports = function (regl) {
  const framebuffer = regl.framebuffer({
    color: regl.texture({
      wrap: 'clamp'
    }),
    depth: true
  })

  return {
    setupFrameBuffer: regl({
      framebuffer: ({viewportWidth, viewportHeight}) => {
        framebuffer.resize(viewportWidth, viewportHeight)
        return framebuffer
      }
    }),
    drawPostProcessing: regl({
      vert: glsl`
        precision mediump float;
        #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
        attribute vec2 position;
        varying vec2 vUv;
        uniform float time;
        uniform vec2 resolution;

        float WOBBLE_AMOUNT = 0.000;
        float WOBBLE_DIFFERENCE = 10.0;
        float WOBBLE_SPEED = 0.75;

        void main() {
          vUv = 0.5 * (position + 1.0);
          float ratio = resolution.x / resolution.y;
          vUv += (
            vec2(WOBBLE_AMOUNT, WOBBLE_AMOUNT * ratio)
            * snoise3(vec3(vUv * WOBBLE_DIFFERENCE, time * WOBBLE_SPEED))
          );
          gl_Position = vec4(position, 0, 1);
        }
      `,
      frag: glsl`
        precision mediump float;
        #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
        #pragma glslify: blur5 = require('glsl-fast-gaussian-blur/5')
        #pragma glslify: blur9 = require('glsl-fast-gaussian-blur/9')
        #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')

        varying vec2 vUv;
        uniform sampler2D framebuffer;
        uniform vec2 resolution;
        uniform float ratio;
        uniform float time;

        float BLUR_SIZE = 2.0;
        float BLUR_POWER = 1.02;
        float BLUR_INTENSITY = 0.5;

        float NOISE_SPEED = 1.0;
        float NOISE_SCALE = 0.05;
        float NOISE_AMOUNT = 0.02;

        float VIGNETTE_OUTER = -0.25;
        float VIGNETTE_INNER = 1.0;
        float VIGNETTE_AMOUNT = 0.90;
        float VIGNETTE_X_OFFSET = 0.1;
        float VIGNETTE_Y_OFFSET = 0.25;

        void main() {
          vec2 uv = vUv + vec2(0.03 * snoise3(vec3(vUv * 3.0, time * 0.25)));
          vec3 color = texture2D(framebuffer, uv).xyz;

          // blur
          float blurSize = ratio * BLUR_SIZE;
          vec3 blurHorizontal = blur13(framebuffer, uv, resolution, vec2(blurSize, 0.0)).xyz;
          vec3 blurVertical = blur13(framebuffer, uv, resolution, vec2(0.0, blurSize)).xyz;
          vec3 blurColor = pow((blurHorizontal + blurVertical) * 0.5, vec3(BLUR_POWER));

          // noise
          float noise = (
            (1.0 - NOISE_AMOUNT) + NOISE_AMOUNT *
            snoise3(vec3(
              NOISE_SCALE * vUv * resolution,
              time * NOISE_SPEED
            ))
          );

          // vignette
          float brightness0 = smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, uv.x * 2.0) * smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, (1.0 - uv.x + VIGNETTE_X_OFFSET) * 2.0);
          float brightness1 = smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, uv.y * 2.0) * smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, (1.0 - uv.y + VIGNETTE_Y_OFFSET) * 2.0);
          float vignette = mix(1.0, brightness0 * brightness1, VIGNETTE_AMOUNT);

          gl_FragColor = vec4(
            vec3(vignette * noise * (color + BLUR_INTENSITY * blurColor)),
            1.0
          );
        }
      `,
      attributes: {
        position: [ -4, -4, 4, -4, 0, 4 ]
      },
      uniforms: {
        time: ({time}) => time,
        framebuffer: () => framebuffer,
        resolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
        ratio: () => window.devicePixelRatio
      },
      depth: { enable: false },
      count: 3
    })
  }
}
