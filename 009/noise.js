const glsl = require('glslify')
const vec3 = require('gl-vec3')

module.exports = function (regl) {
  const points = Array(500).fill().map((n, i) => {
    const point = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]
    const scale = 1 - Math.pow(Math.random(), 2)
    return vec3.scale(point, point, scale * 2.17)
  })

  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 position;
      attribute float size, id;
      uniform mat4 view, projection;
      uniform float overallSize, time;
      varying vec3 vColor;
      varying float vId;

      void main() {
        vId = id;
        vColor = vec3(0.15, 0.15, 0.12) * size * 0.2;
        vec3 position2 = mod(position + vec3(time * abs(position.z) * 0.05, 0.0, 0.0), vec3(1.0)) * 2.0 - 1.0;
        gl_Position = vec4(position2, 1.0);
        gl_PointSize = size * overallSize * (2.0 - gl_Position.z);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      varying vec3 vColor;
      varying float vId;
      uniform float time;

      void main() {
        float alpha = 2.5 * (0.5 - length(gl_PointCoord - vec2(0.5)))
          * (snoise3(vec3(gl_PointCoord, vId * 10.0 + time * 0.25)) * 0.5 + 0.5);
        gl_FragColor = vec4(alpha * alpha * vColor, 0.0);
      }
    `,
    attributes: {
      position: points,
      size: points.map(() => Math.random() + 0.5),
      id: points.map((n, i) => i)
    },
    uniforms: {
      overallSize: ({viewportHeight}) => viewportHeight / 100
    },
    primitive: 'points',
    count: points.length,
    depth: {
      enable: false
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'one',
        srcAlpha: 1,
        dstRGB: 'one',
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
