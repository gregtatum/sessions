const createBox = require('geo-3d-box')
const glsl = require('glslify')
const vec3 = require('gl-vec3')
const BOX_SIZE = 0.02
const BOX_MARGIN = 0.001
const BOX_MULTIPLIER = 22

module.exports = function (regl) {
  const box = createBox({size: [BOX_SIZE, BOX_SIZE, BOX_SIZE ]})
  const buffers = createBuffers(regl, box)

  return regl({
    vert: glsl`
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
      precision mediump float;
      attribute float occluded;
      attribute vec3 normal, position, center;
      uniform float time;
      uniform mat4 model, view, projection;
      varying vec3 vPosition, vNormal;
      varying float vOccluded;

      float WAVE_PERIOD_1 = 3.0;
      float WAVE_PERIOD_2 = 8.0;
      float WAVE_SPEED_1 = 0.3;
      float WAVE_SPEED_2 = 0.85;

      float wave(float t, vec3 position) {
        float noise1 = snoise4(vec4(position * WAVE_PERIOD_1, t * WAVE_SPEED_1)) * 0.5 + 0.5;
        float noise2 = snoise4(vec4(position * WAVE_PERIOD_2, 100.0 - t * WAVE_SPEED_2));

        float noise = noise1 * noise1 + noise2 * 0.2;
        return clamp(0.0, 1.0, 1.0 - noise * 3.0);
      }

      void main() {
        vPosition = (position - center) * wave(time, center) + center;
        vNormal = normal;
        vOccluded = mix(0.2, 1.0, occluded);
        gl_Position = projection * view * vec4(vPosition, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: cookTorranceSpec = require(glsl-specular-cook-torrance)
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      uniform vec3 cameraPosition;
      uniform vec3 lightPositions[3];
      uniform vec3 lightColors[3];
      uniform float roughness, fresnel, time;
      varying vec3 vPosition, vNormal;
      varying float vOccluded;

      void main() {
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        vec3 normal = normalize(vNormal);

        float hue = mod(sin(time) * 0.05 + mix(0.5, 1.03, vOccluded), 1.0);
        float saturation = 0.7;
        float lightness = mix(0.0, 0.5, vOccluded);

        vec3 materialColor = hsl2rgb(hue, saturation, lightness);
        vec3 ambientColor = hsl2rgb(hue, saturation, 0.2) + vec3(0.05, 0.0, 0.0);

        vec3 accumulatedColor = vec3(0.0);
        for (int i = 0; i < 3; i++) {
          accumulatedColor += materialColor * lightColors[i] * cookTorranceSpec(
            normalize(lightPositions[i] - vPosition),
            viewDirection,
            normal,
            roughness,
            fresnel
          );
        }

        gl_FragColor = vec4(ambientColor + accumulatedColor, 1.0);
      }
    `,
    attributes: {
      position: buffers.positions,
      normal: buffers.normals,
      center: buffers.centers,
      occluded: buffers.occluded
    },
    uniforms: {
      roughness: 1.0,
      fresnel: 1,
      'lightPositions[0]': [0, 1.5, 1.5],
      'lightPositions[1]': [-0.5, 1.5, 0],
      'lightPositions[2]': [0.5, -1.5, 0],
      'lightColors[0]': [1, 1, 1].map(i => i + 1.5),
      'lightColors[1]': [1, 1, 1].map(i => i + 1.5),
      'lightColors[2]': [1, 1, 1].map(i => i + 1.5)
    },
    elements: buffers.elements
  })
}

function createBuffers(regl, {positions, normals, cells}) {
  const positionsArray = new Float32Array(positions.length * Math.pow(BOX_MULTIPLIER, 3) * 3)
  const normalsArray = new Float32Array(positionsArray.length)
  const centersArray = new Float32Array(positionsArray.length)
  const occludedArray = new Float32Array(positionsArray.length / 3)
  const elementsArray = new Uint32Array(cells.length * Math.pow(BOX_MULTIPLIER, 3) * 3)
  const centerOffset = -BOX_MULTIPLIER * (BOX_SIZE + BOX_MARGIN) / 2

  const position = [0, 0, 0]
  const origin = [0, 0, 0]
  const normal = [0, 0, 0]
  const inverseLength = 1 / Math.pow(2, 1/3)
  const angleTurn = Math.PI * 0.25

  for (let i = 0; i < BOX_MULTIPLIER; i++) {
    for (let j = 0; j < BOX_MULTIPLIER; j++) {
      for (let k = 0; k < BOX_MULTIPLIER; k++) {
        const offset = (
          i * BOX_MULTIPLIER * BOX_MULTIPLIER +
          j * BOX_MULTIPLIER +
          k
        )

        const positionOffset = offset * positions.length * 3
        for (let l = 0; l < positions.length; l++) {
          const gridOffsetX = centerOffset + i * (BOX_SIZE + BOX_MARGIN)
          const gridOffsetY = centerOffset + j * (BOX_SIZE + BOX_MARGIN)
          const gridOffsetZ = centerOffset + k * (BOX_SIZE + BOX_MARGIN)
          vec3.copy(position, positions[l])
          vec3.copy(normal, normals[l])

          if ((i === 0 || i === BOX_MULTIPLIER - 1) && (j === 0 || j === BOX_MULTIPLIER - 1)) {
            vec3.rotateZ(position, position, origin, angleTurn)
            vec3.rotateZ(normal, normal, origin, angleTurn)
            vec3.scale(position, position, inverseLength)
          }
          if ((i === 0 || i === BOX_MULTIPLIER - 1) && (k === 0 || k === BOX_MULTIPLIER - 1)) {
            vec3.rotateY(position, position, origin, angleTurn)
            vec3.rotateY(normal, normal, origin, angleTurn)
            vec3.scale(position, position, inverseLength)
          }
          if ((j === 0 || j === BOX_MULTIPLIER - 1) && (k === 0 || k === BOX_MULTIPLIER - 1)) {
            vec3.rotateX(position, position, origin, angleTurn)
            vec3.rotateY(normal, normal, origin, angleTurn)
            vec3.scale(position, position, inverseLength)
          }
          positionsArray[positionOffset + l * 3 + 0] = position[0] + gridOffsetX
          positionsArray[positionOffset + l * 3 + 1] = position[1] + gridOffsetY
          positionsArray[positionOffset + l * 3 + 2] = position[2] + gridOffsetZ
          normalsArray[positionOffset + l * 3 + 0] = normal[0]
          normalsArray[positionOffset + l * 3 + 1] = normal[1]
          normalsArray[positionOffset + l * 3 + 2] = normal[2]
          centersArray[positionOffset + l * 3 + 0] = gridOffsetX
          centersArray[positionOffset + l * 3 + 1] = gridOffsetY
          centersArray[positionOffset + l * 3 + 2] = gridOffsetZ
          occludedArray[offset * positions.length + l] = Math.pow(Math.max(
            Math.abs(i / BOX_MULTIPLIER - 0.5) * 2,
            Math.abs(j / BOX_MULTIPLIER - 0.5) * 2,
            Math.abs(k / BOX_MULTIPLIER - 0.5) * 2
          ), 3)
        }

        const elementOffset = offset * cells.length * 3
        for (let l = 0; l < cells.length; l++) {
          elementsArray[elementOffset + l * 3 + 0] = cells[l][0] + positionOffset / 3
          elementsArray[elementOffset + l * 3 + 1] = cells[l][1] + positionOffset / 3
          elementsArray[elementOffset + l * 3 + 2] = cells[l][2] + positionOffset / 3
        }
      }
    }
  }

  return {
    positions: regl.buffer(positionsArray),
    normals: regl.buffer(normalsArray),
    centers: regl.buffer(centersArray),
    occluded: regl.buffer(occludedArray),
    elements: regl.elements(elementsArray),
  }
}
