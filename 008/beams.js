const glsl = require('glslify')
const createBox = require('geo-3d-box')
const mat4 = require('gl-mat4')

const BOX_DEPTH_X = 2
const BOX_DEPTH_Y = 0
const BOX_DEPTH_Z = 5
const BOX_OFFSET_X = -1.0
const BOX_OFFSET_Y = 0.1
const BOX_OFFSET_Z = 0.0
const BOX_LENGTH = 0.35
const BOX_HEIGHT = 0.003
const BOX_WIDTH = 0.009

module.exports = function (regl) {
  const box = createBox({size: [
    BOX_WIDTH,
    BOX_HEIGHT,
    BOX_LENGTH
  ]})

  const a1 = []
  const a2 = []

  const drawBox = regl({
    attributes: {
      position: box.positions,
      normal: box.normals
    },
    uniforms: {
      time: ({time}) => time,
      id: (context, {id}) => id,
      scale: (context, {scale}) => scale,
      projection: (context, {projection}) => projection(context),
      view: (context, {view}) => view,
      model: ({time}, {position}) => {
        return mat4.translate(a1, mat4.identity(a2), [
          position[0],
          position[1],
          (position[2] + time) % BOX_DEPTH_Z - BOX_DEPTH_Z / 2
        ])
      }
    },
    vert: glsl`
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 model, view, projection;
      uniform float time;
      uniform float id;
      uniform float scale;
      varying vec3 vNormal;
      float JUMP_AMOUNT = 0.05;
      float JUMP_MOVEMENT_SPEED = 0.5;
      float JUMP_PERIOD = 2.0;
      float JUMP_CUTOFF = 0.0;

      void main () {
        vNormal = normal;

        float jump = snoise2(vec2(
          time * JUMP_MOVEMENT_SPEED,
          id * JUMP_PERIOD
        ));
        vec3 position3 = position;
        if (jump > JUMP_CUTOFF) {
          position3.x += JUMP_AMOUNT;
        }
        position3.z *= scale;

        gl_Position = projection * view * model * vec4(position3, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vNormal;
      void main () {
        float brightness = dot(vNormal, vec3(0.0, 1.0, 0.0));
        vec3 color = vec3(0.8, 0.0, 0.2);
        gl_FragColor = vec4(
          mix(brightness * color, color, 0.8),
          1.0
        );
      }
    `,
    elements: box.cells
  })

  const props = Array(30).fill(0).map((n, i) => (
    {
      position: [
        Math.random() * BOX_DEPTH_X + BOX_OFFSET_X,
        Math.random() * BOX_DEPTH_Y + BOX_OFFSET_Y,
        Math.random() * BOX_DEPTH_Z + BOX_OFFSET_Z
      ],
      id: i,
      scale: i % 3 + 1
    }
  ))

  return (camera) => {
    props.forEach(prop => {
      Object.assign(prop, camera)
    })
    drawBox(props)
  }
}
