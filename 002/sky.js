const glsl = require('glslify')
const createPlane = require('primitive-plane')

module.exports = function (regl) {
  const plane = createPlane(
    // size
    2, 2,
    // subdivisions
    1, 1
  )
  return regl({
    attributes: {
      position: plane.positions,
      normal: plane.normals,
      uv: plane.uvs
    },
    elements: plane.cells,
    uniforms: {
      time: ({time}) => time,
      width: regl.context('viewportWidth'),
      height: regl.context('viewportHeight')
    },
    vert: glsl`
      precision mediump float;
      attribute vec3 position;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float time;
      varying vec2 vUv;
      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
        vUv = vec2(position.x, position.y) * 0.5 + 0.5;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)

      uniform float width, height, time;

      varying vec2 vUv;

      float GRADIENT_DISTANCE = 0.75;
      float NOISE_DISTANCE = 0.2;
      float NOISE_SCALE = 4.0;
      float NOISE_SPEED = 0.05;
      float FINE_GRAIN_SCALE = 0.1;
      float FINE_GRAIN_AMOUNT = 0.03;
      float FINE_GRAIN_SPEED = 1.5;
      float CENTER_X = 0.8;
      float CENTER_Y = 1.1;
      float ASPECT_RATIO = 0.85;
      float HUE_BASE = 0.70;
      float HUE_SPEED = 0.5;
      float HUE_RANGE = 0.03;

      vec3 mix3(in vec3 a, in vec3 b, in vec3 c, in float center, in float t) {
      vec3 white = vec3(1.0);
      vec3 black = vec3(0.0);

      return
        a * mix(white, black, smoothstep(0.0, center, t)) +
        b * mix(black, white, smoothstep(0.0, center, t))
          * mix(white, black, smoothstep(center, 1.0, t)) +
        c * mix(black, white, smoothstep(center, 1.0, t));
      }

      void main() {
      float aspect = width / height;
      float noise = NOISE_DISTANCE * snoise3(
        vec3(vUv.x, vUv.y, time * NOISE_SPEED) * NOISE_SCALE
      );

      vec2 position = vec2(
        vUv - vec2(CENTER_X + noise, CENTER_Y)
      ) * GRADIENT_DISTANCE;

      position.x *= aspect * ASPECT_RATIO;

      float distance = smoothstep(0.0, 1.0, length(position));

      float baseHue = HUE_BASE + sin(time * HUE_SPEED) * HUE_RANGE;
      vec3 color1 = hsl2rgb(fract(baseHue + 0.18), 0.40, 0.42); // center
      vec3 color2 = hsl2rgb(fract(baseHue + 0.93), 0.46, 0.35); // middle
      vec3 color3 = hsl2rgb(fract(baseHue + 0.63), 0.08, 0.18); // outer
      vec3 color = mix3(color1, color2, color3, 0.4, distance);

      float fineGrain = mix(
        1.0 - FINE_GRAIN_AMOUNT,
        1.0 + FINE_GRAIN_AMOUNT,
        snoise3(vec3(vUv * FINE_GRAIN_SCALE * height, time * FINE_GRAIN_SPEED)) * 0.5 + 0.5
      );
      gl_FragColor = vec4(color * fineGrain, 1.0);
    }`,

    depth: {
      enable: false
    }

  })
}
