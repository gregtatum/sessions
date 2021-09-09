const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createPlane = require('primitive-plane')
const lights = Array(2).fill().map((n, i) => i)

module.exports = function (regl) {
  const plane = createPlane(
    // size
    1, 1,
    // subdivisions
    100, 100
  )
  plane.positions.forEach(position => {
    const [x, z, y] = position
    position[0] = x + 0.5
    position[1] = y
    position[2] = z + 0.5
  })

  return regl({
    vert: glsl`
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      precision highp float;
      uniform mat4 projView;
      uniform float time;
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;
      varying vec3 vNormal, vPosition;

      vec2 TERRAIN_OFFSET_POSITION = vec2(10.0);
      float LARGE_TERRAIN_HEIGHT = 0.3;
      float LARGE_TERRAIN_SCALE = 2.0;
      float SMALL_TERRAIN_HEIGHT = 0.05;
      float SMALL_TERRAIN_SCALE = 7.0;
      float SMALLEST_TERRAIN_HEIGHT = 0.02;
      float SMALLEST_TERRAIN_SCALE = 13.0;
      float TERRAIN_SPEED = 0.02;
      float EPSILON = 0.01;

      vec3 terrain(vec2 coordinate) {
        float x = coordinate.x - 0.5;
        float z = coordinate.y - 0.5;
        float y = -length(x * x + z * z) + 1.0;

        vec3 overallScale = vec3(1.5, 0.5, 1.5);
        float noiseScale = 5.0;
        float noiseMagnitude = 0.9;
        float noise = 0.5 + 0.5 * snoise2(coordinate * noiseScale);
        float noise2 = 0.9 + 0.1 * snoise2(coordinate * noiseScale * 4.0);

        return (
          mix(noise * noise2, 1.0, noiseMagnitude) *
          vec3(x, y, z) *
          overallScale
        ) - vec3(0.0, 0.6, 0.0);
      }

      vec3 calculateNormal(vec3 cartesian, vec2 coordinate) {
        vec3 tangent = normalize(terrain(vec2(coordinate.x, coordinate.y + EPSILON)) - cartesian);
        vec3 binormal = normalize(terrain(vec2(coordinate.x + EPSILON, coordinate.y)) - cartesian);
        return cross(tangent, binormal);
      }

      void main () {
        vUv = uv;
        vec2 coordinate = position.xz;
        vec3 cartesian = terrain(coordinate);
        vNormal = calculateNormal(cartesian, coordinate);
        vPosition = cartesian;
        gl_Position = projView * vec4(cartesian, 1.0);
      }
    `,
    frag: glsl`
      precision highp float;
      #pragma glslify: toGamma = require('glsl-gamma/out')
      #pragma glslify: rotateX = require(glsl-y-rotate/rotateX)
      #pragma glslify: rotateY = require(glsl-y-rotate/rotateY)
      #pragma glslify: rotateZ = require(glsl-y-rotate/rotateZ)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)

      uniform mat3 viewNormal;
      uniform float time;
      varying vec3 vNormal, vPosition;
      varying vec2 vUv;
      void main () {
        vec3 normal = normalize(
          vNormal + 0.1 * vec3(
            snoise2(100.0 * vPosition.xz + 33.0),
            0.0,
            snoise2(100.0 * vPosition.xz)
          )
        );
        float lighting = 0.5 + 0.5 * dot(normal, vec3(0.0, 0.0, -1.0));
        float occlusion = min(
          1.0,
          0.05 + pow(length(vPosition.xz), 1.0)
        );
        vec3 fog = vec3(0.25, 0.3, 0.27) * 0.9;
        float baseColorNoise = snoise2(vPosition.xz * 50.0) * 0.5 + 0.5;
        vec3 baseColor = mix(
          vec3(0.5, 0.6, 0.7),
          vec3(0.5, 0.5, 0.2),
          baseColorNoise
        );
        baseColor = mix(
          baseColor,
          vec3(0.5, 0.7, 0.5),
          0.5 + 0.5 * snoise2(vPosition.xz * 3.0)
        );
        vec3 color = mix(baseColor * lighting, fog, occlusion);

        gl_FragColor = vec4(color, 1.0);
      }`,
    attributes: {
      position: plane.positions,
      uv: plane.uvs
    },
    elements: plane.cells,
    uniforms: {
      time: ({time}) => time
    }
  })
}
