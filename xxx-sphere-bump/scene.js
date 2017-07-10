const vec3 = require('gl-vec3')
const mat3 = require('gl-mat3')
const mat4 = require('gl-mat4')
const createControls = require('orbit-controls')
const createCamera = require('perspective-camera')
const simplex = new (require('simplex-noise'))()

const TAU = 6.283185307179586
const FOV = TAU * 0.1
const ORIGIN = [0, 0, 0]

module.exports = function (regl) {
  const camera = createCamera({
    fov: FOV,
    near: 0.01,
    far: 100,
    position: [0, 0, 1]
  })

  const controls = createControls({
    phi: TAU * 0.2,
    theta: 0.0,
    distanceBounds: [0.5, 1.5],
    phiBounds: [Math.PI * 0.4, Math.PI * 0.6],
    thetaBounds: [Math.PI * -0.12, Math.PI * 0.12],
    zoomSpeed: 0,
    pinchSpeed: 0,
    rotateSpeed: 0.01,
    damping: 0.01,
    parent: regl._gl.canvas,
    element: regl._gl.canvas
  })

  camera.update()

  const cameraPositionNoise = [0, 0, 0]
  const cameraDirectionNoise = [0, 0, 0]
  const cameraNoiseSize = 0.03

  let prevTick
  function update (callback) {
    return ({time, tick, viewportWidth, viewportHeight}) => {
      if (tick !== prevTick) {
        // vec3.rotateY(controls.position, controls.position, ORIGIN, 0.001)
        controls.update()
        controls.copyInto(camera.position, camera.direction, camera.up)
        camera.viewport[2] = viewportWidth
        camera.viewport[3] = viewportHeight
        cameraPositionNoise[0] = cameraNoiseSize * simplex.noise2D(time * 0.15, 0)
        cameraPositionNoise[1] = cameraNoiseSize * simplex.noise2D(0, time * 0.15)
        cameraPositionNoise[2] = cameraNoiseSize * simplex.noise2D(100, time * 0.15)
        cameraDirectionNoise[0] = 0.04 * simplex.noise2D(time * 0.13, -100)
        vec3.add(camera.position, camera.position, cameraPositionNoise)
        vec3.normalize(camera.direction,
          vec3.add(camera.direction, camera.direction, cameraDirectionNoise)
        )

        camera.update()
        prevTick = tick
      }
      return callback.apply(null, arguments)
    }
  }

  return regl({
    uniforms: {
      projection: update(() => camera.projection),
      view: () => camera.view,
      projView: () => camera.projView,
      inverseProjection: () => mat4.invert([], camera.projection),
      inverseView: () => mat4.invert([], camera.view),
      viewNormal: withArrays(1, ([out]) => mat3.normalFromMat4(out, camera.view)),
      projectionViewNormal: withArrays(1, ([out]) => mat3.normalFromMat4(out, camera.projView)),
      light0: vec3.normalize([], [0, 1, 0.1]),
      light1: vec3.normalize([], [0.5, -1, 0.5]),
      light2: vec3.normalize([], [-0.5, 0.2, 0.8]),
      lightColor0: vec3.scale([], [1.0, 0.9, 0.9], 0.6),
      lightColor1: vec3.scale([], [0.8, 1.0, 1.0], 0.6),
      lightColor2: vec3.scale([], [0.8, 0.8, 1.0], 0.6),
      time: ({time}) => time,
      cameraPosition: () => camera.position
    },
    context: {
      fov: FOV
    }
  })
}

function withArrays (length, callback) {
  const arrays = []
  for (let i = 0; i < length; i++) {
    arrays.push([])
  }
  const args = [arrays]
  return (context, props) => {
    for (let i = 0; i < arguments.length; i++) {
      args[i + 1] = arguments[i]
    }
    return callback.apply(null, args)
  }
}
