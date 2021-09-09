const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const quad = require('../common/quads')
const quat = require('gl-quat')
const { cos, sin, max, min } = Math

module.exports = function (regl, mesh) {
  const primitive = 'triangles'
  const model = mat4.identity([])
  const identity = mat4.identity([])

  return regl({
    vert: glsl`
      precision highp float;
      attribute vec3 normal, position;
      attribute float label;
      uniform vec2 yBounds;
      uniform mat4 model, view, projection;
      uniform mat3 normalModel, normalView;
      uniform float time, tiltAmount, id;
      varying vec3 vNormal, vPosition, vPositionOriginal;
      varying float vLabel;

      #pragma glslify: map = require(glsl-map)

      vec3 rotateY(vec3 vector, float theta) {
        return vec3(
          vector.z * sin(theta) + vector.x * cos(theta),
          vector.y,
          vector.z * cos(theta) - vector.x * sin(theta)
        );
      }

      vec3 rotateZ(vec3 vector, float theta) {
        return vec3(
          vector.y * sin(theta) + vector.x * cos(theta),
          vector.y * cos(theta) - vector.x * sin(theta),
          vector.z
        );
      }

      void main() {
        vNormal = normalView * normalModel * normal;
        vPositionOriginal = position;
        float yBoundsLength = yBounds[1] - yBounds[0];
        vPosition = rotateZ(
          position,
          map(
            position.y,
            yBounds[0] - yBoundsLength * 0.5,
            yBounds[1],
            0.0,
            tiltAmount + sin(time + id) * 0.025
          )
        );
        vLabel = label;
        gl_Position = projection * view * model * vec4(vPosition, 1.0);
      }
    `,
    frag: glsl`
      precision highp float;
      #pragma glslify: matcap = require(matcap)
      uniform vec3 cameraPosition;
      uniform sampler2D matcapTexture;
      uniform float time;
      varying vec3 vNormal, vPosition, vPositionOriginal;
      varying float vLabel;

      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      #pragma glslify: noise3d = require(glsl-noise/simplex/3d)
      #pragma glslify: noise2d = require(glsl-noise/simplex/2d)

      vec2 rotate2d(vec2 p, float theta) {
        float c = cos(theta);
        float s = sin(theta);
        float x = p.x;
        float y = p.y;
        return vec2(
          x * c - y * s,
          x * s + y * c
        );
      }

      vec3 stem() {
        float noise = noise2d(vPositionOriginal.xz * 100.0);
        float brightness = 0.95 + 0.05 * sin(
          10.0 * atan(vPositionOriginal.x + noise * 0.02, vPositionOriginal.z)
        );
        return vec3(1.0, 0.95, 0.8) * brightness;
      }

      vec3 headTop() {
        float twistyNoise = noise2d(
          rotate2d(
            vPositionOriginal.xz * 0.3,
            sin(20.0 * length(vPositionOriginal.xz))
          ) * 20.0
        );
        float grain = noise2d(vPositionOriginal.xz * 170.0);
        float spots = (1.0 - max(0.0, grain * grain * grain));
        float veins = 0.3 * max(
          0.0,
          1.0 - sin(20.0 * atan(vPositionOriginal.x, vPositionOriginal.z))
        );
        return (
          hsl2rgb(0.1, 0.3, 0.5) *
          mix(0.9, 1.0, twistyNoise + grain * 0.3 + veins)
          * mix(spots, 1.0, 0.5)
        );
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec2 uv = matcap(cameraPosition, normal);
        vec3 texture = texture2D(matcapTexture, uv).rgb;
        float textureAlpha = 0.2 + 0.2 * (texture.r + texture.g + texture.b);
        vec3 color;
        vec3 headTopResult = headTop();

        if (vLabel == 0.0) {
          color = stem();
        } else if (vLabel <= 1.0) {
          color = headTopResult;
        } else {
          // Head bottom
          float veins = max(
            0.0,
            1.0 - sin(100.0 * atan(vPositionOriginal.x, vPositionOriginal.z))
          );
          // Mix in the top result a bit
          color = mix(
            hsl2rgb(0.1, 0.2, 0.5) * mix(0.8, 1.0, veins),
            headTopResult,
            0.5
          );
        }

        // Top light
        color *= mix(
          (0.5 + 0.5 * dot(normal, vec3(0.0, 1.0, 0.0))),
          2.8,
          0.25
        );

        // Fake ambient occlusion
        color *= (vPosition.y + 0.5) * 1.5;

        // Rim lighting
        float rimLight = (0.5 + 0.5 *
          dot(
            normal,
            normalize(vec3(-1.0, 0.5, -1.0))
          )
        );
        color *= mix(1.0, 5.0 * rimLight * rimLight, 0.2);

        gl_FragColor = vec4(color * textureAlpha, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals,
      label: mesh.labels,
    },
    uniforms: {
      yBounds: mesh.yBounds,
      model: (_, {position, orientation, scale}) => mat4.translate(
        model,
        mat4.rotateY(
          model,
          mat4.scale(
            model,
            identity,
            [scale, scale, scale]
          ),
          orientation
        ),
        position
      ),
      normalModel: () => mat3.normalFromMat4([], model),
      tiltAmount: regl.prop('tiltAmount'),
      id: regl.prop('id'),
      matcapTexture: regl.prop('assets.matcapTexture'),
    },
    elements: quad.elementsFromQuads(regl, mesh, primitive),
    primitive: primitive,
    cull: { enable: true }
  })
}
