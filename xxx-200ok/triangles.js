const glsl = require('glslify')
const mat4 = require('gl-mat4')

module.exports = function(regl) {

  const count = 40
  const ratio = regl._gl.canvas.width / regl._gl.canvas.height
  const mesh = generateTriangles(count, ratio)

  return regl({
    vert: glsl`
      precision highp float;
      uniform mat4 model, view, projection;
      attribute vec2 position, center;
      varying vec2 vCenter;
      uniform float time;

      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/3d)
      #pragma glslify: rotateZ = require(glsl-y-rotate/rotateZ)

      float TAU = 6.283185307179586;

      vec2 rotate2d(vec2 p, float theta) {
        float cosTheta = cos(theta);
        float sinTheta = sin(theta);
        return vec2(
          p.x * cosTheta - p.y * sinTheta,
          p.x * sinTheta + p.y * cosTheta
        );
      }

      void main() {
        vCenter = center;
        vec2 centerMoving = center + vec2(0.0, time * 0.2);
        float noiseValue1 = snoise3(vec3(centerMoving, time * 0.2));
        float generalNoise = 0.15 * noiseValue1;
        float amountOfNoiseApplied = sin(time * 0.5);
        float triangleSize = mix(0.75, 1.0, snoise3(vec3(centerMoving * 2.0, time * 0.2)));
        float rotation = TAU * pow(0.5 + 0.5 * noiseValue1, 2.0);

        vec2 positionSized = rotate2d((position - center) * triangleSize, rotation) + center;
        vec3 finalPosition = vec3(
          positionSized,
          1.0 * generalNoise * amountOfNoiseApplied
        );
        gl_Position = projection * view * model *
          vec4(
            finalPosition,
            1.0
          );
      }
    `,
    frag: glsl`
      precision highp float;
      varying vec2 vCenter;
      uniform float time;
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)

      float BRIGHT_SPEED = 2.0;

      void main() {
        float waveVariation = sin(vCenter.x * 10.0) * 0.1;
        float brightness = sin(waveVariation + time * BRIGHT_SPEED + vCenter.y * 2.0);
        brightness = mix(1.0, 2.0, 0.5 + 0.5 * pow(brightness, 3.0));
        float noise = mix(0.75, 1.0, snoise2(vCenter * 100.0));
        vec3 color = vec3(vCenter, 0.5) * noise * brightness;
        color = mix(color, vec3(0.1), pow(min(1.0, length(vCenter * 1.3)), 2.0));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      center: mesh.centers,
    },
    uniforms: {
      model: mat4.identity([])
      // model: ({viewportHeight, viewportWidth}) => {
      //   const size = 0.9
      //   const width = size * viewportWidth / viewportHeight
      //   const height = size
      //   return mat4.scale([], mat4.identity([]), [
      //     width, height, height
      //   ])
      // }
    },
    count: mesh.positions.length
  })
}

/**
 *       b          a-----c  higher
 *      / \    or    \   /
 *     /   \          \ /
 *    a-----c          b     lower
*/
function generateTriangles (count, ratio) {
  const positions = []
  const centers = []
  const height = count
  const width = ratio * height
  const segmentWidth = ratio / width
  const segmentHeight = 1 / height
  const midpointHeight = segmentHeight * Math.sqrt(3) / 4
  const halfWidth = 0.5 * ratio
  const halfHeight = 0.5
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const flipped = ((i + j) % 2) == 1
      const a = i * segmentWidth - halfWidth
      const b = (i + 1) * segmentWidth - halfWidth
      const c = (i + 2) * segmentWidth - halfWidth
      const lower = j * segmentHeight - halfHeight
      const higher = lower + segmentHeight

      positions.push([a, flipped ? lower : higher])
      positions.push([b, flipped ? higher : lower])
      positions.push([c, flipped ? lower : higher])

      const center = [(a + c) / 2, lower + midpointHeight]
      centers.push(center)
      centers.push(center)
      centers.push(center)
    }
  }
  return { positions, centers }
}
