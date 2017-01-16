const glsl = require('glslify')

const DUST_COUNT = 1000

module.exports = function dustDrawer (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      #pragma glslify: noise = require('glsl-noise/simplex/2d')
      attribute vec3 position;
      uniform float time, viewportHeight;
      varying float speed;

      float POINT_SIZE = 0.004;
      float POINT_SPEED = 0.012;
      
      void main() {
        float particleId = position.x;
        float uniqueNumberA = position.y;
        float uniqueNumberB = position.z;
        speed = (3.0 + mod(particleId, 7.0)) * 0.1;
        speed *= speed;
        float x = uniqueNumberA + 0.02 * noise(vec2(particleId, time * 0.1));
        float y = POINT_SPEED * speed * time + uniqueNumberB;

        gl_Position = vec4(
          // Mod the values to keep them on screen
          vec2(1.0) - vec2(2.0) * mod(vec2(x, y), vec2(1.0)),
          0.0, 1.0);
        gl_PointSize = POINT_SIZE * speed * viewportHeight;
      }
    `,
    frag: `
      precision mediump float;
      varying float speed;
      void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, mix(0.2, 0.4, speed));
      }
    `,
    uniforms: {
      time: ({time}) => time,
      viewportHeight: ({viewportHeight}) => viewportHeight
    },
    attributes: {
      position: fill(DUST_COUNT, i => [i, Math.random(), Math.random()])
    },
    depth: {
      enable: false
    },
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
      }
    },
    primitive: 'points',
    count: DUST_COUNT
  })
}

function fill (size, fn) {
  const array = Array(size)
  for (let i = 0; i < size; i++) {
    array[i] = fn(i)
  }
  return array
}
