const createIcosphere = require('icosphere')
const angleNormals = require('angle-normals')
const mat4 = require('gl-mat4')
const glsl = require('glslify')

module.exports = function createDrawSphere (regl) {
  const icosphere = createIcosphere(3)

  return regl({
    vert: glsl`
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      uniform float time;
      varying vec3 vColor, vPosition, vNormal;

      void main() {
        vColor = hsl2rgb(0.01, 0.8, 0.5);
        vPosition = position;
        vNormal = normal;
        gl_Position = projection * view * model * vec4(position, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
      #pragma glslify: rotateX = require(glsl-y-rotate/rotateX)
      #pragma glslify: rotateY = require(glsl-y-rotate/rotateY)
      #pragma glslify: rotateZ = require(glsl-y-rotate/rotateZ)

      varying vec3 vColor, vPosition, vNormal;
      uniform float time;

      void main() {
        float noise1 = (0.5 * snoise4(vec4(
          (vPosition
            * rotateY(10.0 * sin(1.2 * vPosition.y + time * 0.5))
            * rotateX(1.0 * sin(2.2 * vPosition.x + time * 0.5))
          ),
          time * 1.0
        )) + 0.5);
        float edgeLight = 0.7 * (1.0 - dot(vec3(0.0, 0.0, 1.0), vNormal));
        vec3 color = edgeLight + vColor * mix(0.5, 2.0, noise1);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: icosphere.positions,
      normal: angleNormals(icosphere.cells, icosphere.positions)
    },
    uniforms: {
      time: ({time}) => time,
      model: (_, {center}) => mat4.scale([],
        mat4.translate([], mat4.identity([]), center),
        [0.18, 0.18, 0.18]
      )
    },
    elements: icosphere.cells,
    // primitive: 'lines'
  })
}
