const mat3 = require('gl-mat3')
const mat4 = require('gl-mat4')
const simplex = new (require('simplex-noise'))()


module.exports = function createDrawFigures (drawMask, drawMaskBody) {
  const poses = createPoses()
  const updateHeadModel = createUpdateHeadModel()
  return (time, assets) => {
    poses.forEach((pose) => {
      updateHeadModel(pose, time)
      pose.matcapTexture = assets.matcapTexture
      drawMask(pose)
      drawMaskBody(pose)
    })
  }
}

function createPoses () {
  const poses = [
    {
      model: mat4.translate([], mat4.identity([]), [-0.1, 0, 0.2]),
      offset: 0,
      speed: 1,
    },
    {
      model: mat4.translate([], mat4.identity([]), [0.15, -0.1, -0.3]),
      offset: 100,
      speed: 0.5,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-0.3, 0.0, -0.4]),
      offset: -100,
      speed: 0.5,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-1.2, -0.2, -0.6]),
      offset: 200,
      speed: 1,
    },
    {
      model: mat4.translate([], mat4.identity([]), [0.52, -0.0, -1.8]),
      offset: 400,
      speed: 1,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-0.35, -0.14, -0.10]),
      offset: 500,
      speed: 1,
    },
    {
      model: mat4.translate([], mat4.identity([]), [0.4, -0.14, -0.12]),
      offset: 600,
      speed: 2,
    },
    {
      model: mat4.translate([], mat4.identity([]), [-1.0, 0, -1.8]),
      offset: 600,
      speed: 3,
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
