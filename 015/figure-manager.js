const mat3 = require('gl-mat3')
const mat4 = require('gl-mat4')
const simplex = new (require('simplex-noise'))()
const createDrawMask = require('./mask')


module.exports = function createDrawFigures (regl, drawMaskBody) {
  const poses = createPoses()
  const updateHeadModel = createUpdateHeadModel()
  const drawMasks = poses.map(pose => createDrawMask(regl, pose))

  return (time, assets) => {
    poses.forEach((pose, i) => {
      updateHeadModel(pose, time)
      pose.matcapTexture = assets.matcapTexture
      drawMasks[i](pose)
      drawMaskBody(pose)
    })
  }
}

function createPoses () {
  const poses = [
    {
      model: mat4.translate([], mat4.identity([]), [-0.1, -0.1, 0.2]),
      offset: 0,
      speed: 1,
      z: -0.01
    },
    {
      model: mat4.translate([], mat4.identity([]), [0.15, -0.1, -0.3]),
      offset: 100,
      speed: 0.5,
      w: 0.28,
      h: 0.2,
      d: 0.08,
      antlerShrink: 0.55,
      antlerLength: 0.010,
      initialAntlerExtrude: 0.005,
      antlerDepth: 1,
      antlersScale: 1.5,
      antlersRotation: 0.2,
      antlersOutward: 0.02,
      antlersWaveAmount: 0.00,
      simplexAmount: 0.005,
      simplexScale: 5,
      simplexOffset: 3,
      x: 0,
      y: 0.03,
      z: 0,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-0.2, 0.0, -0.4]),
      offset: -100,
      speed: 0.5,
      radius: 0.15,
      w: 0.35,
      h: 0.3,
      d: 0.05,
      antlerDepth: 7,
      antlerShrink: 0.75,
      antlerLength: 0.010,
      initialAntlerExtrude: 0.01,
      antlersScale: 2,
      antlersRotation: 0.1,
      antlersOutward: 0.02,
      antlersWaveAmount: 0.02,
      simplexOffset: 0,
      simplexAmount: 0.01,
      simplexScale: 2,
      x: 0,
      y: 0,
      z: 0,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-1.2, -0.2, -0.6]),
      offset: 200,
      speed: 1,
      radius: 0.015,
      w: 0.25,
      h: 0.4,
      d: 0.05,
      antlerDepth: 7,
      antlerShrink: 0.99,
      antlerLength: 0.015,
      initialAntlerExtrude: 0.01,
      antlersScale: 1.5,
      antlersRotation: 0.3,
      antlersOutward: 0.04,
      antlersWaveAmount: 0.05,
      simplexOffset: 0,
      simplexAmount: 0.00,
      simplexScale: 5,
      x: 0,
      y: -0.03,
      z: -0.01,
    },
    {
      model: mat4.translate([], mat4.identity([]), [0.52, -0.0, -1.8]),
      offset: 400,
      speed: 1,
      radius: 0.015,
      w: 0.25,
      h: 0.3,
      d: 0.05,
      antlerDepth: 7,
      antlerShrink: 0.85,
      antlerLength: 0.025,
      initialAntlerExtrude: 0.01,
      antlersScale: 2,
      antlersRotation: 0.3,
      antlersOutward: 0.04,
      antlersWaveAmount: 0.05,
      simplexOffset: 0,
      simplexAmount: 0.03,
      simplexScale: 1,
      x: 0,
      y: 0,
      z: 0,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-0.55, -0.14, -0.10]),
      offset: 500,
      speed: 1,
      radius: 0.015,
      w: 0.25,
      h: 0.3,
      d: 0.02,
      antlerDepth: 4,
      antlerShrink: 0.75,
      antlerLength: 0.015,
      initialAntlerExtrude: 0.04,
      antlersScale: 2,
      antlersRotation: 0.1,
      antlersOutward: 0.04,
      antlersWaveAmount: 0.025,
      simplexOffset: 0,
      simplexAmount: 0.00,
      simplexScale: 5,
      x: 0,
      y: 0.01,
      z: -0.02,
    },
    {
      model: mat4.translate([], mat4.identity([]), [0.5, -0.14, -0.12]),
      offset: 600,
      speed: 2,
      radius: 0.015,
      w: 0.25,
      h: 0.2,
      d: 0.05,
      antlerDepth: 5,
      antlerShrink: 0.65,
      antlerLength: 0.025,
      initialAntlerExtrude: 0.01,
      antlersScale: 2,
      antlersRotation: 0.3,
      antlersOutward: 0.04,
      antlersWaveAmount: 0.05,
      simplexOffset: 0,
      simplexAmount: 0.00,
      simplexScale: 5,
      x: 0,
      y: 0.05,
      z: -0.03,
    },
  ]

  poses.forEach(pose => {
    pose.normalModel = mat3.normalFromMat4([], pose.model)
  })

  return poses
}

function createUpdateHeadModel () {
  return (() => {
    const out = []
    const eye = [0, 0, -1]
    const center = [0, 0, 0]
    const up = [0, 1, 0]
    const inv = []
    return (pose, time) => {
      const {offset} = pose
      center[0] = simplex.noise2D(time * 0.1, offset) * 0.05
      center[1] = simplex.noise2D(time * 0.1, offset + 10) * 0.025
      up[0] = simplex.noise2D(time * 0.1, offset + 10) * 0.25

      eye[0] = simplex.noise2D(pose.speed * time * 0.05, offset) * 1
      // return mat4.identity(out)
      pose.headModel = mat4.lookAt(out, center, eye, up)
      pose.normalHeadModel = mat3.normalFromMat4(inv, pose.headModel)
    }
  })()
}
