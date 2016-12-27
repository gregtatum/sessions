const glsl = require('glslify')
const createPlane = require('primitive-plane')

module.exports = function (regl) {
  const plane = createPlane(
    2, 2, // size
    1, 1 // subdivisions
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

      float GRADIENT_DISTANCE = 0.55;
      float NOISE_DISTANCE = 0.5;
      float NOISE_SCALE = 2.0;
      float NOISE_SPEED = 0.05;
      float NOISE2_DISTANCE = 0.2;
      float NOISE2_SCALE = 8.0;
      float NOISE2_SPEED = 0.02;
      float CENTER_X = 0.8;
      float CENTER_Y = 1.3;
      float ASPECT_RATIO = 0.85;
      float HUE_BASE = 0.65;

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
        float noise2 = NOISE2_DISTANCE * snoise3(
          vec3(vUv.x, vUv.y, time * NOISE2_SPEED) * NOISE2_SCALE
        );

        vec2 position = vec2(
          vUv - vec2(CENTER_X + noise, CENTER_Y + noise2)
        ) * GRADIENT_DISTANCE;

        position.x *= aspect * ASPECT_RATIO;

        float distance = smoothstep(0.0, 1.0, length(position));

        float baseHue = HUE_BASE;
        vec3 color1 = hsl2rgb(fract(baseHue + 0.88), 0.80, 0.72); // center
        vec3 color2 = hsl2rgb(fract(baseHue + 0.89), 0.46, 0.30); // middle
        vec3 color3 = hsl2rgb(fract(baseHue + 0.63), 0.08, 0.18); // outer
        vec3 color = mix3(color1, color2, color3, 0.4, distance);

        gl_FragColor = vec4(color, 1.0);
      }
    `,

    depth: {
      enable: false
    }

  })
}
