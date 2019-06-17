const createBox = require('geo-3d-box')
const mat4 = require('gl-mat4')
const glsl = require('glslify')

module.exports = function createDrawBox(regl) {
  const mesh = createBox({size: [ 0.1, 0.1, 0.1 ]})
  const boxModel = mat4.identity([]);
  const drawBox = regl({
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      model: boxModel,
      // normalModel: () => mat3.normalFromMat4([], model),
    },
    elements: mesh.cells
  });

  return { drawBox, boxModel }
}
