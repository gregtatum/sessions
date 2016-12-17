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
  plane.cells.forEach(cell => {
    const [a, b, c] = cell
    cell[0] = b
    cell[1] = c
    cell[2] = a
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
        gl_FragColor = vec4(vec3(vUv, 1.0), brightness);
      }`,
    vert: glsl`
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      precision mediump float;
      uniform mat4 projection;
      uniform mat4 model;
      uniform mat4 view;
      uniform float time;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      varying vec2 vUv;
      varying vec3 vNormal;

      float JUMP_AMOUNT = 0.05;
      float JUMP_MOVEMENT_SPEED = 0.5;
      float JUMP_PERIOD = 5.0;
      float JUMP_CUTOFF = 0.7;

      void main () {
        vNormal = normal;
        vUv = uv;
        float jump = snoise2(vec2(
          time * JUMP_MOVEMENT_SPEED,
          position.x * JUMP_PERIOD
        ));
        vec3 position3 = position;
        if (jump > JUMP_CUTOFF) {
          position3.z += JUMP_AMOUNT;
        }

        gl_Position = projection * view * model * vec4(position3, 1.0);
      }`,
    attributes: {
      position: plane.positions,
      normal: plane.normals,
      uv: plane.uvs
    },
    elements: plane.cells,
    uniforms: {
      time: ({time}) => time,
      projection: (context, {projection}) => projection(context),
      view: (context, {view}) => view,
      model: mat4.rotateX([], mat4.identity([]), TAU * 0.25)
    },
    primitive: 'lines',
    lineWidth: Math.min(2 * window.devicePixelRatio, regl.limits.lineWidthDims[1]),
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    }
  })
}
