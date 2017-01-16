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

        float WOBBLE_AMOUNT = 0.004;
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
        float BLUR_POWER = 1.05;
        float BLUR_INTENSITY = 2.0;

        float SIN_TIP = 0.97;
        float SIN_PERIOD = 10.0;

        float NOISE_SPEED = 3.0;
        float NOISE_SCALE = 0.1;
        float NOISE_AMOUNT = 0.2;

        float VIGNETTE_OUTER = -0.5;
        float VIGNETTE_INNER = 0.5;
        float VIGNETTE_AMOUNT = 0.75;

        void main() {
          vec2 uv = vUv;
          vec3 color = texture2D(framebuffer, uv).xyz;

          // wave
          float wave = (max(SIN_TIP, sin(time + uv.y * SIN_PERIOD)) - SIN_TIP) * (1.0 / (1.0 - SIN_TIP));
          uv.x = uv.x + 0.01 * wave;
          float waveColor = mix(0.9, 1.0, 1.0 - wave);

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
          float brightness0 = smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, uv.x * 2.0) * smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, (1.0 - uv.x) * 2.0);
          float brightness1 = smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, uv.y * 2.0) * smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, (1.0 - uv.y) * 2.0);
          float vignette = mix(1.0, brightness0 * brightness1, VIGNETTE_AMOUNT);

          gl_FragColor = vec4(
            vec3(vignette * noise * waveColor * (color + BLUR_INTENSITY * blurColor)),
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
