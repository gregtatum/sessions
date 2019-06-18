const createBox = require('geo-3d-box')
const mat4 = require('gl-mat4')
const glsl = require('glslify')

const _a0 = []
const _a1 = []

module.exports = function createDrawBox(regl) {
  const mesh = createBox({size: [ 0.1, 0.1, 0.1 ]})
  const boxModel = mat4.identity([]);
  const drawBox = regl({
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      model: (ctx, {position, size}) => {
        _a1[0] = size;
        _a1[1] = size;
        _a1[2] = size;
        return mat4.translate(
          _a0,
          mat4.scale(
            _a0,
            mat4.identity(_a0),
            _a1
          ),
          position
        )
      },
      // normalModel: () => mat3.normalFromMat4([], model),
    },
    elements: mesh.cells
  });

  return { drawBox, boxModel }
}
