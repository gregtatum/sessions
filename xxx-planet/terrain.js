const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createPlane = require('primitive-plane')
const { sin, cos, PI, abs } = Math

module.exports = function (regl) {
  const plane = createPlane(
    // size
    1, 1,
    // subdivisions
    250, 250
  )
  let sumX = 0
  let sumY = 0
  let sumZ = 0

  plane.positions.forEach((position, index) => {
    const [u, v] = plane.uvs[index]
    const [x, z, y] = position

    // Make the terrain's X and Z range: [-0.5, 0.5]
    position[0] = x
    position[1] = (sin(x * 100) + sin(z * 100)) * 0.1
    position[2] = z
  })

  return regl({
    vert: glsl`
      precision highp float;
      attribute vec3 normal, position;
      attribute vec2 uv;
      uniform mat4 model, projView;
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projView * model * vec4(position * 0.1, 1.0);
      }
    `,
    frag: glsl`
      precision highp float;
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      varying vec3 vPosition;

      void main() {

        gl_FragColor = vec4(hsl2rgb(0.5, 0.5, vPosition.y + 0.2), 1.0);
      }
    `,
    attributes: {
      position: plane.positions,
      uv: plane.uvs
    },
    elements: plane.cells,
    uniforms: {
      model: mat4.identity([])
    },
  })
}
