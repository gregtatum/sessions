const glsl = require('glslify')

const DUST_COUNT = 2000

module.exports = function dustDrawer (regl) {
  return regl({
    vert: glsl`
      precision highp float;
      #pragma glslify: noise = require('glsl-noise/simplex/2d')
      attribute vec4 position;
      uniform float time, viewportHeight, aspectRatio;
      uniform mat4 projection, view;
      varying float speed, vParticleId;
      varying vec3 vColor;

      float POINT_SIZE = 0.02;
      float POINT_SPEED = -0.01;
      float STAGE_SIZE = 1.1;
      float HALF_STAGE_SIZE = STAGE_SIZE * 0.5;
      float particleRatioXY = 1.5;

      void main() {
        vParticleId = position.x;
        float uniqueNumberA = position.y;
        float uniqueNumberB = position.z;
        float uniqueNumberC = position.w;
        speed = (3.0 + mod(vParticleId, 7.0)) * 0.1;
        speed *= speed;
        vColor = vec3(0.1, 0.1, 0.1);

        float x = aspectRatio * (HALF_STAGE_SIZE - STAGE_SIZE * uniqueNumberA)
          + 0.02 * noise(vec2(vParticleId, time * 0.1));
        float z = aspectRatio * (HALF_STAGE_SIZE - STAGE_SIZE * uniqueNumberC)
          + 0.02 * noise(vec2(vParticleId + 23.0, time * 0.1));

        x = mod(x + time * POINT_SPEED * particleRatioXY, STAGE_SIZE) - HALF_STAGE_SIZE;

        float y = mod(
          POINT_SPEED * (1.0 / particleRatioXY) * speed * time + uniqueNumberB,
          STAGE_SIZE
        ) - HALF_STAGE_SIZE;

        gl_Position = projection * view * vec4(x, y, z, 1.0);
        gl_PointSize = POINT_SIZE * speed * viewportHeight * (2.0 - gl_Position.z);
      }
    `,
    frag: glsl`
      precision highp float;
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      varying vec3 vColor;
      varying float vParticleId;
      uniform float time;

      void main() {
        float alpha = max(0.0, 5.5 * (0.5 - length(gl_PointCoord - vec2(0.5)))
          * (snoise3(vec3(gl_PointCoord, vParticleId * 100.0 + time * 0.25)) * 0.5 + 0.5));
        gl_FragColor = vec4(alpha * alpha * vColor, 1.0);
      }
    `,
    uniforms: {
      time: ({time}) => time,
      aspectRatio: ({viewportHeight, viewportWidth}) => viewportWidth / viewportHeight,
      viewportHeight: ({viewportHeight}) => viewportHeight
    },
    attributes: {
      position: fill(DUST_COUNT, i => [i, Math.random(), Math.random(), Math.random()])
    },
    depth: {
      enable: true
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one',
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
