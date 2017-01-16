const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
const resl = require('resl')
const glsl = require('glslify')
const createIcosphere = require('icosphere')
const angleNormals = require('angle-normals')

module.exports = function (regl) {
  const envmap = regl.texture()
  const icosphere = createIcosphere(5)
  const {
    tangents,
    binormals,
    normals
  } = calculateTBN(angleNormals(icosphere.cells, icosphere.positions))

  const drawOrb = regl({
    vert: glsl`
      precision mediump float;
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
      #pragma glslify: rotateY = require(glsl-y-rotate/rotateY)
      attribute vec3 position, normal, binormal, tangent;
      uniform mat4 projection, view, invView, model;
      uniform float time;
      varying vec3 vReflectDir, vPosition, vNormal;

      float MODEL_PERIOD = 3.0;
      float EPSILON = 0.001;

      vec3 doModel(vec3 pos) {
        float rawNoise = snoise4(vec4(MODEL_PERIOD * pos, time));
        float noise = mix(0.8, 1.0, max(0.4, rawNoise * 0.5 + 0.5));

        return pos * noise;
      }

      vec3 calculateNormal(vec3 pos) {
        vec3 tangent = normalize(doModel(pos + tangent * EPSILON) - pos);
        vec3 binormal = normalize(doModel(pos + binormal * EPSILON) - pos);
        return cross(tangent, binormal);
      }

      void main() {
        vec3 position2 = doModel(position);
        vec4 modelPosition = model * vec4(position2, 1);
        vec3 eye = normalize(modelPosition.xyz - invView[3].xyz / invView[3].w);
        vReflectDir = reflect(eye, normal);
        vPosition = position2;
        vNormal = calculateNormal(position2);

        gl_Position = projection * view * modelPosition;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
      #pragma glslify: rotate = require(glsl-y-rotate)
      uniform sampler2D envmap;
      uniform float time;
      varying vec3 vReflectDir, vPosition, vNormal;

      #define PI ${Math.PI}

      vec4 lookupEnv (vec3 direction) {
        float lat = atan(direction.z, direction.x);
        float lon = acos(direction.y / length(direction));
        return texture2D(envmap, vec2(
          0.5 + lat / (2.0 * PI),
          lon / PI));
      }

      float FACET_SIZE = 10.0;
      float FACET_RANGE = 1.0;

      void main () {

        vec2 reflect1 = rotate(FACET_RANGE * snoise4(vec4(FACET_SIZE * vPosition, 100.0))) * vReflectDir.xy;
        vec2 reflect2 = rotate(FACET_RANGE * snoise4(vec4(FACET_SIZE * vPosition, 200.0))) * vReflectDir.xz;
        vec2 reflect3 = rotate(FACET_RANGE * snoise4(vec4(FACET_SIZE * vPosition, 300.0))) * vReflectDir.yz;
        vec2 reflect4 = rotate(FACET_RANGE * snoise4(vec4(FACET_SIZE * vPosition, 400.0))) * vReflectDir.xy;
        vec2 reflect5 = rotate(FACET_RANGE * snoise4(vec4(FACET_SIZE * vPosition, 500.0))) * vReflectDir.xz;
        vec2 reflect6 = rotate(FACET_RANGE * snoise4(vec4(FACET_SIZE * vPosition, 600.0))) * vReflectDir.yz;

        vec4 reflectance = (
          lookupEnv(vec3(reflect1.x, reflect1.y, vReflectDir.z)) +
          lookupEnv(vec3(reflect2.x, vReflectDir.z, reflect2.y)) +
          lookupEnv(vec3(vReflectDir.z, reflect3.x, reflect3.y)) +
          lookupEnv(vec3(reflect4.x, reflect4.y, vReflectDir.z)) +
          lookupEnv(vec3(reflect5.x, vReflectDir.z, reflect5.y)) +
          lookupEnv(vec3(vReflectDir.z, reflect6.x, reflect6.y))
        ) * 0.166666;

        vec3 baseColor = vec3(1.0, 0.5, 0.5);
        vec3 lambert = vec3(1.0, 0.8, 0.8) * max(0.4, dot(normalize(vec3(1, 1, 0)), vNormal));

        gl_FragColor = vec4(lambert * baseColor * reflectance.xyz, 1.0);
      }
    `,
    attributes: {
      position: icosphere.positions,
      normal: normals,
      tangent: tangents,
      binormal: binormals
    },
    uniforms: {
      // model: ({time}) => mat4.scale([], mat4.rotateY([], mat4.identity([]), time), [0.02, 0.02, 0.02]),
      model: mat4.translate([], mat4.scale([], mat4.identity([]), [0.2, 0.2, 0.2]), [0, 0, 0]),
      envmap: envmap
    },
    elements: icosphere.cells
  })

  const manifest = {
    envmap: {
      type: 'image',
      stream: true,
      src: '/009/ogd-oregon-360.jpg',
      parser: envmap
    }
  }

  const draw = () => {
    drawOrb()
  }

  return new Promise(resolve => {
    resl({ manifest, onDone: () => resolve(draw) })
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
