const createIcosphere = require('icosphere')
const glsl = require('glslify')
const angleNormals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')

module.exports = function (regl, texture) {
  const icosphere = createIcosphere(5)
  const squashFactor = window.innerHeight / window.innerWidth
  icosphere.positions.forEach(p => {
    p[1] *= squashFactor
  })
  const {
    tangents,
    binormals,
    normals
  } = calculateTBN(angleNormals(icosphere.cells, icosphere.positions))

  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, binormal, tangent, position;
      uniform mat4 model, projView;
      uniform mat3 viewNormal;
      uniform vec3 cameraPosition;
      uniform sampler2D texture;
      uniform float squashFactor, neighborX, neighborY;
      varying vec3 vCameraDirection, vCameraPosition, vNormal;
      varying vec2 vUv;
      varying mat3 vNormalBasis;

      #pragma glslify: transpose = require(glsl-transpose)

      // An arbitrary height function.
      float computeHeight(vec2 coordinate) {
        vec4 particles = texture2D(texture, coordinate);
        float a = particles.x;
        float b = particles.y;
        return -0.05 * pow((particles.x - particles.y), 0.5);
      }

      void main() {
        // Spherical mapping.
        vUv = vec2(
          2.0 * atan(position.z, position.x) / 6.283185307179586,
          (position.y * 0.5 / squashFactor + 0.5)
        );
        vNormal = normal;
        // Matrix to transform something from world space to normal space.
        vNormalBasis = mat3(
          tangent.x, tangent.y, tangent.z,
          binormal.x, binormal.y, binormal.z,
          normal.x, normal.y, normal.z
        );

        // Smooth this noisy thing out.
        float height = 1.0 + 0.04 * (
          computeHeight(vUv) +
          computeHeight(vUv + vec2(neighborX, 0.0)) +
          computeHeight(vUv + vec2(-neighborX, 0.0)) +
          computeHeight(vUv + vec2(0.0, neighborY)) +
          computeHeight(vUv + vec2(0.0, -neighborY)) +
          computeHeight(vUv + vec2(2.5 * neighborX, 0.0)) +
          computeHeight(vUv + vec2(-2.5 * neighborX, 0.0)) +
          computeHeight(vUv + vec2(0.0, 2.5 * neighborY)) +
          computeHeight(vUv + vec2(0.0, -2.5 * neighborY)) +
          computeHeight(vUv + vec2(5.0 * neighborX, 0.0)) +
          computeHeight(vUv + vec2(-5.0 * neighborX, 0.0)) +
          computeHeight(vUv + vec2(0.0, 5.0 * neighborY)) +
          computeHeight(vUv + vec2(0.0, -5.0 * neighborY)) +
          computeHeight(vUv + vec2(10.0 * neighborX, 0.0)) +
          computeHeight(vUv + vec2(-10.0 * neighborX, 0.0)) +
          computeHeight(vUv + vec2(0.0, 10.0 * neighborY)) +
          computeHeight(vUv + vec2(0.0, -10.0 * neighborY))
        );

        vec4 worldPosition = model * vec4(position * height, 1.0);
        vCameraPosition = cameraPosition;
        vCameraDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projView * worldPosition;
      }
    `,
    frag: glsl`
      precision mediump float;
      uniform vec3 light0, light1, light2;
      uniform vec3 lightColor0, lightColor1, lightColor2;
      uniform float neighborX, neighborY, viewportWidth, viewportHeight, time;
      uniform sampler2D texture;
      varying vec3 vNormal, vCameraDirection, vCameraPosition;
      varying vec2 vUv;
      varying mat3 vNormalBasis;

      // An arbitrary height function.
      float computeHeight(vec2 coordinate) {
        vec4 particles = texture2D(texture, coordinate);
        float a = particles.x;
        float b = particles.y;
        return -0.01 * pow((particles.x - particles.y), 0.5);
      }

      vec2 parallax(vec2 coordinate) {
        float height = computeHeight(coordinate);
        // Transform the camera direction vector to be in the same space as the normal.
        vec3 cameraDirection = vNormalBasis * normalize(vCameraDirection);

        // Move the coordinate according to the xy vector components of the
        // camera direction, creating a parallax effect.
        return coordinate + height * cameraDirection.xy;
      }

      float NORMAL_DISTANCE = 5.0;

      vec3 getPosition(vec2 uv) {
        vec4 particles = texture2D(texture, uv);
        return vec3(
          uv.x,
          uv.y,
          computeHeight(uv)
        );
      }

      vec3 getNormal(vec3 position, vec2 uv) {
        // Smooth out the normal by averaging several positions together
        vec3 a = (
          0.5 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE, 0.0)) +
          0.25 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE * 2.0, 0.0)) +
          0.125 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE * 2.0, neighborY * NORMAL_DISTANCE)) +
          0.125 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE * 2.0, -neighborY * NORMAL_DISTANCE))
        );
        vec3 b = (
          0.5 * getPosition(uv + vec2(0.0, neighborY * NORMAL_DISTANCE)) +
          0.25 * getPosition(uv + vec2(0.0, neighborY * NORMAL_DISTANCE * 2.0)) +
          0.125 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE, neighborY * NORMAL_DISTANCE * 2.0)) +
          0.125 * getPosition(uv + vec2(-neighborX * NORMAL_DISTANCE, neighborY * NORMAL_DISTANCE * 2.0))
        );
        return normalize(cross(
          normalize(a - position),
          normalize(b - position)
        ));
      }

      vec3 bumpNormal(vec2 coordinate) {
        vec3 position = getPosition(coordinate);
        vec3 heightNormal = getNormal(position, coordinate);
        return vNormalBasis * heightNormal;
      }

      void main() {
        vec2 uv = parallax(vUv);
        vec3 normal = bumpNormal(uv);
        vec4 particles = texture2D(texture, uv);
        float a = particles.x;
        float b = particles.y;

        vec3 ambient = vec3(0.0, 0.1, 0.1);
        vec3 diffuse = vec3(
          lightColor0 * max(0.0, dot(light0, normal)) +
          lightColor1 * max(0.0, dot(light1, normal)) +
          lightColor2 * max(0.0, dot(light2, normal))
        );

        float center = max(0.0, dot(normal, normalize(vCameraPosition)));
        float rim = 1.0 - center;
        rim = 0.6 * rim * rim * rim;

        float pulse = 0.5 * (
          (cos(6.0 * time) + 1.0) +
          (cos(3.0 + 6.0 * time) + 1.0)
        );

        vec3 troughColor = vec3(0.1, 0.3, 0.25)
          + pulse * pulse * vec3(0.52, 0.1, 0.0) * center * center;
        vec3 hillColor = vec3(0.2, 0.7, 0.8);
        vec3 base =
          (1.0 - a) * hillColor
          + a * troughColor;

        gl_FragColor = vec4(vec3(rim) + base * diffuse, 1.0);
      }
    `,
    attributes: {
      position: icosphere.positions,
      normal: normals,
      tangent: tangents,
      binormal: binormals
    },
    uniforms: {
      texture,
      squashFactor,
      time: ({time}) => time,
      model: mat4.scale([],
        mat4.translate([], mat4.identity([]), [0, 0, 0]),
        [0.4, 0.4, 0.4]
      ),
      viewportWidth: regl.context('viewportWidth'),
      viewportHeight: regl.context('viewportHeight'),
      neighborX: ({viewportWidth}) => 1 / viewportWidth,
      neighborY: ({viewportHeight}) => 1 / viewportHeight,
    },
    elements: icosphere.cells
  })
}

const axisA = [0, 0, 1]
const axisB = vec3.normalize([], [0, 0.001, 1])

function calculateTBN (normals) {
  const tangents = normals.map(calculateTangent)
  const binormals = normals.map((normal, i) => calculateBinormal(normal, tangents[i]))
  return {
    normals,
    tangents,
    binormals
  }
}

function calculateTangent (normal) {
  const tangent = vec3.cross([], axisA, normal)
  return typeof tangent[0] === 'number'
    ? tangent
    : vec3.cross(tangent, axisB, normal)
}

function calculateBinormal (normal, tangent) {
  return vec3.cross([], normal, tangent)
}
