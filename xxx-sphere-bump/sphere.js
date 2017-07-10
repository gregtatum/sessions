const createIcosphere = require('icosphere')
const glsl = require('glslify')
const angleNormals = require('angle-normals')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')

module.exports = function (regl) {
  const icosphere = createIcosphere(3)
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
      varying vec3 vCameraDirection, vNormal;
      varying vec2 vUv;
      varying mat3 vNormalBasis;

      #pragma glslify: transpose = require(glsl-transpose)

      void main() {
        // Spherical mapping.
        vUv = vec2(
          atan(position.z, position.x),
          position.y
        );
        vNormal = normal;
        // Matrix to transform something from world space to normal space.
        vNormalBasis = mat3(
          tangent.x, tangent.y, tangent.z,
          binormal.x, binormal.y, binormal.z,
          normal.x, normal.y, normal.z
        );

        vec4 worldPosition = model * vec4(position, 1.0);
        vCameraDirection = cameraPosition - worldPosition.xyz;
        gl_Position = projView * worldPosition;
      }
    `,
    frag: glsl`
      precision mediump float;
      uniform vec3 light0, light1, light2;
      uniform vec3 lightColor0, lightColor1, lightColor2;
      uniform float time;
      varying vec3 vNormal, vCameraDirection;
      varying vec2 vUv;
      varying mat3 vNormalBasis;

      // An arbitrary height function.
      float computeHeight(vec2 coordinate) {
        float circle = cos(20.0 * coordinate.x) + sin(20.0 * coordinate.y + time * 5.0);
        float circle2 = cos(200.0 * coordinate.x) + sin(200.0 * coordinate.y);
        return 0.005 * (
          sin(10.0 * coordinate.y + time * 22.2) +
          sin(2.0 * coordinate.y + time * 10.2)
        )
        + 0.01 * circle * circle
        + 0.0002 * circle2 * circle2;
      }

      vec2 parallax(vec2 coordinate) {
        float height = computeHeight(coordinate);
        // Transform the camera direction vector to be in the same space as the normal.
        vec3 cameraDirection = vNormalBasis * normalize(vCameraDirection);

        // Move the coordinate according to the xy vector components of the
        // camera direction, creating a parallax effect.
        return coordinate + height * cameraDirection.xy;
      }

      vec3 bumpNormal(vec2 coordinateIn) {
        vec2 coordinate = parallax(coordinateIn);
        float epsilon = 0.001;
        vec3 a = vec3(0.0, 0.0, computeHeight(coordinate));
        vec3 b = vec3(epsilon, 0.0, computeHeight(coordinate + vec2(epsilon, 0.0)));
        vec3 c = vec3(0.0, epsilon, computeHeight(coordinate + vec2(0.0, epsilon)));
        vec3 heightNormal = normalize(cross(b - a, c - a));
        return vNormalBasis * heightNormal;
      }

      void main() {
        // vec3 normal = mix(bumpNormal(vUv), vNormal, sin(time) * 0.5 + 0.5);
        vec3 normal = bumpNormal(vUv);

        vec3 ambient = vec3(0.0, 0.1, 0.1);
        vec3 color = vec3(
          lightColor0 * max(0.0, dot(light0, normal)) +
          lightColor1 * max(0.0, dot(light1, normal)) +
          lightColor2 * max(0.0, dot(light2, normal))
        );
        gl_FragColor = vec4(ambient + color, 1.0);
      }
    `,
    attributes: {
      position: icosphere.positions,
      normal: normals,
      tangent: tangents,
      binormal: binormals
    },
    uniforms: {
      time: ({time}) => time,
      model: mat4.scale([],
        mat4.translate([], mat4.identity([]), [0, 0, 0]),
        [0.2, 0.2, 0.2]
      )
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
