const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createPlane = require('primitive-plane')
const TAU = 6.283185307179586

module.exports = function (regl) {
  const plane = createPlane(
    // size
    1, 1,
    // subdivisions
    30, 30
  )

  plane.positions.forEach(position => {
    let [x, z, y] = position
    position[0] = x
    position[1] = y
    position[2] = z
  })

  return regl({
    frag: `
      precision mediump float;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main () {
        float brightness = min(1.0,
          1.5 * (1.0 - length(2.0 * vUv - vec2(1.0)))
        );
        gl_FragColor = vec4(vec3(vUv, 1.0) * brightness, 1.0);
      }`,
    vert: glsl`
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      precision mediump float;
      uniform mat4 projection, view;
      uniform float time;
      attribute vec3 position, normal;
      attribute vec2 uv;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main () {
        vNormal = normal;
        vUv = uv;
        gl_Position = projection * view * vec4(position, 1.0);
      }`,
    attributes: {
      position: plane.positions,
      normal: plane.normals,
      uv: plane.uvs
    },
    elements: plane.cells,
    uniforms: {
      time: ({time}) => time,
    },
    primitive: 'lines',
    lineWidth: Math.min(2 * window.devicePixelRatio, regl.limits.lineWidthDims[1])
  })
}
