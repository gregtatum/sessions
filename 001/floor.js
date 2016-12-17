const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createPlane = require('primitive-plane')
const TAU = 6.283185307179586

module.exports = function (regl) {
  const plane = createPlane(
    // size
    1, 1,
    // subdivisions
    2, 2
  )

  return regl({
    frag: `
      precision mediump float;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main () {
        float brightness = 0.5 * min(1.0,
          1.5 * (1.0 - length(2.0 * vUv - vec2(1.0)))
        );
        gl_FragColor = vec4(vec3(vUv, 1.0) * brightness, 1.0);
      }`,
    vert: glsl`
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      precision mediump float;
      uniform mat4 proj;
      uniform mat4 model;
      uniform mat4 view;
      uniform float time;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      varying vec2 vUv;
      varying vec3 vNormal;

      float NOISE_SPEED = 0.5;
      float NOISE_PERIOD = 3.0;
      float NOISE_AMPLITUDE = 0.05;

      void main () {
        vNormal = normal;
        vUv = uv;
        vec3 position2 = position;
        position2.z = 0.015;
        gl_Position = proj * view * model * vec4(position2, 1.0);
      }`,
    attributes: {
      position: plane.positions,
      normal: plane.normals,
      uv: plane.uvs
    },
    elements: plane.cells,
    uniforms: {
      time: ({time}) => time,
      proj: ({viewportWidth, viewportHeight}) =>
        mat4.perspective([],
          TAU * 0.05,
          viewportWidth / viewportHeight,
          0.01,
          1000),
      model: mat4.rotateX([], mat4.identity([]), TAU * 0.25),
      view: mat4.lookAt([], [1, 0.5, 1], [0, 0, 0], [0, 1, 0])
    }
  })
}
