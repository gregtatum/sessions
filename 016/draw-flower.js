const glsl = require('glslify')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const vec3 = require('gl-vec3')
const simplex = new (require('simplex-noise'))()

module.exports = function createDrawFlower (regl, mesh) {
  const model = mat4.translate([], mat4.identity([]), [0.1, 0.05, 0])
  const morph = mat4.identity([])

  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, morph, view, projection, projView;
      uniform mat3 normalModel, normalMorph, normalView;
      uniform vec3 cameraPosition;
      varying vec3 vNormal, vCameraVector;

      void main() {
        float unitHeight = clamp(position.y + 0.8, 0.0, 1.0);
        vec4 position4 = vec4(position, 1.0);

        vec4 morphedPosition = mix(
          model * position4,
          morph * model * position4,
          unitHeight
        );

        vNormal = normalView * mix(
          normalModel * normal,
          normalMorph * normalModel * normal,
          unitHeight
        );

        vCameraVector = normalView * (morphedPosition.xyz - cameraPosition);

        gl_Position = projView * morphedPosition;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      #pragma glslify: hueShift = require(../common/glsl/hue-shift)
      #pragma glslify: rgb2hsl = require(../common/glsl/rgb2hsl)
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      uniform sampler2D matcapTexture;
      varying vec3 vNormal, vCameraVector;
      uniform float hueShiftAmount, saturationShiftAmount, lightnessShiftAmount, edgeGlow, brightness;

      void main() {
        vec3 normal = normalize(vNormal);
        vec2 uv = matcap(
          normalize(vCameraVector),
          normal
        );

        float edge = edgeGlow * pow(1.0 - dot(normal, vec3(0.0, 0.2, 0.9)), 2.0);
        vec3 color = texture2D(matcapTexture, uv).rgb;
        vec3 hslColor = rgb2hsl(color);
        hslColor[0] += hueShiftAmount;
        hslColor[1] += saturationShiftAmount;
        hslColor[2] += lightnessShiftAmount;
        vec3 rgbColor = hsl2rgb(hslColor);
        gl_FragColor = vec4(edge + brightness * rgbColor, 1.0);
      }
    `,
    uniforms: {
      model: model,
      normalModel: mat3.normalFromMat4([], model),
      morph: createUpdateMorph(model),
      normalMorph: createUpdateNormalMorph(model),
      matcapTexture: regl.prop('matcapTexture'),
      edgeGlow: 0.4,
      brightness: 1.0,
      hueShiftAmount: 0.3,
      saturationShiftAmount: 0.2,
      lightnessShiftAmount: 0
    },
    cull: { enable: true }
  })
}

function createUpdateMorph (model) {
  const center = 0.1
  const toCenter = [0, -center, 0]
  const fromCenter = [0, center, 0]
  return ({time}) => {
    mat4.identity(model)
    mat4.translate(model, model, toCenter)
    mat4.rotateZ(model, model, simplex.noise2D(time * 0.2, 0) * 0.1 + 0.7)
    mat4.translate(model, model, fromCenter)
    return model
  }
}

function createUpdateNormalMorph (model) {
  let normalModel = mat3.identity([])
  return () => mat3.normalFromMat4(normalModel, model)
}
